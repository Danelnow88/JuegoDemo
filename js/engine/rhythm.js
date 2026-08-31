// ===== ENGINE: ritmo (visuales reactivos a música externa) =====
// Captura una fuente de audio externa (getDisplayMedia con pestaña/ventana elegida
// por el usuario, o micrófono como fallback), la analiza en tiempo real con un
// AnalyserNode y publica valores normalizados (beat/bass/mids/highs/energy) para
// la capa de render rítmica.
//
// Reglas de diseño (Bloque 1):
//  - La cadena de análisis NO se conecta a destination: el usuario sigue escuchando
//    su música desde su propia fuente; no la re-amplificamos (fin estético/immersivo).
//  - Manejos de fallo: permiso denegado, cierre de la pestaña/ventana de origen,
//    capacidad no soportada (getDisplayMedia ausente) y re-entrada (doble start).
//  - Es testeable headless inyectando navigator.mediaDevices, window.AudioContext
//    y callback onStateChange en el sandbox (patrón del resto del proyecto).
(() => {
  'use strict';
  const NV = window.NV;

  const RHYTHM_STORAGE_KEY = 'neonVoidRhythm';

  const DEFAULT_STATE = {
    enabled: false,          // preferencia persistida: usar música propia + visuales
    state: 'off',            // 'off'|'starting'|'listening'|'denied'|'unsupported'|'stopping'
    active: false,
    source: null,            // 'tab' | 'mic'
    mode: null,              // alias semántico para la UI/tests ('tab' | 'mic')
    error: null,
    streamEnded: false,
    stream: null,            // MediaStream activo (si hay captura)
    audioCtx: null,          // AudioContext dedicado (NO el de synth.js)
    sourceNode: null,
    analyser: null,
    data: null,              // Uint8Array de frecuencias
    // Valores analizados por frame (0..1), publicados para la capa de render.
    beat: 0, bass: 0, mids: 0, highs: 0, energy: 0, peak: 0,
    onset: 0, kick: 0, snare: 0, hats: 0, spectralFlux: 0, tempoBpm: 0,
    onsetRate: 0,            // eventos percusivos por segundo (ventana 2s)
    onsetEvt: 0, kickEvt: 0, snareEvt: 0, // score del último pick (sin decay)
    // "Carácter" musical (Bloque 3): densidad percusiva, punch de graves y
    // acento de downbeat. Alimentan la ganancia de render.
    density: 0,              // onsetRate suavizado (~5s de integración)
    punch: 0,                // transitoriedad de graves (0..1)
    accent: 0,               // 1 = golpe alineado a la grilla estimada
    lastAlpha: 0,            // alfa del último draw (verificación/medición)
    _phase: 0,               // fase contra la grilla de tempo (PLL simple)
    _lastNow: 0,
    lastBeatAt: 0, lastOnsetAt: 0,
    lastShakeAt: -99,
    thresholdRel: 1.22,      // energía de graves vs. línea base P55 para disparar beat
    // Internos de suavizado / detección.
    _bassHist: null,
    _hist: null,             // historias móviles para umbrales robustos + AGC
    _pp: null,               // buffers de peak-picking (máximo local ±3 frames)
    _evtTimes: null,         // tiempos de eventos percusivos (para onsetRate)
    _prevBands: null,
    _onsetTimes: null,
    energyRaw: 0,            // energía cruda pre-AGC (diagnóstico en consola)
    dynRange: 0,             // rango dinámico observable P95-P05 (diagnóstico)
    // Límites de seguridad (Bloque 3, "regla de oro"): el efecto NUNCA compite con
    // enemigos/balas/HUD. Se usan como tope duro de saturación y opacidad.
    intensityCap: 0.55,
    maxAlpha: 0.32,
    onStateChange: null,     // callback para la UI (estado -> menú)
  };

  function freshState() {
    const s = Object.assign({}, DEFAULT_STATE);
    s._bassHist = new Array(44).fill(0);
    s._prevBands = { bass: 0, mids: 0, highs: 0, kick: 0, snare: 0, hats: 0 };
    s._onsetTimes = [];
    s._pp = { flux: [], kick: [], snare: [], lastFlux: -9, lastKick: -9, lastSnare: -9 };
    s._evtTimes = [];
    return s;
  }

  NV.rhythm = freshState();
  NV.rhythmFreshState = freshState; // expuesto para tests/diagnóstico (estado limpio por perfil)

  // ---------- persistencia (mismo patrón que neonVoidMeta) ----------
  function savePref() {
    try { localStorage.setItem(RHYTHM_STORAGE_KEY, JSON.stringify({ enabled: !!NV.rhythm.enabled, source: NV.rhythm.source })); }
    catch (e) { if (console && console.warn) console.warn('[RHYTHM] No se pudo persistir:', e); }
  }
  function loadPref() {
    try { return JSON.parse(localStorage.getItem(RHYTHM_STORAGE_KEY) || '{}'); }
    catch (e) { return {}; }
  }

  // Restaura la preferencia guardada (se llama una vez al iniciar).
  NV.rhythmRestorePref = function () {
    const p = loadPref();
    NV.rhythm.enabled = !!p.enabled;
    if (p.source === 'tab' || p.source === 'mic') { NV.rhythm.source = p.source; NV.rhythm.mode = p.source; }
    return NV.rhythm;
  };
  // Cambia la preferencia persistida (música propia + visuales) y notifica.
  NV.rhythmToggleEnabled = function (v) {
    NV.rhythm.enabled = !!v;
    savePref();
    _notify();
    return NV.rhythm.enabled;
  };
  // Permite que la UI se suscriba a cambios de estado.
  NV.rhythmNotifier = function (fn) { NV.rhythm.onStateChange = (typeof fn === 'function') ? fn : null; };

  // Detección de captura de pestaña/sistema vía getDisplayMedia (única vía real).
  NV.rhythmSupported = function () {
    const nav = (typeof navigator !== 'undefined') ? navigator : (window && window.navigator);
    const md = nav ? nav.mediaDevices : null;
    return !!(md && typeof md.getDisplayMedia === 'function');
  };

  function _notify() {
    if (typeof NV.rhythm.onStateChange === 'function') NV.rhythm.onStateChange(NV.rhythm);
  }

  // ---------- análisis puro (Bloque 2 usa la misma función) ----------
  function bandEnergy(data, lo, hi) {
    let sum = 0, n = 0;
    for (let i = lo; i < hi && i < data.length; i++) { sum += data[i]; n++; }
    return n ? (sum / n) / 255 : 0;
  }
  function posFlux(now, prev) { return Math.max(0, (now || 0) - (prev || 0)); }
  // ---------- Bloque 1: estadística robusta + AGC ----------
  const HIST_LEN = 240; // ~4s a 60fps
  function pushHist(h, v) { h.push(v); if (h.length > HIST_LEN) h.shift(); }
  function pct(arr, p) {
    if (!arr.length) return 0;
    const s = arr.slice().sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.max(0, Math.round((s.length - 1) * p)))];
  }
  // Umbral robusto: mediana + k·MAD. La media móvil EMA se contaminaba con los
  // propios golpes detectados (en música densa la media sube hasta absorber los
  // transientes => contraste colapsa, sd/media ~0.6). Mediana+MAD no se deja
  // arrastrar por los picos: el umbral se queda cerca del "silencio relativo"
  // aunque la pista tenga 16 golpes/segundo.
  function robustThr(hist, k, floor) {
    if (hist.length < 24) return floor;
    const med = pct(hist, 0.5);
    const dev = hist.map((v) => Math.abs(v - med)).sort((a, b) => a - b);
    const mad = dev[Math.floor(dev.length / 2)] * 1.4826;
    return Math.max(floor, med * 1.12, med + k * mad);
  }
  // AGC de energía: normaliza contra el rango dinámico REAL de la pista.
  // Mapeo mediana->0.5 con half-range P95-P05: los percentiles extremos tipo
  // P10 fallan cuando la distribución está sesgada (en deathcore el muro está
  // activo >90% del tiempo y P10 cae DENTRO de la masa central => energy~0).
  // Con mediana como ancla, "energía" = posición relativa dentro del rango del
  // propio tema. Se preserva parte del volumen absoluto (factor `loud`) para
  // no borrar la diferencia perceptual suave/fuerte entre géneros.
  // Peak-picking causal: el frame es evento solo si su flujo supera a los 3
  // frames previos (ventana local) y pasa el umbral + refractario del caller.
  // NOTA: la ventana simétrica ±3 (textbook) es inviable a densidad extrema:
  // con blast a 16Hz (golpe cada 3-4 frames) la ventana de 7 siempre contiene
  // 2+ picos y el más nuevo rechaza al central => se pierden la mayoría de los
  // golpes. La ventana causal + refractario de 50ms garantiza exactamente un
  // evento por golpe sin multi-disparo, con latencia cero.
  function peakPick(buf, val) {
    buf.push(val);
    if (buf.length > 4) buf.shift();
    if (buf.length < 4) return null;
    const c = buf[3];
    // Tolerante a empates: dos golpes idénticos consecutivos (patrón periódico
    // estricto) producen flujos iguales; exigir c > previo los perdería todos.
    for (let i = 0; i < 3; i++) if (buf[i] > c) return null;
    return c;
  }
  function agcEnergy(state, hist) {
    state.energyRaw = state.energy;
    pushHist(hist.energy, state.energy);
    if (hist.energy.length < 30) return;
    const p05 = pct(hist.energy, 0.05);
    const p95 = pct(hist.energy, 0.95);
    const med = pct(hist.energy, 0.5);
    state.dynRange = Math.max(0, p95 - p05);
    const half = Math.max(0.035, state.dynRange / 2);
    const loud = Math.min(1, state.energyRaw * 2.5);
    const norm = Math.max(0, Math.min(1, 0.5 + (state.energyRaw - med) / (2 * half)));
    state.energy = norm * (0.45 + 0.55 * loud);
  }
  function pushTempoBeat(state, nowSec) {
    if (!nowSec) return;
    state._onsetTimes.push(nowSec);
    while (state._onsetTimes.length > 8) state._onsetTimes.shift();
    if (state._onsetTimes.length < 3) return;
    let sum = 0, n = 0;
    for (let i = 1; i < state._onsetTimes.length; i++) {
      const d = state._onsetTimes[i] - state._onsetTimes[i - 1];
      if (d < 0.03 || d > 2.5) continue;
      // Plegado de octava: los blast beats (IOI ~60ms) y los half-times (IOI
      // >1s) caen fuera del rango musical útil; se pliegan por ×2 al rango
      // 70-180 BPM antes de promediar, si no el tempo quedaba congelado en
      // metal extremo (los intervalos < 0.24s se descartaban) o disparado.
      let bpm = 60 / d;
      while (bpm < 70) bpm *= 2;
      while (bpm > 180) bpm /= 2;
      sum += bpm; n++;
    }
    if (n) state.tempoBpm += ((sum / n) - state.tempoBpm) * 0.28;
  }
  // Convierte un Uint8Array de frecuencias (getByteFrequencyData) en valores de banda.
  NV.rhythmAnalyze = function (state, data, nowSec) {
    const len = data.length;
    // Bin 0 INCLUIDO (antes arrancaba en 1): con fftSize 512 el bin 0 cubre
    // 0-93.75Hz, justo el fundamental del bombo. Excluirlo dejaba la detección
    // de beat/kick solo con los armónicos del golpe.
    const loBass = 0, hiBass = Math.max(2, Math.floor(len * 0.08));
    const loMid = Math.floor(len * 0.08), hiMid = Math.floor(len * 0.4);
    const loHi = Math.floor(len * 0.55), hiHi = len;
    const kickBand = bandEnergy(data, 0, Math.max(3, Math.floor(len * 0.055)));
    const snareBand = bandEnergy(data, Math.floor(len * 0.12), Math.max(Math.floor(len * 0.13), Math.floor(len * 0.36)));
    const hatBand = bandEnergy(data, Math.floor(len * 0.62), len);
    state.bass = bandEnergy(data, loBass, hiBass);
    state.mids = bandEnergy(data, loMid, hiMid);
    state.highs = bandEnergy(data, loHi, hiHi);
    state.energy = state.bass * 0.4 + state.mids * 0.35 + state.highs * 0.25;
    const hist = state._hist || (state._hist = { flux: [], kick: [], snare: [], energy: [], bass: [] });
    agcEnergy(state, hist);
    const prev = state._prevBands || { bass: 0, mids: 0, highs: 0, kick: 0, snare: 0, hats: 0 };
    const kickFlux = posFlux(kickBand, prev.kick);
    const snareFlux = posFlux(snareBand, prev.snare);
    const highFlux = posFlux(hatBand, prev.hats);
    const flux = kickFlux * 0.48 + snareFlux * 0.34 + highFlux * 0.18;
    pushHist(hist.flux, flux); pushHist(hist.kick, kickFlux); pushHist(hist.snare, snareFlux);
    // ---- Peak-picking (Bloque 2): un transiente solo cuenta si su flujo es
    // máximo local sobre la ventana previa y supera el umbral robusto, con
    // período refractario de ~50ms por detector (ver nota en peakPick: la
    // ventana simétrica textbook pierde golpes a densidad blast). Sin esto, un
    // mismo golpe disparaba scores en varios frames consecutivos (inflando la
    // media que alimenta el umbral adaptativo) y a densidad extrema los
    // envelopes nunca bajaban entre golpes.
    const pp = state._pp || (state._pp = { flux: [], kick: [], snare: [], lastFlux: -9, lastKick: -9, lastSnare: -9 });
    const now = nowSec || 0;
    const onsetFloor = 0.018;
    let freshOnset = 0, freshKick = 0, freshSnare = 0;
    const pkFlux = peakPick(pp.flux, flux);
    const pkKick = peakPick(pp.kick, kickFlux);
    const pkSnare = peakPick(pp.snare, snareFlux);
    if (pkFlux != null) {
      const thr = robustThr(hist.flux, 2.6, onsetFloor);
      if (flux >= thr && now - pp.lastFlux > 0.05) { pp.lastFlux = now; freshOnset = Math.min(1, (flux - thr) / 0.13); }
    }
    if (pkKick != null) {
      const thr = robustThr(hist.kick, 2.8, 0.018);
      if (kickFlux >= thr && now - pp.lastKick > 0.05) { pp.lastKick = now; freshKick = Math.min(1, (kickFlux - thr) / 0.08); }
    }
    if (pkSnare != null) {
      const thr = robustThr(hist.snare, 2.6, 0.018);
      if (snareFlux >= thr && now - pp.lastSnare > 0.05) { pp.lastSnare = now; freshSnare = Math.min(1, (snareFlux - thr) / 0.08); }
    }
    // Último pick sin decay: score del transiente confirmado más reciente
    // (lo consumen shake/lógica por evento; los envelopes de render son otros).
    if (freshOnset > 0) state.onsetEvt = freshOnset;
    if (freshKick > 0) state.kickEvt = freshKick;
    if (freshSnare > 0) state.snareEvt = freshSnare;
    // onsetRate: densidad percusiva real (eventos/segundo en ventana de 2s).
    const evt = state._evtTimes || (state._evtTimes = []);
    if (freshOnset > 0 || freshKick > 0 || freshSnare > 0) evt.push(now);
    while (evt.length && evt[0] < now - 2) evt.shift();
    state.onsetRate = evt.length / 2;
    // ---- Carácter (Bloque 3): densidad suavizada, punch de graves y acento.
    state.density += (state.onsetRate - state.density) * 0.04; // ~5s para converger
    state.punch = Math.max(state.punch * 0.9, Math.min(1, kickFlux * 2.5));
    // PLL de downbeat: avanzamos la fase con el tempo estimado y, cuando un
    // golpe fuerte cae cerca del borde de grilla (fase < 0.35), la re-anclamos.
    // Un golpe en fase => acento pleno; fuera de fase => acento parcial. Así el
    // render marca el pulso fuerte en vez de estroboscopiar cada blast hit.
    const nowS = nowSec || 0;
    const dt = Math.max(0, Math.min(0.1, nowS - (state._lastNow || nowS)));
    state._lastNow = nowS;
    const bpm = state.tempoBpm || 120;
    state._phase = ((state._phase || 0) + (bpm / 60) * dt) % 1;
    if (state.accent > 0.01) state.accent *= Math.pow(0.86, dt * 60);
    if (freshKick > 0.45 || freshOnset > 0.5) {
      if (state._phase < 0.35) { state.accent = 1; state._phase = 0.02; }
      else if (state.accent < 0.5) state.accent = 0.5;
    }
    state.spectralFlux = Math.min(1, flux * 2.8);
    state.onset = Math.max(state.onset * 0.72, freshOnset);
    state.kick = Math.max(state.kick * 0.66, freshKick);
    state.snare = Math.max(state.snare * 0.66, freshSnare);
    state.hats = Math.max(state.hats * 0.82, Math.min(1, highFlux * 4));
    // Línea de base robusta de graves (P55 móvil) para el beat: la EMA previa era
    // arrastrada hacia arriba por un muro de graves sostenido hasta anular el
    // contraste entre golpe y fondo.
    pushHist(hist.bass, state.bass);
    state.peak = Math.max(state.peak * 0.96, state.energy);
    // Beat: envelope con decay por frame. Antes el beat podía quedar "pegado"
    // porque el branch de flujo hacía Math.max(state.beat, kick) y lastBeatAt se
    // refrescaba con eventos frecuentes, evitando el decay. Ahora calculamos un
    // target instantáneo y publicamos max(beat*decay, target): sube con golpes y
    // baja aunque haya actividad musical moderada entre ellos.
    const bassBase = Math.max(0.001, pct(hist.bass, 0.55));
    const thr = Math.max(0.02, bassBase * state.thresholdRel);
    let beatTarget = 0;
    if (state.bass > thr && state.bass > 0.02) {
      const rel = state.bass / Math.max(0.05, bassBase);
      beatTarget = Math.max(beatTarget, Math.min(1, Math.max(0, (rel - state.thresholdRel) / 0.45)));
      state.lastBeatAt = nowSec || 0;
    }
    if (freshKick > 0.05 || freshOnset > 0.1) {
      // Evento de flujo espectral confirmado (peak-pick local + umbral robusto
      // + refractario): aunque el salto de graves no supere la línea base P55
      // (banda cargada de contenido melódico), el ataque sí es un golpe. Sin
      // esta vía beat quedaba en 0 con audio real aunque kick/onset se
      // detectaran correctamente. No arrastramos state.beat anterior: eso era
      // lo que lo dejaba fijo al máximo.
      beatTarget = Math.max(beatTarget, Math.min(0.85, Math.max(state.kick, freshKick, freshOnset * 0.75)));
      state.lastBeatAt = nowSec || 0;
    }
    state.beat = Math.max((state.beat || 0) * 0.78, beatTarget);
    if (freshOnset > 0.35 || freshKick > 0.45 || freshSnare > 0.45) {
      if ((nowSec || 0) - state.lastOnsetAt > 0.16) {
        state.lastOnsetAt = nowSec || 0;
        pushTempoBeat(state, nowSec || 0);
      }
    }
    state._prevBands = { bass: state.bass, mids: state.mids, highs: state.highs, kick: kickBand, snare: snareBand, hats: hatBand };
    return state;
  };
// ---------- captura ----------
  // Inicia la captura. source: 'tab' (getDisplayMedia) | 'mic' (getUserMedia).
  // Retorna una Promise que SIEMPRE resuelve (nunca rechaza): el estado queda en
  // 'listening' si funcionó, o 'denied'/'unsupported' si no, sin romper nada.
  NV.rhythmStart = function (source) {
    // Re-entrada: si ya hay captura activa o está arrancando, no volvemos a pedir
    // permiso (evita leaks y doble diálogo).
    if (NV.rhythm.stream || NV.rhythm.state === 'listening' || NV.rhythm.state === 'starting') {
      return Promise.resolve(NV.rhythm);
    }
    const src = (source === 'mic') ? 'mic' : 'tab';
    NV.rhythm.source = src;
    NV.rhythm.mode = src;
    NV.rhythm.error = null;
    NV.rhythm.streamEnded = false;
    NV.rhythm.state = 'starting';
    _notify();

    const nav = (typeof navigator !== 'undefined') ? navigator : (window && window.navigator);
    const md = nav ? nav.mediaDevices : null;
    if (!md) { NV.rhythm.state = 'unsupported'; NV.rhythm.error = 'media-devices-unavailable'; _notify(); return Promise.resolve(NV.rhythm); }

    if (src === 'tab' && typeof md.getDisplayMedia !== 'function') {
      NV.rhythm.state = 'unsupported'; NV.rhythm.error = 'get-display-media-unavailable'; _notify(); return Promise.resolve(NV.rhythm);
    }
    if (src === 'mic' && typeof md.getUserMedia !== 'function') {
      NV.rhythm.state = 'unsupported'; NV.rhythm.error = 'get-user-media-unavailable'; _notify(); return Promise.resolve(NV.rhythm);
    }

    const constraints = src === 'mic'
      ? { audio: true }
      : { video: true, audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } };
    const acquire = src === 'mic'
      ? () => md.getUserMedia(constraints)
      : () => md.getDisplayMedia(constraints);

    return acquire().then((stream) => {
      return _attachStream(stream);
    }).catch(() => {
      // Permiso denegado o abortado por el usuario.
      NV.rhythm.state = 'denied';
      NV.rhythm.error = 'permission-denied';
      _notify();
      return NV.rhythm;
    });
  };

  function _attachStream(stream) {
    const AC = (typeof window !== 'undefined') ? (window.AudioContext || window.webkitAudioContext) : null;
    if (!AC) {
      try { stream.getTracks().forEach((t) => t.stop && t.stop()); } catch (e) {}
      NV.rhythm.state = 'unsupported';
      NV.rhythm.error = 'audio-context-unavailable';
      _notify();
      return NV.rhythm;
    }
    const audioTracks = stream.getAudioTracks ? stream.getAudioTracks() : [];
    if (!audioTracks.length) {
      try { stream.getTracks().forEach((t) => t.stop && t.stop()); } catch (e) {}
      NV.rhythm.state = 'unsupported';
      NV.rhythm.error = 'no-audio-track';
      _notify();
      return NV.rhythm;
    }
    const ctx = new AC();
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    // fftSize 512 (antes 256): a 48kHz cada bin mide 93.75Hz. Con 256 el bin
    // media 187.5Hz y el fundamental del bombo (50-100Hz) caía ENTERO en el
    // bin 0, que estaba excluido de todas las bandas (loBass/kickBand arrancan
    // en bin >= 1) => la detección solo veía armónicos/agudos del golpe.
    analyser.fftSize = 512;
    // Audio REAL (getDisplayMedia): el default smoothingTimeConstant=0.8 mezcla
    // 80% del frame anterior y difumina cada transiente en ~5-8 frames, lo que
    // aplasta el flujo espectral frame-a-frame (posFlux) => kick/snare/onset
    // disparan tarde o nunca. Los tests inyectan datos crudos sin analyser, por
    // eso la simulación no reproducía esto. 0.35 deja pasar el ataque (~3%
    // residual tras 8 frames) manteniendo el análisis estable.
    analyser.smoothingTimeConstant = 0.35;
    // Rango dB más resolutivo que el default (-100..-30): el audio de pestaña a
    // volumen normal vive arriba de -85dB; ganar resolución evita que todo el
    // espectro útil se comprima en los bytes bajos.
    analyser.minDecibels = -85;
    analyser.maxDecibels = -25;
    const data = new Uint8Array(analyser.frequencyBinCount);
    // NO se conecta a destination: no re-amplificamos la música del usuario.
    src.connect(analyser);

    // Si el usuario cierra la pestaña/ventana de origen (getDisplayMedia) o detiene
    // el compartir, se detiene la captura limpiamente.
    for (const t of stream.getTracks()) {
      if (t.addEventListener) t.addEventListener('ended', () => NV.rhythmStop({ streamEnded: true }));
    }
    if (stream.addEventListener) stream.addEventListener('inactive', () => NV.rhythmStop({ streamEnded: true }));

    Object.assign(NV.rhythm, { stream, audioCtx: ctx, sourceNode: src, analyser, data, state: 'listening', active: true, error: null });
    savePref();
    _notify();
    return NV.rhythm;
  }

  // Detiene la captura y libera recursos (stream, sourceNode, AudioContext).
  NV.rhythmStop = function (opts) {
    opts = opts || {};
    const r = NV.rhythm;
    r.state = 'stopping';
    if (r.stream) { try { r.stream.getTracks().forEach((t) => { try { t.stop(); } catch (e) {} }); } catch (e) {} }
    if (r.sourceNode) { try { r.sourceNode.disconnect(); } catch (e) {} }
    if (r.audioCtx) { const c = r.audioCtx; try { if (c.close) c.close(); } catch (e) {} }
    const wasSource = (r.source === 'mic' || r.source === 'tab') ? r.source : null;
    const wasEnabled = r.enabled;
    const notifier = r.onStateChange;
    Object.assign(r, freshState(), { source: wasSource, mode: wasSource, enabled: wasEnabled, streamEnded: !!opts.streamEnded, onStateChange: notifier });
    _notify();
    return r;
  };

  // Muestreo del AnalyserNode (se llama una vez por frame desde game.js en Bloque 3).
  NV.rhythmTick = function (nowSec) {
    const r = NV.rhythm;
    if (r.state !== 'listening' || !r.analyser) return r;
    r.analyser.getByteFrequencyData(r.data);
    NV.rhythmAnalyze(r, r.data, nowSec || 0);
    return r;
  };

  // Impulso de screen-shake reactivo, reutilizable por game.js con su variable `shake`.
  // Usa SOLO onsets fuertes recientes y cooldown corto: energía sostenida no vibra.
  // Capado para ser notorio pero no mareante ni perjudicar puntería/legibilidad.
  NV.rhythmShakeBoost = function (state, nowSec) {
    const r = state || NV.rhythm;
    if (!r || !r.enabled || r.state !== 'listening') return 0;
    const now = nowSec || 0;
    if (now - (r.lastShakeAt || -99) < 0.18) return 0;
    if (now - (r.lastOnsetAt || -99) > 0.09) return 0;
    const hit = Math.max(r.kick || 0, (r.snare || 0) * 0.75, (r.onset || 0) * 0.65);
    if (hit < 0.5) return 0;
    r.lastShakeAt = now;
    return Math.min(0.26, 0.055 + hit * 0.18);
  };

  // Nebulosa decorativa de fondo: reutiliza el mismo estado NV.rhythm ya
  // calculado por rhythmTick (sin capturas/análisis extra). Va encima del
  // starfield pero debajo de toda la jugabilidad, con alfa capado y movimiento continuo.
  NV.drawRhythmNebula = function (ctx, w, h, frame) {
    const r = NV.rhythm;
    if (!r || !r.enabled || r.state !== 'listening') return;
    const cap = r.intensityCap || 0.55;
    const energy = Math.min(cap, Math.max(0, r.energy || 0));
    const beat = Math.min(cap, Math.max(0, r.beat || 0));
    const onset = Math.min(cap, Math.max(0, r.onset || 0));
    const bass = Math.min(cap, Math.max(0, r.bass || 0));
    const mids = Math.min(cap, Math.max(0, r.mids || 0));
    const highs = Math.min(cap, Math.max(0, r.highs || 0));
    const audio = Math.min(1, energy / cap);
    if (audio <= 0.006) return;

    // Deriva lineal en 360°: garantiza recorrido uniforme por toda la rueda de
    // color. La música modula fase/offset, pero no comprime la paleta a una
    // franja. `forceHue` sigue sirviendo para diagnóstico visual directo.
    let hue = (frame || 0) * 0.18 + (r.hue || 0) * 0.25 + (bass - highs) * 48 + mids * 22 + onset * 70;
    if (r.forceHue != null) hue = r.forceHue;
    hue = wrapHue(hue);
    r.nebulaHue = Math.round(hue);

    const alpha = Math.min(0.34, 0.075 + audio * 0.16 + beat * 0.09 + onset * 0.08);
    r.nebulaAlpha = alpha;
    const t = (frame || 0) * 0.004;
    const maxDim = Math.max(w, h);
    const blobs = [
      { ox: 0.50, oy: 0.48, sx: 0.16, sy: 0.12, ph: 0.0,  hue: 0,   rad: 0.84, a: 0.66, scx: 1.55, scy: 0.78, rot: -0.22 },
      { ox: 0.30, oy: 0.60, sx: 0.12, sy: 0.10, ph: 1.7,  hue: 38,  rad: 0.62, a: 0.42, scx: 1.22, scy: 0.70, rot: 0.58 },
      { ox: 0.70, oy: 0.34, sx: 0.12, sy: 0.09, ph: 3.1,  hue: 96,  rad: 0.66, a: 0.38, scx: 1.38, scy: 0.82, rot: -0.74 },
      { ox: 0.53, oy: 0.22, sx: 0.09, sy: 0.07, ph: 5.3,  hue: 158, rad: 0.48, a: 0.30, scx: 0.95, scy: 0.58, rot: 0.28 },
      { ox: 0.42, oy: 0.74, sx: 0.08, sy: 0.05, ph: 4.4,  hue: 222, rad: 0.42, a: 0.24, scx: 1.75, scy: 0.54, rot: -0.48 },
      { ox: 0.82, oy: 0.58, sx: 0.07, sy: 0.06, ph: 2.6,  hue: 286, rad: 0.38, a: 0.22, scx: 1.05, scy: 0.64, rot: 0.92 },
      { ox: 0.16, oy: 0.36, sx: 0.06, sy: 0.05, ph: 6.1,  hue: 318, rad: 0.34, a: 0.20, scx: 1.42, scy: 0.66, rot: -1.05 },
    ];

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < blobs.length; i++) {
      const b = blobs[i];
      const speed = 0.55 + i * 0.17;
      const cx = w * (b.ox + Math.sin(t * speed + b.ph) * (b.sx + highs * 0.025));
      const cy = h * (b.oy + Math.cos(t * (speed * 0.83) + b.ph) * (b.sy + bass * 0.025));
      const rad = maxDim * (b.rad + energy * 0.14 + beat * 0.08);
      const g = ctx.createRadialGradient(0, 0, rad * 0.02, 0, 0, rad);
      const ha = hue + b.hue;
      // Fade largo con muchas paradas: evita borde circular marcado y mezcla
      // varias capas de gas suave en lugar de manchas planas.
      g.addColorStop(0, hsla(ha, 76 + audio * 14, 66 + audio * 8, alpha * b.a));
      g.addColorStop(0.18, hsla(ha + 24 + onset * 16, 74, 60, alpha * b.a * 0.62));
      g.addColorStop(0.38, hsla(ha + 48 + onset * 28, 70, 53, alpha * b.a * 0.34));
      g.addColorStop(0.66, hsla(ha + 78, 64, 44, alpha * b.a * 0.14));
      g.addColorStop(0.88, hsla(ha + 112, 56, 34, alpha * b.a * 0.045));
      g.addColorStop(1, 'rgba(1,3,13,0)');
      ctx.fillStyle = g;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(b.rot + Math.sin(t * 0.33 + b.ph) * 0.08);
      ctx.scale(b.scx + bass * 0.16, b.scy + highs * 0.12);
      ctx.fillRect(-rad, -rad, rad * 2, rad * 2);
      ctx.restore();
    }
    ctx.restore();
  };

  // Capa decorativa de fondo. Debe llamarse después del fondo/starfield y antes de
  // entidades/jugabilidad. Usa alfa bajo y límites duros para no competir con HUD/combate.
  NV.drawRhythmLayer = function (ctx, w, h, frame) {
    const r = NV.rhythm;
    if (!r || !r.enabled || r.state !== 'listening') return;
    const cap = r.intensityCap || 0.55;
    const energy = Math.min(cap, Math.max(0, r.energy || 0));
    const beat = Math.min(cap, Math.max(0, r.beat || 0));
    const bass = Math.min(cap, Math.max(0, r.bass || 0));
    const mids = Math.min(cap, Math.max(0, r.mids || 0));
    const highs = Math.min(cap, Math.max(0, r.highs || 0));
    const kick = Math.min(cap, Math.max(0, r.kick || 0));
    const snare = Math.min(cap, Math.max(0, r.snare || 0));
    const hats = Math.min(cap, Math.max(0, r.hats || 0));
    const onset = Math.min(cap, Math.max(0, r.onset || 0));
    // Ganancia adaptativa por densidad (Bloque 3): con percusión espaciada cada
    // golpe pesa pleno; con blast beats (density alta) los golpes individuales
    // se atenúan y el acento de downbeat lleva el pulso — evita el muro plano
    // saturado en deathcore sin silenciar los estilos espaciados.
    const gain = 1 / (1 + (r.density || 0) / 8);
    const accent = Math.min(1, Math.max(0, r.accent || 0));
    const punch = Math.min(cap, Math.max(0, r.punch || 0));
    const beatEff = beat * gain * (0.55 + 0.45 * accent);
    const onsetEff = onset * gain * (0.5 + 0.5 * accent);
    // Soft-knee: lineal hasta el 75% del tope, compresión exponencial suave
    // encima. Un clip duro a maxAlpha aplanaba el brillo en deathcore (la
    // energía vive alta => ~45% de los frames exactamente en el cap, sin
    // variación perceptible); el knee conserva variación cerca del tope.
    const knee = (r.maxAlpha || 0.32) * 0.8;
    const raw = 0.045 + energy * 0.34 + beatEff * 0.2 + onsetEff * 0.22 + punch * 0.05;
    const alpha = raw <= knee ? raw : knee + ((r.maxAlpha || 0.32) - knee) * (1 - Math.exp(-(raw - knee) / 0.09));
    r.lastAlpha = alpha; // expuesto para verificación/medición de variación real
    if (alpha <= 0.01) return;

    const lowDom = bass + kick * 0.8;
    const midDom = mids + snare * 0.65;
    const highDom = highs + hats * 0.75;
    const tempo = Math.max(60, Math.min(190, r.tempoBpm || 96));
    const tempoRate = tempo / 120;
    const domSum = Math.max(0.001, lowDom + midDom + highDom);
    // Hue por BANDA DOMINANTE (argmax), no promedio: la mezcla lineal colapsaba
    // en 143-201 (verde/cian) con mezclas realistas. Cada familia tiene su hue,
    // con transición parcial hacia la secundaria + deriva temporal lenta para
    // recorrer toda la rueda. `NV.rhythm.forceHue` permite fijar colores puros
    // (0=rojo, 60=amarillo, 120=verde, 180=cian, 240=azul, 300=magenta) para
    // verificación visual directa.
    const lw = lowDom, mw = midDom, hw = highDom;
    const entries = [[lw, 205], [mw, 55], [hw, 320]].sort((a, b) => b[0] - a[0]);
    let baseHue = entries[0][1];
    const total = Math.max(0.001, lw + mw + hw);
    const secondShare = entries[1][0] / total; // influencia de la banda secundaria
    baseHue += (entries[1][1] - baseHue) * Math.min(0.45, secondShare * 0.6);
    let hue = baseHue + (frame || 0) * 0.25 + onset * 30 + (tempo - 120) * 0.4; // deriva lenta ~1 ciclo/24s
    if (r.forceHue != null) hue = r.forceHue;
    hue = wrapHue(hue);
    r.hue = Math.round(hue); // expuesto para diagnóstico/logging en consola del navegador
    const sat = Math.round(62 + Math.min(20, energy * 24 + onset * 10));
    const light = Math.round(55 + Math.min(12, highs * 10 + onset * 8));
    const coreColor = hsla(hue, sat, light + 8, alpha);
    const midColor = hsla(hue + 34 + snare * 18, sat + 3, light + 2, alpha * (0.68 + highs * 0.32));
    const outerColor = hsla(hue + 72 + hats * 20, Math.max(52, sat - 7), Math.max(42, light - 8), alpha * (0.28 + hats * 0.18));
    const edgeColor = hsla(hue + 18, sat, Math.min(74, light + 10), 1);

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const phase = (frame || 0) * 0.006 * tempoRate;
    const cx = w * (0.5 + Math.sin(phase) * (0.06 + highDom * 0.035));
    const cy = h * (0.5 + Math.cos(phase * 0.83) * (0.055 + midDom * 0.03));
    const rad = Math.max(w, h) * (0.52 + bass * 0.24 + beat * 0.16 + highDom * 0.08);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
    g.addColorStop(0, coreColor);
    g.addColorStop(0.36, midColor);
    g.addColorStop(0.72, outerColor);
    g.addColorStop(1, 'rgba(1,3,13,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // Pulso mínimo en bordes: comunica beat sin tapar proyectiles/enemigos.
    if (beat > 0.015) {
      ctx.globalAlpha = Math.min(0.22, beat * 0.42);
      ctx.strokeStyle = edgeColor;
      ctx.lineWidth = 2 + beat * 7;
      ctx.strokeRect(6, 6, w - 12, h - 12);
    }
    ctx.restore();
  };

  function wrapHue(v) { return ((v % 360) + 360) % 360; }
  function hsla(h, s, l, a) { return `hsla(${Math.round(wrapHue(h))},${Math.round(s)}%,${Math.round(l)}%,${Math.max(0, Math.min(1, a))})`; }

  // Alias público orientado a la feature: separa semánticamente esta captura externa
  // del audio synth/SFX interno del juego.
  NV.externalAudio = {
    startDisplayCapture: () => NV.rhythmStart('tab'),
    startMicCapture: () => NV.rhythmStart('mic'),
    stop: (opts) => NV.rhythmStop(opts),
    getState: () => NV.rhythm,
    supported: () => NV.rhythmSupported(),
  };
})();
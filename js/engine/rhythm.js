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
    lastBeatAt: 0, lastOnsetAt: 0,
    lastShakeAt: -99,
    thresholdRel: 1.35,      // energía de graves vs. media móvil para disparar beat
    // Internos de suavizado / detección.
    _bassHist: null,
    _bassMean: 0,
    _prevBands: null,
    _fluxMean: 0,
    _kickFluxMean: 0,
    _snareFluxMean: 0,
    _onsetTimes: null,
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
    return s;
  }

  NV.rhythm = freshState();

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
  function pushTempoBeat(state, nowSec) {
    if (!nowSec) return;
    state._onsetTimes.push(nowSec);
    while (state._onsetTimes.length > 8) state._onsetTimes.shift();
    if (state._onsetTimes.length < 3) return;
    let sum = 0, n = 0;
    for (let i = 1; i < state._onsetTimes.length; i++) {
      const d = state._onsetTimes[i] - state._onsetTimes[i - 1];
      if (d >= 0.24 && d <= 1.2) { sum += d; n++; }
    }
    if (n) state.tempoBpm += ((60 / (sum / n)) - state.tempoBpm) * 0.28;
  }
  // Convierte un Uint8Array de frecuencias (getByteFrequencyData) en valores de banda.
  NV.rhythmAnalyze = function (state, data, nowSec) {
    const len = data.length;
    const loBass = 1, hiBass = Math.max(2, Math.floor(len * 0.08));
    const loMid = Math.floor(len * 0.08), hiMid = Math.floor(len * 0.4);
    const loHi = Math.floor(len * 0.55), hiHi = len;
    const kickBand = bandEnergy(data, 1, Math.max(3, Math.floor(len * 0.055)));
    const snareBand = bandEnergy(data, Math.floor(len * 0.12), Math.max(Math.floor(len * 0.13), Math.floor(len * 0.36)));
    const hatBand = bandEnergy(data, Math.floor(len * 0.62), len);
    state.bass = bandEnergy(data, loBass, hiBass);
    state.mids = bandEnergy(data, loMid, hiMid);
    state.highs = bandEnergy(data, loHi, hiHi);
    state.energy = state.bass * 0.4 + state.mids * 0.35 + state.highs * 0.25;
    const prev = state._prevBands || { bass: 0, mids: 0, highs: 0, kick: 0, snare: 0, hats: 0 };
    const kickFlux = posFlux(kickBand, prev.kick);
    const snareFlux = posFlux(snareBand, prev.snare);
    const highFlux = posFlux(hatBand, prev.hats);
    const flux = kickFlux * 0.48 + snareFlux * 0.34 + highFlux * 0.18;
    state._fluxMean += (flux - state._fluxMean) * 0.075;
    state._kickFluxMean += (kickFlux - state._kickFluxMean) * 0.075;
    state._snareFluxMean += (snareFlux - state._snareFluxMean) * 0.075;
    const onsetFloor = 0.018;
    const onsetScore = Math.max(0, flux - Math.max(onsetFloor, state._fluxMean * 1.65)) / 0.22;
    const kickScore = Math.max(0, kickFlux - Math.max(0.018, state._kickFluxMean * 1.7)) / 0.2;
    const snareScore = Math.max(0, snareFlux - Math.max(0.018, state._snareFluxMean * 1.65)) / 0.2;
    state.spectralFlux = Math.min(1, flux * 2.8);
    const freshOnset = Math.min(1, onsetScore);
    const freshKick = Math.min(1, kickScore);
    const freshSnare = Math.min(1, snareScore);
    state.onset = Math.max(state.onset * 0.72, freshOnset);
    state.kick = Math.max(state.kick * 0.66, freshKick);
    state.snare = Math.max(state.snare * 0.66, freshSnare);
    state.hats = Math.max(state.hats * 0.82, Math.min(1, highFlux * 4));
    // Línea de base: media móvil exponencial de graves (para no disparar por ruido).
    state._bassMean += (state.bass - state._bassMean) * 0.1;
    state.peak = Math.max(state.peak * 0.96, state.energy);
    // Beat: los graves superan la línea de base por el umbral.
    const thr = (state._bassMean || 0.001) * state.thresholdRel;
    if (state.bass > thr && state.bass > 0.02) {
      state.beat = Math.max(state.kick, Math.min(1, state.bass / (Math.max(0.05, state._bassMean) * 1.8)));
      state.lastBeatAt = nowSec || 0;
    } else if ((nowSec || 0) - state.lastBeatAt > 0.25) {
      state.beat = Math.max(0, state.beat - 0.06);
    }
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
    analyser.fftSize = 256;
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
  NV.rhythmShakeBoost = function (state, nowSec) {
    const r = state || NV.rhythm;
    if (!r || !r.enabled || r.state !== 'listening') return 0;
    const now = nowSec || 0;
    if (now - (r.lastShakeAt || -99) < 0.18) return 0;
    if (now - (r.lastOnsetAt || -99) > 0.09) return 0;
    const hit = Math.max(r.kick || 0, (r.snare || 0) * 0.75, (r.onset || 0) * 0.65);
    if (hit < 0.58) return 0;
    r.lastShakeAt = now;
    return Math.min(0.16, 0.035 + hit * 0.11);
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
    const alpha = Math.min(r.maxAlpha || 0.32, 0.045 + energy * 0.34 + beat * 0.2 + onset * 0.22);
    if (alpha <= 0.01) return;

    const lowDom = bass + kick * 0.8;
    const midDom = mids + snare * 0.65;
    const highDom = highs + hats * 0.75;
    const palette = (highDom > lowDom && highDom > midDom)
      ? { core: '#bdf9ff', mid: '#ff7adf', outer: '#4ee8ff', edge: '#bdf9ff' }
      : (midDom > lowDom)
        ? { core: '#d45cff', mid: '#ff4ab4', outer: '#7cf8ff', edge: '#ff7adf' }
        : { core: '#4ee8ff', mid: '#7c5cff', outer: '#1d4dff', edge: '#4ee8ff' };
    const tempo = Math.max(60, Math.min(190, r.tempoBpm || 96));
    const tempoRate = tempo / 120;

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const phase = (frame || 0) * 0.006 * tempoRate;
    const cx = w * (0.5 + Math.sin(phase) * (0.06 + highDom * 0.035));
    const cy = h * (0.5 + Math.cos(phase * 0.83) * (0.055 + midDom * 0.03));
    const rad = Math.max(w, h) * (0.52 + bass * 0.24 + beat * 0.16 + highDom * 0.08);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
    g.addColorStop(0, `rgba(${hexRgb(palette.core)},${alpha})`);
    g.addColorStop(0.36, `rgba(${hexRgb(palette.mid)},${alpha * (0.68 + highs * 0.32)})`);
    g.addColorStop(0.72, `rgba(${hexRgb(palette.outer)},${alpha * (0.28 + hats * 0.18)})`);
    g.addColorStop(1, 'rgba(1,3,13,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // Pulso mínimo en bordes: comunica beat sin tapar proyectiles/enemigos.
    if (beat > 0.015) {
      ctx.globalAlpha = Math.min(0.22, beat * 0.42);
      ctx.strokeStyle = palette.edge;
      ctx.lineWidth = 2 + beat * 7;
      ctx.strokeRect(6, 6, w - 12, h - 12);
    }
    ctx.restore();
  };

  function hexRgb(hex) {
    const h = hex.charAt(0) === '#' ? hex.slice(1) : hex;
    return `${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)}`;
  }

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
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
    lastBeatAt: 0,
    thresholdRel: 1.35,      // energía de graves vs. media móvil para disparar beat
    // Internos de suavizado / detección.
    _bassHist: null,
    _bassMean: 0,
    // Límites de seguridad (Bloque 3, "regla de oro"): el efecto NUNCA compite con
    // enemigos/balas/HUD. Se usan como tope duro de saturación y opacidad.
    intensityCap: 0.55,
    maxAlpha: 0.32,
    onStateChange: null,     // callback para la UI (estado -> menú)
  };

  function freshState() {
    const s = Object.assign({}, DEFAULT_STATE);
    s._bassHist = new Array(44).fill(0);
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
  // Convierte un Uint8Array de frecuencias (getByteFrequencyData) en valores de banda.
  NV.rhythmAnalyze = function (state, data, nowSec) {
    const len = data.length;
    const loBass = 1, hiBass = Math.max(2, Math.floor(len * 0.08));
    const loMid = Math.floor(len * 0.08), hiMid = Math.floor(len * 0.4);
    const loHi = Math.floor(len * 0.55), hiHi = len;
    state.bass = bandEnergy(data, loBass, hiBass);
    state.mids = bandEnergy(data, loMid, hiMid);
    state.highs = bandEnergy(data, loHi, hiHi);
    state.energy = state.bass * 0.4 + state.mids * 0.35 + state.highs * 0.25;
    // Línea de base: media móvil exponencial de graves (para no disparar por ruido).
    state._bassMean += (state.bass - state._bassMean) * 0.1;
    state.peak = Math.max(state.peak * 0.96, state.energy);
    // Beat: los graves superan la línea de base por el umbral.
    const thr = (state._bassMean || 0.001) * state.thresholdRel;
    if (state.bass > thr && state.bass > 0.02) {
      state.beat = Math.min(1, state.bass / (Math.max(0.05, state._bassMean) * 1.8));
      state.lastBeatAt = nowSec || 0;
    } else if ((nowSec || 0) - state.lastBeatAt > 0.25) {
      state.beat = Math.max(0, state.beat - 0.06);
    }
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

  // Capa decorativa de fondo. Debe llamarse después del fondo/starfield y antes de
  // entidades/jugabilidad. Usa alfa bajo y límites duros para no competir con HUD/combate.
  NV.drawRhythmLayer = function (ctx, w, h, frame) {
    const r = NV.rhythm;
    if (!r || !r.enabled || r.state !== 'listening') return;
    const cap = r.intensityCap || 0.55;
    const energy = Math.min(cap, Math.max(0, r.energy || 0));
    const beat = Math.min(cap, Math.max(0, r.beat || 0));
    const bass = Math.min(cap, Math.max(0, r.bass || 0));
    const highs = Math.min(cap, Math.max(0, r.highs || 0));
    const alpha = Math.min(r.maxAlpha || 0.32, 0.045 + energy * 0.42 + beat * 0.28);
    if (alpha <= 0.01) return;

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const cx = w * (0.5 + Math.sin((frame || 0) * 0.006) * 0.08);
    const cy = h * (0.5 + Math.cos((frame || 0) * 0.005) * 0.08);
    const rad = Math.max(w, h) * (0.55 + bass * 0.25 + beat * 0.18);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
    g.addColorStop(0, `rgba(78,232,255,${alpha})`);
    g.addColorStop(0.38, `rgba(202,92,255,${alpha * (0.72 + highs * 0.35)})`);
    g.addColorStop(0.7, `rgba(255,74,180,${alpha * 0.32})`);
    g.addColorStop(1, 'rgba(1,3,13,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // Pulso mínimo en bordes: comunica beat sin tapar proyectiles/enemigos.
    if (beat > 0.015) {
      ctx.globalAlpha = Math.min(0.22, beat * 0.42);
      ctx.strokeStyle = '#4ee8ff';
      ctx.lineWidth = 2 + beat * 7;
      ctx.strokeRect(6, 6, w - 12, h - 12);
    }
    ctx.restore();
  };

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
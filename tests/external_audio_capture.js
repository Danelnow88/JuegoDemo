// Tests: captura de audio externa para visuales rítmicos (getDisplayMedia + mic fallback).
const fs = require('fs'), vm = require('vm');
let pass = 0, fail = 0;
async function t(desc, fn) {
  try { await fn(); pass++; console.log('  ok  ' + desc); }
  catch (e) { fail++; console.log('  FAIL ' + desc + ' -> ' + e.message); }
}

function mkTrack(kind) {
  const listeners = {};
  return {
    kind: kind || 'audio', stopped: false,
    addEventListener(ev, fn) { listeners[ev] = fn; },
    stop() { this.stopped = true; },
    emit(ev) { if (listeners[ev]) listeners[ev](); },
  };
}
function mkStream(opts) {
  opts = opts || {};
  const audio = opts.noAudio ? [] : [mkTrack('audio')];
  const video = opts.video ? [mkTrack('video')] : [];
  const tracks = audio.concat(video);
  const listeners = {};
  return {
    tracks,
    getTracks() { return tracks; },
    getAudioTracks() { return audio; },
    addEventListener(ev, fn) { listeners[ev] = fn; },
    emit(ev) { if (listeners[ev]) listeners[ev](); },
  };
}
function MockAudioContext() {
  this.closed = false;
  this.createMediaStreamSource = function () { return { connected: null, connect(n) { this.connected = n; }, disconnect() { this.disconnected = true; } }; };
  this.createAnalyser = function () { return { fftSize: 0, frequencyBinCount: 128, getByteFrequencyData(arr) { arr.fill(0); } }; };
  this.close = function () { this.closed = true; };
}
function loadNV(mediaDevices, extra) {
  const store = {};
  const sbx = {
    window: { NV: {}, AudioContext: MockAudioContext },
    navigator: { mediaDevices },
    localStorage: {
      getItem(k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
      setItem(k, v) { store[k] = String(v); },
      removeItem(k) { delete store[k]; },
    },
    console, Uint8Array, Promise,
  };
  if (extra) Object.assign(sbx, extra);
  vm.createContext(sbx);
  vm.runInContext(fs.readFileSync('js/engine/rhythm.js', 'utf8'), sbx, { filename: 'js/engine/rhythm.js' });
  return sbx.window.NV;
}

(async () => {
  await t('startDisplayCapture pide getDisplayMedia con audio+video y queda listening', async () => {
    let called = 0, constraints = null;
    const stream = mkStream({ video: true });
    const NV = loadNV({ getDisplayMedia(c) { called++; constraints = c; return Promise.resolve(stream); } });
    const st = await NV.externalAudio.startDisplayCapture();
    if (called !== 1) throw new Error('getDisplayMedia llamadas=' + called);
    if (!constraints.audio || !constraints.video) throw new Error('constraints incompletos');
    if (st.state !== 'listening' || !st.active || st.mode !== 'tab') throw new Error('estado incorrecto: ' + st.state);
    if (!st.analyser || !st.data) throw new Error('analizador no creado');
  });

  await t('fallback mic usa getUserMedia(audio:true)', async () => {
    let constraints = null;
    const NV = loadNV({ getUserMedia(c) { constraints = c; return Promise.resolve(mkStream()); } });
    const st = await NV.externalAudio.startMicCapture();
    if (!constraints || constraints.audio !== true) throw new Error('no pidió micrófono');
    if (st.state !== 'listening' || st.mode !== 'mic') throw new Error('mic no listening');
  });

  await t('unsupported cuando falta getDisplayMedia', async () => {
    const NV = loadNV({ getUserMedia() { return Promise.resolve(mkStream()); } });
    const st = await NV.externalAudio.startDisplayCapture();
    if (st.state !== 'unsupported') throw new Error('state=' + st.state);
    if (st.error !== 'get-display-media-unavailable') throw new Error('error=' + st.error);
  });

  await t('permiso denegado no rechaza y deja state denied', async () => {
    const NV = loadNV({ getDisplayMedia() { return Promise.reject(new Error('NotAllowedError')); } });
    const st = await NV.externalAudio.startDisplayCapture();
    if (st.state !== 'denied') throw new Error('state=' + st.state);
    if (st.error !== 'permission-denied') throw new Error('error=' + st.error);
  });

  await t('sin pista de audio limpia stream y reporta no-audio-track', async () => {
    const stream = mkStream({ noAudio: true, video: true });
    const NV = loadNV({ getDisplayMedia() { return Promise.resolve(stream); } });
    const st = await NV.externalAudio.startDisplayCapture();
    if (st.state !== 'unsupported' || st.error !== 'no-audio-track') throw new Error('fallo incorrecto');
    if (!stream.tracks.every((tr) => tr.stopped)) throw new Error('tracks no detenidos');
  });

  await t('re-entrada no abre segundo diálogo de permiso', async () => {
    let called = 0;
    const NV = loadNV({ getDisplayMedia() { called++; return Promise.resolve(mkStream()); } });
    await NV.externalAudio.startDisplayCapture();
    await NV.externalAudio.startDisplayCapture();
    if (called !== 1) throw new Error('doble getDisplayMedia: ' + called);
  });

  await t('stop libera recursos y conserva preferencia enabled/source', async () => {
    const stream = mkStream();
    const NV = loadNV({ getDisplayMedia() { return Promise.resolve(stream); } });
    NV.rhythmToggleEnabled(true);
    await NV.externalAudio.startDisplayCapture();
    const st = NV.externalAudio.stop();
    if (st.state !== 'off' || st.active) throw new Error('no apagó');
    if (!stream.tracks[0].stopped) throw new Error('track no detenido');
    if (!st.enabled || st.source !== 'tab') throw new Error('preferencia/source perdidos');
  });

  await t('evento ended marca streamEnded y detiene captura', async () => {
    const stream = mkStream();
    const NV = loadNV({ getDisplayMedia() { return Promise.resolve(stream); } });
    await NV.externalAudio.startDisplayCapture();
    stream.getAudioTracks()[0].emit('ended');
    const st = NV.externalAudio.getState();
    if (st.state !== 'off' || !st.streamEnded) throw new Error('ended no propagado');
  });

  console.log('RESULT external_audio_capture: pass=' + pass + ' fail=' + fail);
  process.exit(fail ? 1 : 0);
})();
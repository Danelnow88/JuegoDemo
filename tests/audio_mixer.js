// Tests del mixer de canales, ducking y playToneEx (Tarea 1 - arquitectura de audio).
const fs = require('fs'), vm = require('vm');
let pass = 0, fail = 0;
function t(desc, fn) { try { fn(); pass++; console.log('  ok  ' + desc); } catch (e) { fail++; console.log('  FAIL ' + desc + ' -> ' + e.message); } }

// Sandbox de AudioContext mockeado (compatible headless). Cubre solo los métodos
// que usa synth.js: createOscillator/Gain/BiquadFilter/Buffer/BufferSource + destination.
function makeSandbox(randomValue) {
  const gainApi = () => ({ value: 0, setValueAtTime(){}, linearRampToValueAtTime(){}, exponentialRampToValueAtTime(){}, cancelScheduledValues(){} });
  const ctx = {
    createOscillator: () => ({ connect(){}, start(){}, stop(){}, type:'', frequency: gainApi() }),
    createGain: () => ({ connect(){}, gain: gainApi() }),
    createBiquadFilter: () => ({ connect(){}, type:'', Q:{value:0}, frequency: gainApi() }),
    createBuffer: () => ({ getChannelData: () => new Float32Array(4410) }),
    createBufferSource: () => ({ connect(){}, start(){}, stop(){}, buffer:null }),
    destination: {}, currentTime: 0, sampleRate: 44100, state: 'suspended',
    resume: () => Promise.resolve(),
  };
  const mathMock = Object.create(Math);
  if (typeof randomValue === 'number') mathMock.random = () => randomValue;
  const sb = { console, Math: mathMock, Object, Array, Number, String, Boolean, Proxy, Reflect, window:{}, globalThis:{}, AudioContext: function () { return ctx; } };
  sb.window.AudioContext = sb.AudioContext; sb.window.NV = {}; sb._ctx = ctx; return sb;
}

function loadSynth(randomValue) {
  const sb = makeSandbox(randomValue);
  vm.runInNewContext(fs.readFileSync('js/audio/synth.js', 'utf8'), sb, { filename: 'synth.js' });
  return sb.window.NV;
}

// ---- mixer perezoso ----
t('mixer no existe hasta initAudio() (perezoso / headless-safe)', () => {
  const NV = loadSynth();
  if ('mixer' in NV) throw new Error('mixer creado antes de initAudio');
});

t('initAudio() crea el mixer con todos los canales esperados + exports', () => {
  const NV = loadSynth(); NV.initAudio();
  if (!NV.mixer) throw new Error('mixer no creado tras initAudio');
  const want = ['music', 'sfxUI', 'sfxPlayer', 'sfxEnemies', 'sfxAmbient'];
  for (const c of want) { if (typeof NV.mixer[c] !== 'object') throw new Error('canal faltante: ' + c); }
  if (typeof NV.channelFor !== 'function') throw new Error('channelFor no exportado');
  if (typeof NV.playToneEx !== 'function') throw new Error('playToneEx no exportado');
  if (typeof NV.duck !== 'function') throw new Error('duck no exportado');
  const g = NV.mixer.music.gain;
  if (typeof g.setValueAtTime !== 'function' || typeof g.linearRampToValueAtTime !== 'function') throw new Error('gain sin API de modulacion');
});

// ---- ducking ----
t('duck() no crashea si no hay mixer (headless)', () => {
  const NV = loadSynth();
  try { NV.duck('music', 0.2, 0.1); } catch (e) { throw new Error('cayo en headless: ' + e.message); }
});

t('duck() programa atenuacion sobre el gain del canal objetivo', () => {
  const NV = loadSynth(); NV.initAudio();
  const g = NV.mixer.music.gain;
  let capturedTarget = null;
  g.linearRampToValueAtTime = function (v) { capturedTarget = v; };
  NV.duck('music', 0.2, 0.18);
  if (capturedTarget !== 0.2) throw new Error('duck no rampeo a 0.2, capturo=' + capturedTarget);
});

// ---- playToneEx: detune fijo, determinista (Math.random mockeado a 0.5 => detune interno=0) ----
t('playToneEx con detune fijo ajusta la frecuencia exactamente', () => {
  const NV = loadSynth(0.5); // Math.random=0.5 anula el detune aleatorio interno de playTone
  NV.initAudio();
  let captured = 0;
  const orig = NV.audioCtx.createOscillator;
  NV.audioCtx.createOscillator = function () {
    const o = orig.call(NV.audioCtx);
    o.frequency.setValueAtTime = function (v) { captured = v; };
    return o;
  };
  // detune fijo +0.05 => freq esperada = 440 * 1.05 = 462 (sin ruido random porque Math.random=0.5)
  NV.playToneEx(440, 0.05, 'square', 0.03, { detune: 0.05 });
  if (Math.abs(captured - 462) > 0.01) throw new Error('freq=' + captured + ' (esperada 462)');
});

t('playToneEx sin detune explicito cae al comportamiento anti-fatiga aleatorio de playTone', () => {
  const NV = loadSynth(0.5); NV.initAudio();
  let captured = 0;
  const orig = NV.audioCtx.createOscillator;
  NV.audioCtx.createOscillator = function () {
    const o = orig.call(NV.audioCtx);
    o.frequency.setValueAtTime = function (v) { captured = v; };
    return o;
  };
  NV.playToneEx(440, 0.05, 'square', 0.03, {});
  // Con Math.random=0.5 el detune aleatorio interno (opts.detune undefined -> random) también da 0
  if (Math.abs(captured - 440) > 0.01) throw new Error('freq=' + captured + ' (esperada 440)');
});

// ---- exports de mixerChannels y hooks de audio adaptativo ----
t('exporta mixerChannels con los 5 canales numericos', () => {
  const NV = loadSynth();
  if (!NV.mixerChannels) throw new Error('mixerChannels no exportado');
  const want = ['music', 'sfxUI', 'sfxPlayer', 'sfxEnemies', 'sfxAmbient'];
  for (const c of want) { if (typeof NV.mixerChannels[c] !== 'number') throw new Error('canal ' + c + ' no numerico'); }
});

t('sfx incluye hooks de audio adaptativo (combo, heartbeat, countdown, bossEnter, victory)', () => {
  const NV = loadSynth(); NV.initAudio();
  const want = ['combo', 'heartbeat', 'countdown', 'bossEnter', 'victory'];
  for (const c of want) { if (typeof NV.sfx[c] !== 'function') throw new Error('sfx.' + c + ' falta'); }
});

t('sfx.combo/heartbeat/countdown/bossEnter/victory no crashean al invocarse', () => {
  const NV = loadSynth(); NV.initAudio();
  try {
    NV.sfx.combo(5); NV.sfx.heartbeat(0.8); NV.sfx.countdown(3); NV.sfx.bossEnter(); NV.sfx.victory(10);
  } catch (e) { throw new Error('sfx adaptativo lanzo: ' + e.message); }
});

// ---- playWeaponSound backwards compatible ----
t('playWeaponSound(weapon) con un solo arg no lanza (backwards compatible)', () => {
  const NV = loadSynth(); NV.initAudio();
  try { NV.playWeaponSound({ id: 'pistol' }); } catch (e) { throw new Error('playWeaponSound sin opts lanzo: ' + e.message); }
});

t('playWeaponSound(weapon, opts) respeta fusion/crit sin crash', () => {
  const NV = loadSynth(); NV.initAudio();
  try { NV.playWeaponSound({ id: 'railgun' }, { fusion: 2, crit: true, channel: 'sfxPlayer' }); } catch (e) { throw new Error('playWeaponSound con opts lanzo: ' + e.message); }
});

t('playWeaponSound cubre las 10 armas conocidas sin crash', () => {
  const NV = loadSynth(); NV.initAudio();
  const ids = ['pistol','rifle','smg','shotgun','sniper','laser','plasma','flamethrower','bow','railgun'];
  for (const id of ids) { try { NV.playWeaponSound({ id }); } catch (e) { throw new Error('arma ' + id + ' lanzo: ' + e.message); } }
});

t('playWeaponSound usa tabla declarativa con fallback seguro', () => {
  const NV = loadSynth(); NV.initAudio();
  if (!NV.WEAPON_SOUND_HANDLERS) throw new Error('WEAPON_SOUND_HANDLERS no exportado');
  const ids = ['pistol','rifle','smg','shotgun','sniper','laser','plasma','flamethrower','bow','railgun'];
  for (const id of ids) {
    if (typeof NV.WEAPON_SOUND_HANDLERS[id] !== 'function') throw new Error('handler ausente ' + id);
  }
  try { NV.playWeaponSound({ id: 'arma-futura' }, { channel: 'sfxPlayer' }); } catch (e) { throw new Error('fallback lanzo: ' + e.message); }
});

// ---- musicState expone combo y phase ----
t('musicState expone combo (number) y phase default "normal"', () => {
  const NV = loadSynth();
  if (typeof NV.musicState.combo !== 'number') throw new Error('musicState.combo no es number');
  if (NV.musicState.phase !== 'normal') throw new Error('phase default != normal, got=' + NV.musicState.phase);
});

console.log('RESULT audio_mixer: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);


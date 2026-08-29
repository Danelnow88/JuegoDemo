// Tests Audio mezcla/balance: disparos no tapados por música.
const fs = require('fs'), vm = require('vm');
let pass = 0, fail = 0;
function t(desc, fn) { try { fn(); pass++; console.log('  ok  ' + desc); } catch (e) { fail++; console.log('  FAIL ' + desc + ' -> ' + e.message); } }

function sandbox() {
  const filters = [];
  const gainApi = () => ({ value: 0.6, setValueAtTime(){}, linearRampToValueAtTime(){}, exponentialRampToValueAtTime(){}, cancelScheduledValues(){} });
  const ctx = {
    createOscillator: () => ({ connect(){}, start(){}, stop(){}, type:'', frequency: gainApi() }),
    createGain: () => ({ connect(){}, gain: gainApi() }),
    createBiquadFilter: () => ({ type:'', Q:{ value:0 }, gain: gainApi(), frequency: gainApi(), connect(){}, filters }),
    createBuffer: () => ({ getChannelData: () => new Float32Array(4410) }),
    createBufferSource: () => ({ connect(){}, start(){}, stop(){}, buffer:null }),
    createStereoPanner: () => ({ connect(){}, pan: { setValueAtTime(){} } }),
    destination: {}, currentTime: 0, sampleRate: 44100, state: 'suspended', resume: () => Promise.resolve(),
  };
  const sb = { console, Math, Object, Array, Number, String, Boolean, window:{}, globalThis:{}, AudioContext: function () { return ctx; } };
  sb.window.AudioContext = sb.AudioContext;
  sb.window.NV = { getBoss: () => null, getState: () => 'playing', getFrame: () => 0 };
  return sb;
}
function load() { const sb = sandbox(); vm.runInNewContext(fs.readFileSync('js/audio/synth.js', 'utf8'), sb, { filename: 'synth.js' }); return { NV: sb.window.NV }; }

t('sfxPlayer queda por encima de música en volumen relativo (mixer)', () => {
  const { NV } = load(); NV.initAudio();
  if (!(NV.mixerChannels.sfxPlayer > NV.mixerChannels.music)) throw new Error('sfxPlayer <= music');
});

t('el canal music aplica lowpass EQ (recorta banda del crack)', () => {
  const src = fs.readFileSync('js/audio/synth.js', 'utf8');
  if (!src.includes('lowpass') || !src.includes('6200') || !src.includes('highshelf') || !src.includes('6000')) throw new Error('falta EQ por canal');
});

t('disparar produce ducking de la música (duck music)', () => {
  const { NV } = load(); NV.initAudio();
  const g = NV.mixer.music.gain;
  let target = null;
  g.linearRampToValueAtTime = function (v) { target = v; };
  NV.playWeaponSound({ id: 'pistol' });
  if (target !== 0.3) throw new Error('no duckeo la musica al disparar, target=' + target);
});

t('la percusión de música pasa por el canal music (duckable)', () => {
  const src = fs.readFileSync('js/audio/synth.js', 'utf8');
  if (!src.includes("gain.connect(channelFor('music'))")) throw new Error('percusión no va por canal music');
});

t('createMixer inserta filtros EQ sin romper los canales', () => {
  const { NV } = load(); NV.initAudio();
  for (const c of ['music', 'sfxPlayer']) if (typeof NV.mixer[c] !== 'object') throw new Error('canal ' + c + ' ausente');
});

console.log('RESULT audio_mix_balance: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
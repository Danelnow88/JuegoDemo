// Tests Audio Bloque 3: música de tienda (boom-bap con swing, aire, acordes cálidos).
const fs = require('fs'), vm = require('vm');
let pass = 0, fail = 0;
function t(desc, fn) { try { fn(); pass++; console.log('  ok  ' + desc); } catch (e) { fail++; console.log('  FAIL ' + desc + ' -> ' + e.message); } }

function sandbox(state) {
  const gainApi = () => ({ value: 0, setValueAtTime(){}, linearRampToValueAtTime(){}, exponentialRampToValueAtTime(){}, cancelScheduledValues(){} });
  const ctx = {
    createOscillator: () => ({ connect(){}, start(){}, stop(){}, type:'', frequency: gainApi() }),
    createGain: () => ({ connect(){}, gain: gainApi() }),
    createBiquadFilter: () => ({ connect(){}, type:'', Q:{value:0}, frequency: gainApi() }),
    createBuffer: () => ({ getChannelData: () => new Float32Array(4410) }),
    createBufferSource: () => ({ connect(){}, start(){}, stop(){}, buffer:null }),
    destination: {}, currentTime: 0, sampleRate: 44100, state: 'suspended', resume: () => Promise.resolve(),
  };
  const sb = { console, Math, Object, Array, Number, String, Boolean, window:{}, globalThis:{}, AudioContext: function () { return ctx; } };
  sb.window.AudioContext = sb.AudioContext;
  sb.window.NV = { getBoss: () => null, getState: () => state || 'shop', getFrame: () => 0 };
  return sb;
}
function load(state) { const sb = sandbox(state); vm.runInNewContext(fs.readFileSync('js/audio/synth.js', 'utf8'), sb, { filename: 'synth.js' }); return { NV: sb.window.NV }; }

t('existe scheduleShopStep con boom-bap (kick 1&3, clap 2&4) y swing', () => {
  const src = fs.readFileSync('js/audio/synth.js', 'utf8');
  for (const pat of ['function scheduleShopStep', 'step === 0 || step === 8', 'step === 4 || step === 12', 'swing', '0.22']) {
    if (!src.includes(pat)) throw new Error('falta ' + pat);
  }
});

t('tienda usa acordes cálidos/organicos (triangle/sine) sin saturación', () => {
  const src = fs.readFileSync('js/audio/synth.js', 'utf8');
  for (const pat of ['function scheduleWarmChord', "'triangle', 0", "'sine', 0", "filter.frequency.setValueAtTime(1400"]) {
    if (!src.includes(pat)) throw new Error('falta ' + pat);
  }
});

t('tienda es un flujo separado del menú (aire/fill cada 4 compases)', () => {
  const src = fs.readFileSync('js/audio/synth.js', 'utf8');
  if (!src.includes("phase === 'shop'") || !src.includes('scheduleShopStep')) throw new Error('tienda no separada');
  if (!src.includes('bar % 4 === 3 && step === 14')) throw new Error('sin fill/aire de tienda');
});

t('updateMusic corre 200 steps en tienda sin crash', () => {
  const { NV } = load('shop'); NV.initAudio();
  for (let i = 0; i < 200; i++) NV.updateMusic(0.2);
  if (NV.musicState.phase !== 'shop') throw new Error('fase no quedó en shop');
});

console.log('RESULT audio_shop_music: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
// Tests Audio Bloque 1: disparos por categoría (playGunshot).
const fs = require('fs'), vm = require('vm');
let pass = 0, fail = 0;
function t(desc, fn) { try { fn(); pass++; console.log('  ok  ' + desc); } catch (e) { fail++; console.log('  FAIL ' + desc + ' -> ' + e.message); } }

function sandbox() {
  const src = new Float32Array(44100);
  const gainApi = () => ({ value: 0.6, setValueAtTime(){}, linearRampToValueAtTime(){}, exponentialRampToValueAtTime(){}, cancelScheduledValues(){}, cancelScheduledValues(){} });
  const ctx = {
    createOscillator: () => ({ connect(){}, start(){}, stop(){}, type:'', frequency: { setValueAtTime(){}, exponentialRampToValueAtTime(){} } }),
    createGain: () => ({ connect(){}, gain: gainApi() }),
    createBiquadFilter: () => ({ connect(){}, type:'', Q:{ value: 0, setValueAtTime(){} }, frequency: gainApi() }),
    createBuffer: () => ({ getChannelData: () => src }),
    createBufferSource: () => ({ connect(){}, start(){}, stop(){}, buffer:null }),
    destination: {}, currentTime: 0, sampleRate: 44100, state: 'suspended', resume: () => Promise.resolve(),
  };
  const sb = { console, Math, Object, Array, Number, String, Boolean, window:{}, globalThis:{}, AudioContext: function () { return ctx; } };
  sb.window.AudioContext = sb.AudioContext; sb.window.NV = { getBoss: () => null, getState: () => 'playing', getFrame: () => 0 };
  return sb;
}
function load() { const sb = sandbox(); vm.runInNewContext(fs.readFileSync('js/audio/synth.js', 'utf8'), sb, { filename: 'synth.js' }); return { NV: sb.window.NV }; }
const REALISTA = ['pistol', 'rifle', 'smg', 'shotgun', 'sniper', 'flamethrower', 'railgun'];
const FUTURISTA = ['laser', 'plasma'];
const ALL = REALISTA.concat(FUTURISTA, ['bow']);

t('existen playGunshot y ruido filtrado (blanco/marrón)', () => {
  const src = fs.readFileSync('js/audio/synth.js', 'utf8');
  for (const pat of ['function playGunshot', 'function scheduleFilteredNoise', 'function createNoiseBuffer', "shape === 'brown'"]) {
    if (!src.includes(pat)) throw new Error('falta ' + pat);
  }
});

t('playGunshot usa crack alto-pass + cuerpo marrón + punch sine, sin melódico', () => {
  const src = fs.readFileSync('js/audio/synth.js', 'utf8');
  if (!src.includes("filterType: 'highpass'")) throw new Error('sin crack alto-pass');
  if (!src.includes("shape: 'brown'")) throw new Error('sin cuerpo marrón');
  if (!src.includes("osc.type = 'sine'")) throw new Error('punch no es sine');
  if (!src.includes('exponentialRampToValueAtTime(Math.max(28')) throw new Error('sin caída de pitch en punch');
});

t('armas realistas usan playGunshot (crack + cuerpo + punch)', () => {
  const src = fs.readFileSync('js/audio/synth.js', 'utf8');
  for (const id of REALISTA) {
    const seg = src.slice(src.indexOf("case '" + id + "'"), src.indexOf("case '" + id + "'") + 400);
    if (!seg.includes('playGunshot')) throw new Error(id + ' no es tiro real');
    if (seg.includes('playToneEx')) throw new Error(id + ' conserva melódico (no debería)');
  }
});

t('armas futuristas conservan identidad synth y suman cuerpo ruidoso', () => {
  const src = fs.readFileSync('js/audio/synth.js', 'utf8');
  const laser = src.slice(src.indexOf("case 'laser'"), src.indexOf("case 'plasma'"));
  const plasma = src.slice(src.indexOf("case 'plasma'"), src.indexOf("case 'bow'"));
  for (const block of [laser, plasma]) {
    if (!block.includes('playToneEx') || !block.includes('scheduleFilteredNoise')) throw new Error('futurista sin tono+cuerpo');
  }
});

t('las 10 armas disparan sin crash', () => {
  const { NV } = load(); NV.initAudio();
  for (const id of ALL) NV.playWeaponSound({ id });
});

console.log('RESULT audio_gunshots: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
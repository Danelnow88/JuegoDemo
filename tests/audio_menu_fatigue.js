// Tests Audio Tarea 5: ambiente de menú y anti-fatiga en armas rápidas.
const fs = require('fs'), vm = require('vm');
let pass = 0, fail = 0;
function t(desc, fn) { try { fn(); pass++; console.log('  ok  ' + desc); } catch (e) { fail++; console.log('  FAIL ' + desc + ' -> ' + e.message); } }

function sandbox(state) {
  const freqs = [], vols = [];
  const gainApi = () => ({ value: 0.6, setValueAtTime(v){ vols.push(v); }, linearRampToValueAtTime(){}, exponentialRampToValueAtTime(){}, cancelScheduledValues(){} });
  const ctx = {
    createOscillator: () => ({ connect(){}, start(){}, stop(){}, type:'', frequency: { setValueAtTime(v){ freqs.push(Math.round(v)); }, exponentialRampToValueAtTime(){} } }),
    createGain: () => ({ connect(){}, gain: gainApi() }),
    createBiquadFilter: () => ({ connect(){}, type:'', Q:{value:0}, frequency: gainApi() }),
    createBuffer: () => ({ getChannelData: () => new Float32Array(4410) }),
    createBufferSource: () => ({ connect(){}, start(){}, stop(){}, buffer:null }),
    destination: {}, currentTime: 0, sampleRate: 44100, state: 'suspended', resume: () => Promise.resolve(),
  };
  const sb = { console, Math, Object, Array, Number, String, Boolean, window:{}, globalThis:{}, AudioContext: function () { return ctx; } };
  sb.window.AudioContext = sb.AudioContext; sb.window.NV = { getBoss: () => null, getState: () => state || 'playing', getFrame: () => 180 };
  sb._freqs = freqs; sb._vols = vols; sb._ctx = ctx; return sb;
}
function load(state) { const sb = sandbox(state); vm.runInNewContext(fs.readFileSync('js/audio/synth.js', 'utf8'), sb, { filename: 'synth.js' }); return { NV: sb.window.NV, sb }; }

t('updateMusic tiene fase menu/shop con capas propias', () => {
  const src = fs.readFileSync('js/audio/synth.js', 'utf8');
  for (const pat of ['MENU_CHORD_ROOTS', "gameState === 'menu'", "gameState === 'shop'", 'isMenuLike']) {
    if (!src.includes(pat)) throw new Error('falta ' + pat);
  }
});

t('loop de game.js actualiza música también en menu/shop', () => {
  const src = fs.readFileSync('js/game.js', 'utf8');
  if (!src.includes("state === 'menu' || state === 'shop'") || !src.includes('updateMusic(dt);')) throw new Error('sin updateMusic fuera de playing');
});

t('playWeaponSound atenúa SMG repetida por heat anti-fatiga', () => {
  const { NV, sb } = load('playing'); NV.initAudio();
  const smg = { id: 'smg' };
  for (let i = 0; i < 8; i++) { sb._ctx.currentTime = i * 0.04; NV.playWeaponSound(smg); }
  const sfxVols = sb._vols.filter((v) => v > 0 && v < 0.1);
  if (sfxVols[sfxVols.length - 1] >= sfxVols[0]) throw new Error('SMG no atenúa');
});

t('railgun también usa rapidFireVolume', () => {
  const src = fs.readFileSync('js/audio/synth.js', 'utf8');
  if (!src.includes("rapidFireVolume('railgun'")) throw new Error('railgun sin anti-fatiga');
});

console.log('RESULT audio_menu_fatigue: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
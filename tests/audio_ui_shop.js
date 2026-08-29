// Tests Audio Tarea 5 bloque UI/shop/consumibles/fusión.
const fs = require('fs'), vm = require('vm');
let pass = 0, fail = 0;
function t(desc, fn) { try { fn(); pass++; console.log('  ok  ' + desc); } catch (e) { fail++; console.log('  FAIL ' + desc + ' -> ' + e.message); } }

function makeSandbox() {
  const freqs = [];
  const gainApi = () => ({ value: 0.6, setValueAtTime(){}, linearRampToValueAtTime(){}, exponentialRampToValueAtTime(){}, cancelScheduledValues(){} });
  const ctx = {
    createOscillator: () => ({ connect(){}, start(){}, stop(){}, type:'', frequency: { setValueAtTime(v){ freqs.push(v); } } }),
    createGain: () => ({ connect(){}, gain: gainApi() }),
    createBiquadFilter: () => ({ connect(){}, type:'', Q:{value:0}, frequency: gainApi() }),
    createBuffer: () => ({ getChannelData: () => new Float32Array(4410) }),
    createBufferSource: () => ({ connect(){}, start(){}, stop(){}, buffer:null }),
    destination: {}, currentTime: 0, sampleRate: 44100, state: 'suspended', resume: () => Promise.resolve(),
  };
  const sb = { console, Math, Object, Array, Number, String, Boolean, window:{}, globalThis:{}, AudioContext: function () { return ctx; } };
  sb.window.AudioContext = sb.AudioContext; sb.window.NV = { getBoss: () => null, getState: () => 'playing', getFrame: () => 0 };
  sb._freqs = freqs; return sb;
}
function loadSynth() { const sb = makeSandbox(); vm.runInNewContext(fs.readFileSync('js/audio/synth.js', 'utf8'), sb, { filename: 'synth.js' }); return { NV: sb.window.NV, sb }; }

t('sfx UI/shop/consumo/fusión existen y no crashean', () => {
  const { NV } = loadSynth(); NV.initAudio();
  for (const k of ['consume', 'fuse', 'shopBuy', 'shopSell', 'playerLevelUp', 'wheelSelect']) {
    if (typeof NV.sfx[k] !== 'function') throw new Error('falta ' + k);
    NV.sfx[k](2);
  }
});

t('game.js conecta consume/shopBuy/shopSell/fuse/wheelSelect', () => {
  const src = fs.readFileSync('js/game.js', 'utf8');
  for (const pat of ['sfx.consume(item.type)', 'sfx.shopBuy()', 'sfx.shopSell()', 'sfx.fuse(fus + 1)', 'sfx.wheelSelect()']) {
    if (!src.includes(pat)) throw new Error('falta ' + pat);
  }
});

t('pickups.js permite callback objeto para usar sfx.fuse en fusiones', () => {
  const sb = { window: { NV: {} }, Math, console };
  vm.runInNewContext(fs.readFileSync('js/engine/pickups.js', 'utf8'), sb, { filename: 'pickups.js' });
  let fused = 0, picked = 0;
  const inv = [{ id: 'rifle' }]; const wp = [{ weapon: { id: 'rifle' }, x: 0, y: 0 }];
  sb.window.NV.updateWeaponPickups(0.1, wp, { x: 0, y: 0 }, inv, 6, {}, () => {}, {}, { pickup(){ picked++; }, fuse(){ fused++; } }, () => ({ fused:true, level:1 }));
  if (fused !== 1 || picked !== 0) throw new Error('no usó sfx.fuse');
});

t('enemies.js usa playerLevelUp para nivel de jugador y fuse para nivel de arma', () => {
  const src = fs.readFileSync('js/engine/enemies.js', 'utf8');
  if (!src.includes('st.sfx.playerLevelUp') || !src.includes('st.sfx.fuse')) throw new Error('wiring incompleto');
});

console.log('RESULT audio_ui_shop: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
// Tests Audio Tarea 6: spatialización básica y volúmenes relativos por canal.
const fs = require('fs'), vm = require('vm');
let pass = 0, fail = 0;
function t(desc, fn) { try { fn(); pass++; console.log('  ok  ' + desc); } catch (e) { fail++; console.log('  FAIL ' + desc + ' -> ' + e.message); } }

function sandbox() {
  const pans = [];
  const gainApi = () => ({ value: 0.6, setValueAtTime(){}, linearRampToValueAtTime(){}, exponentialRampToValueAtTime(){}, cancelScheduledValues(){} });
  const ctx = {
    createOscillator: () => ({ connect(){}, start(){}, stop(){}, type:'', frequency: { setValueAtTime(){} } }),
    createGain: () => ({ connect(){}, gain: gainApi() }),
    createBiquadFilter: () => ({ connect(){}, type:'', Q:{value:0}, frequency: gainApi() }),
    createStereoPanner: () => ({ connect(){}, pan: { setValueAtTime(v){ pans.push(v); } } }),
    createBuffer: () => ({ getChannelData: () => new Float32Array(4410) }),
    createBufferSource: () => ({ connect(){}, start(){}, stop(){}, buffer:null }),
    destination: {}, currentTime: 0, sampleRate: 44100, state: 'suspended', resume: () => Promise.resolve(),
  };
  const sb = { console, Math, Object, Array, Number, String, Boolean, window:{}, globalThis:{}, AudioContext: function () { return ctx; } };
  sb.window.AudioContext = sb.AudioContext; sb.window.NV = { getBoss: () => null, getState: () => 'playing', getFrame: () => 0 };
  sb._pans = pans; return sb;
}
function load() { const sb = sandbox(); vm.runInNewContext(fs.readFileSync('js/audio/synth.js', 'utf8'), sb, { filename: 'synth.js' }); return { NV: sb.window.NV, sb }; }

t('panForX mapea izquierda/centro/derecha a -1/0/1', () => {
  const { NV } = load();
  if (NV.panForX(0, 900) !== -1) throw new Error('izquierda');
  if (NV.panForX(450, 900) !== 0) throw new Error('centro');
  if (NV.panForX(900, 900) !== 1) throw new Error('derecha');
});

t('enemyDeath y playWeaponSound aplican StereoPanner con x/worldWidth', () => {
  const { NV, sb } = load(); NV.initAudio();
  NV.sfx.enemyDeath('normal', { x: 900, worldWidth: 900 });
  NV.playWeaponSound({ id: 'pistol' }, { x: 0, worldWidth: 900 });
  if (!sb._pans.includes(1) || !sb._pans.includes(-1)) throw new Error('pans=' + sb._pans.join(','));
});

t('setChannelVolume ajusta masterVolume y gain de mixer', () => {
  const { NV } = load(); NV.initAudio();
  NV.setChannelVolume('sfxUI', 0.5);
  if (NV.masterVolume.sfxUI !== 0.5) throw new Error('masterVolume no actualizó');
  if (Math.abs(NV.mixer.sfxUI.gain.value - NV.mixerChannels.sfxUI * 0.5) > 1e-9) throw new Error('gain relativo incorrecto');
});

t('módulos conectan posiciones a muertes y disparos', () => {
  const enemies = fs.readFileSync('js/engine/enemies.js', 'utf8');
  const boss = fs.readFileSync('js/engine/boss.js', 'utf8');
  const weapons = fs.readFileSync('js/engine/weapons.js', 'utf8');
  const game = fs.readFileSync('js/game.js', 'utf8');
  for (const pat of ['worldWidth: st.W', 'worldWidth: st.W', 'state.audioPosition', 'audioPosition: { x: player.x, worldWidth: W }']) {
    if (!(enemies + boss + weapons + game).includes(pat)) throw new Error('falta ' + pat);
  }
});

console.log('RESULT audio_spatial_mix: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
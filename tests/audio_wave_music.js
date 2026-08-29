// Tests Audio Bloque 2: música de oleada normal (breakbeat crudo + textura sucia).
const fs = require('fs'), vm = require('vm');
let pass = 0, fail = 0;
function t(desc, fn) { try { fn(); pass++; console.log('  ok  ' + desc); } catch (e) { fail++; console.log('  FAIL ' + desc + ' -> ' + e.message); } }

function sandbox() {
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
  sb.window.NV = { getBoss: () => null, getState: () => 'playing', getFrame: () => 0 };
  return sb;
}
function load() { const sb = sandbox(); vm.runInNewContext(fs.readFileSync('js/audio/synth.js', 'utf8'), sb, { filename: 'synth.js' }); return { NV: sb.window.NV }; }

t('existe scheduleNormalStep con breakbeat variado, no patrón fijo', () => {
  const src = fs.readFileSync('js/audio/synth.js', 'utf8');
  for (const pat of ['function scheduleNormalStep', 'NV.musicState.groove', 'swing =', 'Math.random() < 0.92']) {
    if (!src.includes(pat)) throw new Error('falta ' + pat);
  }
});

t('oleada normal usa textura sucia (dirty note/chord con saturación)', () => {
  const src = fs.readFileSync('js/audio/synth.js', 'utf8');
  for (const pat of ['scheduleDirtyNote', 'scheduleDirtyChord', 'drive.gain.value = 1.6']) {
    if (!src.includes(pat)) throw new Error('falta ' + pat);
  }
});

t('estructura por intensidad: quiebres/rolls y dobles kicks condicionados', () => {
  const src = fs.readFileSync('js/audio/synth.js', 'utf8');
  if (!src.includes('inten > 0.7') || !src.includes('inten > 0.6')) throw new Error('sin estructura por intensidad');
  if (!src.includes('groove === 1 && step === 15')) throw new Error('sin roll tipo amen');
});

t('normal/boss/menu son flujos distintos (desacople)', () => {
  const src = fs.readFileSync('js/audio/synth.js', 'utf8');
  if (!src.includes('scheduleNormalStep') || !src.includes('scheduleBossStep') || !src.includes('scheduleMenuStep')) throw new Error('faltan flujos por fase');
  if (!src.includes("phase === 'normal'")) throw new Error('sin rama normal');
});

t('updateMusic corre 200 steps en oleada normal sin crash', () => {
  const { NV } = load(); NV.initAudio();
  for (let i = 0; i < 200; i++) NV.updateMusic(0.13);
});

console.log('RESULT audio_wave_music: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
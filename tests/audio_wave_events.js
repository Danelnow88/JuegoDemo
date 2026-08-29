// Tests Audio Tarea 5: eventos Tanda C con firma SFX propia.
const fs = require('fs'), vm = require('vm');
let pass = 0, fail = 0;
function t(desc, fn) { try { fn(); pass++; console.log('  ok  ' + desc); } catch (e) { fail++; console.log('  FAIL ' + desc + ' -> ' + e.message); } }

function makeSandbox() {
  const freqs = [];
  const gainApi = () => ({ value: 0.6, setValueAtTime(){}, linearRampToValueAtTime(){}, exponentialRampToValueAtTime(){}, cancelScheduledValues(){} });
  const ctx = {
    createOscillator: () => ({ connect(){}, start(){}, stop(){}, type:'', frequency: { setValueAtTime(v){ freqs.push(Math.round(v)); } } }),
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

t('sfx.waveEvent existe y no crashea para los 4 eventos Tanda C', () => {
  const { NV } = loadSynth(); NV.initAudio();
  for (const k of ['mines', 'fog', 'elites', 'payday']) NV.sfx.waveEvent(k);
});

t('los 4 eventos tienen firmas de frecuencia distintas', () => {
  const sigs = ['mines', 'fog', 'elites', 'payday'].map((k) => {
    const x = loadSynth(); x.NV.initAudio(); x.NV.sfx.waveEvent(k); return x.sb._freqs.join(',');
  });
  if (new Set(sigs).size !== 4) throw new Error('firmas repetidas: ' + sigs.join(' | '));
});

t('game.js dispara sfx.waveEvent(waveEvent) al mostrar evento no-boss', () => {
  const src = fs.readFileSync('js/game.js', 'utf8');
  if (!src.includes('sfx.waveEvent(waveEvent)')) throw new Error('sin conexión en nextWave');
});

console.log('RESULT audio_wave_events: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
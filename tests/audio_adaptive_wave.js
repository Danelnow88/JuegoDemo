// Tests Audio Tarea 5: combo, countdown y fanfarrias diferenciadas.
const fs = require('fs'), vm = require('vm');
let pass = 0, fail = 0;
function t(desc, fn) { try { fn(); pass++; console.log('  ok  ' + desc); } catch (e) { fail++; console.log('  FAIL ' + desc + ' -> ' + e.message); } }

function sandbox() {
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
  sb.window.AudioContext = sb.AudioContext; sb.window.NV = { getBoss: () => null, getState: () => 'playing', getFrame: () => 1 };
  sb._freqs = freqs; return sb;
}
function load() { const sb = sandbox(); vm.runInNewContext(fs.readFileSync('js/audio/synth.js', 'utf8'), sb, { filename: 'synth.js' }); return { NV: sb.window.NV, sb }; }

t('sfx.combo actualiza musicState.combo para capas musicales', () => {
  const { NV } = load(); NV.initAudio(); NV.sfx.combo(8);
  if (NV.musicState.combo !== 8) throw new Error('combo no llegó a musicState');
});

t('victory genérica y de hito tienen firmas distintas', () => {
  const a = load(); a.NV.initAudio(); a.NV.sfx.victory(4, { milestone:false });
  const b = load(); b.NV.initAudio(); b.NV.sfx.victory(5, { milestone:true });
  if (a.sb._freqs.join(',') === b.sb._freqs.join(',')) throw new Error('fanfarrias iguales');
});

t('game.js conecta combo, countdown solo sin boss y sfx.victory con milestone', () => {
  const src = fs.readFileSync('js/game.js', 'utf8');
  for (const pat of ['sfx.combo(cb.count)', 'sfx.countdown(sec)', '!boss && waveTimer > 0', 'countdownLastSecond', 'sfx.victory(wave, { milestone:']) {
    if (!src.includes(pat)) throw new Error('falta ' + pat);
  }
});

t('updateMusic usa comboLayer como capa adaptativa', () => {
  const src = fs.readFileSync('js/audio/synth.js', 'utf8');
  if (!src.includes('comboLayer') || !src.includes('NV.musicState.combo')) throw new Error('sin capa de combo');
});

console.log('RESULT audio_adaptive_wave: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
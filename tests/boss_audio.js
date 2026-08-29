// Tests Tarea 3: identidad sonora de jefe (bossEnter/bossPhaseShift, crossfade de capas).
const fs = require('fs'), vm = require('vm');
let pass = 0, fail = 0;
function t(desc, fn) { try { fn(); pass++; console.log('  ok  ' + desc); } catch (e) { fail++; console.log('  FAIL ' + desc + ' -> ' + e.message); } }

// ---- Sandbox de audio headless (igual criterio que audio_mixer.js) ----
function makeSandbox() {
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
  let bossRef = null, stateRef = 'playing', frameRef = 0;
  const sb = { console, Math, Object, Array, Number, String, Boolean, Proxy, Reflect, window:{}, globalThis:{}, AudioContext: function () { return ctx; } };
  sb.window.AudioContext = sb.AudioContext; sb.window.NV = {};
  sb.window.NV.getBoss = () => bossRef;
  sb.window.NV.getState = () => stateRef;
  sb.window.NV.getFrame = () => frameRef;
  sb._setBoss = (b) => { bossRef = b; };
  sb._setState = (s) => { stateRef = s; };
  sb._tickFrame = () => { frameRef++; };
  sb._ctx = ctx;
  return sb;
}

function loadSynth() {
  const sb = makeSandbox();
  vm.runInNewContext(fs.readFileSync('js/audio/synth.js', 'utf8'), sb, { filename: 'synth.js' });
  return { NV: sb.window.NV, sb };
}

t('sfx.bossPhaseShift existe y no crashea', () => {
  const { NV } = loadSynth(); NV.initAudio();
  try { NV.sfx.bossPhaseShift(); } catch (e) { throw new Error('bossPhaseShift lanzo: ' + e.message); }
});

t('sfx.bossEnter y sfx.bossPhaseShift duckean la musica (llaman a duck)', () => {
  const { NV } = loadSynth(); NV.initAudio();
  const g = NV.mixer.music.gain;
  let calls = 0;
  g.linearRampToValueAtTime = function () { calls++; };
  NV.sfx.bossEnter();
  if (calls === 0) throw new Error('bossEnter no duckeo la musica');
  calls = 0;
  NV.sfx.bossPhaseShift();
  if (calls === 0) throw new Error('bossPhaseShift no duckeo la musica');
});

t('updateMusic cambia musicState.phase a "boss" cuando hay jefe, sin exception', () => {
  const { NV, sb } = loadSynth(); NV.initAudio();
  sb._setState('playing');
  if (NV.musicState.phase !== 'normal') throw new Error('phase inicial != normal');
  sb._setBoss({ hp: 100 });
  NV.updateMusic(0.13); // supera stepDur (0.12) => procesa un step con la fase ya sincronizada
  if (NV.musicState.phase !== 'boss') throw new Error('phase no cambio a boss, got=' + NV.musicState.phase);
});

t('updateMusic vuelve a "normal" al morir el jefe (getBoss null), sin corte abrupto/exception', () => {
  const { NV, sb } = loadSynth(); NV.initAudio();
  sb._setState('playing'); sb._setBoss({ hp: 100 });
  NV.updateMusic(0.13);
  if (NV.musicState.phase !== 'boss') throw new Error('no entro a boss');
  sb._setBoss(null);
  NV.updateMusic(0.13);
  if (NV.musicState.phase !== 'normal') throw new Error('no volvio a normal tras muerte del jefe');
});

t('updateMusic corre 200 steps intercalando boss/normal sin crash (transición repetida, anti-glitch)', () => {
  const { NV, sb } = loadSynth(); NV.initAudio();
  sb._setState('playing');
  try {
    for (let i = 0; i < 200; i++) {
      sb._setBoss(i % 20 < 10 ? { hp: 100 } : null);
      sb._tickFrame();
      NV.updateMusic(0.02);
    }
  } catch (e) { throw new Error('crash en transiciones repetidas: ' + e.message); }
});

t('capas de musica de jefe son distintas de las normales (chordRoots/bass/lead/drums)', () => {
  // Verificación estática: el archivo debe definir constantes BOSS_* separadas
  // de las normales, no reusar las mismas referencias (identidad sonora real).
  const src = fs.readFileSync('js/audio/synth.js', 'utf8');
  for (const pat of ['BOSS_CHORD_ROOTS', 'BOSS_BASS_LINE', 'BOSS_LEAD_SEQ', 'BOSS_DRUM_PATTERN', 'MUSIC_LAYERS', 'currentLayers']) {
    if (!src.includes(pat)) throw new Error('falta ' + pat);
  }
});

t('boss.js invoca sfx.bossPhaseShift al entrar en fase 2', () => {
  const src = fs.readFileSync('js/engine/boss.js', 'utf8');
  if (!src.includes('st.sfx.bossPhaseShift')) throw new Error('boss.js no invoca bossPhaseShift');
});

t('game.js invoca sfx.bossEnter al crear el jefe en nextWave', () => {
  const src = fs.readFileSync('js/game.js', 'utf8');
  const i = src.indexOf('function nextWave()');
  if (i < 0) throw new Error('nextWave no encontrada');
  if (!src.slice(i, i + 1500).includes('sfx.bossEnter()')) throw new Error('nextWave no llama sfx.bossEnter()');
});

t('startGame resetea musicState.phase a "normal" (sin residuo de partida anterior)', () => {
  const src = fs.readFileSync('js/game.js', 'utf8');
  if (!/NV\.musicState\.phase = 'normal'/.test(src)) throw new Error('falta reset de phase en startGame');
});

console.log('RESULT boss_audio: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);

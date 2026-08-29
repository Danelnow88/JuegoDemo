// Tests Audio Tarea 4: SFX de combate diferenciado + heartbeat crítico.
const fs = require('fs'), vm = require('vm');
let pass = 0, fail = 0;
function t(desc, fn) { try { fn(); pass++; console.log('  ok  ' + desc); } catch (e) { fail++; console.log('  FAIL ' + desc + ' -> ' + e.message); } }

function makeSandbox() {
  const freqs = [], ramps = [];
  const gainApi = () => ({ value: 0.6, setValueAtTime(){}, linearRampToValueAtTime(v){ ramps.push(v); }, exponentialRampToValueAtTime(){}, cancelScheduledValues(){} });
  const ctx = {
    createOscillator: () => ({ connect(){}, start(){}, stop(){}, type:'', frequency: { setValueAtTime(v){ freqs.push(v); } } }),
    createGain: () => ({ connect(){}, gain: gainApi() }),
    createBiquadFilter: () => ({ connect(){}, type:'', Q:{value:0}, frequency: gainApi() }),
    createBuffer: () => ({ getChannelData: () => new Float32Array(4410) }),
    createBufferSource: () => ({ connect(){}, start(){}, stop(){}, buffer:null }),
    destination: {}, currentTime: 0, sampleRate: 44100, state: 'suspended', resume: () => Promise.resolve(),
  };
  const sb = { console, Math, Object, Array, Number, String, Boolean, Proxy, Reflect, window:{}, globalThis:{}, AudioContext: function () { return ctx; } };
  sb.window.AudioContext = sb.AudioContext; sb.window.NV = { getBoss: () => null, getState: () => 'playing', getFrame: () => 0 };
  sb._freqs = freqs; sb._ramps = ramps; return sb;
}
function loadSynth() { const sb = makeSandbox(); vm.runInNewContext(fs.readFileSync('js/audio/synth.js', 'utf8'), sb, { filename: 'synth.js' }); return { NV: sb.window.NV, sb }; }

t('sfx.enemyDeath y sfx.playerHit existen y no crashean', () => {
  const { NV } = loadSynth(); NV.initAudio();
  for (const k of ['normal', 'elite', 'boss']) NV.sfx.enemyDeath(k);
  NV.sfx.playerHit();
});

t('enemyDeath usa firmas distintas para normal/elite/boss', () => {
  const normal = loadSynth(); normal.NV.initAudio(); normal.NV.sfx.enemyDeath('normal');
  const elite = loadSynth(); elite.NV.initAudio(); elite.NV.sfx.enemyDeath('elite');
  const boss = loadSynth(); boss.NV.initAudio(); boss.NV.sfx.enemyDeath('boss');
  const sig = (sb) => sb._freqs.map((x) => Math.round(x)).join(',');
  if (sig(normal.sb) === sig(elite.sb)) throw new Error('normal y elite suenan igual');
  if (sig(elite.sb) === sig(boss.sb)) throw new Error('elite y boss suenan igual');
});

t('playerHit es no fatal: distinto de sfx.damage y con ducking más suave', () => {
  const hit = loadSynth(); hit.NV.initAudio(); hit.NV.sfx.playerHit();
  const dmg = loadSynth(); dmg.NV.initAudio(); dmg.NV.sfx.damage();
  const sig = (sb) => sb._freqs.map((x) => Math.round(x)).join(',');
  if (sig(hit.sb) === sig(dmg.sb)) throw new Error('playerHit igual a damage/game over');
  if (!hit.sb._ramps.includes(0.32)) throw new Error('playerHit no duckea a 0.32');
});

t('enemies.js conecta muerte normal/elite y daño no fatal a SFX nuevos', () => {
  const src = fs.readFileSync('js/engine/enemies.js', 'utf8');
  if (!src.includes("sfx.enemyDeath(e.isElite ? 'elite' : 'normal')")) throw new Error('killEnemy no usa enemyDeath por tipo');
  if (!src.includes('st.sfx.playerHit') || !src.includes('st.player.hp > 0')) throw new Error('updateEnemies no usa playerHit no fatal');
});

t('bullets.js conecta proyectiles enemigos a playerHit solo si no es fatal', () => {
  const src = fs.readFileSync('js/engine/bullets.js', 'utf8');
  if (!src.includes('st.sfx.playerHit') || !src.includes('player.hp > 0')) throw new Error('updateBullets no conecta playerHit no fatal');
});

t('boss.js conecta muerte de jefe a enemyDeath("boss")', () => {
  const src = fs.readFileSync('js/engine/boss.js', 'utf8');
  if (!src.includes("st.sfx.enemyDeath('boss')")) throw new Error('muerte de jefe no usa enemyDeath boss');
});

t('game.js maneja heartbeat crítico con timer y reset al recuperarse', () => {
  const src = fs.readFileSync('js/game.js', 'utf8');
  for (const pat of ['heartbeatTimer', 'heartbeatWasCritical', 'hpRatio <= 0.3', 'sfx.heartbeat', 'heartbeatTimer = 0']) {
    if (!src.includes(pat)) throw new Error('falta ' + pat);
  }
});

console.log('RESULT audio_combat_sfx: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
// Tests C2/P3: eventos de oleada — élites extra, hazards independientes y wiring.
const fs = require('fs'), vm = require('vm');
let pass = 0, fail = 0;
function t(d, fn) { try { fn(); pass++; console.log('  ok  ' + d); } catch (e) { fail++; console.log('  FAIL ' + d + ' -> ' + e.message); } }

t('WAVE_EVENTS define los 4', () => {
  const g = fs.readFileSync('js/data/gameData.js', 'utf8');
  for (const k of ['elites:', 'payday:', 'fog:', 'mines:']) if (!g.includes(k)) throw new Error('falta ' + k);
});

function loadNV() {
  // P3.1 placement táctico usa trigonometría real; el sandbox conserva Math
  // determinista para random pero expone las primitivas matemáticas del runtime.
  const rm = {
    random: () => 0.2, floor: Math.floor, hypot: Math.hypot, min: Math.min,
    max: Math.max, round: Math.round, imul: Math.imul, exp: Math.exp, atan2: Math.atan2,
    sin: Math.sin, cos: Math.cos, PI: Math.PI, abs: Math.abs, pow: Math.pow,
  };
  const sbx = { window: { NV: {} }, console, Math: rm };
  vm.runInNewContext(fs.readFileSync('js/data/gameData.js', 'utf8'), sbx, { filename: 'g' });
  vm.runInNewContext(fs.readFileSync('js/data/balance.js', 'utf8'), sbx, { filename: 'bal' });
  vm.runInNewContext(fs.readFileSync('js/engine/rhythm.js', 'utf8'), sbx, { filename: 'rhythm' });
  vm.runInNewContext(fs.readFileSync('js/engine/hazards.js', 'utf8'), sbx, { filename: 'h' });
  vm.runInNewContext(fs.readFileSync('js/engine/enemies.js', 'utf8'), sbx, { filename: 'e' });
  return sbx.window.NV;
}
const ET = [{ hp: 50, speed: 40, radius: 12, color: '#f00', shape: 'circle', behavior: 'chase', damage: 10, score: 20, xp: 20 }];

t('spawnElite: 2 normal, 3 con elites', () => {
  const NV = loadNV();
  const a = [];
  NV.spawnElite({ enemies: a, MAX_ENEMIES: 80, boss: null, wave: 3, W: 800, H: 600, ELITE_TYPES: ET, waveEvent: null });
  if (a.length !== 2) throw new Error('sin evento ' + a.length);
  const b = [];
  NV.spawnElite({ enemies: b, MAX_ENEMIES: 80, boss: null, wave: 3, W: 800, H: 600, ELITE_TYPES: ET, waveEvent: 'elites' });
  if (b.length !== 3) throw new Error('con elites ' + b.length);
});

t('Campo Minado NO marca enemigos: las minas viven en hazards[]', () => {
  const NV = loadNV();
  const c = [];
  NV.spawnEnemy({ enemies: c, MAX_ENEMIES: 80, boss: null, wave: 3, ENEMY_TYPES: NV.ENEMY_TYPES, W: 800, H: 600, waveEvent: 'mines' });
  if (!c.length) throw new Error('no spawneó');
  if (c.some((e) => Object.prototype.hasOwnProperty.call(e, 'mine'))) throw new Error('enemigo conserva e.mine');
  const hazards = [], state = NV.createMinefieldState();
  NV.updateSpeakerMines(0, hazards, state, { waveEvent: 'mines', wave: 3, boss: null, player: { x: 400, y: 500 }, W: 800, H: 600, random: () => 0.1 });
  if (!hazards.length || hazards[0].type !== 'speakerMine') throw new Error('hazard independiente ausente');
});

t('game.js conecta selección %3, evento, hazards y niebla legacy separada', () => {
  const g = fs.readFileSync('js/game.js', 'utf8');
    const ps = ['function pickWaveEvent', 'waveEvent = (wave % 5 !== 0 && wave % 3 === 0)', 'WAVE_EVENTS[waveEvent]', 'updateHazards(dt)', 'drawHazards(ctx, hazards', "waveEvent === 'fog'", 'waveEvent = null;'];
  for (const p of ps) if (!g.includes(p)) throw new Error('falta ' + p);
});

console.log('RESULT wave_events: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
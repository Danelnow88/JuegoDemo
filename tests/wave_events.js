// Tests C2: eventos de oleada — spawn de élites extra, minas y conexión en game.js.
const fs = require('fs'), vm = require('vm');
let pass = 0, fail = 0;
function t(d, fn) { try { fn(); pass++; console.log('  ok  ' + d); } catch (e) { fail++; console.log('  FAIL ' + d + ' -> ' + e.message); } }

t('WAVE_EVENTS define los 4', () => {
  const g = fs.readFileSync('js/data/gameData.js', 'utf8');
  for (const k of ['elites:', 'payday:', 'fog:', 'mines:']) if (!g.includes(k)) throw new Error('falta ' + k);
});

function loadNV() {
  const rm = { random: () => 0.2, floor: Math.floor, hypot: Math.hypot, min: Math.min, round: Math.round, imul: Math.imul };
  const sbx = { window: { NV: {} }, console, Math: rm };
  vm.runInNewContext(fs.readFileSync('js/data/gameData.js', 'utf8'), sbx, { filename: 'g' });
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

t('spawnEnemy marca minas solo con mines', () => {
  const NV = loadNV();
  const c = [];
  NV.spawnEnemy({ enemies: c, MAX_ENEMIES: 80, boss: null, wave: 3, ENEMY_TYPES: NV.ENEMY_TYPES, W: 800, H: 600, waveEvent: 'mines' });
  if (!c.length) throw new Error('no spawneó');
  if (!c.some((e) => e.mine)) throw new Error('sin minas con mines');
  const s = [];
  NV.spawnEnemy({ enemies: s, MAX_ENEMIES: 80, boss: null, wave: 3, ENEMY_TYPES: NV.ENEMY_TYPES, W: 800, H: 600, waveEvent: null });
  if (s.some((e) => e.mine)) throw new Error('minas sin evento');
});

t('game.js conecta selección %3, pickWaveEvent, banner, niebla', () => {
  const g = fs.readFileSync('js/game.js', 'utf8');
  const ps = ['function pickWaveEvent', 'waveEvent = (wave % 3 === 0)', 'WAVE_EVENTS[waveEvent]', "waveEvent === 'fog'", 'waveEvent = null;'];
  for (const p of ps) if (!g.includes(p)) throw new Error('falta ' + p);
});

console.log('RESULT wave_events: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
// Verificaci\u00f3n de integraci\u00f3n de espectros
const fs = require('fs'), vm = require('vm');
let pass = 0, fail = 0;
function t(d, fn) { try { fn(); pass++; console.log('  ok  ' + d); } catch (e) { fail++; console.log('  FAIL ' + d + ' -> ' + e.message); } }

const rm = { random: () => 0.5, floor: Math.floor, hypot: Math.hypot, min: Math.min, max: Math.max, round: Math.round, imul: Math.imul, sin: Math.sin, cos: Math.cos, atan2: Math.atan2, PI: Math.PI, abs: Math.abs };
const sbx = { window: { NV: {} }, console, Math: rm };

// Load modules
vm.runInNewContext(fs.readFileSync('js/data/gameData.js', 'utf8'), sbx, { filename: 'gameData.js' });
vm.runInNewContext(fs.readFileSync('js/data/balance.js', 'utf8'), sbx, { filename: 'balance.js' });
vm.runInNewContext(fs.readFileSync('js/engine/enemies.js', 'utf8'), sbx, { filename: 'enemies.js' });
vm.runInNewContext(fs.readFileSync('js/render/enemies.js', 'utf8'), sbx, { filename: 'renderEnemies.js' });
vm.runInNewContext(fs.readFileSync('js/render/espectroLite.js', 'utf8'), sbx, { filename: 'espectroLite.js' });

const NV = sbx.window.NV;

t('specter_lite registrado en ENEMY_TYPES', () => {
  const et = NV.ENEMY_TYPES.find(x => x.id === 'specter_lite');
  if (!et) throw new Error('no encontrado');
  if (et.hp !== 18) throw new Error('hp=' + et.hp);
  if (et.damage !== 8) throw new Error('damage=' + et.damage);
  if (et.minWave !== 16) throw new Error('minWave=' + et.minWave);
  if (et.behavior !== 'erratic') throw new Error('behavior=' + et.behavior);
  if (et.weight !== 0.08) throw new Error('weight=' + et.weight);
  if (et.shape !== 'specter') throw new Error('shape=' + et.shape);
  if (et.color !== '#ff6a24') throw new Error('color=' + et.color);
});

t('specter_core registrado en ENEMY_TYPES', () => {
  const et = NV.ENEMY_TYPES.find(x => x.id === 'specter_core');
  if (!et) throw new Error('no encontrado');
  if (et.hp !== 28) throw new Error('hp=' + et.hp);
  if (et.damage !== 12) throw new Error('damage=' + et.damage);
  if (et.minWave !== 20) throw new Error('minWave=' + et.damage);
  if (et.behavior !== 'ranged') throw new Error('behavior=' + et.behavior);
  if (et.weight !== 0.06) throw new Error('weight=' + et.weight);
  if (et.shape !== 'specter') throw new Error('shape=' + et.shape);
  if (et.color !== '#ff2244') throw new Error('color=' + et.color);
});

t('weightedRandom existe y funciona sin weight (uniforme)', () => {
  if (typeof NV.weightedRandom !== 'function') throw new Error('no existe');
  const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const result = NV.weightedRandom(items);
  if (!result) throw new Error('devolvi\u00f3 null');
});

t('weightedRandom respeta weights', () => {
  const items = [{ id: 'a', weight: 10 }, { id: 'b', weight: 1 }];
  const oldRandom = rm.random;
  rm.random = () => 0.01;
  let result = NV.weightedRandom(items);
  if (result.id !== 'a') throw new Error('deber\u00eda ser a, fue ' + result.id);
  rm.random = () => 0.99;
  result = NV.weightedRandom(items);
  if (result.id !== 'b') throw new Error('deber\u00eda ser b, fue ' + result.id);
    rm.random = oldRandom;
});

t('spawnEnemy forceTypeId spawn specter_lite sin importar wave/minWave', () => {
  const oldRandom = rm.random;
  rm.random = () => 0.5;
  const enemies = [];
  NV.spawnEnemy({ enemies, MAX_ENEMIES: 80, boss: null, wave: 1, ENEMY_TYPES: NV.ENEMY_TYPES, W: 800, H: 600, forceTypeId: 'specter_lite' });
  if (enemies.length !== 1) throw new Error('spawneo ' + enemies.length + ' enemigos');
  if (enemies[0].enemyTypeId !== 'specter_lite') throw new Error('tipo=' + enemies[0].enemyTypeId);
  if (enemies[0].shape !== 'specter') throw new Error('shape=' + enemies[0].shape);
  if (enemies[0].behavior !== 'erratic') throw new Error('behavior=' + enemies[0].behavior);
  rm.random = oldRandom;
});

t('spawnEnemy normal no spawnea specters en wave bajo', () => {
  const oldRandom = rm.random;
  rm.random = () => 0.5;
  const enemies = [];
  for (let i = 0; i < 20; i++) {
    NV.spawnEnemy({ enemies, MAX_ENEMIES: 80, boss: null, wave: 5, ENEMY_TYPES: NV.ENEMY_TYPES, W: 800, H: 600 });
  }
  if (enemies.some(e => e.shape === 'specter')) throw new Error('espectros en wave 5');
  rm.random = oldRandom;
});

t('SPECTER_ENABLED=false bloquea incluso forceTypeId y true lo rehabilita', () => {
  const oldRandom = rm.random;
  rm.random = () => 0;
  NV.SPECTER_ENABLED = false;
  const disabled = [];
  NV.spawnEnemy({ enemies: disabled, MAX_ENEMIES: 80, boss: null, wave: 20, ENEMY_TYPES: NV.ENEMY_TYPES, W: 800, H: 600, forceTypeId: 'specter_lite' });
  if (disabled.some(e => e.shape === 'specter')) throw new Error('force spawn ignoró el toggle apagado');

  NV.SPECTER_ENABLED = true;
  const enabled = [];
  NV.spawnEnemy({ enemies: enabled, MAX_ENEMIES: 80, boss: null, wave: 1, ENEMY_TYPES: NV.ENEMY_TYPES, W: 800, H: 600, forceTypeId: 'specter_lite' });
  if (!enabled.some(e => e.enemyTypeId === 'specter_lite')) throw new Error('no volvió a habilitar el force spawn');
  rm.random = oldRandom;
});

t('pools por oleada desbloquean lite en 16 y core en 20', () => {
  const ids16 = NV.ENEMY_TYPES.filter(t => (t.minWave || 1) <= 16).map(t => t.id);
  const ids20 = NV.ENEMY_TYPES.filter(t => (t.minWave || 1) <= 20).map(t => t.id);
  if (!ids16.includes('specter_lite') || ids16.includes('specter_core')) throw new Error('pool wave 16 incorrecto');
  if (!ids20.includes('specter_lite') || !ids20.includes('specter_core')) throw new Error('pool wave 20 incorrecto');
});

t('drawSpecter2D existe y es funcion', () => {
  if (typeof NV.drawSpecter2D !== 'function') throw new Error('no existe drawSpecter2D');
});

t('drawEnemy delega a drawSpecter2D para specters', () => {
    const mockCtx = {
    save() {}, restore() {}, translate() {}, scale() {},
    createRadialGradient: () => ({ addColorStop: () => {} }),
    beginPath() {}, closePath() {}, arc() {}, lineTo() {}, moveTo() {}, fill() {}, stroke() {},
    fillText() {}, shadowBlur: 0, shadowColor: '', fillStyle: '', strokeStyle: '', lineWidth: 1,
    font: '', textAlign: '', globalAlpha: 1,
  };
  const enemy = { x: 100, y: 100, radius: 12, color: '#ff6a24', shape: 'specter', enemyTypeId: 'specter_lite', specterPhase: 0.5, specterForm: 0.3 };
  const player = { x: 200, y: 200 };
  NV.drawEnemy(mockCtx, enemy, 10, player, null);
});

t('index.html carga espectroLite.js', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  if (!html.includes('js/render/espectroLite.js')) throw new Error('no cargado');
  if (/ESPECTRO_LITE_ACTIVE\s*=\s*true/.test(html)) throw new Error('auto-activo');
});

console.log('RESULT specter_integration: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);

// ===== TEST: spawn de los 6 enemigos espectrales nuevos =====
// Valida stats, gating por minWave, selección ponderada de élites espectro
// y logs [SPAWN] sin tocar espectros legacy ni el ciclo de élites base.
const fs = require('fs'), vm = require('vm');
let pass = 0, fail = 0;
function t(d, fn) { try { fn(); pass++; console.log('  ok  ' + d); } catch (e) { fail++; console.log('  FAIL ' + d + ' -> ' + e.message); } }

const rm = { random: () => 0.5, floor: Math.floor, hypot: Math.hypot, min: Math.min, max: Math.max, round: Math.round, imul: Math.imul, sin: Math.sin, cos: Math.cos, atan2: Math.atan2, PI: Math.PI, abs: Math.abs };
const sbx = { window: { NV: {} }, console, Math: rm };

vm.runInNewContext(fs.readFileSync('js/data/gameData.js', 'utf8'), sbx, { filename: 'gameData.js' });
vm.runInNewContext(fs.readFileSync('js/data/balance.js', 'utf8'), sbx, { filename: 'balance.js' });
vm.runInNewContext(fs.readFileSync('js/engine/enemies.js', 'utf8'), sbx, { filename: 'enemies.js' });

const NV = sbx.window.NV;
NV.SPECTER_ENABLED = true;

function restoreRandom(r) { rm.random = r; }
function stubRandom(v) { rm.random = () => v; }

console.log('spectral_enemy_spawn:');

// ---- Básicos ----
t('specter_grunt registrado en ENEMY_TYPES', () => {
  const et = NV.ENEMY_TYPES.find(x => x.id === 'specter_grunt');
  if (!et) throw new Error('no encontrado');
  if (et.hp !== 20) throw new Error('hp=' + et.hp);
  if (et.speed !== 85) throw new Error('speed=' + et.speed);
  if (et.damage !== 10) throw new Error('damage=' + et.damage);
  if (et.minWave !== 3) throw new Error('minWave=' + et.minWave);
  if (et.weight !== 0.15) throw new Error('weight=' + et.weight);
  if (et.behavior !== 'chase') throw new Error('behavior=' + et.behavior);
  if (et.shape !== 'circle') throw new Error('shape=' + et.shape);
});

t('specter_archer registrado en ENEMY_TYPES', () => {
  const et = NV.ENEMY_TYPES.find(x => x.id === 'specter_archer');
  if (!et) throw new Error('no encontrado');
  if (et.hp !== 18) throw new Error('hp=' + et.hp);
  if (et.damage !== 9) throw new Error('damage=' + et.damage);
  if (et.minWave !== 3) throw new Error('minWave=' + et.minWave);
  if (et.weight !== 0.12) throw new Error('weight=' + et.weight);
  if (et.behavior !== 'ranged') throw new Error('behavior=' + et.behavior);
});

t('specter_guard registrado en ENEMY_TYPES', () => {
  const et = NV.ENEMY_TYPES.find(x => x.id === 'specter_guard');
  if (!et) throw new Error('no encontrado');
  if (et.hp !== 55) throw new Error('hp=' + et.hp);
  if (et.damage !== 12) throw new Error('damage=' + et.damage);
  if (et.minWave !== 5) throw new Error('minWave=' + et.minWave);
  if (et.weight !== 0.10) throw new Error('weight=' + et.weight);
  if (et.behavior !== 'shield') throw new Error('behavior=' + et.behavior);
  if (!et.shield) throw new Error('faltan shield');
  if (et.resist !== 2) throw new Error('resist=' + et.resist);
});

// ---- Élites ----
t('specter_elite_swift registrado en ELITE_TYPES', () => {
  const et = NV.ELITE_TYPES.find(x => x.id === 'specter_elite_swift');
  if (!et) throw new Error('no encontrado');
  if (!et.spectralElite) throw new Error('falta spectralElite');
  if (et.minWave !== 12) throw new Error('minWave=' + et.minWave);
  if (et.weight !== 0.04) throw new Error('weight=' + et.weight);
  if (et.visualId !== 'elite_specter_swift') throw new Error('visualId=' + et.visualId);
});

t('specter_elite_wrath registrado en ELITE_TYPES', () => {
  const et = NV.ELITE_TYPES.find(x => x.id === 'specter_elite_wrath');
  if (!et) throw new Error('no encontrado');
  if (!et.spectralElite) throw new Error('falta spectralElite');
  if (et.minWave !== 14) throw new Error('minWave=' + et.minWave);
  if (et.weight !== 0.03) throw new Error('weight=' + et.weight);
  if (et.damage !== 30) throw new Error('damage=' + et.damage);
});

t('specter_elite_void registrado en ELITE_TYPES', () => {
  const et = NV.ELITE_TYPES.find(x => x.id === 'specter_elite_void');
  if (!et) throw new Error('no encontrado');
  if (!et.spectralElite) throw new Error('falta spectralElite');
  if (et.minWave !== 16) throw new Error('minWave=' + et.minWave);
  if (et.weight !== 0.03) throw new Error('weight=' + et.weight);
  if (et.stunChance !== 0.1) throw new Error('stunChance=' + et.stunChance);
});

// ---- Legacy intacto ----
t('specter_lite y specter_core NO cambian', () => {
  const lite = NV.ENEMY_TYPES.find(x => x.id === 'specter_lite');
  const core = NV.ENEMY_TYPES.find(x => x.id === 'specter_core');
  if (!lite || !core) throw new Error('faltan espectros legacy');
  if (lite.hp !== 18 || lite.damage !== 8 || lite.minWave !== 16 || lite.weight !== 0.08 || lite.shape !== 'specter') throw new Error('lite alterado');
  if (core.hp !== 28 || core.damage !== 12 || core.minWave !== 20 || core.weight !== 0.06 || core.shape !== 'specter') throw new Error('core alterado');
});

// ---- Gating por wave (básicos) ----
t('wave 2 NO puede spawnear espectros nuevos', () => {
  const r0 = rm.random; stubRandom(0);
  try {
    const newBasic = NV.ENEMY_TYPES.filter(t => t.id.indexOf('specter_') === 0);
    const w2 = [];
    NV.spawnEnemy({ enemies: w2, MAX_ENEMIES: 20, boss: null, wave: 2, ENEMY_TYPES: newBasic, W: 800, H: 600, waveEvent: null });
    if (w2.length !== 0) throw new Error('spawneó ' + w2.length + ' en wave 2');
  } finally { restoreRandom(r0); }
});

t('wave 3 spawnea specter_grunt (random bajo -> primer peso)', () => {
  const r0 = rm.random; stubRandom(0);
  try {
    const newBasic = NV.ENEMY_TYPES.filter(t => t.id === 'specter_grunt' || t.id === 'specter_archer');
    const w3 = [];
    NV.spawnEnemy({ enemies: w3, MAX_ENEMIES: 20, boss: null, wave: 3, ENEMY_TYPES: newBasic, W: 800, H: 600, waveEvent: null });
    if (w3.length !== 1) throw new Error('spawneó ' + w3.length);
    if (w3[0].enemyTypeId !== 'specter_grunt') throw new Error('tipo=' + w3[0].enemyTypeId);
  } finally { restoreRandom(r0); }
});

t('wave 5 spawnea specter_guard (random alto -> último peso)', () => {
  const r0 = rm.random; stubRandom(0.9999);
  try {
    const newBasic = NV.ENEMY_TYPES.filter(t => t.id === 'specter_grunt' || t.id === 'specter_archer' || t.id === 'specter_guard');
    const w5 = [];
    NV.spawnEnemy({ enemies: w5, MAX_ENEMIES: 20, boss: null, wave: 5, ENEMY_TYPES: newBasic, W: 800, H: 600, waveEvent: null });
    if (w5.length !== 1) throw new Error('spawneó ' + w5.length);
    if (w5[0].enemyTypeId !== 'specter_guard') throw new Error('tipo=' + w5[0].enemyTypeId);
  } finally { restoreRandom(r0); }
});

// ---- Gating por wave (élites espectrales) ----
t('wave 11 NO spawnea élites espectrales (minWave 12+)', () => {
  const r0 = rm.random; stubRandom(0);
  try {
    const spectralEt = NV.ELITE_TYPES.filter(t => t.spectralElite);
    const out = [];
    NV.spawnElite({ enemies: out, MAX_ENEMIES: 20, boss: null, wave: 11, W: 800, H: 600, ELITE_TYPES: spectralEt, waveEvent: null });
    if (out.length !== 0) throw new Error('spawneó ' + out.length);
  } finally { restoreRandom(r0); }
});

t('wave 13 spawnea élite espectral swift (peso bajo + random bajo)', () => {
  const r0 = rm.random; stubRandom(0);
  try {
    const spectralEt = NV.ELITE_TYPES.filter(t => t.spectralElite);
    const out = [];
    NV.spawnElite({ enemies: out, MAX_ENEMIES: 20, boss: null, wave: 13, W: 800, H: 600, ELITE_TYPES: spectralEt, waveEvent: null });
    if (out.length === 0) throw new Error('no spawneó');
    for (const e of out) {
      if (!e.isElite) throw new Error('no es élite');
      if (e.enemyTypeId !== 'specter_elite_swift') throw new Error('tipo=' + e.enemyTypeId);
    }
  } finally { restoreRandom(r0); }
});

t('élite espectral lleva enemyTypeId y visualId', () => {
  const r0 = rm.random; stubRandom(0);
  try {
    const spectralEt = NV.ELITE_TYPES.filter(t => t.spectralElite);
    const out = [];
    NV.spawnElite({ enemies: out, MAX_ENEMIES: 20, boss: null, wave: 13, W: 800, H: 600, ELITE_TYPES: spectralEt, waveEvent: null });
    if (!out.length) throw new Error('sin spawn');
    const e = out[0];
    if (e.enemyTypeId !== 'specter_elite_swift') throw new Error('enemyTypeId=' + e.enemyTypeId);
    if (e.visualId !== 'elite_specter_swift') throw new Error('visualId=' + e.visualId);
  } finally { restoreRandom(r0); }
});

// ---- Ciclo base intacto ----
t('el ciclo de élites base sigue intacto (wave 3 da élites no-espectrales)', () => {
  const r0 = rm.random; stubRandom(0.5);
  try {
    const out = [];
    NV.spawnElite({ enemies: out, MAX_ENEMIES: 20, boss: null, wave: 3, W: 800, H: 600, ELITE_TYPES: NV.ELITE_TYPES, waveEvent: null });
    if (out.length !== 2) throw new Error('count=' + out.length);
    for (const e of out) { if (e.enemyTypeId && e.enemyTypeId.indexOf('specter_') === 0) throw new Error('base dio espectro con random 0.5'); }
  } finally { restoreRandom(r0); }
});

// ---- Logs ----
t('spawnEnemy loguea [SPAWN] para espectros', () => {
  const logs = [];
  const orig = console.log;
  console.log = (m) => { logs.push(String(m)); };
  try {
    const r0 = rm.random; stubRandom(0);
    const newBasic = NV.ENEMY_TYPES.filter(t => t.id === 'specter_grunt' || t.id === 'specter_archer');
    const out = [];
    NV.spawnEnemy({ enemies: out, MAX_ENEMIES: 20, boss: null, wave: 3, ENEMY_TYPES: newBasic, W: 800, H: 600, waveEvent: null });
    restoreRandom(r0);
    if (!logs.some(l => l.indexOf('[SPAWN] wave=3 type=specter_grunt') !== -1)) throw new Error('log ausente: ' + logs.join(','));
  } finally { console.log = orig; }
});

t('spawnElite loguea [SPAWN] para élites espectrales', () => {
  const logs = [];
  const orig = console.log;
  console.log = (m) => { logs.push(String(m)); };
  try {
    const r0 = rm.random; stubRandom(0);
    const spectralEt = NV.ELITE_TYPES.filter(t => t.spectralElite);
    const out = [];
    NV.spawnElite({ enemies: out, MAX_ENEMIES: 20, boss: null, wave: 13, W: 800, H: 600, ELITE_TYPES: spectralEt, waveEvent: null });
    restoreRandom(r0);
    if (!logs.some(l => l.indexOf('[SPAWN] wave=13 type=specter_elite_swift') !== -1)) throw new Error('log ausente: ' + logs.join(','));
  } finally { console.log = orig; }
});

console.log('\nRESULT spectral_enemy_spawn: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
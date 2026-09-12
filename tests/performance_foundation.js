// P2 Performance Foundation: monitor, visual budget e invariantes gameplay.
const fs = require('fs'), vm = require('vm');
let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; console.log('  ok  ' + name); } catch (e) { fail++; console.log('  FAIL ' + name + ' -> ' + e.message); } }
function load(f, sbx) { vm.runInNewContext(fs.readFileSync(f, 'utf8'), sbx, { filename: f }); }

function mkNV(withSettings) {
  const sbx = {
    window: { NV: {} }, console, Math, performance, Date, JSON, Object, Array,
    Set, Map, WeakSet, Float32Array, Proxy, Reflect,
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
  };
  if (withSettings) load('js/core/settings.js', sbx);
  return sbx;
}

// ===== Monitor =====
t('monitor: percentiles exactos sobre distribución conocida y contadores de umbrales', () => {
  const sbx = mkNV(); load('js/engine/performanceMonitor.js', sbx);
  const m = sbx.window.NV.performanceMonitor;
  for (let i = 0; i < 12; i++) m.record(10, 1, 1);
  for (let i = 0; i < 4; i++) m.record(20, 2, 2);
  for (let i = 0; i < 4; i++) m.record(40, 4, 4);
  const s = m.getSnapshot();
  if (s.frames !== 20) throw new Error('frames=' + s.frames);
  if (s.frame.p50 !== 10 || s.frame.p95 !== 40 || s.frame.p99 !== 40 || s.frame.worst !== 40) throw new Error(JSON.stringify(s.frame));
  // >16.7: los 20ms y los 40ms (8); >25: los 40ms (4); >33.3: los 40ms (4).
  if (s.framesAbove16_7 !== 8 || s.framesAbove25 !== 4 || s.framesAbove33 !== 4) throw new Error('umbral ' + JSON.stringify({ a: s.framesAbove16_7, b: s.framesAbove25, c: s.framesAbove33 }));
  if (s.update.p50 !== 1 || s.update.p95 !== 4) throw new Error('update ' + JSON.stringify(s.update));
});
t('monitor: ring buffer acotado — windowFrames nunca excede 240 y reset limpia', () => {
  const sbx = mkNV(); load('js/engine/performanceMonitor.js', sbx);
  const m = sbx.window.NV.performanceMonitor;
  for (let i = 0; i < 1000; i++) m.record(16, 1, 1);
  if (m.windowFrames !== 240) throw new Error('windowFrames=' + m.windowFrames);
  m.reset();
  const s = m.getSnapshot();
  if (s.frames !== 0 || s.frame.p95 !== 0 || s.framesAbove16_7 !== 0) throw new Error('reset incompleto');
});
t('monitor: sin shift() por frame y buffers preasignados (Float32Array)', () => {
  const src = fs.readFileSync('js/engine/performanceMonitor.js', 'utf8');
  if (src.includes('.shift(')) throw new Error('shift por frame');
  if (!src.includes('new Float32Array(WINDOW)')) throw new Error('buffers no preasignados');
  if ((src.match(/\.sort\(/g) || []).length !== 1) throw new Error('sort fuera del recompute');
});
t('monitor: API presente y game.js graba exactamente una vez por frame', () => {
  const NVm = mkNV(); load('js/engine/performanceMonitor.js', NVm);
  const NV = NVm.window.NV;
  if (typeof NV.performanceMonitor.getSnapshot !== 'function' || typeof NV.performanceMonitor.reset !== 'function') throw new Error('API ausente');
  NV.togglePerformanceDebug();
  if (!NV.performanceMonitor.debug) throw new Error('debug toggle');
  NV.togglePerformanceDebug(false);
  const g = fs.readFileSync('js/game.js', 'utf8');
  if ((g.match(/NV\.performanceMonitor\.record\(/g) || []).length !== 1) throw new Error('record != 1 por loop');
  if (!g.includes('performanceMonitor.setTelemetryProvider')) throw new Error('telemetría no conectada');
});

// ===== Visual budget =====
t('visual budget: preferencia autoridad — high=full, performance=reduced fijo', () => {
  const sbx = mkNV(true); load('js/render/visualBudget.js', sbx);
  const NV = sbx.window.NV;
  if (NV.getVisualBudget().tier !== 'full') throw new Error('high no arranca full');
  if (NV.getVisualBudget().preference !== 'high') throw new Error('preference ausente');
  // Overload moderado (22ms: >20 pero <26.5 de emergencia): high aguanta.
  NV.updateVisualBudget(22); NV.updateVisualBudget(22); NV.updateVisualBudget(22);
  if (NV.getVisualBudget().tier !== 'full') throw new Error('high degradó sin emergencia');
  NV.updateVisualBudget(30); NV.updateVisualBudget(30); // overload serio sostenido
  if (NV.getVisualBudget().tier !== 'reduced' || NV.getVisualBudget().reason !== 'emergency') throw new Error('emergencia high');
  for (let i = 0; i < 10; i++) NV.updateVisualBudget(45);
  if (NV.getVisualBudget().tier === 'minimal') throw new Error('high nunca debe llegar a minimal');
  NV.setGraphicsQuality('performance');
  if (NV.getVisualBudget().tier !== 'reduced') throw new Error('performance no es reduced');
  for (let i = 0; i < 10; i++) NV.updateVisualBudget(45);
  if (NV.getVisualBudget().tier !== 'reduced') throw new Error('performance auto-cambió');
});
t('visual budget: auto degrada sostenido y recupera lento (histéresis)', () => {
  const sbx = mkNV(true); load('js/render/visualBudget.js', sbx);
  const NV = sbx.window.NV;
  NV.setGraphicsQuality('auto');
  NV.updateVisualBudget(22); NV.updateVisualBudget(22); NV.updateVisualBudget(22);
  if (NV.getVisualBudget().tier !== 'full') throw new Error('un spike no debe degradar');
  NV.updateVisualBudget(22);
  if (NV.getVisualBudget().tier !== 'reduced') throw new Error('no bajó tras 4 ventanas');
  for (let i = 0; i < 4; i++) NV.updateVisualBudget(22);
  if (NV.getVisualBudget().tier !== 'minimal') throw new Error('no llegó a minimal');
  for (let i = 0; i < 15; i++) NV.updateVisualBudget(12);
  if (NV.getVisualBudget().tier !== 'minimal') throw new Error('recuperó antes de tiempo');
  NV.updateVisualBudget(12);
  if (NV.getVisualBudget().tier !== 'reduced') throw new Error('no recuperó a reduced');
  for (let i = 0; i < 16; i++) NV.updateVisualBudget(12);
  if (NV.getVisualBudget().tier !== 'full') throw new Error('no recuperó full');
});
t('visual budget: el tier runtime NO se persiste sobre la preferencia', () => {
  const sbx = mkNV(true); load('js/render/visualBudget.js', sbx);
  const NV = sbx.window.NV;
  NV.setGraphicsQuality('auto');
  for (let i = 0; i < 10; i++) NV.updateVisualBudget(40);
  if (NV.getSettings().graphics.quality !== 'auto') throw new Error('preferencia mutada por el tier');
  NV.resetVisualBudget();
  if (NV.getVisualBudget().tier !== 'full') throw new Error('reset no restaura base');
});
t('visual budget: sin gameplay — la fuente no contiene tokens de gameplay', () => {
  const src = fs.readFileSync('js/render/visualBudget.js', 'utf8');
  for (const bad of ['MAX_HOSTILES', 'MAX_HEAVY', 'damage', 'spawnTimer', 'enemyHpScale', 'canSpawn', 'hostileBudget']) {
    if (src.includes(bad)) throw new Error('token de gameplay: ' + bad);
  }
});
t('visual budget: política expone los campos semánticos acordados', () => {
  const sbx = mkNV(true); load('js/render/visualBudget.js', sbx);
  const p = sbx.window.NV.getVisualBudget();
  for (const k of ['tier', 'reason', 'preference', 'spectralDetail', 'decorativeParticleScale', 'secondaryGlow', 'heavyShadow', 'trailDensity', 'secondaryShockwaves', 'rhythmBackgroundDetail']) {
    if (!(k in p)) throw new Error('falta ' + k);
  }
});
// ===== Integraciones (decorativas, nunca gameplay) =====
function loadFx(vBudget) {
  const sbx = mkNV();
  sbx.window.NV.settings = { graphics: { quality: 'high', particles: true, heavyVfx: true } };
  if (vBudget) sbx.window.NV.getVisualBudget = vBudget;
  load('js/engine/fx.js', sbx);
  return sbx.window.NV;
}
t('fx: ink decorativo escala con decorativeParticleScale; el estallido principal es intacto', () => {
  const base = loadFx(null);
  const p1 = []; base.spawnExplosion(p1, 9999, 0, 0, 40, '#fff', 1);
  const off = loadFx(() => ({ tier: 'minimal', decorativeParticleScale: 0 }));
  const p2 = []; off.spawnExplosion(p2, 9999, 0, 0, 40, '#fff', 1);
  if (p2.length >= p1.length) throw new Error('minimal no redujo ink: ' + p2.length + ' vs ' + p1.length);
  if (p1.length < 28 || p2.length < 28) throw new Error('estallido principal recortado'); // 0.7×40=28
});
t('hidra: tier minimal -> stats.full=0 SIN mutar gameplay', () => {
  const sbx = mkNV(true);
  load('js/render/visualBudget.js', sbx);
  const NV = sbx.window.NV;
  NV.setGraphicsQuality('auto');
  for (let i = 0; i < 10; i++) NV.updateVisualBudget(40);
  if (NV.getVisualBudget().spectralDetail !== 0) throw new Error('setup: no minimal');
  load('js/render/spectralEnemies2D.js', sbx);
  const enemies = Array.from({ length: 8 }, (_, i) => ({ x: 100 + i * 30, y: 100, radius: 18, visualId: 'elite_base', isElite: true, dead: false }));
  const snapshot = JSON.stringify(enemies);
  const stats = NV.prepareEnemyVisualBudget(enemies, { x: 100, y: 100 });
  if (stats.full !== 0 || stats.simplified !== 8) throw new Error(JSON.stringify(stats));
  if (JSON.stringify(enemies) !== snapshot) throw new Error('LOD mutó gameplay');
});
t('hidra: sin visualBudget el comportamiento settings-only se conserva (regresión)', () => {
  const sbx = mkNV();
  sbx.window.NV.getGraphicsPolicy = () => ({ quality: 'auto', particles: true, heavyVfx: true, hydraFullBudget: 7 });
  load('js/render/spectralEnemies2D.js', sbx);
  const NV = sbx.window.NV;
  const enemies = Array.from({ length: 12 }, (_, i) => ({ x: 100 + i * 30, y: 100, radius: 18, visualId: 'elite_base', isElite: true, dead: false }));
  const stats = NV.prepareEnemyVisualBudget(enemies, { x: 100, y: 100 });
  if (stats.total !== 12 || stats.full !== 7 || stats.simplified !== 5) throw new Error(JSON.stringify(stats));
});
t('gameplay-invariante: visual budget minimal NO afloja el presupuesto de hostiles', () => {
  const sbx = { window: { NV: {} }, console, Math: Object.create(Math), Object, Array, Set, Map };
  sbx.Math.random = () => 0;
  load('js/data/balance.js', sbx);
  load('js/data/gameData.js', sbx);
  load('js/render/visualBudget.js', sbx);
  load('js/engine/hostileBudget.js', sbx);
  load('js/engine/enemies.js', sbx);
  const NV = sbx.window.NV;
  NV.settings = { audio: { sfxVolume: 1 }, graphics: { quality: 'auto', particles: true, heavyVfx: true } };
  for (let i = 0; i < 10; i++) NV.updateVisualBudget(40);
  if (NV.getVisualBudget().tier !== 'minimal') throw new Error('setup: no minimal');
  const enemies = Array.from({ length: 30 }, (_, i) => ({ x: i, y: 0, dead: false, hostileClass: 'light' }));
  const st = { enemies, player: { x: 800, y: 500, invuln: 0, stun: 0 }, bullets: [], MAX_BULLETS: 10, MAX_ENEMY_BULLETS: 10, enemyBulletCount: () => 0, applyPlayerDamage() { return { applied: false }; }, addFloatText() {}, spawnExplosion() {}, sfx: new Proxy({}, { get: () => () => {} }), MAX_HOSTILES: 30, MAX_HEAVY_HOSTILES: 7, boss: null };
  st.forceTypeId = 'specter_lite';
  if (NV.spawnEnemy(st) !== false || enemies.length !== 30) throw new Error('visual budget alteró spawns');
  const b = NV.getHostileBudget({ enemies, boss: null });
  if (b.hostiles > 30 || b.heavy > 7) throw new Error('cap roto: ' + JSON.stringify(b));
});
t('shockwave secundaria: se omite solo con visual budget y solo la marcada decorativa', () => {
  const sbx = mkNV();
  sbx.window.NV.settings = { graphics: { quality: 'high', particles: true, heavyVfx: true } };
  load('js/engine/fx.js', sbx);
  const NV = sbx.window.NV;
  const arr = [];
  NV.spawnShockwave(arr, 0, 0, { maxRadius: 70, secondary: true });
  if (arr.length !== 1) throw new Error('sin visualBudget debe dibujarse (default on)');
  NV.getVisualBudget = () => ({ secondaryShockwaves: false });
  const arr2 = [];
  NV.spawnShockwave(arr2, 0, 0, { maxRadius: 70, secondary: true });
  if (arr2.length !== 0) throw new Error('secondary no se omitió');
  const arr3 = [];
  NV.spawnShockwave(arr3, 0, 0, { maxRadius: 110 });
  if (arr3.length !== 1) throw new Error('la onda principal nunca se omite');
});
t('game.js: gates decorativos conectados y balas enemigas intactas', () => {
  const g = fs.readFileSync('js/game.js', 'utf8');
  if (!g.includes('function trailStep()')) throw new Error('trailStep ausente');
  if (!g.includes('frame % trailStep()')) throw new Error('trail no usa el budget');
  if (!g.includes('rbStep')) throw new Error('rhythm layer sin throttle');
  if (!g.includes('heavyShadowOk')) throw new Error('heavyShadow gate ausente');
  if (!g.includes('meteorTrailAlpha')) throw new Error('estela de meteoros sin gate');
  if (!g.includes('Balas enemigas: se dibujan como antes')) throw new Error('dibujo de balas enemigas alterado');
  const sp = fs.readFileSync('js/engine/special.js', 'utf8');
  if (!sp.includes('secondary: true')) throw new Error('anillo secundario sin marca');
});

console.log('RESULT performance_foundation: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);

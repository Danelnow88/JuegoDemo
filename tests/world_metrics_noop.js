const fs = require('fs');
const vm = require('vm');

let pass = 0, fail = 0;
function t(desc, fn) {
  try { fn(); pass++; console.log('  ok  ' + desc); }
  catch (e) { fail++; console.log('  FAIL ' + desc + ' -> ' + e.message); }
}
function load(f, sbx) { vm.runInNewContext(fs.readFileSync(f, 'utf8'), sbx, { filename: f }); }
function eq(actual, expected, label) {
  if (Math.abs(actual - expected) > 1e-9) throw new Error(label + '=' + actual + ' expected ' + expected);
}

function sandbox(opts) {
  opts = opts || {};
  const canvas = {
    getBoundingClientRect() {
      return {
        left: opts.rectLeft || 0,
        top: opts.rectTop || 0,
        width: opts.cssW || 900,
        height: opts.cssH || 520,
      };
    },
  };
  const doc = {
    documentElement: {},
    getElementById(id) { return id === 'game' ? canvas : null; },
    addEventListener() {}, removeEventListener() {},
  };
  const sbx = {
    NV: opts.nv || {},
    window: null,
    document: doc,
    console,
    Math, Date, JSON, Object, Array, Number, String, Boolean, Promise, Symbol, Proxy, Reflect, Error, TypeError, isNaN, parseInt, parseFloat,
    setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    devicePixelRatio: opts.dpr || 1,
    innerWidth: opts.cssW || 900,
    innerHeight: opts.cssH || 520,
    screen: { orientation: {} },
    addEventListener() {}, removeEventListener() {},
  };
  sbx.window = sbx;
  return sbx;
}

function loadViewport(opts) {
  const sbx = sandbox(opts);
  load('js/core/viewport.js', sbx);
  return sbx;
}

t('worldMetrics defaults ref/view/arena = 900x520 y scale=1', () => {
  const sbx = loadViewport({ nv: { capabilities: { isMobile: false } } });
  const m = sbx.NV.worldMetrics;
  eq(m.refW, 900, 'refW'); eq(m.refH, 520, 'refH');
  eq(m.viewW, 900, 'viewW'); eq(m.viewH, 520, 'viewH');
  eq(m.viewX, 0, 'viewX'); eq(m.viewY, 0, 'viewY');
  eq(m.arenaW, 900, 'arenaW'); eq(m.arenaH, 520, 'arenaH');
  eq(m.scale, 1, 'scale');
  if (sbx.NV.viewport.worldMetrics !== m) throw new Error('viewport no comparte NV.worldMetrics');
});

t('desktop viewport mapping unchanged', () => {
  const sbx = loadViewport({ nv: { capabilities: { isMobile: false } }, cssW: 800, cssH: 600 });
  const p = sbx.NV.viewport.screenToGame(400, 300);
  eq(p.x, 450, 'x');
  eq(p.y, 260, 'y');
});

t('mobile CONTAIN mapping unchanged con pillarbox', () => {
  const sbx = loadViewport({ nv: { capabilities: { isMobile: true } }, cssW: 1800, cssH: 520, rectLeft: 100, rectTop: 50 });
  const v = sbx.NV.viewport;
  v.refresh();
  eq(v.displayScale, 1, 'displayScale');
  eq(v.offsetX, 450, 'offsetX');
  eq(v.offsetY, 0, 'offsetY');
});

t('screenToGame unchanged', () => {
  const sbx = loadViewport({ nv: { capabilities: { isMobile: true } }, cssW: 1800, cssH: 520, rectLeft: 100, rectTop: 50 });
  const p = sbx.NV.screenToGame(850, 250);
  eq(p.x, 300, 'x');
  eq(p.y, 200, 'y');
});

t('gameToScreen unchanged', () => {
  const sbx = loadViewport({ nv: { capabilities: { isMobile: true } }, cssW: 1800, cssH: 520, rectLeft: 100, rectTop: 50 });
  const p = sbx.NV.gameToScreen(300, 200);
  eq(p.x, 850, 'x');
  eq(p.y, 250, 'y');
});

t('player bounds remain 900x520 via ARENA metrics', () => {
  const g = fs.readFileSync('js/game.js', 'utf8');
  if (!g.includes('const ARENA_W = worldMetrics.arenaW, ARENA_H = worldMetrics.arenaH')) throw new Error('faltan aliases arena');
  if (!g.includes('function arenaW()')) throw new Error('arenaW accessor ausente');
  if (!g.includes('Math.min(arenaW() - 20, player.x)')) throw new Error('clamp X esperado no encontrado');
  if (!g.includes('Math.min(arenaH() - 20, player.y)')) throw new Error('clamp Y esperado no encontrado');
});

t('enemy spawns still receive 900x520 arena dimensions', () => {
  const g = fs.readFileSync('js/game.js', 'utf8');
  if (!g.includes('NV.spawnEnemy({ enemies, MAX_ENEMIES, boss, wave, ENEMY_TYPES, W: arenaW(), H: arenaH()')) throw new Error('spawnEnemy no recibe W/H arena runtime');
  if (!g.includes('NV.spawnElite({ enemies, MAX_ENEMIES, boss, wave, ELITE_TYPES, W: arenaW(), H: arenaH()')) throw new Error('spawnElite no recibe W/H arena runtime');
});

t('boss center remains x=450', () => {
  const g = fs.readFileSync('js/game.js', 'utf8');
  if (!g.includes('boss = { x: arenaW()/2, y: 100')) throw new Error('boss spawn center no usa arenaW');
  const sbx = { window: { NV: {} }, console, Math };
  sbx.window.window = sbx.window;
  load('js/engine/boss.js', sbx.window);
  const boss = { x: 0, y: 100, hp: 100, maxHp: 100, timer: 0, pattern: 'burst', attack: 'spread', primaryAttack: 'spread', atkTimer: 999, radius: 20, dead: false };
  const st = { boss, player: { x: 450, y: 400, hp: 100, maxHp: 100 }, enemies: [], bullets: [], W: 900, H: 520, score: 0, shards: 0, wave: 5, shake: 0, MAX_BULLETS: 100, MAX_ENEMY_BULLETS: 100, enemyBulletCount: () => 0, ENEMY_TYPES: [{ speed: 1, color: '#fff' }], sfx: { bossAttack: new Proxy({}, { get: () => () => {} }) }, spawnExplosion() {}, showBanner() {}, triggerFlash() {}, triggerWaveVictory() {}, addFloatText() {}, spawnBossProj() {}, spawnMinion() {}, runBossAttack() {}, spawnBossChest() {} };
  sbx.window.NV.updateBoss(0, st);
  eq(boss.x, 450, 'boss.x');
});

t('projectile culling remains equivalent at 900x520', () => {
  const sbx = { window: { NV: {} }, console, Math, Array };
  sbx.window.window = sbx.window;
  load('js/engine/bullets.js', sbx.window);
  const st = { bullets: [{ x: 911, y: 260, vx: 0, vy: 0, damage: 1, dead: false }], W: 900, H: 520, player: { x: 450, y: 260, hp: 100, invuln: 0, character: 'boti' }, enemies: [], boss: null, CHARACTERS: { boti: { size: 12 } }, SHIELD_COOLDOWN: 1, computePlayerHit: () => ({ dmg: 1 }), addFloatText() {}, killEnemy() {}, applyKnockback() {}, spawnExplosion() {} };
  const r = sbx.window.NV.updateBullets(0, st);
  if (r.bullets.length !== 0) throw new Error('bala fuera de W+10 no fue purgada');
});

t('WebGL/world center remains aligned to view center 450,260', () => {
  const g = fs.readFileSync('js/game.js', 'utf8');
  if (!g.includes('OrthographicCamera(viewX(), viewX() + viewW(), -viewY(), -(viewY() + viewH())')) throw new Error('cámara no usa rect VIEW');
  if (!g.includes('x: e.x, y: -e.y')) throw new Error('overlay no usa coordenadas mundo con cámara VIEW');
  const sbx = loadViewport({ nv: { capabilities: { isMobile: false } } });
  eq(sbx.NV.worldMetrics.viewW / 2, 450, 'viewCenterX');
  eq(sbx.NV.worldMetrics.viewH / 2, 260, 'viewCenterY');
});

console.log('RESULT world_metrics_noop: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
const fs = require('fs');
const vm = require('vm');

let pass = 0, fail = 0;
function t(desc, fn) {
  try { fn(); pass++; console.log('  ok  ' + desc); }
  catch (e) { fail++; console.log('  FAIL ' + desc + ' -> ' + e.message); }
}
function near(actual, expected, label, eps) {
  eps = eps == null ? 1e-6 : eps;
  if (Math.abs(actual - expected) > eps) throw new Error(label + '=' + actual + ' expected ' + expected);
}
function load(f, sbx) { vm.runInNewContext(fs.readFileSync(f, 'utf8'), sbx, { filename: f }); }

function sandbox(opts) {
  opts = opts || {};
  const classes = [];
  const root = { classList: {
    add(c) { if (!classes.includes(c)) classes.push(c); },
    remove(c) { const i = classes.indexOf(c); if (i >= 0) classes.splice(i, 1); },
    contains(c) { return classes.includes(c); },
  } };
  const canvas = { getBoundingClientRect() { return { left: opts.left || 0, top: opts.top || 0, width: opts.cssW || 900, height: opts.cssH || 520 }; } };
  const doc = { documentElement: root, getElementById(id) { return id === 'game' ? canvas : null; }, addEventListener() {}, removeEventListener() {} };
  const sbx = {
    NV: opts.nv || {}, window: null, document: doc, console,
    Math, Date, JSON, Object, Array, Number, String, Boolean, Promise, Symbol, Proxy, Reflect, Error, TypeError, isNaN, parseInt, parseFloat,
    setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    devicePixelRatio: opts.dpr || 1, innerWidth: opts.cssW || 900, innerHeight: opts.cssH || 520,
    location: { search: opts.search || '' }, screen: { orientation: {} }, addEventListener() {}, removeEventListener() {},
  };
  sbx.window = sbx;
  return sbx;
}
function viewport(opts) { const sbx = sandbox(opts); load('js/core/viewport.js', sbx); return sbx; }
function engineSandbox(rand) {
  const math = Object.create(Math);
  math.random = typeof rand === 'function' ? rand : Math.random;
  const w = { NV: { enemyHpScale: () => 1, BALANCE: { METEOR_BOSS_DMG_MULT: 1 } } };
  w.window = w;
  w.Math = math;
  w.Array = Array;
  w.console = console;
  return { window: w, console, Math: math, Array };
}

t('1. mobile landscape default: arenaW follows viewW', () => {
  const sbx = viewport({ nv: { capabilities: { isMobile: true, orientation: 'landscape' } }, cssW: 915, cssH: 412 });
  near(sbx.NV.worldMetrics.arenaW, 520 * 915 / 412, 'arenaW');
  if (!sbx.NV.viewport.dynamicViewActive) throw new Error('dynamicViewActive=false');
});

t('2. dynamic 915x412: arenaW≈1154.85 y arenaH=520', () => {
  const sbx = viewport({ nv: { capabilities: { isMobile: true, orientation: 'landscape' } }, cssW: 915, cssH: 412 });
  near(sbx.NV.worldMetrics.viewW, 520 * 915 / 412, 'viewW');
  near(sbx.NV.worldMetrics.arenaW, 520 * 915 / 412, 'arenaW');
  near(sbx.NV.worldMetrics.arenaH, 520, 'arenaH');
  near(sbx.NV.worldMetrics.viewX, 0, 'viewX');
});

t('3. player max X follows dynamic arenaW', () => {
  const g = fs.readFileSync('js/game.js', 'utf8');
  if (!g.includes('Math.min(arenaW() - 20, player.x)')) throw new Error('player clamp no usa arenaW()');
});

t('4. enemy spawn side uses 0 or arenaW', () => {
  const sbx = engineSandbox(() => 0.75);
  load('js/engine/enemies.js', sbx.window);
  const enemies = [];
  sbx.window.NV.spawnEnemy({ enemies, MAX_ENEMIES: 10, boss: null, wave: 1, ENEMY_TYPES: [{ hp: 1, speed: 1, radius: 5, color: '#fff', score: 1, xp: 1, behavior: 'chase' }], W: 1154.85, H: 520 });
  near(enemies[0].x, 1154.85, 'enemy.x');
});

t('5. boss center = arenaW / 2', () => {
  const sbx = engineSandbox();
  load('js/engine/boss.js', sbx.window);
  const boss = { x: 0, y: 100, hp: 100, maxHp: 100, timer: 0, pattern: 'burst', attack: 'spread', primaryAttack: 'spread', atkTimer: 0, radius: 20, dead: false };
  const st = { boss, player: { x: 577.425, y: 400, hp: 100, maxHp: 100 }, enemies: [], bullets: [], W: 1154.85, H: 520, score: 0, shards: 0, wave: 5, shake: 0, MAX_BULLETS: 100, MAX_ENEMY_BULLETS: 100, enemyBulletCount: () => 0, ENEMY_TYPES: [], sfx: { bossAttack: new Proxy({}, { get: () => () => {} }) }, spawnExplosion() {}, showBanner() {}, triggerFlash() {}, triggerWaveVictory() {}, addFloatText() {}, spawnBossProj() {}, spawnMinion() {}, runBossAttack() {}, spawnBossChest() {} };
  sbx.window.NV.updateBoss(0, st);
  near(boss.x, 1154.85 / 2, 'boss.x');
});

t('6. projectile culling uses arenaW', () => {
  const sbx = engineSandbox();
  load('js/engine/bullets.js', sbx.window);
  const st = { bullets: [{ x: 910, y: 260, vx: 0, vy: 0, damage: 1, dead: false }], W: 1154.85, H: 520, player: { x: 450, y: 260, hp: 100, invuln: 0, character: 'boti' }, enemies: [], boss: null, CHARACTERS: { boti: { size: 12 } }, SHIELD_COOLDOWN: 1, applyPlayerDamage: () => ({ applied: true, damage: 1, killed: false }), addFloatText() {}, killEnemy() {}, applyKnockback() {}, spawnExplosion() {} };
  const r = sbx.window.NV.updateBullets(0, st);
  if (r.bullets.length !== 1) throw new Error('bala dentro de arena dinámica fue purgada');
});

t('7. pickup bounds use arenaW', () => {
  const rolls = [0, 1, 0];
  const sbx = engineSandbox(() => rolls.length ? rolls.shift() : 0);
  load('js/engine/pickups.js', sbx.window);
  const weaponPickups = [];
  sbx.window.NV.spawnWeaponPickup([{ name: 'TEST', rarity: 'common' }], weaponPickups, 1154.85, 520, () => {}, { common: '#fff' });
  near(weaponPickups[0].x, 1154.85 - 40, 'pickup.x');
});

t('8. special/meteor width uses arenaW', () => {
  const g = fs.readFileSync('js/game.js', 'utf8');
  if (!g.includes('W: arenaW(), H: arenaH(), shake, specialVFX')) throw new Error('useSpecial no recibe W/H dinámico');
  const sbx = engineSandbox(() => 1);
  load('js/engine/special.js', sbx.window);
  const meteors = [];
  sbx.window.NV.useSpecial({ player: { character: 'boti', x: 10, y: 10 }, CHARACTERS: { boti: { special: 'meteor', maxCd: 1, skillName: 'lluvia', color: '#fff' } }, meteors, particles: [], drones: [], W: 1154.85, shake: 0, specialVFX: null, cbs: { showBanner() {}, triggerFlash() {}, spawnExplosion() {}, sfx: { special() {} } } });
  near(meteors[0].x, 1154.85 - 30, 'meteor.x');
});

t('9. desktop remains 900x520', () => {
  const sbx = viewport({ nv: { capabilities: { isMobile: false, orientation: 'landscape' } }, cssW: 915, cssH: 412, search: '?dynamicView=1' });
  near(sbx.NV.worldMetrics.arenaW, 900, 'arenaW'); near(sbx.NV.worldMetrics.arenaH, 520, 'arenaH');
});

t('10. legacy mobile remains 900x520', () => {
  const sbx = viewport({ nv: { capabilities: { isMobile: true, orientation: 'landscape' } }, cssW: 915, cssH: 412, search: '?dynamicView=0' });
  near(sbx.NV.worldMetrics.arenaW, 900, 'arenaW'); near(sbx.NV.worldMetrics.arenaH, 520, 'arenaH');
});

t('11. Canvas2D/WebGL center alignment remains correct', () => {
  const g = fs.readFileSync('js/game.js', 'utf8');
  if (!g.includes('ctx.setTransform(scaleX, 0, 0, scaleY, -vx * scaleX, -vy * scaleY)')) throw new Error('Canvas2D transform no usa view origin');
  if (!g.includes('camera.left = viewX()') || !g.includes('camera.right = viewX() + viewW()')) throw new Error('WebGL camera no usa view rect');
  const sbx = viewport({ nv: { capabilities: { isMobile: true, orientation: 'landscape' } }, cssW: 915, cssH: 412 });
  const p = sbx.NV.gameToScreen(sbx.NV.worldMetrics.arenaW / 2, 260);
  near(p.x, 915 / 2, 'centerX'); near(p.y, 412 / 2, 'centerY');
});

t('12. screenToGame/gameToScreen round-trip correctly', () => {
  const sbx = viewport({ nv: { capabilities: { isMobile: true, orientation: 'landscape' } }, cssW: 915, cssH: 412 });
  const a = sbx.NV.screenToGame(123, 321);
  const b = sbx.NV.gameToScreen(a.x, a.y);
  near(b.x, 123, 'x'); near(b.y, 321, 'y');
});

console.log('RESULT dynamic_arena: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
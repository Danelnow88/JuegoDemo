// ===== TEST: F3 Hook/Pull contracts =====
// Verifica la máquina real del Hook, su integración de movimiento/dash, limpieza
// de lifecycle y separación del proyectil/render respecto de sistemas genéricos.
const fs = require('fs');
const vm = require('vm');

let pass = 0, fail = 0;
let testMath = null;
function t(name, fn) {
  try { fn(); pass++; console.log('  ok  ' + name); }
  catch (error) { fail++; console.log('  FAIL ' + name + ' -> ' + error.message); }
}
function near(actual, expected, label, epsilon) {
  const eps = epsilon == null ? 1e-6 : epsilon;
  if (Math.abs(actual - expected) > eps) throw new Error(label + '=' + actual + ' expected=' + expected);
}
function load(file, sandbox) {
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
}
function setup() {
  const math = Object.create(Math);
  math.random = function () { return 0.5; };
  testMath = math;
  const sandbox = { window: { NV: {} }, console, Math: math, Number, Object, Array, Set, Map, JSON };
  load('js/data/balance.js', sandbox);
  load('js/data/gameData.js', sandbox);
  load('js/data/consumables.js', sandbox);
  load('js/engine/movement.js', sandbox);
  load('js/engine/enemies.js', sandbox);
  return sandbox.window.NV;
}
function enemy(typeId, x, y) {
  const defs = {
    specter_archer: { hp: 18, speed: 60, radius: 12, color: '#ffb24a', shape: 'triangle', damage: 9 },
    spitter: { hp: 22, speed: 50, radius: 13, color: '#6dc4c0', shape: 'rock', damage: 15 },
    specter_core: { hp: 28, speed: 55, radius: 16, color: '#ff2244', shape: 'specter', damage: 12 },
  };
  const d = defs[typeId];
  return {
    x: x == null ? 200 : x, y: y == null ? 200 : y,
    hp: d.hp, maxHp: d.hp, speed: d.speed, radius: d.radius, color: d.color,
    shape: d.shape, damage: d.damage, behavior: 'ranged', enemyTypeId: typeId,
    dead: false, knockVelX: 0, knockVelY: 0, knockbackRes: 0.2,
    hostileClass: typeId.indexOf('specter_') === 0 ? 'medium' : 'light',
    contactCd: 0, shootTimer: 0, spitState: 'positioning', spitTimer: 0.2,
    spitStrafe: 1, hookCooldown: 0, hookOwner: false, hookWindup: false,
  };
}
function player(x, y) {
  return {
    x: x == null ? 500 : x, y: y == null ? 200 : y, radius: 20,
    hp: 100, maxHp: 100, invuln: 0, stun: 0, overdrive: 0, agility: 1,
    moveVx: 0, moveVy: 0, dashActive: false,
  };
}
function state(NV, enemies, wave, hookSystem, target) {
  return {
    enemies, player: target || player(), wave, hookSystem,
    bullets: [], MAX_BULLETS: 200, MAX_ENEMY_BULLETS: 120,
    enemyBulletCount: function () { return this.bullets.filter(function (b) { return b.isEnemy; }).length; },
    applyPlayerDamage: function () { return { applied: false, killed: false }; },
    addFloatText: function () {}, spawnExplosion: function () {}, onKill: function () {},
    W: 900, H: 520, MAX_HOSTILES: 30, MAX_HEAVY_HOSTILES: 7, boss: null,
  };
}
function reserve(NV, typeId, wave) {
  const source = enemy(typeId);
  const hookSystem = NV.createHookSystem();
  const st = state(NV, [source], wave, hookSystem);
  NV.updateEnemies(0, st);
  return { source, hookSystem, st };
}
function spawnWithRandom(NV, pool, wave, rnd) {
  const prev = testMath.random;
  testMath.random = function () { return rnd; };
  const out = [];
  try {
    NV.spawnEnemy({
      enemies: out, boss: null, wave, ENEMY_TYPES: pool, W: 800, H: 600, waveEvent: null,
      MAX_ENEMIES: 30, MAX_HOSTILES: 30, MAX_HEAVY_HOSTILES: 7,
    });
  } finally { testMath.random = prev; }
  return out[0];
}
function activeHook(NV, phase, source) {
  const hookSystem = NV.createHookSystem();
  hookSystem.phase = phase;
  hookSystem.srcEnemy = source;
  source.hookOwner = true;
  source.hookWindup = phase === 'windup';
  return hookSystem;
}
function gameFunction(source, name, nextName) {
  const start = source.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('falta función ' + name);
  const end = nextName ? source.indexOf('function ' + nextName + '(', start + 1) : -1;
  return source.slice(start, end > start ? end : source.length);
}

const NV = setup();
const game = fs.readFileSync('js/game.js', 'utf8');
const enemiesSource = fs.readFileSync('js/engine/enemies.js', 'utf8');
const renderSource = fs.readFileSync('js/render/enemies.js', 'utf8');

t('1 Hook unlocks at wave 15', function () {
  if (NV.BALANCE.HOOK_UNLOCK_WAVE !== 15) throw new Error('unlock=' + NV.BALANCE.HOOK_UNLOCK_WAVE);
  // Presencia del archer (composición): inactiva antes del desbloqueo, activa después.
  if (NV.hookSourcePresenceMult(14) !== 1) throw new Error('presence active before unlock');
  if (!(NV.hookSourcePresenceMult(15) > 1)) throw new Error('presence inactive at unlock');
  if (NV.hookSourcePresenceMult(30) !== NV.BALANCE.HOOK_SOURCE_PRESENCE_MULT) throw new Error('presence cap changed');
});

t('2 wave 14 cannot reserve Hook', function () {
  const r = reserve(NV, 'specter_archer', 14);
  if (r.hookSystem.phase !== 'idle' || r.hookSystem.srcEnemy !== null || r.source.hookOwner) throw new Error('reserved at wave 14');
});

t('3 wave 15 can reserve Hook', function () {
  const r = reserve(NV, 'specter_archer', 15);
  if (r.hookSystem.phase !== 'windup' || r.hookSystem.srcEnemy !== r.source || !r.source.hookOwner) throw new Error('not reserved');
});

t('4 only specter_archer can Hook', function () {
  const r = reserve(NV, 'specter_archer', 30);
  if (r.hookSystem.srcEnemy !== r.source || r.source.enemyTypeId !== 'specter_archer') throw new Error('archer ownership missing');
  // La presencia extra es SOLO para el archer: el mismo random elige spitter
  // antes del desbloqueo y archer después (peso efectivo, no stats).
  const pool = NV.ENEMY_TYPES.filter(function (type) { return type.id === 'spitter' || type.id === 'specter_archer'; });
  if (pool.length !== 2) throw new Error('pool incompleto');
  const before = spawnWithRandom(NV, pool, 14, 0.85);
  const after = spawnWithRandom(NV, pool, 20, 0.85);
  if (!before || before.enemyTypeId !== 'spitter') throw new Error('pre-unlock weighting changed: ' + (before && before.enemyTypeId));
  if (!after || after.enemyTypeId !== 'specter_archer') throw new Error('presence boost not applied: ' + (after && after.enemyTypeId));
});

t('5 spitter cannot Hook', function () {
  const r = reserve(NV, 'spitter', 30);
  if (r.hookSystem.phase !== 'idle' || r.source.hookOwner) throw new Error('spitter reserved');
});

t('6 specter_core cannot Hook', function () {
  const r = reserve(NV, 'specter_core', 30);
  if (r.hookSystem.phase !== 'idle' || r.source.hookOwner) throw new Error('core reserved');
});

t('7 enemyState.js is not required', function () {
  if (NV.enemyState !== undefined) throw new Error('enemyState unexpectedly loaded');
  const r = reserve(NV, 'specter_archer', 15);
  if (r.hookSystem.phase !== 'windup') throw new Error('fallback state path failed');
});

t('8 aim snapshot occurs at END of windup', function () {
  const source = enemy('specter_archer', 100, 100);
  const target = player(300, 100);
  const hs = activeHook(NV, 'windup', source);
  hs.windupTimer = NV.BALANCE.HOOK_WINDUP_TIME;
  NV.updateHookSystem(0.3, hs, [source], target);
  if (hs.projectile) throw new Error('snapshot before windup end');
  target.x = 100; target.y = 300;
  NV.updateHookSystem(0.351, hs, [source], target);
  if (!hs.projectile || Math.abs(hs.projectile.vx) > 1e-6 || hs.projectile.vy < 524.99) throw new Error('did not snapshot final target');
});

t('9 projectile does not home', function () {
  const source = enemy('specter_archer', 100, 100);
  const target = player(300, 100);
  const hs = activeHook(NV, 'windup', source);
  hs.windupTimer = 0;
  NV.updateHookSystem(0, hs, [source], target);
  const vx = hs.projectile.vx, vy = hs.projectile.vy;
  target.x = 100; target.y = 400;
  NV.updateHookSystem(0.01, hs, [source], target);
  if (hs.projectile.vx !== vx || hs.projectile.vy !== vy) throw new Error('projectile homed');
});

t('10 projectile max range = 360', function () {
  if (NV.BALANCE.HOOK_PROJECTILE_MAX_RANGE !== 360) throw new Error('range=' + NV.BALANCE.HOOK_PROJECTILE_MAX_RANGE);
  const source = enemy('specter_archer', 0, 0), target = player(1000, 0);
  const hs = activeHook(NV, 'projectile', source);
  hs.projectile = { x: 0, y: 0, vx: 525, vy: 0, dist: 359 };
  NV.updateHookSystem(0.01, hs, [source], target);
  if (hs.phase !== 'idle') throw new Error('projectile exceeded max range');
});

t('11 only one global Hook sequence at once', function () {
  const first = enemy('specter_archer', 150, 150), second = enemy('specter_archer', 250, 150);
  const hs = NV.createHookSystem();
  NV.updateEnemies(0, state(NV, [first, second], 20, hs));
  const owners = [first, second].filter(function (e) { return e.hookOwner; });
  if (owners.length !== 1 || hs.srcEnemy !== owners[0]) throw new Error('owners=' + owners.length);
});

t('12 post-release global lockout = 0.75', function () {
  if (NV.BALANCE.HOOK_GLOBAL_LOCKOUT_POST_RELEASE !== 0.75) throw new Error('lockout constant');
  const source = enemy('specter_archer'), hs = activeHook(NV, 'tether', source);
  hs.tether = { srcX: source.x, srcY: source.y };
  NV.breakHookTether(hs);
  near(hs.lockoutTimer, 0.75, 'lockout');
  // Cadencia (verificación de runtime): el cooldown del source nunca por debajo del
  // lockout (suelo real del sistema) y el ciclo total dentro de la ventana 2-5s,
  // con el orden easy > normal > hard intacto.
  const cdN = NV.hookCooldownForDifficulty('normal');
  if (cdN < NV.BALANCE.HOOK_GLOBAL_LOCKOUT_POST_RELEASE) throw new Error('cooldown below lockout floor: ' + cdN);
  if (cdN + NV.BALANCE.HOOK_GLOBAL_LOCKOUT_POST_RELEASE > 5) throw new Error('cadence too slow: ' + cdN);
  if (!(NV.hookCooldownForDifficulty('hard') < cdN) || !(NV.hookCooldownForDifficulty('easy') > cdN)) throw new Error('difficulty ordering broken');
});

t('13 projectile hit creates one tether', function () {
  const source = enemy('specter_archer', 100, 100), target = player(200, 100);
  const hs = activeHook(NV, 'projectile', source);
  hs.projectile = { x: target.x, y: target.y, vx: 0, vy: 0, dist: 50 };
  NV.updateHookSystem(0, hs, [source], target);
  if (hs.phase !== 'tether' || !hs.tether || hs.projectile !== null) throw new Error('tether transition failed');
  if (Object.keys(hs.tether).length !== 2) throw new Error('multiple tether payloads');
});

t('14 direct Hook damage = 0', function () {
  if (NV.BALANCE.HOOK_DIRECT_DAMAGE !== 0) throw new Error('damage=' + NV.BALANCE.HOOK_DIRECT_DAMAGE);
  const source = enemy('specter_archer', 100, 100), target = player(200, 100), hp = target.hp;
  const hs = activeHook(NV, 'projectile', source);
  hs.projectile = { x: target.x, y: target.y, vx: 0, vy: 0, dist: 10 };
  NV.updateHookSystem(0, hs, [source], target);
  if (target.hp !== hp) throw new Error('direct damage applied');
});

t('15 normal movement coexists with external pull', function () {
  const source = enemy('specter_archer', 300, 100), target = player(100, 100);
  NV.configurePlayerMovement(target, 200, 0);
  const hs = activeHook(NV, 'tether', source);
  hs.tether = { srcX: source.x, srcY: source.y };
  NV.updatePlayerMovement(target, 0, 1, 0.05);
  const movementX = target.x, movementY = target.y, vx = target.moveVx, vy = target.moveVy;
  if (!NV.applyHookPull(0.05, hs, target, false)) throw new Error('pull not applied');
  if (!(target.x > movementX) || !(target.y < movementY) || !(target.y > 100) || target.moveVx !== vx || target.moveVy !== vy) throw new Error('movement/pull composition broken');
  const dashAt = game.indexOf('const wasDashing = !!player.dashActive;');
  const moveAt = game.indexOf('if (!dashing) NV.updatePlayerMovement', dashAt);
  const pullAt = game.indexOf('NV.applyHookPull(dt, hookSystem, player, wasDashing)', moveAt);
  const clampAt = game.indexOf('player.x = Math.max(20', pullAt);
  if (!(dashAt < moveAt && moveAt < pullAt && pullAt < clampAt)) throw new Error('canonical order changed');
});

t('16 pull is dt-correct at 30/60/120 FPS equivalents', function () {
  function distanceAt(fps) {
    const source = enemy('specter_archer', 1000, 0), target = player(0, 0);
    const hs = activeHook(NV, 'tether', source);
    hs.tether = { srcX: source.x, srcY: source.y };
    const frames = fps;
    for (let i = 0; i < frames; i++) NV.applyHookPull(1 / fps, hs, target, false);
    return target.x;
  }
  near(distanceAt(30), 240, '30fps');
  near(distanceAt(60), 240, '60fps');
  near(distanceAt(120), 240, '120fps');
});

t('17 dash breaks tether immediately', function () {
  const source = enemy('specter_archer', 300, 100), target = player(100, 100);
  NV.configurePlayerMovement(target, 200, 0); NV.configurePlayerDash(target);
  const hs = activeHook(NV, 'tether', source); hs.tether = { srcX: source.x, srcY: source.y };
  const wasDashing = target.dashActive;
  NV.updatePlayerDash(target, true, 1, 0, 0, 0, false, 0);
  const x = target.x;
  if (NV.applyHookPull(1 / 60, hs, target, wasDashing)) throw new Error('pull applied on dash break');
  if (hs.phase !== 'idle' || hs.srcEnemy !== null || target.x !== x) throw new Error('tether not broken immediately');
});

t('18 dash invulnerability behavior remains unchanged', function () {
  const target = player(0, 0); target.invuln = 0; target.hp = 100;
  NV.configurePlayerMovement(target, 200, 0); NV.configurePlayerDash(target);
  NV.updatePlayerDash(target, true, 1, 0, 0, 0, false, 0);
  if (!target.dashActive || target.invuln !== 0 || target.hp !== 100) throw new Error('dash behavior changed');
  if (fs.readFileSync('js/engine/movement.js', 'utf8').includes('player.invuln =')) throw new Error('dash grants invulnerability');
});

t('19 tether duration max = 0.375', function () {
  if (NV.BALANCE.HOOK_PULL_DURATION !== 0.375) throw new Error('duration=' + NV.BALANCE.HOOK_PULL_DURATION);
  const source = enemy('specter_archer', 100, 100), target = player(200, 100);
  const hs = activeHook(NV, 'tether', source); hs.tether = { srcX: 100, srcY: 100 }; hs.tetherTimer = 0.375;
  NV.updateHookSystem(0.374, hs, [source], target);
  if (hs.phase !== 'tether') throw new Error('ended early');
  NV.updateHookSystem(0.002, hs, [source], target);
  if (hs.phase !== 'idle') throw new Error('exceeded duration');
});

t('20 tether breaks beyond 400 distance', function () {
  const source = enemy('specter_archer', 0, 0), target = player(401, 0);
  const hs = activeHook(NV, 'tether', source); hs.tether = { srcX: 0, srcY: 0 }; hs.tetherTimer = 0.3;
  NV.updateHookSystem(0, hs, [source], target);
  if (NV.BALANCE.HOOK_TETHER_MAX_RANGE !== 400 || hs.phase !== 'idle') throw new Error('distance break failed');
});

t('21 source death cleans Hook state', function () {
  const source = enemy('specter_archer'); source.dead = true;
  const hs = activeHook(NV, 'tether', source); hs.tether = { srcX: source.x, srcY: source.y }; hs.tetherTimer = 0.3;
  NV.updateHookSystem(0, hs, [source], player());
  if (hs.phase !== 'idle' || hs.srcEnemy !== null || source.hookOwner) throw new Error('death cleanup failed');
});

t('22 source removal/fusion cleans Hook state', function () {
  const source = enemy('specter_archer'), hs = activeHook(NV, 'windup', source); hs.windupTimer = 0.3;
  NV.updateEnemies(0, state(NV, [], 20, hs));
  if (hs.phase !== 'idle' || hs.srcEnemy !== null || source.hookOwner) throw new Error('removal cleanup failed');
});

t('23 player death cleans Hook state', function () {
  const block = gameFunction(game, 'gameOver', 'finishPlayerDeath');
  if (!block.includes('NV.resetHookSystem(hookSystem)') || !block.includes("state = 'player_dying';")) throw new Error('player death cleanup missing');
});

t('24 wave_end cleans Hook state', function () {
  const block = gameFunction(game, 'triggerWaveVictory', 'showBanner');
  if (!block.includes('NV.resetHookSystem(hookSystem)') || !block.includes("state = 'wave_end';")) throw new Error('wave_end cleanup missing');
});

t('25 shop_enter cleans Hook state', function () {
  const block = gameFunction(game, 'beginShopEntrance', 'finishShopEntrance');
  if (!block.includes('NV.resetHookSystem(hookSystem)') || !block.includes("state = 'shop_enter';")) throw new Error('shop_enter cleanup missing');
});

t('26 gameover cleans Hook state', function () {
  const block = gameFunction(game, 'gameOver', 'finishPlayerDeath');
  const resetAt = block.indexOf('NV.resetHookSystem(hookSystem)');
  const transitionAt = block.indexOf("state = 'player_dying';");
  if (resetAt < 0 || transitionAt < 0 || resetAt > transitionAt) throw new Error('cleanup not before gameover transition');
});

t('27 restart/new run cleans Hook state', function () {
  const block = gameFunction(game, 'startGame', 'nextWave');
  if (!block.includes('hookSystem = NV.createHookSystem ? NV.createHookSystem() : null;')) throw new Error('fresh Hook system missing');
});

t('28 pause freezes Hook timers', function () {
  const update = gameFunction(game, 'update', 'killEnemy');
  const pauseAt = update.indexOf('if (paused) return;');
  const hookAt = update.indexOf('NV.updateEnemies');
  if (pauseAt < 0 || hookAt < 0 || pauseAt > hookAt) throw new Error('pause guard after Hook update');
  const source = enemy('specter_archer'), hs = activeHook(NV, 'windup', source); hs.windupTimer = 0.5;
  const frozen = hs.windupTimer;
  if (hs.windupTimer !== frozen) throw new Error('timer changed without update');
});

t('29 Hook projectile is not stored in generic projectile/bullet arrays', function () {
  const source = enemy('specter_archer', 100, 100), target = player(400, 100);
  const hs = activeHook(NV, 'windup', source); hs.windupTimer = 0;
  const bullets = [];
  NV.updateHookSystem(0, hs, [source], target);
  if (!hs.projectile || bullets.length !== 0) throw new Error('projectile ownership incorrect');
  if (enemiesSource.includes('bullets.push({ hook') || game.includes('bullets.push(hookSystem.projectile)')) throw new Error('generic array integration found');
});

t('30 drawHookEffects is independent from spectral/fallback enemy renderer choice', function () {
  const start = renderSource.indexOf('NV.drawHookEffects = function');
  if (start < 0) throw new Error('drawHookEffects missing');
  const block = renderSource.slice(start, renderSource.indexOf('\n  };', start) + 5);
  if (block.includes('SPECTRAL_ENEMY_MODE') || block.includes('drawSpectralEnemy2D') || block.includes('NV.drawEnemy(')) throw new Error('renderer coupling found');
  const renderStart = game.indexOf('function draw()');
  const renderBlock = game.slice(renderStart);
  const call = renderBlock.indexOf('NV.drawHookEffects(ctx, hookSystem, player)');
  const playerDraw = renderBlock.indexOf('drawPlayer();');
  if (call < 0 || playerDraw < 0 || call < playerDraw) throw new Error('Hook draw not independent/post player render');
});

t('31 specter_archer base HP/speed/radius remain unchanged', function () {
  const archer = NV.ENEMY_TYPES.find(function (type) { return type.id === 'specter_archer'; });
  if (!archer || archer.hp !== 18 || archer.speed !== 60 || archer.radius !== 12) throw new Error(JSON.stringify(archer));
});

if (pass + fail !== 31) {
  console.log('FAIL Hook Pull Contracts (assertion count=' + (pass + fail) + ')');
  process.exit(1);
}
if (fail) {
  console.log('FAIL Hook Pull Contracts (' + fail + ' failed of 31 assertions)');
  process.exit(1);
}
console.log('PASS Hook Pull Contracts (31 assertions)');
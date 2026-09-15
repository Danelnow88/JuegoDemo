// ===== F4: sistema central de stun del jugador =====
// Enumera TODAS las fuentes productivas de stun, verifica la propagación
// rota (spitter / specter_elite_void / jefes), la invulnerabilidad accidental
// eliminada, el lockout anti-stunlock y la limpieza de timers. Determinista.
const fs = require('fs'), vm = require('vm');
let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; console.log('  ok  ' + name); } catch (e) { fail++; console.log('  FAIL ' + name + ' -> ' + e.message); } }

const FILES = [
  'js/data/balance.js', 'js/data/gameData.js', 'js/engine/combat.js',
  'js/engine/playerStun.js', 'js/engine/enemyState.js', 'js/engine/enemies.js',
  'js/engine/bullets.js', 'js/engine/boss.js', 'js/engine/movement.js',
];
function sandbox(randomValue) {
  const math = Object.create(Math);
  math.random = () => (randomValue === undefined ? 0 : randomValue);
  const sbx = { window: { NV: {} }, console, Math: math, Object, Array, Set, Map };
  for (const f of FILES) vm.runInNewContext(fs.readFileSync(f, 'utf8'), sbx, { filename: f });
  return { NV: sbx.window.NV, math };
}
function mkPlayer(over) {
  return Object.assign({
    x: 100, y: 100, character: 'boti', hp: 120, maxHp: 120, armor: 0, luck: 0,
    permDodge: 0, invuln: 0, stun: 0, stunReapplyLockout: 0, bulwark: 0, phase: 0, shield: 0,
    agility: 1, overdrive: 0, moveVx: 0, moveVy: 0, moveReversing: false,
  }, over || {});
}
function applyNoCrit(NV, player) {
  return (base, opts) => NV.applyPlayerDamage(base, Object.assign({
    player, CHARACTERS: NV.CHARACTERS,
    calcEnemyDamage: (b) => ({ dmg: b, crit: false }),
    addFloatText() {}, sfx: { playerHit() {} },
  }, opts || {}));
}
function bossFixture(attack, stunChance) {
  return { x: 400, y: 100, hp: 6000, maxHp: 6000, radius: 50, color: '#f00', name: 'B',
    attack, primaryAttack: attack, pattern: 'chase', shape: 'hex', atkTimer: 0, timer: 0,
    stunChance, isBoss: true, dead: false, hitFlash: 0 };
}
function bossSt(NV, boss) {
  return { boss, player: { x: 400, y: 500, moveVx: 0, moveVy: 0 }, enemies: [], bullets: [],
    MAX_BULLETS: 200, MAX_ENEMY_BULLETS: 120,
    enemyBulletCount() { let n = 0; for (const b of this.bullets) if (b.isEnemy) n++; return n; },
    wave: 20, W: 900, H: 520, score: 0, shards: 0, shake: 0,
    ENEMY_TYPES: NV.ENEMY_TYPES, MAX_HOSTILES: 30, MAX_HEAVY_HOSTILES: 7,
    sfx: { bossAttack: new Proxy({}, { get: () => () => {} }) },
    showBanner() {}, triggerFlash() {}, spawnExplosion() {}, addFloatText() {},
    triggerWaveVictory() {},
    spawnBossProj: (b, speed, damage, count, spread, color, radius, st, stun, stunDuration) => NV.spawnBossProj(b, speed, damage, count, spread, color, radius, st, stun, stunDuration),
    spawnMinion: () => false, spawnBossChest: () => {} };
}
function fireRanged(NV, e, player) {
  const st = {
    enemies: [e], player, bullets: [], MAX_BULLETS: 200, MAX_ENEMY_BULLETS: 120,
    enemyBulletCount() { let n = 0; for (const b of this.bullets) if (b.isEnemy) n++; return n; },
    applyPlayerDamage: () => ({ applied: false }), addFloatText() {}, spawnExplosion() {},
    MAX_HOSTILES: 30, MAX_HEAVY_HOSTILES: 7, boss: null, wave: 12, waveEvent: null, hookSystem: null,
  };
  e.x = 400; e.y = 300; player.x = 650; player.y = 300;
  e.shootTimer = 1.6;
  NV.updateEnemies(0.05, st); NV.updateEnemies(0.05, st);
  for (let i = 0; i < 13; i++) NV.updateEnemies(0.05, st);
  return st.bullets[0];
}
function bulletFixture(over) {
  return Object.assign({ x: 100, y: 100, vx: 0, vy: 0, damage: 15, color: '#6dc4c0', radius: 5, isEnemy: true, dead: false, stunChance: 0, stunDuration: 0, sourceType: 'test' }, over || {});
}
function bulletHit(NV, player, bullet) {
  return NV.updateBullets(0.016, {
    bullets: [bullet], W: 900, H: 520, player, enemies: [], boss: null,
    CHARACTERS: NV.CHARACTERS, SHIELD_COOLDOWN: 1,
    applyPlayerDamage: applyNoCrit(NV, player), addFloatText() {},
    killEnemy() {}, applyKnockback() {}, spawnExplosion() {},
  });
}

console.log('player_stun_system:');

t('mapa: fuentes productivas de stun con chance/duración objetivo', () => {
  const { NV } = sandbox();
  const spitter = NV.ENEMY_TYPES.find((x) => x.id === 'spitter');
  if (!spitter || spitter.stunChance !== 0.5 || spitter.stunDuration !== 0.45) throw new Error('spitter');
  const titan = NV.ELITE_TYPES.find((x) => x.visualId === 'elite_titan');
  if (!titan || titan.stunChance !== 0.35 || titan.stunDuration !== 0.55) throw new Error('titan');
  const vela = NV.ELITE_TYPES.find((x) => x.id === 'specter_elite_void');
  if (!vela || vela.stunChance !== 0.35 || vela.stunDuration !== 0.5) throw new Error('void');
  for (const id of ['drone', 'runner', 'tank', 'shielder', 'swarmlet', 'wisp', 'kamikaze', 'specter_grunt', 'specter_archer', 'specter_guard', 'specter_lite', 'specter_core']) {
    const ty = NV.ENEMY_TYPES.find((x) => x.id === id);
    if ((ty.stunChance || 0) > 0) throw new Error(id + ' no debería stunear');
  }
  if (NV.BALANCE.PLAYER_STUN_REAPPLY_LOCKOUT !== 1.5) throw new Error('lockout');
  if (NV.BALANCE.PLAYER_STUN_DEFAULT_DURATION !== 0.5) throw new Error('duración default');
});

t('mapa: jefes usan stunChance de datos por-jefe (JEFE cero, resto 0.05..0.25)', () => {
  const { NV } = sandbox();
  if ((NV.BOSS_TYPES[0].stunChance || 0) !== 0) throw new Error('JEFE debería ser cero');
  for (const bt of NV.BOSS_TYPES.slice(1)) {
    const sc = bt.stunChance || 0;
    if (sc < 0.05 || sc > 0.25) throw new Error(bt.name + ' fuera de rango: ' + sc);
  }
});

t('spitter: spawn copia stunChance/stunDuration y el proyectil los lleva', () => {
  const { NV } = sandbox();
  const spawned = [];
  NV.spawnEnemy({ enemies: spawned, boss: null, wave: 12, ENEMY_TYPES: NV.ENEMY_TYPES, W: 900, H: 520, MAX_ENEMIES: 30, MAX_HOSTILES: 30, MAX_HEAVY_HOSTILES: 7, waveEvent: null, forceTypeId: 'spitter' });
  const e = spawned[0];
  if (!e || e.stunChance !== 0.5 || e.stunDuration !== 0.45) throw new Error('spawn: ' + (e && e.stunChance));
  const b = fireRanged(NV, e, { x: 650, y: 300, moveVx: 0, moveVy: 0, invuln: 0, stun: 0 });
  if (!b) throw new Error('sin bala');
  if (b.stunChance !== 0.5 || b.stunDuration !== 0.45) throw new Error('propagación: ' + b.stunChance + '/' + b.stunDuration);
});

t('spitter: impacto exitoso aplica 0.45s + lockout 1.5 y el daño aplica', () => {
  const { NV } = sandbox();
  const player = mkPlayer();
  const b = bulletFixture({ stunChance: 0.5, stunDuration: 0.45, damage: 15, sourceType: 'spitter' });
  bulletHit(NV, player, b);
  if (player.stun !== 0.45) throw new Error('stun=' + player.stun);
  if (player.stunReapplyLockout !== 1.5) throw new Error('lockout=' + player.stunReapplyLockout);
  if (player.hp !== 105) throw new Error('hp=' + player.hp);
  if (player.invuln !== 0) throw new Error('stun concedió invuln');
  if (!b.dead) throw new Error('bala no consumida');
});

t('spitter: roll fallido no aturde pero el daño igual aplica', () => {
  const { NV } = sandbox(0.99);
  const player = mkPlayer();
  const b = bulletFixture({ stunChance: 0.5, stunDuration: 0.45, damage: 15, sourceType: 'spitter' });
  bulletHit(NV, player, b);
  if (player.stun !== 0 || player.stunReapplyLockout !== 0) throw new Error('aturdió con roll fallido');
  if (player.hp !== 105) throw new Error('hp=' + player.hp);
  if (!b.dead) throw new Error('bala no consumida');
});

t('GOLIATH: contacto no es determinista — roll exitoso (rand=0 < 0.35) aturde 0.55s + lockout 1.5', () => {
  const { NV, math } = sandbox(0); // rand() = 0 < 0.35 => stun aplica
  let rolls = 0;
  math.random = () => { rolls++; return 0; };
  const player = mkPlayer({ x: 400, y: 300, hp: 120 });
  const e = { x: 410, y: 300, hp: 50, maxHp: 50, damage: 0, eliteDamage: 20, speed: 0, radius: 12, color: '#ff1493', shape: 'rock', behavior: 'chase', dead: false, isElite: true, knockVelX: 0, knockVelY: 0, knockbackRes: 0.9, contactCd: 0, stunChance: 0.35, stunDuration: 0.55, hostileClass: 'heavy', visualId: 'elite_titan', angle: 0, erraticTimer: 0 };
  NV.updateEnemies(0.016, { enemies: [e], player, bullets: [], MAX_BULLETS: 10, MAX_ENEMY_BULLETS: 10, enemyBulletCount: () => 0, applyPlayerDamage: applyNoCrit(NV, player), addFloatText() {}, spawnExplosion() {}, MAX_HOSTILES: 30, MAX_HEAVY_HOSTILES: 7, boss: null, wave: 20, waveEvent: null, hookSystem: null, onKill() {} });
  if (rolls !== 1) throw new Error('rolls de contacto=' + rolls + ' (esperaba exactamente 1)');
  if (player.stun !== 0.55 || player.stunReapplyLockout !== 1.5) throw new Error('stun=' + player.stun + '/' + player.stunReapplyLockout);
  if (player.hp !== 100) throw new Error('hp=' + player.hp);
  if (!e.dead) throw new Error('el contacto no mató al atacante');
});

t('GOLIATH: contacto NO aturde cuando roll falla (rand=0.99 >= 0.35) pero el daño aplica igual', () => {
  const { NV, math } = sandbox(0.99); // rand() = 0.99 >= 0.35 => stun NO aplica
  let rolls = 0;
  math.random = () => { rolls++; return 0.99; };
  const player = mkPlayer({ x: 400, y: 300, hp: 120 });
  const e = { x: 410, y: 300, hp: 50, maxHp: 50, damage: 0, eliteDamage: 20, speed: 0, radius: 12, color: '#ff1493', shape: 'rock', behavior: 'chase', dead: false, isElite: true, knockVelX: 0, knockVelY: 0, knockbackRes: 0.9, contactCd: 0, stunChance: 0.35, stunDuration: 0.55, hostileClass: 'heavy', visualId: 'elite_titan', angle: 0, erraticTimer: 0 };
  NV.updateEnemies(0.016, { enemies: [e], player, bullets: [], MAX_BULLETS: 10, MAX_ENEMY_BULLETS: 10, enemyBulletCount: () => 0, applyPlayerDamage: applyNoCrit(NV, player), addFloatText() {}, spawnExplosion() {}, MAX_HOSTILES: 30, MAX_HEAVY_HOSTILES: 7, boss: null, wave: 20, waveEvent: null, hookSystem: null, onKill() {} });
  if (rolls !== 1) throw new Error('rolls de contacto=' + rolls + ' (esperaba exactamente 1)');
  if (player.stun !== 0 || player.stunReapplyLockout !== 0) throw new Error('aturdió con roll fallido: stun=' + player.stun);
  if (player.hp !== 100) throw new Error('daño no aplicado con roll fallido: hp=' + player.hp);
  if (!e.dead) throw new Error('el contacto no mató al atacante');
});

t('specter_elite_void: proyectil ranged lleva stun y aplica 0.5s', () => {
  const { NV } = sandbox();
  const spawned = [];
  NV.spawnElite({ enemies: spawned, boss: null, wave: 17, W: 900, H: 520, ELITE_TYPES: NV.ELITE_TYPES.filter((x) => x.id === 'specter_elite_void'), MAX_ENEMIES: 30, MAX_HOSTILES: 30, MAX_HEAVY_HOSTILES: 7, waveEvent: null });
  const e = spawned[0];
  if (!e || e.stunChance !== 0.35 || e.stunDuration !== 0.5) throw new Error('spawn');
  const b = fireRanged(NV, e, { x: 650, y: 300, moveVx: 0, moveVy: 0, invuln: 0, stun: 0 });
  if (!b || b.stunChance !== 0.35 || b.stunDuration !== 0.5) throw new Error('propagación');
  const player = mkPlayer();
  bulletHit(NV, player, bulletFixture({ stunChance: 0.35, stunDuration: 0.5, damage: 20, color: '#9b4dff', sourceType: 'specter_elite_void' }));
  if (player.stun !== 0.5 || player.hp !== 100) throw new Error('impacto: stun=' + player.stun + ' hp=' + player.hp);
});

t('bosses: cada familia usa su chance/duración efectiva única', () => {
  const { NV } = sandbox();
  const DATA = 0.15;
  const cases = [
    ['repeater', DATA, 0.5, 0.23], ['spread', DATA, 0.5, 1.26], ['volley', DATA, 0.5, 0.96],
    ['orbs', DATA, 0.5, 1.11], ['split', DATA, 0.5, 1.16], ['rage', DATA, 0.5, 1.76],
    ['heavy', 0.30, 0.55, 1.36], ['bomb', 0.35, 0.60, 1.61], ['beam', 0.40, 0.65, 3.61],
  ];
  for (const [fam, chance, dur, atkTimer] of cases) {
    const b = bossFixture(fam, DATA);
    const st = bossSt(NV, b);
    b.atkTimer = atkTimer;
    NV.runBossAttack(b, 0.001, st);
    if (!st.bullets.length) throw new Error(fam + ' sin proyectiles');
    for (const bl of st.bullets) {
      if (bl.stunChance !== chance) throw new Error(fam + ' chance=' + bl.stunChance);
      if (bl.stunDuration !== dur) throw new Error(fam + ' dur=' + bl.stunDuration);
    }
  }
  const b = bossFixture('mystery', DATA);
  const st = bossSt(NV, b);
  b.atkTimer = 1.11;
  NV.runBossAttack(b, 0.001, st);
  if (!st.bullets.length || st.bullets[0].stunChance !== DATA || st.bullets[0].stunDuration !== 0.5) throw new Error('familia default');
});

t('sin roll duplicado: spawn no tira y las rutas de impacto no tiran inline', () => {
  const { NV, math } = sandbox();
  let calls = 0;
  math.random = () => { calls++; return 0; };
  const b = bossFixture('spread', 0.15);
  const st = bossSt(NV, b);
  b.atkTimer = 1.26;
  NV.runBossAttack(b, 0.001, st);
  if (!st.bullets.length) throw new Error('spread sin proyectiles');
  if (calls !== 0) throw new Error('spawn consumió ' + calls + ' randoms');
  calls = 0;
  NV.tryApplyPlayerStun(mkPlayer(), 0.45, 0.5, null, { random: math.random });
  if (calls !== 1) throw new Error('helper roll=' + calls);
  const bullets = fs.readFileSync('js/engine/bullets.js', 'utf8');
  const enemies = fs.readFileSync('js/engine/enemies.js', 'utf8');
  if (/Math\.random\(\)\s*<\s*b\.stunChance/.test(bullets)) throw new Error('roll duplicado en bullets');
  if (/Math\.random\(\)\s*<\s*e\.stunChance/.test(enemies)) throw new Error('roll duplicado en enemies');
});

t('cero-stun: contacto de drone no aturde y el daño aplica', () => {
  const { NV } = sandbox();
  const player = mkPlayer({ x: 400, y: 300 });
  const e = { x: 410, y: 300, hp: 50, maxHp: 50, damage: 10, speed: 0, radius: 12, color: '#f07bad', shape: 'circle', behavior: 'chase', dead: false, isElite: false, knockVelX: 0, knockVelY: 0, knockbackRes: 0, contactCd: 0, hostileClass: 'light', enemyTypeId: 'drone', angle: 0, erraticTimer: 0 };
  NV.updateEnemies(0.016, { enemies: [e], player, bullets: [], MAX_BULLETS: 10, MAX_ENEMY_BULLETS: 10, enemyBulletCount: () => 0, applyPlayerDamage: applyNoCrit(NV, player), addFloatText() {}, spawnExplosion() {}, MAX_HOSTILES: 30, MAX_HEAVY_HOSTILES: 7, boss: null, wave: 3, waveEvent: null, hookSystem: null, onKill() {} });
  if (player.stun !== 0 || player.stunReapplyLockout !== 0) throw new Error('aturdió sin stunChance');
  if (player.hp !== 110) throw new Error('hp=' + player.hp);
});

t('helper: validación y sin stack aditivo', () => {
  const { NV } = sandbox();
  const p = mkPlayer();
  if (NV.tryApplyPlayerStun(null, 0.5, 0.5).reason !== 'no-player') throw new Error('null');
  if (NV.tryApplyPlayerStun(p, 0, 0.5).reason !== 'invalid-duration') throw new Error('dur0');
  if (NV.tryApplyPlayerStun(p, NaN, 0.5).reason !== 'invalid-duration') throw new Error('durNaN');
  if (NV.tryApplyPlayerStun(p, 0.5, 0).reason !== 'no-stun-source') throw new Error('chance0');
  if (NV.tryApplyPlayerStun(p, 0.5, 0.5).applied !== true || p.stun !== 0.5) throw new Error('aplicar');
  p.stunReapplyLockout = 0;
  p.stun = 0.3;
  if (!NV.tryApplyPlayerStun(p, 0.2, 1).applied || p.stun !== 0.3) throw new Error('stack corto: ' + p.stun);
  p.stunReapplyLockout = 0;
  if (!NV.tryApplyPlayerStun(p, 0.65, 1).applied || p.stun !== 0.65) throw new Error('stack largo: ' + p.stun);
});

t('stun bloquea movimiento normal y no muta base', () => {
  const { NV } = sandbox();
  const stunned = mkPlayer({ x: 100, y: 100 });
  NV.configurePlayerMovement(stunned, 200, 0);
  stunned.stun = 0.45;
  NV.updatePlayerMovement(stunned, 1, 0, 0.016);
  if (stunned.x !== 100) throw new Error('se movió aturdido: ' + stunned.x);
  const libre = mkPlayer({ x: 100, y: 100 });
  NV.configurePlayerMovement(libre, 200, 0);
  NV.updatePlayerMovement(libre, 1, 0, 0.016);
  if (!(libre.x > 100)) throw new Error('sin stun no se movió: ' + libre.x);
});

t('stun bloquea INICIAR dash nuevo; sin stun el dash inicia', () => {
  const { NV } = sandbox();
  const stunned = mkPlayer();
  NV.configurePlayerMovement(stunned, 200, 0);
  NV.configurePlayerDash(stunned);
  stunned.stun = 0.45;
  NV.updatePlayerDash(stunned, true, 0, 0, 1, 0, false, 0.016);
  if (stunned.dashActive || stunned.dashStamina !== stunned.dashStaminaMax) throw new Error('dash con stun');
  const libre = mkPlayer();
  NV.configurePlayerMovement(libre, 200, 0);
  NV.configurePlayerDash(libre);
  NV.updatePlayerDash(libre, true, 0, 0, 1, 0, false, 0.016);
  if (!libre.dashActive) throw new Error('dash legítimo bloqueado');
});

t('stun NO bloquea daño de proyectil ni de contacto (sin invulnerabilidad)', () => {
  const { NV } = sandbox();
  const player = mkPlayer({ stun: 0.45, stunReapplyLockout: 1.5 });
  const b = bulletFixture({ stunChance: 0.5, stunDuration: 0.45, damage: 15, sourceType: 'spitter' });
  bulletHit(NV, player, b);
  if (player.hp !== 105) throw new Error('proyectil no dañó: hp=' + player.hp);
  if (!b.dead) throw new Error('bala no consumida');
  if (player.stun !== 0.45 || player.stunReapplyLockout !== 1.5) throw new Error('lockout mutó timers: ' + player.stun + '/' + player.stunReapplyLockout);
  const e = { x: 110, y: 100, hp: 50, maxHp: 50, damage: 12, speed: 0, radius: 12, color: '#6dc4c0', shape: 'rock', behavior: 'chase', dead: false, isElite: false, knockVelX: 0, knockVelY: 0, knockbackRes: 0, contactCd: 0, stunChance: 0.5, stunDuration: 0.45, hostileClass: 'light', enemyTypeId: 'spitter', angle: 0, erraticTimer: 0 };
  NV.updateEnemies(0.016, { enemies: [e], player, bullets: [], MAX_BULLETS: 10, MAX_ENEMY_BULLETS: 10, enemyBulletCount: () => 0, applyPlayerDamage: applyNoCrit(NV, player), addFloatText() {}, spawnExplosion() {}, MAX_HOSTILES: 30, MAX_HEAVY_HOSTILES: 7, boss: null, wave: 13, waveEvent: null, hookSystem: null, onKill() {} });
  if (player.hp !== 93) throw new Error('contacto no dañó: hp=' + player.hp);
  if (!e.dead) throw new Error('atacante vivo');
});

t('reapply lockout: reintento exitoso no extiende ni resetea timers', () => {
  const { NV } = sandbox();
  const p = mkPlayer({ stun: 0.45, stunReapplyLockout: 1.4 });
  const r = NV.tryApplyPlayerStun(p, 0.65, 1, null, { random: () => 0 });
  if (!r.blocked || r.reason !== 'reapply-lockout') throw new Error(JSON.stringify(r));
  if (p.stun !== 0.45 || p.stunReapplyLockout !== 1.4) throw new Error('timers alterados');
  if (r.applied) throw new Error('aplicó durante lockout');
});

t('anti-stunlock: fuentes simultáneas no pueden encadenar (cadencia acotada)', () => {
  const { NV } = sandbox();
  const p = mkPlayer();
  let applied = 0;
  for (let i = 0; i < 200; i++) {
    const r = NV.tryApplyPlayerStun(p, 0.65, 1, null, { random: () => 0 });
    if (r.applied) applied++;
    if (p.stun > 0.65) throw new Error('stun sobre duración: ' + p.stun);
    if (p.stun > 0) p.stun = Math.max(0, p.stun - 0.05);
    if (p.stunReapplyLockout > 0) p.stunReapplyLockout = Math.max(0, p.stunReapplyLockout - 0.05);
  }
  if (applied !== 7) throw new Error('stuns en 10s=' + applied + ' (esperaba 7)');
  if (!Number.isFinite(p.stun) || !Number.isFinite(p.stunReapplyLockout)) throw new Error('timers no finitos');
});

t('lifecycle: pausa congela, restart/muerte/wave_end/shop limpian timers', () => {
  const game = fs.readFileSync('js/game.js', 'utf8');
  const updateIdx = game.indexOf('function update(dt) {');
  const pauseIdx = game.indexOf('if (paused) return;', updateIdx);
  const tickIdx = game.indexOf('player.stunReapplyLockout = Math.max(0, player.stunReapplyLockout - dt)');
  if (pauseIdx < 0 || tickIdx < 0 || tickIdx < pauseIdx) throw new Error('pausa no congela stun');
  const startBlock = game.slice(game.indexOf('function startGame() {'), game.indexOf('function nextWave()'));
  if (!startBlock.includes('player.stunReapplyLockout = 0')) throw new Error('restart sin limpieza');
  const goBlock = game.slice(game.indexOf('function gameOver() {'), game.indexOf('function finishPlayerDeath()'));
  if (!goBlock.includes('player.stun = 0; player.stunReapplyLockout = 0;')) throw new Error('muerte sin limpieza');
  const waveBlock = game.slice(game.indexOf('function triggerWaveVictory'), game.indexOf('function triggerFlash(color)'));
  if (!waveBlock.includes('player.stun = 0; player.stunReapplyLockout = 0;')) throw new Error('wave_end sin limpieza');
  const shopBlock = game.slice(game.indexOf('function beginShopEntrance() {'), game.indexOf('function updatePresentation(dt) {'));
  if (!shopBlock.includes('player.stun = 0; player.stunReapplyLockout = 0;')) throw new Error('shop sin limpieza');
  if (!game.includes('stunChance: bt.stunChance || 0')) throw new Error('boss no copia stunChance de datos');
  if (!/\(b, speed, damage, count, spread, color, radius, _stArg, stun, stunDuration\)/.test(game)) throw new Error('wrapper de boss no forwarda stun');
});

t('HP finita en todos los escenarios y Hook/Pull intacto', () => {
  const { NV } = sandbox();
  const player = mkPlayer();
  const b = bulletFixture({ stunChance: 0.5, stunDuration: 0.45, damage: 15, sourceType: 'spitter' });
  bulletHit(NV, player, b);
  if (!Number.isFinite(player.hp) || !Number.isFinite(player.maxHp) || player.maxHp <= 0) throw new Error('hp no finita');
  const enemies = fs.readFileSync('js/engine/enemies.js', 'utf8');
  if (!enemies.includes("e.enemyTypeId === 'specter_archer'")) throw new Error('fuente Hook alterada');
  if (!enemies.includes('NV.BALANCE.HOOK_UNLOCK_WAVE')) throw new Error('gate Hook alterado');
  if (!enemies.includes('hookOwner') || !enemies.includes('hookWindup')) throw new Error('flags Hook alterados');
});

t('boss funcional end-to-end: updateBoss dispara repeater con stun de datos', () => {
  const { NV } = sandbox();
  const boss = bossFixture('repeater', 0.15);
  const st = bossSt(NV, boss);
  boss.atkTimer = 0.23;
  const res = NV.updateBoss(0.001, st);
  if (!st.bullets.length) throw new Error('sin proyectiles de boss');
  if (st.bullets[0].stunChance !== 0.15 || st.bullets[0].stunDuration !== 0.5) throw new Error('stun boss: ' + st.bullets[0].stunChance + '/' + st.bullets[0].stunDuration);
  if (!res.boss || res.boss.dead) throw new Error('boss murió indebidamente');
});

console.log('\nRESULT player_stun_system: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);




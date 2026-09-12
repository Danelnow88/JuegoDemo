// P0: autoridad única de aplicación de daño al jugador y regresiones de explosiones.
const fs = require('fs'), vm = require('vm');
let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; console.log('  ok  ' + name); } catch (e) { fail++; console.log('  FAIL ' + name + ' -> ' + e.message); } }
function load(file, sbx) { vm.runInNewContext(fs.readFileSync(file, 'utf8'), sbx, { filename: file }); }
function sandbox() {
  const math = Object.create(Math);
  const sbx = { window: { NV: {} }, console, Math: math, Object, Array, Set, Map };
  for (const f of ['js/data/balance.js', 'js/data/gameData.js', 'js/engine/rhythm.js', 'js/engine/combat.js', 'js/engine/hazards.js', 'js/engine/enemies.js', 'js/engine/fx.js', 'js/engine/special.js', 'js/engine/bullets.js']) load(f, sbx);
  return sbx;
}
function damageState(NV, player, over) {
  return Object.assign({
    player, CHARACTERS: NV.CHARACTERS,
    calcEnemyDamage: (base) => ({ dmg: base, crit: false }),
    addFloatText() {}, sfx: { playerHit() {} }, onPlayerDamaged() {},
  }, over || {});
}
function killState(NV, enemy, player, over) {
  const base = {
    e: enemy, score: 0, player, weaponLevels: {}, weaponKills: {}, currentWeapon: { id: 'pistol' },
    WEAPON_KILLS_PER_LEVEL: 999, weaponKillProgress: () => 1,
    addFloatText() {}, spawnExplosion() {}, triggerFlash() {}, pickups: [], waveEvent: null, W: 900,
    sfx: { levelup() {}, explosion() {}, enemyDeath() {} },
  };
  return Object.assign(base, over || {});
}

t('pipeline aplica armor y devuelve resultado explícito', () => {
  const { window: { NV } } = sandbox();
  const player = { character: 'boti', hp: 100, armor: 4, permDodge: 0, invuln: 0, x: 0, y: 0 };
  const r = NV.applyPlayerDamage(20, damageState(NV, player));
  if (!r.applied || r.damage !== 16 || player.hp !== 84 || r.hpBefore !== 100 || r.hpAfter !== 84 || r.killed) throw new Error(JSON.stringify(r));
});

t('pipeline conserva modificadores recibidos de ROOK y NOVA', () => {
  const { window: { NV } } = sandbox();
  const rook = { character: 'rook', hp: 100, armor: 0, permDodge: 0, invuln: 0, x: 0, y: 0 };
  const nova = { character: 'nova', hp: 100, armor: 0, permDodge: 0, invuln: 0, x: 0, y: 0 };
  if (NV.applyPlayerDamage(20, damageState(NV, rook)).damage !== 17) throw new Error('ROOK');
  if (NV.applyPlayerDamage(20, damageState(NV, nova)).damage !== 24) throw new Error('NOVA');
});

t('projectile conserva crítico y dodge por default', () => {
  const sbx = sandbox(), NV = sbx.window.NV;
  let player = { character: 'boti', hp: 100, armor: 0, permDodge: 0, invuln: 0, x: 0, y: 0 };
  let r = NV.applyPlayerDamage(10, damageState(NV, player, { calcEnemyDamage: () => ({ dmg: 16, crit: true }), cause: 'projectile' }));
  if (!r.applied || !r.crit || r.damage !== 16) throw new Error('crit=' + JSON.stringify(r));
  player = { character: 'swarm', hp: 100, armor: 0, permDodge: 0, invuln: 0, x: 0, y: 0 };
  sbx.Math.random = () => 0;
  r = NV.applyPlayerDamage(10, damageState(NV, player, { cause: 'projectile' }));
  if (!r.dodged || r.applied || player.hp !== 100) throw new Error('dodge=' + JSON.stringify(r));
});

t('invulnerabilidad bloquea shield, phase y bulwark', () => {
  const { window: { NV } } = sandbox();
  for (const kind of ['shield', 'phase', 'bulwark']) {
    const player = { character: kind === 'phase' ? 'nova' : kind === 'bulwark' ? 'rook' : 'boti', hp: 100, armor: 0, permDodge: 0, invuln: 2, x: 0, y: 0 };
    player[kind] = 2;
    const r = NV.applyPlayerDamage(50, damageState(NV, player, { allowCrit: false, allowDodge: false, cause: 'hazard' }));
    if (r.applied || r.reason !== 'invulnerable' || player.hp !== 100) throw new Error(kind + '=' + JSON.stringify(r));
  }
});

t('hazard deshabilita crítico y dodge pero respeta armor/pasiva', () => {
  const sbx = sandbox(), NV = sbx.window.NV;
  sbx.Math.random = () => 0;
  const player = { character: 'rook', hp: 100, armor: 4, permDodge: 10, invuln: 0, x: 0, y: 0 };
  let critCalls = 0;
  const r = NV.applyPlayerDamage(20, damageState(NV, player, {
    allowCrit: false, allowDodge: false, cause: 'mine-explosion',
    calcEnemyDamage() { critCalls++; return { dmg: 999, crit: true }; },
  }));
  if (!r.applied || r.dodged || r.crit || critCalls !== 0 || r.damage !== 14 || player.hp !== 86) throw new Error(JSON.stringify({ r, critCalls }));
});

t('speaker mine aplica daño una sola vez, sin crit/dodge', () => {
  const sbx = sandbox(), NV = sbx.window.NV;
  const player = { character: 'boti', hp: 100, maxHp: 100, armor: 0, luck: 0, permDodge: 10, invuln: 0, x: 400, y: 400, xp: 0, xpToNext: 999, level: 1 };
  const mine = { type: 'speakerMine', state: 'armed', stateTime: 0, x: 410, y: 400 };
  const apply = (base, opts) => NV.applyPlayerDamage(base, damageState(NV, player, Object.assign({}, opts, { calcEnemyDamage() { throw new Error('crit no permitido'); } })));
  const ctx = { wave: 4, W: 900, applyPlayerDamage: apply, spawnExplosion() {}, spawnShockwave() {}, triggerFlash() {}, sfx: {} };
  NV.detonateSpeakerMine(mine, ctx); NV.detonateSpeakerMine(mine, ctx);
  if (player.hp !== 60 || mine.state !== 'detonating') throw new Error('hp=' + player.hp + ' state=' + mine.state);
});

t('kamikaze aplica 24 una sola vez y respeta invulnerabilidad', () => {
  const { window: { NV } } = sandbox();
  const player = { character: 'nova', hp: 100, maxHp: 100, armor: 0, luck: 0, permDodge: 10, invuln: 0, x: 400, y: 400, xp: 0, xpToNext: 999, level: 1 };
  const enemy = { x: 410, y: 400, hp: 0, maxHp: 10, score: 1, xp: 1, color: '#fff', behavior: 'kami' };
  const apply = (base, opts) => NV.applyPlayerDamage(base, damageState(NV, player, Object.assign({}, opts, { calcEnemyDamage() { throw new Error('crit no permitido'); } })));
  NV.killEnemy(killState(NV, enemy, player, { applyPlayerDamage: apply }));
  if (player.hp !== 71 || !enemy.kamikazeDamageApplied) throw new Error('hp=' + player.hp); // 24 * NOVA 1.2 = 29
  const protectedPlayer = Object.assign({}, player, { hp: 100, invuln: 1 });
  const protectedEnemy = { x: 410, y: 400, hp: 0, maxHp: 10, score: 1, xp: 1, color: '#fff', behavior: 'kami' };
  const protectedApply = (base, opts) => NV.applyPlayerDamage(base, damageState(NV, protectedPlayer, opts));
  NV.killEnemy(killState(NV, protectedEnemy, protectedPlayer, { applyPlayerDamage: protectedApply }));
  if (protectedPlayer.hp !== 100) throw new Error('atravesó invulnerabilidad');
});

t('pipeline reporta muerte del jugador', () => {
  const { window: { NV } } = sandbox();
  const player = { character: 'boti', hp: 5, armor: 0, permDodge: 0, invuln: 0, x: 0, y: 0 };
  const r = NV.applyPlayerDamage(10, damageState(NV, player, { allowCrit: false, allowDodge: false, cause: 'hazard' }));
  if (!r.killed || player.hp !== -5 || r.hpAfter !== -5) throw new Error(JSON.stringify(r));
});

t('updateBullets usa pipeline y conserva comportamiento de proyectil', () => {
  const { window: { NV } } = sandbox();
  const player = { x: 100, y: 100, character: 'boti', hp: 20, armor: 0, permDodge: 0, bulwark: 0, invuln: 0, stun: 0 };
  const bullets = [{ x: 100, y: 100, vx: 0, vy: 0, damage: 8, color: '#f00', radius: 5, isEnemy: true, dead: false }];
  const apply = (base, opts) => NV.applyPlayerDamage(base, damageState(NV, player, opts));
  const r = NV.updateBullets(0, { bullets, W: 900, H: 520, player, enemies: [], boss: null, CHARACTERS: NV.CHARACTERS, SHIELD_COOLDOWN: 1, applyPlayerDamage: apply, addFloatText() {}, killEnemy() {}, applyKnockback() {}, spawnExplosion() {} });
  if (player.hp !== 12 || r.bullets.length !== 0 || r.gameOver) throw new Error(JSON.stringify({ hp: player.hp, r }));
});

console.log('RESULT player_damage_pipeline: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
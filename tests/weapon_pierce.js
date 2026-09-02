// Tests de penetración de armas: default 1 impacto + rebalance de armas lentas/de línea.
const fs = require('fs'), vm = require('vm');
let pass = 0, fail = 0;
function t(desc, fn) { try { fn(); pass++; console.log('  ok  ' + desc); } catch (e) { fail++; console.log('  FAIL ' + desc + ' -> ' + e.message); } }

function load() {
  const sbx = { window: { NV: {} }, console, Math };
  for (const f of ['js/data/balance.js', 'js/data/gameData.js', 'js/engine/weapons.js', 'js/engine/boss.js', 'js/engine/bullets.js']) {
    vm.runInNewContext(fs.readFileSync(f, 'utf8'), sbx, { filename: f });
  }
  return sbx.window.NV;
}

function shootWith(NV, weaponId, bullets) {
  const player = { x: 0, y: 20, luck: 0, permCrit: 0 };
  const weapon = NV.weaponById(weaponId);
  NV.shoot({
    player, enemies: [{ x: 100, y: 0, dead: false }], boss: null, bullets, currentWeapon: weapon,
    currentWeaponLevel: () => 1, weaponVisualTier: () => 0, BULLET_TIER_COLORS: ['#fff'], MAX_BULLETS: 100,
    permDamageBonus: 0, playWeaponSound: () => {}, currentWeaponFusion: 0, fusionStep: 0.2, wave: 1,
  });
}

function updateOnce(NV, bullets, enemies, boss) {
  const st = {
    bullets, W: 900, H: 520,
    player: { x: -1000, y: -1000, character: 'boti', bulwark: 0, invuln: 0, stun: 0 },
    enemies, boss, CHARACTERS: NV.CHARACTERS, SHIELD_COOLDOWN: 0.9,
    computePlayerHit: () => ({ dodged: false, dmg: 1, crit: false }),
    addFloatText() {}, killEnemy(e) { e.dead = true; }, applyKnockback() {}, spawnExplosion() {},
  };
  return NV.updateBullets(0, st);
}

t('shoot asigna impacto directo o perfil de rol sin tocar daño/cadencia', () => {
  const NV = load();
  const expected = { pistol: 1, smg: 1, shotgun: 1, plasma: 1, rifle: 2, railgun: Infinity };
  for (const id of Object.keys(expected)) {
    const bullets = [];
    shootWith(NV, id, bullets);
    if (!bullets.length) throw new Error(id + ' no disparó');
    for (const b of bullets) {
      if (b.pierce !== expected[id]) throw new Error(id + ' pierce=' + b.pierce);
    }
  }
});

t('datos rebalanceados: pierce/cadencia por rol sin tocar daño base', () => {
  const NV = load();
  const expected = {
    sniper: { damage: 50, fireRate: 70, pierce: 4 },
    laser: { damage: 25, fireRate: 20, pierce: 2 },
    bow: { damage: 22, fireRate: 36 },
    flamethrower: { damage: 6, fireRate: 14, pierce: 2 },
    railgun: { damage: 70, fireRate: 84, pierce: 8 },
    rifle: { damage: 20, fireRate: 25, pierce: 2 },
  };
  for (const id of Object.keys(expected)) {
    const w = NV.weaponById(id), exp = expected[id];
    for (const k of Object.keys(exp)) {
      if (w[k] !== exp[k]) throw new Error(id + '.' + k + '=' + w[k]);
    }
  }
  for (const id of ['pistol', 'smg', 'shotgun', 'plasma']) {
    if (Object.prototype.hasOwnProperty.call(NV.weaponById(id), 'pierce')) throw new Error(id + ' no debe tener pierce explícito');
  }
});

t('default pierce 1: armas rápidas/sin pierce no atraviesan múltiples enemigos', () => {
  const NV = load();
  for (const id of ['pistol', 'smg', 'shotgun', 'plasma']) {
    const bullets = [{ x: 100, y: 100, vx: 0, vy: 0, damage: 10, dead: false, isEnemy: false, pierce: 1, wid: id }];
    const enemies = [
      { x: 100, y: 100, radius: 10, hp: 100, dead: false },
      { x: 100, y: 100, radius: 10, hp: 100, dead: false },
    ];
    updateOnce(NV, bullets, enemies, null);
    if (enemies[0].hp !== 90) throw new Error(id + ' no pegó al primero');
    if (enemies[1].hp !== 100) throw new Error(id + ' atravesó sin pierce explícito');
  }
});

t('rifle penetra exactamente hasta 2 enemigos', () => {
  const NV = load();
  const bullets = [{ x: 100, y: 100, vx: 0, vy: 0, damage: 10, dead: false, isEnemy: false, pierce: 2, wid: 'rifle' }];
  const enemies = Array.from({ length: 3 }, () => ({ x: 100, y: 100, radius: 10, hp: 100, dead: false }));
  updateOnce(NV, bullets, enemies, null);
  const damaged = enemies.filter((e) => e.hp === 90).length;
  if (damaged !== 2) throw new Error('damaged=' + damaged);
  if (enemies[2].hp !== 100) throw new Error('excedió límite rifle');
});

t('arco rebota hasta 3 enemigos cercanos además del impacto inicial', () => {
  const NV = load();
  const bullets = [{ x: 100, y: 100, vx: 0, vy: 0, damage: 10, dead: false, isEnemy: false, pierce: 1, impactType: 'bounce', bounceLeft: 3, splashRadius: 180, hitTargets: [], wid: 'bow' }];
  const enemies = [
    { x: 100, y: 100, radius: 10, hp: 100, dead: false },
    { x: 130, y: 100, radius: 10, hp: 100, dead: false },
    { x: 160, y: 100, radius: 10, hp: 100, dead: false },
    { x: 190, y: 100, radius: 10, hp: 100, dead: false },
    { x: 400, y: 100, radius: 10, hp: 100, dead: false },
  ];
  for (let i = 0; i < 4 && bullets.length; i++) {
    const res = updateOnce(NV, bullets, enemies, null);
    bullets.splice(0, bullets.length, ...res.bullets);
  }
  const damaged = enemies.filter((e) => e.hp === 90).length;
  if (damaged !== 4) throw new Error('damaged=' + damaged);
  if (enemies[4].hp !== 100) throw new Error('rebotó fuera de radio');
});

t('plasma explota en área al primer impacto', () => {
  const NV = load();
  const bullets = [{ x: 100, y: 100, vx: 0, vy: 0, damage: 10, dead: false, isEnemy: false, pierce: 1, impactType: 'splash', splashRadius: 58, hitTargets: [], wid: 'plasma', color: '#a855f7' }];
  const enemies = [
    { x: 100, y: 100, radius: 10, hp: 100, dead: false },
    { x: 145, y: 100, radius: 10, hp: 100, dead: false },
    { x: 300, y: 100, radius: 10, hp: 100, dead: false },
  ];
  updateOnce(NV, bullets, enemies, null);
  if (enemies[0].hp !== 90) throw new Error('sin impacto inicial');
  if (enemies[1].hp !== 90) throw new Error('sin splash cercano');
  if (enemies[2].hp !== 100) throw new Error('splash excedió radio');
});

t('pierce explícito impacta hasta su límite y luego muere', () => {
  const NV = load();
  const bullets = [{ x: 100, y: 100, vx: 0, vy: 0, damage: 10, dead: false, isEnemy: false, pierce: 4, wid: 'sniper' }];
  const enemies = Array.from({ length: 5 }, () => ({ x: 100, y: 100, radius: 10, hp: 100, dead: false }));
  updateOnce(NV, bullets, enemies, null);
  const damaged = enemies.filter((e) => e.hp === 90).length;
  if (damaged !== 4) throw new Error('damaged=' + damaged);
  if (enemies[4].hp !== 100) throw new Error('excedió límite');
});

t('boss consume la bala y recibe el mismo daño aunque el arma tenga pierce alto', () => {
  const NV = load();
  const boss = { x: 100, y: 100, radius: 40, hp: 500, maxHp: 500, dead: false, hitFlash: 0 };
  const bullets = [{ x: 100, y: 100, vx: 0, vy: 0, damage: 70, dead: false, isEnemy: false, pierce: 8, wid: 'railgun' }];
  const res = updateOnce(NV, bullets, [], boss);
  if (boss.hp !== 430) throw new Error('boss hp=' + boss.hp);
  if (res.bullets.length !== 0) throw new Error('bala no murió contra boss');
});

console.log('RESULT weapon_pierce: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
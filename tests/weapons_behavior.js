// Tests focalizados: comportamiento + balance de flamethrower, shotgun, plasma, bow, magnet.
const fs = require('fs'), vm = require('vm');
let pass = 0, fail = 0;
function t(desc, fn) { try { fn(); pass++; console.log('  ok  ' + desc); } catch (e) { fail++; console.log('  FAIL ' + desc + ' -> ' + e.message); } }

function loadAll() {
  const sbx = { window: { NV: {} }, console, Math, performance: { now: () => Date.now() } };
  for (const f of [
    'js/data/balance.js', 'js/data/gameData.js', 'js/data/consumables.js',
    'js/engine/weapons.js', 'js/engine/boss.js', 'js/engine/bullets.js',
    'js/engine/flame.js', 'js/engine/pickups.js', 'js/engine/consumables.js',
  ]) { vm.runInNewContext(fs.readFileSync(f, 'utf8'), sbx, { filename: f }); }
  return sbx.window.NV;
}

const NV = loadAll();

function mkEnemies(count, x0, y, gap) {
  const arr = [];
  for (let i = 0; i < count; i++) arr.push({ x: x0 + i * gap, y: y || 300, radius: 10, hp: 100, dead: false });
  return arr;
}
function mkState(over) {
  return Object.assign({
    W: 900, H: 520, CHARACTERS: NV.CHARACTERS, SHIELD_COOLDOWN: 0.9,
    applyPlayerDamage: () => ({ applied: false, dodged: false, damage: 1, crit: false, killed: false }),
    addFloatText() {}, killEnemy(e) { e.dead = true; }, applyKnockback() {}, spawnExplosion() {},
  }, over);
}

// ==================== FLAMETHROWER ====================
console.log('\n--- flamethrower ---');

t('flamethrower NO crea balas viajeras al disparar', () => {
  const bullets = [];
  NV.shoot({
    player: { x: 400, y: 450, luck: 0, permCrit: 0, overdrive: 0 },
    enemies: mkEnemies(3, 100, 400), boss: null, bullets, currentWeapon: NV.weaponById('flamethrower'),
    currentWeaponLevel: () => 1, weaponVisualTier: () => 0, BULLET_TIER_COLORS: ['#fff'], MAX_BULLETS: 100,
    permDamageBonus: 0, playWeaponSound() {}, wave: 1, fusionStep: 0.2, currentWeaponFusion: 0,
    onTarget() {}, onFlame(config) { if (!config || typeof config.range !== 'number') throw new Error('onFlame sin config'); },
  });
  if (bullets.length !== 0) throw new Error('flamethrower NO debe crear balas viajeras, creó ' + bullets.length);
});

t('flamethrower no dispara fuera de rango', () => {
  const res = NV.shoot({
    player: { x: 400, y: 450, luck: 0, permCrit: 0, overdrive: 0 },
    enemies: [{ x: 400, y: 100, radius: 10, hp: 100, dead: false }], boss: null, bullets: [],
    currentWeapon: NV.weaponById('flamethrower'),
    currentWeaponLevel: () => 1, weaponVisualTier: () => 0, BULLET_TIER_COLORS: ['#fff'], MAX_BULLETS: 100,
    permDamageBonus: 0, playWeaponSound() {}, wave: 1, fusionStep: 0.2, currentWeaponFusion: 0, onTarget() {},
  });
  if (res !== false) throw new Error('fuera de rango debe devolver false');
});

t('flamethrower: creaFlameZone produce zona con geometría acotada', () => {
  const z = NV.createFlameZone({ x: 100, y: 100, angle: 0, range: 170, damage: 6 });
  if (z.range !== 170) throw new Error('range=' + z.range);
  if (z.halfAngle <= 0 || z.halfAngle > 0.5) throw new Error('halfAngle=' + z.halfAngle);
  if (z.type !== 'flame') throw new Error('type=' + z.type);
});

t('flamethrower: solo daña enemigos DENTRO del cono', () => {
  const enemies = [
    { x: 200, y: 300, radius: 10, hp: 100, dead: false },
    { x: 0, y: 300, radius: 10, hp: 100, dead: false },
  ];
  const z = NV.createFlameZone({ x: 100, y: 300, angle: 0, range: 170, halfAngle: 0.22, damage: 10, tickRate: 7, life: 0.35, maxLife: 0.35, burnDamage: 3, burnDuration: 0.6 });
  NV.flameZoneDamage(z, { enemies, boss: null, killEnemy(e) { e.dead = true; } });
  if (enemies[0].hp !== 90) throw new Error('enemigo dentro del cone no dañado: hp=' + enemies[0].hp);
  if (enemies[1].hp !== 100) throw new Error('enemigo fuera del cone dañado: hp=' + enemies[1].hp);
});

t('flamethrower: daño por tick controlado (no cada frame)', () => {
  const enemies = [{ x: 150, y: 300, radius: 10, hp: 100, dead: false }];
  const player = { x: 100, y: 320 }; // zona sigue a (100,300), enemigo a la derecha (angle 0)
  const z = NV.createFlameZone({ x: 100, y: 300, angle: 0, range: 170, halfAngle: 0.30, damage: 10, tickRate: 5, life: 0.5, maxLife: 0.5, burnDamage: 3, burnDuration: 0.6 });
  let zones = [z];
  zones = NV.updateFlameZones(0.10, zones, { player, enemies, boss: null, currentAutoTarget: null });
  if (enemies[0].hp !== 100) throw new Error('daño prematuro: hp=' + enemies[0].hp);
  zones = NV.updateFlameZones(0.15, zones, { player, enemies, boss: null, currentAutoTarget: null });
  if (enemies[0].hp !== 90) throw new Error('daño no aplicado en tick: hp=' + enemies[0].hp);
});

t('flamethrower: burn no hace stacking', () => {
  const e = { x: 100, y: 100, hp: 100, dead: false };
  NV.applyBurn(e, 5, 0.6);
  NV.applyBurn(e, 5, 0.6);
  if (!e.burn || e.burn.dps !== 5) throw new Error('DPS duplicado: ' + (e.burn && e.burn.dps));
  NV.applyBurn(e, 10, 0.3);
  if (e.burn.dps !== 10) throw new Error('no tomó mayor DPS: ' + e.burn.dps);
});

t('flamethrower: burn expira y limpia estado', () => {
  const enemies = [{ x: 100, y: 100, hp: 50, dead: false }];
  NV.applyBurn(enemies[0], 5, 0.2);
  NV.updateBurns(0.5, { enemies, boss: null, killEnemy() {} });
  if (enemies[0].burn !== null) throw new Error('burn no expiró');
});

t('flamethrower: overdrive no crea múltiples zonas dañinas', () => {
  let flameCount = 0;
  const bullets = [];
  NV.shoot({
    player: { x: 400, y: 450, luck: 0, permCrit: 0, overdrive: 5 },
    enemies: [{ x: 450, y: 450, radius: 10, hp: 100, dead: false }], boss: null, bullets, currentWeapon: NV.weaponById('flamethrower'),
    currentWeaponLevel: () => 1, weaponVisualTier: () => 0, BULLET_TIER_COLORS: ['#fff'], MAX_BULLETS: 100,
    permDamageBonus: 0, playWeaponSound() {}, wave: 1, fusionStep: 0.2, currentWeaponFusion: 0,
    onTarget() {}, onFlame() { flameCount++; },
  });
  if (flameCount !== 1) throw new Error('overdrive creó ' + flameCount + ' zonas');
});

t('flamethrower: aim manual y auto producen la misma geometría', () => {
  let manual = null, auto = null;
  const common = {
    player: { x: 100, y: 120, luck: 0, permCrit: 0, overdrive: 0 },
    boss: null, bullets: [], currentWeapon: NV.weaponById('flamethrower'),
    currentWeaponLevel: () => 1, weaponVisualTier: () => 0, BULLET_TIER_COLORS: ['#fff'], MAX_BULLETS: 100,
    permDamageBonus: 0, playWeaponSound() {}, wave: 1, fusionStep: 0.2, currentWeaponFusion: 0, onTarget() {},
  };
  NV.shoot(Object.assign({}, common, { enemies: [], aimVector: { x: 1, y: 0 }, onFlame(z) { manual = z; } }));
  NV.shoot(Object.assign({}, common, { enemies: [{ x: 200, y: 120, radius: 10, hp: 100, dead: false }], onFlame(z) { auto = z; } }));
  if (!manual || !auto) throw new Error('faltó zona en uno de los modos');
  if (manual.range !== auto.range || Math.abs(manual.angle - auto.angle) > 0.000001) throw new Error('geometría diferente');
});

t('flamethrower: zona expirada no daña spawns futuros', () => {
  const player = { x: 100, y: 320 };
  let zones = [NV.createFlameZone({ x: 100, y: 300, angle: 0, range: 170, damage: 10, tickRate: 6, life: 0.05 })];
  zones = NV.updateFlameZones(0.1, zones, { player, enemies: [], boss: null, currentAutoTarget: null });
  const future = { x: 150, y: 300, radius: 10, hp: 100, dead: false };
  zones = NV.updateFlameZones(1, zones, { player, enemies: [future], boss: null, currentAutoTarget: null });
  if (zones.length !== 0 || future.hp !== 100) throw new Error('zona expirada dañó un spawn futuro');
});
// ==================== SHOTGUN ====================
console.log('\n--- shotgun ---');

function shootShotgun(target, overdrive) {
  const bullets = [];
  NV.shoot({
    player: { x: 0, y: 20, luck: -1000, permCrit: 0, overdrive: overdrive || 0 },
    enemies: [target], boss: null, bullets,
    aimVector: { x: 1, y: 0 },
    currentWeapon: NV.weaponById('shotgun'),
    currentWeaponLevel: () => 1, weaponVisualTier: () => 0, BULLET_TIER_COLORS: ['#fff'], MAX_BULLETS: 100,
    permDamageBonus: 0, playWeaponSound() {}, wave: 1, fusionStep: 0.2, currentWeaponFusion: 0, onTarget() {},
  });
  return bullets;
}

function advanceBullets(bullets, enemies, seconds) {
  const st = mkState({ bullets, enemies, boss: null, player: { x: -1000, y: -1000, character: 'boti', bulwark: 0, invuln: 0, stun: 0 } });
  const steps = Math.ceil(seconds / 0.02);
  for (let i = 0; i < steps && bullets.length; i++) {
    st.bullets = bullets;
    bullets = NV.updateBullets(0.02, st).bullets;
  }
  return bullets;
}

t('shotgun crea un patrón acotado de pellets reales', () => {
  const bullets = shootShotgun({ x: 100, y: 0, radius: 10, hp: 100, dead: false });
  if (bullets.length !== NV.BALANCE.SHOTGUN_PELLET_COUNT) throw new Error('pellets=' + bullets.length);
  if (bullets.length < 11 || bullets.length > 13) throw new Error('conteo fuera de presupuesto=' + bullets.length);
  if (bullets.some(b => b.impactType !== 'pellet' || b.maxTravelDistance !== 240)) throw new Error('perfil de pellet/rango inválido');
  if (new Set(bullets.map(b => b.shotGroup)).size !== 1) throw new Error('no comparten cap por descarga');
  const weapon = NV.weaponById('shotgun');
  if (weapon.count !== 12 || weapon.damage !== 5) throw new Error('datos shotgun=' + weapon.count + 'x' + weapon.damage);
  if (weapon.count * weapon.damage !== 60) throw new Error('daño teórico=' + (weapon.count * weapon.damage));
  if (!bullets.some(b => b.shotgunSpreadFactor === 0)) throw new Error('falta centro de rosa');
  if (new Set(bullets.map(b => b.shotgunSpreadFactor)).size < 9) throw new Error('patrón poco distribuido');
});

t('shotgun: definición visual usa micro-pellets sin bolas grandes', () => {
  const def = NV.BULLET_DEFS.shotgun;
  if (!def || def.shape !== 'pellet') throw new Error('shape inválida');
  if (!(def.r > 0 && def.r <= 0.8)) throw new Error('radio visual=' + def.r);
});

function pelletSnapshot(distance) {
  let bullets = shootShotgun({ x: 800, y: 0, radius: 10, hp: 100, dead: false });
  const st = mkState({ bullets, enemies: [], boss: null, player: { x: -1000, y: -1000, character: 'boti', bulwark: 0, invuln: 0, stun: 0 } });
  const seconds = distance / NV.weaponById('shotgun').speed;
  const steps = Math.ceil(seconds / 0.005);
  for (let i = 0; i < steps && bullets.length; i++) {
    st.bullets = bullets;
    bullets = NV.updateBullets(0.005, st).bullets;
  }
  const xs = bullets.map(b => b.x), ys = bullets.map(b => b.y);
  return {
    bullets,
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
    bloom: Math.max(...bullets.map(b => b.shotgunBloom || 0)),
  };
}

t('shotgun: rosa permanece muy compacta antes de bloomStart', () => {
  const before = pelletSnapshot(NV.BALANCE.SHOTGUN_BLOOM_START - 8);
  if (before.bloom !== 0) throw new Error('bloom prematuro=' + before.bloom);
  if (before.height > 6) throw new Error('rosa pre-bloom demasiado abierta=' + before.height);
  if (before.width > 12) throw new Error('rosa pre-bloom demasiado larga=' + before.width);
});

t('shotgun: apertura comienza después de bloomStart y progresa suavemente', () => {
  const before = pelletSnapshot(82), early = pelletSnapshot(120), middle = pelletSnapshot(165), far = pelletSnapshot(220);
  if (before.bloom !== 0) throw new Error('before bloom=' + before.bloom);
  if (!(early.bloom > 0 && early.bloom < middle.bloom && middle.bloom < far.bloom && far.bloom < 1)) {
    throw new Error('bloom=' + [before.bloom, early.bloom, middle.bloom, far.bloom].join(','));
  }
  if (!(before.height < early.height && early.height < middle.height && middle.height < far.height)) {
    throw new Error('alturas=' + [before.height, early.height, middle.height, far.height].join(','));
  }
  if (far.height < before.height * 3) throw new Error('apertura final insuficiente=' + far.height);
  if (far.width < far.height * 0.55 || far.width > far.height * 1.45) throw new Error('rosa final no circular=' + far.width + 'x' + far.height);
});

t('shotgun: un blanco cercano recibe más impactos que uno lejano equivalente', () => {
  const close = { x: 70, y: 0, radius: 10, hp: 500, dead: false };
  const closeShot = shootShotgun(close), pelletDamage = closeShot[0].damage;
  advanceBullets(closeShot, [close], 0.7);
  const closeHits = (500 - close.hp) / pelletDamage;
  const far = { x: 225, y: 0, radius: 7, hp: 500, dead: false };
  advanceBullets(shootShotgun(far), [far], 0.7);
  const farHits = (500 - far.hp) / pelletDamage;
  if (!(closeHits >= 10 && closeHits >= farHits + 3)) throw new Error('close=' + closeHits + ' far=' + farHits);
});

t('shotgun: múltiples pellets pueden golpear al mismo enemigo', () => {
  const enemy = { x: 70, y: 0, radius: 10, hp: 500, dead: false };
  const bullets = shootShotgun(enemy), pelletDamage = bullets[0].damage;
  advanceBullets(bullets, [enemy], 0.7);
  if (enemy.hp > 500 - pelletDamage * 10) throw new Error('solo recibió ' + ((500 - enemy.hp) / pelletDamage) + ' impactos');
});

t('shotgun: primer cuerpo consume sólo pellets intersectados y los demás continúan', () => {
  const first = { x: 205, y: 0, radius: 5, hp: 500, dead: false };
  let bullets = shootShotgun(first), pelletDamage = bullets[0].damage;
  bullets = advanceBullets(bullets, [first], 0.54);
  const firstHits = (500 - first.hp) / pelletDamage;
  if (!(firstHits > 0 && firstHits < NV.BALANCE.SHOTGUN_PELLET_COUNT)) throw new Error('impactos primer cuerpo=' + firstHits);
  if (!bullets.length || !bullets.some(b => b.x > first.x)) throw new Error('no sobrevivieron pellets más allá del primer cuerpo');
  const second = { x: 228, y: 10, radius: 5, hp: 500, dead: false };
  bullets = advanceBullets(bullets, [first, second], 0.2);
  if (second.hp >= 500) throw new Error('pellets supervivientes no alcanzaron segundo cuerpo');
});

t('shotgun: cap duro de enemigos únicos por descarga', () => {
  const group = { targets: [], cap: NV.BALANCE.SHOTGUN_UNIQUE_TARGET_CAP };
  const enemies = Array.from({ length: 5 }, (_, i) => ({ x: 100 + i * 40, y: 100, radius: 10, hp: 100, dead: false }));
  const bullets = enemies.map(e => ({ x: e.x, y: e.y, vx: 0, vy: 0, damage: 5, dead: false, isEnemy: false, pierce: 1, impactType: 'pellet', traveledDistance: 0, maxTravelDistance: 240, hitTargets: [], wid: 'shotgun', shotGroup: group }));
  const st = mkState({ bullets, enemies, boss: null, player: { x: -1000, y: -1000, character: 'boti', bulwark: 0, invuln: 0, stun: 0 } });
  NV.updateBullets(0, st);
  const damaged = enemies.filter(e => e.hp < 100).length;
  if (damaged !== 3 || damaged > 4) throw new Error('dañó ' + damaged);
});

t('shotgun: expira por distancia sin daño', () => {
  const enemies = [{ x: 1000, y: 0, radius: 10, hp: 100, dead: false }];
  const bullets = [{ x: 100, y: 0, vx: 600, vy: 0, damage: 5, dead: false, isEnemy: false, pierce: 1, impactType: 'pellet', traveledDistance: 239, maxTravelDistance: 240, hitTargets: [], wid: 'shotgun', shotGroup: { targets: [], cap: 3 } }];
  const st = mkState({ bullets, enemies, boss: null, player: { x: -1000, y: -1000, character: 'boti', bulwark: 0, invuln: 0, stun: 0 } });
  const res = NV.updateBullets(0.1, st);
  if (res.bullets.length !== 0) throw new Error('no expiró');
  if (enemies[0].hp !== 100) throw new Error('daño tras expiración');
});

t('shotgun: pellets expirados no dañan spawns futuros', () => {
  let bullets = shootShotgun({ x: 100, y: 0, radius: 10, hp: 100, dead: false });
  bullets = advanceBullets(bullets, [], 1);
  const future = { x: 120, y: 0, radius: 30, hp: 100, dead: false };
  advanceBullets(bullets, [future], 1);
  if (bullets.length !== 0 || future.hp !== 100) throw new Error('pellet futuro persistente');
});

// ==================== PLASMA ====================
console.log('\n--- plasma ---');

t('plasma: único nerf canónico de daño 40 -> 36', () => {
  const plasma = NV.weaponById('plasma');
  if (plasma.damage !== 36) throw new Error('damage=' + plasma.damage);
  if (plasma.count !== 2 || plasma.range !== 520 || plasma.speed !== 600 || plasma.spread !== 0.1) throw new Error('se alteró otra dimensión del plasma');
});

t('plasma: proyectil con maxTravelDistance', () => {
  const bullets = [];
  NV.shoot({
    player: { x: 0, y: 0, luck: 0, permCrit: 0, overdrive: 0 },
    enemies: [{ x: 100, y: 0, radius: 10, hp: 100, dead: false }], boss: null, bullets,
    currentWeapon: NV.weaponById('plasma'),
    currentWeaponLevel: () => 1, weaponVisualTier: () => 0, BULLET_TIER_COLORS: ['#fff'], MAX_BULLETS: 100,
    permDamageBonus: 0, playWeaponSound() {}, wave: 1, fusionStep: 0.2, currentWeaponFusion: 0, onTarget() {},
  });
  if (!bullets.length) throw new Error('no disparó');
  if (typeof bullets[0].maxTravelDistance !== 'number' || bullets[0].maxTravelDistance <= 0) throw new Error('sin maxTravelDistance');
});

t('plasma: expira al alcanzar distancia máxima sin daño', () => {
  const enemies = [{ x: 1000, y: 0, radius: 10, hp: 100, dead: false }];
  const bullets = [{ x: 100, y: 0, vx: 600, vy: 0, damage: 36, dead: false, isEnemy: false, pierce: 1, impactType: 'splash', splashRadius: 58, traveledDistance: 519, maxTravelDistance: 520, hitTargets: [], wid: 'plasma', color: '#a855f7' }];
  const st = mkState({ bullets, enemies, boss: null, player: { x: -1000, y: -1000, character: 'boti', bulwark: 0, invuln: 0, stun: 0 } });
  const res = NV.updateBullets(0.1, st);
  if (res.bullets.length !== 0) throw new Error('no expiró');
  if (enemies[0].hp !== 100) throw new Error('daño tras expiración');
});

t('plasma: splash al impacto intacto', () => {
  const enemies = [
    { x: 100, y: 0, radius: 10, hp: 100, dead: false },
    { x: 145, y: 0, radius: 10, hp: 100, dead: false },
  ];
  const bullets = [{ x: 100, y: 0, vx: 0, vy: 0, damage: 36, dead: false, isEnemy: false, pierce: 1, impactType: 'splash', splashRadius: 58, traveledDistance: 0, maxTravelDistance: 520, hitTargets: [], wid: 'plasma', color: '#a855f7' }];
  const st = mkState({ bullets, enemies, boss: null, player: { x: -1000, y: -1000, character: 'boti', bulwark: 0, invuln: 0, stun: 0 } });
  NV.updateBullets(0, st);
  if (enemies[0].hp !== 64) throw new Error('impacto inicial hp=' + enemies[0].hp);
  if (enemies[1].hp !== 64) throw new Error('splash cercano hp=' + enemies[1].hp);
});

// ==================== BOW ====================
console.log('\n--- bow ---');

t('bow: cadena visual acotada a 4 objetivos', () => {
  const enemies = mkEnemies(6, 100, 100, 30);
  let bullets = [{ x: 100, y: 100, vx: 0, vy: 0, damage: 10, dead: false, isEnemy: false, pierce: 1, impactType: 'bounce', bounceLeft: 3, splashRadius: 180, hitTargets: [], wid: 'bow' }];
  const st = mkState({ bullets, enemies, boss: null, player: { x: -1000, y: -1000, character: 'boti', bulwark: 0, invuln: 0, stun: 0 } });
  for (let i = 0; i < 10 && bullets.length; i++) { const res = NV.updateBullets(0, st); bullets = res.bullets; }
  const damaged = enemies.filter(e => e.hp < 100).length;
  if (damaged !== 4) throw new Error('dañó ' + damaged + ' (debe ser 4)');
});

t('bow: ningún enemigo golpeado dos veces', () => {
  const enemies = mkEnemies(6, 100, 100, 30);
  let bullets = [{ x: 100, y: 100, vx: 0, vy: 0, damage: 10, dead: false, isEnemy: false, pierce: 1, impactType: 'bounce', bounceLeft: 3, splashRadius: 180, hitTargets: [], wid: 'bow' }];
  const st = mkState({ bullets, enemies, boss: null, player: { x: -1000, y: -1000, character: 'boti', bulwark: 0, invuln: 0, stun: 0 } });
  for (let i = 0; i < 10 && bullets.length; i++) { const res = NV.updateBullets(0, st); bullets = res.bullets; }
  const low = enemies.filter(e => e.hp <= 70).length;
  if (low > 0) throw new Error(low + ' enemigos golpeados 2+ veces');
});

t('bow: no rebota fuera del radio', () => {
  const enemies = [{ x: 100, y: 100, radius: 10, hp: 100, dead: false }, { x: 500, y: 100, radius: 10, hp: 100, dead: false }];
  let bullets = [{ x: 100, y: 100, vx: 0, vy: 0, damage: 10, dead: false, isEnemy: false, pierce: 1, impactType: 'bounce', bounceLeft: 3, splashRadius: 180, hitTargets: [], wid: 'bow' }];
  const st = mkState({ bullets, enemies, boss: null, player: { x: -1000, y: -1000, character: 'boti', bulwark: 0, invuln: 0, stun: 0 } });
  for (let i = 0; i < 10 && bullets.length; i++) { const res = NV.updateBullets(0, st); bullets = res.bullets; }
  if (enemies[1].hp !== 100) throw new Error('rebotó fuera de radio');
});

t('bow: con dt>0 la flecha viaja visiblemente', () => {
  const enemies = [
    { x: 100, y: 100, radius: 10, hp: 100, dead: false },
    { x: 250, y: 100, radius: 10, hp: 100, dead: false },
  ];
  let bullets = [{ x: 100, y: 100, vx: 0, vy: 0, damage: 10, dead: false, isEnemy: false, pierce: 1, impactType: 'bounce', bounceLeft: 3, splashRadius: 180, hitTargets: [], wid: 'bow' }];
  const st = mkState({ bullets, enemies, boss: null, player: { x: -1000, y: -1000, character: 'boti', bulwark: 0, invuln: 0, stun: 0 } });
  let res = NV.updateBullets(0, st); bullets = res.bullets;
  if (enemies[0].hp !== 90) throw new Error('primer impacto no aplicado');
  const startX = bullets[0].x;
  res = NV.updateBullets(0.05, st); bullets = res.bullets;
  if (bullets[0].x === startX) throw new Error('flecha no viaja');
  for (let i = 0; i < 100 && bullets.length; i++) { res = NV.updateBullets(0.05, st); bullets = res.bullets; }
  if (enemies[1].hp !== 90) throw new Error('segundo impacto no aplicado');
});

// ==================== MAGNET ====================
console.log('\n--- magnet ---');

t('magnet: recolección no supera MAGNET_CAP', () => {
  const player = { x: 400, y: 260 };
  const pickups = [];
  for (let i = 0; i < 80; i++) pickups.push({ x: 10 + i * 2, y: 10, dead: false });
  const weaponPickups = [{ x: 50, y: 50, dead: false, weapon: NV.WEAPONS[0] }];
  const n = NV.magnetCollect(pickups, weaponPickups, player);
  if (n > NV.BALANCE.MAGNET_CAP) throw new Error('recolectó ' + n + ' > cap');
});

t('magnet: prioriza los pickups más cercanos', () => {
  const player = { x: 400, y: 260 };
  // Crear muchos pickups; los más cercanos deben ser magnetizados primero
  const pickups = [];
  // 60 pickups lejanos
  for (let i = 0; i < 60; i++) pickups.push({ x: 10 + i, y: 10, dead: false });
  // 3 pickups cercanos al final (más cercanos al player)
  pickups.push({ x: 401, y: 260, dead: false }); // muy cerca
  pickups.push({ x: 402, y: 260, dead: false }); // muy cerca
  pickups.push({ x: 10, y: 10, dead: false });   // lejano (duplicado posición)
  const origCap = NV.BALANCE.MAGNET_CAP;
  // Usar MAGNET_CAP por defecto (50); verificar que los 2 más cercanos están incluidos
  const n = NV.magnetCollect(pickups, [], player);
  if (n > origCap) throw new Error('recolectó ' + n + ' > cap');
  // Los dos más cercanos (401,260) y (402,260) deben estar magnetizados
  const closest1 = pickups.find(p => p.x === 401 && p.y === 260);
  const closest2 = pickups.find(p => p.x === 402 && p.y === 260);
  if (!closest1 || !closest1.magnetPull) throw new Error('pickup más cercano no magnetizado');
  if (!closest2 || !closest2.magnetPull) throw new Error('pickup 2do más cercano no magnetizado');
});

t('magnet: excedentes permanecen vivos y sin magnetizar', () => {
  const player = { x: 400, y: 260 };
  const pickups = [];
  for (let i = 0; i < 80; i++) pickups.push({ x: 10 + i, y: 10, dead: false });
  const n = NV.magnetCollect(pickups, [], player);
  if (n > NV.BALANCE.MAGNET_CAP) throw new Error('recolectó ' + n + ' > cap');
  const notMag = pickups.filter(p => !p.magnetPull && !p.dead).length;
  if (notMag !== 80 - NV.BALANCE.MAGNET_CAP) throw new Error('esperaba ' + (80 - NV.BALANCE.MAGNET_CAP) + ' no magnetizados, hay ' + notMag);
});

console.log('\nRESULT weapons_behavior: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);

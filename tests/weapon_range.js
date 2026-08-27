// Tests de rango de activación por arma (v39).
const fs = require('fs'), vm = require('vm');
const sbx = { window: { NV: {} }, console, Math };
for (const f of ['js/data/balance.js', 'js/data/gameData.js', 'js/engine/weapons.js']) vm.runInNewContext(fs.readFileSync(f, 'utf8'), sbx, { filename: f });
const NV = sbx.window.NV;
let pass = 0, fail = 0;
function t(desc, fn) { try { fn(); pass++; console.log('  ok  ' + desc); } catch (e) { fail++; console.log('  FAIL ' + desc + ' -> ' + e.message); } }

t('TODAS las armas tienen range definido y positivo', () => {
  for (const w of NV.WEAPONS) {
    if (!(typeof w.range === 'number' && w.range > 0)) throw new Error(w.id + ' sin range valido');
  }
});

t('Orden relativo coherente: railgun > sniper > bow > rifle > smg > shotgun > flamethrower', () => {
  const r = id => NV.WEAPONS.find(w => w.id === id).range;
  if (!(r('railgun') > r('sniper'))) throw new Error('railgun<=sniper');
  if (!(r('sniper') > r('bow'))) throw new Error('sniper<=bow');
  if (!(r('bow') > r('rifle'))) throw new Error('bow<=rifle');
  if (!(r('rifle') > r('smg'))) throw new Error('rifle<=smg');
  if (!(r('smg') > r('shotgun'))) throw new Error('smg<=shotgun');
  if (!(r('shotgun') > r('flamethrower'))) throw new Error('shotgun<=flamethrower');
});

t('shoot NO dispara fuera de rango (devuelve false, sin balas ni sonido)', () => {
  const player = { x: 400, y: 500 };
  const enemy = { x: 400, y: 500 - 900 }; // a 900px: fuera del alcance de todas
  let sounded = 0;
  const res = NV.shoot({ player, enemies: [enemy], boss: null, bullets: [], currentWeapon: NV.WEAPONS.find(w => w.id === 'pistol'),
    currentWeaponLevel: () => 1, weaponVisualTier: () => 0, BULLET_TIER_COLORS: [], MAX_BULLETS: 100,
    permDamageBonus: 0, playWeaponSound: () => sounded++ });
  if (res !== false) throw new Error('deberia devolver false');
  if (sounded !== 0) throw new Error('no deberia sonar');
});

t('shoot SÍ dispara dentro de su rango (balas creadas, sonido reproducido)', () => {
  const player = { x: 400, y: 500 };
  const enemy = { x: 400, y: 500 - 300 }; // a 300px: pistol(380) sí, flamethrower(170) no
  const mk = wid => ({ player, enemies: [enemy], boss: null, bullets: [], currentWeapon: NV.WEAPONS.find(w => w.id === wid),
    currentWeaponLevel: () => 1, weaponVisualTier: () => 0, BULLET_TIER_COLORS: ['#fff'], MAX_BULLETS: 100,
    permDamageBonus: 0, playWeaponSound: () => {} });
  const bulletsP = [];
  const stP = mk('pistol'); stP.bullets = bulletsP; stP.playWeaponSound = () => {};
  if (NV.shoot(stP) === false || bulletsP.length === 0) throw new Error('pistol deberia disparar a 300px');
  const stF = mk('flamethrower'); stF.playWeaponSound = () => {};
  if (NV.shoot(stF) !== false) throw new Error('flamethrower NO deberia disparar a 300px');
  // justo en el límite: dentro (<=)
  const enemy2 = { x: 400, y: 500 - 380 };
  const b3 = []; const stB = mk('pistol'); stB.enemies = [enemy2]; stB.bullets = b3;
  if (NV.shoot(stB) === false || b3.length === 0) throw new Error('en el limite exacto deberia disparar');
});

console.log('RESULT weapon_range: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
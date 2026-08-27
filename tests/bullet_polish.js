// Tests E3: proyectil visible por nivel/fusión — crecimiento y halo dorado.
const fs = require('fs'), vm = require('vm');
let pass = 0, fail = 0;
function t(desc, fn) { try { fn(); pass++; console.log('  ok  ' + desc); } catch (e) { fail++; console.log('  FAIL ' + desc + ' -> ' + e.message); } }
function load(f, sbx) { vm.runInNewContext(fs.readFileSync(f, 'utf8'), sbx, { filename: f }); }

const sbx = { window: { NV: {} }, console, Math };
for (const f of ['js/data/gameData.js', 'js/data/balance.js', 'js/core/state.js', 'js/core/utils.js', 'js/engine/weapons.js']) load(f, sbx);
const NV = sbx.window.NV;
const WEAPONS = NV.WEAPONS;

t('bulletSizeGrowth: crece con nivel y fusión', () => {
  if (NV.bulletSizeGrowth(1, 0) !== 0) throw new Error('nivel 1 sin crecimiento');
  const g5 = NV.bulletSizeGrowth(5, 0), g10 = NV.bulletSizeGrowth(10, 0);
  if (!(g10 > g5 && g5 > 0)) throw new Error('no es monótono');
  if (!(NV.bulletSizeGrowth(5, 2) > g5)) throw new Error('fusión no suma');
});

t('tope de crecimiento (nunca más de 40%)', () => {
  if (NV.bulletSizeGrowth(999, 3) > 0.4) throw new Error('sin tope');
  if (NV.bulletSizeGrowth(1, 99) !== 0.4) throw new Error('tope en fusión');
});

t('shoot estampa growth según nivel y fusion del estado', () => {
  let grown = null;
  NV.shoot({
    player: { x: 400, y: 300, luck: 0, overdrive: 0 },
    enemies: [{ x: 450, y: 300, dead: false }], boss: null,
    bullets: [], currentWeapon: WEAPONS[0], currentWeaponLevel: () => 11,
    currentWeaponFusion: 2, permDamageBonus: 0,
    weaponVisualTier: () => 1, BULLET_TIER_COLORS: ['#fff'], MAX_BULLETS: 50,
    playWeaponSound: () => {},
    // interceptamos el push revisando la bala generada
  });
  // shoot empuja al array pasado; rehacemos con array capturado
  const bullets = [];
  NV.shoot({
    player: { x: 400, y: 300, luck: 0, overdrive: 0 },
    enemies: [{ x: 450, y: 300, dead: false }], boss: null,
    bullets, currentWeapon: WEAPONS[0], currentWeaponLevel: () => 11,
    currentWeaponFusion: 2, permDamageBonus: 0,
    weaponVisualTier: () => 1, BULLET_TIER_COLORS: ['#fff'], MAX_BULLETS: 50,
    playWeaponSound: () => {},
  });
  grown = bullets[0];
  const esperado = Math.min(0.4, 10 * 0.02 + 2 * 0.06); // nivel 11 => lv=10
  if (Math.abs(grown.growth - esperado) > 1e-9) throw new Error('growth=' + grown.growth + ' esperado=' + esperado);
  if (grown.glowColor !== '#ffd700') throw new Error('halo dorado ausente para arma fusionada');
});

t('arma sin fusion mantiene el color de tier original', () => {
  const bullets = [];
  NV.shoot({
    player: { x: 400, y: 300, luck: 0, overdrive: 0 },
    enemies: [{ x: 450, y: 300, dead: false }], boss: null,
    bullets, currentWeapon: WEAPONS[0], currentWeaponLevel: () => 3,
    currentWeaponFusion: 0, permDamageBonus: 0,
    weaponVisualTier: () => 0, BULLET_TIER_COLORS: ['#aabbcc'], MAX_BULLETS: 50,
    playWeaponSound: () => {},
  });
  if (bullets[0].glowColor !== '#aabbcc') throw new Error('glowColor=' + bullets[0].glowColor);
  if (bullets[0].growth !== 0.04) throw new Error('growth=' + bullets[0].growth);
});

t('render usa b.growth en game.js', () => {
  const g = fs.readFileSync('js/game.js', 'utf8');
  if (!g.includes('(b.growth || 0)')) throw new Error('game.js no combina growth');
});

console.log('RESULT bullet_polish: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
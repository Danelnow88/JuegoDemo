// Tests B2: venta de armas — precio por rareza coherente (< compra) y connected.
const fs = require('fs'), vm = require('vm');
let pass = 0, fail = 0;
function t(desc, fn) { try { fn(); pass++; console.log('  ok  ' + desc); } catch (e) { fail++; console.log('  FAIL ' + desc + ' -> ' + e.message); } }
const sbx = { window: { NV: {} }, console, Math };
vm.runInNewContext(fs.readFileSync('js/engine/weapons.js', 'utf8'), sbx, { filename: 'weapons.js' });
vm.runInNewContext(fs.readFileSync('js/data/balance.js', 'utf8'), sbx, { filename: 'balance.js' });
const NV = sbx.window.NV;

t('weaponSellValue: valor correcto por rareza', () => {
  const m = NV.BALANCE.WEAPON_SELL_PRICES;
  if (NV.weaponSellValue({ rarity: 'common' }, m) !== m.common) throw new Error('common');
  if (NV.weaponSellValue({ rarity: 'legendary' }, m) !== m.legendary) throw new Error('legendary');
});

t('venta siempre < compra (25): sin farmeo de economía', () => {
  const m = NV.BALANCE.WEAPON_SELL_PRICES;
  for (const k of Object.keys(m)) {
    if (m[k] >= 25) throw new Error(k + ' vende ' + m[k] + ' >= 25');
  }
});

t('rareza desconocida/arma nula: fallback seguro', () => {
  const m = NV.BALANCE.WEAPON_SELL_PRICES;
  if (NV.weaponSellValue({ rarity: 'mythic' }, m) !== m.common) throw new Error('desconocida no cae a common');
  if (NV.weaponSellValue(null, m) !== 0) throw new Error('null no da 0');
  if (NV.weaponSellValue({ rarity: 'epic' }, null) !== 0) throw new Error('sin mapa no da 0');
});

t('game.js vende: usa NV.weaponSellValue, suma shards y saca del inventario', () => {
  const g = fs.readFileSync('js/game.js', 'utf8');
  for (const pat of ['NV.weaponSellValue(weapon, WEAPON_SELL_PRICES)', 'inventory.splice(i, 1)', 'shards += val']) {
    if (!g.includes(pat)) throw new Error('falta: ' + pat);
  }
});

t('constantes de venta en balance.js', () => {
  const b = fs.readFileSync('js/data/balance.js', 'utf8');
  if (!b.includes('WEAPON_SELL_PRICES')) throw new Error('sin WEAPON_SELL_PRICES');
});

console.log('RESULT weapon_sell: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
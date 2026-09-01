// Tests: modo ?fresh=1 (sin persistencia) + tope de consumibles por visita.
const fs = require('fs');
let pass = 0, fail = 0;
function t(desc, fn) { try { fn(); pass++; console.log('  ok  ' + desc); } catch (e) { fail++; console.log('  FAIL ' + desc + ' -> ' + e.message); } }
const g = fs.readFileSync('js/game.js', 'utf8');
const c = fs.readFileSync('js/data/consumables.js', 'utf8');

t('?fresh=1: saltea loadMeta y congela guardado', () => {
  if (!/fresh=1/.test(g) || !/\.test\(\(window\.location && window\.location\.search\) \|\| ''\)/.test(g)) throw new Error('flag no detectado');
  const initIdx = g.indexOf('function init()');
  const initBody = g.slice(initIdx, g.indexOf('resizeCanvas();', initIdx));
  if (!initBody.includes('metaFrozen = true')) throw new Error('no congela en init');
  if (!initBody.includes('metaShards = 0')) throw new Error('no pone metaShards en 0');
});

t('saveMeta respeta metaFrozen', () => {
  const i = g.indexOf('function saveMeta()');
  if (!g.slice(i, i + 200).includes('if (metaFrozen) return')) throw new Error('guard ausente');
});

t('NV.resetMeta borra localStorage', () => {
  if (!g.includes("NV.resetMeta = function")) throw new Error('resetMeta ausente');
  if (!g.includes("localStorage.removeItem('neonVoidMeta')")) throw new Error('no borra la clave');
});

t('tope de consumibles: cap 3 por visita, reset en showShop', () => {
  if (!g.includes('const CONSUMABLE_CAP = 3;')) throw new Error('cap ausente');
  if (!/let consumableBought = \{\};/.test(g)) throw new Error('contador ausente');
  const i = g.indexOf('function showShop()');
  if (!g.slice(i, i + 300).includes('consumableBought = {};')) throw new Error('no se resetea por visita');
  if (!g.includes("bought >= CONSUMABLE_CAP")) throw new Error('puerta del tope ausente');
  if (!g.includes('NV.consumableList().forEach')) throw new Error('tienda no usa lista centralizada');
  for (const k of ['potion', 'overdrive', 'shield']) {
    if (!c.includes("key: '" + k + "'")) throw new Error('falta def de ' + k);
  }
  if (!g.includes('NV.addConsumable(consumableItems')) throw new Error('compra no usa helper de alta');
  if (g.includes('consumableItems.push')) throw new Error('push directo de consumible');
});

t('tope acumulado por tipo: cap 10 y tienda deshabilitada con indicador visual', () => {
  if (!c.includes('NV.CONSUMABLE_STACK_CAP = 10;')) throw new Error('stack cap no centralizado');
  if (!g.includes('const CONSUMABLE_STACK_CAP = NV.CONSUMABLE_STACK_CAP;')) throw new Error('game no lee stack cap');
  if (!g.includes('NV.consumableCountByType(consumableItems, c.key)')) throw new Error('tienda no cuenta stock actual');
  if (!g.includes('disabled: stackFull')) throw new Error('oferta no marca disabled');
  if (!g.includes("disabledReason: 'Límite ' + CONSUMABLE_STACK_CAP + '/' + CONSUMABLE_STACK_CAP")) throw new Error('sin texto de límite');
  if (!g.includes('item.disabled')) throw new Error('render/click no respeta disabled');
  const css = fs.readFileSync('css/styles.css', 'utf8');
  if (!css.includes('.offer.disabled')) throw new Error('sin estilo disabled');
});

console.log('RESULT shop_meta: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
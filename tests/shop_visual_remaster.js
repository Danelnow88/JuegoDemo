// Tests: remaster visual de tienda como terminal de reabastecimiento.
const fs = require('fs');
let pass = 0, fail = 0;
function t(desc, fn) { try { fn(); pass++; console.log('  ok  ' + desc); } catch (e) { fail++; console.log('  FAIL ' + desc + ' -> ' + e.message); } }

const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('css/styles.css', 'utf8');
const game = fs.readFileSync('js/game.js', 'utf8');
const dom = fs.readFileSync('js/ui/dom.js', 'utf8');

t('cabecera técnica: terminal de reabastecimiento, shards y oleada dinámica', () => {
  if (!html.includes('shop-terminal-head')) throw new Error('sin header terminal');
  if (!html.includes('SYS TERMINAL DE REABASTECIMIENTO')) throw new Error('copy de header incorrecto');
  if (!html.includes('id="shopWave"') || !html.includes('id="shopNextWave"')) throw new Error('sin placeholders de oleada');
  if (!game.includes('dom.shopWave.textContent = wave + 1')) throw new Error('shopWave no es dinámico');
  if (!game.includes('dom.shopNextWave.textContent = wave + 1')) throw new Error('shopNextWave no es dinámico');
});

t('layout: 3 paneles con identidades y docks dentro de ARMERÍA/PROTOCOLOS', () => {
  for (const cls of ['shop-section-calibrations', 'shop-section-armory', 'shop-section-protocols']) {
    if (!html.includes(cls)) throw new Error('falta ' + cls);
    if (!css.includes('.' + cls)) throw new Error('sin CSS ' + cls);
  }
  for (const chip of ['SYS', 'WPN', 'PRT']) if (!html.includes('>' + chip + '<')) throw new Error('falta chip ' + chip);
  if (!css.includes('.section-chip')) throw new Error('sin estilo section-chip');
  if (!html.includes('shop-weapon-dock') || !html.includes('id="invSlots"')) throw new Error('inventario no está dentro de armería');
  if (!html.includes('protocol-loadout') || !html.includes('id="shopConsumableLoadout"')) throw new Error('consumibles equipados no están dentro de protocolos');
  if (!css.includes('grid-template-columns: minmax(150px, .8fr) minmax(310px, 1.45fr) minmax(230px, 1fr)')) throw new Error('layout de 3 paneles no diferenciado');
});

t('protocolos renderiza 6 slots desde NV.groupConsumables sin tocar límites', () => {
  if (!dom.includes('shopConsumableLoadout')) throw new Error('dom no expone shopConsumableLoadout');
  if (!game.includes('function renderShopConsumableLoadout()')) throw new Error('sin renderer de loadout');
  if (!game.includes('const groups = NV.groupConsumables(consumableItems)')) throw new Error('no usa NV.groupConsumables');
  if (!game.includes('i < CONSUMABLE_TYPE_SLOT_CAP')) throw new Error('slots no usan cap centralizado');
  if (!game.includes("'loadout-slot'")) throw new Error('sin slots visuales');
});

t('tarjetas: layouts por tipo, rareza visual, hover scanline y disabled diagonal', () => {
  for (const cls of ['.offer-upgrade', '.offer-weapon', '.offer-consumable', '.rarity-common', '.rarity-rare', '.rarity-epic', '.rarity-legendary']) {
    if (!css.includes(cls)) throw new Error('falta ' + cls);
  }
  if (!css.includes('@keyframes shop-card-scan')) throw new Error('sin scanline de hover');
  if (!css.includes("content: 'BLOQUEADO'")) throw new Error('sin overlay bloqueado');
  if (!css.includes('@keyframes legendary-breathe')) throw new Error('sin respiración legendaria');
  if (!game.includes('function visualRarity')) throw new Error('sin mapeo visual de rareza');
  if (!game.includes('"offer offer-" + kind + " rarity-" + visualRarity')) throw new Error('renderOffers no aplica clases visuales');
});

t('fondo de tienda con profundidad: grid isométrico, partículas y línea de estado', () => {
  if (!css.includes('perspective(420px) rotateX(58deg)')) throw new Error('sin piso isométrico');
  if (!css.includes('shop-static-drift')) throw new Error('sin partículas/estático sutil');
  if (!css.includes('shop-status-line')) throw new Error('sin línea inferior animada');
});

t('micro feedback de compra existe sin cambiar reglas de compra', () => {
  if (!css.includes('@keyframes buy-confirm')) throw new Error('sin destello de compra');
  if (!game.includes("el.classList.add('just-bought')")) throw new Error('compra no marca just-bought');
  if (!game.includes('if (shards >= item.price)')) throw new Error('validación de shards alterada/ausente');
  if (!game.includes('if (item.disabled)')) throw new Error('disabled no se respeta');
});

console.log('RESULT shop_visual_remaster: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
// Tests Bloque 3: integración de iconos canvas en tienda/inventario/drops.
const fs = require('fs');
let pass = 0, fail = 0;
function t(d, fn) { try { fn(); pass++; console.log('  ok  ' + d); } catch (e) { fail++; console.log('  FAIL ' + d + ' -> ' + e.message); } }

const game = fs.readFileSync('js/game.js', 'utf8');
const css = fs.readFileSync('css/styles.css', 'utf8');

t('tienda reemplaza pixel-art viejo por drawWeaponCanvas + drawWeaponIcon', () => {
  if (game.includes('function drawWeaponPixelArt')) throw new Error('quedó drawWeaponPixelArt');
  if (!game.includes('function drawWeaponCanvas')) throw new Error('falta drawWeaponCanvas');
  if (!game.includes('drawWeaponCanvas(c, item.weapon, 64, 50)')) throw new Error('ofertas no renderizan armas 64/50');
  if (!game.includes('NV.drawWeaponIcon(ctx, weapon, canvasSize / 2')) throw new Error('drawWeaponCanvas no usa helper aprobado');
});

t('inventario DOM usa canvas por slot, no weapon.icon textual', () => {
  if (!game.includes('<div class="inv-icon"><canvas width="32" height="32"')) throw new Error('slot sin canvas 32');
  if (!game.includes("drawWeaponCanvas(slot.querySelector('canvas'), weapon, 32, 26)")) throw new Error('slot no dibuja icono 32/26');
  if (/inv-icon[^`]+\$\{weapon\.icon\}/.test(game)) throw new Error('inventario aún imprime weapon.icon');
});

t('pickups de armas en mundo usan drawWeaponIcon y conservan etiqueta textual', () => {
  const pickupBlock = game.slice(game.lastIndexOf('for (const wp of weaponPickups)'), game.indexOf('// Cofres de jefe'));
  if (!pickupBlock.includes('NV.drawWeaponIcon(ctx, wp.weapon')) throw new Error('drop no usa icono canvas');
  if (pickupBlock.includes('fillText(wp.weapon.icon')) throw new Error('drop todavía usa weapon.icon');
  if (!pickupBlock.includes('fillText(wp.weapon.name')) throw new Error('drop perdió nombre de arma');
});

t('CSS reserva tamaño real legible para canvas del inventario', () => {
  if (!css.includes('.inv-slot .inv-icon canvas')) throw new Error('falta estilo canvas inventario');
  if (!css.includes('width: 32px; height: 32px')) throw new Error('canvas de inventario no queda 32x32 CSS');
});

console.log('RESULT weapon_icons_integration: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
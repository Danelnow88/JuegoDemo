// P1.5B: invariantes de loadout. Pistola = arma normal; slots = posiciones reales;
// hotkeys 1-6 == slots visibles; venta/compra/fusión sin estados fantasma.
const fs = require('fs'), vm = require('vm');
let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; console.log('  ok  ' + name); } catch (e) { fail++; console.log('  FAIL ' + name + ' -> ' + e.message); } }
function load(f, sbx) { vm.runInNewContext(fs.readFileSync(f, 'utf8'), sbx, { filename: f }); }
const g = fs.readFileSync('js/game.js', 'utf8');
const hud = fs.readFileSync('js/render/hud.js', 'utf8');

t('run inicia con la pistola como arma normal en el slot 1 del inventario', () => {
  if (!g.includes('inventory = [NV.starterWeapon()]; currentWeapon = inventory[0];')) throw new Error('starter no entra al inventario');
});

t('la pistola no conserva privilegios posteriores a la inicialización', () => {
  const uses = (g.match(/currentWeapon = NV\.starterWeapon\(\)/g) || []).length;
  if (uses !== 1) throw new Error('usos de privilegio starter=' + uses);
  if (g.includes('[NV.starterWeapon()].concat(inventory)')) throw new Error('cicla con pistola implícita');
  if (hud.includes('starterWeapon')) throw new Error('HUD inyecta pistola implícita');
});

t('hotkeys 1-6 equipan exactamente el arma visible en ese slot', () => {
  if (!g.includes('equipFromInventory(parseInt(digit[1], 10) - 1)')) throw new Error('mapeo de digitos ausente');
  // HUD y hotkeys comparten el mismo origen (posiciones de inventory).
  if (!hud.includes('inventory.slice(0, 6).map')) throw new Error('HUD no lista el inventario');
  if (!hud.includes('var equippedIdx = inventory.indexOf(weapon);')) throw new Error('equippedIdx no por identidad');
});

t('venta: la última arma se bloquea y la equipada cae a la siguiente válida', () => {
  if (!g.includes("showBanner('NECESITÁS AL MENOS UN ARMA', '#ff5f9b')")) throw new Error('sin guard de ultima arma');
  if (!g.includes('inventory[Math.min(i, inventory.length - 1)] || inventory[0]')) throw new Error('fallback de equipada ausente');
  if (!g.includes('inventory.splice(i, 1)') || !g.includes('shards += val')) throw new Error('flujo de venta alterado');
});

t('venta de la pistola: es posible y no reaparece automaticamente', () => {
  if (g.includes('ARMA EQUIPADA: PISTOLA')) throw new Error('click de soltar re-equipa la pistola');
  // startGame es el unico punto que reinserta la pistola.
  const starts = (g.match(/inventory = \[NV\.starterWeapon\(\)\]/g) || []).length;
  if (starts !== 1) throw new Error('resurrecciones del starter=' + starts);
});

t('compra con inventario lleno: oferta bloqueada, sin arma fantasma ni cobro', () => {
  if (!g.includes("'INVENTARIO LLENO'")) throw new Error('razon INVENTARIO LLENO ausente');
  if (/const invFull = !canFuse/.test(g) === false) throw new Error('guard invFull ausente');
  // El branch de compra de armas ya no equipa sin almacenar.
  const buy = g.slice(g.indexOf('const invFull = !canFuse'), g.indexOf('NV.consumableList().forEach'));
  if (/currentWeapon = w;/.test(buy)) throw new Error('arma fantasma sigue presente');
  if (!buy.includes('return false;')) throw new Error('sin guardia defensiva');
});

t('rollback de compra: buy() que falla devuelve los shards', () => {
  if (!g.includes('const ok = item.buy();')) throw new Error('sin resultado de buy');
  if (!g.includes('shards += item.price;')) throw new Error('sin reembolso');
  if (!g.includes('Invariante: una compra inválida NUNCA cobra')) throw new Error('invariante sin comentar');
});

t('reordenamiento: sólo swap entre armas existentes; los vacíos no aceptan moves', () => {
  if (!g.includes('let invSwapSel = -1;')) throw new Error('estado de swap ausente');
  // Swap in-place: intercambio por posiciones, preserva longitud y compacidad.
  if (!g.includes('inventory[invSwapSel] = inventory[i];')) throw new Error('swap ausente');
  // El move-a-vacío fue retirado: creaba UI que prometía posiciones que el
  // array compacto no conserva (elegías slot 5 y el arma caía en slot 3).
  if (g.includes('inventory.splice(invSwapSel, 1)[0]')) throw new Error('mover a slot vacio sigue presente');
  if (g.includes("slot.title = 'Mover el arma seleccionada aquí'")) throw new Error('UI de move a vacío sigue presente');
  if (!g.includes('invSwapSel = -1;') || (g.match(/invSwapSel = -1;/g) || []).length < 4) throw new Error('reset de swap incompleto');
});

t('modelo compacto: slot visual N == inventory[N-1], vacíos sólo al final, sin sparse', () => {
  // El render itera exactamente INVENTORY_SLOTS y deriva "vacío" de i >= inventory.length.
  if (!g.includes('for (let i = 0; i < INVENTORY_SLOTS; i++)')) throw new Error('render de slots ausente');
  if (!g.includes('if (i < inventory.length)')) throw new Error('deriva de vacío ausente');
  if (!g.includes("slot.classList.add('empty')")) throw new Error('clase de slot vacío ausente');
  // La rama de vacíos no muta el inventario (ni listener ni splice).
  const emptyBranch = g.slice(g.indexOf("slot.classList.add('empty')"), g.indexOf('function renderShopConsumableLoadout'));
  if (/addEventListener|splice|inventory\[\w+\] =/.test(emptyBranch)) throw new Error('los vacíos mutan el inventario');
  // La compactación tras venta es splice(i,1): desplaza y no deja huecos.
  if (!g.includes('inventory.splice(i, 1)')) throw new Error('venta no compacta');
  // Ningún índice escribe más allá del final del array (fuente de sparse).
  if (/inventory\[(inventory\.length|\w+\s*\+\s*\d+)\]\s*=/.test(g)) throw new Error('escritura fuera de rango detectada');
});

t('pickup con inventario lleno: NO se auto-equipa (regresión)', () => {
  const sbx = { window: { NV: {} }, console, Math };
  load('js/engine/pickups.js', sbx);
  const NV = sbx.window.NV;
  const inventory = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }, { id: 'e' }, { id: 'f' }];
  const currentWeapon = inventory[0];
  const wps = [{ x: 0, y: 0, weapon: { id: 'rifle', rarity: 'rare' }, dead: false }];
  const r = NV.updateWeaponPickups(0, wps, { x: 0, y: 0 }, inventory, 6, currentWeapon, () => {}, {}, null);
  if (inventory.length !== 6 || r.currentWeapon !== currentWeapon || wps.length !== 1) throw new Error('auto-equipó con inventario lleno');
});

t('fusión: no cambia posiciones ni crea slots fantasma', () => {
  const buy = g.slice(g.indexOf('const invFull = !canFuse'), g.indexOf('NV.consumableList().forEach'));
  if (!buy.includes('weaponFus[w.id] = fus + 1;')) throw new Error('fusión ausente');
  if (buy.includes('inventory.splice') || buy.includes('inventory.push(w) &&')) throw new Error('fusión muta el loadout');
  // Fusión de pickup opera por id antes del flujo de guardado.
  if (!g.includes('function tryWeaponFusion(weapon)') || !g.includes('inventory.some((w) => w.id === weapon.id)')) throw new Error('tryWeaponFusion alterada');
});

t('interfaz del dock documenta el intercambio (sin moves a vacío)', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  if (!html.includes('click en 2 armas para intercambiar')) throw new Error('hint de swap ausente');
  if (html.includes('mover a slot') || html.includes('Mover el arma')) throw new Error('hint promete moves a vacío');
});

console.log('RESULT loadout_slots: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
// Tests de cambio de arma con rueda: ciclo circular por referencia con pistola base incluida.
const fs = require('fs'), vm = require('vm');
let pass = 0, fail = 0;
function t(desc, fn) { try { fn(); pass++; console.log('  ok  ' + desc); } catch (e) { fail++; console.log('  FAIL ' + desc + ' -> ' + e.message); } }
function load(f, sbx) { vm.runInNewContext(fs.readFileSync(f, 'utf8'), sbx, { filename: f }); }

const sbx = { window: { NV: {} }, console, Math };
load('js/data/gameData.js', sbx);
load('js/core/utils.js', sbx);
const NV = sbx.window.NV;
const pistol = NV.starterWeapon(), rifle = NV.WEAPONS[1], smg = NV.WEAPONS[2];
const list = [pistol, rifle, smg];

t('rueda abajo (dir +1): avanza en orden y es circular (última -> primera)', () => {
  if (NV.cycleWeapon(pistol, list, 1) !== rifle) throw new Error('pistol->rifle');
  if (NV.cycleWeapon(rifle, list, 1) !== smg) throw new Error('rifle->smg');
  if (NV.cycleWeapon(smg, list, 1) !== pistol) throw new Error('wrap smg->pistol');
});

t('rueda arriba (dir -1): retrocede circular (primera -> última)', () => {
  if (NV.cycleWeapon(pistol, list, -1) !== smg) throw new Error('wrap pistol->smg');
  if (NV.cycleWeapon(smg, list, -1) !== rifle) throw new Error('smg->rifle');
});

t('devuelve la MISMA instancia del arma (no copia): conserva nivel/rareza', () => {
  const owned = Object.assign({}, rifle); // instancia concreta del inventario
  const l2 = [pistol, owned, smg];
  if (NV.cycleWeapon(pistol, l2, 1) !== owned) throw new Error('no devolvió la instancia del inventario');
  if (NV.cycleWeapon(owned, l2, 1) !== smg) throw new Error('ciclo roto desde instancia propia');
});

t('arma fuera de lista / lista vacía: sin crash', () => {
  if (NV.cycleWeapon(smg, [], -1) !== smg) throw new Error('lista vacía debería devolver current');
  const other = NV.WEAPONS[9];
  if (list.indexOf(NV.cycleWeapon(other, list, -1)) === -1) throw new Error('debería entrar por extremo');
});

t('game.js conecta el listener de wheel', () => {
  const g = fs.readFileSync('js/game.js', 'utf8');
  if (!g.includes("addEventListener('wheel'")) throw new Error('sin listener wheel');
  if (!g.includes('NV.cycleWeapon')) throw new Error('wrapper no usa cycleWeapon');
});

t('arma fusionada (no referenciada en inventario) cicla de forma estable', () => {
  // `fused` es una instancia fusionada que NO está referenciada en `list` (Hipótesis A).
  const fused = Object.assign({}, rifle);
  const inv = [rifle, smg];          // inventario real: rifle es otra referencia distinta
  const gameList = [pistol].concat(inv); // list del wrapper: [pistola base + inventario]
  // contracto del wrapper: si currentWeapon no está en list, normaliza a list[0] (pistola)
  const base = gameList.indexOf(fused) < 0 ? gameList[0] : fused;
  // wheel down (+1) desde la pistola base -> debe entrar al primer inventario, no saltar
  const next = NV.cycleWeapon(base, gameList, 1);
  if (next !== rifle) throw new Error('fallback deberia armar a rifle, got: ' + (next && next.name));
  if (next === fused) throw new Error('ciclo devolvio la instancia fusionada stale');
});

t('arma fusionada + wheel up retrocede circular sin salto inesperado', () => {
  const fused = Object.assign({}, smg);
  const inv = [pistol, rifle]; // smg no está en inventario (fue fusionada)
  const gameList = [pistol].concat(inv);
  const base = gameList.indexOf(fused) < 0 ? gameList[0] : fused;
  const next = NV.cycleWeapon(base, gameList, -1); // desde list[0], -1 -> wrap a ultima
  if (next !== rifle) throw new Error('wheel up desde fallback deberia ir a rifle (ultima del list), got: ' + (next && next.name));
});

t('lista de un solo elemento (solo pistola): ciclo es no-op estable', () => {
  const onlyPistol = [pistol];
  const base = onlyPistol.indexOf(pistol); // 0
  const next = NV.cycleWeapon(onlyPistol[base], onlyPistol, 1);
  if (next !== pistol) throw new Error('lista unitaria no deberia cambiar de arma');
});

t('game.js normaliza currentWeapon con fallback a pistola (fix wheel bug)', () => {
  const g = fs.readFileSync('js/game.js', 'utf8');
  if (!g.includes('list.indexOf(currentWeapon)')) throw new Error('falta normalizacion por indice');
  if (!g.includes('ci < 0 ? 0 : ci')) throw new Error('falta fallback a list[0]');
  if (!g.includes('NV.cycleWeapon(list[base], list, dir)')) throw new Error('no delega a cycleWeapon pura normalizada');
});

console.log('RESULT weapon_wheel: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
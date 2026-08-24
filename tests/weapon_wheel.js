// Tests de cambio de arma con rueda: ciclo circular por referencia con pistola base incluida.
const fs = require('fs'), vm = require('vm');
let pass = 0, fail = 0;
function t(desc, fn) { try { fn(); pass++; console.log('  ok  ' + desc); } catch (e) { fail++; console.log('  FAIL ' + desc + ' -> ' + e.message); } }
function load(f, sbx) { vm.runInNewContext(fs.readFileSync(f, 'utf8'), sbx, { filename: f }); }

const sbx = { window: { NV: {} }, console, Math };
load('js/data/gameData.js', sbx);
load('js/core/utils.js', sbx);
const NV = sbx.window.NV;
const pistol = NV.WEAPONS[0], rifle = NV.WEAPONS[1], smg = NV.WEAPONS[2];
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

console.log('RESULT weapon_wheel: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
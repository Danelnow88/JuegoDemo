// Tests: recoger armas nunca auto-equipa; con inventario lleno el drop queda en el suelo.
const fs = require('fs'), vm = require('vm');
let pass = 0, fail = 0;
function t(desc, fn) { try { fn(); pass++; console.log('  ok  ' + desc); } catch (e) { fail++; console.log('  FAIL ' + desc + ' -> ' + e.message); } }
const sbx = { window: { NV: {} }, console, Math };
vm.runInNewContext(fs.readFileSync('js/engine/pickups.js', 'utf8'), sbx, { filename: 'pickups.js' });
const NV = sbx.window.NV;
function mk(weapon, x, y) { return { weapon, x, y, dead: false }; }
const texts = [], sfx = () => sfx.n++;
sfx.n = 0;

t('inventario CON lugar: guarda y no toca la equipada', () => {
  const inv = [], w = { name: 'Rifle' }, eq = { name: 'Pistola' };
  const r = NV.updateWeaponPickups(0.1, [mk(w, 0, 0)], { x: 0, y: 0 }, inv, 6, eq,
    (x, y, txt) => texts.push(txt), {}, sfx);
  if (inv.length !== 1 || inv[0] !== w) throw new Error('no guardó');
  if (r.currentWeapon !== eq) throw new Error('cambió la equipada');
});

t('inventario LLENO: no equipa, no consume el drop, avisa', () => {
  texts.length = 0; sfx.n = 0;
  const full = [{}, {}, {}, {}, {}, {}];
  const w = { name: 'Sniper' }, wp = mk(w, 0, 0), eq = { name: 'Pistola' };
  const r = NV.updateWeaponPickups(0.1, [wp], { x: 0, y: 0 }, full, 6, eq,
    (x, y, txt) => texts.push(txt), {}, sfx);
  if (r.currentWeapon !== eq) throw new Error('auto-equipó con inventario lleno');
  if (wp.dead) throw new Error('consumió el drop');
  if (full.length !== 6) throw new Error('metió algo al inventario');
  if (!texts.includes('INVENTARIO LLENO')) throw new Error('sin aviso');
  if (sfx.n !== 0) throw new Error('sonó como recogida');
});

t('aviso INVENTARIO LLENO con anti-spam mientras se pisa', () => {
  texts.length = 0;
  const full = [{}, {}, {}, {}, {}, {}];
  const wp = mk({ name: 'X' }, 0, 0);
  for (let i = 0; i < 10; i++) NV.updateWeaponPickups(0.1, [wp], { x: 0, y: 0 }, full, 6, {},
    (x, y, txt) => texts.push(txt), {}, sfx);
  const n = texts.filter((t2) => t2 === 'INVENTARIO LLENO').length;
  if (n > 1) throw new Error('spameó ' + n + ' avisos');
});

t('al liberar espacio vuelve a recogerse normalmente', () => {
  const inv = [], w = { name: 'Y' }, wp = mk(w, 0, 0);
  NV.updateWeaponPickups(0.1, [wp], { x: 0, y: 0 }, inv, 6, {}, () => {}, {}, sfx); // lleno
  NV.updateWeaponPickups(0.1, [wp], { x: 0, y: 0 }, inv, 6, {}, () => {}, {}, sfx); // aún lleno
  const r = NV.updateWeaponPickups(0.1, [wp], { x: 0, y: 0 }, [], 6, {}, () => {}, {}, sfx); // espacio
  if (!wp.dead || inv[0] !== w || !r.weaponPickups.every((p) => p.dead)) throw new Error('no se recogió tras liberar');
});

console.log('RESULT weapon_pickup: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
// Tests C1: cofre del jefe — al tocarlo suelta 1-3 pickups, no rompe otros flujos.
const fs = require('fs'), vm = require('vm');
let pass = 0, fail = 0;
function t(desc, fn) { try { fn(); pass++; console.log('  ok  ' + desc); } catch (e) { fail++; console.log('  FAIL ' + desc + ' -> ' + e.message); } }
const sbx = { window: { NV: {} }, console, Math };
vm.runInNewContext(fs.readFileSync('js/engine/pickups.js', 'utf8'), sbx, { filename: 'pickups.js' });
const NV = sbx.window.NV;

t('updateBossChests existe', () => {
  if (typeof NV.updateBossChests !== 'function') throw new Error('ausente');
});

// Mock de Math.random controlado para verificar 1-3 consistencia.
let rndVal = 0.5;
const rm = { random: () => rndVal, floor: Math.floor, hypot: Math.hypot, min: Math.min };
const sbx2 = { window: { NV: {} }, console, Math: rm };
vm.runInNewContext(fs.readFileSync('js/engine/pickups.js', 'utf8'), sbx2, { filename: 'pickups.js' });
const NV2 = sbx2.window.NV;

t('al tocar el cofre suelta entre 1 y 3 pickups (aquí: 2 shards)', () => {
  rndVal = 0.5; // n = 1 + floor(0.5*3) = 1 + floor(1.5) = 2 ; tipo: 0.5 < 0.55 => shard
  const chests = [{ x: 0, y: 0, dead: false, timer: 0 }];
  const pickups = []; const wp = [];
  const alive = NV2.updateBossChests(0.1, chests, { x: 0, y: 0 }, pickups, wp, [{ id: 'w1' }], () => {}, () => {});
  if (alive.length !== 0) throw new Error('no se descartó el cofre abierto: ' + alive.length);
  if (pickups.length !== 2 || pickups[0].value < 3) throw new Error('esperaba 2 shards, got p=' + pickups.length);
});

t('cofre lejos no se abre', () => {
  rndVal = 0.7;
  const chests = [{ x: 100, y: 100, dead: false, timer: 0 }];
  const pickups = []; const wp = [];
  const alive = NV2.updateBossChests(0.1, chests, { x: 0, y: 0 }, pickups, wp, [], () => {}, () => {});
  if (alive.length !== 1) throw new Error('debería seguir vivo: ' + alive.length);
  if (pickups.length !== 0) throw new Error('no debería liberar');
});

t('cofre cercano a veces suelta arma (tipo >= 0.55)', () => {
  rndVal = 0.99; // n = 1+floor(0.99*3)=3 ; 0.99>=0.55 -> arma
  const chests = [{ x: 0, y: 0, dead: false, timer: 0 }];
  const pickups = []; const wp = [];
  NV2.updateBossChests(0.1, chests, { x: 0, y: 0 }, pickups, wp, [{ id: 'w1' }], () => {}, () => {});
  if (wp.length !== 3) throw new Error('esperaba 3 armas, got ' + wp.length);
});

t('cofre expira tras TTL (lejos, pasa tiempo)', () => {
  const chests = [{ x: 500, y: 500, dead: false, timer: 0 }];
  let alive = chests;
  for (let i = 0; i < 310; i++) alive = NV.updateBossChests(0.1, alive, { x: 0, y: 0 }, [], [], [], () => {}, () => {});
  if (alive.length !== 0) throw new Error('no expiró');
});

t('game.js conecta: updateBossChests + spawnBossChest + render', () => {
  const g = fs.readFileSync('js/game.js', 'utf8');
  for (const pat of ['function spawnBossChest', 'NV.updateBossChests(', 'bossChests.push', 'for (const c of bossChests)']) {
    if (!g.includes(pat)) throw new Error('falta: ' + pat);
  }
});

t('boss.js invoca spawnBossChest al morir', () => {
  if (!fs.readFileSync('js/engine/boss.js', 'utf8').includes('spawnBossChest')) throw new Error('no conectado');
});

console.log('RESULT boss_chest: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
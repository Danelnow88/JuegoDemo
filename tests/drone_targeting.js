// Tests de targeting de drones (ENJAMBRE): rango 300, prioridad cercano-al-jugador, incluye jefe.
const fs = require('fs'), vm = require('vm');
const sbx = { window: { NV: {} }, console, Math };
vm.runInNewContext(fs.readFileSync('js/engine/drones.js', 'utf8'), sbx);
const NV = sbx.window.NV;
let pass = 0, fail = 0;
function t(desc, fn) { try { fn(); pass++; console.log('  ok  ' + desc); } catch (e) { fail++; console.log('  FAIL ' + desc + ' -> ' + e.message); } }

t('dron dispara a enemigo a ~250px (antes imposible: solo órbita 55)', () => {
  const player = { x: 400, y: 300 };
  const farEnemy = { x: 620, y: 320, dead: false };
  const drones = [{ angle: 0, speed: 2, orbitRadius: 55, fireTimer: 0, life: 5 }];
  const bullets = [];
  NV.updateDrones(0.01, drones, player, bullets, 50, [farEnemy], null, 300);
  if (bullets.length === 0) throw new Error('no disparó a enemigo en rango');
});

t('ignora enemigo fuera de 300px (dispara a su ángulo, sin línea de puntería)', () => {
  const player = { x: 400, y: 300 };
  const tooFar = { x: 900, y: 900, dead: false };
  const drones = [{ angle: Math.PI / 4, speed: 2, orbitRadius: 55, fireTimer: 0, life: 5 }];
  const bullets = [];
  NV.updateDrones(0.01, drones, player, bullets, 50, [tooFar], null, 300);
  if (bullets.length !== 1) throw new Error('debería mantener comportamiento previo (dispara al ángulo orbital)');
  if (drones[0].tx != null || drones[0].ty != null) throw new Error('seteó puntería a un target fuera de rango');
});

t('puede targetear al jefe si es lo más cercano', () => {
  const player = { x: 400, y: 300 };
  const boss = { x: 500, y: 310, dead: false };
  const drones = [{ angle: 0, speed: 2, orbitRadius: 55, fireTimer: 0, life: 5 }];
  const bullets = [];
  NV.updateDrones(0.01, drones, player, bullets, 50, [], boss, 300);
  if (drones[0].tx !== boss.x || drones[0].ty !== boss.y) throw new Error('no apuntó al jefe');
  if (!drones[0].aimLife > 0 && drones[0].aimLife !== undefined) throw new Error('sin aimLife VFX');
});

t('elige el enemigo más cercano al jugador entre varios', () => {
  const player = { x: 400, y: 300 };
  const near = { x: 450, y: 300, dead: false };   // 50px
  const farther = { x: 600, y: 300, dead: false }; // 200px
  const drones = [{ angle: 0, speed: 2, orbitRadius: 55, fireTimer: 0, life: 5 }];
  NV.updateDrones(0.01, drones, player, [], 50, [farther, near], null, 300);
  if (drones[0].tx !== near.x) throw new Error('apuntó al incorrecto');
});

console.log('RESULT drone_targeting: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
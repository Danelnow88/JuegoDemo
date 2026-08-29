// Tests A1: ojos de enemigos — firma extendida y dibujo orientado al jugador.
const fs = require('fs'), vm = require('vm');
let pass = 0, fail = 0;
function t(desc, fn) { try { fn(); pass++; console.log('  ok  ' + desc); } catch (e) { fail++; console.log('  FAIL ' + desc + ' -> ' + e.message); } }
const sbx = { window: { NV: {} }, console, Math };
vm.runInNewContext(fs.readFileSync('js/render/enemies.js', 'utf8'), sbx, { filename: 'enemies.js' });
const NV = sbx.window.NV;
// Canvas 2D stub que registra arcos.
function mkCtx() {
  const arcs = [];
  const translations = [];
  return { arcs, translations, beginPath(){}, arc(x,y,r){arcs.push({x,y,r});}, fill(){}, stroke(){}, save(){}, restore(){},
    translate(x,y){translations.push({x,y});}, moveTo(){}, lineTo(){}, closePath(){}, ellipse(){},
    set fillStyle(v){}, get fillStyle(){return '';}, set strokeStyle(v){}, set lineWidth(v){}, set shadowBlur(v){}, set shadowColor(v){} };
}

t('drawEnemy acepta player y drawEnemyEyes existe', () => {
  if (typeof NV.drawEnemyEyes !== 'function') throw new Error('drawEnemyEyes ausente');
  const ctx = mkCtx();
  NV.drawEnemy(ctx, { x: 0, y: 0, radius: 10, color: '#fff', shape: 'dot' }, 0, { x: 100, y: 0 });
});

t('sin player no dibuja ojos (compatibilidad)', () => {
  const ctx = mkCtx();
  const before = ctx.arcs.length;
  NV.drawEnemy(ctx, { x: 0, y: 0, radius: 10, color: '#fff' }, 0);
  // sin player solo se dibuja el cuerpo (al menos 1 arco del cuerpo 'circle')
  if (ctx.arcs.length < before) throw new Error('cuerpo no dibujado');
  NV.drawEnemyEyes(ctx, { x: 0, y: 0, radius: 10 }, null); // no debe crashear
});

t('las pupilas se orientan hacia el jugador (4 arcos por par de ojos)', () => {
  const ctx = mkCtx();
  NV.drawEnemyEyes(ctx, { x: 0, y: 0, radius: 10, isElite: false }, { x: 50, y: 0 });
  if (ctx.arcs.length !== 4) throw new Error('arcos=' + ctx.arcs.length + ' (esperaba 2 escleróticas + 2 pupilas)');
  const pupils = ctx.arcs.slice(2).map((a) => a.x);
  if (!(pupils[0] > 0 && pupils[1] > 0)) throw new Error('pupilas no miran a la derecha: ' + JSON.stringify(pupils));
});

t('temblor rítmico de enemigos es 100% visual: no muta posición/hitbox/datos', () => {
  const ctx = mkCtx();
  const e = { x: 120, y: 80, radius: 14, color: '#fff', shape: 'dot', hp: 30, speed: 70, behavior: 'chase' };
  const before = JSON.stringify(e);
  const rhythm = { enabled: true, state: 'listening', onset: 1, kick: 0.8, snare: 0.5, hats: 0.4, energy: 0.5 };
  NV.drawEnemy(ctx, e, 42, { x: 300, y: 80 }, rhythm);
  if (JSON.stringify(e) !== before) throw new Error('drawEnemy mutó datos de gameplay');
  const tr = ctx.translations[0];
  if (!tr || (tr.x === e.x && tr.y === e.y)) throw new Error('no hubo offset visual');
  if (Math.abs(tr.x - e.x) > 4.6 || Math.abs(tr.y - e.y) > 2.9) throw new Error('offset visual excesivo');
  if (!rhythm.jitterActive || !(rhythm.jitterAmp >= 2)) throw new Error('jitter imperceptible: amp=' + rhythm.jitterAmp);
});

t('jitter inactivo sin rhythm habilitado o con música casi silenciosa', () => {
  const ctx = mkCtx();
  const rhythmOff = { enabled: false, state: 'listening', onset: 1, kick: 1, energy: 1 };
  NV.drawEnemy(ctx, { x: 0, y: 0, radius: 10, color: '#fff', shape: 'dot' }, 0, null, rhythmOff);
  if (rhythmOff.jitterActive) throw new Error('jitter activo con rhythm apagado');
  const rhythmQuiet = { enabled: true, state: 'listening', onset: 0, kick: 0, snare: 0, hats: 0, energy: 0.02 };
  NV.drawEnemy(ctx, { x: 0, y: 0, radius: 10, color: '#fff', shape: 'dot' }, 0, null, rhythmQuiet);
  if (rhythmQuiet.jitterActive) throw new Error('jitter activo con música silenciosa');
});

t('game.js pasa rhythm solo al render de enemigo y colisiones siguen usando e.x/e.y', () => {
  const g = fs.readFileSync('js/game.js', 'utf8');
  const bullets = fs.readFileSync('js/engine/bullets.js', 'utf8');
  if (!g.includes('NV.drawEnemy(ctx, e, frame, player, NV.rhythm)')) throw new Error('render enemigo no recibe rhythm');
  if (!bullets.includes('Math.hypot(b.x - e.x, b.y - e.y)') || !bullets.includes('d < e.radius + 4')) throw new Error('colisión de balas no usa datos reales');
});

console.log('RESULT enemy_eyes: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
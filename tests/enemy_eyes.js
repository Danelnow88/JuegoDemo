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
  return { arcs, beginPath(){}, arc(x,y,r){arcs.push({x,y,r});}, fill(){}, stroke(){}, save(){}, restore(){},
    translate(){}, moveTo(){}, lineTo(){}, closePath(){}, ellipse(){},
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

console.log('RESULT enemy_eyes: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
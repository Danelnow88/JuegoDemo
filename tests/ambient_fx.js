// Tests A3: starfield con parallax (puro, determinista) + polvo de slide conectado.
const fs = require('fs'), vm = require('vm');
let pass = 0, fail = 0;
function t(desc, fn) { try { fn(); pass++; console.log('  ok  ' + desc); } catch (e) { fail++; console.log('  FAIL ' + desc + ' -> ' + e.message); } }
function mkCtx() { return { arcs: [], beginPath(){}, arc(x,y){this.arcs.push([x,y]);}, fill(){},
  set globalAlpha(v){ this.a=v; }, get globalAlpha(){ return this.a; }, set fillStyle(v){} }; }

const sbx = {}; sbx.window = { NV: {} }; sbx.console = console; sbx.Math = Math; sbx.document = { getElementById: () => ({ getContext: () => mkCtx() }) };
vm.createContext(sbx);
vm.runInContext(fs.readFileSync('js/render/canvas.js', 'utf8'), sbx);
const NV = sbx.window.NV;

t('drawStarfield existe y dibuja sin crash', () => {
  if (typeof NV.drawStarfield !== 'function') throw new Error('ausente');
  const ctx = mkCtx();
  NV.drawStarfield(ctx, 800, 600, 0, 400, 300);
  if (ctx.arcs.length < 50) throw new Error('muy pocas estrellas: ' + ctx.arcs.length);
});

t('determinista: misma entrada => mismas posiciones', () => {
  const a = mkCtx(), b = mkCtx();
  NV.drawStarfield(a, 800, 600, 10, 0, 0);
  NV.drawStarfield(b, 800, 600, 10, 0, 0);
  if (JSON.stringify(a.arcs) !== JSON.stringify(b.arcs)) throw new Error('no determinista');
});

t('parallax: capas se desplazan a distinta velocidad', () => {
  const a = mkCtx(), b = mkCtx();
  NV.drawStarfield(a, 800, 600, 5, 100, 100);
  NV.drawStarfield(b, 800, 600, 5, 200, 200);
  const deltas = new Set();
  for (let i = 0; i < a.arcs.length; i++) {
    if (a.arcs[i][0] !== b.arcs[i][0]) deltas.add(Math.abs(a.arcs[i][0] - b.arcs[i][0]).toFixed(2));
  }
  // Con 3 capas de profundidad esperamos al menos 2 magnitudes de desplazamiento distintas.
  if (deltas.size < 2) throw new Error('capas sin diferenciación: ' + [...deltas].join(','));
});

t('game.js dibuja el starfield con la posición del jugador', () => {
  const g = fs.readFileSync('js/game.js', 'utf8');
  if (!g.includes('NV.drawStarfield(ctx, W, H, frame, player.x, player.y)')) throw new Error('no conectado');
  if (!g.includes("spawnExplosion(player.x - (player.moveVx || 0)")) throw new Error('polvo de slide ausente');
});

console.log('RESULT ambient_fx: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
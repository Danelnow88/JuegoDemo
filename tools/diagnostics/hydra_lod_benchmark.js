// Benchmark headless de operaciones Canvas2D para la familia visual RB6/Hidra.
// No mide FPS real: compara unidades raster ponderadas y operaciones de dibujo.
const fs = require('fs'), vm = require('vm');

function costCtx() {
  const c = { units: 0, paths: 0, segs: 0, arcs: 0, fills: 0, strokes: 0, shadowOps: 0, _blur: 0, _pts: 0 };
  c.save = c.restore = c.translate = c.rotate = c.scale = c.setLineDash = function () {};
  c.beginPath = function () { c.paths++; c._pts = 0; };
  c.closePath = function () {};
  c.moveTo = function () { c._pts++; };
  c.lineTo = c.bezierCurveTo = c.quadraticCurveTo = function () { c.segs++; c._pts++; };
  c.arc = c.ellipse = function () { c.arcs++; c._pts += 2; };
  c.fill = function () { c.fills++; if (c._blur) c.shadowOps++; c.units += 1 + c._blur / 4 + c._pts * .02; };
  c.stroke = function () { c.strokes++; if (c._blur) c.shadowOps++; c.units += 1 + c._blur / 4 + c._pts * .02; };
  c.fillRect = function () { c.units += .5; };
  c.strokeRect = function () { c.units += 1; };
  c.fillText = function () { c.units += 2; };
  c.createRadialGradient = c.createLinearGradient = function () { return { addColorStop() {} }; };
  Object.defineProperty(c, 'shadowBlur', { get(){ return c._blur; }, set(v){ c._blur = Math.max(0, v || 0); } });
  for (const prop of ['shadowColor','fillStyle','strokeStyle','globalAlpha','globalCompositeOperation','lineWidth','lineCap','lineJoin']) Object.defineProperty(c, prop, { get(){ return ''; }, set(){} });
  return c;
}
function load(quality) {
  const budget = quality === 'high' ? Infinity : quality === 'auto' ? 7 : 4;
  const NV = { getGraphicsPolicy: () => ({ quality, particles: true, heavyVfx: true, hydraFullBudget: budget }) };
  vm.runInNewContext(fs.readFileSync('js/render/spectralEnemies2D.js', 'utf8'), { window: { NV }, console, Math, Object, Array, WeakSet }, { filename: 'spectralEnemies2D.js' });
  return NV;
}
function run(count, quality) {
  const NV = load(quality);
  const enemies = Array.from({ length: count }, (_, i) => ({ x: 100 + i * 45, y: 150, radius: 18, hp: 100, maxHp: 100, color: i % 2 ? '#ff8c00' : '#67f8c8', visualId: 'elite_base', isElite: true, dead: false }));
  const player = { x: 100, y: 150 };
  NV.prepareEnemyVisualBudget(enemies, player);
  const ctx = costCtx();
  for (let frame = 0; frame < 120; frame++) for (const e of enemies) NV.drawSpectralEnemy2D(ctx, e, frame, player, null);
  const stats = NV.getEnemyVisualBudgetStats();
  return { count, quality, full: stats.full, simplified: stats.simplified, units: ctx.units / 120, paths: ctx.paths / 120, shadowOps: ctx.shadowOps / 120 };
}

console.log('HYDRA_LOD_BENCHMARK (unidades/operaciones por frame; no FPS)');
for (const count of [1, 6, 7, 10, 12]) {
  for (const quality of ['high', 'auto', 'performance']) {
    const r = run(count, quality);
    console.log([r.count, r.quality, 'full=' + r.full, 'simple=' + r.simplified, 'units=' + r.units.toFixed(1), 'paths=' + r.paths.toFixed(0), 'shadowOps=' + r.shadowOps.toFixed(0)].join(' '));
  }
}
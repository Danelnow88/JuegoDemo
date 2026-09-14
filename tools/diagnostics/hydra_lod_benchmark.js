// Benchmark headless de operaciones Canvas2D para la familia visual RB6/Hidra.
// No mide FPS real: compara unidades raster ponderadas y operaciones de dibujo.
const fs = require('fs'), vm = require('vm');

function costCtx() {
  const c = { units: 0, paths: 0, segs: 0, arcs: 0, fills: 0, strokes: 0, shadowFills: 0, shadowStrokes: 0, saves: 0, transforms: 0, gradients: 0, composites: 0, _blur: 0, _pts: 0 };
  c.save = c.restore = function () { c.saves++; };
  c.translate = c.rotate = c.scale = function () { c.transforms++; };
  c.setLineDash = function () {};
  c.beginPath = function () { c.paths++; c._pts = 0; };
  c.closePath = function () {};
  c.moveTo = function () { c._pts++; };
  c.lineTo = c.bezierCurveTo = c.quadraticCurveTo = function () { c.segs++; c._pts++; };
  c.arc = c.ellipse = function () { c.arcs++; c._pts += 2; };
  c.fill = function () { c.fills++; if (c._blur) c.shadowFills++; c.units += 1 + c._blur / 4 + c._pts * .02; };
  c.stroke = function () { c.strokes++; if (c._blur) c.shadowStrokes++; c.units += 1 + c._blur / 4 + c._pts * .02; };
  c.fillRect = function () { c.units += .5; };
  c.strokeRect = function () { c.units += 1; };
  c.fillText = function () { c.units += 2; };
  c.createRadialGradient = c.createLinearGradient = function () { c.gradients++; return { addColorStop() {} }; };
  Object.defineProperty(c, 'shadowBlur', { get(){ return c._blur; }, set(v){ c._blur = Math.max(0, v || 0); } });
  for (const prop of ['shadowColor','fillStyle','strokeStyle','globalAlpha','lineWidth','lineCap','lineJoin']) Object.defineProperty(c, prop, { get(){ return ''; }, set(){} });
  Object.defineProperty(c, 'globalCompositeOperation', { get(){ return ''; }, set(){ c.composites++; } });
  return c;
}
function load(mode) {
  const sbx = { window: { NV: {} }, console, Math, Object, Array, WeakSet, Set, Map, localStorage: { getItem(){ return null; }, setItem(){}, removeItem(){} } };
  for (const file of ['js/core/settings.js', 'js/render/visualBudget.js', 'js/render/spectralEnemies2D.js']) vm.runInNewContext(fs.readFileSync(file, 'utf8'), sbx, { filename: file });
  const NV = sbx.window.NV;
  NV.setGraphicsQuality(mode === 'auto-reduced' ? 'auto' : mode);
  NV.resetVisualBudget();
  if (mode === 'auto-reduced') for (let i = 0; i < 4; i++) NV.updateVisualBudget(40);
  return NV;
}
function run(count, mode) {
  const NV = load(mode);
  const enemies = Array.from({ length: count }, (_, i) => ({ x: 100 + i * 45, y: 150, radius: 18, hp: 100, maxHp: 100, color: i % 2 ? '#ff8c00' : '#67f8c8', visualId: 'elite_base', isElite: true, dead: false }));
  const player = { x: 100, y: 150 };
  NV.prepareEnemyVisualBudget(enemies, player);
  const ctx = costCtx();
  for (let frame = 0; frame < 120; frame++) for (const e of enemies) NV.drawSpectralEnemy2D(ctx, e, frame, player, null);
  const stats = NV.getEnemyVisualBudgetStats();
  const perFrame = (v) => v / 120;
  return { count, mode, full: stats.full, medium: stats.medium || 0, simple: stats.simplified, units: perFrame(ctx.units), paths: perFrame(ctx.paths), fills: perFrame(ctx.fills), strokes: perFrame(ctx.strokes), shadowFills: perFrame(ctx.shadowFills), shadowStrokes: perFrame(ctx.shadowStrokes), shadowOps: perFrame(ctx.shadowFills + ctx.shadowStrokes), arcs: perFrame(ctx.arcs), segs: perFrame(ctx.segs), saves: perFrame(ctx.saves), transforms: perFrame(ctx.transforms), gradients: perFrame(ctx.gradients), composites: perFrame(ctx.composites) };
}

console.log('HYDRA_LOD_BENCHMARK (unidades/operaciones por frame; no FPS)');
for (const count of [1, 2, 4, 6, 7, 10, 12]) {
  for (const mode of ['high', 'auto', 'auto-reduced', 'performance']) {
    const r = run(count, mode);
    console.log([r.count, r.mode, 'full=' + r.full, 'medium=' + r.medium, 'simple=' + r.simple, 'units=' + r.units.toFixed(1), 'paths=' + r.paths.toFixed(0), 'fills=' + r.fills.toFixed(0), 'strokes=' + r.strokes.toFixed(0), 'shadowFills=' + r.shadowFills.toFixed(0), 'shadowStrokes=' + r.shadowStrokes.toFixed(0), 'shadowOps=' + r.shadowOps.toFixed(0), 'arcs=' + r.arcs.toFixed(0), 'segs=' + r.segs.toFixed(0), 'saveRestore=' + r.saves.toFixed(0), 'transforms=' + r.transforms.toFixed(0), 'gradients=' + r.gradients.toFixed(0), 'composites=' + r.composites.toFixed(0)].join(' '));
  }
}
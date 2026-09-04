// ===== Diagnóstico: profiler de coste de animaciones de enemigos (Canvas2D) =====
// Mide, por arquetipo, (a) tiempo CPU real por 1000 llamadas de draw y (b) un
// "coste raster ponderado" que aproxima el coste de GPU de Canvas2D:
//   - stroke con shadowBlur  -> dominant (blur gaussiano por pasada)
//   - fill con shadowBlur    -> caro
//   - fill/stroke con gradiente -> ~3x / ~2x flat
//   - composite 'lighter'    -> x1.5 (read-modify-write)
// Incluye ablations (cap shadowBlur, gradientes planos, blending normal) para
// atribuir el coste por técnica. NO modifica código del juego.
// Uso: node tools/diagnostics/enemy_anim_profiler.js
const fs = require('fs'), vm = require('vm');

// ---------- Mock ctx con contabilidad de coste ----------
function mkCostCtx(abl) {
  abl = abl || {};
  const maxBlur = abl.maxShadowBlur;      // undefined = sin cap
  const noLighter = !!abl.noLighter;      // 'lighter' tratado como normal
  const c = {
    units: 0, ops: {
      strokeFlat: 0, strokeShadow: 0, fillFlat: 0, fillShadow: 0,
      gradRadial: 0, gradLinear: 0, paths: 0, segs: 0, arcs: 0,
      lighterOps: 0, fillText: 0, saveRestore: 0,
    },
    _blur: 0, _style: '', _grad: false, _lighter: false, _pathPts: 0,
  };
  const addStroke = () => {
    const b = maxBlur == null ? c._blur : Math.min(c._blur, maxBlur);
    let u;
    if (b > 0) { c.ops.strokeShadow++; u = 3 + b / 4; }
    else { c.ops.strokeFlat++; u = 1; }
    if (c._grad) u += 1;
    if (c._lighter && !noLighter) { c.ops.lighterOps++; u *= 1.5; }
    c.units += u + c._pathPts * 0.02; c._pathPts = 0;
  };
  const addFill = () => {
    const b = maxBlur == null ? c._blur : Math.min(c._blur, maxBlur);
    let u;
    if (b > 0) { c.ops.fillShadow++; u = 2 + b / 4; }
    else { c.ops.fillFlat++; u = 1; }
    if (c._grad) u += 2;
    if (c._lighter && !noLighter) { c.ops.lighterOps++; u *= 1.5; }
    c.units += u + c._pathPts * 0.02; c._pathPts = 0;
  };
  c.canvas = { width: 900, height: 520 };
  c.save = function () { c.ops.saveRestore++; c.units += 0.02; };
  c.restore = function () { c.ops.saveRestore++; c.units += 0.02; };
  c.beginPath = function () { c.ops.paths++; c._pathPts = 0; };
  c.closePath = function () {};
  c.moveTo = function () { c._pathPts++; };
  c.lineTo = function () { c.ops.segs++; c._pathPts++; };
  c.bezierCurveTo = function () { c.ops.segs++; c._pathPts += 3; };
  c.quadraticCurveTo = function () { c.ops.segs++; c._pathPts += 2; };
  c.arc = function (x, y, r) { c.ops.arcs++; c._pathPts += 2; c._lastR = r; };
  c.ellipse = function () { c.ops.arcs++; c._pathPts += 2; };
  c.rect = function () { c._pathPts += 4; };
  c.fill = function () { addFill(); };
  c.stroke = function () { addStroke(); };
  c.fillRect = function (x, y, w, h) { c.units += (w * h) / 400000 + 0.5; };
  c.strokeRect = function () { c.units += 1; };
  c.fillText = function () { c.ops.fillText++; c.units += 3; };
  c.setLineDash = function () {};
  c.createRadialGradient = function () { c.ops.gradRadial++; c._grad = true; return { addColorStop() {} }; };
  c.createLinearGradient = function () { c.ops.gradLinear++; c._grad = true; return { addColorStop() {} }; };
  c.clearRect = function () {};
  Object.defineProperty(c, 'shadowBlur', {
    get() { return c._blur; },
    set(v) { c._blur = Math.max(0, v || 0); },
  });
  Object.defineProperty(c, 'shadowColor', { set() {}, get() { return ''; } });
  Object.defineProperty(c, 'fillStyle', { set(v) { c._style = v; c._grad = false; }, get() { return c._style; } });
  Object.defineProperty(c, 'strokeStyle', { set(v) { c._style = v; c._grad = false; }, get() { return c._style; } });
  Object.defineProperty(c, 'globalAlpha', { set() {}, get() { return 1; } });
  Object.defineProperty(c, 'globalCompositeOperation', {
    set(v) { c._lighter = v === 'lighter'; }, get() { return c._lighter ? 'lighter' : 'source-over'; },
  });
  c.translate = function () {}; c.rotate = function () {}; c.scale = function () {};
  c.setTransform = function () {};
  return c;
}

// ---------- Carga del módulo igual que los tests ----------
const sbx = {
  window: { NV: { state: { player: { x: 450, y: 260 } } } },
  console, Math,
};
vm.runInNewContext(fs.readFileSync('js/render/spectralEnemies2D.js', 'utf8'), sbx, { filename: 'spectralEnemies2D.js' });
const NV = sbx.window.NV;
const rhythmOn = { enabled: true, state: 'listening', onset: 0.9, kick: 0.8, bass: 0.7, mids: 0.4, highs: 0.3, hats: 0.4, snare: 0.5, energy: 0.6 };
const player = { x: 450, y: 260 };

function mkEnemy(type, extra) {
  return Object.assign({
    x: 100 + Math.random() * 700, y: 60 + Math.random() * 400,
    radius: 12, color: '#fff', shape: 'circle', enemyTypeId: type,
    visualId: type, dead: false, isElite: false,
  }, extra || {});
}

const GROUPS = {
  basicos: ['drone', 'runner', 'tank', 'shielder', 'swarmlet', 'spitter', 'wisp', 'kamikaze', 'boss_minion'],
  'espectros-lab': ['specter_grunt', 'specter_archer', 'specter_guard'],
  'elites-no-espectrales': ['elite_base', 'elite_velocity', 'elite_bulwark', 'elite_titan'],
  'elites-espectrales': ['specter_elite_swift', 'specter_elite_wrath', 'specter_elite_void'],
};

function measure(types, frames, ablation) {
  const enemies = types.map((ty) => mkEnemy(ty, ty.indexOf('elite') !== -1 ? { isElite: true } : {}));
  const ctx = mkCostCtx(ablation);
  const t0 = process.hrtime.bigint();
  for (let f = 0; f < frames; f++) {
    for (const e of enemies) NV.drawSpectralEnemy2D(ctx, e, f, player, rhythmOn);
  }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6 / frames;
  return { msPerEnemy: ms / enemies.length, ctx };
}

console.log('==== PROFILER ANIMACIONES ENEMIGOS (headless, coste raster ponderado) ====\n');

const perCall = [];
for (const types of Object.values(GROUPS)) {
  for (const ty of types) {
    const r = measure([ty], 200, null);
    perCall.push({ ty, units: r.ctx.units / 200, ms: r.msPerEnemy * 1000, ops: r.ctx.ops });
  }
}
{
  const boss = { x: 450, y: 200, radius: 40, hp: 100, maxHp: 100, dead: false, name: 'JEFE', phase2: false };
  const ctx = mkCostCtx(null);
  for (let f = 0; f < 200; f++) NV.drawSpectralBoss2D(ctx, boss, f, player, rhythmOn);
  perCall.push({ ty: 'boss (drawSpectralBoss2D)', units: ctx.units / 200, ms: 0, ops: ctx.ops });
}

function scaleOps(ops, n) {
  const out = {};
  for (const k of Object.keys(ops)) out[k] = ops[k] / n;
  return out;
}

perCall.sort((a, b) => b.units - a.units);
console.log('--- Coste raster por enemigo (1 frame), ordenado (ops promediadas por llamada) ---');
console.log('tipo'.padEnd(30), 'unid'.padStart(6), 'strSh'.padStart(6), 'filSh'.padStart(6), 'grad'.padStart(5), 'light'.padStart(6), 'segs'.padStart(6));
for (const p of perCall) {
  const o = scaleOps(p.ops, 200);
  console.log(
    p.ty.padEnd(30), p.units.toFixed(1).padStart(6),
    o.strokeShadow.toFixed(1).padStart(6), o.fillShadow.toFixed(1).padStart(6),
    (o.gradRadial + o.gradLinear).toFixed(1).padStart(5),
    o.lighterOps.toFixed(1).padStart(6), o.segs.toFixed(0).padStart(6)
  );
}

console.log('\n--- Tiempo CPU por 1000 llamadas (JS puro con mock ctx) ---');
for (const p of perCall) if (p.ms > 0) console.log(p.ty.padEnd(30), p.ms.toFixed(2).padStart(8) + ' ms');

// ---------- Escenario de carga: 80 enemigos con mezcla ponderada ----------
console.log('\n--- Escenario de carga: 80 enemigos, mezcla ponderada de oleada avanzada ---');
const WAVEMIX = [
  ['drone', 0.10], ['runner', 0.10], ['tank', 0.08], ['shielder', 0.07], ['swarmlet', 0.09],
  ['spitter', 0.08], ['wisp', 0.06], ['kamikaze', 0.07], ['boss_minion', 0.03],
  ['specter_grunt', 0.15], ['specter_archer', 0.12], ['specter_guard', 0.10],
];
function buildMix(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    let r = Math.random(), acc = 0, pick = WAVEMIX[0][0];
    for (const [ty, w] of WAVEMIX) { acc += w; if (r <= acc) { pick = ty; break; } }
    out.push(mkEnemy(pick));
  }
  out[0] = mkEnemy('elite_base', { isElite: true, radius: 20 });
  out[1] = mkEnemy('specter_elite_void', { isElite: true, radius: 18 });
  return out;
}
function measureMix(abl) {
  const enemies = buildMix(80);
  const ctx = mkCostCtx(abl);
  const t0 = process.hrtime.bigint();
  for (let f = 0; f < 100; f++) for (const e of enemies) NV.drawSpectralEnemy2D(ctx, e, f, player, rhythmOn);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6 / 100;
  return { ctx, ms };
}
const base = measureMix(null);
const basePerFrame = base.ctx.units / 100; // 100 frames
console.log('Total/frame: ' + basePerFrame.toFixed(0) + ' unidades raster | CPU: ' + base.ms.toFixed(3) + ' ms/frame (JS)');
const ablBlur = measureMix({ maxShadowBlur: 0 });
const ablLighter = measureMix({ noLighter: true });
console.log('Ablation shadowBlur=0   -> ' + (100 * (1 - ablBlur.ctx.units / base.ctx.units)).toFixed(1) + '% del coste raster viene de shadowBlur');
console.log('Ablation blending normal -> ' + (100 * (1 - ablLighter.ctx.units / base.ctx.units)).toFixed(1) + '% viene de composite lighter');

const byType = {};
for (const p of perCall) byType[p.ty] = p.units;
const share = {};
for (const e of buildMix(80)) share[e.visualId] = (share[e.visualId] || 0) + (byType[e.visualId] || 0);
console.log('\n--- Share del coste raster por tipo en la mezcla de 80 (estimado por coste unitario) ---');
Object.entries(share).sort((a, b) => b[1] - a[1]).forEach(([ty, u]) => {
  console.log(ty.padEnd(24), u.toFixed(0).padStart(6) + ' u', (100 * u / basePerFrame).toFixed(1) + '%');
});

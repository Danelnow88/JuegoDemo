const fs = require('fs'), vm = require('vm');
let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; console.log('  ok  ' + name); } catch (e) { fail++; console.log('  FAIL ' + name + ' -> ' + e.message); } }
function setup(quality, overload) {
  const sb = { window: { NV: {} }, console, Math, Object, Array, WeakSet, Set, Map, localStorage: { getItem(){ return null; }, setItem(){}, removeItem(){} } };
  for (const f of ['js/core/settings.js', 'js/render/visualBudget.js', 'js/render/spectralEnemies2D.js']) vm.runInNewContext(fs.readFileSync(f, 'utf8'), sb, { filename: f });
  sb.window.NV.setGraphicsQuality(quality); sb.window.NV.resetVisualBudget();
  for (let i = 0; i < (overload || 0); i++) sb.window.NV.updateVisualBudget(40);
  return sb.window.NV;
}
function enemy(i, x) { return { x: x == null ? 100 + i * 30 : x, y: 100, radius: 18, hp: 100, maxHp: 100, color: '#a1b2c3', visualId: 'elite_base', isElite: true, dead: false, hitFlash: 0, atkFlash: 0 }; }
function ctx() { const calls = { paths: 0, fills: 0, strokes: 0, arcs: 0, colors: [] }; return new Proxy({ calls }, { get(o, k) { if (k === 'calls') return calls; if (k === 'beginPath') return () => calls.paths++; if (k === 'fill') return () => calls.fills++; if (k === 'stroke') return () => calls.strokes++; if (k === 'arc') return () => calls.arcs++; if (k === 'createRadialGradient' || k === 'createLinearGradient') return () => ({ addColorStop() {} }); return () => {}; }, set(o, k, v) { if (k === 'fillStyle' || k === 'strokeStyle' || k === 'shadowColor') calls.colors.push(String(v)); return true; } }); }
function renderCost(NV, e) { const c = ctx(); NV.drawSpectralEnemy2D(c, e, 30, { x: 450, y: 300 }, null); return c.calls; }
t('High conserva 7 full; Auto 4-7 usa full/medium/simple determinista', () => {
  let NV = setup('high'), es = Array.from({ length: 7 }, (_, i) => enemy(i)); let s = NV.prepareEnemyVisualBudget(es, { x: 100, y: 100 });
  if (s.full !== 7 || s.medium !== 0 || s.simplified !== 0) throw Error(JSON.stringify(s));
  NV = setup('auto'); for (const [n, exp] of [[4,[3,1,0]],[6,[3,2,1]],[7,[3,2,2]]]) { es = Array.from({ length:n }, (_,i)=>enemy(i)); s=NV.prepareEnemyVisualBudget(es,{x:100,y:100}); if ([s.full,s.medium,s.simplified].join() !== exp.join()) throw Error(n+':'+JSON.stringify(s)); }
});
t('Performance degrada de forma acotada y prioriza cercania', () => {
  const NV = setup('performance'), near = enemy(0, 110), mid = enemy(1, 300), far = enemy(2, 800), farther = enemy(3, 850), es = [far, farther, mid, near];
  const snapshot = JSON.stringify(es), s = NV.prepareEnemyVisualBudget(es, { x: 100, y: 100 });
  if ([s.full,s.medium,s.simplified].join() !== '1,1,2') throw Error(JSON.stringify(s));
  if (!(renderCost(NV, near).arcs > renderCost(NV, far).arcs)) throw Error('cercana no recibe mas detalle');
  if (JSON.stringify(es) !== snapshot) throw Error('mutacion de gameplay');
});
t('FULL/MEDIUM/SIMPLE conservan color, cuatro lobulos/ojos y radio', () => {
  const NV = setup('auto'), es = Array.from({ length: 7 }, (_, i) => enemy(i)), radii = es.map(e => e.radius); NV.prepareEnemyVisualBudget(es, { x: 100, y: 100 });
  for (const e of [es[0], es[3], es[6]]) { const c = renderCost(NV, e); if (c.paths < 14 || c.arcs < 9 || !c.colors.includes(e.color)) throw Error(JSON.stringify(c)); }
  if (es.some((e,i) => e.radius !== radii[i])) throw Error('radio alterado');
});
t('particulas Hydra estan agrupadas y caches son acotadas/estaticas', () => {
  const src = fs.readFileSync('js/render/spectralEnemies2D.js','utf8'), body = src.slice(src.indexOf('function drawLiquidParticles'), src.indexOf('function drawHydraSimplified'));
  if ((body.match(/ctx\.fill\(\)/g)||[]).length !== 1 || (body.match(/ctx\.beginPath\(\)/g)||[]).length !== 1) throw Error('particulas no agrupadas');
  if (!src.includes('const BLOB_ANGLE_COUNTS') || /new Map\([^)]*time|cache.*time/i.test(src)) throw Error('cache no acotada');
});
t('feedback y budget conservan contratos de integracion', () => {
  const NV=setup('auto'), e=enemy(0); e.hitFlash=.1; e.atkFlash=.2; e.fusionLevel=2; NV.prepareEnemyVisualBudget([e],{x:0,y:0}); const c=renderCost(NV,e);
  if (c.strokes < 5) throw Error('feedback perdido');
  const game=fs.readFileSync('js/game.js','utf8'); if ((game.match(/NV\.prepareEnemyVisualBudget\(/g)||[]).length !== 1) throw Error('prepare != 1/frame');
});
console.log('RESULT hydra_render_budget: pass=' + pass + ' fail=' + fail);
process.exitCode = fail ? 1 : 0;
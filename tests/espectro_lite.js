// Garantías del módulo WebGL opcional: inerte por defecto y aislado de game.js.
const fs = require('fs'), vm = require('vm');
let pass = 0, fail = 0;
function t(desc, fn) { try { fn(); pass++; console.log('  ok  ' + desc); } catch (e) { fail++; console.log('  FAIL ' + desc + ' -> ' + e.message); } }

function load() {
  const NV = {};
  const sbx = { window: { NV }, console, Math };
  vm.runInNewContext(fs.readFileSync('js/render/espectroLite.js', 'utf8'), sbx, { filename: 'js/render/espectroLite.js' });
  return NV;
}

t('carga inerte: flag false, sin instancia ni recursos', () => {
  const NV = load();
  if (NV.ESPECTRO_LITE_ACTIVE !== false) throw new Error('flag no inicia false');
  if (NV.espectroLite !== null) throw new Error('se auto-inicializó');
  if (typeof NV.EspectroLite !== 'function') throw new Error('clase no exportada');
});

t('flag false bloquea init y update sin necesitar DOM/Three', () => {
  const NV = load();
  if (NV.initEspectroLite({}, {}) !== null) throw new Error('init activo con flag false');
  if (NV.updateEspectroLite(10, 1) !== false) throw new Error('update activo con flag false');
  if (NV.espectroLite !== null) throw new Error('creó instancia con flag false');
});

t('API pública updateEspectroLite acepta time y beat sin rAF propio', () => {
  const NV = load();
  const src = fs.readFileSync('js/render/espectroLite.js', 'utf8');
  if (typeof NV.updateEspectroLite !== 'function') throw new Error('update ausente');
  if (!src.includes('NV.updateEspectroLite = function (time, beat)')) throw new Error('firma incorrecta');
  if (/requestAnimationFrame/.test(src)) throw new Error('incluye rAF propio');
});

t('geometría mínima visible y brillo aditivo sin post-procesado', () => {
  const src = fs.readFileSync('js/render/espectroLite.js', 'utf8');
  if (!src.includes('new THREE.PlaneGeometry(100, 130)')) throw new Error('no usa plano base visible de 2 triángulos');
  if (!src.includes('THREE.AdditiveBlending')) throw new Error('sin blending aditivo');
  const forbidden = ['Effect' + 'Composer', 'Unreal' + 'BloomPass'];
  for (const name of forbidden) if (src.includes(name)) throw new Error('post-procesado prohibido: ' + name);
});

t('shader lite contiene tinta, lava y ojos frontales', () => {
  const src = fs.readFileSync('js/render/espectroLite.js', 'utf8');
  if (!src.includes('vec3(0.02, 0.02, 0.02)')) throw new Error('sin tinta negra');
  if (!src.includes('vec3(1.0, 0.5, 0.0)')) throw new Error('sin lava naranja');
  if (!src.includes('vec2(0.35, 0.7)') || !src.includes('vec2(0.65, 0.7)')) throw new Error('sin ojos frontales');
  if (!src.includes('vec3(1.0, 0.0, 0.0)')) throw new Error('ojos no son rojo puro');
});

t('escala miniatura permanece entre 0.2 y 0.4', () => {
  const src = fs.readFileSync('js/render/espectroLite.js', 'utf8');
  if (!src.includes('Math.max(0.2, Math.min(0.4')) throw new Error('clamp de escala ausente');
});

t('módulo expone APIs encapsuladas de sincronización y visibilidad', () => {
  const src = fs.readFileSync('js/render/espectroLite.js', 'utf8');
  for (const name of ['syncEnemy(entry, options)', 'removeEnemy(entry)', 'setVisible(visible)', 'clearEnemies()']) {
    if (!src.includes(name)) throw new Error('API ausente: ' + name);
  }
});

t('puente Fase A queda apagado y limitado a seis wisp normales', () => {
  const game = fs.readFileSync('js/game.js', 'utf8');
  if (!game.includes('NV.ESPECTRO_LITE_ACTIVE = false')) throw new Error('flag no inicia apagado');
  if (!game.includes('const MAX_LITE_ENEMIES = 6')) throw new Error('cap no es 6');
  if (!game.includes("e.enemyTypeId === 'wisp'")) throw new Error('selector no usa wisp');
  if (!game.includes('!e.isElite') || !game.includes('!e.dead')) throw new Error('filtros elite/dead ausentes');
  if (!game.includes('import(ESPECTRO_THREE_CDN)')) throw new Error('Three no carga dinámicamente');
});

t('puente conserva fallback Canvas2D y mapea coordenadas lógicas', () => {
  const game = fs.readFileSync('js/game.js', 'utf8');
  if (!game.includes('function isEnemyRenderedByLite(e)')) throw new Error('guard de mesh ausente');
  if (!game.includes('if (isEnemyRenderedByLite(e)) return;')) throw new Error('Canvas2D no usa guard seguro');
  if (!game.includes('x: e.x - W / 2, y: H / 2 - e.y')) throw new Error('mapeo de coordenadas ausente');
  if (!game.includes('if (!lite || !lite.initialized) return;')) throw new Error('fallback durante carga ausente');
});

t('puente oculta WebGL fuera de playing/pausa y no avanza uTime', () => {
  const game = fs.readFileSync('js/game.js', 'utf8');
  const start = game.indexOf('function updateEspectroBridge(dt)');
  const end = game.indexOf('NV.toggleEspectroLite', start);
  const bridge = game.slice(start, end);
  if (!bridge.includes("state !== 'playing' || paused")) throw new Error('guard state/pausa ausente');
  const guard = bridge.indexOf("state !== 'playing' || paused");
  const time = bridge.indexOf('espectroTime += dt');
  if (!(guard >= 0 && time > guard)) throw new Error('uTime puede avanzar durante pausa');
  if (!bridge.includes('NV.espectroLite.setVisible(false)')) throw new Error('no oculta canvas');
});

t('spawn normal conserva id de tipo para selección visual', () => {
  const enemies = fs.readFileSync('js/engine/enemies.js', 'utf8');
  if (!enemies.includes('enemyTypeId: type.id')) throw new Error('metadata enemyTypeId ausente');
});

t('index solo carga la definición antes de game.js', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  const lite = html.indexOf('js/render/espectroLite.js');
  const game = html.indexOf('js/game.js');
  if (lite < 0 || !(lite < game)) throw new Error('carga ausente o tardía');
  if (/ESPECTRO_LITE_ACTIVE\s*=\s*true/.test(html)) throw new Error('HTML auto-activa el módulo');
});

console.log('RESULT espectro_lite: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
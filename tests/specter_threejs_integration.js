// Garantías de migración del renderer espectral: Three.js legacy DEPRECADO.
// specter_lite / specter_core ahora usan 100% Canvas 2D líquido (Visual Lab).
const fs = require('fs');
let pass = 0, fail = 0;

function t(name, fn) {
  try { fn(); console.log('  ok  ' + name); pass++; }
  catch (e) { console.log('  FAIL ' + name + ': ' + e.message); fail++; }
}

const game = fs.readFileSync('js/game.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('css/styles.css', 'utf8');
const lite = fs.readFileSync('js/render/espectroLite.js', 'utf8');
const en = fs.readFileSync('js/render/enemies.js', 'utf8');
const engine = fs.readFileSync('js/engine/enemies.js', 'utf8');
const spectral = fs.readFileSync('js/render/spectralEnemies2D.js', 'utf8');

t('NV.SPECTER_ENABLED existe', () => {
  if (!game.includes('NV.SPECTER_ENABLED')) throw new Error('No existe');
});

t('shouldUseEspectroLite retorna false (Three.js deprecado)', () => {
  const start = game.indexOf('function shouldUseEspectroLite');
  const end = game.indexOf('function', start + 1);
  const bridge = game.slice(start, end);
  if (!bridge.includes('return false')) throw new Error('No retorna false');
});

t('ESPECTRO_LITE_ACTIVE default false (Three.js deprecado)', () => {
  if (!game.includes('NV.ESPECTRO_LITE_ACTIVE = false')) throw new Error('No es false');
});

t('toggleEspectroLite existe', () => {
  if (!game.includes('NV.toggleEspectroLite')) throw new Error('No existe');
});

t('flag false filtra espectros del pool y limpia existentes', () => {
  if (!engine.includes("st.ENEMY_TYPES.filter((t) => t.shape !== 'specter')")) throw new Error('spawn no filtra espectros');
  if (!game.includes("enemies = enemies.filter((e) => e.shape !== 'specter')")) throw new Error('toggle no retira espectros');
});

t('usa #specter-overlay (canvas WebGL deprecado pero presente)', () => {
  if (!game.includes("getElementById('specter-overlay')")) throw new Error('No usa');
});

t('HTML tiene #specter-overlay', () => {
  if (!html.includes('id="specter-overlay"')) throw new Error('No existe');
});

t('CSS tiene .espectro-lite-canvas', () => {
  if (!css.includes('.espectro-lite-canvas')) throw new Error('No existe');
});

t('CSS pointer-events none', () => {
  if (!css.includes('pointer-events: none')) throw new Error('No tiene');
});

t('espectroLite.js tiene EspectroLite class', () => {
  if (!lite.includes('class EspectroLite')) throw new Error('No existe');
});

t('game.js decide si omite el fallback Canvas2D', () => {
  if (!game.includes('isEnemyRenderedByLite(e)) return;')) throw new Error('No usa guard WebGL');
});

t('enemies.js NO tiene debug markers', () => {
  if (en.includes('Marcadores de debug temporales')) throw new Error('Tiene debug');
});

t('espectral renderer mapeo specter_lite -> Model 1 (Crowned Amoeba)', () => {
  if (!spectral.includes('specter_lite: 1')) throw new Error('No mapea a Model 1');
});

t('espectral renderer define renderSpecterLite2D distintivo', () => {
  if (!spectral.includes('function renderSpecterLite2D')) throw new Error('Función ausente');
  if (!spectral.includes('SPECTER_LITE_SCALE')) throw new Error('No usa escala propia');
});

console.log('\nRESULT: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
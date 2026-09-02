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
const preview = fs.readFileSync('previews/espectro-lite-single-preview.html', 'utf8');
const approvedPreview = fs.readFileSync('tests/prueba_espectro_lite.html', 'utf8');

t('NV.SPECTER_ENABLED existe', () => {
  if (!game.includes('NV.SPECTER_ENABLED')) throw new Error('No existe');
});

t('shouldUseEspectroLite detecta specter_lite', () => {
  if (!game.includes("e.enemyTypeId === 'specter_lite'")) throw new Error('No detecta');
});

t('shouldUseEspectroLite detecta specter_core', () => {
  if (!game.includes("e.enemyTypeId === 'specter_core'")) throw new Error('No detecta');
});

t('ESPECTRO_LITE_ACTIVE default true', () => {
  if (!game.includes('NV.ESPECTRO_LITE_ACTIVE = true')) throw new Error('No es true');
});

t('toggleSpecter existe', () => {
  if (!game.includes('NV.toggleSpecter')) throw new Error('No existe');
});

t('flag desactivado excluye espectros del pool y limpia existentes', () => {
  if (!engine.includes("st.ENEMY_TYPES.filter((t) => t.shape !== 'specter')")) throw new Error('spawn no filtra espectros');
  if (!game.includes("enemies = enemies.filter((e) => e.shape !== 'specter')")) throw new Error('toggle no retira espectros');
});

t('usa #specter-overlay', () => {
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

t('usa parámetros exactos del preview aprobado', () => {
  for (const expected of ['const SPECTER_FORM = 0.35', 'const SPECTER_SCALE = 0.4', 'const SPECTER_VARIANT = [1, 0, 0]']) {
    if (!game.includes(expected)) throw new Error('Falta ' + expected);
  }
});

t('preview copiado coincide exactamente con el aprobado', () => {
  if (preview !== approvedPreview) throw new Error('El preview difiere');
});

t('index carga Three.js y publica THREE_READY', () => {
  if (!html.includes("import * as THREE from 'three'") || !html.includes('NV.THREE_READY')) throw new Error('Carga explícita ausente');
});

console.log('\nRESULT: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);

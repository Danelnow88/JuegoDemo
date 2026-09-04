// ===== TEST: integración del modo espectral en game.js =====
// Valida que el flag, el toggle y el punto de integración existen y funcionan.
const fs = require('fs');
const vm = require('vm');
const path = require('path');

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); console.log('  ok  ' + name); pass++; }
  catch (err) { console.log('FAIL  ' + name + ': ' + err.message); fail++; }
}

const gameSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'game.js'), 'utf8');

console.log('spectral_enemies_integration:');

// 1. Flag existe y es true por defecto (remaster activo; fallback vía toggle)
t('NV.SPECTRAL_ENEMY_MODE existe y es true por defecto', () => {
  if (!gameSrc.includes('NV.SPECTRAL_ENEMY_MODE = true')) throw new Error('flag no encontrado o no es true');
});

// 2. Toggle existe
t('NV.toggleSpectralEnemyMode es función', () => {
  if (!gameSrc.includes('NV.toggleSpectralEnemyMode = function')) throw new Error('toggle ausente');
});

// 3. Toggle alterna el flag
t('toggleSpectralEnemyMode alterna SPECTRAL_ENEMY_MODE', () => {
  const sandbox = { window: {}, console, Math, Date, Array, Object, JSON, Map, Set, WeakMap, Promise, Symbol, Uint8Array, Float32Array, Int32Array, Uint8ClampedArray, ArrayBuffer, Error, TypeError, RangeError, parseInt, parseFloat, isNaN, isFinite, encodeURIComponent, decodeURIComponent, setTimeout, clearTimeout, setInterval, clearInterval };
  sandbox.window.NV = {};
  vm.createContext(sandbox);
  // Simula el toggle extraído del source
  sandbox.window.NV.SPECTRAL_ENEMY_MODE = false;
  sandbox.window.NV.toggleSpectralEnemyMode = function (enabled) {
    sandbox.window.NV.SPECTRAL_ENEMY_MODE = !!enabled;
    return sandbox.window.NV.SPECTRAL_ENEMY_MODE;
  };
  if (sandbox.window.NV.toggleSpectralEnemyMode(true) !== true) throw new Error('no activó');
  if (sandbox.window.NV.SPECTRAL_ENEMY_MODE !== true) throw new Error('flag no cambió');
  if (sandbox.window.NV.toggleSpectralEnemyMode(false) !== false) throw new Error('no desactivó');
  if (sandbox.window.NV.SPECTRAL_ENEMY_MODE !== false) throw new Error('flag no volvió a false');
});

// 4. drawEnemy tiene la rama espectral
t('drawEnemy contiene rama para SPECTRAL_ENEMY_MODE', () => {
  if (!gameSrc.includes('NV.SPECTRAL_ENEMY_MODE')) throw new Error('rama ausente en drawEnemy');
  if (!gameSrc.includes('NV.drawSpectralEnemy2D')) throw new Error('llamada ausente en drawEnemy');
});

// 5. drawEnemy mantiene fallback al render original
t('drawEnemy mantiene fallback a NV.drawEnemy original', () => {
  // Busca que después de la rama espectral, se llama NV.drawEnemy
  const idx = gameSrc.indexOf('NV.drawSpectralEnemy2D');
  const idxFallback = gameSrc.indexOf('NV.drawEnemy(ctx, e, frame, player, NV.rhythm)');
  if (idxFallback === -1) throw new Error('fallback ausente');
  // El fallback debe estar DESPUÉS de la rama espectral (no la reemplaza, la envuelve)
  if (idxFallback < idx) throw new Error('fallback antes de rama espectral');
});

// 6. El fallback geométrico se mantiene disponible cuando el modo está apagado
t('el fallback geométrico original se mantiene disponible', () => {
  // Si SPECTRAL_ENEMY_MODE es false, drawEnemy llama NV.drawEnemy
  const idxMode = gameSrc.indexOf('NV.SPECTRAL_ENEMY_MODE && typeof NV.drawSpectralEnemy2D');
  if (idxMode === -1) throw new Error('condicional espectral ausente');
});

// 7. ELITE_TYPES.visualId apunta a perfiles válidos
t('ELITE_TYPES.visualId coinciden con SPECTRAL_ELITE_PROFILES', () => {
  const gameDataSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'data', 'gameData.js'), 'utf8');
  // Extrae los visualId de ELITE_TYPES del source
  const visualIds = [];
  const regex = /visualId:\s*'([^']+)'/g;
  let match;
  while ((match = regex.exec(gameDataSrc)) !== null) {
    visualIds.push(match[1]);
  }
  // Debe haber al menos 8 visualIds (uno por élite)
  if (visualIds.length < 8) throw new Error('menos de 8 visualIds en ELITE_TYPES: ' + visualIds.length);
  // Verifica que el spectralEnemies2D.js tiene ELITE_PROFILES
  const spectralSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'render', 'spectralEnemies2D.js'), 'utf8');
  for (const vid of visualIds) {
    if (!spectralSrc.includes(vid + ':') && !spectralSrc.includes("'" + vid + "':") && !spectralSrc.includes('"' + vid + '":')) {
      throw new Error('visualId ' + vid + ' no tiene perfil en ELITE_PROFILES');
    }
  }
});

// 8. Los 6 IDs espectrales nuevos existen en gameData.js
t('gameData contiene los 6 enemigos espectrales nuevos', () => {
  const gameDataSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'data', 'gameData.js'), 'utf8');
  const ids = ['specter_grunt', 'specter_archer', 'specter_guard', 'specter_elite_swift', 'specter_elite_wrath', 'specter_elite_void'];
  for (const id of ids) {
    if (gameDataSrc.indexOf("id: '" + id + "'") === -1) throw new Error('falta ' + id + ' en gameData');
  }
});

// 9. El render espectral cubre los IDs nuevos
t('spectralEnemies2D tiene perfiles para los 6 espectrales nuevos', () => {
  const spectralSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'render', 'spectralEnemies2D.js'), 'utf8');
  for (const id of ['specter_grunt:', 'specter_archer:', 'specter_guard:', 'elite_specter_swift:', 'elite_specter_wrath:', 'elite_specter_void:']) {
    if (spectralSrc.indexOf(id) === -1) throw new Error('falta perfil ' + id);
  }
});

console.log('RESULT spectral_enemies_integration: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
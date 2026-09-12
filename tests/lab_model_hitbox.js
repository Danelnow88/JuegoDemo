// Hitboxes adaptadas al down-scale líquido: cada tipo con modelo del Visual
// Lab spawnea con radius = radius de datos × (factor del modelo / 0.8 previo),
// de modo que la detección coincida con la silueta dibujada a su nuevo tamaño.
const fs = require('fs'), vm = require('vm');
let pass = 0, fail = 0;
function t(d, fn) { try { fn(); pass++; console.log('  ok  ' + d); } catch (e) { fail++; console.log('  FAIL ' + d + ' -> ' + e.message); } }
function load(f, sbx) { vm.runInNewContext(fs.readFileSync(f, 'utf8'), sbx, { filename: f }); }

const sbx = { window: { NV: {} }, console, Math };
for (const f of ['js/data/balance.js', 'js/data/gameData.js', 'js/render/spectralEnemies2D.js', 'js/engine/enemies.js']) load(f, sbx);
const NV = sbx.window.NV;

function spawnOf(typeId) {
  const out = [];
  NV.spawnEnemy({
    enemies: out, MAX_ENEMIES: 20, boss: null, wave: 25,
    ENEMY_TYPES: NV.ENEMY_TYPES, W: 800, H: 600, waveEvent: null, forceTypeId: typeId,
  });
  return out[0];
}

t('specter_lite (RB2, 0.75): hitbox 12 -> 11.25', () => {
  // Contrato vigente (auditado): la convención del roster es 0-based
  // (modelIndex 0..5 = RB1..RB6, como drawLabSpecterEnemy y labPoseIndex).
  // specter_lite está REMAPEADO a RB2 (Ameba Coronada) junto a specter_grunt;
  // su identidad distintiva es su color de datos (#ff6a24 naranja) heredado
  // como acento del modelo líquido, no su forma. Autoridades: el switch
  // case 1 de drawLabEnemyModel (RB2 - Ameba Coronada), el test
  // specter_threejs_integration (exige el literal specter_lite: 1) y
  // spectral_enemies_render (factores 0-based [0.875, 0.9375, 1, 1, 1.025, 1.0625]).
  // Hitbox = radiusDatos × (factorVisual / 0.8) = 12 × (0.75/0.8) = 11.25:
  // el MISMO ratio que encoge el dibujo (labScale 0.8 -> 0.75), de modo que
  // la detección coincide con la silueta a su nuevo tamaño.
  const e = spawnOf('specter_lite');
  if (!e) throw new Error('no spawneó');
  if (Math.abs(e.radius - 11.25) > 0.01) throw new Error('radius=' + e.radius);
});

t('specter_grunt (RB2, 0.75): hitbox 10 -> 9.375', () => {
  const e = spawnOf('specter_grunt');
  if (Math.abs(e.radius - 9.375) > 0.01) throw new Error('radius=' + e.radius);
});

t('specter_core (RB3, 0.80): hitbox 16 -> 16', () => {
  const e = spawnOf('specter_core');
  if (Math.abs(e.radius - 16) > 0.01) throw new Error('radius=' + e.radius);
});

t('specter_archer (RB4, 0.80): hitbox 12 -> 12', () => {
  const e = spawnOf('specter_archer');
  if (Math.abs(e.radius - 12) > 0.01) throw new Error('radius=' + e.radius);
});

t('specter_guard (RB5, 0.82): hitbox 18 -> 18.45', () => {
  const e = spawnOf('specter_guard');
  if (Math.abs(e.radius - 18.45) > 0.01) throw new Error('radius=' + e.radius);
});

t('spawnElite adapta la hitbox de las élites base (modelo 5, ×1.0625)', () => {
  const out = [];
  NV.spawnElite({
    enemies: out, MAX_ENEMIES: 40, boss: null, wave: 3, waveEvent: null,
    ELITE_TYPES: NV.ELITE_TYPES, W: 800, H: 600,
  });
  if (out.length !== 2) throw new Error('élites=' + out.length);
  // wave 3 -> startIndex 1: RÁPIDO (radius 14) y TANQUE (radius 30), modelo 5.
  if (Math.abs(out[0].radius - 14 * 1.0625) > 0.01) throw new Error('rápido=' + out[0].radius);
  if (Math.abs(out[1].radius - 30 * 1.0625) > 0.01) throw new Error('tanque=' + out[1].radius);
});

t('sin renderer cargado: radio de datos intacto (fallback seguro)', () => {
  const sbx2 = { window: { NV: {} }, console, Math };
  for (const f of ['js/data/balance.js', 'js/data/gameData.js', 'js/engine/enemies.js']) load(f, sbx2);
  const out = [];
  sbx2.window.NV.spawnEnemy({
    enemies: out, MAX_ENEMIES: 20, boss: null, wave: 25,
    ENEMY_TYPES: sbx2.window.NV.ENEMY_TYPES, W: 800, H: 600, waveEvent: null, forceTypeId: 'specter_grunt',
  });
  if (!out[0] || out[0].radius !== 10) throw new Error('radius=' + (out[0] && out[0].radius));
});

t('CONTRATO: hitbox spawn = radiusDatos × labModelHitboxFactor(roster 0-based), ratio = visual/0.8', () => {
  // Documenta el contrato visual/hitbox del Visual Lab: el radio de datos se
  // adapta al spawn con el MISMO ratio que escala el dibujo por modelo
  // (labScale = MODEL_SCALE_FACTORS[poseIdx], antes uniforme 0.8). Autoridad:
  // spectralEnemies2D.js (labPoseIndex + drawLabSpecterEnemy + factores) y
  // spectral_enemies_render.js (factores esperados por índice 0-based).
  const expectedHitbox = {
    specter_lite: 12 * 0.9375,   // RB2 (0.75)
    specter_grunt: 10 * 0.9375,  // RB2 (0.75)
    specter_core: 16 * 1,        // RB3 (0.80)
    specter_archer: 12 * 1,      // RB4 (0.80)
    specter_guard: 18 * 1.025,   // RB5 (0.82)
  };
  for (const [id, expected] of Object.entries(expectedHitbox)) {
    const e = spawnOf(id);
    if (!e) throw new Error(id + ' no spawneó');
    if (Math.abs(e.radius - expected) > 0.01) throw new Error(id + ': radius=' + e.radius + ' esperado=' + expected);
  }
  // Jerarquía de hitboxes preservada: grunt < lite < archer/core < guard.
  const lite = spawnOf('specter_lite'), grunt = spawnOf('specter_grunt'), guard = spawnOf('specter_guard');
  if (!(grunt.radius < lite.radius && lite.radius < guard.radius)) throw new Error('jerarquía invertida');
});

console.log('\nRESULT lab_model_hitbox: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
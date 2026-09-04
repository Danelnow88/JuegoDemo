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

t('specter_lite (RB1, 0.70): hitbox 12 -> 10.5', () => {
  const e = spawnOf('specter_lite');
  if (!e) throw new Error('no spawneó');
  if (Math.abs(e.radius - 10.5) > 0.01) throw new Error('radius=' + e.radius);
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

console.log('\nRESULT lab_model_hitbox: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
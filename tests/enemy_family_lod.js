const fs = require('fs'), vm = require('vm');
let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; console.log('  ok  ' + name); } catch (e) { fail++; console.log('  FAIL ' + name + ' -> ' + e.message); } }

function ctx() {
  const calls = [];
  return {
    calls, save(){}, restore(){}, translate(){}, rotate(){}, scale(){}, beginPath(){ calls.push('path'); }, closePath(){},
    moveTo(){}, lineTo(){ calls.push('seg'); }, bezierCurveTo(){ calls.push('seg'); }, quadraticCurveTo(){ calls.push('seg'); },
    arc(){ calls.push('arc'); }, ellipse(){ calls.push('arc'); }, fill(){ calls.push('fill'); }, stroke(){ calls.push('stroke'); },
    fillRect(){ calls.push('fillRect'); }, strokeRect(){ calls.push('strokeRect'); }, setLineDash(){}, fillText(){},
    createRadialGradient(){ calls.push('gradient'); return { addColorStop(){} }; },
    createLinearGradient(){ calls.push('gradient'); return { addColorStop(){} }; },
  };
}
function load(quality) {
  const NV = {
    getGraphicsPolicy() {
      return { quality, particles: true, heavyVfx: true, hydraFullBudget: quality === 'high' ? Infinity : quality === 'auto' ? 7 : 4 };
    },
  };
  const sbx = { window: { NV }, console, Math, Object, Array, WeakSet };
  vm.runInNewContext(fs.readFileSync('js/render/spectralEnemies2D.js', 'utf8'), sbx, { filename: 'spectralEnemies2D.js' });
  return NV;
}
function hydra(i) {
  return { x: 100 + i * 20, y: 100, radius: 18, hp: 100, maxHp: 100, color: i % 2 ? '#ff8c00' : '#67f8c8', shape: 'hex', visualId: 'elite_base', isElite: true, dead: false };
}

t('familia exacta se identifica por modelo/visualId, no por color', () => {
  const NV = load('auto');
  if (!NV.isHydraEnemyFamily(hydra(0))) throw new Error('elite_base no identificada');
  if (!NV.isHydraEnemyFamily({ ...hydra(1), enemyTypeId: 'specter_elite_void', visualId: 'elite_specter_void' })) throw new Error('élite espectral no identificada');
  if (NV.isHydraEnemyFamily({ ...hydra(2), visualId: null, enemyTypeId: 'spitter', color: '#ff8c00' })) throw new Error('identificó por color');
});

t('Auto conserva 7 full y simplifica overflow sin eliminar entidades', () => {
  const NV = load('auto');
  const enemies = Array.from({ length: 12 }, (_, i) => hydra(i));
  const snapshot = JSON.stringify(enemies);
  const stats = NV.prepareEnemyVisualBudget(enemies, { x: 100, y: 100 });
  if (stats.total !== 12 || stats.full !== 7 || stats.simplified !== 5) throw new Error(JSON.stringify(stats));
  if (enemies.length !== 12 || JSON.stringify(enemies) !== snapshot) throw new Error('LOD mutó gameplay');
});

t('selección full es estable por proximidad, no por color', () => {
  const NV = load('performance');
  const enemies = Array.from({ length: 6 }, (_, i) => hydra(i));
  NV.prepareEnemyVisualBudget(enemies, { x: 100, y: 100 });
  const nearCtx = ctx(), farCtx = ctx();
  NV.drawSpectralEnemy2D(nearCtx, enemies[0], 30, { x: 100, y: 100 }, null);
  NV.drawSpectralEnemy2D(farCtx, enemies[5], 30, { x: 100, y: 100 }, null);
  if (nearCtx.calls.length <= farCtx.calls.length) throw new Error('overflow no redujo detalle');
  if (!farCtx.calls.includes('fill') || !farCtx.calls.includes('stroke')) throw new Error('simplificado invisible');
});

t('Alta mantiene ruta full para todas las instancias', () => {
  const NV = load('high');
  const enemies = Array.from({ length: 12 }, (_, i) => hydra(i));
  const stats = NV.prepareEnemyVisualBudget(enemies, { x: 0, y: 0 });
  if (stats.full !== 12 || stats.simplified !== 0) throw new Error(JSON.stringify(stats));
});

t('hook futuro de spawn no cambia cantidad, HP ni daño', () => {
  const NV = { SPECTER_ENABLED: true, enemyHpScale: () => 1 };
  const sbx = { window: { NV }, console, Math: Object.create(Math), Object, Array, Set, Map };
  sbx.Math.random = () => 0;
  vm.runInNewContext(fs.readFileSync('js/engine/enemies.js', 'utf8'), sbx, { filename: 'enemies.js' });
  const enemies = [], seen = [];
  const type = { id: 'drone', hp: 10, speed: 20, radius: 5, color: '#fff', score: 1, xp: 1, damage: 7, behavior: 'chase' };
  NV.spawnEnemy({ enemies, MAX_ENEMIES: 80, boss: null, wave: 1, ENEMY_TYPES: [type], W: 900, H: 520, onSpawnCandidate: (c) => seen.push(c) });
  if (enemies.length !== 1 || seen.length !== 1) throw new Error('cantidad alterada');
  if (enemies[0].hp !== 10 || enemies[0].damage !== 9) throw new Error('stats alterados');
  if (seen[0].x !== enemies[0].x || seen[0].y !== enemies[0].y) throw new Error('hook no describe spawn real');
});

console.log('RESULT enemy_family_lod: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
// ===== Test del renderer espectral Canvas2D =====
const fs = require('fs'), vm = require('vm');
let pass = 0, fail = 0;
function t(desc, fn) { try { fn(); pass++; console.log('  ok  ' + desc); } catch (e) { fail++; console.log('  FAIL ' + desc + ' -> ' + e.message); } }

function mkCtx() {
  const calls = [];
  const ctx = {
    calls,
    save() { calls.push('save'); },
    restore() { calls.push('restore'); },
    translate(x, y) { calls.push('translate:' + Math.round(x) + ',' + Math.round(y)); },
    rotate() { calls.push('rotate'); },
    scale(x, y) { calls.push('scale'); },
    beginPath() { calls.push('beginPath'); },
    closePath() { calls.push('closePath'); },
    moveTo() {}, lineTo() {}, bezierCurveTo() {}, quadraticCurveTo() {},
    arc() { calls.push('arc'); },
    ellipse() { calls.push('ellipse'); },
    fill() { calls.push('fill'); },
    stroke() { calls.push('stroke'); },
    fillRect() { calls.push('fillRect'); },
    strokeRect() { calls.push('strokeRect'); },
    createRadialGradient() { return { addColorStop() {} }; },
    createLinearGradient() { return { addColorStop() {} }; },
    fillText() { calls.push('fillText'); },
  };
  return ctx;
}

const sbx = {
  window: { NV: { enemyRhythmBand: function(e) { return 'medios'; }, state: { player: { x: 100, y: 100 } } } },
  console, Math,
};
vm.runInNewContext(fs.readFileSync('js/render/spectralEnemies2D.js', 'utf8'), sbx, { filename: 'spectralEnemies2D.js' });
const NV = sbx.window.NV;
const player = { x: 200, y: 200 };

t('NV.drawSpectralEnemy2D es función', () => { if (typeof NV.drawSpectralEnemy2D !== 'function') throw new Error('ausente'); });
t('NV.drawSpectralBoss2D es función', () => { if (typeof NV.drawSpectralBoss2D !== 'function') throw new Error('ausente'); });
t('NV.SPECTRAL_ENEMY_PROFILES expone 12 perfiles', () => { if (Object.keys(NV.SPECTRAL_ENEMY_PROFILES).length !== 12) throw new Error('esperaba 12'); });
t('NV.SPECTRAL_ENEMY_PROFILES expone 12 perfiles base', () => { if (Object.keys(NV.SPECTRAL_ENEMY_PROFILES).length !== 12) throw new Error('esperaba 12'); });

const types = ['drone', 'runner', 'tank', 'shielder', 'swarmlet', 'spitter', 'wisp', 'kamikaze', 'boss_minion', 'specter_grunt', 'specter_archer', 'specter_guard', 'specter_lite', 'specter_core'];
for (const type of types) {
  t('render ' + type + ' sin crash', () => {
    const ctx = mkCtx();
    const enemy = { x: 100, y: 100, radius: 12, color: '#fff', shape: 'circle', enemyTypeId: type, dead: false };
    if (NV.drawSpectralEnemy2D(ctx, enemy, 30, player, null) !== true) throw new Error('esperaba true');
    if (ctx.calls.length < 5) throw new Error('pocos trazos');
  });
}

t('drawSpectralEnemy2D NO muta datos del enemigo', () => {
  const ctx = mkCtx();
  const enemy = { x: 100, y: 100, radius: 12, color: '#fff', shape: 'circle', enemyTypeId: 'drone', dead: false };
  const snapshot = JSON.stringify(enemy);
  NV.drawSpectralEnemy2D(ctx, enemy, 30, player, { enabled: true, state: 'listening', onset: 1, kick: 0.8, bass: 0.9, energy: 0.5 });
  if (JSON.stringify(enemy) !== snapshot) throw new Error('mutó datos de gameplay');
});

t('visual raid boss de los 8 elites NO muta datos', () => {
  const vids = ['elite_base', 'elite_velocity', 'elite_bulwark', 'elite_predator', 'elite_phantom', 'elite_chaos', 'elite_titan', 'elite_swift'];
  for (const vid of vids) {
    const ctx = mkCtx();
    const enemy = { x: 100, y: 100, radius: 20, color: '#ff0', shape: 'hex', enemyTypeId: 'tank', visualId: vid, isElite: true, dead: false };
    const snapshot = JSON.stringify(enemy);
    if (NV.drawSpectralEnemy2D(ctx, enemy, 30, player, { enabled: true, state: 'listening', onset: 1, kick: 0.8, bass: 0.9, energy: 0.5 }) !== true) throw new Error('no renderizo ' + vid);
    if (JSON.stringify(enemy) !== snapshot) throw new Error('muto datos de gameplay en ' + vid);
  }
});
t('visual Lab de los 6 espectrales NO muta datos', () => {
  const ids = ['specter_grunt', 'specter_archer', 'specter_guard', 'specter_elite_swift', 'specter_elite_wrath', 'specter_elite_void'];
  for (const id of ids) {
    const ctx = mkCtx();
    const enemy = { x: 100, y: 100, radius: 12, color: '#fff', shape: 'circle', enemyTypeId: id, visualId: id.replace('specter_elite_', 'elite_specter_'), isElite: id.indexOf('specter_elite_') === 0, dead: false };
    const snapshot = JSON.stringify(enemy);
    if (NV.drawSpectralEnemy2D(ctx, enemy, 30, player, { enabled: true, state: 'listening', onset: 1, kick: 0.8, bass: 0.9, energy: 0.5 }) !== true) throw new Error('no renderizó ' + id);
    if (JSON.stringify(enemy) !== snapshot) throw new Error('mutó datos de gameplay en ' + id);
  }
});

t('specter shape ahora renderiza con la estética del Visual Lab', () => {
  const ctx = mkCtx();
  const enemy = { x: 100, y: 100, radius: 12, color: '#ff6a24', shape: 'specter', enemyTypeId: 'specter_lite', dead: false };
  if (NV.drawSpectralEnemy2D(ctx, enemy, 30, player, null) !== true) throw new Error('esperaba true');
  if (ctx.calls.length < 5) throw new Error('pocos trazos para specter');
});

t('specter_lite y specter_core mapean a los modelos del lab sin mutar datos', () => {
  for (const id of ['specter_lite', 'specter_core']) {
    const ctx = mkCtx();
    const isCore = id === 'specter_core';
    const enemy = { x: 100, y: 100, radius: isCore ? 16 : 12, color: isCore ? '#ff2244' : '#ff6a24', shape: 'specter', enemyTypeId: id, dead: false };
    const snapshot = JSON.stringify(enemy);
    if (NV.drawSpectralEnemy2D(ctx, enemy, 30, player, null) !== true) throw new Error('esperaba true para ' + id);
    if (JSON.stringify(enemy) !== snapshot) throw new Error('mutó datos en ' + id);
    if (ctx.calls.length < 5) throw new Error('pocos trazos para ' + id);
  }
});

t('down-scale por modelo: factores aprobados y radio visual del roster', () => {
  if (!Array.isArray(NV.LAB_MODEL_SCALE_FACTORS) || NV.LAB_MODEL_SCALE_FACTORS.length !== 6) throw new Error('factores ausentes');
  const expected = [24.5, 30, 30.4, 30.4, 34.44, 38.25];
  for (let i = 0; i < 6; i++) {
    const r = NV.labModelVisualRadius(i);
    if (Math.abs(r - expected[i]) > 0.01) throw new Error('modelo ' + i + ' radio=' + r);
  }
  // Jerarquía preservada: ningún modelo dibuja más pequeño que el anterior.
  for (let i = 1; i < 6; i++) {
    if (NV.labModelVisualRadius(i) < NV.labModelVisualRadius(i - 1) - 1e-9) throw new Error('jerarquía invertida en ' + i);
  }
});

t('factor de hitbox por modelo = factor visual / 0.8 previo', () => {
  const expected = [0.875, 0.9375, 1, 1, 1.025, 1.0625];
  for (let i = 0; i < 6; i++) {
    const f = NV.labModelHitboxFactor(i);
    if (Math.abs(f - expected[i]) > 1e-9) throw new Error('modelo ' + i + ' factor=' + f);
  }
});

t('customScale escala el radio visual del modelo', () => {
  if (Math.abs(NV.labModelVisualRadius(0, 2) - 49) > 0.01) throw new Error('x2=' + NV.labModelVisualRadius(0, 2));
  if (Math.abs(NV.labModelVisualRadius(5, 0.5) - 19.125) > 0.01) throw new Error('x0.5=' + NV.labModelVisualRadius(5, 0.5));
});

t('render con slowUntil activo', () => {
  const ctx = mkCtx();
  const enemy = { x: 100, y: 100, radius: 12, color: '#fff', shape: 'circle', enemyTypeId: 'drone', dead: false, slowUntil: 1.5 };
  if (NV.drawSpectralEnemy2D(ctx, enemy, 30, player, null) !== true) throw new Error('esperaba true');
});

t('render con mine activo', () => {
  const ctx = mkCtx();
  const enemy = { x: 100, y: 100, radius: 12, color: '#fff', shape: 'circle', enemyTypeId: 'drone', dead: false, mine: true };
  if (NV.drawSpectralEnemy2D(ctx, enemy, 30, player, null) !== true) throw new Error('esperaba true');
});

t('render con armed activo (kamikaze)', () => {
  const ctx = mkCtx();
  const enemy = { x: 100, y: 100, radius: 12, color: '#ff5f3d', shape: 'triangle', enemyTypeId: 'kamikaze', dead: false, armed: true, fuse: 0.5 };
  if (NV.drawSpectralEnemy2D(ctx, enemy, 30, player, null) !== true) throw new Error('esperaba true');
});

t('render élite base (isElite sin visualId)', () => {
  const ctx = mkCtx();
  const enemy = { x: 100, y: 100, radius: 15, color: '#ff0', shape: 'hex', enemyTypeId: 'tank', dead: false, isElite: true };
  if (NV.drawSpectralEnemy2D(ctx, enemy, 30, player, null) !== true) throw new Error('esperaba true');
});

t('render élite con visualId específico', () => {
  const ctx = mkCtx();
  const enemy = { x: 100, y: 100, radius: 15, color: '#ff0', shape: 'triangle', enemyTypeId: 'runner', dead: false, isElite: true, visualId: 'elite_velocity' };
  if (NV.drawSpectralEnemy2D(ctx, enemy, 30, player, null) !== true) throw new Error('esperaba true');
});

// Tests para los 8 perfiles élite diferenciados
const eliteVisualIds = ['elite_base', 'elite_velocity', 'elite_bulwark', 'elite_predator', 'elite_phantom', 'elite_chaos', 'elite_titan', 'elite_swift', 'elite_specter_swift', 'elite_specter_wrath', 'elite_specter_void'];
for (const vid of eliteVisualIds) {
  t('render élite visualId=' + vid + ' sin crash', () => {
    const ctx = mkCtx();
    const enemy = { x: 100, y: 100, radius: 15, color: '#ff0', shape: 'hex', enemyTypeId: 'tank', dead: false, isElite: true, visualId: vid };
    if (NV.drawSpectralEnemy2D(ctx, enemy, 30, player, null) !== true) throw new Error('esperaba true para ' + vid);
    if (ctx.calls.length < 5) throw new Error('pocos trazos para ' + vid);
  });
}

t('NV.SPECTRAL_ELITE_PROFILES expone 11 perfiles', () => {
  if (!NV.SPECTRAL_ELITE_PROFILES) throw new Error('SPECTRAL_ELITE_PROFILES ausente');
  if (Object.keys(NV.SPECTRAL_ELITE_PROFILES).length !== 11) throw new Error('esperaba 11 perfiles élite, hay ' + Object.keys(NV.SPECTRAL_ELITE_PROFILES).length);
});

t('cada perfil élite tiene haloColor y haloWidth', () => {
  for (const [vid, p] of Object.entries(NV.SPECTRAL_ELITE_PROFILES)) {
    if (!p.haloColor) throw new Error(vid + ' sin haloColor');
    if (!p.haloWidth) throw new Error(vid + ' sin haloWidth');
  }
});

t('resolveProfile usa visualId del enemigo', () => {
  const ctx = mkCtx();
  const enemy = { x: 100, y: 100, radius: 15, color: '#ff0', shape: 'hex', enemyTypeId: 'tank', dead: false, isElite: true, visualId: 'elite_titan' };
  // Renderiza y verifica que no crashée con el perfil titan (masivo)
  if (NV.drawSpectralEnemy2D(ctx, enemy, 30, player, null) !== true) throw new Error('esperaba true');
});

t('élite sin visualId cae a elite_base', () => {
  const ctx = mkCtx();
  const enemy = { x: 100, y: 100, radius: 15, color: '#ff0', shape: 'hex', enemyTypeId: 'tank', dead: false, isElite: true };
  if (NV.drawSpectralEnemy2D(ctx, enemy, 30, player, null) !== true) throw new Error('esperaba true');
});

t('élite con visualId inválido cae a elite_base', () => {
  const ctx = mkCtx();
  const enemy = { x: 100, y: 100, radius: 15, color: '#ff0', shape: 'hex', enemyTypeId: 'tank', dead: false, isElite: true, visualId: 'inexistente' };
  if (NV.drawSpectralEnemy2D(ctx, enemy, 30, player, null) !== true) throw new Error('esperaba true');
});

// Tests para el renderer espectral de bosses
const bossTypes = [
  { name: 'JEFE', hp: 300, maxHp: 300, radius: 50, color: '#ff5f9b', shape: 'hex' },
  { name: 'TITÁN', hp: 450, maxHp: 450, radius: 55, color: '#ff8c00', shape: 'hex' },
  { name: 'SEÑOR DEL VACÍO', hp: 600, maxHp: 600, radius: 65, color: '#dc143c', shape: 'circle' },
  { name: 'GUARDIÁN', hp: 350, maxHp: 350, radius: 45, color: '#00bfff', shape: 'hex' },
  { name: 'DESTRUCTOR', hp: 500, maxHp: 500, radius: 60, color: '#ff0000', shape: 'rock' },
  { name: 'NÉMESIS', hp: 400, maxHp: 400, radius: 48, color: '#8b00ff', shape: 'diamond' },
  { name: 'COLOSO', hp: 700, maxHp: 700, radius: 70, color: '#ff4500', shape: 'rock' },
  { name: 'FANTASMA', hp: 280, maxHp: 280, radius: 40, color: '#e0ffff', shape: 'circle' },
  { name: 'MUTANTE', hp: 380, maxHp: 380, radius: 52, color: '#32cd32', shape: 'hex' },
  { name: 'APOCALIPSIS', hp: 800, maxHp: 800, radius: 75, color: '#ff1493', shape: 'rock' },
];
for (const bt of bossTypes) {
  t('render boss ' + bt.name + ' espectral sin crash', () => {
    const ctx = mkCtx();
    const boss = { x: 400, y: 300, hp: bt.hp, maxHp: bt.maxHp, radius: bt.radius, color: bt.color, shape: bt.shape, name: bt.name, dead: false, hitFlash: 0, phase2: false };
    if (NV.drawSpectralBoss2D(ctx, boss, 30, player, null) !== true) throw new Error('esperaba true para boss ' + bt.name);
    if (ctx.calls.length < 8) throw new Error('pocos trazos para boss ' + bt.name);
  });
}

t('render boss con hitFlash activo', () => {
  const ctx = mkCtx();
  const boss = { x: 400, y: 300, hp: 300, maxHp: 300, radius: 50, color: '#ff5f9b', shape: 'hex', name: 'JEFE', dead: false, hitFlash: 0.8, phase2: false };
  if (NV.drawSpectralBoss2D(ctx, boss, 30, player, null) !== true) throw new Error('esperaba true');
});

t('render boss en FASE 2', () => {
  const ctx = mkCtx();
  const boss = { x: 400, y: 300, hp: 300, maxHp: 300, radius: 50, color: '#ff5f9b', shape: 'hex', name: 'JEFE', dead: false, hitFlash: 0, phase2: true };
  if (NV.drawSpectralBoss2D(ctx, boss, 30, player, null) !== true) throw new Error('esperaba true');
});

t('boss muerto devuelve false', () => {
  const ctx = mkCtx();
  const boss = { x: 400, y: 300, hp: 0, maxHp: 300, radius: 50, color: '#ff5f9b', shape: 'hex', name: 'JEFE', dead: true, hitFlash: 0, phase2: false };
  if (NV.drawSpectralBoss2D(ctx, boss, 30, player, null) !== false) throw new Error('esperaba false');
});

t('NV.SPECTRAL_BOSS_PROFILES expone 10 perfiles', () => {
  if (!NV.SPECTRAL_BOSS_PROFILES) throw new Error('SPECTRAL_BOSS_PROFILES ausente');
  if (Object.keys(NV.SPECTRAL_BOSS_PROFILES).length !== 10) throw new Error('esperaba 10 perfiles boss, hay ' + Object.keys(NV.SPECTRAL_BOSS_PROFILES).length);
});

t('render shielder con escudo en cooldown', () => {
  const ctx = mkCtx();
  const enemy = { x: 100, y: 100, radius: 14, color: '#5fffa0', shape: 'diamond', enemyTypeId: 'shielder', dead: false, shieldCd: 1.0 };
  if (NV.drawSpectralEnemy2D(ctx, enemy, 30, player, null) !== true) throw new Error('esperaba true');
});

t('index.html carga spectralEnemies2D.js antes que enemies.js', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  if (!html.includes('js/render/spectralEnemies2D.js')) throw new Error('no cargado');
  const idxSpectral = html.indexOf('spectralEnemies2D.js');
  const idxEnemies = html.indexOf('enemies.js');
  if (idxSpectral > idxEnemies) throw new Error('orden incorrecto');
});

console.log('\nRESULT spectral_enemies_render: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
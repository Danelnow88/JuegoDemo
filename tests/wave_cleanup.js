// Tests Tarea #10: los enemigos sobrantes desaparecen con fade al terminar la oleada.
// - Se marcan para cleanup INMEDIATAMENTE en triggerWaveVictory(false).
// - Avanzan SOLO su timer visual durante wave_end (sin AI, contacto, daño ni kills).
// - Duración ~0.4s: a ~0.1s siguen existiendo (animando) y a ~0.5s ya NO existen.
// - El render consume waveCleanup/waveCleanupT (alpha 1→0 y escala 1→0.7).
// - El flujo boss/#8 no se toca (sin marcado con isBoss, constantes intactas).
const fs = require('fs'), vm = require('vm'), assert = require('assert');
let pass = 0, fail = 0;
function t(desc, fn) { try { fn(); pass++; console.log('  ok  ' + desc); } catch (e) { fail++; console.log('  FAIL ' + desc + ' -> ' + e.message); } }
const noop = () => {};

// Extrae funciones REALES de js/game.js y las ejecuta contra mocks mínimos
// (mismo enfoque FUNCIONAL que tests/boss_reward_autocollect.js para #8d).
function makeGameCtx() {
  const g = fs.readFileSync('js/game.js', 'utf8');
  const c = {
    state: 'playing', paused: false,
    player: { hp: 100, x: 100, y: 100, invuln: 0, stun: 0, stunReapplyLockout: 0, character: 'nova' },
    enemies: [{ hp: 20, maxHp: 20, x: 100, y: 100, radius: 12 }],
    presentation: {}, hazards: [], bullets: [{ isEnemy: true, x: 0, y: 0 }], flameZones: [],
    hookSystem: null, minefieldState: {}, boss: null, bossChests: [], pickups: [], wave: 3,
    WAVE_END_DURATION: 2.1, WAVE_CLEANUP_DURATION: 0.4, BOSS_WAVE_END_DURATION: 2.25, BOSS_CHEST_HOLD: 2.25,
    SHOP_ENTER_DURATION: 0.5, arenaW: () => 900, arenaH: () => 520,
    NV: {
      updateShockwaves: (dt, a) => a, updatePlayerMovement: noop,
      updateMeteors: (dt, m) => ({ meteors: m }),
      activateNormalShardMagnetPull: noop,
    },
    clearCombatIntent: noop, syncGameState: noop, triggerFlash: noop, spawnExplosion: noop,
    showBanner: noop, sfx: { victory: noop },
    shake: 0, flashAlpha: 0, specialVFX: null, shockwaves: [], meteors: [], frame: 0,
    combatIntent: {}, updateParticles: noop, updateFloatTexts: noop, updateTrails: noop,
    updatePickups: noop, updateWeaponPickups: noop, updateBossChests: noop,
    updateBombImpacts: noop, // #11: cola de impactos pendientes vacía en estos escenarios
    };
  vm.createContext(c);
  // triggerWaveVictory real (corta antes de triggerFlash, mockeado) y
  // updatePresentation REAL completa (paso del timer + filtro de eliminación).
  vm.runInContext(g.slice(g.indexOf('  function triggerWaveVictory('), g.indexOf('  function triggerFlash(')), c);
  vm.runInContext(g.slice(g.indexOf('  function updatePresentation('), g.indexOf('  // === UPDATE ===')), c);
  vm.runInContext(g.slice(g.indexOf('  function update(dt)'), g.indexOf('  function shoot(')), c);
  for (const name of ['WAVE_END_DURATION', 'WAVE_CLEANUP_DURATION', 'BOSS_WAVE_END_DURATION', 'BOSS_CHEST_HOLD', 'SHOP_ENTER_DURATION']) {
    c[name] = Number(new RegExp('const ' + name + ' = ([0-9.]+);').exec(g)[1]);
  }
  return c;
}

t('constantes: WAVE_CLEANUP_DURATION=0.4 y #8 intacto (hold/duraciones sin tocar)', () => {
  const g = fs.readFileSync('js/game.js', 'utf8');
  if (!g.includes('const WAVE_CLEANUP_DURATION = 0.4;')) throw new Error('falta WAVE_CLEANUP_DURATION');
  if (!g.includes('const WAVE_END_DURATION = 2.10;')) throw new Error('WAVE_END_DURATION fue modificado');
  if (!g.includes('const BOSS_WAVE_END_DURATION = 2.25;')) throw new Error('BOSS_WAVE_END_DURATION fue modificado');
  if (!g.includes('const BOSS_CHEST_HOLD = 2.25;')) throw new Error('BOSS_CHEST_HOLD fue modificado');
});

t('FUNCIONAL: al terminar la wave los sobrantes quedan marcados YA (y bullets enemigas fuera)', () => {
  const c = makeGameCtx();
  assert.strictEqual(c.triggerWaveVictory(false, null, null), true);
  assert.strictEqual(c.state, 'wave_end');
  assert.strictEqual(c.enemies[0].waveCleanup, true, 'no marcó waveCleanup');
  assert.strictEqual(c.enemies[0].waveCleanupT, 0);
  assert.strictEqual(c.bullets.length, 0, 'quedaron proyectiles enemigos activos');
  assert.strictEqual(c.enemies.length, 1, 'no debe eliminarse en el mismo frame del inicio');
});

t('FUNCIONAL: a ~0.1s de wave_end el enemigo SIGUE existiendo y su timer avanza', () => {
  const c = makeGameCtx();
  c.triggerWaveVictory(false, null, null);
  for (let i = 0; i < 6; i++) c.updatePresentation(1 / 60);
  assert.strictEqual(c.enemies.length, 1);
  const tt = c.enemies[0].waveCleanupT;
  assert(tt > 0.09 && tt < 0.4, 'cleanupT=' + tt + ' (debe avanzar con dt pero no terminar)');
  assert.strictEqual(c.state, 'wave_end', 'no debió salir de wave_end');
});

t('FUNCIONAL: a ~0.5s el enemigo YA NO existe y la tienda AÚN no entró', () => {
  const c = makeGameCtx();
  c.triggerWaveVictory(false, null, null);
  for (let i = 0; i < 6 + 24; i++) c.updatePresentation(1 / 60);
  assert.strictEqual(c.enemies.length, 0, 'sobrevivió al cleanup: sigue hasta la tienda (bug original)');
  assert.strictEqual(c.state, 'wave_end');
});

t('FUNCIONAL: el boss NO se marca para cleanup (transición #8 intacta)', () => {
  const c = makeGameCtx();
  c.enemies = [{ hp: 20, x: 100, y: 100 }];
  c.bossChests = [{ x: 100, y: 100, dead: false, timer: 0 }]; // cofre pendiente => rama hold real
  c.triggerWaveVictory(true, 'BOSS', '#ffd700');
  assert.strictEqual(c.enemies[0].waveCleanup, undefined, 'boss flow no debe tocar enemies');
  assert.strictEqual(c.presentation.isBoss, true);
  c.updatePresentation(1 / 60);
  assert.strictEqual(c.enemies.length, 1);
});

t('ENGINE: waveCleanup no dispara contacto/onKill/AI (el activo adyacente sí ataca)', () => {
  const sbx = { window: { NV: {} }, console, Math };
  vm.runInNewContext(fs.readFileSync('js/engine/enemies.js', 'utf8'), sbx, { filename: 'enemies.js' });
  const NVE = sbx.window.NV;
  const cleanupE = { hp: 10, maxHp: 10, x: 110, y: 100, radius: 12, waveCleanup: true, waveCleanupT: 0.05, dead: false, contactCd: 0, behavior: 'chase', speed: 999, damage: 50, isElite: false };
  const active = { hp: 10, maxHp: 10, x: 111, y: 100, radius: 12, dead: false, contactCd: 0, behavior: 'chase', speed: 0, damage: 10, isElite: false, hostileClass: 'light', angle: 0, erraticTimer: 0 };
  const player = { hp: 100, x: 100, y: 100, radius: 12, invuln: 0, stun: 0, stunReapplyLockout: 0, xp: 0, xpToNext: 10, level: 1, maxHp: 100 };
  let onKillCalls = 0;
  const res = NVE.updateEnemies(0.016, {
    enemies: [cleanupE, active], player, bullets: [], MAX_BULLETS: 10, MAX_ENEMY_BULLETS: 10,
    enemyBulletCount: () => 0, applyPlayerDamage: (damage) => { player.hp -= damage; return { applied: true, killed: false }; }, addFloatText: noop,
    spawnExplosion: noop, MAX_HOSTILES: 30, MAX_HEAVY_HOSTILES: 7, boss: null, wave: 3,
    waveEvent: null, hookSystem: null, onKill: () => { onKillCalls++; },
  });
  const kept = res.enemies.find((e) => e.waveCleanup);
  assert(kept, 'el cleanup debe conservarse en la lista (sólo es visual)');
  assert.strictEqual(kept.dead, false, 'el cleanup NO debe morir');
  assert.strictEqual(kept.x, 110, 'la AI no debe moverlo');
  assert.strictEqual(onKillCalls, 1, 'sólo el activo debe matar por contacto');
  assert.strictEqual(active.dead, true, 'el activo adyacente debe seguir con su lógica');
  assert(player.hp < 100, 'el contacto del activo debe dañar al jugador');
});

t('ENGINE: una muerte normal sigue acreditando score/explosión (sin regresión)', () => {
  const sbx = { window: { NV: { BALANCE: { WEAPON_MAX_LEVEL: 100, GREED_PERM_DROP: 0 } } }, console, Math };
  vm.runInNewContext(fs.readFileSync('js/engine/enemies.js', 'utf8'), sbx, { filename: 'enemies.js' });
  const NVE = sbx.window.NV;
  const e = { hp: 0, x: 5, y: 5, score: 10, xp: 2, isElite: false, dead: false, behavior: 'chase' };
  const player = { hp: 100, x: 0, y: 0, xp: 0, xpToNext: 100, level: 1, maxHp: 100, luck: 0, permGreed: 0, bounty: 0 };
  const pickups = [];
  let explosions = 0;
  const score = NVE.killEnemy({
    e, score: 0, player, weaponLevels: { rifle: 1 }, weaponKills: {}, currentWeapon: { id: 'rifle' },
    WEAPON_KILLS_PER_LEVEL: 10, addFloatText: noop, spawnExplosion: () => { explosions++; },
    triggerFlash: noop, sfx: { enemyDeath: noop }, pickups, weaponKillProgress: () => 1,
    waveEvent: null, applyPlayerDamage: () => ({ killed: false }), W: 900,
  });
  assert.strictEqual(e.dead, true);
  assert.strictEqual(score, 10, 'el score normal cambió');
  assert.strictEqual(explosions, 1, 'la explosión de muerte cambió');
});

t('GAME: killEnemy es NO-OP para un enemigo en cleanup (sin score, xp ni drops)', () => {
  const g = fs.readFileSync('js/game.js', 'utf8');
  const c = { score: 0, shards: 0, NV: {}, hookSystem: null, killCombo: { count: 0, timer: 0 }, sfx: {}, waveEvent: null };
  vm.createContext(c);
  vm.runInContext(g.slice(g.indexOf('  function killEnemy('), g.indexOf('  function updateEnemies(')), c);
  let engineKills = 0;
  c.NV.killEnemy = () => { engineKills++; return 0; };
  c.NV.comboOnKill = () => ({ bonusScore: 0, gemBonus: 0, count: 1 });
  c.killEnemy({ waveCleanup: true, waveCleanupT: 0.2, dead: false, score: 10, xp: 5 });
  assert.strictEqual(engineKills, 0, 'el cleanup no debe pasar por NV.killEnemy');
  assert.strictEqual(c.score, 0);
});

t('RENDER: sustitución cartoon rápida — body visible antes y puff fuerte inmediatamente después', () => {
  const g = fs.readFileSync('js/game.js', 'utf8');
  const c = {
    NV: { SPECTRAL_ENEMY_MODE: true, rhythm: null },
    frame: 3, player: { x: 0, 'y': 0 }, WAVE_CLEANUP_DURATION: 0.4,
    WAVE_CLEANUP_POP_T: 0.08, WAVE_CLEANUP_POP_SCALE: 1.08,
    isEnemyRenderedByLite: () => false,
  };
  const calls = { save: 0, restore: 0, translate: [], scale: [], bodyAlpha: [], puffAlpha: [] };
  const alphaStack = [];
  c.ctx = {
    globalAlpha: 1,
    save() { calls.save++; alphaStack.push(this.globalAlpha); },
    restore() { calls.restore++; this.globalAlpha = alphaStack.pop(); },
    translate(x, y) { calls.translate.push([x, y]); },
    scale(sx, sy) { calls.scale.push([sx, sy]); },
    beginPath() {}, arc() {}, fill() { calls.puffAlpha.push(this.globalAlpha); }, fillRect() {}, stroke() {},
  };
  vm.createContext(c);
  vm.runInContext(g.slice(g.indexOf('  function drawCleanupPuff('), g.indexOf('  function drawBoss(')), c);
  c.NV.drawSpectralEnemy2D = (rctx) => {
    rctx.globalAlpha = 0.8;
    calls.bodyAlpha.push(c.ctx.globalAlpha);
  };
  const sample = (t) => {
    calls.bodyAlpha.length = 0;
    calls.puffAlpha.length = 0;
    calls.scale.length = 0;
    c.drawEnemy({ x: 200, y: 120, radius: 12, waveCleanup: true, waveCleanupT: t });
    return {
      bodyAlpha: calls.bodyAlpha.length ? calls.bodyAlpha[0] : 0,
      puffAlpha: calls.puffAlpha.length ? Math.max(...calls.puffAlpha) : 0,
      scale: calls.scale.length ? calls.scale[0][0] : null,
    };
  };
  const at005 = sample(0.05);
  assert(Math.abs(at005.bodyAlpha - 0.8) < 1e-9, 'a 0.05s el cuerpo debe seguir opaco');
  assert.strictEqual(at005.puffAlpha, 0, 'a 0.05s el puff aún no debe dominar');
  assert(Math.abs(at005.scale - 1.0666666666666667) < 1e-9, 'a 0.05s debe estar en el micro pop');
  const at009 = sample(0.09);
  assert(at009.bodyAlpha > 0.65, 'a 0.09s el cuerpo debe seguir visible durante el squash: ' + at009.bodyAlpha);
  assert.strictEqual(at009.puffAlpha, 0, 'a 0.09s el puff debe seguir ausente antes de la sustitución');
  assert(at009.scale < 0.93 && at009.scale > 0.88, 'a 0.09s el cuerpo debe estar contraído: ' + at009.scale);
  const at011 = sample(0.11);
  assert.strictEqual(at011.bodyAlpha, 0, 'a 0.11s el cuerpo ya debe haber desaparecido');
  assert(at011.puffAlpha > 0.85, 'a 0.11s el puff debe reemplazar al cuerpo con alpha alto: ' + at011.puffAlpha);
  const at012 = sample(0.12);
  assert.strictEqual(at012.bodyAlpha, 0, 'a 0.12s el cuerpo debe permanecer invisible');
  assert(at012.puffAlpha > 0.85, 'a 0.12s el puff debe seguir fuerte: ' + at012.puffAlpha);
  const at018 = sample(0.18);
  assert.strictEqual(at018.bodyAlpha, 0, 'a 0.18s el cuerpo debe ser invisible');
  assert(at018.puffAlpha > 0.85, 'a 0.18s el puff expandido debe seguir claramente visible: ' + at018.puffAlpha);
  const at030 = sample(0.30);
  assert.strictEqual(at030.bodyAlpha, 0, 'a 0.30s el cuerpo debe permanecer invisible');
  assert(at030.puffAlpha > 0.45, 'a 0.30s el puff debe seguir visible durante su dispersión: ' + at030.puffAlpha);
  assert(at009.bodyAlpha > 0.65 && at009.puffAlpha === 0 && at011.bodyAlpha === 0 && at011.puffAlpha > 0.85,
    'la sustitución 0.09→0.11s debe evitar un crossfade largo');
  assert.strictEqual(c.ctx.globalAlpha, 1, 'el estado del ctx debe restaurarse');
  assert.deepStrictEqual(calls.translate[0], [200, 120], 'la escala debe pivotar en el centro del enemigo');
  // Con progress >= 1 ya no se dibuja nada.
  calls.save = 0; calls.restore = 0;
  c.NV.drawSpectralEnemy2D = () => { throw new Error('no debe dibujarse con progreso completo'); };
  c.drawEnemy({ x: 200, y: 120, radius: 12, waveCleanup: true, waveCleanupT: 0.4 });
  assert(calls.save === 0 && calls.restore === 0, 'no debe tocar el ctx al final');
});

t('GAME: sin cleanup el drawEnemy delega exactamente como antes (sin proxy ni save extra)', () => {
  const g = fs.readFileSync('js/game.js', 'utf8');
  const draw = g.slice(g.indexOf('  function drawEnemy('), g.indexOf('  function drawBoss('));
  const pre = g.slice(0, g.indexOf('  function drawEnemy('));
  const loop = pre.slice(pre.lastIndexOf('for (const e of enemies) if (!(e.atkFlash > 0)) drawEnemy(e);'));
  assert(loop.includes('drawEnemy(e)'), 'el bucle de render cambió de orden');
  const c = {
    NV: { SPECTRAL_ENEMY_MODE: false, drawEnemy: (rctx) => { assert(rctx === c.ctx, 'sin cleanup debe usar ctx directo'); } },
    frame: 1, player: { x: 0, y: 0 }, isEnemyRenderedByLite: () => false,
  };
  let saves = 0;
  c.ctx = { globalAlpha: 1, save() { saves++; }, restore() {}, translate() {}, scale() {} };
  vm.createContext(c);
  vm.runInContext(draw, c);
  c.drawEnemy({ x: 5, y: 5, radius: 8 });
  assert.strictEqual(saves, 0, 'un enemigo normal no debe pasar por el wrapper de cleanup');
});

t('GAME: los bucles de legibilidad/intención ignoran enemigos en cleanup', () => {
  const g = fs.readFileSync('js/game.js', 'utf8');
  if (!g.includes('for (const e of enemies) if (!e.waveCleanup && NV.drawContactReadability)')) throw new Error('drawContactReadability no filtra cleanup');
  if (!g.includes('const e of enemies) if (!e.waveCleanup && NV.drawEnemyIntent)')) throw new Error('drawEnemyIntent no filtra cleanup');
});

t('FUNCIONAL: update real elimina a 0.4 s sin ejecutar combate ni esperar tienda', () => {
  const c = makeGameCtx();
  const e = c.enemies[0];
  for (const name of ['updateEnemies', 'updateBullets', 'updateBoss', 'updateHazards', 'updateDrones']) {
    c[name] = () => { throw new Error('combate durante wave_end: ' + name); };
  }
  c.triggerWaveVictory(false);
  for (let i = 0; i < 10; i++) c.update(0.01);
  assert.strictEqual(c.enemies[0], e);
  assert(Math.abs(e.waveCleanupT - 0.1) < 1e-9);
  for (let i = 0; i < 29; i++) c.update(0.01);
  assert.strictEqual(c.enemies[0], e, 'eliminado antes de 0.4 s');
  c.update(0.01);
  assert.strictEqual(c.enemies.length, 0);
  assert.strictEqual(c.state, 'wave_end');
  for (let i = 0; i < 150; i++) c.update(0.01);
  assert.strictEqual(c.state, 'wave_end');
  assert.strictEqual(c.enemies.length, 0);
  assert.strictEqual(c.player.hp, 100);
});

t('ENGINE: ranged/kamikaze cleanup no generan balas, daño, kills ni rewards', () => {
  const sbx = { window: { NV: {} }, console, Math };
  vm.runInNewContext(fs.readFileSync('js/engine/enemies.js', 'utf8'), sbx);
  const NV = sbx.window.NV;
  const enemies = ['ranged', 'kami'].map((behavior) => ({
    behavior, x: 100, y: 100, hp: 20, dead: false, radius: 12,
    waveCleanup: true, waveCleanupT: 0, shootTimer: 0, speed: 500,
  }));
  const before = JSON.stringify(enemies);
  const bullets = [], pickups = [];
  const forbidden = () => { throw new Error('efecto de gameplay en cleanup'); };
  let result;
  for (let i = 0; i < 30; i++) result = NV.updateEnemies(1 / 60, {
    enemies, bullets, player: { x: 100, y: 100, hp: 100, invuln: 0 },
    hookSystem: null, applyPlayerDamage: forbidden, onKill: forbidden,
    spawnExplosion: forbidden, addFloatText: forbidden,
  });
  assert.strictEqual(result.enemies.length, 2);
  assert.strictEqual(JSON.stringify(enemies), before);
  assert.strictEqual(bullets.length, 0);
  for (const e of enemies) {
    assert.strictEqual(NV.killEnemy({ e, score: 37, pickups, player: {}, sfx: {} }), 37);
    assert.strictEqual(e.killResolved, undefined);
  }
  assert.strictEqual(pickups.length, 0);
});

t('RENDER: puff cartoon render-only — 7 círculos principales + 3 mini-puffs efímeros', () => {
  const g = fs.readFileSync('js/game.js', 'utf8');
  const c = {
    NV: { SPECTRAL_ENEMY_MODE: false, drawEnemy: () => {} },
    frame: 1, player: { x: 0, y: 0 },
    WAVE_CLEANUP_DURATION: 0.4, WAVE_CLEANUP_POP_T: 0.08, WAVE_CLEANUP_POP_SCALE: 1.08,
    isEnemyRenderedByLite: () => false,
  };
  const circles = [], fills = [];
  c.ctx = {
    globalAlpha: 1,
    save() {}, restore() {}, translate() {}, scale() {},
    beginPath() {},
    arc(x, y, r) { circles.push([Math.round(x * 100) / 100, Math.round(y * 100) / 100, Math.round(r * 100) / 100]); },
    fill() { fills.push({ color: this.fillStyle, alpha: this.globalAlpha }); },
  };
  vm.createContext(c);
  vm.runInContext(g.slice(g.indexOf('  function drawCleanupPuff('), g.indexOf('  function drawBoss(')), c);
  const draw = (t) => {
    circles.length = 0; fills.length = 0;
    c.drawEnemy({ x: 200, y: 120, radius: 12, color: '#f0f', waveCleanup: true, waveCleanupT: t });
    return circles.length;
  };
  assert.strictEqual(draw(0.03), 0, 'antes de 0.04s no debe aparecer el puff');
  assert.strictEqual(draw(0.09), 0, 'antes del poof el puff debe estar ausente');
  assert.strictEqual(draw(0.12), 10, 'el puff debe tener centro + 6 lóbulos + 3 mini-puffs');
  assert(fills.every((f) => ['#f4f1e8', '#fffaf0', '#e8edf2'].includes(f.color)), 'colores fuera de la paleta de humo claro');
  assert(fills.every((f) => f.alpha > 0 && f.alpha < 1), 'alpha del puff fuera de rango');
  const snap = circles.map((r) => r.join(',')).join('|');
  draw(0.12);
  assert.strictEqual(circles.map((r) => r.join(',')).join('|'), snap, 'el puff debe ser determinista (mismo timer => mismos círculos)');
  draw(0.22);
  const maxCloudRadius = Math.max(...circles.map((r) => r[2]));
  assert(maxCloudRadius >= 10, 'el puff no crece lo suficiente al pico: radio=' + maxCloudRadius);
  draw(0.36);
  assert.strictEqual(circles.length, 7, 'los mini-puffs deben ser efímeros y desaparecer antes del final');
  assert(fills.every((f) => f.alpha < 0.12), 'el puff tardío debe estar desvaneciéndose');
  assert.strictEqual(draw(0.4), 0, 'al completar 0.4s no debe dibujarse');
  circles.length = 0; fills.length = 0;
  c.drawEnemy({ x: 200, y: 120, radius: 12, color: '#f0f' }); // sin waveCleanup
  assert.strictEqual(circles.length, 0, 'el puff no debe existir fuera de waveCleanup');
  const puff = g.slice(g.indexOf('function drawCleanupPuff'), g.indexOf('  function drawEnemy'));
  for (const banned of ['particles', 'push(', 'killEnemy', 'score', 'waveCleanupBurstDone', 'sfx', 'Math.random']) {
    if (puff.includes(banned)) throw new Error('el puff no debe usar ' + banned);
  }
});

console.log('RESULT wave_cleanup: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);

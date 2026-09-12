// ===== STRESS HARNESS (P2 Performance Foundation) =====
// Escenarios A–S reproducibles a nivel de SISTEMA (no del loop completo de
// game.js, que requiere DOM/canvas real): carga los módulos de engine/render en
// una sandbox y mide el coste real de update() y draw() por frame con el
// monitor de performance. Fidelidad documentada:
//  - update: pipeline real (updateEnemies/updateBullets/updateParticles/
//    updateMeteors/updateDrones/updateBoss según escenario).
//  - draw: renderer espectral real (la ruta dominante de enemigos) con ctx
//    contador; el resto del render de game.js no se mide aquí.
//  - computePlayerHit se aproxima con multiplicador neutro 1.
// Uso: node tools/performance/stress_harness.js [--frames N]
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');

function makeNV() {
  const sbx = {
    window: { NV: {} },
    console,
    Math,
    performance,
    Date, JSON, Object, Array, Set, Map, WeakSet, Float32Array, Proxy, Reflect,
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
  };
  sbx.window.window = sbx.window;
  const files = [
    'js/data/balance.js',
    'js/data/gameData.js',
    'js/core/settings.js',
    'js/engine/hostileBudget.js',
    'js/engine/performanceMonitor.js',
    'js/render/visualBudget.js',
    'js/engine/rhythm.js',
    'js/engine/fx.js',
    'js/engine/hazards.js',
    'js/engine/enemies.js',
    'js/engine/boss.js',
    'js/engine/bullets.js',
    'js/engine/drones.js',
    'js/engine/meteors.js',
    'js/engine/special.js',
    'js/render/spectralEnemies2D.js',
    'js/render/hazards.js',
  ];
  for (const f of files) {
    vm.runInNewContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sbx, { filename: f });
  }
  return sbx.window.NV;
}

function costCtx() {
  const units = { calls: 0, paths: 0, shadowOps: 0, grads: 0 };
  const grad = { addColorStop() {} };
  return new Proxy({ canvas: { width: 900, height: 520 } }, {
    get(t, k) {
      if (k === 'units') return units;
      if (k === 'canvas') return t.canvas;
      if (k === 'createRadialGradient' || k === 'createLinearGradient') { units.grads++; return () => grad; }
      if (k === 'measureText') return () => ({ width: 10 });
      return () => { units.calls++; };
    },
    set() { return true; },
  });
}

const DT = 1 / 60;
function deepProxy() {
  const fn = () => {};
  return new Proxy(fn, {
    get(t, k) { return typeof k === 'symbol' ? undefined : deepProxy(); },
    apply() { return undefined; },
  });
}
function lightEnemy(i) {
  return { x: 80 + (i % 10) * 80, y: 60 + Math.floor(i / 10) * 60, hp: 20, maxHp: 20, damage: 4, speed: 55, radius: 11, color: '#67f8c8', shape: 'specter', behavior: 'chase', enemyTypeId: 'specter_lite', visualId: 'specter_lite', dead: false, knockVelX: 0, knockVelY: 0, hostileClass: 'light', shootTimer: 2 + i };
}
function heavyEnemy(i) {
  return { x: 120 + i * 90, y: 380, hp: 300, maxHp: 300, damage: 10, speed: 30, radius: 26, color: '#ff8c00', shape: 'specter', behavior: 'chase', enemyTypeId: 'elite_base', visualId: 'elite_base', isElite: true, dead: false, knockVelX: 0, knockVelY: 0, hostileClass: 'heavy', shootTimer: 3 + i };
}
function mkBoss() {
  return { x: 450, y: 90, hp: 6000, maxHp: 6000, radius: 26, color: '#ff5f9b', name: 'BOSS', isBoss: true, dead: false, timer: 0, pattern: 'burst', attack: 'spread', primaryAttack: 'spread', atkTimer: 0, stunChance: 0, spiralOff: 0, teleportTimer: 0, hitFlash: 0 };
}

function baseState(NV, enemies, opts) {
  opts = opts || {};
  const st = {
    enemies, player: { x: 450, y: 420, hp: 100, maxHp: 100, invuln: 0, stun: 0, overdrive: opts.overdrive || 0, character: 'boti', bulwark: 0 },
    MAX_BULLETS: 160, MAX_ENEMY_BULLETS: 80,
    CHARACTERS: NV.CHARACTERS,
    applyPlayerDamage() { return { applied: false }; },
    applyKnockback() {},
    killEnemy(e) { e.dead = true; },
    computePlayerHit() { return 1; }, // aproximación documentada del mult del jugador
    addFloatText() {}, gameOver() {},
    spawnExplosion(x, y, c, col, sm) { NV.spawnExplosion(st.particles, NV.BALANCE.MAX_PARTICLES, x, y, c, col, sm); },
    spawnShockwave(x, y, o) { NV.spawnShockwave(st.shockwaves, x, y, o); },
    showBanner() {}, triggerFlash() {}, triggerWaveVictory() {},
    spawnBossProj(b, speed, damage, count) {
      for (let i = 0; i < (count || 1) && st.bullets.length < st.MAX_BULLETS && st.enemyBulletCount() < st.MAX_ENEMY_BULLETS; i++) {
        st.bullets.push({ x: b.x, y: b.y, vx: speed, vy: speed, damage, color: '#f66', radius: 5, isEnemy: true, dead: false });
      }
    },
    spawnMinion() {}, runBossAttack() {}, spawnBossChest() {},
    MAX_HOSTILES: NV.BALANCE.MAX_HOSTILES, MAX_HEAVY_HOSTILES: NV.BALANCE.MAX_HEAVY_HOSTILES,
    boss: null, W: 900, H: 520, shake: 0, hitstop: 0, wave: 10, score: 0, shards: 0,
    SHIELD_COOLDOWN: 6,
    sfx: deepProxy(),
    onKill() {}, onPlayerDamaged() {},
    particles: [], shockwaves: [], trails: [], drones: [], meteors: [], hazards: [], musicalNotes: [],
    minefieldState: NV.createMinefieldState(), waveEvent: null,
  };
  st.bullets = [];
  st.visualPolicy = { tier: 'full' };
  st.spawnMusicalNotes = function (x, y, opts) {
    return NV.spawnMusicalNotes(x, y, Object.assign({}, opts, { notes: st.musicalNotes }));
  };
  st.clearMusicalNotes = function () { NV.clearMusicalNotes(st.musicalNotes); };
  st.enemyBulletCount = function () { let n = 0; for (const b of st.bullets) if (b.isEnemy) n++; return n; };
  st.playerBulletCount = function () { let n = 0; for (const b of st.bullets) if (!b.isEnemy) n++; return n; };
  return st;
}
function musicRhythm(frame) {
  const phase = (frame % 30) / 30;
  const kick = frame % 15 === 0 ? 1 : Math.max(0, 0.35 - (frame % 15) * 0.03);
  return {
    enabled: true, active: true, state: 'listening', _phase: phase,
    tempoBpm: 120, kick, kickEvt: frame % 15 === 0 ? 1 : 0,
    accent: frame % 30 === 0 ? 0.85 : 0, energy: 0.62, bass: 0.7, hue: 300,
  };
}

// --- helpers de presión y escenario ---
function flameBullets(st, n) {
  // Aproximación del chorro sostenido del lanzallamas: balas jugador cortas
  // (mide el coste bala×enemigo; el audio no forma parte del harness).
  for (let i = 0; i < n && st.playerBulletCount() < st.MAX_BULLETS; i++) {
    st.bullets.push({ x: st.player.x, y: st.player.y, vx: (Math.random() - 0.5) * 60, vy: -420, damage: 4, color: '#ff7a2a', radius: 5, size: 4, wid: 'flamethrower', dead: false });
  }
}
function enemyBulletPressure(st, target) {
  while (st.enemyBulletCount() < target && st.bullets.length < st.MAX_BULLETS) {
    st.bullets.push({ x: Math.random() * 900, y: 40, vx: 0, vy: 180, damage: 8, color: '#f66', radius: 5, isEnemy: true, dead: false });
  }
}
function speakerMine(i, state) {
  const cols = 3;
  return {
    type: 'speakerMine', state: state || 'armed', stateTime: 0, simTime: i * 0.11,
    x: 150 + (i % cols) * 300, y: 135 + Math.floor(i / cols) * 225,
    visualRadius: 16, triggerRadius: 14,
    phaseOffset: (i * 2.399963229728653) % (Math.PI * 2),
    grooveMode: 'idle', grooveBlend: 0, musicGrace: 0,
    kickImpulse: 0, kickLatched: false, smoothedEnergy: 0,
    accentImpulse: 0, accentLatched: false,
  };
}
function addMines(st, count, state) {
  st.waveEvent = 'mines';
  for (let i = 0; i < count; i++) st.hazards.push(speakerMine(i, state));
  st.minefieldState.spawned = count;
  st.minefieldState.spawnTimer = 999;
}
function fillParticles(st, count) {
  for (let i = 0; i < count; i++) {
    st.particles.push({ x: (i * 37) % 900, y: (i * 53) % 520, vx: 0, vy: 0, life: 10, fade: 10, size: 2, color: '#ff5f9b' });
  }
}
const SCENARIOS = {
  A: { label: '30 light', build(st) { for (let i = 0; i < 30; i++) st.enemies.push(lightEnemy(i)); } },
  B: { label: '23 light + 7 heavy', build(st) { for (let i = 0; i < 23; i++) st.enemies.push(lightEnemy(i)); for (let i = 0; i < 7; i++) st.enemies.push(heavyEnemy(i)); } },
  C: { label: '30 light + flamethrower sostenido', flame: true, build(st) { for (let i = 0; i < 30; i++) st.enemies.push(lightEnemy(i)); } },
  D: { label: '23 light + 7 heavy + flamethrower', flame: true, build(st) { for (let i = 0; i < 23; i++) st.enemies.push(lightEnemy(i)); for (let i = 0; i < 7; i++) st.enemies.push(heavyEnemy(i)); } },
  E: { label: 'boss + 6 summons heavy + presión de balas', boss: true, pressure: true, build(st) { st.boss = mkBoss(); for (let i = 0; i < 6; i++) st.enemies.push(heavyEnemy(i)); enemyBulletPressure(st, 80); } },
  F: { label: '30 light + BOTI 12 meteoros', meteors: true, build(st) { for (let i = 0; i < 30; i++) st.enemies.push(lightEnemy(i)); } },
  G: { label: '30 light + SWARM 6 drones', drones: true, build(st) { for (let i = 0; i < 30; i++) st.enemies.push(lightEnemy(i)); for (let i = 0; i < 6; i++) st.drones.push({ angle: i, orbitRadius: 70, speed: 2.5, color: '#7cf8ff', fireTimer: i * 0.13, life: 9999, aimLife: 0, tx: null, ty: null }); } },
  H: { label: 'overdrive + flamethrower + 30 light', flame: true, overdrive: true, build(st) { st.player.overdrive = 5; for (let i = 0; i < 30; i++) st.enemies.push(lightEnemy(i)); } },
  I: { label: '7 heavy + explosiones sostenidas', explosions: true, build(st) { for (let i = 0; i < 7; i++) st.enemies.push(heavyEnemy(i)); } },
  J: { label: 'mixto extremo: boss + 23 light + 6 heavy + flame + explosiones', boss: true, flame: true, explosions: true, build(st) { st.boss = mkBoss(); for (let i = 0; i < 23; i++) st.enemies.push(lightEnemy(i)); for (let i = 0; i < 6; i++) st.enemies.push(heavyEnemy(i)); } },
  K: { label: '24 hostiles + 6 speaker mines', mines: true, build(st) { for (let i = 0; i < 24; i++) st.enemies.push(lightEnemy(i)); addMines(st, 6); } },
  L: { label: '23 light + 7 heavy + 6 speaker mines', mines: true, build(st) { for (let i = 0; i < 23; i++) st.enemies.push(lightEnemy(i)); for (let i = 0; i < 7; i++) st.enemies.push(heavyEnemy(i)); addMines(st, 6); } },
  M: { label: '23 light + 7 heavy + flame + 6 mines', mines: true, flame: true, build(st) { for (let i = 0; i < 23; i++) st.enemies.push(lightEnemy(i)); for (let i = 0; i < 7; i++) st.enemies.push(heavyEnemy(i)); addMines(st, 6); } },
  N: { label: '6 mines detonando secuencialmente', mines: true, sequentialMines: true, build(st) { addMines(st, 6); } },
  O: { label: '6 mines + 200 particles + 7 heavy', mines: true, build(st) { for (let i = 0; i < 7; i++) st.enemies.push(heavyEnemy(i)); addMines(st, 6); fillParticles(st, 200); } },
  P: { label: '6 mines MUSIC_GROOVE', mines: true, music: true, build(st) { addMines(st, 6); } },
  Q: { label: '6 detonaciones + musical-note FX', mines: true, music: true, sequentialMines: true, build(st) { addMines(st, 6); } },
  R: { label: '23 light + 7 heavy + flame + 6 music mines', mines: true, music: true, flame: true, build(st) { for (let i = 0; i < 23; i++) st.enemies.push(lightEnemy(i)); for (let i = 0; i < 7; i++) st.enemies.push(heavyEnemy(i)); addMines(st, 6); } },
  S: { label: '6 mines IDLE_GROOVE', mines: true, build(st) { addMines(st, 6); } },
};

function runScenario(NV, key, frames) {
  const def = SCENARIOS[key];
  const st = baseState(NV, [], { overdrive: def.overdrive });
  def.build(st);
  const initialBudget = NV.getHostileBudget({ enemies: st.enemies, boss: st.boss && !st.boss.dead ? st.boss : null });
  const perf = NV.performanceMonitor;
  perf.reset();
  const ctx = costCtx();
  const mCb = { killEnemy(e) { e.dead = true; }, applyKnockback() {}, spawnExplosion: st.spawnExplosion };
  let maxHazards = st.hazards.length, maxParticles = st.particles.length, maxMusicalNotes = st.musicalNotes.length;
  for (let f = 0; f < frames; f++) {
    if (def.flame) flameBullets(st, 3);
    if (def.pressure) enemyBulletPressure(st, st.MAX_ENEMY_BULLETS);
    if (def.explosions) for (let k = 0; k < 4; k++) st.spawnExplosion(100 + k * 180, 200 + (f % 200), 26, '#ff5f9b', 0.9);
    if (def.meteors) while (st.meteors.length < 12) st.meteors.push({ x: (st.meteors.length * 70 + f * 7) % 900, y: -20, vx: 25, vy: 230, radius: 12, color: '#ffd700', dead: false });
    // Peor caso realista: una detonación cada 12 frames, no seis en el mismo frame.
    if (def.sequentialMines && f % 12 === 0) {
      const next = st.hazards.find((h) => h.state === 'armed');
      if (next) NV.detonateSpeakerMine(next, st);
    }

    const u0 = performance.now();
    if (def.mines) {
      const hr = NV.updateSpeakerMines(DT, st.hazards, st.minefieldState, {
        waveEvent: st.waveEvent, wave: st.wave, boss: null, transitioning: false,
        player: st.player, playerRadius: 9, W: st.W, H: st.H, rhythm: def.music ? musicRhythm(f) : null,
        musicalNotes: st.musicalNotes, visualPolicy: st.visualPolicy,
        spawnMusicalNotes: st.spawnMusicalNotes, clearMusicalNotes: st.clearMusicalNotes,
        applyPlayerDamage: st.applyPlayerDamage, spawnExplosion: st.spawnExplosion,
        spawnShockwave: st.spawnShockwave, triggerFlash: st.triggerFlash,
        sfx: st.sfx, shake: st.shake,
      });
      st.hazards = hr.hazards; st.minefieldState = hr.state; st.shake = hr.shake;
      maxHazards = Math.max(maxHazards, st.hazards.length);
      maxMusicalNotes = Math.max(maxMusicalNotes, st.musicalNotes.length);
    }
    const rE = NV.updateEnemies(DT, st);
    st.enemies = rE.enemies; st.shake = rE.shake || 0;
    const rB = NV.updateBullets(DT, st);
    st.bullets = rB.bullets; st.shake = rB.shake || st.shake; st.hitstop = rB.hitstop || 0;
    NV.updateParticles(DT, st.particles);
    maxParticles = Math.max(maxParticles, st.particles.length);
    st.trails = NV.updateTrails(DT, st.trails);
    st.shockwaves = NV.updateShockwaves(DT, st.shockwaves);
    if (def.meteors) { const rM = NV.updateMeteors(DT, st.meteors, { W: 900, H: 520, enemies: st.enemies, boss: st.boss, shake: st.shake }, mCb); st.meteors = rM.meteors; }
    if (def.drones) st.drones = NV.updateDrones(DT, st.drones, st.player, st.bullets, st.MAX_BULLETS, st.enemies, st.boss, 300);
    if (st.boss) NV.updateBoss(DT, Object.assign({}, st));
    const u1 = performance.now();

    const d0 = performance.now();
    NV.prepareEnemyVisualBudget(st.enemies, st.player);
    for (const e of st.enemies) NV.drawSpectralEnemy2D(ctx, e, f, st.player, null);
    if (def.mines) NV.drawHazards(ctx, st.hazards, def.music ? musicRhythm(f) : null, NV.getVisualBudget(), false, st.musicalNotes, st.minefieldState.groove);
    const d1 = performance.now();

    // frameMs sintético (60fps nominal): el harness mide coste CPU de update/draw.
    perf.record(1000 / 60, u1 - u0, d1 - d0);
  }

  const snap = perf.getSnapshot();
  const budget = NV.getHostileBudget({ enemies: st.enemies, boss: st.boss && !st.boss.dead ? st.boss : null });
  return {
    scenario: key + ' — ' + def.label,
    frames,
    update: snap.update,
    draw: snap.draw,
    frame: snap.frame,
    framesAbove16_7: snap.framesAbove16_7,
    framesAbove25: snap.framesAbove25,
    framesAbove33: snap.framesAbove33,
    counts: {
      initialHostiles: initialBudget.hostiles, initialHeavy: initialBudget.heavy,
      hostiles: budget.hostiles, heavy: budget.heavy,
      playerBullets: st.playerBulletCount(), enemyBullets: st.enemyBulletCount(),
      particles: st.particles.length, maxParticles, meteors: st.meteors.length, drones: st.drones.length,
      hazards: st.hazards.length, maxHazards,
      musicalNotes: st.musicalNotes.length, maxMusicalNotes,
    },
    tier: NV.getVisualBudget().tier,
  };
}

function runAll(frames) {
  const NV = makeNV();
  const out = [];
  for (const key of Object.keys(SCENARIOS)) {
    NV.performanceMonitor.reset();
    NV.resetVisualBudget();
    out.push(runScenario(NV, key, frames));
  }
  return out;
}

function printTable(results) {
  console.log('STRESS HARNESS (headless: coste CPU de engine/render; NO es frame real de browser)');
  console.log('escenario | upd p50/p95 | draw p50/p95 | >16.7/>25/>33 | hostiles/heavy | hazards | part | tier');
  for (const r of results) {
    console.log(
      r.scenario +
      ' | upd ' + r.update.p50.toFixed(2) + '/' + r.update.p95.toFixed(2) + 'ms' +
      ' | draw ' + r.draw.p50.toFixed(2) + '/' + r.draw.p95.toFixed(2) + 'ms' +
      ' | ' + r.framesAbove16_7 + '/' + r.framesAbove25 + '/' + r.framesAbove33 +
      ' | ' + r.counts.hostiles + '/' + r.counts.heavy +
      ' | ' + r.counts.hazards +
      ' | ' + r.counts.particles + '(peak ' + r.counts.maxParticles + ')' +
      ' | ' + r.tier);
  }
}

module.exports = { runAll, SCENARIOS, makeNV };

if (require.main === module) {
  const args = process.argv.slice(2);
  let frames = 240;
  const fi = args.indexOf('--frames');
  if (fi >= 0 && args[fi + 1]) frames = parseInt(args[fi + 1], 10) || 240;
  printTable(runAll(frames));
}

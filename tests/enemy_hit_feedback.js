const fs = require('fs');
const vm = require('vm');

let pass = 0;
let fail = 0;

function test(name, fn) {
  try {
    fn();
    pass++;
    console.log('  ok  ' + name);
  } catch (error) {
    fail++;
    console.log('  FAIL ' + name + ' -> ' + error.message);
  }
}

function loadRenderers() {
  const sandbox = {
    window: {
      NV: {
        enemyRhythmBand() { return 'medios'; },
        state: { player: { x: 300, y: 250 } },
      },
    },
    console,
    Math,
  };
  vm.runInNewContext(fs.readFileSync('js/render/spectralEnemies2D.js', 'utf8'), sandbox, { filename: 'spectralEnemies2D.js' });
  vm.runInNewContext(fs.readFileSync('js/render/enemies.js', 'utf8'), sandbox, { filename: 'enemies.js' });
  vm.runInNewContext(fs.readFileSync('js/render/bosses.js', 'utf8'), sandbox, { filename: 'bosses.js' });
  return sandbox.window.NV;
}

function createContext() {
  const calls = [];
  const state = {
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    fillStyle: '#000000',
    strokeStyle: '#000000',
    shadowColor: 'rgba(0, 0, 0, 0)',
    shadowBlur: 0,
    lineWidth: 1,
  };
  const stack = [];
  const ctx = {
    calls,
    save() {
      stack.push({ ...state });
      calls.push({ op: 'save' });
    },
    restore() {
      const prior = stack.pop();
      if (!prior) throw new Error('restore sin save');
      Object.assign(state, prior);
      calls.push({ op: 'restore' });
    },
    translate() {}, rotate() {}, scale() {}, setTransform() {},
    beginPath() { calls.push({ op: 'beginPath' }); },
    closePath() {}, moveTo() {}, lineTo() {}, bezierCurveTo() {}, quadraticCurveTo() {},
    arc(x, y, radius) { calls.push({ op: 'arc', x, y, radius }); },
    ellipse() {},
    fill() { calls.push({ op: 'fill', style: state.fillStyle, alpha: state.globalAlpha, composite: state.globalCompositeOperation }); },
    stroke() { calls.push({ op: 'stroke', style: state.strokeStyle, alpha: state.globalAlpha, shadowColor: state.shadowColor, shadowBlur: state.shadowBlur }); },
    fillRect() { calls.push({ op: 'fillRect', style: state.fillStyle, alpha: state.globalAlpha }); },
    strokeRect() { calls.push({ op: 'strokeRect', style: state.strokeStyle, alpha: state.globalAlpha }); },
    clearRect() {}, fillText() {}, setLineDash() {},
    createRadialGradient() { return { addColorStop() {} }; },
    createLinearGradient() { return { addColorStop() {} }; },
    get stackDepth() { return stack.length; },
    get snapshot() { return { ...state }; },
    set globalAlpha(value) { state.globalAlpha = value; },
    get globalAlpha() { return state.globalAlpha; },
    set globalCompositeOperation(value) { state.globalCompositeOperation = value; },
    get globalCompositeOperation() { return state.globalCompositeOperation; },
    set fillStyle(value) { state.fillStyle = value; },
    get fillStyle() { return state.fillStyle; },
    set strokeStyle(value) { state.strokeStyle = value; },
    get strokeStyle() { return state.strokeStyle; },
    set shadowColor(value) { state.shadowColor = value; },
    get shadowColor() { return state.shadowColor; },
    set shadowBlur(value) { state.shadowBlur = value; },
    get shadowBlur() { return state.shadowBlur; },
    set lineWidth(value) { state.lineWidth = value; },
    get lineWidth() { return state.lineWidth; },
    set lineCap(_) {}, set lineJoin(_) {}, set font(_) {}, set textAlign(_) {}, set textBaseline(_) {},
  };
  return ctx;
}

function renderSnapshot(draw) {
  const ctx = createContext();
  const before = ctx.snapshot;
  draw(ctx);
  return { ctx, before, after: ctx.snapshot };
}

function assertRedFeedback(result, label) {
  const redFill = result.ctx.calls.some((call) => call.op === 'fill' && typeof call.style === 'string' && call.style.includes('255, 42, 75'));
  const redStroke = result.ctx.calls.some((call) => call.op === 'stroke' && call.style === '#ff2a4b' && call.shadowColor === '#ff2a4b');
  if (!redFill || !redStroke) throw new Error(label + ' no dibujó relleno + contorno rojo');
  if (result.ctx.stackDepth !== 0) throw new Error(label + ' dejó save/restore desbalanceado');
  if (JSON.stringify(result.before) !== JSON.stringify(result.after)) throw new Error(label + ' filtró estado Canvas');
}

function countRectangles(result) {
  return result.ctx.calls.filter((call) => call.op === 'fillRect' || call.op === 'strokeRect').length;
}

function loadDamagePipeline() {
  const sandbox = { window: { NV: {} }, console, Math };
  for (const file of ['js/data/balance.js', 'js/engine/bullets.js']) {
    vm.runInNewContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
  }
  return sandbox.window.NV;
}

function updateBullets(NV, bullet, enemies) {
  return NV.updateBullets(0, {
    bullets: [bullet],
    W: 900,
    H: 520,
    player: { x: -1000, y: -1000, character: 'boti', invuln: 0, stun: 0 },
    enemies,
    boss: null,
    CHARACTERS: {},
    SHIELD_COOLDOWN: 0.9,
    applyPlayerDamage() { return { applied: false, killed: false }; },
    addFloatText() {},
    killEnemy(enemy) { enemy.dead = true; },
    applyKnockback() {},
    spawnExplosion() {},
  });
}

test('hitFlash conserva duración de 0.10 s y HIT_SLOW permanece exacto', () => {
  const NV = loadDamagePipeline();
  const expected = {
    NORMAL: { multiplier: 0.85, activeDuration: 0.15, immunity: 0.20 },
    ELITE: { multiplier: 0.90, activeDuration: 0.12, immunity: 0.23 },
    BOSS: { multiplier: 0.95, activeDuration: 0.08, immunity: 0.27 },
  };
  if (JSON.stringify(NV.HIT_SLOW) !== JSON.stringify(expected)) throw new Error('NV.HIT_SLOW cambió');
  const enemy = { x: 100, y: 100, radius: 12, hp: 100, dead: false, hitFlash: 0, hitSlowUntil: 0, hitSlowImmunity: 0 };
  updateBullets(NV, { x: 100, y: 100, vx: 0, vy: 0, damage: 10, dead: false, isEnemy: false, pierce: 1 }, [enemy]);
  if (enemy.hitFlash !== 0.10) throw new Error('hitFlash=' + enemy.hitFlash);
  if (enemy.hitSlowUntil !== 0.15 || enemy.hitSlowImmunity !== 0.35) throw new Error('hitSlow normal cambió');
});

test('pierce aplica feedback independiente a cada enemigo realmente impactado', () => {
  const NV = loadDamagePipeline();
  const enemies = Array.from({ length: 4 }, (_, index) => ({
    x: 100,
    y: 100,
    radius: 12,
    hp: 100,
    dead: false,
    hitFlash: index === 1 ? 0.04 : 0,
    hitSlowUntil: 0,
    hitSlowImmunity: 0,
  }));
  updateBullets(NV, { x: 100, y: 100, vx: 0, vy: 0, damage: 10, dead: false, isEnemy: false, pierce: 3 }, enemies);
  for (let index = 0; index < 3; index++) {
    if (enemies[index].hp !== 90 || enemies[index].hitFlash !== 0.10) throw new Error('objetivo ' + index + ' sin feedback independiente');
  }
  if (enemies[3].hp !== 100 || enemies[3].hitFlash !== 0) throw new Error('objetivo fuera de pierce fue alterado');
});

test('helper rojo usa geometría circular, restaura Canvas y nunca usa rectángulos', () => {
  const NV = loadRenderers();
  const result = renderSnapshot((ctx) => NV.drawEnemyHitFeedback(ctx, { radius: 18, hitFlash: 0.10 }, 18));
  assertRedFeedback(result, 'helper');
  if (countRectangles(result) !== 0) throw new Error('helper dibujó rectángulo');
  if (!result.ctx.calls.some((call) => call.op === 'arc' && call.radius === 20)) throw new Error('helper no siguió radio corporal');
});

test('renderer base soporta feedback rojo sin rectángulo adicional', () => {
  const NV = loadRenderers();
  const base = { x: 80, y: 90, radius: 14, color: '#44ccff', shape: 'circle', dead: false, hitFlash: 0 };
  const cold = renderSnapshot((ctx) => NV.drawEnemy(ctx, base, 20, { x: 200, y: 90 }, null));
  const hot = renderSnapshot((ctx) => NV.drawEnemy(ctx, { ...base, hitFlash: 0.10 }, 20, { x: 200, y: 90 }, null));
  assertRedFeedback(hot, 'renderer base');
  if (countRectangles(hot) !== countRectangles(cold)) throw new Error('renderer base agregó rectángulo por hit');
});

test('renderers espectrales normal, Runner, Spitter, Lab y élite soportan hitFlash', () => {
  const NV = loadRenderers();
  const variants = [
    { label: 'normal', enemyTypeId: 'drone' },
    { label: 'Runner', enemyTypeId: 'runner', behavior: 'flank' },
    { label: 'Spitter', enemyTypeId: 'spitter', behavior: 'ranged' },
    { label: 'RÁPIDO', enemyTypeId: 'runner', visualId: 'elite_velocity', isElite: true, hp: 100, maxHp: 100 },
    { label: 'specter Lab', enemyTypeId: 'specter_grunt' },
  ];
  for (const variant of variants) {
    const enemy = { x: 100, y: 100, radius: 18, color: '#55ccff', shape: 'circle', dead: false, hitFlash: 0, ...variant };
    const cold = renderSnapshot((ctx) => NV.drawSpectralEnemy2D(ctx, enemy, 30, { x: 240, y: 100 }, null));
    const hot = renderSnapshot((ctx) => NV.drawSpectralEnemy2D(ctx, { ...enemy, hitFlash: 0.10 }, 30, { x: 240, y: 100 }, null));
    assertRedFeedback(hot, variant.label);
    if (countRectangles(hot) !== countRectangles(cold)) throw new Error(variant.label + ' agregó rectángulo por hit');
  }
});

test('boss espectral y fallback comparten feedback rojo aislado', () => {
  const NV = loadRenderers();
  const boss = { x: 300, y: 180, radius: 45, hp: 300, maxHp: 300, color: '#ff5f9b', shape: 'hex', name: 'JEFE', dead: false, hitFlash: 0.10 };
  const spectral = renderSnapshot((ctx) => NV.drawSpectralBoss2D(ctx, { ...boss }, 30, { x: 300, y: 400 }, null));
  const fallback = renderSnapshot((ctx) => NV.drawBoss(ctx, { ...boss }, 30));
  assertRedFeedback(spectral, 'boss espectral');
  assertRedFeedback(fallback, 'boss fallback');
});

test('el rectángulo blanco de hitFlash fue eliminado del renderer', () => {
  const spectral = fs.readFileSync('js/render/spectralEnemies2D.js', 'utf8');
  const base = fs.readFileSync('js/render/enemies.js', 'utf8');
  if (/hitFlash[\s\S]{0,220}fillRect\s*\(/.test(spectral + base)) throw new Error('queda fillRect asociado a hitFlash');
  if (spectral.includes('fillRect(-60, -60, 120, 120)')) throw new Error('queda artefacto 120x120');
});

console.log('RESULT enemy_hit_feedback: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
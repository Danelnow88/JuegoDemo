// ===== TEST: Spitter / ESCOPURAS como enemigo de rango (FEATURE 07) =====
// Verifica: F05 (NV.enemyState) es la autoridad de estados; banda de rango
// [SPIT_NEAR, SPIT_FAR] (lejos->approach, en banda->strafe, cerca->retreat);
// strafe persistente sin jitter; WINDUP real (cero spawn + aim snapshot +
// lead parcial topado) -> ATTACK = 1 disparo de la familia existente sin homing
// -> RECOVERY = ventana de castigo sin refire; Runner intacto; budgets 30/7;
// telégrafo base del windup lee intent/spitAim* (visible con calidad reducida).
const fs = require('fs'), vm = require('vm');
let pass = 0, fail = 0;
function t(n, fn) { try { fn(); pass++; console.log('  ok  ' + n); } catch (e) { fail++; console.log('  FAIL ' + n + ' -> ' + e.message); } }
function setup() {
  const m = Object.create(Math); m.random = function () { return 0.5; }; // determinista (strafe=+1, sin flips)
  const sbx = { window: { NV: {} }, console, Math: m, Object, Array, Set, Map };
  ['js/data/balance.js', 'js/data/gameData.js', 'js/engine/hostileBudget.js', 'js/engine/enemies.js', 'js/engine/enemyState.js'].forEach(function (f) {
    try { vm.runInNewContext(fs.readFileSync(f, 'utf8'), sbx, { filename: f }); } catch (e) { console.log('LOAD FAIL ' + f + ' -> ' + e.message); }
  });
  return sbx.window.NV;
}
function mkSpitter(x, y) {
  return {
    x: x, y: y, hp: 22, maxHp: 22, damage: 15, speed: 50, radius: 13, color: '#6dc4c0', shape: 'rock',
    behavior: 'ranged', enemyTypeId: 'spitter', dead: false, knockVelX: 0, knockVelY: 0, knockbackRes: 0.4,
    hostileClass: 'light', contactCd: 0, shootTimer: 0,
  };
}
function mkState(enemies, player) {
  return {
    enemies: enemies,
    player: player || { x: 650, y: 300, moveVx: 0, moveVy: 0, invuln: 0, stun: 0 },
    bullets: [], MAX_BULLETS: 10, MAX_ENEMY_BULLETS: 10,
    enemyBulletCount: function () { let n = 0; for (const b of this.bullets) if (b.isEnemy) n++; return n; },
    applyPlayerDamage: function () { return { applied: false }; },
    addFloatText: function () {}, spawnExplosion: function () {},
    MAX_HOSTILES: 30, MAX_HEAVY_HOSTILES: 7, boss: null,
  };
}
function step(NV, st, dt, frames) { for (let i = 0; i < frames; i++) NV.updateEnemies(dt, st); }

console.log('spitter_f07:');

t('spitter produccion: id spitter / ESCOPURAS / behavior ranged', function () {
  const NV = setup();
  const sp = NV.ENEMY_TYPES.find((x) => x.id === 'spitter');
  if (!sp) throw new Error('spitter no definido');
  if (sp.behavior !== 'ranged') throw new Error('behavior=' + sp.behavior);
  if (sp.name !== 'ESCOPURAS') throw new Error('nombre alterado: ' + sp.name);
  const r = NV.ENEMY_TYPES.find((x) => x.id === 'runner');
  if (!r || r.behavior !== 'flank') throw new Error('Runner modificado: behavior=' + (r && r.behavior));
});

t('F05 es autoridad: intent creado con banda preferida', function () {
  const NV = setup(), e = mkSpitter(400, 300), st = mkState([e]);
  NV.updateEnemies(0.05, st);
  if (!e.intent) throw new Error('sin intent de F05');
  if (e.intent.state !== NV.enemyState.STATE.POSITIONING) throw new Error('state=' + e.intent.state);
  if (e.intent.stateTimer <= 0) throw new Error('timer=' + e.intent.stateTimer);
  if (e.intent.preferredRange !== 250) throw new Error('preferredRange=' + e.intent.preferredRange);
});

t('demasiado lejos (>320): approach a velocidad reducida', function () {
  const NV = setup(), e = mkSpitter(100, 300), st = mkState([e], { x: 700, y: 300, moveVx: 0, moveVy: 0, invuln: 0, stun: 0 });
  const x0 = e.x;
  step(NV, st, 0.05, 12);
  if (!(e.x > x0)) throw new Error('no se acercó: x=' + e.x);
  if (e.x >= st.player.x) throw new Error('persiguió hasta el jugador: x=' + e.x);
  if (st.bullets.length !== 0) throw new Error('disparó estando lejos');
});

t('demasiado cerca (<180): RETREAT aleja del jugador', function () {
  const NV = setup(), e = mkSpitter(250, 300), st = mkState([e], { x: 300, y: 300, moveVx: 0, moveVy: 0, invuln: 0, stun: 0 });
  const x0 = e.x;
  step(NV, st, 0.05, 12);
  if (!(e.x < x0)) throw new Error('no retrocedió: x=' + e.x + ' x0=' + x0);
  if (st.bullets.length !== 0) throw new Error('disparó estando encima');
});

t('en banda: strafe lateral persistente sin jitter', function () {
  const NV = setup(), e = mkSpitter(400, 300), st = mkState([e], { x: 650, y: 300, moveVx: 0, moveVy: 0, invuln: 0, stun: 0 });
  step(NV, st, 0.05, 2); // idle -> positioning
  const s = e.spitStrafe;
  if (s !== -1 && s !== 1) throw new Error('spitStrafe=' + s);
  const y0 = e.y;
  for (let i = 0; i < 20; i++) NV.updateEnemies(0.05, st);
  if (e.spitStrafe !== s) throw new Error('strafe cambió: ' + s + '->' + e.spitStrafe);
  if (Math.abs(e.y - y0) < 1e-6 && Math.abs(e.x - 400) < 1e-6) throw new Error('sin movimiento strafe');
  if (e.intent.state !== 'positioning') throw new Error('state=' + e.intent.state);
});
t('no dispara fuera de la banda ni muy lejos ni muy cerca', function () {
  const NV = setup();
  const far = mkSpitter(100, 300), stF = mkState([far], { x: 700, y: 300, moveVx: 0, moveVy: 0, invuln: 0, stun: 0 });
  far.shootTimer = 1.6;
  step(NV, stF, 0.05, 30);
  if (stF.bullets.length !== 0) throw new Error('disparo lejano');
  const near = mkSpitter(250, 300), stN = mkState([near], { x: 300, y: 300, moveVx: 0, moveVy: 0, invuln: 0, stun: 0 });
  near.shootTimer = 1.6;
  step(NV, stN, 0.05, 30);
  if (stN.bullets.length !== 0) throw new Error('disparo cercano');
});

t('WINDUP real: cero spawn + aim snapshot; 1 disparo al expirar -> RECOVERY', function () {
  const NV = setup(), e = mkSpitter(400, 300), st = mkState([e], { x: 650, y: 300, moveVx: 0, moveVy: 0, invuln: 0, stun: 0 });
  e.shootTimer = 1.6;
  NV.updateEnemies(0.05, st); // idle -> positioning
  NV.updateEnemies(0.05, st); // positioning con timer listo -> windup
  if (e.intent.state !== 'windup') throw new Error('no windup: ' + e.intent.state);
  if (st.bullets.length !== 0) throw new Error('spawn durante windup');
  if (e.spitAimX == null || Math.abs(e.spitAimX - 650) > 1e-6) throw new Error('aimX=' + e.spitAimX);
  if (Math.abs(e.spitAimY - 300) > 1e-6) throw new Error('aimY=' + e.spitAimY);
  NV.updateEnemies(0.05, st); // mid-windup: sigue 0 proyectiles
  if (st.bullets.length !== 0) throw new Error('disparó durante windup');
  step(NV, st, 0.05, 12); // expira el timer (0.55s) -> 1 disparo + RECOVERY
  if (st.bullets.length !== 1) throw new Error('disparos=' + st.bullets.length);
  if (e.intent.state !== NV.enemyState.STATE.RECOVERY) throw new Error('no recovery: ' + e.intent.state);
  if (e.intent.stateTimer <= 0) throw new Error('recovery sin timer');
});

t('aim SNAPSHOT: mover al jugador durante windup no redirige', function () {
  const NV = setup(), e = mkSpitter(400, 300), st = mkState([e], { x: 650, y: 300, moveVx: 0, moveVy: 0, invuln: 0, stun: 0 });
  e.shootTimer = 1.6;
  NV.updateEnemies(0.05, st); NV.updateEnemies(0.05, st); // windup
  st.player.y = 460; // esquiva durante el windup
  step(NV, st, 0.05, 13);
  if (st.bullets.length !== 1) throw new Error('disparos=' + st.bullets.length);
  const b = st.bullets[0];
  const ang = Math.atan2(b.vy, b.vx);
  const exp = Math.atan2(300 - 300, 650 - 400); // snapshot (0 rad), no el jugador movido
  if (Math.abs(ang - exp) > 1e-6) throw new Error('disparo redirigido: ' + ang);
});

t('ataque usa la familia de proyectiles existente, sin homing', function () {
  const NV = setup(), e = mkSpitter(400, 300), st = mkState([e], { x: 650, y: 300, moveVx: 0, moveVy: 0, invuln: 0, stun: 0 });
  e.shootTimer = 1.6;
  NV.updateEnemies(0.05, st); NV.updateEnemies(0.05, st);
  step(NV, st, 0.05, 13);
  const b = st.bullets[0];
  if (!b) throw new Error('sin bala');
  if (!b.isEnemy) throw new Error('no es enemiga');
  if (b.sourceEnemy !== e) throw new Error('sourceEnemy');
  if (b.damage !== 15) throw new Error('damage=' + b.damage);
  if (Math.abs(Math.hypot(b.vx, b.vy) - 250) > 1e-6) throw new Error('speed=' + Math.hypot(b.vx, b.vy));
  if (b.homing !== undefined || b.seek !== undefined || b.curve !== undefined) throw new Error('homing presente');
});
t('lead parcial y topado (factor 0.5, cap 60)', function () {
  const NV = setup(), e = mkSpitter(400, 300), st = mkState([e], { x: 650, y: 300, moveVx: 900, moveVy: 0, invuln: 0, stun: 0 });
  e.shootTimer = 1.6;
  NV.updateEnemies(0.05, st); NV.updateEnemies(0.05, st);
  if (e.intent.state !== 'windup') throw new Error('no windup');
  const leadX = e.spitAimX - 650, leadY = e.spitAimY - 300;
  const lm = Math.hypot(leadX, leadY);
  if (lm > 60 + 1e-6) throw new Error('cap superado: ' + lm);
  if (lm < 59) throw new Error('no alcanzó el cap: ' + lm);
  if (!(leadX < 900)) throw new Error('predicción completa (lead=' + leadX + ')');
});

t('RECOVERY: ventana de castigo sin refire inmediato', function () {
  const NV = setup(), e = mkSpitter(400, 300), st = mkState([e], { x: 650, y: 300, moveVx: 0, moveVy: 0, invuln: 0, stun: 0 });
  e.shootTimer = 1.6;
  NV.updateEnemies(0.05, st); NV.updateEnemies(0.05, st);
  step(NV, st, 0.05, 13); // dispara -> recovery (1.0s)
  if (st.bullets.length !== 1) throw new Error('disparos=' + st.bullets.length);
  step(NV, st, 0.05, 19); // 0.95s más: recovery activo sin refire
  if (st.bullets.length !== 1) throw new Error('refire durante recovery: ' + st.bullets.length);
  const s = e.intent.state;
  if (s !== 'recovery' && s !== 'positioning') throw new Error('state=' + s);
  // tras recovery completo + positioning, shootTimer reseteado -> no dispara al instante
  step(NV, st, 0.05, 10); // 0.5s extra
  if (st.bullets.length !== 1) throw new Error('se disparó sin acumular ciclo: ' + st.bullets.length);
});

t('presupuesto 30/7 intacto y spitter sigue siendo light', function () {
  const NV = setup();
  if (NV.BALANCE.MAX_HOSTILES !== 30 || NV.BALANCE.MAX_HEAVY_HOSTILES !== 7) throw new Error('budget');
  const e = mkSpitter(200, 200);
  if (NV.hostileClassOf(e) !== 'light') throw new Error('cls=' + NV.hostileClassOf(e));
  const s2 = { enemies: [], player: { x: 400, y: 300 }, MAX_HOSTILES: 30, MAX_HEAVY_HOSTILES: 7, boss: null, wave: 12, W: 900, H: 520, forceTypeId: 'spitter', ENEMY_TYPES: NV.ENEMY_TYPES, ELITE_TYPES: NV.ELITE_TYPES, onSpawnCandidate: function () {} };
  if (!NV.spawnEnemy(s2)) throw new Error('no spawnea');
  if (s2.enemies.length !== 1) throw new Error('len=' + s2.enemies.length);
  if (s2.enemies[0].behavior !== 'ranged') throw new Error('spawn behavior alterado');
  // tope hostiles sigue válido
  for (let i = 0; i < 40; i++) NV.spawnEnemy(s2);
  if (s2.enemies.length !== 30) throw new Error('hostiles=' + s2.enemies.length);
});

// ---- Render: telégrafo base del windup (ruta sin META_VIS, calidad reducida) ----
function mkRenderEnv() {
  const store = {};
  const calls = { strokes: 0, styles: [] };
  const base = {
    save() {}, restore() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {},
    arc() {}, ellipse() {}, fill() {}, translate() {}, setLineDash() {}, fillText() {},
    stroke() { calls.strokes++; calls.styles.push(store.strokeStyle); },
  };
  const ctx = new Proxy(base, { get(t, k) { if (k in t) return t[k]; return undefined; }, set(t, k, v) { store[k] = v; return true; } });
  return { ctx, calls, store };
}
function loadRender() {
  const NV = {};
  vm.runInNewContext(fs.readFileSync('js/render/enemies.js', 'utf8'), { window: { NV }, Math }, { filename: 'js/render/enemies.js' });
  return NV;
}
t('telégrafo windup: render base lee intent/spitAim, ausente sin windup', function () {
  const NV = loadRender();
  const player = { x: 650, y: 300 };
  const e = mkSpitter(400, 300);
  e.intent = { state: 'windup', stateTimer: 0.3 };
  e.spitAimX = 650; e.spitAimY = 300;
  const env = mkRenderEnv();
  NV.drawEnemy(env.ctx, e, 0, player, null);
  const has = env.calls.styles.filter((s) => typeof s === 'string' && s.indexOf('255,224,74') >= 0).length;
  if (has < 1) throw new Error('sin telégrafo windup en render base');
  const e2 = mkSpitter(400, 300); // sin intent
  const env2 = mkRenderEnv();
  NV.drawEnemy(env2.ctx, e2, 0, player, null);
  const without = env2.calls.styles.filter((s) => typeof s === 'string' && s.indexOf('255,224,74') >= 0).length;
  if (without !== 0) throw new Error('telégrafo sin windup: ' + without);
});

console.log('');
console.log('RESULT spitter_f07: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
// controlled_movement.js — Movimiento controlado (F02) + Dash stamina (F03).
// Simula a 120 Hz sobre el módulo real (engine/movement.js) y verifica:
// aceleración/parada/inversión, identidad por personaje, permanente con cap,
// Overdrive sin mutación de stats base, y el sistema de dash: coste, delay,
// regeneración, press-edge (sin abuso de hold), dirección (mov->aim->fallback),
// sin invuln/daño, pausa/latch, reset y ruta móvil compartida.
const fs = require('fs'), vm = require('vm');
let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; console.log('  ok  ' + name); } catch (e) { fail++; console.log('  FAIL ' + name + ' -> ' + e.message); } }
function near(actual, expected, label, eps) { eps = eps == null ? 1e-6 : eps; if (Math.abs(actual - expected) > eps) throw new Error(label + '=' + actual + ' expected=' + expected); }

const sbx = { window: { NV: {} }, console, Math, Number, Object, Array, JSON };
for (const file of ['js/data/balance.js', 'js/data/gameData.js', 'js/data/consumables.js', 'js/core/inputIntent.js', 'js/engine/movement.js', 'js/engine/consumables.js']) {
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), sbx, { filename: file });
}
const NV = sbx.window.NV;
const STEP = 1 / 120;
const measurements = { reach: [], stop: [], reverseCross: 0, reverseComplete: 0, stackedStop: 0 };

function player(base, permanentLevel) {
  const p = { x: 0, y: 0, moveVx: 0, moveVy: 0, stun: 0, overdrive: 0, agility: 1, hp: 100, invuln: 0 };
  NV.configurePlayerMovement(p, base, permanentLevel || 0);
  NV.configurePlayerDash(p);
  return p;
}

// Avanza el movimiento estándar hasta que pred devuelva true (o maxSec).
function runUntil(p, x, y, dashHeld, pred, maxSec) {
  let elapsed = 0;
  while (!pred(p) && elapsed < (maxSec || 1)) {
    NV.updatePlayerMovement(p, x || 0, y || 0, STEP);
    elapsed += STEP;
  }
  return elapsed;
}

// --- Dash helpers ---
function pressDash(p, moveX, moveY, aimX, aimY, aimActive) {
  return NV.updatePlayerDash(
    p, true, moveX || 0, moveY || 0,
    aimX == null ? 0 : aimX, aimY == null ? 0 : aimY,
    !!aimActive, 0
  );
}
function releaseDash(p, moveX, moveY) {
  return NV.updatePlayerDash(p, false, moveX || 0, moveY || 0, 0, 0, false, 0);
}
// Avanza el estado de dash por N segundos (el dash activo y el delay/regen se resuelven aquí).
function runDash(p, seconds, moveX, moveY) {
  let elapsed = 0;
  while (elapsed < seconds) {
    NV.updatePlayerDash(p, false, moveX || 0, moveY || 0, 0, 0, false, STEP);
    elapsed += STEP;
  }
  return elapsed;
}

// ===== F02: MOVIMIENTO CONTROLADO =====

t('velocidades base conservan identidad en rango compacto', () => {
  const expected = { rook: 170, boti: 195, swarm: 210, nova: 225 };
  for (const id of Object.keys(expected)) {
    if (NV.CHARACTERS[id].stats.speed !== expected[id]) throw new Error(id + '=' + NV.CHARACTERS[id].stats.speed);
  }
  if (!(expected.rook < expected.boti && expected.boti < expected.swarm && expected.swarm < expected.nova)) throw new Error('orden roto');
});

t('aceleración normal alcanza velocidad en 0.10–0.16s', () => {
  for (const base of [170, 195, 210, 225]) {
    const p = player(base, 0);
    const elapsed = runUntil(p, 1, 0, false, (q) => q.moveVx >= q.effectiveMoveSpeed - 1e-6, 1);
    measurements.reach.push(elapsed);
    if (elapsed < 0.10 || elapsed > 0.16) throw new Error(base + ' reach=' + elapsed.toFixed(4));
  }
});

t('deceleración detiene en 0.08–0.14s', () => {
  for (const base of [170, 195, 210, 225]) {
    const p = player(base, 0);
    p.moveVx = p.effectiveMoveSpeed;
    const elapsed = runUntil(p, 0, 0, false, (q) => Math.hypot(q.moveVx, q.moveVy) <= 1e-6, 1);
    measurements.stop.push(elapsed);
    if (elapsed < 0.08 || elapsed > 0.14) throw new Error(base + ' stop=' + elapsed.toFixed(4));
  }
});

t('inversión cruza cero rápido y completa antes que el modelo anterior extremo', () => {
  const p = player(225, 10);
  p.moveVx = p.effectiveMoveSpeed;
  const cross = runUntil(p, -1, 0, false, (q) => q.moveVx <= 0, 1);
  const complete = cross + runUntil(p, -1, 0, false, (q) => q.moveVx <= -q.effectiveMoveSpeed + 1e-6, 1);
  measurements.reverseCross = cross;
  measurements.reverseComplete = complete;
  if (cross > 0.07) throw new Error('cross=' + cross.toFixed(4));
  if (complete > 0.13) throw new Error('complete=' + complete.toFixed(4));
});

t('diagonal queda normalizada a la misma velocidad punta', () => {
  const axis = player(195, 0), diagonal = player(195, 0);
  runUntil(axis, 1, 0, false, (p) => p.moveVx >= p.effectiveMoveSpeed - 1e-6, 1);
  for (let i = 0; i < 30; i++) NV.updatePlayerMovement(diagonal, 1, 1, STEP, false);
  near(Math.hypot(diagonal.moveVx, diagonal.moveVy), axis.effectiveMoveSpeed, 'diagonal speed');
});

t('permanente existente se remapea y limita a +20% velocidad / +25% control', () => {
  const max = NV.movementPermanentProfile(10);
  near(max.speedMultiplier, 1.2, 'speed cap');
  near(max.controlMultiplier, 1.25, 'control cap');
  const legacyOverflow = NV.movementPermanentProfile(999);
  near(legacyOverflow.speedMultiplier, 1.2, 'legacy save cap');
  const oldSave = NV.normalizePermUpgrades({ speed: 7, damage: 2 });
  if (oldSave.speed !== 7 || oldSave.damage !== 2) throw new Error('save existente no preservado');
});

t('Overdrive es temporal y nunca muta base/permanente', () => {
  const p = player(195, 10);
  const base = p.baseMoveSpeed, permanent = p.moveSpeedPermanentMult;
  p.overdrive = 5;
  NV.updatePlayerMovement(p, 1, 0, STEP);
  near(p.effectiveMoveSpeed, 195 * 1.2 * NV.CONSUMABLES.overdrive.speedMult, 'overdrive speed');
  if (p.baseMoveSpeed !== base || p.moveSpeedPermanentMult !== permanent) throw new Error('stats base mutados');
  p.overdrive = 0;
  NV.updatePlayerMovement(p, 1, 0, STEP);
  near(p.effectiveMoveSpeed, 195 * 1.2, 'restored effective');
  if (p.baseMoveSpeed !== base || p.moveSpeedPermanentMult !== permanent) throw new Error('restauración mutó base');
});

t('soltar Overdrive conserva parada controlada', () => {
  const p = player(225, 10);
  p.overdrive = 5;
  for (let i = 0; i < 30; i++) NV.updatePlayerMovement(p, 1, 0, STEP);
  p.overdrive = 0;
  const elapsed = runUntil(p, 0, 0, false, (q) => Math.hypot(q.moveVx, q.moveVy) <= 1e-6, 1);
  measurements.stackedStop = elapsed;

t('handler Overdrive solo renueva timer, no multiplica/divide velocidad', () => {
  const p = player(195, 0);
  const before = { base: p.baseMoveSpeed, effective: p.effectiveMoveSpeed, speed: p.speed };
  NV.applyConsumable({ type: 'overdrive' }, { player: p, addFloatText() {}, triggerFlash() {} });
  if (p.overdrive !== 5) throw new Error('timer=' + p.overdrive);
  if (p.baseMoveSpeed !== before.base || p.effectiveMoveSpeed !== before.effective || p.speed !== before.speed) throw new Error('handler mutó velocidad');
});

t('Agilidad mejora control sin aumentar velocidad punta', () => {
  const normal = player(210, 0), agile = player(210, 0);
  agile.agility = 2;
  NV.updatePlayerMovement(normal, 1, 0, STEP, false);
  NV.updatePlayerMovement(agile, 1, 0, STEP, false);
  if (!(agile.moveVx > normal.moveVx)) throw new Error('agilidad no acelera control');
  for (let i = 0; i < 60; i++) { NV.updatePlayerMovement(normal, 1, 0, STEP, false); NV.updatePlayerMovement(agile, 1, 0, STEP, false); }
  near(normal.effectiveMoveSpeed, agile.effectiveMoveSpeed, 'top speed');
});

t('pausa no necesita catch-up y resume desde velocidad estable', () => {
  const p = player(195, 0);
  for (let i = 0; i < 8; i++) NV.updatePlayerMovement(p, 1, 0, STEP, false);
  const before = { x: p.x, vx: p.moveVx };
  // Pausa: game.update() no llama al sistema; el estado debe quedar congelado.
  if (p.x !== before.x || p.moveVx !== before.vx) throw new Error('estado cambió durante pausa');
  NV.updatePlayerMovement(p, 1, 0, STEP, false);
  if (!(p.x > before.x && p.moveVx >= before.vx)) throw new Error('resume inestable');
});

t('integración usa moveX/moveY existente y update O(1) sin allocations explícitas', () => {
  const game = fs.readFileSync('js/game.js', 'utf8');
  const movement = fs.readFileSync('js/engine/movement.js', 'utf8');
  if (!game.includes('NV.updatePlayerMovement(player, combatIntent.moveX, combatIntent.moveY, dt)')) throw new Error('no consume intent existente');
  if (/new\s+|\[\]|\.map\(|\.filter\(|\.reduce\(/.test(movement.slice(movement.indexOf('NV.updatePlayerMovement')))) throw new Error('allocation/iteración inesperada en update');
  if (game.includes('player.speed /=') || game.includes('player.speed *=')) throw new Error('mutación multiplicativa residual');
});

t('joystick móvil desemboca en el mismo intent y la misma autoridad de movimiento', () => {
  const mobile = fs.readFileSync('js/ui/mobileControls.js', 'utf8');
  const game = fs.readFileSync('js/game.js', 'utf8');
  if (!mobile.includes('input.setMoveLeft(v.left)') || !mobile.includes('input.setMoveRight(v.right)')) throw new Error('joystick no alimenta NV.input');
  if (!game.includes('syncMoveIntent()') || !game.includes('combatIntent.moveX, combatIntent.moveY')) throw new Error('mobile no converge al intent compartido');
});

// ===== F03: DASH STAMINA =====

t('dash consume coste exacto: desde lleno deja cero usos tras dos dashes', () => {
  const p = player(195, 0);
  if (p.dashStaminaMax !== 100 || p.dashCost !== 50) throw new Error('stamina=' + p.dashStaminaMax + '/' + p.dashCost);
  near(p.dashStamina, 100, 'stamina inicial');
  // Dash 1
  if (!pressDash(p, 1, 0)) throw new Error('primer dash no disparó');
  releaseDash(p);
  runDash(p, 0.5); // depleta dash1 (activo 0.15), delay(0.90) queda >0 -> no regen
  near(p.dashStamina, 50, 'stamina tras dash1');
  // Dash 2
  if (!pressDash(p, 1, 0)) throw new Error('segundo dash no disparó');
  releaseDash(p);
  runDash(p, 0.5);
  near(p.dashStamina, 0, 'stamina tras dash2');
  if (p.dashStamina < 0) throw new Error('stamina negativa');
});

t('sin coste suficiente el dash se niega: no baja de cero ni activa dash', () => {
  const p = player(195, 0);
  p.dashStamina = 49;
  const before = { x: p.x, y: p.y, vx: p.moveVx, vy: p.moveVy, stamina: p.dashStamina };
  const trig = pressDash(p, 1, 0);
  if (trig || p.dashActive) throw new Error('dash permitido por debajo del coste');
  if (p.dashStamina < 0) throw new Error('stamina negativa=' + p.dashStamina);
  near(p.dashStamina, 49, 'stamina no gastada');
  if (!(p.moveVx === before.vx && p.moveVy === before.vy && p.x === before.x && p.y === before.y)) throw new Error('movimiento inesperado');
});

  if (elapsed > 0.14) throw new Error('stack stop=' + elapsed.toFixed(4));
});

t('delay 0.8–1.0s y recuperación completa (~3–4s) de la reserva vacía', () => {
  const p = player(195, 0);
  // Vaciar: dos dashes.
  pressDash(p, 1, 0); releaseDash(p); runDash(p, 0.5);
  pressDash(p, 1, 0); releaseDash(p);
  if (p.dashRechargeDelay < 0.8 || p.dashRechargeDelay > 1.0) throw new Error('delay=' + p.dashRechargeDelay);
  near(p.dashStamina, 0, 'vacía');
  // Medir la recuperación completa desde vacío.
  let elapsed = 0;
  while (p.dashStamina < p.dashStaminaMax - 1e-6 && elapsed < 6) {
    NV.updatePlayerDash(p, false, 1, 0, 0, 0, false, STEP);
    elapsed += STEP;
  }
  if (elapsed < 3.2 || elapsed > 4.4) throw new Error('full regen=' + elapsed.toFixed(3));
  near(p.dashStamina, p.dashStaminaMax, 'stamina llena');
  if (p.dashActive) throw new Error('dash quedó activo');
});

t('mantener Shift no re-dispara cuando la stamina se recupera (press edge)', () => {
  const p = player(195, 0);
  if (!pressDash(p, 1, 0)) throw new Error('dash inicial no disparó');
  // Mantener Shift sostenido durante la recarga completa; jamás debe re-disparar.
  for (let i = 0; i < 600; i++) NV.updatePlayerDash(p, true, 1, 0, 0, 0, false, STEP);
  if (p.dashActive) throw new Error('dash re-disparado al recuperar stamina');
  near(p.dashStamina, 100, 'stamina recargada con hold');
});

t('liberar y volver a pulsar re-dispara el dash', () => {
  const p = player(195, 0);
  pressDash(p, 1, 0); releaseDash(p); runDash(p, 0.5);
  near(p.dashStamina, 50, 'stamina tras primer dash');
  const trig = pressDash(p, 1, 0);
  if (!trig) throw new Error('re-press no disparó');
  near(p.dashStamina, 0, 'stamina tras re-press');
});

t('dirección del dash: movimiento primero, aim como fallback, último movimiento', () => {
  // Movimiento primero.
  const p1 = player(195, 0);
  pressDash(p1, 1, 0, 0, 1, true);
  if (p1.dashDirX < 0.99 || Math.abs(p1.dashDirY) > 0.01) throw new Error('move dir=' + p1.dashDirX + ',' + p1.dashDirY);
  // Aim como fallback sin movimiento.
  const aim = NV.inputIntent.normalizeVector(0, 1);
  const p2 = player(195, 0);
  pressDash(p2, 0, 0, aim.x, aim.y, true);
  if (Math.abs(p2.dashDirX) > 0.01 || p2.dashDirY < 0.99) throw new Error('aim dir=' + p2.dashDirX + ',' + p2.dashDirY);
  // Último movimiento conocido como fallback limpio.
  const p3 = player(195, 0);
  p3.lastMoveDirX = 0; p3.lastMoveDirY = -1;
  pressDash(p3, 0, 0, 0, 0, false);
  if (Math.abs(p3.dashDirX) > 0.01 || p3.dashDirY > -0.99) throw new Error('last dir=' + p3.dashDirX + ',' + p3.dashDirY);
});

t('dash no otorga invulnerabilidad ni daño y termina por sí solo', () => {
  const p = player(195, 0);
  p.invuln = 0; p.hp = 100;
  pressDash(p, 1, 0);
  if (p.invuln !== 0) throw new Error('invulnerabilidad otorgada');
  releaseDash(p);
  runDash(p, 0.5);
  if (p.dashActive) throw new Error('dash sigue activo tras duración');
  near(p.hp, 100, 'hp intacta');
  near(p.dashStamina, 50, 'stamina tras dash');
});

t('pausa deja sin releer el estado y no re-dispara tras el latch', () => {
  const p = player(195, 0);
  pressDash(p, 1, 0); releaseDash(p);
  const frozen = { stamina: p.dashStamina, active: p.dashActive, time: p.dashTime, delay: p.dashRechargeDelay };
  // En pausa game.update() no llama al sistema: sin catch-up automático.
  if (p.dashStamina !== frozen.stamina || p.dashActive !== frozen.active) throw new Error('estado cambió sin update');
  // game.js limpia dashIntent y el latch al pausar.
  NV.resetDashPauseLatch(p, false);
  // Al reanudar, sin nuevo keydown el dashIntent queda false -> no hay dash espurio.
  for (let i = 0; i < 400; i++) NV.updatePlayerDash(p, false, 1, 0, 0, 0, false, STEP);
  if (p.dashActive) throw new Error('dash espurio tras pausa');
  near(p.dashStamina, 100, 'stamina recargada tras pausa');
  // Un press explícito posterior sí dispara.
  if (!pressDash(p, 1, 0)) throw new Error('press post-pausa no disparó');
  near(p.dashStamina, 50, 'stamina tras press post-pausa');
});

t('reiniciar partida restablece stamina completa y limpia el latch', () => {
  const p = player(195, 0);
  pressDash(p, 1, 0); releaseDash(p); runDash(p, 0.5);
  near(p.dashStamina, 50, 'stamina gastada');
  NV.configurePlayerDash(p); // startGame()/selección de personaje llaman esto
  near(p.dashStamina, 100, 'stamina reiniciada');
  if (p.dashInputHeld !== false) throw new Error('latch no limpiado al reiniciar');
  if (p.dashActive) throw new Error('dash activo tras reinicio');
});

t('botón DASH móvil desemboca en el mismo dash intent y motor', () => {
  const mobile = fs.readFileSync('js/ui/mobileControls.js', 'utf8');
  const game = fs.readFileSync('js/game.js', 'utf8');
  if (!mobile.includes("input.setSlide")) throw new Error('botón táctil no usa setSlide');
  if (!game.includes('setSlide = (v) => { combatIntent.dashIntent')) throw new Error('game no alimenta dashIntent');
  if (!game.includes('combatIntent.dashIntent')) throw new Error('update no consume dashIntent');
});

console.log('MEASURE controlled_movement: reach=' + measurements.reach.map((v) => v.toFixed(4)).join(',') +
  ' stop=' + measurements.stop.map((v) => v.toFixed(4)).join(',') +
  ' reverseCross=' + measurements.reverseCross.toFixed(4) +
  ' reverseComplete=' + measurements.reverseComplete.toFixed(4) +
  ' stackedStop=' + measurements.stackedStop.toFixed(4));
console.log('RESULT controlled_movement: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);

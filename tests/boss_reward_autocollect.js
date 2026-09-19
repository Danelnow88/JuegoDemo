// Tests Tarea #8 (real): margen real para recoger el cofre del jefe ANTES de la tienda.
// - La tienda no entra inmediatamente tras la muerte del boss.
// - Durante el margen el cofre puede recogerse manualmente.
// - Si se recoge manualmente, no se duplica.
// - Si vence el margen con el cofre pendiente, se auto-recoge (ANTES de la tienda).
// - Después del auto-pickup entra la tienda.
// - Drops normales siguen iguales.
const fs = require('fs'), vm = require('vm');
let pass = 0, fail = 0;
function t(desc, fn) { try { fn(); pass++; console.log('  ok  ' + desc); } catch (e) { fail++; console.log('  FAIL ' + desc + ' -> ' + e.message); } }

function loadNV(mathMock) {
  const sbx = { window: { NV: {} }, console, Math: mathMock || Math };
  vm.runInNewContext(fs.readFileSync('js/engine/pickups.js', 'utf8'), sbx, { filename: 'pickups.js' });
  return sbx.window.NV;
}
const NV = loadNV();

// Secuencia RNG determinista: [n=0.1 => 1 drop] [ox] [oy] [tipo=0.5 => shard]
function makeSeqNV() {
  const seq = [0.1, 0.5, 0.5, 0.5];
  return loadNV({ random: () => (seq.length > 1 ? seq.shift() : seq[0]), floor: Math.floor, hypot: Math.hypot, min: Math.min });
}

t('constantes del margen en game.js (2.25 + 2.25 ≈ 4.5s, sin tocar BOSS_WAVE_END_DURATION)', () => {
  const g = fs.readFileSync('js/game.js', 'utf8');
  if (!g.includes('const BOSS_CHEST_HOLD = 2.25;')) throw new Error('falta BOSS_CHEST_HOLD');
  if (!g.includes('const BOSS_WAVE_END_DURATION = 2.25;')) throw new Error('BOSS_WAVE_END_DURATION fue modificado');
  if (!g.includes('const WAVE_END_DURATION = 2.10;')) throw new Error('WAVE_END_DURATION fue modificado');
});

t('la tienda NO entra inmediatamente: hay hold en wave_end mientras haya cofre de boss', () => {
  const g = fs.readFileSync('js/game.js', 'utf8');
  const upd = g.indexOf('function updatePresentation');
  const bloque = g.slice(upd, g.indexOf("state === 'player_dying'", upd));
  if (!bloque.includes('BOSS_CHEST_HOLD')) throw new Error('updatePresentation no implementa el hold del cofre');
  const callHold = bloque.indexOf('presentation.hold = (presentation.hold || 0) + dt;');
  const callShop = bloque.lastIndexOf('beginShopEntrance()'); // la llamada real (los comentarios la mencionan antes)
  if (callHold < 0 || callShop < 0 || callHold > callShop) throw new Error('el hold debe ocurrir antes de beginShopEntrance');
  if (!bloque.includes("bossChests.length > 0")) throw new Error('el hold debe condicionarse al cofre pendiente');
});

t('la auto-recogida del boss corre ANTES de beginShopEntrance (no dentro)', () => {
  const g = fs.readFileSync('js/game.js', 'utf8');
  const begin = g.indexOf('function beginShopEntrance');
  const fin = g.indexOf('function finishShopEntrance', begin);
  if (g.slice(begin, fin).includes('autoCollectBossRewards()')) throw new Error('beginShopEntrance no debe auto-recoger: ya se resolvió antes');
  const upd = g.indexOf('function updatePresentation');
  const bloque = g.slice(upd, g.indexOf("state === 'player_dying'", upd));
  const ac = bloque.indexOf('autoCollectBossRewards()');
  const shop = bloque.lastIndexOf('beginShopEntrance()'); // la llamada real (un comentario la menciona antes)
  if (ac < 0 || shop < 0 || ac > shop) throw new Error('autoCollectBossRewards debe correr antes de beginShopEntrance en updatePresentation');
});

t('si el cofre se recoge manualmente durante el margen, la tienda entra sin auto-recogida', () => {
  const g = fs.readFileSync('js/game.js', 'utf8');
  const upd = g.indexOf('function updatePresentation');
  const bloque = g.slice(upd, g.indexOf("state === 'player_dying'", upd));
  // Condición del hold: pendiente = isBoss && bossChests.length > 0. Con cofre abierto
  // manualmente (bossChests vacío) NO hay hold y se va directo a beginShopEntrance.
  if (!/cofrePendiente\s*=.*presentation\.isBoss\s*&&\s*bossChests\.length > 0/.test(bloque)) {
    throw new Error('la condición del hold no depende del cofre pendiente');
  }
});

t('al vencer el margen con cofre pendiente: auto-abre ese cofre y acredita su reward', () => {
  const NVS = makeSeqNV();
  const chests = [{ x: 400, y: 300, dead: false, timer: 0 }]; // cofre sin abrir (jugador lejos)
  const pickups = []; const wp = [];
  let shards = 0, chestsAbiertos = 0;
  const res = NVS.autoCollectBossRewards({
    bossChests: chests, pickups, weaponPickups: wp, WEAPONS: [{ id: 'rifle' }],
    collectShard: (v) => { shards += v; },
    collectWeapon: () => { chestsAbiertos++; return true; },
  });
  if (res.chestsOpened !== 1 || chests[0].dead !== true) throw new Error('no auto-abrió el cofre pendiente');
  if (shards !== 5 || res.shards !== 5) throw new Error('reward del cofre no acreditada: ' + shards);
  if (pickups.length !== 1 || pickups[0].dead !== true) throw new Error('drop del cofre no consumido');
});

t('si ya se recogió manualmente, la auto-recogida NO duplica nada', () => {
  const NVS = makeSeqNV();
  const chests = [{ x: 0, y: 0, dead: false, timer: 0 }];
  const pickups = []; const wp = [];
  // Pickup manual: jugador cerca del cofre -> se abre y suelta.
  NVS.updateBossChests(0.016, chests, { x: 0, y: 0 }, pickups, wp, [{ id: 'rifle' }], () => {}, () => {});
  if (pickups.length !== 1) throw new Error('setup: esperaba 1 drop del cofre');
  // El drop se recoge a mano (updatePickups): muere y se filtra.
  const enSuelo = pickups.filter((p) => !p.dead);
  for (const p of pickups) p.dead = true;
  let shards = 0, llamadas = 0;
  const res = NVS.autoCollectBossRewards({
    bossChests: chests.filter((c) => !c.dead), pickups: enSuelo, weaponPickups: wp.filter((w) => !w.dead),
    WEAPONS: [{ id: 'rifle' }],
    collectShard: (v) => { shards += v; llamadas++; },
    collectWeapon: () => true,
  });
  if (res.chestsOpened !== 0 || llamadas !== 0 || shards !== 0 || res.shards !== 0 || res.weapons !== 0) {
    throw new Error('duplicó tras pickup manual: ' + JSON.stringify(res));
  }
});

t('después del auto-pickup entra la tienda (updatePresentation continúa a beginShopEntrance)', () => {
  const g = fs.readFileSync('js/game.js', 'utf8');
  const upd = g.indexOf('function updatePresentation');
  const bloque = g.slice(upd, g.indexOf("state === 'player_dying'", upd));
  const holdEnd = bloque.indexOf('} else {');
  if (holdEnd < 0) throw new Error('no hay rama post-margen');
  const cola = bloque.slice(holdEnd);
  // La recogida vive en la fase de animación del auto-pickup (no en el cierre
  // post-margen); la tienda sólo entra en fase 3 o en la rama sin cofre.
  if (!bloque.includes('autoCollectBossRewards()')) throw new Error('updatePresentation debe auto-recoger el cofre pendiente');
  if (cola.indexOf('beginShopEntrance()') < 0) throw new Error('tras el margen debe entrar a la tienda');
  // El hold está acotado: sólo corre con cofre pendiente y vence por margen.
  if (!bloque.includes('cofrePendiente && (presentation.hold || 0) < BOSS_CHEST_HOLD')) {
    throw new Error('el hold debe vencer por margen, no ser infinito');
  }
});

t('oleada normal (sin boss): sin hold, transición a tienda igual que siempre', () => {
  const g = fs.readFileSync('js/game.js', 'utf8');
  const upd = g.indexOf('function updatePresentation');
  const bloque = g.slice(upd, g.indexOf("state === 'player_dying'", upd));
  if (!/cofrePendiente\s*=.*presentation\.isBoss/.test(bloque)) {
    throw new Error('el hold no debe aplicar en oleadas sin boss');
  }
});

t('drops normales siguen iguales: nextWave limpia weaponPickups como siempre', () => {
  const g = fs.readFileSync('js/game.js', 'utf8');
  if (g.includes('preserveBossWeaponPickups')) throw new Error('quedó código de persistencia en game.js');
  const nw = g.indexOf('function nextWave');
  const fin = g.indexOf('if (wave % 5 === 0)', nw);
  if (!/weaponPickups\s*=\s*\[\]/.test(g.slice(nw, fin))) throw new Error('nextWave debe limpiar weaponPickups normal');
  if (typeof NV.preserveBossWeaponPickups !== 'undefined') throw new Error('preserveBossWeaponPickups debería estar eliminado');
  if (fs.readFileSync('js/engine/pickups.js', 'utf8').includes('uncredited')) throw new Error('quedó rastro de uncredited');
});

t('game.js mantiene el wiring existente del cofre (spawn, update, render, invuln cubre el margen)', () => {
  const g = fs.readFileSync('js/game.js', 'utf8');
  for (const pat of ['function spawnBossChest', 'NV.updateBossChests(', 'bossChests.push', 'function autoCollectBossRewards']) {
    if (!g.includes(pat)) throw new Error('falta: ' + pat);
  }
  const inv = g.indexOf('player.invuln = Math.max(player.invuln, presentation.duration');
  if (inv < 0 || !g.slice(inv, inv + 140).includes('BOSS_CHEST_HOLD')) throw new Error('la invulnerabilidad no cubre el margen del cofre');
});

t('caso sin recompensa válida: no crash, no undefined, no recompensa inventada', () => {
  const res = NV.autoCollectBossRewards({});
  if (!res || res.chestsOpened !== 0 || res.shards !== 0 || res.weapons !== 0) throw new Error('resultado inválido: ' + JSON.stringify(res));
  const chests = [{ x: 10, y: 10, dead: false, timer: 0 }];
  const pickups = []; const wp = [];
  const res2 = NV.autoCollectBossRewards({
    bossChests: chests, pickups, weaponPickups: wp, WEAPONS: [{ id: 'rifle' }], isEligible: () => false,
    collectShard: () => {}, collectWeapon: () => true,
  });
  if (res2.chestsOpened !== 1) throw new Error('cofre pendiente debe procesarse');
  // Shards del cofre son recompensa legítima; lo que NO puede ocurrir es un arma
  // inventada con el pool inelegible.
  if (wp.length !== 0 || res2.weapons !== 0) throw new Error('inventó arma con pool inelegible');
});

t('arma max fusión / inventario lleno: NO se consume (reglas existentes intactas)', () => {
  const w = { x: 0, y: 0, weapon: { id: 'maxeada' }, dead: false, fromBossChest: true };
  const res = NV.autoCollectBossRewards({
    bossChests: [], pickups: [], weaponPickups: [w], WEAPONS: [{ id: 'maxeada' }],
    collectWeapon: () => false, // simula max fusión / inventario lleno
  });
  if (res.weapons !== 0) throw new Error('consumió arma inelegible');
  if (w.dead) throw new Error('marcó muerto un pickup que sigue en el mundo');
});

// ---- Tarea #8c: feedback visual del auto-pickup (vuelo del cofre) ----

t('constantes de la animación dentro de rangos (0.35-0.5 vuelo, ~0.3 settle)', () => {
  const g = fs.readFileSync('js/game.js', 'utf8');
  if (!/const BOSS_CHEST_ANIM = 0\.[3-5]\d*;/.test(g)) throw new Error('falta BOSS_CHEST_ANIM en rango 0.35-0.5');
  if (!/const BOSS_CHEST_SETTLE = 0\.(2[5-9]|3[0-5]?);/.test(g)) throw new Error('falta BOSS_CHEST_SETTLE en rango ~0.25-0.35');
  if (!g.includes('const BOSS_CHEST_HOLD = 2.25;')) throw new Error('BOSS_CHEST_HOLD fue modificado');
});

function animBlock(g) {
  const upd = g.indexOf('function updatePresentation');
  const bloque = g.slice(upd, g.indexOf("state === 'player_dying'", upd));
  const animStart = bloque.indexOf('else if (cofrePendiente) {');
  const animEnd = bloque.indexOf('\n        } else {', animStart);
  return bloque.slice(animStart, animEnd);
}

t('la tienda NO entra mientras la animación de auto-pickup está activa', () => {
  const anim = animBlock(fs.readFileSync('js/game.js', 'utf8'));
  const fase1 = anim.slice(anim.indexOf('const a = presentation.chestAnim;'), anim.indexOf('if (a.t >= a.dur && !a.collected)'));
  if (fase1.includes('beginShopEntrance()')) throw new Error('la tienda entra durante el vuelo del cofre');
  if (!anim.includes('a.dur = BOSS_CHEST_SETTLE')) throw new Error('falta la pausa post-recogida que también retrasa la tienda');
});

t('autoCollectBossRewards ocurre al TERMINAR la animación (al llegar el cofre al jugador)', () => {
  const anim = animBlock(fs.readFileSync('js/game.js', 'utf8'));
  const guard = anim.indexOf('if (a.t >= a.dur && !a.collected) {');
  const ac = anim.indexOf('autoCollectBossRewards()');
  if (guard < 0 || ac < 0) throw new Error('falta la recogida al final del vuelo');
  if (ac < guard) throw new Error('la auto-recogida no está dentro del guard de fin de animación');
  // beginShopEntrance NO está en la fase de vuelo: ocurre después (fase 3 de settle).
  if (anim.includes('beginShopEntrance()')) throw new Error('la tienda no debe entrar durante el vuelo');
});

t('beginShopEntrance ocurre después del settle (fase 3), no antes', () => {
  const g = fs.readFileSync('js/game.js', 'utf8');
  const upd = g.indexOf('function updatePresentation');
  const bloque = g.slice(upd, g.indexOf("state === 'player_dying'", upd));
  // Tarea #8d: la rama de settle debe atender SOLO la fase post-recogida
  // (chestAnim.collected); si bastara con que chestAnim exista, interceptaría el
  // vuelo en el else-if-chain y el cofre nunca recorrería la distancia.
  const settleStart = bloque.indexOf('if (presentation.chestAnim && presentation.chestAnim.collected) {');
  const settleEnd = bloque.indexOf('} else if (presentation.elapsed >= presentation.duration)', settleStart);
  if (settleStart < 0 || settleEnd < 0) throw new Error('falta la fase de settle con precedencia sobre la tienda');
  const settleBranch = bloque.slice(settleStart, settleEnd);
  if (!settleBranch.includes('a.t += dt;')) throw new Error('el settle no acumula tiempo');
  const shop = settleBranch.indexOf('beginShopEntrance()');
  if (shop < 0) throw new Error('la tienda debe entrar al terminar el settle');
  if (!settleBranch.includes('presentation.chestAnim = null;')) throw new Error('el estado de animación debe limpiarse antes de la tienda');
  // El settle debe tener precedencia sobre el bloque del margen (si bossChests
  // quedó vacío tras la recogida, NO se entra a tienda sin respetar el settle).
  if (settleEnd < 0 || settleEnd <= settleStart) throw new Error('estructura inválida');
  if (!settleBranch.includes('if (a.t >= a.dur) {')) throw new Error('la tienda debe estar gated por a.t >= a.dur en el settle');
});

t('pickup manual NO activa la animación (sin cofre pendiente => rama directa a tienda)', () => {
  const g = fs.readFileSync('js/game.js', 'utf8');
  const upd = g.indexOf('function updatePresentation');
  const bloque = g.slice(upd, g.indexOf("state === 'player_dying'", upd));
  const animStart = bloque.indexOf('else if (cofrePendiente) {');
  const animEnd = bloque.indexOf('\n        } else {', animStart);
  const ramaSinCofre = bloque.slice(animEnd);
  if (!ramaSinCofre.includes('beginShopEntrance()')) throw new Error('sin cofre pendiente debe entrar directo a tienda');
  if (ramaSinCofre.includes('chestAnim')) throw new Error('sin cofre pendiente no debe haber animación');
  if (ramaSinCofre.includes('autoCollectBossRewards()')) throw new Error('sin cofre pendiente no debe auto-recoger');
});

t('la animación reutiliza el cofre existente: no genera recompensa ni RNG', () => {
  const anim = animBlock(fs.readFileSync('js/game.js', 'utf8'));
  if (anim.includes('bossChests.push')) throw new Error('la animación no debe crear cofres nuevos');
  if (anim.includes('Math.random')) throw new Error('la animación no debe tirar RNG');
  if (!anim.includes('bossChests[0]')) throw new Error('debe animar el cofre existente (bossChests[0])');
  if (!anim.includes('const ease = 1 - Math.pow(1 - prog, 3);')) throw new Error('falta el easing ease-out cúbico visible desde el inicio');
  if (anim.includes('prog * prog')) throw new Error('easing viejo (prog * prog) todavía presente');
  const guard = anim.indexOf('if (a.t >= a.dur && !a.collected) {');
  const setCollected = anim.indexOf('a.collected = true;');
  if (guard < 0 || setCollected < 0 || setCollected < guard) throw new Error('falta el flag collected: podría duplicar la recogida');
});

t('el cofre sigue la posición ACTUAL del jugador (sin destino congelado pX/pY)', () => {
  const anim = animBlock(fs.readFileSync('js/game.js', 'utf8'));
  if (anim.includes('a.pX') || anim.includes('a.pY')) throw new Error('el destino no debe ser un pX/pY congelado');
  if (!anim.includes('c.x = a.fromX + (player.x - a.fromX) * ease')) throw new Error('el cofre debe volar hacia la posición actual del jugador en X');
  if (!anim.includes('c.y = a.fromY + (player.y - a.fromY) * ease')) throw new Error('el cofre debe volar hacia la posición actual del jugador en Y');
  if (!anim.includes('c.x = player.x; c.y = player.y;')) throw new Error('al llegar debe apoyarse en la posición del jugador');
});

t('escala del vuelo: completa al inicio y reducción sólo en el tramo final', () => {
  const anim = animBlock(fs.readFileSync('js/game.js', 'utf8'));
  const linea = anim.indexOf('a.scale =');
  if (linea < 0) throw new Error('falta el cálculo de escala de la animación');
  if (!/if \(prog < 0\.65\)/.test(anim.split('\n').find((l) => l.includes('a.scale =')) || '')) {
    // búsqueda laxa: la constante de corte debe existir en la línea de escala
    if (!anim.includes('prog < 0.65')) throw new Error('la escala debe mantenerse completa durante el primer ~65% del vuelo');
  }
  if (!anim.includes('c.autoScale = a.scale;')) throw new Error('la escala calculada debe aplicarse al cofre (render)');
  if (!anim.includes('c.autoScale = 1;')) throw new Error('la escala inicial del cofre debe ser completa');
  // El render NO debe reusar el progreso del settle (evita que la escala "reviva").
  const g = fs.readFileSync('js/game.js', 'utf8');
  const render = g.slice(g.indexOf('Cofres de jefe'), g.indexOf('Cofres de jefe') + 900);
  if (render.includes('presentation.chestAnim.t / presentation.chestAnim.dur')) {
    throw new Error('el render no debe derivar la escala del t/dur del settle');
  }
});

t('updateBossChests NO abre por proximidad un cofre con autoCollect=true (control de la animación)', () => {
  // Cofre en vuelo de auto-pickup justo ENCIMA del jugador: no debe abrirse.
  const chests = [{ x: 100, y: 100, dead: false, timer: 0, autoCollect: true }];
  const pickups = []; const wp = [];
  const alive = NV.updateBossChests(0.016, chests, { x: 100, y: 100 }, pickups, wp, [{ id: 'rifle' }], () => {}, () => {});
  if (chests[0].dead) throw new Error('updateBossChests abrió un cofre bajo control de la animación');
  if (alive.length !== 1) throw new Error('el cofre en auto-pickup debe conservarse vivo en la lista');
  if (pickups.length !== 0 || wp.length !== 0) throw new Error('liberó drops antes de terminar el vuelo');
  // Sin regresión: un cofre NORMAL en la misma posición SÍ se abre por proximidad.
  const normal = [{ x: 100, y: 100, dead: false, timer: 0 }];
  const alive2 = NV.updateBossChests(0.016, normal, { x: 100, y: 100 }, pickups, wp, [{ id: 'rifle' }], () => {}, () => {});
  if (alive2.length !== 0 || !normal[0].dead) throw new Error('el pickup manual por proximidad se rompió');
});

t('render del cofre: mismo bucle/objeto, escala sólo con autoCollect', () => {
  const g = fs.readFileSync('js/game.js', 'utf8');
  const render = g.indexOf('Cofres de jefe');
  const trozo = g.slice(render, render + 900);
  if (!trozo.includes('for (const c of bossChests)')) throw new Error('render cambió de bucle');
  if (!trozo.includes('c.autoCollect')) throw new Error('falta la escala del auto-pickup en el render');
  if (!trozo.includes('ctx.scale(scale, scale)')) throw new Error('el achique del cofre no se aplica');
  if (!trozo.includes('ctx.translate(c.x, c.y)')) throw new Error('el cofre animado debe usar su posición actualizada');
});

// ---- Tarea #8d: test FUNCIONAL de la trayectoria real del auto-pickup ----
// Ejecuta el texto REAL de updatePresentation() (js/game.js) contra el motor REAL
// de pickups.js con mocks mínimos. Devuelve métricas observadas de la simulación.
function runChestScen(opts) {
  const o = opts || {};
  const g = fs.readFileSync('js/game.js', 'utf8');
  const s = g.indexOf('function updatePresentation(dt) {');
  const e = g.indexOf('// === UPDATE ===');
  const num = (n) => Number((new RegExp('const ' + n + ' = ([0-9.]+);').exec(g) || [])[1]);
  const EN = loadNV();
  const ct = {};
  ct.NV = { updateShockwaves: (dt, a) => a, updatePlayerMovement: () => {}, updateMeteors: (dt, m) => ({ meteors: m }) };
  ct.BOSS_CHEST_HOLD = num('BOSS_CHEST_HOLD');
  ct.BOSS_CHEST_ANIM = num('BOSS_CHEST_ANIM');
  ct.BOSS_CHEST_SETTLE = num('BOSS_CHEST_SETTLE');
  ct.arenaW = () => 900; ct.arenaH = () => 520;
  ct.updateParticles = () => {}; ct.updateFloatTexts = () => {}; ct.updateTrails = () => {};
  ct.shockwaves = []; ct.combatIntent = { moveX: 0, moveY: 0, dashIntent: false };
  ct.pickups = []; ct.weaponPickups = []; ct.meteors = []; ct.specialVFX = null;
  ct.addFloatText = () => {}; ct.sfxPickup = () => {};
  ct.WEAPONS = [{ id: 'rifle', name: 'Rifle', rarity: 'common' }];
  ct.isWeaponDropEligible = () => true;
  ct.updatePickups = () => {}; ct.updateWeaponPickups = () => {};
  ct.updateBombImpacts = () => {}; // #11: cola de impactos pendientes vacía aquí
  ct.updateBossChests = (dt) => {
    ct.bossChests = EN.updateBossChests(dt, ct.bossChests, ct.player, ct.pickups, ct.weaponPickups,
      ct.WEAPONS, ct.addFloatText, ct.sfxPickup, ct.isWeaponDropEligible);
  };
  ct.autoCollectCalls = 0; ct.autoCollectFrame = null; ct.shards = 0; ct.lastAutoRes = null;
  ct.autoCollectBossRewards = () => {
    ct.autoCollectCalls++;
    if (ct.autoCollectFrame === null) ct.autoCollectFrame = ct.frame;
    ct.lastAutoRes = EN.autoCollectBossRewards({
      bossChests: ct.bossChests, pickups: ct.pickups, weaponPickups: ct.weaponPickups, WEAPONS: ct.WEAPONS,
      isEligible: ct.isWeaponDropEligible, addFloatText: ct.addFloatText, pickupSfx: ct.sfxPickup,
      collectShard: (v) => { ct.shards += v; }, collectWeapon: () => true,
    });
  };
  ct.shopFrame = null;
  ct.beginShopEntrance = () => { if (ct.shopFrame === null) ct.shopFrame = ct.frame; ct.state = 'shop_enter'; };
  ct.finishPlayerDeath = () => {}; ct.finishShopEntrance = () => {};
  ct.state = 'wave_end'; ct.frame = 0; ct.transition = 0; ct.shake = 0; ct.flashAlpha = 0;
  ct.player = { x: o.playerX != null ? o.playerX : 120, y: o.playerY != null ? o.playerY : 300, invuln: 0 };
  const cx = o.chestX != null ? o.chestX : 700, cy = o.chestY != null ? o.chestY : 320;
  ct.presentation = { kind: 'wave_end', elapsed: 2.25, duration: 2.25, isBoss: true, hold: 2.25, chestAnim: null, finalized: false, targetX: 0, targetY: 0 };
  ct.bossChests = [{ x: cx, y: cy, dead: false, timer: 0 }];
  const startDist = Math.hypot(ct.player.x - cx, ct.player.y - cy);
  const updatePresentation = new Function('__c', 'with (__c) { ' + g.slice(s, e) + '\n return updatePresentation; }')(ct);
  const DT = 1 / 60;
  let maxDesp = 0, lastChest = null, flightErr = null, flightEndX = null, sawAnim = false;
  for (let i = 0; i < 400; i++) {
    ct.frame = i;
    if (typeof o.movePlayer === 'function') o.movePlayer(ct.player, i, DT);
    updatePresentation(DT);
    const c = ct.bossChests[0];
    if (c) {
      lastChest = [c.x, c.y];
      maxDesp = Math.max(maxDesp, Math.hypot(c.x - cx, c.y - cy));
      const a = ct.presentation.chestAnim;
      if (a && !a.collected) { sawAnim = true; flightErr = Math.hypot(c.x - ct.player.x, c.y - ct.player.y); flightEndX = c.x; }
    }
    if (ct.state !== 'wave_end') break;
  }
  const leftovers = ct.pickups.filter((p) => !p.dead).length + ct.weaponPickups.filter((w) => !w.dead).length;
  return {
    ct, startDist, maxDesp, lastChest, flightErr, flightEndX, sawAnim, leftovers,
    playerFinal: [ct.player.x, ct.player.y],
    autoCollectCalls: ct.autoCollectCalls, autoCollectFrame: ct.autoCollectFrame, shopFrame: ct.shopFrame,
    chestsLeft: ct.bossChests.length, shards: ct.shards, drops: ct.pickups.length, weaponDrops: ct.weaponPickups.length,
    anim: ct.BOSS_CHEST_ANIM, settle: ct.BOSS_CHEST_SETTLE, hold: ct.BOSS_CHEST_HOLD,
  };
}

t('FUNCIONAL: el cofre recorre la distancia completa, acredita UNA vez y luego entra la tienda', () => {
  const r = runChestScen({});
  if (r.startDist < 400) throw new Error('escenario inválido');
  if (r.maxDesp < r.startDist * 0.95) {
    throw new Error('el cofre sólo recorrió ' + r.maxDesp.toFixed(1) + 'px de ' + r.startDist.toFixed(1) + 'px (vuelo interrumpido)');
  }
  if (r.autoCollectCalls !== 1) throw new Error('auto-recogida llamada ' + r.autoCollectCalls + ' veces (se esperaba 1)');
  if (r.shopFrame === null) throw new Error('la tienda nunca entró');
  if (!(r.autoCollectFrame < r.shopFrame)) throw new Error('la recogida debe ocurrir ANTES de la tienda');
  // Vuelo ≈ BOSS_CHEST_ANIM y settle ≈ BOSS_CHEST_SETTLE (márgenes de 2 frames).
  const flightFrames = r.autoCollectFrame;
  if (Math.abs(flightFrames - r.anim * 60) > 2) throw new Error('el vuelo duró ' + flightFrames + ' frames (esperado ~' + (r.anim * 60) + ')');
  if (Math.abs((r.shopFrame - r.autoCollectFrame) - r.settle * 60) > 2) throw new Error('el settle duró ' + (r.shopFrame - r.autoCollectFrame) + ' frames (esperado ~' + (r.settle * 60) + ')');
  if (!r.ct.lastAutoRes || r.ct.lastAutoRes.chestsOpened !== 1) throw new Error('el cofre pendiente no se abrió en la auto-recogida');
  if (r.chestsLeft !== 0) throw new Error('quedó cofre pendiente tras la auto-recogida');
  if (r.leftovers !== 0) throw new Error('quedaron drops del cofre sin acreditar: ' + r.leftovers);
  if (r.flightErr === null || r.flightErr > 1) throw new Error('al terminar el vuelo el cofre no está sobre el jugador (err=' + r.flightErr + ')');
  if (r.ct.presentation.chestAnim !== null) throw new Error('chestAnim no se limpió antes de la tienda');
});

t('FUNCIONAL: con el jugador en movimiento el cofre persigue su posición ACTUAL', () => {
  const r = runChestScen({ movePlayer: (p) => { p.x = Math.min(860, p.x + 1.2); } });
  if (r.flightErr === null || r.flightErr > 1) throw new Error('el cofre no alcanzó al jugador en movimiento (err=' + r.flightErr + ')');
  if (!(r.flightEndX > 130)) throw new Error('el cofre terminó en x=' + r.flightEndX + ': parece seguir un destino congelado');
  if (r.autoCollectCalls !== 1) throw new Error('auto-recogida llamada ' + r.autoCollectCalls + ' veces');
  if (!(r.autoCollectFrame < r.shopFrame)) throw new Error('la tienda entró antes de la recogida');
});

t('FUNCIONAL: pickup manual durante el margen — sin animación, sin auto-recogida, sin duplicados', () => {
  const r = runChestScen({ chestX: 120, chestY: 300 }); // el jugador ya está sobre el cofre
  if (r.autoCollectCalls !== 0) throw new Error('el pickup manual no debe disparar la auto-recogida');
  if (r.sawAnim) throw new Error('no debe haber animación si el cofre ya se abrió a mano');
  if (r.ct.presentation.chestAnim !== null) throw new Error('no debe crearse chestAnim en el pickup manual');
  // Ojo: updatePresentation hace frame++ al entrar, así que los frames son 1-based:
  // "1" = mismo frame en que el cofre se abre por proximidad.
  if (r.shopFrame > 1) throw new Error('sin cofre pendiente la tienda debe entrar de inmediato (frame ' + r.shopFrame + ')');
  if (r.chestsLeft !== 0) throw new Error('el cofre manual debe quedar consumido');
  // El cofre suelta 1-3 drops, que pueden ser shards y/o armas (tipo aleatorio).
  const totalDrops = r.drops + r.weaponDrops;
  if (totalDrops < 1 || totalDrops > 3) throw new Error('drops del cofre fuera de rango: ' + totalDrops);
  if (r.ct.pickups.some((p) => !p.fromBossChest)) throw new Error('los shards del cofre deben conservar su marca');
  if (r.ct.weaponPickups.some((w) => !w.fromBossChest)) throw new Error('las armas del cofre deben conservar su marca');
});

console.log('RESULT boss_reward_autocollect: pass=' + pass + ' fail=' + fail);


process.exit(fail ? 1 : 0);

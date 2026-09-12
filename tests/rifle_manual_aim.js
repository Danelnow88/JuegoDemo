// FEATURE 04 — RIFLE MANUAL-AIM IDENTITY.
// Verifica la identidad del Rifle como primera arma habilidosa: disparo manual exacto a lo
// largo de aimVector, cadencia estable, legacy-auto con la MISMA pipeline, contrato de pierce
// explícito (pierce = TOTAL de objetivos dañables), penetración finita 2 = primario + 1,
// compatibilidad con nivel/fusión, pausa/reset sin doble disparo, cambio de política sin
// duplicado, móvil→legacy-auto, independencia del dash y waveWeaponMult desconectado (F04
// documenta y NO habilita el scaler global).
const fs = require('fs'), vm = require('vm');
let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; console.log('  ok  ' + name); } catch (e) { fail++; console.log('  FAIL ' + name + ' -> ' + e.message); } }
function near(a, b, l) { if (Math.abs(a - b) > 1e-6) throw new Error((l || 'v') + '=' + a + ' expected=' + b); }

// Math determinista: sin críticos aleatorios (random siempre 0.99) para daño exacto.
const MathMock = Object.create(Math);
MathMock.random = () => 0.99;

function load(files, nv) {
  const sbx = { window: { NV: nv || {} }, console, Math: MathMock, Number, Object, Array, JSON };
  for (const f of files) vm.runInNewContext(fs.readFileSync(f, 'utf8'), sbx, { filename: f });
  return sbx.window.NV;
}

const NV = load(['js/data/balance.js', 'js/data/gameData.js', 'js/engine/weapons.js', 'js/engine/boss.js', 'js/engine/bullets.js', 'js/core/inputIntent.js']);
const rifle = NV.weaponById('rifle');
const RIFLE_INTERVAL = 25 / 60; // fireRate se interpreta a 60fps

function shootRifle(extraState) {
  const bullets = [];
  const state = Object.assign({
    player: { x: 0, y: 20, luck: 0, permCrit: 0, overdrive: 0 },
    enemies: [{ x: -100, y: 20, dead: false }], boss: null, bullets,
    currentWeapon: rifle,
    currentWeaponLevel: () => 1, weaponVisualTier: () => 0, BULLET_TIER_COLORS: ['#fff'], MAX_BULLETS: 100,
    permDamageBonus: 0, playWeaponSound() {}, currentWeaponFusion: 0, fusionStep: 0.2,
    onTarget() {},
  }, extraState || {});
  const fired = NV.shoot(state);
  return { bullets, state, fired };
}

function updateOnce(NV, bullets, enemies, boss) {
  const st = {
    bullets, W: 900, H: 520,
    player: { x: -1000, y: -1000, character: 'boti', bulwark: 0, invuln: 0, stun: 0 },
    enemies, boss, CHARACTERS: NV.CHARACTERS, SHIELD_COOLDOWN: 0.9,
    applyPlayerDamage: () => ({ applied: true, dodged: false, damage: 1, crit: false, killed: false }),
    addFloatText() {}, killEnemy(e) { e.dead = true; }, applyKnockback() {}, spawnExplosion() {},
  };
  return NV.updateBullets(0, st);
}

// ===== Identidad =====
t('F04: el Rifle es un arma estable de línea: damage 20 / cadencia 25 / range 480 / pierce 2', () => {
  if (rifle.damage !== 20 || rifle.fireRate !== 25 || rifle.range !== 480 || rifle.speed !== 700 || rifle.pierce !== 2) throw new Error(JSON.stringify(rifle));
  const impact = NV.weaponImpactProfile(rifle);
  if (impact.type !== 'pierce' || impact.pierce !== 2) throw new Error(JSON.stringify(impact));
});

// ===== Manual =====
t('F04: manual dispara exactamente a lo largo de aimVector sin autocorregir al enemigo', () => {
  let reported = 'unset';
  const { bullets } = shootRifle({
    aimVector: { x: 1, y: 0 },
    enemies: [{ x: -100, y: 20, dead: false }], // enemigo en la dirección OPUESTA
    onTarget: (tg) => { reported = tg === null ? 'null' : 'target'; },
  });
  if (bullets.length !== 1) throw new Error('bullets=' + bullets.length);
  const b = bullets[0];
  if (!(b.vx > 0)) throw new Error('no disparó a la derecha vx=' + b.vx);
  near(b.vy, 0, 'vy');
  const hyp = Math.hypot(b.vx, b.vy);
  near(b.vx / hyp, 1, 'dirX'); near(b.vy / hyp, 0, 'dirY');
  if (reported !== 'null') throw new Error('manual NO debe resolver objetivo: ' + reported);
});

t('F04: el Rifle manual es preciso sin spread/recoil: disparos idénticos para el mismo aim', () => {
  if ('spread' in rifle && rifle.spread !== 0) throw new Error('rifle define spread');
  const rg = [...Array(6)].map(() => shootRifle({ aimVector: { x: 7, y: 24 } }).bullets[0]);
  for (const b of rg.slice(1)) {
    if (Math.abs(b.vx - rg[0].vx) > 1e-9 || Math.abs(b.vy - rg[0].vy) > 1e-9) throw new Error('spread/recoil alteró ángulo');
  }
});

// ===== Cadencia =====
t('F04: cadencia manual respeta el intervalo del Rifle (25/60) y un press = un disparo', () => {
  let shots = 0;
  const r0 = NV.inputIntent.advanceFireCadence(0, 1 / 120, true, false, () => { shots++; return true; }, RIFLE_INTERVAL, 4 / 60);
  if (shots !== 1 || !r0.fired) throw new Error('press inicial shots=' + shots);
  const spikes = [];
  let timer = r0.timer;
  for (let tick = 1; tick < 240; tick++) {
    const r = NV.inputIntent.advanceFireCadence(timer, 1 / 120, true, false, () => { spikes.push(tick); return true; }, RIFLE_INTERVAL, 4 / 60);
    timer = r.timer;
  }
  if (spikes.length < 4) throw new Error('pocos disparos sostenidos: ' + spikes.length);
  let prev = 0;
  for (const s of spikes) {
    const gap = (s - prev) * (1 / 120);
    if (gap < RIFLE_INTERVAL - 0.002) throw new Error('gap=' + gap.toFixed(4) + ' < intervalo ' + RIFLE_INTERVAL.toFixed(4));
    prev = s;
  }
});

// ===== Legacy auto =====
t('F04: legacy-auto usa la MISMA pipeline del Rifle y apunta al más cercano', () => {
  let reported = 'unset';
  const { bullets } = shootRifle({
    enemies: [{ x: 200, y: 20, dead: false }, { x: -100, y: 20, dead: false }],
    onTarget: (tg) => { reported = tg && !tg.dead ? 'target' : 'none'; },
  });
  if (bullets.length !== 1 || !(bullets[0].vx < 0)) throw new Error('auto no apuntó al más cercano (izquierda)');
  if (reported !== 'target') throw new Error('onTarget=' + reported);
  // Mismas propiedades de bala que el manual: solo cambia la dirección.
  const man = shootRifle({ aimVector: { x: 0, y: 1 } }).bullets[0];
  const aut = bullets[0];
  if (man.damage !== aut.damage || man.pierce !== aut.pierce || man.impactType !== aut.impactType || man.wid !== aut.wid) throw new Error('pipeline distinta manual/auto');
  near(Math.hypot(man.vx, man.vy), Math.hypot(aut.vx, aut.vy), 'speed');
});

// ===== Contrato de pierce (explícito) =====
t('F04: CONTRATO pierce explícito: rifle 2 = objetivo primario + 1 adicional (TOTAL)', () => {
  const b = shootRifle({ aimVector: { x: 1, y: 0 } }).bullets[0];
  if (b.impactType !== 'pierce') throw new Error('impactType=' + b.impactType);
  if (b.bounceLeft !== 0 || b.splashRadius !== 0) throw new Error('rifle no debe rebotar ni explotar');
  if (b.pierce !== 2) throw new Error('pierce=' + b.pierce);
});

t('F04: penetración finita exacta — daña 2 y el tercero queda intacto, bala muere', () => {
  const bullets = [{ x: 100, y: 100, vx: 0, vy: 0, damage: 10, dead: false, isEnemy: false, pierce: 2, impactType: 'pierce', hitTargets: [], bounceLeft: 0, splashRadius: 0, wid: 'rifle' }];
  const enemies = Array.from({ length: 3 }, () => ({ x: 100, y: 100, radius: 10, hp: 100, dead: false }));
  const res = updateOnce(NV, bullets, enemies, null);
  const damaged = enemies.filter((e) => e.hp === 90).length;
  if (damaged !== 2) throw new Error('damaged=' + damaged);
  if (enemies[2].hp !== 100) throw new Error('el tercero no debe recibir daño');
  if (res.bullets.length !== 0) throw new Error('bala viva tras alcanzar el tope (penetración infinita)');
});

// ===== Nivel / fusión =====
t('F04: nivel y fusión se conservan en el Rifle (daño base + bono nivel + fusión)', () => {
  const { bullets } = shootRifle({
    currentWeaponLevel: () => 10, currentWeaponFusion: 3, fusionStep: 0.2,
  });
  // (20 + weaponLevelDamageBonus(10)=10) × ×1 (wave ausente) × (1+3×0.2)=1.6 → round(30×1.6)=48
  const expected = Math.round(30 * 1.6);
  if (bullets[0].damage !== expected) throw new Error('damage=' + bullets[0].damage + ' expected=' + expected);
});

// ===== Pausa / reset =====
t('F04: pausa bloquea el fuego y resume sin doble disparo (cadencia compartida)', () => {
  let shots = 0;
  const r = NV.inputIntent.advanceFireCadence(0, 1 / 120, true, true, () => { shots++; return true; }, RIFLE_INTERVAL, 4 / 60);
  if (shots !== 0) throw new Error('disparó pausado');
  const r2 = NV.inputIntent.advanceFireCadence(r.timer, 0, true, false, () => { shots++; return true; }, RIFLE_INTERVAL, 4 / 60);
  if (shots !== 1 || !r2.fired) throw new Error('resume shots=' + shots);
});

// ===== Cambio de política =====
t('F04: cambiar de política no duplica disparo (una pipeline, cadencia compartida + reset)', () => {
  const game = fs.readFileSync('js/game.js', 'utf8');
  if ((game.match(/NV\.shoot\(\{/g) || []).length !== 1) throw new Error('más de una pipeline NV.shoot');
  if (!game.includes('combatIntent.firePolicy = settings.controls.firePolicy') || !game.includes('combatIntent.fireIntent = false') || !game.includes('fireTimer = 0')) throw new Error('game.js no resetea intención/cadencia al cambiar política');
  let timer = 0, shots = 0, maxPerTick = 0;
  for (let i = 0; i < 240; i++) {
    if (i === 60) timer = 0; // reset de game.js en el switch manual→auto
    let perTick = 0;
    const r = NV.inputIntent.advanceFireCadence(timer, 1 / 120, true, false, () => { shots++; perTick++; return true; }, RIFLE_INTERVAL, 4 / 60);
    maxPerTick = Math.max(maxPerTick, perTick);
    timer = r.timer;
  }
  if (maxPerTick > 1) throw new Error('doble disparo en un tick');
  if (shots < 5) throw new Error('shots=' + shots);
});

// ===== Móvil =====
t('F04: móvil fuerza legacy-auto y dispara por la MISMA pipeline del Rifle', () => {
  const intent = NV.inputIntent.createCombatIntent('manual');
  if (NV.inputIntent.effectiveFirePolicy(intent, true) !== 'legacy-auto') throw new Error('mobile no fuerza auto');
  const { bullets } = shootRifle(); // sin aimVector → camino legacy
  const b = bullets[0];
  if (b.pierce !== 2 || b.impactType !== 'pierce') throw new Error('pipeline móvil distinta');
});

// ===== Independencia del dash (F01–F03 cerradas) =====
t('F04: el dash no altera daño/pierce/velocidad/cadencia del Rifle', () => {
  const base = shootRifle({ aimVector: { x: 1, y: 0 } }).bullets[0];
  const dashing = shootRifle({ aimVector: { x: 1, y: 0 }, player: { x: 0, y: 20, luck: 0, permCrit: 0, overdrive: 0, dashActive: true, dashStamina: 0, dashTime: 0.1 } }).bullets[0];
  if (base.damage !== dashing.damage || base.pierce !== dashing.pierce) throw new Error('dash alteró daño/pierce');
  near(Math.hypot(base.vx, base.vy), Math.hypot(dashing.vx, dashing.vy), 'speed');
});

// ===== waveWeaponMult (re-verificado; NO habilitado en F04) =====
t('F04: waveWeaponMult sigue desconectado en producción — documentado, no habilitado', () => {
  const game = fs.readFileSync('js/game.js', 'utf8');
  const call = game.match(/NV\.shoot\(\{[\s\S]*?\n    \}\)/);
  if (!call) throw new Error('no localicé el call de shoot');
  if (/\bwave\s*:/.test(call[0])) throw new Error('shoot PASÓ wave: scaler conectado — revisar impacto antes de habilitar');
  if (NV.waveWeaponMult(undefined) !== 1) throw new Error('wave undefined no cae a ×1');
  const src = fs.readFileSync('js/engine/weapons.js', 'utf8');
  if (!src.includes('NV.waveWeaponMult(state.wave)')) throw new Error('shoot dejó de ser único consumidor de waveWeaponMult');
  // F04 no silenciosamente activa un scaler global: el daño del Rifle sin `wave` = base+nivel+fusión (×1).
  const { bullets } = shootRifle();
  const expected = Math.round((20 + NV.weaponLevelDamageBonus(1)) * 1);
  if (bullets[0].damage !== expected) throw new Error('daño=' + bullets[0].damage + ' esperado=' + expected);
});

// ===== Visual: línea legible sin FX nuevos =====
t('F04: proyectil Rifle conserva una forma de línea legible (sin FX por frame nuevos)', () => {
  const def = NV.BULLET_DEFS.rifle && NV.BULLET_DEFS.rifle.shape;
  if (def !== 'bullet') throw new Error('forma=' + def);
  if (NV.BULLET_DEFS.rifle.len < 9) throw new Error('len pequeño ilegible');
  if (!fs.readFileSync('js/render/projectiles.js', 'utf8').includes('def.shape')) throw new Error('render no consume BULLET_DEFS');
});

console.log('RESULT rifle_manual_aim: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
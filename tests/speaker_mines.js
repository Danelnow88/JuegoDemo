// P3: Campo Minado / Speaker Mines — lifecycle, daño, placement, ritmo y render.
const fs = require('fs'), vm = require('vm');
let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; console.log('  ok  ' + name); } catch (e) { fail++; console.log('  FAIL ' + name + ' -> ' + e.message); } }
function load(f, sbx) { vm.runInNewContext(fs.readFileSync(f, 'utf8'), sbx, { filename: f }); }
function sandbox(withRender) {
  const math = Object.create(Math);
  const sbx = { window: { NV: {} }, console, Math: math, Object, Array, Set, Map, WeakSet, Date, JSON };
  load('js/data/balance.js', sbx); load('js/data/gameData.js', sbx); load('js/engine/rhythm.js', sbx); load('js/engine/combat.js', sbx); load('js/engine/hazards.js', sbx); load('js/engine/enemies.js', sbx);
  if (withRender) load('js/render/hazards.js', sbx);
  return sbx;
}
function mine(over) {
  return Object.assign({
    type: 'speakerMine', state: 'spawning', stateTime: 0, simTime: 0,
    x: 200, y: 200, visualRadius: 16, triggerRadius: 14, phaseOffset: 0,
    grooveMode: 'idle', grooveBlend: 0, musicGrace: 0,
    kickImpulse: 0, kickLatched: false, smoothedEnergy: 0,
    accentImpulse: 0, accentLatched: false,
  }, over || {});
}
function ctx(over) {
  return Object.assign({ waveEvent: 'mines', wave: 3, boss: null, transitioning: false, player: { x: 450, y: 450 }, playerRadius: 9, W: 900, H: 520, rhythm: null, shake: 0, applyPlayerDamage() { return { applied: true, killed: false }; }, spawnExplosion() {}, spawnShockwave() {}, triggerFlash() {}, sfx: {} }, over || {});
}

t('lifecycle: spawning telegraph sin daño -> armed -> detonating -> dead', () => {
  const NV = sandbox().window.NV, hazards = [mine()], state = NV.createMinefieldState();
  state.spawnTimer = 999; // aislar lifecycle: sin reposición del controlador
  let hits = 0;
  let r = NV.updateSpeakerMines(0.89, hazards, state, ctx({ player: { x: 200, y: 200 }, applyPlayerDamage() { hits++; return { applied: true }; } }));
  if (r.hazards[0].state !== 'spawning' || hits) throw new Error('telegraph dañó');
  r = NV.updateSpeakerMines(0.02, hazards, state, ctx({ player: { x: 200, y: 200 }, applyPlayerDamage() { hits++; return { applied: true }; } }));
  if (r.hazards[0].state !== 'armed' || hits) throw new Error('armado incorrecto');
  r = NV.updateSpeakerMines(0.01, hazards, state, ctx({ player: { x: 200, y: 200 }, applyPlayerDamage() { hits++; return { applied: true }; } }));
  if (r.hazards[0].state !== 'detonating' || hits !== 1) throw new Error('detonación incorrecta');
  r = NV.updateSpeakerMines(0.13, hazards, state, ctx());
  if (r.hazards.length !== 0) throw new Error('dead no limpiado');
});

t('single application: frames superpuestos, dos callbacks y mina detonada aplican una vez', () => {
  const NV = sandbox().window.NV, m = mine({ state: 'armed' });
  let hits = 0;
  const c = ctx({ applyPlayerDamage() { hits++; return { applied: true, killed: false }; } });
  if (!NV.detonateSpeakerMine(m, c)) throw new Error('primera no detonó');
  if (NV.detonateSpeakerMine(m, c) || NV.detonateSpeakerMine(m, c)) throw new Error('callback duplicado aceptado');
  const hazards = [m], st = NV.createMinefieldState();
  NV.updateSpeakerMines(0.03, hazards, st, ctx({ player: { x: m.x, y: m.y }, applyPlayerDamage() { hits++; return { applied: true }; } }));
  if (hits !== 1) throw new Error('hits=' + hits);
});

t('damage scaling: base 38 +0.5/wave redondeado, cap 52', () => {
  const NV = sandbox().window.NV;
  if (NV.speakerMineDamage(0) !== 38 || NV.speakerMineDamage(4) !== 40 || NV.speakerMineDamage(100) !== 52) throw new Error('curva incorrecta');
});

t('damage usa pipeline: no crit/dodge, respeta armor e invulnerabilidad', () => {
  const NV = sandbox().window.NV;
  let critCalls = 0;
  const player = { character: 'rook', hp: 100, maxHp: 100, armor: 4, permDodge: 99, invuln: 0, x: 0, y: 0 };
  const apply = (base, opts) => NV.applyPlayerDamage(base, { player, CHARACTERS: NV.CHARACTERS, calcEnemyDamage() { critCalls++; return { dmg: 999, crit: true }; }, addFloatText() {}, sfx: {}, cause: opts.cause, allowCrit: opts.allowCrit, allowDodge: opts.allowDodge });
  NV.detonateSpeakerMine(mine({ state: 'armed' }), ctx({ wave: 4, applyPlayerDamage: apply }));
  // wave4=40, armor4 =>36, ROOK x0.85 =>31.
  if (player.hp !== 69 || critCalls !== 0) throw new Error('hp=' + player.hp + ' crit=' + critCalls);
  const protectedPlayer = Object.assign({}, player, { hp: 100, invuln: 1 });
  const protectedApply = (base, opts) => NV.applyPlayerDamage(base, { player: protectedPlayer, CHARACTERS: NV.CHARACTERS, calcEnemyDamage() { throw new Error('crit'); }, addFloatText() {}, sfx: {}, cause: opts.cause, allowCrit: opts.allowCrit, allowDodge: opts.allowDodge });
  NV.detonateSpeakerMine(mine({ state: 'armed' }), ctx({ applyPlayerDamage: protectedApply }));
  if (protectedPlayer.hp !== 100) throw new Error('atravesó invulnerabilidad');
});

t('damage letal propaga onPlayerKilled/gameOver una sola vez', () => {
  const NV = sandbox().window.NV, m = mine({ state: 'armed' });
  let deaths = 0;
  const c = ctx({ applyPlayerDamage() { return { applied: true, killed: true }; }, onPlayerKilled() { deaths++; } });
  NV.detonateSpeakerMine(m, c); NV.detonateSpeakerMine(m, c);
  if (deaths !== 1) throw new Error('deaths=' + deaths);
});

t('budget independiente: nunca supera 6 y boss bloquea spawn', () => {
  const NV = sandbox().window.NV, hazards = [], state = NV.createMinefieldState();
  const seq = [0.05, 0.1, 0.15, 0.2, 0.8, 0.25, 0.85, 0.3, 0.9, 0.35, 0.95, 0.4]; let i = 0;
  const c = ctx({ wave: 99, player: { x: 450, y: 450 }, random: () => seq[(i++) % seq.length] });
  for (let f = 0; f < 500; f++) NV.updateSpeakerMines(0.1, hazards, state, c);
  if (hazards.length > 6) throw new Error('hazards=' + hazards.length);
  const before = hazards.length;
  NV.spawnSpeakerMine(hazards, state, Object.assign({}, c, { boss: { dead: false } }));
  if (hazards.length !== before) throw new Error('spawn con boss');
});

t('safe placement: distancia jugador, separación y agotamiento sin loop infinito', () => {
  const NV = sandbox().window.NV, player = { x: 450, y: 260 };
  let n = 0;
  const p = NV.findSpeakerMinePosition([], player, 900, 520, () => [0, 0, 0.95, 0.95][(n++) % 4]);
  if (!p || Math.hypot(p.x - player.x, p.y - player.y) < 175) throw new Error('placement cerca');
  const occupied = [mine({ state: 'armed', x: 450, y: 260 })];
  let calls = 0;
  const none = NV.findSpeakerMinePosition(occupied, player, 900, 520, () => { calls++; return 0.5; });
  // P3.1 consume una llamada adicional para decidir táctico/distribuido; siguen
  // siendo como máximo 24 candidatos (dos randoms por candidato + selector).
  if (calls > 49) throw new Error('agotamiento calls=' + calls);
});

t('heurística angular conserva una salida y rechaza corona cerrada', () => {
  const NV = sandbox().window.NV, player = { x: 450, y: 260 }, hazards = [];
  // Seis sectores alternos/cercanos: candidato central/near no debe completar corona.
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 4;
    hazards.push(mine({ state: 'armed', x: player.x + Math.cos(a) * 250, y: player.y + Math.sin(a) * 190 }));
  }
  let calls = 0;
  const p = NV.findSpeakerMinePosition(hazards, player, 900, 520, () => { calls++; return 0.5; });
  if (p !== null) throw new Error('cerró corona: ' + JSON.stringify(p));
  if (calls > 49) throw new Error('loop no acotado');
});

t('cadence: empieza gradual, repone con demora y nunca spawnea al lado del jugador', () => {
  const NV = sandbox().window.NV, hazards = [], state = NV.createMinefieldState();
  let ri = 0;
  const vals = [0.02, 0.1, 0.95, 0.1, 0.02, 0.9, 0.95, 0.9, 0.1, 0.05, 0.85, 0.2];
  const c = ctx({ wave: 3, random: () => vals[(ri++) % vals.length] });
  NV.updateSpeakerMines(0, hazards, state, c);
  if (hazards.length !== 1) throw new Error('no inició con una gradual');
  NV.updateSpeakerMines(0.1, hazards, state, c);
  if (hazards.length !== 1) throw new Error('ignoró cadence inicial');
  NV.updateSpeakerMines(0.2, hazards, state, c);
  if (hazards.length !== 2) throw new Error('no añadió segunda');
  for (const h of hazards) if (Math.hypot(h.x - c.player.x, h.y - c.player.y) < 175) throw new Error('spawn cercano');
  // Al quedar lleno, el timer queda preparado para refill, no negativo.
  for (let f = 0; f < 20; f++) NV.updateSpeakerMines(0.3, hazards, state, c);
  while (hazards.length < 3) NV.updateSpeakerMines(0.3, hazards, state, c);
  hazards.pop();
  const before = hazards.length;
  NV.updateSpeakerMines(0.01, hazards, state, c);
  if (hazards.length !== before) throw new Error('refill inmediato');
});

t('cleanup: evento terminado, transición o boss limpian sin detonar', () => {
  const NV = sandbox().window.NV;
  for (const over of [{ waveEvent: null }, { transitioning: true }, { boss: { dead: false } }]) {
    const hazards = [mine({ state: 'armed' })], state = NV.createMinefieldState();
    let hits = 0, booms = 0;
    NV.updateSpeakerMines(0.1, hazards, state, ctx(Object.assign({ applyPlayerDamage() { hits++; }, spawnExplosion() { booms++; } }, over)));
    if (hazards.length || hits || booms) throw new Error('cleanup inseguro ' + JSON.stringify(over));
  }
});

t('enemy speed: normal 1.22, fast 1.12, elite 1.10, cap 260 y rollback natural', () => {
  const NV = sandbox().window.NV;
  const normal = { speed: 100, movementClass: 'normal' };
  const fast = { speed: 200, movementClass: 'fast' };
  const elite = { speed: 100, movementClass: 'normal', isElite: true, hostileClass: 'heavy' };
  if (NV.minefieldEnemySpeed(normal, 'mines') !== 122) throw new Error('normal');
  if (NV.minefieldEnemySpeed(fast, 'mines') !== 224.00000000000003 && Math.abs(NV.minefieldEnemySpeed(fast, 'mines') - 224) > 1e-9) throw new Error('fast');
  if (NV.minefieldEnemySpeed(elite, 'mines') !== 110.00000000000001 && Math.abs(NV.minefieldEnemySpeed(elite, 'mines') - 110) > 1e-9) throw new Error('elite');
  if (NV.minefieldEnemySpeed({ speed: 250, movementClass: 'fast' }, 'mines') !== 260) throw new Error('cap');
  if (NV.minefieldEnemySpeed(normal, null) !== 100 || normal.speed !== 100) throw new Error('mutación permanente');
});

t('spawn guarda movementClass sin lista de IDs y update consume waveEvent', () => {
  const src = fs.readFileSync('js/engine/enemies.js', 'utf8');
  if (!src.includes('movementClass: type.movementClass')) throw new Error('metadata ausente');
  if (!src.includes('minefieldEnemySpeed(e, st.waveEvent)')) throw new Error('speed efectiva ausente');
  if (/runner|kamikaze.*\[|enemyTypeId.*movementClass/.test(src)) throw new Error('lista frágil de IDs');
});

t('updateEnemies real acelera movimiento durante mines y vuelve al base después', () => {
  const NV = sandbox().window.NV;
  function moved(event) {
    const e = { x: 0, y: 100, speed: 100, movementClass: 'normal', radius: 10, damage: 1, dead: false, behavior: 'chase', knockVelX: 0, knockVelY: 0, hostileClass: 'light' };
    NV.updateEnemies(0.1, { enemies: [e], player: { x: 500, y: 100, invuln: 0, stun: 0 }, bullets: [], MAX_BULLETS: 10, MAX_ENEMY_BULLETS: 10, enemyBulletCount: () => 0, applyPlayerDamage() { return { applied: false }; }, addFloatText() {}, waveEvent: event });
    return e.x;
  }
  const base = moved(null), boosted = moved('mines');
  if (Math.abs(base - 10) > 1e-9 || Math.abs(boosted - 12.2) > 1e-9) throw new Error('base=' + base + ' boosted=' + boosted);
});

t('ritmo: fallback 114 BPM determinista y phaseOffset desincroniza sin cambiar BPM', () => {
  const NV = sandbox().window.NV;
  const a = mine({ state: 'armed', simTime: 1, phaseOffset: 0 });
  const b = mine({ state: 'armed', simTime: 1, phaseOffset: 0.4 });
  const pa = NV.speakerMinePose(a, null), pa2 = NV.speakerMinePose(a, null), pb = NV.speakerMinePose(b, null);
  if (JSON.stringify(pa) !== JSON.stringify(pa2)) throw new Error('fallback no determinista');
  if (pa.phase === pb.phase || Math.abs((pb.phase - pa.phase) - 0.4) > 1e-9) throw new Error('phaseOffset');
  const active = NV.speakerMinePose(Object.assign(a, { grooveBlend: 1, grooveMode: 'music' }), { enabled: true, active: true, state: 'listening', _phase: 0.25, kick: 0.8, beat: 0.6 });
  if (Math.abs(active.phase - Math.PI / 2) > 1e-9 || active.woofer <= 1) throw new Error('phase musical');
});

t('pulso compartido modifica pose visual pero nunca x/y/triggerRadius', () => {
  const NV = sandbox().window.NV, m = mine({ state: 'armed', simTime: 0.5, grooveMode: 'music', grooveBlend: 1 });
  const logical = { x: m.x, y: m.y, triggerRadius: m.triggerRadius };
  const quiet = { enabled: true, active: true, state: 'listening', beat: 0, kick: 0, onset: 0, energy: 0.25 };
  const hit = { enabled: true, active: true, state: 'listening', beat: 1, kick: 1, onset: 0.8, energy: 0.7 };
  const a = NV.createRhythmGrooveState(), b = NV.createRhythmGrooveState();
  let quietGroove, hitGroove;
  for (let i = 0; i < 8; i++) {
    quietGroove = NV.computeRhythmGroove(a, quiet, 1 / 60, { connected: true });
    hitGroove = NV.computeRhythmGroove(b, hit, 1 / 60, { connected: true });
  }
  const before = NV.speakerMinePose(m, quiet, quietGroove);
  const after = NV.speakerMinePose(m, hit, hitGroove);
  if (after.woofer <= before.woofer || Math.abs(after.bob) <= Math.abs(before.bob)) throw new Error('pulso shared sin respuesta');
  if (m.x !== logical.x || m.y !== logical.y || m.triggerRadius !== logical.triggerRadius) throw new Error('pulso mutó hitbox');
});

t('groove: conexión real activa MUSIC incluso en sección quiet; sin conexión vuelve a IDLE con transición suave', () => {
  const NV = sandbox().window.NV, hazards = [mine({ state: 'armed' })], state = NV.createMinefieldState();
  state.spawnTimer = 999;
  const quietConnected = { enabled: true, active: true, state: 'listening', _phase: 0.2, tempoBpm: 120, energy: 0, kick: 0, accent: 0 };
  NV.updateSpeakerMines(0.1, hazards, state, ctx({ rhythm: quietConnected }));
  NV.updateSpeakerMines(0.5, hazards, state, ctx({ rhythm: quietConnected }));
  const m = hazards[0];
  if (m.grooveMode !== 'music' || m.grooveBlend <= 0) throw new Error('quiet connected no entró a music');
  const before = m.grooveBlend;
  // Una caída breve conserva blend por hysteresis.
  NV.updateSpeakerMines(0.2, hazards, state, ctx({ rhythm: { enabled: true, active: false, state: 'listening', energy: 1 } }));
  if (m.grooveBlend < before - 1e-9 || m.grooveMode !== 'music') throw new Error('flip-flop sin grace');
  // Tras grace, blend baja progresivamente: no cambia en un frame.
  NV.updateSpeakerMines(0.25, hazards, state, ctx({ rhythm: { enabled: true, active: false, state: 'listening', energy: 1 } }));
  if (!(m.grooveBlend > 0 && m.grooveBlend < 1)) throw new Error('blend no suavizado=' + m.grooveBlend);
  for (let i = 0; i < 8; i++) NV.updateSpeakerMines(0.1, hazards, state, ctx({ rhythm: null }));
  if (m.grooveMode !== 'idle' || m.grooveBlend > 0.05) throw new Error('no volvió idle');
});

t('idle groove siempre se mueve y música tiene mayor flujo sin mutar geometría lógica', () => {
  const NV = sandbox().window.NV;
  const idle = mine({ state: 'armed', simTime: 0.37, grooveMode: 'idle', grooveBlend: 0 });
  const music = mine({ state: 'armed', simTime: 0.37, grooveMode: 'music', grooveBlend: 1, kickImpulse: 0.8, smoothedEnergy: 0.7, accentImpulse: 0.7 });
  const logical = JSON.stringify({ x: music.x, y: music.y, r: music.triggerRadius });
  const ip = NV.speakerMinePose(idle, null);
  const mp = NV.speakerMinePose(music, { enabled: true, active: true, state: 'listening', _phase: 0.37, tempoBpm: 120, kick: 0.8, accent: 0.7 });
  if (Math.abs(ip.sway) < 0.05 && Math.abs(ip.bob) < 0.05) throw new Error('idle congelado');
  if (!(Math.abs(mp.sway) > Math.abs(ip.sway) || Math.abs(mp.tilt) > Math.abs(ip.tilt))) throw new Error('music no tiene mayor flujo');
  if (JSON.stringify({ x: music.x, y: music.y, r: music.triggerRadius }) !== logical) throw new Error('pose alteró geometría');
});

t('idle de mina es vida orgánica lenta: amplitud baja y sin percusión imaginaria', () => {
  const NV = sandbox().window.NV;
  let minSway = Infinity, maxSway = -Infinity, minBob = Infinity, maxBob = -Infinity;
  let maxTilt = 0, minWoofer = Infinity, maxWoofer = -Infinity;
  for (let i = 0; i <= 88; i++) {
    const m = mine({ state: 'armed', simTime: i * 0.05, phaseOffset: 0.37, grooveMode: 'idle', grooveBlend: 0 });
    const p = NV.speakerMinePose(m, null);
    minSway = Math.min(minSway, p.sway); maxSway = Math.max(maxSway, p.sway);
    minBob = Math.min(minBob, p.bob); maxBob = Math.max(maxBob, p.bob);
    maxTilt = Math.max(maxTilt, Math.abs(p.tilt));
    minWoofer = Math.min(minWoofer, p.woofer); maxWoofer = Math.max(maxWoofer, p.woofer);
    if (p.scaleX < 0.995 || p.scaleX > 1.008 || p.scaleY < 0.992 || p.scaleY > 1.006) throw new Error('idle scale excesivo=' + JSON.stringify(p));
  }
  if (maxSway - minSway < 1.5 || maxSway > 2 || minSway < -2) throw new Error('idle sway=' + minSway + '..' + maxSway);
  if (maxBob - minBob < 0.35 || maxBob > 0.8 || minBob < -0.8) throw new Error('idle bob=' + minBob + '..' + maxBob);
  if (maxTilt > 0.045) throw new Error('idle tilt=' + maxTilt);
  if (minWoofer < 1 || maxWoofer > 1.05) throw new Error('idle woofer=' + minWoofer + '..' + maxWoofer);

  const m = mine({ state: 'armed', simTime: 1.1, phaseOffset: 0.2, grooveMode: 'idle', grooveBlend: 0 });
  const plain = NV.speakerMinePose(m, null);
  const disconnectedNoise = NV.speakerMinePose(m, { enabled: true, active: false, state: 'listening', beat: 1, kick: 1, onset: 1, energy: 1 });
  if (JSON.stringify(plain) !== JSON.stringify(disconnectedNoise)) throw new Error('idle reaccionó a señal no conectada');
});

t('música conserva idle base y percusión domina energía mediante attack/release compartido', () => {
  const NV = sandbox().window.NV;
  const quiet = { enabled: true, active: true, state: 'listening', beat: 0, kick: 0, onset: 0, accent: 0, energy: 0.7 };
  const hit = { enabled: true, active: true, state: 'listening', beat: 1, kick: 1, onset: 0.8, accent: 0.7, energy: 0.7 };
  const qs = NV.createRhythmGrooveState(), hs = NV.createRhythmGrooveState();
  let qg, hg;
  for (let i = 0; i < 8; i++) {
    qg = NV.computeRhythmGroove(qs, quiet, 1 / 60, { connected: true });
    hg = NV.computeRhythmGroove(hs, hit, 1 / 60, { connected: true });
  }
  const m = mine({ state: 'armed', simTime: 1.35, phaseOffset: 0.4, grooveMode: 'music', grooveBlend: 1 });
  const idle = NV.speakerMinePose(Object.assign({}, m, { grooveMode: 'idle', grooveBlend: 0 }), null);
  const q = NV.speakerMinePose(m, quiet, qg);
  const h = NV.speakerMinePose(m, hit, hg);
  if (Math.abs(q.sway - idle.sway) < 1 || Math.abs(q.tilt - idle.tilt) < 0.01) throw new Error('music quiet no despierta idle');
  if (h.woofer - q.woofer < 0.12) throw new Error('percusión no domina woofer=' + (h.woofer - q.woofer));
  if (Math.abs(h.bob - q.bob) < 1 || Math.abs(h.tilt - q.tilt) < 0.01) throw new Error('golpe sin gesto físico');
  const deform = Math.abs(h.scaleX - q.scaleX) + Math.abs(h.scaleY - q.scaleY);
  const physical = Math.abs(h.sway - q.sway) + Math.abs(h.bob - q.bob) + Math.abs(h.tilt - q.tilt) + Math.abs(h.woofer - q.woofer);
  if (physical <= deform * 20) throw new Error('deformación domina gesto: physical=' + physical + ' deform=' + deform);

  // El release compartido conserva impulso decreciente/rebound sin detector local.
  let release = hg;
  const firstPulse = hg.pulseEnv;
  for (let i = 0; i < 10; i++) release = NV.computeRhythmGroove(hs, quiet, 1 / 60, { connected: true });
  if (!(release.pulseEnv > 0 && release.pulseEnv < firstPulse)) throw new Error('release compartido inválido=' + release.pulseEnv);
});

t('barrido visual mantiene estructura rígida y geometría lógica invariante', () => {
  const NV = sandbox().window.NV;
  for (const blend of [0, 0.25, 0.5, 0.75, 1]) {
    for (let i = 0; i <= 32; i++) {
      const pulse = i / 32, phase = i * Math.PI / 8;
      const m = mine({ state: 'armed', simTime: i * 0.09, phaseOffset: 0.3, grooveMode: blend > 0.5 ? 'music' : 'idle', grooveBlend: blend });
      const logical = JSON.stringify({ x: m.x, y: m.y, visualRadius: m.visualRadius, triggerRadius: m.triggerRadius, state: m.state, stateTime: m.stateTime });
      const p = NV.speakerMinePose(m, { enabled: true, active: true, state: 'listening' }, {
        pulseEnv: pulse, curvedPulse: pulse * pulse * (3 - 2 * pulse), energyEnv: 1,
        breathPhase: phase, breath: 0.5 + 0.5 * Math.sin(phase), smoothSkew: 5.45,
      });
      if (p.scaleX < 0.95 || p.scaleX > 1.05 || p.scaleY < 0.94 || p.scaleY > 1.06) throw new Error('scale fuera de contrato=' + JSON.stringify(p));
      if (JSON.stringify({ x: m.x, y: m.y, visualRadius: m.visualRadius, triggerRadius: m.triggerRadius, state: m.state, stateTime: m.stateTime }) !== logical) throw new Error('pose mutó gameplay');
    }
  }
});

t('groove compartido: helper finito/acotado alimenta una base única de minas sin mutar hitbox', () => {
  const NV = sandbox().window.NV;
  const rhythm = { enabled: true, active: true, state: 'listening', beat: 0.9, kick: 0.8, onset: 0.7, accent: 0.6, energy: 0.75, _phase: 0.3, tempoBpm: 120 };
  const gs = NV.createRhythmGrooveState();
  const groove = NV.computeRhythmGroove(gs, rhythm, 1 / 60, { connected: true });
  for (const k of ['pulseEnv', 'curvedPulse', 'energyEnv', 'breathPhase', 'smoothScale', 'smoothSkew']) {
    if (!Number.isFinite(groove[k])) throw new Error('no finito ' + k);
  }
  if (groove.curvedPulse < 0 || groove.curvedPulse > 1 || groove.smoothScale < 1 || groove.smoothScale > 1.62) throw new Error('bound=' + JSON.stringify(groove));
  const m = mine({ state: 'armed', grooveMode: 'music', grooveBlend: 1 });
  const before = JSON.stringify({ x: m.x, y: m.y, r: m.triggerRadius });
  const p = NV.speakerMinePose(m, rhythm, groove);
  if (p.scaleX > 1.05 || p.scaleY < 0.94 || p.scaleY > 1.01) throw new Error('stretch excesivo=' + JSON.stringify(p));
  if (JSON.stringify({ x: m.x, y: m.y, r: m.triggerRadius }) !== before) throw new Error('pose compartida mutó geometría');
  const hazards = [mine({ state: 'armed' }), mine({ state: 'armed', x: 300 })], state = NV.createMinefieldState();
  state.spawnTimer = 999;
  NV.updateSpeakerMines(1 / 60, hazards, state, ctx({ rhythm }));
  if (!state.groove || !state.grooveState || hazards.some((h) => Object.prototype.hasOwnProperty.call(h, '_poseGrooveState'))) throw new Error('base no compartida');
});

t('Option A: speakerMinePose() consume groove compartido (no fallback) y el flujo es desplazamiento > deformación', () => {
  const NV = sandbox().window.NV;
  // 1) El groove compartido (producido por computeRhythmGroove) es el que mapea la pose.
  const rhythm = { enabled: true, active: true, state: 'listening', beat: 0.9, kick: 0.8, onset: 0.7, accent: 0.6, energy: 0.75, _phase: 0.3, tempoBpm: 120 };
  const gs = NV.createRhythmGrooveState();
  const groove = NV.computeRhythmGroove(gs, rhythm, 1 / 60, { connected: true });
  const m = mine({ state: 'armed', grooveMode: 'music', grooveBlend: 1 });
  const p = NV.speakerMinePose(m, rhythm, groove);
  // La pose refleja groove.curvedPulse/breath/energyEnv, no el fallback.
  if (p.woofer <= 1 || Math.abs(p.sway) < 0.5) throw new Error('pose no refleja groove compartido: ' + JSON.stringify(p));
  // 2) Límites estrictos de escala del cuerpo.
  if (p.scaleX < 0.95 || p.scaleX > 1.05) throw new Error('scaleX fuera de 0.95..1.05: ' + p.scaleX);
  if (p.scaleY < 0.94 || p.scaleY > 1.06) throw new Error('scaleY fuera de 0.94..1.06: ' + p.scaleY);
  // 3) El flujo viene de desplazamiento/rotación, no de estirar el cuerpo.
  const dispMag = Math.abs(p.sway) + Math.abs(p.bob) + Math.abs(p.tilt) + (p.woofer - 1);
  const deformMag = Math.abs(p.scaleX - 1) + Math.abs(p.scaleY - 1);
  if (dispMag <= deformMag) throw new Error('flujo no es desplazamiento>deformación: disp=' + dispMag + ' deform=' + deformMag);
  // 4) Invariantes: x/y/radios no mutan.
  if (m.x !== 200 || m.y !== 200 || m.triggerRadius !== 14) throw new Error('pose mutó geometría lógica');
});

t('hazards no introducen DOM, layout, analyser ni loop individual por mina', () => {
  const src = fs.readFileSync('js/engine/hazards.js', 'utf8');
  if (!src.includes('state.groove = NV.computeRhythmGroove')) throw new Error('hazards no consume helper compartido');
  if (/document\.|getComputedStyle|querySelector|requestAnimationFrame|AudioContext|AnalyserNode/.test(src)) throw new Error('dependencia DOM/audio/loop en hazards');
  if (/for \(const mine[\s\S]{0,1000}computeRhythmGroove/.test(src)) throw new Error('groove recalculado por mina');
});

t('spawn táctico predice movimiento, puntúa intercepción y preserva distancia/separación/salida', () => {
  const NV = sandbox().window.NV;
  const player = { x: 330, y: 260, moveVx: 180, moveVy: 0 };
  const predicted = NV.predictedPlayerPosition(player, 0.65);
  if (Math.abs(predicted.x - 447) > 1e-9 || predicted.y !== 260) throw new Error('predicción incorrecta');
  let i = 0;
  const seq = [0.5, 0.22, 0.5, 0.72, 0.5, 0.42, 0.5, 0.88, 0.5, 0.62, 0.5, 0.32];
  const p = NV.findSpeakerMinePosition([], player, 900, 520, () => seq[(i++) % seq.length], true);
  if (!p || !p.tactical) throw new Error('sin candidato táctico');
  if (Math.hypot(p.x - player.x, p.y - player.y) < 175) throw new Error('táctico cercano');
  if (p.x < 42 || p.x > 858 || p.y < 42 || p.y > 478) throw new Error('táctico fuera de arena');
});

t('telegraph fija la posición futura durante 0.9s y no habilita colisión antes de armed', () => {
  const NV = sandbox().window.NV, hazards = [], state = NV.createMinefieldState();
  const c = ctx({ player: { x: 450, y: 450, moveVx: 120, moveVy: 0 }, rhythm: null, random: () => 0.25 });
  const m = NV.spawnSpeakerMine(hazards, state, c);
  if (!m || m.x !== m.spawnX || m.y !== m.spawnY) throw new Error('spawn no locked');
  const locked = [m.x, m.y];
  c.player = { x: m.x, y: m.y };
  NV.updateSpeakerMines(0.89, hazards, state, c);
  if (m.state !== 'spawning' || m.x !== locked[0] || m.y !== locked[1]) throw new Error('telegraph mutó/armó antes');
  NV.updateSpeakerMines(0.02, hazards, state, c);
  if (m.state !== 'armed') throw new Error('no armó a 0.9s');
});

t('notas musicales: tier, cap, limpieza y update son decorativos', () => {
  const NV = sandbox().window.NV, notes = [];
  const full = NV.spawnMusicalNotes(100, 100, { notes, policy: { tier: 'full' } });
  if (full !== 7 || notes.length !== 7) throw new Error('full=' + full);
  NV.clearMusicalNotes(notes);
  const reduced = NV.spawnMusicalNotes(100, 100, { notes, policy: { tier: 'reduced' } });
  if (reduced !== 5) throw new Error('reduced=' + reduced);
  NV.clearMusicalNotes(notes);
  const minimal = NV.spawnMusicalNotes(100, 100, { notes, policy: { tier: 'minimal' } });
  if (minimal !== 2 || !notes.every((n) => n.vy < 0 && n.maxLife >= 0.6)) throw new Error('minimal/notas inválidas');
  for (let i = 0; i < 10; i++) NV.spawnMusicalNotes(100, 100, { notes, policy: { tier: 'full' } });
  if (notes.length > 24) throw new Error('cap=' + notes.length);
  NV.updateMusicalNotes(2, notes);
  if (notes.length !== 0) throw new Error('cleanup vida');
});

function fakeCtx() {
  const calls = [];
  const c = new Proxy({ calls }, {
    get(t, k) { if (k === 'calls') return calls; return (...args) => { calls.push([k].concat(args)); }; },
    set(t, k, v) { calls.push(['set', k, v]); return true; },
  });
  return c;
}

t('renderer headless: minimal conserva cuerpo/telegraph y no muta geometría', () => {
  const sbx = sandbox(true), NV = sbx.window.NV, c = fakeCtx();
  const m = mine({ state: 'spawning', stateTime: 0.3, simTime: 0.3 });
  const snapshot = JSON.stringify(m);
  NV.drawHazards(c, [m], null, { tier: 'minimal' }, false);
  if (JSON.stringify(m) !== snapshot) throw new Error('renderer mutó hazard');
  const arcs = c.calls.filter((x) => x[0] === 'arc').length;
  if (arcs < 3) throw new Error('minimal sin cuerpo/telegraph');
});

t('visual tier no modifica triggerRadius; debug hitbox es opt-in', () => {
  const sbx = sandbox(true), NV = sbx.window.NV, m = mine({ state: 'armed' });
  for (const tier of ['full', 'reduced', 'minimal']) {
    const c = fakeCtx(), r = m.triggerRadius;
    NV.drawHazards(c, [m], null, { tier }, false);
    if (m.triggerRadius !== r) throw new Error('tier mutó trigger');
  }
  const c = fakeCtx(); NV.drawHazards(c, [m], null, { tier: 'minimal' }, true);
  if (!c.calls.some((x) => x[0] === 'arc' && x[3] === m.triggerRadius)) throw new Error('debug hitbox ausente');
});

t('visual tier no reduce número lógico, estado, telegraph ni cadence de minas', () => {
  const NV = sandbox(true).window.NV;
  for (const tier of ['full', 'reduced', 'minimal']) {
    const hazards = Array.from({ length: 6 }, (_, i) => mine({ state: 'armed', x: 100 + i * 100 }));
    const snapshot = hazards.map((h) => [h.state, h.triggerRadius]);
    const c = fakeCtx(); NV.drawHazards(c, hazards, null, { tier }, false);
    if (hazards.length !== 6 || JSON.stringify(hazards.map((h) => [h.state, h.triggerRadius])) !== JSON.stringify(snapshot)) throw new Error('tier=' + tier);
  }
});

t('telegraph nunca consume la groove compartida del body; el body sí consume groove compartida y el flow viene de desplazar/rotar más que de estirar', () => {
    const sbx = sandbox(true), NV = sbx.window.NV;

    // (a) Telegraph: sprites de spawning no toman pose de baile; marker =
    //     simTime/phase. Diferentes objetos con x/y iguales y estado spawning
    //     deben producir el mismo dibujo aunque el groove sea nulo o real.
    const mq = mine({ state: 'spawning', stateTime: 0.3, simTime: 1.2, x: 200, y: 250, visualRadius: 16, triggerRadius: 14, phaseOffset: 0 });
    const mg = mine({ state: 'spawning', stateTime: 0.3, simTime: 1.2, x: 200, y: 250, visualRadius: 16, triggerRadius: 14, phaseOffset: 0 });
    const arcsNoGroove = () => { const c = fakeCtx(); NV.drawHazards(c, [mq], null, { tier: 'minimal' }, false, null, null); return c.calls.filter((x) => x[0] === 'arc').length; };
    const arcsGroove = () => { const c = fakeCtx(); NV.drawHazards(c, [mg], { enabled: true, active: true, state: 'listening', kick: 0.7 }, { tier: 'minimal' }, false, null, { kick: 0.7 }); return c.calls.filter((x) => x[0] === 'arc').length; };
    if (arcsNoGroove() !== arcsGroove()) throw new Error('telegraph varía con groove');

    // (b) Body: misma mina, mismo groove => pose idéntica (sin jitter aleatorio).
    const armed = mine({ state: 'armed', simTime: 0.6, grooveMode: 'music', grooveBlend: 1, phaseOffset: 0.1, x: 200, y: 250, visualRadius: 16, triggerRadius: 14 });
    const g = { pulseEnv: 0.7, curvedPulse: 0.6, energyEnv: 0.5, breathPhase: 0.7, smoothScale: 1.3, smoothSkew: 0.5, breath: 0.75, breathAmp: 0.2 };
    const p1 = NV.speakerMinePose(armed, { enabled: true, active: true, state: 'listening', kick: 0.7 }, g);
    const p2 = NV.speakerMinePose(armed, { enabled: true, active: true, state: 'listening', kick: 0.7 }, g);
    if (p1.sway !== p2.sway || p1.tilt !== p2.tilt || p1.woofer !== p2.woofer) throw new Error('pose no determinista');

    // (c) La respuesta al beat/kick se manifiesta principalmente en desplazamiento,
    //     rotación y woofer; la escala del cuerpo se mantiene conservadora.
    const quiet = { enabled: true, active: true, state: 'listening', beat: 0, kick: 0, onset: 0, energy: 0.2, _phase: 0.2 };
    const hit = { enabled: true, active: true, state: 'listening', beat: 1, kick: 1, onset: 0.8, energy: 0.7, _phase: 0.2 };
    const gq = NV.computeRhythmGroove(NV.createRhythmGrooveState(), quiet, 1 / 60, { connected: true });
    const gh = NV.computeRhythmGroove(NV.createRhythmGrooveState(), hit, 1 / 60, { connected: true });
    const pq = NV.speakerMinePose(armed, quiet, gq);
    const ph = NV.speakerMinePose(armed, hit, gh);
    const dSwing = Math.abs(ph.sway - pq.sway);
    const dTilt = Math.abs(ph.tilt - pq.tilt);
    const dBob = Math.abs(ph.bob - pq.bob);
    const dScale = Math.abs((ph.scaleX * ph.scaleY) - (pq.scaleX * pq.scaleY));
    if (!(dSwing > 0 || dTilt > 0 || dBob > 0)) throw new Error('beat no produce movimiento visible');
    if (dScale >= dSwing && dScale >= dTilt) throw new Error('scale domina sobre desplazamiento/rotación');
    if (ph.woofer <= pq.woofer) throw new Error('woofer no responde al groove');
    if (ph.scaleX < 0.95 || ph.scaleX > 1.05) throw new Error('scaleX fuera de rango conservador: ' + ph.scaleX);
    if (ph.scaleY < 0.94 || ph.scaleY > 1.06) throw new Error('scaleY fuera de rango conservador: ' + ph.scaleY);
    if (Math.abs(ph.tilt) > 26) throw new Error('tilt excesivo: ' + ph.tilt);
    if (Math.abs(ph.sway) > 18) throw new Error('sway excesivo: ' + ph.sway);

    // (d) Un telegraph ya armado queda fijo geométricamente durante spawning hasta
    //     que vuelve a armed; en un estado válido del sandbox el spawnX/spawnY deben
    //     existir y coincidir con x/y durante spawning.
    const m2 = mine({ state: 'spawning', stateTime: 0.3, simTime: 0.9, x: 200, y: 250, visualRadius: 16, triggerRadius: 14, phaseOffset: 0 });
    m2.spawnX = m2.x; m2.spawnY = m2.y; m2.grooveMode = 'idle'; m2.grooveBlend = 0; m2.damageApplied = false;
    const c3 = fakeCtx(); NV.drawHazards(c3, [m2], null, { tier: 'minimal' }, false);
    if (c3.calls.filter((x) => x[0] === 'arc').length < 3) throw new Error('minimal sin cuerpo/telegraph');
    if (m2.x !== m2.spawnX || m2.y !== m2.spawnY) throw new Error('telegraph mutó posición lógica');
  });

  t('placement usa world units en arenas desktop y mobile landscape, sin DPR', () => {
  const NV = sandbox().window.NV;
  for (const dims of [[900, 520], [1155, 520], [1125, 520]]) {
    let i = 0; const seq = [0.02, 0.08, 0.95, 0.12, 0.88, 0.25];
    const player = { x: dims[0] / 2, y: dims[1] - 100 };
    const p = NV.findSpeakerMinePosition([], player, dims[0], dims[1], () => seq[(i++) % seq.length]);
    if (!p || p.x < 42 || p.x > dims[0] - 42 || p.y < 42 || p.y > dims[1] - 42) throw new Error('arena=' + dims.join('x'));
    if (Math.hypot(p.x - player.x, p.y - player.y) < 175) throw new Error('dist mobile');
  }
  const src = fs.readFileSync('js/engine/hazards.js', 'utf8');
  if (/devicePixelRatio|effectiveDpr/.test(src)) throw new Error('hazard depende de DPR');
});

t('producción limpia hazards en menu/start/wave/victory/shop/gameOver', () => {
  const g = fs.readFileSync('js/game.js', 'utf8');
  for (const name of ['function showMenu()', 'function startGame()', 'function nextWave()', 'function triggerWaveVictory', 'function showShop()', 'function gameOver()']) {
    const i = g.indexOf(name); if (i < 0) throw new Error('falta ' + name);
    if (!g.slice(i, i + 2200).includes('clearHazards')) throw new Error('sin cleanup ' + name);
  }
});

t('producción: hazards no son hostiles, targets, kills ni condición de fin de wave', () => {
  const g = fs.readFileSync('js/game.js', 'utf8'), h = fs.readFileSync('js/engine/hazards.js', 'utf8');
  if (!g.includes('let enemies = []') || !g.includes('hazards = []')) throw new Error('arrays no separados');
  if (/getHostileBudget\([^)]*hazards/.test(g + h)) throw new Error('hazards cuentan como hostiles');
  if (/findNearest|currentAutoTarget|killEnemy|pickups\.push|player\.xp/.test(h)) throw new Error('hazard acoplado a rewards/target');
  const end = g.slice(g.indexOf('// Fin de oleada'), g.indexOf('updateHazards(dt)'));
  if (end.includes('hazards.length')) throw new Error('hazards bloquean wave');
});

t('legacy e.mine retirado de producción y weather.js continúa desconectado', () => {
  const prod = ['js/engine/enemies.js', 'js/render/spectralEnemies2D.js', 'js/game.js'].map((f) => fs.readFileSync(f, 'utf8')).join('\n');
  if (/\be\.mine\b|mineDamageApplied/.test(prod)) throw new Error('legacy e.mine presente');
  const html = fs.readFileSync('index.html', 'utf8');
  if (html.includes('js/engine/weather.js')) throw new Error('weather revivido');
  if (!html.includes('js/engine/hazards.js') || !html.includes('js/render/hazards.js')) throw new Error('módulos hazards no cargados');
});

t('audio: armado/explosión usan mixer existente y reciben posición', () => {
  const audio = fs.readFileSync('js/audio/synth.js', 'utf8'), hazards = fs.readFileSync('js/engine/hazards.js', 'utf8');
  for (const s of ['speakerMineArm', 'speakerMineExplosion']) if (!audio.includes(s) || !hazards.includes('sfx.' + s)) throw new Error('SFX falta ' + s);
  if (!hazards.includes('worldWidth: ctx.W || 900')) throw new Error('sin paneo posicional');
  if (/new AudioContext|webkitAudioContext/.test(hazards)) throw new Error('AudioContext paralelo');
});

console.log('RESULT speaker_mines: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);

// Tests E2: Kamikaze — existe como tipo, detona al morir (área) y se arma/detona en update.
const fs = require('fs'), vm = require('vm');
let pass = 0, fail = 0;
function t(desc, fn) { try { fn(); pass++; console.log('  ok  ' + desc); } catch (e) { fail++; console.log('  FAIL ' + desc + ' -> ' + e.message); } }
function load(f, sbx) { vm.runInNewContext(fs.readFileSync(f, 'utf8'), sbx, { filename: f }); }

const sbx = { window: { NV: {} }, console, Math };
load('js/data/balance.js', sbx);
load('js/data/gameData.js', sbx);
load('js/engine/enemies.js', sbx);
const NV = sbx.window.NV;

function mkKami(x, y) {
  return {
    x, y, hp: 40, maxHp: 40, speed: 100, radius: 10, color: '#ff5f3d', shape: 'triangle',
    score: 22, xp: 22, dead: false, behavior: 'kami', angle: 0, erraticTimer: 0,
    knockbackRes: 0.2, knockVelX: 0, knockVelY: 0, damage: 14, shield: false, shieldCd: 0,
    resist: 0, shootTimer: 0, stunChance: 0, slowUntil: 0, stun: 0,
  };
}
function baseSt(enemy, hits) {
  return {
    enemies: [enemy],
    player: { x: 400, y: 400, xp: 0, xpToNext: 10, level: 1, maxHp: 100, hp: 80, luck: 0, invuln: 0, stun: 0 },
    bullets: [], MAX_BULLETS: 50, MAX_ENEMY_BULLETS: 50, enemyBulletCount: () => 0,
    computePlayerHit: (dmg) => { hits.push(dmg); return { dmg }; },
    addFloatText: () => {}, spawnExplosion: (px, py, n, c) => booms.push([px, py, c]),
    sfx: { explosion: () => {}, levelup: () => {} }, triggerFlash: () => {},
    pickups: [], weaponLevels: {}, weaponKills: {}, WEAPON_KILLS_PER_LEVEL: 5,
    weaponKillProgress: () => 1, currentWeapon: { id: 'pistol', name: 'Pistola' },
    waveEvent: null, shake: 0, W: 800, H: 600, MAX_ENEMIES: 40, boss: null, wave: 5,
    ENEMY_TYPES: NV.ENEMY_TYPES,
  };
}
let booms = [];

t('tipo KAMIKAZE definido en ENEMY_TYPES con behavior kami', () => {
  const k = NV.ENEMY_TYPES.find((x) => x.id === 'kamikaze');
  if (!k || k.behavior !== 'kami') throw new Error('tipo ausente o mal comportamiento');
});

t('killEnemy de un kamikaze cercano detona y daña en área', () => {
  booms = []; const hits = [];
  const e = mkKami(430, 415); // ~34px del jugador
  const st = baseSt(e, hits); st.e = e;
  NV.killEnemy(st);
  if (!booms.some((b) => b[2] === '#ff5f3d')) throw new Error('sin explosión kamikaze');
  if (hits.length !== 1 || hits[0] !== 24) throw new Error('hits=' + JSON.stringify(hits));
});

t('kamikaze lejano al morir explota pero NO golpea al jugador', () => {
  booms = []; const hits = [];
  const e = mkKami(100, 100);
  const st = baseSt(e, hits); st.e = e;
  NV.killEnemy(st);
  if (hits.length !== 0) throw new Error('daño fuera de área');
  if (!booms.length) throw new Error('debería explotar igual');
});

t('updateEnemies: a <130px se arma con mecha y al agotarse llama onKill', () => {
  booms = []; const kills = [];
  const e = mkKami(450, 420); // <130px
  const st = baseSt(e, []);
  st.onKill = (k) => kills.push(k);
  let r = NV.updateEnemies(0.3, st); // t=0.3s
  if (!e.armed || Math.abs(e.fuse - 0.5) > 0.01) throw new Error('mecha incorrecta: ' + e.fuse);
  if (kills.length !== 0) throw new Error('detonó antes de tiempo');
  NV.updateEnemies(0.6, st); // cruza los 0.8s totales
  if (kills.length !== 1 || !kills[0].dead) throw new Error('onKill no disparado');
});

t('updateEnemies: lejos del jugador NO se arma', () => {
  const e = mkKami(700, 700); // ~424px
  const st = baseSt(e, []);
  NV.updateEnemies(0.2, st);
  if (e.armed) throw new Error('se armó estando lejos');
});

t('updateEnemies: daño de contacto tiene cooldown por enemigo aunque el jugador quede quieto', () => {
  const hits = [];
  const e = {
    x: 410, y: 400, hp: 40, maxHp: 40, speed: 75, radius: 11, color: '#f07bad', shape: 'circle',
    score: 10, xp: 10, dead: false, behavior: 'chase', angle: 0, erraticTimer: 0,
    knockbackRes: 0, knockVelX: 0, knockVelY: 0, damage: 12, shield: false, shieldCd: 0,
    resist: 0, shootTimer: 0, stunChance: 0, slowUntil: 0, stun: 0,
  };
  const st = baseSt(e, hits);
  const beforeX = e.x;
  NV.updateEnemies(0.016, st);
  if (hits.length !== 1) throw new Error('primer contacto no dañó una sola vez: ' + hits.length);
  if (!(e.contactCd > 0)) throw new Error('sin cooldown de contacto por enemigo');
  if (Math.abs(e.x - beforeX) > 5) throw new Error('reposicionamiento brusco en contacto: dx=' + (e.x - beforeX));
  st.player.invuln = 0; // simula que terminó la invulnerabilidad global antes del cooldown del enemigo
  NV.updateEnemies(0.6, st);
  if (hits.length !== 1) throw new Error('contacto repetido durante cooldown del enemigo: ' + hits.length);
});

t('updateEnemies: separa varios chase apilados y evita cascada inmediata de golpes', () => {
  function mkChase(i) {
    return {
      x: 410 + (i % 2), y: 400 + (i % 3), hp: 40, maxHp: 40, speed: 75, radius: 11, color: '#f07bad', shape: 'circle',
      score: 10, xp: 10, dead: false, behavior: 'chase', angle: 0, erraticTimer: 0,
      knockbackRes: 0, knockVelX: 0, knockVelY: 0, damage: 12, shield: false, shieldCd: 0,
      resist: 0, shootTimer: 0, stunChance: 0, slowUntil: 0, stun: 0,
    };
  }
  function overlapPairs(enemies) {
    let n = 0;
    for (let i = 0; i < enemies.length; i++) for (let j = i + 1; j < enemies.length; j++) {
      if (Math.hypot(enemies[i].x - enemies[j].x, enemies[i].y - enemies[j].y) < enemies[i].radius + enemies[j].radius) n++;
    }
    return n;
  }
  const hits = [];
  const enemies = Array.from({ length: 8 }, (_, i) => mkChase(i));
  const st = baseSt(enemies[0], hits);
  st.enemies = enemies;
  const before = overlapPairs(enemies);
  st.player.invuln = 10;
  for (let i = 0; i < 20; i++) NV.updateEnemies(0.016, st);
  const after = overlapPairs(enemies);
  if (!(after < before)) throw new Error('no redujo amontonamiento: before=' + before + ' after=' + after);

  st.player.invuln = 0;
  NV.updateEnemies(0.016, st);
  if (hits.length !== 1) throw new Error('primer golpe esperado: hits=' + hits.length);
  NV.updateEnemies(0.016, st);
  if (hits.length !== 1) throw new Error('cascada inmediata de golpes: hits=' + hits.length);
});

t('contacto letal: el atacante muere al dañar, pasa por onKill (explosión + score) y no hay cascada', () => {
  booms = [];
  const hits = [];
  const kills = [];
  const e = {
    x: 410, y: 400, hp: 40, maxHp: 40, speed: 75, radius: 11, color: '#f07bad', shape: 'circle',
    score: 10, xp: 10, dead: false, behavior: 'chase', angle: 0, erraticTimer: 0,
    knockbackRes: 0, knockVelX: 0, knockVelY: 0, damage: 12, shield: false, shieldCd: 0,
    resist: 0, shootTimer: 0, stunChance: 0, slowUntil: 0, stun: 0,
  };
  const st = baseSt(e, hits);
  // Igual que game.js: onKill(e) delega en NV.killEnemy (explosión, score, drops).
  st.onKill = (k) => { kills.push(k); NV.killEnemy({ ...st, e: k }); };
  NV.updateEnemies(0.016, st);
  if (hits.length !== 1) throw new Error('contacto no golpeó: ' + hits.length);
  if (!e.dead) throw new Error('el atacante no murió al dañar');
  if (kills.length !== 1 || kills[0] !== e) throw new Error('onKill no disparado con el atacante: ' + kills.length);
  if (!booms.some((b) => b[2] === '#f07bad')) throw new Error('sin explosión del atacante en su posición');
  // Sin cascada: el tick siguiente no agrega golpes (invuln global + atacante muerto).
  st.player.invuln = 0;
  NV.updateEnemies(0.016, st);
  if (hits.length !== 1) throw new Error('cascada de golpes tras contacto letal: ' + hits.length);
});

t('atkFlash decae con el tiempo en enemigos vivos (no atacantes)', () => {
  const e = {
    x: 700, y: 700, hp: 40, maxHp: 40, speed: 75, radius: 11, color: '#f07bad', shape: 'circle',
    score: 10, xp: 10, dead: false, behavior: 'chase', angle: 0, erraticTimer: 0,
    knockbackRes: 0, knockVelX: 0, knockVelY: 0, damage: 12, shield: false, shieldCd: 0,
    resist: 0, shootTimer: 0, stunChance: 0, slowUntil: 0, stun: 0, atkFlash: 0.4,
  };
  const st = baseSt(e, []);
  NV.updateEnemies(0.5, st);
  if (e.atkFlash > 0.001) throw new Error('atkFlash no decayó: ' + e.atkFlash);
});

t('esquiva tambien activa gesto corto de ataque (atkFlash) en el que intento golpear', () => {
  const e = {
    x: 410, y: 400, hp: 40, maxHp: 40, speed: 75, radius: 11, color: '#f07bad', shape: 'circle',
    score: 10, xp: 10, dead: false, behavior: 'chase', angle: 0, erraticTimer: 0,
    knockbackRes: 0, knockVelX: 0, knockVelY: 0, damage: 12, shield: false, shieldCd: 0,
    resist: 0, shootTimer: 0, stunChance: 0, slowUntil: 0, stun: 0,
  };
  const st = baseSt(e, []);
  st.computePlayerHit = () => ({ dmg: 12, dodged: true });
  NV.updateEnemies(0.016, st);
  if (!(e.atkFlash > 0)) throw new Error('sin atkFlash en intento esquivado');
});

t('hpDebug: contacto loguea HP DOWN con cause contact y hpAfter', () => {
  const logs = [];
  const origLog = console.log;
  console.log = (...a) => { logs.push(a.map((x) => (typeof x === 'object' && x !== null ? JSON.stringify(x) : String(x))).join(' ')); };
  try {
    const e = {
      x: 410, y: 400, hp: 40, maxHp: 40, speed: 75, radius: 11, color: '#f07bad', shape: 'circle',
      score: 10, xp: 10, dead: false, behavior: 'chase', angle: 0, erraticTimer: 0,
      knockbackRes: 0, knockVelX: 0, knockVelY: 0, damage: 12, shield: false, shieldCd: 0,
      resist: 0, shootTimer: 0, stunChance: 0, slowUntil: 0, stun: 0,
    };
    const hits = [];
    const st = baseSt(e, hits);
    st.hpDebug = true;
    NV.updateEnemies(0.016, st);
    if (hits.length !== 1) throw new Error('sin golpe de contacto: ' + hits.length);
  } finally {
    console.log = origLog;
  }
  const down = logs.filter((l) => l.includes('[hp-debug] HP DOWN'));
  if (down.length !== 1) throw new Error('esperaba 1 HP DOWN, vi ' + down.length + ': ' + logs.join(' | '));
  if (!down[0].includes('"cause":"contact:chase"')) throw new Error('cause incorrecta: ' + down[0]);
  if (!down[0].includes('"hpAfter":68')) throw new Error('hpAfter incorrecto: ' + down[0]);
});

t('spawn: kamikaze aparece desde oleada 10 y los demas tipos mantienen su umbral', () => {
  function poolAt(wave) { return NV.ENEMY_TYPES.filter((ty) => (ty.minWave || 1) <= wave).map((t) => t.id); }
  const w5 = poolAt(5), w9 = poolAt(9), w10 = poolAt(10);
  if (w5.includes('kamikaze')) throw new Error('kamikaze antes de tiempo (w5)');
  if (w5.join(',') !== 'drone,runner,tank') throw new Error('w5=' + w5.join(','));
  if (!w9.includes('swarmlet') || w9.includes('kamikaze')) throw new Error('w9=' + w9.join(','));
  if (!w10.includes('kamikaze')) throw new Error('kamikaze no entra en w10');
  // Spawn headless con oleada >=10: deben salir kamikazes entre los generados.
  const spawned = [];
  for (let i = 0; i < 200; i++) {
    NV.spawnEnemy({ enemies: spawned, MAX_ENEMIES: 200, boss: null, wave: 12, ENEMY_TYPES: NV.ENEMY_TYPES, W: 800, H: 600, waveEvent: null });
  }
  if (!spawned.some((e2) => e2.behavior === 'kami')) throw new Error('ningun kamikaze generado en w12');
});

console.log('RESULT kamikaze: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
// ===== ENGINE: jefes (movimiento por patrón, fases, ataques y proyectiles/esbirros) =====
// updateBoss muta el objeto boss (por ref) y devuelve los primitivos let que cambian en game.js
// (score, shards, wave, shake) además del propio boss (que se reasigna a null al morir).
// spawnBossProj/spawnMinion empujan por ref a bullets/enemies.
(() => {
  'use strict';
  const NV = window.NV;

  // ---- Proyectil del jefe (disparo guiado al jugador, salida debajo del cuerpo) ----
  NV.spawnBossProj = function (b, speed, damage, count, spread, color, radius, st) {
    if (!b) return;
    const cnt = count || 1;
    const angle = Math.atan2(st.player.y - b.y, st.player.x - b.x);
    const spreadA = spread || 0;
    for (let i = 0; i < cnt && st.bullets.length < st.MAX_BULLETS && st.enemyBulletCount() < st.MAX_ENEMY_BULLETS; i++) {
      const a = cnt > 1 ? angle + (i - (cnt - 1) / 2) * spreadA : angle;
      st.bullets.push({ x: b.x, y: b.y + 40, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, damage: damage, color: color || b.color, radius: radius || 5, isEnemy: true, dead: false, stunChance: b.stunChance || 0 });
    }
  };

  // ---- Esbirro (funciona incluso durante pelea con jefe) ----
  NV.spawnMinion = function (x, y, st) {
    if (st.enemies.length >= 40) return;
    const t = st.ENEMY_TYPES[0];
    const e = {
      x: x, y: y,
      hp: Math.round(20 * (1 + st.wave * 0.3)), speed: t.speed + st.wave * 2, radius: 9, color: t.color, shape: 'circle',
      score: 8, xp: 8, dead: false, behavior: 'chase', angle: Math.random() * Math.PI * 2,
      erraticTimer: 0, isElite: false, eliteDamage: 8, knockbackRes: 0, knockVelX: 0, knockVelY: 0,
      damage: 8, shield: false, shootTimer: 0, stun: 0,
    };
    e.maxHp = e.hp;
    st.enemies.push(e);
  };

  // ---- Ataques propios de cada jefe ----
  NV.runBossAttack = function (b, dt, st) {
    b.atkTimer = (b.atkTimer || 0) + dt;
    const s = b.attack;
    const proj = st.spawnBossProj;
    const minion = st.spawnMinion;
    switch (s) {
      case 'repeater':
        if (b.atkTimer >= 0.22) { st.sfx.bossAttack.repeater(); proj(b, 360, 13); b.atkTimer = 0; }
        break;
      case 'heavy':
        if (b.atkTimer >= 1.8) { st.sfx.bossAttack.heavy(); proj(b, 420, 42); b.atkTimer = 0; }
        break;
      case 'summon':
        if (b.atkTimer >= 3.5 && st.enemies.length < 22) {
          st.sfx.bossAttack.summon();
          minion(b.x, b.y + 40); minion(b.x + 30, b.y + 20); minion(b.x - 30, b.y + 20);
          b.atkTimer = 0;
        }
        break;
      case 'spread':
        if (b.atkTimer >= 1.7) {
          st.sfx.bossAttack.spread();
          const cnt = 9;
          for (let i = 0; i < cnt; i++) {
            const a = (i / cnt) * Math.PI * 2;
            if (st.bullets.length >= st.MAX_BULLETS || st.enemyBulletCount() >= st.MAX_ENEMY_BULLETS) break;
            st.bullets.push({ x: b.x, y: b.y + 40, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260, damage: 18, color: b.color, radius: 5, isEnemy: true, dead: false });
          }
          b.atkTimer = 0;
        }
        break;
      case 'beam':
        if (b.atkTimer >= 4.6) { st.sfx.bossAttack.beam(); proj(b, 560, 44); b.atkTimer = 0; b.beamWarned = false; }
        else if (b.atkTimer >= 4.1 && !b.beamWarned) {
          b.beamWarned = true; st.triggerFlash('#ff5f9b');
          st.addFloatText(b.x, b.y - 60, '¡CARGANDO LÁSER!', '#ff5f9b');
        }
        break;
      case 'volley':
        if (b.atkTimer >= 1.3) { st.sfx.bossAttack.volley(); proj(b, 420, 20, 5, 0.24); b.atkTimer = 0; }
        break;
      case 'bomb':
        if (b.atkTimer >= 2.0) { st.sfx.bossAttack.bomb(); proj(b, 200, 34); b.atkTimer = 0; }
        break;
      case 'orbs':
        if (b.atkTimer >= 1.4) {
          st.sfx.bossAttack.orbs();
          const a = Math.atan2(st.player.y - b.y, st.player.x - b.x) + (Math.random() - 0.5) * 0.4;
          if (st.bullets.length < st.MAX_BULLETS && st.enemyBulletCount() < st.MAX_ENEMY_BULLETS) st.bullets.push({ x: b.x, y: b.y + 40, vx: Math.cos(a) * 300, vy: Math.sin(a) * 300, damage: 18, color: '#e0ffff', radius: 5, isEnemy: true, dead: false });
          b.atkTimer = 0;
        }
        break;
      case 'split':
        if (!b.split && b.hp < b.maxHp / 2) {
          b.split = true; st.sfx.bossAttack.split();
          minion(b.x, b.y); minion(b.x, b.y); minion(b.x + 25, b.y - 20);
        }
        if (b.atkTimer >= 1.5) { st.sfx.bossAttack.split(); proj(b, 340, 24); b.atkTimer = 0; }
        break;
      case 'rage':
        {
          const hpct = b.hp / b.maxHp;
          const cd = 0.9 + hpct * 1.5;
          if (b.atkTimer >= cd) { st.sfx.bossAttack.rage(); proj(b, 460, 26); b.atkTimer = 0; }
        }
        break;
      default:
        if (b.atkTimer >= 1.5) { proj(b, 320, 18); b.atkTimer = 0; }
    }
  };

  // ---- Movimiento/fases/muerte del jefe ----
  NV.updateBoss = function (dt, st) {
    const boss = st.boss;
    if (!boss || boss.dead) return { score: st.score, shards: st.shards, wave: st.wave, shake: st.shake, boss };
    const W = st.W, H = st.H;
    boss.timer += dt;

    if (boss.pattern === 'chase') { boss.x = W / 2 + Math.sin(boss.timer * 0.3) * 200; }
    else if (boss.pattern === 'charge') { boss.x = W / 2 + Math.sin(boss.timer * 0.5) * 300; boss.y = 100 + Math.sin(boss.timer * 0.5) * 30; }
    else if (boss.pattern === 'circle') { boss.x = W / 2 + Math.cos(boss.timer) * 250; boss.y = 100 + Math.sin(boss.timer * 0.7) * 100; }
    else if (boss.pattern === 'burst') { boss.x = W / 2 + Math.sin(boss.timer * 2) * 150; }
    else if (boss.pattern === 'teleport') {
      boss.teleportTimer = (boss.teleportTimer || 0) + dt;
      if (boss.teleportTimer >= 2.2) {
        boss.teleportTimer = 0;
        st.spawnExplosion(boss.x, boss.y, 18, boss.color, 0.6);
        boss.x = 100 + Math.random() * (W - 200);
        boss.y = 100 + Math.random() * 200;
        st.spawnExplosion(boss.x, boss.y, 18, boss.color, 0.6);
      }
    }
    else if (boss.pattern === 'slow_charge') { boss.x = W / 2 + Math.sin(boss.timer * 0.3) * 350; }
    else if (boss.pattern === 'phase') { boss.x = W / 2 + Math.sin(boss.timer) * 180; boss.y = 80 + Math.cos(boss.timer * 1.5) * 80; }
    else if (boss.pattern === 'split') { boss.x = W / 2 + Math.sin(boss.timer * 0.8) * 220; }
    else if (boss.pattern === 'rage') { boss.x = W / 2 + Math.sin(boss.timer * 1.2) * 280; boss.y = 100 + Math.cos(boss.timer) * 120; }
    else { boss.x = W / 2 + Math.sin(boss.timer) * 200; }

    let shake = st.shake || 0;
    let score = st.score, shards = st.shards, wave = st.wave;

    // === FASE 2 (por debajo del 50% de HP) ===
    if (!boss.phase2 && boss.hp <= boss.maxHp * 0.5) {
      boss.phase2 = true;
      st.showBanner('¡FASE 2! ' + boss.name, '#ff5f9b');
      st.triggerFlash('#ff5f9b');
      shake = Math.max(shake, 0.8);
    }
    if (boss.phase2) {
      boss.atkTimer = (boss.atkTimer || 0) + dt * 0.9; // ataques ~2x más frecuentes
      boss.timer += dt * 0.35; // patrón de movimiento más veloz
    }

    NV.runBossAttack(boss, dt, st);

    if (boss.hp <= 0) {
      const bossName = boss.name, bossColor = boss.color;
      boss.dead = true;
      score += 500;
      shards += 30;
      st.spawnExplosion(boss.x, boss.y, 60, boss.color, 1.4);
      wave++;
      st.triggerWaveVictory(true, bossName, bossColor);
      return { score, shards, wave, shake, boss: null };
    }
    return { score, shards, wave, shake, boss };
  };
})();
// ===== ENGINE: jefes (movimiento por patrón, fases, ataques y proyectiles/esbirros) =====
// updateBoss muta el objeto boss (por ref) y devuelve los primitivos let que cambian en game.js
// (score, shards, wave, shake) además del propio boss (que se reasigna a null al morir).
// spawnBossProj/spawnMinion empujan por ref a bullets/enemies.
(() => {
  'use strict';
  const NV = window.NV;

  // ---- IA: puntería predictiva (apunta a donde ESTARÁ el jugador, con 80% de lead para que sea esquivable) ----
  NV.predictAim = function (b, st, projSpeed) {
    const p = st.player;
    const dx = p.x - b.x, dy = p.y - b.y;
    const vx = p.moveVx || 0, vy = p.moveVy || 0;
    if (!projSpeed || (!vx && !vy)) return Math.atan2(dy, dx);
    const t = Math.min(0.8, Math.hypot(dx, dy) / projSpeed);
    return Math.atan2(dy + vy * t * 0.8, dx + vx * t * 0.8);
  };

  // ---- Proyectil del jefe (puntería predictiva, salida debajo del cuerpo; stun opcional por disparo) ----
  NV.spawnBossProj = function (b, speed, damage, count, spread, color, radius, st, stun) {
    if (!b) return;
    const cnt = count || 1;
    const baseAngle = NV.predictAim(b, st, speed);
    const spreadA = spread || 0;
    const sc = (stun !== undefined ? stun : b.stunChance) || 0;
    for (let i = 0; i < cnt && st.bullets.length < st.MAX_BULLETS && st.enemyBulletCount() < st.MAX_ENEMY_BULLETS; i++) {
      const a = cnt > 1 ? baseAngle + (i - (cnt - 1) / 2) * spreadA : baseAngle;
      st.bullets.push({ x: b.x, y: b.y + 40, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, damage: damage, color: color || b.color, radius: radius || 5, isEnemy: true, dead: false, stunChance: sc });
    }
  };

  // ---- IA adaptativa: elige el ataque según el estado del jugador/arena ----
  // Cada jefe conserva su ataque primario como identidad; rota entre un pool secundario propio.
  NV.AI_SECONDARY = {
    repeater: ['spread', 'volley'], heavy: ['volley', 'bomb'], summon: ['orbs', 'spread'],
    spread: ['volley', 'repeater'], beam: ['heavy', 'spread'], volley: ['spread', 'repeater'],
    bomb: ['heavy', 'volley'], orbs: ['spread', 'volley'], split: ['volley', 'spread'], rage: ['heavy', 'beam'],
  };
  NV.selectBossAttack = function (b, st) {
    const p = st.player;
    const dist = Math.hypot(p.x - b.x, p.y - b.y);
    const pool = NV.AI_SECONDARY[b.primaryAttack] || ['volley', 'spread'];
    const lowHp = p.maxHp > 0 && p.hp / p.maxHp < 0.35;
    if (b.primaryAttack === 'summon') {
      // Identidad invocadora: invoca salvo que la arena esté saturada.
      return st.enemies.length >= 15 ? 'repeater' : 'summon';
    }
    if (lowHp && dist < 280) return 'volley';           // remate agresivo si el jugador está herido y cerca
    if (dist > 380) return pool[0];                      // lejos: presión a distancia
    if (st.enemies.length < 3 && b.phase2) return pool[1]; // fase 2 con arena limpia: cambia de registro
    return b.primaryAttack;                              // por defecto, su mecánica única
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
    const proj = (speed, damage, count, spread, color, radius, stun) => st.spawnBossProj(b, speed, damage, count, spread, color, radius, st, stun);
    const minion = st.spawnMinion;
    switch (s) {
      case 'repeater':
        if (b.atkTimer >= 0.22) { st.sfx.bossAttack.repeater(); proj(360, 13); b.atkTimer = 0; }
        break;
      case 'heavy':
        if (b.atkTimer >= 1.35) { st.sfx.bossAttack.heavy(); proj(420, 42, 1, 0, undefined, undefined, 0.25); b.atkTimer = 0; } // golpe pesado: aturde a veces
        break;
      case 'summon':
        if (b.atkTimer >= 2.6 && st.enemies.length < 26) {
          st.sfx.bossAttack.summon();
          minion(b.x, b.y + 40); minion(b.x + 30, b.y + 20); minion(b.x - 30, b.y + 20);
          b.atkTimer = 0;
        }
        break;
      case 'spread':
        if (b.atkTimer >= 1.25) {
          st.sfx.bossAttack.spread();
          // Espiral rotante: cada ráfaga rota el anillo, cubriendo más ángulos entre casts
          b.spiralOff = (b.spiralOff || 0) + 0.35;
          const cnt = 9;
          for (let i = 0; i < cnt; i++) {
            const a = b.spiralOff + (i / cnt) * Math.PI * 2;
            if (st.bullets.length >= st.MAX_BULLETS || st.enemyBulletCount() >= st.MAX_ENEMY_BULLETS) break;
            st.bullets.push({ x: b.x, y: b.y + 40, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260, damage: 18, color: b.color, radius: 5, isEnemy: true, dead: false });
          }
          b.atkTimer = 0;
        }
        break;
      case 'beam':
        if (b.atkTimer >= 3.6) { st.sfx.bossAttack.beam(); proj(560, 44, 1, 0, '#ff5f9b', 9, 0.35); b.atkTimer = 0; b.beamWarned = false; } // láser cargado: stun alto
        else if (b.atkTimer >= 3.1 && !b.beamWarned) {
          b.beamWarned = true; st.triggerFlash('#ff5f9b');
          st.addFloatText(b.x, b.y - 60, '¡CARGANDO LÁSER!', '#ff5f9b');
        }
        break;
      case 'volley':
        // Cadena de proyectiles: ráfaga principal + ráfaga rápida de seguimiento
        if (b.atkTimer >= (b.chaining ? 0.18 : 0.95)) {
          st.sfx.bossAttack.volley(); proj(420, 20, 5, 0.24); b.atkTimer = 0; b.chaining = !b.chaining;
        }
        break;
      case 'bomb':
        if (b.atkTimer >= 1.6) { st.sfx.bossAttack.bomb(); proj(200, 34, 1, 0, undefined, undefined, 0.3); b.atkTimer = 0; } // bomba: stun al impactar
        break;
      case 'orbs':
        if (b.atkTimer >= 1.1) {
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
        if (b.atkTimer >= 1.15) { st.sfx.bossAttack.split(); proj(340, 24); b.atkTimer = 0; }
        break;
      case 'rage':
        {
          const hpct = b.hp / b.maxHp;
          const cd = 0.55 + hpct * 1.2;
          if (b.atkTimer >= cd) { st.sfx.bossAttack.rage(); proj(460, 26); b.atkTimer = 0; }
        }
        break;
      default:
        if (b.atkTimer >= 1.1) { proj(320, 18); b.atkTimer = 0; }
    }
  };

  // ---- Reacción de dolor/enojo: golpe fuerte => globo de texto (con cooldown interno) ----
  const BOSS_RAGE_TEXTS = ['@%$#!', '¡GRRR!', '😡', '💢', '#@!*', '¡¿QUÉ?!', '😤', '¡DUELE!'];
  NV.bossHitReaction = function (boss, damage, addFloatText) {
    if (!boss || boss.dead) return false;
    if ((boss.rageCd || 0) > 0) return false;
    // Solo reacciona a golpes contundentes (≥2.5% de su vida máxima).
    if (damage < boss.maxHp * 0.025) return false;
    const txt = BOSS_RAGE_TEXTS[Math.floor(Math.random() * BOSS_RAGE_TEXTS.length)];
    addFloatText(boss.x, boss.y - boss.radius - 14, txt, '#ff5f5f');
    boss.rageCd = 1.6;
    return true;
  };

  // ---- Movimiento/fases/muerte del jefe ----
  NV.updateBoss = function (dt, st) {
    const boss = st.boss;
    if (!boss || boss.dead) return { score: st.score, shards: st.shards, wave: st.wave, shake: st.shake, boss };
    const W = st.W, H = st.H;
    boss.timer += dt;
    if ((boss.rageCd || 0) > 0) boss.rageCd -= dt;

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
      boss.aiTimer = 99; // fuerza re-selección de ataque al entrar en fase 2
      st.showBanner('¡FASE 2! ' + boss.name, '#ff5f9b');
      st.triggerFlash('#ff5f9b');
      shake = Math.max(shake, 0.8);
      // Firma sonora de transición de fase (Tarea 3, idea 6): distinta del bossEnter.
      if (st.sfx && st.sfx.bossPhaseShift) st.sfx.bossPhaseShift();
    }
    if (boss.phase2) {
      boss.atkTimer = (boss.atkTimer || 0) + dt * 1.4; // ataques notablemente más frecuentes en FASE 2
      boss.timer += dt * 0.6; // patrón de movimiento más veloz
    }

    // IA adaptativa: re-evalúa el ataque cada pocos segundos según el estado del jugador/arena
    boss.primaryAttack = boss.primaryAttack || boss.attack;
    boss.aiTimer = (boss.aiTimer || 0) + dt;
    if (boss.aiTimer >= (boss.phase2 ? 5 : 8)) { boss.aiTimer = 0; boss.attack = NV.selectBossAttack(boss, st); boss.atkTimer = 0; }

    NV.runBossAttack(boss, dt, st);

    if (boss.hp <= 0) {
      const bossName = boss.name, bossColor = boss.color;
      boss.dead = true;
      score += 500;
      // Recompensa escalada: el jefe es el contenido más difícil y financia ~1 mejora grande.
      shards += 50 + wave * 5;
      st.spawnExplosion(boss.x, boss.y, 60, boss.color, 1.4);
      if (st.sfx && st.sfx.enemyDeath) st.sfx.enemyDeath('boss', { x: boss.x, worldWidth: st.W || 900 });
      // Cofre de botín: 1-3 pickups al tocarlo (callback opcional en game.js).
      if (typeof st.spawnBossChest === 'function') st.spawnBossChest(boss.x, boss.y);
      // OJO: wave NO se incrementa aquí; game.js lo hace en skipShop() para que
      // el HUD siga mostrando la oleada del jefe hasta salir de la tienda.
      st.triggerWaveVictory(true, bossName, bossColor);
      return { score, shards, wave, shake, boss: null };
    }
    return { score, shards, wave, shake, boss };
  };
})();
// ===== ENGINE: enemigos =====
// spawnEnemy/spawnElite empujan a `enemies` (por ref); killEnemy y updateEnemies devuelven
// los valores `let` que en game.js deben reasignarse (score, shake) y flags (gameOver).
// El resto de estado se muta por referencia (player, arrays) o via callbacks/closures.
(() => {
  'use strict';
  const NV = window.NV;

  // ---- Spawn normal ----
  NV.spawnEnemy = function (st) {
    if (st.enemies.length >= st.MAX_ENEMIES) return;
    if (st.boss && !st.boss.dead) return;
    const waveTier = Math.min(6, Math.floor(st.wave / 3));
    const available = st.ENEMY_TYPES.slice(0, 2 + waveTier);
    const type = available[Math.floor(Math.random() * available.length)];
    const side = Math.random() < 0.5 ? 0 : st.W;
    const y = 80 + Math.random() * (st.H - 200);
    const hpScale = 1 + st.wave * 0.30;
    const dmgScale = Math.min(60, Math.round(st.wave * 1.5)); // el daño enemigo también escala
    st.enemies.push({
      x: side, y: y,
      hp: Math.round(type.hp * hpScale), maxHp: Math.round(type.hp * hpScale),
      speed: type.speed + Math.min(40, st.wave * 2.5),
      radius: type.radius, color: type.color, shape: type.shape,
      score: type.score * (1 + st.wave * 0.1), xp: type.xp * (1 + st.wave * 0.1),
      dead: false, behavior: type.behavior,
      angle: Math.random() * Math.PI * 2, erraticTimer: 0,
      knockbackRes: type.knockbackRes || 0, knockVelX: 0, knockVelY: 0,
      damage: (type.damage || 10) + dmgScale, shield: type.shield || false, shieldCd: 0, resist: type.resist || 0,
      shootTimer: 0, stunChance: type.stunChance || 0,
      // Evento CAMPO MINADO: algunos enemigos detonan en cadena al morir.
      mine: !!(st.waveEvent === 'mines' && Math.random() < 0.5),
    });
  };

  // ---- Spawn élite (cada 2 oleadas, desde la 3) ----
  NV.spawnElite = function (st) {
    if (st.wave < 3) return;
    if (st.wave % 2 === 0) return;
    if (st.boss && !st.boss.dead) return; // no élites durante un jefe
    // Evento LLUVIA DE ÉLITES: 1 élite extra (3 en vez de 2) en cada spawn.
    const count = st.waveEvent === 'elites' ? 3 : 2;
    const startIndex = ((st.wave / 2 - 1) * 2) % st.ELITE_TYPES.length;
    for (let i = 0; i < count; i++) {
      if (st.enemies.length >= st.MAX_ENEMIES) break;
      const elite = st.ELITE_TYPES[(startIndex + i) % st.ELITE_TYPES.length];
      const side = Math.random() < 0.5 ? 0 : st.W;
      const y = 80 + Math.random() * (st.H - 200);
      const eliteDmg = elite.damage + Math.min(80, Math.round(st.wave * 2));
      st.enemies.push({
        x: side, y: y,
        hp: Math.round(elite.hp + st.wave * st.wave * 1.5), maxHp: Math.round(elite.hp + st.wave * st.wave * 1.5),
        speed: elite.speed + st.wave,
        radius: elite.radius, color: elite.color, shape: elite.shape,
        score: elite.score, xp: elite.xp, dead: false,
        behavior: elite.behavior, angle: Math.random() * Math.PI * 2,
        erraticTimer: 0, isElite: true, eliteDamage: eliteDmg,
        knockbackRes: 0.3, knockVelX: 0, knockVelY: 0, shootTimer: 0,
        stunChance: elite.stunChance || 0, resist: elite.resist || 0,
      });
    }
  };

  // ---- Derribo (muta player/weaponLevels/weaponKills por ref; devuelve nuevo score) ----
  NV.killEnemy = function (st) {
    const e = st.e;
    e.dead = true;
    let score = st.score + e.score;
    st.player.xp += e.xp;
    st.addFloatText(e.x, e.y, '+' + Math.round(e.score), e.isElite ? '#ff0' : '#ffcf76');
    while (st.player.xp >= st.player.xpToNext) {
      st.player.xp -= st.player.xpToNext;
      st.player.level++;
      st.player.xpToNext = Math.floor(st.player.xpToNext * 1.5);
      st.player.maxHp += 10;
      st.player.hp = Math.min(st.player.hp + 20, st.player.maxHp);
      st.addFloatText(st.player.x, st.player.y - 50, 'LEVEL UP!', '#ff0');
      st.sfx.levelup();
      st.triggerFlash('#ff0');
    }
    // El arma equipada gana XP por derribos y sube de nivel.
    const wid = st.currentWeapon.id;
    const curLevel = st.weaponLevels[wid] || 1;
    st.weaponKills[wid] = (st.weaponKills[wid] || 0) + st.weaponKillProgress();
    if (st.weaponKills[wid] >= st.WEAPON_KILLS_PER_LEVEL * curLevel) {
      st.weaponLevels[wid] = curLevel + 1;
      st.addFloatText(st.player.x, st.player.y - 40, st.currentWeapon.name + ' → Nv ' + (curLevel + 1), '#ffd700');
      st.sfx.levelup();
    }
    st.spawnExplosion(e.x, e.y, 8, e.color, 0.3);
    if (e.isElite) {
      // El élite garantiza shards de mayor valor: matarlo es una decisión económica.
      st.pickups.push({ x: e.x, y: e.y, type: 'shard', value: 3, dead: false });
    } else if (Math.random() < 0.15 + st.player.luck * 0.01) {
      st.pickups.push({ x: e.x, y: e.y, type: 'shard', dead: false });
    }
    // Evento DÍA DE PAGO: cada derribo suelta además un shard extra de valor 2.
    if (st.waveEvent === 'payday') {
      st.pickups.push({ x: e.x + 6, y: e.y + 6, type: 'shard', value: 2, dead: false });
    }
    // Evento CAMPO MINADO: el enemigo mina explota al morir (área, daño al jugador si está cerca).
    if (e.mine) {
      st.spawnExplosion(e.x, e.y, 26, '#ff5f9b', 0.9);
      if (st.computePlayerHit && Math.hypot(e.x - st.player.x, e.y - st.player.y) < 90) {
        st.computePlayerHit(20);
      }
    }
    st.sfx.explosion();
    return score;
  };

  // ---- Update de todos los enemigos (comportamientos, daño al jugador) ----
  // Devuelve { enemies, shake, gameOver }. Mutaciones de array/player por ref; los
  // primitivos let (enemies filtrado, shake) y el flag gameOver vuelven del retorno.
  NV.updateEnemies = function (dt, st) {
    const { enemies, player, bullets, MAX_BULLETS, MAX_ENEMY_BULLETS, enemyBulletCount, computePlayerHit, addFloatText } = st;
    let shake = st.shake || 0;
    let gameOver = false;

    for (const e of enemies) {
      if (e.dead) continue;

      const kb = e.knockVelX || 0;
      const kby = e.knockVelY || 0;
      const kbx = Math.abs(kb) > 0.1 ? kb : 0;
      const kby2 = Math.abs(kby) > 0.1 ? kby : 0;

            if (e.stun > 0) e.stun -= dt;
            if (e.shieldCd > 0) e.shieldCd = Math.max(0, e.shieldCd - dt);
      const stunned = e.stun > 0;
      if (!stunned) {
        if (e.behavior === 'chase') {
          const angle = Math.atan2(st.player.y - e.y, st.player.x - e.x);
          e.x += Math.cos(angle) * e.speed * dt + kbx * dt;
          e.y += Math.sin(angle) * e.speed * dt + kby2 * dt;
        } else if (e.behavior === 'erratic') {
          e.erraticTimer -= dt;
          if (e.erraticTimer <= 0) { e.angle += (Math.random() - 0.5) * 3; e.erraticTimer = 0.5; }
          e.x += (Math.cos(e.angle) * e.speed + kbx) * dt;
          e.y += (Math.sin(e.angle) * e.speed + kby2) * dt;
        } else if (e.behavior === 'swarm') {
          const angle = Math.atan2(st.player.y - e.y, st.player.x - e.x);
          e.x += (Math.cos(angle) * e.speed + kbx) * dt;
          e.y += (Math.sin(angle) * e.speed + kby2) * dt;
          for (const other of enemies) {
            if (other !== e && !other.dead && Math.hypot(other.x - e.x, other.y - e.y) < e.radius * 4) {
              const oa = Math.atan2(other.y - e.y, other.x - e.x);
              e.x -= Math.cos(oa) * 10 * dt;
              e.y -= Math.sin(oa) * 10 * dt;
            }
          }
        } else if (e.behavior === 'shield') {
          const angle = Math.atan2(st.player.y - e.y, st.player.x - e.x);
          const dist = Math.hypot(st.player.x - e.x, st.player.y - e.y);
          if (dist > e.radius + 30) {
            e.x += Math.cos(angle) * e.speed * dt + kbx * dt;
            e.y += Math.sin(angle) * e.speed * dt + kby2 * dt;
          }
        } else if (e.behavior === 'ranged') {
          const dist = Math.hypot(st.player.x - e.x, st.player.y - e.y);
          if (dist > 170) {
            const angle = Math.atan2(st.player.y - e.y, st.player.x - e.x);
            e.x += Math.cos(angle) * e.speed * 0.5 * dt + kbx * dt;
            e.y += Math.sin(angle) * e.speed * 0.5 * dt + kby2 * dt;
          } else {
            for (const other of enemies) {
              if (other === e || other.dead) continue;
              const od = Math.hypot(other.x - e.x, other.y - e.y);
              const minD = (e.radius + other.radius) * 0.7;
              if (od > 0 && od < minD) {
                const a2 = Math.atan2(e.y - other.y, e.x - other.x);
                const push = (minD - od) * 1.2 * dt;
                e.x += Math.cos(a2) * push;
                e.y += Math.sin(a2) * push;
              }
            }
            e.shootTimer += dt;
            if (e.shootTimer > 1.2) {
              e.shootTimer = 0;
              const angle = Math.atan2(st.player.y - e.y, st.player.x - e.x);
              if (bullets.length < MAX_BULLETS && st.enemyBulletCount() < MAX_ENEMY_BULLETS)
                bullets.push({ x: e.x, y: e.y, vx: Math.cos(angle) * 250, vy: Math.sin(angle) * 250, damage: e.damage, color: e.color, isEnemy: true, dead: false });
            }
          }
        }
      }

      e.knockVelX = (e.knockVelX || 0) * 0.92;
      e.knockVelY = (e.knockVelY || 0) * 0.92;

            const d = Math.hypot(e.x - st.player.x, e.y - st.player.y);
      if (d < e.radius + 20 && st.player.invuln <= 0 && st.player.stun <= 0) {
        const baseDmg = e.isElite ? (e.eliteDamage || 0) : e.damage;
        const hit = computePlayerHit(baseDmg);
        if (hit.dodged) {
          addFloatText(st.player.x, st.player.y - 20, 'ESQUIVA', '#8dfaff');
        } else {
          const damage = hit.dmg;
          st.player.hp -= damage;
          st.player.invuln = 0.5;
          if (e.stunChance && Math.random() < e.stunChance) { st.player.stun = 0.6; addFloatText(st.player.x, st.player.y - 30, 'STUN', '#ff0'); }
          shake = Math.max(shake, hit.crit ? 0.3 : 0.15);
          addFloatText(st.player.x, st.player.y - 20, '-' + damage + (hit.crit ? ' ★CRIT' : ''), hit.crit ? '#ff0' : (e.isElite ? '#ff0' : '#ff5f9b'));
          if (st.player.hp <= 0) { gameOver = true; return { enemies: enemies.filter((x) => !x.dead), shake, gameOver }; }
        }
      }
    }
    return { enemies: enemies.filter((e) => !e.dead), shake, gameOver };
  };
})();
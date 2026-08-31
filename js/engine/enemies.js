// ===== ENGINE: enemigos =====
// spawnEnemy/spawnElite empujan a `enemies` (por ref); killEnemy y updateEnemies devuelven
// los valores `let` que en game.js deben reasignarse (score, shake) y flags (gameOver).
// El resto de estado se muta por referencia (player, arrays) o via callbacks/closures.
(() => {
  'use strict';
  const NV = window.NV;
  NV._contactDbgEnemySeq = NV._contactDbgEnemySeq || 0;

  // ---- Spawn normal ----
  NV.spawnEnemy = function (st) {
    if (st.enemies.length >= st.MAX_ENEMIES) return;
    if (st.boss && !st.boss.dead) return;
    // Pool por oleada: cada tipo tiene su minWave. Los umbrales reproducen el
    // desbloqueo escalonado original (slice por índice); kamikaze entra desde la 10.
    const available = st.ENEMY_TYPES.filter((t) => (t.minWave || 1) <= st.wave);
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
      (st.sfx.playerLevelUp || st.sfx.levelup)();
      st.triggerFlash('#ff0');
    }
    // El arma equipada gana XP por derribos y sube de nivel.
    const wid = st.currentWeapon.id;
    const curLevel = st.weaponLevels[wid] || 1;
    st.weaponKills[wid] = (st.weaponKills[wid] || 0) + st.weaponKillProgress();
    if (st.weaponKills[wid] >= st.WEAPON_KILLS_PER_LEVEL * curLevel) {
      st.weaponLevels[wid] = curLevel + 1;
      st.addFloatText(st.player.x, st.player.y - 40, st.currentWeapon.name + ' → Nv ' + (curLevel + 1), '#ffd700');
      (st.sfx.fuse || st.sfx.levelup)(curLevel + 1);
    }
    st.spawnExplosion(e.x, e.y, 8, e.color, 0.3);
    if (e.isElite) {
      // El élite garantiza shards de mayor valor: matarlo es una decisión económica.
      st.pickups.push({ x: e.x, y: e.y, type: 'shard', value: 3, dead: false });
    } else if (Math.random() < 0.15 + st.player.luck * 0.01 + (st.player.permGreed || 0) * NV.BALANCE.GREED_PERM_DROP) {
      st.pickups.push({ x: e.x, y: e.y, type: 'shard', dead: false });
    }
    // Consumible RECOMPENSA: +1 shard y score doble por derribo durante su duración.
    if (st.player.bounty > 0) {
      score += e.score; // doble (ya sumamos el base arriba)
      st.pickups.push({ x: e.x, y: e.y, type: 'shard', value: 1, dead: false });
      st.addFloatText(st.player.x, st.player.y - 20, 'BOUNTY +1💎', '#ffd700');
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
        if (st.hpDebug || NV._hpDebug) console.log('[hp-debug] INFO explosion-no-damage', { frame: st.frame, cause: 'mine', dmg: 20, reason: 'computePlayerHit result discarded in killEnemy -> no actual hp change' });
      }
    }
    // KAMIKAZE: siempre detona al morir (por disparo o por autodetonacion).
    if (e.behavior === 'kami') {
      st.spawnExplosion(e.x, e.y, 34, '#ff5f3d', 1.1);
      if (st.computePlayerHit && Math.hypot(e.x - st.player.x, e.y - st.player.y) < 95) {
        st.computePlayerHit(24);
        if (st.hpDebug || NV._hpDebug) console.log('[hp-debug] INFO explosion-no-damage', { frame: st.frame, cause: 'kamikaze', dmg: 24, reason: 'computePlayerHit result discarded in killEnemy -> no actual hp change' });
      }
    }
    if (st.sfx.enemyDeath) st.sfx.enemyDeath(e.isElite ? 'elite' : 'normal', { x: e.x, worldWidth: st.W || 900 });
    else st.sfx.explosion(e.isElite ? 'elite' : 'normal', { x: e.x, worldWidth: st.W || 900 });
    return score;
  };

  // ---- Combo de kills (E1): encadena derribos con <2s entre ellos ----
  // combo = { count, timer } (estado en game.js). Devuelve bonus a aplicar.
  NV.comboOnKill = function (combo) {
    combo.count = combo.timer > 0 ? combo.count + 1 : 1;
    combo.timer = 2;
    const milestone = combo.count % 5 === 0; // cada 5: +1 💎
    return { count: combo.count, bonusScore: Math.min(50, 2 * combo.count), gemBonus: milestone ? 1 : 0, milestone };
  };

  NV.comboTick = function (combo, dt) {
    if (combo.timer > 0) { combo.timer -= dt; if (combo.timer < 0) { combo.timer = 0; combo.count = 0; } }
    return combo;
  };

  // ---- Consumibles: bomba de vacío y congelante ----
  NV.voidBomb = function (enemies, boss) {
    for (const e of enemies) { if (!e.dead) e.hp = Math.max(1, e.hp - Math.round(e.maxHp * 0.25)); }
    if (boss && !boss.dead) boss.hp = Math.max(1, boss.hp - Math.round(boss.maxHp * 0.25));
  };
  NV.freezeEnemies = function (enemies, duration) {
    for (const e of enemies) { if (!e.dead) e.slowUntil = duration; }
  };

  // ---- Update de todos los enemigos (comportamientos, daño al jugador) ----
  // Devuelve { enemies, shake, gameOver }. Mutaciones de array/player por ref; los
  // primitivos let (enemies filtrado, shake) y el flag gameOver vuelven del retorno.
  NV.updateEnemies = function (dt, st) {
    const { enemies, player, bullets, MAX_BULLETS, MAX_ENEMY_BULLETS, enemyBulletCount, computePlayerHit, addFloatText } = st;
    let shake = st.shake || 0;
    let gameOver = false;
    const contactDebug = !!(st.contactDebug || NV._contactDebug);
    const contactDebugNow = contactDebug ? (typeof performance !== 'undefined' ? performance.now() : Date.now()) : 0;
    const hpDebug = !!(st.hpDebug || NV._hpDebug);

    for (const e of enemies) {
      if (e.dead) continue;

      const kb = e.knockVelX || 0;
      const kby = e.knockVelY || 0;
      const kbx = Math.abs(kb) > 0.1 ? kb : 0;
      const kby2 = Math.abs(kby) > 0.1 ? kby : 0;

            if (e.stun > 0) e.stun -= dt;
            if (e.shieldCd > 0) e.shieldCd = Math.max(0, e.shieldCd - dt);
            if (e.contactCd > 0) e.contactCd = Math.max(0, e.contactCd - dt);
            if (e.atkFlash > 0) e.atkFlash = Math.max(0, e.atkFlash - dt);
      const stunned = e.stun > 0;
      // Congelante: algunos enemigos ralentizados (slowUntil).
      if (e.slowUntil > 0) e.slowUntil -= dt;
      const spd = e.speed * (e.slowUntil > 0 ? 0.5 : 1);
      if (!stunned) {
        if (e.behavior === 'chase') {
          const angle = Math.atan2(st.player.y - e.y, st.player.x - e.x);
          e.x += Math.cos(angle) * spd * dt + kbx * dt;
          e.y += Math.sin(angle) * spd * dt + kby2 * dt;
        } else if (e.behavior === 'kami') {
          // KAMIKAZE: persigue; a <130px se arma (mecha 0.8s, parpadeo) y detonan.
          const angle = Math.atan2(st.player.y - e.y, st.player.x - e.x);
          const dist = Math.hypot(st.player.x - e.x, st.player.y - e.y);
          if (!e.armed && dist < 130) { e.armed = true; e.fuse = 0.8; }
          if (e.armed) {
            e.fuse -= dt;
            const creep = spd * 0.3 * dt; // avanza lento mientras está armado
            e.x += Math.cos(angle) * creep;
            e.y += Math.sin(angle) * creep;
            if (e.fuse <= 0) {
              e.dead = true;
              if (st.onKill) st.onKill(e); // pasa por killEnemy: puntos/drops/explosión
              continue;
            }
          } else {
            e.x += Math.cos(angle) * spd * dt + kbx * dt;
            e.y += Math.sin(angle) * spd * dt + kby2 * dt;
          }
        } else if (e.behavior === 'erratic') {
          e.erraticTimer -= dt;
          if (e.erraticTimer <= 0) { e.angle += (Math.random() - 0.5) * 3; e.erraticTimer = 0.5; }
          e.x += (Math.cos(e.angle) * spd + kbx) * dt;
          e.y += (Math.sin(e.angle) * spd + kby2) * dt;
        } else if (e.behavior === 'swarm') {
          const angle = Math.atan2(st.player.y - e.y, st.player.x - e.x);
          e.x += (Math.cos(angle) * spd + kbx) * dt;
          e.y += (Math.sin(angle) * spd + kby2) * dt;
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
            e.x += Math.cos(angle) * spd * dt + kbx * dt;
            e.y += Math.sin(angle) * spd * dt + kby2 * dt;
          }
        } else if (e.behavior === 'ranged') {
          const dist = Math.hypot(st.player.x - e.x, st.player.y - e.y);
          if (dist > 170) {
            const angle = Math.atan2(st.player.y - e.y, st.player.x - e.x);
            e.x += Math.cos(angle) * spd * 0.5 * dt + kbx * dt;
            e.y += Math.sin(angle) * spd * 0.5 * dt + kby2 * dt;
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

      // Separación suave común para enemigos cuerpo a cuerpo: evita que varios
      // chase/kami/erratic/shield se apilen sobre el mismo punto del jugador.
      if (e.behavior !== 'ranged') {
        const selfIndex = enemies.indexOf(e);
        for (let oi = 0; oi < enemies.length; oi++) {
          const other = enemies[oi];
          if (other === e || other.dead) continue;
          const dx = e.x - other.x, dy = e.y - other.y;
          const od = Math.hypot(dx, dy);
          const minD = e.radius + other.radius + 6;
          if (od < minD) {
            const a = od > 0 ? Math.atan2(dy, dx) : (selfIndex - oi) * 2.399963229728653;
            const push = Math.min(1.6, (minD - od) * 7 * dt);
            e.x += Math.cos(a) * push;
            e.y += Math.sin(a) * push;
          }
        }
      }

      e.knockVelX = (e.knockVelX || 0) * 0.92;
      e.knockVelY = (e.knockVelY || 0) * 0.92;

            const d = Math.hypot(e.x - st.player.x, e.y - st.player.y);
      const inContact = d < e.radius + 20;
      if (contactDebug && inContact) {
        if (!e._contactDbgId) e._contactDbgId = ++NV._contactDbgEnemySeq;
        const blockedBy = st.player.invuln > 0 ? 'player.invuln' : (st.player.stun > 0 ? 'player.stun' : ((e.contactCd || 0) > 0 ? 'enemy.contactCd' : null));
        if (blockedBy && contactDebugNow - (e._contactDbgBlockAt || 0) > 250) {
          e._contactDbgBlockAt = contactDebugNow;
          console.log('[contact-debug] CONTACT BLOCK', {
            frame: st.frame, id: e._contactDbgId, index: enemies.indexOf(e), blockedBy,
            behavior: e.behavior, elite: !!e.isElite, baseDamage: e.isElite ? (e.eliteDamage || 0) : e.damage,
            dist: Number(d.toFixed(2)), threshold: e.radius + 20,
            playerInvuln: Number((st.player.invuln || 0).toFixed(3)), playerStun: Number((st.player.stun || 0).toFixed(3)), contactCd: Number((e.contactCd || 0).toFixed(3)),
            hp: Number(st.player.hp.toFixed ? st.player.hp.toFixed(2) : st.player.hp),
            overlappingEnemies: enemies.filter((x) => !x.dead && Math.hypot(x.x - st.player.x, x.y - st.player.y) < x.radius + 20).length,
          });
        }
      }
      if (inContact && st.player.invuln <= 0 && st.player.stun <= 0 && (e.contactCd || 0) <= 0) {
        const baseDmg = e.isElite ? (e.eliteDamage || 0) : e.damage;
        const hpBefore = st.player.hp;
        const contactCdBefore = e.contactCd || 0;
        const hit = computePlayerHit(baseDmg);
        if (hit.dodged) {
          if (contactDebug) {
            if (!e._contactDbgId) e._contactDbgId = ++NV._contactDbgEnemySeq;
            console.log('[contact-debug] CONTACT DODGE', {
              frame: st.frame, id: e._contactDbgId, index: enemies.indexOf(e), behavior: e.behavior, elite: !!e.isElite,
              baseDamage: baseDmg, dist: Number(d.toFixed(2)), contactCdBefore: Number(contactCdBefore.toFixed(3)), hp: hpBefore,
              overlappingEnemies: enemies.filter((x) => !x.dead && Math.hypot(x.x - st.player.x, x.y - st.player.y) < x.radius + 20).length,
            });
          }
          e.atkFlash = 0.25; // gesto corto: destaca QUÉ enemigo intentó golpear
          addFloatText(st.player.x, st.player.y - 20, 'ESQUIVA', '#8dfaff');
          if (hpDebug) console.log('[hp-debug] NO-DAMAGE', { frame: st.frame, cause: 'contact:' + e.behavior + ':dodge', hp: st.player.hp, id: e._contactDbgId || enemies.indexOf(e) });
        } else {
          const damage = hit.dmg;
          st.player.hp -= damage;
          if (hpDebug) console.log('[hp-debug] HP DOWN', { frame: st.frame, cause: 'contact:' + e.behavior + (e.isElite ? ':elite' : ''), dmg: damage, crit: !!hit.crit, hpBefore, hpAfter: st.player.hp, id: e._contactDbgId || enemies.indexOf(e) });
          if (st.sfx && st.sfx.playerHit && st.player.hp > 0) st.sfx.playerHit();
          st.player.invuln = 0.5;
          const contactAngle = d > 0 ? Math.atan2(e.y - st.player.y, e.x - st.player.x) : e.angle || 0;
          const contactPush = Math.max(90, (e.speed || 0) * 1.2) * (1 - (e.knockbackRes || 0) * 0.5);
          e.knockVelX = Math.cos(contactAngle) * contactPush;
          e.knockVelY = Math.sin(contactAngle) * contactPush;
          e.contactCd = 1.0;
          e.atkFlash = 0.45; // gesto de ataque: el render destaca QUÉ enemigo está golpeando
          if (st.spawnExplosion) st.spawnExplosion(player.x + Math.cos(contactAngle) * 12, player.y + Math.sin(contactAngle) * 12, 3, '#ff6b6b', 0.5); // chispa de impacto en el punto de contacto
          // El atacante muere al dañar: cada pérdida de HP por contacto tiene una
          // causa ÚNICA, visible e inequívoca (el enemigo que golpeó explota en su
          // posición, vía killEnemy: puntos/xp/drops/explosión). Sin "turnos" de
          // golpes entre enemigos que rodean al jugador.
          e.dead = true;
          if (st.onKill) st.onKill(e);
          if (contactDebug) {
            if (!e._contactDbgId) e._contactDbgId = ++NV._contactDbgEnemySeq;
            console.log('[contact-debug] CONTACT HIT', {
              frame: st.frame, id: e._contactDbgId, index: enemies.indexOf(e), behavior: e.behavior, elite: !!e.isElite,
              baseDamage: baseDmg, damage, crit: !!hit.crit, dist: Number(d.toFixed(2)), threshold: e.radius + 20,
              hpBefore, hpAfter: st.player.hp,
              playerInvulnAfter: st.player.invuln, contactCdBefore: Number(contactCdBefore.toFixed(3)), contactCdAfter: e.contactCd,
              killedAttacker: true,
              knockVelX: Number((e.knockVelX || 0).toFixed(2)), knockVelY: Number((e.knockVelY || 0).toFixed(2)),
              overlappingEnemies: enemies.filter((x) => !x.dead && Math.hypot(x.x - st.player.x, x.y - st.player.y) < x.radius + 20).length,
            });
          }
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
// ===== ENGINE: proyectiles/balas (movimiento, colisiones con jugador/enemigos/jefe) =====
// updateBullets muta arrays por ref y devuelve { bullets, shake, hitstop, gameOver } porque esos
// son primitivos let en game.js. Los callbacks preservan las closures del monolito
// (computePlayerHit, killEnemy, applyKnockback, addFloatText, spawnExplosion, gameOver).
(() => {
  'use strict';
  const NV = window.NV;

  function hasHitTarget(b, target) {
    return Array.isArray(b.hitTargets) && b.hitTargets.indexOf(target) !== -1;
  }

  function rememberHitTarget(b, target) {
    if (!Array.isArray(b.hitTargets)) b.hitTargets = [];
    if (b.hitTargets.indexOf(target) === -1) b.hitTargets.push(target);
  }

  function applyPlayerBulletDamage(b, e, st) {
    const { addFloatText, killEnemy, applyKnockback } = st;
    const dealt = Math.max(1, b.damage - (e.resist || 0));
    e.hp -= dealt;
    if (e.isElite) e.stun = 0.25;
    if (b.crit) addFloatText(e.x, e.y - e.radius - 6, '★CRIT', '#ff0');
    if (e.hp <= 0) killEnemy(e);
    applyKnockback(e, b.x, b.y, 60);
  }

  function findBounceTarget(from, enemies, b) {
    const radius = b.splashRadius || 180;
    let next = null, best = Infinity;
    for (const e of enemies) {
      if (e.dead || hasHitTarget(b, e)) continue;
      const d = Math.hypot(e.x - from.x, e.y - from.y);
      if (d <= radius && d < best) { best = d; next = e; }
    }
    return next;
  }

  function explodeSplash(b, st) {
    const radius = b.splashRadius || 0;
    if (radius <= 0) return;
    const { enemies, boss, spawnExplosion } = st;
    spawnExplosion(b.x, b.y, 18, b.color, 0.75);
    for (const other of enemies) {
      if (other.dead || hasHitTarget(b, other)) continue;
      if (Math.hypot(other.x - b.x, other.y - b.y) > radius + other.radius) continue;
      rememberHitTarget(b, other);
      applyPlayerBulletDamage(b, other, st);
    }
    if (boss && !boss.dead && Math.hypot(boss.x - b.x, boss.y - b.y) <= radius + boss.radius) {
      boss.hp -= b.damage;
      boss.hitFlash = Math.max(boss.hitFlash, 0.15);
      NV.bossHitReaction(boss, b.damage, st.addFloatText);
    }
  }

  NV.updateBullets = function (dt, st) {
    const { bullets, W, H, player, enemies, boss, CHARACTERS, SHIELD_COOLDOWN,
      computePlayerHit, addFloatText, killEnemy, applyKnockback, spawnExplosion } = st;
    let shake = st.shake || 0;
    let hitstop = st.hitstop || 0;
    let over = false;

    for (const b of bullets) {
      if (b.dead) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.x < -10 || b.x > W + 10 || b.y < -10 || b.y > H + 10) {
        if (!b.isEnemy && b.impactType === 'splash') explodeSplash(b, st);
        b.dead = true;
        continue;
      }

      if (b.isEnemy) {
        const d = Math.hypot(b.x - player.x, b.y - player.y);
        const playerRadius = (CHARACTERS[player.character].size || 20) * 0.45;
        const hitRadius = playerRadius + (b.radius || 5);
        if (d < hitRadius) {
          if (player.bulwark > 0) {
            // Muralla: refleja la bala enemiga hacia el enemigo
            b.isEnemy = false;
            b.vx *= -1.1; b.vy *= -1.1;
            b.color = '#ffcf76';
            b.damage = 30; // +50% de reflejo con Muralla activa
            b.pierce = 1;
            continue;
          }
          if (player.invuln <= 0 && player.stun <= 0) {
          const hit = computePlayerHit(b.damage);
            b.dead = true;
            if (hit.dodged) {
              addFloatText(player.x, player.y - 20, 'ESQUIVA', '#8dfaff');
            } else {
              const damage = hit.dmg;
              player.hp -= damage;
              if (st.sfx && st.sfx.playerHit && player.hp > 0) st.sfx.playerHit();
              if (b.stunChance && Math.random() < b.stunChance) { player.stun = 0.6; addFloatText(player.x, player.y - 30, 'STUN', '#ff0'); }
              shake = Math.max(shake, hit.crit ? 0.3 : 0.1);
              addFloatText(player.x, player.y - 20, '-' + damage + (hit.crit ? ' ★CRIT' : ''), hit.crit ? '#ff0' : '#ff5f9b');
              if (player.hp <= 0) { over = true; break; }
            }
          }
        }
      } else {
        let hitCount = 0;
        for (const e of enemies) {
          if (e.dead) continue;
          if (hasHitTarget(b, e)) continue;
          const d = Math.hypot(b.x - e.x, b.y - e.y);
          if ((b.impactType === 'sustain' && d < e.radius + (b.splashRadius || 18)) ||
              (b.impactType !== 'sustain' && d < e.radius + 4)) {
            // ESCUDO (shielder): bloquea balas frontales solo cuando el escudo está listo.
            if (e.shield) {
              if (e.shieldCd <= 0) {
                const facing = Math.atan2(player.y - e.y, player.x - e.x);
                const toBullet = Math.atan2(b.y - e.y, b.x - e.x);
                const diff = Math.abs(Math.atan2(Math.sin(toBullet - facing), Math.cos(toBullet - facing)));
                if (diff < Math.PI / 2) {
                  b.dead = true;
                  e.shieldCd = st.SHIELD_COOLDOWN; // queda recargando: vulnerable un instante
                  spawnExplosion(e.x + Math.cos(toBullet) * e.radius, e.y + Math.sin(toBullet) * e.radius, 4, e.color, 0.4);
                  break;
                }
              }
            }
            rememberHitTarget(b, e);
            applyPlayerBulletDamage(b, e, st);
            hitCount++;
            if (b.impactType === 'splash') explodeSplash(b, st);
            if (b.impactType === 'bounce' && b.bounceLeft > 0) {
              let from = e;
              while (b.bounceLeft > 0) {
                const next = findBounceTarget(from, enemies, b);
                if (!next) break;
                b.x = next.x; b.y = next.y;
                rememberHitTarget(b, next);
                applyPlayerBulletDamage(b, next, st);
                b.bounceLeft--;
                from = next;
              }
              b.dead = true;
              break;
            }
            if (b.pierce && hitCount >= b.pierce) { b.dead = true; break; }
          }
        }
        if (boss && !boss.dead && !b.dead) {
          const d = Math.hypot(b.x - boss.x, b.y - boss.y);
          const contactRadius = b.impactType === 'sustain' ? (b.splashRadius || 18) : 4;
          if (d < boss.radius + contactRadius) {
            boss.hp -= b.damage;
            boss.hitFlash = Math.max(boss.hitFlash, 0.15);
            if (b.impactType === 'splash') explodeSplash(b, st);
            b.dead = true; hitstop = 0.03; NV.bossHitReaction(boss, b.damage, addFloatText);
          }
        }
      }
    }
    return { bullets: bullets.filter((b) => !b.dead), shake, hitstop, gameOver: over };
  };
})();
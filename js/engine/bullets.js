// ===== ENGINE: proyectiles/balas (movimiento, colisiones con jugador/enemigos/jefe) =====
// updateBullets muta arrays por ref y devuelve { bullets, shake, hitstop, gameOver } porque esos
// son primitivos let en game.js. Los callbacks preservan las closures del monolito
// (computePlayerHit, killEnemy, applyKnockback, addFloatText, spawnExplosion, gameOver).
(() => {
  'use strict';
  const NV = window.NV;

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
      if (b.x < -10 || b.x > W + 10 || b.y < -10 || b.y > H + 10) { b.dead = true; continue; }

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
          const d = Math.hypot(b.x - e.x, b.y - e.y);
          if (d < e.radius + 4) {
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
            const dealt = Math.max(1, b.damage - (e.resist || 0));
            e.hp -= dealt;
            hitCount++;
            if (e.isElite) e.stun = 0.25; // Élite se aturde un instante al recibir daño
            if (b.crit) addFloatText(e.x, e.y - e.radius - 6, '★CRIT', '#ff0');
            if (e.hp <= 0) killEnemy(e);
            // Knockback al enemigo al dispararle
            applyKnockback(e, b.x, b.y, 60);
            if (b.pierce && hitCount >= b.pierce) { b.dead = true; break; }
          }
        }
        if (boss && !boss.dead && !b.dead) {
          const d = Math.hypot(b.x - boss.x, b.y - boss.y);
          if (d < boss.radius + 4) { boss.hp -= b.damage; boss.hitFlash = Math.max(boss.hitFlash, 0.15); b.dead = true; hitstop = 0.03; NV.bossHitReaction(boss, b.damage, addFloatText); }
        }
      }
    }
    return { bullets: bullets.filter((b) => !b.dead), shake, hitstop, gameOver: over };
  };
})();
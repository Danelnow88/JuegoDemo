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
    e.hitFlash = Math.max(e.hitFlash || 0, 0.10);
    var _hsCat = e.isElite ? "ELITE" : "NORMAL";
    var _hs = NV.hitSlowFor(_hsCat);
    if ((e.hitSlowImmunity || 0) <= 0 && (e.hitSlowUntil || 0) <= 0) { e.hitSlowUntil = _hs.activeDuration; e.hitSlowImmunity = _hs.activeDuration + _hs.immunity; }
    // Número de daño con código de color por intensidad (sin textos "CRITICAL!"):
    // normal blanco · sustancial cian · crítico rojo intenso con fuente mayor.
    const dfs = hitFloatStyle(dealt, !!b.crit);
    addFloatText(e.x, e.y - e.radius - 6, String(dealt), dfs.color, dfs.size);
    if (e.hp <= 0) killEnemy(e);
    applyKnockback(e, b.x, b.y, 60);
  }

  // Estilo del número de daño. Delegado en balance.js (NV.damageFloatStyle)
  // cuando está cargado; fallback mínimo para sandboxes que cargan bullets.js
  // aislado (p. ej. tests/boss_death_fix).
  function hitFloatStyle(dealt, crit) {
    if (NV.damageFloatStyle) return NV.damageFloatStyle(dealt, crit);
    return { color: crit ? '#FF2A4B' : '#FFFFFF', size: crit ? 17 : 13 };
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

  function setupBowChain(b, firstTarget, enemies) {
    const targets = [];
    let from = firstTarget;
    let remaining = b.bounceLeft;
    while (remaining > 0) {
      const next = findBounceTarget(from, enemies, b);
      if (!next) break;
      targets.push(next);
      rememberHitTarget(b, next);
      from = next;
      remaining--;
    }
    b.chainTargets = targets;
    b.chainIndex = 0;
    b.chainSpeed = 900;
    b.state = 'chain';
  }

  function segmentHitsCircle(x1, y1, x2, y2, cx, cy, radius) {
    const dx = x2 - x1, dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq <= 0.000001) return Math.hypot(cx - x2, cy - y2) < radius;
    const t = Math.max(0, Math.min(1, ((cx - x1) * dx + (cy - y1) * dy) / lenSq));
    return Math.hypot(cx - (x1 + dx * t), cy - (y1 + dy * t)) < radius;
  }

  function shotgunCanDamage(b, target) {
    const group = b.shotGroup;
    if (!group) return true;
    if (group.targets.indexOf(target) !== -1) return true;
    if (group.targets.length >= group.cap) return false;
    group.targets.push(target);
    return true;
  }

  function updateShotgunPelletVelocity(b, dt) {
    if (b.impactType !== 'pellet' || !Number.isFinite(b.shotgunBaseAngle)) return;
    const speed = b.shotgunSpeed || Math.hypot(b.vx, b.vy);
    const range = b.maxTravelDistance || 240;
    const bloomStart = Math.max(0, Math.min(range - 1, b.shotgunBloomStart || 90));
    const sampleDistance = Math.min(range, (b.traveledDistance || 0) + speed * Math.max(0, dt) * 0.5);
    const raw = Math.max(0, Math.min(1, (sampleDistance - bloomStart) / Math.max(1, range - bloomStart)));
    const bloom = raw * raw * (3 - 2 * raw);
    const compactHalf = (b.shotgunCompactSpread || 0.018) * 0.5;
    const maxHalf = (b.shotgunMaxSpread || 0.44) * 0.5;
    const offset = (b.shotgunSpreadFactor || 0) * (compactHalf + (maxHalf - compactHalf) * bloom);
    const angle = b.shotgunBaseAngle + offset;
    b.vx = Math.cos(angle) * speed;
    b.vy = Math.sin(angle) * speed;
    b.shotgunBloom = bloom;
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
      boss.hitFlash = Math.max(boss.hitFlash, 0.10);
      NV.bossHitReaction(boss, b.damage, st.addFloatText);
    }
  }

  NV.updateBullets = function (dt, st) {
    const { bullets, W, H, player, enemies, boss, CHARACTERS, SHIELD_COOLDOWN,
      applyPlayerDamage, addFloatText, killEnemy, applyKnockback, spawnExplosion } = st;
    let shake = st.shake || 0;
    let hitstop = st.hitstop || 0;
    let over = false;

    for (const b of bullets) {
      if (b.dead) continue;
      if (!b.isEnemy && b.wid === 'bow' && b.state === 'chain' && b.chainTargets && b.chainIndex < b.chainTargets.length) {
        if (dt <= 0) {
          while (b.chainIndex < b.chainTargets.length) {
            const target = b.chainTargets[b.chainIndex++];
            if (!target || target.dead) continue;
            applyPlayerBulletDamage(b, target, st);
          }
          b.dead = true;
          continue;
        }
        const target = b.chainTargets[b.chainIndex];
        if (!target || target.dead) {
          b.chainIndex++;
          if (b.chainIndex >= b.chainTargets.length) b.dead = true;
          continue;
        }
        const dx = target.x - b.x, dy = target.y - b.y;
        const dist = Math.hypot(dx, dy);
        const speed = b.chainSpeed || 900;
        if (dist <= target.radius + 4) {
          applyPlayerBulletDamage(b, target, st);
          b.chainIndex++;
          if (b.chainIndex >= b.chainTargets.length) b.dead = true;
        } else {
          const step = Math.min(dist, speed * dt);
          b.vx = dx / dist * speed;
          b.vy = dy / dist * speed;
          b.x += dx / dist * step;
          b.y += dy / dist * step;
        }
        continue;
      }

      updateShotgunPelletVelocity(b, dt);
      const oldX = b.x, oldY = b.y;
      let travelStep = Math.hypot(b.vx, b.vy) * dt;
      let expiresAfterStep = false;
      if (!b.isEnemy && b.maxTravelDistance > 0) {
        const remaining = Math.max(0, b.maxTravelDistance - (b.traveledDistance || 0));
        if (travelStep >= remaining) {
          const ratio = travelStep > 0 ? remaining / travelStep : 0;
          b.x += b.vx * dt * ratio;
          b.y += b.vy * dt * ratio;
          travelStep = remaining;
          expiresAfterStep = true;
        } else {
          b.x += b.vx * dt;
          b.y += b.vy * dt;
        }
        b.traveledDistance = (b.traveledDistance || 0) + travelStep;
      } else {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
      }
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
            b.dead = true;
            const hit = applyPlayerDamage(b.damage, { cause: 'projectile', projectile: b });
            if (hit.applied) {
              if (b.stunChance && Math.random() < b.stunChance) { player.stun = 0.6; addFloatText(player.x, player.y - 30, 'STUN', '#ff0'); }
              shake = Math.max(shake, hit.crit ? 0.3 : 0.1);
              if (hit.killed) { over = true; break; }
            }
          }
        }
      } else {
        let hitCount = 0;
        for (const e of enemies) {
          if (e.dead) continue;
          if (hasHitTarget(b, e)) continue;
          const d = Math.hypot(b.x - e.x, b.y - e.y);
          const collided = b.impactType === 'pellet'
            ? segmentHitsCircle(oldX, oldY, b.x, b.y, e.x, e.y, e.radius + 3)
            : ((b.impactType === 'sustain' && d < e.radius + (b.splashRadius || 18)) ||
              (b.impactType !== 'sustain' && d < e.radius + 4));
          if (collided) {
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
            if (b.impactType === 'pellet' && !shotgunCanDamage(b, e)) continue;
            rememberHitTarget(b, e);
            applyPlayerBulletDamage(b, e, st);
            hitCount++;
            if (NV.playtest) NV.playtest.bulletHit(hitCount); // telemetría opt-in F08 (pierce/alineación)
            if (b.impactType === 'splash') explodeSplash(b, st);
            if (b.impactType === 'bounce' && b.bounceLeft > 0) {
              setupBowChain(b, e, enemies);
              if (!b.chainTargets.length) b.dead = true;
              break;
            }
            // CONTRATO PIERCE (F04): `pierce` = TOTAL de objetivos dañables antes de morir
            // (primario + N penetraciones finitas). Alcanzado el límite la bala muere,
            // garantizando penetración finita y legible (p.ej. rifle 2 = primario + 1).
            if (b.pierce && hitCount >= b.pierce) { b.dead = true; break; }
          }
        }
        if (boss && !boss.dead && !b.dead) {
          const d = Math.hypot(b.x - boss.x, b.y - boss.y);
          const contactRadius = b.impactType === 'sustain' ? (b.splashRadius || 18) : 4;
          const bossCollision = b.impactType === 'pellet'
            ? segmentHitsCircle(oldX, oldY, b.x, b.y, boss.x, boss.y, boss.radius + 3)
            : d < boss.radius + contactRadius;
          if (bossCollision && shotgunCanDamage(b, boss)) {
            boss.hp -= b.damage;
            boss.hitFlash = Math.max(boss.hitFlash, 0.10);
            var _bhs = NV.hitSlowFor("BOSS");
            if ((boss.hitSlowImmunity || 0) <= 0 && (boss.hitSlowUntil || 0) <= 0) { boss.hitSlowUntil = _bhs.activeDuration; boss.hitSlowImmunity = _bhs.activeDuration + _bhs.immunity; }
            if (b.impactType === 'splash') explodeSplash(b, st);
            b.dead = true; hitstop = 0.03; NV.bossHitReaction(boss, b.damage, addFloatText);
          }
        }
      }
      if (expiresAfterStep && !b.dead) b.dead = true;
    }
    return { bullets: bullets.filter((b) => !b.dead), shake, hitstop, gameOver: over };
  };
})();
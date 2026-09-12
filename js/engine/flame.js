// ===== ENGINE: zonas de llama del flamethrower =====
// El flamethrower NO crea proyectiles viajantes. En su lugar genera "zonas de llama"
// acotadas (cono corto) que aplican daño por tick a los enemigos dentro de su geometría.
(() => {
  'use strict';
  const NV = window.NV;

  // Crea una zona de llama. opts: { x, y, angle, range, halfAngle, damage, tickRate,
  // life, maxLife, burnDamage, burnDuration, color, crit }
  NV.createFlameZone = function (opts) {
    return {
      type: 'flame',
      x: opts.x, y: opts.y,
      angle: opts.angle,
      range: opts.range || 170,
      halfAngle: opts.halfAngle != null ? opts.halfAngle : 0.22,
      damage: opts.damage,
      tickRate: opts.tickRate || 6,
      tickAccum: 0,
      life: opts.life != null ? opts.life : 0.35,
      maxLife: opts.maxLife != null ? opts.maxLife : (opts.life != null ? opts.life : 0.35),
      burnDamage: opts.burnDamage != null ? opts.burnDamage : Math.max(1, Math.round(opts.damage * 0.4)),
      burnDuration: opts.burnDuration != null ? opts.burnDuration : 0.6,
      hitTargets: [],
      color: opts.color || '#fb923c',
      visualTime: opts.visualTime || 0,
      seed: opts.seed != null ? opts.seed : 0.5,
      wid: 'flamethrower',
      dead: false,
    };
  };

  // Aplica burn (DOT) a una entidad. No stacking: refresca duración, nunca acumula DPS.
  NV.applyBurn = function (entity, burnDamage, burnDuration) {
    if (entity.burn) {
      // Ya tiene burn: refresca duración, mantiene el DPS más alto (no multiplicativo)
      entity.burn.remaining = Math.max(entity.burn.remaining, burnDuration);
      if (burnDamage > entity.burn.dps) entity.burn.dps = burnDamage;
    } else {
      entity.burn = { dps: burnDamage, remaining: burnDuration };
    }
  };

  // Actualiza los burns activos en enemigos/jefe. Llámalo cada frame.
  // ctx: { enemies, boss, killEnemy, spawnExplosion }
  NV.updateBurns = function (dt, ctx) {
    const { enemies, boss, killEnemy, spawnExplosion } = ctx;
    const apply = (e) => {
      if (!e || e.dead || !e.burn) return;
      e.hp -= e.burn.dps * dt;
      e.burn.remaining -= dt;
      if (e.burn.remaining <= 0 || e.hp <= 0) {
        if (e.hp <= 0 && !e.isBoss) {
          if (killEnemy) killEnemy(e);
        }
        e.burn = null;
      }
    };
    for (const e of enemies) apply(e);
    if (boss && !boss.dead) apply(boss);
  };

  // Actualiza todas las zonas de llama. Devuelve el array filtrado (no-muertas).
  // ctx: { player, enemies, boss, aimAngle, currentAutoTarget, killEnemy, addFloatText, applyKnockback }
  NV.updateFlameZones = function (dt, zones, ctx) {
    const { player, enemies, boss, currentAutoTarget } = ctx;
    const alive = [];
    for (const z of zones) {
      if (z.dead) continue;

      // La zona sigue al jugador (origen actual) y apunta al objetivo actual
      z.x = player.x;
      z.y = player.y - 20;
      if (Number.isFinite(ctx.aimAngle)) {
        z.angle = ctx.aimAngle;
      } else if (currentAutoTarget && !currentAutoTarget.dead) {
        z.angle = Math.atan2(currentAutoTarget.y - z.y, currentAutoTarget.x - z.x);
      }
      z.visualTime += dt;

      // Tick de daño
      z.tickAccum += dt;
      while (z.tickAccum >= 1 / z.tickRate) {
        z.tickAccum -= 1 / z.tickRate;
        NV.flameZoneDamage(z, ctx);
        z.hitTargets = [];
      }

      z.life -= dt;
      if (z.life <= 0) { z.dead = true; continue; }
      alive.push(z);
    }
    return alive;
  };

  // Aplica daño del cono de una zona de llama a enemigos/jefe dentro de su geometría.
  // ctx: { enemies, boss, killEnemy, addFloatText, applyKnockback, spawnExplosion }
  NV.flameZoneDamage = function (z, ctx) {
    const { enemies, boss, killEnemy, addFloatText, applyKnockback, spawnExplosion } = ctx;

    const inCone = (ex, ey, eRadius) => {
      const dx = ex - z.x, dy = ey - z.y;
      const dist = Math.hypot(dx, dy);
      if (dist > z.range + (eRadius || 0)) return false;
      const ang = Math.atan2(dy, dx);
      let diff = ang - z.angle;
      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;
      return Math.abs(diff) <= z.halfAngle;
    };

    // Enemigos normales/élites
    for (const e of enemies) {
      if (e.dead || z.hitTargets.indexOf(e) !== -1) continue;
      if (!inCone(e.x, e.y, e.radius)) continue;
      z.hitTargets.push(e);
      const dealt = Math.max(1, z.damage - (e.resist || 0));
      e.hp -= dealt;
      if (e.isElite) e.stun = 0.25;
      e.hitFlash = Math.max(e.hitFlash || 0, 0.10);
      NV.applyBurn(e, z.burnDamage, z.burnDuration);
      if (addFloatText) addFloatText(e.x, e.y - e.radius - 6, String(dealt), '#fb923c', 13);
      if (e.hp <= 0 && killEnemy) killEnemy(e);
      if (applyKnockback) applyKnockback(e, z.x, z.y, 30);
    }

    // Jefe
    if (boss && !boss.dead && inCone(boss.x, boss.y, boss.radius)) {
      boss.hp -= z.damage;
      boss.hitFlash = Math.max(boss.hitFlash || 0, 0.10);
      NV.applyBurn(boss, z.burnDamage, z.burnDuration);
      if (NV.bossHitReaction) NV.bossHitReaction(boss, z.damage, addFloatText);
    }
  };
})();

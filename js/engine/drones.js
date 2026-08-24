// ===== ENGINE: drones de combate (habilidad ENJAMBRE) =====
// updateDrones recibe lo que necesita: array drones (devuelve el filtrado), player/bullets
// por ref, tope y una callback findTarget. No muta estado global más allá de los arrays.
(() => {
  'use strict';
  const NV = window.NV;

  // Objetivo para drones: el más cercano AL JUGADOR dentro del rango dado (enemigos o jefe).
  NV.findDroneTarget = function (player, enemies, boss, range) {
    let target = null, minDist = range;
    for (const e of enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - player.x, e.y - player.y);
      if (d < minDist) { minDist = d; target = e; }
    }
    if (boss && !boss.dead) {
      const d = Math.hypot(boss.x - player.x, boss.y - player.y);
      if (d < minDist) { minDist = d; target = boss; }
    }
    return target;
  };

  NV.updateDrones = function (dt, drones, player, bullets, MAX_BULLETS, findTarget, enemies, boss, range) {
    if (drones.length === 0) return drones;
    const TARGET_RANGE = range || 300;
    for (const d of drones) {
      if (!d.life) d.life = 5;
      d.life -= dt;
      if (d.life <= 0) { d.dead = true; continue; }
      d.angle += d.speed * dt;
      if (d.aimLife > 0) d.aimLife -= dt; // desvanece la línea de puntería
      d.fireTimer -= dt;
      if (d.fireTimer <= 0) {
        d.fireTimer = 0.8;
        const dx = Math.cos(d.angle) * d.orbitRadius;
        const dy = Math.sin(d.angle) * d.orbitRadius;
        const target = NV.findDroneTarget(player, enemies || [], boss, TARGET_RANGE);
        let angle;
        if (target) {
          angle = Math.atan2(target.y - (player.y + dy), target.x - (player.x + dx));
          d.tx = target.x; d.ty = target.y; d.aimLife = 0.3; // VFX: línea hacia el objetivo
        } else {
          angle = d.angle;
        }
        if (bullets.length < MAX_BULLETS) {
          bullets.push({
            x: player.x + dx, y: player.y + dy,
            vx: Math.cos(angle) * 500, vy: Math.sin(angle) * 500,
            damage: 15, color: d.color, dead: false, isEnemy: false,
          });
        }
      }
    }
    return drones.filter((d) => !d.dead);
  };
})();
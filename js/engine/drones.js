// ===== ENGINE: drones de combate (habilidad ENJAMBRE) =====
// updateDrones recibe lo que necesita: array drones (devuelve el filtrado), player/bullets
// por ref, tope y una callback findTarget. No muta estado global más allá de los arrays.
(() => {
  'use strict';
  const NV = window.NV;

  NV.updateDrones = function (dt, drones, player, bullets, MAX_BULLETS, findTarget) {
    if (drones.length === 0) return drones;
    for (const d of drones) {
      if (!d.life) d.life = 5;
      d.life -= dt;
      if (d.life <= 0) { d.dead = true; continue; }
      d.angle += d.speed * dt;
      d.fireTimer -= dt;
      if (d.fireTimer <= 0) {
        d.fireTimer = 0.8;
        const dx = Math.cos(d.angle) * d.orbitRadius;
        const dy = Math.sin(d.angle) * d.orbitRadius;
        const target = findTarget();
        const angle = target
          ? Math.atan2(target.y - (player.y + dy), target.x - (player.x + dx))
          : d.angle;
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
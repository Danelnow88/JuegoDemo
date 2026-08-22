// engine/weapons.js — Disparo del jugador y knockback.
// Patrón ctxState+callbacks: reciben estado/callbacks y retornan/mutan el resultado.
(function () {
  'use strict';
  const NV = (window.NV = window.NV || {});

  // Enemigo/jefe más cercano al jugador.
  NV.findTarget = function ({ player, enemies, boss }) {
    let target = null, minDist = Infinity;
    for (const e of enemies) {
      const d = Math.hypot(e.x - player.x, e.y - player.y);
      if (d < minDist) { minDist = d; target = e; }
    }
    if (boss && !boss.dead) {
      const d = Math.hypot(boss.x - player.x, boss.y - player.y);
      if (d < minDist) target = boss;
    }
    return target;
  };

  // Empuje físico sobre un enemigo tras un impacto.
  NV.applyKnockback = function (e, bx, by, strength) {
    const angle = Math.atan2(e.y - by, e.x - bx);
    const kb = strength * (1 - (e.knockbackRes || 0));
    e.knockVelX = (e.knockVelX || 0) + Math.cos(angle) * kb;
    e.knockVelY = (e.knockVelY || 0) + Math.sin(angle) * kb;
  };

  // Disparo del arma actual: genera proyectiles amistosos (con crítico y tier visual).
  // state: { player, enemies, boss, bullets, currentWeapon, currentWeaponLevel,
  //          weaponVisualTier, BULLET_TIER_COLORS, MAX_BULLETS, permDamageBonus, playWeaponSound }
  NV.shoot = function (state) {
    const { player, enemies, boss, bullets, currentWeapon: weapon } = state;
    const count = Math.min(weapon.count || 1, 7);
    const spread = weapon.spread || 0;
    const target = NV.findTarget({ player, enemies, boss });
    const baseAngle = target
      ? Math.atan2(target.y - player.y, target.x - player.x)
      : -Math.PI / 2;

    // Durante overdrive, disparos duplicados
    const actualCount = player.overdrive > 0 ? count * 2 : count;

    // Estética por tier del arma (solo visual).
    const vTier = state.weaponVisualTier();
    const glowColor = state.BULLET_TIER_COLORS[vTier];

    for (let i = 0; i < actualCount; i++) {
      if (bullets.length >= state.MAX_BULLETS) break;
      const angle = baseAngle + (i - (actualCount - 1) / 2) * spread;
      const crit = Math.random() < (0.1 + player.luck * 0.002);
      const baseDmg = weapon.damage + state.permDamageBonus * 2 + state.currentWeaponLevel(); // daño aditivo: base + meta + nivel de arma
      bullets.push({
        x: player.x, y: player.y - 20,
        vx: Math.cos(angle) * weapon.speed, vy: Math.sin(angle) * weapon.speed,
        damage: crit ? baseDmg * 2 : baseDmg,
        color: weapon.color, dead: false, isEnemy: false, pierce: weapon.pierce || 0,
        crit, stunChance: 0,
        // Estética de tier (visual; no se usa en colisiones). wid selecciona la forma.
        tier: vTier, glowColor, wid: weapon.id,
      });
    }
    state.playWeaponSound(weapon);
  };
})();
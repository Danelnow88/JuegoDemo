// engine/weapons.js — Disparo del jugador y knockback.
// Patrón ctxState+callbacks: reciben estado/callbacks y retornan/mutan el resultado.
(() => {
  'use strict';
  const NV = window.NV;

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

  // Daño con multiplicador de fusión: las armas repetidas (fusionadas) escalan el daño
  // base con un % por nivel de fusión. Puro y testeable. fus 0 => daño base.
  NV.weaponFusionDamage = function (base, fus, step) {
    const s = step || 0.2;
    return Math.round(base * (1 + (fus || 0) * s));
  };

  // Precio de venta de un arma según su rareza, desde una tabla (balance). Si la rareza
  // no está en la tabla, devuelve el valor mínimo. Puro y testeable.
  NV.weaponSellValue = function (weapon, sellMap) {
    if (!weapon || !sellMap) return 0;
    const v = sellMap[weapon.rarity];
    return typeof v === 'number' ? v : (sellMap.common || 0);
  };

  // Disparo del arma actual: genera proyectiles amistosos (con crítico y tier visual).
  // state: { player, enemies, boss, bullets, currentWeapon, currentWeaponLevel,
  //          weaponVisualTier, BULLET_TIER_COLORS, MAX_BULLETS, permDamageBonus, playWeaponSound }
  NV.shoot = function (state) {
    const { player, enemies, boss, bullets, currentWeapon: weapon } = state;
    const count = Math.min(weapon.count || 1, 7);
    const spread = weapon.spread || 0;
    const target = NV.findTarget({ player, enemies, boss });

    // === RANGO DE ACTIVACIÓN ===
    // El arma solo dispara si hay objetivo y está dentro de su alcance (config por arma en WEAPONS.range).
    // Devuelve false para que game.js reintente pronto sin consumir la cadencia del arma.
    if (!target) return false;
    const range = weapon.range || Infinity;
    if (Math.hypot(target.x - player.x, target.y - player.y) > range) return false;

    const baseAngle = Math.atan2(target.y - player.y, target.x - player.x);

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
      // Fusión de repetidas: multiplicador extra (puro, cap en game.js).
      const finalDmg = NV.weaponFusionDamage(baseDmg, state.currentWeaponFusion, state.fusionStep);
      bullets.push({
        x: player.x, y: player.y - 20,
        vx: Math.cos(angle) * weapon.speed, vy: Math.sin(angle) * weapon.speed,
        damage: crit ? finalDmg * 2 : finalDmg,
        color: weapon.color, dead: false, isEnemy: false, pierce: weapon.pierce || 0,
        crit, stunChance: 0,
        // Estética de tier (visual; no se usa en colisiones). wid selecciona la forma.
        tier: vTier, glowColor, wid: weapon.id,
      });
    }
    state.playWeaponSound(weapon);
  };
})();
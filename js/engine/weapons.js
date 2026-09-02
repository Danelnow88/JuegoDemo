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

  // Crecimiento VISUAL del proyectil por nivel de arma y fusión (no afecta colisiones):
  // +2% de tamaño por nivel sobre 1 y +6% por nivel de fusión, con tope. Puro y testeable.
  NV.bulletSizeGrowth = function (level, fus) {
    const lv = Math.max(0, (level || 1) - 1);
    return Math.min(0.4, lv * 0.02 + (fus || 0) * 0.06);
  };

  NV.weaponImpactProfile = function (weapon) {
    const id = weapon && weapon.id;
    if (id === 'rifle') return { type: 'pierce', pierce: 2 };
    if (id === 'railgun') return { type: 'pierce', pierce: Infinity };
    if (id === 'bow') return { type: 'bounce', bounces: 3, radius: 180 };
    if (id === 'flamethrower') return { type: 'sustain', pierce: Infinity, radius: 18 };
    if (id === 'plasma') return { type: 'splash', pierce: 1, radius: 58 };
    return { type: 'direct', pierce: weapon.pierce || 1 };
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
    const glowColor = (state.currentWeaponFusion || 0) > 0 ? '#ffd700' : state.BULLET_TIER_COLORS[vTier];

    for (let i = 0; i < actualCount; i++) {
      if (bullets.length >= state.MAX_BULLETS) break;
      const angle = baseAngle + (i - (actualCount - 1) / 2) * spread;
      const crit = Math.random() < (0.1 + player.luck * 0.002 + (player.permCrit || 0) * NV.BALANCE.CRIT_PERM_CHANCE);
      const baseDmg = (weapon.damage + state.permDamageBonus * 2 + state.currentWeaponLevel()) * NV.waveWeaponMult(state.wave); // daño aditivo: base + meta + nivel de arma, escalado por oleada (B2)
      // Fusión de repetidas: multiplicador extra (puro, cap en game.js).
      const finalDmg = NV.weaponFusionDamage(baseDmg, state.currentWeaponFusion, state.fusionStep);
      const impact = NV.weaponImpactProfile(weapon);
      bullets.push({
        x: player.x, y: player.y - 20,
        vx: Math.cos(angle) * weapon.speed, vy: Math.sin(angle) * weapon.speed,
        damage: crit ? finalDmg * 2 : finalDmg,
        color: weapon.color, dead: false, isEnemy: false, pierce: impact.pierce,
        crit, stunChance: 0,
        impactType: impact.type, splashRadius: impact.radius || 0, bounceLeft: impact.bounces || 0, hitTargets: [],
        // Estética de tier (visual; no se usa en colisiones). wid selecciona la forma.
        tier: vTier, glowColor, wid: weapon.id,
        // Crecimiento por nivel/fusión + halo dorado si el arma está fusionada.
        growth: NV.bulletSizeGrowth(state.currentWeaponLevel(), state.currentWeaponFusion),
      });
    }
    state.playWeaponSound(weapon, state.audioPosition || { x: player.x, worldWidth: state.W || 900 });
  };
})();
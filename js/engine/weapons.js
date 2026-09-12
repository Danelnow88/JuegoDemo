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

  // Perfil de impacto por arma.
  //
  // CONTRATO DE PIERCE (explícito, F04): `pierce` cuenta el número TOTAL de objetivos
  // distintos que el proyectil puede dañar antes de morir. El PRIMERO es el objetivo
  // primario; los siguientes son penetraciones finitas. p.ej. rifle `pierce: 2` =
  // objetivo primario + 1 enemigo adicional (NUNCA "2 penetraciones tras el primero").
  // El guard de muerte está en engine/bullets.js (`hitCount >= b.pierce` → dead).
  // `Infinity` = sin tope (railgun). Flamethrower usa una zona separada sin proyectiles.
  //
  // Rifle (F04): identidad de arma habilidosa — arma automática estable, aim manual
  // exacto (sin spread ni recoil; el ángulo depende solo de aimVector en manual) y
  // penetración de línea moderada y finita. El resto de armas NO se rediseña.
  NV.weaponImpactProfile = function (weapon) {
    const id = weapon && weapon.id;
    if (id === 'rifle') return { type: 'pierce', pierce: 2 };
    if (id === 'railgun') return { type: 'pierce', pierce: Infinity };
    if (id === 'bow') return { type: 'bounce', bounces: 3, radius: 180 };
    if (id === 'flamethrower') return { type: 'flame' };
    if (id === 'plasma') return { type: 'splash', pierce: 1, radius: 58 };
    if (id === 'shotgun') return { type: 'pellet', pierce: 1 };
    return { type: 'direct', pierce: weapon.pierce || 1 };
  };

  function emitWeaponAudio(state, weapon, player, projectileCount, crit) {
    const audioEvent = Object.assign({}, state.audioPosition || { x: player.x, worldWidth: state.W || 900 }, {
      projectileCount,
      crit,
      fusion: state.currentWeaponFusion || 0,
      fireInterval: state.fireInterval,
    });
    try {
      state.playWeaponSound(weapon, audioEvent);
    } catch (err) {
      const audioDebug = !!(
        NV.DEBUG_AUDIO === true ||
        (NV.audio && typeof NV.audio.getWeaponSfxStats === 'function' && NV.audio.getWeaponSfxStats().debug)
      );
      if (audioDebug && typeof console !== 'undefined' && console.error) {
        console.error('[AUDIO] weapon SFX failed after gameplay creation:', err);
      }
    }
  }

  // Disparo del arma actual: genera proyectiles amistosos (con crítico y tier visual).
  // state: { player, enemies, boss, bullets, currentWeapon, currentWeaponLevel,
  //          weaponVisualTier, BULLET_TIER_COLORS, MAX_BULLETS, permDamageBonus, playWeaponSound }
  NV.shoot = function (state) {
    const { player, enemies, boss, bullets, currentWeapon: weapon } = state;
    const configuredCount = weapon.id === 'shotgun'
      ? (NV.BALANCE.SHOTGUN_PELLET_COUNT || weapon.count || 12)
      : (weapon.count || 1);
    const count = Math.min(configuredCount, 13);
    const spread = weapon.id === 'shotgun'
      ? (NV.BALANCE.SHOTGUN_SPREAD || weapon.spread || 0.44)
      : (weapon.spread || 0);
    const manualAim = state.aimVector && Number.isFinite(state.aimVector.x) && Number.isFinite(state.aimVector.y);
    const target = manualAim ? null : NV.findTarget({ player, enemies, boss });
    if (state.onTarget) state.onTarget(target);

    // === RANGO DE ACTIVACIÓN ===
    // El arma solo dispara si hay objetivo y está dentro de su alcance (config por arma en WEAPONS.range).
    // Devuelve false para que game.js reintente pronto sin consumir la cadencia del arma.
    if (!manualAim) {
      if (!target) return false;
      const range = weapon.range || Infinity;
      if (Math.hypot(target.x - player.x, target.y - player.y) > range) return false;
    }

    const aimLength = manualAim ? Math.hypot(state.aimVector.x, state.aimVector.y) : 0;
    const aim = manualAim && aimLength > 0.000001 ? { x: state.aimVector.x / aimLength, y: state.aimVector.y / aimLength, active: true } : null;
    if (manualAim && !aim) return false;
    const baseAngle = manualAim ? Math.atan2(aim.y, aim.x) : Math.atan2(target.y - player.y, target.x - player.x);

    const lvlBonus = NV.weaponLevelDamageBonus(state.currentWeaponLevel());
    const baseDmg = (weapon.damage + state.permDamageBonus * 2 + lvlBonus) * NV.waveWeaponMult(state.wave);
    const finalDmg = NV.weaponFusionDamage(baseDmg, state.currentWeaponFusion, state.fusionStep);
    const impact = NV.weaponImpactProfile(weapon);

    if (impact.type === 'flame') {
      const crit = Math.random() < (0.1 + player.luck * 0.002 + (player.permCrit || 0) * NV.BALANCE.CRIT_PERM_CHANCE);
      if (typeof state.onFlame === 'function') {
        state.onFlame({
          x: player.x,
          y: player.y - 20,
          angle: baseAngle,
          range: weapon.range || 170,
          damage: crit ? finalDmg * 2 : finalDmg,
          crit,
          color: weapon.color,
        });
      }
      emitWeaponAudio(state, weapon, player, 1, crit);
      return true;
    }

    // Durante overdrive, disparos duplicados
    const actualCount = player.overdrive > 0 ? count * 2 : count;

    // Estética por tier del arma (solo visual).
    const vTier = state.weaponVisualTier();
    const glowColor = (state.currentWeaponFusion || 0) > 0 ? '#ffd700' : state.BULLET_TIER_COLORS[vTier];
    const shotBursts = 1;
    const pelletsPerBurst = weapon.id === 'shotgun' ? count : actualCount;
    const projectileCount = pelletsPerBurst * shotBursts;
    const shotGroups = [];
    for (let burst = 0; burst < shotBursts; burst++) {
      shotGroups.push({ targets: [], cap: NV.BALANCE.SHOTGUN_UNIQUE_TARGET_CAP || 3 });
    }
    const shotgunRose = [
      [0.00, 0.00], [0.52, 0.05], [-0.28, 0.42], [-0.24, -0.45],
      [0.82, 0.31], [0.30, 0.78], [-0.43, 1.00], [-0.91, 0.34],
      [-0.76, -0.43], [-0.12, -1.00], [0.57, -0.73], [0.96, -0.20],
    ];

    let firedCount = 0, anyCrit = false;
    for (let i = 0; i < projectileCount; i++) {
      if (bullets.length >= state.MAX_BULLETS) break;
      const burstIndex = weapon.id === 'shotgun' ? Math.floor(i / pelletsPerBurst) : 0;
      const pelletIndex = weapon.id === 'shotgun' ? i % pelletsPerBurst : i;
      const localCount = weapon.id === 'shotgun' ? pelletsPerBurst : projectileCount;
      const rosePoint = weapon.id === 'shotgun'
        ? shotgunRose[pelletIndex % shotgunRose.length]
        : [0, localCount > 1 ? (pelletIndex - (localCount - 1) / 2) / ((localCount - 1) / 2) : 0];
      const spreadFactor = rosePoint[1];
      const compactSpread = weapon.id === 'shotgun' ? (NV.BALANCE.SHOTGUN_COMPACT_SPREAD || 0.018) : spread;
      const initialAngle = baseAngle + spreadFactor * compactSpread * 0.5;
      const roseRadius = weapon.id === 'shotgun' ? 1.8 : 0;
      const spawnForward = rosePoint[0] * roseRadius;
      const spawnLateral = rosePoint[1] * roseRadius;
      const pelletSpeed = weapon.id === 'shotgun' ? weapon.speed * (1 + rosePoint[0] * 0.045) : weapon.speed;
      const crit = Math.random() < (0.1 + player.luck * 0.002 + (player.permCrit || 0) * NV.BALANCE.CRIT_PERM_CHANCE);
      const overdriveMult = weapon.id === 'shotgun' && player.overdrive > 0 ? 1.5 : 1;
      bullets.push({
        x: player.x + Math.cos(baseAngle) * spawnForward - Math.sin(baseAngle) * spawnLateral,
        y: player.y - 20 + Math.sin(baseAngle) * spawnForward + Math.cos(baseAngle) * spawnLateral,
        vx: Math.cos(initialAngle) * pelletSpeed, vy: Math.sin(initialAngle) * pelletSpeed,
        damage: (crit ? finalDmg * 2 : finalDmg) * overdriveMult,
        color: weapon.color, dead: false, isEnemy: false, pierce: impact.pierce,
        crit, stunChance: 0,
        impactType: impact.type, splashRadius: impact.radius || 0, bounceLeft: impact.bounces || 0, hitTargets: [],
        // Estética de tier (visual; no se usa en colisiones). wid selecciona la forma.
        tier: vTier, glowColor, wid: weapon.id,
        // Crecimiento por nivel/fusión + halo dorado si el arma está fusionada.
        growth: NV.bulletSizeGrowth(state.currentWeaponLevel(), state.currentWeaponFusion),
        traveledDistance: 0,
        maxTravelDistance: (weapon.id === 'shotgun' || weapon.id === 'plasma') ? (weapon.range || 0) : 0,
        shotGroup: weapon.id === 'shotgun' ? shotGroups[burstIndex] : null,
        pelletIndex: weapon.id === 'shotgun' ? pelletIndex : null,
        shotgunBaseAngle: weapon.id === 'shotgun' ? baseAngle : null,
        shotgunSpreadFactor: weapon.id === 'shotgun' ? spreadFactor : null,
        shotgunMaxSpread: weapon.id === 'shotgun' ? spread : null,
        shotgunCompactSpread: weapon.id === 'shotgun' ? compactSpread : null,
        shotgunBloomStart: weapon.id === 'shotgun' ? (NV.BALANCE.SHOTGUN_BLOOM_START || 90) : null,
        shotgunSpeed: weapon.id === 'shotgun' ? pelletSpeed : null,
      });
      firedCount++;
      anyCrit = anyCrit || crit;
    }
    if (firedCount > 0) {
      emitWeaponAudio(state, weapon, player, firedCount, anyCrit);
    }
    return firedCount > 0;
  };
})();
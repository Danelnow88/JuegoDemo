// ===== DATOS: constantes de balanc / tuning =====
// Pura configuración (sin lógica). Se carga ANTES de game.js; game.js lee cada
// constante por alias local (p. ej. const FIRE_FPS = NV.BALANCE.FIRE_FPS;).
(() => {
  'use strict';
  const NV = window.NV;

  const FIRE_FPS = 60;
  const MIN_FIRE_INTERVAL = 4 / FIRE_FPS; // ~0.0667s -> máx ~15 disparos/s (piso anti-congestión)

  NV.BALANCE = {
    // Tope de buffers de entidad
    MAX_ENEMIES: 80, MAX_BULLETS: 200, MAX_PARTICLES: 200,
    // Presupuesto separado de balas por bando
    MAX_PLAYER_BULLETS: 150, MAX_ENEMY_BULLETS: 120,
    // Progresión permanente
    MAX_PERM_LEVEL: 10,
    // Fusión de armas repetidas: duplicar una arma que ya tenés sube su fusión
    // (+ daño) en vez de sumar un slot. Techo bajo para no desbalancear la curva.
    MAX_WEAPON_FUSION: 3,          // fusiones máximas por arma
    WEAPON_FUSION_DMG: 0.20,       // +20% de daño por nivel de fusión
    WEAPON_FUSE_PRICE: 15,         // precio de fusionar comprando duplicado en tienda
    // Venta de armas (shards in-run, siempre < compra 25 para no farmear economías).
    WEAPON_SELL_PRICES: { common: 6, uncommon: 9, rare: 12, epic: 16, legendary: 20 },
    // Cadencia de armas (fireRate se interpreta como frames a ~60fps)
    FIRE_FPS, MIN_FIRE_INTERVAL,
    WAVE_CADENCE_SCALE: 0.01,          // -1% de intervalo por oleada (máx -45% de factor)
    WEAPON_LEVEL_CADENCE_SCALE: 0.004, // -0.4% de intervalo por nivel de arma (máx -40%)
    // Misc
    SHIELD_COOLDOWN: 0.9,              // recarga del escudo del shielder (s): vulnerable entre bloqueos
    METEOR_BOSS_DMG_MULT: 0.3,         // Lluvia Estelar: daño de meteoro reducido contra jefes (anti one-shot)
    PHASE_AURA_DPS: 40,                // Fase Fantasma (NOVA): daño por segundo del aura espectral
    PHASE_AURA_RADIUS: 70,             // radio de la zona de daño del aura
    PHASE_AURA_BOSS_MULT: 0.3,         // multiplicador del aura contra el jefe (coherente con meteoro)
    PHASE_DETONATION_MULT: 0.5,        // Detonación Espectral: % del DoT acumulado que pega el estallido final
    MAX_AGILITY: 2,                    // tope de la mejora de Agilidad (x2 = +100% aceleración/freno)
    AGILITY_PER_UPGRADE: 0.2,          // +0.2 por compra (5 compras llegan al tope)
    WEAPON_KILLS_PER_LEVEL: 6,         // ~6 puntos de progreso por nivel
    WEAPON_PROGRESS_SCALE: 0.06,       // +6% de progreso por derribo, por oleada
    WEAPON_PROGRESS_CAP: 3,            // máx ~3 puntos de progreso por derribo
  };
  Object.freeze(NV.BALANCE);
})();

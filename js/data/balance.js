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
    MAX_HOSTILES: 30, MAX_HEAVY_HOSTILES: 7,
    MAX_SPEAKER_MINES: 6,
    SPEAKER_MINE_INITIAL_COUNT: 5,
    SPEAKER_MINE_DETONATE_TIME: 0.12,
    SPEAKER_MINE_VISUAL_RADIUS: 16,
    SPEAKER_MINE_TRIGGER_RADIUS: 14,
    SPEAKER_MINE_DAMAGE_BASE: 38,
    SPEAKER_MINE_DAMAGE_PER_WAVE: 0.5,
    SPEAKER_MINE_DAMAGE_CAP: 52,
    SPEAKER_MINE_PLAYER_MIN_DIST: 175,
    SPEAKER_MINE_SEPARATION: 105,
    SPEAKER_MINE_ARENA_MARGIN: 42,
    SPEAKER_MINE_PLACEMENT_ATTEMPTS: 24,
    SPEAKER_MINE_INITIAL_CADENCE: 0.28,
    SPEAKER_MINE_REFILL_CADENCE: 2.4,
    SPEAKER_MINE_TELEGRAPH_DURATION: 0.9,
    SPEAKER_MINE_REFILL_CADENCE_P3_1: 2.6,
    SPEAKER_MINE_REFILL_CADENCE_WAVE_THRESHOLD: 8,
    SPEAKER_MINE_TACTICAL_CHANCE: 0.7,
    SPEAKER_MINE_PLAYER_PREDICTION: 0.65,
    MINEFIELD_SPEED_NORMAL: 1.22,
    MINEFIELD_SPEED_FAST: 1.12,
    MINEFIELD_SPEED_ELITE: 1.10,
    MINEFIELD_SPEED_CAP: 260,
    MAX_ENEMIES: 30, MAX_BULLETS: 200, MAX_PARTICLES: 200,
    MAGNET_CAP: 50,
    SHOTGUN_PELLET_COUNT: 12,
    SHOTGUN_SPREAD: 0.44,
    SHOTGUN_COMPACT_SPREAD: 0.018,
    SHOTGUN_BLOOM_START: 90,
    SHOTGUN_UNIQUE_TARGET_CAP: 3,
    FLAME_TICK_RATE: 6,
    FLAME_BURN_DPS: 2,
    FLAME_BURN_DURATION: 0.6,
    // Movimiento controlado: las tasas se derivan de la velocidad efectiva para que
    // permanentes/temporales no alarguen la parada ni creen inercia descontrolada.
    MOVE_ACCEL_TIME: 0.13,
    MOVE_DECEL_TIME: 0.10,
    MOVE_TURN_TIME: 0.085,
    MOVE_REVERSE_TIME: 0.11,
    // Dash stamina: dos usos desde lleno, dash breve y recuperación por tiempo de simulación.
    DASH_STAMINA_MAX: 100,
    DASH_STAMINA_COST: 50,
    DASH_DURATION: 0.15,
    DASH_SPEED: 560,
    DASH_RECHARGE_DELAY: 0.90,
    DASH_REGEN_PER_SECOND: 100 / 2.9,
    // Presupuesto separado de balas por bando
    MAX_PLAYER_BULLETS: 150, MAX_ENEMY_BULLETS: 120,
    // Nuevas permanentes (por nivel): chance de crítico propio / esquiva / HP/s regen / % extra de drop
    PERM_MOVE_SPEED_PER_LEVEL: 0.02,
    PERM_MOVE_CONTROL_PER_LEVEL: 0.025,
    MAX_AGILITY: 2,
    AGILITY_PER_UPGRADE: 0.2,
    // Progresión permanente
    MAX_PERM_LEVEL: 10,
    // Nuevas permanentes (por nivel): chance de crítico propio / esquiva / HP/s regen / % extra de drop
    CRIT_PERM_CHANCE: 0.005,
    DODGE_PERM_CHANCE: 0.004,
    REGEN_PERM_HPSEC: 0.2,
    GREED_PERM_DROP: 0.03,
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
    WEAPON_MAX_LEVEL: 100,             // tope duro de nivel de arma (pico de poder)

    // Duración de oleada normal (segundos, cuenta regresiva): 25 - wave*0.4, piso 15.
    // ÚNICA fuente de verdad: nextWave y la barra de progreso leen de acá.
    WAVE_TIME_BASE: 25,
    WAVE_TIME_DECAY: 0.4,
    WAVE_TIME_MIN: 15,
  };
  // Duración base de la oleada (sin bonus de evento). Fórmula original fiel:
  // max(15, 25 - wave*0.4). ÚNICA fuente de verdad: nextWave y la barra de
  // progreso leen de acá (elimina la duplicación que era bug latente).
  NV.waveDuration = function (wave, waveEvent) {
    const base = Math.max(15, 25 - wave * 0.4);
    // Eventos de oleada (Tanda C): +25s para disfrutar el modificador (cap 90s).
    const bonus = waveEvent ? 25 : 0;
    return Math.min(90, base + bonus);
  };


  // Compensación económica (PASO 3): factor para escalar el intervalo de spawn en
  // oleadas largas, manteniendo la cantidad total de spawns (y score/shards) por oleada.
  NV.waveSpawnFactor = function (wave, waveEvent) {
    return NV.waveDuration(wave, waveEvent) / NV.waveDuration(wave);
  };

  // ===== B1: escalado de HP enemigo =====
  // Curva ORIGINAL: 1 + 0.30*wave (lineal) — crecía más rápido que el poder del
  // jugador y generaba la espiral descendente que mataba la partida antes de la 30.
  // Nueva curva: idéntica hasta la oleada 10 (onboarding intacto) y pendiente 0.22
  // a partir de ahí (continua en w=10: 4.0 = 1 + 0.30*10). Pura y testeable;
  // spawnEnemy (enemies.js) es su único consumidor.
  NV.enemyHpScale = function (wave) {
    const w = Math.max(1, wave || 1);
    if (w <= 10) return 1 + 0.30 * w;
    return 4 + (w - 10) * 0.22;
  };

  // ===== B2: piso de poder del jugador =====
  // El daño del arma escala +5% por oleada completada (automático, sin comprar),
  // para que el poder nunca quede estático contra el HP creciente (B1).
  // wave=1 -> x1.00 (partida igual a siempre). Pura y testeable;
  // shoot (weapons.js) es su único consumidor.
  NV.waveWeaponMult = function (wave) {
    const w = Math.max(1, wave || 1);
    return 1 + (w - 1) * 0.05;
  };

  // ===== Bono de daño por nivel de arma (curva con soft-cap) =====
  // Lineal hasta el nivel 50 (idéntico al comportamiento actual: +1 daño/nivel)
  // y +0.5 daño por nivel a partir de ahí. El tope duro WEAPON_MAX_LEVEL=100
  // marca el pico de poder sin romper la curva de dificultad media.
  // Consumidores: engine/weapons.js (daño de bala) y render/hud.js (stats TAB).
  NV.weaponLevelDamageBonus = function (level) {
    const L = Math.max(1, level || 1);
    if (L <= 50) return L;
    return 50 + (L - 50) * 0.5;
  };

  // ---- Números de daño con código de color por intensidad (sin "CRITICAL!") ----
  // Normal → blanco · Golpe sustancial → cian · Crítico → rojo intenso + fuente mayor.
  // Definido aquí (data/) para que engine/bullets.js y engine/enemies.js puedan
  // usarlo incluso en sandboxes mínimos que cargan balance.js sin fx.js.
  NV.DAMAGE_FLOAT_COLORS = { normal: '#FFFFFF', heavy: '#00E5FF', crit: '#FF2A4B' };
  NV.damageFloatStyle = function (dealt, crit) {
    if (crit) return { color: NV.DAMAGE_FLOAT_COLORS.crit, size: 17 };
    if ((dealt || 0) >= 20) return { color: NV.DAMAGE_FLOAT_COLORS.heavy, size: 15 };
    return { color: NV.DAMAGE_FLOAT_COLORS.normal, size: 13 };
  };

  // F10: difficulty modes
  NV.DIFFICULTY = {
    easy:   { id: "easy",   label: "Facil",   hpMult: 0.80, dmgMult: 0.75, spawnMult: 0.85 },
    normal: { id: "normal", label: "Normal",   hpMult: 1.00, dmgMult: 1.00, spawnMult: 1.00 },
    hard:   { id: "hard",   label: "Dificil", hpMult: 1.20, dmgMult: 1.25, spawnMult: 1.15 },
  };
  NV.DIFFICULTY_ORDER = ["easy", "normal", "hard"];
  NV.difficultyGet = function (id) { return NV.DIFFICULTY[id] || NV.DIFFICULTY.normal; };
  NV.difficultyHpMult = function (id) { return NV.difficultyGet(id).hpMult; };
  NV.difficultyDmgMult = function (id) { return NV.difficultyGet(id).dmgMult; };
  NV.HIT_SLOW = {
    NORMAL: { multiplier: 0.85, activeDuration: 0.15, immunity: 0.20 },
    ELITE:  { multiplier: 0.90, activeDuration: 0.12, immunity: 0.23 },
    BOSS:   { multiplier: 0.95, activeDuration: 0.08, immunity: 0.27 },
  };
  NV.hitSlowFor = function (category) { return NV.HIT_SLOW[category] || NV.HIT_SLOW.NORMAL; };
  NV.difficultySafeMult = function (kind, diffId) {
    if (!NV.DIFFICULTY) return 1;
    var d = NV.difficultyGet(diffId || (NV.settings && NV.settings.gameplay && NV.settings.gameplay.difficulty));
    if (!d) return 1;
    return kind === "hp" ? d.hpMult : kind === "dmg" ? d.dmgMult : kind === "spawn" ? (d.spawnMult||1) : 1;
  };
  Object.freeze(NV.BALANCE);
})();

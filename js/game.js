/* ============================================================
   NEON VOID - ROGUELITE
   ============================================================ */
(() => {
  'use strict';

  const GW = 900, GH = 520;
  const canvas = NV.canvas;
  const ctx = NV.ctx;
  let scaleX = 1, scaleY = 1;

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dw = Math.round(rect.width), dh = Math.round(rect.height);
    if (canvas.width !== dw || canvas.height !== dh) {
      canvas.width = dw; canvas.height = dh;
      scaleX = canvas.width / GW; scaleY = canvas.height / GH;
    }
  }
  const W = GW, H = GH;

  // === PUENTE OPCIONAL ESPECTRO LITE (Fase A) ===
  // Apagado por defecto: sin import de Three.js, canvas extra ni recursos GPU.
  NV.ESPECTRO_LITE_ACTIVE = false;
  const MAX_LITE_ENEMIES = 6;
  const ESPECTRO_THREE_CDN = 'https://unpkg.com/three@0.160.0/build/three.module.js';
  const espectroEntries = new Map();
  const ESPECTRO_VARIANTS = [
    [1, 0, 0], [1, 0.5, 0], [1, 0, 0.5], [1, 0.3, 0.1], [0.72, 0, 0.18],
  ];
  let espectroLiteLoading = false;
  let espectroLiteFailed = false;
  let espectroTime = 0;

  // === ESTADO ===
  let state = 'menu', frame = 0, lastTime = 0;
  let shake = 0, hitstop = 0, flashColor = null, flashAlpha = 0, specialVFX = null;
  let deathTimer = 0, deathShake = 0;

  // === JUGADOR ===
  const player = {
    x: W/2, y: H-100, hp: 100, maxHp: 100, speed: 200, color: '#7cf8ff',
    specialCd: 0, maxCd: 4, invuln: 0, character: 'boti',
    armor: 0, luck: 0, overdrive: 0, xp: 0, level: 1, xpToNext: 100,
    moveVx: 0, moveVy: 0, agility: 1,
  };

  // === ENTIDADES ===
  let enemies = [], bullets = [], particles = [], pickups = [], floatTexts = [], shockwaves = [], trails = [], weaponPickups = [], drones = [], meteors = [], bossChests = [];
  const MAX_ENEMIES = NV.BALANCE.MAX_ENEMIES, MAX_BULLETS = NV.BALANCE.MAX_BULLETS, MAX_PARTICLES = NV.BALANCE.MAX_PARTICLES;
  // Presupuesto separado de balas por bando: evita que las balas enemigas
  // (p. ej. muchos ESCOPURAS) congele el disparo del jugador al saturar el buffer común.
  const MAX_PLAYER_BULLETS = NV.BALANCE.MAX_PLAYER_BULLETS;
  const MAX_ENEMY_BULLETS = NV.BALANCE.MAX_ENEMY_BULLETS;
  // Cuenta cuántas balas hay de cada bando (para respetar los topes propios).
  function playerBulletCount() { let n = 0; for (const b of bullets) if (!b.isEnemy) n++; return n; }
  function enemyBulletCount() { let n = 0; for (const b of bullets) if (b.isEnemy) n++; return n; }

  function espectroHash(e, salt) {
    const value = Math.sin((e.x || 0) * 12.9898 + (e.y || 0) * 78.233 + (e.radius || 1) * 37.719 + salt * 43.1234) * 43758.5453;
    return value - Math.floor(value);
  }

  function shouldUseEspectroLite(e) {
    return !!(NV.ESPECTRO_LITE_ACTIVE && e && !e.dead && !e.isElite && e.enemyTypeId === 'wisp');
  }

  function isEnemyRenderedByLite(e) {
    return !!(NV.ESPECTRO_LITE_ACTIVE && hasEspectroLiteApi(NV.espectroLite) && NV.espectroLite.initialized && espectroEntries.has(e));
  }

  function hasEspectroLiteApi(lite) {
    return !!(lite
      && typeof lite.setVisible === 'function'
      && typeof lite.clearEnemies === 'function'
      && typeof lite.removeEnemy === 'function'
      && typeof lite.createEnemy === 'function'
      && typeof lite.syncEnemy === 'function'
      && typeof lite.update === 'function');
  }

  // Cortafuegos: una incompatibilidad, caché vieja o error WebGL jamás debe
  // propagarse al requestAnimationFrame ni alterar el gameplay Canvas2D.
  function disableEspectroLiteSafely() {
    const lite = NV.espectroLite;
    try {
      if (lite && typeof lite.setVisible === 'function') lite.setVisible(false);
      else {
        const staleCanvas = document.querySelector('.espectro-lite-canvas');
        if (staleCanvas) staleCanvas.style.display = 'none';
      }
    } catch (_) { /* fallback Canvas2D: ignorar errores de una capa visual */ }
    espectroEntries.clear();
    espectroLiteFailed = true;
    NV.ESPECTRO_LITE_ACTIVE = false;
  }

  function ensureEspectroLite() {
    if (!NV.ESPECTRO_LITE_ACTIVE || espectroLiteLoading || espectroLiteFailed) return;
    if (NV.espectroLite && NV.espectroLite.initialized) return;
    espectroLiteLoading = true;
    import(ESPECTRO_THREE_CDN).then((THREE) => {
      if (!NV.ESPECTRO_LITE_ACTIVE) return;
      const host = canvas.parentElement;
      const rect = canvas.getBoundingClientRect();
      const webglCanvas = document.createElement('canvas');
      webglCanvas.className = 'espectro-lite-canvas';
      const camera = new THREE.OrthographicCamera(-W / 2, W / 2, H / 2, -H / 2, 0.1, 100);
      camera.position.z = 10;
      const lite = NV.initEspectroLite(THREE, {
        host, canvas: webglCanvas, camera,
        width: Math.max(1, Math.round(rect.width)),
        height: Math.max(1, Math.round(rect.height)),
      });
      if (!lite || !hasEspectroLiteApi(lite)) throw new Error('API incompatible de Espectro Lite');
      lite.setVisible(false);
    }).catch(() => {
      disableEspectroLiteSafely();
    }).finally(() => { espectroLiteLoading = false; });
  }

  function clearEspectroBridge() {
    const lite = NV.espectroLite;
    if (hasEspectroLiteApi(lite)) {
      try {
        lite.clearEnemies();
        lite.setVisible(false);
      } catch (_) {
        disableEspectroLiteSafely();
      }
    } else if (lite) {
      disableEspectroLiteSafely();
    }
    espectroEntries.clear();
  }

  function updateEspectroBridge(dt) {
    try {
      if (!NV.ESPECTRO_LITE_ACTIVE || state !== 'playing' || paused) {
        const inactiveLite = NV.espectroLite;
        if (inactiveLite) {
          if (!hasEspectroLiteApi(inactiveLite)) disableEspectroLiteSafely();
          else inactiveLite.setVisible(false);
        }
        return;
      }

      const selected = [];
      for (const e of enemies) {
        if (shouldUseEspectroLite(e) && selected.length < MAX_LITE_ENEMIES) selected.push(e);
      }
      if (!selected.length) {
        clearEspectroBridge();
        return;
      }

      ensureEspectroLite();
      const lite = NV.espectroLite;
      if (!lite || !lite.initialized) return; // Canvas2D continúa visible durante carga/fallo
      if (!hasEspectroLiteApi(lite)) { disableEspectroLiteSafely(); return; }

      const selectedSet = new Set(selected);
      for (const [enemy, entry] of espectroEntries) {
        if (!selectedSet.has(enemy)) {
          lite.removeEnemy(entry);
          espectroEntries.delete(enemy);
        }
      }

      for (const e of selected) {
        let entry = espectroEntries.get(e);
        if (!entry) {
          const variantIndex = Math.floor(espectroHash(e, 3) * ESPECTRO_VARIANTS.length);
          entry = lite.createEnemy({
            x: e.x - W / 2, y: H / 2 - e.y,
            scale: Math.max(0.2, Math.min(0.4, e.radius / 30)),
            phase: espectroHash(e, 2) * Math.PI * 2,
            form: espectroHash(e, 1),
            variantColor: ESPECTRO_VARIANTS[variantIndex],
          });
          if (entry) espectroEntries.set(e, entry);
        }
        if (entry) {
          lite.syncEnemy(entry, {
            x: e.x - W / 2, y: H / 2 - e.y,
            scale: Math.max(0.2, Math.min(0.4, e.radius / 30)),
          });
        }
      }

      espectroTime += dt;
      const beat = NV.rhythm ? Math.max(NV.rhythm.kick || 0, NV.rhythm.onset || 0) : 0;
      lite.setVisible(espectroEntries.size > 0);
      NV.updateEspectroLite(espectroTime, beat);
    } catch (_) {
      disableEspectroLiteSafely();
    }
  }

  NV.toggleEspectroLite = function (enabled) {
    NV.ESPECTRO_LITE_ACTIVE = !!enabled;
    espectroLiteFailed = false;
    if (!NV.ESPECTRO_LITE_ACTIVE) clearEspectroBridge();
    return NV.ESPECTRO_LITE_ACTIVE;
  };

  // === PROGRESO ===
  let wave = 1, score = 0, shards = 0, waveTimer = 0, spawnTimer = 0, boss = null, transition = 0;
  // Evento de oleada activo (null si no hay): modifica la run de esa oleada.
  let waveEvent = null;
  const WAVE_EVENTS = NV.WAVE_EVENTS;

  // === INVENTARIO ===
  let inventory = [];
  const INVENTORY_SLOTS = 6;
  let consumableItems = [];
  let consumSel = 0; // índice del tipo de consumible seleccionado (cicla con Q, usa F)
  const CONSUMABLES = NV.CONSUMABLES;

  // === PROGRESIÓN PERMANENTE ===
  let metaShards = 0;
  let permUpgrades = NV.defaultPermUpgrades();
  // Compras por partida en la tienda de oleada (topes anti-acumulación infinita).
  let shopBought = {};
  const SHOP_CAPS = { hp: 8, armor: 5, luck: 7 }; // +25 HP ×8, +3 armadura ×5, +2 suerte ×7
  // Slots de mejoras por partida: cada mejora ocupa UN slot (agrupada por tipo) y sube de nivel.
  const UPGRADE_SLOT_CAP = 6;
  const UPGRADE_LEVEL_CAP = 6; // nivel máximo por mejora
  const UPGRADE_LEVELS = {
    hp: Math.min(SHOP_CAPS.hp, UPGRADE_LEVEL_CAP),
    speed: UPGRADE_LEVEL_CAP,
    armor: Math.min(SHOP_CAPS.armor, UPGRADE_LEVEL_CAP),
    luck: Math.min(SHOP_CAPS.luck, UPGRADE_LEVEL_CAP),
  };
  let upgradeSlots = []; // registro de compras de mejoras de la partida actual (se agrupa por tipo)
  // Tope de compras del mismo consumible POR VISITA a la tienda (se resetea en showShop).
  const CONSUMABLE_CAP = 3;
  let consumableBought = {};
  const CONSUMABLE_STACK_CAP = NV.CONSUMABLE_STACK_CAP;
  const CONSUMABLE_TYPE_SLOT_CAP = NV.CONSUMABLE_TYPE_SLOT_CAP;

  // Mejoras permanentes comprables con metaShards (afectan a TODOS los personajes).
  // El coste crece con el nivel y tienen un tope máximo (MAX_PERM_LEVEL).
  const MAX_PERM_LEVEL = NV.BALANCE.MAX_PERM_LEVEL;
  const PERM_UPGRADES = NV.PERM_UPGRADES;

  // === INPUT ===
  let moveLeft = false, moveRight = false, moveUp = false, moveDown = false;
  let slideHeld = false, specialPressed = false, showStats = false, showHUD = true, paused = false;

  // === PERSONAJES ===
  const CHARACTERS = NV.CHARACTERS;

  // === ARMAS (10) ===
  const WEAPONS = NV.WEAPONS;

  const RARITY_COLORS = NV.RARITY_COLORS;
  let currentWeapon = NV.starterWeapon(), fireTimer = 0;
  let killCombo = { count: 0, timer: 0 }; // combo de kills (E1)
  let currentAutoTarget = null;
  let densityField = null;
  let damageFeedback = null, invulnerabilityFeedback = null, previousInvulnerability = 0;
  const momentumVisual = { shift: false, previousVx: 0, previousVy: 0, previousSpeed: 0 };
  let heartbeatTimer = 0, heartbeatWasCritical = false;
  let countdownLastSecond = 0;
  // Cadencia determinista (en segundos). fireRate se interpreta como frames a ~60fps.
  const FIRE_FPS = NV.BALANCE.FIRE_FPS;                 // frames por segundo asumidos en fireRate
  const MIN_FIRE_INTERVAL = NV.BALANCE.MIN_FIRE_INTERVAL; // ~0.0667s -> máx ~15 disparos/s (piso anti-congestión)
  const WAVE_CADENCE_SCALE = NV.BALANCE.WAVE_CADENCE_SCALE;     // -1% de intervalo por oleada (máx -45% de factor)
  const WEAPON_LEVEL_CADENCE_SCALE = NV.BALANCE.WEAPON_LEVEL_CADENCE_SCALE; // -0.4% de intervalo por nivel de arma (máx -40%)
  const SHIELD_COOLDOWN = NV.BALANCE.SHIELD_COOLDOWN;        // recarga del escudo del shielder (s): vulnerable entre bloqueos
  const MAX_AGILITY = NV.BALANCE.MAX_AGILITY;              // tope de la mejora de Agilidad (x2 = +100% aceleración/freno)
  const AGILITY_PER_UPGRADE = NV.BALANCE.AGILITY_PER_UPGRADE;    // +0.2 por compra (5 compras llegan al tope)
  // Intervalo de disparo efectivo: base del arma acortada por la dificultad de la oleada
  // (factor wave) y por el nivel del arma (factor nivel): la cadencia mejora al subir de nivel.
  function weaponFireInterval() {
    const base = currentWeapon.fireRate / FIRE_FPS;                      // intervalo base en segundos
    const waveFactor = Math.max(0.55, 1 - WAVE_CADENCE_SCALE * wave);    // dificultad de la oleada
    const levelFactor = Math.max(0.6, 1 - WEAPON_LEVEL_CADENCE_SCALE * (currentWeaponLevel() - 1)); // nivel del arma
    return Math.max(MIN_FIRE_INTERVAL, base * waveFactor * levelFactor);
  }
  // Niveles por arma: cada derribo aporta "puntos de progreso" (weaponKills) que
  // pesan según la dificultad de la oleada (más difícil = más progreso), con tope.
  let weaponLevels = {}, weaponKills = {};
  // Fusión de repetidas: duplicar un arma sube este contador (cap MAX_WEAPON_FUSION).
  // Multiplica el daño vía NV.weaponFusionDamage. Reseteado por partida como weaponLevels.
  let weaponFus = {};
  const MAX_WEAPON_FUSION = NV.BALANCE.MAX_WEAPON_FUSION;
  const WEAPON_FUSION_DMG = NV.BALANCE.WEAPON_FUSION_DMG;
  const WEAPON_FUSE_PRICE = NV.BALANCE.WEAPON_FUSE_PRICE;
  const WEAPON_SELL_PRICES = NV.BALANCE.WEAPON_SELL_PRICES;
  function currentWeaponFusion() { return weaponFus[currentWeapon.id] || 0; }
  function weaponFusionLevel(id) { return weaponFus[id] || 0; }
  const WEAPON_KILLS_PER_LEVEL = NV.BALANCE.WEAPON_KILLS_PER_LEVEL;   // ~6 puntos de progreso por nivel
  const WEAPON_PROGRESS_SCALE = NV.BALANCE.WEAPON_PROGRESS_SCALE; // +6% de progreso por derribo, por oleada
  const WEAPON_PROGRESS_CAP = NV.BALANCE.WEAPON_PROGRESS_CAP;      // máx ~3 puntos de progreso por derribo
  // Progreso que aporta un derribo: crece con la oleada, acotado para no explotar.
  function weaponKillProgress() {
    return Math.min(WEAPON_PROGRESS_CAP, 1 + WEAPON_PROGRESS_SCALE * wave);
  }
  function currentWeaponLevel() { return weaponLevels[currentWeapon.id] || 1; }
  // Estética por nivel del arma: cada 10 niveles cambia la apariencia de los disparos
  // (tier). Solo visual; NO afecta colisiones ni velocidad/pierce/count de proyectiles.
  const BULLET_TIER_COLORS = NV.BULLET_TIER_COLORS;
  const MAX_BULLET_TIER = BULLET_TIER_COLORS.length - 1; // 5 (nivel >= 60)
  function weaponVisualTier() {
    return Math.min(MAX_BULLET_TIER, Math.floor(currentWeaponLevel() / 10));
  }
  // Identidad visual de cada arma: forma y tamaño base del proyectil del jugador.
  // El "len" es largo (a lo largo del vuelo), "w" grosor (transversal). Solo render;
  // no participan en colisiones. El tier aplica un factor de crecimiento tardío y sutil.
  const BULLET_DEFS = NV.BULLET_DEFS;

  // === ENEMIGOS BÁSICOS (7 tipos) ===
  const ENEMY_TYPES = NV.ENEMY_TYPES;

  // === ÉLITES (8 tipos) ===
  const ELITE_TYPES = NV.ELITE_TYPES;

  // === BOSSES (10 tipos) ===
    const BOSS_TYPES = NV.BOSS_TYPES;
  const formatPoints = NV.formatPoints;
  // === AUDIO (migrado a js/audio/synth.js) ===
  const initAudio = NV.initAudio;
  const updateMusic = NV.updateMusic;
  const playWeaponSound = NV.playWeaponSound;
  const sfx = NV.sfx;

  // === DOM ELEMENTS ===
  const dom = NV.dom;

  // === INICIALIZACIÓN ===
  function init() {
    console.log('[INIT] Iniciando...');
    if (/[?&]fresh=1/.test((window.location && window.location.search) || '')) {
      metaFrozen = true;
      metaShards = 0;
      permUpgrades = NV.defaultPermUpgrades();
      console.log('[META] Modo ?fresh=1: mejoras permanentes y meta-shards en cero (no se guarda progreso).');
    } else {
      loadMeta();
    }
    if (NV.rhythmRestorePref) NV.rhythmRestorePref();
    resizeCanvas();
    NV.renderCharacterCards(dom.charGrid, CHARACTERS, player.character);
    renderMenuSkillIcons();

    const charCards = document.querySelectorAll('.char-card');
    charCards.forEach(card => {
      card.addEventListener('click', () => {
        charCards.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        player.character = card.getAttribute('data-char');
        const char = CHARACTERS[player.character];
        player.color = char.color;
        player.maxHp = (char.stats ? char.stats.hp : 100) + permUpgrades.hp * 20;
        player.hp = player.maxHp;
        player.speed = char.stats ? char.stats.speed : 200;
        player.speed *= (1 + permUpgrades.speed * 0.15);
        player.armor = (char.stats ? char.stats.armor : 0) + (permUpgrades.armor || 0);
        player.luck = (char.stats ? char.stats.luck : 0) + permUpgrades.luck * 10;
        player.permCrit = permUpgrades.crit; player.permDodge = permUpgrades.dodge;
        player.permRegen = permUpgrades.regen; player.permGreed = permUpgrades.greed;
        player.maxCd = char.maxCd;
        dom.sound.textContent = NV.soundOn ? '♫ ON' : '♫ OFF';
        dom.sound.classList.toggle('off', !NV.soundOn);
        console.log('[CHAR] Seleccionado:', player.character);
      });
    });

    dom.startBtn.addEventListener('click', () => {
      console.log('[CLICK] JUGAR');
      initAudio();
      startGame();
    });

    dom.restartBtn.addEventListener('click', () => showMenu());
    dom.skipWave.addEventListener('click', skipShop);
    if (dom.permBtn) dom.permBtn.addEventListener('click', openPermShop);
    if (dom.permBack) dom.permBack.addEventListener('click', closePermShop);
    window.addEventListener('resize', resizeCanvas);
    // Rueda del mouse: arma anterior/siguiente (también funciona para todos los personajes,
    // el inventario es compartido). passive:false para poder cancelar el scroll.
    window.addEventListener('wheel', (e) => {
      if (state !== 'playing' || paused) return;
      cycleWeapon(e.deltaY > 0 ? 1 : -1);
      e.preventDefault();
    }, { passive: false });
    // Click sobre un slot de consumible (HUD): lo selecciona como activo.
    canvas.addEventListener('click', (e) => {
      if (state !== 'playing' || paused || !NV.consumSlotRects) return;
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) / scaleX, my = (e.clientY - rect.top) / scaleY;
      for (let i = 0; i < NV.consumSlotRects.length; i++) {
        const r = NV.consumSlotRects[i];
        if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
          if (consumSel !== i) { consumSel = i; sfx.wheelSelect(); }
          return;
        }
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') moveLeft = true;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') moveRight = true;
      if (e.code === 'ArrowUp' || e.code === 'KeyW') moveUp = true;
      if (e.code === 'ArrowDown' || e.code === 'KeyS') moveDown = true;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') { slideHeld = true; e.preventDefault(); }
      if (e.code === 'Space' || e.code === 'KeyZ' || e.code === 'KeyX') {
        specialPressed = true; e.preventDefault();
      }
      if (e.code === 'Tab') { showStats = !showStats; e.preventDefault(); }
      if (e.code === 'KeyP') togglePause();
      if (e.code === 'KeyF' && state === 'playing' && !paused) {
        useConsumable();
        e.preventDefault();
      }
      if (e.code === 'KeyQ' && state === 'playing' && !paused) {
        // Cicla el consumible seleccionado (el resaltado en el HUD muestra cuál se usa con F).
        const groups = NV.groupConsumables(consumableItems);
        if (groups.length) { consumSel = NV.cycleIndex(consumSel, groups.length, -1); sfx.wheelSelect(); }
        e.preventDefault();
      }
      if (e.code === 'KeyE' && state === 'playing' && !paused) {
        // Cicla en sentido inverso al Q para poder movernos en ambos sentidos entre tipos.
        const groups = NV.groupConsumables(consumableItems);
        if (groups.length) { consumSel = NV.cycleIndex(consumSel, groups.length, +1); sfx.wheelSelect(); }
        e.preventDefault();
      }
      const digit = /^Digit([1-6])$/.exec(e.code);
      if (digit && state === 'playing' && !paused) {
        equipFromInventory(parseInt(digit[1], 10) - 1);
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') moveLeft = false;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') moveRight = false;
      if (e.code === 'ArrowUp' || e.code === 'KeyW') moveUp = false;
      if (e.code === 'ArrowDown' || e.code === 'KeyS') moveDown = false;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') slideHeld = false;
      if (e.code === 'Space' || e.code === 'KeyZ' || e.code === 'KeyX') specialPressed = false;
    });

    // === PAUSA (tecla P) ===
    function togglePause() {
      if (state !== 'playing') return;
      paused = !paused;
      if (paused) dom.startScreen.classList.add('hidden');
    }

    // === CAMBIO DE ARMA (teclas 1-6 entre las recogidas) ===
    function equipFromInventory(index) {
      if (index < 0 || !inventory[index] || inventory[index] === currentWeapon) return;
      currentWeapon = inventory[index];
      addFloatText(W / 2, H / 2 - 40, 'EQUIPADO: ' + currentWeapon.name, RARITY_COLORS[currentWeapon.rarity]);
      updateHUD();
      sfx.wheelSelect();
    }

    // === CAMBIO DE ARMA CON LA RUEDA DEL MOUSE (pistola base + inventario, circular) ===
    function cycleWeapon(dir) {
      if (state !== 'playing' || paused) return;
      const list = [NV.starterWeapon()].concat(inventory);
      // Normalizar currentWeapon a un índice válido de `list`: si quedó desreferenciado
      // (p.ej. tras fusionar o recoger el arma equipada) cae a la pistola base (list[0]),
      // para que indexOf nunca falle y el ciclo sea estable. (Hipótesis A del bug)
      const ci = list.indexOf(currentWeapon);
      const base = ci < 0 ? 0 : ci;
      const next = NV.cycleWeapon(list[base], list, dir);
      if (!next || next === list[base]) return;
      currentWeapon = next;
      addFloatText(W / 2, H / 2 - 40, 'EQUIPADO: ' + currentWeapon.name, RARITY_COLORS[currentWeapon.rarity]);
      updateHUD();
      sfx.wheelSelect();
    }

    dom.sound.addEventListener('click', () => {
      NV.soundOn = !NV.soundOn;
      dom.sound.textContent = NV.soundOn ? '♫ ON' : '♫ OFF';
      dom.sound.classList.toggle('off', !NV.soundOn);
    });

    setupRhythmUI();

        if (dom.hudToggle) {
      dom.hudToggle.addEventListener('click', () => {
        showHUD = !showHUD;
        dom.hudToggle.classList.toggle('active', showHUD);
        dom.hudToggle.textContent = showHUD ? 'HUD' : 'NO HUD';
      });
    }
    if (dom.charBtn) {
      dom.charBtn.addEventListener('click', () => {
        showStats = !showStats;
      });
    }

    showMenu();
    requestAnimationFrame(loop);
  }

    function setupRhythmUI() {
    if (!NV.externalAudio) return;
    const widget = dom.rwAddMusicBtn ? dom.rwAddMusicBtn.parentElement : null;
    if (!widget) return;

    // Posiciona el widget (absolute dentro de .hud relative) justo en el hueco
    // entre .logo y .stats (.stat-wave), calculado dinámicamente para que no se
    // rompa si cambia el ancho del logo ni desplace a ningún otro elemento.
    function positionRhythmWidget() {
      const hud = widget.parentElement;
      if (!hud) return;
      const logo = hud.querySelector('.logo');
      const stats = hud.querySelector('.stats');
      if (!logo || !stats || !hud.getBoundingClientRect) return;
      const hudRect = hud.getBoundingClientRect();
      const logoRect = logo.getBoundingClientRect();
      const statsRect = stats.getBoundingClientRect();
      // hueco izquierdo (borde der del logo) y derecho (arranque de .stats)
      const gapL = logoRect.right - hudRect.left;
      const gapR = statsRect.left - hudRect.left;
      if (gapR <= gapL + 20) return; // poco espacio: evitar sobre-escrituras
      // Anclar pegado al borde derecho del logo con un margen pequeño
      // (no centrar en el hueco completo). Margen de 36px de separación visual.
      const w = widget.offsetWidth || 0;
      const MARGIN = 36;
      // Clamp para que nunca invada el arranque de .stats
      const left = Math.min(gapL + MARGIN, gapR - w - 6);
      widget.style.left = left + 'px';
      widget.style.top = '50%';
      widget.style.transform = 'translateY(-50%)';
    }
    positionRhythmWidget();
    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('resize', positionRhythmWidget);
    }

    const statusText = (r) => {
      r = r || NV.rhythm;
      if (!NV.rhythmSupported || !NV.rhythmSupported()) return 'Captura no soportada. Probá el micrófono si está disponible.';
      if (r.state === 'starting') return 'Esperando permiso del navegador… elegí una pestaña/ventana con audio y activá “compartir audio” si aparece.';
      if (r.state === 'listening' && r.mode === 'tab') return 'Captura de pestaña activa: los fondos reaccionan de forma sutil. La música no se reamplifica.';
      if (r.state === 'listening' && r.mode === 'mic') return 'Micrófono activo: los fondos reaccionan de forma sutil.';
      if (r.state === 'denied') return 'Permiso cancelado o denegado. Podés intentarlo de nuevo cuando quieras.';
      if (r.error === 'no-audio-track') return 'La captura no incluyó audio. Volvé a intentar y marcá “compartir audio”.';
      if (r.streamEnded) return 'Captura finalizada. Podés volver a activarla desde el menú.';
      return 'Opcional: compartí una pestaña/ventana con audio. Solo se analiza el volumen/frecuencias para fondos sutiles.';
    };
    const refresh = (r) => {
      r = r || NV.rhythm;
      const active = (r.state === 'listening' || r.state === 'starting');
      if (dom.rwAddMusicBtn) {
        dom.rwAddMusicBtn.disabled = !!active;
        dom.rwAddMusicBtn.title = active ? 'Música ya capturada' : 'Agregar música (capturar pestaña/ventana)';
        widget.title = statusText(r);
      }
      if (dom.rwStopBtn) {
        dom.rwStopBtn.disabled = !active;
        dom.rwStopBtn.title = 'Detener captura';
      }
    };
    NV.rhythmNotifier(refresh);
    if (dom.rwAddMusicBtn) dom.rwAddMusicBtn.addEventListener('click', () => { NV.rhythmToggleEnabled(true); NV.externalAudio.startDisplayCapture(); });
    if (dom.rwStopBtn) dom.rwStopBtn.addEventListener('click', () => { NV.rhythmToggleEnabled(false); NV.externalAudio.stop(); });
    refresh(NV.rhythm);

    // Anima el ícono SVG del widget (pulso de beat, color por hue, glow por
    // energía) reutilizando NV.rhythm, actualizado una vez por frame desde el
    // loop del juego. Sin captura activa queda estático (es la señal visual).
    function updateRhythmWidgetIcon() {
      const icon = dom.rwIcon;
      if (!icon) return;
      const glyph = icon.querySelector('svg.mn') || icon;
      const r = NV.rhythm;
      if (!r || r.state !== 'listening' || !r.enabled) {
        glyph.style.transform = '';
        icon._smoothScale = 1;
        icon._smoothSkew = 0;
        icon._pulseEnv = 0;
        icon._energyEnv = 0;
        icon._breathPhase = 0;
        icon._smoothT = 0;
        icon.style.color = '';
        icon.style.opacity = '';
        icon.style.filter = '';
        return;
      }
      const hue = (r.hue == null) ? 200 : r.hue;
      const beat = r.beat || 0;
      const perc = Math.max(beat, (r.kick || 0) * 0.85, (r.onset || 0) * 0.65);
      const energy = Math.max(0, Math.min(1, r.energy || 0));
      // Movimiento del ícono: beat + respiración continua por energía. El beat
      // da golpes notorios, pero mientras haya audio real (energy > piso) el
      // ícono nunca queda 100% quieto: respira suavemente proporcional al nivel.
      const targetPulse = Math.min(1, perc * 2.1);
      const nowMs = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      const prevMs = icon._smoothT || nowMs;
      const dtMs = Math.max(0, Math.min(80, nowMs - prevMs));
      icon._smoothT = nowMs;
      const dtSec = dtMs / 1000;
      const curPulse = icon._pulseEnv || 0;
      const pulseTau = targetPulse > curPulse ? 45 : 300;
      const pulseA = 1 - Math.exp(-dtMs / pulseTau);
      const pulseEnv = curPulse + (targetPulse - curPulse) * pulseA;
      icon._pulseEnv = pulseEnv;
      const curvedPulse = pulseEnv * pulseEnv * (3 - 2 * pulseEnv);
      const curEnergy = icon._energyEnv || 0;
      const energyTau = energy > curEnergy ? 180 : 520;
      const energyA = 1 - Math.exp(-dtMs / energyTau);
      const energyEnv = curEnergy + (energy - curEnergy) * energyA;
      icon._energyEnv = energyEnv;
      const hasAudio = energyEnv > 0.025;
      const phaseSpeed = (1.55 + energyEnv * 2.8 + curvedPulse * 1.6) * Math.PI * 2;
      icon._breathPhase = (icon._breathPhase || 0) + (hasAudio ? dtSec * phaseSpeed : 0);
      const breath = hasAudio ? (0.5 + 0.5 * Math.sin(icon._breathPhase)) : 0;
      const breathAmp = hasAudio ? (0.10 + energyEnv * 0.18) : 0;
      const targetScale = Math.min(1.62, 1 + breathAmp * breath + 0.48 * curvedPulse);
      const targetSkew = 4.2 * curvedPulse + (hasAudio ? Math.sin(icon._breathPhase * 1.35) * energyEnv * 1.25 : 0);
      const curScale = (icon._smoothScale == null) ? 1 : icon._smoothScale;
      const curSkew = (icon._smoothSkew == null) ? 0 : icon._smoothSkew;
      const scaleTau = targetScale > curScale ? 35 : 240;
      const skewTau = targetSkew > curSkew ? 35 : 200;
      const scaleA = 1 - Math.exp(-dtMs / scaleTau);
      const skewA = 1 - Math.exp(-dtMs / skewTau);
      const smoothScale = curScale + (targetScale - curScale) * scaleA;
      const smoothSkew = curSkew + (targetSkew - curSkew) * skewA;
      icon._smoothScale = smoothScale;
      icon._smoothSkew = smoothSkew;
      glyph.style.transform = 'scale(' + smoothScale.toFixed(4) + ') skewX(' + smoothSkew.toFixed(2) + 'deg)';
      // Color dinámico por hue calculado (mismo que tiñe el fondo)
      icon.style.color = 'hsl(' + Math.round(hue) + ',75%,62%)';
      // Brillo/glow fade en función de la energía detectada
      icon.style.opacity = (0.65 + energy * 0.35).toFixed(3);
      icon.style.filter = 'drop-shadow(0 0 ' + (2 + energy * 6).toFixed(1) + 'px hsl(' + Math.round(hue) + ',80%,60%))';
      // ===== TEMP DEBUG (eliminar tras diagnosticar) — activar con index.html?rhythmdebug=1 =====
      if (typeof NV._rhythmDbg === 'undefined') {
        NV._rhythmDbg = (typeof location !== 'undefined') && /[?&]rhythmdebug=1/.test(location.search || '');
        NV._rhythmDbgLast = 0; NV._rhythmDbgSumT = 0; NV._rhythmDbgMaxBeat = 0; NV._rhythmDbgLastTr = '';
      }
      if (NV._rhythmDbg) {
        NV._rhythmDbgMaxBeat = Math.max(NV._rhythmDbgMaxBeat, beat);
        NV._rhythmDbgLastTr = glyph.style.transform;
        const dnow = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        if (beat > 0.3 && dnow - NV._rhythmDbgLast > 120) {
          NV._rhythmDbgLast = dnow;
          console.log('[rhythm-icon] KICK beat=' + beat.toFixed(3) + ' hue=' + Math.round(hue) + ' energy=' + energy.toFixed(3) + ' transform="' + glyph.style.transform + '"');
        }
        if (dnow - NV._rhythmDbgSumT >= 1000) {
          NV._rhythmDbgSumT = dnow;
          let mn = 255, mx = 0, sum = 0, n = 0;
          if (r.data) for (let i = 0; i < r.data.length; i++) { const v = r.data[i]; if (v < mn) mn = v; if (v > mx) mx = v; sum += v; n++; }
          console.log('[rhythm-icon] 1s maxBeat=' + NV._rhythmDbgMaxBeat.toFixed(3) + ' energy=' + energy.toFixed(3) + ' bass=' + (r.bass || 0).toFixed(3) + ' hue=' + Math.round(hue) + ' rawBytes=' + (n ? (mn + '/' + Math.round(sum / n) + '/' + mx) : 'n/a') + ' state=' + r.state + ' lastTransform="' + NV._rhythmDbgLastTr + '"');
          NV._rhythmDbgMaxBeat = 0;
        }
      }
      // ===== FIN TEMP DEBUG =====
    }
    NV.updateRhythmWidgetIcon = updateRhythmWidgetIcon;

    // ===== TEMP DEBUG: tecla T fuerza un pulso sin audio — eliminar tras diagnosticar =====
    // Prueba binaria: si el ícono se mueve con T => el problema es la detección de
    // audio real (r.beat nunca sube). Si no se mueve ni con T => render/CSS/JS.
    const dbgKey = (typeof location !== 'undefined') && /[?&]rhythmdebug=1/.test(location.search || '');
    if (dbgKey) {
      console.log('[rhythm-icon] debug ACTIVO: apretá T para pulso forzado (sin música)');
      window.addEventListener('keydown', (e) => {
        if (e.code !== 'KeyT') return;
        const r = NV.rhythm;
        const prev = { state: r.state, enabled: r.enabled };
        r.enabled = true;
        r.state = 'listening';
        r.beat = 1; r.hue = 180; r.energy = 1;
        console.log('[rhythm-icon] PULSO FORZADO: beat=1 hue=180 energy=1 state=listening');
        if (r._dbgRestore) clearTimeout(r._dbgRestore);
        r._dbgRestore = setTimeout(() => {
          r.beat = 0; r.energy = 0;
          r.state = prev.state; r.enabled = prev.enabled;
          console.log('[rhythm-icon] pulso forzado finalizado (estado restaurado)');
        }, 350);
      });
    }
    // ===== FIN TEMP DEBUG =====
  }

  function loadMeta() {
    try {
      const saved = JSON.parse(localStorage.getItem('neonVoidMeta') || '{}');
      metaShards = saved.metaShards || 0;
      permUpgrades = NV.normalizePermUpgrades(saved.permUpgrades);
    } catch (e) { console.warn('[META] Error:', e); }
  }
  // Modo testing (?fresh=1): empieza sin permanentes ni meta-shards y NO guarda,
  // para tunear balance desde cero sin pisar el progreso real.
  let metaFrozen = false;
  function saveMeta() {
    if (metaFrozen) return;
    try { localStorage.setItem('neonVoidMeta', JSON.stringify({ metaShards, permUpgrades })); } catch (e) { console.warn('[META] Error:', e); }
  }
  // Consola: NV.resetMeta() borra el progreso persistente al instante.
  NV.resetMeta = function () {
    try { localStorage.removeItem('neonVoidMeta'); console.log('[META] Progreso borrado. Recargá para empezar de cero.'); }
    catch (e) { console.warn('[META] Error:', e); }
  };

  function showMenu() {
    state = 'menu';
    dom.startScreen.classList.remove('hidden');
    dom.shop.classList.add('hidden');
    dom.gameOver.classList.add('hidden');
    dom.permScreen.classList.add('hidden');
  }

  function startGame() {
    console.log('[START] Iniciando partida...');
    state = 'playing';
    dom.startScreen.classList.add('hidden');
    dom.shop.classList.add('hidden');
    dom.gameOver.classList.add('hidden');
    dom.permScreen.classList.add('hidden');

    const char = CHARACTERS[player.character];
    player.maxCd = char.maxCd;
    player.x = W / 2; player.y = H - 100;
    player.maxHp = char.stats.hp + permUpgrades.hp * 20;
    player.hp = player.maxHp;
    player.speed = char.stats.speed * (1 + permUpgrades.speed * 0.15);
    player.armor = (char.stats.armor || 0) + (permUpgrades.armor || 0);
    player.luck = (char.stats.luck || 0) + permUpgrades.luck * 10;
    player.permCrit = permUpgrades.crit || 0; player.permDodge = permUpgrades.dodge || 0;
    player.permRegen = permUpgrades.regen || 0; player.permGreed = permUpgrades.greed || 0;
    player.specialCd = 0; player.invuln = 0; player.overdrive = 0; player.stun = 0;
    player.moveVx = 0; player.moveVy = 0; slideHeld = false; player.agility = 1;
    player.xp = 0; player.level = 1; player.xpToNext = 100;

    wave = 1; score = 0; shards = 0;
    waveEvent = null;
    shopBought = {};
    upgradeSlots = []; // los slots de mejoras se reinician por partida, igual que shopBought
    killCombo = { count: 0, timer: 0 };
    heartbeatTimer = 0; heartbeatWasCritical = false; countdownLastSecond = 0;
    enemies = []; bullets = []; particles = []; pickups = [];
    clearEspectroBridge();
    floatTexts = []; trails = []; weaponPickups = []; bossChests = [];
    shockwaves = []; drones = []; meteors = [];
    inventory = []; currentWeapon = NV.starterWeapon(); consumableItems = [];
    consumSel = 0;
    weaponLevels = {}; weaponKills = {}; weaponFus = {}; fireTimer = 0;
        boss = null; shake = 0; hitstop = 0; flashAlpha = 0;
    transition = 0; paused = false; showStats = false;
    specialVFX = null; NV.musicTime = 0;
    NV.musicState.step = 0; NV.musicState.lastBeat = 0; NV.musicState.intensity = 0;
    NV.musicState.phase = 'normal'; NV.musicState.combo = 0; // reset de identidad sonora (Tarea 3)

    resizeCanvas();
    nextWave();
    updateHUD();
    console.log('[START] Partida iniciada correctamente');
  }

  function nextWave() {
    console.log('[WAVE] Oleada ' + wave);
    // Elegir evento ANTES de calcular duración: la duración depende de si hay evento.
    waveEvent = (wave % 5 !== 0 && wave % 3 === 0) ? pickWaveEvent() : null;
    waveTimer = NV.waveDuration(wave, waveEvent);
    spawnTimer = 0;
    // Limpieza completa de entidades por oleada (rendimiento): no dejar restos de
    // partículas, drones, meteoros, estelas, textos/cofres/armas del suelo de la
    // oleada anterior acumulándose entre oleadas (deuda técnica de rendimiento).
    enemies = []; bullets = []; particles = []; pickups = [];
    clearEspectroBridge();
    floatTexts = []; trails = []; shockwaves = []; weaponPickups = [];
    drones = []; meteors = []; bossChests = [];

    if (wave % 5 === 0) {
      const bossIndex = ((wave / 5 - 1) % BOSS_TYPES.length + BOSS_TYPES.length) % BOSS_TYPES.length;
      const bt = BOSS_TYPES[bossIndex];
                  // HP cuadrático en la oleada y durabilidad global: peleas largas y con peso.
                  const bossHp = Math.round((bt.hp + wave * wave * 12 + wave * 40) * 1.8);
                  boss = { x: W/2, y: 100, hp: bossHp, maxHp: bossHp, radius: bt.radius, color: bt.color, timer: 0, atkTimer: 0, hitFlash: 0, name: bt.name, pattern: bt.pattern, attack: bt.attack, shape: bt.shape };
      showBanner('¡' + bt.name + '!', bt.color);
      triggerFlash(bt.color);
      spawnExplosion(boss.x, boss.y, 40, boss.color, 1);
      // Identidad sonora de jefe (Tarea 3): SFX de entrada + música cambia a la capa 'boss'
      // en el próximo step de updateMusic (sin corte audible, ver synth.js updateMusic).
      sfx.bossEnter();
    } else {
      boss = null;
      // waveEvent ya calculado antes de la duración (ver arriba); el banner lo lee aquí.
      const ev = waveEvent ? WAVE_EVENTS[waveEvent] : null;
      if (ev) {
        showBanner('⚠ ' + ev.name, ev.color);
        triggerFlash(ev.color);
        sfx.waveEvent(waveEvent);
      } else {
        showBanner('OLEADA ' + wave, '#7cf8ff');
        triggerFlash('#7cf8ff');
      }
    }
    countdownLastSecond = 0;
    sfx.wave();
    updateHUD();
  }

  // Elige un evento de oleada al azar (sin repetir el de la oleada anterior).
  function pickWaveEvent() {
    const keys = Object.keys(WAVE_EVENTS);
    let ev;
    do { ev = keys[Math.floor(Math.random() * keys.length)]; } while (ev === waveEvent && keys.length > 1);
    return ev;
  }

  function showBanner(text, color) {
    dom.waveBanner.textContent = text;
    dom.waveBanner.style.color = color;
    dom.waveBanner.classList.remove('hidden');
    setTimeout(() => dom.waveBanner.classList.add('hidden'), 1500);
  }

  // === CELEBRACIÓN DE VICTORIA DE OLEADA (más épica para jefes) ===
  function triggerWaveVictory(isBoss, bossName, bossColor) {
    transition = isBoss ? 1.9 : 1.3;
    player.invuln = Math.max(player.invuln, transition + 0.2);
    if (isBoss) {
      shake = 1;
      triggerFlash(bossColor || '#ffd700');
      spawnExplosion(W / 2, H / 2, 90, bossColor || '#ffd700', 1.5);
      spawnExplosion(W / 2, H / 2, 60, '#fff', 1.1);
      spawnExplosion(W / 2, H / 2, 40, '#ff5f9b', 0.9);
      showBanner('¡' + (bossName || 'BOSS') + ' DERROTADO!', '#ffd700');
    } else {
      shake = 0.4;
      triggerFlash('#7cf8ff');
      spawnExplosion(W / 2, H / 2, 55, '#7cf8ff', 1);
      spawnExplosion(W / 2, H / 2, 35, '#caa7ff', 0.8);
      showBanner('Oleada ' + wave + ' completa! ◆', '#7cf8ff');
    }
    sfx.victory(wave, { milestone: isBoss || wave % 5 === 0 || wave % 10 === 0 || wave % 25 === 0 });
  }

  function triggerFlash(color) {
    flashColor = color;
    flashAlpha = Math.max(flashAlpha, 0.3);
  }

  function spawnExplosion(x, y, count, color, speedMult) {
    NV.spawnExplosion(particles, MAX_PARTICLES, x, y, count, color, speedMult);
  }
  function spawnShockwave(x, y, opts) { NV.spawnShockwave(shockwaves, x, y, opts); }


  function skipShop() {
    wave++; // la oleada siguiente "arranca" recién al salir de la tienda
    state = 'playing';
    dom.shop.classList.add('hidden');
    nextWave();
  }

  function showShop() {
    state = 'shop';
    consumableBought = {}; // el tope de consumibles es por visita a la tienda
    updateHUD(); // La habilidad no debe seguir pulsando fuera del combate.
    dom.shop.classList.remove('hidden');
    dom.shopShards.textContent = shards;
    if (dom.shopWave) dom.shopWave.textContent = wave + 1;
    if (dom.shopNextWave) dom.shopNextWave.textContent = wave + 1;
    generateOffers();
    renderInventory();
  }
  // === CONSUMIBLES (se usan con la tecla F en partida) ===
  function useConsumable() {
    if (state !== 'playing' || paused || consumableItems.length === 0) return;
    // Usa el TIPO seleccionado (elegido con Q / click en el HUD), no siempre el primero.
    const groups = NV.groupConsumables(consumableItems);
    consumSel = Math.min(consumSel, groups.length - 1);
    const item = NV.consumeByType(consumableItems, groups[consumSel].type);
    if (!item) { consumSel = Math.max(0, consumSel - 1); return; }
    NV.applyConsumable(item, { player, enemies, boss, pickups, weaponPickups, addFloatText, triggerFlash, spawnExplosion, spawnShockwave });
    triggerFlash('#7cf8ff');
    sfx.consume(item.type);
    updateHUD();
  }

  // === TIENDA DE MEJORAS PERMANENTES (gasta metaShards) ===
  function permCost(u) { return Math.round(u.base * (1 + (permUpgrades[u.key] || 0))); }
  function renderPermOffers() {
    if (!dom.permOffers) return;
    dom.permShards.textContent = metaShards;
    dom.permOffers.innerHTML = '';
    PERM_UPGRADES.forEach(u => {
      const lvl = permUpgrades[u.key] || 0;
      const maxed = lvl >= MAX_PERM_LEVEL;
      const cost = permCost(u);
      const el = document.createElement('div');
      el.className = 'offer' + (maxed ? ' offer-maxed' : '');
      el.innerHTML = '<div class="offer-icon"><canvas></canvas></div>' +
        '<div class="offer-name">' + u.name + ' Nv ' + lvl + (maxed ? ' (MÁX)' : '') + '</div>' +
        '<div class="offer-desc">' + u.desc + '</div>' +
        "<div class='offer-price'>" + (maxed ? 'MÁX' : '◆ ' + cost) + '</div>';
      el.addEventListener('click', () => {
        if (maxed) { showBanner(u.name + ' al máximo', '#aaa'); return; }
        if (metaShards >= cost) {
          metaShards -= cost;
          permUpgrades[u.key] = lvl + 1;
          saveMeta();
          showBanner(u.name + ' → Nv ' + (lvl + 1), '#ffd700');
          renderPermOffers();
        } else {
          showBanner('Fragmentos insuficientes', '#ff5f9b');
        }
      });
      dom.permOffers.appendChild(el);
      drawMetaSkillCanvas(el.querySelector('canvas'), u.key, 64, 48);
    });
  }
  function openPermShop() {
    dom.startScreen.classList.add('hidden');
    dom.shop.classList.add('hidden');
    dom.gameOver.classList.add('hidden');
    dom.permScreen.classList.remove('hidden');
    renderPermOffers();
  }
  function closePermShop() {
    dom.permScreen.classList.add('hidden');
    dom.startScreen.classList.remove('hidden');
  }

  function renderInventory() {
    if (!dom.invSlots) return;
    dom.invSlots.innerHTML = '';

    for (let i = 0; i < INVENTORY_SLOTS; i++) {
      const slot = document.createElement('div');
      slot.className = 'inv-slot';

      if (i < inventory.length) {
        const weapon = inventory[i];
        const fusLevel = weaponFusionLevel(weapon.id);
        slot.classList.add('rarity-' + visualRarity(weapon.rarity, 25));
        slot.innerHTML = `
          <div class="inv-icon"><canvas width="32" height="32" aria-label="${weapon.name}"></canvas></div>
          <div class="inv-name">${weapon.name}</div>
          ${fusLevel > 0 ? `<div class="inv-fuse">Fusión Nv${fusLevel}</div>` : ''}
        `;
        drawWeaponCanvas(slot.querySelector('canvas'), weapon, 32, 26);
        if (weapon === currentWeapon) {
          slot.classList.add('equipped');
          slot.title = weapon.name + ' (equipada) - click para soltar';
        } else {
          slot.title = weapon.name + ' - click para equipar';
        }

        // Click = equipar / soltar
        slot.addEventListener('click', () => {
          if (weapon === currentWeapon) {
            currentWeapon = NV.starterWeapon();
            addFloatText(W/2, H/2, 'ARMA EQUIPADA: PISTOLA', '#fff');
          } else {
            currentWeapon = weapon;
            addFloatText(W/2, H/2, 'EQUIPADO: ' + weapon.name, RARITY_COLORS[weapon.rarity]);
          }
          renderInventory();
        });

        // Botón vender: da shards según rareza (coherente con la economía; < compra siempre).
        const sellBtn = document.createElement('button');
        sellBtn.className = 'inv-remove';
        sellBtn.textContent = 'SELL';
        sellBtn.title = 'Vender por ' + NV.weaponSellValue(weapon, WEAPON_SELL_PRICES) + ' shards';
        sellBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const val = NV.weaponSellValue(weapon, WEAPON_SELL_PRICES);
          shards += val;
          if (dom.shopShards) dom.shopShards.textContent = shards;
          inventory.splice(i, 1);
          if (currentWeapon === weapon) {
            currentWeapon = NV.starterWeapon();
          }
          addFloatText(W / 2, H / 2, '+◆ ' + val, '#7cf8ff');
          updateHUD();
          renderInventory();
          sfx.shopSell();
        });
        slot.appendChild(sellBtn);
      } else {
        slot.classList.add('empty');
        slot.style.cursor = 'default';
      }
      dom.invSlots.appendChild(slot);
    }
  }

  function renderShopConsumableLoadout() {
    if (!dom.shopConsumableLoadout) return;
    dom.shopConsumableLoadout.innerHTML = '';
    const groups = NV.groupConsumables(consumableItems);
    const hint = dom.shopConsumableLoadout.parentElement && dom.shopConsumableLoadout.parentElement.querySelector('.inv-hint');
    if (hint) hint.textContent = 'tipos ' + groups.length + '/' + CONSUMABLE_TYPE_SLOT_CAP + ' · stack máx ' + CONSUMABLE_STACK_CAP;
    for (let i = 0; i < CONSUMABLE_TYPE_SLOT_CAP; i++) {
      const g = groups[i];
      const slot = document.createElement('div');
      slot.className = 'loadout-slot' + (g ? '' : ' empty');
      if (g) {
        const canvas = document.createElement('canvas');
        canvas.width = 32; canvas.height = 32;
        slot.appendChild(canvas);
        drawConsumableCanvas(canvas, g.type, 32, 24);
        slot.insertAdjacentHTML('beforeend', '<span class="slot-index">' + (i + 1) + '</span><span class="slot-badge">x' + g.count + '</span>');
        slot.title = g.name + ' x' + g.count + '/' + CONSUMABLE_STACK_CAP;
      } else {
        slot.title = 'Slot de protocolo vacío';
      }
      dom.shopConsumableLoadout.appendChild(slot);
    }
  }

  // Nivel actual de una mejora (compras agrupadas por tipo dentro de la partida).
  function upgradeLevel(icon) {
    let n = 0;
    for (const u of upgradeSlots) if (u.icon === icon) n++;
    return n;
  }

  // Slots de mejoras de la partida (panel MEJORAS): misma estética que el dock de armas
  // y los consumibles equipados. Cada mejora ocupa UN slot con su nivel; al llegar al
  // máximo se bloquea con el estilo rojo/diagonal. Vacíos = contorno punteado.
  function renderUpgradeSlots() {
    if (!dom.upgradeSlots) return;
    dom.upgradeSlots.innerHTML = '';
    const groups = [];
    const byIcon = {};
    for (const u of upgradeSlots) {
      if (!byIcon[u.icon]) { byIcon[u.icon] = { icon: u.icon, name: u.name, level: 0 }; groups.push(byIcon[u.icon]); }
      byIcon[u.icon].level++;
    }
    const hint = dom.upgradeSlots.parentElement && dom.upgradeSlots.parentElement.querySelector('.inv-hint');
    if (hint) hint.textContent = 'tipos ' + groups.length + '/' + UPGRADE_SLOT_CAP + ' · nivel máx ' + UPGRADE_LEVEL_CAP;
    for (let i = 0; i < UPGRADE_SLOT_CAP; i++) {
      const g = groups[i];
      const slot = document.createElement('div');
      const maxLvl = g ? (UPGRADE_LEVELS[g.icon] || UPGRADE_LEVEL_CAP) : 0;
      const blocked = !!g && (g.level >= maxLvl || (g.icon === 'speed' && player.agility >= MAX_AGILITY));
      slot.className = 'loadout-slot' + (g ? (blocked ? ' blocked' : '') : ' empty');
      if (g) {
        const canvas = document.createElement('canvas');
        canvas.width = 32; canvas.height = 32;
        slot.appendChild(canvas);
        drawMetaSkillCanvas(canvas, g.icon, 32, 24);
        slot.insertAdjacentHTML('beforeend', '<span class="slot-index">' + (i + 1) + '</span><span class="slot-badge">Nv' + g.level + '</span>');
        slot.title = g.name + ' Nv' + g.level + (blocked ? ' (máximo)' : '');
      } else {
        slot.title = 'Slot de mejora vacío';
      }
      dom.upgradeSlots.appendChild(slot);
    }
  }

  function visualRarity(rarity, price) {
    if (rarity === 'legendary') return 'legendary';
    if (rarity === 'epic') return 'epic';
    if (rarity === 'rare') return 'rare';
    if (price >= 30) return 'rare';
    return 'common';
  }

  function generateOffers() {
    const upgrades = [];
    const weapons = [];
    const consumables = [];
    // Cada mejora ocupa UN slot y sube de nivel; al llegar a su nivel máximo la oferta se bloquea.
    const hpLvl = upgradeLevel('hp');
    const speedLvl = upgradeLevel('speed');
    const armorLvl = upgradeLevel('armor');
    const luckLvl = upgradeLevel('luck');

    if ((shopBought.hp || 0) < SHOP_CAPS.hp) {
      upgrades.push({
        kind: 'upgrade', metaIcon: 'hp', name: '+25 HP', desc: 'Vida máxima +25 (' + (shopBought.hp || 0) + '/' + SHOP_CAPS.hp + ')', rarity: 'common',
        disabled: hpLvl >= UPGRADE_LEVELS.hp, disabledReason: 'Nivel ' + UPGRADE_LEVELS.hp + '/' + UPGRADE_LEVELS.hp,
        price: 15, buy: () => { player.maxHp += 25; player.hp += 25; shopBought.hp = (shopBought.hp || 0) + 1; upgradeSlots.push({ icon: 'hp', name: '+25 HP' }); },
      });
    }
    if (player.agility < MAX_AGILITY) {
      upgrades.push({
        kind: 'upgrade', metaIcon: 'speed', name: 'Agilidad', desc: 'Acelera y frena mejor (máx +100%)', rarity: 'rare',
        disabled: speedLvl >= UPGRADE_LEVELS.speed, disabledReason: 'Nivel ' + UPGRADE_LEVELS.speed + '/' + UPGRADE_LEVELS.speed,
        price: 15, buy: () => { player.agility = Math.min(MAX_AGILITY, player.agility + AGILITY_PER_UPGRADE); upgradeSlots.push({ icon: 'speed', name: 'Agilidad' }); },
      });
    }
    if ((shopBought.armor || 0) < SHOP_CAPS.armor) {
      upgrades.push({
        kind: 'upgrade', metaIcon: 'armor', name: 'Armadura', desc: '+3 armadura (' + (shopBought.armor || 0) + '/' + SHOP_CAPS.armor + ')', rarity: 'epic',
        disabled: armorLvl >= UPGRADE_LEVELS.armor, disabledReason: 'Nivel ' + UPGRADE_LEVELS.armor + '/' + UPGRADE_LEVELS.armor,
        price: 20, buy: () => { player.armor += 3; shopBought.armor = (shopBought.armor || 0) + 1; upgradeSlots.push({ icon: 'armor', name: 'Armadura' }); },
      });
    }
    if ((shopBought.luck || 0) < SHOP_CAPS.luck) {
      upgrades.push({
        kind: 'upgrade', metaIcon: 'luck', name: 'Suerte', desc: '+2 suerte (' + (shopBought.luck || 0) + '/' + SHOP_CAPS.luck + ')', rarity: 'rare',
        disabled: luckLvl >= UPGRADE_LEVELS.luck, disabledReason: 'Nivel ' + UPGRADE_LEVELS.luck + '/' + UPGRADE_LEVELS.luck,
        price: 20, buy: () => { player.luck += 2; shopBought.luck = (shopBought.luck || 0) + 1; upgradeSlots.push({ icon: 'luck', name: 'Suerte' }); },
      });
    }

    WEAPONS.forEach(w => {
      const isCurrent = w === currentWeapon;
      const owned = inventory.some((iw) => iw.id === w.id);
      const fus = weaponFusionLevel(w.id);
      // La equipada actual no se ofrece (conserva el comportamiento previo).
      if (isCurrent) return;
      // Poseída al tope de fusión: no se ofrece.
      if (owned && fus >= MAX_WEAPON_FUSION) return;
      const canFuse = owned && fus < MAX_WEAPON_FUSION;
      weapons.push({
        kind: 'weapon', name: w.name, weapon: w, rarity: w.rarity,
        desc: canFuse
          ? ('FUSIONAR: +' + Math.round(WEAPON_FUSION_DMG * 100) + '% daño (Nv' + (fus + 1) + '/' + MAX_WEAPON_FUSION + ')')
          : (w.rarity + ' | daño ' + w.damage + ' | ' + (w.pro || '')),
        price: canFuse ? WEAPON_FUSE_PRICE : 25,
        buy: () => {
          if (canFuse) {
            weaponFus[w.id] = fus + 1;
            addFloatText(W / 2, H / 2, w.name + ' FUSIONADO → Nv' + (fus + 1), '#ffd700');
            sfx.fuse(fus + 1);
          } else if (inventory.length < INVENTORY_SLOTS) {
            inventory.push(w);
            addFloatText(W/2, H/2, '¡' + w.name + '!', RARITY_COLORS[w.rarity]);
            sfx.shopBuy();
          } else {
            currentWeapon = w;
            addFloatText(W/2, H/2, 'EQUIPADO: ' + w.name, RARITY_COLORS[w.rarity]);
            sfx.shopBuy();
          }
        },
      });
    });

    NV.consumableList().forEach((c) => {
      const bought = consumableBought[c.key] || 0;
      const typeCount = NV.consumableTypeCount(consumableItems);
      const stacked = NV.consumableCountByType(consumableItems, c.key);
      const stackFull = stacked >= CONSUMABLE_STACK_CAP;
      const typeSlotsFull = stacked === 0 && typeCount >= CONSUMABLE_TYPE_SLOT_CAP;
      if (bought >= CONSUMABLE_CAP) return; // tope por visita: la oferta desaparece
      consumables.push({
        kind: 'consumable', consumableType: c.key, name: c.name,
        desc: c.desc,
        badge: (stacked > 0 ? ('Equipado x' + stacked) : 'Nuevo') + ' · ' + bought + '/' + CONSUMABLE_CAP,
        price: c.price,
        disabled: stackFull || typeSlotsFull,
        disabledReason: stackFull ? ('Límite ' + CONSUMABLE_STACK_CAP + '/' + CONSUMABLE_STACK_CAP) : ('Slots ' + CONSUMABLE_TYPE_SLOT_CAP + '/' + CONSUMABLE_TYPE_SLOT_CAP),
        buy: () => {
          if (!NV.addConsumable(consumableItems, { type: c.key, name: c.name }, CONSUMABLE_STACK_CAP, CONSUMABLE_TYPE_SLOT_CAP)) {
            const reason = NV.consumableCountByType(consumableItems, c.key) >= CONSUMABLE_STACK_CAP
              ? ('límite ' + CONSUMABLE_STACK_CAP + '/' + CONSUMABLE_STACK_CAP)
              : ('slots ' + CONSUMABLE_TYPE_SLOT_CAP + '/' + CONSUMABLE_TYPE_SLOT_CAP);
            showBanner(c.name + ': ' + reason, '#ff5f9b');
            return false;
          }
          consumableBought[c.key] = (consumableBought[c.key] || 0) + 1;
          showBanner(c.banner, c.color);
          return true;
        },
      });
    });

    renderOffers(dom.upgradesOffers, upgrades);
    renderOffers(dom.weaponOffers, weapons);
    renderOffers(dom.consumableOffers, consumables);
    renderShopConsumableLoadout();
    renderUpgradeSlots();
  }

  function drawWeaponCanvas(canvas, weapon, canvasSize, iconSize) {
    if (!canvas || !weapon) return;
    canvasSize = canvasSize || 64;
    iconSize = iconSize || Math.floor(canvasSize * 0.76);
    canvas.width = canvasSize; canvas.height = canvasSize;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvasSize, canvasSize);
    if (typeof NV.drawWeaponIcon === 'function') NV.drawWeaponIcon(ctx, weapon, canvasSize / 2, canvasSize / 2, iconSize, { glow: 2 });
  }

  function drawConsumableCanvas(canvas, type, canvasSize, iconSize) {
    if (!canvas || !type) return;
    canvasSize = canvasSize || 64;
    iconSize = iconSize || Math.floor(canvasSize * 0.76);
    canvas.width = canvasSize; canvas.height = canvasSize;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvasSize, canvasSize);
    if (typeof NV.drawConsumableIcon === 'function') NV.drawConsumableIcon(ctx, type, canvasSize / 2, canvasSize / 2, iconSize, { glow: 2 });
  }

  function drawMetaSkillCanvas(canvas, id, canvasSize, iconSize) {
    if (!canvas || !id) return;
    canvasSize = canvasSize || 64;
    iconSize = iconSize || Math.floor(canvasSize * 0.76);
    canvas.width = canvasSize; canvas.height = canvasSize;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvasSize, canvasSize);
    if (typeof NV.drawMetaSkillIcon === 'function') NV.drawMetaSkillIcon(ctx, id, canvasSize / 2, canvasSize / 2, iconSize, { glow: 2 });
  }

  function renderMenuSkillIcons() {
    if (typeof document === 'undefined') return;
    const icons = document.querySelectorAll('.char-skill-icon[data-skill-icon]');
    icons.forEach(canvas => drawMetaSkillCanvas(canvas, canvas.getAttribute('data-skill-icon'), 36, 24));
  }

  function renderOffers(container, items) {
    if (!container) return;
    container.innerHTML = "";
    items.forEach(item => {
      const el = document.createElement("div");
      const kind = item.kind || (item.weapon ? 'weapon' : item.consumableType ? 'consumable' : 'upgrade');
      el.className = "offer offer-" + kind + " rarity-" + visualRarity(item.rarity, item.price) + (item.disabled ? " disabled" : "");
      const iconHtml = item.weapon || item.consumableType || item.metaIcon ? '<div class="offer-icon"><canvas></canvas></div>' : '<div class="offer-icon">•</div>';
      const priceHtml = item.disabled ? item.disabledReason : ('◆ ' + item.price);
      const badgeHtml = item.badge ? '<div class="offer-badge">' + item.badge + '</div>' : '';
      el.innerHTML = iconHtml + '<div class="offer-name">' + item.name + "</div><div class=\"offer-desc\">" + item.desc + "</div>" + badgeHtml + "<div class='offer-price'>" + priceHtml + "</div>";
      el.addEventListener("click", () => {
        if (item.disabled) {
          addFloatText(W/2, H/2, item.disabledReason || 'Límite alcanzado', '#ff5f9b');
          return;
        }
        if (shards >= item.price) {
          shards -= item.price;
          item.buy();
          el.classList.add('just-bought');
          dom.shopShards.textContent = shards;
          setTimeout(() => { generateOffers(); updateHUD(); renderInventory(); }, 180);
          if (!item.weapon) sfx.shopBuy();
        } else {
          addFloatText(W/2, H/2, "Fragmentos insuficientes", "#ff5f9b");
        }
      });
      container.appendChild(el);
      const c = el.querySelector("canvas");
      if (c && item.weapon) drawWeaponCanvas(c, item.weapon, 64, 50);
      if (c && item.consumableType) drawConsumableCanvas(c, item.consumableType, 64, 48);
      if (c && item.metaIcon) drawMetaSkillCanvas(c, item.metaIcon, 64, 48);
    });
  }

  function gameOver() {
    state = 'gameover';
    deathTimer = 1.2;
    deathShake = 1;
    shake = 1;
    triggerFlash('#ff0000');
    sfx.damage();
    setTimeout(() => {
      dom.gameOver.classList.remove('hidden');
      dom.goTitle.textContent = 'FIN';
      dom.goText.textContent = 'Llegaste a la oleada ' + wave;
      dom.goScore.textContent = formatPoints(score);
      dom.goWave.textContent = wave;
      metaShards += Math.floor(shards / 2) + Math.floor(score / 100);
      saveMeta();
    }, 1200);
  }

  // === UPDATE ===
  function update(dt) {
    if (state !== 'playing' || paused) return;
    frame++;

    if (shake > 0) shake -= dt;
    if (hitstop > 0) hitstop = Math.max(0, hitstop - dt);
    if (flashAlpha > 0) flashAlpha = Math.max(0, flashAlpha - dt);
    if (specialVFX) {
      specialVFX.x = player.x; specialVFX.y = player.y;
      specialVFX.life -= dt;
      if (specialVFX.life <= 0) specialVFX = null;
    }

    updateMusic(dt);

    // Heartbeat crítico: pulso grave solo mientras el HP está bajo; al recuperarse
    // se resetea el timer para que no quede sonando de fondo ni encadene pulsos.
    const hpRatio = player.maxHp > 0 ? player.hp / player.maxHp : 1;
    if (hpRatio > 0 && hpRatio <= 0.3 && state === 'playing') {
      heartbeatTimer -= dt;
      if (!heartbeatWasCritical || heartbeatTimer <= 0) {
        heartbeatWasCritical = true;
        heartbeatTimer = 1.15;
        if (sfx.heartbeat) sfx.heartbeat(1 - hpRatio / 0.3);
      }
    } else {
      heartbeatWasCritical = false;
      heartbeatTimer = 0;
    }

    const dx = (moveRight ? 1 : 0) - (moveLeft ? 1 : 0);
    const dy = (moveDown ? 1 : 0) - (moveUp ? 1 : 0);
    const len = Math.hypot(dx, dy);
    const sliding = slideHeld && len > 0 && player.stun <= 0;
    const speed = sliding ? player.speed * 2.15 : player.speed;
    const targetVx = len > 0 && player.stun <= 0 ? (dx / len) * speed : 0;
    const targetVy = len > 0 && player.stun <= 0 ? (dy / len) * speed : 0;
    // Al mantener Shift acelera; al soltarlo (o la dirección) desacelera sin
    // recorrer una distancia prefijada. Así el deslizamiento es controlable.
    const maxDelta = (sliding ? 1800 : 2600) * player.agility * dt;
    player.moveVx += Math.max(-maxDelta, Math.min(maxDelta, targetVx - player.moveVx));
    player.moveVy += Math.max(-maxDelta, Math.min(maxDelta, targetVy - player.moveVy));
    player.x += player.moveVx * dt;
    player.y += player.moveVy * dt;
    player.x = Math.max(20, Math.min(W - 20, player.x));
    player.y = Math.max(30, Math.min(H - 20, player.y));
    momentumVisual.shift = sliding;

    if (frame % 3 === 0) {
      const char = CHARACTERS[player.character];
      trails.push({ x: player.x, y: player.y, life: 0.3, color: player.color, size: char.size * 0.6 });
    }
    // Polvo de propulsión al deslizar: chispas hacia atrás del movimiento.
    if (sliding && frame % 2 === 0) {
      spawnExplosion(player.x - (player.moveVx || 0) * 0.02, player.y - (player.moveVy || 0) * 0.02 + 8, 1, '#7cf8ff', 0.12);
    }

    // Regeneración pasiva BOTI
    const char = CHARACTERS[player.character];
    NV.applyBotiPassiveRegen(char, player, frame, addFloatText);

    // Regeneración permanente (+0.2 HP/s por nivel, solo fuera de peligro)
    if ((player.permRegen || 0) > 0 && player.hp < player.maxHp && state !== 'gameover') {
      let inDanger = false;
      for (const e of enemies) {
        if (!e.dead && Math.hypot(e.x - player.x, e.y - player.y) < 170) { inDanger = true; break; }
      }
      if (!inDanger) {
        player.regenAcc = (player.regenAcc || 0) + NV.BALANCE.REGEN_PERM_HPSEC * player.permRegen * dt;
        if (player.regenAcc >= 1) {
          const heal = Math.floor(player.regenAcc);
          player.hp = Math.min(player.maxHp, player.hp + heal);
          player.regenAcc -= heal;
          addFloatText(player.x, player.y - 40, '+' + heal, '#7cf8ff');
        }
      } else {
        player.regenAcc = 0; // el peligro corta la regeneración
      }
    }

    if (player.invuln > 0) { player.invuln -= dt; if (player.invuln < 0) player.invuln = 0; }
    updateDamageReadability(dt);
    if (player.stun > 0) { player.stun = Math.max(0, player.stun - dt); }
    if (player.phase) { player.phase -= dt; if (player.phase <= 0) { player.phase = 0; player.invuln = 0; detonatePhase(); } }
    if (player.bulwark > 0) { player.bulwark -= dt; if (player.bulwark < 0) player.bulwark = 0; }
    if (player.shield > 0) { player.shield -= dt; if (player.shield < 0) player.shield = 0; }
    if (player.overdrive > 0) {
      player.overdrive -= dt;
      if (player.overdrive <= 0) { player.speed /= 1.5; triggerFlash('#caa7ff'); }
    }
    if (player.bounty > 0) { player.bounty -= dt; if (player.bounty <= 0) player.bounty = 0; }
    NV.comboTick(killCombo, dt);
    NV.musicState.combo = killCombo.count;
    if (player.specialCd > 0) player.specialCd -= dt;

    fireTimer -= dt;
    if (currentAutoTarget && (currentAutoTarget.dead || Math.hypot(currentAutoTarget.x - player.x, currentAutoTarget.y - player.y) > (currentWeapon.range || Infinity))) currentAutoTarget = null;
    if (fireTimer <= 0 && hitstop <= 0) {
      if (playerBulletCount() < MAX_PLAYER_BULLETS) {
        if (shoot() !== false) fireTimer = weaponFireInterval();
        else fireTimer = MIN_FIRE_INTERVAL; // fuera de rango: reintentar enseguida sin gastar cadencia
      } else {
        // Buffer casi lleno (p. ej. con overdrive activo): reintentar enseguida.
        fireTimer = MIN_FIRE_INTERVAL;
      }
    }

    if (specialPressed && player.specialCd <= 0) useSpecial();

    // Spawns y progreso de oleada SOLO fuera de la transición de victoria: durante la
    // celebración no arranca la oleada siguiente (nada de spawns ni countdown visible).
    if (transition <= 0) {
        spawnTimer -= dt;
    if (spawnTimer <= 0) {
      // Densidad progresiva garantizada: cada oleada empieza con presión
      // real (mínimo 2 enemigos por lote) para evitar "victorias sin combate".
      const perWave = 2 + Math.min(6, Math.floor(wave / 2));
      for (let i = 0; i < perWave; i++) {
        if (enemies.length < MAX_ENEMIES) spawnEnemy();
      }
      spawnElite();
      if (Math.random() < 0.03 + wave * 0.002) spawnWeaponPickup();
      spawnTimer = Math.max(0.25, (1.3 - wave * 0.035) * NV.waveSpawnFactor(wave, waveEvent)); // oleadas largas: mismo total de spawns
    }

        waveTimer -= dt;
        if (!boss && waveTimer > 0 && waveTimer <= 3.1) {
          const sec = Math.ceil(waveTimer);
          if (sec !== countdownLastSecond && sec >= 1 && sec <= 3) {
            countdownLastSecond = sec;
            sfx.countdown(sec);
          }
        } else if (waveTimer > 3.1 || boss) {
          countdownLastSecond = 0;
        }
    }
    // Fin de oleada (sin jefe): se evalúa ANTES del countdown de transición para
    // evitar que abrir la tienda re-dispare la victoria en el mismo frame.
    if (transition <= 0 && waveTimer <= 0 && !boss) {
      shards += 8 + wave * 2;
      triggerWaveVictory(false, null, null);
      // El incremento de oleada se difiere a skipShop(): el HUD no debe mostrar
      // "OLEADA n+1" hasta que el jugador salga de la tienda.
    }
    if (transition > 0) {
      transition -= dt;
      if (transition <= 0) { transition = 0; showShop(); }
    }

    updateEnemies(dt);
    updateBoss(dt);
    updateBullets(dt);
    updateParticles(dt);
    updatePickups(dt);
    updateWeaponPickups(dt);
    updateBossChests(dt);
    updateFloatTexts(dt);
    updateTrails(dt);
    shockwaves = NV.updateShockwaves(dt, shockwaves);
    updateDrones(dt);
    updateMeteors(dt);

    // Aura de daño de Fase Fantasma (NOVA): zona visible que daña enemigos cercanos y al jefe
    if (player.phase > 0) {
      const R = NV.BALANCE.PHASE_AURA_RADIUS, DPS = NV.BALANCE.PHASE_AURA_DPS;
      for (const e of enemies) {
        if (e.dead) continue;
        if (Math.hypot(e.x - player.x, e.y - player.y) < R) {
          e.hp -= DPS * dt;
          e.phaseAcc = (e.phaseAcc || 0) + DPS * dt; // acumulado para la Detonación Espectral
          if (e.hp <= 0) killEnemy(e);
        }
      }
      if (boss && !boss.dead && Math.hypot(boss.x - player.x, boss.y - player.y) < R + 40) {
        boss.hp -= DPS * NV.BALANCE.PHASE_AURA_BOSS_MULT * dt;
        boss.phaseAcc = (boss.phaseAcc || 0) + DPS * dt; // sin mult: la detonación ya aplica el suyo
      }
    }

    updateHUD();
  }

  function shoot() {
    return NV.shoot({
      player, enemies, boss, bullets, currentWeapon,
      currentWeaponLevel, weaponVisualTier, BULLET_TIER_COLORS, MAX_BULLETS,
      permDamageBonus: permUpgrades.damage, playWeaponSound,
      audioPosition: { x: player.x, worldWidth: W },
      currentWeaponFusion: currentWeaponFusion(), fusionStep: WEAPON_FUSION_DMG,
      onTarget: (target) => { currentAutoTarget = target; },
    });
  }

  function applyKnockback(e, bx, by, strength) {
    return NV.applyKnockback(e, bx, by, strength);
  }

  function useSpecial() {
    const res = NV.useSpecial({
      player, CHARACTERS, meteors, particles, drones, W, shake, specialVFX,
      enemies, shockwaves,
      cbs: { showBanner, triggerFlash, spawnExplosion, sfx, applyKnockback, addFloatText },
    });
    drones = res.drones; shake = res.shake; specialVFX = res.specialVFX;
  }

  function updateDrones(dt) {
    drones = NV.updateDrones(dt, drones, player, bullets, MAX_BULLETS, enemies, boss, 300);
  }

  // Detonación Espectral: golpe final al terminar la Fase Fantasma.
  function detonatePhase() {
    NV.detonatePhase(player, enemies, boss, shockwaves, { addFloatText, spawnExplosion, triggerFlash });
  }

  function updateMeteors(dt) {
    const res = NV.updateMeteors(dt, meteors, { H, enemies, boss, shake }, { killEnemy, applyKnockback, spawnExplosion });
    meteors = res.meteors;
    shake = res.shake;
  }

  function spawnEnemy() {
    NV.spawnEnemy({ enemies, MAX_ENEMIES, boss, wave, ENEMY_TYPES, W, H, waveEvent });
  }

  function spawnElite() {
    NV.spawnElite({ enemies, MAX_ENEMIES, boss, wave, ELITE_TYPES, W, H, waveEvent });
  }

  function spawnWeaponPickup() {
    NV.spawnWeaponPickup(WEAPONS, weaponPickups, W, H, showBanner, RARITY_COLORS);
  }

  function killEnemy(e) {
    score = NV.killEnemy({
      e, score, player, weaponLevels, weaponKills, currentWeapon,
      WEAPON_KILLS_PER_LEVEL, addFloatText, spawnExplosion, triggerFlash, sfx, pickups, weaponKillProgress,
      waveEvent, computePlayerHit, W,
    });
    // Combo de kills: bonus escalable por encadenar derribos (<2s entre ellos).
    const cb = NV.comboOnKill(killCombo);
    score += cb.bonusScore;
    if (cb.gemBonus) shards += cb.gemBonus;
    if (cb.count >= 3) sfx.combo(cb.count);
    if (cb.count >= 3) addFloatText(e.x, e.y - 25, 'COMBO x' + cb.count + (cb.milestone ? ' ◆+1' : ''), '#7cf8ff');
  }

  function updateEnemies(dt) {
    const res = NV.updateEnemies(dt, {
      enemies, player, bullets, MAX_BULLETS, MAX_ENEMY_BULLETS, shake,
      enemyBulletCount, computePlayerHit, addFloatText, spawnExplosion,
      onKill: (e) => killEnemy(e), // autodestrucción de kamikazes: mismo camino que un kill normal
      onPlayerDamaged: recordPlayerDamage,
    });
    enemies = res.enemies; shake = res.shake;
    if (res.gameOver) { gameOver(); return; }
  }

  function updateBoss(dt) {
    const res = NV.updateBoss(dt, {
      boss, player, enemies, bullets, W, H,
      score, shards, wave, shake,
      MAX_BULLETS, MAX_ENEMY_BULLETS, enemyBulletCount, ENEMY_TYPES,
      spawnExplosion, showBanner, triggerFlash, triggerWaveVictory, addFloatText, sfx,
      spawnBossProj, spawnMinion, runBossAttack, spawnBossChest,
    });
    score = res.score; shards = res.shards; wave = res.wave; shake = res.shake; boss = res.boss;
  }

  // Cofre de jefe: queda en el campo hasta que el jugador lo toque.
  function spawnBossChest(x, y) {
    bossChests.push({ x, y, dead: false, timer: 0 });
  }
  function updateBossChests(dt) {
    bossChests = NV.updateBossChests(dt, bossChests, player, pickups, weaponPickups, WEAPONS, addFloatText, sfx.pickup);
  }

    // === DIFICULTAD PROGRESIVA: críticos escalables con la oleada (PvE) ===
  // La "suerte" del jugador reduce la chance de crítico enemigo.
  function enemyCritChance() { return NV.enemyCritChance(wave, player); }
  function calcEnemyDamage(base) { return NV.calcEnemyDamage(base, enemyCritChance); }
  function computePlayerHit(base) {
    const r = NV.computePlayerHit(base, { player, CHARACTERS, calcEnemyDamage });
    if (!r.dodged) { killCombo.count = 0; killCombo.timer = 0; } // recibir daño corta el combo
    return r;
  }

  // === PROYECTILES Y ATAQUES DISTINTOS POR JEFE ===
  function spawnBossProj(b, speed, damage, count, spread, color, radius) {
    return NV.spawnBossProj(b, speed, damage, count, spread, color, radius, { player, bullets, MAX_BULLETS, enemyBulletCount, MAX_ENEMY_BULLETS });
  }

  // Esbirros invocados (funciona incluso durante la pelea con un jefe)
  function spawnMinion(x, y) {
    return NV.spawnMinion(x, y, { enemies, wave, ENEMY_TYPES });
  }

  function runBossAttack(b, dt) {
    return NV.runBossAttack(b, dt, {
      player, enemies, bullets, sfx, triggerFlash, addFloatText,
      MAX_BULLETS, MAX_ENEMY_BULLETS, enemyBulletCount,
      spawnBossProj, spawnMinion,
    });
  }

  function updateBullets(dt) {
    const res = NV.updateBullets(dt, {
      bullets, W, H, player, enemies, boss, shake, hitstop,
      MAX_BULLETS, CHARACTERS, SHIELD_COOLDOWN,
      computePlayerHit, addFloatText, killEnemy, applyKnockback, spawnExplosion, gameOver,
      sfx, onPlayerDamaged: recordPlayerDamage,
    });
    bullets = res.bullets; shake = res.shake; hitstop = res.hitstop;
    if (res.gameOver) { gameOver(); return; }
  }

  function recordPlayerDamage(hit) {
    const e = hit.enemy || null;
    let sourceX = e ? e.x : player.x, sourceY = e ? e.y : player.y;
    if (!e && hit.projectile) {
      const projectileSpeed = Math.max(1, Math.hypot(hit.projectile.vx || 0, hit.projectile.vy || 0));
      sourceX = player.x - (hit.projectile.vx || 0) / projectileSpeed * 40;
      sourceY = player.y - (hit.projectile.vy || 0) / projectileSpeed * 40;
    }
    damageFeedback = { life: 0.55, sourceX, sourceY, critical: !!hit.crit, cause: hit.cause };
    invulnerabilityFeedback = { life: 0.5, duration: 0.5, kind: 'start' };
    if (!NV.META_DEBUG || !NV.recordMetaDamage) return;
    NV.recordMetaDamage({
      cause: hit.cause, enemy: e, enemyType: e && (e.enemyTypeId || e.behavior || e.shape),
      hpBefore: hit.hpBefore, hpAfter: hit.hpAfter, critical: !!hit.crit, wave,
      playerX: player.x, playerY: player.y,
      speed: Math.hypot(player.moveVx || 0, player.moveVy || 0),
      moveVx: player.moveVx || 0, moveVy: player.moveVy || 0,
      shift: !!slideHeld, invulnerability: player.invuln || 0,
    });
  }

  function updateMetaDiagnostics() {
    if (!NV.META_DEBUG || !NV.updateMetaSnapshot) return;
    let within50 = 0, within100 = 0, within170 = 0, alive = 0;
    for (const e of enemies) {
      if (e.dead) continue;
      alive++;
      const d = Math.hypot(e.x - player.x, e.y - player.y);
      if (d <= 50) within50++;
      if (d <= 100) within100++;
      if (d <= 170) within170++;
    }
    NV.updateMetaSnapshot({
      wave, playerX: player.x, playerY: player.y,
      speed: Math.hypot(player.moveVx || 0, player.moveVy || 0),
      moveVx: player.moveVx || 0, moveVy: player.moveVy || 0,
      shift: !!slideHeld, invulnerability: player.invuln || 0,
      within50, within100, within170, nearbyDensity: within100,
      overlap: densityField ? densityField.playerOverlap || 0 : 0, aliveEnemies: alive, autofireTarget: currentAutoTarget,
    });
  }

  function updateDamageReadability(dt) {
    if (damageFeedback) { damageFeedback.life -= dt; if (damageFeedback.life <= 0) damageFeedback = null; }
    if (invulnerabilityFeedback) { invulnerabilityFeedback.life -= dt; if (invulnerabilityFeedback.life <= 0) invulnerabilityFeedback = null; }
    if (previousInvulnerability > 0 && player.invuln <= 0) invulnerabilityFeedback = { life: 0.22, duration: 0.22, kind: 'end' };
    previousInvulnerability = player.invuln || 0;
  }

  function prepareDensityReadability() {
    if (!NV.buildDensityField) return;
    densityField = NV.buildDensityField(enemies);
    NV.metaDensityInfo = densityField.info;
    let playerOverlap = 0;
    for (const e of enemies) {
      if (e.dead) continue;
      const visual = densityField.info.get(e);
      if (Math.hypot(e.x - player.x, e.y - player.y) <= 100 && visual) playerOverlap += visual.overlap;
    }
    densityField.playerOverlap = playerOverlap;
  }

  function updateParticles(dt) {
    particles = NV.updateParticles(dt, particles);
  }


  function updatePickups(dt) {
    const r = NV.updatePickups(dt, pickups, player, addFloatText, sfx.pickup);
    pickups = r.pickups; shards += r.shards;
  }

  // Fusión de arma recogida: si ya la poseés, sube su nivel de fusión en vez de
  // ocupar un slot. Devuelve {fused,level} | {maxed} | {fused:false,owned:false}.
  function tryWeaponFusion(weapon) {
    if (!inventory.some((w) => w.id === weapon.id)) return { fused: false, owned: false };
    const cur = weaponFus[weapon.id] || 0;
    if (cur >= MAX_WEAPON_FUSION) return { fused: false, maxed: true };
    weaponFus[weapon.id] = cur + 1;
    if (currentWeapon.id === weapon.id) updateHUD();
    return { fused: true, level: cur + 1 };
  }

  function updateWeaponPickups(dt) {
    const r = NV.updateWeaponPickups(dt, weaponPickups, player, inventory, INVENTORY_SLOTS, currentWeapon, addFloatText, RARITY_COLORS, sfx, tryWeaponFusion);
    weaponPickups = r.weaponPickups;
    if (currentWeapon !== r.currentWeapon) currentWeapon = r.currentWeapon;
  }

  function updateFloatTexts(dt) {
    floatTexts = NV.updateFloatTexts(dt, floatTexts);
  }


  function addFloatText(x, y, text, color) {
    NV.addFloatText(floatTexts, x, y, text, color);
  }


  function updateTrails(dt) {
    trails = NV.updateTrails(dt, trails);
  }


  function updateHUD() {
    dom.wave.textContent = 'Oleada ' + wave;
    dom.score.textContent = formatPoints(score);
    dom.shards.textContent = shards;
    dom.hpText.textContent = Math.max(0, Math.round(player.hp)) + '/' + player.maxHp;
    dom.hpFill.style.width = Math.max(0, (player.hp / player.maxHp) * 100) + '%';
    const criticalHealth = player.hp > 0 && player.hp / player.maxHp <= 0.25;
    dom.hpBar.classList.toggle('critical', criticalHealth);
    dom.hpFill.classList.toggle('critical', criticalHealth);

    if (state !== 'playing' || paused) {
      dom.specialFill.style.background = '#3d4355';
      dom.specialCooldown.classList.remove('is-ready');
      return;
    }

    const char = CHARACTERS[player.character];
    if (player.specialCd > 0) {
      const pct = (player.specialCd / char.maxCd) * 100;
      // La recarga llena todo el icono, pasando de gris neutro a verde.
      const readiness = 1 - pct / 100;
      const r = Math.round(61 + (78 - 61) * readiness);
      const g = Math.round(67 + (232 - 67) * readiness);
      const b = Math.round(85 + (142 - 85) * readiness);
      dom.specialFill.style.background = 'rgb(' + r + ', ' + g + ', ' + b + ')';
      dom.specialCooldown.classList.remove('is-ready');
    } else {
      dom.specialFill.style.background = '#4ee88e';
      dom.specialCooldown.classList.add('is-ready');
    }
  }

  // Dibuja el proyectil del jugador según su forma (identidad visual por arma),
  // orientado a la dirección de vuelo. "g" es el factor de crecimiento por tier (sutil,
  // solo en niveles altos). No participa en colisiones.
  function drawBulletShape(b, def, g) {
    NV.drawBulletShape(ctx, b, def, g);
  }



  // === RENDER ===
  function draw() {
    resizeCanvas();
    ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
    prepareDensityReadability();

    // Fondo galaxia más oscuro: mejora el contraste de los visuales rítmicos
    // sin aclarar el campo donde se leen enemigos, balas y HUD.
    ctx.fillStyle = '#01030d';
    ctx.fillRect(0, 0, W, H);
    NV.drawStarfield(ctx, W, H, frame, player.x, player.y, NV.rhythm);
    if (NV.drawRhythmLayer) NV.drawRhythmLayer(ctx, W, H, frame);

    if (flashAlpha > 0 && flashColor) {
      ctx.fillStyle = flashColor;
      ctx.globalAlpha = flashAlpha;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }

    const gridAlpha = 0.03 + Math.sin(frame * 0.02) * 0.005;
    ctx.strokeStyle = `rgba(124, 248, 255, ${gridAlpha})`;
    ctx.lineWidth = 0.5;
    for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    // Barra de progreso de oleada
    if (showHUD && state === 'playing' && !boss) {
            const maxWaveTimer = NV.waveDuration(wave, waveEvent);
      const progress = Math.max(0, Math.min(1, 1 - (waveTimer / maxWaveTimer)));
      const barW = 200, barH = 6;
      const barX = (W - barW) / 2, barY = 10;
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = '#7cf8ff';
      ctx.fillRect(barX, barY, barW * progress, barH);
      ctx.strokeStyle = 'rgba(124,248,255,0.3)';
      ctx.lineWidth = 1;
      ctx.strokeRect(barX, barY, barW, barH);
      ctx.fillStyle = '#7cf8ff';
      ctx.font = 'bold 10px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('OLEADA ' + wave, W / 2, barY + 16);
    }

    if (specialVFX) drawSpecialVFX(specialVFX);
    NV.drawShockwaves(ctx, shockwaves);

    for (const t of trails) {
      ctx.globalAlpha = Math.max(0, t.life / 0.3);
      ctx.fillStyle = t.color;
      ctx.beginPath(); ctx.arc(t.x, t.y, t.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    for (const wp of weaponPickups) {
      if (wp.dead) continue;
      if (typeof NV.drawWeaponIcon === 'function') {
        NV.drawWeaponIcon(ctx, wp.weapon, wp.x, wp.y - 2, 24, { glow: 5 });
      }
      ctx.fillStyle = RARITY_COLORS[wp.weapon.rarity];
      ctx.textAlign = 'center';
      ctx.font = '10px system-ui';
      ctx.fillText(wp.weapon.name, wp.x, wp.y + 15);
    }

    // Cofres de jefe: cofre dorado pulsante.
    for (const c of bossChests) {
      if (c.dead) continue;
      const pulse = 0.6 + Math.sin(frame * 0.15) * 0.4;
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.shadowBlur = 14;
      ctx.shadowColor = '#ffd700';
      ctx.fillStyle = '#ffcf76';
      ctx.fillRect(-14, -11, 28, 22);
      ctx.fillStyle = '#a06b18';
      ctx.fillRect(-14, -11, 28, 4);
      ctx.globalAlpha = 0.5 + pulse * 0.4;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-15, -12, 30, 24);
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    for (const p of pickups) {
      ctx.fillStyle = '#7cf8ff';
      ctx.font = '16px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('◆', p.x, p.y);
    }

    // Drones de combate
    for (const d of drones) {
      const dx = Math.cos(d.angle) * d.orbitRadius;
      const dy = Math.sin(d.angle) * d.orbitRadius;
      // Línea de puntería: muestra a qué objetivo apunta cada dron (se desvanece)
      if (d.aimLife > 0 && d.tx != null) {
        ctx.strokeStyle = d.color || '#7cf8ff';
        ctx.globalAlpha = (d.aimLife / 0.3) * 0.45;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(player.x + dx, player.y + dy);
        ctx.lineTo(d.tx, d.ty);
        ctx.stroke();
        ctx.setLineDash([]);
        // Marca en el punto del objetivo
        ctx.globalAlpha = (d.aimLife / 0.3) * 0.7;
        ctx.beginPath(); ctx.arc(d.tx, d.ty, 4, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = d.color;
      ctx.shadowBlur = 10;
      ctx.shadowColor = d.color;
      ctx.beginPath(); ctx.arc(player.x + dx, player.y + dy, 5, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Meteoritos
    for (const m of meteors) {
      ctx.fillStyle = m.color;
      ctx.shadowBlur = 15;
      ctx.shadowColor = m.color;
      ctx.beginPath(); ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      // Estela
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = m.color;
      ctx.fillRect(m.x - 2, m.y - m.radius * 2, 4, m.radius * 2);
      ctx.globalAlpha = 1;
    }

    // Legibilidad del golpe: dibujar PRIMERO a los no-atacantes y DESPUÉS a los
    // atacantes (atkFlash activo) => el enemigo que golpea queda por encima
    // visualmente y no es tapado por los superpuestos. Solo orden de dibujo.
    for (const e of enemies) if (!(e.atkFlash > 0)) drawEnemy(e);
    for (const e of enemies) if (e.atkFlash > 0) drawEnemy(e);
    if (NV.drawAutofireTarget) NV.drawAutofireTarget(ctx, currentAutoTarget, frame);
    for (const e of enemies) if (NV.drawContactReadability) NV.drawContactReadability(ctx, e, player, NV.META_DEBUG);
    for (const e of enemies) if (NV.drawEnemyIntent) NV.drawEnemyIntent(ctx, e, player);
    if (boss && !boss.dead) drawBoss();

    for (const b of bullets) {
      if (b.isEnemy) {
        // Balas enemigas: se dibujan como antes (círculo con su radio de colisión).
        ctx.fillStyle = b.color;
        ctx.shadowBlur = 8;
        ctx.shadowColor = b.color;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius || 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        continue;
      }
      if (!b.wid) {
        // Balas sin forma definida (p. ej. de drones): círculo pequeño como antes.
        ctx.fillStyle = b.color;
        ctx.shadowBlur = 4;
        ctx.shadowColor = b.color;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.size || 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        continue;
      }
      // Proyectil del jugador con identidad por arma.
      const def = BULLET_DEFS[b.wid] || BULLET_DEFS.pistol;
      // Crecimiento visual: nivel/fusión del arma + tier alto (nivel 30+), solo estético.
      const g = (b.growth || 0) + Math.max(0, (b.tier || 0) - 2) * 0.05;
      if (b.tier > 0) {
        ctx.shadowColor = b.glowColor || b.color;
        ctx.shadowBlur = 8 + b.tier; // glow compacto, no infla tanto
      } else {
        ctx.shadowColor = b.color;
        ctx.shadowBlur = 4;
      }
      drawBulletShape(b, def, g);
      ctx.shadowBlur = 0;
    }

    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / 0.5);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;

    for (const ft of floatTexts) {
      ctx.globalAlpha = Math.max(0, ft.life / 0.8);
      ctx.fillStyle = ft.color;
      ctx.font = 'bold 14px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.globalAlpha = 1;

    if (NV.drawMomentumReadability) NV.drawMomentumReadability(ctx, player, momentumVisual);
    drawPlayer();
    if (NV.drawDamageFeedback) NV.drawDamageFeedback(ctx, player, damageFeedback);
    if (NV.drawInvulnerabilityFeedback) NV.drawInvulnerabilityFeedback(ctx, player, invulnerabilityFeedback);
    // Evento NEBLINA: velo oscuro con viñeta que reduce la visibilidad periférica.
    if (waveEvent === 'fog' && state === 'playing') {
      ctx.save();
      ctx.fillStyle = 'rgba(8, 10, 22, 0.35)';
      ctx.fillRect(0, 0, W, H);
      const rx = W * 0.3, ry = H * 0.35; // elipse clara centrada en el jugador
      const g = ctx.createRadialGradient(player.x, player.y, Math.min(rx, ry) * 0.4, player.x, player.y, Math.max(W, H) * 0.75);
      g.addColorStop(0, 'rgba(8, 10, 22, 0)');
      g.addColorStop(1, 'rgba(8, 10, 22, 0.85)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    if (showHUD) {
      drawSpecialCooldown();
    NV.drawCombo(ctx, W, H, killCombo);
      drawWeaponHUD();
    }

    if (showStats) drawStats();

    // Pantalla de muerte roja con jumpscare
    if (state === 'gameover' && deathTimer > 0) {
      const intensity = Math.max(0, deathTimer / 1.2);
      // Overlay rojo pulsante
      ctx.fillStyle = `rgba(200, 0, 0, ${0.3 + intensity * 0.3})`;
      ctx.fillRect(0, 0, W, H);

      // Anillo de choque expandiéndose
      const ringR = (1 - intensity) * 600;
      ctx.strokeStyle = `rgba(255, 0, 0, ${intensity})`;
      ctx.lineWidth = 12 * intensity;
      ctx.beginPath(); ctx.arc(W / 2, H / 2, ringR, 0, Math.PI * 2); ctx.stroke();

      // "FIN" gigante con latido
      const beat = 1 + Math.sin(frame * 0.5) * 0.1;
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.scale(beat, beat);
      ctx.fillStyle = '#ff0000';
      ctx.shadowBlur = 50;
      ctx.shadowColor = '#ff0000';
      ctx.font = 'bold 120px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('FIN', 0, 0);
      ctx.restore();

      // Ojos de jumpscare
      const eyeY = Math.sin(frame * 0.3) * 8;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(W / 2 - 90, H / 2 + 80 + eyeY, 30, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(W / 2 + 90, H / 2 + 80 + eyeY, 30, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff0000';
      ctx.beginPath(); ctx.arc(W / 2 - 90, H / 2 + 80 + eyeY, 12, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(W / 2 + 90, H / 2 + 80 + eyeY, 12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(W / 2 - 90, H / 2 + 80 + eyeY, 4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(W / 2 + 90, H / 2 + 80 + eyeY, 4, 0, Math.PI * 2); ctx.fill();
    }

    // Pantalla de pausa (tecla P)
    if (paused) {
      ctx.fillStyle = 'rgba(5, 7, 20, 0.68)';
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#7cf8ff';
      ctx.shadowBlur = 30; ctx.shadowColor = '#7cf8ff';
      ctx.font = 'bold 56px system-ui';
      ctx.fillText('⏸ PAUSA', W / 2, H / 2 - 20);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#aaa';
      ctx.font = '18px system-ui';
      ctx.fillText('Pulsa P para continuar', W / 2, H / 2 + 24);
      ctx.fillStyle = '#666';
      ctx.font = '12px system-ui';
      ctx.fillText('Oleada ' + wave + ' · Puntos ' + score, W / 2, H / 2 + 54);
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    momentumVisual.previousVx = player.moveVx || 0;
    momentumVisual.previousVy = player.moveVy || 0;
    momentumVisual.previousSpeed = Math.hypot(momentumVisual.previousVx, momentumVisual.previousVy);
  }

  function drawSpecialVFX(vfx) {
    NV.drawSpecialVFX(ctx, vfx);
  }



  function drawSpecialCooldown() {
    NV.drawSpecialCooldown(ctx, W, H, CHARACTERS, player);
  }



  function drawWeaponHUD() {
    NV.drawWeaponHUD(ctx, W, H, CHARACTERS, RARITY_COLORS, player, currentWeapon, currentWeaponLevel, inventory, NV.groupConsumables(consumableItems), consumSel, showHUD);
  }



  function drawStats() {
    NV.drawStats(ctx, CHARACTERS, RARITY_COLORS, player, currentWeapon, currentWeaponLevel, weaponVisualTier, BULLET_TIER_COLORS, permUpgrades, inventory, INVENTORY_SLOTS, consumableItems);
  }



  function drawEnemy(e) {
    // Solo ocultar Canvas2D cuando el mesh WebGL de ESTE enemigo ya existe.
    // Durante carga, fallo o flag apagado, el render original sigue intacto.
    if (isEnemyRenderedByLite(e)) return;
    NV.drawEnemy(ctx, e, frame, player, NV.rhythm);
  }



  function drawBoss() {
    NV.drawBoss(ctx, boss, frame);
  }


  function drawPlayer() {
    NV.drawPlayer(ctx, player, CHARACTERS, frame);
  }


  // === LOOP ===
  function loop(now) {
    if (!lastTime) lastTime = now;
    let dt = Math.min(0.03, (now - lastTime) / 1000);
    lastTime = now;

    if (hitstop > 0) { hitstop = Math.max(0, hitstop - dt); dt = 0; }
    if (NV.rhythmTick) {
      const rhythmNow = now / 1000;
      NV.rhythmTick(rhythmNow);
      if (NV.rhythmShakeBoost) shake = Math.max(shake, NV.rhythmShakeBoost(NV.rhythm, rhythmNow));
      if (NV.updateRhythmWidgetIcon) NV.updateRhythmWidgetIcon();
    }

    // Decrementar deathTimer y deathShake en gameover
    if (state === 'gameover' && deathTimer > 0) {
      deathTimer = Math.max(0, deathTimer - dt);
      deathShake = Math.max(0, deathShake - dt * 2);
    }

    update(dt);
    if ((state === 'menu' || state === 'shop') && !paused) updateMusic(dt);
    draw();
    updateMetaDiagnostics();
    updateEspectroBridge(dt);

    if (shake > 0 && (state === 'playing' || state === 'gameover')) {
      const sx = (Math.random() - 0.5) * 8 * shake * (state === 'gameover' ? 2 : 1);
      const sy = (Math.random() - 0.5) * 4 * shake * (state === 'gameover' ? 2 : 1);
      canvas.style.transform = `translate(${sx}px, ${sy}px)`;
    } else { canvas.style.transform = ''; }

    requestAnimationFrame(loop);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }

  // === Accesores de estado para módulos externos (audio, render, ui…)
  NV.getFrame = () => frame;
  NV.getState = () => state;
  NV.getBoss = () => boss;
})();


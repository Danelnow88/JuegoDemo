/* ============================================================
   NEON VOID - ROGUELITE
   ============================================================ */
(() => {
  'use strict';

  const worldMetrics = NV.worldMetrics || (NV.worldMetrics = {
    refW: 900,
    refH: 520,
    viewW: 900,
    viewH: 520,
    viewX: 0,
    viewY: 0,
    arenaW: 900,
    arenaH: 520,
    scale: 1,
  });
  const REF_W = worldMetrics.refW, REF_H = worldMetrics.refH;
  const ARENA_W = worldMetrics.arenaW, ARENA_H = worldMetrics.arenaH;
  // Aliases legacy iniciales. En Stage 3 el gameplay consulta arenaW()/arenaH()
  // para que mobile landscape use la arena dinámica y desktop conserve legacy.
  const GW = REF_W, GH = REF_H;
  const canvas = NV.canvas;
  const ctx = NV.ctx;
  const specterCanvas = document.getElementById('specter-overlay');
  let scaleX = 1, scaleY = 1;

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dw = Math.round(rect.width), dh = Math.round(rect.height);
    // DPR efectivo centralizado: en escritorio SIEMPRE 1 (comportamiento original);
    // en móvil upscale hasta el cap del viewport (nítido sin resolver absurdo).
    const dpr = (NV.viewport && typeof NV.viewport.getEffectiveDpr === 'function')
      ? NV.viewport.getEffectiveDpr() : 1;
    const bdW = Math.round(dw * dpr), bdH = Math.round(dh * dpr);
    if (specterCanvas) {
      specterCanvas.style.left = canvas.offsetLeft + 'px';
      specterCanvas.style.top = canvas.offsetTop + 'px';
      specterCanvas.style.right = 'auto';
      specterCanvas.style.bottom = 'auto';
      specterCanvas.style.width = rect.width + 'px';
      specterCanvas.style.height = rect.height + 'px';
    }
    if (canvas.width !== bdW || canvas.height !== bdH) {
      canvas.width = bdW; canvas.height = bdH;
      if (specterCanvas && NV.espectroLite && typeof NV.espectroLite.resize === 'function') {
        NV.espectroLite.resize(dw, dh);
      }
    }
    syncEspectroCamera();
    const currentViewW = worldMetrics.viewW || REF_W;
    const currentViewH = worldMetrics.viewH || REF_H;
    scaleX = canvas.width / currentViewW; scaleY = canvas.height / currentViewH;
  }
  const W = ARENA_W, H = ARENA_H;
  function arenaW() { return worldMetrics.arenaW || REF_W; }
  function arenaH() { return worldMetrics.arenaH || REF_H; }
  function viewW() { return worldMetrics.viewW || REF_W; }
  function viewH() { return worldMetrics.viewH || REF_H; }
  function viewX() { return worldMetrics.viewX || 0; }
  function viewY() { return worldMetrics.viewY || 0; }
  function syncEspectroCamera() {
    const lite = NV.espectroLite;
    const camera = lite && lite.camera;
    if (!camera) return;
    camera.left = viewX();
    camera.right = viewX() + viewW();
    camera.top = -viewY();
    camera.bottom = -(viewY() + viewH());
    if (typeof camera.updateProjectionMatrix === 'function') camera.updateProjectionMatrix();
  }

  // === PUENTE ESPECTRO LITE WEBGL ===
  // Totalmente deprecado: Three.js legacy se desactiva por completo. Todos los
  // espectros (incl. specter_lite / specter_core) usan el renderer Canvas2D líquido.
  NV.SPECTER_ENABLED = true;
  NV.ESPECTRO_LITE_ACTIVE = false;
  // === MODO ESPECTRAL ENEMIES 2D ===
  // Render alternativo Canvas2D para enemigos (no specters). Default: true (remaster).
  // NV.toggleSpectralEnemyMode(false) revierte al render geométrico original.
  NV.SPECTRAL_ENEMY_MODE = true;
  const ESPECTRO_THREE_CDN = 'https://unpkg.com/three@0.160.0/build/three.module.js';
  const espectroEntries = new Map();
  // Identidad visual aprobada en previews/espectro-lite-single-preview.html.
  const SPECTER_FORM = 0.35;
  const SPECTER_SCALE = 0.4;
  const SPECTER_VARIANT = [1, 0, 0];
  let espectroLiteLoading = false;
  let espectroLiteFailed = false;
  let espectroTime = 0;
  // Tipo de espectro forzado vía URL (?forceSpecter=specter_lite) o consola forceSpecter()
  let forceSpecterType = null;

  // === ESTADO ===
  let state = 'menu', frame = 0, lastTime = 0;
  let shake = 0, hitstop = 0, flashColor = null, flashAlpha = 0, specialVFX = null;
  const DEATH_TRANSITION_DURATION = 1.45;
  const WAVE_END_DURATION = 2.10;
  const BOSS_WAVE_END_DURATION = 2.25;
  const SHOP_ENTER_DURATION = 0.35;
  let presentation = {
    kind: null,
    elapsed: 0,
    duration: 0,
    targetX: 0,
    targetY: 0,
    isBoss: false,
    pilot: 'boti',
    finalized: false,
  };

  function resetPresentation() {
    presentation.kind = null;
    presentation.elapsed = 0;
    presentation.duration = 0;
    presentation.targetX = 0;
    presentation.targetY = 0;
    presentation.isBoss = false;
    presentation.pilot = 'boti';
    presentation.finalized = false;
  }

  function clearCombatIntent() {
    NV.input.setFire(false);
    combatIntent.fireIntent = false;
    combatIntent.dashIntent = false;
    combatIntent.abilityIntent = false;
    fireTimer = 0;
    currentAutoTarget = null;
    NV.resetDashPauseLatch(player, false);
    if (NV.audio && typeof NV.audio.stopAllWeapons === 'function') NV.audio.stopAllWeapons();
  }

  function easeOutCubic(value) {
    const p = Math.max(0, Math.min(1, value));
    return 1 - Math.pow(1 - p, 3);
  }

  function presentationProgress() {
    return presentation.duration > 0 ? Math.max(0, Math.min(1, presentation.elapsed / presentation.duration)) : 0;
  }

  function presentationZoom() {
    const reduced = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const maxZoom = reduced ? 1.02 : (state === 'player_dying' || state === 'gameover' ? 1.10 : (presentation.isBoss ? 1.08 : 1.07));
    const raw = presentationProgress();
    const delayed = state === 'player_dying' || state === 'gameover'
      ? Math.max(0, (raw - 0.08) / 0.54)
      : Math.max(0, (raw - 0.05) / 0.32);
    const progress = state === 'shop_enter' || state === 'shop' ? 1 : easeOutCubic(Math.min(1, delayed));
    return 1 + (maxZoom - 1) * progress;
  }

  function cinematicView(vx, vy, vw, vh) {
    if (state !== 'player_dying' && state !== 'gameover' && state !== 'wave_end' && state !== 'shop_enter') {
      return { zoom: 1, centerX: vx + vw / 2, centerY: vy + vh / 2 };
    }
    const zoom = presentationZoom();
    const halfW = vw / zoom / 2;
    const halfH = vh / zoom / 2;
    const centerX = Math.max(halfW, Math.min(arenaW() - halfW, presentation.targetX || player.x));
    const centerY = Math.max(halfH, Math.min(arenaH() - halfH, presentation.targetY || player.y));
    return { zoom, centerX, centerY };
  }

  function playerPresentationStyle() {
    const progress = presentationProgress();
    if (state === 'player_dying' || state === 'gameover') {
      const dissolve = easeOutCubic(Math.max(0, Math.min(1, (progress - 0.10) / 0.58)));
      return { alpha: 1 - dissolve, scale: 1 - dissolve * 0.14, flourish: 0 };
    }
    if (state === 'wave_end') {
      const local = Math.max(0, Math.min(1, presentation.elapsed / 0.55));
      return { alpha: 1, scale: 1 + Math.sin(local * Math.PI) * 0.035, flourish: Math.sin(local * Math.PI) };
    }
    return null;
  }

  // Publica el estado compartido para que CSS y la UI móvil controlen visibilidad.
  function syncGameState() {
    const root = document.documentElement;
    if (root) {
      root.setAttribute('data-game-state', state);
      root.setAttribute('data-paused', paused ? 'true' : 'false');
    }
    if (typeof document !== 'undefined' && typeof document.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
      document.dispatchEvent(new CustomEvent('nv-game-state-change', { detail: { state, paused } }));
    }
  }

  // === JUGADOR ===
  const player = {
    x: arenaW()/2, y: arenaH()-100, hp: 100, maxHp: 100,
    baseMoveSpeed: 195, effectiveMoveSpeed: 195, speed: 195, color: '#7cf8ff',
    specialCd: 0, maxCd: 4, invuln: 0, character: 'boti',
    armor: 0, luck: 0, overdrive: 0, xp: 0, level: 1, xpToNext: 100,
    moveVx: 0, moveVy: 0, agility: 1,
    moveSpeedPermanentMult: 1, moveControlPermanentMult: 1, moveSpeedTemporaryMult: 1,
    acceleration: 0, deceleration: 0, turnControl: 0, reversalControl: 0,
    moveReversing: false,
    lastMoveDirX: 0, lastMoveDirY: -1,
    dashStaminaMax: 100, dashStamina: 100, dashCost: 50,
    dashTime: 0, dashRechargeDelay: 0, dashDirX: 0, dashDirY: -1,
    dashInputHeld: false, dashActive: false,
  };

  // === ENTIDADES ===
  let enemies = [], bullets = [], particles = [], pickups = [], floatTexts = [], shockwaves = [], trails = [], weaponPickups = [], drones = [], meteors = [], bossChests = [], hazards = [];
  let minefieldState = NV.createMinefieldState ? NV.createMinefieldState() : { spawnTimer: 0, serial: 0, spawned: 0, active: false };
  const MAX_HOSTILES = NV.BALANCE.MAX_HOSTILES, MAX_HEAVY_HOSTILES = NV.BALANCE.MAX_HEAVY_HOSTILES;
  const MAX_ENEMIES = MAX_HOSTILES, MAX_BULLETS = NV.BALANCE.MAX_BULLETS, MAX_PARTICLES = NV.BALANCE.MAX_PARTICLES;
  // Presupuesto separado de balas por bando: evita que las balas enemigas
  // (p. ej. muchos ESCOPURAS) congele el disparo del jugador al saturar el buffer común.
  const MAX_PLAYER_BULLETS = NV.BALANCE.MAX_PLAYER_BULLETS;
  const MAX_ENEMY_BULLETS = NV.BALANCE.MAX_ENEMY_BULLETS;
  // Cuenta cuántas balas hay de cada bando (para respetar los topes propios).
  function playerBulletCount() { let n = 0; for (const b of bullets) if (!b.isEnemy) n++; return n; }
  function enemyBulletCount() { let n = 0; for (const b of bullets) if (b.isEnemy) n++; return n; }

  // Three.js legacy FULLY DEPRECATED. Todos los espectros ahora renderizan
  // por completo con el Canvas 2D líquido del Visual Lab. Siempre retorna false.
  function shouldUseEspectroLite() {
    return false;
  }

  function isEnemyRenderedByLite(e) {
    return !!(NV.SPECTER_ENABLED !== false && NV.ESPECTRO_LITE_ACTIVE
      && hasEspectroLiteApi(NV.espectroLite) && NV.espectroLite.initialized && espectroEntries.has(e));
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
    if (!NV.ESPECTRO_LITE_ACTIVE || !NV.SPECTER_ENABLED || espectroLiteLoading || espectroLiteFailed) return;
    if (NV.espectroLite && NV.espectroLite.initialized) return;
    espectroLiteLoading = true;
    (NV.THREE_READY || import(ESPECTRO_THREE_CDN)).then((THREE) => {
      if (!NV.ESPECTRO_LITE_ACTIVE) return;
      const host = canvas.parentElement;
      const rect = canvas.getBoundingClientRect();
      const webglCanvas = specterCanvas;
      if (!webglCanvas) throw new Error('Canvas #specter-overlay no encontrado');
      const camera = new THREE.OrthographicCamera(viewX(), viewX() + viewW(), -viewY(), -(viewY() + viewH()), 0.1, 100);
      camera.position.z = 10;
      const lite = NV.initEspectroLite(THREE, {
        host, canvas: webglCanvas, camera,
        width: Math.max(1, Math.round(rect.width)),
        height: Math.max(1, Math.round(rect.height)),
      });
      if (!lite || !hasEspectroLiteApi(lite)) throw new Error('API incompatible de Espectro Lite');
      if (typeof lite.resize === 'function') lite.resize(rect.width, rect.height);
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
      // La asignación directa NV.SPECTER_ENABLED=false también es efectiva:
      // retira entidades existentes, limpia meshes y oculta el overlay.
      if (NV.SPECTER_ENABLED === false) {
        enemies = enemies.filter((e) => e.shape !== 'specter');
        clearEspectroBridge();
        return;
      }
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
        if (shouldUseEspectroLite(e)) selected.push(e);
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
          entry = lite.createEnemy({
            x: e.x, y: -e.y,
            scale: SPECTER_SCALE,
            phase: 0,
            form: SPECTER_FORM,
            variantColor: SPECTER_VARIANT,
          });
          if (entry) espectroEntries.set(e, entry);
        }
        if (entry) {
          lite.syncEnemy(entry, {
            x: e.x, y: -e.y,
            scale: SPECTER_SCALE,
            lookX: player.x,
            lookY: -player.y,
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

  NV.toggleSpecter = function (enabled) {
    NV.SPECTER_ENABLED = !!enabled;
    espectroLiteFailed = false;
    if (!NV.SPECTER_ENABLED) {
      enemies = enemies.filter((e) => e.shape !== 'specter');
      clearEspectroBridge();
    } else {
      NV.ESPECTRO_LITE_ACTIVE = true;
    }
    return NV.SPECTER_ENABLED;
  };

  // Toggle para el render espectral de enemigos (Canvas2D). No afecta specters (WebGL).
  // Default: off. Al activarse, drawEnemy usa drawSpectralEnemy2D para cada enemigo.
  NV.toggleSpectralEnemyMode = function (enabled) {
    NV.SPECTRAL_ENEMY_MODE = !!enabled;
    return NV.SPECTRAL_ENEMY_MODE;
  };

  // Ayuda de prueba compatible con el parámetro ?forceSpecter=...
  NV.forceSpecter = function (typeId) {
    forceSpecterType = typeId || null;
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
  const moveButtons = { left: false, right: false, up: false, down: false };
  const combatIntent = NV.inputIntent.createCombatIntent(NV.settings.controls.firePolicy);
  let showStats = false, showHUD = true, paused = false;
  let settingsRestorePaused = false;

  // === PUENTE INPUT (táctil → el MISMO sistema lógico) ===
  // La capa móvil (mobileControls.js) escribe en ESTOS mismos canales booleanos que
  // ya usa el teclado: nada de duplicar física ni lógica. En escritorio este puente
  // queda inactivo (mobileControls no se activa si no hay detección móvil).
  NV.input = NV.input || {};
  function syncMoveIntent() { NV.inputIntent.setMoveFromButtons(combatIntent, moveButtons); }
  NV.input.setMoveLeft = (v) => { moveButtons.left = !!v; syncMoveIntent(); };
  NV.input.setMoveRight = (v) => { moveButtons.right = !!v; syncMoveIntent(); };
  NV.input.setMoveUp = (v) => { moveButtons.up = !!v; syncMoveIntent(); };
  NV.input.setMoveDown = (v) => { moveButtons.down = !!v; syncMoveIntent(); };
  NV.input.setSlide = (v) => { combatIntent.dashIntent = !!v; };
  NV.input.setSpecial = (v) => { combatIntent.abilityIntent = !!v; };
  NV.input.setFire = (v) => { combatIntent.fireIntent = !!v; };
  NV.input.setAimWorld = (x, y) => NV.inputIntent.setAimWorld(combatIntent, x, y, player.x, player.y);
  NV.input.getCombatIntent = () => Object.assign({}, combatIntent);
  NV.input.getEffectiveFirePolicy = () => NV.inputIntent.effectiveFirePolicy(combatIntent, !!(NV.capabilities && NV.capabilities.isMobile));
  NV.input.useSelected = () => {
    if (state === 'playing' && !paused) useConsumable();
  };
  // Cambio de consumible táctil → misma lógica que Q/E (grupos + selección circular).
  NV.input.cycleConsumable = (dir) => {
    if (state !== 'playing' || paused) return;
    const g = NV.groupConsumables(consumableItems);
    if (g.length) {
      consumSel = NV.cycleIndex(consumSel, g.length, dir > 0 ? +1 : -1);
      try { if (sfx && typeof sfx.wheelSelect === 'function') sfx.wheelSelect(); } catch (_) { /* defensivo */ }
      notifyMobileConsumable();
    }
  };
  // API mínima para que mobileControls lea el estado actual sin duplicarlo.
  NV.input.getWeaponInfo = () => {
    if (!currentWeapon) return { id: 'pistol', name: '—', rarity: 'common' };
    return { id: currentWeapon.id || 'pistol', name: currentWeapon.name || '—', rarity: currentWeapon.rarity || 'common' };
  };
  NV.input.getConsumableInfo = () => {
    const g = NV.groupConsumables(consumableItems);
    if (!g.length || consumSel === undefined || consumSel < 0 || consumSel >= g.length) return null;
    const cur = g[consumSel];
    return { type: (cur && cur.type) || '—', name: (cur && cur.name) || (cur && cur.type) || '—', count: (cur && cur.count) || 0 };
  };
  NV.input.getSpecialInfo = () => {
    const char = CHARACTERS[player.character];
    const max = char && char.maxCd > 0 ? char.maxCd : 1;
    const remaining = Math.max(0, player.specialCd || 0);
    const active = state === 'playing' && !paused;
    return {
      active,
      ready: active && remaining <= 0,
      remaining,
      max,
      progress: active ? Math.max(0, Math.min(1, 1 - remaining / max)) : 0,
      color: (char && char.color) || '#7cf8ff',
    };
  };
  // Notifica a la capa móvil cuando cambia el estado de arma/consumible.
  function notifyMobileWeapon() { const cbs = NV.input._onWeaponChange; if (Array.isArray(cbs)) { const info = NV.input.getWeaponInfo(); try { cbs.forEach((cb) => { if (typeof cb === 'function') cb(info); }); } catch (_) { /* defensivo */ } } }
  function notifyMobileConsumable() { const cbs = NV.input._onConsumableChange; if (Array.isArray(cbs)) { const info = NV.input.getConsumableInfo(); try { cbs.forEach((cb) => { if (typeof cb === 'function') cb(info); }); } catch (_) { /* defensivo */ } } }
  function notifyMobileSpecial() { const cbs = NV.input._onSpecialChange; if (Array.isArray(cbs)) { const info = NV.input.getSpecialInfo(); try { cbs.forEach((cb) => { if (typeof cb === 'function') cb(info); }); } catch (_) { /* defensivo */ } } }
  NV.input.notifyWeaponChange = notifyMobileWeapon;
  NV.input.notifyConsumableChange = notifyMobileConsumable;
  NV.input.notifySpecialChange = notifyMobileSpecial;
  NV.input._onWeaponChange = NV.input._onWeaponChange || [];
  NV.input._onConsumableChange = NV.input._onConsumableChange || [];
  NV.input._onSpecialChange = NV.input._onSpecialChange || [];
  // Panel de opciones móvil → reutiliza togglePause / showStats y el toggle de sonido.
  NV.input.toggleStats = () => { showStats = !showStats; };
  function syncSoundUI() {
    const enabled = NV.soundOn !== false;
    if (dom && dom.sound) {
      dom.sound.textContent = enabled ? '🔊 SONIDO' : '🔇 SILENCIO';
      dom.sound.classList.toggle('off', !enabled);
      dom.sound.setAttribute('aria-pressed', enabled ? 'true' : 'false');
      dom.sound.title = enabled ? 'Silenciar sonido' : 'Activar sonido';
    }
    if (dom && dom.mSoundBtn) {
      dom.mSoundBtn.textContent = enabled ? '🔊 Sonido: ON' : '🔇 Sonido: OFF';
      dom.mSoundBtn.classList.toggle('off', !enabled);
      dom.mSoundBtn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    }
  }
  NV.syncSoundUI = syncSoundUI;
  NV.input.toggleSound = () => {
    NV.setSoundEnabled(!NV.soundOn);
  };
  NV.input.setSettingsOpen = (open) => {
    if (state !== 'playing') { syncGameState(); return; }
    if (open) {
      NV.input.setFire(false);
      combatIntent.dashIntent = false;
      NV.resetDashPauseLatch(player, false);
      settingsRestorePaused = paused;
      paused = true;
      if (NV.audio && typeof NV.audio.stopAllWeapons === 'function') NV.audio.stopAllWeapons();
    } else {
      paused = settingsRestorePaused;
      combatIntent.dashIntent = false;
      NV.resetDashPauseLatch(player, false);
    }
    syncGameState();
  };

  // === PERSONAJES ===
  const CHARACTERS = NV.CHARACTERS;

  // === ARMAS (10) ===
  const WEAPONS = NV.WEAPONS;

  const RARITY_COLORS = NV.RARITY_COLORS;
  let currentWeapon = NV.starterWeapon(), fireTimer = 0;
  NV.onSettingsChange((settings) => {
    combatIntent.firePolicy = settings.controls.firePolicy;
    combatIntent.fireIntent = false;
    fireTimer = 0;
  });
  let invSwapSel = -1; // origen de intercambio de slots en el dock de armas (shop)
  function stopCurrentWeaponAudio() {
    if (currentWeapon && NV.audio && typeof NV.audio.weaponStop === 'function') NV.audio.weaponStop(currentWeapon.id);
  }
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
  const MAX_AGILITY = NV.BALANCE.MAX_AGILITY;              // tope de control in-run; no aumenta velocidad punta
  const AGILITY_PER_UPGRADE = NV.BALANCE.AGILITY_PER_UPGRADE;    // +0.2 control por compra (5 compras llegan al tope)
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

  function updateLobbyHeroInfo() {
    const char = CHARACTERS[player.character];
    if (!char || typeof document === 'undefined') return;
    const card = char.card || {};
    const setText = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value || '';
    };
    setText('heroName', char.name);
    setText('heroTag', card.tag);
    // F09.4: stats como chips escaneables (HP/SPD/ARM). Progresivo: si el
    // statLine cambia o el DOM no está listo, cae al texto plano original.
    // Se usa innerHTML (valores ya validados por regex) para ser compatible
    // con el arnés headless de tests.
    (function renderHeroStatChips() {
      const el = document.getElementById('heroStats');
      if (!el) return;
      const line = card.statLine || '';
      const m = line.match(/HP\s*([^\s·]+)\s*·\s*SPD\s*([^\s·]+)\s*·\s*ARM\s*([^\s·]+)/);
      if (!m) { el.textContent = line; return; }
      const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
      el.innerHTML =
        '<span class="stat-chip"><b>HP</b> ' + esc(m[1]) + '</span>' +
        '<span class="stat-chip"><b>SPD</b> ' + esc(m[2]) + '</span>' +
        '<span class="stat-chip"><b>ARM</b> ' + esc(m[3]) + '</span>';
    })();
    setText('heroPassive', char.passive);
    setText('heroSkillName', char.skillName);
    setText('heroSkillDesc', char.skillDesc);
    setText('heroIdentity', card.identity);
    const info = document.querySelector('.lobby-hero-info');
    if (info && info.style && typeof info.style.setProperty === 'function') info.style.setProperty('--pilot-accent', char.color);
    const icon = document.getElementById('heroSkillIcon');
    if (icon && typeof NV.drawMetaSkillIcon === 'function') {
      const iconCtx = icon.getContext('2d');
      if (iconCtx) {
        iconCtx.clearRect(0, 0, icon.width, icon.height);
        NV.drawMetaSkillIcon(iconCtx, char.special, icon.width / 2, icon.height / 2, 14, { glow: 2 });
      }
    }
  }

  function syncPilotCards() {
    if (typeof document === 'undefined') return;
    document.querySelectorAll('.char-card').forEach((card) => {
      const selected = card.getAttribute('data-char') === player.character;
      card.classList.toggle('selected', selected);
      card.setAttribute('aria-pressed', selected ? 'true' : 'false');
    });
  }

  function selectPilot(id) {
    const char = CHARACTERS[id];
    if (!char) return false;
    player.character = id;
    player.color = char.color;
    player.maxHp = (char.stats ? char.stats.hp : 100) + (permUpgrades.hp || 0) * 20;
    player.hp = player.maxHp;
    if (NV.configurePlayerMovement) NV.configurePlayerMovement(player, char.stats ? char.stats.speed : 195, permUpgrades.speed || 0);
    if (NV.configurePlayerDash) NV.configurePlayerDash(player);
    player.armor = (char.stats ? char.stats.armor : 0) + (permUpgrades.armor || 0);
    player.luck = (char.stats ? char.stats.luck : 0) + (permUpgrades.luck || 0) * 10;
    player.permCrit = permUpgrades.crit || 0;
    player.permDodge = permUpgrades.dodge || 0;
    player.permRegen = permUpgrades.regen || 0;
    player.permGreed = permUpgrades.greed || 0;
    player.maxCd = char.maxCd;
    syncPilotCards();
    renderMenuSkillIcons();
    updateLobbyHeroInfo();
    syncSoundUI();
    return true;
  }

  function changePilot(direction) {
    const order = NV.CHARACTER_ORDER || [];
    if (!order.length) return false;
    const current = Math.max(0, order.indexOf(player.character));
    return selectPilot(order[(current + direction + order.length) % order.length]);
  }

  NV.selectPilot = selectPilot;

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
    if (typeof window !== 'undefined' && window.location && window.location.search) {
      const m = /[?&]forceSpecter=([^&]+)/.exec(window.location.search);
      if (m && m[1]) forceSpecterType = m[1];
    }

    if (NV.rhythmRestorePref) NV.rhythmRestorePref();
    resizeCanvas();
    syncGameState();
    NV.renderCharacterCards(dom.charGrid, CHARACTERS, player.character);
    renderMenuSkillIcons();
    document.querySelectorAll('.char-card').forEach((card) => {
      card.addEventListener('click', () => selectPilot(card.getAttribute('data-char')));
    });

    const heroPrev = document.getElementById('hero-prev');
    const heroNext = document.getElementById('hero-next');
    if (heroPrev) heroPrev.addEventListener('click', () => changePilot(-1));
    if (heroNext) heroNext.addEventListener('click', () => changePilot(1));

    if (dom.lobbyPlayBtn) dom.lobbyPlayBtn.addEventListener('click', () => {
      initAudio();
      startGame();
    });
    if (dom.pilotsBtn) dom.pilotsBtn.addEventListener('click', showCharacterSelect);
    dom.startBtn.addEventListener('click', showLobby);
    dom.restartBtn.addEventListener('click', showLobby);
    dom.skipWave.addEventListener('click', skipShop);
    if (dom.permBtn) dom.permBtn.addEventListener('click', openPermShop);
    if (dom.permBack) dom.permBack.addEventListener('click', closePermShop);
    window.addEventListener('resize', resizeCanvas);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        NV.input.setFire(false);
        combatIntent.dashIntent = false;
        if (NV.audio && typeof NV.audio.stopAllWeapons === 'function') NV.audio.stopAllWeapons();
      }
    });
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
      // Conversión centralizada screen→game: escritorio usa la misma fórmula
      // legacy; móvil aplica escala uniforme + letterbox/pillarbox + DPR.
      let mx, my;
      if (NV.screenToGame) {
        const pt = NV.screenToGame(e.clientX, e.clientY);
        mx = pt.x; my = pt.y;
      } else {
        const rect = canvas.getBoundingClientRect();
        mx = (e.clientX - rect.left) / scaleX; my = (e.clientY - rect.top) / scaleY;
      }
      for (let i = 0; i < NV.consumSlotRects.length; i++) {
        const r = NV.consumSlotRects[i];
        if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
          if (consumSel !== i) { consumSel = i; sfx.wheelSelect(); }
          return;
        }
      }
    });

    function eventHitsConsumableSlot(e) {
      if (!NV.consumSlotRects || !NV.screenToGame) return false;
      const pt = NV.screenToGame(e.clientX, e.clientY);
      return NV.consumSlotRects.some((r) => pt.x >= r.x && pt.x <= r.x + r.w && pt.y >= r.y && pt.y <= r.y + r.h);
    }
    // Desktop manual: mouse client -> mundo mediante la autoridad de viewport.
    canvas.addEventListener('mousemove', (e) => {
      if (NV.capabilities && NV.capabilities.isMobile) return;
      const pt = NV.screenToGame(e.clientX, e.clientY);
      NV.input.setAimWorld(pt.x, pt.y);
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0 || state !== 'playing' || paused || NV.input.getEffectiveFirePolicy() !== 'manual') return;
      // LMB conserva la selección de consumibles del HUD Canvas.
      if (eventHitsConsumableSlot(e)) return;
      const pt = NV.screenToGame(e.clientX, e.clientY);
      NV.input.setAimWorld(pt.x, pt.y);
      NV.input.setFire(true);
      e.preventDefault();
    });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) NV.input.setFire(false); });
    window.addEventListener('blur', () => { NV.input.setFire(false); combatIntent.dashIntent = false; });

    window.addEventListener('keydown', (e) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') NV.input.setMoveLeft(true);
      if (e.code === 'ArrowRight' || e.code === 'KeyD') NV.input.setMoveRight(true);
      if (e.code === 'ArrowUp' || e.code === 'KeyW') NV.input.setMoveUp(true);
      if (e.code === 'ArrowDown' || e.code === 'KeyS') NV.input.setMoveDown(true);
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') { NV.input.setSlide(true); e.preventDefault(); }
      if (e.code === 'Space' || e.code === 'KeyZ' || e.code === 'KeyX') {
        NV.input.setSpecial(true); e.preventDefault();
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
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') NV.input.setMoveLeft(false);
      if (e.code === 'ArrowRight' || e.code === 'KeyD') NV.input.setMoveRight(false);
      if (e.code === 'ArrowUp' || e.code === 'KeyW') NV.input.setMoveUp(false);
      if (e.code === 'ArrowDown' || e.code === 'KeyS') NV.input.setMoveDown(false);
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') NV.input.setSlide(false);
      if (e.code === 'Space' || e.code === 'KeyZ' || e.code === 'KeyX') NV.input.setSpecial(false);
    });

    // === PAUSA (tecla P) ===
    function togglePause() {
      if (state !== 'playing') return;
      paused = !paused;
      NV.input.setFire(false);
      combatIntent.dashIntent = false;
      // Marcamos la intención actual como consumida por el motor para que
      // mantener Shift durante la pausa no genere un dash diferido al reanudar.
      NV.resetDashPauseLatch(player, false);
      if (paused && NV.audio && typeof NV.audio.stopAllWeapons === 'function') NV.audio.stopAllWeapons();
      syncGameState();
      if (paused) dom.startScreen.classList.add('hidden');
    }
    NV.input.togglePause = togglePause;

    // === CAMBIO DE ARMA (teclas 1-6 entre las recogidas) ===
    function equipFromInventory(index) {
      if (index < 0 || !inventory[index] || inventory[index] === currentWeapon) return;
      stopCurrentWeaponAudio();
      currentWeapon = inventory[index];
      addFloatText(arenaW() / 2, arenaH() / 2 - 40, 'EQUIPADO: ' + currentWeapon.name, RARITY_COLORS[currentWeapon.rarity]);
      updateHUD();
      sfx.wheelSelect();
      notifyMobileWeapon();
    }

    // === CAMBIO DE ARMA CON LA RUEDA DEL MOUSE (loadout completo, circular) ===
    // La pistola inicial es un arma normal del inventario: ningún slot está reservado.
    function cycleWeapon(dir) {
      if (state !== 'playing' || paused) return;
      const list = inventory.slice();
      if (!list.length) return;
      const ci = list.indexOf(currentWeapon);
      const base = ci < 0 ? 0 : ci;
      const next = NV.cycleWeapon(list[base], list, dir);
      if (!next || next === list[base]) return;
      stopCurrentWeaponAudio();
      currentWeapon = next;
      addFloatText(arenaW() / 2, arenaH() / 2 - 40, 'EQUIPADO: ' + currentWeapon.name, RARITY_COLORS[currentWeapon.rarity]);
      updateHUD();
      sfx.wheelSelect();
      notifyMobileWeapon();
    }
    NV.input.cycleWeapon = cycleWeapon;

    dom.sound.addEventListener('click', () => {
      NV.input.toggleSound();
    });
    syncSoundUI();

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
    // Telemetría opt-in F08: se activa con ?playtest=1 (o manualmente en consola
    // con NV.playtest.enable()); snapshot con NV.playtest.snapshot().
    try {
      if (NV.playtest && typeof URLSearchParams === 'function'
        && window.location && window.location.search
        && new URLSearchParams(window.location.search).has('playtest')) {
        NV.playtest.enable();
      }
    } catch (_) { /* entornos sin location: la telemetría queda manual */ }
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
      const nowMs = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      const prevMs = icon._smoothT || nowMs;
      const dtMs = Math.max(0, Math.min(80, nowMs - prevMs));
      icon._smoothT = nowMs;
      // La matemática de envelope/respiración/attack-release vive en rhythm.js y
      // también alimenta Speaker Mines. Aquí solo se hace el mapping DOM del SVG.
      const groove = NV.computeRhythmGroove(icon, r, dtMs / 1000, { connected: true });
      const beat = groove.beat;
      const energy = groove.energy;
      glyph.style.transform = 'scale(' + groove.smoothScale.toFixed(4) + ') skewX(' + groove.smoothSkew.toFixed(2) + 'deg)';
      // Color dinámico por hue calculado (mismo que tiñe el fondo)
      icon.style.color = 'hsl(' + Math.round(hue) + ',75%,62%)';
      // Brillo/glow fade en función de la energía detectada
      icon.style.opacity = (0.65 + energy * 0.35).toFixed(3);
      icon.style.filter = 'drop-shadow(0 0 ' + (2 + energy * 6).toFixed(1) + 'px hsl(' + Math.round(hue) + ',80%,60%))';
      // Diagnóstico opt-in del widget de ritmo: activar con ?rhythmdebug=1.
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
    }
    NV.updateRhythmWidgetIcon = updateRhythmWidgetIcon;

    // En modo ?rhythmdebug=1, T fuerza un pulso para aislar captura vs. render.
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

  function prepareMenuState() {
    if (NV.audio && typeof NV.audio.stopAllWeapons === 'function') NV.audio.stopAllWeapons();
    NV.input.setFire(false);
    combatIntent.dashIntent = false;
    NV.resetDashPauseLatch(player, false);
    paused = false;
    state = 'menu';
    resetPresentation();
    if (NV.clearHazards) NV.clearHazards(hazards, minefieldState); else hazards = [];
    syncGameState();
    dom.shop.classList.add('hidden');
    dom.gameOver.classList.add('hidden');
    dom.permScreen.classList.add('hidden');
  }

  function showLobby() {
    prepareMenuState();
    updateLobbyHeroInfo();
    dom.startScreen.classList.remove('hidden');
    if (dom.characterSelectScreen) dom.characterSelectScreen.classList.add('hidden');
    if (typeof NV.renderLobbyDifficultySelection === 'function') NV.renderLobbyDifficultySelection();
  }

  function showCharacterSelect() {
    prepareMenuState();
    syncPilotCards();
    renderMenuSkillIcons();
    dom.startScreen.classList.add('hidden');
    if (dom.characterSelectScreen) dom.characterSelectScreen.classList.remove('hidden');
  }

  function showMenu() { showLobby(); }

  function startGame() {
    console.log('[START] Iniciando partida...');
    NV.runDifficulty = NV.settings && NV.settings.gameplay && NV.settings.gameplay.difficulty || 'normal';
    paused = false;
    state = 'playing';
    resetPresentation();
    syncGameState();
    dom.startScreen.classList.add('hidden');
    if (dom.characterSelectScreen) dom.characterSelectScreen.classList.add('hidden');
    dom.shop.classList.add('hidden');
    dom.gameOver.classList.add('hidden');
    dom.permScreen.classList.add('hidden');

    const char = CHARACTERS[player.character];
    player.maxCd = char.maxCd;
    player.x = arenaW() / 2; player.y = arenaH() - 100;
    player.maxHp = char.stats.hp + permUpgrades.hp * 20;
    player.hp = player.maxHp;
    NV.configurePlayerMovement(player, char.stats.speed, permUpgrades.speed);
    NV.configurePlayerDash(player);
    player.armor = (char.stats.armor || 0) + (permUpgrades.armor || 0);
    player.luck = (char.stats.luck || 0) + permUpgrades.luck * 10;
    player.permCrit = permUpgrades.crit || 0; player.permDodge = permUpgrades.dodge || 0;
    player.permRegen = permUpgrades.regen || 0; player.permGreed = permUpgrades.greed || 0;
    player.specialCd = 0; player.invuln = 0; player.overdrive = 0; player.stun = 0;
    player.moveVx = 0; player.moveVy = 0; combatIntent.dashIntent = false; player.agility = 1;
    player.xp = 0; player.level = 1; player.xpToNext = 100;

    wave = 1; score = 0; shards = 0;
    waveEvent = null;
    if (NV.clearHazards) NV.clearHazards(hazards, minefieldState); else hazards = [];
    shopBought = {};
    upgradeSlots = []; // los slots de mejoras se reinician por partida, igual que shopBought
    killCombo = { count: 0, timer: 0 };
    heartbeatTimer = 0; heartbeatWasCritical = false; countdownLastSecond = 0;
    enemies = []; bullets = []; particles = []; pickups = [];
    clearEspectroBridge();
    floatTexts = []; trails = []; weaponPickups = []; bossChests = [];
    shockwaves = []; drones = []; meteors = []; hazards = [];
    minefieldState = NV.createMinefieldState ? NV.createMinefieldState() : minefieldState;
    inventory = [NV.starterWeapon()]; currentWeapon = inventory[0]; consumableItems = [];
    consumSel = 0;
    weaponLevels = {}; weaponKills = {}; weaponFus = {}; fireTimer = 0;
    if (NV.playtest) NV.playtest.reset(); // telemetría opt-in F08: agregados por partida
        boss = null; shake = 0; hitstop = 0; flashAlpha = 0;
    transition = 0; paused = false; showStats = false;
    resetPresentation();
    specialVFX = null; NV.musicTime = 0;
    NV.musicState.step = 0; NV.musicState.lastBeat = 0; NV.musicState.intensity = 0;
    NV.musicState.phase = 'normal'; NV.musicState.combo = 0; // reset de identidad sonora (Tarea 3)

    resizeCanvas();
    nextWave();
    updateHUD();
    notifyMobileWeapon();
    notifyMobileConsumable();
    console.log('[START] Partida iniciada correctamente');
  }

  function nextWave() {
    console.log('[WAVE] Oleada ' + wave);
    // Elegir evento ANTES de calcular duración: la duración depende de si hay evento.
    waveEvent = (wave % 5 !== 0 && wave % 3 === 0) ? pickWaveEvent() : null;
    waveTimer = NV.waveDuration(wave, waveEvent);
    spawnTimer = 0;
    if (NV.clearHazards) NV.clearHazards(hazards, minefieldState); else hazards = [];
    // Limpieza completa de entidades por oleada (rendimiento): no dejar restos de
    // partículas, drones, meteoros, estelas, textos/cofres/armas del suelo de la
    // oleada anterior acumulándose entre oleadas (deuda técnica de rendimiento).
    enemies = []; bullets = []; particles = []; pickups = [];
    clearEspectroBridge();
    floatTexts = []; trails = []; shockwaves = []; weaponPickups = [];
    drones = []; meteors = []; bossChests = []; hazards = [];

    if (wave % 5 === 0) {
      const bossIndex = ((wave / 5 - 1) % BOSS_TYPES.length + BOSS_TYPES.length) % BOSS_TYPES.length;
      const bt = BOSS_TYPES[bossIndex];
                  // HP cuadrático en la oleada y durabilidad global: peleas largas y con peso.
                  const bossHp = Math.round((bt.hp + wave * wave * 12 + wave * 40) * 1.8 * ((typeof NV.difficultySafeMult === "function") ? NV.difficultySafeMult("hp") : 1));
                  const bossCandidate = { x: arenaW()/2, y: 100, hp: bossHp, maxHp: bossHp, radius: bt.radius, color: bt.color, timer: 0, atkTimer: 0, hitFlash: 0, hitSlowUntil: 0, hitSlowImmunity: 0, name: bt.name, pattern: bt.pattern, attack: bt.attack, shape: bt.shape, isBoss: true, hostileClass: 'heavy' };
                  boss = NV.canSpawnBoss({ enemies, boss: null, MAX_HOSTILES, MAX_HEAVY_HOSTILES }) ? bossCandidate : null;
      if (!boss) return;
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
        showBanner('⚠ ' + ev.name + ' · ' + ev.desc, ev.color);
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
    if (state === 'player_dying' || state === 'gameover' || state === 'wave_end' || state === 'shop_enter' || state === 'shop') return false;
    if (player.hp <= 0) { gameOver(); return false; }
    // Hazards no bloquean ni dañan durante la transición a tienda.
    if (NV.clearHazards) NV.clearHazards(hazards, minefieldState); else hazards = [];
    clearCombatIntent();
    bullets = [];
    state = 'wave_end';
    presentation.kind = 'wave_end';
    presentation.elapsed = 0;
    presentation.duration = isBoss ? BOSS_WAVE_END_DURATION : WAVE_END_DURATION;
    presentation.targetX = player.x;
    presentation.targetY = player.y;
    presentation.isBoss = !!isBoss;
    presentation.pilot = player.character;
    presentation.finalized = false;
    transition = presentation.duration;
    player.invuln = Math.max(player.invuln, presentation.duration + SHOP_ENTER_DURATION + 0.2);
    syncGameState();
    if (isBoss) {
      shake = 1;
      triggerFlash(bossColor || '#ffd700');
      spawnExplosion(arenaW() / 2, arenaH() / 2, 90, bossColor || '#ffd700', 1.5);
      spawnExplosion(arenaW() / 2, arenaH() / 2, 60, '#fff', 1.1);
      spawnExplosion(arenaW() / 2, arenaH() / 2, 40, '#ff5f9b', 0.9);
      showBanner('¡' + (bossName || 'BOSS') + ' DERROTADO!', '#ffd700');
    } else {
      shake = 0.4;
      triggerFlash('#7cf8ff');
      spawnExplosion(arenaW() / 2, arenaH() / 2, 55, '#7cf8ff', 1);
      spawnExplosion(arenaW() / 2, arenaH() / 2, 35, '#caa7ff', 0.8);
      showBanner('Oleada ' + wave + ' completa! ◆', '#7cf8ff');
    }
    sfx.victory(wave, { milestone: isBoss || wave % 5 === 0 || wave % 10 === 0 || wave % 25 === 0 });
    const victoryStyle = NV.PILOT_TRANSITIONS && NV.PILOT_TRANSITIONS[player.character];
    if (NV.spawnPlayerStabilize) NV.spawnPlayerStabilize(particles, MAX_PARTICLES, player.x, player.y, {
      count: isBoss ? 8 : 7, radius: isBoss ? 42 : 34, life: isBoss ? 0.68 : 0.55,
      colors: victoryStyle ? victoryStyle.colors : [player.color],
      color: victoryStyle ? victoryStyle.accent : player.color,
      spiral: victoryStyle && victoryStyle.flourish === 'orbit-sync' ? 0.75 : 0
    });
    if (sfx.stabilizeTone) sfx.stabilizeTone(player.character, !!isBoss);
    return true;
  }

  function triggerFlash(color) {
    flashColor = color;
    flashAlpha = Math.max(flashAlpha, 0.3);
  }

  function spawnExplosion(x, y, count, color, speedMult) {
    NV.spawnExplosion(particles, MAX_PARTICLES, x, y, count, color, speedMult);
  }
  function spawnShockwave(x, y, opts) { NV.spawnShockwave(shockwaves, x, y, opts); }

  // P2: paso de la estela del jugador según trailDensity del visual budget (decorativo).
  function trailStep() {
    if (!NV.getVisualBudget) return 3;
    const d = NV.getVisualBudget().trailDensity;
    return d >= 1 ? 3 : d >= 0.5 ? 6 : 12;
  }


  function skipShop() {
    wave++; // la oleada siguiente "arranca" recién al salir de la tienda
    state = 'playing';
    resetPresentation();
    syncGameState();
    dom.shop.classList.add('hidden');
    NV.resetDashPauseLatch(player, false);
    nextWave();
  }

  function showShop() {
    if (NV.audio && typeof NV.audio.stopAllWeapons === 'function') NV.audio.stopAllWeapons();
    NV.input.setFire(false);
    combatIntent.dashIntent = false;
    consumableBought = {}; // el tope de consumibles es por visita a la tienda
    state = presentation.kind === 'shop_enter' ? 'shop_enter' : 'shop';
    if (NV.clearHazards) NV.clearHazards(hazards, minefieldState); else hazards = [];
    syncGameState();
    dom.shop.setAttribute('aria-hidden', state === 'shop_enter' ? 'true' : 'false');
    invSwapSel = -1;
    updateHUD(); // La habilidad no debe seguir pulsando fuera del combate.
    dom.shop.classList.remove('hidden');
    dom.shopShards.textContent = shards;
    if (dom.shopWave) dom.shopWave.textContent = wave + 1;
    if (dom.shopNextWave) dom.shopNextWave.textContent = wave + 1;
    generateOffers();
    renderInventory();
  }
  // === CONSUMIBLES (se usan con la tecla F en partida) ===
  // Reconcilia la selección tras mutar consumibleItems: 0 tipos -> 0; índice fuera
  // de rango -> wrap al primero. Así HUD y gameplay siempre apuntan al mismo tipo.
  function reconcileConsumSel() {
    const n = NV.groupConsumables(consumableItems).length;
    consumSel = n === 0 ? 0 : (consumSel >= n ? 0 : Math.max(0, consumSel));
  }
  function useConsumable() {
    if (state !== 'playing' || paused || consumableItems.length === 0) return;
    // Usa el TIPO seleccionado (elegido con Q / click en el HUD), no siempre el primero.
    const groups = NV.groupConsumables(consumableItems);
    consumSel = Math.min(consumSel, groups.length - 1);
    const item = NV.consumeByType(consumableItems, groups[consumSel].type);
    if (!item) { reconcileConsumSel(); return; }
    NV.applyConsumable(item, { player, enemies, boss, pickups, weaponPickups, addFloatText, triggerFlash, spawnExplosion, spawnShockwave });
    triggerFlash('#7cf8ff');
    sfx.consume(item.type);
    reconcileConsumSel();
    updateHUD();
    notifyMobileConsumable();
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
    if (dom.characterSelectScreen) dom.characterSelectScreen.classList.add('hidden');
    dom.shop.classList.add('hidden');
    dom.gameOver.classList.add('hidden');
    dom.permScreen.classList.remove('hidden');
    renderPermOffers();
  }
  function closePermShop() {
    dom.permScreen.classList.add('hidden');
    showLobby();
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
          slot.title = weapon.name + ' (equipada)';
        } else {
          slot.title = weapon.name + ' - click para equipar';
        }
        if (invSwapSel === i) {
          slot.style.outline = '2px solid #ffd700';
          slot.title = 'Origen del intercambio (click en otra arma para intercambiar)';
        }

        // Click = seleccionar para intercambiar / equipar
        slot.addEventListener('click', () => {
          if (invSwapSel >= 0 && invSwapSel !== i) {
            const tmp = inventory[invSwapSel];
            inventory[invSwapSel] = inventory[i];
            inventory[i] = tmp;
            invSwapSel = -1;
            sfx.wheelSelect();
            renderInventory();
            return;
          }
          if (weapon === currentWeapon) {
            // Equipada: permitir elegirla como origen de intercambio.
            invSwapSel = (invSwapSel === i) ? -1 : i;
            renderInventory();
            return;
          }
          invSwapSel = -1;
          stopCurrentWeaponAudio();
          currentWeapon = weapon;
          addFloatText(arenaW()/2, arenaH()/2, 'EQUIPADO: ' + weapon.name, RARITY_COLORS[weapon.rarity]);
          renderInventory();
        });

        // Botón vender: da shards según rareza (coherente con la economía; < compra siempre).
        const sellBtn = document.createElement('button');
        sellBtn.className = 'inv-remove';
        sellBtn.textContent = 'SELL';
        sellBtn.title = 'Vender por ' + NV.weaponSellValue(weapon, WEAPON_SELL_PRICES) + ' shards';
        sellBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          // Nunca quedarse sin armas: el engine presupone currentWeapon válido.
          if (inventory.length <= 1) {
            showBanner('NECESITÁS AL MENOS UN ARMA', '#ff5f9b');
            return;
          }
          const val = NV.weaponSellValue(weapon, WEAPON_SELL_PRICES);
          shards += val;
          if (dom.shopShards) dom.shopShards.textContent = shards;
          inventory.splice(i, 1);
          if (currentWeapon === weapon) {
            // Fallback a la siguiente arma válida en el orden visible del loadout.
            stopCurrentWeaponAudio();
            currentWeapon = inventory[Math.min(i, inventory.length - 1)] || inventory[0];
          }
          invSwapSel = -1;
          addFloatText(arenaW() / 2, arenaH() / 2, '+◆ ' + val, '#7cf8ff');
          updateHUD();
          renderInventory();
          sfx.shopSell();
        });
        slot.appendChild(sellBtn);
      } else {
        // Slot vacío: SOLO representación visual de capacidad disponible.
        // Loadout compacto (modelo único): slot visual N == inventory[N-1];
        // no existen huecos internos persistentes ni moves a vacío.
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
      const invFull = !canFuse && inventory.length >= INVENTORY_SLOTS;
      weapons.push({
        kind: 'weapon', name: w.name, weapon: w, rarity: w.rarity,
        desc: canFuse
          ? ('FUSIONAR: +' + Math.round(WEAPON_FUSION_DMG * 100) + '% daño (Nv' + (fus + 1) + '/' + MAX_WEAPON_FUSION + ')')
          : (w.rarity + ' | daño ' + w.damage + ' | ' + (w.pro || '')),
        price: canFuse ? WEAPON_FUSE_PRICE : 25,
        // Inventario lleno: oferta bloqueada (misma regla que los pickups: sin auto-equipar).
        disabled: invFull,
        disabledReason: invFull ? 'INVENTARIO LLENO' : undefined,
        buy: () => {
          if (canFuse) {
            weaponFus[w.id] = fus + 1;
            addFloatText(arenaW() / 2, arenaH() / 2, w.name + ' FUSIONADO → Nv' + (fus + 1), '#ffd700');
            sfx.fuse(fus + 1);
          } else if (inventory.length < INVENTORY_SLOTS) {
            inventory.push(w);
            addFloatText(arenaW()/2, arenaH()/2, '¡' + w.name + '!', RARITY_COLORS[w.rarity]);
            sfx.shopBuy();
          } else {
            // Guardia defensiva: nunca arma fantasma equipada fuera del loadout.
            return false;
          }
          return true;
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
          addFloatText(arenaW()/2, arenaH()/2, item.disabledReason || 'Límite alcanzado', '#ff5f9b');
          return;
        }
        if (shards >= item.price) {
          shards -= item.price;
          const ok = item.buy();
          if (ok === false) {
            // Invariante: una compra inválida NUNCA cobra ni muta estado.
            shards += item.price;
            addFloatText(arenaW()/2, arenaH()/2, item.disabledReason || 'Compra no completada', '#ff5f9b');
            return;
          }
          el.classList.add('just-bought');
          dom.shopShards.textContent = shards;
          setTimeout(() => { generateOffers(); updateHUD(); renderInventory(); }, 180);
          if (!item.weapon) sfx.shopBuy();
        } else {
          addFloatText(arenaW()/2, arenaH()/2, "Fragmentos insuficientes", "#ff5f9b");
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
    if (state === 'player_dying' || state === 'gameover') return false;
    clearCombatIntent();
    state = 'player_dying';
    if (NV.clearHazards) NV.clearHazards(hazards, minefieldState); else hazards = [];
    bullets = [];
    drones = [];
    meteors = [];
    presentation.kind = 'player_dying';
    presentation.elapsed = 0;
    presentation.duration = DEATH_TRANSITION_DURATION;
    presentation.targetX = player.x;
    presentation.targetY = player.y;
    presentation.isBoss = false;
    presentation.pilot = player.character;
    presentation.finalized = false;
    syncGameState();
    shake = Math.max(shake, 0.22);
    triggerFlash(player.color || '#7cf8ff');
    const deathStyle = NV.PILOT_TRANSITIONS && NV.PILOT_TRANSITIONS[player.character];
    if (NV.spawnPlayerDissolve) NV.spawnPlayerDissolve(particles, MAX_PARTICLES, player.x, player.y, player.color, deathStyle ? {
      colors: deathStyle.colors, speed: deathStyle.speed, life: deathStyle.life,
      size: deathStyle.size, spiral: deathStyle.spiral,
      downwardDrift: deathStyle.downwardDrift, originRadius: (CHARACTERS[player.character].size || 18) * 0.8,
      angular: deathStyle.deathMotion === 'angular-fracture'
    } : null);
    if (sfx.deathTone) sfx.deathTone(player.character); else sfx.damage();
    return true;
  }

  function finishPlayerDeath() {
    if (presentation.finalized || state !== 'player_dying') return;
    presentation.finalized = true;
    state = 'gameover';
    syncGameState();
    dom.gameOver.classList.remove('hidden');
    dom.goTitle.textContent = 'FIN';
    dom.goText.textContent = 'Llegaste a la oleada ' + wave;
    dom.goScore.textContent = formatPoints(score);
    dom.goWave.textContent = wave;
    metaShards += Math.floor(shards / 2) + Math.floor(score / 100);
    saveMeta();
  }

  function beginShopEntrance() {
    if (state !== 'wave_end') return;
    state = 'shop_enter';
    presentation.kind = 'shop_enter';
    presentation.elapsed = 0;
    presentation.duration = SHOP_ENTER_DURATION;
    presentation.finalized = false;
    transition = SHOP_ENTER_DURATION;
    particles = [];
    trails = [];
    shockwaves = [];
    floatTexts = [];
    meteors = [];
    specialVFX = null;
    showShop();
  }

  function finishShopEntrance() {
    if (presentation.finalized || state !== 'shop_enter') return;
    presentation.finalized = true;
    state = 'shop';
    transition = 0;
    dom.shop.setAttribute('aria-hidden', 'false');
    syncGameState();
  }

  function updatePresentation(dt) {
    frame++;
    presentation.elapsed = Math.min(presentation.duration, presentation.elapsed + dt);
    transition = Math.max(0, presentation.duration - presentation.elapsed);
    if (shake > 0) shake = Math.max(0, shake - dt * 1.8);
    if (flashAlpha > 0) flashAlpha = Math.max(0, flashAlpha - dt);
    if (player.invuln > 0) player.invuln = Math.max(0, player.invuln - dt);
    if (specialVFX) {
      specialVFX.life -= dt;
      if (specialVFX.life <= 0) specialVFX = null;
    }
    updateParticles(dt);
    updateFloatTexts(dt);
    updateTrails(dt);
    shockwaves = NV.updateShockwaves(dt, shockwaves);

    if (state === 'wave_end') {
      NV.updatePlayerMovement(player, combatIntent.moveX, combatIntent.moveY, dt);
      player.x = Math.max(20, Math.min(arenaW() - 20, player.x));
      player.y = Math.max(30, Math.min(arenaH() - 20, player.y));
      presentation.targetX = player.x;
      presentation.targetY = player.y;
      updatePickups(dt);
      updateWeaponPickups(dt);
      updateBossChests(dt);
      const meteorResult = NV.updateMeteors(dt, meteors, {
        W: arenaW(), H: arenaH(), enemies: [], boss: null, shake, visualOnly: true,
      }, { killEnemy() {}, applyKnockback() {}, spawnExplosion() {} });
      meteors = meteorResult.meteors;
      if (presentation.elapsed >= presentation.duration) beginShopEntrance();
    } else if (state === 'player_dying') {
      if (presentation.elapsed >= presentation.duration) finishPlayerDeath();
    } else if (state === 'shop_enter') {
      if (presentation.elapsed >= presentation.duration) finishShopEntrance();
    }
  }

  // === UPDATE ===
  function update(dt) {
    if (paused) return;
    if (state === 'player_dying' || state === 'wave_end' || state === 'shop_enter') {
      updatePresentation(dt);
      return;
    }
    if (state !== 'playing') return;
    if (NV.SPECTER_ENABLED === false) {
      enemies = enemies.filter((e) => e.shape !== 'specter');
    }
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

    const dashing = NV.updatePlayerDash(
      player, combatIntent.dashIntent,
      combatIntent.moveX, combatIntent.moveY,
      combatIntent.aimX, combatIntent.aimY, combatIntent.aimActive,
      dt
    );
    if (!dashing) NV.updatePlayerMovement(player, combatIntent.moveX, combatIntent.moveY, dt);
    player.x = Math.max(20, Math.min(arenaW() - 20, player.x));
    player.y = Math.max(30, Math.min(arenaH() - 20, player.y));
    // El cursor vive en mundo: si el jugador se mueve, recalcular la dirección
    // sin exigir otro mousemove mantiene aim y movimiento realmente independientes.
    if (combatIntent.aimActive) {
      NV.inputIntent.setAimWorld(combatIntent, combatIntent.aimWorldX, combatIntent.aimWorldY, player.x, player.y);
    }
    momentumVisual.shift = dashing;

    // Estela del jugador: densidad decorativa adaptable (visual budget P2).
    if (frame % trailStep() === 0) {
      const char = CHARACTERS[player.character];
      trails.push({ x: player.x, y: player.y, life: 0.3, color: player.color, size: char.size * 0.6 });
    }
    // Polvo de propulsión durante el dash: chispas hacia atrás del movimiento.
    if (dashing && frame % 2 === 0) {
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
      if (player.overdrive <= 0) { player.overdrive = 0; triggerFlash('#caa7ff'); }
    }
    if (player.bounty > 0) { player.bounty -= dt; if (player.bounty <= 0) player.bounty = 0; }
    NV.comboTick(killCombo, dt);
    NV.musicState.combo = killCombo.count;
    if (player.specialCd > 0) player.specialCd -= dt;

    const firePolicy = NV.input.getEffectiveFirePolicy();
    const fireActive = firePolicy === 'legacy-auto' || combatIntent.fireIntent;
    if (currentAutoTarget && (currentAutoTarget.dead || Math.hypot(currentAutoTarget.x - player.x, currentAutoTarget.y - player.y) > (currentWeapon.range || Infinity))) currentAutoTarget = null;
    const cadence = NV.inputIntent.advanceFireCadence(
      fireTimer, dt, fireActive, hitstop > 0,
      () => playerBulletCount() < MAX_PLAYER_BULLETS ? shoot(firePolicy) : false,
      weaponFireInterval(), MIN_FIRE_INTERVAL
    );
    fireTimer = cadence.timer;

    if (combatIntent.abilityIntent && player.specialCd <= 0) useSpecial();

    // Spawns y progreso de oleada SOLO fuera de la transición de victoria: durante la
    // celebración no arranca la oleada siguiente (nada de spawns ni countdown visible).
    if (transition <= 0) {
        spawnTimer -= dt;
    if (spawnTimer <= 0) {
      // Densidad progresiva garantizada: cada oleada empieza con presión
      // real (mínimo 2 enemigos por lote) para evitar "victorias sin combate".
      const perWave = 2 + Math.min(6, Math.floor(wave / 2));
      const budget = NV.getHostileBudget({ enemies, boss, MAX_HOSTILES, MAX_HEAVY_HOSTILES });
      if (budget.remainingHostiles > 0) {
        const normalAttempts = Math.min(perWave, budget.remainingHostiles);
        for (let i = 0; i < normalAttempts; i++) spawnEnemy();
        spawnElite();
      }
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
    updateHazards(dt);
    if (state !== 'playing') return;
    updateEnemies(dt);
    if (state !== 'playing') return;
    updateBoss(dt);
    if (state !== 'playing') return;
    updateBullets(dt);
    if (state !== 'playing') return;
    // La muerte resuelta por hazards/enemigos/proyectiles tiene prioridad sobre el
    // fin de oleada cuando ambos eventos caen en el mismo frame.
    if (transition <= 0 && waveTimer <= 0 && !boss) {
      if (player.hp <= 0) { gameOver(); return; }
      shards += 8 + wave * 2;
      triggerWaveVictory(false, null, null);
      return;
    }
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
          e.hitFlash = Math.max(e.hitFlash || 0, 0.10);
          e.phaseAcc = (e.phaseAcc || 0) + DPS * dt; // acumulado para la Detonación Espectral
          if (e.hp <= 0) killEnemy(e);
        }
      }
      if (boss && !boss.dead && Math.hypot(boss.x - player.x, boss.y - player.y) < R + 40) {
        boss.hp -= DPS * NV.BALANCE.PHASE_AURA_BOSS_MULT * dt;
        boss.hitFlash = Math.max(boss.hitFlash || 0, 0.10);
        boss.phaseAcc = (boss.phaseAcc || 0) + DPS * dt; // sin mult: la detonación ya aplica el suyo
      }
    }

    updateHUD();
  }

  function shoot(firePolicy) {
    const fireInterval = weaponFireInterval();
    const res = NV.shoot({
      player, enemies, boss, bullets, currentWeapon,
      currentWeaponLevel, weaponVisualTier, BULLET_TIER_COLORS, MAX_BULLETS,
      permDamageBonus: permUpgrades.damage, playWeaponSound,
      audioPosition: { x: player.x, worldWidth: arenaW() },
      fireInterval,
      aimVector: firePolicy === 'manual' ? { x: combatIntent.aimX, y: combatIntent.aimY } : null,
      currentWeaponFusion: currentWeaponFusion(), fusionStep: WEAPON_FUSION_DMG,
      onTarget: (target) => { currentAutoTarget = target; },
    });
    // Telemetría opt-in F08: solo dispara reales (NV.shoot devuelve false fuera de rango).
    if (res && NV.playtest) { NV.playtest.shot(); NV.playtest.setFireMode(firePolicy); }
    return res;
  }

  function applyKnockback(e, bx, by, strength) {
    return NV.applyKnockback(e, bx, by, strength);
  }

  function useSpecial() {
    const res = NV.useSpecial({
      player, CHARACTERS, meteors, particles, drones, W: arenaW(), H: arenaH(), shake, specialVFX,
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
    NV.detonatePhase(player, enemies, boss, shockwaves, { addFloatText, spawnExplosion, triggerFlash, killEnemy });
  }

  function updateMeteors(dt) {
    const res = NV.updateMeteors(dt, meteors, { W: arenaW(), H: arenaH(), enemies, boss, shake }, { killEnemy, applyKnockback, spawnExplosion });
    meteors = res.meteors;
    shake = res.shake;
  }

  function updateHazards(dt) {
    if (!NV.updateSpeakerMines) return;
    const char = CHARACTERS[player.character];
    const playerRadius = ((char && char.size) || 20) * 0.45;
    const res = NV.updateSpeakerMines(dt, hazards, minefieldState, {
      waveEvent, wave, boss, transitioning: transition > 0,
      player, playerRadius, W: arenaW(), H: arenaH(), rhythm: NV.rhythm,
      // P3.1: notas musicales + política visual en tiempo real.
      musicalNotes: NV.MUSICAL_NOTES,
      visualPolicy: NV.getVisualBudget ? NV.getVisualBudget() : null,
      spawnMusicalNotes: (x, y, o) => NV.spawnMusicalNotes(x, y, Object.assign({}, o, { notes: NV.MUSICAL_NOTES })),
      clearMusicalNotes: () => { NV.clearMusicalNotes(); },
      applyPlayerDamage, spawnExplosion, spawnShockwave, triggerFlash, sfx, shake,
      onPlayerKilled: () => { if (state === 'playing') gameOver(); },
    });
    hazards = res.hazards; minefieldState = res.state; shake = res.shake;
  }

  function spawnEnemy() {
    NV.spawnEnemy({ enemies, boss, MAX_HOSTILES, MAX_HEAVY_HOSTILES, wave, ENEMY_TYPES, W: arenaW(), H: arenaH(), waveEvent, forceTypeId: forceSpecterType });
  }

  function spawnElite() {
    NV.spawnElite({ enemies, boss, MAX_HOSTILES, MAX_HEAVY_HOSTILES, wave, ELITE_TYPES, W: arenaW(), H: arenaH(), waveEvent });
  }

  function spawnWeaponPickup() {
    NV.spawnWeaponPickup(WEAPONS, weaponPickups, arenaW(), arenaH(), showBanner, RARITY_COLORS);
  }

  function killEnemy(e) {
    if (e.killResolved) return;
    score = NV.killEnemy({
      e, score, player, weaponLevels, weaponKills, currentWeapon,
      WEAPON_KILLS_PER_LEVEL, addFloatText, spawnExplosion, triggerFlash, sfx, pickups, weaponKillProgress,
      waveEvent, applyPlayerDamage, onPlayerKilled: () => { if (state === 'playing') gameOver(); }, W: arenaW(),
    });
    // Combo de kills: bonus escalable por encadenar derribos (<2s entre ellos).
    const cb = NV.comboOnKill(killCombo);
    score += cb.bonusScore;
    if (cb.gemBonus) shards += cb.gemBonus;
    if (cb.count >= 3) sfx.combo(cb.count);
    // Sin texto flotante de combo sobre los enemigos: el contador ya vive en el
    // HUD (esquina superior izquierda) con su barra de caducidad.
  }

  function updateEnemies(dt) {
    const res = NV.updateEnemies(dt, {
      enemies, player, bullets, MAX_BULLETS, MAX_ENEMY_BULLETS, shake,
      enemyBulletCount, applyPlayerDamage, addFloatText, spawnExplosion, waveEvent,
      onKill: (e) => killEnemy(e), // autodestrucción de kamikazes: mismo camino que un kill normal
      onPlayerDamaged: recordPlayerDamage,
    });
    enemies = res.enemies; shake = res.shake;
    // Telemetría opt-in F08: muestreo agregado de intents Runner/Spitter (sin mutar entidades).
    if (NV.playtest && NV.playtest.enabled) {
      NV.playtest.frame();
      for (const e of enemies) NV.playtest.observeEnemy(e, dt);
    }
    if (res.gameOver) { gameOver(); return; }
  }

  function updateBoss(dt) {
    const res = NV.updateBoss(dt, {
      boss, player, enemies, bullets, W: arenaW(), H: arenaH(),
      score, shards, wave, shake,
      MAX_BULLETS, MAX_ENEMY_BULLETS, enemyBulletCount, ENEMY_TYPES, MAX_HOSTILES, MAX_HEAVY_HOSTILES,
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

  function applyPlayerDamage(base, opts) {
    opts = opts || {};
    const event = {};
    if (opts.enemy) event.enemy = opts.enemy;
    if (opts.projectile) event.projectile = opts.projectile;
    if (opts.hazard) event.hazard = opts.hazard;
    const r = NV.applyPlayerDamage(base, {
      player, CHARACTERS, calcEnemyDamage, addFloatText, sfx,
      cause: opts.cause, allowCrit: opts.allowCrit, allowDodge: opts.allowDodge,
      respectInvulnerability: opts.respectInvulnerability,
      onPlayerDamaged: recordPlayerDamage, event,
    });
    if (r.applied) { killCombo.count = 0; killCombo.timer = 0; }
    return r;
  }

  // === PROYECTILES Y ATAQUES DISTINTOS POR JEFE ===
  function spawnBossProj(b, speed, damage, count, spread, color, radius) {
    return NV.spawnBossProj(b, speed, damage, count, spread, color, radius, { player, bullets, MAX_BULLETS, enemyBulletCount, MAX_ENEMY_BULLETS });
  }

  // Esbirros invocados (funciona incluso durante la pelea con un jefe)
  function spawnMinion(x, y) {
    return NV.spawnMinion(x, y, { enemies, boss, wave, ENEMY_TYPES, MAX_HOSTILES, MAX_HEAVY_HOSTILES });
  }

  function runBossAttack(b, dt) {
    return NV.runBossAttack(b, dt, {
      player, enemies, bullets, sfx, triggerFlash, addFloatText,
      boss, MAX_HOSTILES, MAX_HEAVY_HOSTILES, MAX_BULLETS, MAX_ENEMY_BULLETS, enemyBulletCount,
      spawnBossProj, spawnMinion,
    });
  }

  function updateBullets(dt) {
    const res = NV.updateBullets(dt, {
      bullets, W: arenaW(), H: arenaH(), player, enemies, boss, shake, hitstop,
      MAX_BULLETS, CHARACTERS, SHIELD_COOLDOWN,
      applyPlayerDamage, addFloatText, killEnemy, applyKnockback, spawnExplosion,
      sfx, onPlayerDamaged: recordPlayerDamage,
    });
    bullets = res.bullets; shake = res.shake; hitstop = res.hitstop;
    if (res.gameOver) { gameOver(); return; }
  }

  function recordPlayerDamage(hit) {
    const e = hit.enemy || (hit.projectile && hit.projectile.sourceEnemy) || null;
    const hazard = hit.hazard || null;
    let sourceX = e ? e.x : (hazard ? hazard.x : player.x), sourceY = e ? e.y : (hazard ? hazard.y : player.y);
    if (!e && hit.projectile) {
      const projectileSpeed = Math.max(1, Math.hypot(hit.projectile.vx || 0, hit.projectile.vy || 0));
      sourceX = player.x - (hit.projectile.vx || 0) / projectileSpeed * 40;
      sourceY = player.y - (hit.projectile.vy || 0) / projectileSpeed * 40;
    }
    damageFeedback = { life: 0.55, sourceX, sourceY, critical: !!hit.crit, cause: hit.cause, flash: 0.05 };
    invulnerabilityFeedback = { life: 0.5, duration: 0.5, kind: 'start' };
    if (!NV.META_DEBUG || !NV.recordMetaDamage) return;
    let within50 = 0, within100 = 0, within170 = 0, aliveEnemies = 0, overlap = 0;
    for (const enemy of enemies) {
      if (enemy.dead) continue;
      aliveEnemies++;
      const d = Math.hypot(enemy.x - player.x, enemy.y - player.y);
      if (d <= 50) within50++;
      if (d <= 100) {
        within100++;
        const density = densityField && densityField.info.get(enemy);
        if (density) overlap += density.overlap;
      }
      if (d <= 170) within170++;
    }
    NV.recordMetaDamage({
      cause: hit.cause, enemy: e, hazard,
      enemyType: (hit.projectile && hit.projectile.sourceType) || (e && (e.enemyTypeId || e.behavior || e.shape)) || (hazard && hazard.type),
      hpBefore: hit.hpBefore, hpAfter: hit.hpAfter, critical: !!hit.crit, wave,
      playerX: player.x, playerY: player.y,
      speed: Math.hypot(player.moveVx || 0, player.moveVy || 0),
      moveVx: player.moveVx || 0, moveVy: player.moveVy || 0,
      shift: !!combatIntent.dashIntent, invulnerability: player.invuln || 0,
      within50, within100, within170, nearbyDensity: within100,
      overlap, aliveEnemies, autofireTarget: currentAutoTarget,
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
      shift: !!combatIntent.dashIntent, invulnerability: player.invuln || 0,
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
    if (currentWeapon !== r.currentWeapon) {
      stopCurrentWeaponAudio();
      currentWeapon = r.currentWeapon;
    }
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
    notifyMobileSpecial();

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
    // P2: política visual runtime (solo decorativa; sin visualBudget => todo full).
    const vbp = NV.getVisualBudget ? NV.getVisualBudget() : null;
    const heavyShadowOk = vbp ? vbp.heavyShadow : true;
    const meteorTrailAlpha = vbp ? Math.max(0, Math.min(1, vbp.trailDensity)) * 0.4 : 0.4;
    const vw = viewW(), vh = viewH(), vx = viewX(), vy = viewY();
    const cinematic = cinematicView(vx, vy, vw, vh);
    const worldScaleX = scaleX * cinematic.zoom;
    const worldScaleY = scaleY * cinematic.zoom;
    const worldOffsetX = scaleX * (vw / 2 - cinematic.centerX * cinematic.zoom);
    const worldOffsetY = scaleY * (vh / 2 - cinematic.centerY * cinematic.zoom);
    const cameraW = vw / cinematic.zoom;
    const cameraH = vh / cinematic.zoom;
    const cameraLeft = cinematic.centerX - cameraW / 2;
    const cameraTop = cinematic.centerY - cameraH / 2;
    ctx.setTransform(worldScaleX, 0, 0, worldScaleY, worldOffsetX, worldOffsetY);

    // META-VIS: contexto compartido de render (t, saturación, urgencia, gain).
    const hostileBudget = NV.getHostileBudget({ enemies, boss, MAX_HOSTILES, MAX_HEAVY_HOSTILES });
    const hostileSaturation = Math.min(1, hostileBudget.hostiles / hostileBudget.maxHostiles);
    const metaRenderEnv = {
      t: (typeof performance !== 'undefined' && typeof performance.now === 'function') ? performance.now() / 1000 : frame / 60,
      saturation: hostileSaturation,
      urgency: (player.hp > 0 && player.hp / player.maxHp <= 0.3) ? 1 : 0,
      gain: 1,
    };
    prepareDensityReadability();

    // Fondo galaxia más oscuro: mejora el contraste de los visuales rítmicos
    // sin aclarar el campo donde se leen enemigos, balas y HUD.
    ctx.fillStyle = '#01030d';
    ctx.fillRect(cameraLeft, cameraTop, cameraW, cameraH);
    ctx.save();
    ctx.translate(cameraLeft, cameraTop);
    NV.drawStarfield(ctx, cameraW, cameraH, frame, player.x - cameraLeft, player.y - cameraTop, NV.rhythm);
    if (NV.drawRhythmLayer) {
      // P2: capa rítmica de fondo es decorativa — se throttlea por tier.
      const rbDetail = vbp ? vbp.rhythmBackgroundDetail : 1;
      const rbStep = rbDetail >= 1 ? 1 : rbDetail >= 0.5 ? 2 : 4;
      if (frame % rbStep === 0) NV.drawRhythmLayer(ctx, cameraW, cameraH, frame);
    }
    ctx.restore();

    if (flashAlpha > 0 && flashColor) {
      ctx.fillStyle = flashColor;
      ctx.globalAlpha = flashAlpha;
      ctx.fillRect(cameraLeft, cameraTop, cameraW, cameraH);
      ctx.globalAlpha = 1;
    }

    const gridAlpha = 0.03 + Math.sin(frame * 0.02) * 0.005;
    ctx.strokeStyle = `rgba(124, 248, 255, ${gridAlpha})`;
    ctx.lineWidth = 0.5;
    const gridStartX = Math.floor(cameraLeft / 40) * 40;
    const gridEndX = cameraLeft + cameraW;
    const gridStartY = Math.floor(cameraTop / 40) * 40;
    const gridEndY = cameraTop + cameraH;
    for (let x = gridStartX; x < gridEndX; x += 40) { ctx.beginPath(); ctx.moveTo(x, cameraTop); ctx.lineTo(x, cameraTop + cameraH); ctx.stroke(); }
    for (let y = gridStartY; y < gridEndY; y += 40) { ctx.beginPath(); ctx.moveTo(cameraLeft, y); ctx.lineTo(cameraLeft + cameraW, y); ctx.stroke(); }

    // META-VIS-02b: neblina de densidad (capa 1, bajo entidades). Contexto
    // compartido de render: t, saturación por cantidad viva, urgencia por HP.
    if (NV.drawDensityFog && densityField) {
      NV.drawDensityFog(ctx, enemies, densityField.info, {
        t: performance.now() / 1000,
        saturation: hostileSaturation,
        urgency: (player.hp > 0 && player.hp / player.maxHp <= 0.3) ? 1 : 0,
      });
    }

    // Barra de progreso de oleada — con contador de enemigos vivos y élites
    if (showHUD && state === 'playing' && !boss) {
            const maxWaveTimer = NV.waveDuration(wave, waveEvent);
      const progress = Math.max(0, Math.min(1, 1 - (waveTimer / maxWaveTimer)));
      const barW = 200, barH = 6;
      const barX = (arenaW() - barW) / 2, barY = 10;

      // --- Contar enemigos vivos por categoría (Pilar 3 HUD) ---
      let alive = 0, elites = 0;
      for (let i = 0; i < enemies.length; i++) {
        const en = enemies[i];
        if (en.dead) continue;
        alive++;
        if (en.isElite || en.shape === 'specter' || en.enemyTypeId === 'specter_lite') elites++;
      }

      // --- Fondo de la barra ---
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(barX, barY, barW, barH);

      // --- Barra de progreso con degradado (Pilar 3: progreso oleada) ---
      const grad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
      grad.addColorStop(0, '#4a90d9');    // azul inicio
      grad.addColorStop(0.5, '#b534e6');  // púrpura centro
      grad.addColorStop(1, '#e94850');    // rojo final
      ctx.fillStyle = grad;
      ctx.fillRect(barX, barY, barW * progress, barH);

      // --- Borde de la barra ---
      ctx.strokeStyle = 'rgba(124,248,255,0.3)';
      ctx.lineWidth = 1;
      ctx.strokeRect(barX, barY, barW, barH);

      // --- Texto de la oleada centrado y contador apilado en upper-left ---
      ctx.fillStyle = '#7cf8ff';
      ctx.font = 'bold 10px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('OLEADA ' + wave, arenaW() / 2, barY + 16);
      // Contador de enemigos vivos + élites
      const countText = 'ENEMIGOS: ' + alive + ' (' + elites + ')';
      const mobilePresentation = !!(NV.capabilities && NV.capabilities.isMobile);
      ctx.fillStyle = '#9bb0ff';
      ctx.font = 'bold 9px system-ui';
      ctx.textAlign = 'left';
      ctx.fillText(countText, viewX() + 12, viewY() + (mobilePresentation ? 58 : 43));
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
      // P2: glow del dron es decorativo; el cuerpo y su silueta siempre se dibujan.
      if (heavyShadowOk) { ctx.shadowBlur = 10; ctx.shadowColor = d.color; }
      ctx.beginPath(); ctx.arc(player.x + dx, player.y + dy, 5, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Meteoritos (el count de gameplay NUNCA cambia: solo trail/glow decorativos)
    for (const m of meteors) {
      ctx.fillStyle = m.color;
      if (heavyShadowOk) { ctx.shadowBlur = 15; ctx.shadowColor = m.color; }
      ctx.beginPath(); ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      // Estela
      ctx.globalAlpha = meteorTrailAlpha;
      ctx.fillStyle = m.color;
      ctx.fillRect(m.x - 2, m.y - m.radius * 2, 4, m.radius * 2);
      ctx.globalAlpha = 1;
    }

    // Legibilidad del golpe: dibujar PRIMERO a los no-atacantes y DESPUÉS a los
    // atacantes (atkFlash activo) => el enemigo que golpea queda por encima
    // visualmente y no es tapado por los superpuestos. Solo orden de dibujo.
    if (NV.prepareEnemyVisualBudget) NV.prepareEnemyVisualBudget(enemies, player);
    for (const e of enemies) if (!(e.atkFlash > 0)) drawEnemy(e);
    for (const e of enemies) if (e.atkFlash > 0) drawEnemy(e);
    const autoTargetInRange = currentAutoTarget ? (Math.hypot(currentAutoTarget.x - player.x, currentAutoTarget.y - player.y) <= (currentWeapon.range || Infinity)) : false;
    if (NV.drawAutofireTarget) NV.drawAutofireTarget(ctx, currentAutoTarget, frame, player, autoTargetInRange, NV.META_DEBUG, metaRenderEnv);
    for (const e of enemies) if (NV.drawContactReadability) NV.drawContactReadability(ctx, e, player, NV.META_DEBUG, metaRenderEnv);
    for (const e of enemies) if (NV.drawEnemyIntent) NV.drawEnemyIntent(ctx, e, player, metaRenderEnv);
    if (boss && !boss.dead) drawBoss();

    // Partículas decorativas quedan detrás de hazards/proyectiles: un telegraph
    // peligroso nunca debe desaparecer bajo VFX pesado.
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / (p.fade || 0.5));
      ctx.fillStyle = p.color;
      const psz = p.size || 4;
      ctx.fillRect(p.x - psz / 2, p.y - psz / 2, psz, psz);
    }
    ctx.globalAlpha = 1;

    // Hazards sobre partículas y debajo de proyectiles: las minas conservan
    // warning/telegraph legibles y las balas enemigas siguen siendo prioritarias.
    if (NV.drawHazards) NV.drawHazards(ctx, hazards, NV.rhythm, vbp, !!NV.META_DEBUG, NV.MUSICAL_NOTES, minefieldState.groove);

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

    for (const ft of floatTexts) {
      ctx.globalAlpha = Math.max(0, ft.life / 0.8);
      ctx.fillStyle = ft.color;
      ctx.font = 'bold ' + (ft.size || 14) + 'px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.globalAlpha = 1;

    if (NV.drawMomentumReadability && state !== 'player_dying' && state !== 'gameover') NV.drawMomentumReadability(ctx, player, momentumVisual, metaRenderEnv);
    if (state !== 'gameover' && !(state === 'player_dying' && presentationProgress() >= 0.66)) drawPlayer();
    // Retícula Canvas barata: geometría fija, sin glow, partículas ni DOM por frame.
    if (state === 'playing' && !paused && NV.input.getEffectiveFirePolicy() === 'manual' && combatIntent.aimActive) {
      const ax = combatIntent.aimWorldX, ay = combatIntent.aimWorldY;
      ctx.save();
      ctx.strokeStyle = 'rgba(124, 248, 255, 0.9)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(ax, ay, 7, 0, Math.PI * 2);
      ctx.moveTo(ax - 11, ay); ctx.lineTo(ax - 4, ay);
      ctx.moveTo(ax + 4, ay); ctx.lineTo(ax + 11, ay);
      ctx.moveTo(ax, ay - 11); ctx.lineTo(ax, ay - 4);
      ctx.moveTo(ax, ay + 4); ctx.lineTo(ax, ay + 11);
      ctx.stroke();
      ctx.restore();
    }
    if (NV.drawDamageFeedback) NV.drawDamageFeedback(ctx, player, damageFeedback, metaRenderEnv);
    if (NV.drawInvulnerabilityFeedback) NV.drawInvulnerabilityFeedback(ctx, player, invulnerabilityFeedback, metaRenderEnv);
    // Evento NEBLINA: velo oscuro con viñeta que reduce la visibilidad periférica.
    if (waveEvent === 'fog' && state === 'playing') {
      ctx.save();
      ctx.fillStyle = 'rgba(8, 10, 22, 0.35)';
      ctx.fillRect(0, 0, arenaW(), arenaH());
      const rx = arenaW() * 0.3, ry = arenaH() * 0.35; // elipse clara centrada en el jugador
      const g = ctx.createRadialGradient(player.x, player.y, Math.min(rx, ry) * 0.4, player.x, player.y, Math.max(arenaW(), arenaH()) * 0.75);
      g.addColorStop(0, 'rgba(8, 10, 22, 0)');
      g.addColorStop(1, 'rgba(8, 10, 22, 0.85)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, arenaW(), arenaH());
      ctx.restore();
    }

    ctx.setTransform(scaleX, 0, 0, scaleY, -vx * scaleX, -vy * scaleY);

    if (state === 'player_dying' || state === 'wave_end' || state === 'shop_enter') {
      const progress = presentationProgress();
      const dimStart = state === 'player_dying' ? 0.62 : 0.72;
      const dim = Math.max(0, Math.min(1, (progress - dimStart) / (1 - dimStart)));
      ctx.save();
      ctx.fillStyle = state === 'player_dying'
        ? 'rgba(2, 4, 12, ' + (dim * 0.58).toFixed(3) + ')'
        : 'rgba(2, 5, 14, ' + (dim * 0.34).toFixed(3) + ')';
      ctx.fillRect(vx, vy, vw, vh);
      ctx.restore();
    }

    if (showHUD && (state === 'playing' || state === 'wave_end')) {
      drawSpecialCooldown();
      const mobilePresentation = !!(NV.capabilities && NV.capabilities.isMobile);
      NV.drawCombo(ctx, arenaW(), arenaH(), killCombo, mobilePresentation ? { x: viewX() + 12, y: viewY() + 83 } : null);
      NV.drawDashStamina(ctx, viewX(), viewY(), viewW(), viewH(), player, mobilePresentation);
      if (!mobilePresentation) drawWeaponHUD();
      else NV.consumSlotRects = [];
    }

    if (showStats) drawStats();

    // Pantalla de pausa (tecla P)
    if (paused) {
      ctx.fillStyle = 'rgba(5, 7, 20, 0.68)';
      ctx.fillRect(0, 0, arenaW(), arenaH());
      ctx.textAlign = 'center';
      ctx.fillStyle = '#7cf8ff';
      ctx.shadowBlur = 30; ctx.shadowColor = '#7cf8ff';
      ctx.font = 'bold 56px system-ui';
      ctx.fillText('⏸ PAUSA', arenaW() / 2, arenaH() / 2 - 20);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#aaa';
      ctx.font = '18px system-ui';
      ctx.fillText('Pulsa P para continuar', arenaW() / 2, arenaH() / 2 + 24);
      ctx.fillStyle = '#666';
      ctx.font = '12px system-ui';
      ctx.fillText('Oleada ' + wave + ' · Puntos ' + score, arenaW() / 2, arenaH() / 2 + 54);
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    momentumVisual.previousVx = player.moveVx || 0;
    momentumVisual.previousVy = player.moveVy || 0;
    momentumVisual.previousSpeed = Math.hypot(momentumVisual.previousVx, momentumVisual.previousVy);
  }

  function drawSpecialVFX(vfx) {
    NV.drawSpecialVFX(ctx, vfx);
  }



  // F09.4: anillo/contorno de cooldown alrededor del jugador ELIMINADO.
  // Era redundante: la disponibilidad de la habilidad ya se comunica con
  // (1) el indicador DOM del header (.special-cooldown/#specialFill) y
  // (2) el slot de habilidad del panel canvas (drawWeaponHUD).
  // Se conserva este stub como no-op para no romper llamadas externas.
  function drawSpecialCooldown() { return; }



  function drawWeaponHUD() {
    // Resolvedor de nivel por arma: cada slot muestra SU nivel (badge + tinte).
    const weaponLevelFor = (id) => weaponLevels[id] || 1;
    NV.drawWeaponHUD(ctx, arenaW(), arenaH(), CHARACTERS, RARITY_COLORS, player, currentWeapon, currentWeaponLevel, inventory, NV.groupConsumables(consumableItems), consumSel, showHUD, weaponLevelFor);
  }



  function drawStats() {
    NV.drawStats(ctx, CHARACTERS, RARITY_COLORS, player, currentWeapon, currentWeaponLevel, weaponVisualTier, BULLET_TIER_COLORS, permUpgrades, inventory, INVENTORY_SLOTS, consumableItems);
  }



  function drawEnemy(e) {
    // Solo ocultar Canvas2D cuando el mesh WebGL de ESTE enemigo ya existe.
    // Durante carga, fallo o flag apagado, el render original sigue intacto.
    if ((NV.SPECTER_ENABLED === false && e.shape === 'specter') || isEnemyRenderedByLite(e)) return;
    // Modo espectral: delega a drawSpectralEnemy2D (retorna false para specters, que ya se excluyeron).
    if (NV.SPECTRAL_ENEMY_MODE && typeof NV.drawSpectralEnemy2D === 'function') {
      NV.drawSpectralEnemy2D(ctx, e, frame, player, NV.rhythm);
      return;
    }
    NV.drawEnemy(ctx, e, frame, player, NV.rhythm);
  }



  function drawBoss() {
    if (NV.SPECTRAL_ENEMY_MODE && typeof NV.drawSpectralBoss2D === 'function') {
      NV.drawSpectralBoss2D(ctx, boss, frame, player, NV.rhythm);
      return;
    }
    NV.drawBoss(ctx, boss, frame);
  }


  function drawPlayer() {
    NV.drawPlayer(ctx, player, CHARACTERS, frame, playerPresentationStyle());
  }

  // === LOBBY PREVIEW: render real del personaje seleccionado en el lobby ===
  // Reutiliza NV.drawPlayer con un estado limpio de presentación. El renderer
  // canónico ya contiene respiración, bobbing y movimiento específico por piloto.
  let lobbyPreviewCanvas = null, lobbyPreviewCtx = null;
  function getLobbyPreviewCanvas() {
    if (lobbyPreviewCanvas) return lobbyPreviewCanvas;
    lobbyPreviewCanvas = document.getElementById('lobbyPreview');
    if (lobbyPreviewCanvas) lobbyPreviewCtx = lobbyPreviewCanvas.getContext('2d');
    return lobbyPreviewCanvas;
  }
  function resizeLobbyPreview() {
    const c = getLobbyPreviewCanvas();
    if (!c) return;
    const rect = c.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const dpr = (NV.viewport && typeof NV.viewport.getEffectiveDpr === 'function')
      ? NV.viewport.getEffectiveDpr() : 1;
    const bw = Math.round(rect.width * dpr), bh = Math.round(rect.height * dpr);
    if (c.width !== bw || c.height !== bh) { c.width = bw; c.height = bh; }
  }
  function isLobbyPreviewActive() {
    const root = document.documentElement;
    const settingsOpen = root && root.getAttribute && root.getAttribute('data-settings-open') === 'true';
    return state === 'menu' && !settingsOpen && dom.startScreen && !dom.startScreen.classList.contains('hidden');
  }
  function lobbyPreviewPlayer() {
    return Object.assign({}, player, {
      x: 0,
      y: 0,
      hp: Math.max(1, player.maxHp || 1),
      maxHp: Math.max(1, player.maxHp || 1),
      // F09.4: el preview nunca muestra contorno de cooldown (ya eliminado
      // globalmente); se fija estado limpio de presentación.
      specialCd: 0,
      invuln: 0,
      stun: 0,
      phase: 0,
      bulwark: 0,
      shield: 0,
      overdrive: 0,
    });
  }
  function lobbyPreviewVisualRadius(char, characterId) {
    const base = char.size || 20;
    return base * (characterId === 'swarm' ? 2.65 : 1.65) + 12;
  }
  function drawLobbyPreview() {
    if (!isLobbyPreviewActive()) return;
    const c = getLobbyPreviewCanvas();
    if (!c || !lobbyPreviewCtx) return;
    const char = CHARACTERS[player.character];
    if (!char) return;
    resizeLobbyPreview();
    const w = c.width, h = c.height;
    lobbyPreviewCtx.setTransform(1, 0, 0, 1, 0, 0);
    lobbyPreviewCtx.clearRect(0, 0, w, h);
    const safeWidth = Math.max(1, w * 0.82);
    const safeHeight = Math.max(1, h * 0.78);
    const radius = lobbyPreviewVisualRadius(char, player.character);
    const scale = Math.max(1, Math.min(4.25, safeWidth / (radius * 2), safeHeight / (radius * 2)));
    const previewPlayer = lobbyPreviewPlayer();
    lobbyPreviewCtx.save();
    lobbyPreviewCtx.translate(w / 2, h / 2);
    lobbyPreviewCtx.scale(scale, scale);
    NV.drawPlayer(lobbyPreviewCtx, previewPlayer, CHARACTERS, frame);
    lobbyPreviewCtx.restore();
  }


  // === LOOP ===
  // P2: instrumentación del loop. frameMs = intervalo real entre rAF;
  // updateMs/drawMs = coste de cada fase. El monitor SOLO observa.
  let perfPrevNow = 0, vbEvalTimer = 0;
  function loop(now) {
    if (!lastTime) lastTime = now;
    perfPrevNow = lastTime;
    let dt = Math.min(0.03, (now - lastTime) / 1000);
    lastTime = now;

    if (NV.audio && typeof NV.audio.update === 'function') {
      NV.audio.update({ state, paused, hidden: !!document.hidden });
    }

    if (hitstop > 0) { hitstop = Math.max(0, hitstop - dt); dt = 0; }
    if (NV.rhythmTick) {
      const rhythmNow = now / 1000;
      NV.rhythmTick(rhythmNow);
      if (NV.rhythmShakeBoost) shake = Math.max(shake, NV.rhythmShakeBoost(NV.rhythm, rhythmNow));
      if (NV.updateRhythmWidgetIcon) NV.updateRhythmWidgetIcon();
    }

    if ((state === 'menu' || state === 'shop' || state === 'shop_enter') && !paused) updateMusic(dt);
    // El tiempo visual del piloto avanza solo mientras el lobby es la vista activa.
    if (isLobbyPreviewActive()) {
      frame++;
      drawLobbyPreview();
    }
    const perfUpdateStart = performance.now();
    update(dt);
    const perfDrawStart = performance.now();
    draw();
    const perfDrawEnd = performance.now();
    if (NV.performanceMonitor) {
      NV.performanceMonitor.record(now - perfPrevNow, perfDrawStart - perfUpdateStart, perfDrawEnd - perfDrawStart);
    }
    // Visual budget: evaluación de baja frecuencia (~2 Hz) con el p95 real.
    vbEvalTimer += now - perfPrevNow;
    if (vbEvalTimer >= 500) {
      vbEvalTimer = 0;
      if (NV.updateVisualBudget) {
        NV.updateVisualBudget(NV.performanceMonitor ? NV.performanceMonitor.getSnapshot().frame.p95 : NaN);
      }
    }
    updateMetaDiagnostics();
    updateEspectroBridge(dt);

    if (shake > 0 && (state === 'playing' || state === 'player_dying' || state === 'wave_end')) {
      const deathMult = state === 'player_dying' ? 0.7 : 1;
      const sx = (Math.random() - 0.5) * 8 * shake * deathMult;
      const sy = (Math.random() - 0.5) * 4 * shake * deathMult;
      canvas.style.transform = `translate(${sx}px, ${sy}px)`;
      if (specterCanvas) specterCanvas.style.transform = `translate(${sx}px, ${sy}px)`;
    } else {
      canvas.style.transform = '';
      if (specterCanvas) specterCanvas.style.transform = '';
    }

    requestAnimationFrame(loop);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }

  // === Accesores de estado para módulos externos (audio, render, ui…)
  NV.getFrame = () => frame;
  // P2: telemetría de entidades para el monitor (solo lectura, nunca muta).
  if (NV.performanceMonitor) {
    NV.performanceMonitor.setTelemetryProvider(() => {
      let light = 0, medium = 0, heavy = 0;
      for (const e of enemies) {
        if (e.dead) continue;
        const c = e.hostileClass || 'light';
        if (c === 'heavy') heavy++;
        else if (c === 'medium') medium++;
        else light++;
      }
      if (boss && !boss.dead) heavy++; // el jefe consume un slot heavy
      let playerBullets = 0, enemyBullets = 0;
      for (const b of bullets) {
        if (b.dead) continue;
        if (b.isEnemy) enemyBullets++; else playerBullets++;
      }
      const vbp = NV.getVisualBudget ? NV.getVisualBudget() : null;
      return {
        hostiles: light + medium + heavy,
        lightHostiles: light,
        mediumHostiles: medium,
        heavyHostiles: heavy,
        playerBullets,
        enemyBullets,
        particles: particles.length,
        shockwaves: shockwaves.length,
        trails: trails.length,
        meteors: meteors.length,
        drones: drones.length,
        hazards: hazards.length,
        graphicsQuality: (NV.settings && NV.settings.graphics && NV.settings.graphics.quality) || 'high',
        effectiveVisualTier: vbp ? vbp.tier : 'unknown',
        effectiveDpr: (NV.viewport && typeof NV.viewport.getEffectiveDpr === 'function') ? NV.viewport.getEffectiveDpr() : 1,
        mobile: !!(NV.capabilities && NV.capabilities.isMobile),
      };
    });
  }
  NV.getState = () => state;
  NV.getBoss = () => boss;
  NV.getRuntimeSnapshot = () => ({
    state,
    paused,
    frame,
    wave,
    waveTimer,
    transition,
    presentation: {
      kind: presentation.kind,
      elapsed: presentation.elapsed,
      duration: presentation.duration,
      isBoss: presentation.isBoss,
      zoom: presentationZoom(),
    },
    enemies: enemies.filter((enemy) => !enemy.dead).length,
    player: {
      character: player.character,
      x: player.x,
      y: player.y,
      hp: player.hp,
      maxHp: player.maxHp,
    },
  });
})();


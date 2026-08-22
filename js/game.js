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
  let enemies = [], bullets = [], particles = [], pickups = [], floatTexts = [], trails = [], weaponPickups = [], drones = [], meteors = [];
  const MAX_ENEMIES = NV.BALANCE.MAX_ENEMIES, MAX_BULLETS = NV.BALANCE.MAX_BULLETS, MAX_PARTICLES = NV.BALANCE.MAX_PARTICLES;
  // Presupuesto separado de balas por bando: evita que las balas enemigas
  // (p. ej. muchos ESCOPURAS) congele el disparo del jugador al saturar el buffer común.
  const MAX_PLAYER_BULLETS = NV.BALANCE.MAX_PLAYER_BULLETS;
  const MAX_ENEMY_BULLETS = NV.BALANCE.MAX_ENEMY_BULLETS;
  // Cuenta cuántas balas hay de cada bando (para respetar los topes propios).
  function playerBulletCount() { let n = 0; for (const b of bullets) if (!b.isEnemy) n++; return n; }
  function enemyBulletCount() { let n = 0; for (const b of bullets) if (b.isEnemy) n++; return n; }

  // === PROGRESO ===
  let wave = 1, score = 0, shards = 0, waveTimer = 0, spawnTimer = 0, boss = null, transition = 0;

  // === INVENTARIO ===
  let inventory = [];
  const INVENTORY_SLOTS = 6;
  let consumableItems = [];
  const CONSUMABLES = NV.CONSUMABLES;

  // === PROGRESIÓN PERMANENTE ===
  let metaShards = 0;
  let permUpgrades = { damage: 0, speed: 0, hp: 0, armor: 0, luck: 0 };

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
  let currentWeapon = WEAPONS[0], fireTimer = 0;
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
    loadMeta();
    resizeCanvas();

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
        player.maxCd = char.maxCd;
        dom.sound.textContent = NV.soundOn ? '🔊 SONIDO' : '🔇 SONIDO';
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
      sfx.pickup();
    }

    dom.sound.addEventListener('click', () => {
      NV.soundOn = !NV.soundOn;
      dom.sound.textContent = NV.soundOn ? '🔊 SONIDO' : '🔇 SONIDO';
      dom.sound.classList.toggle('off', !NV.soundOn);
    });

        if (dom.hudToggle) {
      dom.hudToggle.addEventListener('click', () => {
        showHUD = !showHUD;
        dom.hudToggle.classList.toggle('active', showHUD);
        dom.hudToggle.textContent = showHUD ? '👁️' : '🚫';
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

  function loadMeta() {
    try {
      const saved = JSON.parse(localStorage.getItem('neonVoidMeta') || '{}');
      metaShards = saved.metaShards || 0;
      permUpgrades = saved.permUpgrades || { damage: 0, speed: 0, hp: 0, armor: 0, luck: 0 };
    } catch (e) { console.warn('[META] Error:', e); }
  }
  function saveMeta() {
    try { localStorage.setItem('neonVoidMeta', JSON.stringify({ metaShards, permUpgrades })); } catch (e) { console.warn('[META] Error:', e); }
  }

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
    player.specialCd = 0; player.invuln = 0; player.overdrive = 0; player.stun = 0;
    player.moveVx = 0; player.moveVy = 0; slideHeld = false; player.agility = 1;
    player.xp = 0; player.level = 1; player.xpToNext = 100;

    wave = 1; score = 0; shards = 0;
    enemies = []; bullets = []; particles = []; pickups = [];
    floatTexts = []; trails = []; weaponPickups = [];
    inventory = []; currentWeapon = WEAPONS[0]; consumableItems = [];
    weaponLevels = {}; weaponKills = {}; fireTimer = 0;
        boss = null; shake = 0; hitstop = 0; flashAlpha = 0;
    transition = 0; paused = false; showStats = false;
    specialVFX = null; NV.musicTime = 0;
    NV.musicState.step = 0; NV.musicState.lastBeat = 0; NV.musicState.intensity = 0;

    resizeCanvas();
    nextWave();
    updateHUD();
    console.log('[START] Partida iniciada correctamente');
  }

  function nextWave() {
    console.log('[WAVE] Oleada ' + wave);
    waveTimer = Math.max(15, 25 - wave * 0.4);
    spawnTimer = 0;
    enemies = []; bullets = []; pickups = [];

    if (wave % 5 === 0) {
      const bossIndex = ((wave / 5 - 1) % BOSS_TYPES.length + BOSS_TYPES.length) % BOSS_TYPES.length;
      const bt = BOSS_TYPES[bossIndex];
                  boss = { x: W/2, y: 100, hp: bt.hp + wave * 25, maxHp: bt.hp + wave * 25, radius: bt.radius, color: bt.color, timer: 0, atkTimer: 0, hitFlash: 0, name: bt.name, pattern: bt.pattern, attack: bt.attack, shape: bt.shape };
      showBanner('¡' + bt.name + '!', bt.color);
      triggerFlash(bt.color);
      spawnExplosion(boss.x, boss.y, 40, boss.color, 1);
    } else {
      boss = null;
      showBanner('OLEADA ' + wave, '#7cf8ff');
      triggerFlash('#7cf8ff');
    }
    sfx.wave();
    updateHUD();
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
      showBanner('👑 ¡' + (bossName || 'BOSS') + ' DERROTADO! 💥', '#ffd700');
    } else {
      shake = 0.4;
      triggerFlash('#7cf8ff');
      spawnExplosion(W / 2, H / 2, 55, '#7cf8ff', 1);
      spawnExplosion(W / 2, H / 2, 35, '#caa7ff', 0.8);
      showBanner('⭐ ¡OLEADA ' + wave + ' COMPLETA! 💎', '#7cf8ff');
    }
    sfx.wave();
  }

  function triggerFlash(color) {
    flashColor = color;
    flashAlpha = Math.max(flashAlpha, 0.3);
  }

  function spawnExplosion(x, y, count, color, speedMult) {
    NV.spawnExplosion(particles, MAX_PARTICLES, x, y, count, color, speedMult);
  }


  function skipShop() {
    state = 'playing';
    dom.shop.classList.add('hidden');
    nextWave();
  }

  function showShop() {
    state = 'shop';
    updateHUD(); // La habilidad no debe seguir pulsando fuera del combate.
    dom.shop.classList.remove('hidden');
    dom.shopShards.textContent = shards;
    generateOffers();
    renderInventory();
  }
// === CONSUMIBLES (se usan con la tecla F en partida) ===
  function useConsumable() {
    if (state !== 'playing' || paused || consumableItems.length === 0) return;
    const item = consumableItems.shift();
    if (item.type === 'potion') {
      player.hp = Math.min(player.maxHp, player.hp + CONSUMABLES.potion.hp);
      addFloatText(player.x, player.y, '+40 HP', '#0f0');
    } else if (item.type === 'overdrive') {
      // Solo se multiplica la velocidad una vez para no inflarla con compras repetidas.
      if (player.overdrive <= 0) player.speed *= CONSUMABLES.overdrive.speedMult;
      player.overdrive = CONSUMABLES.overdrive.duration;
      addFloatText(player.x, player.y, 'OVERDRIVE', '#caa7ff');
    } else if (item.type === 'shield') {
      player.invuln = CONSUMABLES.shield.duration;
      addFloatText(player.x, player.y, 'ESCUDO', '#ffcf76');
    }
    triggerFlash('#7cf8ff');
    sfx.pickup();
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
      el.innerHTML = '<div class="offer-icon">' + u.icon + '</div>' +
        '<div class="offer-name">' + u.name + ' Nv ' + lvl + (maxed ? ' (MÁX)' : '') + '</div>' +
        '<div class="offer-desc">' + u.desc + '</div>' +
        "<div class='offer-price'>" + (maxed ? 'MÁX' : '💎 ' + cost) + '</div>';
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
        slot.innerHTML = `
          <div class="inv-icon" style="color:${RARITY_COLORS[weapon.rarity]}">${weapon.icon}</div>
          <div class="inv-name">${weapon.name}</div>
        `;
        if (weapon === currentWeapon) {
          slot.classList.add('equipped');
          slot.title = weapon.name + ' (equipada) - click para soltar';
        } else {
          slot.title = weapon.name + ' - click para equipar';
        }

        // Click = equipar / soltar
        slot.addEventListener('click', () => {
          if (weapon === currentWeapon) {
            currentWeapon = WEAPONS[0];
            addFloatText(W/2, H/2, 'ARMA EQUIPADA: PISTOLA', '#fff');
          } else {
            currentWeapon = weapon;
            addFloatText(W/2, H/2, 'EQUIPADO: ' + weapon.name, RARITY_COLORS[weapon.rarity]);
          }
          renderInventory();
        });

        // Botón quitar
        const removeBtn = document.createElement('button');
        removeBtn.className = 'inv-remove';
        removeBtn.textContent = '✕';
        removeBtn.title = 'Quitar del inventario';
        removeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          inventory.splice(i, 1);
          if (currentWeapon === weapon) {
            currentWeapon = WEAPONS[0];
          }
          renderInventory();
          sfx.pickup();
        });
        slot.appendChild(removeBtn);
      } else {
        slot.classList.add('empty');
        slot.innerHTML = '<div class="inv-icon" style="opacity:0.2">•</div>';
        slot.style.cursor = 'default';
      }
      dom.invSlots.appendChild(slot);
    }
  }

  function generateOffers() {
    const upgrades = [];
    const weapons = [];
    const consumables = [];

    upgrades.push({
      icon: '💚', name: '+25 HP', desc: 'Vida máxima +25',
      price: 15, buy: () => { player.maxHp += 25; player.hp += 25; },
    });
    if (player.agility < MAX_AGILITY) {
      upgrades.push({
        icon: '🌀', name: 'Agilidad', desc: 'Responde más rápido: acelera y frena mejor (máx +100%)',
        price: 15, buy: () => { player.agility = Math.min(MAX_AGILITY, player.agility + AGILITY_PER_UPGRADE); },
      });
    }
    upgrades.push({
            icon: '🛡', name: 'Armadura', desc: '+3 armadura',
      price: 20, buy: () => { player.armor += 3; },
    });
    upgrades.push({
            icon: '🍀', name: 'Suerte', desc: '+2 suerte',
      price: 20, buy: () => { player.luck += 2; },
    });

    WEAPONS.forEach(w => {
      if (w !== currentWeapon && !inventory.includes(w)) {
        weapons.push({
          icon: "", name: w.name, weapon: w,
          desc: w.rarity + ' | daño ' + w.damage + ' | ' + (w.pro || ''),
          price: 25,
          buy: () => {
            if (inventory.length < INVENTORY_SLOTS) {
              inventory.push(w);
              addFloatText(W/2, H/2, '¡' + w.name + '!', RARITY_COLORS[w.rarity]);
            } else {
              currentWeapon = w;
              addFloatText(W/2, H/2, 'EQUIPADO: ' + w.name, RARITY_COLORS[w.rarity]);
            }
            sfx.pickup();
          },
        });
      }
    });

    consumables.push({
      icon: '🧪', name: 'Poción', desc: 'Cura 40 HP (tecla F en partida)',
      price: 10, buy: () => { consumableItems.push({ type: 'potion', name: 'Poción', icon: '🧪' }); showBanner('Poción guardada (F para usar)', '#0f0'); },
    });
    consumables.push({
            icon: '⚡', name: 'Overdrive', desc: '+50% velocidad 5s (tecla F)',
      price: 18, buy: () => { consumableItems.push({ type: 'overdrive', name: 'Overdrive', icon: '⚡' }); showBanner('Overdrive guardado (F)', '#caa7ff'); },
    });
    consumables.push({
            icon: '🛡', name: 'Escudo', desc: 'Invulnerable 2s (tecla F)',
      price: 22, buy: () => { consumableItems.push({ type: 'shield', name: 'Escudo', icon: '🛡' }); showBanner('Escudo guardado (F)', '#ffcf76'); },
    });

    renderOffers(dom.upgradesOffers, upgrades);
    renderOffers(dom.weaponOffers, weapons);
    renderOffers(dom.consumableOffers, consumables);
  }

  function drawWeaponPixelArt(canvas, weapon) {
    if (!canvas || !weapon) return;
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, 64, 64);
    const name = (weapon.name || "").toLowerCase();
    const palettes = {
      pistol: ["#fff","#7cf8ff","#aaa"],
      rifle: ["#fff","#ffcf76","#caa7ff"],
      shotgun: ["#fff","#ff5f9b","#7cf8ff"],
      smg: ["#fff","#aaa","#7cf8ff"],
      sniper: ["#fff","#0f0","#caa7ff"],
      flamethrower: ["#ff5f9b","#ff0","#f80"],
      laser: ["#f0f","#fff","#0ff"],
      rocket: ["#ff5f9b","#fff","#aaa"],
      plasma: ["#0ff","#fff","#f0f"],
      railgun: ["#0ff","#fff","#ff0"]
    };
    const pal = palettes[name] || ["#fff","#7cf8ff","#caa7ff"];
    const draw = (x,y,c) => { ctx.fillStyle = c; ctx.fillRect(x,y,4,4); };
    ctx.translate(32,32);
    if (name.includes("pistol")) {
      draw(0,0,pal[0]); draw(4,0,pal[1]); draw(8,0,pal[0]); draw(12,0,pal[2]); draw(-4,0,pal[0]); draw(-8,0,pal[1]); draw(0,4,pal[1]); draw(0,8,pal[2]); draw(0,12,pal[0]);
    } else if (name.includes("rifle")) {
      draw(-4,-4,pal[0]); draw(0,-4,pal[1]); draw(4,-4,pal[0]); draw(8,-4,pal[2]); draw(-8,0,pal[0]); draw(-4,0,pal[1]); draw(0,0,pal[2]); draw(4,0,pal[1]); draw(8,0,pal[0]); draw(0,4,pal[1]);
    } else if (name.includes("shotgun")) {
      draw(-8,-4,pal[0]); draw(-4,-4,pal[1]); draw(0,-4,pal[0]); draw(4,-4,pal[1]); draw(8,-4,pal[2]); draw(-8,0,pal[1]); draw(-4,0,pal[2]); draw(0,0,pal[0]); draw(4,0,pal[1]); draw(8,0,pal[2]); draw(0,4,pal[0]);
    } else if (name.includes("smg")) {
      draw(-4,-8,pal[0]); draw(0,-8,pal[1]); draw(4,-8,pal[0]); draw(-8,-4,pal[1]); draw(-4,-4,pal[2]); draw(0,-4,pal[0]); draw(4,-4,pal[1]); draw(-4,0,pal[0]); draw(0,0,pal[1]); draw(4,0,pal[2]);
    } else if (name.includes("sniper")) {
      draw(-12,-2,pal[0]); draw(-8,-2,pal[1]); draw(-4,-2,pal[0]); draw(0,-2,pal[2]); draw(4,-2,pal[1]); draw(8,-2,pal[0]); draw(-8,2,pal[0]); draw(-4,2,pal[1]); draw(0,2,pal[2]); draw(4,2,pal[0]); draw(8,2,pal[1]);
    } else if (name.includes("flame")) {
      draw(-4,-8,pal[0]); draw(0,-8,pal[1]); draw(4,-8,pal[0]); draw(-8,-4,pal[1]); draw(-4,-4,pal[2]); draw(0,-4,pal[1]); draw(4,-4,pal[2]); draw(8,-4,pal[1]); draw(-4,0,pal[0]); draw(0,0,pal[1]); draw(4,0,pal[0]); draw(0,4,pal[2]); draw(0,8,pal[0]);
    } else if (name.includes("laser")) {
      draw(-4,-12,pal[0]); draw(0,-12,pal[1]); draw(4,-12,pal[2]); draw(-8,-8,pal[1]); draw(-4,-8,pal[2]); draw(0,-8,pal[0]); draw(4,-8,pal[1]); draw(8,-8,pal[2]); draw(-4,-4,pal[0]); draw(0,-4,pal[1]); draw(4,-4,pal[0]); draw(0,0,pal[2]); draw(0,4,pal[0]); draw(0,8,pal[2]);
    } else if (name.includes("rocket")) {
      draw(-8,-4,pal[0]); draw(-4,-4,pal[1]); draw(0,-4,pal[2]); draw(4,-4,pal[1]); draw(8,-4,pal[0]); draw(-12,0,pal[1]); draw(-8,0,pal[0]); draw(-4,0,pal[1]); draw(0,0,pal[2]); draw(4,0,pal[1]); draw(8,0,pal[0]); draw(0,4,pal[2]); draw(4,4,pal[1]); draw(0,8,pal[0]);
    } else if (name.includes("plasma")) {
      draw(-4,-12,pal[0]); draw(0,-12,pal[1]); draw(4,-12,pal[2]); draw(-8,-8,pal[1]); draw(-4,-8,pal[2]); draw(0,-8,pal[0]); draw(4,-8,pal[1]); draw(8,-8,pal[2]); draw(-4,-4,pal[0]); draw(0,-4,pal[1]); draw(4,-4,pal[2]); draw(-8,0,pal[1]); draw(-4,0,pal[0]); draw(0,0,pal[1]); draw(4,0,pal[2]); draw(8,0,pal[0]); draw(-4,4,pal[2]); draw(0,4,pal[1]); draw(4,4,pal[0]);
    } else if (name.includes("rail")) {
      draw(-12,0,pal[0]); draw(-8,0,pal[1]); draw(-4,0,pal[2]); draw(0,0,pal[0]); draw(4,0,pal[1]); draw(8,0,pal[2]); draw(12,0,pal[0]); draw(-8,-4,pal[0]); draw(-4,-4,pal[1]); draw(0,-4,pal[2]); draw(4,-4,pal[0]); draw(8,-4,pal[1]); draw(-8,4,pal[0]); draw(-4,4,pal[1]); draw(0,4,pal[2]); draw(4,4,pal[0]); draw(8,4,pal[1]);
    } else {
      draw(-4,-4,pal[0]); draw(0,-4,pal[1]); draw(4,-4,pal[2]); draw(-8,0,pal[1]); draw(-4,0,pal[2]); draw(0,0,pal[0]); draw(4,0,pal[1]); draw(8,0,pal[2]); draw(-4,4,pal[0]); draw(0,4,pal[1]); draw(4,4,pal[0]);
    }
    ctx.setTransform(1,0,0,1,0,0);
  }

  function renderOffers(container, items) {
    if (!container) return;
    container.innerHTML = "";
    items.forEach(item => {
      const el = document.createElement("div");
      el.className = "offer";
      const iconHtml = item.weapon ? '<div class="offer-icon"><canvas></canvas></div>' : '<div class="offer-icon">' + item.icon + "</div>";
            el.innerHTML = iconHtml + '<div class="offer-name">' + item.name + "</div><div class=\"offer-desc\">" + item.desc + "</div><div class='offer-price'>💎 " + item.price + "</div>";
      el.addEventListener("click", () => {
        if (shards >= item.price) {
          shards -= item.price;
          item.buy();
          dom.shopShards.textContent = shards;
          generateOffers();
          updateHUD();
          sfx.pickup();
        } else {
          addFloatText(W/2, H/2, "Fragmentos insuficientes", "#ff5f9b");
        }
      });
      container.appendChild(el);
      const c = el.querySelector("canvas");
      if (c && item.weapon) drawWeaponPixelArt(c, item.weapon);
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

    if (frame % 3 === 0) {
      const char = CHARACTERS[player.character];
      trails.push({ x: player.x, y: player.y, life: 0.3, color: player.color, size: char.size * 0.6 });
    }

    // Regeneración pasiva BOTI
    const char = CHARACTERS[player.character];
    if (char.passive.includes('Regenera') && frame % 300 === 0 && player.hp < player.maxHp) {
      player.hp = Math.min(player.maxHp, player.hp + 1);
      addFloatText(player.x, player.y - 40, '+1', '#7cf8ff');
    }

    if (player.invuln > 0) { player.invuln -= dt; if (player.invuln < 0) player.invuln = 0; }
    if (player.stun > 0) { player.stun = Math.max(0, player.stun - dt); }
    if (player.phase) { player.phase -= dt; if (player.phase <= 0) { player.phase = 0; player.invuln = 0; } }
    if (player.bulwark > 0) { player.bulwark -= dt; if (player.bulwark < 0) player.bulwark = 0; }
    if (player.overdrive > 0) {
      player.overdrive -= dt;
      if (player.overdrive <= 0) { player.speed /= 1.5; triggerFlash('#caa7ff'); }
    }
    if (player.specialCd > 0) player.specialCd -= dt;

    fireTimer -= dt;
    if (fireTimer <= 0 && hitstop <= 0) {
      if (playerBulletCount() < MAX_PLAYER_BULLETS) {
        shoot();
        fireTimer = weaponFireInterval();
      } else {
        // Buffer casi lleno (p. ej. con overdrive activo): reintentar enseguida.
        fireTimer = MIN_FIRE_INTERVAL;
      }
    }

    if (specialPressed && player.specialCd <= 0) useSpecial();

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
      spawnTimer = Math.max(0.45, 1.3 - wave * 0.018);
    }

        waveTimer -= dt;
    // Fin de oleada (sin jefe): se evalúa ANTES del countdown de transición para
    // evitar que abrir la tienda re-dispare la victoria en el mismo frame.
    if (transition <= 0 && waveTimer <= 0 && !boss) {
      shards += 10 + wave * 2;
      triggerWaveVictory(false, null, null);
      wave++;
      waveTimer = Math.max(15, 25 - wave * 0.4); // arranca limpia la próxima oleada
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
    updateFloatTexts(dt);
    updateTrails(dt);
    updateDrones(dt);
    updateMeteors(dt);

    // Aura de daño de Fase Fantasma (NOVA): daña a los enemigos cercanos
    if (player.phase > 0) {
      for (const e of enemies) {
        if (e.dead) continue;
        if (Math.hypot(e.x - player.x, e.y - player.y) < 45) {
          e.hp -= 12 * dt;
          if (e.hp <= 0) killEnemy(e);
        }
      }
    }

    updateHUD();
  }

  function shoot() {
    NV.shoot({
      player, enemies, boss, bullets, currentWeapon,
      currentWeaponLevel, weaponVisualTier, BULLET_TIER_COLORS, MAX_BULLETS,
      permDamageBonus: permUpgrades.damage, playWeaponSound,
    });
  }

  function findTarget() {
    return NV.findTarget({ player, enemies, boss });
  }

  function applyKnockback(e, bx, by, strength) {
    return NV.applyKnockback(e, bx, by, strength);
  }

  function useSpecial() {
    const res = NV.useSpecial({
      player, CHARACTERS, meteors, particles, W, shake, specialVFX,
      cbs: { showBanner, triggerFlash, spawnExplosion, sfx },
    });
    drones = res.drones; shake = res.shake; specialVFX = res.specialVFX;
  }

  function updateDrones(dt) {
    drones = NV.updateDrones(dt, drones, player, bullets, MAX_BULLETS, findTarget);
  }

  function updateMeteors(dt) {
    const res = NV.updateMeteors(dt, meteors, { H, enemies, boss, shake }, { killEnemy, applyKnockback, spawnExplosion });
    meteors = res.meteors;
    shake = res.shake;
  }

  function spawnEnemy() {
    NV.spawnEnemy({ enemies, MAX_ENEMIES, boss, wave, ENEMY_TYPES, W, H });
  }

  function spawnElite() {
    NV.spawnElite({ enemies, MAX_ENEMIES, boss, wave, ELITE_TYPES, W, H });
  }

  function spawnWeaponPickup() {
    NV.spawnWeaponPickup(WEAPONS, weaponPickups, W, H, showBanner, RARITY_COLORS);
  }

  function killEnemy(e) {
    score = NV.killEnemy({
      e, score, player, weaponLevels, weaponKills, currentWeapon,
      WEAPON_KILLS_PER_LEVEL, addFloatText, spawnExplosion, triggerFlash, sfx, pickups, weaponKillProgress,
    });
  }

  function updateEnemies(dt) {
    const res = NV.updateEnemies(dt, {
      enemies, player, bullets, MAX_BULLETS, MAX_ENEMY_BULLETS, shake,
      enemyBulletCount, computePlayerHit, addFloatText,
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
      spawnBossProj, spawnMinion, runBossAttack,
    });
    score = res.score; shards = res.shards; wave = res.wave; shake = res.shake; boss = res.boss;
  }

    // === DIFICULTAD PROGRESIVA: críticos escalables con la oleada (PvE) ===
  // La "suerte" del jugador reduce la chance de crítico enemigo.
  function enemyCritChance() { return NV.enemyCritChance(wave, player); }
  function calcEnemyDamage(base) { return NV.calcEnemyDamage(base, enemyCritChance); }
  function computePlayerHit(base) { return NV.computePlayerHit(base, { player, CHARACTERS, calcEnemyDamage }); }

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
    });
    bullets = res.bullets; shake = res.shake; hitstop = res.hitstop;
    if (res.gameOver) return;
  }

  function updateParticles(dt) {
    particles = NV.updateParticles(dt, particles);
  }


  function updatePickups(dt) {
    const r = NV.updatePickups(dt, pickups, player, addFloatText, sfx.pickup);
    pickups = r.pickups; shards += r.shards;
  }

  function updateWeaponPickups(dt) {
    const r = NV.updateWeaponPickups(dt, weaponPickups, player, inventory, INVENTORY_SLOTS, currentWeapon, addFloatText, RARITY_COLORS, sfx.pickup);
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
    dom.wave.textContent = 'OLEADA ' + wave;
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

    ctx.fillStyle = '#050714';
    ctx.fillRect(0, 0, W, H);

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
      const maxWaveTimer = Math.max(15, 25 - wave * 0.4);
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

    for (const t of trails) {
      ctx.globalAlpha = Math.max(0, t.life / 0.3);
      ctx.fillStyle = t.color;
      ctx.beginPath(); ctx.arc(t.x, t.y, t.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    for (const wp of weaponPickups) {
      if (wp.dead) continue;
      ctx.fillStyle = RARITY_COLORS[wp.weapon.rarity];
      ctx.font = 'bold 16px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(wp.weapon.icon, wp.x, wp.y);
      ctx.font = '10px system-ui';
      ctx.fillText(wp.weapon.name, wp.x, wp.y + 15);
    }

    for (const p of pickups) {
      ctx.fillStyle = '#7cf8ff';
      ctx.font = '16px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('💎', p.x, p.y);
    }

    // Drones de combate
    for (const d of drones) {
      const dx = Math.cos(d.angle) * d.orbitRadius;
      const dy = Math.sin(d.angle) * d.orbitRadius;
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

    for (const e of enemies) drawEnemy(e);
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
      // Crecimiento por tier: solo a partir de tier 3 (nivel 30+) y por % pequeño.
      const g = Math.max(0, (b.tier || 0) - 2) * 0.05;
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

    drawPlayer();
    if (showHUD) {
      drawSpecialCooldown();
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
  }

  function drawSpecialVFX(vfx) {
    NV.drawSpecialVFX(ctx, vfx);
  }



  function drawSpecialCooldown() {
    NV.drawSpecialCooldown(ctx, W, H, CHARACTERS, player);
  }



  function drawWeaponHUD() {
    NV.drawWeaponHUD(ctx, W, H, CHARACTERS, RARITY_COLORS, player, currentWeapon, currentWeaponLevel, consumableItems, showHUD);
  }



  function drawStats() {
    NV.drawStats(ctx, CHARACTERS, RARITY_COLORS, player, currentWeapon, currentWeaponLevel, weaponVisualTier, BULLET_TIER_COLORS, permUpgrades, inventory, INVENTORY_SLOTS, consumableItems);
  }



  function drawEnemy(e) {
    NV.drawEnemy(ctx, e, frame);
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

    // Decrementar deathTimer y deathShake en gameover
    if (state === 'gameover' && deathTimer > 0) {
      deathTimer = Math.max(0, deathTimer - dt);
      deathShake = Math.max(0, deathShake - dt * 2);
    }

    update(dt);
    draw();

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


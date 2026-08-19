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
  const MAX_ENEMIES = 80, MAX_BULLETS = 200, MAX_PARTICLES = 200;
  // Presupuesto separado de balas por bando: evita que las balas enemigas
  // (p. ej. muchos ESCOPURAS) congele el disparo del jugador al saturar el buffer común.
  const MAX_PLAYER_BULLETS = 150;
  const MAX_ENEMY_BULLETS = 120;
  // Cuenta cuántas balas hay de cada bando (para respetar los topes propios).
  function playerBulletCount() { let n = 0; for (const b of bullets) if (!b.isEnemy) n++; return n; }
  function enemyBulletCount() { let n = 0; for (const b of bullets) if (b.isEnemy) n++; return n; }

  // === PROGRESO ===
  let wave = 1, score = 0, shards = 0, waveTimer = 0, spawnTimer = 0, boss = null, transition = 0;

  // === INVENTARIO ===
  let inventory = [];
  const INVENTORY_SLOTS = 6;
  let consumableItems = [];

  // === PROGRESIÓN PERMANENTE ===
  let metaShards = 0;
  let permUpgrades = { damage: 0, speed: 0, hp: 0, armor: 0, luck: 0 };

  // Mejoras permanentes comprables con metaShards (afectan a TODOS los personajes).
  // El coste crece con el nivel y tienen un tope máximo (MAX_PERM_LEVEL).
  const MAX_PERM_LEVEL = 10;
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
  const FIRE_FPS = 60;                 // frames por segundo asumidos en fireRate
  const MIN_FIRE_INTERVAL = 4 / FIRE_FPS; // ~0.0667s -> máx ~15 disparos/s (piso anti-congestión)
  const WAVE_CADENCE_SCALE = 0.01;     // -1% de intervalo por oleada (máx -45% de factor)
  const WEAPON_LEVEL_CADENCE_SCALE = 0.004; // -0.4% de intervalo por nivel de arma (máx -40%)
  const SHIELD_COOLDOWN = 0.9;        // recarga del escudo del shielder (s): vulnerable entre bloqueos
  const MAX_AGILITY = 2;              // tope de la mejora de Agilidad (x2 = +100% aceleración/freno)
  const AGILITY_PER_UPGRADE = 0.2;    // +0.2 por compra (5 compras llegan al tope)
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
  const WEAPON_KILLS_PER_LEVEL = 6;   // ~6 puntos de progreso por nivel
  const WEAPON_PROGRESS_SCALE = 0.06; // +6% de progreso por derribo, por oleada
  const WEAPON_PROGRESS_CAP = 3;      // máx ~3 puntos de progreso por derribo
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
    for (let i = 0; i < count && particles.length < MAX_PARTICLES; i++) {
      const a = (i / count) * Math.PI * 2;
      particles.push({ x, y, vx: Math.cos(a) * 300 * speedMult, vy: Math.sin(a) * 300 * speedMult, life: 1, color });
    }
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
      player.hp = Math.min(player.maxHp, player.hp + 40);
      addFloatText(player.x, player.y, '+40 HP', '#0f0');
    } else if (item.type === 'overdrive') {
      // Solo se multiplica la velocidad una vez para no inflarla con compras repetidas.
      if (player.overdrive <= 0) player.speed *= 1.5;
      player.overdrive = 5;
      addFloatText(player.x, player.y, 'OVERDRIVE', '#caa7ff');
    } else if (item.type === 'shield') {
      player.invuln = 2;
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
    const weapon = currentWeapon;
    const count = Math.min(weapon.count || 1, 7);
    const spread = weapon.spread || 0;
    const target = findTarget();
    const baseAngle = target
      ? Math.atan2(target.y - player.y, target.x - player.x)
      : -Math.PI / 2;

    // Durante overdrive, disparos duplicados
    const actualCount = player.overdrive > 0 ? count * 2 : count;

    // Estética por tier del arma (solo visual).
    const vTier = weaponVisualTier();
    const glowColor = BULLET_TIER_COLORS[vTier];

    for (let i = 0; i < actualCount; i++) {
      if (bullets.length >= MAX_BULLETS) break;
      const angle = baseAngle + (i - (actualCount - 1) / 2) * spread;
      const crit = Math.random() < (0.1 + player.luck * 0.002);
      const baseDmg = weapon.damage + permUpgrades.damage * 2 + currentWeaponLevel(); // daño aditivo: base + meta + nivel de arma
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
    playWeaponSound(weapon);
  }

  function findTarget() {
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
  }

  function applyKnockback(e, bx, by, strength) {
    const angle = Math.atan2(e.y - by, e.x - bx);
    const kb = strength * (1 - (e.knockbackRes || 0));
    e.knockVelX = (e.knockVelX || 0) + Math.cos(angle) * kb;
    e.knockVelY = (e.knockVelY || 0) + Math.sin(angle) * kb;
  }

  function useSpecial() {
    const char = CHARACTERS[player.character];
    player.specialCd = char.maxCd + 0.5;
    specialVFX = { x: player.x, y: player.y, life: 1, type: char.special, color: char.color };
    showBanner(char.skillName.toUpperCase(), char.color);

    if (char.special === 'meteor') {
      // Lluvia Estelar: 8 meteoritos caen del cielo
      triggerFlash('#7cf8ff');
      shake = 0.4;
      for (let i = 0; i < 12; i++) {
        meteors.push({
          x: 30 + Math.random() * (W - 60),
          y: -20 - Math.random() * 120,
          vy: 320 + Math.random() * 200,
          vx: (Math.random() - 0.5) * 70,
          radius: 9 + Math.random() * 7,
          color: i % 2 === 0 ? '#7cf8ff' : '#caa7ff',
          dead: false,
        });
      }
      spawnExplosion(player.x, player.y, 30, '#7cf8ff', 0.6);
    } else if (char.special === 'phase') {
      // Fase Fantasma: intangible 3s + rastro de daño
      player.invuln = 3;
      player.phase = 3;
      triggerFlash('#caa7ff');
      for (let i = 0; i < 46; i++) {
        const a = (i / 46) * Math.PI * 2;
        particles.push({ x: player.x, y: player.y, vx: Math.cos(a) * 360, vy: Math.sin(a) * 360, life: 0.7, color: i % 2 ? '#caa7ff' : '#fff' });
      }
    } else if (char.special === 'bulwark') {
      player.invuln = 3;
      player.bulwark = 3;
      shake = 0.5;
      triggerFlash('#ffcf76');
      spawnExplosion(player.x, player.y, 40, '#ffcf76', 0.4);
      spawnExplosion(player.x, player.y, 25, '#fff', 0.5);
    } else if (char.special === 'hivemind') {
      // Drones de Combate: 6 drones que orbitan y disparan por 5s
      triggerFlash('#8dfaff');
      drones = [];
      for (let i = 0; i < 6; i++) {
        drones.push({
          angle: (i / 6) * Math.PI * 2,
          orbitRadius: 55,
          speed: 2.5,
          fireTimer: 0.3 + i * 0.1,
          color: '#8dfaff',
          dead: false,
        });
      }
      spawnExplosion(player.x, player.y, 20, '#8dfaff', 0.6);
    }
    sfx.special();
  }

  function updateDrones(dt) {
    if (drones.length === 0) return;
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
    drones = drones.filter((d) => !d.dead);
  }

  function updateMeteors(dt) {
    if (meteors.length === 0) return;
    for (const m of meteors) {
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      if (m.y > H + 20) { m.dead = true; continue; }
      // Impacto
      for (const e of enemies) {
        if (e.dead) continue;
        const d = Math.hypot(e.x - m.x, e.y - m.y);
        if (d < m.radius + e.radius) {
          e.hp -= 40;
          if (e.hp <= 0) killEnemy(e);
          applyKnockback(e, m.x, m.y, 150);
        }
      }
      if (boss && !boss.dead) {
        const d = Math.hypot(boss.x - m.x, boss.y - m.y);
                if (d < m.radius + boss.radius) { boss.hp -= 30; boss.hitFlash = 0.2; }
      }
      if (m.y > H - 20) {
        m.dead = true;
        spawnExplosion(m.x, m.y, 8, m.color, 0.4);
        shake = Math.max(shake, 0.1);
      }
    }
    meteors = meteors.filter((m) => !m.dead);
  }

  function spawnEnemy() {
    if (enemies.length >= MAX_ENEMIES) return;
    if (boss && !boss.dead) return;

    const waveTier = Math.min(6, Math.floor(wave / 3));
    const available = ENEMY_TYPES.slice(0, 2 + waveTier);
    const type = available[Math.floor(Math.random() * available.length)];
    const side = Math.random() < 0.5 ? 0 : W;
    const y = 80 + Math.random() * (H - 200);
        const hpScale = 1 + wave * 0.18;

    enemies.push({
      x: side, y: y,
      hp: Math.round(type.hp * hpScale), maxHp: Math.round(type.hp * hpScale),
      speed: type.speed + wave * 2,
      radius: type.radius, color: type.color, shape: type.shape,
      score: type.score * (1 + wave * 0.1), xp: type.xp * (1 + wave * 0.1),
      dead: false, behavior: type.behavior,
      angle: Math.random() * Math.PI * 2, erraticTimer: 0,
      knockbackRes: type.knockbackRes || 0, knockVelX: 0, knockVelY: 0,
      damage: type.damage || 10, shield: type.shield || false, shieldCd: 0, resist: type.resist || 0,
      shootTimer: 0, stunChance: type.stunChance || 0,
    });
  }

  function spawnElite() {
    if (wave < 2) return;
    if (wave % 2 !== 0) return;
    if (boss && !boss.dead) return; // No spawnear élites durante un jefe
    const startIndex = ((wave / 2 - 1) * 2) % ELITE_TYPES.length;
    for (let i = 0; i < 2; i++) {
      if (enemies.length >= MAX_ENEMIES) break;
      const elite = ELITE_TYPES[(startIndex + i) % ELITE_TYPES.length];
      const side = Math.random() < 0.5 ? 0 : W;
      const y = 80 + Math.random() * (H - 200);
      enemies.push({
        x: side, y: y,
        hp: elite.hp + wave * 4, maxHp: elite.hp + wave * 4,
        speed: elite.speed + wave,
        radius: elite.radius, color: elite.color, shape: elite.shape,
        score: elite.score, xp: elite.xp, dead: false,
        behavior: elite.behavior, angle: Math.random() * Math.PI * 2,
        erraticTimer: 0, isElite: true, eliteDamage: elite.damage,
        knockbackRes: 0.3, knockVelX: 0, knockVelY: 0, shootTimer: 0,
        stunChance: elite.stunChance || 0, resist: elite.resist || 0,
      });
    }
  }

  function spawnWeaponPickup() {
    const weapon = WEAPONS[Math.floor(Math.random() * WEAPONS.length)];
    weaponPickups.push({ x: 40 + Math.random() * (W - 80), y: 80 + Math.random() * (H - 160), weapon: weapon, dead: false });
    showBanner('¡' + weapon.name + '! 💎', RARITY_COLORS[weapon.rarity]);
  }

  function killEnemy(e) {
    e.dead = true;
    score += e.score;
    player.xp += e.xp;
    addFloatText(e.x, e.y, '+' + Math.round(e.score), e.isElite ? '#ff0' : '#ffcf76');
    while (player.xp >= player.xpToNext) {
      player.xp -= player.xpToNext;
      player.level++;
      player.xpToNext = Math.floor(player.xpToNext * 1.5);
      player.maxHp += 10;
      player.hp = Math.min(player.hp + 20, player.maxHp);
      addFloatText(player.x, player.y - 50, 'LEVEL UP!', '#ff0');
      sfx.levelup();
      triggerFlash('#ff0');
    }
    // El arma equipada gana XP por derribos y sube de nivel (más daño, se conserva al cambiar).
    // El progreso de cada derribo pesa según la dificultad de la oleada.
    const wid = currentWeapon.id;
    const curLevel = weaponLevels[wid] || 1;
    weaponKills[wid] = (weaponKills[wid] || 0) + weaponKillProgress();
    if (weaponKills[wid] >= WEAPON_KILLS_PER_LEVEL * curLevel) {
      weaponLevels[wid] = curLevel + 1;
      addFloatText(player.x, player.y - 40, currentWeapon.name + ' → Nv ' + (curLevel + 1), '#ffd700');
      sfx.levelup();
    }
    spawnExplosion(e.x, e.y, 8, e.color, 0.3);
    if (Math.random() < 0.15 + player.luck * 0.01) pickups.push({ x: e.x, y: e.y, type: 'shard', dead: false });
    sfx.explosion();
  }

  function updateEnemies(dt) {
    for (const e of enemies) {
      if (e.dead) continue;

      const kb = e.knockVelX || 0;
      const kby = e.knockVelY || 0;
      const kbx = Math.abs(kb) > 0.1 ? kb : 0;
      const kby2 = Math.abs(kby) > 0.1 ? kby : 0;

            if (e.stun > 0) e.stun -= dt;
            if (e.shieldCd > 0) e.shieldCd = Math.max(0, e.shieldCd - dt);
      const stunned = e.stun > 0;
      if (!stunned) {
        if (e.behavior === 'chase') {
          const angle = Math.atan2(player.y - e.y, player.x - e.x);
          e.x += Math.cos(angle) * e.speed * dt + kbx * dt;
          e.y += Math.sin(angle) * e.speed * dt + kby2 * dt;
        } else if (e.behavior === 'erratic') {
          e.erraticTimer -= dt;
          if (e.erraticTimer <= 0) { e.angle += (Math.random() - 0.5) * 3; e.erraticTimer = 0.5; }
          e.x += (Math.cos(e.angle) * e.speed + kbx) * dt;
          e.y += (Math.sin(e.angle) * e.speed + kby2) * dt;
        } else if (e.behavior === 'swarm') {
          const angle = Math.atan2(player.y - e.y, player.x - e.x);
          e.x += (Math.cos(angle) * e.speed + kbx) * dt;
          e.y += (Math.sin(angle) * e.speed + kby2) * dt;
          // Se juntan entre sí
          for (const other of enemies) {
            if (other !== e && !other.dead && Math.hypot(other.x - e.x, other.y - e.y) < e.radius * 4) {
              const oa = Math.atan2(other.y - e.y, other.x - e.x);
              e.x -= Math.cos(oa) * 10 * dt;
              e.y -= Math.sin(oa) * 10 * dt;
            }
          }
        } else if (e.behavior === 'shield') {
          const angle = Math.atan2(player.y - e.y, player.x - e.x);
          const dist = Math.hypot(player.x - e.x, player.y - e.y);
          if (dist > e.radius + 30) {
            e.x += Math.cos(angle) * e.speed * dt + kbx * dt;
            e.y += Math.sin(angle) * e.speed * dt + kby2 * dt;
          }
        } else if (e.behavior === 'ranged') {
          const dist = Math.hypot(player.x - e.x, player.y - e.y);
          if (dist > 170) {
            const angle = Math.atan2(player.y - e.y, player.x - e.x);
            e.x += Math.cos(angle) * e.speed * 0.5 * dt + kbx * dt;
            e.y += Math.sin(angle) * e.speed * 0.5 * dt + kby2 * dt;
          } else {
            // Separación suave para que no se apilen todos en un mismo punto.
            for (const other of enemies) {
              if (other === e || other.dead) continue;
              const od = Math.hypot(other.x - e.x, other.y - e.y);
              const minD = (e.radius + other.radius) * 0.7;
              if (od > 0 && od < minD) {
                const a2 = Math.atan2(e.y - other.y, e.x - other.x);
                const push = (minD - od) * 1.2 * dt;
                e.x += Math.cos(a2) * push;
                e.y += Math.sin(a2) * push;
              }
            }
            e.shootTimer += dt;
            if (e.shootTimer > 1.2) {
              e.shootTimer = 0;
              const angle = Math.atan2(player.y - e.y, player.x - e.x);
              if (bullets.length < MAX_BULLETS && enemyBulletCount() < MAX_ENEMY_BULLETS) bullets.push({ x: e.x, y: e.y, vx: Math.cos(angle) * 250, vy: Math.sin(angle) * 250, damage: e.damage, color: e.color, isEnemy: true, dead: false });
            }
          }
        }
      }

      e.knockVelX = (e.knockVelX || 0) * 0.92;
      e.knockVelY = (e.knockVelY || 0) * 0.92;

            const d = Math.hypot(e.x - player.x, e.y - player.y);
      if (d < e.radius + 20 && player.invuln <= 0 && player.stun <= 0) {
        const baseDmg = e.isElite ? (e.eliteDamage || 0) : e.damage;
        const hit = computePlayerHit(baseDmg);
        if (hit.dodged) {
          addFloatText(player.x, player.y - 20, 'ESQUIVA', '#8dfaff');
        } else {
          const damage = hit.dmg;
          player.hp -= damage;
          player.invuln = 0.5;
          if (e.stunChance && Math.random() < e.stunChance) { player.stun = 0.6; addFloatText(player.x, player.y - 30, 'STUN', '#ff0'); }
          shake = Math.max(shake, hit.crit ? 0.3 : 0.15);
          addFloatText(player.x, player.y - 20, '-' + damage + (hit.crit ? ' ★CRIT' : ''), hit.crit ? '#ff0' : (e.isElite ? '#ff0' : '#ff5f9b'));
          if (player.hp <= 0) { gameOver(); return; }
        }
      }
    }
    enemies = enemies.filter((e) => !e.dead);
  }

  function updateBoss(dt) {
    if (!boss || boss.dead) return;
    boss.timer += dt;

    if (boss.pattern === 'chase') { boss.x = W / 2 + Math.sin(boss.timer * 0.3) * 200; }
    else if (boss.pattern === 'charge') { boss.x = W / 2 + Math.sin(boss.timer * 0.5) * 300; boss.y = 100 + Math.sin(boss.timer * 0.5) * 30; }
    else if (boss.pattern === 'circle') { boss.x = W / 2 + Math.cos(boss.timer) * 250; boss.y = 100 + Math.sin(boss.timer * 0.7) * 100; }
    else if (boss.pattern === 'burst') { boss.x = W / 2 + Math.sin(boss.timer * 2) * 150; }
    else if (boss.pattern === 'teleport') {
      boss.teleportTimer = (boss.teleportTimer || 0) + dt;
      if (boss.teleportTimer >= 2.2) {
        boss.teleportTimer = 0;
        spawnExplosion(boss.x, boss.y, 18, boss.color, 0.6);
        boss.x = 100 + Math.random() * (W - 200);
        boss.y = 100 + Math.random() * 200;
        spawnExplosion(boss.x, boss.y, 18, boss.color, 0.6);
      }
    }
    else if (boss.pattern === 'slow_charge') { boss.x = W / 2 + Math.sin(boss.timer * 0.3) * 350; }
    else if (boss.pattern === 'phase') { boss.x = W / 2 + Math.sin(boss.timer) * 180; boss.y = 80 + Math.cos(boss.timer * 1.5) * 80; }
    else if (boss.pattern === 'split') { boss.x = W / 2 + Math.sin(boss.timer * 0.8) * 220; }
    else if (boss.pattern === 'rage') { boss.x = W / 2 + Math.sin(boss.timer * 1.2) * 280; boss.y = 100 + Math.cos(boss.timer) * 120; }
    else { boss.x = W / 2 + Math.sin(boss.timer) * 200; }

// === FASE 2 (por debajo del 50% de HP) ===
    if (!boss.phase2 && boss.hp <= boss.maxHp * 0.5) {
      boss.phase2 = true;
      showBanner('¡FASE 2! ' + boss.name, '#ff5f9b');
      triggerFlash('#ff5f9b');
      shake = Math.max(shake, 0.8);
    }
    if (boss.phase2) {
      boss.atkTimer = (boss.atkTimer || 0) + dt * 0.9; // ataques ~2x más frecuentes
      boss.timer += dt * 0.35; // patrón de movimiento más veloz
    }
    // === ATAQUES PROPIOS DE CADA JEFE (arma / sonido / timing distintos) ===

    runBossAttack(boss, dt);

    if (boss.hp <= 0) {
      const bossName = boss.name, bossColor = boss.color;
      boss.dead = true;
      score += 500;
      shards += 30;
      spawnExplosion(boss.x, boss.y, 60, boss.color, 1.4);
      wave++;
      boss = null;
            triggerWaveVictory(true, bossName, bossColor);
    }
  }

    // === DIFICULTAD PROGRESIVA: críticos escalables con la oleada (PvE) ===
  // La "suerte" del jugador reduce la chance de crítico enemigo.
  function enemyCritChance() { return Math.max(0.05, Math.min(0.35, 0.08 + wave * 0.018 - player.luck * 0.0008)); }
  function calcEnemyDamage(base) {
    const crit = Math.random() < enemyCritChance();
    return { dmg: crit ? Math.round(base * 1.6) : base, crit };
  }
  // Daño que recibe el jugador: crítico → armadura (plano) → pasiva del personaje → esquiva.
  function computePlayerHit(base) {
    const char = CHARACTERS[player.character];
    if ((char.dodge || 0) > 0 && Math.random() < char.dodge) {
      return { dodged: true };
    }
    const c = calcEnemyDamage(base);
    let dmg = Math.max(1, c.dmg - player.armor);
    const mult = char.takeDmgMult || 1;
    dmg = Math.max(1, Math.round(dmg * mult));
    return { dodged: false, dmg, crit: c.crit };
  }

  // === PROYECTILES Y ATAQUES DISTINTOS POR JEFE ===
  function spawnBossProj(b, speed, damage, count, spread, color, radius) {
    if (!b) return;
    const cnt = count || 1;
    const angle = Math.atan2(player.y - b.y, player.x - b.x);
    const spreadA = spread || 0;
    for (let i = 0; i < cnt && bullets.length < MAX_BULLETS && enemyBulletCount() < MAX_ENEMY_BULLETS; i++) {
      const a = cnt > 1 ? angle + (i - (cnt - 1) / 2) * spreadA : angle;
      bullets.push({ x: b.x, y: b.y + 40, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, damage: damage, color: color || b.color, radius: radius || 5, isEnemy: true, dead: false, stunChance: b.stunChance || 0 });
    }
  }

  // Esbirros invocados (funciona incluso durante la pelea con un jefe)
  function spawnMinion(x, y) {
    if (enemies.length >= 40) return;
    const t = ENEMY_TYPES[0];
    const e = {
      x: x, y: y,
      hp: Math.round(20 * (1 + wave * 0.3)), speed: t.speed + wave * 2, radius: 9, color: t.color, shape: 'circle',
      score: 8, xp: 8, dead: false, behavior: 'chase', angle: Math.random() * Math.PI * 2,
      erraticTimer: 0, isElite: false, eliteDamage: 8, knockbackRes: 0, knockVelX: 0, knockVelY: 0,
      damage: 8, shield: false, shootTimer: 0, stun: 0,
    };
    e.maxHp = e.hp;
    enemies.push(e);
  }

  function runBossAttack(b, dt) {
    b.atkTimer = (b.atkTimer || 0) + dt;
    const s = b.attack;
    switch (s) {
      case 'repeater':
        if (b.atkTimer >= 0.22) { sfx.bossAttack.repeater(); spawnBossProj(b, 360, 13); b.atkTimer = 0; }
        break;
      case 'heavy':
        if (b.atkTimer >= 1.8) { sfx.bossAttack.heavy(); spawnBossProj(b, 420, 42); b.atkTimer = 0; }
        break;
      case 'summon':
        if (b.atkTimer >= 3.5 && enemies.length < 22) {
          sfx.bossAttack.summon();
          spawnMinion(b.x, b.y + 40); spawnMinion(b.x + 30, b.y + 20); spawnMinion(b.x - 30, b.y + 20);
          b.atkTimer = 0;
        }
        break;
      case 'spread':
        if (b.atkTimer >= 1.7) {
          sfx.bossAttack.spread();
          const cnt = 9;
          for (let i = 0; i < cnt; i++) {
            const a = (i / cnt) * Math.PI * 2;
            if (bullets.length >= MAX_BULLETS || enemyBulletCount() >= MAX_ENEMY_BULLETS) break;
            bullets.push({ x: b.x, y: b.y + 40, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260, damage: 18, color: b.color, radius: 5, isEnemy: true, dead: false });
          }
          b.atkTimer = 0;
        }
        break;
      case 'beam':
        if (b.atkTimer >= 4.6) { sfx.bossAttack.beam(); spawnBossProj(b, 560, 44); b.atkTimer = 0; b.beamWarned = false; }
        else if (b.atkTimer >= 4.1 && !b.beamWarned) {
          b.beamWarned = true; triggerFlash('#ff5f9b');
          addFloatText(b.x, b.y - 60, '¡CARGANDO LÁSER!', '#ff5f9b');
        }
        break;
      case 'volley':
        if (b.atkTimer >= 1.3) { sfx.bossAttack.volley(); spawnBossProj(b, 420, 20, 5, 0.24); b.atkTimer = 0; }
        break;
      case 'bomb':
        if (b.atkTimer >= 2.0) { sfx.bossAttack.bomb(); spawnBossProj(b, 200, 34); b.atkTimer = 0; }
        break;
      case 'orbs':
        if (b.atkTimer >= 1.4) {
          sfx.bossAttack.orbs();
          const a = Math.atan2(player.y - b.y, player.x - b.x) + (Math.random() - 0.5) * 0.4;
          if (bullets.length < MAX_BULLETS && enemyBulletCount() < MAX_ENEMY_BULLETS) bullets.push({ x: b.x, y: b.y + 40, vx: Math.cos(a) * 300, vy: Math.sin(a) * 300, damage: 18, color: '#e0ffff', radius: 5, isEnemy: true, dead: false });
          b.atkTimer = 0;
        }
        break;
      case 'split':
        if (!b.split && b.hp < b.maxHp / 2) {
          b.split = true; sfx.bossAttack.split();
          spawnMinion(b.x, b.y); spawnMinion(b.x, b.y); spawnMinion(b.x + 25, b.y - 20);
        }
        if (b.atkTimer >= 1.5) { sfx.bossAttack.split(); spawnBossProj(b, 340, 24); b.atkTimer = 0; }
        break;
      case 'rage':
        {
          const hpct = b.hp / b.maxHp;
          const cd = 0.9 + hpct * 1.5;
          if (b.atkTimer >= cd) { sfx.bossAttack.rage(); spawnBossProj(b, 460, 26); b.atkTimer = 0; }
        }
        break;
      default:
        if (b.atkTimer >= 1.5) { spawnBossProj(b, 320, 18); b.atkTimer = 0; }
    }
  }

  function updateBullets(dt) {
    for (const b of bullets) {
      if (b.dead) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.x < -10 || b.x > W + 10 || b.y < -10 || b.y > H + 10) { b.dead = true; continue; }

      if (b.isEnemy) {
        const d = Math.hypot(b.x - player.x, b.y - player.y);
        const playerRadius = (CHARACTERS[player.character].size || 20) * 0.45;
        const hitRadius = playerRadius + (b.radius || 5);
        if (d < hitRadius) {
          if (player.bulwark > 0) {
            // Muralla: refleja la bala enemiga hacia el enemigo
            b.isEnemy = false;
            b.vx *= -1.1; b.vy *= -1.1;
            b.color = '#ffcf76';
            b.damage = 20;
            b.pierce = 1;
            continue;
          }
          if (player.invuln <= 0 && player.stun <= 0) {
            const hit = computePlayerHit(b.damage);
            b.dead = true;
            if (hit.dodged) {
              addFloatText(player.x, player.y - 20, 'ESQUIVA', '#8dfaff');
            } else {
              const damage = hit.dmg;
              player.hp -= damage;
              if (b.stunChance && Math.random() < b.stunChance) { player.stun = 0.6; addFloatText(player.x, player.y - 30, 'STUN', '#ff0'); }
              shake = Math.max(shake, hit.crit ? 0.3 : 0.1);
              addFloatText(player.x, player.y - 20, '-' + damage + (hit.crit ? ' ★CRIT' : ''), hit.crit ? '#ff0' : '#ff5f9b');
              if (player.hp <= 0) { gameOver(); return; }
            }
            }
        }
      } else {
        let hitCount = 0;
        for (const e of enemies) {
          if (e.dead) continue;
          const d = Math.hypot(b.x - e.x, b.y - e.y);
          if (d < e.radius + 4) {
            // ESCUDO (shielder): bloquea balas frontales solo cuando el escudo está listo.
            if (e.shield) {
              if (e.shieldCd <= 0) {
                const facing = Math.atan2(player.y - e.y, player.x - e.x);
                const toBullet = Math.atan2(b.y - e.y, b.x - e.x);
                const diff = Math.abs(Math.atan2(Math.sin(toBullet - facing), Math.cos(toBullet - facing)));
                if (diff < Math.PI / 2) {
                  b.dead = true;
                  e.shieldCd = SHIELD_COOLDOWN; // queda recargando: vulnerable un instante
                  spawnExplosion(e.x + Math.cos(toBullet) * e.radius, e.y + Math.sin(toBullet) * e.radius, 4, e.color, 0.4);
                  break;
                }
              }
            }
            const dealt = Math.max(1, b.damage - (e.resist || 0));
            e.hp -= dealt;
            hitCount++;
            if (e.isElite) e.stun = 0.25; // Élite se aturde brevemente al recibir daño
            if (b.crit) addFloatText(e.x, e.y - e.radius - 6, '★CRIT', '#ff0');
            if (e.hp <= 0) killEnemy(e);
            // Knockback al enemigo al dispararle
            applyKnockback(e, b.x, b.y, 60);
            if (b.pierce && hitCount >= b.pierce) { b.dead = true; break; }
          }
        }
        if (boss && !boss.dead && !b.dead) {
          const d = Math.hypot(b.x - boss.x, b.y - boss.y);
                    if (d < boss.radius + 4) { boss.hp -= b.damage; boss.hitFlash = Math.max(boss.hitFlash, 0.15); b.dead = true; hitstop = 0.03; }
        }
      }
    }
    bullets = bullets.filter((b) => !b.dead);
  }

  function updateParticles(dt) {
    for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
    particles = particles.filter((p) => p.life > 0);
  }

  function updatePickups(dt) {
    for (const p of pickups) {
      if (p.dead) continue;
      const d = Math.hypot(p.x - player.x, p.y - player.y);
      if (d < 30) { p.dead = true; shards += 1; addFloatText(p.x, p.y - 10, '+1', '#7cf8ff'); sfx.pickup(); }
    }
    pickups = pickups.filter((p) => !p.dead);
  }

  function updateWeaponPickups(dt) {
    for (const wp of weaponPickups) {
      if (wp.dead) continue;
      const d = Math.hypot(wp.x - player.x, wp.y - player.y);
      if (d < 30) {
        wp.dead = true;
        if (inventory.length < INVENTORY_SLOTS) {
          inventory.push(wp.weapon);
          addFloatText(wp.x, wp.y - 10, 'GUARDADO', '#ffcf76');
        } else {
          currentWeapon = wp.weapon;
          addFloatText(wp.x, wp.y - 10, currentWeapon.name, RARITY_COLORS[currentWeapon.rarity]);
        }
        sfx.pickup();
      }
    }
    weaponPickups = weaponPickups.filter((wp) => !wp.dead);
  }

  function updateFloatTexts(dt) {
    for (const ft of floatTexts) { ft.y -= 60 * dt; ft.life -= dt; }
    floatTexts = floatTexts.filter((ft) => ft.life > 0);
  }

  function addFloatText(x, y, text, color) { floatTexts.push({ x, y, text, color, life: 0.8 }); }

  function updateTrails(dt) {
    for (const t of trails) { t.life -= dt; t.size *= 0.9; }
    trails = trails.filter((t) => t.life > 0);
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
    const color = b.color;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(Math.atan2(b.vy, b.vx));
    ctx.fillStyle = color;
    ctx.strokeStyle = color;

    if (def.shape === 'bullet') {
      // Proyectil tipo bala: cuerpo recto + punta cónica al frente (+x).
      const L = def.len * (1 + g), W = def.w * (1 + g);
      ctx.beginPath();
      ctx.rect(-L * 0.55, -W / 2, L * 0.75, W);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(L * 0.2, -W / 2);
      ctx.lineTo(L * 0.5, 0);
      ctx.lineTo(L * 0.2, W / 2);
      ctx.closePath();
      ctx.fill();
    } else if (def.shape === 'arrow') {
      // Flecha: astil + cabeza triangular + plumas traseras.
      const L = def.len * (1 + g);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-L * 0.55, 0);
      ctx.lineTo(L * 0.42, 0);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(L * 0.42, -2.5);
      ctx.lineTo(L * 0.78, 0);
      ctx.lineTo(L * 0.42, 2.5);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-L * 0.55, 0); ctx.lineTo(-L * 0.32, -3);
      ctx.moveTo(-L * 0.55, 0); ctx.lineTo(-L * 0.32, 3);
      ctx.stroke();
    } else if (def.shape === 'laser') {
      // Rayo fino: núcleo brillante + centro blanco.
      const L = def.len * (1 + g), W = def.w * (1 + g);
      ctx.fillStyle = color;
      ctx.fillRect(-L / 2, -W / 2, L, W);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillRect(-L / 2, -W * 0.25, L, W * 0.5);
    } else if (def.shape === 'orb') {
      // Orbe de plasma: núcleo + centro claro.
      const r = def.r * (1 + g);
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath(); ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2); ctx.fill();
    } else if (def.shape === 'pellet') {
      // Perdigón pequeño (escopeta).
      const r = def.r * (1 + g);
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    } else if (def.shape === 'flame') {
      // Llama: gota de fuego con punta al frente y núcleo claro.
      const L = def.len * (1 + g), W = def.w * (1 + g);
      ctx.beginPath();
      ctx.moveTo(L * 0.45, 0);
      ctx.quadraticCurveTo(0, -W / 2, -L * 0.55, 0);
      ctx.quadraticCurveTo(0, W / 2, L * 0.45, 0);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.moveTo(L * 0.18, 0);
      ctx.quadraticCurveTo(0, -W * 0.35, -L * 0.22, 0);
      ctx.quadraticCurveTo(0, W * 0.35, L * 0.18, 0);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    } else {
      // Fallback: círculo pequeño.
      const r = (def.r || 2.5) * (1 + g);
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    }

    ctx.restore();
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
    const radius = (1 - vfx.life) * 130;
    ctx.strokeStyle = vfx.color;
    ctx.lineWidth = 5;
    ctx.globalAlpha = vfx.life;
    ctx.beginPath(); ctx.arc(vfx.x, vfx.y, radius, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function drawSpecialCooldown() {
    const char = CHARACTERS[player.character];
    const cx = player.x, cy = player.y;
    const radius = char.size + 16;

    if (player.specialCd > 0) {
      const progress = 1 - player.specialCd / char.maxCd;
      ctx.strokeStyle = 'rgba(124, 248, 255, 0.5)';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke();

      ctx.strokeStyle = char.color;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      const startAngle = -Math.PI / 2;
      ctx.arc(cx, cy, radius, startAngle, startAngle + progress * Math.PI * 2);
      ctx.stroke();
      ctx.lineCap = 'default';
    } else {
      ctx.fillStyle = char.color;
      ctx.font = 'bold 18px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(char.skillIcon, cx, cy - radius - 8);
    }
  }

  function drawWeaponHUD() {
    if (!showHUD) return;
    const weapon = currentWeapon;
    const char = CHARACTERS[player.character];
    const iconColor = RARITY_COLORS[weapon.rarity];
    const w = 118, h = 40;
    const wx = W - w - 12, wy = 10;

    ctx.textAlign = 'left';

    // === ARMA (panel pequeño) ===
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.strokeStyle = iconColor; ctx.lineWidth = 1.5;
    ctx.fillRect(wx, wy, w, h); ctx.strokeRect(wx, wy, w, h);
    ctx.font = 'bold 15px system-ui';
    ctx.fillStyle = iconColor;
    ctx.fillText(weapon.emoji, wx + 7, wy + 24);
    ctx.font = 'bold 9px system-ui';
    ctx.fillStyle = '#fff';
    ctx.fillText(weapon.name, wx + 30, wy + 16);
    ctx.font = '8px system-ui';
    ctx.fillStyle = '#aaa';
    ctx.fillText('Nv ' + currentWeaponLevel() + ' · teclas 1-6', wx + 30, wy + 30);

    // === HABILIDAD (panel pequeño + relleno de cooldown) ===
    const sy = wy + h + 6;
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.strokeStyle = char.color; ctx.lineWidth = 1.5;
    ctx.fillRect(wx, sy, w, h); ctx.strokeRect(wx, sy, w, h);

    // Relleno que se completa de abajo hacia arriba según el cooldown
    const cd = player.specialCd > 0 ? 1 - player.specialCd / char.maxCd : 1;
    const fillH = Math.max(0, Math.min(1, cd)) * (h - 2);
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = char.color;
    ctx.fillRect(wx + 1, sy + h - 1 - fillH, w - 2, fillH);
    ctx.globalAlpha = 1;

    ctx.font = 'bold 15px system-ui';
    ctx.fillStyle = char.color;
    ctx.fillText(char.skillIcon, wx + 7, sy + 24);
    ctx.font = 'bold 8px system-ui';
    ctx.fillStyle = cd >= 1 ? '#fff' : '#aaa';
    ctx.fillText(cd >= 1 ? '¡LISTO! ✓' : 'CD ' + Math.ceil(player.specialCd) + 's', wx + 30, sy + 16);
    ctx.font = '8px system-ui';
    ctx.fillStyle = '#aaa';
    ctx.fillText(char.skillName, wx + 30, sy + 30);

    // === CONSUMIBLES (indicador con la tecla F) ===
    if (consumableItems.length > 0) {
      const cy = sy + h + 6;
      ctx.fillStyle = 'rgba(0,0,0,0.72)';
      ctx.strokeStyle = '#7cf8ff'; ctx.lineWidth = 1.5;
      ctx.fillRect(wx, cy, w, h); ctx.strokeRect(wx, cy, w, h);
      ctx.font = 'bold 15px system-ui';
      ctx.fillText(consumableItems[0].icon, wx + 7, cy + 24);
      ctx.font = 'bold 9px system-ui';
      ctx.fillStyle = '#fff';
      ctx.fillText('x' + consumableItems.length, wx + 30, cy + 16);
      ctx.font = '8px system-ui';
      ctx.fillStyle = '#aaa';
      ctx.fillText('F: usar consumible', wx + 30, cy + 30);
    }
  }

  function drawStats() {
    const char = CHARACTERS[player.character];
    const weapon = currentWeapon;
    const panelX = 10, panelY = 60, panelW = 260, panelH = 250;

    ctx.fillStyle = 'rgba(0,0,0,0.9)';
    ctx.fillRect(panelX, panelY, panelW, panelH);
    ctx.strokeStyle = RARITY_COLORS[weapon.rarity];
    ctx.lineWidth = 2;
    ctx.strokeRect(panelX, panelY, panelW, panelH);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px system-ui';
    ctx.textAlign = 'left';
    ctx.fillText('ESTADÍSTICAS', panelX + 10, panelY + 20);

    ctx.font = '12px system-ui';
    ctx.fillStyle = '#aaa';
    const lines = [
      `Personaje: ${char.name}`,
      `Pasiva: ${char.passive}`,
      `Habilidad: ${char.skillIcon} ${char.skillName} (CD: ${char.maxCd}s)`,
      `Nivel: ${player.level}  |  XP: ${player.xp}/${player.xpToNext}`,
      `HP: ${Math.round(player.hp)}/${player.maxHp}  |  Armadura: ${player.armor}`,
      `Velocidad: ${Math.round(player.speed)}  |  Suerte: ${player.luck}`,
      `Agilidad: ${player.agility.toFixed(2)}x (maniobralidad)`,
      `Arma: ${weapon.name} (${weapon.rarity}) | Nv ${currentWeaponLevel()}` + (weaponVisualTier() > 0 ? ` | Tier ${weaponVisualTier()} (${BULLET_TIER_COLORS[weaponVisualTier()]})` : ''),
      `Daño: ${weapon.damage + permUpgrades.damage * 2 + currentWeaponLevel()}`,
      `Inventario: ${inventory.length}/${INVENTORY_SLOTS}  |  Consumibles: ${consumableItems.length}`,
    ];
    lines.forEach((line, i) => ctx.fillText(line, panelX + 10, panelY + 45 + i * 18));
  }

  function drawEnemy(e) {
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.fillStyle = e.color;
    ctx.shadowBlur = e.isElite ? 14 : 10;
    ctx.shadowColor = e.color;

    const r = e.radius;
    if (e.shape === 'hex') {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      ctx.closePath(); ctx.fill();
    } else if (e.shape === 'triangle') {
      ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r * 0.87, r * 0.5); ctx.lineTo(-r * 0.87, r * 0.5); ctx.closePath(); ctx.fill();
    } else if (e.shape === 'diamond') {
      ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r, 0); ctx.lineTo(0, r); ctx.lineTo(-r, 0); ctx.closePath(); ctx.fill();
    } else if (e.shape === 'atom') {
      ctx.beginPath(); ctx.arc(0, 0, r * 0.4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = e.color;
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2 + frame * 0.1; ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.3, a, 0, Math.PI * 2); ctx.stroke(); }
    } else if (e.shape === 'rock') {
      ctx.beginPath();
      for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; const rr = r * (0.7 + (i / 7) * 0.3); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      ctx.closePath(); ctx.fill();
      // Brillo interior para que se vea intencional en lugar de "roto".
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; const rr = r * (0.38 + (i / 7) * 0.16); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      ctx.closePath(); ctx.fill();
    } else if (e.shape === 'dot') {
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(-r * 0.3, -r * 0.3, r * 0.2, 0, Math.PI * 2); ctx.arc(r * 0.3, -r * 0.3, r * 0.2, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    }

    if (e.isElite) {
      ctx.strokeStyle = '#ff0';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, r + 4, 0, Math.PI * 2); ctx.stroke();
    }

    ctx.shadowBlur = 0;
    ctx.restore();
  }

    function drawBoss() {
    if (!boss || boss.dead) return;
    if (boss.hitFlash > 0) boss.hitFlash = Math.max(0, boss.hitFlash - 0.05);
    ctx.save();
    ctx.translate(boss.x, boss.y);
    ctx.fillStyle = boss.color;
    ctx.shadowBlur = 30;
    ctx.shadowColor = boss.color;

    // Barra de salud del jefe
    const barW = 260, barH = 16;
    const hpPct = Math.max(0, boss.hp) / boss.maxHp;
    ctx.save();
    ctx.translate(0, -boss.radius - 40);
    ctx.fillStyle = '#222';
    ctx.fillRect(-barW / 2, 0, barW, barH);
    ctx.fillStyle = hpPct > 0.4 ? '#7cf8ff' : (hpPct > 0.2 ? '#ffcf76' : '#ff5f9b');
    ctx.fillRect(-barW / 2, 0, barW * hpPct, barH);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(-barW / 2, 0, barW, barH);
    ctx.font = 'bold 11px system-ui';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.fillText(Math.ceil(boss.hp) + ' / ' + boss.maxHp, 0, 13);
    ctx.restore();

    // Flash blanco al recibir daño
    if (boss.hitFlash > 0) {
      ctx.globalAlpha = boss.hitFlash;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; ctx.lineTo(Math.cos(a) * boss.radius, Math.sin(a) * boss.radius); }
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    const r = boss.radius;
    ctx.save();
    if (boss.shape === 'circle') {
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.closePath(); ctx.fill();
    } else if (boss.shape === 'diamond') {
// Anillo indicador de FASE 2
    if (boss.phase2) {
      ctx.strokeStyle = 'rgba(255, 95, 155, 0.85)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, r + 12 + Math.sin(frame * 0.1) * 3, 0, Math.PI * 2);
      ctx.stroke();
    }
      ctx.beginPath(); ctx.moveTo(0, -r * 1.2); ctx.lineTo(r * 0.9, 0); ctx.lineTo(0, r * 1.2); ctx.lineTo(-r * 0.9, 0); ctx.closePath(); ctx.fill();
    } else if (boss.shape === 'rock') {
      ctx.beginPath();
      for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; const rr = r * (0.75 + (i / 7) * 0.25); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      ctx.closePath(); ctx.fill();
    } else {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();

    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-8, -5, 6, 0, Math.PI * 2); ctx.arc(8, -5, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(-8, -5, 3, 0, Math.PI * 2); ctx.arc(8, -5, 3, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = boss.color;
    ctx.font = 'bold 13px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(boss.name, 0, -r - 10);

    ctx.shadowBlur = 0;
    ctx.restore();
  }

  function drawPlayer() {
    const char = CHARACTERS[player.character];
    ctx.save();
    ctx.translate(player.x, player.y);

    const invulnBlink = player.invuln > 0 && Math.floor(player.invuln * 20) % 2 === 0;
    const stunBlink = player.stun > 0 && Math.floor(player.stun * 20) % 2 === 0;
    const criticalHealth = player.hp > 0 && player.hp / player.maxHp <= 0.25;
    ctx.globalAlpha = invulnBlink ? 0.4 : (stunBlink ? 0.6 : 1);

    // Señal visual de vida crítica: un contorno rojo late alrededor de cualquier personaje.
    if (criticalHealth) {
      const pulse = 0.35 + Math.sin(frame * 0.22) * 0.25;
      ctx.save();
      ctx.globalAlpha = pulse;
      ctx.strokeStyle = '#ff3048';
      ctx.shadowColor = '#ff3048';
      ctx.shadowBlur = 18;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, char.size + 10 + Math.sin(frame * 0.18) * 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Fase Fantasma: aura espectral pulsante
    if (player.phase > 0) {
      const ghostPulse = 0.3 + Math.sin(frame * 0.3) * 0.2;
      ctx.strokeStyle = '#caa7ff';
      ctx.globalAlpha = ghostPulse;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, char.size + 20 + Math.sin(frame * 0.2) * 5, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, char.size + 8, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = invulnBlink ? 0.4 : 1;
    }

    // Muralla: escudo dorado visible
    if (player.bulwark > 0) {
      const shieldPulse = 0.4 + Math.sin(frame * 0.15) * 0.2;
      ctx.strokeStyle = '#ffcf76';
      ctx.globalAlpha = shieldPulse;
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(0, 0, char.size + 15, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = invulnBlink ? 0.4 : 1;
    }

    const breathe = Math.sin(frame * 0.05) * 1.5;
    const bob = Math.sin(frame * 0.12) * 2;
    ctx.translate(0, bob + breathe);

    // Aura pulsante
    const auraPulse = 0.15 + Math.sin(frame * 0.08) * 0.05;
    ctx.strokeStyle = char.color;
    ctx.globalAlpha = auraPulse * (invulnBlink ? 0.4 : 1);
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, char.size + 12 + Math.sin(frame * 0.1) * 3, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = invulnBlink ? 0.4 : 1;

    ctx.shadowBlur = 30;
    ctx.shadowColor = char.color;
    const size = char.size;
    const cid = char.id || player.character;

    if (cid === 'boti') {
      // Hexágono
      ctx.fillStyle = char.bodyColor;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; ctx.lineTo(Math.cos(a) * size, Math.sin(a) * size); }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = char.color;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; ctx.lineTo(Math.cos(a) * (size * 0.6), Math.sin(a) * (size * 0.6)); }
      ctx.closePath(); ctx.fill();
    } else if (cid === 'nova') {
      // Diamante/rombo
      ctx.fillStyle = char.bodyColor;
      ctx.beginPath();
      ctx.moveTo(0, -size * 1.2);
      ctx.lineTo(size * 0.8, 0);
      ctx.lineTo(0, size * 1.2);
      ctx.lineTo(-size * 0.8, 0);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = char.color;
      ctx.beginPath();
      ctx.moveTo(0, -size * 0.7);
      ctx.lineTo(size * 0.45, 0);
      ctx.lineTo(0, size * 0.7);
      ctx.lineTo(-size * 0.45, 0);
      ctx.closePath(); ctx.fill();
    } else if (cid === 'rook') {
      // Escudo hexagonal grueso
      ctx.fillStyle = char.bodyColor;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + Math.PI / 6; ctx.lineTo(Math.cos(a) * size * 1.1, Math.sin(a) * size * 1.1); }
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = char.color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + Math.PI / 6; ctx.lineTo(Math.cos(a) * size * 0.7, Math.sin(a) * size * 0.7); }
      ctx.closePath(); ctx.stroke();
      ctx.fillStyle = char.color;
      ctx.beginPath(); ctx.arc(0, 0, size * 0.3, 0, Math.PI * 2); ctx.fill();
    } else if (cid === 'swarm') {
      // Círculo con anillos orbitales
      ctx.fillStyle = char.bodyColor;
      ctx.beginPath(); ctx.arc(0, 0, size, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = char.color;
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + frame * 0.05;
        ctx.beginPath(); ctx.ellipse(0, 0, size * 1.3, size * 0.4, a, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.fillStyle = char.color;
      ctx.beginPath(); ctx.arc(0, 0, size * 0.5, 0, Math.PI * 2); ctx.fill();
    }

    // Ojos
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(-5, -1, 2.5, 0, Math.PI * 2); ctx.arc(5, -1, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = char.eyeColor;
    ctx.beginPath(); ctx.arc(-5, -1, 1.2, 0, Math.PI * 2); ctx.arc(5, -1, 1.2, 0, Math.PI * 2); ctx.fill();

    ctx.shadowBlur = 0;
    ctx.restore();
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
  NV.getPlayer = () => player;
})();


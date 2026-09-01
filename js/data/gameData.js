// ===== DATOS PUROS DEL JUEGO (sin lógica) =====
// Expuestos en window.NV. Se carga ANTES de game.js, que los usa vía alias locales.
(() => {
  'use strict';
  const NV = window.NV;

  // === MEJORAS PERMANENTES (meta) ===
  // El coste crece con el nivel y tienen un tope máximo (MAX_PERM_LEVEL).
  NV.PERM_UPGRADES = [
    { key: 'damage', name: 'Daño', base: 40, desc: '+2 daño por nivel' },
    { key: 'speed',  name: 'Velocidad', base: 50, desc: '+15% velocidad por nivel' },
    { key: 'hp',     name: 'Vida', base: 30, desc: '+20 HP máx por nivel' },
    { key: 'armor',  name: 'Armadura', base: 35, desc: '+1 armadura por nivel' },
    { key: 'luck',   name: 'Suerte', base: 20, desc: '+10 suerte · reduce el crítico enemigo' },
    { key: 'crit',   name: 'Crítico', base: 45, desc: '+0,5% prob. de crítico propio por nivel' },
    { key: 'dodge',  name: 'Esquiva', base: 40, desc: '+0,4% de esquivar golpes por nivel' },
    { key: 'regen',  name: 'Regeneración', base: 38, desc: '+0,2 HP/s fuera de peligro por nivel' },
    { key: 'greed',  name: 'Codicia', base: 42, desc: '+3% chance de drop de 💎 por nivel' },
  ];

  // Defaults derivados de la lista de permanentes: evita duplicar claves en game.js
  // y permite que guardados antiguos reciban claves nuevas sin romper compatibilidad.
  NV.defaultPermUpgrades = function () {
    const defaults = {};
    NV.PERM_UPGRADES.forEach((u) => { defaults[u.key] = 0; });
    return defaults;
  };

  NV.normalizePermUpgrades = function (saved) {
    return Object.assign(NV.defaultPermUpgrades(), saved || {});
  };

  // === PERSONAJES ===
  NV.CHARACTERS = {
    boti: {
      name: 'BOTI', color: '#7cf8ff', bodyColor: '#4a9eff', eyeColor: '#fff', size: 22,
      special: 'meteor', maxCd: 14, passive: 'Regenera 1 HP cada 5s',
      skillName: 'Lluvia Estelar', skillDesc: 'Meteoritos devastadores contra enemigos normales; recarga larga y daño reducido contra jefes',
      stats: { hp: 120, speed: 200, armor: 0, luck: 0 },
    },
    nova: {
      name: 'NOVA', color: '#caa7ff', bodyColor: '#9b59b6', eyeColor: '#ff0', size: 18,
      special: 'phase', maxCd: 7, passive: 'Daño +20%, recibe +20%', takeDmgMult: 1.2,
      skillName: 'Fase Fantasma', skillDesc: 'Aura espectral de área potente (afecta jefes); al terminar, detona un golpe final sobre lo alcanzado',
      stats: { hp: 80, speed: 280, armor: 0, luck: 5 },
    },
    rook: {
      name: 'ROOK', color: '#ffcf76', bodyColor: '#f39c12', eyeColor: '#000', size: 26,
      special: 'bulwark', maxCd: 12, passive: '-15% daño recibido', takeDmgMult: 0.85,
      skillName: 'Muralla', skillDesc: 'Escudo que refleja balas con más fuerza; onda de choque que aturde y empuja al activarse',
      stats: { hp: 160, speed: 150, armor: 5, luck: 0 },
    },
    swarm: {
      name: 'ENJAMBRE', color: '#8dfaff', bodyColor: '#00d4aa', eyeColor: '#fff', size: 16,
      special: 'hivemind', maxCd: 10, passive: '15% esquiva', dodge: 0.15,
      skillName: 'Drones de Combate', skillDesc: '6 drones escoltas que apuntan solos al enemigo o jefe más cercano a distancia',
      stats: { hp: 90, speed: 240, armor: 0, luck: 10 },
    },
  };

  // === ARMAS (10) ===
  NV.WEAPONS = [
    { id: 'pistol', name: 'Pistola', range: 380, damage: 12, speed: 500, fireRate: 30, color: '#fff', rarity: 'common', pro: 'Versátil', con: 'Daño bajo' },
    { id: 'rifle', name: 'Rifle', range: 480, damage: 20, speed: 700, fireRate: 25, color: '#4ade80', rarity: 'uncommon', pro: 'Daño alto', con: 'Cadencia media' },
    { id: 'smg', name: 'Subfusil', range: 320, damage: 7, speed: 450, fireRate: 12, color: '#facc15', rarity: 'rare', pro: 'Muy rápido', con: 'Daño bajo' },
    { id: 'shotgun', name: 'Escopeta', range: 240, damage: 8, speed: 400, fireRate: 45, count: 5, spread: 0.25, color: '#f97316', rarity: 'rare', pro: 'Área', con: 'Corto alcance' },
    { id: 'sniper', name: 'Francotirador', range: 700, damage: 50, speed: 1200, fireRate: 70, color: '#ef4444', rarity: 'epic', pro: 'Daño extrema', con: 'Lenta' },
    { id: 'laser', name: 'Láser', range: 450, damage: 25, speed: 900, fireRate: 20, color: '#f472b6', rarity: 'epic', pro: 'Penetra 1', con: 'Daño medio' },
    { id: 'plasma', name: 'Plasma', range: 520, damage: 40, speed: 600, fireRate: 35, count: 2, spread: 0.1, color: '#a855f7', rarity: 'legendary', pro: 'Doble disparo', con: 'Lento' },
    { id: 'flamethrower', name: 'Lanzallamas', range: 170, damage: 6, speed: 260, fireRate: 14, count: 3, spread: 0.35, color: '#fb923c', rarity: 'epic', pro: 'Área amplia', con: 'Daño bajo' },
    { id: 'bow', name: 'Arco', range: 540, damage: 22, speed: 800, fireRate: 40, pierce: 3, color: '#22c55e', rarity: 'rare', pro: 'Penetra 3', con: 'Cadencia media' },
    { id: 'railgun', name: 'Cañón de Riel', range: 800, damage: 70, speed: 1500, fireRate: 90, pierce: 5, color: '#06b6d4', rarity: 'legendary', pro: 'Máximo daño', con: 'Muy lenta' },
  ];

  // === COLORES DE TIER DE DISPARO: cada 10 niveles cambia la apariencia ===
  NV.BULLET_TIER_COLORS = ['#7cf8ff', '#ffd700', '#ff5f8a', '#a855f7', '#00ffd8', '#ffffff'];

  // === COLORES DE RAREZA ===
  NV.RARITY_COLORS = { common: '#fff', uncommon: '#4ade80', rare: '#facc15', epic: '#f472b6', legendary: '#a855f7' };

  // === FORMAS DE PROYECTIL POR ARMA (solo render; no participan en colisiones) ===
  NV.BULLET_DEFS = {
    pistol: { shape: 'bullet', len: 7,  w: 3 },
    rifle:  { shape: 'bullet', len: 10, w: 3 },
    smg:    { shape: 'bullet', len: 6,  w: 3 },
    shotgun:{ shape: 'pellet', r: 2.2 },
    sniper: { shape: 'bullet', len: 16, w: 3.5 },
    laser:  { shape: 'laser',  len: 16, w: 2 },
    plasma: { shape: 'orb',    r: 4 },
    flamethrower: { shape: 'flame', len: 8, w: 6 },
    bow:    { shape: 'arrow',  len: 12 },
    railgun:{ shape: 'bullet', len: 20, w: 3 },
  };

  // === ENEMIGOS BÁSICOS (7 tipos) ===
  NV.ENEMY_TYPES = [
    { id: 'drone', name: 'DRON', hp: 25, speed: 75, radius: 11, color: '#f07bad', shape: 'circle', score: 10, xp: 10, behavior: 'chase', knockbackRes: 0, damage: 12, minWave: 1 },
    { id: 'runner', name: 'CORREDOR', hp: 15, speed: 145, radius: 9, color: '#ffcf76', shape: 'triangle', score: 15, xp: 15, behavior: 'chase', knockbackRes: 0.3, damage: 10, minWave: 1 },
    { id: 'tank', name: 'TANQUE', hp: 60, speed: 40, radius: 20, color: '#ef9d49', shape: 'hex', score: 30, xp: 35, behavior: 'chase', knockbackRes: 0.8, damage: 18, minWave: 3, resist: 3 },
    { id: 'shielder', name: 'ESCUDO', hp: 35, speed: 65, radius: 14, color: '#caa7ff', shape: 'diamond', score: 25, xp: 30, behavior: 'shield', knockbackRes: 0.6, damage: 8, minWave: 6, shield: true },
    { id: 'swarmlet', name: 'ENJAMBITO', hp: 10, speed: 115, radius: 7, color: '#22d3ee', shape: 'atom', score: 8, xp: 8, behavior: 'swarm', knockbackRes: 0.1, damage: 8, minWave: 9 },
    { id: 'spitter', name: 'ESCOPURAS', hp: 22, speed: 50, radius: 13, color: '#6dc4c0', shape: 'rock', score: 18, xp: 25, behavior: 'ranged', knockbackRes: 0.4, damage: 15, minWave: 12, stunChance: 0.2 },
    { id: 'wisp', name: 'ESPÍRITU', hp: 12, speed: 160, radius: 6, color: '#4ade80', shape: 'dot', score: 6, xp: 6, behavior: 'erratic', knockbackRes: 0.2, damage: 6, minWave: 15 },
    { id: 'kamikaze', name: 'KAMIKAZE', hp: 20, speed: 125, radius: 10, color: '#ff5f3d', shape: 'triangle', score: 22, xp: 22, behavior: 'kami', knockbackRes: 0.2, damage: 14, minWave: 10 },
  ];

  // === ÉLITES (8 tipos) ===
  NV.ELITE_TYPES = [
    { name: 'ÉLITE', hp: 90, speed: 90, radius: 20, color: '#ff0', shape: 'hex', score: 50, xp: 50, behavior: 'chase', damage: 20 },
    { name: 'RÁPIDO', hp: 40, speed: 190, radius: 14, color: '#0ff', shape: 'triangle', score: 30, xp: 30, behavior: 'erratic', damage: 15 },
    { name: 'TANQUE', hp: 160, speed: 35, radius: 30, color: '#f80', shape: 'rock', score: 60, xp: 60, behavior: 'chase', damage: 25, resist: 3 },
    { name: 'ASESINO', hp: 55, speed: 165, radius: 12, color: '#f0f', shape: 'diamond', score: 40, xp: 40, behavior: 'chase', damage: 30 },
    { name: 'FANTASMA', hp: 65, speed: 145, radius: 16, color: '#e0ffff', shape: 'circle', score: 45, xp: 45, behavior: 'erratic', damage: 25 },
    { name: 'CAOS', hp: 105, speed: 130, radius: 22, color: '#ff4500', shape: 'atom', score: 55, xp: 55, behavior: 'erratic', damage: 22 },
    { name: 'GOLIATH', hp: 210, speed: 25, radius: 36, color: '#ff1493', shape: 'rock', score: 100, xp: 100, behavior: 'chase', damage: 35, stunChance: 0.15, resist: 3 },
    { name: 'VELOCITY', hp: 40, speed: 220, radius: 10, color: '#00ff88', shape: 'dot', score: 35, xp: 35, behavior: 'chase', damage: 18 },
  ];

  // === BOSSES (10 tipos) ===
  NV.BOSS_TYPES = [
    { name: 'JEFE', hp: 300, radius: 50, color: '#ff5f9b', speed: 30, pattern: 'chase', attack: 'repeater', shape: 'hex', stunChance: 0 },
    { name: 'TITÁN', hp: 450, radius: 55, color: '#ff8c00', speed: 25, pattern: 'charge', attack: 'heavy', shape: 'hex', stunChance: 0.1 },
    { name: 'SEÑOR DEL VACÍO', hp: 600, radius: 65, color: '#dc143c', speed: 20, pattern: 'summon', attack: 'summon', shape: 'circle', stunChance: 0.15 },
    { name: 'GUARDIÁN', hp: 350, radius: 45, color: '#00bfff', speed: 35, pattern: 'circle', attack: 'spread', shape: 'hex', stunChance: 0.05 },
    { name: 'DESTRUCTOR', hp: 500, radius: 60, color: '#ff0000', speed: 28, pattern: 'burst', attack: 'beam', shape: 'rock', stunChance: 0.25 },
    { name: 'NÉMESIS', hp: 400, radius: 48, color: '#8b00ff', speed: 40, pattern: 'teleport', attack: 'volley', shape: 'diamond', stunChance: 0.08 },
    { name: 'COLOSO', hp: 700, radius: 70, color: '#ff4500', speed: 18, pattern: 'slow_charge', attack: 'bomb', shape: 'rock', stunChance: 0.2 },
    { name: 'FANTASMA', hp: 280, radius: 40, color: '#e0ffff', speed: 45, pattern: 'phase', attack: 'orbs', shape: 'circle', stunChance: 0.12 },
    { name: 'MUTANTE', hp: 380, radius: 52, color: '#32cd32', speed: 32, pattern: 'split', attack: 'split', shape: 'hex', stunChance: 0.1 },
    { name: 'APOCALIPSIS', hp: 800, radius: 75, color: '#ff1493', speed: 22, pattern: 'rage', attack: 'rage', shape: 'rock', stunChance: 0.18 },
  ];

  // Eventos de oleada aleatorios (cada ~3 oleadas): modifican la run sin tocar las mecánicas base.
  NV.WAVE_EVENTS = {
    elites:  { name: 'DIAS DE ÉLITES',   color: '#ff0',    desc: '¡Más élites' },
    payday:  { name: 'DÍA DE PAGO',      color: '#7cf8ff', desc: 'Drops de 💎 x2' },
    fog:     { name: 'NEBLINA',          color: '#caa7ff', desc: 'Visibilidad reducida' },
    mines:   { name: 'CAMPO MINADO',     color: '#ff5f9b', desc: '¡Enemigos explosivos!' },
  };
})();

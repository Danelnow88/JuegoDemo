// ===== DATOS: definiciones de consumibles (se usan con la tecla F en partida) =====
// Puro datos de efectos. La lógica está en game.js (useConsumable), que lee estos
// valores en vez de hardcodearlos. Se carga ANTES de game.js.
(() => {
  'use strict';
  const NV = window.NV;

  NV.CONSUMABLES = {
    potion:    { key: 'potion',    name: 'Poción',     useName: 'POCIÓN',     desc: 'Cura 40 HP (tecla F en partida)',     price: 10, banner: 'Poción guardada (F para usar)',  color: '#22c55e', hp: 40 },
    overdrive: { key: 'overdrive', name: 'Overdrive',  useName: 'OVERDRIVE',  desc: '+50% velocidad 5s (tecla F)',         price: 18, banner: 'Overdrive guardado (F)',         color: '#caa7ff', speedMult: 1.5, duration: 5 },
    shield:    { key: 'shield',    name: 'Escudo',     useName: 'ESCUDO',     desc: 'Invulnerable 2s (tecla F)',           price: 22, banner: 'Escudo guardado (F)',            color: '#ffcf76', duration: 2 },
    bomb:      { key: 'bomb',      name: 'Bomba',      useName: 'BOMBA',      desc: 'Daña 25% HP a todos (tecla F)',       price: 34, banner: 'Bomba guardada (F)',             color: '#ff5f9b' },
    freeze:    { key: 'freeze',    name: 'Congelante', useName: 'CONGELANTE', desc: 'Enemigos lentos 50% por 4s (F)',      price: 26, banner: 'Congelante guardado (F)',        color: '#67e8f9', duration: 4 },
    magnet:    { key: 'magnet',    name: 'Imán',       useName: 'IMÁN',       desc: 'Atrae todos los shards/armas (F)',    price: 20, banner: 'Imán guardado (F)',              color: '#7cf8ff' },
    bounty:    { key: 'bounty',    name: 'Recompensa', useName: 'RECOMPENSA', desc: '10s: kills dan +1 💎 y x2 score (F)', price: 30, banner: 'Recompensa guardada (F)',        color: '#ffd700', duration: 10 },
  };
  NV.CONSUMABLE_ORDER = ['potion', 'overdrive', 'shield', 'bomb', 'freeze', 'magnet', 'bounty'];
  NV.consumableList = function () {
    return NV.CONSUMABLE_ORDER.map((key) => NV.CONSUMABLES[key]).filter(Boolean);
  };
  Object.freeze(NV.CONSUMABLES);
  Object.freeze(NV.CONSUMABLE_ORDER);
})();

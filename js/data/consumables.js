// ===== DATOS: definiciones de consumibles (se usan con la tecla F en partida) =====
// Puro datos de efectos. La lógica está en game.js (useConsumable), que lee estos
// valores en vez de hardcodearlos. Se carga ANTES de game.js.
(() => {
  'use strict';
  const NV = window.NV;

  NV.CONSUMABLES = {
    potion:    { hp: 40,                    icon: '🧪', name: 'POCIÓN',    color: '#0f0' },
    overdrive: { speedMult: 1.5, duration: 5, icon: '⚡', name: 'OVERDRIVE', color: '#caa7ff' },
    shield:    { duration: 2,               icon: '🛡', name: 'ESCUDO',   color: '#ffcf76' },
  };
  Object.freeze(NV.CONSUMABLES);
})();

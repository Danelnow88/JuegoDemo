// ===== UTILIDADES PURAS (sin estado) =====
// Funciones de uso general expuestas en window.NV.
(() => {
  'use strict';
  const NV = window.NV;

  // Formatea el puntaje: entero con separador de miles y abreviación en números grandes
  // (ej. 12,3K / 1,2M) para que nunca desborde su contenedor.
  NV.formatPoints = function (n) {
    const v = Math.round(n);
    const abs = Math.abs(v);
    if (abs >= 1000000) return (v / 1000000).toFixed(1).replace('.', ',') + 'M';
    if (abs >= 100000) return Math.round(v / 1000) + 'K';
    return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  // Arma siguiente/anterior en una lista circular (por referencia). Si el arma actual
  // no está en la lista, entra por los extremos. dir: +1 rueda arriba, -1 abajo.
  NV.cycleWeapon = function (current, list, dir) {
    if (!list || list.length === 0) return current;
    let i = list.indexOf(current);
    if (i === -1) return list[dir > 0 ? 0 : list.length - 1];
    i = (i + (dir > 0 ? 1 : -1) + list.length) % list.length;
    return list[i];
  };

})();

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
})();

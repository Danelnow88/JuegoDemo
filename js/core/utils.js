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

  // Agrupa consumibles por tipo preservando el orden de primera aparición.
  // Devuelve [{ type, name, count }] para el HUD de slots.
  NV.groupConsumables = function (items) {
    const groups = [], byType = {};
    for (const it of items || []) {
      let g = byType[it.type];
      if (!g) { g = { type: it.type, name: it.name, count: 0 }; byType[it.type] = g; groups.push(g); }
      g.count++;
    }
    return groups;
  };

  // Índice circular seguro (para ciclar la selección de consumibles con teclas).
  NV.cycleIndex = function (i, len, dir) {
    if (!len || len <= 0) return 0;
    return ((i + (dir > 0 ? 1 : -1)) % len + len) % len;
  };

  // Quita el PRIMER ítem del tipo dado y lo devuelve (null si no hay). No muta si falta.
  NV.consumeByType = function (items, type) {
    const idx = (items || []).findIndex((it) => it.type === type);
    if (idx === -1) return null;
    return items.splice(idx, 1)[0];
  };

  NV.consumableCountByType = function (items, type) {
    return (items || []).filter((it) => it && it.type === type).length;
  };

  NV.canAddConsumable = function (items, type, cap) {
    const max = cap === undefined ? NV.CONSUMABLE_STACK_CAP : cap;
    return NV.consumableCountByType(items, type) < max;
  };

  NV.addConsumable = function (items, item, cap) {
    if (!items || !item || !item.type || !NV.canAddConsumable(items, item.type, cap)) return false;
    items.push(item);
    return true;
  };

})();

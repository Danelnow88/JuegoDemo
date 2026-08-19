// ===== RENDER: canvas + context =====
// Se carga ANTES de game.js. Expone canvas/ctx en NV para que game.js los alias
// localmente (const canvas = NV.canvas; const ctx = NV.ctx;) sin cambiar draw().
(() => {
  'use strict';
  const NV = window.NV;

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  NV.canvas = canvas;
  NV.ctx = ctx;
})();

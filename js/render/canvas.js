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

  // Campo de estrellas determinista con PARALLAX: se desplaza levemente contra la
  // posición del jugador para dar profundidad al mundo. Puro y testeable.
  const STARS = [];
  let seeded = false;
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function seedStars() {
    const rnd = mulberry32(1337);
    for (let i = 0; i < 90; i++) {
      // capa 0 = lejana (chica, lenta), capa 2 = cercana (grande, rápida)
      STARS.push({ fx: rnd(), fy: rnd(), layer: Math.floor(rnd() * 3), tw: rnd() * Math.PI * 2 });
    }
    seeded = true;
  }
  NV.drawStarfield = function (ctx2, W, H, frame, px, py) {
    if (!seeded) seedStars();
    for (const s of STARS) {
      const depth = (s.layer + 1) / 3;              // 0.33 / 0.66 / 1
      const x = ((s.fx * W - (px || 0) * 0.04 * depth) % W + W) % W;
      const y = ((s.fy * H - (py || 0) * 0.04 * depth) % H + H) % H;
      const r = 0.6 + s.layer * 0.5;
      const alpha = (0.25 + depth * 0.45) * (0.7 + Math.sin(frame * 0.02 + s.tw) * 0.3);
      ctx2.globalAlpha = Math.max(0.05, alpha);
      ctx2.fillStyle = s.layer === 2 ? '#caa7ff' : '#7cf8ff';
      ctx2.beginPath(); ctx2.arc(x, y, r, 0, Math.PI * 2); ctx2.fill();
    }
    ctx2.globalAlpha = 1;
  };
})();

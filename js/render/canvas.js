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
    for (let i = 0; i < 160; i++) {
      // capa 0 = lejana (chica, lenta), capa 2 = cercana (grande, rápida)
      STARS.push({ fx: rnd(), fy: rnd(), layer: Math.floor(rnd() * 3), tw: rnd() * Math.PI * 2 });
    }
    seeded = true;
  }
  NV.drawStarfield = function (ctx2, W, H, frame, px, py, rhythm) {
    if (!seeded) seedStars();
    const rr = (rhythm && rhythm.enabled && rhythm.state === 'listening') ? rhythm : null;
    const bassPulse = rr ? Math.min(0.55, Math.max(0, rr.bass || 0, rr.kick || 0)) : 0;
    const sparkle = rr ? Math.min(0.6, Math.max(0, rr.highs || 0, rr.hats || 0)) : 0;
    const onset = rr ? Math.min(0.5, Math.max(0, rr.onset || 0)) : 0;
    for (const s of STARS) {
      const depth = (s.layer + 1) / 3;              // 0.33 / 0.66 / 1
      const drift = sparkle * (0.9 + s.layer * 0.45);
      const x = ((s.fx * W - (px || 0) * 0.04 * depth + Math.sin(frame * (0.018 + sparkle * 0.04) + s.tw) * drift) % W + W) % W;
      const y = ((s.fy * H - (py || 0) * 0.04 * depth + Math.cos(frame * (0.014 + sparkle * 0.035) + s.tw) * drift) % H + H) % H;
      const r = (0.34 + s.layer * 0.28) * (1 + bassPulse * (0.28 + depth * 0.34));
      const twinkle = 0.7 + Math.sin(frame * (0.02 + sparkle * 0.045) + s.tw) * (0.3 + sparkle * 0.18);
      const alpha = Math.min(0.95, (0.25 + depth * 0.45) * twinkle + onset * 0.18 + sparkle * 0.12);
      ctx2.globalAlpha = Math.max(0.05, alpha);
      ctx2.fillStyle = sparkle > bassPulse ? (s.layer === 2 ? '#ff7adf' : '#bdf9ff') : (s.layer === 2 ? '#caa7ff' : '#7cf8ff');
      ctx2.beginPath(); ctx2.arc(x, y, r, 0, Math.PI * 2); ctx2.fill();
    }
    ctx2.globalAlpha = 1;
  };
})();

// ===== RENDER: proyectiles del jugador + efectos especiales =====
// Funciones de dibujo PUROS (solo leen contexto y estructura, no mutan el estado del juego).
// Se cargan ANTES de game.js; game.js las llama vía wrappers locales que aportan el ctx
// y los valores de su closure (así ninguna referencia interna cambia en el juego).
(() => {
  'use strict';
  const NV = window.NV;

  // Dibuja el proyectil del jugador según su forma (id). "g" = factor de crecimiento por tier.
  NV.drawBulletShape = function (ctx, b, def, g) {
    const color = b.color;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(Math.atan2(b.vy, b.vx));
    ctx.fillStyle = color;
    ctx.strokeStyle = color;

    if (def.shape === 'bullet') {
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
      const L = def.len * (1 + g), W = def.w * (1 + g);
      ctx.fillStyle = color;
      ctx.fillRect(-L / 2, -W / 2, L, W);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillRect(-L / 2, -W * 0.25, L, W * 0.5);
    } else if (def.shape === 'orb') {
      const r = def.r * (1 + g);
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath(); ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2); ctx.fill();
    } else if (def.shape === 'pellet') {
      const r = def.r * (1 + g);
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    } else if (def.shape === 'flame') {
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
      const r = (def.r || 2.5) * (1 + g);
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    }

    ctx.restore();
  };

  // Anillo expansivo del EAE especial.
  NV.drawSpecialVFX = function (ctx, vfx) {
    const radius = (1 - vfx.life) * 130;
    ctx.strokeStyle = vfx.color;
    ctx.lineWidth = 5;
    ctx.globalAlpha = vfx.life;
    ctx.beginPath(); ctx.arc(vfx.x, vfx.y, radius, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
  };
})();
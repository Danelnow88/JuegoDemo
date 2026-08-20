// ===== RENDER: enemigos =====
// Función de dibujo PURA para enemigos. game.js aporta ctx y frame al llamarla.
(() => {
  'use strict';
  const NV = window.NV;

  NV.drawEnemy = function (ctx, e, frame) {
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.fillStyle = e.color;
    ctx.shadowBlur = e.isElite ? 14 : 10;
    ctx.shadowColor = e.color;

    const r = e.radius;
    if (e.shape === 'hex') {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      ctx.closePath(); ctx.fill();
    } else if (e.shape === 'triangle') {
      ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r * 0.87, r * 0.5); ctx.lineTo(-r * 0.87, r * 0.5); ctx.closePath(); ctx.fill();
    } else if (e.shape === 'diamond') {
      ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r, 0); ctx.lineTo(0, r); ctx.lineTo(-r, 0); ctx.closePath(); ctx.fill();
    } else if (e.shape === 'atom') {
      ctx.beginPath(); ctx.arc(0, 0, r * 0.4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = e.color;
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2 + frame * 0.1; ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.3, a, 0, Math.PI * 2); ctx.stroke(); }
    } else if (e.shape === 'rock') {
      ctx.beginPath();
      for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; const rr = r * (0.7 + (i / 7) * 0.3); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      ctx.closePath(); ctx.fill();
      // Brillo interior
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; const rr = r * (0.38 + (i / 7) * 0.16); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      ctx.closePath(); ctx.fill();
    } else if (e.shape === 'dot') {
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(-r * 0.3, -r * 0.3, r * 0.2, 0, Math.PI * 2); ctx.arc(r * 0.3, -r * 0.3, r * 0.2, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    }

    if (e.isElite) {
      ctx.strokeStyle = '#ff0';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, r + 4, 0, Math.PI * 2); ctx.stroke();
    }

    ctx.shadowBlur = 0;
    ctx.restore();
  };
})();
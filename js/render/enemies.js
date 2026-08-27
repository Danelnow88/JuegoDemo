// ===== RENDER: enemigos =====
// Función de dibujo PURA para enemigos. game.js aporta ctx y frame al llamarla.
(() => {
  'use strict';
  const NV = window.NV;

  // Ojos que miran al jugador: dos escleróticas blancas + pupilas orientadas.
  // Rojos en élites. Da identidad de "criatura" a las formas geométricas.
  NV.drawEnemyEyes = function (ctx, e, player) {
    if (!player) return;
    const r = e.radius;
    const eyeR = Math.max(1.6, r * 0.18);
    const sep = r * 0.34;               // separación entre ojos
    const fwd = Math.atan2(player.y - e.y, player.x - e.x);
    const ox = Math.cos(fwd) * sep * 0.4; // offset hacia el objetivo
    const oy = Math.sin(fwd) * sep * 0.4;
    for (const side of [-1, 1]) {
      const ex = side * sep + ox * 0.5;
      const ey = -r * 0.15 + oy * 0.5;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(ex, ey, eyeR, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = e.isElite ? '#ff2222' : '#10131c';
      ctx.beginPath(); ctx.arc(ex + Math.cos(fwd) * eyeR * 0.45, ey + Math.sin(fwd) * eyeR * 0.45, eyeR * 0.55, 0, Math.PI * 2); ctx.fill();
    }
  };

  NV.drawEnemy = function (ctx, e, frame, player) {
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.fillStyle = e.color;
    ctx.shadowBlur = e.isElite ? 14 : 10;
    ctx.shadowColor = e.color;
    // KAMIKAZE armado: parpadeo rápido + anillo de mecha expansivo (aviso claro de peligro)
    if (e.armed) {
      const blink = 0.45 + Math.sin(frame * 0.55) * 0.55;
      ctx.globalAlpha = blink;
      ctx.strokeStyle = '#ff5f3d';
      ctx.lineWidth = 2.5;
      ctx.shadowBlur = 16; ctx.shadowColor = '#ff5f3d';
      ctx.beginPath(); ctx.arc(0, 0, e.radius + 6 + (0.8 - Math.max(e.fuse, 0)) * 12, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = Math.sin(frame * 0.55) > 0 ? '#ffffff' : '#ff5f3d';
      ctx.shadowColor = '#ffffff';
    }

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
    NV.drawEnemyEyes(ctx, e, player);
    ctx.restore();
  };
})();
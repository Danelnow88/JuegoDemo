// ===== RENDER: jefe físico (cuerpo + ojos + FASE 2) =====
// Función de dibujo PURA. game.js aporta ctx, boss, frame.
(() => {
  'use strict';
  const NV = window.NV;

  NV.drawBoss = function (ctx, boss, frame) {
    if (!boss || boss.dead) return;
    ctx.save();
    ctx.translate(boss.x, boss.y);
    ctx.fillStyle = boss.color;
    ctx.shadowBlur = 30;
    ctx.shadowColor = boss.color;

    const r = boss.radius;
    ctx.save();
    if (boss.shape === 'circle') {
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.closePath(); ctx.fill();
    } else if (boss.shape === 'diamond') {
      // Anillo indicador de FASE 2
      if (boss.phase2) {
        ctx.strokeStyle = 'rgba(255, 95, 155, 0.85)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, r + 12 + Math.sin(frame * 0.1) * 3, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.beginPath(); ctx.moveTo(0, -r * 1.2); ctx.lineTo(r * 0.9, 0); ctx.lineTo(0, r * 1.2); ctx.lineTo(-r * 0.9, 0); ctx.closePath(); ctx.fill();
    } else if (boss.shape === 'rock') {
      ctx.beginPath();
      for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; const rr = r * (0.75 + (i / 7) * 0.25); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      ctx.closePath(); ctx.fill();
    } else {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    if (NV.drawEnemyHitFeedback) NV.drawEnemyHitFeedback(ctx, boss, boss.radius);

    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-8, -5, 6, 0, Math.PI * 2); ctx.arc(8, -5, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(-8, -5, 3, 0, Math.PI * 2); ctx.arc(8, -5, 3, 0, Math.PI * 2); ctx.fill();

    ctx.shadowBlur = 0;
    ctx.restore();
  };
})();
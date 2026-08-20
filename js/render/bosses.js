// ===== RENDER: jefe (cuerpo + barra de HP + FASE 2) =====
// Función de dibujo PURA. game.js aporta ctx, boss, frame.
(() => {
  'use strict';
  const NV = window.NV;

  NV.drawBoss = function (ctx, boss, frame) {
    if (!boss || boss.dead) return;
    if (boss.hitFlash > 0) boss.hitFlash = Math.max(0, boss.hitFlash - 0.05);
    ctx.save();
    ctx.translate(boss.x, boss.y);
    ctx.fillStyle = boss.color;
    ctx.shadowBlur = 30;
    ctx.shadowColor = boss.color;

    // Barra de salud del jefe
    const barW = 260, barH = 16;
    const hpPct = Math.max(0, boss.hp) / boss.maxHp;
    ctx.save();
    ctx.translate(0, -boss.radius - 40);
    ctx.fillStyle = '#222';
    ctx.fillRect(-barW / 2, 0, barW, barH);
    ctx.fillStyle = hpPct > 0.4 ? '#7cf8ff' : (hpPct > 0.2 ? '#ffcf76' : '#ff5f9b');
    ctx.fillRect(-barW / 2, 0, barW * hpPct, barH);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(-barW / 2, 0, barW, barH);
    ctx.font = 'bold 11px system-ui';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.fillText(Math.ceil(boss.hp) + ' / ' + boss.maxHp, 0, 13);
    ctx.restore();

    // Flash blanco al recibir daño
    if (boss.hitFlash > 0) {
      ctx.globalAlpha = boss.hitFlash;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; ctx.lineTo(Math.cos(a) * boss.radius, Math.sin(a) * boss.radius); }
      ctx.fill();
    }
    ctx.globalAlpha = 1;

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

    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-8, -5, 6, 0, Math.PI * 2); ctx.arc(8, -5, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(-8, -5, 3, 0, Math.PI * 2); ctx.arc(8, -5, 3, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = boss.color;
    ctx.font = 'bold 13px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(boss.name, 0, -r - 10);

    ctx.shadowBlur = 0;
    ctx.restore();
  };
})();
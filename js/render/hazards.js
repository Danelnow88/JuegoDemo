// ===== RENDER: hazards / speaker mines =====
// Todas las transformaciones son locales al canvas: nunca alteran x/y/hitbox.
(() => {
  'use strict';
  const NV = window.NV = window.NV || {};

  function drawTelegraph(ctx, mine) {
    const total = (NV.BALANCE && NV.BALANCE.SPEAKER_MINE_TELEGRAPH_DURATION) || 0.9;
    const p = Math.max(0, Math.min(1, mine.stateTime / total));
    const pulse = 0.5 + 0.5 * Math.sin(mine.simTime * 18 + mine.phaseOffset);
    ctx.save();
    // Anillo de warning que pulsa (visible incluso con partículas pesadas).
    ctx.globalAlpha = 0.35 + pulse * 0.4;
    ctx.strokeStyle = '#ffcf5a'; ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.arc(mine.x, mine.y, 18 + p * 14, 0, Math.PI * 2); ctx.stroke();
    // Concentric warning waves: marcación rítmica de zona peligrosa.
    ctx.globalAlpha = 0.14 + p * 0.18;
    ctx.strokeStyle = '#00f0ff'; ctx.lineWidth = 1.7;
    for (let i = 1; i <= 4; i++) {
      const r = 16 + p * (12 + i * 5);
      ctx.beginPath(); ctx.arc(mine.x, mine.y, r, 0, Math.PI * 2); ctx.stroke();
    }
    // Mini ghost silhouette (preview del woofer) para identidad de parlante.
    ctx.globalAlpha = 0.10 + p * 0.2;
    ctx.fillStyle = '#ff4da6';
    ctx.beginPath(); ctx.arc(mine.x, mine.y, 4.5 + p * 5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawBody(ctx, mine, rhythm, policy, groove) {
    const pose = NV.speakerMinePose(mine, rhythm, groove);
    const full = !policy || policy.tier === 'full';
    const reduced = !policy || policy.tier !== 'minimal';
    const hue = rhythm && Number.isFinite(rhythm.hue) ? rhythm.hue : 330;
    const accent = 'hsl(' + Math.round(hue) + ',90%,62%)';
    const det = mine.state === 'detonating';
    ctx.save();
    ctx.translate(mine.x + pose.sway, mine.y + pose.bob);
    ctx.rotate(pose.tilt);
    ctx.scale(pose.scaleX * (det ? 1.32 : 1), pose.scaleY * (det ? 0.46 : 1));
    if (full) { ctx.shadowColor = '#ff3d8d'; ctx.shadowBlur = 14; }

    // Patas: peso alternado (pie plantado opuesto al movimiento del cuerpo).
    ctx.fillStyle = '#171522';
    ctx.fillRect(-12 + pose.feet, 12, 7, 5);
    ctx.fillRect(5 + pose.feet, 12, 7, 5);

    // Caja oscura + borde warning fijo: no parece pickup/enemigo/proyectil.
    ctx.fillStyle = '#090b13';
    ctx.strokeStyle = mine.state === 'armed' ? '#ffcf5a' : '#ff4da6';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(-14, -14); ctx.lineTo(12, -14); ctx.lineTo(15, -10);
    ctx.lineTo(15, 12); ctx.lineTo(11, 15); ctx.lineTo(-12, 15); ctx.lineTo(-15, 11); ctx.lineTo(-15, -10);
    ctx.closePath(); ctx.fill(); ctx.stroke();

    // Woofer principal siempre presente y legible (inclusive minimal).
    ctx.fillStyle = '#151a28'; ctx.strokeStyle = accent; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 3, 7.5 * pose.woofer, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffcf5a';
    ctx.beginPath(); ctx.arc(0, 3, 2.3 * pose.woofer, 0, Math.PI * 2); ctx.fill();

    // Tweeter/segundo cono y tornillos: decorativos (reducidos por tier).
    if (reduced) {
      ctx.fillStyle = '#23283a'; ctx.strokeStyle = '#ff4da6'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(0, -7, 3.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    if (full) {
      ctx.fillStyle = '#7cf8ff';
      for (const x of [-10, 10]) for (const y of [-9, 10]) { ctx.beginPath(); ctx.arc(x, y, 1, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.restore();
  }

  // --- P3.1: notas musicales geométricas (no dependen de fuentes) ---
  function drawNote(ctx, n) {
    if (!n || n.alpha <= 0) return;
    const size = n.size || 4.2;
    const a = Math.max(0, Math.min(1, n.alpha));
    ctx.save();
    ctx.translate(n.x, n.y);
    ctx.rotate(n.rot || 0);
    ctx.globalAlpha = a;
    ctx.fillStyle = n.hue; ctx.strokeStyle = n.hue; ctx.lineWidth = 1.3;
    // cabeza circular
    ctx.beginPath(); ctx.arc(0, 0, size * 0.28, 0, Math.PI * 2); ctx.fill();
    // tallo
    ctx.beginPath(); ctx.moveTo(0, -size * 0.85); ctx.lineTo(0, size * 0.25); ctx.stroke();
    // abanico/pulgar (flag) o segunda nota (eighth): geometría minimalista
    if (n.type === 'flagged') {
      ctx.beginPath(); ctx.moveTo(0, -size * 0.85); ctx.quadraticCurveTo(size * 0.7, -size * 0.6, size * 1.1, -size * 0.3); ctx.stroke();
    } else if (n.type === 'eighth') {
      ctx.beginPath(); ctx.arc(size * 0.42, -size * 0.85, size * 0.25, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  NV.drawMusicalNotes = function (ctx, notes, visualPolicy) {
    if (!notes || !notes.length) return;
    for (let i = 0; i < notes.length; i++) drawNote(ctx, notes[i], visualPolicy);
  };

  NV.drawHazards = function (ctx, hazards, rhythm, visualPolicy, debugHitbox, notes, groove) {
    for (const mine of hazards || []) {
      if (!mine || mine.type !== 'speakerMine' || mine.state === 'dead') continue;
      if (mine.state === 'spawning') drawTelegraph(ctx, mine);
      drawBody(ctx, mine, rhythm, visualPolicy, groove);
      if (debugHitbox) {
        ctx.save(); ctx.strokeStyle = 'rgba(124,248,255,0.75)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(mine.x, mine.y, mine.triggerRadius, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      }
    }
    if (notes && notes.length) NV.drawMusicalNotes(ctx, notes, visualPolicy);
  };
})();
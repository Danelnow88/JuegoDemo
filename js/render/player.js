// ===== RENDER: jugador (nave/piloto + auras) =====
// Función de dibujo PURA. game.js aporta ctx, player, CHARACTERS, frame.
(() => {
  'use strict';
  const NV = window.NV;

  NV.drawPlayer = function (ctx, player, CHARACTERS, frame) {
    const char = CHARACTERS[player.character];
    ctx.save();
    ctx.translate(player.x, player.y);

    const invulnBlink = player.invuln > 0 && Math.floor(player.invuln * 20) % 2 === 0;
    const stunBlink = player.stun > 0 && Math.floor(player.stun * 20) % 2 === 0;
    const criticalHealth = player.hp > 0 && player.hp / player.maxHp <= 0.25;
    ctx.globalAlpha = invulnBlink ? 0.4 : (stunBlink ? 0.6 : 1);

    // Señal visual de vida crítica: un contorno rojo late alrededor de cualquier personaje.
    if (criticalHealth) {
      const pulse = 0.35 + Math.sin(frame * 0.22) * 0.25;
      ctx.save();
      ctx.globalAlpha = pulse;
      ctx.strokeStyle = '#ff3048';
      ctx.shadowColor = '#ff3048';
      ctx.shadowBlur = 18;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, char.size + 10 + Math.sin(frame * 0.18) * 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Fase Fantasma: aura espectral pulsante
    if (player.phase > 0) {
      const ghostPulse = 0.3 + Math.sin(frame * 0.3) * 0.2;
      ctx.strokeStyle = '#caa7ff';
      ctx.globalAlpha = ghostPulse;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, char.size + 20 + Math.sin(frame * 0.2) * 5, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, char.size + 8, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = invulnBlink ? 0.4 : 1;
    }

    // Muralla: escudo dorado visible
    if (player.bulwark > 0) {
      const shieldPulse = 0.4 + Math.sin(frame * 0.15) * 0.2;
      ctx.strokeStyle = '#ffcf76';
      ctx.globalAlpha = shieldPulse;
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(0, 0, char.size + 15, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = invulnBlink ? 0.4 : 1;
    }

    const breathe = Math.sin(frame * 0.05) * 1.5;
    const bob = Math.sin(frame * 0.12) * 2;
    ctx.translate(0, bob + breathe);

    // Aura pulsante
    const auraPulse = 0.15 + Math.sin(frame * 0.08) * 0.05;
    ctx.strokeStyle = char.color;
    ctx.globalAlpha = auraPulse * (invulnBlink ? 0.4 : 1);
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, char.size + 12 + Math.sin(frame * 0.1) * 3, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = invulnBlink ? 0.4 : 1;

    ctx.shadowBlur = 30;
    ctx.shadowColor = char.color;
    const size = char.size;
    const cid = char.id || player.character;

    if (cid === 'boti') {
      // Hexágono
      ctx.fillStyle = char.bodyColor;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; ctx.lineTo(Math.cos(a) * size, Math.sin(a) * size); }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = char.color;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; ctx.lineTo(Math.cos(a) * (size * 0.6), Math.sin(a) * (size * 0.6)); }
      ctx.closePath(); ctx.fill();
    } else if (cid === 'nova') {
      // Diamante/rombo
      ctx.fillStyle = char.bodyColor;
      ctx.beginPath();
      ctx.moveTo(0, -size * 1.2);
      ctx.lineTo(size * 0.8, 0);
      ctx.lineTo(0, size * 1.2);
      ctx.lineTo(-size * 0.8, 0);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = char.color;
      ctx.beginPath();
      ctx.moveTo(0, -size * 0.7);
      ctx.lineTo(size * 0.45, 0);
      ctx.lineTo(0, size * 0.7);
      ctx.lineTo(-size * 0.45, 0);
      ctx.closePath(); ctx.fill();
    } else if (cid === 'rook') {
      // Escudo hexagonal grueso
      ctx.fillStyle = char.bodyColor;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + Math.PI / 6; ctx.lineTo(Math.cos(a) * size * 1.1, Math.sin(a) * size * 1.1); }
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = char.color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + Math.PI / 6; ctx.lineTo(Math.cos(a) * size * 0.7, Math.sin(a) * size * 0.7); }
      ctx.closePath(); ctx.stroke();
      ctx.fillStyle = char.color;
      ctx.beginPath(); ctx.arc(0, 0, size * 0.3, 0, Math.PI * 2); ctx.fill();
    } else if (cid === 'swarm') {
      // Círculo con anillos orbitales
      ctx.fillStyle = char.bodyColor;
      ctx.beginPath(); ctx.arc(0, 0, size, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = char.color;
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + frame * 0.05;
        ctx.beginPath(); ctx.ellipse(0, 0, size * 1.3, size * 0.4, a, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.fillStyle = char.color;
      ctx.beginPath(); ctx.arc(0, 0, size * 0.5, 0, Math.PI * 2); ctx.fill();
    }

    // Ojos
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(-5, -1, 2.5, 0, Math.PI * 2); ctx.arc(5, -1, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = char.eyeColor;
    ctx.beginPath(); ctx.arc(-5, -1, 1.2, 0, Math.PI * 2); ctx.arc(5, -1, 1.2, 0, Math.PI * 2); ctx.fill();

    ctx.shadowBlur = 0;
    ctx.restore();
  };
})();
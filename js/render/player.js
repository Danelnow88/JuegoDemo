// ===== RENDER: jugador (nave/piloto + auras) =====
// Función de dibujo PURA. game.js aporta ctx, player, CHARACTERS, frame.
(() => {
  'use strict';
  const NV = window.NV;
  // NEW: Visual utility functions for advanced rendering effects
  function NV_drawLiquidInkBlob(ctx, cx, cy, radius, points, noise, speed, fillColor, strokeColor, glowColor, seed, t) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.beginPath();
    for (let i = 0; i <= points; i++) {
      let angle = (i / points) * Math.PI * 2;
      let n1 = Math.sin(angle * 4 + t * 8 * speed + seed);
      let n2 = Math.cos(angle * 3 - t * 10 * speed + seed * 2);
      let jitter = (Math.random() - 0.5) * 2.5;
      let r = radius + (n1 + n2) * noise + jitter;
      let x = Math.cos(angle) * r;
      let y = Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 18;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = strokeColor;
    ctx.stroke();
    ctx.restore();
  }
  function NV_drawFlowingPatterns(ctx, cx, cy, radius, color, count, seed, t) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    for (let i = 0; i < count; i++) {
      let progress = ((t * 0.8 + (i / count)) % 1);
      let alpha = Math.sin(progress * Math.PI);
      let currentR = radius * (0.2 + progress * 0.75);
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.ellipse(Math.cos(t + i + seed) * 6, Math.sin(t * 1.2 + i) * 6, currentR, currentR * 0.45, t + i, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
  function NV_drawDripsAndMelts(ctx, cx, cy, radius, color, glowColor, seed, t) {
    ctx.save();
    for (let i = 0; i < 6; i++) {
      let pAngle = (i / 6) * Math.PI * 2 + t * 1.5 + seed;
      let dripY = Math.sin(t * 4 + i) * 15;
      let px = cx + Math.cos(pAngle) * (radius + 8);
      let py = cy + Math.sin(pAngle) * (radius + 8) + dripY;
      let pSize = 3 + Math.sin(t * 8 + i) * 2;
      if (pSize > 0) {
        ctx.beginPath();
        ctx.arc(px, py, pSize, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 8;
        ctx.fill();
      }
    }
    ctx.restore();
  }

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

    // Fase Fantasma: zona de daño claramente legible + aura espectral pulsante
    if (player.phase > 0) {
      const R = (window.NV.BALANCE ? window.NV.BALANCE.PHASE_AURA_RADIUS : 70);
      const zonePulse = 0.10 + Math.sin(frame * 0.35) * 0.05; // relleno tenue: "esta zona pega"
      ctx.fillStyle = '#caa7ff';
      ctx.globalAlpha = zonePulse;
      ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
      // Borde rotante en guiones: gira para leerse como campo activo
      ctx.strokeStyle = '#caa7ff';
      ctx.globalAlpha = 0.75;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([14, 9]);
      ctx.lineDashOffset = -frame * 1.4;
      ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      // Aura espectral original del personaje (intangibilidad)
      const ghostPulse = 0.3 + Math.sin(frame * 0.3) * 0.2;
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

    
    // Escudo de consumible: burbuja azul pulsante. Visible mientras `player.shield > 0`
    // y NO hay fase activa (la fase ya dibuja su propia aura espectral).
    if (player.shield > 0 && player.phase <= 0) {
      const shieldPulse = 0.35 + Math.sin(frame * 0.2) * 0.2;
      ctx.strokeStyle = '#7cf8ff';
      ctx.globalAlpha = shieldPulse;
      ctx.lineWidth = 3.5;
      ctx.shadowColor = '#7cf8ff';
      ctx.shadowBlur = 14;
      ctx.setLineDash([10, 6]);
      ctx.beginPath(); ctx.arc(0, 0, char.size + 18, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      // Anillo interno fino para refuerzo visual de "activo".
      ctx.globalAlpha = shieldPulse * 0.8;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, 0, char.size + 14, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = invulnBlink ? 0.4 : 1;
      ctx.shadowBlur = 0;
    }

    // Overdrive: energía violeta/eléctrica alrededor del personaje mientras dura
    // el boost de velocidad. Solo render: la lógica sigue en engine/consumables + game.js.
    if (player.overdrive > 0) {
      const odPulse = 0.45 + Math.sin(frame * 0.45) * 0.25;
      ctx.strokeStyle = '#caa7ff';
      ctx.globalAlpha = odPulse;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#caa7ff';
      ctx.shadowBlur = 18;
      ctx.beginPath(); ctx.arc(0, 0, char.size + 23 + Math.sin(frame * 0.25) * 4, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = odPulse * 0.75;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(0, 0, char.size + 9, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = invulnBlink ? 0.4 : 1;
      ctx.shadowBlur = 0;
    }

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
      const t = frame * 0.025;
      NV_drawDripsAndMelts(ctx, 0, 0, size * 0.9, '#00f0ff', '#00f0ff', 1, t);
      NV_drawLiquidInkBlob(ctx, 0, 4, size * 0.7, 12, 3.5, 1.2, '#021536', '#0066ff', '#0066ff', 1, t);
      NV_drawLiquidInkBlob(ctx, 0, 0, size * 0.95, 16, 5, 1.0, '#042b5c', '#00f0ff', '#00f0ff', 2, t);
      NV_drawFlowingPatterns(ctx, 0, 0, size * 0.86, '#70f3ff', 5, 1, t);
    } else if (cid === 'nova') {
      // NOVA (MARS) – adapted from visual prototype
      const t = frame * 0.025;
      NV_drawDripsAndMelts(ctx, 0, 0, size * (45 / 46), '#ff3300', '#ff6600', 2, t);
      NV_drawLiquidInkBlob(ctx, size * (-12 / 46), size * (-8 / 46), size * (24 / 46), 10, size * (8 / 46), 1.6, '#4a0800', '#ff9900', '#ff9900', 3, t);
      NV_drawLiquidInkBlob(ctx, 0, 0, size, 14, size * (12 / 46), 1.1, '#2b0500', '#ff3300', '#ff3300', 4, t);
      NV_drawFlowingPatterns(ctx, 0, 0, size * (42 / 46), '#ffaa00', 4, 2, t);
    } else if (cid === 'rook') {
      // ROOK (JUPITER) – adapted from visual prototype
      const t = frame * 0.025;
      NV_drawDripsAndMelts(ctx, 0, 0, size, '#eab308', '#a855f7', 3, t);
      NV_drawLiquidInkBlob(ctx, 0, 0, size, 18, size * (11 / 50), 0.9, '#1e0a2a', '#a855f7', '#a855f7', 5, t);
      NV_drawFlowingPatterns(ctx, 0, 0, size * (48 / 50), '#fef08a', 6, 3, t);
    } else if (cid === 'swarm') {
      // SWARM (SATURN) – adapted from visual prototype
      const t = frame * 0.025;
      NV_drawDripsAndMelts(ctx, 0, 0, size * (40 / 38), '#ffee77', '#ffee77', 4, t);
      NV_drawLiquidInkBlob(ctx, 0, 0, size, 12, size * (7 / 38), 1.0, '#241c02', '#ffee77', '#ffee77', 6, t);
      NV_drawFlowingPatterns(ctx, 0, 0, size * (36 / 38), '#ffffff', 3, 4, t);

      // Animated rings for SATURN
      ctx.save();
      ctx.rotate(0.35 + Math.sin(t * 2) * 0.06);

      for (let a = 0; a < 2; a++) {
        const ringProgress = ((t * 0.6 + a * 0.5) % 1);
        const ringAlpha = Math.sin(ringProgress * Math.PI);

        ctx.globalAlpha = ringAlpha;
        ctx.beginPath();
        ctx.ellipse(
          0,
          0,
          size * ((65 + ringProgress * 25) / 38),
          size * ((20 + ringProgress * 8) / 38),
          0,
          0,
          Math.PI * 2
        );

        ctx.strokeStyle = a === 0 ? '#ffee77' : '#ffffff';
        ctx.lineWidth = 3 - ringProgress * 1.5;
        ctx.shadowColor = '#ffee77';
        ctx.shadowBlur = 12;
        ctx.stroke();
      }

      ctx.restore();
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
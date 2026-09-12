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
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = '#fff4cf';
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.48;
      ctx.fillStyle = color;
      ctx.fillRect(-r * 1.8, -r * 0.28, r * 1.6, r * 0.56);
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

  NV.drawFlameZone = function (ctx, z, reducedVfx) {
    const fade = Math.max(0, Math.min(1, z.life / (z.maxLife || 0.28)));
    const time = z.visualTime || 0;
    const range = z.range || 170;
    const seed = z.seed || 0.5;
    const width = range * Math.tan(z.halfAngle || 0.22);
    const outerTongues = reducedVfx ? 5 : 8;
    const innerTongues = reducedVfx ? 3 : 5;
    const emberCount = reducedVfx ? 3 : 7;
    const flow = time * 7.5 + seed * 17;

    ctx.save();
    ctx.translate(z.x, z.y);
    ctx.rotate(z.angle);
    ctx.globalCompositeOperation = 'lighter';

    const outerGradient = ctx.createLinearGradient(-4, 0, range * 1.05, 0);
    outerGradient.addColorStop(0, 'rgba(255,214,70,' + (0.74 * fade) + ')');
    outerGradient.addColorStop(0.24, 'rgba(255,137,24,' + (0.68 * fade) + ')');
    outerGradient.addColorStop(0.68, 'rgba(245,66,12,' + (0.48 * fade) + ')');
    outerGradient.addColorStop(1, 'rgba(150,20,6,0)');
    ctx.fillStyle = outerGradient;
    const upperA = Math.sin(flow * 1.07) * width * 0.10;
    const upperB = Math.sin(flow * 1.71 + 1.3) * width * 0.13;
    const lowerA = Math.sin(flow * 0.93 + 2.1) * width * 0.11;
    const lowerB = Math.sin(flow * 1.49 + 4.2) * width * 0.14;
    const tipDrift = Math.sin(flow * 1.83 + 0.7) * width * 0.18;
    ctx.beginPath();
    ctx.moveTo(-5, -width * 0.04);
    ctx.bezierCurveTo(range * 0.10, -width * 0.22, range * 0.18, -width * 0.62 + upperA, range * 0.34, -width * 0.68);
    ctx.bezierCurveTo(range * 0.46, -width * 0.98 + upperB, range * 0.56, -width * 0.48, range * 0.67, -width * 0.66 + upperA);
    ctx.bezierCurveTo(range * 0.78, -width * 0.82 + upperB, range * 0.84, -width * 0.30, range * 0.92, -width * 0.44 + tipDrift);
    ctx.bezierCurveTo(range * 1.01, -width * 0.35, range * 1.04, -width * 0.08, range * 1.02, tipDrift * 0.24);
    ctx.bezierCurveTo(range * 0.94, width * 0.10, range * 0.94, width * 0.48, range * 0.83, width * 0.38 + tipDrift);
    ctx.bezierCurveTo(range * 0.72, width * 0.72 + lowerB, range * 0.62, width * 0.42, range * 0.51, width * 0.75 + lowerA);
    ctx.bezierCurveTo(range * 0.37, width * 1.00 + lowerB, range * 0.25, width * 0.50, range * 0.13, width * 0.44);
    ctx.bezierCurveTo(range * 0.05, width * 0.30, range * 0.01, width * 0.10, -5, width * 0.04);
    ctx.closePath();
    ctx.fill();

    for (let tongue = 0; tongue < outerTongues; tongue++) {
      const phase = seed * 23 + tongue * 2.17;
      const side = tongue % 2 ? 1 : -1;
      const start = range * (0.28 + (tongue % 4) * 0.10);
      const pulse = 0.5 + 0.5 * Math.sin(flow * (0.76 + tongue * 0.035) + phase);
      const length = range * (0.18 + pulse * 0.20 + tongue * 0.008);
      const lateral = side * width * (0.36 + (tongue % 3) * 0.20) + Math.sin(flow * 1.28 + phase) * width * 0.16;
      ctx.fillStyle = tongue % 3 === 0
        ? 'rgba(255,157,24,' + (0.44 * fade) + ')'
        : 'rgba(255,66,12,' + (0.34 * fade) + ')';
      ctx.beginPath();
      ctx.moveTo(start, lateral * 0.34);
      ctx.bezierCurveTo(start + length * 0.24, lateral * 0.20, start + length * 0.55, lateral + Math.sin(flow * 1.55 + phase) * width * 0.13, start + length, lateral * 0.72);
      ctx.bezierCurveTo(start + length * 0.66, lateral * 0.30, start + length * 0.26, lateral * 0.10, start, lateral * 0.34);
      ctx.closePath();
      ctx.fill();
    }

    const streamGradient = ctx.createLinearGradient(-6, 0, range * 0.82, 0);
    streamGradient.addColorStop(0, 'rgba(255,255,250,' + fade + ')');
    streamGradient.addColorStop(0.16, 'rgba(255,250,190,' + (0.98 * fade) + ')');
    streamGradient.addColorStop(0.48, 'rgba(255,205,55,' + (0.82 * fade) + ')');
    streamGradient.addColorStop(1, 'rgba(255,105,18,0)');
    ctx.fillStyle = streamGradient;
    ctx.beginPath();
    ctx.moveTo(-7, -width * 0.08);
    ctx.bezierCurveTo(range * 0.18, -width * 0.22 + Math.sin(flow * 1.8) * 2, range * 0.42, -width * 0.30 + upperA * 0.35, range * 0.78, tipDrift * 0.20);
    ctx.bezierCurveTo(range * 0.48, width * 0.28 + lowerA * 0.30, range * 0.18, width * 0.22 + Math.sin(flow * 1.6 + 2) * 2, -7, width * 0.08);
    ctx.closePath();
    ctx.fill();

    for (let tongue = 0; tongue < innerTongues; tongue++) {
      const phase = seed * 11 + tongue * 1.91;
      const side = tongue % 2 ? 1 : -1;
      const start = range * (0.08 + tongue * 0.075);
      const end = range * (0.48 + tongue * 0.055 + Math.sin(flow * 0.82 + phase) * 0.045);
      const lateral = side * width * (0.08 + tongue * 0.055) + Math.sin(flow * 1.7 + phase) * width * 0.10;
      ctx.fillStyle = tongue < 2
        ? 'rgba(255,255,224,' + (0.72 * fade) + ')'
        : 'rgba(255,220,74,' + (0.50 * fade) + ')';
      ctx.beginPath();
      ctx.moveTo(start, lateral * 0.20);
      ctx.bezierCurveTo(start + (end - start) * 0.35, lateral - side * width * 0.10, end - range * 0.08, lateral + side * width * 0.18, end, lateral * 0.55);
      ctx.bezierCurveTo(end - range * 0.12, lateral * 0.18, start + range * 0.05, lateral * 0.06, start, lateral * 0.20);
      ctx.closePath();
      ctx.fill();
    }

    const muzzlePulse = 0.88 + Math.sin(flow * 2.4) * 0.08 + Math.sin(flow * 3.7 + 1.2) * 0.04;
    const muzzleGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, width * 0.48);
    muzzleGradient.addColorStop(0, 'rgba(255,255,255,' + (muzzlePulse * fade) + ')');
    muzzleGradient.addColorStop(0.35, 'rgba(255,250,188,' + (0.88 * fade) + ')');
    muzzleGradient.addColorStop(1, 'rgba(255,143,24,0)');
    ctx.fillStyle = muzzleGradient;
    ctx.beginPath();
    ctx.ellipse(4, 0, width * 0.54, width * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();

    for (let i = 0; i < emberCount; i++) {
      const cycle = (time * (1.05 + i * 0.07) + seed * 2.7 + i * 0.173) % 1;
      const x = range * (0.38 + cycle * 0.72);
      const side = i % 2 ? 1 : -1;
      const y = side * width * (0.28 + cycle * 0.78) + Math.sin(flow + i * 2.31) * width * 0.18;
      const alpha = Math.sin(Math.PI * cycle) * 0.70 * fade;
      ctx.fillStyle = i % 2 ? 'rgba(255,210,80,' + alpha + ')' : 'rgba(255,92,24,' + alpha + ')';
      const size = i % 3 === 0 ? 1.5 : 1;
      ctx.fillRect(x, y, size, size);
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

  // Shockwave genérico: doble anillo (frontal brillante + estela interna que se desvanece).
  NV.drawShockwaves = function (ctx, shockwaves) {
    for (const s of shockwaves) {
      const ease = 1 - s.life;              // ease-out cuadrático
      const radius = s.maxRadius * (1 - (1 - ease) * (1 - ease));
      // Anillo frontal
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width;
      ctx.globalAlpha = s.life;
      ctx.beginPath(); ctx.arc(s.x, s.y, radius, 0, Math.PI * 2); ctx.stroke();
      // Estela interna (más tenue, detrás del frente)
      ctx.lineWidth = s.width * 2;
      ctx.globalAlpha = s.life * 0.25;
      ctx.beginPath(); ctx.arc(s.x, s.y, Math.max(0, radius - 14), 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  };
})();
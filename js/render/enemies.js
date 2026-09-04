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

  // Hash estable por enemigo (solo lectura de e.x/e.y/radius): da banda asignada,
  // umbral de participación y fase individual. NUNCA escribe en e (no muta gameplay).
  function hash01(e, salt) {
    const v = Math.sin((e.x || 0) * 12.9898 + (e.y || 0) * 78.233 + (e.radius || 1) * 37.719 + salt * 43.1234) * 43758.5453;
    return v - Math.floor(v);
  }
  // Banda espectral asignada: sub 15% / graves 35% / medios 30% / agudos 20%.
  // Es energía POR BANDA (convención de mezcla), no separación de instrumentos.
  NV.enemyRhythmBand = function (e) {
    const h = hash01(e, 0);
    return h < 0.15 ? 'sub' : h < 0.5 ? 'graves' : h < 0.8 ? 'medios' : 'agudos';
  };

  NV.drawEnemy = function (ctx, e, frame, player, rhythm) {
    ctx.save();
    let rx = 0, ry = 0;
    if (rhythm && rhythm.enabled && rhythm.state === 'listening') {
      // Temblor visible pero estético. SOLO offsets locales de render: nunca
      // toca e.x/e.y/hitbox/datos de gameplay.
      // Bloque 4a: cada enemigo "escucha" una banda distinta del espectro y
      // participa según un umbral individual estable -> percusión suave = pocos
      // enemigos tiemblan; percusión intensa = casi todos, con amplitudes
      // heterogéneas. Señal = envolvente de SU banda (+ transientes de su banda).
      const band = NV.enemyRhythmBand(e);
      const bandSig = band === 'sub'
        ? Math.min(1, (rhythm.bass || 0) * 0.5 + (rhythm.kick || 0) * 0.9)
        : band === 'graves'
          ? Math.min(1, (rhythm.bass || 0) * 0.75 + (rhythm.kick || 0) * 0.55)
          : band === 'medios'
            ? Math.min(1, (rhythm.mids || 0) * 0.85 + (rhythm.snare || 0) * 0.8)
            : Math.min(1, (rhythm.highs || 0) + (rhythm.hats || 0) * 0.85);
      // Intensidad percusiva global (gate escalonado) + energía sostenida.
      const perc = Math.min(1, (rhythm.onset || 0) * 0.5 + (rhythm.kick || 0) * 0.3 + (rhythm.snare || 0) * 0.2 + (rhythm.hats || 0) * 0.15 + (rhythm.energy || 0) * 0.35);
      const energyBase = Math.min(1, (rhythm.energy || 0) * 1.6);
      const thr = 0.18 + hash01(e, 1) * 0.52; // umbral de participación 0.18-0.70
      const level = Math.max(0, Math.min(1, (bandSig - thr) / (1 - thr)));
      if (level > 0.02 && (perc > 0.05 || energyBase > 0.12)) {
        const seed = hash01(e, 2) * 6.28318;
        // Amplitud perceptible: hasta ~4.5px en golpes, escalada por cuánto
        // supera SU umbral. Fase individual (seed) => nunca perfectamente
        // sincronizados. Oscilación ~3Hz (5.5Hz aliasaba a shimmer invisible).
        const amp = Math.min(4.5, (0.9 + energyBase * 1.3 + bandSig * 3.4) * level);
        const fr = (frame || 0) * 0.31;
        rx = Math.sin(fr + seed) * amp;
        ry = Math.cos(fr * 0.87 + seed * 1.7) * amp * 0.62;
        // Expuesto para diagnóstico/verificación en consola.
        rhythm.jitterAmp = Math.round(Math.hypot(rx, ry) * 100) / 100;
        rhythm.jitterActive = true;
        rhythm.jitterBand = band;
      } else {
        rhythm.jitterActive = false;
        rhythm.jitterAmp = 0;
        rhythm.jitterBand = band;
      }
    }
    // Gesto de ataque (daño de contacto): el atacante se abalanza visualmente hacia
    // el jugador (lunge). 100% decorativo: no muta datos de gameplay ni la hitbox.
    let lx = 0, ly = 0;
    if (e.atkFlash > 0 && player) {
      const atk = Math.min(1, Math.max(0, (e.atkFlash || 0) / 0.45));
      const fwd = Math.atan2(player.y - e.y, player.x - e.x);
      lx = Math.cos(fwd) * Math.sin(atk * Math.PI) * e.radius * 0.45;
      ly = Math.sin(fwd) * Math.sin(atk * Math.PI) * e.radius * 0.45;
    }
    ctx.translate(e.x + rx + lx, e.y + ry + ly);
    ctx.fillStyle = e.color;
    // Glow base moderado (neón presente pero barato): 4/8 en vez de 10/14.
    // Los glows intensos quedan reservados a transitorios importantes (atkFlash,
    // kamikaze armado / mecha, jefe) donde de verdad aportan feedback.
    ctx.shadowBlur = e.isElite ? 8 : 4;
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

    // Fallback Canvas2D. El wrapper de game.js omite este dibujo cuando el mesh
    // WebGL de este enemigo ya está listo.
    if (e.shape === 'specter' && typeof NV.drawSpecter2D === 'function') {
      NV.drawSpecter2D(ctx, e, frame, player);
    } else if (e.shape === 'hex') {
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

    // Fusión de enemigos: indicador provisorio MUY explícito para testear lectura.
    // No toca gameplay; usa e.fusionLevel generado por engine/enemies.js.
    if ((e.fusionLevel || 0) > 0) {
      const lvl = e.fusionLevel || 1;
      const pulse = 0.65 + Math.sin(frame * 0.16 + lvl) * 0.25;
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = e.color || '#ffe04a';
      ctx.lineWidth = 4;
      ctx.shadowColor = e.color || '#ffe04a';
      ctx.shadowBlur = 18;
      ctx.beginPath(); ctx.arc(0, 0, r + 8 + pulse * 5, 0, Math.PI * 2); ctx.stroke();
      ctx.shadowBlur = 0;
      if (ctx.fillText) {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('FUSION ' + lvl, 0, -r - 18);
      }
      ctx.restore();
    }

    // Congelante: hint visual de enemigo ralentizado. Brillo azulado + halo exterior
    // que parpadea sutilmente. 100% visual: no altera datos de gameplay.
    if (e.slowUntil > 0) {
      const cold = 0.5 + Math.sin(frame * 0.35) * 0.5; // parpadeo suave
      ctx.fillStyle = 'rgba(103,232,249,' + (cold * 0.22) + ')';
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#67e8f9';
      ctx.globalAlpha = cold * 0.6;
      ctx.lineWidth = 2;
      ctx.shadowColor = '#67e8f9';
      ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(0, 0, r + 4, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    }

    ctx.shadowBlur = 0;
    // Ojos: skip para espectros (drawSpecter2D los dibuja con seguimiento al jugador)
    if (e.shape !== 'specter') {
      NV.drawEnemyEyes(ctx, e, player);
    }

    // Legibilidad del atacante (daño de contacto): halo blanco de selección +
    // anillo rojo reforzado -> se lee por encima de los superpuestos. Solo visual.
    if (e.atkFlash > 0 && player) {
      const atk = Math.min(1, Math.max(0, (e.atkFlash || 0) / 0.45));
      const fwd = Math.atan2(player.y - e.y, player.x - e.x);

      // Halo blanco exterior de selección (destaca al atacante por encima del resto).
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#ffffff';
      ctx.beginPath(); ctx.arc(0, 0, r + 5, 0, Math.PI * 2); ctx.stroke();

      // Anillo principal: doble trazo (rojo exterior + blanco interior) expansivo.
      const reach = e.radius + 8 + (1 - atk) * 18;
      const gap = 1.1 + (1 - atk) * 0.45;
      ctx.strokeStyle = '#ff3040';
      ctx.lineWidth = 5;
      ctx.shadowBlur = 18;
      ctx.shadowColor = '#ff3040';
      ctx.beginPath();
      ctx.arc(0, 0, reach, fwd + gap, fwd - gap, true);
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#ff3040';
      ctx.beginPath();
      ctx.arc(0, 0, reach - 5, fwd - 0.5, fwd + 0.5);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  };
})();
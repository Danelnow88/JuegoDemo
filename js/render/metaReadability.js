// ===== META VIS: lectura espacial (solo render/diagnóstico) =====
(() => {
  'use strict';
  const NV = window.NV;
  const CELL = 64;
  NV.metaDensityInfo = new WeakMap();

  // ===== Paleta emocional unificada =====
  // peligro / info fría / advertencia / densidad-agrupamiento / seguro.
  NV.META_VIS_PALETTE = {
    danger: '#FF3333',
    dangerSoft: '#FF8800',
    info: '#33CCFF',
    infoCold: '#00FFFF',
    warn: '#FFCC00',
    warnAmber: '#FFAA00',
    density: '#AA66FF',
    densityAlt: '#FF66AA',
    safe: '#66FF33',
  };

  // Toggles individuales (accesibilidad: cada efecto puede apagarse solo).
  NV.META_VIS_OPTIONS = {
    density: true,
    contact: true,
    damage: true,
    invulnerability: true,
    momentum: true,
    autofire: true,
    intent: true,
    legend: true,
  };

  NV.setMetaVisOption = function (key, enabled) {
    if (!(key in NV.META_VIS_OPTIONS)) return false;
    NV.META_VIS_OPTIONS[key] = !!enabled;
    return true;
  };

  // Contexto de render compartido: t (segundos), saturación (0..1),
  // urgencia (0..1) y gain (multiplicador global de intensidad).
  function metaEnv(env) {
    env = env || {};
    return {
      t: env.t || 0,
      saturation: Math.max(0, Math.min(1, env.saturation || 0)),
      urgency: Math.max(0, Math.min(1, env.urgency || 0)),
      gain: env.gain == null ? 1 : Math.max(0, Math.min(2, env.gain)),
    };
  }
  NV.resolveMetaEnv = metaEnv;

  const META_FOG_MAX = 10; // tope de brumas por frame (rendimiento)

  NV.buildDensityField = function (enemies) {
    const grid = new Map(), info = new WeakMap();
    for (const e of enemies || []) {
      if (!e || e.dead) continue;
      const cx = Math.floor(e.x / CELL), cy = Math.floor(e.y / CELL), key = cx + ',' + cy;
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(e);
    }
    let comparisons = 0;
    for (const e of enemies || []) {
      if (!e || e.dead) continue;
      const cx = Math.floor(e.x / CELL), cy = Math.floor(e.y / CELL);
      let nearby = 0, overlap = 0, localChecks = 0;
      scan: for (let gx = cx - 1; gx <= cx + 1; gx++) for (let gy = cy - 1; gy <= cy + 1; gy++) {
        const cell = grid.get(gx + ',' + gy);
        if (!cell) continue;
        for (const other of cell) {
          if (other === e || other.dead) continue;
          comparisons++;
          localChecks++;
          const d = Math.hypot(other.x - e.x, other.y - e.y);
          if (d <= 54) nearby++;
          const combined = (e.radius || 0) + (other.radius || 0);
          if (combined > 0 && d < combined) overlap += 1 - d / combined;
          // La señal ya queda visualmente saturada; no necesitamos contar toda
          // la masa. Tope fijo => costo lineal incluso con 80 superpuestos.
          if (localChecks >= 12) break scan;
        }
      }
      info.set(e, { nearby, overlap, intensity: Math.min(1, nearby / 7 + overlap * 0.22) });
    }
    return { info, comparisons, count: grid.size };
  };

  NV.drawEnemyDensity = function (ctx, e, density) {
    density = density || NV.metaDensityInfo.get(e);
    if (!density || density.intensity < 0.16) return false;
    const a = Math.min(0.22, 0.035 + density.intensity * 0.14);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.strokeStyle = density.overlap > 0.8 ? '#ff8a4c' : '#caa7ff';
    ctx.lineWidth = 1 + density.intensity * 1.2;
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = 2 + density.intensity * 5;
    ctx.beginPath();
    ctx.arc(2 + density.intensity * 2, 1, e.radius + 3 + density.intensity * 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    return true;
  };

  NV.drawContactReadability = function (ctx, e, player, debug) {
    if (!player || !e || e.dead) return false;
    const contactRadius = e.radius + 20; // espejo visual exacto; no participa en colisión
    const d = Math.hypot(e.x - player.x, e.y - player.y);
    const imminent = d < contactRadius + 18;
    if (!debug && !imminent && !(e.atkFlash > 0)) return false;
    const closeness = Math.max(0, Math.min(1, 1 - (d - contactRadius) / 18));
    ctx.save();
    ctx.globalAlpha = debug ? 0.32 : Math.min(0.16, 0.035 + closeness * 0.1 + (e.atkFlash > 0 ? 0.04 : 0));
    ctx.strokeStyle = e.atkFlash > 0 ? '#ff4054' : '#ffcf76';
    ctx.lineWidth = debug ? 1.25 : 0.8 + closeness * 0.7;
    if (debug) ctx.setLineDash([4, 5]);
    ctx.beginPath();
    ctx.arc(e.x, e.y, contactRadius, 0, Math.PI * 2);
    ctx.stroke();
    if (debug) ctx.setLineDash([]);
    ctx.restore();
    return true;
  };

  NV.drawDamageFeedback = function (ctx, player, feedback) {
    if (!feedback || feedback.life <= 0) return false;
    const t = Math.max(0, Math.min(1, feedback.life / 0.55));
    const dx = player.x - feedback.sourceX, dy = player.y - feedback.sourceY;
    const len = Math.max(1, Math.hypot(dx, dy));
    ctx.save();
    ctx.globalAlpha = 0.12 + t * 0.28;
    ctx.strokeStyle = feedback.critical ? '#fff0a0' : '#ff4054';
    ctx.lineWidth = feedback.critical ? 3 : 2;
    ctx.beginPath();
    ctx.moveTo(player.x - dx / len * 10, player.y - dy / len * 10);
    ctx.lineTo(player.x - dx / len * 30, player.y - dy / len * 30);
    ctx.stroke();
    ctx.globalAlpha = t * 0.22;
    ctx.beginPath();
    ctx.arc(player.x, player.y, 24 + (1 - t) * 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    return true;
  };

  NV.drawInvulnerabilityFeedback = function (ctx, player, phase) {
    if (!phase || phase.life <= 0) return false;
    const t = Math.max(0, Math.min(1, phase.life / phase.duration));
    ctx.save();
    ctx.globalAlpha = phase.kind === 'end' ? t * 0.1 : t * 0.14;
    ctx.strokeStyle = phase.kind === 'end' ? '#7cf8ff' : '#ffffff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(player.x, player.y, 28 + (1 - t) * 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    return true;
  };

  NV.drawMomentumReadability = function (ctx, player, state) {
    if (!state) return false;
    const vx = player.moveVx || 0, vy = player.moveVy || 0;
    const speed = Math.hypot(vx, vy);
    if (speed < 35) return false;
    const nx = vx / speed, ny = vy / speed;
    const length = Math.min(42, 8 + speed * 0.075);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.globalAlpha = state.shift ? 0.2 : 0.1;
    ctx.strokeStyle = state.shift ? '#7cf8ff' : '#9bb6c8';
    ctx.lineWidth = state.shift ? 2 : 1.2;
    ctx.beginPath();
    ctx.moveTo(player.x - nx * 8, player.y - ny * 8);
    ctx.lineTo(player.x - nx * length, player.y - ny * length);
    ctx.stroke();
    if (state.previousSpeed > 35) {
      const px = state.previousVx / state.previousSpeed, py = state.previousVy / state.previousSpeed;
      const turn = 1 - Math.max(-1, Math.min(1, nx * px + ny * py));
      if (turn > 0.08) {
        ctx.globalAlpha = Math.min(0.12, turn * 0.1);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(player.x - px * 7, player.y - py * 7);
        ctx.lineTo(player.x - px * Math.min(30, state.previousSpeed * 0.055), player.y - py * Math.min(30, state.previousSpeed * 0.055));
        ctx.stroke();
      }
    }
    ctx.restore();
    return true;
  };

  NV.drawAutofireTarget = function (ctx, target, frame) {
    if (!target || target.dead) return false;
    const r = (target.radius || 10) + 5;
    const pulse = 0.08 + (Math.sin((frame || 0) * 0.12) * 0.5 + 0.5) * 0.05;
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.strokeStyle = '#7cf8ff';
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(target.x + Math.cos(a) * r, target.y + Math.sin(a) * r);
      ctx.lineTo(target.x + Math.cos(a) * (r + 4), target.y + Math.sin(a) * (r + 4));
      ctx.stroke();
    }
    ctx.restore();
    return true;
  };

  NV.drawEnemyIntent = function (ctx, e, player) {
    if (!e || e.dead || !player) return false;
    let drawn = false;
    ctx.save();
    if (e.behavior === 'erratic' && (e.erraticTimer || 0) < 0.16) {
      const a = e.angle || 0, r = e.radius + 5;
      ctx.globalAlpha = 0.12;
      ctx.strokeStyle = '#caa7ff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(e.x + Math.cos(a) * r, e.y + Math.sin(a) * r);
      ctx.lineTo(e.x + Math.cos(a) * (r + 5), e.y + Math.sin(a) * (r + 5));
      ctx.stroke(); drawn = true;
    }
    if (e.behavior === 'ranged') {
      const d = Math.hypot(player.x - e.x, player.y - e.y);
      if (d <= 170) {
        const a = Math.atan2(player.y - e.y, player.x - e.x);
        ctx.globalAlpha = 0.09;
        ctx.strokeStyle = '#6dc4c0'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(e.x, e.y, e.radius + 5, a - 0.8, a + 0.8); ctx.stroke(); drawn = true;
      }
    }
    if (e.behavior === 'shield') {
      const a = Math.atan2(player.y - e.y, player.x - e.x);
      ctx.globalAlpha = e.shieldCd > 0 ? 0.07 : 0.16;
      ctx.strokeStyle = e.shieldCd > 0 ? '#807090' : '#caa7ff';
      ctx.lineWidth = e.shieldCd > 0 ? 1 : 2;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.radius + 6, a - Math.PI / 2, a + Math.PI / 2); ctx.stroke(); drawn = true;
    }
    ctx.restore();
    return drawn;
  };

  // ===== META-VIS-02b: neblina de densidad =====
  // Gradiente radial pulsante que emana de los núcleos de masa. Violeta en
  // densidad normal, naranja cuando el solapamiento es extremo. Partículas
  // de "calor" se elevan en núcleos muy comprimidos. Tope por frame.
  NV.drawDensityFog = function (ctx, enemies, info, env) {
    if (!NV.META_VIS_OPTIONS.density || !enemies) return false;
    const e2 = metaEnv(env);
    const dim = e2.gain * (1 - 0.45 * e2.saturation);
    let drawn = 0;
    for (const en of enemies) {
      if (drawn >= META_FOG_MAX) break;
      if (!en || en.dead) continue;
      const d = info && info.get ? info.get(en) : null;
      if (!d || d.intensity < 0.3) continue;
      drawn++;
      const pulse = 0.85 + 0.15 * Math.sin(e2.t * 2 + en.x * 0.013);
      const radius = en.radius * 2.2 + (d.nearby || 0) * 3;
      const hot = (d.overlap || 0) > 1.2;
      const gradient = ctx.createRadialGradient(en.x, en.y, 0, en.x, en.y, radius);
      gradient.addColorStop(0, hot ? 'rgba(255,136,76,0.16)' : 'rgba(170,102,255,0.13)');
      gradient.addColorStop(0.45, hot ? 'rgba(255,100,50,0.08)' : 'rgba(150,80,220,0.06)');
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.save();
      ctx.globalAlpha = Math.min(0.5, dim * pulse);
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(en.x, en.y, radius, 0, Math.PI * 2);
      ctx.fill();
      // Partículas de calor en núcleos muy comprimidos.
      if (d.intensity > 0.6) {
        for (let i = 0; i < 3; i++) {
          const seed = (i + 1) * 0.37 + en.x * 0.003 + en.y * 0.001;
          const angle = seed * Math.PI * 2;
          const drift = (e2.t * 22 + seed * 40) % (radius * 0.8);
          const px = en.x + Math.cos(angle) * drift;
          const py = en.y + Math.sin(angle) * drift - ((e2.t * 26 + seed * 50) % 24);
          ctx.globalAlpha = Math.min(0.35, dim * (0.05 + 0.05 * Math.sin(e2.t * 3 + seed * 9)));
          ctx.fillStyle = hot ? '#ffb37a' : '#c9a0ff';
          ctx.beginPath();
          ctx.arc(px, py, 1 + ((seed * 7) % 1.4), 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }
    return drawn > 0;
  };
})();
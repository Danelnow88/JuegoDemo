// ===== META VIS: lectura espacial (solo render/diagnóstico) =====
(() => {
  'use strict';
  const NV = window.NV;
  const CELL = 64;
  NV.metaDensityInfo = new WeakMap();

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
})();
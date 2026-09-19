// ===== RENDER: identidad visual de consumibles =====
// Capa dedicada a feedback visual (sin gameplay). Geometria determinista Canvas2D,
// animada con `frame`; sin Math.random por frame y con save/restore balanceado.
(() => {
  'use strict';
  const NV = window.NV;

  NV.CONSUMABLE_FX_MAX = 8;
  // #11: el timing de la bomba vive en js/data/consumables.js (fuente neutral
  // para engine y renderer). Aquí sólo se LEE: sin segundas copias de 0.9/0.46.
  NV.CONSUMABLE_FX_LIFETIMES = { potion: 0.55, overdrive: 0.6, shield: 0.65, bomb: NV.BOMB_FX_LIFETIME, freeze: 0.8, bounty: 0.7 };

  function budget() {
    return (typeof NV.getVisualBudget === 'function') ? NV.getVisualBudget() : null;
  }

  function motionOf(player) {
    let vx = (player && Number(player.moveVx)) || 0;
    let vy = (player && Number(player.moveVy)) || 0;
    let speed = Math.hypot(vx, vy);
    if (speed <= 1) {
      const dx = (player && Number(player.lastMoveDirX)) || 0;
      const dy = (player && Number(player.lastMoveDirY)) || -1;
      const len = Math.hypot(dx, dy) || 1;
      return { ux: dx / len, uy: dy / len, speed: 0 };
    }
    return { ux: vx / speed, uy: vy / speed, speed };
  }

  function hexPath(ctx, x, y, radius, rot) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (rot || 0) + -Math.PI / 2 + i * Math.PI / 3;
      const px = x + Math.cos(a) * radius;
      const py = y + Math.sin(a) * radius;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  function plusPath(ctx, x, y, size) {
    const s = size / 2;
    ctx.beginPath();
    ctx.moveTo(x - s, y - s * 0.34);
    ctx.lineTo(x - s * 0.34, y - s * 0.34);
    ctx.lineTo(x - s * 0.34, y - s);
    ctx.lineTo(x + s * 0.34, y - s);
    ctx.lineTo(x + s * 0.34, y - s * 0.34);
    ctx.lineTo(x + s, y - s * 0.34);
    ctx.lineTo(x + s, y + s * 0.34);
    ctx.lineTo(x + s * 0.34, y + s * 0.34);
    ctx.lineTo(x + s * 0.34, y + s);
    ctx.lineTo(x - s * 0.34, y + s);
    ctx.lineTo(x - s * 0.34, y + s * 0.34);
    ctx.lineTo(x - s, y + s * 0.34);
    ctx.closePath();
  }

  function diamondPath(ctx, x, y, size, squash) {
    const sy = size * (squash == null ? 1 : squash);
    ctx.beginPath();
    ctx.moveTo(x, y - sy);
    ctx.lineTo(x + size, y);
    ctx.lineTo(x, y + sy);
    ctx.lineTo(x - size, y);
    ctx.closePath();
  }

  function timeOf(event) {
    if (!event || !event.duration) return 1;
    return Math.max(0, Math.min(1, 1 - (event.life || 0) / event.duration));
  }

  NV.spawnConsumableFx = function (queue, type, x, y, opts) {
    if (!queue || !type) return queue || [];
    const defs = NV.CONSUMABLE_FX_LIFETIMES || {};
    const o = opts || {};
    const dur = o.duration || defs[type] || 0.6;
    // Seed determinista por evento: variación visual estable sin Math.random.
    const seedAngle = (((x * 7.31 + y * 13.77) % 6.28318) + 6.28318) % 6.28318;
    queue.push({
      type, x, y, duration: dur, life: dur, seedAngle,
      arenaW: o.arenaW || 0,
      arenaH: o.arenaH || 0,
    });
    while (queue.length > (NV.CONSUMABLE_FX_MAX || 8)) queue.shift();
    return queue;
  };

  NV.updateConsumableFx = function (queue, dt) {
    if (!queue) return [];
    for (const e of queue) e.life -= dt;
    return queue.filter((e) => e.life > 0);
  };

  // ===== FREEZE PERSISTENTE: carcasa irregular de hielo facetado =====
  // 100% visual. Sin Math.random: hash estable + xorshift determinista.
  function frozenHash(enemy) {
    const e = enemy || {};
    const key = (e.enemyTypeId || e.visualId || '?') + '|' + (e.shape || 'enemy') + '|' +
      (e.behavior || 'chase') + '|' + Math.round(Number(e.radius) || 0) + '|' +
      Math.round(Number(e.maxHp) || 0) + '|' + Math.round(Number(e.x) || 0) + '|' + Math.round(Number(e.y) || 0);
    let h = 2166136261;
    for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }
  function frozenRng(seed) {
    let s = (seed >>> 0) || 0x9e3779b9;
    return function () {
      s = (s ^ (s << 13)) >>> 0;
      s = (s ^ (s >>> 17)) >>> 0;
      s = (s ^ (s << 5)) >>> 0;
      return s / 4294967296;
    };
  }
  // Carcasa determinista: 8–12 vértices de radios desiguales (placa de hielo
  // rota), facetas internas, acumulaciones asimétricas y escarcha bifurcada.
  NV.frozenShellOf = function (enemy, radius, detail) {
    const d = { facets: 4, accretions: 3, frost: 5, elite: false, sharp: 0.20 };
    if (detail) for (const k in detail) d[k] = detail[k];
    const r = Math.max(4, Number(radius) || 12);
    const rng = frozenRng(frozenHash(enemy));
    const n = d.elite ? 11 : 8 + Math.floor(rng() * 3);
    const verts = [];
    for (let i = 0; i < n; i++) {
      verts.push({ a: (i / n) * Math.PI * 2 + (rng() - 0.5) * 0.55, rr: r * (0.90 + rng() * d.sharp * 1.5) });
    }
    const facets = [];
    for (let i = 0; i < d.facets; i++) {
      const i0 = Math.floor(rng() * n);
      let i1 = (i0 + 2 + Math.floor(rng() * Math.max(1, n - 4))) % n;
      if (i1 === i0) i1 = (i1 + 3) % n;
      facets.push({ i0, i1, alpha: 0.20 + rng() * 0.30 });
    }
    const accretions = [];
    for (let i = 0; i < d.accretions; i++) {
      accretions.push({
        vi: Math.floor(rng() * n),
        size: r * (i === 0 ? 0.34 + rng() * 0.14 : 0.14 + rng() * 0.16), // asimetría
        skew: (rng() - 0.5) * 0.9,
      });
    }
    const frost = [];
    for (let i = 0; i < d.frost; i++) {
      frost.push({ a: rng() * Math.PI * 2, base: r * (0.62 + rng() * 0.42), len: r * (0.16 + rng() * 0.20), fork: (rng() - 0.5) * 1.2 });
    }
    const patches = [];
    for (let i = 0; i < Math.max(2, Math.round(d.facets * 0.6)); i++) {
      patches.push({ a: rng() * Math.PI * 2, rr: r * (0.35 + rng() * 0.45), size: r * (0.14 + rng() * 0.12), alpha: 0.10 + rng() * 0.12 });
    }
    return {
      radius: r, verts, facets, accretions, frost, patches,
      shimmer: { a: rng() * Math.PI * 2, span: 0.45 + rng() * 0.30, speed: 0.014 + rng() * 0.010, phase: rng() },
    };
  };
  // Cache PRIVADO del renderer (WeakMap): la carcasa del enemigo no muta jamás
  // el objeto gameplay. Estable, determinista y escalada por radio.
  const frozenShellCache = new WeakMap();
  function frozenShellCached(e, radius, detail, tierKey) {
    let cached = e ? frozenShellCache.get(e) : null;
    if (cached && cached.radius === radius && cached.tierKey === tierKey) {
      return cached.shell; // el enemigo mantiene SU misma carcasa
    }
    const shell = NV.frozenShellOf(e, radius, detail);
    if (e) frozenShellCache.set(e, { radius, tierKey, shell, entryAt: e.slowUntil });
    return shell;
  }
  NV.drawFrozenStatus = function (ctx, enemy, frame, radius) {
    const e = enemy;
    if (!ctx || !e || !(e.slowUntil > 0)) return false;
    const f = frame || 0;
    const r = Math.max(4, Number(radius) || e.radius || 12);
    const pol = budget();
    const tierName = pol ? (pol.tier || 'full') : 'full';
    const isElite = !!e.isElite;
    const small = r < 10;
    // Presupuesto: degrada DENSIDAD de detalle, nunca la identidad. LOW sigue
    // siendo una carcasa irregular de hielo, jamás un círculo simple.
    const detail = tierName === 'full'
      ? { facets: small ? 3 : 4, accretions: small ? 2 : (isElite ? 4 : 3), frost: small ? 3 : 5, elite: isElite, sharp: isElite ? 0.24 : 0.20 }
      : (tierName === 'reduced'
        ? { facets: 3, accretions: small ? 2 : 3, frost: 3, elite: false, sharp: 0.20 }
        : { facets: small ? 1 : 2, accretions: small ? 1 : 2, frost: 2, elite: false, sharp: 0.18 });
    const shell = frozenShellCached(e, r, detail, tierName + (isElite ? 'E' : '') + (small ? 's' : ''));
    const cache = e ? frozenShellCache.get(e) : null;
    if (cache && e.slowUntil > cache.entryAt) cache.entryAt = e.slowUntil; // re-freeze
    const entry = cache ? Math.max(0, Math.min(1, (cache.entryAt - e.slowUntil) / 0.15)) : 0.25;
    const fadeIn = entry * entry * (3 - 2 * entry);
    // SALIDA: últimos ~0.5 s el hielo se descongela: alpha baja, fracturas crecen.
    const exit = e.slowUntil < 0.5 ? Math.max(0, Math.min(1, (0.5 - e.slowUntil) / 0.5)) : 0;
    const bodyA = (0.85 - exit * 0.60) * (0.55 + 0.45 * fadeIn); // alpha aparece rápido
    const grow = 0.90 + 0.10 * fadeIn; // entrada: carcasa 90% → 100%
    const breath = 1 + Math.sin(f * 0.05 + shell.shimmer.phase * 6.28) * 0.008; // hielo sólido
    ctx.save();
    // — A. COLD BODY TINT: superficie enfriada translúcida (no tapa el color base).
    ctx.beginPath();
    for (let i = 0; i < shell.verts.length; i++) {
      const v = shell.verts[i];
      const px = Math.cos(v.a) * v.rr * grow * breath, py = Math.sin(v.a) * v.rr * grow * breath;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.globalAlpha = bodyA;
    ctx.fillStyle = 'rgba(126,222,249,0.16)';
    ctx.fill();
    ctx.globalAlpha = bodyA * 0.75;
    ctx.fillStyle = 'rgba(224,246,255,0.12)';
    ctx.fill();
    for (let i = 0; i < shell.patches.length; i++) {
      const p = shell.patches[i];
      const px = Math.cos(p.a) * p.rr, py = Math.sin(p.a) * p.rr, s = p.size;
      ctx.globalAlpha = bodyA * p.alpha;
      ctx.fillStyle = '#bfeeff';
      ctx.beginPath();
      ctx.moveTo(px - s, py + s * 0.4);
      ctx.lineTo(px + s * 0.2, py - s);
      ctx.lineTo(px + s, py + s * 0.5);
      ctx.closePath();
      ctx.fill();
    }
    // — B. CARCASA: placa irregular translúcida + borde cristalino.
    ctx.beginPath();
    for (let i = 0; i < shell.verts.length; i++) {
      const v = shell.verts[i];
      const rr = v.rr * 1.10 * grow * breath;
      const px = Math.cos(v.a) * rr, py = Math.sin(v.a) * rr;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.globalAlpha = bodyA * 0.55;
    ctx.fillStyle = 'rgba(190,238,255,0.28)';
    ctx.fill();
    ctx.globalAlpha = bodyA * (isElite ? 0.95 : 0.75) * (1 - exit * 0.6);
    ctx.strokeStyle = isElite ? '#dff6ff' : '#9fe8ff';
    ctx.lineWidth = isElite ? 2.4 : 1.7;
    if (pol && pol.heavyShadow) { ctx.shadowColor = '#67e8f9'; ctx.shadowBlur = 8; }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // — C. FACETAS: cuerdas internas + pequeñas caras triangulares facetadas.
    for (let i = 0; i < shell.facets.length; i++) {
      const fc = shell.facets[i];
      const v0 = shell.verts[fc.i0 % shell.verts.length], v1 = shell.verts[fc.i1 % shell.verts.length];
      const x0 = Math.cos(v0.a) * v0.rr * 0.92, y0 = Math.sin(v0.a) * v0.rr * 0.92;
      const x1 = Math.cos(v1.a) * v1.rr * 0.92, y1 = Math.sin(v1.a) * v1.rr * 0.92;
      ctx.globalAlpha = bodyA * fc.alpha;
      ctx.strokeStyle = '#d8f6ff';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
      const mx = (x0 + x1) * 0.5, my = (y0 + y1) * 0.5;
      ctx.globalAlpha = bodyA * fc.alpha * 0.5;
      ctx.fillStyle = '#eafcff';
      ctx.beginPath();
      ctx.moveTo(mx, my - r * 0.07);
      ctx.lineTo(mx + r * 0.09, my + r * 0.04);
      ctx.lineTo(mx - r * 0.08, my + r * 0.06);
      ctx.closePath();
      ctx.fill();
    }
    // — D. ACUMULACIONES: cristales que sobresalen, asimétricos (1 grande + menores).
    for (let i = 0; i < shell.accretions.length; i++) {
      const ac = shell.accretions[i];
      const v = shell.verts[ac.vi % shell.verts.length];
      const ca = Math.cos(v.a), sa = Math.sin(v.a);
      const s = ac.size * grow;
      ctx.globalAlpha = bodyA * 0.70;
      ctx.fillStyle = i === 0 ? '#e8fbff' : '#bdeefc';
      ctx.beginPath();
      ctx.moveTo(ca * (v.rr - s * 0.3), sa * (v.rr - s * 0.3));
      ctx.lineTo(Math.cos(v.a + ac.skew) * (v.rr + s), Math.sin(v.a + ac.skew) * (v.rr + s));
      ctx.lineTo(ca * (v.rr - s * 0.1) + Math.cos(v.a + 0.5) * s * 0.45, sa * (v.rr - s * 0.1) + Math.sin(v.a + 0.5) * s * 0.45);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = bodyA * 0.5;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 0.9;
      ctx.stroke();
    }
    // — E. ESCARCHA: ramificaciones cortas bifurcadas depositadas sobre el hielo.
    for (let i = 0; i < shell.frost.length; i++) {
      const fr = shell.frost[i];
      const ca = Math.cos(fr.a), sa = Math.sin(fr.a);
      const x1 = ca * (fr.base + fr.len), y1 = sa * (fr.base + fr.len);
      ctx.globalAlpha = bodyA * 0.55;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(ca * fr.base, sa * fr.base);
      ctx.lineTo(x1, y1);
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 + Math.cos(fr.a + fr.fork) * fr.len * 0.5, y1 + Math.sin(fr.a + fr.fork) * fr.len * 0.5);
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 + Math.cos(fr.a - fr.fork) * fr.len * 0.4, y1 + Math.sin(fr.a - fr.fork) * fr.len * 0.4);
      ctx.stroke();
    }
    // — F. SHIMMER: reflejo frío corto que recorre una sección diagonal (sólo él).
    if (tierName !== 'minimal') {
      const sh = shell.shimmer;
      const cyc = (f * sh.speed + sh.phase) % 1;
      const shA = Math.sin(cyc * Math.PI) * 0.30 * bodyA;
      if (shA > 0.01) {
        const baseA = sh.a + cyc * 1.2;
        ctx.globalAlpha = shA;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(Math.cos(baseA) * r * 0.30, Math.sin(baseA) * r * 0.30);
        ctx.lineTo(Math.cos(baseA + sh.span) * r * 0.95, Math.sin(baseA + sh.span) * r * 0.95);
        ctx.stroke();
      }
    }
    // — G. ENTRADA (<150ms): pequeño flash frío mientras la carcasa asienta.
    if (entry < 1) {
      ctx.globalAlpha = (1 - entry) * 0.5 * (0.55 + 0.45 * fadeIn);
      ctx.strokeStyle = '#eafcff';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.80 * (0.90 + entry * 0.10), 0, Math.PI * 2);
      ctx.stroke();
    }
    // — H. SALIDA: fracturas que se intensifican mientras el casing se desvanece.
    if (exit > 0.25) {
      const k = (exit - 0.25) / 0.75;
      ctx.globalAlpha = Math.min(0.8, k * 0.9) * bodyA;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < shell.frost.length && i < 4; i++) {
        const fr = shell.frost[i];
        const ca = Math.cos(fr.a), sa = Math.sin(fr.a);
        ctx.moveTo(ca * fr.base * 0.4, sa * fr.base * 0.4);
        ctx.lineTo(ca * (fr.base + fr.len) * (1 + k * 0.3), sa * (fr.base + fr.len) * (1 + k * 0.3));
      }
      ctx.stroke();
    }
    ctx.restore();
    return true;
  };

  function drawPotionActivation(ctx, event, frame) {
    const t = timeOf(event);
    const converge = Math.max(0, Math.min(1, t / 0.62));
    const pulse = t > 0.62 ? (t - 0.62) / 0.38 : 0;
    ctx.save();
    ctx.translate(event.x, event.y);
    const size = Math.max(14, event.size || 20);
    ctx.shadowColor = '#34d399'; ctx.shadowBlur = 10;
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + i * Math.PI * 2 / 5 + frame * 0.008;
      const startR = size * 2.35;
      const rr = startR * (1 - converge) + size * 0.18 * converge;
      const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
      ctx.globalAlpha = 0.9 - converge * 0.35;
      ctx.fillStyle = i % 2 ? '#bbf7d0' : '#22c55e';
      plusPath(ctx, px, py, size * 0.30);
      ctx.fill();
    }
    if (pulse > 0) {
      ctx.globalAlpha = 0.55 * (1 - pulse);
      ctx.strokeStyle = '#4ade80'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(0, 0, size * 0.55 + pulse * size * 1.2, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = Math.max(0, 0.65 * (1 - pulse));
      ctx.fillStyle = '#d7ffe4';
      ctx.beginPath(); ctx.arc(0, 0, size * 0.20 * (1 - pulse * 0.5), 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawOverdriveActivation(ctx, event) {
    const t = timeOf(event);
    ctx.save();
    ctx.translate(event.x, event.y);
    const size = Math.max(14, event.size || 20);
    const squeeze = t < 0.35 ? t / 0.35 : 1 - (t - 0.35) / 0.65;
    ctx.globalAlpha = 0.65 * (1 - t * 0.65);
    ctx.strokeStyle = '#caa7ff'; ctx.lineWidth = 2.5;
    ctx.shadowColor = '#caa7ff'; ctx.shadowBlur = 12;
    ctx.save();
    ctx.scale(1 + squeeze * 0.22, 1 - squeeze * 0.18);
    ctx.beginPath(); ctx.arc(0, 0, size + 8 + t * size * 1.1, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    ctx.restore();
  }
  // ===== SHIELD PERSISTENTE: campo de fuerza tecnológico facetado =====
  // Determinista (WeakMap por jugador + hash estable). 100% visual; la guarda
  // es player.shield > 0 (coexiste con Phase, Bulwark y Bounty).
  function buildShieldField(rng, size, detail) {
    // SHELL FACETADO: ~12 vértices con radios irregulares deterministas.
    // L laterales prominentes (flancos), T superior, I inferior, F frontal.
    // Lenguaje tecnológico: no es círculo, es una esfera protectora estructurada.
    const R = Math.max(20, size * 1.22);
    const n = 12;
    const baseRadii = [
      0.92, 1.02, 1.06, 0.90, 0.94, 1.04,
      0.91, 1.05, 1.08, 0.93, 0.96, 1.03,
    ];
    const verts = [];
    for (let i = 0; i < n; i++) {
      const ad = i * (Math.PI * 2 / n);
      const rrBase = R * (baseRadii[i] + (rng() - 0.5) * 0.05);
      verts.push({ a: ad + (rng() - 0.5) * 0.05, rr: rrBase });
    }
    // Placas GRANDES: 5 estructurales deterministas + 1 complementaria.
    // span=3 → cada placa abarca 4 vértices de borde (arco segmentado),
    // interior en ~0.40–0.44 del radio → panel convexo visible.
    const span = detail.span || (detail.plates >= 7 ? 3 : 2);
    const plates = [];
    const plateSpec = [
      { i0: 2, span, tone: 0.72, alpha: 0.34, back: true  }, // derecha (L)
      { i0: 9, span, tone: 0.28, alpha: 0.30, back: true  }, // superior (T)
      { i0: 8, span: 2, tone: 0.62, alpha: 0.36, back: false }, // izquierda (F)
      { i0: 3, span, tone: 0.78, alpha: 0.32, back: false }, // inferior (I)
      { i0: 5, span: 2, tone: 0.38, alpha: 0.28, back: false }, // frontal-derecha (F)
      { i0: 11, span: 2, tone: 0.55, alpha: 0.22, back: true, complementary: true }, // complementaria trasera
    ];
    const activePlates = detail.plates >= 7 ? plateSpec
      : detail.plates >= 5 ? plateSpec.filter((p, idx) => idx !== 5)
      : plateSpec.filter((p) => !p.complementary).slice(0, 3);
    for (let i = 0; i < activePlates.length; i++) {
      const sp = activePlates[i];
      plates.push({
        i0: sp.i0,
        span: sp.span,
        tone: sp.tone,
        alpha: sp.alpha,
        phase: rng() * 6.28,
        back: !!sp.back,
        interiorMul: 0.38 + sp.tone * 0.08,
      });
    }
    // Seams: conexiones energéticas discretas entre paneles (pocos, visibles).
    const seams = [];
    const seamSpec = [
      { i0: 5, i1: 7 },
      { i0: 10, i1: 0 },
      { i0: 2, i1: 4 },
      { i0: 8, i1: 10 },
    ];
    const usedSeams = detail.seams >= 4 ? seamSpec : seamSpec.slice(0, detail.seams);
    for (let i = 0; i < usedSeams.length; i++) {
      seams.push({ i0: usedSeams[i].i0, i1: usedSeams[i].i1, phase: rng() * 6.28 });
    }
    // Borde segmentado: grosores/alphas distintos + gaps naturales.
    // Dos gaps (~180° separados) dan sensación de segmentación estructural.
    const edges = [];
    const edgeSpec = [
      { w: 1.7, alpha: 0.78, on: true },
      { w: 1.1, alpha: 0.55, on: true },
      { w: 0.8, alpha: 0.35, on: false },
      { w: 1.6, alpha: 0.72, on: true },
      { w: 1.0, alpha: 0.50, on: true },
      { w: 0.7, alpha: 0.30, on: false },
      { w: 1.8, alpha: 0.80, on: true },
      { w: 1.2, alpha: 0.58, on: true },
      { w: 0.9, alpha: 0.40, on: true },
      { w: 1.5, alpha: 0.70, on: true },
      { w: 0.8, alpha: 0.34, on: false },
      { w: 1.0, alpha: 0.48, on: true },
    ];
    for (let i = 0; i < n; i++) edges.push({ ...edgeSpec[i], phase: rng() * 6.28 });
    // Highlights: 2–3 reflejos cian/blanco con distintos alpha para depth/curvatura.
    const highlights = [
      { i0: 1, span: 3, alpha: 0.30, w: 2.6, primary: true },
      { i0: 6, span: 2, alpha: 0.14, w: 1.7 },
      { i0: 9, span: 2, alpha: 0.10, w: 1.3 },
    ];
    // Microenergía: pocos pulsos que recorren seams (no partículas).
    const ticks = [];
    for (let i = 0; i < seams.length; i++) {
      ticks.push({ s: i, off: rng(), dir: rng() < 0.5 ? 1 : -1 });
    }
    return { R, size, n, verts, plates, seams, edges, highlights, ticks };
  }
  const shieldFieldCache = new WeakMap();
  NV.shieldFieldOf = function (player, size, tierName) {
    const tier = tierName || 'full';
    const detail = tier === 'full' ? { plates: 7, seams: 5 } : (tier === 'reduced' ? { plates: 5, seams: 3 } : { plates: 3, seams: 2 });
    let cached = player ? shieldFieldCache.get(player) : null;
    if (cached && cached.size === size && cached.tier === tier) return cached.field;
    const rng = frozenRng(frozenHash({ shape: 'player', radius: size, maxHp: player ? (player.maxHp || 0) : 0, x: player ? player.x : 0, y: player ? player.y : 0 }));
    const field = buildShieldField(rng, size, detail);
    if (player) shieldFieldCache.set(player, { size, tier, field });
    return field;
  };

  // Paleta del escudo derivada de char.color (fuente de verdad en CHARACTERS).
  // El cian solo sobrevive como fallback cuando no hay color de personaje.
  function hexRgb(hex) {
    const v = parseInt(String(hex).slice(1), 16);
    return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
  }
  function rgbHex(r, g, b) {
    return '#' + [r, g, b].map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('');
  }
  function darken(hex, f) {
    const c = hexRgb(hex);
    return rgbHex(c.r * f, c.g * f, c.b * f);
  }
  function lighten(hex, t) {
    const c = hexRgb(hex);
    return rgbHex(c.r + (255 - c.r) * t, c.g + (255 - c.g) * t, c.b + (255 - c.b) * t);
  }
  function rgba(hex, alpha) {
    const c = hexRgb(hex);
    return `rgba(${c.r},${c.g},${c.b},${alpha})`;
  }
  function mix(hexA, hexB, t) {
    const a = hexRgb(hexA), b = hexRgb(hexB);
    return rgbHex(a.r + (b.r - a.r) * t, a.g + (b.g - a.g) * t, a.b + (b.b - a.b) * t);
  }
  // Paleta del escudo derivada del color visual dominante del personaje.
  // Fuente: char.shieldColor (color real del cuerpo en drawPlayer); char.color
  // queda como compatibilidad y el cian solo como fallback final.
  function shieldBaseColor(char) {
    return (char && char.shieldColor) ? char.shieldColor : ((char && char.color) ? char.color : '#65f2ff');
  }
  function shieldPalette(char) {
    const base = shieldBaseColor(char);
    // Derivación conservadora: el base domina. Los claros se obtienen con
    // mezclas cortas hacia blanco (nunca rosa pálido/blanco dominante).
    const deep = mix(base, '#000000', 0.52);
    const plateDeep = mix(base, '#000000', 0.34);
    const rim = mix(base, '#ffffff', 0.22);
    const seam = mix(base, '#ffffff', 0.12);
    return {
      accent: base,
      plate: plateDeep,
      casing: mix(base, '#000000', 0.18),
      edge: deep,
      highlight: rim,
      flare: seam,
      glow: base,
    };
  }
  function facetPath(ctx, verts, mul, grow) {
    ctx.beginPath();
    for (let i = 0; i < verts.length; i++) {
      const rr = verts[i].rr * mul * grow;
      const px = Math.cos(verts[i].a) * rr, py = Math.sin(verts[i].a) * rr;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }
  function facetPoint(v, mul, grow) {
    const rr = v.rr * mul * grow;
    return [Math.cos(v.a) * rr, Math.sin(v.a) * rr];
  }
  function facetArcPoints(verts, i0, span, mul, grow) {
    const pts = [];
    for (let i = 0; i <= span; i++) {
      const v = verts[(i0 + i) % verts.length];
      pts.push(facetPoint(v, mul, grow));
    }
    return pts;
  }
  function facetArcInterior(verts, i0, span, interiorMul, grow) {
    const pts = [];
    for (let i = 0; i <= span; i++) {
      const v = verts[(i0 + i) % verts.length];
      const rr = v.rr * interiorMul * grow;
      pts.push([Math.cos(v.a) * rr, Math.sin(v.a) * rr]);
    }
    return pts;
  }
  // Campo persistente: back layer (detrás del personaje) + front layer (encima).
  function drawShieldField(ctx, player, char, f, layer, tierName) {
    const size = char.size || 20;
    const pal = shieldPalette(char);
    const field = NV.shieldFieldOf(player, size, tierName);
    const shield = player.shield;
    // FINAL (~0.30s): apagado desigual — highlight desaparece primero, borde
    // flicker, seams fallan, shell baja alpha. Nunca un apagón instantáneo.
    const fall = shield < 0.3 ? Math.max(0, shield / 0.3) : 1;
    const flick = fall < 1 ? 0.72 + 0.28 * Math.abs(Math.sin(f * 0.9)) : 1;
    const phaseDim = player.phase > 0 ? 0.72 : 1; // coexistencia con Phase
    const pulse = 0.5 + Math.sin(f * 0.16) * 0.5;
    const glow = 1 + Math.sin(f * 0.11) * 0.012; // micro-respiración del campo
    const A = (m) => Math.max(0, m * fall * (fall < 1 ? flick : 1) * phaseDim);
    const R = field.R;
    ctx.save();
    if (layer === 'behind') {
      // PARTE TRASERA: shell volumétrico tenue + glow profundo + placas posteriores.
      facetPath(ctx, field.verts, 1.0, glow);
      if (typeof ctx.createRadialGradient === 'function') {
        const g = ctx.createRadialGradient(0, 0, R * 0.2, 0, 0, R * 1.08);
        g.addColorStop(0, rgba(pal.casing, 0.02));
        g.addColorStop(0.72, rgba(pal.accent, 0.05));
        g.addColorStop(1, rgba(pal.accent, 0.11));
        ctx.globalAlpha = A(1);
        ctx.fillStyle = g;
        ctx.fill();
      } else {
        ctx.globalAlpha = A(0.05);
        ctx.fillStyle = pal.accent;
        ctx.fill();
      }
      // Placas traseras: volumen (interior) visible pero atenuado (perspectiva trás).
      for (const p of field.plates) {
        if (!p.back) continue;
        const outer = facetArcPoints(field.verts, p.i0, p.span, 1.0, glow);
        const inner = facetArcInterior(field.verts, p.i0, p.span, p.interiorMul, glow);
        ctx.globalAlpha = A(0.22 + pulse * 0.06);
        ctx.fillStyle = pal.plate;
        ctx.beginPath();
        ctx.moveTo(outer[0][0], outer[0][1]);
        for (let k = 1; k < outer.length; k++) ctx.lineTo(outer[k][0], outer[k][1]);
        for (let k = inner.length - 1; k >= 0; k--) ctx.lineTo(inner[k][0], inner[k][1]);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = A(0.16 + pulse * 0.05);
        ctx.strokeStyle = pal.edge;
        ctx.lineWidth = 0.9;
        ctx.stroke();
      }
      // Borde trasero tenue por secciones (gaps para segmentación).
      for (let i = 0; i < field.n; i++) {
        const ed = field.edges[i];
        if (!ed.on) continue;
        const p0 = facetPoint(field.verts[i], 1.02, glow);
        const p1 = facetPoint(field.verts[(i + 1) % field.n], 1.02, glow);
        ctx.globalAlpha = A(ed.alpha * 0.30);
        ctx.strokeStyle = pal.edge;
        ctx.lineWidth = ed.w * 0.8;
        ctx.beginPath();
        ctx.moveTo(p0[0], p0[1]);
        ctx.lineTo(p1[0], p1[1]);
        ctx.stroke();
      }
    } else if (layer === 'front') {
      // PARTE FRONTAL: placas delanteras/laterales, seams energéticos, borde
      // segmentado, highlights y microenergía. Sin relleno del cuerpo (eso va
      // en 'behind'): el personaje se ve perfectamente a través del campo.
      for (const p of field.plates) {
        if (p.back) continue;
        const outer = facetArcPoints(field.verts, p.i0, p.span, 1.0, glow);
        const inner = facetArcInterior(field.verts, p.i0, p.span, p.interiorMul, glow);
        ctx.globalAlpha = A(p.alpha * (0.60 + pulse * 0.22 + p.tone * 0.10));
        ctx.fillStyle = p.tone > 0.5 ? pal.plate : pal.casing;
        ctx.beginPath();
        ctx.moveTo(outer[0][0], outer[0][1]);
        for (let k = 1; k < outer.length; k++) ctx.lineTo(outer[k][0], outer[k][1]);
        for (let k = inner.length - 1; k >= 0; k--) ctx.lineTo(inner[k][0], inner[k][1]);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = A(0.26 + pulse * 0.12);
        ctx.strokeStyle = p.tone > 0.5 ? pal.accent : pal.flare;
        ctx.lineWidth = 1.1;
        ctx.stroke();
      }
      // Seams: pocas líneas finas de energía entre paneles, pulsando.
      ctx.lineCap = 'round';
      for (const s of field.seams) {
        const on = 0.5 + 0.5 * Math.sin(f * 0.09 + s.phase);
        const p0 = facetPoint(field.verts[s.i0], 1.0, glow);
        const p1 = facetPoint(field.verts[s.i1], 1.0, glow);
        ctx.globalAlpha = A(0.12 + on * 0.26);
        ctx.strokeStyle = pal.flare;
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.moveTo(p0[0], p0[1]);
        ctx.lineTo(p1[0], p1[1]);
        ctx.stroke();
      }
      // BORDE ENERGÉTICO por secciones: grosores/alphas distintos, gaps
      // naturales (ed.on) y pulsación por segmento. Nunca un aro uniforme.
      for (let i = 0; i < field.n; i++) {
        const ed = field.edges[i];
        if (!ed.on) continue;
        const breathe = 0.72 + 0.28 * Math.sin(f * 0.14 + ed.phase * 6.28);
        const p0 = facetPoint(field.verts[i], 1.02, glow);
        const p1 = facetPoint(field.verts[(i + 1) % field.n], 1.02, glow);
        ctx.globalAlpha = A(ed.alpha * breathe);
        ctx.strokeStyle = breathe > 0.92 ? pal.highlight : pal.accent;
        ctx.lineWidth = ed.w;
        ctx.beginPath();
        ctx.moveTo(p0[0], p0[1]);
        ctx.lineTo(p1[0], p1[1]);
        ctx.stroke();
      }
      // Highlights curvos: principal superior-lateral, secundario opuesto
      // tenue, frontal mínimo. El principal desaparece primero en el FINAL.
      // Highlights: solo 1 reflejo principal pequeño + 2 ecos muy tenues.
      // El blanco es reflejo, nunca el color principal del campo.
      for (const h of field.highlights) {
        if (fall < 1 && h.primary) continue;
        const reflection = h.primary ? mix(pal.accent, '#ffffff', 0.42) : pal.flare;
        ctx.globalAlpha = A(h.alpha * (h.primary ? 0.55 : 0.5));
        ctx.strokeStyle = reflection;
        ctx.lineWidth = h.w * (h.primary ? 0.7 : 0.6);
        ctx.beginPath();
        const pts = facetArcPoints(field.verts, h.i0, h.span, 0.985, glow);
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1]);
        ctx.stroke();
      }
      // Microenergía: pulsos breves que recorren los seams (no partículas).
      if (tierName !== 'minimal') {
        for (const tk of field.ticks) {
          const s = field.seams[tk.s];
          if (!s) continue;
          const prog = (f * 0.008 + tk.off) % 1;
          const p0 = facetPoint(field.verts[s.i0], 1.0, glow);
          const p1 = facetPoint(field.verts[s.i1], 1.0, glow);
          const dx = p1[0] - p0[0], dy = p1[1] - p0[1];
          const dl = Math.hypot(dx, dy) || 1;
          const mx = p0[0] + dx * prog, my = p0[1] + dy * prog;
          const len = 3 + size * 0.07;
          ctx.globalAlpha = A(0.30 * Math.sin(prog * Math.PI));
          ctx.strokeStyle = pal.accent;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(mx - (dx / dl) * len, my - (dy / dl) * len);
          ctx.lineTo(mx + (tk.dir ? -dy : dy) / dl * 1.6, my + (tk.dir ? dx : -dx) / dl * 1.6);
          ctx.lineTo(mx, my);
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  }

  // ===== SHIELD — ACTIVACIÓN: "ESCUDO DESPLEGADO" (separada del estado
  // persistente). F1 expansión rápida → F2 silueta → F3 placas se ensamblan →
  // F4 flare corto. Determinista; reutiliza la estructura facetada del campo.
  function drawShieldDeploy(ctx, event, char, frame) {
    const t = timeOf(event);
    const size = Math.max(14, event.size || 20);
    const pal = shieldPalette(char);
    ctx.save();
    ctx.translate(event.x, event.y);
    const field = NV.shieldFieldOf(null, size, 'full');
    const easeOut = (x) => 1 - Math.pow(1 - x, 3);
    // FASE 1 (0–0.18): expansión rápida desde el jugador, ya en color base.
    if (t < 0.18) {
      const p = t / 0.18;
      ctx.globalAlpha = 0.42 * (1 - p);
      ctx.strokeStyle = pal.accent;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(0, 0, size + p * size * 1.3, 0, Math.PI * 2);
      ctx.stroke();
    }
    // FASE 2 (0.12–0.42): la silueta facetada crece hasta su escala final.
    if (t > 0.12) {
      const p = easeOut(Math.min(1, (t - 0.12) / 0.3));
      ctx.globalAlpha = 0.10 + p * 0.18;
      ctx.strokeStyle = pal.accent;
      ctx.lineWidth = 1.6;
      facetPath(ctx, field.verts, 1.0, 0.86 + 0.14 * p);
      ctx.stroke();
    }
    // FASE 3 (0.30–0.90): las placas se ensamblan/encienden en secuencia.
    if (t > 0.3) {
      for (const p of field.plates) {
        const on = Math.max(0, Math.min(1, (t - 0.3 - (p.phase * 0.0) * 0) / 0.16));
        if (on <= 0 || p.back) continue;
        const outer = facetArcPoints(field.verts, p.i0, p.span, 1.0, 1);
        const inner = facetArcInterior(field.verts, p.i0, p.span, p.interiorMul, 1);
        ctx.globalAlpha = on * (0.22 + p.alpha * 0.36);
        ctx.fillStyle = p.tone > 0.5 ? pal.plate : pal.casing;
        ctx.beginPath();
        ctx.moveTo(outer[0][0], outer[0][1]);
        for (let k = 1; k < outer.length; k++) ctx.lineTo(outer[k][0], outer[k][1]);
        for (let k = inner.length - 1; k >= 0; k--) ctx.lineTo(inner[k][0], inner[k][1]);
        ctx.closePath();
        ctx.fill();
      }
    }
    // FASE 4 (0.60–0.95): consolidación corta en color base, sin flare blanco.
    if (t > 0.6 && t < 0.95) {
      const fp = 1 - (t - 0.6) / 0.35;
      ctx.globalAlpha = 0.36 * fp;
      ctx.strokeStyle = pal.accent;
      ctx.lineWidth = 1.8;
      facetPath(ctx, field.verts, 1.04, 1 + fp * 0.03);
      ctx.stroke();
    }
    void frame;
    ctx.restore();
  }

  // Radio autoritativo de la detonación de la bomba: la esquina más lejana de la
  // arena desde el epicentro (sin caps arbitrarios; puede superar 600 px).
  NV.bombMaxRadius = function (event) {
    if (!event) return 0;
    const x = Number(event.x) || 0;
    const y = Number(event.y) || 0;
    const W = Number(event.arenaW) || 0;
    const H = Number(event.arenaH) || 0;
    if (W > 0 && H > 0) {
      return Math.max(
        Math.hypot(x, y),
        Math.hypot(W - x, y),
        Math.hypot(x, H - y),
        Math.hypot(W - x, H - y)
      );
    }
    return Math.hypot(x, y);
  };

  function drawBombActivation(ctx, event, frame) {
    const t = timeOf(event);
    const size = Math.max(14, event.size || 20);
    const maxR = NV.bombMaxRadius(event);
    const W = event.arenaW || Math.max(1, Math.ceil(Math.abs(event.x) * 2));
    const H = event.arenaH || Math.max(1, Math.ceil(Math.abs(event.y) * 2));
    const DET = NV.BOMB_IMPACT_T; // instante de detonación (constante compartida con la mecánica)
    ctx.save();
    // DISTORSIÓN GLOBAL: overlay en coordenadas ABSOLUTAS de la arena, ANTES del
    // translate al epicentro (un rect desde (0,0) tras translate quedaría
    // desplazado). Oscurecimiento + tinte magenta radial, muy breve.
    if (t >= DET) {
      const k = Math.max(0, Math.min(1, (t - DET) / (1 - DET)));
      const shade = 0.40 * Math.pow(1 - k, 1.6);
      if (shade > 0.004) {
        ctx.fillStyle = 'rgba(12,2,20,' + shade.toFixed(3) + ')';
        ctx.fillRect(0, 0, W, H);
        if (typeof ctx.createRadialGradient === 'function') {
          const g = ctx.createRadialGradient(event.x, event.y, 0, event.x, event.y, Math.max(1, maxR));
          g.addColorStop(0, 'rgba(255,46,136,' + (0.32 * (1 - k)).toFixed(3) + ')');
          g.addColorStop(1, 'rgba(255,46,136,0)');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, W, H);
        }
      }
    }
    ctx.translate(event.x, event.y);
    ctx.shadowColor = '#ff2e88';
    ctx.shadowBlur = 16;
    if (t < 0.34) {
      // SUCCIÓN: líneas de energía convergen al centro desde el radio máximo.
      const k = t / 0.34;
      const rOut = maxR * (0.98 - 0.86 * k);
      const rIn = maxR * Math.max(0.02, 0.78 - 0.76 * k);
      ctx.lineCap = 'round';
      for (let i = 0; i < 10; i++) {
        const a = (event.seedAngle || 0) + i * Math.PI / 5 + 0.11;
        const ca = Math.cos(a), sa = Math.sin(a);
        ctx.globalAlpha = 0.30 + k * 0.55;
        ctx.strokeStyle = i % 2 ? '#ff77b3' : '#a855f7';
        ctx.lineWidth = 1.6 + k * 1.4;
        ctx.beginPath();
        ctx.moveTo(ca * rOut, sa * rOut);
        ctx.lineTo(ca * rIn, sa * rIn);
        ctx.stroke();
      }
      ctx.globalAlpha = 0.35 + k * 0.35;
      ctx.strokeStyle = '#7c3aed';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, size * (2.2 - k * 1.2), 0, Math.PI * 2);
      ctx.stroke();
    } else if (t < DET) {
      // COMPRESIÓN: núcleo oscuro/magenta al colapsar.
      const k = (t - 0.34) / (DET - 0.34);
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = '#160414';
      ctx.beginPath();
      ctx.arc(0, 0, size * (1.05 - k * 0.35), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = '#ff2e88';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, size * (1.05 - k * 0.35), 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.30 + k * 0.5;
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(0, 0, size * (2.6 - k * 1.6), 0, Math.PI * 2);
      ctx.stroke();
    } else {
      // DETONACIÓN: onda enorme hasta la esquina más lejana del epicentro.
      const k = Math.max(0, Math.min(1, (t - DET) / (1 - DET)));
      const eo = 1 - Math.pow(1 - k, 3);
      const waveR = maxR * eo;
      ctx.globalAlpha = Math.max(0, 0.9 * (1 - k));
      ctx.strokeStyle = '#ff5fa2';
      ctx.lineWidth = 5 * (1 - k) + 1;
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(1, waveR), 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = Math.max(0, 0.55 * (1 - k));
      ctx.strokeStyle = '#7c3aed';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(1, waveR * 0.72), 0, Math.PI * 2);
      ctx.stroke();
      // RESIDUO: arcos y fragmentos que se desvanecen sobre el frente de onda.
      if (k > 0.18) {
        const res = Math.max(0, Math.min(1, (k - 0.18) / 0.82));
        ctx.lineCap = 'round';
        for (let i = 0; i < 6; i++) {
          const a = (event.seedAngle || 0) + i * Math.PI / 3 - frame * 0.01;
          ctx.globalAlpha = Math.max(0, 0.6 * (1 - res));
          ctx.strokeStyle = i % 2 ? '#ff8fc0' : '#a855f7';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 0, Math.max(2, waveR), a, a + 0.5 - res * 0.25);
          ctx.stroke();
        }
        const frag = 10;
        for (let i = 0; i < frag; i++) {
          const a = (event.seedAngle || 0) + i * (Math.PI * 2 / frag) + 0.37;
          const d = waveR * (0.55 + (i % 3) * 0.14);
          ctx.globalAlpha = Math.max(0, 0.5 * (1 - res));
          ctx.fillStyle = i % 2 ? '#ffd0e4' : '#c084fc';
          diamondPath(ctx, Math.cos(a) * d, Math.sin(a) * d, 3 + (i % 2) * 2, 1.4);
          ctx.fill();
        }
      }
    }
    ctx.restore();
  }

  function drawFreezePulse(ctx, event, frame) {
    const t = timeOf(event);
    ctx.save();
    ctx.translate(event.x, event.y);
    const size = Math.max(14, event.size || 20);
    ctx.globalAlpha = Math.max(0, 0.7 * (1 - t));
    ctx.strokeStyle = '#9beeff'; ctx.lineWidth = 3;
    ctx.shadowColor = '#67e8f9'; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.arc(0, 0, size + 8 + t * size * 3.0, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = Math.max(0, 0.55 * (1 - t));
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3 + frame * 0.006;
      const rr = size + 10 + t * size * 3.0;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (rr - 7), Math.sin(a) * (rr - 7));
      ctx.lineTo(Math.cos(a) * (rr + 7), Math.sin(a) * (rr + 7));
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawBountyActivation(ctx, event) {
    const t = timeOf(event);
    ctx.save();
    ctx.translate(event.x, event.y);
    const size = Math.max(14, event.size || 20);
    ctx.globalAlpha = Math.max(0, 0.8 * (1 - t));
    ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 3;
    ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.arc(0, 0, size + 10 + t * size * 1.4, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = Math.max(0, 0.85 * (1 - t));
    ctx.fillStyle = '#fff4c2';
    ctx.beginPath(); ctx.arc(0, -size - 16 - t * 10, 3.2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  NV.drawConsumableActivation = function (ctx, event, player, char, frame) {
    if (!ctx || !event) return false;
    if (event.x == null || event.y == null) return false;
    const size = (char && char.size) || 20;
    // #11: reenviar dimensiones reales de la arena y seed — drawBombActivation
    // las necesita para calcular el radio hasta la esquina más lejana.
    const ev = { type: event.type, x: event.x, y: event.y, life: event.life, duration: event.duration, size, seedAngle: event.seedAngle || 0, arenaW: event.arenaW || 0, arenaH: event.arenaH || 0 };
    if (ev.type === 'potion') drawPotionActivation(ctx, ev, frame || 0);
    else if (ev.type === 'overdrive') drawOverdriveActivation(ctx, ev);
    else if (ev.type === 'shield') drawShieldDeploy(ctx, ev, char, frame || 0);
    else if (ev.type === 'bomb') drawBombActivation(ctx, ev, frame || 0);
    else if (ev.type === 'freeze') drawFreezePulse(ctx, ev, frame || 0);
    else if (ev.type === 'bounty') drawBountyActivation(ctx, ev);
    else return false;
    void player;
    return true;
  };

  NV.drawPlayerConsumableEffects = function (ctx, player, char, frame, layer) {
    if (!ctx || !player || !char) return false;
    const size = char.size || 20;
    const f = frame || 0;
    const pol = budget();
    const depressed = pol && pol.tier !== 'full';
    ctx.save();
    if (layer === 'behind') {
      if (player.overdrive > 0) {
        const m = motionOf(player);
        const moving = m.speed > 24;
        const lean = Math.atan2(m.uy, m.ux);
        const streaks = depressed ? 2 : 4;
        ctx.lineCap = 'round';
        for (let i = 0; i < streaks; i++) {
          const lateral = (i - (streaks - 1) / 2) * (size * 0.34);
          const len = size * (moving ? (1.25 + (i % 2) * 0.45) : 0.28);
          const bx = -m.ux * (size * 0.85) + Math.cos(lean + Math.PI / 2) * lateral;
          const by = -m.uy * (size * 0.85) + Math.sin(lean + Math.PI / 2) * lateral;
          const wobble = Math.sin(f * 0.32 + i * 1.7) * size * 0.08;
          ctx.globalAlpha = moving ? 0.58 - i * 0.07 : 0.22;
          ctx.strokeStyle = i % 2 ? '#efe2ff' : '#caa7ff';
          ctx.lineWidth = 2.6 - i * 0.35;
          if (!depressed) { ctx.shadowColor = '#a855f7'; ctx.shadowBlur = 8; }
          ctx.beginPath();
          ctx.moveTo(bx + wobble * 0.35, by);
          ctx.lineTo(bx - m.ux * len + wobble, by - m.uy * len);
          ctx.stroke();
        }
        ctx.shadowBlur = 0;
        const arcs = depressed ? 1 : 2;
        for (let i = 0; i < arcs; i++) {
          const aa = lean + Math.PI + Math.sin(f * 0.22 + i * 2.4) * 0.55;
          ctx.globalAlpha = moving ? 0.38 : 0.20;
          ctx.strokeStyle = '#8b5cf6';
          ctx.lineWidth = 1.7;
          ctx.beginPath();
          ctx.arc(-m.ux * size * 0.55, -m.uy * size * 0.55, size * (0.55 + i * 0.18), aa - 0.65, aa + 0.65);
          ctx.stroke();
        }
      }
      if (player.shield > 0) { // PARTE TRASERA del campo (detrás del personaje)
        drawShieldField(ctx, player, char, f, 'behind', pol ? pol.tier : 'full');
      }
    } else {
      if (player.bounty > 0) {
        const coins = depressed ? 3 : 4;
        for (let i = 0; i < coins; i++) {
          const orbit = size + 17 + (i % 2) * 7;
          const a = f * (0.035 + i * 0.006) + i * Math.PI * 2 / coins;
          const px = Math.cos(a) * orbit;
          const py = Math.sin(a) * orbit * 0.62;
          const tw = 0.62 + Math.sin(f * 0.16 + i * 1.9) * 0.38;
          ctx.globalAlpha = 0.55 + tw * 0.35;
          ctx.fillStyle = '#ffd34d';
          if (!depressed) { ctx.shadowColor = '#ffb700'; ctx.shadowBlur = 8; }
          diamondPath(ctx, px, py, 3.4 + tw * 1.5, 1.35);
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.globalAlpha *= 0.55;
          ctx.fillStyle = '#fff3c4';
          diamondPath(ctx, px, py - 1, 1.5, 1.35);
          ctx.fill();
        }
      }
      if (player.shield > 0) { // coexiste con Phase: sin exclusión phase<=0
        drawShieldField(ctx, player, char, f, 'front', pol ? pol.tier : 'full');
      }
    }
    ctx.restore();
    return true;
  };
})();


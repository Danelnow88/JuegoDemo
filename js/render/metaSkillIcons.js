// ===== RENDER: iconos SVG-approved de mejoras permanentes y habilidades convertidos a canvas =====
// Grilla lógica 32x32. Diseños aprobados en previews/meta-skill-icons-preview.html.
(() => {
  'use strict';
  const NV = window.NV;

  const COLORS = {
    damage: { c: '#ff5f9b', c2: '#fca5a5' },
    speed: { c: '#38bdf8', c2: '#bae6fd' },
    hp: { c: '#22c55e', c2: '#fb7185' },
    armor: { c: '#ffcf76', c2: '#fde68a' },
    luck: { c: '#84cc16', c2: '#fde68a' },
    crit: { c: '#f97316', c2: '#fecaca' },
    dodge: { c: '#7cf8ff', c2: '#cbd5e1' },
    regen: { c: '#4ade80', c2: '#86efac' },
    greed: { c: '#ffd700', c2: '#fbbf24' },
    meteor: { c: '#7cf8ff', c2: '#bfdbfe' },
    phase: { c: '#caa7ff', c2: '#f0abfc' },
    bulwark: { c: '#ffcf76', c2: '#fde68a' },
    hivemind: { c: '#8dfaff', c2: '#5eead4' },
  };

  function idOf(item) { return typeof item === 'string' ? item : (item && (item.key || item.special || item.id || item.type)) || 'damage'; }
  function color(id, cls) { const p = COLORS[id] || COLORS.damage; return cls === 'accent' ? p.c : cls === 'alt' ? p.c2 : cls === 'ghost' ? p.c : '#e5eefb'; }
  function fallbackPath(ctx, d) {
    if (typeof ctx.moveTo !== 'function' || typeof ctx.lineTo !== 'function') return false;
    const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+/g) || [];
    let i = 0, cmd = '', x = 0, y = 0;
    const num = () => parseFloat(tokens[i++]);
    while (i < tokens.length) {
      if (/^[a-zA-Z]$/.test(tokens[i])) cmd = tokens[i++];
      if (cmd === 'M') { x = num(); y = num(); ctx.moveTo(x, y); cmd = 'L'; }
      else if (cmd === 'm') { x += num(); y += num(); ctx.moveTo(x, y); cmd = 'l'; }
      else if (cmd === 'L') { x = num(); y = num(); ctx.lineTo(x, y); }
      else if (cmd === 'l') { x += num(); y += num(); ctx.lineTo(x, y); }
      else if (cmd === 'H') { x = num(); ctx.lineTo(x, y); }
      else if (cmd === 'h') { x += num(); ctx.lineTo(x, y); }
      else if (cmd === 'V') { y = num(); ctx.lineTo(x, y); }
      else if (cmd === 'v') { y += num(); ctx.lineTo(x, y); }
      else if (cmd === 'C') { const x1 = num(), y1 = num(), x2 = num(), y2 = num(), x3 = num(), y3 = num(); if (typeof ctx.bezierCurveTo === 'function') ctx.bezierCurveTo(x1, y1, x2, y2, x3, y3); else ctx.lineTo(x3, y3); x = x3; y = y3; }
      else if (cmd === 'c') { const x1 = x + num(), y1 = y + num(), x2 = x + num(), y2 = y + num(), x3 = x + num(), y3 = y + num(); if (typeof ctx.bezierCurveTo === 'function') ctx.bezierCurveTo(x1, y1, x2, y2, x3, y3); else ctx.lineTo(x3, y3); x = x3; y = y3; }
      else if (cmd === 'S' || cmd === 's') { const x2 = (cmd === 's' ? x : 0) + num(), y2 = (cmd === 's' ? y : 0) + num(), x3 = (cmd === 's' ? x : 0) + num(), y3 = (cmd === 's' ? y : 0) + num(); if (typeof ctx.bezierCurveTo === 'function') ctx.bezierCurveTo(x, y, x2, y2, x3, y3); else ctx.lineTo(x3, y3); x = x3; y = y3; }
      else if (cmd === 'A' || cmd === 'a') { i += 5; const nx = (cmd === 'a' ? x : 0) + num(), ny = (cmd === 'a' ? y : 0) + num(); ctx.lineTo(nx, ny); x = nx; y = ny; }
      else if (cmd === 'Z' || cmd === 'z') { if (typeof ctx.closePath === 'function') ctx.closePath(); }
      else break;
    }
    return true;
  }
  function path(ctx, cls, d) {
    ctx.strokeStyle = color(this.id, cls); ctx.globalAlpha = cls === 'ghost' ? 0.42 : 1;
    if (typeof Path2D !== 'undefined') { const p = new Path2D(d); ctx.stroke(p); }
    else { ctx.beginPath(); if (fallbackPath(ctx, d)) ctx.stroke(); }
    ctx.globalAlpha = 1;
  }
  function circle(ctx, cls, x, y, r, fill) { ctx.strokeStyle = color(this.id, cls); ctx.fillStyle = color(this.id, cls); ctx.globalAlpha = cls === 'ghost' ? 0.42 : 1; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); fill ? ctx.fill() : ctx.stroke(); ctx.globalAlpha = 1; }

  const DRAW = {
    damage(ctx) { path.call(this, ctx, 'base', 'M7 25l12-12'); path.call(this, ctx, 'accent', 'M17 5l10 10-5 1-6 6-6-6 6-6 1-5Z'); path.call(this, ctx, 'ghost', 'M6 16l4-4M16 26l4-4'); },
    speed(ctx) { path.call(this, ctx, 'accent', 'M6 18h15'); path.call(this, ctx, 'accent', 'M17 12l6 6-6 6'); path.call(this, ctx, 'base', 'M4 12h9M2 24h10'); path.call(this, ctx, 'ghost', 'M8 7h8'); },
    hp(ctx) { path.call(this, ctx, 'base', 'M16 27S6 20.5 6 12.8C6 8.8 8.6 6 12 6c2 0 3.3 1 4 2.2C16.7 7 18 6 20 6c3.4 0 6 2.8 6 6.8C26 20.5 16 27 16 27Z'); path.call(this, ctx, 'accent', 'M16 12v8M12 16h8'); path.call(this, ctx, 'ghost', 'M9 12.5c0-1.8 1.2-3.3 3-3.6'); },
    armor(ctx) { path.call(this, ctx, 'base', 'M16 4l9 4v7c0 6-3.7 10.2-9 13-5.3-2.8-9-7-9-13V8l9-4Z'); path.call(this, ctx, 'accent', 'M11 13h10M10 17h12M13 21h6'); path.call(this, ctx, 'ghost', 'M16 7v18'); },
    luck(ctx) { circle.call(this, ctx, 'base', 13, 13, 3.2, false); circle.call(this, ctx, 'base', 19, 13, 3.2, false); circle.call(this, ctx, 'base', 13, 19, 3.2, false); circle.call(this, ctx, 'base', 19, 19, 3.2, false); path.call(this, ctx, 'accent', 'M18.5 20.5L24 26'); },
    crit(ctx) { circle.call(this, ctx, 'base', 16, 16, 8, false); path.call(this, ctx, 'accent', 'M16 8v5M16 19v5M8 16h5M19 16h5'); path.call(this, ctx, 'alt', 'M13 13l6 6M19 13l-6 6'); path.call(this, ctx, 'ghost', 'M23 9l3-3M9 23l-3 3'); },
    dodge(ctx) { path.call(this, ctx, 'base', 'M12 8c4 3 4 13 0 16'); path.call(this, ctx, 'ghost', 'M18 8c4 3 4 13 0 16'); path.call(this, ctx, 'accent', 'M4 16h9'); path.call(this, ctx, 'alt', 'M22 12l5 4-5 4'); },
    regen(ctx) { path.call(this, ctx, 'base', 'M24 11a9 9 0 0 0-15-3'); path.call(this, ctx, 'base', 'M8 21a9 9 0 0 0 15 3'); path.call(this, ctx, 'accent', 'M9 5v5h5M23 27v-5h-5'); path.call(this, ctx, 'alt', 'M16 12v8M12 16h8'); },
    greed(ctx) { path.call(this, ctx, 'base', 'M16 5l8 6-3 12H11L8 11l8-6Z'); path.call(this, ctx, 'accent', 'M8 11h16M11 23l5-18 5 18'); path.call(this, ctx, 'alt', 'M25 5l.8 1.7 1.7.8-1.7.8L25 11l-.8-1.7-1.7-.8 1.7-.8L25 5Z'); },
    meteor(ctx) { path.call(this, ctx, 'accent', 'M22 4L11 15'); path.call(this, ctx, 'base', 'M9 17l6-6 6 6-6 6-6-6Z'); path.call(this, ctx, 'ghost', 'M5 25c5 3 17 3 22 0'); path.call(this, ctx, 'alt', 'M25 7h3M25 11h2'); },
    phase(ctx) { path.call(this, ctx, 'base', 'M16 5c5 0 8 4 8 9v10l-4-2-4 2-4-2-4 2V14c0-5 3-9 8-9Z'); path.call(this, ctx, 'accent', 'M11 15c2-2 8-2 10 0'); path.call(this, ctx, 'ghost', 'M6 16H3M29 16h-3M8 9L5 7M24 9l3-2'); circle.call(this, ctx, 'base', 13, 13, 1, true); circle.call(this, ctx, 'base', 19, 13, 1, true); },
    bulwark(ctx) { path.call(this, ctx, 'base', 'M16 4l8 4v7c0 5.5-3.2 9.4-8 12-4.8-2.6-8-6.5-8-12V8l8-4Z'); path.call(this, ctx, 'accent', 'M16 8v16M11 14h10'); path.call(this, ctx, 'ghost', 'M5 12c-3 2.5-3 6.5 0 9M27 12c3 2.5 3 6.5 0 9'); path.call(this, ctx, 'alt', 'M3 16H1M31 16h-2'); },
    hivemind(ctx) { circle.call(this, ctx, 'base', 16, 16, 4, false); circle.call(this, ctx, 'ghost', 16, 16, 10, false); path.call(this, ctx, 'accent', 'M16 6v4M16 22v4M6 16h4M22 16h4'); path.call(this, ctx, 'alt', 'M9 9l3 3M23 9l-3 3M9 23l3-3M23 23l-3-3'); circle.call(this, ctx, 'base', 16, 16, 1, true); },
  };

  NV.META_SKILL_ICON_IDS = Object.keys(DRAW);
  NV.metaSkillIconColors = COLORS;
  NV.drawMetaSkillIcon = function (ctx, idOrItem, x, y, size, opts) {
    const id = idOf(idOrItem);
    const draw = DRAW[id] || DRAW.damage;
    opts = opts || {};
    ctx.save();
    ctx.translate(x, y);
    const s = (size || 24) / 32;
    ctx.scale(s, s);
    ctx.translate(-16, -16);
    ctx.lineWidth = opts.lineWidth || 1.9;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (opts.glow) { ctx.shadowColor = (COLORS[id] || COLORS.damage).c; ctx.shadowBlur = opts.glow; }
    draw.call({ id }, ctx);
    ctx.shadowBlur = 0;
    ctx.restore();
  };

  NV.metaSkillIconToDataURL = function (idOrItem, size) {
    const c = document.createElement('canvas');
    c.width = c.height = size || 48;
    const ctx = c.getContext('2d');
    NV.drawMetaSkillIcon(ctx, idOrItem, c.width / 2, c.height / 2, Math.floor(c.width * 0.78), { glow: 2 });
    return c.toDataURL('image/png');
  };
})();
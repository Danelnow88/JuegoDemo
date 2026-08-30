// ===== RENDER: iconos SVG-approved de consumibles convertidos a canvas =====
// Grilla lógica 32x32. Diseños minimalistas aprobados en previews/consumable-icons-preview.html.
(() => {
  'use strict';
  const NV = window.NV;

  const COLORS = {
    potion: { c: '#22c55e', c2: '#86efac' },
    overdrive: { c: '#caa7ff', c2: '#f0abfc' },
    shield: { c: '#ffcf76', c2: '#fde68a' },
    bomb: { c: '#ff5f9b', c2: '#fca5a5' },
    freeze: { c: '#67e8f9', c2: '#c4b5fd' },
    magnet: { c: '#7cf8ff', c2: '#93c5fd' },
    bounty: { c: '#ffd700', c2: '#fbbf24' },
  };

  function idOf(item) { return typeof item === 'string' ? item : (item && (item.type || item.id || item.key)) || 'potion'; }
  function color(id, cls) { const p = COLORS[id] || COLORS.potion; return cls === 'accent' ? p.c2 : cls === 'alt' ? p.c2 : cls === 'ghost' ? p.c : p.c; }
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
    potion(ctx) { path.call(this, ctx, 'base', 'M13 5h6'); path.call(this, ctx, 'base', 'M14 8v4l-4 8c-1.4 2.8.6 6 3.8 6h4.4c3.2 0 5.2-3.2 3.8-6l-4-8V8'); path.call(this, ctx, 'accent', 'M11.5 20h9'); circle.call(this, ctx, 'base', 17.8, 17, 1, true); },
    overdrive(ctx) { path.call(this, ctx, 'accent', 'M18 3l-7 13h6l-3 13 9-16h-6l1-10Z'); path.call(this, ctx, 'base', 'M6 11h5'); path.call(this, ctx, 'ghost', 'M4 16h5M7 21h4'); },
    shield(ctx) { path.call(this, ctx, 'base', 'M16 4l9 4v7c0 6-3.7 10.2-9 13-5.3-2.8-9-7-9-13V8l9-4Z'); path.call(this, ctx, 'accent', 'M12 16l3 3 6-7'); path.call(this, ctx, 'ghost', 'M16 7v18'); },
    bomb(ctx) { circle.call(this, ctx, 'base', 15, 18, 8, false); path.call(this, ctx, 'accent', 'M20.5 11.5l3-3'); path.call(this, ctx, 'alt', 'M25 5l1 2.2 2.2.8-2.2.9-1 2.1-1-2.1-2.2-.9 2.2-.8L25 5Z'); path.call(this, ctx, 'ghost', 'M10.5 14.5c1-1.2 2.4-1.9 4-2'); },
    freeze(ctx) { circle.call(this, ctx, 'ghost', 16, 16, 10, false); path.call(this, ctx, 'accent', 'M16 5v22'); path.call(this, ctx, 'base', 'M6.5 10.5l19 11'); path.call(this, ctx, 'base', 'M25.5 10.5l-19 11'); path.call(this, ctx, 'accent', 'M12 8l4 4 4-4M12 24l4-4 4 4'); },
    magnet(ctx) { path.call(this, ctx, 'base', 'M9 7v9c0 4 2.7 7 7 7s7-3 7-7V7'); path.call(this, ctx, 'accent', 'M9 7h5v7M18 14V7h5'); path.call(this, ctx, 'alt', 'M6 10H3M29 10h-3'); circle.call(this, ctx, 'base', 16, 23, 1.1, true); },
    bounty(ctx) { circle.call(this, ctx, 'base', 16, 16, 9, false); circle.call(this, ctx, 'ghost', 16, 16, 5, false); path.call(this, ctx, 'accent', 'M16 7v4M16 21v4M7 16h4M21 16h4'); path.call(this, ctx, 'alt', 'M16 13l1.1 2.1 2.4.3-1.7 1.7.4 2.4-2.2-1.1-2.2 1.1.4-2.4-1.7-1.7 2.4-.3L16 13Z'); },
  };

  NV.CONSUMABLE_ICON_IDS = Object.keys(DRAW);
  NV.consumableIconColors = COLORS;
  NV.drawConsumableIcon = function (ctx, itemOrId, x, y, size, opts) {
    const id = idOf(itemOrId);
    const draw = DRAW[id] || DRAW.potion;
    opts = opts || {};
    ctx.save();
    ctx.translate(x, y);
    const s = (size || 24) / 32;
    ctx.scale(s, s);
    ctx.translate(-16, -16);
    ctx.lineWidth = opts.lineWidth || 1.9;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (opts.glow) { ctx.shadowColor = (COLORS[id] || COLORS.potion).c; ctx.shadowBlur = opts.glow; }
    draw.call({ id }, ctx);
    ctx.shadowBlur = 0;
    ctx.restore();
  };

  NV.consumableIconToDataURL = function (itemOrId, size) {
    const c = document.createElement('canvas');
    c.width = c.height = size || 48;
    const ctx = c.getContext('2d');
    NV.drawConsumableIcon(ctx, itemOrId, c.width / 2, c.height / 2, Math.floor(c.width * 0.78), { glow: 2 });
    return c.toDataURL('image/png');
  };
})();
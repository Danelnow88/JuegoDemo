// ===== RENDER: iconos SVG-approved de armas convertidos a canvas =====
// Grilla lógica 32x32. Diseños minimalistas aprobados en previews/weapon-icons-preview.html.
(() => {
  'use strict';
  const NV = window.NV;

  const COLORS = {
    pistol: { c: '#e5eefb', c2: '#93c5fd' },
    rifle: { c: '#4ade80', c2: '#bbf7d0' },
    smg: { c: '#facc15', c2: '#fde68a' },
    shotgun: { c: '#f97316', c2: '#fed7aa' },
    sniper: { c: '#ef4444', c2: '#fecaca' },
    laser: { c: '#f472b6', c2: '#fbcfe8' },
    plasma: { c: '#a855f7', c2: '#c4b5fd' },
    flamethrower: { c: '#fb923c', c2: '#fca5a5' },
    bow: { c: '#22c55e', c2: '#86efac' },
    railgun: { c: '#06b6d4', c2: '#67e8f9' },
  };

  function idOf(w) { return typeof w === 'string' ? w : (w && w.id) || 'pistol'; }
  function color(id, cls) { const p = COLORS[id] || COLORS.pistol; return cls === 'accent' ? p.c : cls === 'alt' ? p.c2 : cls === 'ghost' ? p.c : '#e5eefb'; }
  function path(ctx, cls, d) { ctx.strokeStyle = color(this.id, cls); ctx.globalAlpha = cls === 'ghost' ? 0.42 : 1; const p = new Path2D(d); ctx.stroke(p); ctx.globalAlpha = 1; }
  function rect(ctx, cls, x, y, w, h, r) { ctx.strokeStyle = color(this.id, cls); ctx.globalAlpha = cls === 'ghost' ? 0.42 : 1; ctx.beginPath(); if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, r || 0); else ctx.rect(x, y, w, h); ctx.stroke(); ctx.globalAlpha = 1; }
  function circle(ctx, cls, x, y, r, fill) { ctx.strokeStyle = color(this.id, cls); ctx.fillStyle = color(this.id, cls); ctx.globalAlpha = cls === 'ghost' ? 0.42 : 1; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); fill ? ctx.fill() : ctx.stroke(); ctx.globalAlpha = 1; }

  const DRAW = {
    pistol(ctx) { path.call(this, ctx, 'base', 'M6 14h12.5'); path.call(this, ctx, 'accent', 'M18.5 14h5'); path.call(this, ctx, 'base', 'M11 15l3 8'); path.call(this, ctx, 'ghost', 'M15 15c-.4 1.8-1.4 2.8-3.1 3.3'); },
    rifle(ctx) { path.call(this, ctx, 'base', 'M4 15h24'); path.call(this, ctx, 'accent', 'M11 12h8'); path.call(this, ctx, 'base', 'M7 16l-4 4'); path.call(this, ctx, 'base', 'M15 16l2 7'); },
    smg(ctx) { path.call(this, ctx, 'base', 'M6 14h14.5'); path.call(this, ctx, 'accent', 'M21 14h5'); path.call(this, ctx, 'base', 'M11 15v9'); path.call(this, ctx, 'base', 'M17 15l4 5'); circle.call(this, ctx, 'accent', 27.8, 14, 0.9, true); },
    shotgun(ctx) { rect.call(this, ctx, 'accent', 8, 12, 18, 4, 2); path.call(this, ctx, 'alt', 'M26 14h3'); rect.call(this, ctx, 'base', 11.5, 17, 9.5, 3.5, 1.7); path.call(this, ctx, 'ghost', 'M14 17.6v2.3M16.2 17.6v2.3M18.4 17.6v2.3'); path.call(this, ctx, 'base', 'M8 15H5l-3 5'); path.call(this, ctx, 'base', 'M7 18l5 6'); },
    sniper(ctx) { path.call(this, ctx, 'base', 'M3 16h26'); rect.call(this, ctx, 'accent', 10, 10.2, 10, 3.4, 1.7); path.call(this, ctx, 'base', 'M7 16l-4 5'); path.call(this, ctx, 'ghost', 'M21 17l-3 7M24 17l3 7'); },
    laser(ctx) { path.call(this, ctx, 'base', 'M6 16h10'); path.call(this, ctx, 'accent', 'M16 16h13'); path.call(this, ctx, 'ghost', 'M23.5 12h5.5M23.5 20h5.5'); path.call(this, ctx, 'base', 'M9 16l2 7'); },
    plasma(ctx) { path.call(this, ctx, 'base', 'M5 17h9.5'); path.call(this, ctx, 'base', 'M8 17l3 6'); circle.call(this, ctx, 'accent', 23, 16, 6.2, false); circle.call(this, ctx, 'accent', 23, 16, 2, true); circle.call(this, ctx, 'ghost', 23, 16, 8.2, false); },
    flamethrower(ctx) { rect.call(this, ctx, 'base', 5, 12.8, 10.5, 7.4, 3.7); path.call(this, ctx, 'base', 'M9 20l3 5'); path.call(this, ctx, 'accent', 'M15.5 16.5h6.5'); path.call(this, ctx, 'alt', 'M22.5 16.5c3-2.4 2.5-5.3.5-7.5 5.7 2.2 6.9 7.8 1.6 12.5-2.1-1.2-2.7-3.1-2.1-5Z'); },
    bow(ctx) { path.call(this, ctx, 'base', 'M10.5 5c7.4 5 7.4 17 0 22'); path.call(this, ctx, 'ghost', 'M10.5 5v22'); path.call(this, ctx, 'accent', 'M5 16h22'); path.call(this, ctx, 'accent', 'M27 16l-5-4M27 16l-5 4'); },
    railgun(ctx) { rect.call(this, ctx, 'base', 5, 11, 18, 10, 5); circle.call(this, ctx, 'accent', 24, 16, 5, false); path.call(this, ctx, 'accent', 'M24 11v10'); path.call(this, ctx, 'base', 'M8 21l-3 5h10l-3-5'); path.call(this, ctx, 'ghost', 'M5 16H2'); },
  };

  NV.WEAPON_ICON_IDS = Object.keys(DRAW);
  NV.weaponIconColors = COLORS;
  NV.drawWeaponIcon = function (ctx, weaponOrId, x, y, size, opts) {
    const id = idOf(weaponOrId);
    const draw = DRAW[id] || DRAW.pistol;
    opts = opts || {};
    ctx.save();
    ctx.translate(x, y);
    const s = (size || 24) / 32;
    ctx.scale(s, s);
    ctx.translate(-16, -16);
    ctx.lineWidth = opts.lineWidth || 1.9;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (opts.glow) { ctx.shadowColor = (COLORS[id] || COLORS.pistol).c; ctx.shadowBlur = opts.glow; }
    draw.call({ id }, ctx);
    ctx.shadowBlur = 0;
    ctx.restore();
  };

  NV.weaponIconToDataURL = function (weaponOrId, size) {
    const c = document.createElement('canvas');
    c.width = c.height = size || 48;
    const ctx = c.getContext('2d');
    NV.drawWeaponIcon(ctx, weaponOrId, c.width / 2, c.height / 2, Math.floor(c.width * 0.78), { glow: 2 });
    return c.toDataURL('image/png');
  };
})();
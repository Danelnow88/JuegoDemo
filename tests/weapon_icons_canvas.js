// Tests Bloque 1: renderer canvas reutilizable de iconos de armas aprobados.
const fs = require('fs'), vm = require('vm');
let pass = 0, fail = 0;
function t(d, fn) { try { fn(); pass++; console.log('  ok  ' + d); } catch (e) { fail++; console.log('  FAIL ' + d + ' -> ' + e.message); } }

class Path2DStub { constructor(d) { this.d = d; } }
function loadNV() {
  const sbx = { window: { NV: {} }, console, Math, Path2D: Path2DStub, document: { createElement(){ return mkCanvas(); } } };
  vm.createContext(sbx);
  vm.runInContext(fs.readFileSync('js/render/weaponIcons.js', 'utf8'), sbx, { filename: 'js/render/weaponIcons.js' });
  return sbx.window.NV;
}
function mkCanvas() { return { width: 0, height: 0, getContext(){ return mkCtx(); }, toDataURL(){ return 'data:image/png;base64,test'; } }; }
function mkCtx() {
  return {
    ops: [], _ga: 1,
    save(){ this.ops.push('save'); }, restore(){ this.ops.push('restore'); }, translate(x,y){ this.ops.push(['translate', x, y]); }, scale(x,y){ this.ops.push(['scale', x, y]); },
    beginPath(){ this.ops.push('beginPath'); }, rect(x,y,w,h){ this.ops.push(['rect', x,y,w,h]); }, roundRect(x,y,w,h,r){ this.ops.push(['roundRect', x,y,w,h,r]); },
    arc(x,y,r){ this.ops.push(['arc', x,y,r]); }, stroke(p){ this.ops.push(['stroke', p && p.d || 'shape', this.strokeStyle, this._ga]); }, fill(){ this.ops.push(['fill', this.fillStyle, this._ga]); },
    set globalAlpha(v){ this._ga = v; }, get globalAlpha(){ return this._ga; },
    set strokeStyle(v){ this._ss = v; }, get strokeStyle(){ return this._ss; }, set fillStyle(v){ this._fs = v; }, get fillStyle(){ return this._fs; },
    set lineWidth(v){ this._lw = v; }, get lineWidth(){ return this._lw; }, set lineCap(v){ this._lc = v; }, set lineJoin(v){ this._lj = v; }, set shadowColor(v){ this._shc = v; }, set shadowBlur(v){ this._shb = v; }, get shadowBlur(){ return this._shb || 0; }
  };
}

const ids = ['pistol','rifle','smg','shotgun','sniper','laser','plasma','flamethrower','bow','railgun'];

t('expone drawWeaponIcon y los 10 IDs aprobados', () => {
  const NV = loadNV();
  if (typeof NV.drawWeaponIcon !== 'function') throw new Error('drawWeaponIcon ausente');
  const missing = ids.filter(id => !NV.WEAPON_ICON_IDS.includes(id));
  if (missing.length) throw new Error('faltan IDs: ' + missing.join(','));
});

t('cada arma dibuja primitivas canvas con save/restore y sin texto/emoji', () => {
  const NV = loadNV();
  ids.forEach(id => {
    const ctx = mkCtx();
    NV.drawWeaponIcon(ctx, id, 12, 13, 22);
    if (!ctx.ops.includes('save') || !ctx.ops.includes('restore')) throw new Error(id + ' sin save/restore');
    const strokes = ctx.ops.filter(o => Array.isArray(o) && (o[0] === 'stroke' || o[0] === 'fill'));
    if (strokes.length < 3 || strokes.length > 8) throw new Error(id + ' cantidad visual inesperada: ' + strokes.length);
    if (ctx.ops.some(o => Array.isArray(o) && String(o[0]).includes('Text'))) throw new Error(id + ' usa texto');
  });
});

t('colores identitarios coinciden con el preview aprobado', () => {
  const NV = loadNV();
  const expected = { shotgun:'#f97316', railgun:'#06b6d4', plasma:'#a855f7', flamethrower:'#fb923c', sniper:'#ef4444' };
  for (const [id, c] of Object.entries(expected)) if (NV.weaponIconColors[id].c !== c) throw new Error(id + ' color=' + NV.weaponIconColors[id].c);
});

t('index carga weaponIcons antes del HUD/game', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  const wi = html.indexOf('js/render/weaponIcons.js');
  const hud = html.indexOf('js/render/hud.js');
  const game = html.indexOf('js/game.js');
  if (wi < 0) throw new Error('script ausente');
  if (!(wi < hud && wi < game)) throw new Error('orden incorrecto');
});

console.log('RESULT weapon_icons_canvas: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
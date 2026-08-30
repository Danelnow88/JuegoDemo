// Tests Bloque 1: helper canvas de iconos SVG-approved de consumibles.
const fs = require('fs'), vm = require('vm');
let pass = 0, fail = 0;
function t(d, fn) { try { fn(); pass++; console.log('  ok  ' + d); } catch (e) { fail++; console.log('  FAIL ' + d + ' -> ' + e.message); } }

function mkCtx() {
  return {
    calls: [],
    save(){ this.calls.push('save'); }, restore(){ this.calls.push('restore'); }, translate(){}, scale(){},
    beginPath(){ this.calls.push('beginPath'); }, moveTo(){}, lineTo(){}, bezierCurveTo(){}, closePath(){},
    arc(){ this.calls.push('arc'); }, stroke(){ this.calls.push('stroke'); }, fill(){ this.calls.push('fill'); },
    strokeStyle: '', fillStyle: '', globalAlpha: 1, shadowColor: '', shadowBlur: 0, lineWidth: 1, lineCap: '', lineJoin: '',
  };
}
function mkCanvas() { return { width: 0, height: 0, getContext(){ return mkCtx(); }, toDataURL(){ return 'data:image/png;base64,test'; } }; }

const sbx = { window: { NV: {} }, document: { createElement(){ return mkCanvas(); } }, console, Math };
vm.runInNewContext(fs.readFileSync('js/render/consumableIcons.js', 'utf8'), sbx, { filename: 'js/render/consumableIcons.js' });
const NV = sbx.window.NV;

t('expone drawConsumableIcon + 7 ids aprobados', () => {
  const ids = ['potion','overdrive','shield','bomb','freeze','magnet','bounty'];
  if (typeof NV.drawConsumableIcon !== 'function') throw new Error('falta drawConsumableIcon');
  if (NV.CONSUMABLE_ICON_IDS.length !== 7) throw new Error('cantidad ' + NV.CONSUMABLE_ICON_IDS.length);
  for (const id of ids) if (!NV.CONSUMABLE_ICON_IDS.includes(id)) throw new Error('falta ' + id);
});

t('cada icono renderiza strokes/fills en canvas sin Path2D', () => {
  for (const id of NV.CONSUMABLE_ICON_IDS) {
    const ctx = mkCtx();
    NV.drawConsumableIcon(ctx, id, 16, 16, 24, { glow: 2 });
    if (!ctx.calls.includes('save') || !ctx.calls.includes('restore')) throw new Error(id + ' sin save/restore');
    if (!ctx.calls.some(c => c === 'stroke' || c === 'fill')) throw new Error(id + ' no dibuja');
  }
});

t('consumableIconToDataURL usa canvas y devuelve data url', () => {
  const url = NV.consumableIconToDataURL('potion', 48);
  if (!url.startsWith('data:image/png;base64,')) throw new Error(url);
});

console.log('RESULT consumable_icons_canvas: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
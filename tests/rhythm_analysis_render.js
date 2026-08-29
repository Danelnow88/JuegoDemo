// Tests: análisis de ritmo + render decorativo + integración en loop/render/UI.
const fs = require('fs'), vm = require('vm');
let pass = 0, fail = 0;
function t(desc, fn) { try { fn(); pass++; console.log('  ok  ' + desc); } catch (e) { fail++; console.log('  FAIL ' + desc + ' -> ' + e.message); } }

function loadNV() {
  const sbx = {
    window: { NV: {} },
    navigator: { mediaDevices: {} },
    localStorage: { getItem(){ return null; }, setItem(){}, removeItem(){} },
    console, Uint8Array, Promise, Math,
  };
  vm.createContext(sbx);
  vm.runInContext(fs.readFileSync('js/engine/rhythm.js', 'utf8'), sbx, { filename: 'js/engine/rhythm.js' });
  return sbx.window.NV;
}
function mkCtx() {
  return {
    ops: [], _alpha: 1,
    save(){ this.ops.push('save'); }, restore(){ this.ops.push('restore'); },
    fillRect(x,y,w,h){ this.ops.push(['fillRect', x,y,w,h, this._alpha]); },
    strokeRect(x,y,w,h){ this.ops.push(['strokeRect', x,y,w,h, this._alpha]); },
    createRadialGradient(){ this.ops.push('gradient'); return { stops: [], addColorStop(p, c){ this.stops.push([p, c]); } }; },
    set fillStyle(v){ this._fillStyle = v; }, get fillStyle(){ return this._fillStyle; },
    set strokeStyle(v){ this._strokeStyle = v; }, get strokeStyle(){ return this._strokeStyle; },
    set lineWidth(v){ this._lineWidth = v; }, get lineWidth(){ return this._lineWidth; },
    set globalAlpha(v){ this._alpha = v; }, get globalAlpha(){ return this._alpha; },
    set globalCompositeOperation(v){ this._gco = v; }, get globalCompositeOperation(){ return this._gco; },
  };
}

t('rhythmAnalyze publica bandas normalizadas y beat ante graves fuertes', () => {
  const NV = loadNV();
  const st = NV.rhythm;
  const quiet = new Uint8Array(128); quiet.fill(5);
  for (let i = 0; i < 10; i++) NV.rhythmAnalyze(st, quiet, i * 0.1);
  const data = new Uint8Array(128); data.fill(12);
  for (let i = 1; i < 10; i++) data[i] = 240;
  NV.rhythmAnalyze(st, data, 2);
  if (!(st.bass > st.mids && st.bass > 0.5)) throw new Error('graves no detectados');
  if (!(st.beat > 0)) throw new Error('beat no detectado');
  if (st.energy < 0 || st.energy > 1) throw new Error('energy fuera de rango');
});

t('rhythmTick lee AnalyserNode y actualiza energy', () => {
  const NV = loadNV();
  NV.rhythm.state = 'listening';
  NV.rhythm.data = new Uint8Array(128);
  NV.rhythm.analyser = { getByteFrequencyData(arr) { arr.fill(180); } };
  NV.rhythmTick(1);
  if (!(NV.rhythm.energy > 0.4)) throw new Error('tick no analizó');
});

t('drawRhythmLayer no dibuja si está apagado o sin listening', () => {
  const NV = loadNV();
  const ctx = mkCtx();
  NV.rhythm.enabled = true;
  NV.rhythm.state = 'off';
  NV.drawRhythmLayer(ctx, 900, 520, 0);
  if (ctx.ops.length) throw new Error('dibujó estando off');
});

t('drawRhythmLayer dibuja solo fondo sutil con alfa acotado', () => {
  const NV = loadNV();
  const ctx = mkCtx();
  Object.assign(NV.rhythm, { enabled: true, state: 'listening', energy: 1, beat: 1, bass: 1, highs: 1, maxAlpha: 0.18, intensityCap: 0.35 });
  NV.drawRhythmLayer(ctx, 900, 520, 10);
  if (!ctx.ops.includes('gradient')) throw new Error('sin gradiente');
  if (!ctx.ops.some((op) => Array.isArray(op) && op[0] === 'fillRect')) throw new Error('sin fill de fondo');
  const stroke = ctx.ops.find((op) => Array.isArray(op) && op[0] === 'strokeRect');
  if (!stroke) throw new Error('sin pulso de borde');
  if (stroke[5] > 0.121) throw new Error('alfa invasivo: ' + stroke[5]);
});

t('game.js integra drawRhythmLayer después del starfield y antes de gameplay/HUD', () => {
  const g = fs.readFileSync('js/game.js', 'utf8');
  const star = g.indexOf('NV.drawStarfield(ctx, W, H, frame, player.x, player.y)');
  const rhythm = g.indexOf('NV.drawRhythmLayer(ctx, W, H, frame)');
  const grid = g.indexOf('const gridAlpha', rhythm);
  const special = g.indexOf('if (specialVFX)', rhythm);
  if (!(star >= 0 && rhythm > star)) throw new Error('no va después del starfield');
  if (!(grid > rhythm && special > rhythm)) throw new Error('no queda antes de capas de gameplay');
});

t('game.js llama rhythmTick en el loop y la UI persiste preferencia', () => {
  const g = fs.readFileSync('js/game.js', 'utf8');
  if (!g.includes('if (NV.rhythmTick) NV.rhythmTick(now / 1000)')) throw new Error('tick ausente');
  if (!g.includes('NV.rhythmToggleEnabled(true); NV.externalAudio.startDisplayCapture()')) throw new Error('botón pestaña no activa preferencia');
  if (!g.includes('NV.rhythmToggleEnabled(false); NV.externalAudio.stop()')) throw new Error('botón stop no desactiva preferencia');
});

t('index/dom/css exponen controles de música externa', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  const dom = fs.readFileSync('js/ui/dom.js', 'utf8');
  const css = fs.readFileSync('css/styles.css', 'utf8');
  for (const id of ['rhythmTabBtn', 'rhythmMicBtn', 'rhythmStopBtn', 'rhythmStatus']) {
    if (!html.includes('id="' + id + '"')) throw new Error('html falta ' + id);
    if (!dom.includes(id + ': document.getElementById')) throw new Error('dom falta ' + id);
  }
  if (!html.includes('js/engine/rhythm.js')) throw new Error('script rhythm ausente');
  if (!css.includes('.rhythm-panel')) throw new Error('css rhythm ausente');
});

console.log('RESULT rhythm_analysis_render: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
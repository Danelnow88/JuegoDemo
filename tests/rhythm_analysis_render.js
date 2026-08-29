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
    ops: [], gradients: [], _alpha: 1,
    save(){ this.ops.push('save'); }, restore(){ this.ops.push('restore'); },
    fillRect(x,y,w,h){ this.ops.push(['fillRect', x,y,w,h, this._alpha]); },
    strokeRect(x,y,w,h){ this.ops.push(['strokeRect', x,y,w,h, this._alpha]); },
    createRadialGradient(x0,y0,r0,x1,y1,r1){ const g = { args: [x0,y0,r0,x1,y1,r1], stops: [], addColorStop(p, c){ this.stops.push([p, c]); } }; this.gradients.push(g); this.ops.push('gradient'); return g; },
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

t('drawRhythmLayer cambia paleta por banda dominante y tempo mueve el centro', () => {
  const NV = loadNV();
  const low = mkCtx(), high = mkCtx(), fast = mkCtx();
  Object.assign(NV.rhythm, { enabled: true, state: 'listening', energy: 0.45, beat: 0.35, bass: 0.8, mids: 0.1, highs: 0.05, kick: 0.7, snare: 0, hats: 0, onset: 0.5, tempoBpm: 80 });
  NV.drawRhythmLayer(low, 900, 520, 100);
  Object.assign(NV.rhythm, { enabled: true, state: 'listening', energy: 0.45, beat: 0.2, bass: 0.05, mids: 0.1, highs: 0.85, kick: 0, snare: 0.1, hats: 0.8, onset: 0.4, tempoBpm: 80 });
  NV.drawRhythmLayer(high, 900, 520, 100);
  Object.assign(NV.rhythm, { enabled: true, state: 'listening', energy: 0.45, beat: 0.2, bass: 0.05, mids: 0.1, highs: 0.85, kick: 0, snare: 0.1, hats: 0.8, onset: 0.4, tempoBpm: 180 });
  NV.drawRhythmLayer(fast, 900, 520, 100);
  const lowColor = low.gradients[0].stops[0][1], highColor = high.gradients[0].stops[0][1];
  if (lowColor === highColor) throw new Error('paleta no cambia por dominancia');
  if (!lowColor.startsWith('hsla(') || !highColor.startsWith('hsla(')) throw new Error('paleta no usa hue dinámico');
  const hueOf = (c) => Number((c.match(/hsla\((\d+)/) || [])[1]);
  const lowHue = hueOf(lowColor), highHue = hueOf(highColor);
  if (!(lowHue >= 0 && lowHue <= 360 && highHue >= 0 && highHue <= 360)) throw new Error('hue fuera de rango');
  if (Math.abs(lowHue - highHue) < 35) throw new Error('hues demasiado parecidos: ' + lowHue + '/' + highHue);
  if (JSON.stringify(high.gradients[0].args.slice(0, 2)) === JSON.stringify(fast.gradients[0].args.slice(0, 2))) throw new Error('tempo no mueve el centro');
});

t('rhythmTick lee AnalyserNode y actualiza energy', () => {
  const NV = loadNV();
  NV.rhythm.state = 'listening';
  NV.rhythm.data = new Uint8Array(128);
  NV.rhythm.analyser = { getByteFrequencyData(arr) { arr.fill(180); } };
  NV.rhythmTick(1);
  if (!(NV.rhythm.energy > 0.4)) throw new Error('tick no analizó');
});

t('hue usa espectro completo: spread >= 150 entre perfiles de banda dominante', () => {
  const NV = loadNV();
  const profiles = {
    bass:  { bass: 0.9, mids: 0.15, highs: 0.08, kick: 0.7, snare: 0, hats: 0 },
    mids:  { bass: 0.2, mids: 0.85, highs: 0.18, kick: 0, snare: 0.6, hats: 0.1 },
    highs: { bass: 0.12, mids: 0.19, highs: 0.9, kick: 0, snare: 0.1, hats: 0.7 },
  };
  const hues = {};
  for (const [name, p] of Object.entries(profiles)) {
    const ctx = mkCtx();
    Object.assign(NV.rhythm, { enabled: true, state: 'listening', energy: 0.45, beat: 0.2, onset: 0, tempoBpm: 96, maxAlpha: 0.32, intensityCap: 0.55, forceHue: null }, p);
    NV.drawRhythmLayer(ctx, 900, 520, 0); // frame 0: sin deriva temporal, aísla el efecto de dominancia
    hues[name] = Number((ctx.gradients[0].stops[0][1].match(/hsla\((\d+)/) || [])[1]);
  }
  const list = Object.values(hues);
  const spread = Math.max(...list) - Math.min(...list);
  if (spread < 150) throw new Error('hue comprimido: ' + JSON.stringify(hues) + ' spread=' + spread);
  if (!(hues.mids < 120)) throw new Error('medios deberian caer en amarillo/naranja: ' + hues.mids);
  if (!(hues.highs > 250)) throw new Error('agudos deberian caer en violeta/magenta: ' + hues.highs);
  if (!(hues.bass > 140 && hues.bass < 260)) throw new Error('graves deberian caer en cian/azul: ' + hues.bass);
});

t('forceHue fija el color exactamente (verificacion de colores puros)', () => {
  const NV = loadNV();
  for (const fh of [0, 60, 120, 240, 300]) {
    const ctx = mkCtx();
    Object.assign(NV.rhythm, { enabled: true, state: 'listening', energy: 0.45, beat: 0.2, bass: 0.8, mids: 0.1, highs: 0.05, onset: 0, tempoBpm: 96, forceHue: fh });
    NV.drawRhythmLayer(ctx, 900, 520, 777);
    const hue = Number((ctx.gradients[0].stops[0][1].match(/hsla\((\d+)/) || [])[1]);
    if (hue !== fh) throw new Error('forceHue=' + fh + ' no respeto el hue: ' + hue);
  }
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
  Object.assign(NV.rhythm, { enabled: true, state: 'listening', energy: 1, beat: 1, bass: 1, highs: 1, maxAlpha: 0.32, intensityCap: 0.55 });
  NV.drawRhythmLayer(ctx, 900, 520, 10);
  if (!ctx.ops.includes('gradient')) throw new Error('sin gradiente');
  if (!ctx.ops.some((op) => Array.isArray(op) && op[0] === 'fillRect')) throw new Error('sin fill de fondo');
  const stroke = ctx.ops.find((op) => Array.isArray(op) && op[0] === 'strokeRect');
  if (!stroke) throw new Error('sin pulso de borde');
  if (stroke[5] > 0.221) throw new Error('alfa invasivo: ' + stroke[5]);
  if (ctx._lineWidth > 6) throw new Error('borde demasiado grueso: ' + ctx._lineWidth);
});

t('game.js usa fondo galaxia mas oscuro para contraste sin aclarar combate', () => {
  const g = fs.readFileSync('js/game.js', 'utf8');
  if (!g.includes("ctx.fillStyle = '#01030d'")) throw new Error('fondo galaxia no aplicado');
  const bg = g.indexOf("ctx.fillStyle = '#01030d'");
  const star = g.indexOf('NV.drawStarfield(ctx, W, H, frame, player.x, player.y, NV.rhythm)', bg);
  if (!(star > bg)) throw new Error('fondo no precede starfield');
});

t('game.js integra drawRhythmLayer después del starfield y antes de gameplay/HUD', () => {
  const g = fs.readFileSync('js/game.js', 'utf8');
  const star = g.indexOf('NV.drawStarfield(ctx, W, H, frame, player.x, player.y, NV.rhythm)');
  const rhythm = g.indexOf('NV.drawRhythmLayer(ctx, W, H, frame)');
  const grid = g.indexOf('const gridAlpha', rhythm);
  const special = g.indexOf('if (specialVFX)', rhythm);
  if (!(star >= 0 && rhythm > star)) throw new Error('no va después del starfield');
  if (!(grid > rhythm && special > rhythm)) throw new Error('no queda antes de capas de gameplay');
});

t('game.js llama rhythmTick en el loop y la UI persiste preferencia', () => {
  const g = fs.readFileSync('js/game.js', 'utf8');
  if (!g.includes('const rhythmNow = now / 1000') || !g.includes('NV.rhythmTick(rhythmNow)')) throw new Error('tick ausente');
  if (!g.includes('NV.rhythmShakeBoost(NV.rhythm, rhythmNow)')) throw new Error('shake rítmico ausente');
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
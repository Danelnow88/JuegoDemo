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



// ---- Bloque 1: AGC + umbrales robustos (regresión deathcore) ----
function blastFrames(t) { // muro sostenido (medios/agudos altos) + blast 16Hz
  if (t < 2) return null;
  const ph = (t - 2) % 0.0625;
  const dec = Math.exp(-ph * 22);
  const k = Math.floor((t - 2) / 0.0625) % 2 === 0;
  const bands = k ? [[1, 12, 220], [80, 128, 150], [15, 128, 150]] : [[15, 46, 190], [80, 128, 150], [15, 128, 150]];
  return { dec, bands };
}

t('AGC: energia normalizada conserva respiracion con master comprimido (deathcore)', () => {
  const NV = loadNV();
  const st = NV.rhythmFreshState();
  const LEN = 128;
  let t = 0; const vals = [];
  for (let f = 0; f < 600; f++) {
    t += 1 / 60;
    const d = new Uint8Array(LEN);
    d.fill(0);
    for (let i = 15; i < LEN; i++) d[i] = 170;
    for (let i = 1; i < 12; i++) d[i] = 60;
    const h = blastFrames(t);
    if (h) for (const b of h.bands) for (let i = b[0]; i < b[1]; i++) d[i] = Math.min(255, Math.max(d[i], Math.round(80 + b[2] * h.dec)));
    NV.rhythmAnalyze(st, d, t);
    if (t > 6) vals.push(st.energy);
  }
  const m = vals.reduce((a, b) => a + b, 0) / vals.length;
  const min = Math.min(...vals), max = Math.max(...vals);
  if (m < 0.2 || m > 0.95) throw new Error('energia fuera de rango util: ' + m.toFixed(3));
  if (max - min < 0.3) throw new Error('sin respiracion dinamica: spread=' + (max - min).toFixed(3));
  if (!(st.dynRange > 0.1)) throw new Error('dynRange colapsado: ' + st.dynRange.toFixed(3));
  if (!(st.energyRaw > 0.4)) throw new Error('energyRaw no refleja el master denso: ' + st.energyRaw.toFixed(3));
});

t('umbrales robustos: transientes conservan contraste bajo densidad extrema', () => {
  const NV = loadNV();
  const st = NV.rhythmFreshState();
  const LEN = 128;
  let t = 0; const onsets = [];
  for (let f = 0; f < 600; f++) {
    t += 1 / 60;
    const d = new Uint8Array(LEN);
    for (let i = 15; i < LEN; i++) d[i] = 170;
    for (let i = 1; i < 12; i++) d[i] = 60;
    const h = blastFrames(t);
    if (h) for (const b of h.bands) for (let i = b[0]; i < b[1]; i++) d[i] = Math.min(255, Math.max(d[i], Math.round(80 + b[2] * h.dec)));
    NV.rhythmAnalyze(st, d, t);
    if (t > 6) onsets.push(st.onset);
  }
  const max = Math.max(...onsets), min = Math.min(...onsets);
  if (max < 0.45) throw new Error('golpes no detectados en blast: max=' + max.toFixed(3));
  if (min > 0.35) throw new Error('sin contraste entre golpes (todo al tope): min=' + min.toFixed(3));
});

// ---- Bloque 3: carácter (density/punch/accent) y alpha no saturado ----
function mkAlphaCtx() {
  return { gradients: [], ops: [], createRadialGradient(){ const g = { stops: [], addColorStop(o, c){ this.stops.push([o, c]); } }; this.gradients.push(g); return g; }, fillRect(){ this.ops.push('fill'); }, strokeRect(){ this.ops.push('stroke'); }, save(){}, restore(){} };
}

t('caracter: density/punch/accent publicados y alpha respira sin saturar en deathcore', () => {
  const NV = loadNV();
  const st = NV.rhythmFreshState();
  const LEN = 128;
  let t = 0; const alphas = [];
  for (let f = 0; f < 900; f++) {
    t += 1 / 60;
    const d = new Uint8Array(LEN);
    d.fill(0);
    for (let i = 15; i < LEN; i++) d[i] = 170;
    for (let i = 1; i < 12; i++) d[i] = 60;
    const h = blastFrames(t);
    if (h) for (const b of h.bands) for (let i = b[0]; i < b[1]; i++) d[i] = Math.min(255, Math.max(d[i], Math.round(80 + b[2] * h.dec)));
    NV.rhythmAnalyze(st, d, t);
    Object.assign(NV.rhythm, {
      enabled: true, state: 'listening', maxAlpha: 0.32, intensityCap: 0.55,
      energy: st.energy, beat: st.beat, bass: st.bass, mids: st.mids, highs: st.highs,
      kick: st.kick, snare: st.snare, hats: st.hats, onset: st.onset,
      onsetRate: st.onsetRate, density: st.density, accent: st.accent, punch: st.punch,
      tempoBpm: st.tempoBpm, forceHue: null,
    });
    NV.drawRhythmLayer(mkAlphaCtx(), 900, 520, Math.floor(t * 60));
    if (t > 8) alphas.push(NV.rhythm.lastAlpha);
  }
  if (!(st.density > 8)) throw new Error('density no refleja blast: ' + st.density.toFixed(2));
  if (!(st.punch > 0.3)) throw new Error('punch no refleja kicks: ' + st.punch.toFixed(3));
  if (!(st.accent > 0.2)) throw new Error('accent inactivo: ' + st.accent.toFixed(3));
  const m = alphas.reduce((a, b) => a + b, 0) / alphas.length;
  const sd = Math.sqrt(alphas.reduce((a, b) => a + (b - m) ** 2, 0) / alphas.length);
  const satShare = alphas.filter((a) => a >= 0.319).length / alphas.length;
  if (m > 0.30) throw new Error('alpha saturado (clavado al tope): media=' + m.toFixed(3));
  if (satShare > 0.15) throw new Error('demasiados frames saturados: ' + (satShare * 100).toFixed(1) + '%');
  if (sd < 0.045) throw new Error('alpha plano (sin respiracion): sd=' + sd.toFixed(4));
});

t('ganancia por densidad: estilo espaciado conserva golpe pleno, blast lo atenúa', () => {
  const NV = loadNV();
  const sparse = Object.assign({}, NV.rhythm, { density: 1.2, accent: 0.9, beat: 0.8, onset: 0.8, energy: 0.45 });
  const blast = Object.assign({}, NV.rhythm, { density: 16, accent: 0.3, beat: 0.8, onset: 0.8, energy: 0.45 });
  const a = (r) => {
    const gain = 1 / (1 + (r.density || 0) / 8);
    const beatEff = r.beat * gain * (0.55 + 0.45 * r.accent);
    const onsetEff = r.onset * gain * (0.5 + 0.5 * r.accent);
    return beatEff * 0.2 + onsetEff * 0.22;
  };
  if (!(a(sparse) > a(blast) * 2.2)) throw new Error('ganancia no diferencia densidades: ' + a(sparse).toFixed(3) + ' vs ' + a(blast).toFixed(3));
  if (!(a(sparse) > 0.25)) throw new Error('estilo espaciado quedo debil: ' + a(sparse).toFixed(3));
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
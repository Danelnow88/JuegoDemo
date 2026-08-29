// Diagnóstico de hue: simula perfiles de audio sintéticos y registra los valores
// reales de hue/bandas producidos por el pipeline (rhythmAnalyze -> drawRhythmLayer).
const fs = require('fs'), vm = require('vm');

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
    gradients: [], _alpha: 1,
    save(){}, restore(){}, fillRect(){}, strokeRect(){},
    createRadialGradient(x0,y0,r0,x1,y1,r1){ const g = { stops: [], addColorStop(p, c){ this.stops.push([p, c]); } }; this.gradients.push(g); return g; },
    set fillStyle(v){}, get fillStyle(){ return ''; },
    set strokeStyle(v){}, set lineWidth(v){},
    set globalAlpha(v){ this._alpha = v; }, get globalAlpha(){ return this._alpha; },
    set globalCompositeOperation(v){},
  };
}
const hueOf = (c) => Number((c.match(/hsla\((\d+)/) || [])[1]);

// Perfiles FFT sintéticos (128 bins, como analyser.fftSize=256).
function mkData(kind) {
  const d = new Uint8Array(128);
  const set = (lo, hi, v) => { for (let i = lo; i < hi; i++) d[i] = v; };
  if (kind === 'bass') { set(1, 10, 235); set(10, 50, 40); set(70, 128, 20); }
  else if (kind === 'mids') { set(1, 10, 50); set(10, 50, 225); set(70, 128, 45); }
  else if (kind === 'highs') { set(1, 10, 30); set(10, 50, 50); set(70, 128, 230); }
  else { set(1, 10, 150); set(10, 50, 150); set(70, 128, 150); } // balanceado
  return d;
}

const NV = loadNV();
const st = NV.rhythm;
console.log('--- DIAGNOSTICO HUE (antes/despues segun version) ---');
for (const kind of ['bass', 'mids', 'highs', 'balanceado']) {
  // estado fresco por perfil
  for (const k of Object.keys(st)) delete st[k];
  Object.assign(st, {
    enabled: true, state: 'listening',
    _bassHist: new Array(44).fill(0), _prevBands: { bass:0, mids:0, highs:0, kick:0, snare:0, hats:0 }, _onsetTimes: [],
    beat: 0, bass: 0, mids: 0, highs: 0, energy: 0, peak: 0,
    onset: 0, kick: 0, snare: 0, hats: 0, spectralFlux: 0, tempoBpm: 0,
    lastBeatAt: 0, lastOnsetAt: 0, lastShakeAt: -99, _bassMean: 0, _fluxMean: 0, _kickFluxMean: 0, _snareFluxMean: 0,
  });
  const data = mkData(kind);
  let t = 0;
  // Calentamiento + sustento sin transientes (aisla el hue de banda dominante).
  for (let i = 0; i < 60; i++) { NV.rhythmAnalyze(st, data, t); t += 0.05; }
  const ctx = mkCtx();
  NV.drawRhythmLayer(ctx, 900, 520, 100);
  const hue = ctx.gradients.length ? hueOf(ctx.gradients[0].stops[0][1]) : -1;
  console.log(
    'perfil=' + kind.padEnd(10) +
    ' bass=' + st.bass.toFixed(3) +
    ' mids=' + st.mids.toFixed(3) +
    ' highs=' + st.highs.toFixed(3) +
    ' onset=' + st.onset.toFixed(3) +
    ' tempo=' + (st.tempoBpm || 0).toFixed(0) +
    ' => hue=' + hue
  );
}

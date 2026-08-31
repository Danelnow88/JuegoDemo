// Test: por qué el pulso no dispara con audio REAL de getDisplayMedia.
// Dos causas estructurales, ambas en la config del AnalyserNode:
//  1) fftSize=256 => bin de 187.5Hz => el fundamental del bombo (50-100Hz)
//     caía ENTERO en el bin 0, EXCLUIDO de todas las bandas (arrancaban en 1).
//  2) smoothingTimeConstant default 0.8 difumina transientes entre frames.
// Los tests sintéticos inyectaban el kick repartido en bins agudos, algo que
// no ocurre con espectros reales, y por eso "funcionaban" igual que el juego
// no funcionaba. Este test modela el espectro con el fundamental donde le
// corresponde según la geometría de cada config, aplica el filtro IIR del
// analyser y pasa los datos por rhythmAnalyze REAL.
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

let seed = 42;
function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }

// Fondo musical realista: energía baja siempre presente, decae con la frecuencia.
function bg(bin) { return 140 * Math.exp(-bin / 45) + 35 + rnd() * 8 - 4; }

// Pista: 12 kicks a 120 BPM (1 cada 0.5s, 4 frames de ataque), 60fps, 6s.
// oldConfig: 128 bins (fft256 => 187.5Hz/bin): el fundamental (50-100Hz) cae en
//   el bin 0 EXCLUIDO; solo pasan armónicos débiles a bins 1-2.
// newConfig: 256 bins (fft512 => 93.75Hz/bin): fundamental en bins 0-1, INCLUIDO.
function buildFrames(oldConfig) {
  const N = oldConfig ? 128 : 256;
  const frames = [];
  const kickFrames = new Set();
  for (let f = 0; f < 360; f++) if (f % 30 < 4) kickFrames.add(f);
  for (let f = 0; f < 360; f++) {
    const d = new Uint8Array(N);
    for (let i = 0; i < N; i++) d[i] = Math.max(0, Math.min(255, Math.round(bg(i))));
    if (kickFrames.has(f)) {
      if (oldConfig) {
        // fundamental (bin 0) invisible para las bandas; armónicos tenues
        d[0] = Math.min(255, d[0] + 110);
        d[1] = Math.min(255, d[1] + 22);
        d[2] = Math.min(255, d[2] + 12);
      } else {
        d[0] = Math.min(255, d[0] + 110);
        d[1] = Math.min(255, d[1] + 95);
        d[2] = Math.min(255, d[2] + 40);
        d[3] = Math.min(255, d[3] + 25);
      }
    }
    frames.push(d);
  }
  return frames;
}
// Modelo del IIR del AnalyserNode (lo que hace el hardware con audio real).
function smoothed(frames, k) {
  const out = [];
  let prev = new Float32Array(frames[0].length);
  for (const f of frames) {
    const cur = new Float32Array(f.length);
    for (let i = 0; i < f.length; i++) cur[i] = k * prev[i] + (1 - k) * f[i];
    out.push(Uint8Array.from(cur, Math.round));
    prev = cur;
  }
  return out;
}

function runConfig(label, oldConfig, smoothing) {
  const NV = loadNV();
  const r = NV.rhythmFreshState();
  r.state = 'listening'; r.enabled = true;
  const data = smoothed(buildFrames(oldConfig), smoothing);
  let maxBeat = 0, rising = 0, prevB = 0, maxBass = 0;
  for (let f = 0; f < data.length; f++) {
    NV.rhythmAnalyze(r, data[f], f / 60);
    const b = r.beat || 0;
    if (b > 0.15 && prevB <= 0.15) rising++; // beat*2.2>=0.33 ~ cap => pulso pleno del icono
    prevB = b;
    maxBeat = Math.max(maxBeat, b);
    maxBass = Math.max(maxBass, r.bass || 0);
  }
  const pulse = Math.min(1, maxBeat * 2.0);
  const curved = pulse * pulse * (3 - 2 * pulse);
  const scale = 1 + 0.26 * curved;
  console.log('  [' + label + '] maxBeat=' + maxBeat.toFixed(3) + ' pulsosIcono=' + rising + '/12 maxBass=' + maxBass.toFixed(3) + ' escalaIcono=' + scale.toFixed(3));
  return { maxBeat, rising, scale };
}

t('analyser real usa fftSize=512, smoothingTimeConstant=0.35 y rango dB resolutivo', () => {
  const src = fs.readFileSync('js/engine/rhythm.js', 'utf8');
  if (!/fftSize\s*=\s*512/.test(src)) throw new Error('fftSize 512 ausente');
  if (!/smoothingTimeConstant\s*=\s*0\.35/.test(src)) throw new Error('smoothing 0.35 ausente');
  if (!/minDecibels\s*=\s*-85/.test(src) || !/maxDecibels\s*=\s*-25/.test(src)) throw new Error('rango dB ausente');
});

t('NÚMEROS: con espectro realista la config nueva detecta los 12 kicks con pulso pleno', () => {
  const oldR = runConfig('ANTES fft256/bin0-excluido/smoothing0.8', true, 0.8);
  const newR = runConfig('AHORA fft512/bin0-incluido/smoothing0.35', false, 0.35);
  if (newR.rising < 8 || newR.maxBeat < 0.2) throw new Error('la config nueva debería detectar (pulsos=' + newR.rising + ' maxBeat=' + newR.maxBeat.toFixed(3) + ')');
  if (newR.scale < 1.12) throw new Error('escala del icono insuficiente: ' + newR.scale.toFixed(3));
  if (newR.rising <= oldR.rising) throw new Error('la config nueva no mejora a la vieja (nueva=' + newR.rising + ' vieja=' + oldR.rising + ')');
});

t('beat de audio real oscila: sube en kicks y baja entre golpes (no queda pegado)', () => {
  const NV = loadNV();
  const r = NV.rhythmFreshState();
  r.state = 'listening'; r.enabled = true;
  const data = smoothed(buildFrames(false), 0.35);
  let peaks = 0, valleys = 0, prevB = 0, minBetween = 1, maxB = 0;
  for (let f = 0; f < data.length; f++) {
    NV.rhythmAnalyze(r, data[f], f / 60);
    const b = r.beat || 0;
    if (b > 0.18 && prevB <= 0.18) peaks++;
    if (f % 30 > 12 && f % 30 < 25) minBetween = Math.min(minBetween, b);
    if (f > 60 && b < 0.08) valleys++;
    maxB = Math.max(maxB, b);
    prevB = b;
  }
  console.log('  [beat envelope] peaks=' + peaks + '/12 maxBeat=' + maxB.toFixed(3) + ' minBetween=' + minBetween.toFixed(3) + ' valleys=' + valleys);
  if (peaks < 8) throw new Error('pocos picos beat: ' + peaks + '/12');
  if (minBetween > 0.12 || valleys < 20) throw new Error('beat pegado, no baja: minBetween=' + minBetween.toFixed(3) + ' valleys=' + valleys);
});

t('rhythmAnalyze incluye el bin 0 en bass/kick (fundamental del bombo)', () => {
  const src = fs.readFileSync('js/engine/rhythm.js', 'utf8');
  if (!/const loBass = 0,/.test(src)) throw new Error('loBass no incluye bin 0');
  if (!/bandEnergy\(data, 0, Math\.max\(3,/.test(src)) throw new Error('kickBand no incluye bin 0');
});

console.log('RESULT rhythm_real_audio_fix: pass=' + pass + ' fail=' + fail);
if (fail) process.exit(1);

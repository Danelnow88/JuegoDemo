// Tests Bloque 1: análisis fino/onset para distinguir música sostenida vs percusiva.
const fs = require('fs'), vm = require('vm');
let pass = 0, fail = 0;
function t(desc, fn) { try { fn(); pass++; console.log('  ok  ' + desc); } catch (e) { fail++; console.log('  FAIL ' + desc + ' -> ' + e.message); } }

function loadNV() {
  const sbx = { window: { NV: {} }, navigator: { mediaDevices: {} }, localStorage: { getItem(){return null;}, setItem(){}, removeItem(){} }, console, Uint8Array, Promise, Math };
  vm.createContext(sbx);
  vm.runInContext(fs.readFileSync('js/engine/rhythm.js', 'utf8'), sbx, { filename: 'js/engine/rhythm.js' });
  return sbx.window.NV;
}
function bins(fill) { const a = new Uint8Array(128); a.fill(fill || 0); return a; }
function addRange(a, lo, hi, v) { for (let i = lo; i < hi; i++) a[i] = v; return a; }

t('sostenido con energía alta no dispara onset/kick/snare fuerte', () => {
  const NV = loadNV();
  const st = NV.rhythm;
  const sustained = addRange(addRange(addRange(bins(28), 1, 8, 165), 16, 44, 145), 80, 127, 80);
  for (let i = 0; i < 20; i++) NV.rhythmAnalyze(st, sustained, i / 20);
  if (st.energy < 0.25) throw new Error('energía de control demasiado baja');
  if (st.onset > 0.18) throw new Error('onset falso en sostenido: ' + st.onset);
  if (st.kick > 0.18 || st.snare > 0.18) throw new Error('kick/snare falsos: ' + st.kick + '/' + st.snare);
});

t('transiente grave puntual dispara kick mucho más que sostenido', () => {
  const NV = loadNV();
  const st = NV.rhythm;
  const quiet = bins(18);
  for (let i = 0; i < 10; i++) NV.rhythmAnalyze(st, quiet, i / 20);
  const kick = addRange(bins(18), 1, 7, 255);
  NV.rhythmAnalyze(st, kick, 0.55);
  if (st.kick < 0.7) throw new Error('kick débil: ' + st.kick);
  if (st.onset < 0.45) throw new Error('onset débil: ' + st.onset);
});

t('transiente medio/agudo dispara snare sin parecer kick', () => {
  const NV = loadNV();
  const st = NV.rhythm;
  const quiet = bins(15);
  for (let i = 0; i < 10; i++) NV.rhythmAnalyze(st, quiet, i / 20);
  const snare = addRange(addRange(bins(15), 18, 46, 245), 80, 127, 160);
  NV.rhythmAnalyze(st, snare, 0.6);
  if (st.snare < 0.65) throw new Error('snare débil: ' + st.snare);
  if (st.kick > 0.25) throw new Error('snare confundido con kick: ' + st.kick);
});

t('pulsos regulares estiman tempo aproximado', () => {
  const NV = loadNV();
  const st = NV.rhythm;
  const quiet = bins(12);
  const kick = addRange(bins(12), 1, 7, 255);
  let now = 0;
  for (let p = 0; p < 8; p++) {
    NV.rhythmAnalyze(st, quiet, now); now += 0.22;
    NV.rhythmAnalyze(st, kick, now); now += 0.28; // pulso cada ~0.5s => ~120 BPM
  }
  if (st.tempoBpm < 95 || st.tempoBpm > 145) throw new Error('tempo fuera de rango: ' + st.tempoBpm);
});

console.log('RESULT rhythm_onset: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
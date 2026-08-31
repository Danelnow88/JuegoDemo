// DIAG NÚMEROS REALES de r.beat para el pulso del ícono del widget.
// Simula audio real (graves con kick a 120 BPM) por el pipeline real de rhythm.js
// y registra qué valores de r.beat se producen y qué escala genera la fórmula
// actual del widget (1 + min(0.18, beat*0.9)) vs. una ampliada.
const fs = require('fs'), vm = require('vm');

function loadNV() {
  const sbx = { window: { NV: {} }, navigator: { mediaDevices: {} }, localStorage: { getItem(){return null;}, setItem(){}, removeItem(){} }, console, Uint8Array, Promise, Math };
  vm.createContext(sbx);
  vm.runInContext(fs.readFileSync('js/engine/rhythm.js', 'utf8'), sbx, { filename: 'js/engine/rhythm.js' });
  return sbx.window.NV;
}
function mkFrame(floor, kickAmp, snareAmp) {
  const a = new Uint8Array(128);
  a.fill(floor || 14);
  if (kickAmp) for (let i = 1; i < 11; i++) a[i] = kickAmp;
  if (snareAmp) { for (let i = 18; i < 46; i++) a[i] = snareAmp; for (let i = 80; i < 127; i++) a[i] = snareAmp * 0.6; }
  return a;
}

const NV = loadNV();
const st = NV.rhythmFreshState ? NV.rhythmFreshState() : NV.rhythm;
let now = 0;
const samples = [];
const DUR = 6; // segundos simulados
const BPM = 120; // golpe cada 0.5s
let beatCount = 0, maxBeat = 0, frames;

for (let f = 0; f < DUR * 60; f++) {
  now = f / 60;
  const ph = now % 0.5;                     // pulso 2 Hz (120 BPM)
  const dec = Math.exp(-ph * 16);           // envelope percusivo
  const isKick = Math.floor(now / 0.5) % 2 === 0;
  const kickAmp = isKick ? Math.round(90 + 165 * dec) : 20;
  const snareAmp = !isKick ? Math.round(70 + 130 * dec) : 14;
  NV.rhythmAnalyze(st, mkFrame(14, kickAmp, snareAmp), now);
  // grabar solo frame de beat fuerte (ph < 0.06 aprox)
  if (ph < 0.05) {
    const scaleCur = (1 + Math.min(0.18, (st.beat || 0) * 0.9)).toFixed(3);
    const scaleNew = (1 + Math.min(0.35, (st.beat || 0) * 2.2)).toFixed(3);
    samples.push({ frame: f, t: now.toFixed(2), beat: (st.beat || 0).toFixed(3), bass: st.bass.toFixed(3), kick: st.kick.toFixed(2), energy: st.energy.toFixed(3), scaleCur, scaleNew });
    if (st.beat > maxBeat) maxBeat = st.beat;
    beatCount++;
  }
}
frames = DUR * 60;
console.log('DIAG r.beat en audio percusivo 120BPM (6s):');
console.log('  frames=' + frames + ' beatSamples=' + samples.length);
console.log('  maxBeat=' + maxBeat.toFixed(3));
console.log();
console.log('  frame |  t    | beat  | bass | kick | energy | scaleActual(1+min(.18,beat*.9)) | scalePropuesto(1+min(.35,beat*2.2))');
for (const s of samples.slice(0, 14)) {
  console.log('  ' + String(s.frame).padStart(5) + ' | ' + s.t + ' | ' + s.beat + ' | ' + s.bass + ' | ' + s.kick + '  | ' + s.energy + ' | ' + s.scaleCur + ' (Δ' + (Number(s.scaleCur) - 1).toFixed(3) + ')   | ' + s.scaleNew + ' (Δ' + (Number(s.scaleNew) - 1).toFixed(3) + ')');
}
// Rango real de beat en frames sin golpe (muro sostenido continuo — deathcore)
console.log();
console.log('=== ESCENARIO CONTRASTANTE: muro sostenido (deathcore/blast) ===');
const st2 = NV.rhythmFreshState ? NV.rhythmFreshState() : NV.rhythm;
let now2 = 0, maxB2 = 0, minB2 = 1;
const b2s = [];
for (let f = 0; f < 6 * 60; f++) {
  now2 = f / 60;
  const ph = now2 % 0.07;                  // blast ~14 Hz
  const dec = Math.exp(-ph * 22);
  const kickAmp = Math.round(60 + 150 * dec);
  NV.rhythmAnalyze(st2, mkFrame(55, kickAmp, 30), now2); // floor alto = muro
  if (f % 6 === 0) { maxB2 = Math.max(maxB2, st2.beat); minB2 = Math.min(minB2, st2.beat); b2s.push(st2.beat.toFixed(3)); }
}
console.log('  maxBeat=' + maxB2.toFixed(3) + ' minBeat=' + minB2.toFixed(3) + ' (muestra cada 6 frames)');
console.log('  beat en ventana de 1s: ' + b2s.slice(0, 60).join(' '));
console.log('  => scaleActual pico=' + (1 + Math.min(0.18, maxB2 * 0.9)).toFixed(3) + ' | scalePropuesto pico=' + (1 + Math.min(0.35, maxB2 * 2.2)).toFixed(3));
console.log();
console.log('CONCLUSIÓN: el pulso de escala del ícono se ve SI el delta de escala es grande');
console.log('y el beat pico es alto. Con beat~0.9 la escala actual queda 1.18 (Δ=0.18 = 3px a 16px).');
console.log('Propuesta: ampliar pulso (cap 0.35, gain 2.2 => Δ~0.35 = 7px a 20px) + CSS transition más lenta.');

process.exit(0);
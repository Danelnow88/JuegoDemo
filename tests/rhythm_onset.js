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
  // Ventana causal: el pico se confirma en el mismo frame del transiente.
  if (st.kick < 0.7) throw new Error('kick débil: ' + st.kick);
  if (st.onset < 0.45) throw new Error('onset débil: ' + st.onset);
  if (st.kickEvt < 0.7) throw new Error('kickEvt débil: ' + st.kickEvt);
  for (let i = 1; i <= 4; i++) NV.rhythmAnalyze(st, quiet, 0.55 + i / 20);
  if (st.onsetRate < 0.4 || st.onsetRate > 2) throw new Error('onsetRate implausible para golpe único: ' + st.onsetRate);
});

t('transiente medio/agudo dispara snare sin parecer kick', () => {
  const NV = loadNV();
  const st = NV.rhythm;
  const quiet = bins(15);
  for (let i = 0; i < 10; i++) NV.rhythmAnalyze(st, quiet, i / 20);
  const snare = addRange(addRange(bins(15), 18, 46, 245), 80, 127, 160);
  NV.rhythmAnalyze(st, snare, 0.6);
  if (st.snareEvt < 0.65) throw new Error('snare débil: ' + st.snareEvt);
  if (st.kickEvt > 0.25) throw new Error('snare confundido con kick: ' + st.kickEvt);
  for (let i = 1; i <= 4; i++) NV.rhythmAnalyze(st, quiet, 0.6 + i / 20);
});

t('pulsos regulares estiman tempo aproximado', () => {
  const NV = loadNV();
  const st = NV.rhythm;
  const quiet = bins(12);
  const kick = addRange(bins(12), 1, 7, 255);
  let now = 0;
  for (let p = 0; p < 10; p++) {
    NV.rhythmAnalyze(st, quiet, now); now += 0.22;
    NV.rhythmAnalyze(st, kick, now); now += 0.28; // pulso cada ~0.5s => ~120 BPM
  }
  if (st.tempoBpm < 95 || st.tempoBpm > 145) throw new Error('tempo fuera de rango: ' + st.tempoBpm);
  if (st.onsetRate < 1 || st.onsetRate > 3.5) throw new Error('onsetRate implausible para 2 Hz: ' + st.onsetRate);
});

t('blast beats: onsetRate alto y refractario evita multi-disparo por golpe', () => {
  const NV = loadNV();
  const st = NV.rhythmFreshState();
  const LEN = 128;
  let t = 0; const onsets = [];
  for (let f = 0; f < 700; f++) {
    t += 1 / 60;
    const d = new Uint8Array(LEN);
    d.fill(0);
    for (let i = 15; i < LEN; i++) d[i] = 170;   // muro sostenido
    for (let i = 1; i < 12; i++) d[i] = 60;
    if (t >= 2) {
      const ph = (t - 2) % 0.0625;               // blast 16 Hz
      const dec = Math.exp(-ph * 22);
      const isKick = Math.floor((t - 2) / 0.0625) % 2 === 0;
      const lo = isKick ? 1 : 15, hi = isKick ? 12 : 46, amp = isKick ? 220 : 190;
      for (let i = lo; i < hi; i++) d[i] = Math.min(255, Math.max(d[i], Math.round(80 + amp * dec)));
      for (let i = 80; i < LEN; i++) d[i] = Math.min(255, Math.max(d[i], Math.round(80 + 150 * dec)));
    }
    NV.rhythmAnalyze(st, d, t);
    if (t > 6) onsets.push(st.onset);
  }
  if (st.onsetRate < 8) throw new Error('onsetRate no refleja densidad blast: ' + st.onsetRate.toFixed(2));
  const max = Math.max(...onsets), min = Math.min(...onsets);
  if (min > 0.35) throw new Error('envelope sin contraste entre golpes: min=' + min.toFixed(3));
  if (max < 0.45) throw new Error('golpes no detectados en blast: max=' + max.toFixed(3));
  if (!(st.tempoBpm > 70 && st.tempoBpm < 180)) throw new Error('tempo sin plegado de octava en blast: ' + st.tempoBpm.toFixed(1));
});

t('shake reactivo solo aparece en onset fuerte y queda acotado', () => {
  const NV = loadNV();
  const st = NV.rhythm;
  Object.assign(st, { enabled: true, state: 'listening', kick: 0.9, snare: 0.1, onset: 0.8, lastOnsetAt: 1.0, lastShakeAt: -99 });
  const boost = NV.rhythmShakeBoost(st, 1.03);
  if (boost < 0.18 || boost > 0.26) throw new Error('boost fuera de rango: ' + boost);
  const immediate = NV.rhythmShakeBoost(st, 1.08);
  if (immediate !== 0) throw new Error('cooldown no respetado: ' + immediate);
});

t('shake no se dispara con energía sostenida ni onset viejo', () => {
  const NV = loadNV();
  const st = NV.rhythm;
  Object.assign(st, { enabled: true, state: 'listening', bass: 0.9, energy: 0.8, kick: 0.2, snare: 0.2, onset: 0.2, lastOnsetAt: 1.0, lastShakeAt: -99 });
  if (NV.rhythmShakeBoost(st, 1.2) !== 0) throw new Error('shake falso por sostenido');
});

t('game.js reutiliza shake existente con Math.max y sin sistema paralelo', () => {
  const g = fs.readFileSync('js/game.js', 'utf8');
  if (!g.includes('shake = Math.max(shake, NV.rhythmShakeBoost(NV.rhythm, rhythmNow))')) throw new Error('no reutiliza shake existente');
  if (!g.includes('canvas.style.transform = `translate(${sx}px, ${sy}px)`')) throw new Error('transform existente ausente');
});

console.log('RESULT rhythm_onset: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
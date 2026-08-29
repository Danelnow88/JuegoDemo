// DIAGNÓSTICO (solo lectura del engine): cómo responde rhythmAnalyze a 3 estilos.
const fs = require('fs'), vm = require('vm');
const sbx = { window: { NV: {} }, navigator: { mediaDevices: {} }, localStorage: { getItem(){return null;}, setItem(){}, removeItem(){} }, console, Uint8Array, Promise, Math };
vm.createContext(sbx);
vm.runInContext(fs.readFileSync('js/engine/rhythm.js', 'utf8'), sbx, { filename: 'rhythm.js' });
const NV = sbx.window.NV;

const LEN = 128;
// generador: golpe = subida exponencial de energía en bandas con decay por frame
function makeFrame(hitBands, level, phase) {
  const d = new Uint8Array(LEN);
  const base = Math.round(18 * level); // piso (compresión master típica)
  for (let i = 0; i < LEN; i++) d[i] = base;
  for (const [lo, hi, amp, decay] of hitBands) {
    for (let i = lo; i < hi; i++) {
      const v = base + Math.round(amp * level * decay);
      d[i] = Math.max(d[i], Math.min(255, v));
    }
  }
  return d;
}
// perfiles: [loBass,hiBass,ampK], [snare], [hats] con decay por frame desde el golpe
const KICK = [1, 12, 220], SNR = [15, 46, 190], HAT = [80, 128, 160];
function hits(bpmPerSec, now) { // devuelve decay actual si hay golpe activo en este frame
  return null;
}

function simulate(name, pattern, seconds, fps) {
  const st = NV.rhythmFreshState();
  const n = Math.floor(seconds * fps);
  const rec = { onset: [], kick: [], snare: [], hats: [], energy: [], flux: [] };
  let t = 0;
  for (let f = 0; f < n; f++) {
    t += 1 / fps;
    // ¿hay golpe en este frame? pattern: lista de {at, bands}
    let data = null;
    for (const h of pattern) {
      const age = t - h.at;
      if (age >= 0 && age < 0.35) {
        const decay = Math.exp(-age * 18);
        const d = new Uint8Array(LEN).fill(Math.round(20));
        for (const [lo, hi, amp] of h.bands) for (let i = lo; i < hi; i++) d[i] = Math.max(d[i], Math.min(255, Math.round(20 + amp * decay)));
        data = d;
      }
    }
    if (!data) data = new Uint8Array(LEN).fill(Math.round(20)); // suelo constante
    NV.rhythmAnalyze(st, data, t);
    rec.onset.push(st.onset); rec.kick.push(st.kick); rec.snare.push(st.snare);
    rec.hats.push(st.hats); rec.energy.push(st.energy); rec.flux.push(st.spectralFlux);
  }
  const stat = (a) => { const m = a.reduce((x, y) => x + y, 0) / a.length; const sd = Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length); return [m, sd]; };
  const [mo, so] = stat(rec.onset), [mk, sk] = stat(rec.kick), [mh, sh] = stat(rec.hats), [me] = stat(rec.energy);
  console.log(name);
  console.log('  onset media=' + mo.toFixed(3) + ' sd=' + so.toFixed(3) + ' | kick media=' + mk.toFixed(3) + ' sd=' + sk.toFixed(3) + ' | hats media=' + mh.toFixed(3) + ' | energy media=' + me.toFixed(3));
  console.log('  => ratio senal (sd/media) onset=' + (so / mo).toFixed(2) + '  (<0.5 = aplanado)');
  return st;
}

// blast beats: 16 golpes/s alternando kick+snare, energía total casi constante
const blast = [];
for (let i = 0; i < 240; i++) {
  const t = 2 + i * 0.0625; // 16 Hz
  blast.push({ at: t, bands: i % 2 === 0 ? [KICK, HAT] : [SNR, HAT] });
}
// techno: 4-on-floor 130bpm kick + offbeat hats
const techno = [];
for (let i = 0; i < 32; i++) {
  const t = 2 + i * 0.4615;
  techno.push({ at: t, bands: [KICK] });
  techno.push({ at: t + 0.23, bands: [HAT] });
}
// lofi: kick espaciado suave, amplitud baja
const lofi = [];
for (let i = 0; i < 8; i++) {
  const t = 2 + i * 1.2;
  lofi.push({ at: t, bands: [[1, 12, 120]] });
  lofi.push({ at: t + 0.6, bands: [[15, 46, 90]] });
}

simulate('BLAST BEATS (16 hits/s, agresivo)', blast, 17, 60);
simulate('TECHNO (4-on-floor 130bpm)', techno, 17, 60);
simulate('LOFI (suave, esparcido)', lofi, 12, 60);

// ESCENARIO REALISTA deathcore: muro de sonido sostenido (guitarras distorsionadas
// + crash continuo => piso alto en medios/agudos) + blast beats encima.
const wall = [];
const WALL = [[15, 128, 150]]; // piso alto permanente en medios+agudos
for (let i = 0; i < 240; i++) {
  const t = 2 + i * 0.0625;
  wall.push({ at: t, bands: i % 2 === 0 ? [KICK, HAT, WALL[0]] : [SNR, HAT, WALL[0]] });
}
// Para simular el piso constante, inyectamos frames con el muro activo SIEMPRE:
// re-simulamos manualmente con piso alto.
(function blastConMuro() {
  const st = NV.rhythmFreshState();
  const n = 17 * 60;
  const rec = { onset: [], kick: [], hats: [], energy: [] };
  let t = 0;
  for (let f = 0; f < n; f++) {
    t += 1 / 60;
    const d = new Uint8Array(LEN).fill(0);
    for (let i = 15; i < 128; i++) d[i] = 170; // muro sostenido SIEMPRE
    for (let i = 1; i < 12; i++) d[i] = 60;    // graves de base
    for (const h of wall) {
      const age = t - h.at;
      if (age >= 0 && age < 0.25) {
        const decay = Math.exp(-age * 22);
        for (const [lo, hi, amp] of h.bands) for (let i = lo; i < hi; i++) d[i] = Math.min(255, Math.max(d[i], Math.round(80 + amp * decay)));
      }
    }
    NV.rhythmAnalyze(st, d, t);
    rec.onset.push(st.onset); rec.kick.push(st.kick); rec.hats.push(st.hats); rec.energy.push(st.energy);
  }
  const stat = (a) => { const m = a.reduce((x, y) => x + y, 0) / a.length; const sd = Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length); return [m, sd]; };
  const [mo, so] = stat(rec.onset), [mk, sk] = stat(rec.kick), [mh, sh] = stat(rec.hats), [me] = stat(rec.energy);
  console.log('DEATHCORE (muro sostenido + blast 16Hz) -- TU CASO');
  console.log('  onset media=' + mo.toFixed(3) + ' sd=' + so.toFixed(3) + ' | kick media=' + mk.toFixed(3) + ' sd=' + sk.toFixed(3) + ' | hats media=' + mh.toFixed(3) + ' sd=' + sh.toFixed(3) + ' | energy media=' + me.toFixed(3));
  console.log('  => ratio senal onset=' + (so / mo).toFixed(2) + ' kick=' + (sk / mk).toFixed(2) + ' hats=' + (sh / mh).toFixed(2));
})();

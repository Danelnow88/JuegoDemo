// Diagnóstico en dos problemas: (1) visibilidad del jitter de enemigos, (2) sesgo verde del hue.
// DIAG 1: simular decaimiento de onset/kick y % de frames con jitter activo y amplitud.
let onset = 0, kick = 0, snare = 0, hats = 0;
let active = 0, ampSum = 0;
const n = 600; // ~10s a 60fps, golpe de batería cada 0.5s (120 bpm)
for (let f = 0; f < n; f++) {
  if (f % 30 === 0) { onset = 1; kick = 0.9; snare = 0.7; hats = 0.5; }
  onset *= 0.72; kick *= 0.66; snare *= 0.66; hats *= 0.82;
  const pulse = Math.min(1, Math.max(0, onset * 0.55 + kick * 0.35 + snare * 0.25 + hats * 0.18));
  if (pulse > 0.02) { active++; ampSum += Math.min(2.4, 0.35 + pulse * 2.15); }
}
console.log('DIAG1 jitter: frames activos=' + active + '/' + n +
  ' (' + (100 * active / n).toFixed(1) + '%)' +
  ' amp media=' + (ampSum / Math.max(1, active)).toFixed(2) + 'px (max 2.4px), freq osc ~5.5Hz');

// DIAG 2: hue con mezcla lineal ponderada sobre mezclas realistas de música.
function hueOf(l, m, h) {
  const lw = l * l, mw = m * m, hw = h * h, s = lw + mw + hw;
  return Math.round((lw * 190 + mw * 55 + hw * 300) / s);
}
const cases = {
  'electronica (graves fuertes+agudos)': [0.8, 0.4, 0.55],
  'metal (todo alto, medios arriba)': [0.7, 0.65, 0.6],
  'clasica (medios/agudos suaves)': [0.35, 0.5, 0.45],
  'lofi (graves+medios)': [0.6, 0.55, 0.25],
  'pop (balanceado)': [0.55, 0.5, 0.5],
};
for (const [k, [l, m, h]] of Object.entries(cases)) {
  console.log('DIAG2 mezcla realista ' + k + ' => hue=' + hueOf(l, m, h));
}

// DIAG 3: blend 'screen' sobre fondo #01030d — ¿sesga a verde? (comprobación matemática)
function hsl2rgb(h, s, l) {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (nn) => { const k = (nn + h / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1))); };
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}
const screen = (a, b) => 255 - (255 - a) * (255 - b) / 255;
for (const h of [0, 60, 120, 180, 240, 300]) {
  const [r, g, b] = hsl2rgb(h, 80, 60);
  const out = [screen(r, 1), screen(g, 3), screen(b, 13)];
  const fin = out.map((v) => Math.round(v * 0.32 + 1 * 0.68)); // alpha 0.32 sobre fondo
  const dom = fin[1] > fin[0] && fin[1] > fin[2] ? 'DOMINA VERDE' : (fin[2] > fin[0] ? 'domina azul' : 'domina rojo');
  console.log('DIAG3 hue forzado ' + h + ' -> rgb final en pantalla ~ (' + fin.join(',') + ') ' + dom);
}

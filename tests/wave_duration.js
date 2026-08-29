// PASO 1: waveDuration única fuente de verdad (fórmula original fiel).
const fs = require('fs'), vm = require('vm');
let pass = 0, fail = 0;
function t(desc, fn) { try { fn(); pass++; console.log('  ok  ' + desc); } catch (e) { fail++; console.log('  FAIL ' + desc + ' -> ' + e.message); } }
function load(f, sbx) { vm.runInNewContext(fs.readFileSync(f, 'utf8'), sbx, { filename: f }); }

const sbx = { window: { NV: {} }, console, Math };
load('js/data/balance.js', sbx);
const NV = sbx.window.NV;

t('fórmula original fiel: max(15, 25 - wave*0.4)', () => {
  for (const w of [1, 2, 5, 10, 15, 25, 30]) {
    const expected = Math.max(15, 25 - w * 0.4);
    if (NV.waveDuration(w) !== expected) throw new Error('wave ' + w + ': ' + NV.waveDuration(w) + ' != ' + expected);
  }
});

t('piso en 15s para oleadas altas', () => {
  if (NV.waveDuration(25) !== 15 || NV.waveDuration(100) !== 15) throw new Error('piso roto');
});

t('sin fórmula inline duplicada en game.js (barra y nextWave usan NV.waveDuration)', () => {
  const g = fs.readFileSync('js/game.js', 'utf8');
    const uses = (g.match(/NV\.waveDuration\(wave[,\)]/g) || []).length;
  if (uses < 2) throw new Error('esperaba >=2 usos, hay ' + uses);
  if (/Math\.max\(15,\s*25\s*-\s*wave\s*\*/.test(g)) throw new Error('quedó fórmula inline duplicada');
});

t('nextWave y barra leen de la MISMA función (la barra no se desincroniza)', () => {
  const g = fs.readFileSync('js/game.js', 'utf8');
    const nw = g.includes('waveTimer = NV.waveDuration(wave, waveEvent);');
  const bar = g.includes('const maxWaveTimer = NV.waveDuration(wave, waveEvent);');
  if (!nw || !bar) throw new Error('nextWave=' + nw + ' barra=' + bar);
});

t('evento extiende duración y respeta cap 90s', () => {
  // base oleada 1: 25 - 0.4 = 24.6; evento: +25 => 49.6 (sin pasar 90)
  if (Math.abs(NV.waveDuration(1, 'fog') - 49.6) > 0.001) throw new Error('duración evento: ' + NV.waveDuration(1, 'fog'));
  // el cap 90 es una salvaguarda: NUNCA debe superar 90s (ni en oleadas bajas con bonus fijo)
  for (const w of [1, 2, 3, 5, 10, 20, 24, 25, 100]) {
    if (NV.waveDuration(w, 'fog') > 90) throw new Error('cap 90 superado en w=' + w + ': ' + NV.waveDuration(w, 'fog'));
  }
  // oleadas muy altas: base pisa 15s, evento = 15 + 25 = 40 (no 90, el clamp no altera el piso)
  if (NV.waveDuration(100, 'fog') !== 40) throw new Error('evento alta: ' + NV.waveDuration(100, 'fog'));
});

t('sin evento: duración base sin cambios', () => {
  for (const w of [1, 2, 5, 10]) {
    if (NV.waveDuration(w, null) !== NV.waveDuration(w)) throw new Error('base cambió en ' + w);
    if (NV.waveDuration(w, false) !== NV.waveDuration(w)) throw new Error('base falsy cambió en ' + w);
  }
});

t('waveSpawnFactor compensa oleadas largas (mismo total de spawns)', () => {
  // Sin evento: factor = 1 (intervalo base).
  if (Math.abs(NV.waveSpawnFactor(5, null) - 1) > 1e-9) throw new Error('factor sin evento: ' + NV.waveSpawnFactor(5, null));
  // Con evento: factor > 1 (intervalo más lento, menos spawns/segundo)
  if (NV.waveSpawnFactor(5, 'fog') <= 1) throw new Error('factor evento debe ser >1: ' + NV.waveSpawnFactor(5, 'fog'));
  // El factor es la razón de duraciones: wave 5 -> base 23, evento 48 => factor = 48/23
  if (Math.abs(NV.waveSpawnFactor(5, 'fog') - (48 / 23)) > 1e-6) throw new Error('factor no coincide con ratio: ' + NV.waveSpawnFactor(5, 'fog'));
});

console.log('RESULT wave_duration: pass=' + pass + ' fail=' + fail);

console.log('RESULT wave_duration: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
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
  const uses = (g.match(/NV\.waveDuration\(wave\)/g) || []).length;
  if (uses < 2) throw new Error('esperaba >=2 usos, hay ' + uses);
  if (/Math\.max\(15,\s*25\s*-\s*wave\s*\*/.test(g)) throw new Error('quedó fórmula inline duplicada');
});

t('nextWave y barra leen de la MISMA función (la barra no se desincroniza)', () => {
  const g = fs.readFileSync('js/game.js', 'utf8');
  const nw = g.includes('waveTimer = NV.waveDuration(wave);');
  const bar = g.includes('const maxWaveTimer = NV.waveDuration(wave);');
  if (!nw || !bar) throw new Error('nextWave=' + nw + ' barra=' + bar);
});

console.log('RESULT wave_duration: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
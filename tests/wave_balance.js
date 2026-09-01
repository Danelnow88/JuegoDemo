// Tests B1: curva de HP enemigo (NV.enemyHpScale) — pendiente 0.22 desde w=10.
const fs = require('fs'), vm = require('vm');
let pass = 0, fail = 0;
function t(desc, fn) { try { fn(); pass++; console.log('  ok  ' + desc); } catch (e) { fail++; console.log('  FAIL ' + desc + ' -> ' + e.message); } }
function load(f, sbx) { vm.runInNewContext(fs.readFileSync(f, 'utf8'), sbx, { filename: f }); }

const sbx = { window: { NV: {} }, console, Math };
load('js/data/balance.js', sbx);
load('js/data/gameData.js', sbx);
load('js/engine/enemies.js', sbx);
const NV = sbx.window.NV;

const oldHp = (w) => 1 + 0.30 * w;

t('oleadas 1-10 mantienen la curva original (onboarding intacto)', () => {
  for (let w = 1; w <= 10; w++) {
    if (NV.enemyHpScale(w) !== oldHp(w)) throw new Error('w=' + w + ' esperado ' + oldHp(w) + ' got ' + NV.enemyHpScale(w));
  }
});

t('continua en w=10 (sin salto)', () => {
  const a = NV.enemyHpScale(10), b = NV.enemyHpScale(11);
  if (Math.abs(b - a - 0.22) > 1e-9) throw new Error('paso 11-10=' + (b - a));
});

t('pendiente 0.22 reduce HP en oleada alta', () => {
  for (const w of [20, 30, 40]) {
    if (!(NV.enemyHpScale(w) < oldHp(w))) throw new Error('w=' + w + ' nuevo ' + NV.enemyHpScale(w) + ' no < ' + oldHp(w));
  }
  const red30 = 1 - NV.enemyHpScale(30) / oldHp(30);
  if (!(red30 > 0.10 && red30 < 0.25)) throw new Error('reduccion w30=' + red30.toFixed(3));
});

t('spawnEnemy consume la curva unica (sin formula duplicada)', () => {
  const src = fs.readFileSync('js/engine/enemies.js', 'utf8');
  if (/0\.30\s*\*\s*st\.wave|0\.3\s*\*\s*st\.wave/.test(src)) throw new Error('formula vieja inline en enemies.js');
  if (!src.includes('NV.enemyHpScale(st.wave)')) throw new Error('spawnEnemy no usa NV.enemyHpScale');
});

t('wave invalida cae a 1 de forma segura', () => {
  if (NV.enemyHpScale(0) !== NV.enemyHpScale(1)) throw new Error('w=0 no cae a 1');
  if (NV.enemyHpScale(undefined) !== NV.enemyHpScale(1)) throw new Error('undefined no cae a 1');
});

console.log('RESULT wave_balance: pass=' + pass + ' fail=' + fail);
process.exitCode = fail ? 1 : 0;
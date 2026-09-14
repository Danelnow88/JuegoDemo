// Tests B1: curva de HP enemigo (NV.enemyHpScale) — pendiente 0.28 desde w=10 (F1).
// Tests B2: piso de poder (NV.waveWeaponMult) — +5% de daño de arma por oleada.
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
  if (Math.abs(b - a - 0.28) > 1e-9) throw new Error('paso 11-10=' + (b - a));
});

t('F1: pendiente 0.28 moderada, monotónica y bajo el lineal original', () => {
  for (const [w, exp] of [[11, 4.28], [20, 6.8], [30, 9.6], [40, 12.4], [50, 15.2]]) {
    if (Math.abs(NV.enemyHpScale(w) - exp) > 1e-9) throw new Error('w=' + w + ' esperado ' + exp);
  }
  let prev = NV.enemyHpScale(1);
  for (let w = 2; w <= 60; w++) {
    const s = NV.enemyHpScale(w);
    if (!(s > prev)) throw new Error('no monotónica en w=' + w);
    if (!(s <= 1 + 0.30 * w)) throw new Error('w=' + w + ' superó el lineal original');
    prev = s;
  }
  // F1: más durable que la pendiente 0.22 previa (el late game tiene MENOS enemigos)
  if (!(NV.enemyHpScale(30) > 4 + 20 * 0.22)) throw new Error('F1 no subió durabilidad tardía');
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

// ===== B2 =====
t('B2: w=1 no altera el daño inicial (partida igual a siempre)', () => {
  if (NV.waveWeaponMult(1) !== 1) throw new Error('w=1 -> ' + NV.waveWeaponMult(1));
});

t('B2: +5% lineal por oleada completada', () => {
  for (const [w, exp] of [[2, 1.05], [10, 1.45], [20, 1.95], [30, 2.45]]) {
    if (Math.abs(NV.waveWeaponMult(w) - exp) > 1e-9) throw new Error('w=' + w + ' esperado ' + exp);
  }
});

t('B2: wave invalida cae a 1 de forma segura', () => {
  if (NV.waveWeaponMult(0) !== 1) throw new Error('w=0 -> ' + NV.waveWeaponMult(0));
  if (NV.waveWeaponMult(undefined) !== 1) throw new Error('undefined -> ' + NV.waveWeaponMult(undefined));
});

t('B2: shoot escala el daño del arma (unico consumidor)', () => {
  const src = fs.readFileSync('js/engine/weapons.js', 'utf8');
  if (!src.includes('NV.waveWeaponMult(state.wave)')) throw new Error('shoot no usa NV.waveWeaponMult');
  const others = ['js/engine/bullets.js', 'js/engine/enemies.js', 'js/engine/boss.js', 'js/engine/combat.js'];
  for (const f of others) {
    if (fs.readFileSync(f, 'utf8').includes('waveWeaponMult')) throw new Error('uso inesperado en ' + f);
  }
});

console.log('RESULT wave_balance: pass=' + pass + ' fail=' + fail);
process.exitCode = fail ? 1 : 0;
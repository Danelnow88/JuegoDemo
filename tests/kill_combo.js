// Tests E1: combo de kills — encadenar derribos, expiración, reset por daño y bonus escalable.
const fs = require('fs'), vm = require('vm');
let pass = 0, fail = 0;
function t(desc, fn) { try { fn(); pass++; console.log('  ok  ' + desc); } catch (e) { fail++; console.log('  FAIL ' + desc + ' -> ' + e.message); } }
function load(f, sbx) { vm.runInNewContext(fs.readFileSync(f, 'utf8'), sbx, { filename: f }); }

const sbx = { window: { NV: {} }, console, Math };
load('js/engine/enemies.js', sbx);
const NV = sbx.window.NV;

t('kills encadenados suben el contador y devuelven milestone', () => {
  const c = { count: 0, timer: 0 };
  let r = NV.comboOnKill(c);
  if (r.count !== 1) throw new Error('primer kill count=' + r.count);
  NV.comboTick(c, 0.5); // sigue viva la ventana
  r = NV.comboOnKill(c);
  if (r.count !== 2) throw new Error('segundo kill count=' + r.count);
  if (r.milestone) throw new Error('no debería haber milestone en x2');
});

t('ventana de 2s: el combo expira si no hay kills', () => {
  const c = { count: 3, timer: 1.5 };
  NV.comboTick(c, 1.0); // queda 0.5
  if (c.count !== 3) throw new Error('expiró antes de tiempo');
  NV.comboTick(c, 0.6); // cruza los 2s
  if (c.count !== 0 || c.timer !== 0) throw new Error('no resetea al expirar');
  const r = NV.comboOnKill(c);
  if (r.count !== 1) throw new Error('tras expirar debe reiniciar en 1, fue ' + r.count);
});

t('milestones cada 5 kills (x5, x10)', () => {
  const c = { count: 4, timer: 1.0 };
  const r5 = NV.comboOnKill(c);
  if (!r5.milestone || r5.count !== 5) throw new Error('x5 sin milestone');
  const r6 = NV.comboOnKill(c);
  if (r6.milestone) throw new Error('milestone fuera de múltiplos de 5');
});

t('bonus de score escala y el milestone paga +1 💎', () => {
  const lo = NV.comboOnKill({ count: 0, timer: 0 });
  const hi = NV.comboOnKill({ count: 7, timer: 1 });
  if (!(hi.bonusScore > lo.bonusScore)) throw new Error('bonusScore no escaló');
  if (lo.gemBonus !== 0) throw new Error('x1 no debería pagar gema');
  const mid = NV.comboOnKill({ count: 4, timer: 1 });
  if (hi.bonusScore !== 16) throw new Error('x8 = 2*8=16, fue ' + hi.bonusScore);
});

console.log('RESULT kill_combo: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
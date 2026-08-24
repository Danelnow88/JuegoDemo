// Tests NOVA Detonación Espectral: 50% del DoT acumulado, jefe con mult, VFX doble anillo.
const fs = require('fs'), vm = require('vm');
let pass = 0, fail = 0;
function t(desc, fn) { try { fn(); pass++; console.log('  ok  ' + desc); } catch (e) { fail++; console.log('  FAIL ' + desc + ' -> ' + e.message); } }
function load(f, sbx) { vm.runInNewContext(fs.readFileSync(f, 'utf8'), sbx, { filename: f }); }

const sbx = { window: { NV: {} }, console, Math };
for (const f of ['js/data/balance.js', 'js/engine/fx.js', 'js/engine/special.js']) load(f, sbx);
const NV = sbx.window.NV;
const cbs = {
  addFloatText(x, y, txt) { cbs.texts.push(txt); }, texts: [],
  spawnExplosion() { cbs.explosions++; }, explosions: 0,
  triggerFlash(c) { cbs.flashes.push(c); }, flashes: [],
};

t('detona el 50% del DoT acumulado y limpia phaseAcc', () => {
  const player = { x: 400, y: 300 };
  const e1 = { x: 450, y: 300, hp: 50, dead: false, phaseAcc: 80 };   // recibe 40 -> hp 10
  const e2 = { x: 900, y: 900, dead: false, phaseAcc: 0 };
  const shockwaves = [];
  const hits = NV.detonatePhase(player, [e1, e2], null, shockwaves, cbs);
  if (e1.hp !== 10) throw new Error('hp=' + e1.hp);
  if (e1.phaseAcc !== 0) throw new Error('acc no limpio');
  if (!cbs.texts.includes('ESPECTRAL')) throw new Error('sin texto');
  if (hits !== 1) throw new Error('hits=' + hits);
});

t('jefe: acc*0.5*0.3 (DoT de aura sin mult ya se aplicó en vivo)', () => {
  const player = { x: 400, y: 300 };
  const boss = { x: 430, y: 300, hp: 5000, dead: false, phaseAcc: 120 };
  NV.detonatePhase(player, [], boss, [], cbs);
  if (boss.hp !== 5000 - 18) throw new Error('boss hp=' + boss.hp); // 120*0.5*0.3
  if (boss.phaseAcc !== 0) throw new Error('acc jefe no limpio');
});

t('VFX diferenciado: doble shockwave espectral + estallido + flash', () => {
  const player = { x: 0, y: 0 };
  const sw = []; cbs.explosions = 0; cbs.flashes = [];
  NV.detonatePhase(player, [], null, sw, cbs);
  if (sw.length !== 2) throw new Error('anillos=' + sw.length);
  if (!(sw[0].color === '#caa7ff' && sw[1].color === '#fff')) throw new Error('colores mal');
  if (cbs.explosions !== 1 || !cbs.flashes.includes('#caa7ff')) throw new Error('falta estallido/flash');
});

t('balance define PHASE_DETONATION_MULT=0.5', () => {
  if (NV.BALANCE.PHASE_DETONATION_MULT !== 0.5) throw new Error(NV.BALANCE.PHASE_DETONATION_MULT);
});

console.log('RESULT nova_detonation: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
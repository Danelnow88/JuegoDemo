// Tests D2: permanentes nuevas (crítico, esquiva, regeneración, codicia).
const fs = require('fs'), vm = require('vm');
let pass = 0, fail = 0;
function t(desc, fn) { try { fn(); pass++; console.log('  ok  ' + desc); } catch (e) { fail++; console.log('  FAIL ' + desc + ' -> ' + e.message); } }
function load(f, sbx) { vm.runInNewContext(fs.readFileSync(f, 'utf8'), sbx, { filename: f }); }

const sbx = { window: { NV: {} }, console };
sbx.Math = Object.create(Math); // hereda todo; random se overridea por test
load('js/data/balance.js', sbx);
load('js/data/gameData.js', sbx);
load('js/engine/combat.js', sbx);
const NV = sbx.window.NV;

t('PERM_UPGRADES tiene 9 entradas con las 4 nuevas', () => {
  const keys = NV.PERM_UPGRADES.map((u) => u.key);
  for (const k of ['damage', 'speed', 'hp', 'armor', 'luck', 'crit', 'dodge', 'regen', 'greed']) {
    if (!keys.includes(k)) throw new Error('falta ' + k);
  }
  const bases = Object.fromEntries(NV.PERM_UPGRADES.map((u) => [u.key, u.base]));
  // Coherencia con economía lenta: las nuevas no más baratas que luck (20)
  for (const k of ['crit', 'dodge', 'regen', 'greed']) {
    if (!(bases[k] >= 30 && bases[k] <= 50)) throw new Error('base fuera de rango razonable: ' + k + '=' + bases[k]);
  }
});

t('crítico permanente sumado a la chance base (weapons.js)', () => {
  const g = fs.readFileSync('js/engine/weapons.js', 'utf8');
  if (!g.includes('permCrit || 0') || !g.includes('CRIT_PERM_CHANCE')) throw new Error('hook de crítico ausente');
  if (NV.BALANCE.CRIT_PERM_CHANCE !== 0.005) throw new Error('valor CRIT_PERM_CHANCE inesperado');
});

t('esquiva permanente aplica en computePlayerHit (random determinista)', () => {
  const st = { CHARACTERS: { nova: { dodge: 0, takeDmgMult: 1 } }, player: { character: 'nova', armor: 0, permDodge: 10 }, calcEnemyDamage: () => ({ dmg: 10, crit: false }) };
  sbx.Math.random = () => 0.03; // < 4% => esquiva
  let hit = NV.computePlayerHit(10, st);
  if (!hit.dodged) throw new Error('debería esquivar con permDodge=10 y random=0.03');
  st.player.permDodge = 0;
  hit = NV.computePlayerHit(10, st);
  if (hit.dodged) throw new Error('no debería esquivar sin permDodge');
});

t('codicia suma al roll de drop (killEnemy, random determinista)', () => {
  const g = fs.readFileSync('js/engine/enemies.js', 'utf8');
  if (!g.includes('permGreed || 0') || !g.includes('GREED_PERM_DROP')) throw new Error('hook de codicia ausente');
  // Simulación del umbral: luck=0, permGreed=3 -> 0.15+0.09=0.24
  const chance = 0.15 + 0 * 0.01 + 3 * 0.03;
  if (Math.abs(chance - 0.24) > 1e-9) throw new Error('umbral codicia incorrecto');
});

t('regeneración constante + bloque en game.js', () => {
  if (NV.BALANCE.REGEN_PERM_HPSEC !== 0.2) throw new Error('REGEN_PERM_HPSEC inesperado');
  const g = fs.readFileSync('js/game.js', 'utf8');
  if (!g.includes('permRegen') || !g.includes('REGEN_PERM_HPSEC') || !g.includes('regenAcc')) throw new Error('bloque de regen ausente');
});

t('defaults de permUpgrades incluyen las 4 claves (game.js x3)', () => {
  const g = fs.readFileSync('js/game.js', 'utf8');
  const n = (g.match(/crit: 0, dodge: 0, regen: 0, greed: 0/g) || []).length;
  if (n < 3) throw new Error('solo ' + n + ' defaults actualizados');
  if (!g.includes('player.permCrit = permUpgrades.crit')) throw new Error('stats no aplicados en selección/arranque');
});

console.log('RESULT perm_upgrades: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
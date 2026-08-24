// Tests de habilidades de personaje (v40): nerf de Lluvia Estelar contra jefes.
const fs = require('fs'), vm = require('vm');
const sbx = { window: { NV: {} }, console, Math };
for (const f of ['js/data/balance.js', 'js/data/gameData.js', 'js/engine/meteors.js']) vm.runInNewContext(fs.readFileSync(f, 'utf8'), sbx, { filename: f });
const NV = sbx.window.NV;
let pass = 0, fail = 0;
function t(desc, fn) { try { fn(); pass++; console.log('  ok  ' + desc); } catch (e) { fail++; console.log('  FAIL ' + desc + ' -> ' + e.message); } }

t('BOTI: cooldown notoriamente mayor (>= 12s)', () => {
  const cd = NV.CHARACTERS.boti.maxCd;
  if (!(cd >= 12)) throw new Error('maxCd=' + cd);
});

t('Lluvia Estelar: daño a jefe reducido por METEOR_BOSS_DMG_MULT', () => {
  const mult = NV.BALANCE.METEOR_BOSS_DMG_MULT;
  if (!(mult > 0 && mult < 0.5)) throw new Error('mult=' + mult);
  // Simular un meteoro impactando al jefe: 30 * 0.3 = 9 por meteoro
  const boss = { x: 400, y: 300, hp: 10000, maxHp: 10000, radius: 50, dead: false, hitFlash: 0 };
  const meteors = [{ x: 400, y: 300, vx: 0, vy: 400, radius: 10, color: '#fff', dead: false }];
  const r = NV.updateMeteors(0.05, meteors, { H: 600, enemies: [], boss }, { killEnemy() {}, applyKnockback() {}, spawnExplosion() {} });
  const dmg = 10000 - boss.hp; // ~30*mult*frames... verificar que sea < 15 en el tick
  if (!(dmg > 0 && dmg <= 15 * (mult / 0.3) + 1)) throw new Error('dano tick=' + dmg);
  if (!(10000 - 12 <= boss.hp)) throw new Error('dano excesivo por impacto');
});

t('Lluvia Estelar: dano contra enemigos comunes intacto (40)', () => {
  const e = { x: 400, y: 315, hp: 39, maxHp: 39, radius: 10, dead: false, knockVelX: 0, knockVelY: 0 };
  let killed = false;
  NV.updateMeteors(0.05, [{ x: 400, y: 300, vx: 0, vy: 400, radius: 10, color: '#fff', dead: false }],
    { H: 600, enemies: [e], boss: null },
    { killEnemy(en) { killed = true; }, applyKnockback() {}, spawnExplosion() {} });
  if (!killed) throw new Error('deberia matar con 40 de dano');
});

console.log('RESULT char_skills: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
// Tests de habilidades de personaje (v40): nerf de Lluvia Estelar contra jefes.
const fs = require('fs'), vm = require('vm');
const sbx = { window: { NV: {} }, console, Math };
for (const f of ['js/data/balance.js', 'js/data/gameData.js', 'js/data/consumables.js', 'js/engine/meteors.js', 'js/engine/consumables.js']) vm.runInNewContext(fs.readFileSync(f, 'utf8'), sbx, { filename: f });
const NV = sbx.window.NV;
let pass = 0, fail = 0;
function t(desc, fn) { try { fn(); pass++; console.log('  ok  ' + desc); } catch (e) { fail++; console.log('  FAIL ' + desc + ' -> ' + e.message); } }

t('BOTI: cooldown notoriamente mayor (>= 12s)', () => {
  const cd = NV.CHARACTERS.boti.maxCd;
  if (!(cd >= 12)) throw new Error('maxCd=' + cd);
});

t('BOTI: regeneración usa passiveId y conserva tick cada 300 frames con límite de HP', () => {
  const g = fs.readFileSync('js/game.js', 'utf8');
  if (g.includes("passive.includes('Regenera')")) throw new Error('queda detección por texto');
  if (!g.includes('NV.applyBotiPassiveRegen(char, player, frame, addFloatText)')) throw new Error('game.js no usa helper de regen');
  if (NV.CHARACTERS.boti.passiveId !== 'boti_regen') throw new Error('passiveId BOTI incorrecto');
  const floats = [];
  const player = { x: 10, y: 50, hp: 99, maxHp: 100 };
  const addFloatText = (x, y, text, color) => floats.push({ x, y, text, color });
  if (NV.applyBotiPassiveRegen(NV.CHARACTERS.boti, player, 299, addFloatText) !== false) throw new Error('curó fuera de tick');
  if (player.hp !== 99) throw new Error('hp cambió antes de tick');
  if (NV.applyBotiPassiveRegen(NV.CHARACTERS.boti, player, 300, addFloatText) !== true) throw new Error('no curó en tick 300');
  if (player.hp !== 100) throw new Error('hp tick=' + player.hp);
  if (!floats.some((f) => f.x === 10 && f.y === 10 && f.text === '+1' && f.color === '#7cf8ff')) throw new Error('float incorrecto');
  if (NV.applyBotiPassiveRegen(NV.CHARACTERS.boti, player, 600, addFloatText) !== false) throw new Error('curó sobre maxHp');
  if (player.hp !== 100) throw new Error('superó maxHp');
  const legacyTextOnly = { passive: 'Regenera 1 HP cada 5s' };
  player.hp = 90;
  if (NV.applyBotiPassiveRegen(legacyTextOnly, player, 900, addFloatText) !== false || player.hp !== 90) throw new Error('curó sin passiveId');
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
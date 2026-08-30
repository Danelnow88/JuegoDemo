// Tests de integración de iconos canvas de mejoras permanentes/habilidades.
const fs = require('fs');
let pass = 0, fail = 0;
function t(d, fn) { try { fn(); pass++; console.log('  ok  ' + d); } catch (e) { fail++; console.log('  FAIL ' + d + ' -> ' + e.message); } }

const game = fs.readFileSync('js/game.js', 'utf8');
const data = fs.readFileSync('js/data/gameData.js', 'utf8');

t('tienda permanente renderiza mejoras con canvas aprobado 64/48', () => {
  if (!game.includes('function drawMetaSkillCanvas')) throw new Error('falta drawMetaSkillCanvas');
  if (!game.includes("drawMetaSkillCanvas(el.querySelector('canvas'), u.key, 64, 48)")) throw new Error('renderPermOffers no dibuja 64/48');
  if (!game.includes('NV.drawMetaSkillIcon(ctx, id, canvasSize / 2')) throw new Error('drawMetaSkillCanvas no usa helper aprobado');
  if (game.includes("' + u.icon + '")) throw new Error('renderPermOffers conserva u.icon textual');
});

t('PERM_UPGRADES conserva 9 claves sin campo icon legacy', () => {
  const block = data.slice(data.indexOf('NV.PERM_UPGRADES'), data.indexOf('];', data.indexOf('NV.PERM_UPGRADES')));
  for (const id of ['damage','speed','hp','armor','luck','crit','dodge','regen','greed']) {
    if (!block.includes("key: '" + id + "'")) throw new Error('falta ' + id);
  }
  if (/icon\s*:/.test(block)) throw new Error('quedó campo icon en PERM_UPGRADES');
});

console.log('RESULT meta_skill_icons_integration: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
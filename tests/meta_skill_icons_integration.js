// Tests de integración de iconos canvas de mejoras permanentes/habilidades.
const fs = require('fs');
let pass = 0, fail = 0;
function t(d, fn) { try { fn(); pass++; console.log('  ok  ' + d); } catch (e) { fail++; console.log('  FAIL ' + d + ' -> ' + e.message); } }

const game = fs.readFileSync('js/game.js', 'utf8');
const data = fs.readFileSync('js/data/gameData.js', 'utf8');
const hud = fs.readFileSync('js/render/hud.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('css/styles.css', 'utf8');

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

t('HUD de habilidad usa drawMetaSkillIcon a 18px dentro del slot 22', () => {
  if (!hud.includes('NV.drawMetaSkillIcon(ctx, char.special')) throw new Error('HUD no usa drawMetaSkillIcon');
  if (!hud.includes('var sl = 22')) throw new Error('slot skill no es 22');
  if (!hud.includes('ssy + sl / 2, 18')) throw new Error('icono skill no es 18px centrado');
  if (!hud.includes('cy - radius - 8, 18')) throw new Error('cooldown sobre personaje no usa icono canvas 18px');
  if (!hud.includes('Habilidad: ${char.skillName}')) throw new Error('stats TAB conserva icono textual');
  if (hud.includes('char.skillIcon')) throw new Error('HUD conserva char.skillIcon');
});

t('CHARACTERS conserva special/skillName sin skillIcon legacy', () => {
  const block = data.slice(data.indexOf('NV.CHARACTERS'), data.indexOf('};', data.indexOf('NV.CHARACTERS')));
  for (const id of ['meteor','phase','bulwark','hivemind']) {
    if (!block.includes("special: '" + id + "'")) throw new Error('falta special ' + id);
  }
  if (/skillIcon\s*:/.test(block)) throw new Error('quedó skillIcon en CHARACTERS');
});

t('menú inicial renderiza 4 canvas de habilidades de personaje', () => {
  if (!game.includes('function renderMenuSkillIcons')) throw new Error('falta renderMenuSkillIcons');
  if (!game.includes("drawMetaSkillCanvas(canvas, canvas.getAttribute('data-skill-icon'), 36, 24)")) throw new Error('menú no dibuja canvas 36/24');
  if (!game.includes('renderMenuSkillIcons();')) throw new Error('init no pinta skills del menú');
  const icons = html.match(/class="char-skill-icon" data-skill-icon="/g) || [];
  if (icons.length !== 4) throw new Error('canvas menú=' + icons.length);
  if (!css.includes('.char-skill-icon')) throw new Error('falta CSS char-skill-icon');
});

t('tienda de partida usa metaIcon canvas para mejoras temporales', () => {
  for (const id of ["metaIcon: 'hp'", "metaIcon: 'speed'", "metaIcon: 'armor'", "metaIcon: 'luck'"]) {
    if (!game.includes(id)) throw new Error('falta ' + id);
  }
  if (!game.includes('item.weapon || item.consumableType || item.metaIcon')) throw new Error('renderOffers no reserva canvas metaIcon');
  if (!game.includes('drawMetaSkillCanvas(c, item.metaIcon, 64, 48)')) throw new Error('renderOffers no dibuja metaIcon 64/48');
  if (game.includes('item.icon')) throw new Error('renderOffers conserva item.icon textual');
});

console.log('RESULT meta_skill_icons_integration: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
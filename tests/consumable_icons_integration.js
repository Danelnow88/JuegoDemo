// Tests Bloque 3/4: integración de iconos canvas de consumibles y barrido anti-placeholder.
const fs = require('fs');
let pass = 0, fail = 0;
function t(d, fn) { try { fn(); pass++; console.log('  ok  ' + d); } catch (e) { fail++; console.log('  FAIL ' + d + ' -> ' + e.message); } }

const game = fs.readFileSync('js/game.js', 'utf8');
const hud = fs.readFileSync('js/render/hud.js', 'utf8');
const data = fs.readFileSync('js/data/consumables.js', 'utf8');
const utils = fs.readFileSync('js/core/utils.js', 'utf8');

t('tienda renderiza consumibles con canvas aprobado 64/48', () => {
  if (!game.includes('function drawConsumableCanvas')) throw new Error('falta drawConsumableCanvas');
  if (!game.includes('drawConsumableCanvas(c, item.consumableType, 64, 48)')) throw new Error('ofertas no renderizan consumibles 64/48');
  if (!game.includes('NV.drawConsumableIcon(ctx, type, canvasSize / 2')) throw new Error('drawConsumableCanvas no usa helper aprobado');
});

t('HUD usa drawConsumableIcon y no g.icon', () => {
  if (!hud.includes('NV.drawConsumableIcon')) throw new Error('HUD no usa drawConsumableIcon');
  if (hud.includes('g.icon')) throw new Error('HUD todavía referencia g.icon');
});

t('consumibles comprados se guardan por type/name sin icon legacy', () => {
  if (!game.includes('consumableItems.push({ type: c.key, name: c.name })')) throw new Error('push conserva campos no esperados');
  if (utils.includes('icon: it.icon')) throw new Error('groupConsumables conserva icon');
});

t('datos runtime de NV.CONSUMABLES no conservan campo icon', () => {
  const block = data.slice(data.indexOf('NV.CONSUMABLES'), data.indexOf('};', data.indexOf('NV.CONSUMABLES')));
  if (/icon\s*:/.test(block)) throw new Error('quedó campo icon en NV.CONSUMABLES');
});

t('no quedan emojis viejos de los 7 consumibles en runtime', () => {
  const defsStart = game.indexOf('const consumableDefs = [');
  const defsEnd = game.indexOf('];', defsStart);
  const pushStart = game.indexOf('consumableItems.push');
  const pushEnd = game.indexOf('showBanner', pushStart);
  const runtime = [game.slice(defsStart, defsEnd), game.slice(pushStart, pushEnd), hud, data, utils].join('\n');
  for (const old of ['🧪','⚡','🛡','💣','⏱','🧲','🎯']) {
    if (runtime.includes(old)) throw new Error('quedó placeholder viejo de consumible: ' + old);
  }
});

console.log('RESULT consumable_icons_integration: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
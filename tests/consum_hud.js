// Tests Fix 3: HUD de armas/consumibles en grillas de 6 slots + selección de consumible.
const fs = require('fs'), vm = require('vm');
let pass = 0, fail = 0;
function t(desc, fn) { try { fn(); pass++; console.log('  ok  ' + desc); } catch (e) { fail++; console.log('  FAIL ' + desc + ' -> ' + e.message); } }
function load(f, sbx) { vm.runInNewContext(fs.readFileSync(f, 'utf8'), sbx, { filename: f }); }

const sbx = { window: { NV: {} }, console, Math };
load('js/data/gameData.js', sbx);
load('js/core/utils.js', sbx);
const NV = sbx.window.NV;

t('groupConsumables: agrupa por tipo con conteo y orden de aparición', () => {
  const items = [{ type: 'potion' }, { type: 'shield' }, { type: 'potion' }];
  const g = NV.groupConsumables(items);
  if (g.length !== 2 || g[0].type !== 'potion' || g[0].count !== 2 || g[1].count !== 1) throw new Error(JSON.stringify(g));
});

t('consumeByType: quita el PRIMER ítem del tipo elegido, no el primero de la cola', () => {
  const items = [{ type: 'potion', id: 1 }, { type: 'potion', id: 2 }, { type: 'shield', id: 3 }];
  const got = NV.consumeByType(items, 'shield');
  if (!got || got.id !== 3) throw new Error('no quitó el shield');
  if (items.length !== 2 || items[0].id !== 1) throw new Error('mutación incorrecta');
  if (NV.consumeByType([], 'potion') !== null) throw new Error('vacío debería dar null');
});

t('tope acumulado de consumibles por tipo: addConsumable bloquea al llegar a 10', () => {
  NV.CONSUMABLE_STACK_CAP = 10;
  const items = Array.from({ length: 10 }, () => ({ type: 'potion', name: 'Poción' }));
  if (NV.consumableCountByType(items, 'potion') !== 10) throw new Error('count potion');
  if (NV.canAddConsumable(items, 'potion', 10)) throw new Error('debería bloquear potion llena');
  if (NV.addConsumable(items, { type: 'potion', name: 'Poción' }, 10)) throw new Error('agregó sobre cap');
  if (!NV.addConsumable(items, { type: 'shield', name: 'Escudo' }, 10)) throw new Error('bloqueó otro tipo');
  NV.consumeByType(items, 'potion');
  if (!NV.addConsumable(items, { type: 'potion', name: 'Poción' }, 10)) throw new Error('no permitió tras consumir');
});

t('cycleIndex: cicla selección en ambos sentidos sin salirse', () => {
  if (NV.cycleIndex(0, 3, -1) !== 2) throw new Error('wrap abajo');
  if (NV.cycleIndex(2, 3, 1) !== 0) throw new Error('wrap arriba');
  if (NV.cycleIndex(5, 0, 1) !== 0) throw new Error('lista vacía segura');
});

t('HUD dibuja filas horizontales (drawSlotRow) y expone rects para el click', () => {
  const h = fs.readFileSync('js/render/hud.js', 'utf8');
  if ((h.match(/drawSlotRow/g) || []).length < 2) throw new Error('faltan filas horizontales de slots');
  if (!h.includes('NV.consumSlotRects')) throw new Error('sin rects para hit-test');
  if (!h.includes('NV.drawConsumableIcon')) throw new Error('HUD no usa iconos canvas de consumibles');
  if (h.includes('return { icon: g.icon')) throw new Error('HUD conserva placeholder g.icon');
});

t('game.js conecta Q (ciclar), F (usar seleccionado) y click en slot', () => {
  const g = fs.readFileSync('js/game.js', 'utf8');
  if (!g.includes("canvas.addEventListener('click'")) throw new Error('sin click handler');
  if (!g.includes('consumSel = 0;') || !/startGame[\s\S]{0,2000}consumSel = 0;/.test(g)) throw new Error('sin reset por partida');
  if (!g.includes('NV.consumeByType(consumableItems')) throw new Error('F no usa el tipo seleccionado');
});

console.log('RESULT consum_hud: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
// Test integrador del HUD minimalista v2: layout, combo posicion, slots alineados.
const fs = require('fs'), vm = require('vm');
const sbx = { window: { NV: {} }, console, Math: Math };
for (const f of ['js/core/utils.js', 'js/data/balance.js', 'js/data/gameData.js'])
  vm.runInNewContext(fs.readFileSync(f, 'utf8'), sbx, { filename: f });
const NV = sbx.window.NV;
for (const f of ['js/render/hud.js'])
  vm.runInNewContext(fs.readFileSync(f, 'utf8'), sbx, { filename: f });
const WEAPONS = NV.WEAPONS;
const RARITY_COLORS = NV.RARITY_COLORS;
let pass = 0, fail = 0;
function t(d, fn) { try { fn(); pass++; console.log('  ok  ' + d); } catch (e) { fail++; console.log('  FAIL ' + d + ' -> ' + e.message); } }

const mockCtx = {
  __c: [],
  fillRect: function (x,y,w,h) { this.__c.push('F'+x.toFixed(0)+','+y.toFixed(0)+','+w+','+h); },
  strokeRect: function (x,y,w,h) { this.__c.push('S'+x.toFixed(0)+','+y.toFixed(0)+','+w+','+h); },
  fillText: function (t,x,y) { this.__c.push('T'+t.substring(0,10)+','+x.toFixed(0)+','+y.toFixed(0)); },
  beginPath: function(){}, arc: function(){}, stroke: function(){},
  save: function(){}, restore: function(){},
  font: '', fillStyle: '', globalAlpha: 1, shadowColor: '', shadowBlur: 0, textAlign: '', lineWidth: 1, lineCap: '',
};
const inv = [WEAPONS[3]];
const char = NV.CHARACTERS['boti'];
const player = { character: 'boti', specialCd: 0, agility: 0, maxCd: 4, luck: 0, armor: 0, speed: 0 };

// HUD sin consumibles
mockCtx.__c.length = 0;
NV.consumSlotRects = null;
NV.drawWeaponHUD(mockCtx, 800, 600, NV.CHARACTERS, RARITY_COLORS, player, WEAPONS[0], () => 1, inv, [], 0, true);
t('HUD sin consumibles: no crash + consumSlotRects vacio', () => {
  if (NV.consumSlotRects.length !== 0) throw new Error('debe estar vacio');
  if (!mockCtx.__c.some(c => c.startsWith('T'))) throw new Error('no dibujo nada');
});

// HUD con consumibles: rects alineados horizontalmente
const cons = [{type:'potion', icon:'p', count:3}, {type:'shield', icon:'s', count:1}];
mockCtx.__c.length = 0;
NV.consumSlotRects = null;
NV.drawWeaponHUD(mockCtx, 800, 600, NV.CHARACTERS, RARITY_COLORS, player, WEAPONS[0], () => 1, inv, NV.groupConsumables(cons), 0, true);
t('HUD con consumibles: 2 rects alineados en Y', () => {
  if (NV.consumSlotRects.length !== 2) throw new Error('esperaba 2, hay ' + NV.consumSlotRects.length);
  const r = NV.consumSlotRects[0];
  if (Math.abs(r.y - NV.consumSlotRects[1].y) > 0) throw new Error('no alineados horizontalmente');
  if (!mockCtx.__c.some(c => c.includes('F usar'))) throw new Error('falta hint F usar');
});

// slot 0 = pistola fija
mockCtx.__c.length = 0;
NV.drawWeaponHUD(mockCtx, 800, 600, NV.CHARACTERS, RARITY_COLORS, player, WEAPONS[0], () => 1, inv, [], 0, true);
const pistolCalls = mockCtx.__c.filter(c => c.startsWith('T') && c.includes(WEAPONS[0].emoji));
t('Slot 0 muestra la pistola inicial', () => {
  if (pistolCalls.length === 0) throw new Error('pistola no aparece en HUD');
});

// Combo en esquina sup-izquierda
mockCtx.__c.length = 0;
NV.drawCombo(mockCtx, 800, 600, { count: 4, timer: 1 });
t('Combo aparece en esquina superior izquierda (x<=50, y<=25)', () => {
  const first = mockCtx.__c.find(c => c.startsWith('T'));
  if (!first) throw new Error('no dibujo combo');
  const parts = first.split(',');
  const x = parseInt(parts[2]), y = parseInt(parts[3]);
  if (x > 50 || y > 25) throw new Error('combo en (' + x + ',' + y + ') no es esquina sup-izq');
});

// cycleIndex bidireccional
const groups = NV.groupConsumables(cons);
t('cycleIndex bidireccional Q/E', () => {
  if (NV.cycleIndex(0, groups.length, +1) !== 1) throw new Error('+1 fallo');
  if (NV.cycleIndex(0, groups.length, -1) !== 1) throw new Error('wrap -1 fallo');
});

// orden vertical verificado (armas antes que consumibles antes que habilidad)
mockCtx.__c.length = 0;
NV.drawWeaponHUD(mockCtx, 800, 600, NV.CHARACTERS, RARITY_COLORS, player, WEAPONS[0], () => 1, inv, NV.groupConsumables(cons), 0, true);
t('Orden vertical: armas header -> consumibles hint -> skill name', () => {
  const txtCalls = mockCtx.__c.filter(c => c.startsWith('T'));
  const idxArma = txtCalls.findIndex(c => c.includes(WEAPONS[0].name) || c.includes(WEAPONS[0].emoji));
  const idxCons = txtCalls.findIndex(c => c.includes('F usar'));
  const idxSkill = txtCalls.findIndex(c => c.includes(char.skillName) || c.includes(char.skillIcon));
  if (idxArma === -1 || idxCons === -1 || idxSkill === -1) throw new Error('falta alguna seccion');
  if (idxArma > idxCons || idxCons > idxSkill) throw new Error('orden incorrecto: arma='+idxArma+' cons='+idxCons+' skill='+idxSkill);
});

console.log('RESULT hud_v2: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
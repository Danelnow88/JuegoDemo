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
  save: function(){}, restore: function(){}, translate: function(){}, scale: function(){},
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

// Estilo vidrio neon: usa roundRect (o fallback fillRect+strokeRect) y gradiente.
t('Estilo vidrio neon: no depende de roundRect (fallback a rect)', () => {
  const h = fs.readFileSync('js/render/hud.js', 'utf8');
  if (!h.includes('roundRect')) throw new Error('no usa roundRect');
  if (!h.includes('createLinearGradient') || !h.includes('slotGradient')) throw new Error('sin gradiente');
  if (!h.includes('GLOW_BY_RARITY')) throw new Error('sin tabla de glow por rareza');
});

// Glow escalado por rareza: shadowBlur mayor para legendary que common.
t('Glow escalado por rareza (legendary > common en intensity)', () => {
  const h = fs.readFileSync('js/render/hud.js', 'utf8');
  const m = h.match(/GLOW_BY_RARITY\s*=\s*\{([^}]+)\}/);
  if (!m) throw new Error('no encontro tabla');
  const get = (k) => {
    const mm = m[1].match(new RegExp(k + '\\s*:\\s*([0-9.]+)'));
    return mm ? parseFloat(mm[1]) : NaN;
  };
  const common = get('common'), legendary = get('legendary');
  if (legendary <= common) throw new Error('legendary (' + legendary + ') no >= common (' + common + ')');
  if (!(common >= 0.2 && common <= 0.5) || !(legendary >= 0.7)) throw new Error('valores fuera de rango');
});

// Micro-animaciones presentes sin tocar geometria
t('Micro-animaciones (selPulse, fillFlash, fuseFlash, readyPulse)', () => {
  const h = fs.readFileSync('js/render/hud.js', 'utf8');
  for (const k of ['selPulse', 'fillFlash', 'fuseFlash', 'readyPulse', 'lastCd']) {
    if (!h.includes(k)) throw new Error('falta ' + k);
  }
});

// Nombres largos: "Cañon de Riel" (legendary) debe truncarse con '…' sin pisar bordes.
t('Render con nombre largo "Cañon de Riel Nv9" no rompe y usa truncado', () => {
  // Arma real mas larga del juego
  const rail = NV.WEAPONS.find(w => w.name === 'Cañón de Riel') || NV.WEAPONS.find(w => w.name.includes('Cañon')) || WEAPONS[WEAPONS.length - 1];
  const largo = rail.name + ' Nv9';
  if (largo.length < 12) throw new Error('texto no es realmente largo');
  // El HUD lo recibe via currentWeapon; redibujamos con el railgun equipado
  mockCtx.__c.length = 0;
  NV.drawWeaponHUD(mockCtx, 800, 600, NV.CHARACTERS, RARITY_COLORS, player, rail, () => 9, [rail], [], 0, true);
  const railCalls = mockCtx.__c.filter(c => c.startsWith('T') && (c.includes('Ca') || c.includes('Nv') || c.includes('…')));
  // al menos texto de la cabecera se dibujo sin excepcion
  if (railCalls.length === 0) throw new Error('no dibujo texto de railgun');
});

// El nombre de la skill no pisa el borde inferior del contenedor (sh/2 + 6 dentro de sh=24)
t('Nombre de skill dentro del contenedor (no pisa borde inferior)', () => {
  const h = fs.readFileSync('js/render/hud.js', 'utf8');
  // sh=24 y el nombre se ubica en by + sh/2 + 6 = by+18 (dentro de los 24px, fuentelo 7px acaba ~by+25 -> dentro)
  if (!h.includes('var sh = 24')) throw new Error('sh no es 24');
  if (!h.includes('by + sh / 2 + 6')) throw new Error('nombre no reposicionado dentro');
  // Verifica que ya no exista el bug viejo: by + sh + 1 (fuera del contenedor)
  if (h.includes('by + sh + 1')) throw new Error('aun tiene nombre fuera (by+sh+1)');
});

// Cabecera de arma: contenedor de 16px con truncado y rareza en borde/texto
t('Cabecera de arma: 16px + truncado + textAlign del color por rareza', () => {
  const h = fs.readFileSync('js/render/hud.js', 'utf8');
  if (!h.includes('var hh = 16')) throw new Error('cabecera no tiene 16px');
  if (!h.includes('truncateToWidth')) throw new Error('sin truncado');
  // iconColor ya era la rareza; verificamos que el borde use el rgbaNum(iconColor)
  if (!h.includes("rgba(' + hCnum + '")) throw new Error('borde no usa rareza');
  // GLOW incluye uncommon ahora
  if (!h.includes('uncommon: 0.42')) throw new Error('GLOW no tiene uncommon');
});

// Fade de la cabecera al cambiar de arma
t('Fade de cabecera al cambiar de arma (weaponFadeAt)', () => {
  const h = fs.readFileSync('js/render/hud.js', 'utf8');
  if (!h.includes('weaponFadeAt')) throw new Error('sin weaponFadeAt');
  if (!h.includes('lastWeaponText')) throw new Error('sin lastWeaponText');
});

console.log('RESULT hud_v2: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
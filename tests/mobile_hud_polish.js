const fs = require('fs');

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log('  ok  ' + name); }
  catch (error) { fail++; console.log('  FAIL ' + name + ' -> ' + error.message); }
}

const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('css/styles.css', 'utf8');
const game = fs.readFileSync('js/game.js', 'utf8');
const mobile = fs.readFileSync('js/ui/mobileControls.js', 'utf8');

t('mobile arma/item incluyen canvas de icono y etiqueta legible', () => {
  for (const id of ['weaponIndicatorIcon', 'weaponIndicatorName', 'consumableIndicatorIcon', 'consumableIndicatorName']) {
    if (!html.includes('id="' + id + '"')) throw new Error('falta ' + id);
  }
  if (!mobile.includes('NV.drawWeaponIcon(iconCtx')) throw new Error('arma no reutiliza drawWeaponIcon');
  if (!mobile.includes('NV.drawConsumableIcon(iconCtx')) throw new Error('item no reutiliza drawConsumableIcon');
});

t('arma/item mobile se apilan upper-right y liberan bottom-center', () => {
  if (!/\.nv-mobile \.mobile-weapon-switch,[\s\S]*right:\s*calc\(env\(safe-area-inset-right/.test(css)) throw new Error('switches no respetan safe-area derecha');
  if (!/\.nv-mobile \.mobile-weapon-switch\s*\{[\s\S]*top:\s*calc\(env\(safe-area-inset-top/.test(css)) throw new Error('arma no está bajo header/menu');
  if (!/\.nv-mobile \.mobile-consumable-switch\s*\{[\s\S]*top:\s*calc\(env\(safe-area-inset-top/.test(css)) throw new Error('item no está apilado bajo arma');
  if (!/\.nv-mobile \.mobile-weapon-switch,[\s\S]*bottom:\s*auto/.test(css)) throw new Error('bottom-center no fue liberado');
});

t('especial mobile integra progreso, segundos y estado listo', () => {
  if (!html.includes('id="touchSpecialStatus"')) throw new Error('falta estado integrado');
  if (!css.includes('conic-gradient(from -90deg')) throw new Error('falta anillo de progreso');
  if (!mobile.includes("style.setProperty('--special-progress'")) throw new Error('JS no publica progreso visual');
  if (!mobile.includes("ready ? 'LISTO'")) throw new Error('falta estado LISTO');
  if (!mobile.includes('Math.ceil(Math.max(0, info.remaining || 0))')) throw new Error('falta tiempo restante');
});

t('estado especial reutiliza cooldown existente sin cambiar valores ni activación', () => {
  if (!game.includes('remaining = Math.max(0, player.specialCd || 0)')) throw new Error('no lee specialCd existente');
  if (!game.includes('1 - remaining / max')) throw new Error('normalización de progreso inesperada');
  if (!game.includes('if (combatIntent.abilityIntent && player.specialCd <= 0) useSpecial();')) throw new Error('activación especial alterada');
  if (game.includes('player.specialCd = char.maxCd + 0.5;')) throw new Error('game.js no debe reasignar cooldown');
});

t('contador enemigo y combo quedan apilados upper-left en canvas', () => {
  if (!game.includes('viewY() + (mobilePresentation ? 58 : 43)')) throw new Error('contador no separa mobile/desktop upper-left');
  if (!game.includes("mobilePresentation ? { x: viewX() + 12, y: viewY() + 83 } : null")) throw new Error('combo mobile no queda bajo el contador');
  if (game.includes('ctx.fillText(countText, barX + barW + 8, barY + 10)')) throw new Error('contador superior-centro antiguo sigue activo');
});

t('desktop conserva la posición legacy del combo y sólo relocaliza enemigos', () => {
  const hud = fs.readFileSync('js/render/hud.js', 'utf8');
  if (!hud.includes('opts.x == null ? 10')) throw new Error('x legacy del combo desktop cambió');
  if (!hud.includes('opts.y == null ? 20')) throw new Error('y legacy del combo desktop cambió');
  if (!game.includes("mobilePresentation ? { x: viewX() + 12, y: viewY() + 83 } : null")) throw new Error('desktop no delega al default legacy');
});

t('switching e input especial conservan las rutas existentes', () => {
  for (const token of ['input.cycleWeapon(1)', 'input.cycleConsumable(1)', 'input.setSpecial && input.setSpecial(true)', 'input.setSpecial && input.setSpecial(false)']) {
    if (!mobile.includes(token)) throw new Error('ruta de input ausente: ' + token);
  }
});

console.log('RESULT mobile_hud_polish: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
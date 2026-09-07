const fs = require('fs');
let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; console.log('  ok  ' + name); } catch (e) { fail++; console.log('  FAIL ' + name + ' -> ' + e.message); } }
const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('css/styles.css', 'utf8');
const game = fs.readFileSync('js/game.js', 'utf8');

t('game over usa panel centrado reusable y una sola acción primaria', () => {
  if (!html.includes('class="game-over-panel"')) throw new Error('panel ausente');
  if ((html.match(/id="restartBtn"/g) || []).length !== 1) throw new Error('restart duplicado');
  if (!css.includes('.game-over-panel') || !css.includes('justify-content: center')) throw new Error('centrado estructural ausente');
});

t('settings abierto durante play usa pausa compartida', () => {
  if (!game.includes('NV.input.setSettingsOpen')) throw new Error('puente settings ausente');
  if (!game.includes('settingsRestorePaused = paused') || !game.includes('paused = true')) throw new Error('no pausa gameplay');
  if (!css.includes('html[data-settings-open="true"] .mobile-options')) throw new Error('opciones móviles no se ocultan');
});

t('HUD móvil evita duplicar panel canvas de arma/consumible', () => {
  if (!game.includes('if (!mobilePresentation) drawWeaponHUD()')) throw new Error('panel Canvas no se suprime en móvil');
  if (!game.includes('else NV.consumSlotRects = []')) throw new Error('hitboxes Canvas móviles quedan activas');
  if (!html.includes('id="mobileWeaponSwitch"') || !html.includes('id="mobileConsumableSwitch"')) throw new Error('región DOM dedicada ausente');
});

t('jerarquía HUD móvil separa info, menú y controles inferiores', () => {
  if (!css.includes('.nv-mobile[data-game-state="playing"] .hud .touch-options')) throw new Error('menú top-right ausente');
  if (!css.includes('.nv-mobile .mobile-weapon-switch { right: 50%')) throw new Error('arma no está en región inferior central');
  if (!css.includes('.nv-mobile .mobile-consumable-switch { left: 50%')) throw new Error('item no está en región inferior central');
});

t('lobby y game over ocultan controles de gameplay', () => {
  if (!css.includes('[data-game-state="menu"] .mobile-hud') || !css.includes('[data-game-state="gameover"] .mobile-hud')) throw new Error('visibilidad por estado incompleta');
});

console.log('RESULT ui_foundation: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
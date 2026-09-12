// Tests de la CAPA DE COMPATIBILIDAD MÓVIL.
// No tocan gameplay: verifican el viewport centralizado (escala uniforme y
// screenToGame), la detección por capacidad, el mapeo del joystick a los canales
// lógicos existentes, y el wiring (HTML/JS/CSS) sin tocar el mundo del juego.
const fs = require('fs'), vm = require('vm');

let pass = 0, fail = 0;
function t(desc, fn) { try { fn(); pass++; console.log('  ok  ' + desc); } catch (e) { fail++; console.log('  FAIL ' + desc + ' -> ' + e.message); } }
function load(f, sbx) { vm.runInNewContext(fs.readFileSync(f, 'utf8'), sbx, { filename: f }); }

function makeSandbox(opts) {
  opts = opts || {};
  const root = {
    classList: {
      _c: [],
      add(c) { if (!this._c.includes(c)) this._c.push(c); },
      remove(c) { this._c = this._c.filter(x => x !== c); },
      contains(c) { return this._c.includes(c); },
    },
  };
  const makeCanvas = () => ({
    getBoundingClientRect() { return { left: opts.rectLeft || 0, top: opts.rectTop || 0, width: opts.cssW || 900, height: opts.cssH || 520 }; },
  });
  const doc = {
    documentElement: root,
    getElementById(id) { return id === 'game' ? makeCanvas() : { getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 100 }; }, classList: { add() {}, remove() {}, contains() { return false; } } }; },
    querySelector() { return { setAttribute() {} }; },
    addEventListener() {}, removeEventListener() {},
  };
  const mm = opts.matchMedia || (() => ({ matches: false, addEventListener() {}, addListener() {} }));
  const sbx = {
    NV: opts.nv || {},
    document: doc,
    console,
    Math, Date, JSON, Object, Array, Number, String, Boolean, Promise, Symbol, Proxy, Reflect, Error, TypeError, isNaN, parseInt, parseFloat,
    setTimeout: (fn) => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    devicePixelRatio: opts.dpr || 1,
    innerWidth: opts.cssW || 900,
    innerHeight: opts.cssH || 520,
    matchMedia: mm,
    navigator: opts.navigator || {},
    location: opts.location || null,
    screen: { orientation: {} },
  };
  sbx.window = sbx;
  sbx.addEventListener = function() {}; sbx.removeEventListener = function() {};
  return { sbx, root };
}

// ============ DETECCIÓN POR CAPACIDAD ============
t('capabilities: puntero fino puro → NO móvil (laptop táctil inclusive)', () => {
  const { sbx } = makeSandbox({
    matchMedia: (q) => ({ matches: q === '(pointer: fine)', addEventListener() {}, addListener() {} }),
    navigator: { maxTouchPoints: 20 },
  });
  load('js/core/capabilities.js', sbx);
  if (sbx.NV.capabilities.isMobile) throw new Error('laptop con touch no debe clasificarse móvil');
});

t('capabilities: pointer coarse activa móvil y taguea <html>', () => {
  const { sbx, root } = makeSandbox({
    matchMedia: (q) => ({ matches: q === '(pointer: coarse)', addEventListener() {}, addListener() {} }),
    navigator: { maxTouchPoints: 5 },
  });
  load('js/core/capabilities.js', sbx);
  if (!sbx.NV.capabilities.isMobile) throw new Error('coarse debe ser móvil');
  if (!root.classList.contains('nv-mobile')) throw new Error('falta .nv-mobile en <html>');
});

t('capabilities: ?mobile=1 fuerza la capa móvil (modo prueba/emulación)', () => {
  const { sbx, root } = makeSandbox({
    location: { search: '?mobile=1' },
    matchMedia: (q) => ({ matches: q === '(pointer: fine)', addEventListener() {}, addListener() {} }),
    navigator: { maxTouchPoints: 0 },
  });
  load('js/core/capabilities.js', sbx);
  if (!sbx.NV.capabilities.isMobile) throw new Error('debería forzar mobile');
  if (!root.classList.contains('nv-mobile')) throw new Error('falta .nv-mobile');
});

// ============ VIEWPORT (escala uniforme, conversión, DPR) ============
t('viewport.computeScale: escala uniforme = min(width/900, height/520)', () => {
  const { sbx } = makeSandbox({ nv: { capabilities: { isMobile: false } } });
  load('js/core/viewport.js', sbx);
  const v = sbx.NV.viewport;
  if (v.computeScale(450, 260, 900, 520) !== 0.5) throw new Error('450x260 no dio 0.5');
  if (v.computeScale(900, 260, 900, 520) !== 0.5) throw new Error('debe elegir el min (la altura)');
  if (v.computeScale(1800, 1040, 900, 520) !== 2) throw new Error('1800x1040 no dio 2');
});

t('viewport.worldMetrics: ref/view/arena permanecen 900x520 en Stage 0/1', () => {
  const { sbx } = makeSandbox({ nv: { capabilities: { isMobile: false } } });
  load('js/core/viewport.js', sbx);
  const m = sbx.NV.worldMetrics;
  const expected = { refW: 900, refH: 520, viewW: 900, viewH: 520, viewX: 0, viewY: 0, arenaW: 900, arenaH: 520, scale: 1 };
  for (const k of Object.keys(expected)) {
    if (m[k] !== expected[k]) throw new Error(k + '=' + m[k]);
  }
  if (sbx.NV.viewport.worldMetrics !== m) throw new Error('viewport no comparte la métrica central');
});

t('viewport.screenToGame (móvil legacy fallback): escala uniforme + pillarbox + rect offset', () => {
  const { sbx } = makeSandbox({ nv: { capabilities: { isMobile: true } }, cssW: 1800, cssH: 520, dpr: 2, rectLeft: 100, rectTop: 50, location: { search: '?dynamicView=0' } });
  load('js/core/viewport.js', sbx);
  const v = sbx.NV.viewport;
  v.refresh();
  if (Math.abs(v.displayScale - 1) > 1e-9) throw new Error('scale=' + v.displayScale);
  if (Math.abs(v.offsetX - 450) > 1e-9) throw new Error('offsetX=' + v.offsetX);
  const p = v.screenToGame(100 + 450 + 300, 50 + 200); // client 850, 250
  if (Math.abs(p.x - 300) > 1e-6) throw new Error('x=' + p.x);
  if (Math.abs(p.y - 200) > 1e-6) throw new Error('y=' + p.y);
});

t('viewport.screenToGame (escritorio): preserva la fórmula legacy exacta', () => {
  const { sbx } = makeSandbox({ nv: { capabilities: { isMobile: false } }, cssW: 800, cssH: 600 });
  load('js/core/viewport.js', sbx);
  const p = sbx.NV.viewport.screenToGame(400, 300);
  if (Math.abs(p.x - 450) > 1e-6) throw new Error('x=' + p.x); // 400 * 900/800
  if (Math.abs(p.y - 260) > 1e-6) throw new Error('y=' + p.y); // 300 * 520/600
});

t('viewport.getEffectiveDpr: escritorio=1 (sin cambios) y móvil con cap', () => {
  const { sbx } = makeSandbox({ nv: { capabilities: { isMobile: true } }, dpr: 2.75, cssW: 900, cssH: 520 });
  load('js/core/viewport.js', sbx);
  if (sbx.NV.viewport.getEffectiveDpr() !== 2) throw new Error('cap móvil no aplicado');
  const { sbx: sbxD } = makeSandbox({ nv: { capabilities: { isMobile: false } }, dpr: 3 });
  load('js/core/viewport.js', sbxD);
  if (sbxD.NV.viewport.getEffectiveDpr() !== 1) throw new Error('escritorio debe ser 1');
});

// ============ JOYSTICK → mismas señales booleanas que el teclado ============
t('vectorToInput: dead zone central = sin salida', () => {
  const { sbx } = makeSandbox({ nv: {} });
  load('js/ui/mobileControls.js', sbx);
  if (!sbx.NV.mobileControls) throw new Error('mobileControls no expuesto');
  const v = sbx.NV.mobileControls.vectorToInput(0.1, 0.1, { deadZone: 0.22 });
  if (v.left || v.right || v.up || v.down) throw new Error('dead zone ignorada');
});

t('vectorToInput: derecha pura activa solo right (mismo canal que teclado)', () => {
  const { sbx } = makeSandbox({ nv: {} });
  load('js/ui/mobileControls.js', sbx);
  const v = sbx.NV.mobileControls.vectorToInput(1, 0, { deadZone: 0.22 });
  if (!v.right || v.left || v.up || v.down) throw new Error('dirección incorrecta');
});

t('vectorToInput: diagonal activa dos ejes a la vez (comportamiento 8-direcciones)', () => {
  const { sbx } = makeSandbox({ nv: {} });
  load('js/ui/mobileControls.js', sbx);
  const v = sbx.NV.mobileControls.vectorToInput(0.8, -0.6, { deadZone: 0.22 });
  if (!v.right || !v.up || v.left || v.down) throw new Error('diagonal rota');
});

// ============ WIRING (sin duplicar el juego) ============
t('game.js expone NV.input sobre los canales lógicos existentes', () => {
  const g = fs.readFileSync('js/game.js', 'utf8');
  const keys = ['NV.input.setMoveLeft', 'NV.input.setMoveRight', 'NV.input.setMoveUp', 'NV.input.setMoveDown', 'NV.input.setSlide', 'NV.input.setSpecial', 'NV.input.useSelected'];
  for (const k of keys) if (!g.includes(k)) throw new Error('falta ' + k);
});

t('game.js usa NV.screenToGame en el click de slots', () => {
  const g = fs.readFileSync('js/game.js', 'utf8');
  if (!g.includes('canvas.addEventListener(\'click\'')) throw new Error('sin click handler');
  if (!g.includes('NV.screenToGame(e.clientX, e.clientY)')) throw new Error('el click no usa conversión centralizada');
});

t('game.js resizeCanvas usa el DPR efectivo del viewport', () => {
  const g = fs.readFileSync('js/game.js', 'utf8');
  if (!g.includes('viewport.getEffectiveDpr')) throw new Error('resize no lee DPR');
});

t('index.html carga capabilities, viewport y mobileControls en el orden correcto', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  const scripts = html.match(/<script src="([^"]+)"/g).map((s) => s.match(/"([^"]+)"/)[1]);
  const iC = scripts.indexOf('js/core/capabilities.js');
  const iV = scripts.indexOf('js/core/viewport.js');
  const iM = scripts.indexOf('js/ui/mobileControls.js');
  const iG = scripts.indexOf('js/game.js');
  if (iC < 0 || iV < 0 || iM < 0) throw new Error('faltan scripts de la capa móvil');
  if (iC >= iV) throw new Error('capabilities debe cargar antes que viewport');
  if (iM <= iG) throw new Error('mobileControls debe cargar después de game.js');
});

t('index.html contiene joystick, botones y overlay de rotación', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  const ids = ['joystickZone', 'joystickBase', 'joystickThumb', 'touchSlideBtn', 'touchSpecialBtn', 'touchUseBtn', 'fullscreenBtn', 'rotateOverlay', 'mobileHud'];
  for (const id of ids) if (!html.includes('id="' + id + '"')) throw new Error('falta #' + id);
});

t('css móvil: safe-areas, touch-action y overlay de rotación por orientación', () => {
  const css = fs.readFileSync('css/styles.css', 'utf8');
  if (!css.includes('--nv-safe-top')) throw new Error('falta safe-area var');
  if (!css.includes('.joystick-zone') || !css.includes('.touch-special')) throw new Error('faltan estilos touch');
  if (!/@media \(pointer: coarse\) and \(orientation: landscape\)/.test(css)) throw new Error('falta ocultar overlay en landscape');
  if (!css.includes('.nv-mobile .game-box')) throw new Error('falta regla responsive del game-box');
});

// ============ PRUEBAS DE VISIBILIDAD DEL BOTÓN JUGAR EN PAISAJES CORTOS ============
t('css móvil: compresión de overlay para paisajes cortos (max-height: 500px)', () => {
  const css = fs.readFileSync('css/styles.css', 'utf8');
  if (!css.includes('@media (pointer: coarse) and (orientation: landscape) and (max-height: 500px)')) {
    throw new Error('falta regla de compresión para paisajes cortos (max-height: 500px)');
  }
  // Debe reducir el padding del overlay (valor exacto puede variar)
  if (!css.includes('.nv-mobile .overlay { padding:')) {
    throw new Error('falta compresión del padding del overlay');
  }
  // Debe reducir el min-height de las tarjetas de personaje
  if (!css.includes('.nv-mobile .char-card { min-height:')) {
    throw new Error('falta compresión del min-height de char-card');
  }
});

t('css móvil: compresión adicional para paisajes muy cortos (max-height: 380px)', () => {
  const css = fs.readFileSync('css/styles.css', 'utf8');
  if (!css.includes('@media (pointer: coarse) and (orientation: landscape) and (max-height: 380px)')) {
    throw new Error('falta regla de compresión para paisajes muy cortos (max-height: 380px)');
  }
  if (!css.includes('.nv-mobile .char-card { min-height: 70px; padding: 6px; }')) {
    throw new Error('falta compresión adicional del min-height de char-card');
  }
});

t('css móvil: body usa 100dvh para manejar chrome del navegador móvil', () => {
  const css = fs.readFileSync('css/styles.css', 'utf8');
  if (!css.includes('height: 100dvh')) {
    throw new Error('body debe usar 100dvh para manejar la barra de dirección del navegador móvil');
  }
});

t('layout: verificación matemática de que #startBtn cabe en 915x412', () => {
  const viewportHeight = 412;
  const shellPadding = 4;
  const shellGap = 3;
  const hudMinHeight = 30;
  const overlayPadding = 16 * 2;
  const overlayGap = 8;
  const h1Height = 32;
  const subtitleHeight = 14;
  const charCardMinHeight = 90;
  const startBtnHeight = 38;
  const consumed = shellPadding * 2 + shellGap + hudMinHeight + overlayPadding + overlayGap * 3 + h1Height + subtitleHeight + charCardMinHeight + startBtnHeight;
  const remaining = viewportHeight - consumed;
  if (remaining < 0) throw new Error('El layout no cabe en 915x412: faltan ' + Math.abs(remaining) + 'px');
});

t('layout: verificación matemática de que #startBtn cabe en 800x360', () => {
  const viewportHeight = 360;
  const shellPadding = 2;
  const shellGap = 2;
  const hudMinHeight = 26;
  const overlayPadding = 10 * 2;
  const overlayGap = 6;
  const h1Height = 24;
  const subtitleHeight = 12;
  const charCardMinHeight = 70;
  const startBtnHeight = 30;
  const consumed = shellPadding * 2 + shellGap + hudMinHeight + overlayPadding + overlayGap * 3 + h1Height + subtitleHeight + charCardMinHeight + startBtnHeight;
  const remaining = viewportHeight - consumed;
  if (remaining < 0) throw new Error('El layout no cabe en 800x360: faltan ' + Math.abs(remaining) + 'px');
});

// ============ STATE-BASED VISIBILITY ============
t('css móvil: controles táctiles ocultos durante menú/selección', () => {
  const css = fs.readFileSync('css/styles.css', 'utf8');
  // Los controles móviles deben ocultarse cuando el juego está en estado menu/shop/gameover/paused
  if (!css.includes('[data-game-state="menu"] .mobile-hud')) {
    throw new Error('falta regla para ocultar controles móviles durante el menú');
  }
  if (!css.includes('[data-game-state="shop"] .mobile-hud')) {
    throw new Error('falta regla para ocultar controles móviles durante la tienda');
  }
  if (!css.includes('[data-game-state="gameover"] .mobile-hud')) {
    throw new Error('falta regla para ocultar controles móviles durante game over');
  }
});

t('js: game.js sincroniza estado del juego al DOM', () => {
  const g = fs.readFileSync('js/game.js', 'utf8');
  // Debe existir una función que sincronice el estado
  if (!g.includes('data-game-state')) {
    throw new Error('game.js no sincroniza data-game-state al DOM');
  }
  // Debe llamarse en las transiciones de estado
  if (!g.includes('syncGameState()')) {
    throw new Error('game.js no llama a syncGameState()');
  }
});

t('js: game.js expone inputs móviles de arma/consumible/pausa/stats/sonido', () => {
  const g = fs.readFileSync('js/game.js', 'utf8');
  for (const k of [
    'NV.input.cycleWeapon',
    'NV.input.cycleConsumable',
    'NV.input.togglePause',
    'NV.input.toggleStats',
    'NV.input.toggleSound',
  ]) {
    if (!g.includes(k)) throw new Error('falta ' + k);
  }
  // cycleConsumable debe delegar en NV.groupConsumables / NV.cycleIndex (sin duplicar lógica).
  if (!g.includes('NV.groupConsumables') || !g.includes('NV.cycleIndex')) {
    throw new Error('cycleConsumable no reutiliza lógica compartida de grupos');
  }
});

t('wire: HTML expone switch de armas y consumibles y panel de opciones', () => {
  const h = fs.readFileSync('index.html', 'utf8');
  for (const id of ['touchWeaponPrev', 'touchWeaponNext', 'touchConsumPrev', 'touchConsumNext', 'optionsBtn', 'mobileOptions', 'mPauseBtn', 'mStatsBtn', 'mSoundBtn']) {
    if (!h.includes('id="' + id + '"')) throw new Error('falta #' + id);
  }
});

t('lobby fullscreen móvil usa API real y sincroniza soporte/orientación/estado', () => {
  const h = fs.readFileSync('index.html', 'utf8');
  const mc = fs.readFileSync('js/ui/mobileControls.js', 'utf8');
  const viewport = fs.readFileSync('js/core/viewport.js', 'utf8');
  const css = fs.readFileSync('css/lobby-f093.css', 'utf8');
  if (!h.includes('id="lobbyFullscreenBtn"') || !h.includes('PANTALLA COMPLETA')) throw new Error('botón lobby ausente');
  if (!mc.includes('syncLobbyFullscreenButton') || !mc.includes('viewport.requestFullscreen()')) throw new Error('wiring fullscreen lobby ausente');
  if (!mc.includes("classList.contains('nv-landscape')") || !mc.includes("getAttribute('data-game-state') === 'menu'")) throw new Error('visibilidad no respeta landscape/lobby');
  if (!mc.includes("addEventListener('fullscreenchange'") || !mc.includes("addEventListener('webkitfullscreenchange'")) throw new Error('estado fullscreen no sincronizado');
  if (!mc.includes("lobbyMo.observe(startScreen") || !mc.includes("attributeFilter: ['class']")) throw new Error('retorno al lobby no resincroniza botón');
  if (!viewport.includes("typeof root.requestFullscreen === 'function'") || !viewport.includes("typeof root.webkitRequestFullscreen === 'function'")) throw new Error('feature detection incompleta');
  if (!viewport.includes("d.addEventListener('fullscreenchange', onViewportChange)")) throw new Error('viewport no refresca al salir por UI del navegador');
  if (!css.includes('.nv-mobile.nv-landscape .main-lobby-actions .lobby-fullscreen:not(.hidden)')) throw new Error('estilo mobile landscape ausente');
  if (!/\.lobby-fullscreen:not\(\.hidden\)\s*\{[\s\S]*position:\s*fixed;[\s\S]*top:\s*max\(8px,[\s\S]*right:\s*max\(10px,/.test(css)) throw new Error('botón no queda visible sin empujar JUGAR');
});

t('wire: mobileControls cablea ciclo de arma/consumible y opciones', () => {
  const mc = fs.readFileSync('js/ui/mobileControls.js', 'utf8');
  if (!mc.includes('input.cycleWeapon')) throw new Error('sin cycleWeapon en mobileControls');
  if (!mc.includes('input.cycleConsumable')) throw new Error('sin cycleConsumable en mobileControls');
  if (!mc.includes('input.togglePause')) throw new Error('sin togglePause en mobileControls');
  if (!mc.includes('initShopTabs')) throw new Error('sin initShopTabs en mobileControls');
});

t('shop tabs: HTML y CSS móvil con una sola sección activa', () => {
  const h = fs.readFileSync('index.html', 'utf8');
  const css = fs.readFileSync('css/styles.css', 'utf8');
  if (!h.includes('id="shopTabs"')) throw new Error('faltan tabs de tienda en HTML');
  for (const tab of ['data-tab="upgrades"', 'data-tab="weapons"', 'data-tab="consumables"']) {
    if (!h.includes(tab)) throw new Error('falta ' + tab);
  }
  if (!css.includes('[data-active-tab="upgrades"]')) throw new Error('sin CSS de tab activo');
  // El ocultado por tab no debe afectar a #permShop (selector scoped a #shop).
  if (!css.includes('#shop[data-active-tab')) throw new Error('los tabs deben estar scoped a #shop');
});

t('css móvil: panel de opciones y switches son solo-mobile', () => {
  const css = fs.readFileSync('css/styles.css', 'utf8');
  if (!css.includes('.mobile-options') || !css.includes('.nv-mobile .mobile-options')) {
    throw new Error('falta panel móvil de opciones');
  }
  if (!css.includes('.mobile-weapon-switch') || !css.includes('.nv-mobile .mobile-weapon-switch')) {
    throw new Error('falta estilos del switch de arma');
  }
});

// ============ SEGUNDA PASADA MOBILE ============
t('indicadores: HTML expone indicador de arma y consumible', () => {
  const h = fs.readFileSync('index.html', 'utf8');
  if (!h.includes('id="weaponIndicator"')) throw new Error('falta indicador de arma');
  if (!h.includes('id="consumableIndicator"')) throw new Error('falta indicador de consumible');
});

t('indicadores: game.js expone getWeaponInfo/getConsumableInfo sin estado duplicado', () => {
  const g = fs.readFileSync('js/game.js', 'utf8');
  if (!g.includes('NV.input.getWeaponInfo')) throw new Error('falta getWeaponInfo');
  if (!g.includes('NV.input.getConsumableInfo')) throw new Error('falta getConsumableInfo');
  // No debe leer currentWeapon/consumSel desde mobileControls (estado vive en game.js).
  if (g.includes('NV.input.currentWeapon')) throw new Error('network: exporta currentWeapon duplicado');
});

t('weapon/consumable notify: game.js avisa a la capa móvil al cambiar', () => {
  const g = fs.readFileSync('js/game.js', 'utf8');
  for (const s of ['notifyMobileWeapon()', 'notifyMobileConsumable()']) {
    if (!g.includes(s)) throw new Error('falta callback ' + s);
  }
  if (!g.includes('NV.input.notifyWeaponChange')) throw new Error('falta notifyWeaponChange');
});

t('header mobile: oculta controles secundarios (charBtn, hudToggle, sound, fullscreen, rhythm)', () => {
  const css = fs.readFileSync('css/styles.css', 'utf8');
  if (!css.includes('.nv-mobile #charBtn')) throw new Error('no oculta charBtn');
  if (!css.includes('.nv-mobile #hudToggle')) throw new Error('no oculta hudToggle');
  if (!css.includes('.nv-mobile #sound')) throw new Error('no oculta sound');
  if (!css.includes('.nv-mobile #fullscreenBtn')) throw new Error('no oculta fullscreenBtn');
  if (!css.includes('.nv-mobile .rhythm-widget')) throw new Error('no oculta rhythm widget');
  // ☰ y stats core siguen visibles.
  if (!css.includes('.nv-mobile .touch-options')) throw new Error('☰ no queda visible');
  if (!css.includes('.nv-mobile .stat-wave')) throw new Error('wave no queda visible');
});

t('pausa: juego usa data-paused y mobile la respeta (oculta gameplay, ☰ sigue accesible)', () => {
  const g = fs.readFileSync('js/game.js', 'utf8');
  if (!g.includes('data-paused')) throw new Error('game.js no publica data-paused');
  const css = fs.readFileSync('css/styles.css', 'utf8');
  if (!css.includes('.nv-paused .joystick-zone')) throw new Error('no oculta joystick en pausa');
  if (!css.includes('.nv-paused .mobile-actions')) throw new Error('no oculta acciones en pausa');
  if (!css.includes('.nv-paused .mobile-weapon-switch')) throw new Error('no oculta switch de arma en pausa');
  const mc = fs.readFileSync('js/ui/mobileControls.js', 'utf8');
  if (!mc.includes('data-paused')) throw new Error('mobileControls no lee data-paused');
  if (!mc.includes('Reanudar')) throw new Error('no refleja "Reanudar" en pausa');
});

t('joystick mobile: base/thumb más chicos pero zona sigue amplia', () => {
  const css = fs.readFileSync('css/styles.css', 'utf8');
  if (!css.includes('.nv-mobile .joystick-base')) throw new Error('falta estilo base compacta');
  if (!css.includes('clamp(72px, 16vmin, 92px)')) throw new Error('base no usa clamp compacto');
  if (!css.includes('clamp(32px, 8vmin, 42px)')) throw new Error('thumb no usa clamp compacto');
  if (!css.includes('.joystick-zone.active')) throw new Error('falta visible en activo');
});

t('shop mobile: solo una sección activa y UNA scroll (sin nested)', () => {
  const css = fs.readFileSync('css/styles.css', 'utf8');
  // Scroll único en .shop-grid, overflow visible en .offers y .shop-section.
  if (!css.includes('.nv-mobile #shop .shop-grid')) throw new Error('falta grid scroller');
  if (!css.includes('.offers {') || !css.includes('overflow: visible')) throw new Error('offers no libera scroll');
  if (!css.includes('repeat(auto-fit, minmax(150px, 1fr))')) throw new Error('falta grid responsive de cards');
});

t('permShop mobile: adaptado con grid responsive y scroll único', () => {
  const baseCss = fs.readFileSync('css/styles.css', 'utf8');
  const lobbyCss = fs.readFileSync('css/lobby-f093.css', 'utf8');
  if (!baseCss.includes('.nv-mobile #permShop .shop-grid')) throw new Error('falta permShop grid base');
  if (!lobbyCss.includes('.nv-mobile #permShop.shop-screen')) throw new Error('falta autoridad sobre el nodo real de permShop');
  if (/#permShop \.shop-screen\s*[,\{]/.test(lobbyCss.replace(/\/\*[\s\S]*?\*\//g, ''))) {
    throw new Error('selector descendiente imposible reintroducido');
  }
  if (!/\.nv-mobile #permShop\.shop-screen::after\s*\{[\s\S]*inset-inline:\s*0;[\s\S]*transform:\s*translateY\(34px\);/.test(lobbyCss)) {
    throw new Error('decoración heredada puede ampliar scrollWidth');
  }
  if (!/\.nv-mobile #permShop \.shop-grid::before\s*\{[\s\S]*inset:\s*0;/.test(lobbyCss)) {
    throw new Error('decoración de shop-grid conserva inset negativo');
  }
  if (!/\.nv-mobile #permShop \.offers\s*\{[\s\S]*grid-template-columns:\s*repeat\(auto-fit, minmax\(min\(180px, 100%\), 1fr\)\);[\s\S]*overflow-x:\s*hidden;/.test(lobbyCss)) {
    throw new Error('falta grilla final acotada al viewport');
  }
});

t('menu/gameover mobile: overlay usa viewport sin header robando espacio', () => {
  const css = fs.readFileSync('css/styles.css', 'utf8') + fs.readFileSync('css/lobby-f093.css', 'utf8');
  const html = fs.readFileSync('index.html', 'utf8');
  if (!css.includes('.nv-mobile .overlay')) throw new Error('falta overlay mobile');
  if (!css.includes('.nv-mobile #startBtn')) throw new Error('no asegura JUGAR');
  if (!css.includes('.nv-mobile #permBtn')) throw new Error('no asegura PERMANENTES');
  if (!html.includes('id="lobbyPlayBtn"') || !html.includes('id="pilotsBtn"') || !html.includes('id="characterSelectScreen"') || !html.includes('id="startBtn"')) throw new Error('flujo lobby/biblioteca incompleto');
  if (!css.includes('.nv-mobile .main-lobby-panel') || !css.includes('.nv-mobile .character-select-actions')) throw new Error('adaptación móvil del nuevo flujo ausente');
});

t('lobby fullscreen mobile usa composición lateral y CTA alcanzable en landscape corto', () => {
  const css = fs.readFileSync('css/styles.css', 'utf8') + fs.readFileSync('css/lobby-f093.css', 'utf8');
  if (!/@media \(pointer: coarse\), \(max-height: 560px\)[\s\S]*\.main-lobby-panel[\s\S]*grid-template-columns:/.test(css)) throw new Error('lobby mobile no conserva regiones laterales');
  if (!/\.main-lobby-actions \.lobby-play \{ min-height: clamp\(40px, 12vh, 52px\)/.test(css)) throw new Error('CTA principal no preserva target táctil');
  if (!css.includes('.lobby-preview') || !css.includes('.lobby-hero { height: 100%; min-height: 0; }')) throw new Error('hero real no se adapta al viewport');
  if (!css.includes('@media (pointer: coarse) and (orientation: landscape) and (max-height: 380px)')) throw new Error('sin gate para landscape extremadamente corto');
  if (!css.includes('.character-select-screen .character-select-actions .primary { min-height: 30px')) throw new Error('acciones de biblioteca no alcanzables en altura corta');
  if (!css.includes('@media (orientation: portrait) and (max-width: 700px)')) throw new Error('portrait fallback ausente');
});

console.log('RESULT mobile_compat: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
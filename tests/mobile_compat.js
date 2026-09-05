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

t('viewport.screenToGame (móvil): escala uniforme + pillarbox + rect offset', () => {
  const { sbx } = makeSandbox({ nv: { capabilities: { isMobile: true } }, cssW: 1800, cssH: 520, dpr: 2, rectLeft: 100, rectTop: 50 });
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

console.log('RESULT mobile_compat: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
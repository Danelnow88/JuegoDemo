const fs = require('fs');
const vm = require('vm');

let pass = 0, fail = 0;
function t(desc, fn) {
  try { fn(); pass++; console.log('  ok  ' + desc); }
  catch (e) { fail++; console.log('  FAIL ' + desc + ' -> ' + e.message); }
}
function load(f, sbx) { vm.runInNewContext(fs.readFileSync(f, 'utf8'), sbx, { filename: f }); }
function near(actual, expected, label, eps) {
  eps = eps == null ? 1e-6 : eps;
  if (Math.abs(actual - expected) > eps) throw new Error(label + '=' + actual + ' expected ' + expected);
}

function makeSandbox(opts) {
  opts = opts || {};
  const classes = [];
  const root = {
    classList: {
      add(c) { if (!classes.includes(c)) classes.push(c); },
      remove(c) { const i = classes.indexOf(c); if (i >= 0) classes.splice(i, 1); },
      contains(c) { return classes.includes(c); },
    },
  };
  const canvas = {
    getBoundingClientRect() {
      return {
        left: opts.rectLeft || 0,
        top: opts.rectTop || 0,
        width: opts.cssW || 900,
        height: opts.cssH || 520,
      };
    },
  };
  const doc = {
    documentElement: root,
    getElementById(id) { return id === 'game' ? canvas : null; },
    addEventListener() {}, removeEventListener() {},
  };
  const sbx = {
    NV: opts.nv || {},
    window: null,
    document: doc,
    console,
    Math, Date, JSON, Object, Array, Number, String, Boolean, Promise, Symbol, Proxy, Reflect, Error, TypeError, isNaN, parseInt, parseFloat,
    setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    devicePixelRatio: opts.dpr || 1,
    innerWidth: opts.cssW || 900,
    innerHeight: opts.cssH || 520,
    location: { search: opts.search || '' },
    screen: { orientation: {} },
    addEventListener() {}, removeEventListener() {},
  };
  sbx.window = sbx;
  return { sbx, root };
}

function loadViewport(opts) {
  const made = makeSandbox(opts);
  load('js/core/viewport.js', made.sbx);
  return made;
}

t('mobile landscape sin query activa dynamic view por defecto', () => {
  const { sbx, root } = loadViewport({ nv: { capabilities: { isMobile: true, orientation: 'landscape' } }, cssW: 915, cssH: 412 });
  const m = sbx.NV.worldMetrics;
  if (!sbx.NV.viewport.dynamicViewActive) throw new Error('dynamicViewActive=false');
  near(m.viewW, 520 * (915 / 412), 'viewW'); near(m.viewH, 520, 'viewH');
  near(m.arenaW, m.viewW, 'arenaW'); near(m.arenaH, 520, 'arenaH');
  if (!root.classList.contains('nv-dynamic-view')) throw new Error('clase dinámica no activa por defecto');
});

t('915x412 dynamic default: viewH=520 y viewW≈1154.85', () => {
  const { sbx } = loadViewport({ nv: { capabilities: { isMobile: true, orientation: 'landscape' } }, cssW: 915, cssH: 412 });
  const m = sbx.NV.worldMetrics;
  near(m.viewH, 520, 'viewH');
  near(m.viewW, 520 * (915 / 412), 'viewW');
});

t('view empieza en 0 porque la arena dinámica ya ocupa todo el visible', () => {
  const { sbx } = loadViewport({ nv: { capabilities: { isMobile: true, orientation: 'landscape' } }, cssW: 915, cssH: 412 });
  const m = sbx.NV.worldMetrics;
  near(m.viewX, 0, 'viewX');
  near(m.viewY, 0, 'viewY');
});

t('arena/view center dinámico mapea al centro físico', () => {
  const { sbx } = loadViewport({ nv: { capabilities: { isMobile: true, orientation: 'landscape' } }, cssW: 915, cssH: 412 });
  const p = sbx.NV.gameToScreen(sbx.NV.worldMetrics.arenaW / 2, 260);
  near(p.x, 915 / 2, 'screenX');
  near(p.y, 412 / 2, 'screenY');
});

t('screen left edge mapea a world x=viewX', () => {
  const { sbx } = loadViewport({ nv: { capabilities: { isMobile: true, orientation: 'landscape' } }, cssW: 915, cssH: 412 });
  const p = sbx.NV.screenToGame(0, 206);
  near(p.x, sbx.NV.worldMetrics.viewX, 'worldX');
});

t('screen right edge mapea a world x=viewX+viewW', () => {
  const { sbx } = loadViewport({ nv: { capabilities: { isMobile: true, orientation: 'landscape' } }, cssW: 915, cssH: 412 });
  const p = sbx.NV.screenToGame(915, 206);
  const m = sbx.NV.worldMetrics;
  near(p.x, m.viewX + m.viewW, 'worldX');
});

t('screenToGame/gameToScreen round trip en dynamic', () => {
  const { sbx } = loadViewport({ nv: { capabilities: { isMobile: true, orientation: 'landscape' } }, cssW: 844, cssH: 390, rectLeft: 7, rectTop: 11 });
  const a = sbx.NV.screenToGame(321, 222);
  const b = sbx.NV.gameToScreen(a.x, a.y);
  near(b.x, 321, 'x');
  near(b.y, 222, 'y');
});

t('scaleX≈scaleY por fórmula uniforme', () => {
  const { sbx } = loadViewport({ nv: { capabilities: { isMobile: true, orientation: 'landscape' } }, cssW: 640, cssH: 360 });
  const m = sbx.NV.worldMetrics;
  near(640 / m.viewW, 360 / m.viewH, 'scale');
  near(m.scale, 360 / 520, 'metrics.scale');
});

t('gameplay arena matches dynamic view', () => {
  const { sbx } = loadViewport({ nv: { capabilities: { isMobile: true, orientation: 'landscape' } }, cssW: 915, cssH: 412 });
  near(sbx.NV.worldMetrics.arenaW, 520 * (915 / 412), 'arenaW');
  near(sbx.NV.worldMetrics.arenaH, 520, 'arenaH');
});

t('boss center uses runtime arena center', () => {
  const g = fs.readFileSync('js/game.js', 'utf8');
  if (!g.includes('bossCandidate = { x: arenaW()/2, y: 100')) throw new Error('boss center no usa arenaW()/2');
  if (g.includes('boss = { x: viewW()/2')) throw new Error('boss usa view center');
});

t('enemy spawn dimensions use runtime arena W/H', () => {
  const g = fs.readFileSync('js/game.js', 'utf8');
  if (!g.includes('function arenaW()')) throw new Error('arenaW accessor ausente');
  if (!g.includes('NV.spawnEnemy({ enemies, boss, MAX_HOSTILES, MAX_HEAVY_HOSTILES, wave, ENEMY_TYPES, W: arenaW(), H: arenaH()')) throw new Error('spawnEnemy no recibe arena runtime W/H');
});

t('projectile bounds use runtime arena W/H', () => {
  const g = fs.readFileSync('js/game.js', 'utf8');
  if (!g.includes('NV.updateBullets(dt, {')) throw new Error('wrapper updateBullets ausente');
  if (!g.includes('bullets, W: arenaW(), H: arenaH(), player, enemies, boss')) throw new Error('bullets no recibe W/H arena runtime');
});

t('desktop remains 900x520 aunque tenga flag', () => {
  const { sbx, root } = loadViewport({ nv: { capabilities: { isMobile: false, orientation: 'landscape' } }, cssW: 915, cssH: 412, search: '?dynamicView=1' });
  const m = sbx.NV.worldMetrics;
  near(m.viewW, 900, 'viewW'); near(m.viewH, 520, 'viewH');
  if (root.classList.contains('nv-dynamic-view')) throw new Error('dynamic activo en desktop');
});

t('dynamic CSS state activates for mobile landscape default and respects fallback', () => {
  const css = fs.readFileSync('css/styles.css', 'utf8');
  if (!css.includes('.nv-mobile.nv-landscape.nv-dynamic-view .game-box')) throw new Error('selector dinámico scoped ausente');
  const noFlag = loadViewport({ nv: { capabilities: { isMobile: true, orientation: 'landscape' } }, cssW: 915, cssH: 412 });
  if (!noFlag.root.classList.contains('nv-dynamic-view')) throw new Error('clase no activa sin flag');
  const yesFlag = loadViewport({ nv: { capabilities: { isMobile: true, orientation: 'landscape' } }, cssW: 915, cssH: 412, search: '?dynamicView=1' });
  if (!yesFlag.root.classList.contains('nv-dynamic-view')) throw new Error('clase no activa con flag');
  const forcedOff = loadViewport({ nv: { capabilities: { isMobile: true, orientation: 'landscape' } }, cssW: 915, cssH: 412, search: '?dynamicView=0' });
  if (forcedOff.root.classList.contains('nv-dynamic-view')) throw new Error('fallback dynamicView=0 no apagó la clase');
  near(forcedOff.sbx.NV.worldMetrics.viewW, 900, 'fallback viewW');
});

t('portrait mobile no activa dynamic landscape gameplay', () => {
  const { sbx, root } = loadViewport({ nv: { capabilities: { isMobile: true, orientation: 'portrait' } }, cssW: 412, cssH: 915 });
  if (sbx.NV.viewport.dynamicViewActive) throw new Error('dynamic activo en portrait');
  if (root.classList.contains('nv-dynamic-view')) throw new Error('clase activa en portrait');
  near(sbx.NV.worldMetrics.arenaW, 900, 'arenaW');
  near(sbx.NV.worldMetrics.arenaH, 520, 'arenaH');
});

t('WebGL center uses view rectangle metrics', () => {
  const g = fs.readFileSync('js/game.js', 'utf8');
  if (!g.includes('OrthographicCamera(viewX(), viewX() + viewW(), -viewY(), -(viewY() + viewH())')) throw new Error('camera no usa view rect');
  if (!g.includes('x: e.x, y: -e.y')) throw new Error('entidades WebGL no quedan en coords mundo');
  if (!g.includes('function syncEspectroCamera()')) throw new Error('resize no resincroniza cámara WebGL');
  if (!g.includes('camera.left = viewX()') || !g.includes('camera.updateProjectionMatrix')) throw new Error('frustum WebGL no usa métricas view runtime');
});

console.log('RESULT dynamic_viewport: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
const fs = require('fs');
const vm = require('vm');

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log('  ok  ' + name); }
  catch (error) { fail++; console.log('  FAIL ' + name + ' -> ' + error.message); }
}

class ClassList {
  constructor(values) { this.values = new Set(values || []); }
  add(value) { this.values.add(value); }
  remove(value) { this.values.delete(value); }
  contains(value) { return this.values.has(value); }
  toggle(value, force) {
    if (force) this.values.add(value); else this.values.delete(value);
  }
}

function element(classes) {
  return {
    classList: new ClassList(classes), attributes: {}, listeners: {}, style: {}, textContent: '', title: '',
    addEventListener(type, fn) { this.listeners[type] = fn; },
    setAttribute(name, value) { this.attributes[name] = String(value); },
    getAttribute(name) { return this.attributes[name] || null; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 100 }; },
  };
}

function runtime(options) {
  options = options || {};
  const root = element(['nv-mobile', options.portrait ? 'nv-portrait' : 'nv-landscape']);
  root.attributes['data-game-state'] = options.state || 'menu';
  const startScreen = element(options.lobbyHidden ? ['hidden'] : []);
  const lobbyButton = element(['lobby-fullscreen', 'hidden']);
  const elements = { startScreen, lobbyFullscreenBtn: lobbyButton };
  const documentListeners = {};
  const windowListeners = {};
  const document = {
    documentElement: root,
    getElementById(id) { return elements[id] || null; },
    addEventListener(type, fn) { documentListeners[type] = fn; },
    removeEventListener() {},
  };
  let fullscreen = !!options.fullscreen;
  let requests = 0;
  const viewport = {
    canFullscreen() { return options.supported !== false; },
    readFullscreen() { return fullscreen; },
    requestFullscreen() {
      requests++;
      fullscreen = true;
      return { then(fn) { fn(true); return this; } };
    },
    lockLandscape() { return Promise.resolve(true); },
    refresh() {},
  };
  const sandbox = {
    window: null, document, console, Math, Date, JSON, Object, Array, Number, String, Boolean, Promise,
    Symbol, Proxy, Reflect, Error, TypeError, parseInt, parseFloat, isNaN,
    setTimeout() { return 0; }, clearTimeout() {}, setInterval() { return 0; }, clearInterval() {},
    MutationObserver: function () { this.observe = function () {}; },
  };
  sandbox.window = sandbox;
  sandbox.NV = { capabilities: { isMobile: true }, input: {}, viewport };
  sandbox.addEventListener = (type, fn) => { windowListeners[type] = fn; };
  sandbox.removeEventListener = () => {};
  vm.runInNewContext(fs.readFileSync('js/ui/mobileControls.js', 'utf8'), sandbox, { filename: 'mobileControls.js' });
  return { sandbox, root, startScreen, lobbyButton, documentListeners, windowListeners, viewport, requests: () => requests, setFullscreen(value) { fullscreen = value; } };
}

t('botón existe en el lobby y está oculto por defecto para desktop/no JS móvil', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  const css = fs.readFileSync('css/lobby-f093.css', 'utf8');
  if (!html.includes('id="lobbyFullscreenBtn"')) throw new Error('botón ausente');
  if (!html.includes('lobby-fullscreen hidden')) throw new Error('no inicia oculto');
  if (!css.includes('.lobby-fullscreen { display: none; }')) throw new Error('desktop no lo oculta');
});

t('mobile landscape lobby soportado muestra el botón', () => {
  const r = runtime();
  if (r.lobbyButton.classList.contains('hidden')) throw new Error('sigue oculto');
  if (r.lobbyButton.getAttribute('aria-hidden') !== 'false') throw new Error('aria no visible');
});

t('portrait, fuera de lobby o API ausente ocultan el botón', () => {
  for (const options of [{ portrait: true }, { state: 'playing' }, { lobbyHidden: true }, { supported: false }]) {
    const r = runtime(options);
    if (!r.lobbyButton.classList.contains('hidden')) throw new Error('visible con ' + JSON.stringify(options));
  }
});

t('click directo solicita fullscreen y oculta el control al entrar', () => {
  const r = runtime();
  const down = r.lobbyButton.listeners.touchstart || r.lobbyButton.listeners.pointerdown;
  if (typeof down !== 'function') throw new Error('listener directo ausente');
  down({});
  if (r.requests() !== 1) throw new Error('requests=' + r.requests());
  if (!r.lobbyButton.classList.contains('hidden')) throw new Error('no se ocultó en fullscreen');
});

t('fullscreenchange restaura el botón al salir', () => {
  const r = runtime({ fullscreen: true });
  if (!r.lobbyButton.classList.contains('hidden')) throw new Error('visible dentro de fullscreen');
  r.setFullscreen(false);
  const listener = r.windowListeners.fullscreenchange;
  const documentListener = r.documentListeners.fullscreenchange;
  if (typeof listener !== 'function' || typeof documentListener !== 'function') throw new Error('listener fullscreenchange ausente');
  documentListener();
  if (r.lobbyButton.classList.contains('hidden')) throw new Error('no volvió tras salir');
});

console.log('RESULT mobile_lobby_fullscreen: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
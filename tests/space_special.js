// Arnés headless: carga TODOS los módulos con stubs DOM/canvas, arranca partida,
// selecciona cada personaje, dispara Espacio y corre frames buscando la excepción.
const fs = require('fs'), vm = require('vm');
const CHARS = ['boti', 'nova', 'rook', 'swarm'];

function makeSandbox() {
  const ctxStub = new Proxy(function () {}, {
    get(t, k) {
      if (k === Symbol.toPrimitive) return () => 0;
      if (k === 'width') return 0;
      return (t[k] = t[k] || function () { return ctxStub; });
    },
    set() { return true; },
    apply() { return ctxStub; },
  });
  const els = {};
  const docListeners = {};
  function makeEl(id) {
    const t = {
      id, textContent: '', value: '', style: {}, dataset: {},
      classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
      listeners: {},
      width: 800, height: 600,
      addEventListener(ev, fn) { (t.listeners[ev] = t.listeners[ev] || []).push(fn); },
      removeEventListener() {},
      appendChild() {}, removeChild() {}, remove() {}, focus() {},
      querySelector() { return makeEl('inner'); }, querySelectorAll() { return []; },
      getAttribute(k) { return t.attrs && t.attrs[k]; },
      attrs: {},
      getContext() { return ctxStub; },
      getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 600 }; },
      setAttribute(k, v) { t.attrs[k] = v; },
    };
    return new Proxy(t, {
      get(tt, k) { if (k in tt) return tt[k]; return (tt[k] = function () {}); },
      set(tt, k, v) { tt[k] = v; return true; },
    });
  }
  const getEl = (id) => (els[id] = els[id] || makeEl(id));
  let rafCb = null;
  const sandbox = {
    console,
    document: {
      getElementById: getEl,
      querySelector: () => getEl('qs'),
      querySelectorAll(sel) {
        if (/char-card/.test(sel)) return CHARS.map((c) => { const e = makeEl('card-' + c); e.setAttribute('data-char', c); return e; });
        return [];
      },
      createElement: () => makeEl('created'),
      addEventListener(ev, fn) { (docListeners[ev] = docListeners[ev] || []).push(fn); },
      removeEventListener() {},
      body: makeEl('body'),
      hidden: false,
    },
    requestAnimationFrame(cb) { rafCb = cb; },
    cancelAnimationFrame() { rafCb = null; },
    performance: { now: () => Date.now() },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    devicePixelRatio: 1,
    innerWidth: 800, innerHeight: 600,
    Math, Date, JSON, Object, Array, Number, String, Boolean, Promise, Set, Map,
    Symbol, Proxy, Reflect, TypeError, RangeError, Error, isNaN, parseInt, parseFloat,
    setTimeout: (fn) => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
  };
  sandbox.window = sandbox;
  sandbox.addEventListener = (ev, fn) => { (docListeners[ev] = docListeners[ev] || []).push(fn); };
  sandbox.removeEventListener = () => {};
  sandbox.globalThis = sandbox;
  sandbox.AudioContext = function () {};
  sandbox.AudioContext.prototype.createOscillator = function () { return { connect() {}, start() {}, stop() {}, frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} }, type: '' }; };
  sandbox.AudioContext.prototype.createGain = function () { return { connect() {}, gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} } }; };
  sandbox.AudioContext.prototype.createBiquadFilter = function () { return { connect() {}, frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} }, Q: { value: 0 }, type: '', detune: { value: 0 } }; };
  sandbox.AudioContext.prototype.createBuffer = function () { return { getChannelData: () => new Float32Array(100) }; };
  sandbox.AudioContext.prototype.createBufferSource = function () { return { connect() {}, start() {}, stop() {}, buffer: null }; };
  sandbox.AudioContext.prototype.destination = {};
  sandbox.AudioContext.prototype.currentTime = 0;
  sandbox.AudioContext.prototype.resume = function () { return Promise.resolve(); };
  sandbox.window.AudioContext = sandbox.AudioContext;
  return {
    sandbox,
    step(ms) { const cb = rafCb; rafCb = null; if (cb) cb(ms); return !!cb; },
    fire(el, ev, arg) { for (const fn of (el.listeners[ev] || [])) fn(arg); },
    fireDoc(ev, arg) { for (const fn of (docListeners[ev] || [])) fn(arg); },
    getEl,
  };
}

function runFor(charId) {
  const h = makeSandbox();
  const order = fs.readFileSync('index.html', 'utf8').match(/<script src="([^"]+)"/g).map((s) => s.match(/"([^"]+)"/)[1]);
  for (const f of order) vm.runInNewContext(fs.readFileSync(f, 'utf8'), h.sandbox, { filename: f });
  // click en tarjeta de personaje y luego Start
  h.fire(h.getEl('card-' + charId), 'click');
  h.fire(h.getEl('startBtn'), 'click');
  let t = 1000;
  // calentar ~60 frames
  for (let i = 0; i < 60; i++) h.step((t += 16));
  // disparar Space
  h.fireDoc('keydown', { code: 'Space', preventDefault() {} });
  for (let i = 0; i < 300; i++) {
    try { if (!h.step((t += 16))) break; } catch (e) { return 'FREEZE frame+' + i + ': ' + e.message + '\n    ' + (e.stack || '').split('\n').slice(1, 5).join('\n    '); }
  }
  return 'ok';
}

for (const c of CHARS) console.log(c.padEnd(6), '->', runFor(c));
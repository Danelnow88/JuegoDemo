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
    const classes = new Set(id === 'characterSelectScreen' || id === 'shop' || id === 'gameOver' || id === 'permShop' || id === 'settingsPanel' ? ['hidden'] : []);
    const t = {
      id, textContent: '', value: '', style: {}, dataset: {},
      classList: {
        add(...names) { names.forEach((name) => classes.add(name)); },
        remove(...names) { names.forEach((name) => classes.delete(name)); },
        toggle(name, force) {
          const add = force === undefined ? !classes.has(name) : !!force;
          if (add) classes.add(name); else classes.delete(name);
          return add;
        },
        contains(name) { return classes.has(name); },
      },
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
        if (/char-card/.test(sel)) return CHARS.map((c) => { const e = getEl('card-' + c); e.setAttribute('data-char', c); return e; });
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
  sandbox.AudioContext.prototype.createOscillator = function () { return { connect(){}, start(){}, stop(){}, frequency: { value: 0, setValueAtTime(){}, exponentialRampToValueAtTime(){}, linearRampToValueAtTime(){} }, detune:{ value: 0, setValueAtTime(){} }, type: '' }; };
  sandbox.AudioContext.prototype.createGain = function () { return { connect(){}, gain: { value: 0, setValueAtTime(){}, exponentialRampToValueAtTime(){}, linearRampToValueAtTime(){} } }; };
  sandbox.AudioContext.prototype.createBiquadFilter = function () { return { connect(){}, frequency: { value: 0, setValueAtTime(){}, exponentialRampToValueAtTime(){}, linearRampToValueAtTime(){} }, Q: { value: 0, setValueAtTime(){} }, type: '', detune: { value: 0 } }; };
  sandbox.AudioContext.prototype.createBuffer = function () { return { getChannelData: () => new Float32Array(100) }; };
  sandbox.AudioContext.prototype.createBufferSource = function () { return { connect(){}, start(){}, stop(){}, buffer: null, playbackRate: { value: 1, setValueAtTime(){}, exponentialRampToValueAtTime(){}, linearRampToValueAtTime(){} }, loop: false }; };
  sandbox.AudioContext.prototype.createDelay = function () { return { connect(){}, delayTime: { value: 0, setValueAtTime(){} } }; };
  sandbox.AudioContext.prototype.createDynamicsCompressor = function () { return { connect(){}, threshold:{ value:0, setValueAtTime(){} }, knee:{ value:0, setValueAtTime(){} }, ratio:{ value:1, setValueAtTime(){} }, attack:{ value:0, setValueAtTime(){} }, release:{ value:0, setValueAtTime(){} } }; };
  sandbox.AudioContext.prototype.createWaveShaper = function () { return { connect(){}, curve: null }; };
  sandbox.AudioContext.prototype.createChannelMerger = function () { return { connect(){} }; };
  sandbox.AudioContext.prototype.createStereoPanner = function () { return { connect(){}, pan: { value: 0, setValueAtTime(){} } }; };
  sandbox.AudioContext.prototype.destination = {};
  sandbox.AudioContext.prototype.currentTime = 0;
  sandbox.AudioContext.prototype.resume = function () { return Promise.resolve(); };
  sandbox.AudioContext.prototype.sampleRate = 44100;
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
  // Flujo F09.3: la biblioteca selecciona; JUGAR arranca directamente desde lobby.
  h.fire(h.getEl('card-' + charId), 'click');
  if (h.getEl('heroName').textContent !== h.sandbox.NV.CHARACTERS[charId].name) return 'FAIL selección no sincronizada';
  h.fire(h.getEl('lobbyPlayBtn'), 'click');
  if (h.sandbox.NV.getState() !== 'playing') return 'FAIL estado no es playing';
  for (const id of ['startScreen', 'characterSelectScreen', 'shop', 'gameOver', 'permShop']) {
    if (!h.getEl(id).classList.contains('hidden')) return 'FAIL overlay visible: ' + id;
  }
  let t = 1000;
  // calentar ~60 frames
  for (let i = 0; i < 60; i++) h.step((t += 16));
  let snapshot = h.sandbox.NV.getRuntimeSnapshot();
  if (snapshot.state !== 'playing' || snapshot.paused || snapshot.wave !== 1 || snapshot.frame <= 0) return 'FAIL runtime inactivo';
  if (snapshot.player.character !== charId) return 'FAIL piloto de gameplay incorrecto';
  if (snapshot.enemies <= 0) return 'FAIL oleada sin spawns visibles';
  const startX = snapshot.player.x;
  h.fireDoc('keydown', { code: 'KeyD', preventDefault() {} });
  for (let i = 0; i < 20; i++) h.step((t += 16));
  h.fireDoc('keyup', { code: 'KeyD', preventDefault() {} });
  snapshot = h.sandbox.NV.getRuntimeSnapshot();
  if (snapshot.player.x <= startX) return 'FAIL input no controla al jugador';
  // disparar Space
  h.fireDoc('keydown', { code: 'Space', preventDefault() {} });
  for (let i = 0; i < 300; i++) {
    try { if (!h.step((t += 16))) break; } catch (e) { return 'FREEZE frame+' + i + ': ' + e.message + '\n    ' + (e.stack || '').split('\n').slice(1, 5).join('\n    '); }
  }
  return 'ok';
}

function verifyLobbySwitching() {
  const h = makeSandbox();
  const order = fs.readFileSync('index.html', 'utf8').match(/<script src="([^"]+)"/g).map((s) => s.match(/"([^"]+)"/)[1]);
  for (const f of order) vm.runInNewContext(fs.readFileSync(f, 'utf8'), h.sandbox, { filename: f });
  const prev = h.getEl('hero-prev'), next = h.getEl('hero-next');
  if ((prev.listeners.click || []).length !== 1 || (next.listeners.click || []).length !== 1) return 'FAIL listeners duplicados';
  const expected = ['NOVA', 'ROOK', 'ENJAMBRE', 'BOTI'];
  for (const name of expected) {
    h.fire(next, 'click');
    if (h.getEl('heroName').textContent !== name) return 'FAIL next esperaba ' + name + ' obtuvo ' + h.getEl('heroName').textContent;
  }
  h.fire(prev, 'click');
  if (h.getEl('heroName').textContent !== 'ENJAMBRE') return 'FAIL previous no retrocede uno';
  return 'ok';
}

console.log('switch ->', verifyLobbySwitching());
for (const c of CHARS) console.log(c.padEnd(6), '->', runFor(c));
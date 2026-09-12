const fs = require('fs');
const vm = require('vm');

let pass = 0;
let fail = 0;

function test(name, fn) {
  try {
    fn();
    pass++;
    console.log('  ok  ' + name);
  } catch (error) {
    fail++;
    console.log('  FAIL ' + name + ' -> ' + error.message);
  }
}

class ClassList {
  constructor(initial) {
    this.values = new Set(initial || []);
  }

  add(value) {
    this.values.add(value);
  }

  remove(value) {
    this.values.delete(value);
  }

  contains(value) {
    return this.values.has(value);
  }

  toggle(value, force) {
    if (force === true) this.values.add(value);
    else if (force === false) this.values.delete(value);
    else if (this.values.has(value)) this.values.delete(value);
    else this.values.add(value);
    return this.values.has(value);
  }
}

class Button {
  constructor(diff, text) {
    this.tagName = 'BUTTON';
    this.dataset = { diff };
    this.textContent = text;
    this.classList = new ClassList(['lobby-diff-btn']);
    this.attributes = { 'data-diff': diff, 'aria-pressed': 'false' };
    this.listeners = {};
    this.isConnected = true;
  }

  addEventListener(type, listener) {
    this.listeners[type] = listener;
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  getAttribute(name) {
    return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null;
  }

  click() {
    this.listeners.click({ currentTarget: this, target: this });
  }
}

function selected(buttons) {
  return buttons.filter((button) => button.classList.contains('is-selected'));
}

function createRuntime(initialDifficulty) {
  const buttons = [
    new Button('easy', 'FÁCIL'),
    new Button('normal', 'NORMAL'),
    new Button('hard', 'DIFÍCIL'),
  ];
  const listeners = [];
  const NV = {
    DIFFICULTY_ORDER: ['easy', 'normal', 'hard'],
    settings: { gameplay: { difficulty: initialDifficulty || 'normal' } },
    onSettingsChange(listener) {
      listeners.push(listener);
    },
    setDifficulty(value) {
      NV.settings.gameplay.difficulty = value;
      listeners.slice().forEach((listener) => listener());
      return true;
    },
  };
  const document = {
    querySelectorAll(selector) {
      return selector === '#lobbyDiffOptions .lobby-diff-btn' ? buttons : [];
    },
    getElementById() {
      return null;
    },
    addEventListener() {},
    documentElement: { setAttribute() {} },
  };
  const sandbox = { window: { NV }, document, console, Array };
  vm.runInNewContext(fs.readFileSync('js/ui/settingsPanel.js', 'utf8'), sandbox, { filename: 'settingsPanel.js' });
  return { NV, buttons };
}

test('index contiene exactamente tres botones estáticos de dificultad', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  const container = html.match(/<div class="lobby-diff-options" id="lobbyDiffOptions">([\s\S]*?)<\/div>/);
  if (!container) throw new Error('contenedor ausente');
  const buttons = container[1].match(/<button\b[^>]*class="lobby-diff-btn"[^>]*>/g) || [];
  if (buttons.length !== 3) throw new Error('buttons=' + buttons.length);
  for (const diff of ['easy', 'normal', 'hard']) {
    if (!container[1].includes('data-diff="' + diff + '"')) throw new Error('falta ' + diff);
  }
});

test('no existe creación o reconstrucción dinámica de botones', () => {
  const source = fs.readFileSync('js/ui/settingsPanel.js', 'utf8');
  if (/createElement\s*\(|lobbyDiffOptions[^\n]*innerHTML|lobbyDiffOpts\.appendChild/.test(source)) {
    throw new Error('queda creación dinámica');
  }
});

test('NORMAL queda seleccionado al inicializar', () => {
  const { buttons } = createRuntime('normal');
  const current = selected(buttons);
  if (current.length !== 1 || current[0].dataset.diff !== 'normal') throw new Error('selección inicial incorrecta');
  if (current[0].getAttribute('aria-pressed') !== 'true') throw new Error('NORMAL sin aria true');
});

test('clic real cambia clase y aria de forma exclusiva', () => {
  const { buttons } = createRuntime('normal');
  for (const diff of ['easy', 'normal', 'hard']) {
    const button = buttons.find((candidate) => candidate.dataset.diff === diff);
    button.click();
    const current = selected(buttons);
    if (current.length !== 1 || current[0] !== button) throw new Error('selección no exclusiva para ' + diff);
    for (const candidate of buttons) {
      const expected = candidate === button ? 'true' : 'false';
      if (candidate.getAttribute('aria-pressed') !== expected) throw new Error('aria incorrecto para ' + candidate.dataset.diff);
    }
  }
});

test('las referencias siguen conectadas y son los mismos nodos tras sincronizar', () => {
  const { NV, buttons } = createRuntime('normal');
  const original = buttons.slice();
  buttons[0].click();
  if (typeof NV.renderLobbyDifficultySelection === 'function') NV.renderLobbyDifficultySelection();
  buttons[2].click();
  if (typeof NV.renderLobbyDifficultySelection === 'function') NV.renderLobbyDifficultySelection();
  if (!buttons.every((button, index) => button === original[index] && button.isConnected)) {
    throw new Error('referencias stale o detached');
  }
});

test('la autoridad visual final usa únicamente is-selected', () => {
  const lobbyCss = fs.readFileSync('css/lobby-f093.css', 'utf8');
  const stylesCss = fs.readFileSync('css/styles.css', 'utf8');
  const finalRule = /#lobbyDiffOptions \.lobby-diff-btn\.is-selected\s*\{[\s\S]*background:\s*#7cf8ff\s*!important;[\s\S]*color:\s*#001018\s*!important;[\s\S]*border:\s*2px solid #ffffff\s*!important;[\s\S]*box-shadow:[\s\S]*!important;/;
  if (!finalRule.test(lobbyCss)) throw new Error('regla final cyan incompleta');
  if (/\.lobby-diff-btn\.active|\.lobby-diff-btn\[aria-pressed/.test(lobbyCss + stylesCss)) throw new Error('autoridad visual antigua presente');
  if (!lobbyCss.trimEnd().endsWith('}')) throw new Error('CSS final incompleto');
  if (lobbyCss.lastIndexOf('#lobbyDiffOptions .lobby-diff-btn.is-selected') < lobbyCss.length - 700) throw new Error('regla no está al final');
});

console.log('RESULT f10_1c_difficulty_ui: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
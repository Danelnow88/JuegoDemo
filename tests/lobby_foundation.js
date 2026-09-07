const fs = require('fs'), vm = require('vm');
let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; console.log('  ok  ' + name); } catch (e) { fail++; console.log('  FAIL ' + name + ' -> ' + e.message); } }

const countEl = { textContent: '' };
const sbx = {
  window: { NV: {} }, console,
  document: { getElementById(id) { return id === 'lobbyCharacterCount' ? countEl : null; } },
};
vm.runInNewContext(fs.readFileSync('js/data/gameData.js', 'utf8'), sbx, { filename: 'gameData.js' });
vm.runInNewContext(fs.readFileSync('js/ui/characters.js', 'utf8'), sbx, { filename: 'characters.js' });
const NV = sbx.window.NV;

t('lobby usa la fuente única NV.characterList', () => {
  const src = fs.readFileSync('js/ui/characters.js', 'utf8');
  if (!src.includes('NV.characterList()')) throw new Error('renderer no usa characterList');
  if (/MOBILE_CHARACTERS|DESKTOP_CHARACTERS/.test(src)) throw new Error('datos duplicados por plataforma');
});

t('cada personaje produce una sola card compartida', () => {
  const html = NV.characterCardsHtml(null, 'nova');
  const cards = html.match(/class="char-card/g) || [];
  if (cards.length !== NV.characterList().length) throw new Error('cards=' + cards.length);
  if (!html.includes('data-char="nova"') || !html.includes('aria-pressed="true"')) throw new Error('selección accesible ausente');
});

t('estructura de card separa visual, identidad, stats y descripción', () => {
  const html = NV.characterCardsHtml(null, 'boti');
  for (const cls of ['char-visual', 'char-content', 'char-heading', 'char-stat', 'char-desc']) {
    if (!html.includes('class="' + cls)) throw new Error('falta ' + cls);
  }
});

t('contador de lobby deriva del mismo roster', () => {
  const container = { innerHTML: '' };
  NV.renderCharacterCards(container, NV.CHARACTERS, 'boti');
  if (countEl.textContent !== NV.characterList().length + ' disponibles') throw new Error(countEl.textContent);
});

t('HTML y CSS definen una sola composición responsive', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  const css = fs.readFileSync('css/styles.css', 'utf8');
  if ((html.match(/id="charGrid"/g) || []).length !== 1) throw new Error('charGrid duplicado');
  if (!html.includes('class="overlay lobby-screen"') || !html.includes('class="lobby-actions"')) throw new Error('fundación lobby ausente');
  if (!css.includes('.lobby-shell') || !css.includes('repeat(4, minmax(0, 1fr))')) throw new Error('layout responsive ausente');
  if (!css.includes('-webkit-line-clamp: 4')) throw new Error('descripción móvil no amplió jerarquía');
});

console.log('RESULT lobby_foundation: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
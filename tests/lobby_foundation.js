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
  const css = fs.readFileSync('css/styles.css', 'utf8') + fs.readFileSync('css/lobby-f093.css', 'utf8');
  if ((html.match(/id="charGrid"/g) || []).length !== 1) throw new Error('charGrid duplicado');
  if (!html.includes('id="startScreen"') || !html.includes('id="characterSelectScreen"') || !html.includes('id="pilotsBtn"')) throw new Error('faltan lobby o biblioteca');
  if (!html.includes('class="lobby-actions character-select-actions"')) throw new Error('acciones del selector ausentes');
  if (!css.includes('.lobby-shell') || !css.includes('repeat(4, minmax(0, 1fr))')) throw new Error('layout responsive ausente');
  if (!css.includes('-webkit-line-clamp: 4')) throw new Error('descripción móvil no amplió jerarquía');
});

t('lobby principal precede a selección y no contiene el roster', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  const lobbyStart = html.indexOf('id="startScreen"');
  const selectorStart = html.indexOf('id="characterSelectScreen"');
  const lobby = html.slice(lobbyStart, selectorStart);
  if (lobbyStart < 0 || selectorStart <= lobbyStart) throw new Error('orden lobby -> selector inválido');
  if (!lobby.includes('id="lobbyPlayBtn"') || !lobby.includes('id="lobbySettingsBtn"') || !lobby.includes('id="permBtn"')) throw new Error('acciones principales incompletas');
  if (lobby.includes('id="charGrid"')) throw new Error('roster duplicado dentro del lobby principal');
});

t('JUGAR inicia directo y la biblioteca es opcional', () => {
  const game = fs.readFileSync('js/game.js', 'utf8');
  if (!/dom\.lobbyPlayBtn[\s\S]{0,150}initAudio\(\);[\s\S]{0,80}startGame\(\);/.test(game)) throw new Error('JUGAR no inicia audio + gameplay');
  if (!game.includes("dom.pilotsBtn.addEventListener('click', showCharacterSelect)")) throw new Error('PILOTOS no abre biblioteca');
  if (!game.includes("dom.startBtn.addEventListener('click', showLobby)")) throw new Error('biblioteca no vuelve al lobby');
  if (/lobbyPlayBtn[^\n]+showCharacterSelect/.test(game)) throw new Error('biblioteca sigue siendo gate obligatorio');
});

t('vista inicial es lobby fullscreen y no una tarjeta centrada pequeña', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  const css = fs.readFileSync('css/styles.css', 'utf8') + fs.readFileSync('css/lobby-f093.css', 'utf8');
  if (!html.includes('id="startScreen" class="overlay lobby-screen main-lobby-screen"')) throw new Error('startScreen no es el lobby inicial');
  const screen = css.slice(css.indexOf('.lobby-screen {'), css.indexOf('.lobby-screen::before'));
  for (const contract of ['position: fixed', 'width: 100vw', 'height: 100dvh']) if (!screen.includes(contract)) throw new Error('falta fullscreen: ' + contract);
  if (/\.main-lobby-panel\s*\{[^}]*width:\s*min\(620px/s.test(css)) throw new Error('lobby volvió a panel pequeño');
  if (!/\.main-lobby-panel\s*\{[\s\S]*grid-template-columns:[^;]+;/.test(css)) throw new Error('composición lateral ausente');
});

t('lobby contiene un único preview real y ningún hero promocional falso', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  const game = fs.readFileSync('js/game.js', 'utf8');
  for (const cls of ['lobby-atmosphere', 'lobby-grid-floor', 'lobby-brand-mark', 'lobby-hero', 'lobby-preview']) {
    if (!html.includes(cls)) throw new Error('falta ' + cls);
  }
  if ((html.match(/id="lobbyPreview"/g) || []).length !== 1) throw new Error('preview duplicado');
  if (/hero-nova|NOVA, piloto destacado|hero-caption/.test(html)) throw new Error('fake hero presente');
  if (!game.includes('NV.drawPlayer(lobbyPreviewCtx, previewPlayer, CHARACTERS, frame)')) throw new Error('preview no usa renderer real');
  if (!game.includes('function isLobbyPreviewActive()') || !game.includes("!dom.startScreen.classList.contains('hidden')") || !game.includes("getAttribute('data-settings-open') === 'true'")) throw new Error('preview sin ownership de vista');
  if (!game.includes('function lobbyPreviewPlayer()') || !game.includes('invuln: 0') || !game.includes('overdrive: 0')) throw new Error('preview hereda residuos de combate');
});

t('selección de piloto tiene una sola autoridad y orden productivo', () => {
  const game = fs.readFileSync('js/game.js', 'utf8');
  const data = fs.readFileSync('js/data/gameData.js', 'utf8');
  if (!game.includes('function selectPilot(id)') || !game.includes('NV.selectPilot = selectPilot')) throw new Error('autoridad selectPilot ausente');
  if (!game.includes("card.addEventListener('click', () => selectPilot(card.getAttribute('data-char')))")) throw new Error('cards no usan autoridad');
  if ((game.match(/heroPrev\.addEventListener\('click'/g) || []).length !== 1 || (game.match(/heroNext\.addEventListener\('click'/g) || []).length !== 1) throw new Error('listeners duplicados');
  if (!data.includes("NV.CHARACTER_ORDER = ['boti', 'nova', 'rook', 'swarm']")) throw new Error('orden productivo cambió');
});

t('Game Over y permanentes regresan al lobby', () => {
  const game = fs.readFileSync('js/game.js', 'utf8');
  if (!game.includes("dom.restartBtn.addEventListener('click', showLobby)")) throw new Error('Game Over no vuelve al lobby');
  if (!/function closePermShop\(\)[\s\S]{0,140}showLobby\(\)/.test(game)) throw new Error('permanentes no vuelve al lobby');
});

t('navegación secundaria conserva permanentes, settings y no ofrece Continuar', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  const game = fs.readFileSync('js/game.js', 'utf8');
  const settings = fs.readFileSync('js/ui/settingsPanel.js', 'utf8');
  if (!game.includes('function closePermShop()') || !/function closePermShop\(\)[\s\S]{0,140}showLobby\(\)/.test(game)) throw new Error('permanentes no vuelve al lobby');
  if (!settings.includes("lobbyBtn.addEventListener('click', open)")) throw new Error('settings del lobby sin wiring');
  if (/<button[^>]*>[^<]*(CONTINUAR|CONTINUE)/i.test(html)) throw new Error('botón Continuar no permitido');
});

console.log('RESULT lobby_foundation: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
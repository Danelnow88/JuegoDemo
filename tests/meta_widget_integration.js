// Tests: integración del widget de música externa en DOM + game.js wiring.
const fs = require('fs');
let pass = 0, fail = 0;
function t(desc, fn) {
  try { fn(); pass++; console.log('  ok  ' + desc); }
  catch (e) { fail++; console.log('  FAIL ' + desc + ' -> ' + e.message); }
}
(function () {
  const html = fs.readFileSync('index.html', 'utf8');
  const dom = fs.readFileSync('js/ui/dom.js', 'utf8');
  const game = fs.readFileSync('js/game.js', 'utf8');
  const css = fs.readFileSync('css/styles.css', 'utf8');

  t('index.html contiene el widget rhythm-widget', () => {
    if (!html.includes('id="rhythm-widget"')) throw new Error('falta #rhythm-widget');
  });

  t('widget tiene icono 🎵 y 2 botones (añadir + detener)', () => {
    if (!html.includes('class="rw-icon"') || !html.includes('>🎵')) throw new Error('falta icono');
    if (!html.includes('id="rwAddMusicBtn"')) throw new Error('falta boton add');
    if (!html.includes('id="rwStopBtn"')) throw new Error('falta boton stop');
    if (html.includes('id="rhythmTabBtn"')) throw new Error('no debe quedar rhythmTabBtn');
    if (html.includes('id="rhythmMicBtn"')) throw new Error('no debe quedar rhythmMicBtn');
  });

  t('dom.js expone rwAddMusicBtn / rwStopBtn', () => {
    if (!dom.includes('rwAddMusicBtn: document.getElementById')) throw new Error('dom falta rwAddMusicBtn');
    if (!dom.includes('rwStopBtn: document.getElementById')) throw new Error('dom falta rwStopBtn');
    if (dom.includes('rhythmTabBtn:')) throw new Error('dom no debe tener rhythmTabBtn');
    if (dom.includes('rhythmMicBtn:')) throw new Error('dom no debe tener rhythmMicBtn');
  });

  t('game.js wiring usa API real: externalAudio.startDisplayCapture / stop', () => {
    if (!game.includes('NV.externalAudio.startDisplayCapture()')) throw new Error('no wirea startDisplayCapture');
    if (!game.includes('NV.externalAudio.stop()')) throw new Error('no wirea stop');
    if (game.includes('NV.externalAudio.startMicCapture()')) throw new Error('no debe wirear startMicCapture');
  });

  t('game.js setupRhythmUI bindea click en rwAddMusicBtn / rwStopBtn', () => {
    if (!game.includes("dom.rwAddMusicBtn.addEventListener('click'")) throw new Error('falta listener rwAddMusicBtn');
    if (!game.includes("dom.rwStopBtn.addEventListener('click'")) throw new Error('falta listener rwStopBtn');
  });

    t('css posiciona el widget absoluto sin left fijo al centro', () => {
    const css = fs.readFileSync('css/styles.css', 'utf8');
    if (!css.includes('.rhythm-widget')) throw new Error('falta .rhythm-widget en css');
    // Debe ser absolute (fuera del flujo flex) para no desplazar nada
    const block = css.slice(css.indexOf('.rhythm-widget'));
    const posBlock = block.slice(0, block.indexOf('}'));
    if (!posBlock.includes('position: absolute')) throw new Error('widget debe ser absolute');
    // No debe fijar left:50% (JS calcula el hueco real)
    if (posBlock.includes('left: 50%')) throw new Error('widget no debe quedar centrado por CSS');
  });

  t('game.js calcula posicion dinámica entre logo y stats (no left fijo)', () => {
    const game = fs.readFileSync('js/game.js', 'utf8');
    if (!game.includes('function positionRhythmWidget')) throw new Error('falta positionRhythmWidget');
    if (!game.includes("hud.querySelector('.logo')")) throw new Error('no lee .logo');
    if (!game.includes("hud.querySelector('.stats')")) throw new Error('no lee .stats');
    if (!game.includes('logoRect.right')) throw new Error('no calcula borde derecho del logo');
    if (!game.includes('statsRect.left')) throw new Error('no calcula arranque de stats');
    if (!game.includes('addEventListener(\'resize\'') && !game.includes('addEventListener("resize"')) throw new Error('falta recalcular en resize');
  });

  t('wiring de clicks usa API real NV.externalAudio.startDisplayCapture / stop', () => {
    const game = fs.readFileSync('js/game.js', 'utf8');
    const dom = fs.readFileSync('js/ui/dom.js', 'utf8');
    // DOM expone los nodos
    if (!dom.includes('rwAddMusicBtn:')) throw new Error('dom no expone rwAddMusicBtn');
    if (!dom.includes('rwStopBtn:')) throw new Error('dom no expone rwStopBtn');
    // Game wirea los clicks a las funciones reales de rhythm.js (no a nombres inventados)
    const wireAdd = "dom.rwAddMusicBtn.addEventListener('click', () => { NV.rhythmToggleEnabled(true); NV.externalAudio.startDisplayCapture(); })";
    const wireStop = "dom.rwStopBtn.addEventListener('click', () => { NV.rhythmToggleEnabled(false); NV.externalAudio.stop(); })";
    if (!game.includes(wireAdd)) throw new Error('click add no dispara startDisplayCapture real');
    if (!game.includes(wireStop)) throw new Error('click stop no dispara stop() real');
  });

  console.log('RESULT meta_widget_integration: pass=' + pass + ' fail=' + fail);
  process.exit(fail ? 1 : 0);
})();

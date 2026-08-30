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

    t('css define .rhythm-widget inline dentro del header, entre logo y stats', () => {
    const html = fs.readFileSync('index.html', 'utf8');
    const logoPos = html.indexOf('class="logo"');
    const widgetPos = html.indexOf('id="rhythm-widget"');
    const statsPos = html.indexOf('class="stats"');
    if (!(logoPos >= 0 && widgetPos > logoPos && statsPos > widgetPos)) throw new Error('widget no va entre logo y stats');
    if (!css.includes('.rhythm-widget')) throw new Error('falta .rhythm-widget en css');
    if (!css.includes('display: inline-flex') && !css.includes('display: flex')) throw new Error('widget debe ser flex inline');
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

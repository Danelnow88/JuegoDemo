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

  t('widget tiene ícono SVG music-note (sin emoji) y 2 botones', () => {
    if (!html.includes('class="rw-icon"')) throw new Error('falta .rw-icon');
    if (html.includes('>🎵')) throw new Error('no debe quedar el emoji 🎵 en el widget');
    // SVG music-note con líneas de vibración ghost
    if (!html.includes('<svg class="mn"')) throw new Error('falta svg.mn');
    if (!html.includes('class="mn-ghost"')) throw new Error('falta líneas de vibración ghost');
    if (!html.includes('class="mn-base"') || !html.includes('class="mn-dot"')) throw new Error('faltan primitivas base/dot');
    if (!html.includes('id="rwAddMusicBtn"')) throw new Error('falta boton add');
    if (!html.includes('id="rwStopBtn"')) throw new Error('falta boton stop');
    if (html.includes('id="rhythmTabBtn"')) throw new Error('no debe quedar rhythmTabBtn');
    if (html.includes('id="rhythmMicBtn"')) throw new Error('no debe quedar rhythmMicBtn');
  });

  t('dom.js expone rwAddMusicBtn / rwStopBtn / rwIcon', () => {
    if (!dom.includes('rwAddMusicBtn: document.getElementById')) throw new Error('dom falta rwAddMusicBtn');
    if (!dom.includes('rwStopBtn: document.getElementById')) throw new Error('dom falta rwStopBtn');
    if (!dom.includes('rwIcon: document.querySelector')) throw new Error('dom falta rwIcon');
    if (dom.includes('rhythmTabBtn:')) throw new Error('dom no debe tener rhythmTabBtn');
    if (dom.includes('rhythmMicBtn:')) throw new Error('dom no debe tener rhythmMicBtn');
  });

  t('css: ícono usa currentColor para tinte por hue y ghost fino 1.2/0.38', () => {
    const css = fs.readFileSync('css/styles.css', 'utf8');
    if (!css.includes('.rw-icon')) throw new Error('falta .rw-icon en css');
    const iconBlock = css.slice(css.indexOf('.rw-icon'));
    if (!iconBlock.includes('.mn-ghost')) throw new Error('falta estilos .mn-ghost');
    if (!css.includes('stroke-width: 1.2')) throw new Error('ghost no es fino 1.2');
    if (!css.includes('opacity: .38')) throw new Error('ghost no tiene opacidad .38');
    if (!css.includes('stroke: currentColor')) throw new Error('el SVG no usa currentColor (no se puede teñir por hue)');
  });

  t('game.js: updateRhythmWidgetIcon aplica pulso/skew suavizados, color y glow', () => {
    if (!game.includes('function updateRhythmWidgetIcon')) throw new Error('falta updateRhythmWidgetIcon');
    // gate: estático sin listening
    if (!game.includes("r.state !== 'listening'")) throw new Error('falta gate de estado listening');
    // pulso percusivo (beat/kick/onset) + respiración continua por energía
    if (!game.includes('const perc = Math.max(beat')) throw new Error('falta fuente percusiva combinada');
    if (!game.includes('r.kick') || !game.includes('r.onset')) throw new Error('no usa kick/onset para movimiento');
    if (!game.includes('Math.min(1, perc * 2.1)')) throw new Error('falta targetPulse percusivo amplificado');
    if (!game.includes('skewX(')) throw new Error('falta distorsión skew de borde');
    if (!game.includes('pulseEnv') || !game.includes('curvedPulse')) throw new Error('falta envelope/curva del pulso');
    if (!game.includes('energyEnv') || !game.includes('breathPhase')) throw new Error('falta respiración continua por energía');
    if (!game.includes('hasAudio = energyEnv > 0.025')) throw new Error('falta gate de audio real para movimiento continuo');
    if (!game.includes('breathAmp')) throw new Error('falta amplitud de respiración');
    if (!game.includes('pulseEnv * pulseEnv * (3 - 2 * pulseEnv)')) throw new Error('falta smoothstep del pulso');
    if (!game.includes('targetScale') || !game.includes('smoothScale')) throw new Error('falta suavizado de escala');
    if (!game.includes('pulseTau') || !game.includes('scaleTau') || !game.includes('skewTau')) throw new Error('falta attack/release temporal');
    if (!game.includes('0.10 + energyEnv * 0.18')) throw new Error('falta breathAmp ampliado');
    if (!game.includes('Math.min(1.62')) throw new Error('falta cap ampliado de escala');
    if (!game.includes('0.48 * curvedPulse')) throw new Error('falta rango visual fuerte de escala por percusión');
    if (!game.includes('4.2 * curvedPulse')) throw new Error('falta rango visual fuerte de skew por percusión');
    if (!game.includes('Math.exp(-dtMs / pulseTau)')) throw new Error('falta lerp exponencial del envelope por dt');
    if (!game.includes('Math.exp(-dtMs / scaleTau)')) throw new Error('falta lerp exponencial de escala por dt');
    if (!game.includes('transform = \'scale(')) throw new Error('falta apply scale');
    // color por hue
    if (!game.includes("icon.style.color = 'hsl(")) throw new Error('falta color por hue');
    // glow por energía
    if (!game.includes('icon.style.filter')) throw new Error('falta glow (filter)');
    // usa hue/beat/energy de NV.rhythm
    if (!game.includes('NV.rhythm') || !game.includes('r.hue') || !game.includes('r.beat') || !game.includes('r.energy')) throw new Error('no reusa NV.rhythm');
    // se llama en el loop
    if (!game.includes('NV.updateRhythmWidgetIcon()')) throw new Error('no se llama updateRhythmWidgetIcon en el loop');
  });

  t('ícono SVG a 20px y SIN transition en transform (filtra el pulso)', () => {
    const html = fs.readFileSync('index.html', 'utf8');
    const css = fs.readFileSync('css/styles.css', 'utf8');
    if (!html.includes('width="20" height="20"')) throw new Error('ícono no agrandado a 20px');
    if (!css.includes('width: 20px') || !css.includes('height: 20px')) throw new Error('CSS no tiene 20px');
    // Regresión: una transition en transform filtraba el transiente del beat
    // (se re-escribe cada frame) y el pulso se volvia invisible. No debe volver.
    const iconBlock2 = css.slice(css.indexOf('.rw-icon'), css.indexOf('.rw-icon svg'));
    if (/transition\s*:[^;]*transform/.test(iconBlock2)) throw new Error('.rw-icon no debe tener transition en transform (filtra el pulso)');
  });

  t('game.js resetea estado interno del suavizado cuando no hay captura', () => {
    if (!game.includes('icon._smoothScale = 1')) throw new Error('no resetea smoothScale');
    if (!game.includes('icon._smoothSkew = 0')) throw new Error('no resetea smoothSkew');
    if (!game.includes('icon._pulseEnv = 0')) throw new Error('no resetea pulseEnv');
    if (!game.includes('icon._energyEnv = 0')) throw new Error('no resetea energyEnv');
    if (!game.includes('icon._breathPhase = 0')) throw new Error('no resetea breathPhase');
    if (!game.includes('icon._smoothT = 0')) throw new Error('no resetea smoothT');
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

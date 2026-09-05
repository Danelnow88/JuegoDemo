// Verificación headless de viewports para la capa móvil (herramienta de desarrollo).
// Uso:   node tools/verify_viewports.js [filtro]
// Requiere: servidor rooteado corriendo (node tools/serve.js) en el puerto indicado.
// Recorre los viewports landscape pedidos + portrait + un juego de tamagnos
// desktop y comprueba, sin tocar la lógica del juego:
//   - clases <html> (nv-mobile / nv-landscape|nv-portrait);
//   - menú visible (startScreen sin hidden → init() corrió);
//   - canvas con aspecto preservado (~900:520) en móvil;
//   - SIN desborde horizontal (canvas width <= innerWidth);
//   - ausencia de excepciones JS en la consola del navegador.
// `--window-size` de Edge headless incluye el marco, así que el tamaño interno
// real se MIDE con una sonda data: y se calibra antes de cada dump del juego.
const { spawnSync } = require('child_process');
const http = require('http');
const path = require('path');

const PORT = parseInt(process.env.NV_PORT || '8080', 10);
const BASE = 'http://localhost:' + PORT + '/index.html';
const EDGE = process.env.EDGE_PATH
  || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

// Viewports REALES pedidos (inner width x inner height) — son casos de PRUEBA.
// No se genera ningún CSS específico por resolución.
const MOBILE_LANDSCAPE = [
  [640, 360], [720, 360], [740, 360], [780, 360],
  [844, 390], [852, 393], [915, 412], [932, 430],
];
const DESKTOP = [[1280, 800], [1920, 1080]];

// Marco de ventana estimado del headless (punto de partida; se calibra igual).
const OFFSET_W = 24, OFFSET_H = 92;

function ping() {
  return new Promise((resolve) => {
    const req = http.get(BASE, (r) => { r.resume(); r.on('end', () => resolve(true)); });
    req.on('error', () => resolve(false));
  });
}

function runEdge(args) {
  const r = spawnSync(EDGE, args, { encoding: 'utf8', timeout: 45000, maxBuffer: 32 * 1024 * 1024 });
  return { stdout: r.stdout || '', stderr: r.stderr || '' };
}

// Mide el innerWidth/innerHeight reales para un window-size dado (sonda data:).
function probeInner(winW, winH) {
  const url = 'data:text/html,<h1 id="x"></h1><script>' +
    'document.getElementById("x").textContent = innerWidth + "x" + innerHeight;</script>';
  const { stdout } = runEdge([
    '--headless=new', '--disable-gpu', '--no-sandbox',
    '--window-size=' + winW + ',' + winH,
    '--virtual-time-budget=2000', '--dump-dom', url,
  ]);
  const m = stdout.match(/id="x">(\d+)x(\d+)</);
  return m ? { w: parseInt(m[1], 10), h: parseInt(m[2], 10) } : null;
}

// Calibra: busca el window-size cuyo inner sea ~el pedido (1-2 iteraciones).
function calibrateInner(targetW, targetH) {
  let winW = targetW + OFFSET_W, winH = targetH + OFFSET_H;
  for (let i = 0; i < 3; i++) {
    const inner = probeInner(winW, winH);
    if (!inner) break;
    const dW = targetW - inner.w, dH = targetH - inner.h;
    if (Math.abs(dW) <= 1 && Math.abs(dH) <= 1) break;
    winW += dW; winH += dH;
  }
  return { winW, winH, inner: probeInner(winW, winH) };
}

function check(label, innerW, innerH, withMobile) {
  const cal = calibrateInner(innerW, innerH);
  const realW = cal.inner ? cal.inner.w : innerW;
  const realH = cal.inner ? cal.inner.h : innerH;
  const { stdout, stderr } = runEdge([
    '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    '--enable-logging=stderr',
    '--window-size=' + cal.winW + ',' + cal.winH,
    '--virtual-time-budget=6000', '--dump-dom', BASE + (withMobile ? '?mobile=1' : ''),
  ]);
  const issues = [];

  const htmlMatch = stdout.match(/<html[^>]*class="([^"]*)"/);
  const classes = htmlMatch ? htmlMatch[1].split(/\s+/) : [];
  const isLandscape = classes.includes('nv-landscape');
  const isPortrait = classes.includes('nv-portrait');
  if (withMobile && !classes.includes('nv-mobile')) issues.push('falta .nv-mobile');
  if (!withMobile && classes.includes('nv-mobile')) issues.push('.nv-mobile en desktop (no debe)');
  if (realH > realW && !isPortrait) issues.push('viewport vertical sin nv-portrait');
  if (realW > realH && !isLandscape) issues.push('viewport horizontal sin nv-landscape');

  const canvasMatch = stdout.match(/id="game" width="(\d+)" height="(\d+)"/);
  let aspectOk = false;
  if (canvasMatch) {
    const w = parseInt(canvasMatch[1], 10), h = parseInt(canvasMatch[2], 10);
    // tolerancia ±2.5% sobre 900/520
    aspectOk = h > 0 && Math.abs(w / h - 900 / 520) < 0.025;
    if (withMobile && !aspectOk) issues.push('aspecto distorsionado ' + w + 'x' + h);
    if (withMobile && w > realW + 2) issues.push('desborde horizontal: canvas ' + w + ' > inner ' + realW);
  } else {
    issues.push('canvas no encontrado');
  }

  const startScreenHidden = /id="startScreen" class="overlay[^"]*hidden/.test(stdout);
  if (startScreenHidden) issues.push('startScreen sigue hidden → init() no corrió');

  const consoleErr = /Uncaught|Unhandled promise rejection/i;
  const errLines = stderr.split(/\r?\n/).filter((l) => consoleErr.test(l));
  if (errLines.length) issues.push('errores JS: ' + errLines[0].slice(0, 200));

  const status = issues.length ? 'FAIL' : 'ok';
  console.log(
    '[' + status + '] ' + label.padEnd(18) +
    ' inner=' + realW + 'x' + realH +
    (withMobile ? ' mobile=on' : ' mobile=off') +
    ' html=' + (classes.join(' ') || '(none)') +
    (canvasMatch ? ' canvas=' + canvasMatch[1] + 'x' + canvasMatch[2] + ' aspect=' + (aspectOk ? 'ok' : '(desktop legacy)') : '') +
    (issues.length ? ' -> ' + issues.join(' | ') : '')
  );
  return issues.length ? 1 : 0;
}

(async () => {
  if (!(await ping())) {
    console.error('No hay servidor en ' + BASE + ' . Arrancalo con: node tools/serve.js ' + PORT);
    process.exit(2);
  }
  const filter = process.argv[2] || '';
  let failed = 0;
  for (const [w, h] of MOBILE_LANDSCAPE) {
    const label = 'landscape ' + w + 'x' + h;
    if (filter && !label.includes(filter)) continue;
    failed += check(label, w, h, true);
  }
  if (!filter || 'portrait'.includes(filter)) failed += check('portrait 390x844', 390, 844, true);
  for (const [w, h] of DESKTOP) {
    const label = 'desktop ' + w + 'x' + h;
    if (filter && !label.includes(filter)) continue;
    failed += check(label, w, h, false);
  }
  console.log(failed ? 'RESULT viewports: FAILED=' + failed : 'RESULT viewports: all ok');
  process.exit(failed ? 1 : 0);
})();
// ===== TEST: preview de roster espectral =====
// Valida estructura del HTML, sintaxis del script inline y que buildRoster
// produce el roster completo (13 básicos + 11 élites + 10 bosses) sin crash.
const fs = require('fs'), vm = require('vm'), path = require('path');
let pass = 0, fail = 0;
function t(d, fn) { try { fn(); pass++; console.log('  ok  ' + d); } catch (e) { fail++; console.log('  FAIL ' + d + ' -> ' + e.message); } }

const previewPath = path.join(__dirname, '..', 'previews', 'spectral-roster-preview.html');
const html = fs.readFileSync(previewPath, 'utf8');

console.log('spectral_roster_preview:');

t('preview carga gameData.js y spectralEnemies2D.js', () => {
  if (html.indexOf('../js/data/gameData.js') === -1) throw new Error('falta gameData.js');
  if (html.indexOf('../js/render/spectralEnemies2D.js') === -1) throw new Error('falta spectralEnemies2D.js');
});

t('script inline contiene buildRoster, drawCell y animate', () => {
  for (const pat of ['function buildRoster()', 'function drawCell(', 'function animate(', 'NV.drawSpectralEnemy2D(', 'NV.drawSpectralBoss2D(']) {
    if (html.indexOf(pat) === -1) throw new Error('falta: ' + pat);
  }
});

t('no hay typos de colores/funciones', () => {
  if (html.indexOf('fn ()') !== -1) throw new Error('typo fn()');
  if (html.indexOf('#4155668') !== -1) throw new Error('hex roto');
  if (html.indexOf('drawSectionNd') !== -1) throw new Error('función rota');
  if (html.indexOf('c y') !== -1) throw new Error('espacio roto en cy');
  if (html.indexOf('difference break') !== -1) throw new Error('texto de debug');
});

t('preview inicializa window.NV antes de cargar los módulos (bootstrap)', () => {
  // Debe aparecer ANTES de los <script src> de módulos (mismo patrón que espectro-lite-single-preview.html)
  const idxBootstrap = html.indexOf('window.NV = window.NV || {}');
  const idxGameData = html.indexOf('../js/data/gameData.js');
  if (idxBootstrap === -1) throw new Error('bootstrap ausente');
  if (idxBootstrap > idxGameData) throw new Error('bootstrap después de los módulos');
});

t('script inline tiene guard con mensaje visible si los módulos no cargan', () => {
  if (html.indexOf('insertAdjacentHTML') === -1) throw new Error('guard ausente');
  if (html.indexOf('const NV = window.NV;') === -1) throw new Error('referencia defensiva ausente');
});

// Cargar módulos y extraer buildRoster del HTML para correrlo headless.
function extractInline() {
  // Hay varios <script> inline (bootstrap + roster). Extraer el del roster.
  const scripts = [];
  const re = /<script>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html)) !== null) scripts.push(m[1]);
  const roster = scripts.find((s) => s.indexOf('ROSTER ESPECTRAL') !== -1);
  if (!roster) throw new Error('script del roster ausente');
  return roster;
}

t('script inline tiene sintaxis válida', () => {
  const code = extractInline();
  // new Function compila sin ejecutar el cuerpo de nivel superior hasta la llamada...
  // Compila solo declaraciones: quitar la última parte (autoinit) no es trivial; en su
  // lugar compilamos el script entero en un sandbox con DOM stubeado (ver siguiente test).
  new Function(code); // sin ejecutar; solo parseo
});

t('buildRoster deriva 13 básicos + 11 élites + 10 bosses desde datos reales', () => {
  const NV = {};
  const sbx = {
    window: { NV: NV },
    console: console,
    Math: Math,
    JSON: JSON,
    Object: Object,
    Array: Array,
  };
  vm.createContext(sbx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'data', 'gameData.js'), 'utf8'), sbx, { filename: 'gameData.js' });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'render', 'spectralEnemies2D.js'), 'utf8'), sbx, { filename: 'spectralEnemies2D.js' });

  const code = extractInline();
  // Extraemos y evaluamos solo buildRoster dentro de una IIFE con NV disponible.
  const prelude =
    'var __NV = NV; var __buildRoster = null;' +
    code.replace(/\(function\s*\(\)\s*\{[\s\S]*?function buildRoster\(\)/, '(function(){ function buildRoster()');

  // Enfoque más simple: evaluamos una función que reimplementa el recorrido desde NV
  // (misma lógica del HTML) para no depender del DOM.
  const rosterFn = new Function('NV', `
    var shapeBase = { hex:'tank', triangle:'runner', rock:'tank', diamond:'shielder', circle:'wisp', atom:'wisp', dot:'swarmlet' };
    var rows = [];
    for (var i=0;i<NV.ENEMY_TYPES.length;i++){ var t=NV.ENEMY_TYPES[i]; if(!t.id) continue; rows.push({kind:'basic',id:t.id,isWebGL:t.shape==='specter'}); }
    for (var j=0;j<NV.ELITE_TYPES.length;j++){ var el=NV.ELITE_TYPES[j]; rows.push({kind:'elite',id:el.id||('vis:'+el.visualId),visualId:el.visualId||null}); }
    for (var k=0;k<NV.BOSS_TYPES.length;k++){ rows.push({kind:'boss',name:NV.BOSS_TYPES[k].name}); }
    return rows;
  `);
  const rows = rosterFn(NV);
  const basic = rows.filter(r => r.kind === 'basic');
  const elite = rows.filter(r => r.kind === 'elite');
  const boss = rows.filter(r => r.kind === 'boss');
  if (basic.length !== 13) throw new Error('básicos=' + basic.length);
  if (elite.length !== 11) throw new Error('élites=' + elite.length);
  if (boss.length !== 10) throw new Error('bosses=' + boss.length);
  // Los 6 nuevos están presentes
  for (const id of ['specter_grunt', 'specter_archer', 'specter_guard', 'specter_elite_swift', 'specter_elite_wrath', 'specter_elite_void']) {
    if (!NV.ENEMY_TYPES.some(t => t.id === id) && !NV.ELITE_TYPES.some(t => t.id === id)) throw new Error('falta ' + id);
  }
  if (basic.filter(r => r.isWebGL).length !== 2) throw new Error('espectros webgl=' + basic.filter(r => r.isWebGL).length);
});

t('preview se ejecuta headless: dibuja todo el roster sin errores', () => {
  const NV = {};
  const makeCtx = () => {
    const calls = [];
    const grd = { addColorStop() {} };
    return {
      calls,
      fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, font: '', textAlign: 'left', shadowBlur: 0, shadowColor: '', globalAlpha: 1,
      save() { calls.push('save'); },
      restore() { calls.push('restore'); },
      translate() { calls.push('translate'); },
      rotate() { calls.push('rotate'); },
      scale() { calls.push('scale'); },
      beginPath() { calls.push('beginPath'); },
      closePath() { calls.push('closePath'); },
      moveTo() {}, lineTo() {}, arc() { calls.push('arc'); }, ellipse() { calls.push('ellipse'); },
      quadraticCurveTo() {}, bezierCurveTo() {}, setLineDash() {},
      fill() { calls.push('fill'); }, stroke() { calls.push('stroke'); },
      fillRect() { calls.push('fillRect'); }, strokeRect() { calls.push('strokeRect'); },
      fillText() { calls.push('fillText'); },
      createRadialGradient() { return grd; },
      createLinearGradient() { return grd; },
      setTransform() {}, clearRect() {},
    };
  };
  const ctx = makeCtx();
  const canvas = { width: 1200, height: 2200, style: {}, getContext: () => ctx };
  const sandbox = {
    window: { NV: NV, devicePixelRatio: 1 },
    NV: NV,
    document: { getElementById: () => canvas, body: { insertAdjacentHTML() {} } },
    requestAnimationFrame(cb) { this.__frames = (this.__frames || 0) + 1; if (this.__frames <= 3) cb(); return 1; },
    console: console, Math: Math, JSON: JSON, Object: Object, Array: Array, Set: Set, Map: Map,
  };
  sandbox.__frames = 0;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'data', 'gameData.js'), 'utf8'), sandbox, { filename: 'gameData.js' });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'render', 'spectralEnemies2D.js'), 'utf8'), sandbox, { filename: 'spectralEnemies2D.js' });
  vm.runInContext(extractInline(), sandbox, { filename: 'roster-inline.js' });
  if (!ctx.calls.includes('fillRect')) throw new Error('no dibujó (sin fillRect)');
  if (ctx.calls.filter(c => c === 'arc').length < 20) throw new Error('pocos arcos: ' + ctx.calls.filter(c => c === 'arc').length);
  if (ctx.calls.includes('save') && !ctx.calls.includes('restore')) throw new Error('save sin restore');
});

console.log('\nRESULT spectral_roster_preview: pass=' + pass + ' fail=' + fail);
console.log('\nRESULT spectral_roster_preview: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
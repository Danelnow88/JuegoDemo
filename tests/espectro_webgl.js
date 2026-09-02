// Tests headless del sistema de Espectros WebGL (sin WebGL real en Node):
// verifica shaders, API pura (hash/escala/offsets), fallback seguro y que
// el juego conserva el fallback Canvas2D intacto.
const fs = require('fs'), vm = require('vm');
let pass = 0, fail = 0;
function t(desc, fn) { try { fn(); pass++; console.log('  ok  ' + desc); } catch (e) { fail++; console.log('  FAIL ' + desc + ' -> ' + e.message); } }

function load() {
  const sbx = { window: { NV: {} }, console, Math };
  for (const f of ['js/render/espectroShader.js', 'js/render/espectroMesh.js']) {
    vm.runInNewContext(fs.readFileSync(f, 'utf8'), sbx, { filename: f });
  }
  return sbx.window.NV;
}

t('shaders del espectro existen y usan uTime + offset por enemigo', () => {
  const NV = load();
  const v = NV.ESPECTRO_VERTEX, f = NV.ESPECTRO_FRAGMENT;
  if (typeof v !== 'string' || typeof f !== 'string') throw new Error('shaders ausentes');
  for (const s of [v, f]) {
    if (!s.includes('uTime') || !s.includes('uOffset')) throw new Error('uniforms de fase ausentes');
  }
  if (!v.includes('projectionMatrix * modelViewMatrix')) throw new Error('vertex sin transform estandar');
  if (!f.includes('vec3(1.0, 0.5, 0.0)')) throw new Error('lava naranja intensa ausente');
  if (!f.includes('vec3(1.0, 0.0, 0.0)')) throw new Error('ojos rojos ausentes');
  if (!f.includes('vec3(0.02, 0.02, 0.02)')) throw new Error('tinta negra ausente');
  // Identidad visual prescripta: ojos frontales y halo matematico, lava en base, reflejo gris.
  if (!f.includes('vec2(0.35, 0.7)') || !f.includes('vec2(0.65, 0.7)')) throw new Error('ojos no frontales (y=0.7)');
  if (!f.includes('exp(-pow(')) throw new Error('halo de ojos no es degradado matematico');
  if (!f.includes('vUv.y < 0.25')) throw new Error('zona de lava incorrecta');
  if (!f.includes('vUv.y > 0.7')) throw new Error('sin reflejo gris superior');
});

t('hash de fase estable, determinista y distribuido (no sincronizados)', () => {
  const NV = load();
  const e = { x: 120, y: 300, radius: 10 };
  if (NV.espectroHash(e, 3) !== NV.espectroHash({ x: 120, y: 300, radius: 10 }, 3)) throw new Error('no determinista');
  const offs = [];
  for (let i = 0; i < 24; i++) {
    const o = NV.espectroHash({ x: 40 + i * 17, y: 60 + i * 23, radius: 10 }, 3);
    if (o < 0 || o >= 1) throw new Error('fuera de [0,1)');
    offs.push(o);
  }
  const uniq = new Set(offs.map((o) => o.toFixed(4)));
  if (uniq.size < 18) throw new Error('offsets poco distribuidos: ' + uniq.size);
});

t('escala acotada a [0.15, 0.6] sobre plano base 100x130 y elites dentro del tope', () => {
  const NV = load();
  for (const r of [1, 8, 10, 16, 36, 80]) {
    const s = NV.espectroScale({ radius: r });
    if (s < 0.15 || s > 0.6) throw new Error('r=' + r + ' escala=' + s);
  }
  const se = NV.espectroScale({ radius: 16, isElite: true });
  if (se < 0.15 || se > 0.6) throw new Error('elite escala=' + se);
  if (!(se > NV.espectroScale({ radius: 16 }))) throw new Error('elite no destaca');
});

t('inicializacion prescripta: tamano real, formula de camara exacta y capas', () => {
  const m = fs.readFileSync('js/render/espectroMesh.js', 'utf8');
  if (!m.includes('gameCanvas.clientWidth') || !m.includes('gameCanvas.clientHeight')) throw new Error('no usa clientWidth/clientHeight del canvas 2D');
  if (!m.includes('-frustumSize * aspect, frustumSize * aspect,') || !m.includes('frustumSize, -frustumSize,') || !m.includes('0.1, 1000')) throw new Error('formula de OrthographicCamera incompleta');
  if (!m.includes('camera.position.z = 10')) throw new Error('camara no queda fuera del plano de enemigos');
  if (!m.includes('alpha: true') || !m.includes("setClearColor(0x000000, 0)")) throw new Error('renderer sin alpha transparente');
  if (!m.includes('transparent: true') || !m.includes('depthWrite: false')) throw new Error('materiales sin transparent/depthWrite false');
  if (!m.includes('NV.ESPECTRO_DEBUG')) throw new Error('debug log sin flag');
});

t('renderWebGL corre DESPUES del renderizado 2D en game.js', () => {
  const g = fs.readFileSync('js/game.js', 'utf8');
  const iPass2 = g.indexOf('for (const e of enemies) if (e.atkFlash > 0) drawEnemy(e);');
  const iBoss = g.indexOf('if (boss && !boss.dead) drawBoss();');
  const iUpdate = g.indexOf('NV.espectroUpdate(enemies);');
  if (iPass2 < 0 || iBoss < 0 || iUpdate < 0) throw new Error('llamadas ausentes');
  if (!(iPass2 < iUpdate && iBoss < iUpdate)) throw new Error('renderWebGL no va despues del 2D');
});

t('sin WebGL (Node): overlay inactivo, update no-op y sin mutar enemigos', () => {
  const NV = load();
  if (NV.espectroActive()) throw new Error('activo sin boot');
  const e = { x: 100, y: 100, radius: 10, isElite: false, atkFlash: 0 };
  const snapshot = JSON.stringify(e);
  NV.espectroEnsure({ W: 900, H: 520 }); // no debe lanzar sin document/THREE
  NV.espectroUpdate([e, e, e]);
  NV.espectroUpdate([], 0.016);
  NV.espectroDispose();
  if (JSON.stringify(e) !== snapshot) throw new Error('update muto enemigos');
});

t('fallback Canvas2D intacto: game.js conserva drawEnemy y las dos pasadas', () => {
  const g = fs.readFileSync('js/game.js', 'utf8');
  if (!g.includes('NV.drawEnemy(ctx, e, frame, player, NV.rhythm)')) throw new Error('wrapper Canvas2D ausente');
  if (!g.includes('for (const e of enemies) if (!(e.atkFlash > 0)) drawEnemy(e);')) throw new Error('primera pasada ausente');
  if (!g.includes('for (const e of enemies) if (e.atkFlash > 0) drawEnemy(e);')) throw new Error('segunda pasada ausente');
  if (!g.includes('NV.espectroEnsure({ W, H })') || !g.includes('NV.espectroUpdate(enemies)')) throw new Error('integracion del overlay ausente');
});

t('index.html carga los modulos del espectro antes de game.js', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  const iShader = html.indexOf('js/render/espectroShader.js');
  const iMesh = html.indexOf('js/render/espectroMesh.js');
  const iGame = html.indexOf('js/game.js');
  if (iShader < 0 || iMesh < 0) throw new Error('script tags ausentes');
  if (!(iShader < iMesh && iMesh < iGame)) throw new Error('orden de carga incorrecto');
});

t('sin post-procesado prohibido ni emojis en el sistema nuevo', () => {
  for (const f of ['js/render/espectroShader.js', 'js/render/espectroMesh.js']) {
    const c = fs.readFileSync(f, 'utf8');
    if (/EffectComposer|UnrealBloomPass/.test(c)) throw new Error(f + ' usa post-procesado prohibido');
    if (/[\uD800-\uDFFF]/.test(c) || c.includes('\u26A1')) throw new Error(f + ' contiene emojis');
  }
});

console.log('RESULT espectro_webgl: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);

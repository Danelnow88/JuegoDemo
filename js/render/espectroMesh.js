// ===== RENDER: gestor de Espectros WebGL (Three.js) =====
// Overlay WebGL superpuesto al canvas 2D del juego. OPTIMIZADO PARA RENDIMIENTO:
// - Cero post-procesado y cero pasadas de composicion: el brillo de ojos
//   y lava se simula con THREE.AdditiveBlending en Sprites (1 quad c/u, material compartido).
// - Geometria barata: UN PlaneGeometry compartido por todos los enemigos (12x16 segs).
// - Escala pequeña por enemigo (0.15 a 0.3) y offset de animacion individual (hash
//   estable) para que nunca se muevan sincronizados.
// - Camera ORTOGRAFICA con frustum simetrico centrado en el origen y
//   frustumSize = mitad del alto logico del mundo (1 unidad = 1 px del mundo 2D).
// - Fallback automatico: sin WebGL/Three el overlay no se activa y el render
//   Canvas2D de siempre sigue funcionando (los tests headless no se afectan).
(() => {
  'use strict';
  const NV = window.NV;

  const THREE_CDN = 'https://unpkg.com/three@0.160.0/build/three.module.js';
  const MAX_ATTEMPTS = 3; // reintentos de carga del CDN antes de fallback permanente

  let st = null;          // estado del overlay (null => inactivo)
  let attempts = 0;
  let booting = false;
  let time = 0;

  // Hash estable por enemigo (misma formula que render/enemies.js): determinista,
  // solo lectura de e.x/e.y/radius. NO muta datos de gameplay.
  NV.espectroHash = function (e, salt) {
    const v = Math.sin((e.x || 0) * 12.9898 + (e.y || 0) * 78.233 + (e.radius || 1) * 37.719 + salt * 43.1234) * 43758.5453;
    return v - Math.floor(v);
  };

  NV.espectroActive = function () { return !!(st && st.ready); };

  // Escala del espectro: multiplicador sobre el plano base de 100x130 px del
  // mundo logico (1 unidad = 1 px, ver boot). Pequeno por diseno; elite destaca.
  NV.espectroScale = function (e) {
    const s = ((e.radius || 10) * 2.6 / 130) * ((e.isElite) ? 1.15 : 1);
    return Math.max(0.15, Math.min(0.6, s));
  };

  // Carga perezosa del módulo Three (ESM por CDN) desde un script clásico.
  // Si falla (offline/sin WebGL), el juego sigue en Canvas2D sin errores.
  NV.espectroEnsure = function (opts) {
    if (NV.espectroActive() || booting) return;
    if (attempts >= MAX_ATTEMPTS) return;
    booting = true;
    try {
      import(THREE_CDN)
        .then((THREE) => { boot(THREE, opts || {}); booting = false; })
        .catch(() => { booting = false; attempts++; });
    } catch (e) {
      booting = false;
      attempts++;
    }
  };

  function makeGlowTexture(THREE, r, g, b) {
    const size = 64;
    const cv = document.createElement('canvas');
    cv.width = size; cv.height = size;
    const c2 = cv.getContext('2d');
    const grad = c2.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(' + r + ',' + g + ',' + b + ',1)');
    grad.addColorStop(0.4, 'rgba(' + r + ',' + g + ',' + b + ',0.45)');
    grad.addColorStop(1, 'rgba(' + r + ',' + g + ',' + b + ',0)');
    c2.fillStyle = grad;
    c2.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(cv);
    tex.needsUpdate = true;
    return tex;
  }

  function boot(THREE, opts) {
    try {
      if (!THREE || !THREE.WebGLRenderer) return;
      // Mundo logico del gameplay (GW/GH en game.js): las posiciones e.x/e.y viven ahi.
      const W = opts.W || 900, H = opts.H || 520;
      const host = document.querySelector('.game-box');
      const gameCanvas = document.getElementById('game');
      if (!host || !gameCanvas) return;

      // Tamano REAL de visualizacion del canvas 2D (sin valores fijos). El buffer
      // 2D es dinamico (game.js resizeCanvas), asi que el WebGL lo sigue.
      const width = gameCanvas.clientWidth || W;
      const height = gameCanvas.clientHeight || H;

      const canvas = document.createElement('canvas');
      canvas.className = 'espectro-canvas';
      host.appendChild(canvas);

      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'high-performance' });
      renderer.setPixelRatio(1);
      renderer.setSize(width, height, false);
      renderer.setClearColor(0x000000, 0); // transparencia total: el fondo lo dibuja el 2D

      // Formula EXACTA prescripta: frustum simetrico centrado en el origen.
      // frustumSize = mitad del alto logico del mundo (520/2 = 260) => 1 unidad = 1 px
      // y el frustum horizontal (-fs*aspect .. fs*aspect) cubre exactamente el mundo.
      const frustumSize = H / 2;
      const aspect = width / height;
      const camera = new THREE.OrthographicCamera(
        -frustumSize * aspect, frustumSize * aspect,
        frustumSize, -frustumSize,
        0.1, 1000
      );
      camera.position.z = 10; // fuera del plano de los enemigos (z = 0)

      const scene = new THREE.Scene();
      const geometry = new THREE.PlaneGeometry(1, 1, 12, 16); // compartida; escala px por mesh

      // Materiales de sprites COMPARTIDOS (additive): glow de ojos y de lava.
      const eyeTex = makeGlowTexture(THREE, 255, 30, 20);
      const lavaTex = makeGlowTexture(THREE, 255, 110, 20);
      const eyeMat = new THREE.SpriteMaterial({ map: eyeTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.9 });
      const lavaMat = new THREE.SpriteMaterial({ map: lavaTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.55 });

      st = { THREE, renderer, scene, camera, geometry, pool: new Map(), eyeMat, lavaMat, gameCanvas, W, H, lastW: width, lastH: height, ready: true };
      canvas.style.display = 'none'; // visible solo cuando hay espectros que dibujar
    } catch (e) {
      st = null; // sin WebGL: fallback Canvas2D permanente
    }
  }

  // Sincroniza el pool de meshes con el array de enemigos del gameplay y renderiza.
  // NUNCA muta los enemigos: solo lee e.x/e.y/radius/isElite/atkFlash.
  // dt interno por performance.now(): el draw() de game.js no maneja delta.
  let lastNow = 0;
  NV.espectroUpdate = function (enemies, dtOpt) {
    if (!NV.espectroActive()) return;
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    const dt = (typeof dtOpt === 'number') ? dtOpt
      : (lastNow > 0 ? Math.min(0.1, (now - lastNow) / 1000) : 0);
    lastNow = now;
    time += dt;
    const { scene, pool, renderer, camera } = st;

    // Seguimiento del tamano REAL del canvas 2D (su buffer es dinamico en game.js).
    const cw = st.gameCanvas.clientWidth, ch = st.gameCanvas.clientHeight;
    if (cw > 0 && ch > 0 && (cw !== st.lastW || ch !== st.lastH)) {
      renderer.setSize(cw, ch, false);
      st.lastW = cw; st.lastH = ch;
    }

    // Z-order como en Canvas2D: atacantes (atkFlash) al final (encima).
    const alive = [];
    for (const e of enemies) if (!(e.atkFlash > 0)) alive.push(e);
    for (const e of enemies) if (e.atkFlash > 0) alive.push(e);

    const seen = new Set();
    for (const e of alive) {
      seen.add(e);
      let rec = pool.get(e);
      if (!rec) {
        const material = new THREE.ShaderMaterial({
          vertexShader: NV.ESPECTRO_VERTEX,
          fragmentShader: NV.ESPECTRO_FRAGMENT,
          uniforms: {
            uTime: { value: 0 },
            uOffset: { value: NV.espectroHash(e, 3) * 6.28318 },
            uIntensity: { value: e.isElite ? 1.6 : 1.0 },
          },
          transparent: true,   // humo: no tapa el fondo del canvas 2D
          depthWrite: false,   // sin oclusion entre espectros
        });
        const mesh = new THREE.Mesh(st.geometry, material);
        // Sprites aditivos: glow "bloom-free" de ojos y base de lava (materiales compartidos).
        const eyeL = new THREE.Sprite(st.eyeMat);
        const eyeR = new THREE.Sprite(st.eyeMat);
        const glow = new THREE.Sprite(st.lavaMat);
        scene.add(mesh); scene.add(eyeL); scene.add(eyeR); scene.add(glow);
        rec = { mesh, eyeL, eyeR, glow };
        pool.set(e, rec);
      }
      // Coordenadas de gameplay (e.x/e.y en px, y-down) -> camara centrada (y-up).
      const s = NV.espectroScale(e);
      const w2 = s * 100, h2 = s * 130;      // tamano del espectro en px del mundo logico
      const r = e.radius || 10;
      const x = e.x - st.W / 2;
      const y = st.H / 2 - e.y;
      const phase = rec.mesh.material.uniforms.uOffset.value;
      const bob = Math.sin(time * 1.5 + phase) * 2; // flotacion sutil individual (px)
      rec.mesh.position.set(x, y + bob, 0);
      rec.mesh.scale.set(w2, h2, 1);
      rec.mesh.material.uniforms.uTime.value = time * (0.85 + NV.espectroHash(e, 9) * 0.3) + phase;
      // Ojos (UV 0.35/0.65, y 0.65 => sobre el centro) + glow de lava en la base.
      rec.eyeL.position.set(x - w2 * 0.15, y + bob + h2 * 0.15, 0.01);
      rec.eyeR.position.set(x + w2 * 0.15, y + bob + h2 * 0.15, 0.01);
      rec.eyeL.scale.set(r * 0.9, r * 0.9, 1);
      rec.eyeR.scale.set(r * 0.9, r * 0.9, 1);
      rec.glow.position.set(x, y + bob - h2 * 0.3, 0);
      rec.glow.scale.set(r * 2.2, r * 1.3, 1);
    }

    // Limpieza: enemigos muertos salen del pool y liberan su material (geometria compartida).
    for (const [e, rec] of pool) {
      if (!seen.has(e)) {
        scene.remove(rec.mesh); scene.remove(rec.eyeL); scene.remove(rec.eyeR); scene.remove(rec.glow);
        rec.mesh.material.dispose();
        pool.delete(e);
      }
    }

    const canvas = renderer.domElement;
    if (alive.length === 0) {
      if (canvas.style.display !== 'none') canvas.style.display = 'none';
      return; // sin enemigos: ni un draw call
    }
    if (canvas.style.display !== 'block') canvas.style.display = 'block';

    // DEBUG (prescripcion): activar con NV.ESPECTRO_DEBUG = true en consola.
    // Loguea cantidad, camara, posicion del primer espectro y uTime antes de renderizar.
    if (NV.ESPECTRO_DEBUG) {
      const first = pool.get(alive[0]);
      console.log('Renderizando WebGL. Enemigos: ', alive.length,
        'Camara: ', camera.position,
        'Posicion del primer espectro: ', first && first.mesh.position,
        'uTime: ', first && first.mesh.material.uniforms.uTime.value);
    }

    renderer.render(scene, camera);
  };

  NV.espectroDispose = function () {
    if (!st) return;
    for (const [, rec] of st.pool) {
      st.scene.remove(rec.mesh); st.scene.remove(rec.eyeL); st.scene.remove(rec.eyeR); st.scene.remove(rec.glow);
      rec.mesh.material.dispose();
    }
    st.pool.clear();
    st.geometry.dispose();
    st.renderer.dispose();
    if (st.renderer.domElement && st.renderer.domElement.parentNode) {
      st.renderer.domElement.parentNode.removeChild(st.renderer.domElement);
    }
    st = null;
  };
})();

// ===== RENDER: gestor de Espectros WebGL (Three.js) =====
// Overlay WebGL superpuesto al canvas 2D del juego. OPTIMIZADO PARA RENDIMIENTO:
// - Cero post-procesado y cero pasadas de composicion: el brillo de ojos
//   y lava se simula con THREE.AdditiveBlending en Sprites (1 quad c/u, material compartido).
// - Geometria barata: UN PlaneGeometry compartido por todos los enemigos (12x16 segs).
// - Escala pequeña por enemigo (0.15 a 0.3) y offset de animacion individual (hash
//   estable) para que nunca se muevan sincronizados.
// - Camera ORTOGRAFICA mapeada 1:1 con el mundo 2D (1 unidad de escena = 100 px),
//   asi las posiciones del gameplay (e.x/e.y) se trasladan sin transformaciones.
// - Fallback automatico: sin WebGL/Three el overlay no se activa y el render
//   Canvas2D de siempre sigue funcionando (los tests headless no se afectan).
(() => {
  'use strict';
  const NV = window.NV;

  const THREE_CDN = 'https://unpkg.com/three@0.160.0/build/three.module.js';
  const PPU = 100;      // pixeles por unidad de escena
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

  // Escala del espectro: pequeña, proporcional a la hitbox, acotada a [0.15, 0.3].
  NV.espectroScale = function (e) {
    const s = (e.radius || 10) * 0.022 * ((e.isElite) ? 1.35 : 1);
    return Math.max(0.15, Math.min(0.3, s));
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
      const W = opts.W || 900, H = opts.H || 520;
      const host = document.querySelector('.game-box');
      if (!host) return;

      const canvas = document.createElement('canvas');
      canvas.className = 'espectro-canvas';
      canvas.width = W; canvas.height = H;
      host.appendChild(canvas);

      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'high-performance' });
      renderer.setSize(W, H, false);
      renderer.setPixelRatio(1); // 1:1 con el canvas del juego: cientos de enemigos sin costo extra

      // Ortografica mapeada al mundo 2D: x px/PPU hacia la derecha, y px/PPU hacia abajo.
      const camera = new THREE.OrthographicCamera(0, W / PPU, 0, -H / PPU, 0.1, 10);
      camera.position.z = 5;
      const scene = new THREE.Scene();

      const geometry = new THREE.PlaneGeometry(1, 1, 12, 16); // compartida por TODOS los meshes

      // Materiales de sprites COMPARTIDOS (additive): glow de ojos y de lava.
      const eyeTex = makeGlowTexture(THREE, 255, 30, 20);
      const lavaTex = makeGlowTexture(THREE, 255, 110, 20);
      const eyeMat = new THREE.SpriteMaterial({ map: eyeTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.9 });
      const lavaMat = new THREE.SpriteMaterial({ map: lavaTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.55 });

      st = { THREE, renderer, scene, camera, geometry, pool: new Map(), eyeMat, lavaMat, W, H, ready: true };
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
          transparent: true,
          depthWrite: false,
        });
        const mesh = new THREE.Mesh(st.geometry, material);
        // Sprites aditivos: glow "bloom-free" de ojos y base de lava (materiales compartidos).
        const eyeL = new THREE.Sprite(st.eyeMat);
        const eyeR = new THREE.Sprite(st.eyeMat);
        const glow = new THREE.Sprite(st.lavaMat);
        scene.add(mesh); scene.add(eyeL); scene.add(eyeR); scene.add(glow);
        rec = { mesh, eyeL, eyeR, glow, eyeSide: NV.espectroHash(e, 5) * 0.02 };
        pool.set(e, rec);
      }
      const scale = NV.espectroScale(e);
      const x = e.x / PPU, y = -(e.y / PPU);
      const phase = rec.mesh.material.uniforms.uOffset.value;
      // Flotacion sutil individual (el offset de fase evita movimiento sincronizado).
      const bob = Math.sin(time * 1.5 + phase) * 0.02;
      rec.mesh.position.set(x, y + bob, 0);
      rec.mesh.scale.set(scale, scale, scale);
      rec.mesh.material.uniforms.uTime.value = time * (0.85 + NV.espectroHash(e, 9) * 0.3) + phase;
      // Ojos (UV 0.35/0.65, y 0.65 => sobre el centro) + glow de lava en la base.
      const eyeY = y + bob + scale * 0.15;
      const eyeSep = scale * 0.15 + rec.eyeSide;
      rec.eyeL.position.set(x - eyeSep, eyeY, 0.01);
      rec.eyeR.position.set(x + eyeSep, eyeY, 0.01);
      const eyeS = scale * 0.35;
      rec.eyeL.scale.set(eyeS, eyeS, 1);
      rec.eyeR.scale.set(eyeS, eyeS, 1);
      rec.glow.position.set(x, y + bob - scale * 0.35, 0);
      rec.glow.scale.set(scale * 0.9, scale * 0.55, 1);
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

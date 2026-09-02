// ===== RENDER OPCIONAL: Espectro Lite WebGL =====
// Modulo completamente aislado del motor Canvas2D. Al cargarse solo define una
// API: NO crea renderer, canvas, geometria, materiales ni bucle de animacion.
// Para inicializarlo, un hook externo debe activar NV.ESPECTRO_LITE_ACTIVE y
// llamar explicitamente a NV.initEspectroLite(THREE, opciones).
(() => {
  'use strict';
  const NV = window.NV;

  // Inerte por defecto. No se activa implicitamente aunque Three.js exista.
  if (typeof NV.ESPECTRO_LITE_ACTIVE !== 'boolean') NV.ESPECTRO_LITE_ACTIVE = false;

  const VERTEX_SHADER = `
    uniform float uTime;
    uniform float uBeat;
    uniform float uPhase;
    uniform float uForm;
    varying vec2 vUv;

    void main() {
      vUv = uv;
      vec3 pos = position;
      float phaseSeed = fract(sin(uPhase * 17.17) * 43758.5453);
      float speed = mix(0.72, 1.38, phaseSeed);
      float t = uTime * speed + uPhase;

      // Factor de forma por arquetipo, sin agregar vertices:
      // bajo = ancho/redondeado; medio = capa rasgada; alto = largo/delgado.
      if (uForm < 0.33) {
        pos.x *= mix(1.18, 1.05, uForm / 0.33);
        pos.y *= 0.90;
      } else if (uForm < 0.75) {
        float medium = (uForm - 0.33) / 0.42;
        pos.x *= mix(1.0, 0.84, medium);
        pos.x += sin(vUv.y * 24.0 + uPhase) * (1.2 + medium * 1.1);
      } else {
        float longForm = (uForm - 0.75) / 0.25;
        pos.x *= mix(0.74, 0.52, longForm);
        pos.y *= mix(1.08, 1.22, longForm);
      }

      // Movimiento organico sutil: conserva la escala miniatura del plano.
      pos.x += sin(vUv.y * 7.0 + t * 1.8) * mix(1.2, 2.8, uForm);
      pos.y += cos(vUv.x * 9.0 + t * 1.3) * mix(0.7, 1.6, uForm);
      if (vUv.y < 0.25) {
        pos.x += sin(t * 2.4 + vUv.x * 12.0) * mix(1.4, 3.5, uForm);
      }
      pos *= 1.0 + clamp(uBeat, 0.0, 1.0) * 0.025;

      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `;

  const FRAGMENT_SHADER = `
    uniform float uTime;
    uniform float uBeat;
    uniform float uPhase;
    uniform float uForm;
    uniform vec3 uVariant;
    varying vec2 vUv;

    void main() {
      float phaseSeed = fract(sin(uPhase * 17.17) * 43758.5453);
      float inkSpeed = mix(0.72, 1.38, phaseSeed);
      float fireSpeed = mix(0.65, 1.55, fract(phaseSeed * 7.31));
      float eyeSpeed = mix(1.2, 4.8, fract(phaseSeed * 13.7));
      float t = uTime * inkSpeed + uPhase;
      vec3 ink = vec3(0.02, 0.02, 0.02);
      vec3 variant = clamp(uVariant, vec3(0.0), vec3(1.0));
      vec3 lavaVariant = vec3(variant.r, max(variant.g, 0.04), variant.b * 0.35);
      vec3 lava = mix(vec3(1.0, 0.5, 0.0), lavaVariant, 0.58);
      vec3 eyeColor = mix(vec3(1.0, 0.0, 0.0), variant, 0.78);
      vec3 color = ink;

      // Lava naranja en la base: dos senos baratos simulan fuego interior.
      if (vUv.y < 0.25) {
        float fireT = uTime * fireSpeed + uPhase;
        float fireA = sin(fireT * 7.0 + vUv.x * 22.0) * 0.5 + 0.5;
        float fireB = sin(fireT * -10.0 + vUv.x * 39.0) * 0.5 + 0.5;
        float fire = max(fireA, fireB);
        color = mix(ink, lava, fire * (0.72 + clamp(uBeat, 0.0, 1.0) * 0.18));
      } else if (vUv.y > 0.7) {
        // Reflejo gris superior para volumen, sin luces.
        float rim = smoothstep(0.7, 1.0, vUv.y);
        color = mix(ink, vec3(0.13, 0.13, 0.15), rim * 0.35);
      }

      // Ojos frontales: color y parpadeo varian por enemigo mediante fase/variant.
      float eyeDrift = sin(uTime * eyeSpeed + uPhase) * 0.012;
      float blink = 0.72 + 0.28 * (sin(uTime * eyeSpeed * 1.7 + uPhase) * 0.5 + 0.5);
      vec2 eyeCenterL = vec2(0.35, 0.7) + vec2(eyeDrift, 0.0);
      vec2 eyeCenterR = vec2(0.65, 0.7) + vec2(eyeDrift, 0.0);
      float eyeL = distance(vUv, eyeCenterL);
      float eyeR = distance(vUv, eyeCenterR);
      float eye = min(eyeL, eyeR);
      float core = 1.0 - smoothstep(0.035, 0.05, eye);
      float halo = 1.0 - smoothstep(0.05, 0.13, eye);
      color += eyeColor * halo * 0.45 * blink;
      color = mix(color, eyeColor, core * blink);

      // Silueta por fragmento: variedad real sin subdividir PlaneGeometry.
      float centeredX = abs(vUv.x - 0.5);
      float halfWidth;
      float bottomEdge;
      if (uForm < 0.33) {
        // Fantasma clasico: hombros redondos y base ancha.
        halfWidth = 0.34 + (1.0 - vUv.y) * 0.13;
        halfWidth -= smoothstep(0.72, 1.0, vUv.y) * 0.12;
        bottomEdge = 0.035 + (sin(vUv.x * 25.0 + uPhase) * 0.5 + 0.5) * 0.045;
      } else if (uForm < 0.75) {
        // Capa desgarrada: bordes dentados y picos desparejos abajo.
        halfWidth = 0.31 + sin(vUv.y * 31.0 + uPhase) * 0.055;
        halfWidth += sin(vUv.y * 57.0 - uPhase * 0.7) * 0.025;
        bottomEdge = 0.035 + (sin(vUv.x * 43.0 + uPhase * 2.0) * 0.5 + 0.5) * 0.17;
      } else {
        // Lamento: cuerpo delgado, alargado y base de hebras largas.
        halfWidth = 0.19 + (1.0 - vUv.y) * 0.075;
        halfWidth += sin(vUv.y * 22.0 + uPhase) * 0.018;
        bottomEdge = 0.015 + (sin(vUv.x * 61.0 + uPhase * 2.4) * 0.5 + 0.5) * 0.23;
      }
      float sideMask = 1.0 - smoothstep(halfWidth - 0.025, halfWidth, centeredX);
      float bottomMask = smoothstep(bottomEdge - 0.018, bottomEdge + 0.018, vUv.y);
      float topMask = 1.0 - smoothstep(0.92, 1.0, vUv.y);
      float alpha = sideMask * bottomMask * topMask;
      gl_FragColor = vec4(color, alpha * 0.94);
    }
  `;

  function clampScale(value) {
    return Math.max(0.2, Math.min(0.4, Number(value) || 0.2));
  }

  function clamp01(value, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(0, Math.min(1, number));
  }

  function normalizeVariant(value) {
    const source = Array.isArray(value) ? value : [1, 0, 0];
    return [
      clamp01(source[0], 1),
      clamp01(source[1], 0),
      clamp01(source[2], 0),
    ];
  }

  function makeGlowTexture(THREE, colorA, colorB) {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, colorA);
    gradient.addColorStop(1, colorB);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 32, 32);
    return new THREE.CanvasTexture(canvas);
  }

  class EspectroLite {
    constructor(THREE, options) {
      this.THREE = THREE || null;
      this.options = options || {};
      this.initialized = false;
      this.entries = [];
      this.scene = null;
      this.camera = null;
      this.renderer = null;
      this.geometry = null;
      this.bodyMaterial = null;
      this.eyeMaterial = null;
      this.lavaMaterial = null;
    }

    // Debe invocarse explicitamente y solo funciona con el flag habilitado.
    init() {
      if (!NV.ESPECTRO_LITE_ACTIVE || this.initialized) return false;
      const THREE = this.THREE;
      const host = this.options.host;
      if (!THREE || !host || typeof document === 'undefined') return false;

      const width = this.options.width || host.clientWidth || 1;
      const height = this.options.height || host.clientHeight || 1;
      const canvas = this.options.canvas || document.createElement('canvas');
      canvas.className = canvas.className || 'espectro-lite-canvas';
      if (!canvas.parentNode) host.appendChild(canvas);

      this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
      this.renderer.setPixelRatio(1);
      this.renderer.setSize(width, height, false);
      this.renderer.setClearColor(0x000000, 0);
      this.scene = new THREE.Scene();
      this.camera = this.options.camera || new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
      this.camera.position.z = 10;

      // PlaneGeometry sin segmentos extra: 2 triangulos, compartida por todos.
      // Base 100x130 unidades: con escala 0.2-0.4 produce espectros de 20x26
      // a 40x52 unidades, visibles en un mundo Canvas2D de 900x520.
      this.geometry = new THREE.PlaneGeometry(100, 130);
      this.bodyMaterial = new THREE.ShaderMaterial({
        vertexShader: VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER,
        uniforms: {
          uTime: { value: 0 },
          uBeat: { value: 0 },
          uPhase: { value: 0 },
          uForm: { value: 0 },
          uVariant: { value: new THREE.Vector3(1, 0, 0) },
        },
        transparent: true,
        depthWrite: false,
      });

      // Sprites aditivos compartidos: brillo sin pasadas extra de pantalla.
      const eyeTexture = makeGlowTexture(THREE, 'rgba(255,0,0,1)', 'rgba(255,0,0,0)');
      const lavaTexture = makeGlowTexture(THREE, 'rgba(255,128,0,1)', 'rgba(255,80,0,0)');
      this.eyeMaterial = new THREE.SpriteMaterial({ map: eyeTexture, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
      this.lavaMaterial = new THREE.SpriteMaterial({ map: lavaTexture, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
      this.initialized = true;
      return true;
    }

    // Crea un espectro solo por pedido del consumidor. Escala 0.2-0.4.
    createEnemy(options) {
      if (!NV.ESPECTRO_LITE_ACTIVE || !this.initialized) return null;
      const THREE = this.THREE;
      const opts = options || {};
      const phase = Number(opts.phase) || 0;
      const form = clamp01(opts.form, 0);
      const variant = normalizeVariant(opts.variantColor);
      const material = this.bodyMaterial.clone();
      material.uniforms = {
        uTime: { value: 0 },
        uBeat: { value: 0 },
        uPhase: { value: phase },
        uForm: { value: form },
        uVariant: { value: new THREE.Vector3(variant[0], variant[1], variant[2]) },
      };
      const body = new THREE.Mesh(this.geometry, material);
      const eyeL = new THREE.Sprite(this.eyeMaterial);
      const eyeR = new THREE.Sprite(this.eyeMaterial);
      const lava = new THREE.Sprite(this.lavaMaterial);
      const scale = clampScale(opts.scale);
      body.scale.set(scale, scale, 1);
      body.position.set(Number(opts.x) || 0, Number(opts.y) || 0, Number(opts.z) || 0);
      eyeL.position.set(body.position.x - scale * 15, body.position.y + scale * 20, body.position.z + 0.01);
      eyeR.position.set(body.position.x + scale * 15, body.position.y + scale * 20, body.position.z + 0.01);
      lava.position.set(body.position.x, body.position.y - scale * 35, body.position.z + 0.01);
      eyeL.scale.set(scale * 35, scale * 35, 1);
      eyeR.scale.set(scale * 35, scale * 35, 1);
      lava.scale.set(scale * 90, scale * 50, 1);
      this.scene.add(body, eyeL, eyeR, lava);
      const entry = { body, eyeL, eyeR, lava, phase, form, variant };
      this.entries.push(entry);
      return entry;
    }

    // Sincroniza exclusivamente la representación visual. No muta el enemigo
    // Canvas2D ni conoce vida, IA, colisiones o lógica de oleadas.
    syncEnemy(entry, options) {
      if (!NV.ESPECTRO_LITE_ACTIVE || !this.initialized || !entry) return false;
      const opts = options || {};
      const x = Number(opts.x) || 0;
      const y = Number(opts.y) || 0;
      const z = Number(opts.z) || 0;
      const scale = clampScale(opts.scale);
      entry.body.position.set(x, y, z);
      entry.body.scale.set(scale, scale, 1);
      entry.eyeL.position.set(x - scale * 15, y + scale * 20, z + 0.01);
      entry.eyeR.position.set(x + scale * 15, y + scale * 20, z + 0.01);
      entry.lava.position.set(x, y - scale * 35, z + 0.01);
      entry.eyeL.scale.set(scale * 35, scale * 35, 1);
      entry.eyeR.scale.set(scale * 35, scale * 35, 1);
      entry.lava.scale.set(scale * 90, scale * 50, 1);
      return true;
    }

    removeEnemy(entry) {
      if (!entry) return false;
      const index = this.entries.indexOf(entry);
      if (index < 0) return false;
      if (this.scene) this.scene.remove(entry.body, entry.eyeL, entry.eyeR, entry.lava);
      entry.body.material.dispose();
      this.entries.splice(index, 1);
      return true;
    }

    clearEnemies() {
      while (this.entries.length) this.removeEnemy(this.entries[this.entries.length - 1]);
      return true;
    }

    setVisible(visible) {
      if (!this.renderer || !this.renderer.domElement) return false;
      this.renderer.domElement.style.display = visible ? 'block' : 'none';
      return true;
    }

    // No tiene bucle propio: el hook externo decide cuándo actualizar.
    update(time, beat) {
      if (!NV.ESPECTRO_LITE_ACTIVE || !this.initialized) return false;
      const t = Number(time) || 0;
      const b = Math.max(0, Math.min(1, Number(beat) || 0));
      for (const entry of this.entries) {
        entry.body.material.uniforms.uTime.value = t;
        entry.body.material.uniforms.uBeat.value = b;
        entry.body.material.uniforms.uPhase.value = entry.phase;
        entry.body.material.uniforms.uForm.value = entry.form;
        entry.body.material.uniforms.uVariant.value.set(entry.variant[0], entry.variant[1], entry.variant[2]);
      }
      this.renderer.render(this.scene, this.camera);
      return true;
    }

    dispose() {
      this.clearEnemies();
      if (this.geometry) this.geometry.dispose();
      if (this.bodyMaterial) this.bodyMaterial.dispose();
      if (this.eyeMaterial) {
        if (this.eyeMaterial.map) this.eyeMaterial.map.dispose();
        this.eyeMaterial.dispose();
      }
      if (this.lavaMaterial) {
        if (this.lavaMaterial.map) this.lavaMaterial.map.dispose();
        this.lavaMaterial.dispose();
      }
      if (this.renderer) this.renderer.dispose();
      this.initialized = false;
      this.scene = null;
      this.camera = null;
      this.renderer = null;
      return true;
    }
  }

  // API publica: crear/actualizar requiere llamadas externas explícitas.
  NV.EspectroLite = EspectroLite;
  NV.espectroLite = null;

  NV.initEspectroLite = function (THREE, options) {
    if (!NV.ESPECTRO_LITE_ACTIVE) return null;
    if (!NV.espectroLite) NV.espectroLite = new EspectroLite(THREE, options);
    return NV.espectroLite.init() ? NV.espectroLite : null;
  };

  NV.updateEspectroLite = function (time, beat) {
    if (!NV.ESPECTRO_LITE_ACTIVE || !NV.espectroLite) return false;
    return NV.espectroLite.update(time, beat);
  };
})();
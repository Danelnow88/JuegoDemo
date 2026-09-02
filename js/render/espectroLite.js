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
    varying vec2 vUv;

    void main() {
      vUv = uv;
      vec3 pos = position;
      float t = uTime + uPhase;

      // Movimiento organico sutil: conserva la escala miniatura del plano.
      pos.x += sin(pos.y * 7.0 + t * 1.8) * 0.025;
      pos.y += cos(pos.x * 9.0 + t * 1.3) * 0.018;
      if (vUv.y < 0.25) {
        pos.x += sin(t * 2.4 + vUv.x * 12.0) * 0.035;
      }
      pos *= 1.0 + clamp(uBeat, 0.0, 1.0) * 0.025;

      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `;

  const FRAGMENT_SHADER = `
    uniform float uTime;
    uniform float uBeat;
    uniform float uPhase;
    varying vec2 vUv;

    void main() {
      float t = uTime + uPhase;
      vec3 ink = vec3(0.02, 0.02, 0.02);
      vec3 lava = vec3(1.0, 0.5, 0.0);
      vec3 color = ink;

      // Lava naranja en la base: dos senos baratos simulan fuego interior.
      if (vUv.y < 0.25) {
        float fireA = sin(t * 7.0 + vUv.x * 22.0) * 0.5 + 0.5;
        float fireB = sin(t * -10.0 + vUv.x * 39.0) * 0.5 + 0.5;
        float fire = max(fireA, fireB);
        color = mix(ink, lava, fire * (0.72 + clamp(uBeat, 0.0, 1.0) * 0.18));
      } else if (vUv.y > 0.7) {
        // Reflejo gris superior para volumen, sin luces.
        float rim = smoothstep(0.7, 1.0, vUv.y);
        color = mix(ink, vec3(0.13, 0.13, 0.15), rim * 0.35);
      }

      // Dos ojos frontales rojos con halo matematico barato.
      float eyeL = distance(vUv, vec2(0.35, 0.7));
      float eyeR = distance(vUv, vec2(0.65, 0.7));
      float eye = min(eyeL, eyeR);
      float core = 1.0 - smoothstep(0.035, 0.05, eye);
      float halo = 1.0 - smoothstep(0.05, 0.13, eye);
      color += vec3(1.0, 0.0, 0.0) * halo * 0.45;
      color = mix(color, vec3(1.0, 0.0, 0.0), core);

      // Bordes transparentes: el plano no se percibe como rectangulo.
      float alpha = smoothstep(0.0, 0.08, vUv.x)
        * smoothstep(1.0, 0.92, vUv.x)
        * smoothstep(0.0, 0.08, vUv.y)
        * smoothstep(1.0, 0.94, vUv.y);
      gl_FragColor = vec4(color, alpha * 0.94);
    }
  `;

  function clampScale(value) {
    return Math.max(0.2, Math.min(0.4, Number(value) || 0.2));
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
      const material = this.bodyMaterial.clone();
      material.uniforms = {
        uTime: { value: 0 },
        uBeat: { value: 0 },
        uPhase: { value: phase },
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
      const entry = { body, eyeL, eyeR, lava, phase };
      this.entries.push(entry);
      return entry;
    }

    // No tiene bucle propio: el hook externo decide cuándo actualizar.
    update(time, beat) {
      if (!NV.ESPECTRO_LITE_ACTIVE || !this.initialized) return false;
      const t = Number(time) || 0;
      const b = Math.max(0, Math.min(1, Number(beat) || 0));
      for (const entry of this.entries) {
        entry.body.material.uniforms.uTime.value = t;
        entry.body.material.uniforms.uBeat.value = b;
      }
      this.renderer.render(this.scene, this.camera);
      return true;
    }

    dispose() {
      for (const entry of this.entries) {
        this.scene.remove(entry.body, entry.eyeL, entry.eyeR, entry.lava);
        entry.body.material.dispose();
      }
      this.entries.length = 0;
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
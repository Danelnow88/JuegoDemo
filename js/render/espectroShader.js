// ===== RENDER: shaders del Espectro de Tinta (WebGL) =====
// Shaders puros (strings) para el overlay WebGL de enemigos. Sin post-procesado:
// el "bloom" de ojos/lava se logra con AdditiveBlending en sprites (espectroMesh.js).
// Basado en el prototipo "Espectro Sombrío" adaptado a PlaneGeometry (barato):
// geometría plana liviana en lugar de conos densos, y cero pasadas de post-proceso.
(() => {
  'use strict';
  const NV = window.NV;

  // Vertex: deforma el plano para humo/tinta líquida. PlaneGeometry(1,1,12,16)
  // => posiciones en [-0.5, 0.5]. uOffset = fase individual por enemigo para que
  // nunca se muevan sincronizados; uTime lo alimenta game.js (un solo rAF).
  // Amplitudes SUTILES: el movimiento no debe romper la escala de enemigos chicos.
  NV.ESPECTRO_VERTEX = `
    uniform float uTime;
    uniform float uOffset;
    varying vec2 vUv;

    void main() {
      vUv = uv;
      vec3 pos = position;
      float t = uTime + uOffset;

      // Silueta de espectro: mas ancho abajo (base de lava), estrecho arriba.
      float taper = mix(0.45, 1.0, smoothstep(0.0, 1.0, uv.y));
      pos.x *= taper;

      // Ondulacion sutil de humo/tinta liquida (amplitudes acotadas).
      float waveX = sin(pos.y * 10.0 + t * 2.0) * 0.05;
      float waveY = cos(pos.x * 16.0 + t * 1.5) * 0.035;
      pos.x += waveX;
      pos.y += waveY;

      // La base se "derrite" apenas hacia afuera (gota de tinta).
      if (uv.y < 0.25) {
        pos.x += sin(t * 3.0 + pos.y * 24.0) * 0.10;
        pos.y -= cos(t * 2.0) * 0.03;
      }

      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `;

  // Fragment: identidad "Espectro de Tinta y Lava". Todo el brillo se calcula
  // por matematica en el shader (sin post-procesado/bloom): cuerpo negro azabache,
  // lava naranja parpadeante por UV en la base, ojos rojos puros al frente con
  // halo por degradado matematico, y reflejo gris sutil arriba para volumen.
  NV.ESPECTRO_FRAGMENT = `
    uniform float uTime;
    uniform float uOffset;
    uniform float uIntensity;
    varying vec2 vUv;

    void main() {
      float t = uTime + uOffset;

      // Colores de identidad.
      vec3 colorTinta = vec3(0.02, 0.02, 0.02);  // negro azabache profundo
      vec3 colorLava = vec3(1.0, 0.5, 0.0);      // naranja intenso
      vec3 colorBorde = vec3(0.16, 0.16, 0.18);  // reflejo gris (volumen sin luces)

      // === ZONA INFERIOR (vUv.y < 0.25): LAVA PARPADEANTE ===
      if (vUv.y < 0.25) {
        // Fuego por superposicion de senos: dos frecuencias + pulso vertical.
        float fuego = sin(vUv.x * 22.0 + t * 7.0) * 0.5 + 0.5;
        fuego = max(fuego, sin(vUv.x * 41.0 - t * 11.0) * 0.5 + 0.5);
        float pulso = sin(t * 5.0 + vUv.x * 9.0) * 0.5 + 0.5;
        float mezcla = fuego * (0.55 + 0.35 * pulso);
        colorTinta = mix(colorTinta, colorLava, mezcla * 0.85 * uIntensity);
      } else if (vUv.y > 0.7) {
        // === ZONA SUPERIOR (vUv.y > 0.7): REFLEJO GRIS SUTIL ===
        // Degradado hacia los bordes superiores para volumen 3D sin luces.
        float reflejo = smoothstep(0.7, 1.0, vUv.y);
        float brillo = sin(vUv.y * 6.0 + t * 0.8) * 0.5 + 0.5;
        colorTinta = mix(colorTinta, colorBorde, reflejo * (0.35 + 0.15 * brillo));
      } else {
        // === CUERPO: TINTA NEGRA con leve textura viva ===
        float brillo = sin(vUv.y * 5.0 + t) * 0.05;
        colorTinta = mix(colorTinta, colorBorde, brillo * 0.6);
      }

      // === OJOS FRONTALES Y BRILLANTES (x 0.35 / 0.65, y 0.7) ===
      float dL = distance(vUv, vec2(0.35, 0.7));
      float dR = distance(vUv, vec2(0.65, 0.7));
      float dOjo = min(dL, dR);
      float radio = 0.05;
      if (dOjo < radio) {
        // Nucleo del ojo: ROJO PURO.
        colorTinta = vec3(1.0, 0.0, 0.0);
      } else {
        // Halo/resplandor por degradado matematico (cero post-procesado).
        float halo = exp(-pow((dOjo - radio) / (radio * 1.8), 2.0));
        colorTinta += vec3(1.0, 0.05, 0.0) * halo * 0.6 * uIntensity;
      }

      // Humo: alfa se desvanece en el borde superior y laterales (sin rectangulo duro).
      float alpha = 0.92;
      alpha *= smoothstep(0.0, 0.18, vUv.y);
      alpha *= smoothstep(1.0, 0.94, vUv.y);
      alpha *= smoothstep(0.0, 0.06, vUv.x) * smoothstep(1.0, 0.94, vUv.x);

      gl_FragColor = vec4(colorTinta, alpha);
    }
  `;
})();

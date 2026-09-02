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

      // Ondulacion de humo/tinta liquida.
      float waveX = sin(pos.y * 10.0 + t * 2.0) * 0.08;
      float waveY = cos(pos.x * 16.0 + t * 1.5) * 0.06;
      pos.x += waveX;
      pos.y += waveY;

      // La base se "derrite" hacia afuera (gota de tinta).
      if (uv.y < 0.25) {
        pos.x += sin(t * 3.0 + pos.y * 24.0) * 0.18;
        pos.y -= cos(t * 2.0) * 0.05;
      }

      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `;

  // Fragment: cuerpo negro azabache, lava naranja parpadeante por UV abajo y
  // ojos rojos brillantes al frente (halo suave para fundir con sprites aditivos).
  NV.ESPECTRO_FRAGMENT = `
    uniform float uTime;
    uniform float uOffset;
    uniform float uIntensity;
    varying vec2 vUv;

    void main() {
      float t = uTime + uOffset;

      // Colores base: tinta negra profunda + lava naranja + borde gris oscuro.
      vec3 colorTinta = vec3(0.02, 0.02, 0.02);
      vec3 colorLava = vec3(1.0, 0.4, 0.0);
      vec3 colorBorde = vec3(0.1, 0.1, 0.1);

      // Zona inferior: lava parpadeante (ruido matematico por UV).
      if (vUv.y < 0.3) {
        float fuego = sin(vUv.x * 20.0 + t * 8.0) * 0.5 + 0.5;
        fuego = max(fuego, sin(vUv.x * 40.0 - t * 12.0) * 0.5 + 0.5);
        colorTinta = mix(colorTinta, colorLava, fuego * 0.8 * uIntensity);
      } else {
        // Zona media/superior: tinta con leves reflejos que dan volumen.
        float brillo = sin(vUv.y * 5.0 + t) * 0.05;
        colorTinta = mix(colorTinta, colorBorde, brillo);
      }

      // Ojos rojos brillantes: nucleo solido + halo (calculados por UV).
      float dL = distance(vUv, vec2(0.35, 0.65));
      float dR = distance(vUv, vec2(0.65, 0.65));
      float dOjo = min(dL, dR);
      float radio = 0.05;
      if (dOjo < radio) {
        colorTinta = vec3(1.0, 0.0, 0.0);
      } else {
        float halo = smoothstep(radio * 2.4, radio, dOjo);
        colorTinta += vec3(1.0, 0.05, 0.0) * halo * 0.55 * uIntensity;
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

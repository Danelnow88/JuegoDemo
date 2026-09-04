# AUDITORÍA VISUAL — RAZA ESPECTRAL

Documento de partida para la **remasterización visual progresiva** de la raza espectral.
Fase 1 (auditoría) + plan concreto. No se propone migración masiva.

## 0. Contexto técnico del juego
- Motor procedural **Canvas 2D** (`js/render/canvas.js`) + `requestAnimationFrame` en `js/game.js`.
- Resolución lógica fija **900×520**, escala responsive vía `scaleX/sY`.
- Arquitectura IIFE con API compartida en `window.NV`; orden de carga en `index.html`:
  `core/*` → `data/*` → `audio/synth.js` → `ui/*` → `render/*` → `engine/*` → `game.js`.
- Tests headless con Node: `npm test` → `tests/run_all.js` (≈70 archivos).
- **Three.js NO está instalado**: se carga vía CDN (`three@0.160.0` import-map) y se publica
  `NV.THREE_READY`. No hay `node_modules` de Three para el juego.

## 1/2/3/4/5. Definición, creación, spawn, archivos involucrados, shaders
- **Datos**: `js/data/gameData.js`
  - `specter_lite` (ESPECTRO LÚTIL): shape `specter`, minWave 16, weight 0.08, `specterVariant:'lite'`, color `#ff6a24`.
  - `specter_core` (ESPECTRO NÚCLEO): shape `specter`, minWave 20, weight 0.06, `specterVariant:'core'`, color `#ff2244`.
  - Plus 3 élites espectrales (`specter_elite_swift/wrath/void`), `spectralElite:true`.
- **Spawn**: `js/engine/enemies.js` → `NV.spawnEnemy`. Filtra `shape==='specter'` si
  `SPECTER_ENABLED===false`; `forceTypeId` para testing.
- **Archivos clave**:
  `js/render/espectroLite.js` (WebGL shader + fallback 2D), `js/game.js` (puente/bridge + draw),
  `js/render/enemies.js` (drawEnemy guard), `js/render/spectralEnemies2D.js` (auras/profiles 2D),
  `index.html` (2 canvases apilados + importmap Three.js),
  `previews/espectro-lite-single-preview.html` y `previews/spectral-roster-preview.html` (herramientas de preview).
- **Shaders involucrados** (`espectroLite.js`): `VERTEX_SHADER` y `FRAGMENT_SHADER` como strings;
  programa único compartido. No hay shaders fragment separados para ojos/fuego (todo en un pass).
## 6. Canvases / WebGL / Three.js / librerías / texturas
- **Librería**: Three.js 0.160.0 vía CDN import-map (`index.html`). NO npm.
- **Renderer**: `THREE.WebGLRenderer({alpha:true, antialias:false})`, `pixelRatio=1`, clear transparente.
- **Canvases**: `#game` (Canvas2D) + `#specter-overlay` (WebGL) apilados; el overlay es único para todos los espectros (NO un canvas por enemigo).
- **Geometría**: `PlaneGeometry(100,130)` (2 triángulos), **compartida**.
- **Materiales**: 1 `ShaderMaterial` clonado por enemigo (nuevo set de uniforms, MISMO programa) + sprites: 3 materiales/sprites aditivos `eyeMaterial`, `lavaMaterial` con texturas 32×32 generadas on-the-fly (`makeGlowTexture`).
- **Texturas**: solo las 32×32 radiales; no hay assets externos.
- **Texturas/buffers**: no hay render targets ni postprocessing.

## 7. Blending / transparencia / ruido / deformación / trail / fuego / partículas
- Blending: `AdditiveBlending` para sprites ojos/lava; blending por defecto (`Normal`) + `transparent:true` + `depthWrite:false` para el plano ShaderMaterial (alpha ≈0.98).
- Deformación: wobble en **vertex shader** (senos sobre UV). No hay ruido textural (solo senos).
- **Trail**: NINGÚN trail propio del espectro; existe un sistema de trails en Canvas2D de `js/game.js` (usado por player/meteor), pero el espectro WebGL no lo usa.
- **Partículas**: el shader no genera partículas; solo el fallback 2D `drawSpecter2D` dibuja partículas orbitales.
- **Fuego**: fire seno barato en base (`vUv.y<0.25`) + sprite lava aditivo fijo.
- **Distorsión**: NINGUNA (no hay efecto de fondo alterado).
- **Render order (z DOM)**: overlay WebGL `#specter-overlay` encima de TODO el Canvas2D (fondo, enemigos, balas, jugador, HUD). Los espectros se dibujan por encima de balas y jugador.

## 8/9. Qué funciona bien vs. qué está "raro"
### Funciona
- Separación lógica/render: el Specter no roba gameplay (colisiones + IA viven en Canvas2D).
- Bridge WebGL→Canvas2D robusto (try/catch, fallbacks, flags por consola).
- Silueta por fragmento → base irregular real (no sprite estampado).
- Ojos distance-field + sprite aditivo: bloom barato, parpadeo y fase por enemigo.
- Pulso musical `uBeat` + `uPhase` por enemigo → variedad real sin más geometría.
- Fallback `drawSpecter2D` replica la identidad (aurora, estrella puntiaguda, ojos tracking, partículas orbitales): **ya contiene el ADN de la nueva raza**.
- Arquitectura modular (`render/*` + `engine/*`) facilita un EnemyRenderer.

### Problemas
1. **Contraste CRÍTICO**: ink `#00000...` (0.035,0.035,0.04) sobre fondo `#01030d` → gris sobre negro; se pierde. Solo ojos/lava leen.
2. Escala/form/variant **fijos globales** (`SPECTER_SCALE=0.4`, `SPECTER_FORM=0.35`, `SPECTER_VARIANT=[1,0,0]`) → lite y core idénticos.
3. Sprites ojos/lava **no siguen** la deformación del vertex → pueden desincronizarse (wobble ±3.5 u en bottom edge).
4. `drawEnemy` salta ENTODO cuando mesh WebGL existe → **suprime** `atkFlash`, `slowUntil`, `hitFlash`. El espectro paga hits que no se ven.
5. Sin movement-coupling: base no se estira/estira ni arrastra con velocidad.
6. Sin trail ni partículas WebGL; lava sprite plano.
7. Z-order: overlay encima de balas/jugador.

## 10. Dificultad de apreción en gameplay
- Contraste negro/en-negro. Aparece oleada 16 `weight:0.08` → raro, pocos ojos dominan.
- Sin hit-feedback visual. Sin trail/dirección → no percibe amenaza.
- Size fijo (~40px) vs hitbox radius 12 → mismatch percibido.

## 11. Reutilizable
- Shader de silueta/fragmento (cuerpo del espectro).
- Fallback `drawSpecter2D` (auras, estrella puntiaguda, ojos tracking, partículas orbitales) → piloto automático del nuevo estilo.
- Profiles/auras/rings/coronas de `spectralEnemies2D.js` → plantilla de atributos visuales.
- Bridge WebGL↔Canvas2D y flags (`SPECTER_ENABLED`, `ESPECTRO_LITE_ACTIVE`, `toggleSpectralEnemyMode`).
- Sistema de ritmo `NV.rhythm` (kick/onset/bass/mids/highs/hats/energy) → `uBeat` + temblor por banda.
## 12–16. Adaptación de la referencia, base desgarrada, puntas, ojos, fuego, negro+neón
- **Body negro/translúcido**: ink actual `#00000..`≈`(0.035,0.035,0.04)` (gris claro). Falta translucidez interior.
- **Capucha/cabeza redondeada**: `uForm<0.33` ancho; pero forma fija (0.35). Sin capucha distintiva.
- **Ojos rojos**: sprites aditivos + `eyeColor` red. Sprites no siguen malla → desincronización.
- **Base desgarrada**: `bottomEdge` seno (amp ~0.035–0.23 UV) → ondulación global, NO puntas independientes.
- **Llamas en grietas**: fire seno (`<0.25`) + sprite lava plano. Sin scroll UV ascendente ni particulas en grietas.
- **Movimiento**: wobble vertex in-situ. Sin estirado, inclinación, arrastrar base.
- **Negro + neón**: estrategia propuesta → NO RGB. Usar `uEnvColor` (color dominante del visualizador/música) para rim sutil + partículas absorben el color del fondo (no RGB del cuerpo). Body negro/neutro, ojos/rojo, energía naranja.

| referencia | actual | hueco |
|---|---|---|
| cabeza redondeada | uForm ancho | sin capucha |
| cuerpo negro translúcido | ink gris claro | falta translucidez |
| silueta base irregular | bottomEdge seno | amplitud baja, sin filamentos |
| fuego en grietas | fire seno + sprite | sin scroll ni particulas |
| movimiento orgánico | wobble | sin velocity coupling |

## 17. Integrar negro + neón
- `uEnvColor` uniform (del color dominante de la paleta neón actual, expuesto por `rhythm`/synth) → rim sutil sobre el negro, absorción parcial de partículas.
- `drawSpecter2D` fallback ya recibe `rhythm` → puede leer paleta. Body negro, ojos/rojo, energía naranja.
- Partículas: pueden tomar `color` del fondo actual (snapshot) → "absorben color del fondo".

## 18. Renderer reutilizable (EnemyLogic + EnemyRenderer)
- **Base existente**: `engine/enemies.js` (lógica/IA) × `render/enemies.js|spectralEnemies2D.js` (render). `drawEnemy()` ya elige renderer vía `shape`/`visualId`/`enemyTypeId`.
- Patrón:
  - `EnemyLogic`: posición/hp/hitbox/AI (invariante).
  - `EnemyRenderer`: `render(ctx, e, frame, player, rhythm)` con body (mask), eyes, tendrils, fire, particles, trail, distortion, variant.
- Propuesta refactorización:
  - `js/render/spectral/race.js` → DNA de variantes (SPECTER/WRAITH/WATCHER/HARBINGER).
  - `js/render/spectral/renderer3D.js` → params shader por variante (reemplaza constantes globales).
  - `js/render/spectral/renderer2D.js` → fallback Canvas2D (reemplaza parcial de `drawSpecter2D`).

## 19. Visual Lab
- `previews/enemy-visual-lab.html` reutilizando patrones de `spectral-roster-preview.html` + `espectro-lite-single-preview.html`.
- Controles: Enemy [Basic|Elite|Boss|Specter], AI/Movement ON/OFF, Speed 0–100%, Invincible/Damage/Collision ON/OFF, Scale slider, Particles/Shader/Trail toggles, Background = fondo de juego real.
- DEBUG ONLY. No toca `game.js`.

## 20/21. Riesgos técnicos y de rendimiento
- Técnicos: no romper bridge WebGL↔Canvas2D; suites `tests/espectro_lite.js`,
  `tests/specter_threejs_integration.js`, `tests/spectral_*.js` deben seguir verdes; `npm test` verde.
  El canvas `#specter-overlay` es único → **no crear un canvas por enemigo**; reusar renderer/scene.
- Rendimiento: hoy 1 programa WebGL + geometry compartida + 3 sprites por enemigo (eficiente).
  Límite ~60 enemigos. Estrategia LOD: 1–10 full; 10–30 menos partículas; 30–60 trail reducido;
  60+ shader simplificado. Pools de partículas (`particles` de `game.js`).
- Render Order: overlay encima del todo. Solución simple: mejorar contraste (rim/neón interno) en vez de moverlo;
  alternativa futura: offscreen Canvas2D leído por `drawImage` en el pipeline (para hand-drawn).

# PLAN DE REMASTERIZACIÓN ESPECTRAL (fases pequeñas, 0 riesgo gameplay)

### F0 — Baseline (0 riesgo)
- `npm test` verde. Arrancar juego, llegar a wave 16, observar espectros.
- Screenshots: overlay encima de todo; sin hit-feedback; contraste negro-negro.

### F1 — Enemy Visual Lab (debug only)
- `previews/enemy-visual-lab.html` reutilizando patrón de `spectral-roster-preview.html`.
- Controles solicitados (Enemy/AI/Movement/Speed/Invincible/.../Scale/Particles/Shader/Trail/Background).
- DEBUG ONLY. No toca `game.js`.
- Verificación: abre en navegador, lista variantes, cero errores de consola.

### F2 — Arquitectura reutilizable + ADN de raza
- `js/render/spectral/race.js`: DNA de variantes (SPECTER/WRAITH/WATCHER/HARBINGER) →
  mapeo `form/scale/variant/eyeVariant`.
- Refactorizar `espectroLite.js`: aceptar `form/scale/variantColor` por tipo en vez de
  constantes globales (`SPECTER_FORM/_SCALE/_VARIANT`). La signatura `initEspectroLite(THREE, opts)`
  y `createEnemy({...})` se conservan (tests `espectro_lite.js` seguirán verdes).
- `js/render/spectral/renderer2D.js`: fallback Canvas2D con misma DNA (reemplaza parcial de
  `drawSpecter2D`).

### F3 — Remaster del Specter base
- Contraste: rim interno sutil + `uEnvColor` (del visualizador) → cuerpo negro legible.
- Body translúcido con **value-noise interior** (no textura: `fract(sin(...))`).
- Ojos unificados al shader (eliminar sprites duplicados): parpadeo irregular + tracking lookX/Y.
- Base: **tendrils shader** (senos faseados) + límite irregular.
- Fire en grietas: scroll UV vertical + value-noise + spawn de partículas.
- Velocity coupling: `uVelX/uVelY` → estirado de la punta + inclinación del cuerpo.

### F4 — Las 4 variantes
- Mapear DNA: SPECTER (base, `form≈0.35`), WRAITH (`form≈0.8`, tendrils largos, más trail),
  WATCHER (`form≈0.2`, ancho, ojos dominantes, humo, menos fuego),
  HARBINGER/elite (más capas, partículas + distorsión, puntas largas).
- Re-mapear `specterVariant` → DNA visual; **sin tocar IA/comportamiento** en `ENEMY_TYPES`.

### F5 — Integración visual + feedback
- Reemplazar el *white-flash* Canvas2D: shader de "flash energía" cuando espectro es golpeado
  (el guard `isEnemyRenderedByLite(e)` salta `atkFlash`/`hitFlash` → proponer pasar
  `e.hitFlash`/`e.atkFlash` al shader vía uniform).
- Trail para espectros: partículas `trails` de Canvas2D **o** fade de posición anterior en shader.
- LOD por densidad: 1–10 full; 10–30 menos partículas; 30–60 trail reducido; 60+ shader simplificado;
  silueta+ojos siempre visibles.

### F6 — Verificación final (checklist "no romper")
- `npm test` verde. Juego arranca. Oleadas funcionan. Colisiones funcionan.
- Jugador funciona · audio funciona · visualizador funciona · tienda funciona.
- Consola sin errores nuevos · rendimiento razonable (FPS estable en wave 16+).

> **Three.js ya existe (CDN).** No se instala nada nuevo sin autorización. Se propone usarlo
> como hoy (un renderer compartido sobre `#specter-overlay`); solo si se necesitara distorsión
> de pantalla (heat distortion) o partículas/pantalla con postprocessing se justificaría
> Three.js + pass adicional (costo: ~180KB gzipped CDN, 1 draw fullscreen), y se demostraría
> convivencia (render offscreen → `drawImage` en Canvas2D como capa intermedia).
<!--chunk-->
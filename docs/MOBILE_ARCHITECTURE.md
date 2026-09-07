# Arquitectura móvil: métricas del mundo

## Reference world

`NV.worldMetrics.refW` / `NV.worldMetrics.refH` son las dimensiones de diseño de referencia. Representan el lienzo lógico original del juego y los valores contra los que se diseñaron HUD, efectos, balance visual y pruebas legacy.

Actualmente: `refW = 900`, `refH = 520`.

## Runtime view

`NV.worldMetrics.viewW` / `NV.worldMetrics.viewH` son las dimensiones lógicas visibles por el renderer/cámara. La conversión de entrada `screenToGame()` y la inversa `gameToScreen()` proyectan contra esta vista lógica.

Sin flags: `viewW = 900`, `viewH = 520`, `viewX = 0`, `viewY = 0`.

La política normal sigue siendo **CONTAIN**: escala uniforme, sin crop, sin stretch y con pillarbox/letterbox cuando corresponda.

### Stage 3: Dynamic View + Dynamic Arena

Detrás de `?dynamicView=1`, solo en móvil landscape, el renderer usa una vista lógica más ancha para llenar el ancho físico disponible sin estirar. Desde Stage 3, la arena jugable móvil dinámica se expande para coincidir con esa vista.

La fórmula autoritativa vive en `js/core/viewport.js`:

```js
viewH = refH; // 520
viewW = Math.max(refW, viewH * (physicalStageWidth / physicalStageHeight));
arenaW = viewW;
arenaH = viewH;
viewX = 0;
viewY = 0;
scale = physicalStageHeight / viewH;
```

Ejemplo `915x412`:

```js
viewW ≈ 1154.85
viewH = 520
arenaW ≈ 1154.85
arenaH = 520
viewX = 0
viewY = 0
```

Esto hace visible y jugable todo el rango `0..viewW x 0..520`, evitando paredes invisibles internas alrededor del antiguo `x=900`.

## Gameplay arena

`NV.worldMetrics.arenaW` / `NV.worldMetrics.arenaH` son los límites reales de gameplay: clamp del jugador, spawns, culling de proyectiles, posiciones de jefe y demás reglas de arena.

Sin flag y en desktop: `arenaW = 900`, `arenaH = 520`.

Con `?dynamicView=1` en móvil landscape: `arenaW = viewW`, `arenaH = 520`.

## Estado actual y futuro

Sin flag:

```js
ref = view = arena = 900x520
```

Con `?dynamicView=1` en móvil landscape:

```js
ref = 900x520
view = arena = dynamicViewW x 520
```

Balance:

- `arenaW` dinámica solo está aprobada para `?dynamicView=1` + móvil + landscape.
- No compensar dificultad automáticamente al expandir arena: no cambiar spawn rate, MAX_ENEMIES, velocidades, salud, daño, rangos ni cantidades hasta medir impacto real.

## Regla para código nuevo

Evitar `900` / `520` crudos cuando exista una semántica clara:

- diseño/base legacy: usar `NV.worldMetrics.refW/refH`;
- render/cámara/vista visible: usar `NV.worldMetrics.viewW/viewH/viewX/viewY`;
- gameplay/bounds/spawns/culling: usar `NV.worldMetrics.arenaW/arenaH`;
- DOM/UI móvil: no depender de coordenadas de arena salvo intención explícita.
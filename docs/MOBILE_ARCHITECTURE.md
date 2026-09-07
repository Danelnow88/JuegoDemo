# Arquitectura móvil

Este documento es el **contrato autoritativo de compatibilidad móvil**.

## Política de producción

La activación es:

```js
dynamicViewActive = isMobile && orientation === 'landscape' && !dynamicViewForcedOff;
```

- Móvil landscape activa Dynamic World View y Dynamic Arena automáticamente.
- `?dynamicView=1` sigue aceptado como alias compatible, pero no es necesario.
- `?dynamicView=0` fuerza el modo contain legacy exclusivamente como fallback de depuración.
- Desktop nunca activa la arena dinámica por defecto ni por `?dynamicView=1`.
- Móvil portrait conserva el overlay de orientación y métricas legacy.

## Reference world

```text
refW = 900
refH = 520
```

Estas métricas representan constantes de diseño y compatibilidad legacy. No son necesariamente los bounds runtime en móvil landscape.

## Desktop

```text
view = 900x520
arena = 900x520
viewX = 0
viewY = 0
```

La presentación usa escala uniforme contain, sin stretch ni crop. Letterbox o pillarbox puede aparecer según el contenedor.

## Mobile landscape

La fórmula Stage 3 no debe alterarse:

```js
viewH = 520;
viewW = Math.max(900, 520 * stageAspect);

arenaW = viewW;
arenaH = 520;

viewX = 0;
viewY = 0;
```

Consecuencias:

- el mundo llena el ancho físico disponible;
- no hay stretching;
- no hay cover cropping;
- no quedan gutters laterales del contain antiguo;
- la arena se expande horizontalmente junto con la vista;
- las proporciones en unidades de mundo permanecen consistentes;
- `screenToGame()` y `gameToScreen()` proyectan contra la vista dinámica.

## Mobile portrait

Portrait no activa Dynamic World View. Se mantienen `view = arena = 900x520` y el overlay `#rotateOverlay` solicita orientación horizontal. No sustituir esta política por un segundo layout de gameplay portrait sin una decisión arquitectónica explícita.

## Semántica de métricas

- Diseño/reference legacy: `NV.worldMetrics.refW/refH`.
- Renderer, cámara y región visible: `viewW/viewH/viewX/viewY`.
- Gameplay, clamps, spawns y culling: `arenaW/arenaH`.
- UI DOM móvil: coordenadas CSS del viewport físico y safe areas.

**La UI móvil es UI del viewport físico, no UI en coordenadas de mundo.** Joystick, botones, opciones, menús y tiendas no deben posicionarse usando `arenaW` o `viewW` salvo una necesidad visual explícita.

## Lobby responsive

El lobby usa una única estructura DOM y la misma fuente `NV.characterList()` en desktop y móvil.

- Desktop presenta cuatro cards espaciosas dentro del frame de referencia.
- Móvil landscape convierte el overlay de menú en layout físico de viewport completo.
- Header, roster y acciones son regiones estructurales separadas.
- Las cuatro cards permanecen simultáneamente visibles en los viewports objetivo normales.
- Las descripciones móviles muestran una jerarquía útil de hasta cuatro líneas; no se resuelve el espacio reduciendo todo globalmente.
- `JUGAR`, `MEJORAS PERMANENTES` y `AJUSTES` pertenecen al área de acciones compartida.

Añadir un personaje a `NV.CHARACTERS` y `CHARACTER_ORDER` lo incorpora al mismo renderer de lobby para ambas presentaciones. No crear arrays de personajes móviles.

## HUD físico móvil

- Top-left: información esencial de run desde el HUD DOM compartido.
- Top-center: combo Canvas cuando está activo.
- Top-right: única entrada `☰`.
- Bottom-left: joystick.
- Bottom-right: `USAR`, `SHIFT` y `ESPECIAL`.
- Bottom-center: chips DOM de arma y consumible.

El panel Canvas completo de arma/consumible se omite en móvil porque duplicaba los mismos datos y competía con `☰`. Desktop conserva el renderer Canvas completo.

## Contrato automático de compatibilidad móvil

### A. World feature

Ejemplos: enemigo, boss, proyectil, pickup, meteorito o VFX de mundo.

Comportamiento esperado:

- hereda automáticamente métricas de vista/arena mediante los sistemas existentes;
- usa `arena*` para bounds y `view*` para render/cámara;
- requiere **cero código de gameplay específico para móvil**.

Si una world feature necesita ramas por modelo de teléfono, la integración viola el contrato.

### B. Data feature

Ejemplos: definición de arma, consumible, enemigo, boss o artículo de tienda.

Comportamiento esperado:

- se declara en la fuente de datos existente;
- aparece automáticamente en UI data-driven donde el sistema lo soporte;
- puede requerir renderer, icono, audio o handler específico por ID, pero no una variante móvil de gameplay.

### C. UI feature

Ejemplos: widget HUD, minimapa, árbol de habilidades o panel nuevo.

Requisito:

- debe existir una decisión explícita para presentación desktop y móvil;
- debe definir propiedad por estado y coordenadas físicas en móvil;
- no debe crear estado de gameplay duplicado.

### D. Input feature

Ejemplos: nueva acción, tecla o gesto.

Requisito:

- debe mapearse primero a la abstracción lógica compartida;
- teclado, touch u otros dispositivos alimentan el mismo canal;
- la acción y su física se implementan una sola vez.

## Limitaciones de balance

La arquitectura dinámica no incluye compensación automática de dificultad:

1. una arena más ancha puede reducir la presión de enemigos;
2. la densidad aparente de spawns puede ser menor;
3. bosses usan mayormente amplitudes absolutas en unidades de mundo;
4. pickups y meteoritos pueden quedar más distribuidos.

No modificar tasas, cantidades, velocidades, daño, salud, rangos ni patrones durante trabajo de viewport salvo pedido explícito de balance.
# Arquitectura

Este documento describe la arquitectura de producción actual. El código es la verificación final cuando una implementación y la documentación difieren.

## Modelo general

El proyecto no tiene framework ni bundler. `index.html` carga módulos JavaScript IIFE en orden y estos comparten APIs mediante `window.NV`. `js/game.js` es el coordinador del loop y del estado, pero delega datos, render, audio y sistemas de gameplay en módulos especializados.

Orden conceptual de carga:

1. capacidades y núcleo (`js/core/`);
2. datos (`js/data/`);
3. audio y referencias DOM;
4. renderers (`js/render/`);
5. sistemas de gameplay (`js/engine/`);
6. coordinador (`js/game.js`);
7. adaptación táctil (`js/ui/mobileControls.js`).

## Game logic

Existe **una sola implementación compartida de gameplay**. Desktop y móvil ejecutan el mismo loop, entidades, colisiones, oleadas, tiendas, progresión y balance.

- `js/game.js`: estado de sesión, loop, transiciones, composición de sistemas y adaptadores.
- `js/engine/`: enemigos, bosses, balas, armas, pickups, consumibles, meteoritos, drones, habilidades, ritmo y VFX lógicos.
- No existe ni debe crearse una variante de gameplay específica para móvil.

## World metrics

`NV.worldMetrics`, administrado exclusivamente por `js/core/viewport.js`, separa tres conceptos:

| Métrica | Responsabilidad |
| --- | --- |
| `refW/refH` | Constantes de diseño y referencia legacy. |
| `viewW/viewH/viewX/viewY` | Rectángulo lógico visible para renderer, cámara y conversión de coordenadas. |
| `arenaW/arenaH` | Bounds reales de gameplay, spawns, clamps y culling. |

La referencia es `900x520`. Desktop mantiene vista y arena en esa medida. Móvil landscape expande horizontalmente vista y arena según el contrato de [arquitectura móvil](MOBILE_ARCHITECTURE.md).

## Render

- El pipeline de producción principal usa Canvas2D sobre `#game`.
- `js/render/` dibuja fondo, enemigos, bosses, jugador, proyectiles, HUD e iconos.
- `#specter-overlay`, `js/render/espectroLite.js` y Three.js permanecen disponibles como bridge/overlay espectral legacy y opcional.
- `NV.ESPECTRO_LITE_ACTIVE` es `false` por defecto; los espectros de producción usan el renderer Canvas2D.
- Cámara y transformaciones visuales consumen métricas `view*`, no bounds de arena por conveniencia.

## Input

- El teclado actualiza los canales lógicos definidos en `js/game.js`.
- `js/ui/mobileControls.js` traduce joystick, botones y selectores táctiles a esos mismos canales mediante `NV.input`.
- La física y las acciones no se duplican por plataforma.
- Toda acción nueva debe añadirse a la abstracción lógica compartida y luego mapearse desde cada dispositivo aplicable.

## UI

- Desktop usa la presentación base de `index.html` y `css/styles.css`.
- Móvil se activa por capacidades mediante `js/core/capabilities.js` y clases `nv-mobile`, `nv-portrait` y `nv-landscape`.
- `js/game.js` publica `data-game-state` y `data-paused` en `<html>`.
- CSS y `js/ui/mobileControls.js` controlan visibilidad y adaptación; no mantienen un segundo estado de juego.
- La UI DOM móvil se posiciona en coordenadas del viewport físico y respeta safe areas. No pertenece al sistema de coordenadas del mundo.

La propiedad por estado está documentada en [UI States](UI_STATES.md).

## Data

- `js/data/gameData.js`: personajes, armas, proyectiles, enemigos, élites, bosses, mejoras permanentes y eventos de oleada.
- `js/data/consumables.js`: definiciones y orden de consumibles.
- `js/data/balance.js`: constantes de tuning y topes.
- La tienda consume `NV.WEAPONS`, `NV.consumableList()` y las definiciones de mejoras existentes.
- Renderers de iconos y audio pueden tener comportamiento específico por ID, con fallback cuando corresponde.

## Límites entre sistemas

- **Core** detecta capacidades y calcula viewport; no contiene gameplay.
- **Data** declara contenido y tuning; no controla DOM ni loop.
- **Engine** opera sobre estado y métricas recibidas; no decide layout físico.
- **Render** representa estado; no altera balance ni bounds.
- **UI** presenta estado y traduce interacción; no duplica física.
- **Game coordinator** conecta sistemas y conserva el estado de sesión compartido.

## Limitaciones actuales

- Una arena móvil más ancha puede modificar dificultad efectiva, densidad aparente y distancias de encuentro.
- Spawn density no está compensada por ancho.
- Los patrones de bosses usan mayormente amplitudes absolutas en unidades de mundo.
- Pickups y meteoritos se distribuyen sobre el ancho de arena y pueden sentirse más dispersos.
- No cambiar estos factores durante refactors arquitectónicos salvo que una tarea solicite balance explícitamente.

## Deuda técnica de gameplay congelada

Estos puntos requieren una tarea aislada porque pueden cambiar balance o comportamiento:

1. `waveWeaponMult` existe en `js/engine/weapons.js`, pero el wrapper de `js/game.js` no pasa `wave` a `NV.shoot`.
2. Las explosiones de minas y kamikazes deben validarse de forma aislada respecto de la aplicación final del daño calculado al jugador.
3. Una esquiva de contacto no asigna invulnerabilidad ni `contactCd`; el enemigo puede reintentar inmediatamente.
4. El contacto usa un radio fijo de jugador, mientras los proyectiles usan el tamaño definido por personaje.
5. Kills indirectos pueden acreditar progreso al arma equipada en el momento del derribo.
6. La probabilidad de shard no tiene clamp explícito.
7. Comprar un arma con el inventario lleno puede equiparla sin almacenarla.

No resolver estos puntos como efecto lateral de documentación, viewport, UI o refactors visuales.
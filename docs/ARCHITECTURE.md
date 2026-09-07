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

`js/core/settings.js` se carga después del namespace y antes de render/gameplay. Es la única fuente de preferencias generales persistentes.

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

### Presupuesto visual de la familia Hidra

Las variantes élite se identifican por el modelo visual `LAB_SPECTER_IDS -> 5` (`RB6 / Entidad Hidra`), no por color. Su render activo es:

`js/game.js` → `NV.drawSpectralEnemy2D()` → `drawLabSpecterEnemy()` → `drawLabEnemyModel(5)`.

`NV.prepareEnemyVisualBudget()` selecciona las instancias full más cercanas al jugador mediante un `WeakSet` de render. La selección no escribe propiedades en entidades ni cambia array, update, colisiones, HP, daño o conteo de oleada.

- `high`: todas las instancias usan calidad completa;
- `auto`: hasta 7 instancias cercanas usan calidad completa;
- `performance`: hasta 4 instancias cercanas usan calidad completa;
- overflow: mantiene cuerpo, contorno, ojos y estados, pero reduce blobs secundarios, partículas, jitter y `shadowBlur`.

Los perfiles élite combinados están cacheados para evitar `Object.assign()` por entidad y frame. Los recursos visuales no se crean ni renderizan antes de que existan entidades activas.

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
- Lobby, Game Over y Settings usan una única estructura DOM compartida; CSS decide su composición desktop/móvil.
- En móvil, arma y consumible viven en chips DOM dedicados. El panel Canvas completo de arma/consumible se dibuja solo en desktop para evitar duplicación y solapamiento.

La propiedad por estado está documentada en [UI States](UI_STATES.md).

## Data

- `js/data/gameData.js`: personajes, armas, proyectiles, enemigos, élites, bosses, mejoras permanentes y eventos de oleada.
- `js/data/consumables.js`: definiciones y orden de consumibles.
- `js/data/balance.js`: constantes de tuning y topes.
- La tienda consume `NV.WEAPONS`, `NV.consumableList()` y las definiciones de mejoras existentes.
- Renderers de iconos y audio pueden tener comportamiento específico por ID, con fallback cuando corresponde.

## Settings

`js/core/settings.js` expone `NV.settings` y las APIs `getSettings`, `setGraphicsQuality`, `setGraphicsOption`, `getGraphicsPolicy` y `onSettingsChange`.

- Persistencia única: `localStorage['neonVoidSettings']`.
- Defaults: calidad `high`, partículas activas y VFX intensos activos.
- El renderer consume una política derivada; nunca lee `localStorage`.
- `js/ui/settingsPanel.js` presenta el mismo panel en desktop, lobby y móvil.
- Si Settings se abre durante una partida, reutiliza la pausa compartida y restaura el estado previo al cerrar.
- Las preferencias gráficas no pueden modificar simulación ni balance.

La integración con fuentes externas de audio en móvil requiere investigación separada de permisos, Media Capture y restricciones de plataforma. No forma parte del sistema de Settings actual.

## Hook futuro de spawn telegraph

`js/engine/enemies.js` expone `NV.describeEnemySpawnCandidate()` y admite el callback opcional `onSpawnCandidate` antes de insertar un spawn normal o élite. El callback recibe tipo, posición y clasificación élite del spawn que se ejecutará.

Actualmente el juego no conecta ese callback: no hay warning, delay, fade-in ni distancia mínima nueva. El hook permite añadir telegraphing más adelante sin duplicar la selección de spawn ni alterar las fórmulas actuales.

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
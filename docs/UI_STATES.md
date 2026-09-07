# Estados de UI

`js/game.js` mantiene el estado lógico y lo refleja en `<html>` mediante `data-game-state` y `data-paused`. CSS y `js/ui/mobileControls.js` consumen esos atributos; no existe un segundo state manager móvil.

## Propiedad por estado

| Estado de producto | Estado/condición DOM | Contenedores principales | HUD/controles móviles |
| --- | --- | --- | --- |
| Menu / Character Select | `data-game-state="menu"`; `#startScreen` visible | `#startScreen`, `#charGrid`, `#startBtn`, `#permBtn` | Ocultos |
| Playing | `data-game-state="playing"`, `data-paused="false"` | `#game`, HUD compacto, banners | Visibles y activos |
| Paused | `data-game-state="playing"`, `data-paused="true"`; `#mobileHud.nv-paused` | Mundo detenido; menú `#mobileOptions` accesible | Acciones de gameplay ocultas/desactivadas; ☰ accesible |
| Shop | `data-game-state="shop"`; `#shop` visible | `#shop`, tabs y ofertas | HUD y controles de gameplay ocultos |
| Perm Shop | estado base `menu`; `#permShop` visible y `#startScreen` oculto | `#permShop`, `#permOffers`, `#permBack` | Ocultos |
| Game Over | `data-game-state="gameover"`; `#gameOver` visible | `#gameOver`, resultados, `#restartBtn` | Ocultos |

## Menu / Character Select

- Es UI DOM de viewport completo.
- No muestra HUD ni controles de gameplay.
- La selección usa las cards generadas en `#charGrid`.
- En móvil landscape no debe quedar limitada al aspect ratio lógico del mundo.

## Playing

- El mundo usa vista/arena dinámica en móvil landscape.
- Se muestra el HUD mínimo necesario y los controles táctiles de `#mobileHud`.
- `#joystickZone`, `#mobileActions`, selectores de arma/consumible y `#optionsBtn` pertenecen al viewport físico.
- El panel `#mobileOptions` comienza cerrado y reutiliza acciones de `NV.input`.

## Paused

- `state` interno continúa siendo `playing`; `syncGameState()` publica `data-game-state="playing"` y `data-paused="true"`.
- `js/ui/mobileControls.js` refleja la pausa con la clase `#mobileHud.nv-paused`.
- La actualización de gameplay se detiene.
- Los controles táctiles de gameplay se ocultan o quedan inactivos.
- El acceso al menú de opciones debe permanecer disponible para reanudar.

## Shop

- `#shop` ocupa el viewport disponible.
- HUD y controles de gameplay quedan ocultos.
- En móvil, `#shopTabs` muestra una sección a la vez: mejoras, armas o consumibles.
- El contenido activo tiene un único scroll vertical; el botón de despliegue permanece accesible.

## Perm Shop

- `#permShop` es una pantalla DOM de upgrades permanentes abierta desde el menú.
- No crea un valor adicional en el state machine; su visibilidad está dada por las clases `hidden` de `#startScreen` y `#permShop`.
- HUD y controles de gameplay permanecen ocultos.
- En móvil usa grid responsive y scroll único.

## Game Over

- `#gameOver` presenta resultado y acción de reintento.
- HUD desktop secundario y controles móviles se ocultan.
- El mundo puede seguir dibujándose como fondo, pero no acepta gameplay input.

## Reglas para UI nueva

1. Definir qué estados poseen el componente.
2. Decidir presentación desktop y móvil por separado.
3. En móvil, posicionar con viewport CSS y safe areas, no con coordenadas de mundo.
4. Leer el estado compartido; no crear flags paralelos que puedan desincronizarse.
5. Añadir pruebas de visibilidad/wiring cuando el componente afecte estados críticos.
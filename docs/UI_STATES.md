# Estados de UI

`js/game.js` mantiene el estado lógico y lo refleja en `<html>` mediante `data-game-state` y `data-paused`. CSS y `js/ui/mobileControls.js` consumen esos atributos; no existe un segundo state manager móvil.

## Propiedad por estado

| Estado de producto | Estado/condición DOM | Contenedores principales | HUD/controles móviles |
| --- | --- | --- | --- |
| Lobby / Character Select | `data-game-state="menu"`; `#startScreen` visible | `#startScreen`, `#charGrid`, `#startBtn`, `#permBtn`, `#lobbySettingsBtn` | Ocultos |
| Playing | `data-game-state="playing"`, `data-paused="false"` | `#game`, HUD compacto, banners | Visibles y activos |
| Paused | `data-game-state="playing"`, `data-paused="true"`; `#mobileHud.nv-paused` | Mundo detenido; menú `#mobileOptions` accesible | Acciones de gameplay ocultas/desactivadas; ☰ accesible |
| Shop | `data-game-state="shop"`; `#shop` visible | `#shop`, tabs y ofertas | HUD y controles de gameplay ocultos |
| Perm Shop | estado base `menu`; `#permShop` visible y `#startScreen` oculto | `#permShop`, `#permOffers`, `#permBack` | Ocultos |
| Game Over | `data-game-state="gameover"`; `#gameOver` visible | `#gameOver`, resultados, `#restartBtn` | Ocultos |
| Settings | `data-settings-open="true"`; `#settingsPanel` visible | panel gráfico compartido | Gameplay pausado si se abrió durante play; controles ocultos |

## Lobby / Character Select

- Es UI DOM de viewport completo.
- No muestra HUD ni controles de gameplay.
- `#startScreen > .lobby-shell` separa presentación, roster y acciones.
- La selección usa cards generadas en `#charGrid` desde `NV.characterList()`.
- En móvil landscape no debe quedar limitada al aspect ratio lógico del mundo.
- El mismo DOM se presenta espacioso en desktop y utiliza el viewport físico en móvil.

## Playing

- El mundo usa vista/arena dinámica en móvil landscape.
- Se muestra el HUD mínimo necesario y los controles táctiles de `#mobileHud`.
- `#joystickZone`, `#mobileActions`, selectores de arma/consumible y `#optionsBtn` pertenecen al viewport físico.
- El panel `#mobileOptions` comienza cerrado y reutiliza acciones de `NV.input`.
- El panel Canvas de inventario/consumibles se omite en móvil; sus datos viven en `#mobileWeaponSwitch` y `#mobileConsumableSwitch`.

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

- `#gameOver` centra `.game-over-panel`, que agrupa título, resumen, score/oleada y acción primaria.
- HUD desktop secundario y controles móviles se ocultan.
- El mundo puede seguir dibujándose como fondo, pero no acepta gameplay input.
- `.game-over-future` reserva una separación estructural para recompensas/estadísticas/acciones futuras sin implementar esos sistemas.

## Settings

- `#settingsPanel` es un modal DOM compartido, accesible desde el header desktop, el lobby y `#mobileOptions`.
- Publica `data-settings-open` en `<html>`.
- Durante play llama `NV.input.setSettingsOpen(true)`, pausa la simulación y restaura el estado previo al cerrar.
- Oculta el menú móvil subyacente y no crea coordenadas de mundo ni estado de gameplay paralelo.
- Sus controles escriben exclusivamente en `NV.settings`.

## Reglas para UI nueva

1. Definir qué estados poseen el componente.
2. Decidir presentación desktop y móvil por separado.
3. En móvil, posicionar con viewport CSS y safe areas, no con coordenadas de mundo.
4. Leer el estado compartido; no crear flags paralelos que puedan desincronizarse.
5. Añadir pruebas de visibilidad/wiring cuando el componente afecte estados críticos.
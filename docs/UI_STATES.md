# Estados de UI

`js/game.js` mantiene el estado lógico y lo refleja en `<html>` mediante `data-game-state` y `data-paused`. CSS y `js/ui/mobileControls.js` consumen esos atributos; no existe un segundo state manager móvil.

## Propiedad por estado

| Estado de producto | Estado/condición DOM | Contenedores principales | HUD/controles móviles |
| --- | --- | --- | --- |
| Lobby | `data-game-state="menu"`; `#startScreen` visible | `#startScreen`, `#lobbyPreview`, `#lobbyPlayBtn`, `#pilotsBtn`, `#permBtn`, `#lobbySettingsBtn` | Ocultos |
| Pilot Library | `data-game-state="menu"`; `#characterSelectScreen` visible | `#characterSelectScreen`, `#charGrid`, `#startBtn` | Ocultos |
| Playing | `data-game-state="playing"`, `data-paused="false"` | `#game`, HUD compacto, banners | Visibles y activos |
| Paused | `data-game-state="playing"`, `data-paused="true"`; `#mobileHud.nv-paused` | Mundo detenido; menú `#mobileOptions` accesible | Acciones de gameplay ocultas/desactivadas; ☰ accesible |
| Shop | `data-game-state="shop"`; `#shop` visible | `#shop`, tabs y ofertas | HUD y controles de gameplay ocultos |
| Perm Shop | estado base `menu`; `#permShop` visible y las dos vistas de menú ocultas | `#permShop`, `#permOffers`, `#permBack` | Ocultos |
| Game Over | `data-game-state="gameover"`; `#gameOver` visible | `#gameOver`, resultados, `#restartBtn` | Ocultos |
| Settings | `data-settings-open="true"`; `#settingsPanel` visible | panel gráfico compartido | Gameplay pausado si se abrió durante play; controles ocultos |

## Lobby y biblioteca de pilotos

- Es UI DOM de viewport completo.
- No muestra HUD ni controles de gameplay.
- `#startScreen` es el lobby principal y no contiene el roster.
- `#lobbyPlayBtn` inicializa audio y crea la partida directamente con el piloto seleccionado.
- `#pilotsBtn` abre la biblioteca opcional `#characterSelectScreen`; no es un paso obligatorio antes de jugar.
- `#characterSelectScreen > .lobby-shell` separa presentación, roster y la acción para volver al lobby.
- La selección usa cards generadas en `#charGrid` desde `NV.characterList()` y comparte la autoridad `NV.selectPilot` con las flechas del lobby.
- `#startBtn` conserva el piloto elegido y vuelve al lobby; no inicia gameplay.
- Lobby y biblioteca comparten el estado lógico `menu`; sus clases `hidden` son subestado de presentación, no gameplay paralelo.
- El preview `#lobbyPreview` pertenece exclusivamente al lobby, usa `NV.drawPlayer` y no se renderiza sobre la biblioteca, permanentes, settings ni gameplay.
- F09.4: el fondo del lobby es negro profundo con estrellas CSS baratas (sin órbitas decorativas: `.lobby-orbit` eliminado del lobby y neutralizado por CSS); `.lobby-hero-info` usa acento por piloto (`--pilot-accent`) y stats en chips HP/SPD/ARM.
- F09.4: el anillo/contorno de cooldown alrededor del jugador (`NV.drawSpecialCooldown`) fue eliminado globalmente (gameplay + preview). El estado de la habilidad vive en el header DOM (`.special-cooldown`/`#specialFill`) y en el slot canvas del panel (`drawWeaponHUD`).
- F09.5: el círculo punteado "Buscando" alrededor del jugador (`NV.drawAutofireTarget` rama sin target: `arc(player.x,player.y,34)` + `setLineDash([4,4])`) fue eliminado. Era el contorno segmentado persistente durante oleadas/eventos/jefes cuando no había lock de autoapuntado. Se conserva el retículo sobre el objetivo (aro + ticks) y la línea de mira solo-debug. No es `showHUD`: es overlay world-space de legibilidad dibujado en `js/game.js` fuera del gate `showHUD`; por eso el toggle de HUD no lo ocultaba directamente (solo cambiaba el lock/target).
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
- Volver desde la tienda permanente regresa al lobby principal.
- HUD y controles de gameplay permanecen ocultos.
- En móvil usa grid responsive y scroll único.

## Game Over

- `#gameOver` centra `.game-over-panel`, que agrupa título, resumen, score/oleada y acción primaria.
- HUD desktop secundario y controles móviles se ocultan.
- El mundo puede seguir dibujándose como fondo, pero no acepta gameplay input.
- `.game-over-future` reserva una separación estructural para recompensas/estadísticas/acciones futuras sin implementar esos sistemas.
- La acción principal vuelve al lobby unificado; no obliga a pasar por la biblioteca de pilotos.

## Settings

- `#settingsPanel` es un modal DOM compartido, accesible desde el header desktop, el lobby y `#mobileOptions`.
- Publica `data-settings-open` en `<html>`.
- Durante play llama `NV.input.setSettingsOpen(true)`, pausa la simulación y restaura el estado previo al cerrar.
- Oculta el menú móvil subyacente y no crea coordenadas de mundo ni estado de gameplay paralelo.
- Sus controles escriben exclusivamente en `NV.settings`.

## Persistencia disponible en el lobby

- `neonVoidSettings` guarda preferencias de audio, gráficos y controles.
- `neonVoidMeta` guarda meta-fragmentos y mejoras permanentes.
- No existe guardado de una run activa; el lobby no ofrece “Continuar partida”.

## Reglas para UI nueva

1. Definir qué estados poseen el componente.
2. Decidir presentación desktop y móvil por separado.
3. En móvil, posicionar con viewport CSS y safe areas, no con coordenadas de mundo.
4. Leer el estado compartido; no crear flags paralelos que puedan desincronizarse.
5. Añadir pruebas de visibilidad/wiring cuando el componente afecte estados críticos.
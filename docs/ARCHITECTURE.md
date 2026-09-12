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

### Pipeline autoritativo de daño al jugador

`js/engine/combat.js` separa cálculo y aplicación:

- `NV.computePlayerHit(baseDamage, state)` calcula dodge, crítico, armadura y modificadores de personaje;
- `NV.applyPlayerDamage(baseDamage, state)` comprueba invulnerabilidad, resta HP, genera feedback/SFX, dispara `onPlayerDamaged` y devuelve un resultado explícito con `applied`, `dodged`, `crit`, `damage`, `hpBefore`, `hpAfter`, `killed` y `cause`.

Contacto y proyectiles delegan en esta autoridad sin cambiar sus defaults históricos de crítico/esquiva. Speaker Mines y explosiones kamikaze delegan con `allowCrit:false` y `allowDodge:false`; siguen respetando invulnerabilidad, armadura y modificadores de personaje. `NV.killEnemy()` es idempotente por entidad y la detonación NOVA resuelve bajas normales mediante el callback `killEnemy`.

### Loadout de armas y consumibles

**Modelo de slots (regla única, verificada).** El loadout es un **array compacto**: `inventory[0] == slot visual 1`, `inventory[1] == slot visual 2`, … No existen huecos internos persistentes. Los slots vacíos que dibuja el dock son **solo representación visual de capacidad disponible** (se derivan de `i >= inventory.length`), no posiciones lógicas: no aceptan "mover arma aquí" porque el array compacto no conserva posiciones arbitrarias (elegir slot 5 con 3 armas dejaría el arma en slot 3). El reordenamiento es **swap entre dos armas existentes** (intercambio in-place, preserva longitud). Al vender, `splice(i,1)` compacta y el slot siguiente ocupa su lugar. `currentWeapon ∈ inventory` garantizado siempre (venta con fallback a la siguiente arma válida; última arma no se vende: `NECESITÁS AL MENOS UN ARMA`). Hotkeys 1–6 ≡ slots visibles ≡ posiciones de `inventory`, por lo que el mapeo es trivialmente correcto.

**Armas.** La pistola inicial es un arma normal del inventario desde `startGame` (`inventory[0]`); no existe slot reservado ni fallback implícito al starter. Cualquier arma puede ocupar cualquier posición. La compra con inventario lleno se bloquea (`INVENTARIO LLENO`), igual que los pickups. `NV.starterWeapon()` solo participa en la inicialización de la run y en la tienda como arma comprable; una fusión opera por `weapon.id` y nunca muta posiciones.

**Consumibles.** Los límites son `CONSUMABLE_STACK_CAP=10` por tipo, `CONSUMABLE_TYPE_SLOT_CAP=6` tipos simultáneos y `CONSUMABLE_CAP=3` compras por visita. Una compra inválida nunca cobra: `renderOffers` reembolsa si `buy()` devuelve `false`. El orden de los tipos es el de primera aparición y lo comparten HUD y gameplay. Al consumir, `reconcileConsumSel()` mantiene la selección determinista: misma posición si el tipo sigue vivo, wrap al primero si el índice quedó fuera de rango y `0` si no quedan consumibles.

### Presupuesto autoritativo de hostiles

`js/engine/hostileBudget.js` deriva el estado vivo en cada consulta vía `NV.getHostileBudget(state)` y autoriza lotes con `NV.canSpawnHostileBatch(state, count, heavyCount)`; no mantiene contadores persistentes. Los límites de producción son `MAX_HOSTILES=30` y `MAX_HEAVY_HOSTILES=7`.

- todo enemigo vivo consume un slot hostile;
- el boss vive fuera de `enemies`, pero consume un slot hostile y uno heavy;
- todos los élites consumen heavy;
- espectros normales son medium y no consumen heavy;
- summons son light;
- fusiones normales pasan a medium y las extremas pueden promocionarse a heavy si queda presupuesto;
- normal/élite pueden truncar lote; summon triple y split Mutante son all-or-nothing;
- spawns forzados respetan el presupuesto salvo `ignoreHostileBudget:true` explícito.

La saturación visual se deriva de `hostiles / MAX_HOSTILES`; no usa `enemies.length` ni el límite histórico 80.

### Hazards y Campo Minado (P3/P3.1/P3.1.1)

`hazards[]` es una categoría de entidades independiente de `enemies`, `bullets` y `pickups`. `js/engine/hazards.js` posee lifecycle, placement, colisión y cadence; `js/render/hazards.js` posee exclusivamente dibujo. Los hazards no cuentan como hostile/heavy, kill, XP, shard, target de autofire ni condición de fin de wave. Su presupuesto separado es `MAX_SPEAKER_MINES=6`.

**Speaker Mine.** Estados explícitos: `spawning` (telegraph fijo de 0.9s, sin colisión), `armed` (obstáculo activo), `detonating` (transición única, daño ya resuelto) y `dead` (compactación segura). Solo `armed` puede entrar a `detonating`, por lo que varios frames/callbacks no pueden aplicar daño dos veces. Daño de balance sin cambios: `round(min(52, 38 + wave*0.5))`; pasa por `applyPlayerDamage` con `allowCrit:false`/`allowDodge:false`, respetando invulnerabilidad, armor, pasivas defensivas, diagnóstico y Game Over.

**Spawn y seguridad.** Campo Minado empieza gradualmente con objetivo 3; crece hasta 6 según wave y repone cada ~3.2s (2.6s desde wave 8), nunca inmediatamente tras una detonación. Placement: margen 42 world units, distancia inicial al jugador 175, separación 105 y máximo total de 24 candidatos. El 70% puede ser táctico: predice `player.position + moveV * 0.65s`, puntúa cercanía a la ruta y alineación frontal, y elige el mejor candidato seguro; el resto conserva distribución normal. Una heurística de 8 sectores exige conservar dos sectores contiguos libres y limita a cinco minas cercanas, evitando una corona completa sin pathfinding. Si no hay posición segura, no spawnea. La posición queda bloqueada desde el inicio del telegraph.

**Presión enemiga.** `movementClass` (`slow`/`normal`/`fast`) se guarda al crear la entidad usando metadata o fallback por `behavior/speed`, nunca por nombre/ID. `NV.minefieldEnemySpeed()` calcula velocidad efectiva sin mutar `enemy.speed`: normal/lento ×1.22, fast ×1.12, élite/heavy ×1.10, cap 260. Fuera del evento devuelve exactamente la velocidad base; no cambia daño ni cantidad de enemigos.

**Ritmo, groove y visual budget.** El `#rhythm-widget` y las Speaker Mines comparten `NV.computeRhythmGroove(state, rhythm, dt, options)` de `js/engine/rhythm.js`. El helper toma beat/kick/onset, energía y conexión; aplica envelope percusivo attack/release (45ms/300ms), smoothstep, envelope de energía (180ms/520ms), respiración por fase y smoothing final de scale/skew. El widget llama el helper una vez por frame y solo mapea el resultado a su SVG DOM (`scale`/`skewX`, color, opacity, filter). Campo Minado mantiene una sola `minefieldState.grooveState` y calcula `minefieldState.groove` una vez por update; las hasta seis minas consumen esa base Canvas con `phaseOffset` propio. No hay DOM, layout, `getComputedStyle`, analyser ni loop individual por mina.

Cada mina expone `grooveMode: 'idle'|'music'` y `grooveBlend: 0..1`. Música conectada se detecta por el estado real `NV.rhythm.enabled && active && state==='listening'`, no por energía; una gracia de 0.4s evita oscilar ante una caída breve. `IDLE_GROOVE` es vida de personaje lenta (~4.4s): sway ±~1.8px, tilt <~2.6°, bob <1px, peso asimétrico y woofer 1.015–1.035, sin responder a señales desconectadas. `MUSIC_GROOVE` conserva esa base y suma groove continuo más el envelope percusivo compartido (`pulseEnv`/`curvedPulse`, attack 45ms/release 300ms) para compresión posicional, tilt, peso, rebound y woofer; `energyEnv` solo modula amplitud secundaria. `phaseOffset` mantiene variación determinista sin BPM por mina. La escala del cuerpo queda deliberadamente secundaria y dentro de `scaleX 0.95..1.05` / `scaleY 0.94..1.06`; el flow viene de sway, peso, tilt, bob y woofer. Todas las transformaciones son locales y no mutan `x/y/triggerRadius`.

**Telegraph, detonación y notas.** El telegraph combina warning ring, ondas concéntricas y preview de woofer, con el mismo punto lógico bloqueado. La detonación conserva flash y shockwave principal, añade squash más violento, shake corto, SFX bajo/ataque/tono y notas musicales geométricas (sin fuente): `full=7`, `reduced=5`, `minimal=2`, cap global 24, lifetime 0.65–1.01s, arco ascendente y limpieza in-place. Notas, glow, tweeter, tornillos y segunda onda son decorativos; cuerpo, warning, telegraph, hitbox, cadence, ritmo lógico, número y daño permanecen intactos. `META_DEBUG` permite visualizar el trigger radius.

**Transiciones.** `clearHazards()` se ejecuta en menú, start/restart, inicio/fin de wave, transición de victoria, shop y Game Over. Pausa congela el sistema porque `game.update()` no avanza; el tiempo visual usa `simTime`, no reloj de pared. Boss waves no seleccionan eventos y `spawnSpeakerMine()` rechaza contexto con boss.

`js/engine/weather.js` continúa desconectado. Solo se migraron sus ideas útiles de placement con margen, pulso y entidad ambiental separada. Su estado paralelo `weather.mines`, `computePlayerHit(22)` descartado, zonas/fog y lifecycle pre-P0 quedan obsoletos para Campo Minado y no se cargan desde `index.html`.

## Performance foundation (P2)

Arquitectura de medición y degradación decorativa. Tres piezas, con responsabilidades separadas:

**Monitor** (`js/engine/performanceMonitor.js`). Observa sin tocar gameplay. Ring buffers preasignados (`Float32Array`, 240 muestras ≈ 4s): cero `shift()` ni allocations por frame. Registra `frameMs` (intervalo real entre rAF), `updateMs` y `drawMs`. Los percentiles p50/p95/p99/worst y los contadores `framesAbove16_7/25/33` se recalculan a frecuencia baja (caché ~250ms, un único `sort` en recompute). API: `NV.performanceMonitor.record/getSnapshot/reset`, `NV.togglePerformanceDebug()`, `setTelemetryProvider(fn)`. La telemetría (conteos de hostiles por clase, balas, partículas, meteoros, drones, DPR efectivo, tier visual) la produce `game.js` vía provider; el monitor solo la expone.

**Visual budget** (`js/render/visualBudget.js`). Política de calidad visual runtime, **completamente separada del presupuesto de hostiles**: nunca decide spawns, daño, cadencia, proyectiles, HP, velocidad, AI, cooldowns ni hitboxes. Solo calidad decorativa. La autoridad es la preferencia del usuario (`NV.settings.graphics.quality`: `high`/`auto`/`performance`); el tier runtime (`full`/`reduced`/`minimal`) **no se persiste** sobre esa preferencia. Auto-quality por histéresis: degrada relativamente rápido ante p95 sostenido ≥20ms, recupera mucho más lento (≤14.5ms); `high` solo sacrifica decoración en overload serio (≥26.5ms, tier `emergency`); `performance` es `reduced` fijo. Campos de política semánticos y acotados: `spectralDetail`, `decorativeParticleScale`, `secondaryGlow`, `heavyShadow`, `trailDensity`, `secondaryShockwaves`, `rhythmBackgroundDetail`.

**Integraciones decorativas** (game.js, spectralEnemies2D.js, fx.js, special.js): el loop mide update/draw y evalúa el budget a ~2 Hz; Hidra intersecta su presupuesto de settings con el tier runtime (solo recorta modelos completos); el ink de explosión, los glows de drones/meteoros, las estelas, el throttle de la capa rítmica y las shockwaves secundarias se degradan por tier. **Balas enemigas, número de proyectiles, cadencia, daño, meteoros (12) y drones (6) son intocables.**

**Harness** (`tools/performance/stress_harness.js`): escenarios A–S reproducibles a nivel de sistema (update + renderer espectral/hazards real en sandbox headless, con `computePlayerHit` aproximado a 1). A–J conservan el baseline P2; K–O aíslan mines base; P mide seis mines en `MUSIC_GROOVE`; Q mide seis detonaciones secuenciales con notas; R combina 23+7, lanzallamas y seis mines musicales; S mide seis mines `IDLE_GROOVE`. Mide coste CPU real de engine/render; **no es frame real de browser ni garantía de FPS**. Los presupuestos 30 hostiles / 7 heavy / 6 minas / 24 notas / 200 partículas se validan en todos los escenarios aplicables.

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

- `js/core/inputIntent.js` define el modelo lógico compartido: `moveX/moveY`, `aimX/aimY`, `fireIntent`, `dashIntent`, `abilityIntent` y la política `manual | legacy-auto`.
- Teclado y mouse actualizan intents mediante `NV.input`; los sistemas tocados consumen el intent, no eventos DOM crudos.
- El aim desktop convierte coordenadas client a mundo con `NV.screenToGame()` y se normaliza independientemente del movimiento.
- Manual y auto clásico comparten `NV.shoot()` y el mismo controlador de cadencia. En manual `NV.shoot()` recibe `aimVector` y no busca/corrige objetivo; en auto conserva nearest-target y rango.
- `js/ui/mobileControls.js` traduce joystick, botones y selectores táctiles a esos mismos intents mediante `NV.input`.
- Móvil fuerza por ahora `legacy-auto`; no existe aún segundo stick ni polling por entidad.
- La física y las acciones no se duplican por plataforma.
- Toda acción nueva debe añadirse a la abstracción lógica compartida y luego mapearse desde cada dispositivo aplicable.

## Movimiento controlado

`js/engine/movement.js` es la autoridad O(1) del movimiento del jugador. Consume exclusivamente `combatIntent.moveX/moveY`; no define input alternativo y no modifica aim/fire.

- `baseMoveSpeed`: identidad base del personaje, inmutable durante la run.
- `effectiveMoveSpeed`: base × permanente × modificadores temporales.
- `acceleration`, `deceleration`, `turnControl` y `reversalControl`: tasas derivadas de la velocidad efectiva y de tiempos objetivo, no constantes de fuerza independientes.
- `moveVx/moveVy`: velocidad física actual.
- `agility`: control in-run; mejora respuesta sin aumentar velocidad punta.

Tuning base: aceleración `0.13s`, parada `0.10s`, giro `0.085s`, inversión completa `0.11s`. La mejora permanente `speed` conserva su clave/save pero se interpreta como Movilidad: `+2%` velocidad y `+2.5%` control por nivel, con cap efectivo en nivel 10 (`+20%/+25%`). Guardados con niveles mayores se preservan y se limitan al calcular el perfil.

### Dash stamina

`js/engine/movement.js` también orquesta el dash. Sustituye el antiguo Shift sostenido (multiplicador `×2.15`) por un recurso táctico limitado, sin invulnerabilidad ni daño, sin sistemas por personaje y sin stamina de otro tipo:

- Reserva `100`, coste `50` por dash (`2` usos desde lleno), duración `0.15s`, velocidad fija `560`, velocidad de recarga `100/2.9 ≈ 34.5/s`.
- Retraso de recarga `0.90s`; recuperación completa de la reserva vacía en `~3.8–4.0s` de tiempo de simulación.
- **Press edge**: un dash solo se dispara en el flanco ascendente de `combatIntent.dashIntent`; mantener Shift jamás re-dispara cuando la stamina se recupera.
- Dirección: `moveX/moveY` primero; si no hay movimiento, `aimX/aimY` cuando está activo; si no, el último movimiento conocido.
- Regeneración sigue el tiempo de simulación y la convención de pausa (`game.update()` no corre en pausa; no hay catch-up).
- Transiciones de estado (pausa, Settings, menú, tienda y game over) limpian `dashIntent` y el latch mediante `NV.resetDashPauseLatch(player, false)` para que un Shift mantenido en pausa/UI no genere un dash espurio al reanudar.
- `NV.configurePlayerDash()` rellena la reserva y limpia el latch en selección de personaje y `startGame()`.

Estado en el player: `dashStaminaMax`, `dashStamina`, `dashCost`, `dashTime`, `dashRechargeDelay`, `dashDirX`, `dashDirY`, `dashInputHeld`, `dashActive`. El HUD dibuja una barra segmentada de 2 usos (`js/render/hud.js → NV.drawDashStamina`), posicionada más arriba en móvil para no solapar los chips DOM de arma/consumible.

Overdrive solo renueva su timer y aplica `×1.18` dentro del cálculo efectivo; nunca multiplica/divide stats persistentes. `player.speed` queda como alias de compatibilidad de `effectiveMoveSpeed`, no como fuente base.

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

## Rifle — identidad manual (F04)

El Rifle (`id: 'rifle'`, raridad uncommon) es la primera arma que materializa la dirección habilidosa: arma automática estable + aim manual preciso + penetración de línea moderada y finita.

- **Datos:** damage `20`, cadencia `25` (intervalo base `25/60s` a 60fps), rango `480`, velocidad `700`, `pierce: 2`, sin spread.
- **Disparo manual:** `NV.shoot()` con `aimVector` dispara exactamente a lo largo del vector normalizado; NO resuelve objetivo (`findTarget` recibe `null` y `onTarget` reporta `null`). Sin autocorrección al enemigo más cercano.
- **Legacy-auto:** usa la MISMA pipeline (mismo `NV.shoot` y la misma cadencia compartida), resolviendo nearest-target dentro del rango. Móvil fuerza legacy-auto por política efectiva.
- **Recoil/spread (auditoría F04):** el Rifle mantiene spread cero y sin recoil. Añadir bloom haría que la precisión dependiera del azar, contradiciendo que el aim manual importe; no hay camera kick ni random bloom.
- **Contrato de pierce (explícito):** `pierce` = número TOTAL de objetivos dañables antes de morir. Rifle `pierce: 2` = objetivo primario + 1 enemigo adicional (NUNCA "2 penetraciones tras el primero"). Al alcanzar el límite la bala muere (`hitCount >= b.pierce` en `engine/bullets.js`) → penetración finita y legible. Contrato documentado en `engine/weapons.js` y `engine/bullets.js`.
- **Visual:** proyectil `bullet` largo (`len 10`), una línea orientada al vuelo; sin partículas ni glow nuevos por frame.
- **Nivel/fusión:** sin cambios. El daño sigue `(base + perm*2 + bonoNivel) × waveWeaponMult × fusión`; nivel y fusión se conservan (cubierto en tests).
- **Independencia del dash:** el dash no altera daño, pierce, cadencia ni velocidad del proyectil; el disparo solo depende de `aimVector`/target y de la cadencia compartida.

El resto de armas NO se rediseña en F04.

## Enemy intent/state foundation (F05)

`js/engine/enemyState.js` introduce un vocabulario mínimo y reutilizable para que futuros enemigos no reduzcan todo a `directionToPlayer`. Es **opt-in**: los enemigos legacy no se modifican y continúan con su comportamiento actual.

- **Vocabulario de estado:** `idle`, `positioning`, `windup`, `attack`, `recovery`, `retreat`. No todos los estados aplican a todos los enemigos.
- **Separación intent/steering:** el intent expresa lo que el enemigo QUIERE (rango preferido, flanco, objetivo de retirada, bloqueo de movimiento en ataque); el steering consume ese intent para producir velocidad. El intent no fuerza movimiento directamente.
- **Helpers baratos y deterministas:**
  - `preferredRangeOf` / `inPreferredBand` — banda de distancia deseada sin `Math.sqrt` cuando basta comparar contra un radio.
  - `flankTargetOf` — offset lateral perpendicular a la línea hacia el objetivo (persistente, sin jitter aleatorio por frame).
  - `retreatVectorFrom` — dirección de huida desde un punto de peligro.
  - `attackMovementFactor` — factor de movimiento durante ataque (1 = libre, 0 = bloqueado), con clamp explícito 0..1.
  - `separationContributionCandidate` — candidato de separación para reutilizar el grid espacial existente (no añade pasada O(n²)).
- **Ciclo de vida:** `createEnemyIntent` inicializa; `updateIntent` decrementa timers; `resetIntent` vuelve a IDLE y limpia; todo es seguro si el enemigo no tiene `intent` (legacy).
- **Grid espacial existente:** el foundation reutiliza `buildSpatialGrid` + `forEachGridNeighbor` ya presente en `enemies.js` (O(n) amortizado). No se añade pathfinding ni nueva pasada O(n²).
- **Presupuesto intacto:** `MAX_HOSTILES=30`, `MAX_HEAVY_HOSTILES=7` en `balance.js` + `hostileBudget.js`. El foundation no altera spawns, fusión ni derribos.
- **Compatibilidad:** bosses, legacy behaviors (chase/kami/erratic/swarm/shield/ranged) y fusión de enemigos permanecen sin cambios. `updateEnemies` funciona con o sin intents.

Los enemigos concretos (Runner, Spitter, etc.) se convierten en Features 06 y 07; F05 solo deja la base reusable.

## Runner as Flanker (F06)

El Runner (`id: 'runner'`, hp 15, speed 145, radius 9, damage 10, minWave 1) se convirtió de persecución directa (`chase`) a flanqueador (`flank`). Usa la arquitectura F05 de forma opcional (si `enemyState.js` está cargado; si no, el comportamiento es completamente autónomo).

- **Nuevo behavior:** `flank` (rama agregada en `updateEnemies`, `js/engine/enemies.js`).
- **State machine:** `APPROACH` → `COMMIT` → `RECOVERY` → `APPROACH`.
  - **APPROACH:** elige un lado (izq/der, `flankSide` persistido) y se posiciona lateralmente con offset respecto al jugador.
  - **COMMIT:** lunge hacia un punto desplazado del centro (no el centro exacto), sin corrección magnética constante. Duración ~0.45s.
  - **RECOVERY:** retroceso para crear separación antes del próximo approach. Duración ~0.6s. Posible cambio de lado (40% chance, no inmediato).
- **Persistencia:** `flankSide`, `flankState`, `stateTimer` se mantienen entre frames. El lado no cambia durante APPROACH.
- **Contacto/death-on-contact:** preservado. El Runner muere al contacto (sin cambios en la semántica melee global).
- **Minefield/eventos:** sin cambios. La velocidad efectiva usa `minefieldEnemySpeed` (normal × 1.22 = ~177, cap 260).
- **Presupuesto:** sin cambios (`MAX_HOSTILES=30`, `MAX_HEAVY=7`, clase `light`).
- **Autonomía:** el comportamiento funciona incluso si `enemyState.js` no está cargado (verificado en `space_special.js`).

El Spitter NO se convierte en F06 (es Feature 07).

## Settings

`js/core/settings.js` expone `NV.settings` y las APIs `getSettings`, `setGraphicsQuality`, `setGraphicsOption`, `getGraphicsPolicy` y `onSettingsChange`.

- Persistencia única: `localStorage['neonVoidSettings']`.
- Defaults: calidad `high`, partículas activas y VFX intensos activos.
- El renderer consume una política derivada; nunca lee `localStorage`.
- `js/ui/settingsPanel.js` presenta el mismo panel en desktop, lobby y móvil.
- Si Settings se abre durante una partida, reutiliza la pausa compartida y restaura el estado previo al cerrar.
- Las preferencias gráficas no pueden modificar simulación ni balance.

La integración con fuentes externas de audio en móvil requiere investigación separada de permisos, Media Capture y restricciones de plataforma. No forma parte del sistema de Settings actual.

## Audio y SFX de armas

`js/audio/synth.js` es propietario del único `AudioContext`, el mixer general, los canales de música/SFX y el master gain usado por el mute. `js/audio/weaponSfx.js` se carga inmediatamente después y reutiliza ese contexto y el canal `sfxPlayer`; no crea un contexto paralelo.

La API central es `NV.audio.weaponFire/start/stop/reload`, más `stopAllWeapons`, `update` y `getWeaponSfxStats` para ciclo de vida/diagnóstico. Los presets `NV.WEAPON_SFX_PRESETS` se indexan exclusivamente por los IDs estables de `NV.WEAPONS` y contienen solo parámetros de audio.

El flujo obligatorio es:

`NV.shoot()` crea los proyectiles reales → emite un único evento descriptivo → `NV.audio.weaponFire()` sintetiza lo ocurrido.

Audio nunca decide cadencia, daño, cantidad de proyectiles, doble disparo ni reload. El lanzallamas usa una voz continua idempotente mantenida por eventos reales y liberada por timeout, mute, pausa, tienda, Game Over, menú o pérdida de visibilidad. El ataque de cada one-shot se preserva completo; únicamente el SMG reduce eco y densidad de crackle al detectar solapamiento rápido. Las curvas de saturación se reutilizan desde caché y toda la síntesis termina en el canal compartido `sfxPlayer`.

### Port fiel del laboratorio de armas

- **Núcleo balístico:** crack supersónico con high-pass, vía directa y vía comprimida paralela; muzzle noise con barrido low-pass; thump derivado del muzzle; tail band-pass; boom puff y crackle.
- **Saturación:** `sumBus` se divide en low `<200 Hz`, mid `200–2800 Hz` y high `>2800 Hz`. Low usa el soft clip asimétrico 250 del laboratorio; mid y high usan el overdrive brutal del preset.
- **Espacio:** dos taps sin feedback, alrededor de 45 ms/2800 Hz y 100 ms/1300 Hz, seguidos del Haas de cada preset con lado aleatorio. En SMG sostenido sus retornos y crackle se reducen, sin reducir crack, muzzle ni cuerpo multibanda.
- **Presets:** rifle, smg, shotgun, sniper, laser, plasma, flamethrower, bow y railgun reproducen los valores de `tools/toolsweapon_sfx_lab.html`. Pistol conserva sus valores de producción, pero atraviesa el mismo núcleo balístico completo.
- **Sin calibración reinterpretada:** el camino fiel no usa `outputGain`, `transientGain`, `bodyGain` ni `tailGain` por familia.

### Diagnóstico

`getWeaponSfxStats()` expone contadores de llamadas y nodos creados; un ring buffer de hasta 24 eventos alimenta `NV.audio.getRecentWeaponEvents()` con `{id, preset, created, suppressed, reason, t}`. `NV.audio.setDebug(true)` habilita el flag interno de diagnóstico. La validación headless comprueba arquitectura; la aprobación final exige escucha A/B real contra el laboratorio.

Contrato: **GAMEPLAY OWNS MECHANICS/TIMING. AUDIO CONSUMES EVENTS.**

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

1. `waveWeaponMult` existe en `js/engine/weapons.js`, pero el wrapper de `js/game.js` no pasa `wave` a `NV.shoot`. **Re-verificado en F04**: sigue desconectado en producción (`state.wave` llega `undefined` → siempre ×1). Documentado y probado en `tests/rifle_manual_aim.js`; no habilitado a propósito en F04.
2. Una esquiva de contacto no asigna invulnerabilidad ni `contactCd`; el enemigo puede reintentar inmediatamente.
3. El contacto usa un radio fijo de jugador, mientras los proyectiles usan el tamaño definido por personaje.
4. Kills indirectos pueden acreditar progreso al arma equipada en el momento del derribo.
5. La probabilidad de shard no tiene clamp explícito.
6. Comprar un arma con el inventario lleno puede equiparla sin almacenarla.

No resolver estos puntos como efecto lateral de documentación, viewport, UI o refactors visuales.
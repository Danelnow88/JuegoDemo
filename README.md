# 🔷 NEON VOID — Roguelite de supervivencia

> **Juego arcade roguelite** estilo *synthwave* / *neon*, hecho 100% con **HTML5 Canvas + JavaScript + CSS** (sin frameworks ni dependencias externas: se juega abriendo `index.html` en el navegador).

---

## ⚠️ REGLA DE MANTENIMIENTO DEL README (LEER PRIMERO)

> **Este README es la fuente de verdad del proyecto.** Cada vez que se **modifique** una característica existente o se **agregue** una nueva (código, mecánicas, personajes, armas, enemigos, jefes, sonido, UI, configuración, estructura de archivos, etc.), **este README DEBE actualizarse en el mismo cambio**, documentando:

- Qué se agregó / modificó / corrigió.
- Dónde vive en el código (archivo y función / sección).
- Cualquier cambio en datos del juego (números, balance, valores).

**Si el código cambia y el README no, el cambio está incompleto.** Esta regla aplica a cualquier contribución (manual o mediante IA).

---

## 📁 Estructura del proyecto

```
JuegoDemo/
├── index.html          # Página principal: DOM, HUD, overlays (menú, tienda, game over), nav táctil (oculto)
├── README.md           # Este documento (fuente de verdad)
├── tests/
│   └── space_special.js # Arnés headless: especial de cada personaje × 300 frames sin crash
├── css/
│   └── styles.css      # Estilo visual: neon, HUD, menú, tarjetas, tienda, inventario, ofertas
└── js/
    ├── core/
    │   ├── state.js    # Namespace global window.NV (se carga primero)
    │   └── utils.js    # Utilidades puras: NV.formatPoints
    ├── data/
    │   ├── gameData.js   # Datos puros: personajes, armas, élites, jefes, mejoras
    │   ├── balance.js    # Datos de balance/tuning (NV.BALANCE)
    │   └── consumables.js # Datos de consumibles (NV.CONSUMABLES)
    ├── audio/
    │   └── synth.js    # Audio synthwave + SFX: Estado mutable en NV.* (soundOn/audioCtx/musicState/musicTime); consume NV.getFrame/getBoss/getState
    ├── render/
    │   ├── canvas.js      # canvas + ctx base (expuestos en NV.canvas/NV.ctx)
    │   ├── projectiles.js # Dibujo de proyectiles del jugador (formas por arma) + VFX especial (NV.drawBulletShape/NV.drawSpecialVFX)
    │   ├── enemies.js     # NV.drawEnemy
    │   ├── bosses.js      # NV.drawBoss
    │   ├── player.js      # NV.drawPlayer
    │   └── hud.js         # HUD en canvas: cooldown, panel arma/habilidad/consumibles, stats TAB (NV.drawSpecialCooldown/drawWeaponHUD/drawStats)
    ├── ui/
    │   └── dom.js      # Árbol DOM (expuesto en NV.dom)
    ├── engine/
    │   ├── fx.js        # Efectos/FX (partículas, textos flotantes, estelas): NV.spawnExplosion/updateParticles/addFloatText/updateFloatTexts/updateTrails
    │   ├── drones.js     # NV.updateDrones (disparo de drones ENJAMBRE)
    │   ├── meteors.js     # NV.updateMeteors (Lluvia Estelar)
    │   ├── pickups.js     # NV.spawnWeaponPickup/updatePickups/updateWeaponPickups (drop de armas + shards)
    │   ├── enemies.js     # NV.spawnEnemy/spawnElite/killEnemy/updateEnemies
    │   ├── combat.js      # NV.enemyCritChance/calcEnemyDamage/computePlayerHit
    │   ├── boss.js        # NV.updateBoss/spawnBossProj/spawnMinion/runBossAttack
    │   ├── bullets.js     # NV.updateBullets (colisiones, bulwark, escudos)
    │   ├── weapons.js     # NV.shoot/findTarget/applyKnockback (disparo del jugador)
    │   └── special.js     # NV.useSpecial (habilidades: meteor/phase/bulwark/hivemind)
    └── game.js         # Orquestador: init/update/loop, flujo de oleadas/tienda/menú, input, guardado — IIFE
```

- **Sin builds, sin dependencias, sin servidor.** Se ejecuta directamente en el navegador. Orden de carga: `core/state.js` → `core/utils.js` → `data/gameData.js` → `data/balance.js` → `data/consumables.js` → `audio/synth.js` → `ui/dom.js` → `render/canvas.js` → `game.js`.
- `game.js` está en una **IIFE** con `'use strict'` (todo scoped, no contamina el global), pero los **datos** ya viven en `window.NV` (`core/state.js` + `data/gameData.js` + `data/balance.js` + `data/consumables.js`) y `game.js` los usa por **alias locales** (`const BALANCE = NV.BALANCE`, etc.).
- El estado del juego y del canvas es totalmente **procedural** (se dibuja en cada frame con `requestAnimationFrame`).

---

## 🎮 Presentación general

El jugador controla una nave/entidad en un área de `900 × 520` (escalada responsive al tamaño de pantalla) y debe **sobrevivir oleadas** de enemigos. Al completar una oleada (o al vencer un jefe cada 5 oleadas) se abre una **tienda** donde el jugador gasta **fragmentos (💎 shards)** para comprar mejoras, armas y consumibles. También puede recoger armas durante la partida y guardarlas en un **inventario de 6 slots** (teclas 1–6 en partida para equipar). El objetivo es acumular puntaje, avanzar oleadas y conseguir **progresión permanente** (meta) que se conserva entre partidas.

---

## 🧠 Arquitectura y flujo del código (`js/game.js`)

El archivo se organiza en secciones claramente comentadas. Flujo general:

1. **`init()`** — configuración inicial: carga la meta de `localStorage`, prepara el canvas, añade todos los listeners (teclado, botones, tarjetas de personaje) y arranca el loop de animación.
2. **`loop(now)`** — bucle principal: calcula `dt` (delta time, máx `0.03`), gestiona *hitstop* y *deathTimer*, llama a `update(dt)` y `draw()`, y aplica el *screen shake*.
3. **`update(dt)`** — solo corre si `state === 'playing'`. Mueve al jugador, dispara, gestiona habilidades/enfriamientos, spawn de enemigos/élites, timer de oleada, y actualiza todas las entidades.
4. **`draw()`** — renderiza todo en el canvas: fondo, grilla, barra de oleada, entidades, partículas, textos flotantes, HUD, panel de stats, y la pantalla de muerte con *jumpscare*.

### Estados del juego (`state`)
| Estado | Descripción |
|--------|-------------|
| `menu` | Pantalla de inicio con selección de personaje |
| `playing` | En plena oleada |
| `shop` | Tienda entre oleadas |
| `gameover` | Pantalla de muerte / derrota |

### Variable de estado clave: `player`
La nave del jugador y sus stats en vivo:
```js
{ x, y, hp, maxHp, speed, color, specialCd, maxCd, invuln, character,
  armor, luck, overdrive, xp, level, xpToNext }
```
También hay estado por partida: `wave`, `score`, `shards`, `boss`, `inventory`, `currentWeapon`, `consumableItems`… y estado de **meta** (persistente): `metaShards` y `permUpgrades`.

---

## 🕹️ Controles

| Input | Acción |
|-------|--------|
| `WASD` o flechas | Mover |
| `SHIFT` + dirección | Deslizamiento progresivo; acelera mientras se mantiene y desacelera al soltar |
| `ESPACIO`, `Z` o `X` | Habilidad especial |
| `TAB` | Mostrar/ocultar estadísticas |
| `P` | Pausa (no existe atajo con `ESC` en el código) |
| `1`–`6` en partida | Equipar arma del inventario |
| `F` | Usar el consumible disponible (poción/overdrive/escudo) |
| Botones táctiles | Mover izquierda/derecha + especial (móvil, **inactivos** — ver Estado actual) |

---

## 👤 Personajes jugables (4)

Definidos en `const CHARACTERS`. Se eligen en el menú inicial (tarjetas HTML) y cada uno tiene stats base, pasiva y habilidad especial.

| Personaje | HP | SPD | ARM | Pasiva | Habilidad (ESPACIO) | CD |
|-----------|----|----|-----|--------|---------------------|-----|
| BOTI | 120 | 200 | 0 | Regenera 1 HP cada 5s | Lluvia Estelar ☄️ | 6s |
| NOVA | 80 | 280 | 0 | +20% daño, recibe +20% | Fase Fantasma 👻 | 7s |
| ROOK | 160 | 150 | 5 | -15% daño recibido | Muralla 🛡 | 12s |
| ENJAMBRE | 90 | 240 | 0 | 15% esquiva | Drones de Combate 🛸 | 10s |

---

## 🔫 Armas (10)

Definidas en `const WEAPONS` con rareza `common / uncommon / rare / epic / legendary`.

| ID | Nombre | Daño | Vel. | Cadencia | Rareza | Pro | Con |
|----|--------|------|------|----------|--------|-----|-----|
| `pistol` | Pistola | 12 | 500 | 30 | common | Versátil | Daño bajo |
| `rifle` | Rifle | 20 | 700 | 25 | uncommon | Daño alto | Cadencia media |
| `smg` | Subfusil | 7 | 450 | 12 | rare | Muy rápido | Daño bajo |
| `shotgun` | Escopeta | 8 | 400 | 45 | rare | Área | Corto alcance |
| `sniper` | Francotirador | 50 | 1200 | 70 | epic | Daño extrema | Lenta |
| `laser` | Láser | 25 | 900 | 20 | epic | Penetra 1 | Daño medio |
| `plasma` | Plasma | 40 | 600 | 35 | legendary | Doble disparo | Lento |
| `flamethrower` | Lanzallamas | 6 | 260 | 14 | epic | Área amplia | Daño bajo |
| `bow` | Arco | 22 | 800 | 40 | rare | Penetra 3 | Cadencia media |
| `railgun` | Cañón de Riel | 70 | 1500 | 90 | legendary | Máximo daño | Muy lenta |

---

## 👾 Enemigos básicos (7 tipos)

Definidos en `const ENEMY_TYPES`.

| ID | Nombre | HP | Vel. | Daño | Shape | Behavior |
|----|--------|----|------|------|-------|----------|
| `drone` | DRON | 25 | 75 | 12 | circle | chase |
| `runner` | CORREDOR | 15 | 145 | 10 | triangle | chase |
| `tank` | TANQUE | 60 | 40 | 18 | hex | chase |
| `shielder` | ESCUDO | 35 | 65 | 8 | diamond | shield |
| `swarmlet` | ENJAMBITO | 10 | 115 | 8 | atom | swarm |
| `spitter` | ESCOPURAS | 22 | 50 | 15 | rock | ranged |
| `wisp` | ESPÍRITU | 12 | 160 | 6 | dot | erratic |

---

## 💀 Élites (8 tipos)

Definidos en `const ELITE_TYPES`. Aparecen aleatoriamente durante las oleadas, tienen más HP, score y xp, y se aturden brevemente al recibir daño (`e.stun = 0.25` en `updateBullets`).

| Nombre | HP | Vel. | Daño | Shape |
|--------|----|------|------|-------|
| ÉLITE | 90 | 90 | 20 | hex |
| RÁPIDO | 40 | 190 | 15 | triangle |
| TANQUE | 160 | 35 | 25 | rock |
| ASESINO | 55 | 165 | 30 | diamond |
| FANTASMA | 65 | 145 | 25 | circle |
| CAOS | 105 | 130 | 22 | atom |
| GOLIATH | 210 | 25 | 35 | rock |
| VELOCITY | 40 | 220 | 18 | dot |

---

## 👑 Jefes (10 tipos)

Definidos en `const BOSS_TYPES`. Aparecen cada 5 oleadas. Cada jefe tiene patrón de movimiento, tipo de ataque y forma propia.

| Nombre | HP base | Vel. | Patrón | Ataque | Shape |
|--------|---------|------|--------|--------|-------|
| JEFE | 300 | 30 | chase | repeater | hex |
| TITÁN | 450 | 25 | charge | heavy | hex |
| SEÑOR DEL VACÍO | 600 | 20 | summon | summon | circle |
| GUARDIÁN | 350 | 45 | circle | spread | hex |
| DESTRUCTOR | 500 | 28 | burst | beam | rock |
| NÉMESIS | 400 | 40 | teleport | volley | diamond |
| COLOSO | 700 | 18 | slow_charge | bomb | rock |
| FANTASMA | 280 | 45 | phase | orbs | circle |
| MUTANTE | 380 | 32 | split | split | hex |
| APOCALIPSIS | 800 | 22 | rage | rage | rock |

---

## 🛒 Tienda del Vacío

Se abre al completar una oleada o derrotar un jefe. Tiene **3 secciones** generadas dinámicamente por `generateOffers()` y renderizadas con `renderOffers()`:

1. **MEJORAS** (`dom.upgradesOffers`): mejoras permanentes para la partida actual.
2. **ARMAS** (`dom.weaponOffers`): nuevas armas para agregar al inventario.
3. **CONSUMIBLES** (`dom.consumableOffers`): potenciadores de un solo uso.

También incluye el **INVENTARIO** (`dom.invSlots`) con 6 slots. Para comprar, seleccionar una oferta y confirmar. Las armas recogidas se guardan en el inventario y se pueden equipar con las teclas **1–6** durante la partida.

Cada oferta muestra un **icono emoji** descriptivo y un **precio en 💎** (fragmentos): 💚 +25 HP, 🚀 Velocidad, 🛡 Armadura, 🍀 Suerte, 🧪 Poción, ⚡ Overdrive, 🛡 Escudo. Las ofertas de armas usan **arte pixelado procedural** (`drawWeaponPixelArt`) renderizado en un canvas de 64×64px dentro del `offer-icon`.

---

## 📦 Inventario

- **6 slots** (`INVENTORY_SLOTS`).
- Si el inventario está lleno, comprar un arma la equipa automáticamente.
- Las armas también se pueden recoger en la partida como *pickups* (`weaponPickups`).
- Al recoger un pickup: si hay slot libre se guarda; si no, se equipa directamente.

---

## 📊 Progresión

### Progresión por partida
- `wave`: oleada actual (aumenta al limpiar oleadas o derrotar jefes).
- `score`: puntaje acumulado por eliminar enemigos.
- `shards`: fragmentos gastables en la tienda (se obtienen de enemigos y jefes).
- `xp` / `level`: al matar enemigos se gana XP; al subir de nivel se otorgan +10 HP máx y +20 HP.

### Progresión permanente (meta)
- `metaShards`: fragmentos que persisten entre partidas (se ganan al morir: `metaShards += floor(shards/2) + floor(score/100)`).
- `permUpgrades`: mejoras permanentes compradas con meta-shards.
  - `damage`: +2 daño por nivel.
  - `speed`: +15% velocidad por nivel.
  - `hp`: +20 HP máx por nivel.
  - `luck`: +10 suerte por nivel (suma a `player.luck`; mejora el drop de shards y reduce el crítico enemigo).

Los datos de meta se guardan en `localStorage` (`neonVoidMeta`) mediante `loadMeta()` / `saveMeta()`.

---

## 🔊 Audio

Sistema de audio procedural basado en **Web Audio API** (sin archivos externos).

### Efectos de sonido (`sfx`)
- `sfx.pickup()` — pickup genérico.
- `sfx.special()` — uso de habilidad especial.
- `sfx.wave()` — inicio de oleada / victoria.
- `sfx.damage()` — daño al jugador.
- `sfx.levelup()` — subida de nivel.
- `sfx.explosion()` — muerte de enemigo.
- `sfx.bossAttack.<tipo>()` — sonido de ataque por cada tipo de jefe (`repeater`, `heavy`, `summon`, `spread`, `beam`, `volley`, `bomb`, `orbs`, `split`, `rage`).
- `playWeaponSound(weapon)` — sonido distinto por arma.

### Música synthwave
- Generada proceduralmente con osciladores, filtros y ruido.
- Estructura: kick + snare + hi-hat + bajo (sawtooth) + lead melódico.
- `updateMusic(dt)` incrementa la intensidad según si hay jefe en pantalla.
- Patrón de 16 steps (`DRUM_PATTERN`), acorde raíz rotativo (`CHORD_ROOTS`) y drone atmosférico continuo.

---

## 🎨 Efectos visuales

| Efecto | Dónde | Descripción |
|--------|-------|-------------|
| *Screen shake* | `shake`, `canvas.style.transform` | Vibración al recibir daño, al morir y en victorias. |
| *Hitstop* | `hitstop` | Congelamiento breve al impactar al jefe. |
| *Flash* | `flashColor`, `flashAlpha` | Pantalla iluminada al usar habilidades o victorias. |
| *Partículas* | `particles` | Explosiones, habilidades y FX. |
| *Textos flotantes* | `floatTexts` | Daño, críticos, level up, pickups. |
| *Estelas* | `trails` | Rastro del jugador y proyectiles. |
| *Meteoritos* | `meteors` | Habilidad de BOTI. |
| *Drones* | `drones` | Habilidad de ENJAMBRE. |
| *Barra de HP del jefe* | `drawBoss()` | HP sobre el jefe, color condicional. |
| *Flash de daño al jefe* | `boss.hitFlash` | Blanco que decae al recibir daño. |

---

## 🏗️ Detalle de sistemas principales

### Spawn de enemigos
- `spawnEnemy()` elige entre `ENEMY_TYPES` y, con probabilidad, un `ELITE_TYPES`.
- Si no hay jefe, genera enemigos cada `spawnTimer`.
- La cantidad por tick crece con la oleada: `2 + min(6, floor(wave/2))`.
- Frecuencia de spawn: `max(0.45, 1.3 - wave * 0.018)`.
- Escalado de HP: `hpScale = 1 + wave * 0.18` (más suave en oleadas altas).

### Daño
- Daño al jugador: `computePlayerHit(base)` → crítico (`chance = 0.08 + wave*0.018`, tope 35%, reducida por la suerte) → armadura plana → pasiva del personaje (NOVA +20%, ROOK −15%, ENJAMBRE esquiva 15%).
- Daño de armas: `weapon.damage + permUpgrades.damage * 2 + weaponLevel`.
- Armadura reduce daño plano: `max(1, dmg - player.armor)`.

### Oleadas y victoria
- `waveTimer` inicia en `max(15, 25 - wave * 0.4)` segundos.
- Al terminar: `triggerWaveVictory()` → `transition` → `showShop()`.
- Jefes cada 5 oleadas: al morir, `wave++` y se abre la tienda con victoria épica.

### Niveles
- XP necesaria por nivel: `xpToNext`, escala con `* 1.5` al subir.
- Al subir: `+10 maxHp`, `+20 hp`, flash dorado y texto `LEVEL UP!`.

---

## 🕒 Timeline / versionado

### v1 — Base del juego
- Motor completo con Canvas, estados `menu / playing / shop / gameover`.
- 4 personajes con habilidades especiales distintas (meteor, phase, bulwark, hivemind).
- 10 armas, 7 enemigos básicos, 8 élites, 10 jefes.
- HUD con HP, especial, oleada, score, shards.
- Tienda con 3 secciones (mejoras, armas, consumibles) e inventario de 6 slots.
- Progresión permanente (`metaShards`, `permUpgrades`) persistida en `localStorage`.
- Sistema de audio procedural synthwave (música + SFX por arma/jefe).
- Sistema de niveles por XP.

### v2 — Correcciones y balance
- **Fix de shop y tienda**: `generateOffers()` reescrita para estructura de 3 secciones con `renderOffers()`. (`js/game.js`)
- **Fix de sonido de jefes**: todas las llamadas a `sfx.bossAttack` corregidas de sintaxis de función a método (`sfx.bossAttack.repeater()`, etc.) en `runBossAttack()`. (`js/game.js`)
- **Fix de encoding**: corregida corrupción de emojis y caracteres especiales (tildes, ñ). (`js/game.js`, `index.html`, `README.md`)
- **Efectos FX ampliados**: explosiones, textos flotantes, estelas y partículas optimizadas.

### v3 — Relevamiento de mecánicas
- **Daño crítico enemigo**: críticos escalables con la oleada (`calcEnemyDamage`).
- **Stuns de élite**: al recibir daño, los élites se aturden 0.3s y se congelan (movimientos y disparos). (`updateEnemies`)
- **Densidad de spawns progresiva**: `2 + min(6, floor(wave/2))` enemigos por tick, frecuencia ajustada. Ya no hay oleadas de 3s. (`update()`)
- **Escalado de HP enemigo reforzado**: `hpScale = 1 + wave * 0.22`. (`spawnEnemy`)
- **Barra de HP del jefe y flash de daño**: `drawBoss()` con barra de HP y `hitFlash` blanco. (`BOSS_TYPES`, `nextWave`, `drawBoss`, `updateBoss`, daño en `updateBullets`)
- **Fix de scrollbar de la tienda**: `.shop-overlay` con `overflow-y: hidden`, `max-height: 100vh` y contenido compactado para evitar scroll. (`css/styles.css`)

### v4 — Bugs críticos
- **BUG CRÍTICO — oleadas que terminan en segundos**: la condición de fin de oleada (`transition <= 0 && waveTimer <= 0 && !boss`) se evaluaba después del countdown que abría la tienda. Cuando `transition` llegaba a 0, `showShop()` abría la tienda y, en el mismo frame, la condición volvía a dispararse → victorias automáticas (~1.3 s por oleada). **Fix**: fin de oleada evaluado antes del countdown de transición, reiniciando `waveTimer` limpio. Las oleadas duran de verdad y no "se ganan solas". (`update()`)
- **BUG — botón 📊 sin función**: `charBtn` no tenía listener. **Fix**: agregado a `dom` y vinculado a `showStats`. (`init()`)
- **Limpieza de estado al iniciar partida**: `startGame()` resetea `transition`, `paused` y `showStats`. (`startGame()`)
- **Nota sobre el "boss roto"**: tras la corrección de la cascada de oleadas, el flujo de jefe (spawn en múltiplo de 5, daño, `hitFlash`, barra de HP, derrota → victoria épica → tienda) quedó coherente.

---

### v5 — UI/UX de tienda y arte de armas
- **Tienda sin scroll ni desplazamiento**: `.shop-overlay` con `overflow-y: hidden`, `max-height: 100vh` y paddings/gaps reducidos para que todo el contenido quepa en pantalla sin scroll. (`css/styles.css`)
- **Arte de armas en la tienda**: se reemplazaron los emojis por dibujos pixelados procedurales generados con canvas (`drawWeaponPixelArt`). Cada arma tiene su propio sprite estilo pixel art retro (pistola, rifle, escopeta, subfusil, francotirador, lanzallamas, láser, cohete, plasma, cañón de riel). (`js/game.js`)

### v6 — Reconstrucción de la tienda rota

- **BUG CRÍTICO — CSS de ofertas corrupto**: la regla `.offer` estaba envuelta en `@"..."@` (delimitadores de C#, no de CSS), lo que rompía el parsing y dejaba las ofertas de la tienda totalmente sin estilar. **Fix**: eliminados los caracteres `@"` y `"@`. (`css/styles.css`: sección tienda/offers)
- **BUG CRÍTICO — `gameOver()` fuera de la IIFE**: la función tenía indentación 0, quedando fuera del `(() => { ... })();`. Al morir el jugador lanzaba `ReferenceError: triggerFlash is not defined`, congelando el juego e impidiendo avanzar/reiniciar. **Fix**: reindentada a 2 espacios para quedar dentro de la IIFE. (`js/game.js`, función `gameOver()`)
- **Iconos de ofertas rotos**: mejoras y consumibles mostraban los caracteres `?`, `??`, `???` (signos literales) en vez de emoji. **Fix**: reemplazados por emoji descriptivos — 💚 +25 HP, 🚀 Velocidad, 🛡 Armadura, 🍀 Suerte, 🧪 Poción, ⚡ Overdrive, 🛡 Escudo. (`js/game.js`, `generateOffers()`)
- **Icono de precio roto**: el precio de cada oferta mostraba `??` en lugar de 💎. **Fix**: reemplazado por 💎 (diamante), coherente con la barra de fragmentos. (`js/game.js`, `renderOffers()`)
- **Rediseño a pantalla de tienda dedicada (sin overlay)**: la tienda dejó de usar la clase compartida `.overlay` (fondo translúcido, centrado, scroll) y el botón quedaba recortado (`overflow-y: hidden`). Ahora es una pantalla propia `.shop-screen` con fondo sólido, `overflow: hidden` (sin scroll) y todo el contenido en cuadrículas auto-ajustables: `.shop-grid` (secciones MEJORAS / ARMAS / CONSUMIBLES con `flex: 1` y columnas `repeat(auto-fit, minmax(200px, 1fr))`) y `.offers` dentro de cada sección (`repeat(auto-fill, minmax(88px, 1fr))`). La sección de inventario y el botón ▶ CONTINUAR quedan al pie, siempre visibles. (`index.html` — div `#shop`, `css/styles.css` — `.shop-screen`)
- **Verificación**: `node --check js/game.js` pasa sin errores; la tienda vuelve a mostrarse estilizada y funcional (comprar, equipar, continuar).

---

### v7 — Mejoras y correcciones (mantenimiento)
- **Tienda de mejoras permanentes**: pantalla `#permShop` en el menú; gasta `metaShards` en `PERM_UPGRADES` (daño, velocidad, vida, suerte) con coste creciente (`permCost`). Aplica en `selectCharacter` y `startGame()`. (`index.html`, `js/game.js`)
- **Consumibles de uso real (tecla F)**: al comprar Poción/Overdrive/Escudo se guardan en `consumableItems` y se usan en partida con `F` (`useConsumable`). Indicador en el HUD canvas.
- **Nivel de armas por derribos**: `weaponLevels`/`weaponKills` (6 derribos por nivel), daño `+nivel`, se conserva al cambiar de arma; reemplaza al `weaponLevel` global fijo.
- **Fix Overdrive**: la velocidad solo se multiplica una vez (`*1.5` si no está activo), evitando inflarla con compras repetidas.
- **Fix boss `teleport` (NÉMESIS)**: ahora teletransporta cada 2.2 s (con partículas), no cada frame.
- **Escudo del `shielder`**: bloquea balas del frente en `updateBullets`.
- **Fix mojibake**: `Vida máxima`, `daño`, `¡`, `Poción`.
- **`permUpgrades.luck` aplicada** (+10 suerte por nivel).
- **Limpieza de código muerto**: `selectedWeapon`, `dom.offers`, `WX/WY`, `sfx.shoot`, `sfx.menu`; eliminado `js/utils.js` (vacío); `player.stun` duplicado.
- **Nueva tecla**: `F` para usar consumible.

---


### v8 — Pasivas, resistencias, críticos, meta y fases de jefe
- **Pasivas de personaje implementadas de verdad** (`computePlayerHit`): NOVA recibe +20%, ROOK -15%, ENJAMBRE 15% de esquiva (texto `ESQUIVA`); antes solo la regeneración de BOTI funcionaba (el resto era cosmético). (`CHARACTERS`, `js/game.js`)
- **Crítico de armas real**: cada bala tiene chance (`0.1 + suerte*0.002`) de hacer **×2** de daño y mostrarlo (`★CRIT`); antes el "CRIT" era un estun fantasma en golpe letal (inútil).
- **Elite stun corregido**: las élites ahora **se aturden 0.25s al recibir daño** (lo que el README ya prometía pero el código no hacía).
- **Resistencias de enemigos**: TANQUE (básico y élite) y GOLIATH tienen `resist: 3` (reducción plana de daño por bala). Es la primera resistencia del juego.
- **Balance de crítico enemigo**: chance tope 0.35 (antes 0.4) y multiplicador 1.6 (antes 1.75); además **la suerte del jugador reduce** la chance de crítico enemigo.
- **Escalado de HP de enemigos más suave**: `1 + wave*0.18` (antes `0.22`).
- **Meta mejorada**: nuevo nivel de **Armadura** (+1 por nivel), **tope máximo por mejora** (`MAX_PERM_LEVEL = 10`, muestra "MÁX"), y la **Suerte** ahora también reduce el crítico enemigo.
- **Sin élites durante jefes**: `spawnElite()` ya no corre si hay boss (antes, en oleadas de jefe pares seguían saliendo élites).
- **Tope de esbirros invocados** a 40 (antes 80) para evitar el caos en sumon/split.
- **FASE 2 de jefes**: al bajar del 50% de HP, un aviso `¡FASE 2!`, el jefe ataca ~2x más rápido, se mueve más rápido y muestra un anillo rojo pulsante.

### v9 — Movimiento y colisiones precisas
- **Deslizamiento progresivo**: `SHIFT` junto a una dirección acelera hasta 2.15× la velocidad normal; al soltar SHIFT o la dirección, la velocidad se reduce suavemente y no existe una distancia fija de deslizamiento. (`player.moveVx/moveVy`, listeners de teclado y `update()` en `js/game.js`)
- **Hitboxes de proyectiles enemigos**: cada proyectil de jefe guarda y dibuja su propio radio. `updateBullets()` comprueba la suma del radio real del proyectil y el radio visual del personaje, sustituyendo el umbral fijo de 25 px que podía registrar daño al pasar claramente por debajo de una bola.

### v10 — HUD compacto y alerta de vida crítica
- **Panel de estado compacto**: `.stats` ahora agrupa oleada, puntaje y fragmentos como chips pequeños con iconos; la habilidad se representa con un icono circular con anillo de recarga y pulsación al estar lista. (`index.html`, `css/styles.css`, `updateHUD()`)
- **Vida crítica al 25%**: al quedar con 25% de HP o menos, la barra de vida pasa a rojo y se sacude; además, `drawPlayer()` muestra un contorno rojo pulsante alrededor del personaje. Las alertas se desactivan automáticamente al recuperar vida por encima de ese umbral.

### v11 — Lenguaje visual unificado del HUD
- **Iconografía coherente**: oleada, puntaje y fragmentos reemplazan sus letras por símbolos visuales, incluido el diamante. Logo, indicadores, vida y botones comparten tamaño, borde, radio y brillo neon.
- **Habilidad sin texto**: el icono de habilidad ya no muestra `OK`/`CD`. Durante la recarga exhibe un relleno circular del color del personaje y, al quedar disponible, se vuelve completamente verde con pulso suave.

### v12 — Indicador de habilidad simplificado
- **Cooldown sin glifos**: el indicador de habilidad no contiene texto ni símbolos. Se rellena completamente en gris al iniciar la recarga y transiciona de forma continua hacia verde; al completarse queda verde y mantiene un pulso suave. El botón de sonido vuelve a usar únicamente su icono de altavoz.

### v13 — Habilidad lista destacada
- **Confirmación dorada sincronizada**: al completar el relleno verde, el indicador gana un borde dorado, brillo verde/dorado y un movimiento breve de elevación. Si se usa la habilidad, la clase de estado se elimina de inmediato y vuelve al aspecto neutro de recarga.

### v14 — HUD ajustado por contexto
- **Indicador de habilidad más compacto**: el círculo de habilidad pasa de 30 px a 26 px. Fuera del combate (tienda o pausa) se desactiva su pulso y se muestra en gris neutro.
- **Barra de vida más ancha**: `.hp-bar` se estira de 90 px a 112 px, conservando sus 18 px de alto y sus alertas de vida crítica.

### v15 — Cadencia determinista y proporcional a la oleada
- **Cadencia por tiempo real**: `update()` ahora resta `dt` a `fireTimer` (antes era un contador por frame, dependiente del framerate). `fireRate` se interpreta como frames a ~60fps (`FIRE_FPS = 60`), por lo que el ritmo de disparo real ya no cambia con el monitor/Hz. (`js/game.js`)
- **Cadencia proporcional a la dificultad de la oleada**: el intervalo efectivo (`weaponFireInterval()`) se acorta `1%` por oleada (`WAVE_CADENCE_SCALE = 0.01`), con tope de factor `0.55` (máx `-45%`) y sin bajar del piso `MIN_FIRE_INTERVAL = 4/60s` (~15 disparos/s).
- **Freno anti-congestión**: si hay más del `80%` de `MAX_BULLETS` en pantalla (`BULLET_SOFT_CAP = 0.8`), no se dispara y se reintenta al piso; evita saturar el render cuando la cadencia alta coincide con `overdrive`. (`update()`)

### v16 — Nivel de arma proporcional a la dificultad de la oleada
- **El progreso por derribo pesa según la oleada**: cada kill del arma equipada suma `weaponKillProgress() = min(3, 1 + 0.06×wave)` puntos a `weaponKills` (antes +1 fijo). Matar enemigos en oleadas altas (más duros) hace avanzar el nivel del arma al mismo ritmo, sin regalar niveles. (`js/game.js`)
- **Tope anti-explosión**: el peso máximo es 3 puntos por derribo (`WEAPON_PROGRESS_CAP = 3`). El umbral sigue siendo `6 × nivelActual`, por lo que más allá de la oleada ~34 el ritmo se estabiliza (≈2 derribos por nivel).

### v17 — Mejora de arma coherente: daño fijo + cadencia por nivel
- **Daño**: se mantiene aditivo y predecible `weapon.damage + permUpgrades.damage*2 + currentWeaponLevel()` (sin cambios de valor; comentario aclaratorio en `shoot()`).
- **Cadencia que mejora con el nivel del arma**: `weaponFireInterval()` ahora multiplica también por `levelFactor = max(0.6, 1 − 0.004×(nivel−1))` (−0.4% por nivel, máx −40%). Se combina con el factor de oleada (v15) y respeta el piso `MIN_FIRE_INTERVAL`. El DPS crece de forma suave por daño y por cadencia, sin cambiar velocidades/pierce/count (física intacta). (`js/game.js`)

### v18 — Estética de disparos por tier (cada 10 niveles del arma)
- **Tier visual por nivel**: `weaponVisualTier() = min(5, floor(nivel/10))` (nivel 1–9 base; 10–19 tier 1; 20–29 tier 2; …; ≥60 tier 5). (`js/game.js`)
- **En `shoot()`** cada bala del jugador guarda `tier`, `glowColor` (de `BULLET_TIER_COLORS` = cian, dorado, rosa, púrpura, turquesa, blanco) y `size = 3 + tier`. Solo visual; NO se usa en colisiones.
- **En `draw()`** las balas del jugador con `tier > 0` dibujan un halo exterior del color del tier y un glow más intenso (`shadowBlur = 10 + tier*2`); el núcleo conserva `weapon.color` y el tamaño crece `1px` por tier. Las balas enemigas se dibujan igual que antes.
- **Panel de stats** (`TAB`): muestra `| Tier N (color)` cuando el arma está en tier 1+.

### v19 — Rework de identidad visual de los disparos (v18 ajustado)
- **Geometría base propia por arma** vía `BULLET_DEFS` (formas y tamaños base pequeños): bala (pistola/rifle/subfusil/francotirador/riel, con largos distintos), flecha (arco), rayo fino (láser), orbe (plasma), perdigones (escopeta) y llama (lanzallamas). Se dibujan orientados a la dirección de vuelo (`drawBulletShape()`). Solo render; no afecta colisión. (`js/game.js`)
- **Tamaños reducidos**: ya no `3 + tier`. El proyectil conserva su tamaño base hasta tier 2 (nivel 1–29) y crece muy sutilmente desde tier 3: `g = max(0, tier−2) × 0.05` (tier 3 = +5%, tier 4 = +10%, tier 5 = +15%).
- **Glow compacto por tier**: `shadowBlur = 8 + tier` (en vez de `10 + tier*2`) y sin halo exterior grande.
- **`shoot()`** guarda `wid` en cada bala para elegir la forma; las balas enemigas y las de drones se dibujan como antes.

### v20 — Fix de bugs encontrados: shielder inmortal + enemigos que se congelan
- **ESCUDO (`shielder`) ya no es inmortal**: el rombo morado bloqueaba TODAS las balas porque el autofire siempre impacta por el frente. Ahora el escudo tiene recarga `SHIELD_COOLDOWN = 0.9s`: bloquea una bala y queda vulnerable un instante antes de volver a escudarse. (Se mantiene el bloqueo frontal; se agrega `shieldCd` al spawn y su decremento en `updateEnemies()`.)
- **Se elimina el "congelado" por saturación del buffer de balas**: balas del jugador y enemigas compartían `bullets` (tope 200), y cuando las enemigas llenaban el buffer, el jugador (y luego los propios enemigos) dejaban de disparar → montón estático sin atacar. Ahora hay **presupuestos separados** `MAX_PLAYER_BULLETS = 150` / `MAX_ENEMY_BULLETS = 120`, contados con `playerBulletCount()`/`enemyBulletCount()`, aplicados a los 4 puntos de balas enemigas (ESCOPURA, `spawnBossProj`, spread, orbs) y al disparo del jugador. Cada bando ya no bloquea al otro.
- **ESCOPURAS (`spitter`) mejorado**: color neón en paleta (`#6dc4c0`), deja de moverse recién a 170 px (antes 200) y agrega separación suave entre ellos para no apilarse; su forma `rock` recibe un brillo interior para no verse "roto".
- Se eliminó la constante muerta `BULLET_SOFT_CAP` (reemplazada por el conteo por bando).

### v21 — Mejora de tienda "Velocidad" → "Agilidad" (equilibrio de movimiento)
- **La mejora de tienda ya no infla la velocidad** (antes `player.speed *= 1.25`, que al comprarla varias veces volvía incontrolable al personaje y chocaba con el impulso de `Shift`).
- Ahora esa compra se llama **Agilidad** (`🌀`): aumenta `player.agility`, que **acelera y frena más rápido el movimiento** (`maxDelta`) sin cambiar la velocidad punta. Se ofrece **solo si no está al tope** (`MAX_AGILITY = 2`; cada compra `+0.2`, 5 compras = tope +100%).
- La velocidad normal sigue siendo `char.stats.speed × (1 + permUpgrades.speed*0.15)`, y `Shift` sigue multiplicando por `2.15` (sin inflarse por compras).
- Se muestra `Agilidad: x2.00` en el panel de estadísticas (`TAB`).

### v22 — Fix de HUD: oleada completa y puntaje entero legible
- **Oleada ya no se corta**: el span `#wave` ("OLEADA 12") tenía `max-width:54px` + ellipsis que lo recortaba. Se quita el corte (`max-width:none`, `overflow:visible`) y se agrega `white-space:nowrap` a `.stat` para que ningún número se parta. (`css/styles.css`)
- **Puntaje entero y formateado**: nuevo helper `formatPoints(n)` que redondea a entero, separa los miles y abrevia números enormes (≥100.000 → `123K`, ≥1.000.000 → `1,5M`) para que nunca desborde el contenedor. Aplicado al HUD (`dom.score`) y a la pantalla de game over (`dom.goScore`). (`js/game.js`)
- Continuo: los fragmentos (`shards`) ya eran enteros; el `goWave`/barra de oleada del canvas también.

### v23 — Fase 0+1 del refactor: desmonolitizar (datos al namespace `NV`)
- **Se define el namespace global `window.NV`** (`js/core/state.js`), futuro contenedor del estado compartido. Se carga primero.
- **Los datos puros se extraen a `js/data/gameData.js`** (personajes, armas, rarezas, formas de proyectil, enemigos, élites, jefes, mejoras permanentes). Se carga antes de `game.js`.
- `game.js` ahora consume esos datos mediante **alias locales** (`const CHARACTERS = NV.CHARACTERS;`), por lo que **ninguna referencia interna cambió** → mismo comportamiento. `index.html` carga los scripts en orden: `core/state.js` → `data/gameData.js` → `game.js`.
- Estructura: `js/` ahora tiene subcarpetas `core/` y `data/` (primer paso del plan de desmonopolización; siguen `utils`, `audio`, `engine`, `render`, `ui`, `main`).

### v24 — Fase 2 del refactor: utilidades puras
- Se crea `js/core/utils.js` con helpers puros (sin estado): **`NV.formatPoints`** (formato de puntaje).
- `game.js` lo consume con alias local `const formatPoints = NV.formatPoints;`. Orden de carga: `core/state.js` → `core/utils.js` → `data/gameData.js` → `game.js`.

### v25 — Fase 3 del refactor: migración de audio a `js/audio/synth.js`
- **Audio extraído de `game.js`**: toda la cadena synthwave/SFX (`initAudio`, `updateMusic`, `playWeaponSound`, `sfx.*`, drones y programación de notas) pasó a `js/audio/synth.js` (IIFE). Estado mutable en `window.NV` (`NV.soundOn`, `NV.audioCtx`, `NV.musicState`, `NV.musicTime`).
- **`game.js`** expone accessors `NV.getFrame`/`getState`/`getBoss`/`getPlayer` (cierran sobre `frame`/`state`/`boss`/`player`) y consume el audio por aliases locales (`const initAudio = NV.initAudio; const updateMusic = NV.updateMusic; const playWeaponSound = NV.playWeaponSound; const sfx = NV.sfx;`). El código migrado es una copia fiel (copy + refs a `NV`): lógica, patrón, timing y volúmenes idénticos → comportamiento idéntico.
- Orden de carga en `index.html`: `core/state.js` → `core/utils.js` → `data/gameData.js` → `audio/synth.js` → `game.js`.
- **NOVA — bug de daño NO corregido** (intencional): el multiplicador de daño saliente documentado en `shoot()`/`baseDmg` se deja pendiente; se conserva el comportamiento documentado y no se altera el balance.
- Verificación: `node --check js/game.js` y `node --check js/audio/synth.js` OK; smoke runtime en Node (carga ordenada + ejercicio de `initAudio`/`updateMusic`/`playWeaponSound`/`sfx.*` y toggle `soundOn`) pasa 18/18.

### v26 — Fase 4 del refactor: canvas/ctx y DOM en módulos
- **Canvas/ctx extraído**: `js/render/canvas.js` expone `NV.canvas`/`NV.ctx`; `game.js` los aliasa (`const canvas = NV.canvas; const ctx = NV.ctx;`) sin tocar `draw()`/`resizeCanvas()`.
- **DOM extraído**: `js/ui/dom.js` expone `NV.dom`; `game.js` aliasa `const dom = NV.dom;`, sin cambiar referencias `dom.*`.
- Comportamiento idéntico: misma data de elementos, solo se reubica la declaración.
- Verificación: `node --check js/render/canvas.js`, `node --check js/ui/dom.js`, `node --check js/game.js` OK; smoke runtime 7 módulos, 13/13 checks.

### v27 — Fase 5 del refactor: balance y consumibles a `data/`
- **`js/data/balance.js`**: extrae el bloque de constantes de tuning de `game.js` y lo expone como `NV.BALANCE` (congelado con `Object.freeze`). Incluye: `MAX_ENEMIES`, `MAX_BULLETS`, `MAX_PARTICLES`, `MAX_PLAYER_BULLETS`, `MAX_ENEMY_BULLETS`, `MAX_PERM_LEVEL`, `FIRE_FPS`, `MIN_FIRE_INTERVAL`, `WAVE_CADENCE_SCALE`, `WEAPON_LEVEL_CADENCE_SCALE`, `SHIELD_COOLDOWN`, `MAX_AGILITY`, `AGILITY_PER_UPGRADE`, `WEAPON_KILLS_PER_LEVEL`, `WEAPON_PROGRESS_SCALE`, `WEAPON_PROGRESS_CAP`.
- **`js/data/consumables.js`**: extrae las definiciones de consumibles a `NV.CONSUMABLES` (poción `hp:40`, overdrive `speedMult:1.5/duration:5`, escudo `duration:2`), congelado. `useConsumable` en `game.js` los lee desde ahí.
- `game.js` consume por alias locales (`const CONSUMABLES = NV.CONSUMABLES;`, y lee `NV.BALANCE.*` inline en las 16 constantes). Comportamiento idéntico.
- Estructura: `data/` pasa a tener `gameData.js` + `balance.js` + `consumables.js`.
- Verificación: `node --check` de los 2 nuevos módulos y de `game.js` OK; refs a `NV.BALANCE` (16 usos) y `NV.CONSUMABLES` confirmadas en runtime.

### v28 — Fase A del refactor: render desmonopolizado a `js/render/`
- Extraído del monolito el **render de entidades/HUD** a módulos independientes (cada uno una IIFE que expone funciones PURAS de dibujo en `NV.*`). Este corte es mecánico y **no cambia ningún comportamiento**: `game.js` conserva wrappers locales (`function drawEnemy(e){ NV.drawEnemy(ctx, e, frame); }`) que aportan el `ctx` y los valores de su closure, por lo que el frame dibuja exactamente igual.
- Nuevos módulos en `js/render/`:
  - `projectiles.js` → `NV.drawBulletShape` (forma por arma, patrón del proyectil) + `NV.drawSpecialVFX` (anillo del especial).
  - `enemies.js` → `NV.drawEnemy` (formas hex/triangle/diamond/atom/rock/dot + élite).
  - `bosses.js` → `NV.drawBoss` (cuerpo, forma, barra HP, flash, anillo FASE 2, nombre).
  - `player.js` → `NV.drawPlayer` (forma del piloto + auras: crítico, fase fantasma, muralla, respiración, orbital swarm).
  - `hud.js` → `NV.drawSpecialCooldown`, `NV.drawWeaponHUD`, `NV.drawStats` (paneles en canvas).
- `game.js` **baja de ~2156 a ~1734 líneas** (se sacaron ~500 líneas de dibujo). Orden de carga en `index.html`: `core` → `data` → `audio` → `ui/dom` → `render/canvas, projectiles, enemies, bosses, player, hud` → `game.js`.
- Verificación: `node --check` de todos los módulos OK; smoke runtime en Node (con ctx/canvas/DOM stubs) **22/22** checks de render (todas las formas + estados).

### v29 — Fase B del refactor: engine FX a `js/engine/fx.js`
- Extraído del monolito el **primer bloque del motor**: los efectos visuales (FX) a `js/engine/fx.js`. Son las funciones más aisladas (operan solo sobre sus arrays de partículas/textos/estelas), ideal para el corte inicial del `engine`.
- Expuestas en `NV.*`: `NV.spawnExplosion` (empuja partículas por referencia, respeta `MAX_PARTICLES`), `NV.updateParticles`, `NV.addFloatText`, `NV.updateFloatTexts`, `NV.updateTrails`.
- **Patrón de array**: las que hacen `filter` reciben el array y **devuelven el filtrado** (el wrapper en `game.js` lo reasigna: `particles = NV.updateParticles(dt, particles)`); las que hacen `push` mutan el array por referencia. Así el comportamiento es idéntico.
- `game.js` conserva wrappers locales (`function spawnExplosion(x,y,c,col,s){ NV.spawnExplosion(particles, MAX_PARTICLES, x,y,c,col,s); }`) → mismas firmas de llamada, cero cambios en el resto.
- Orden de carga: `... render/hud.js` → `engine/fx.js` → `game.js`.
- Verificación: `node --check js/game.js` y `node --check js/engine/fx.js` OK; smoke runtime **6/6** (push/filter/interacción con refs).

---

### v30 — Fase C del refactor: engine drones + meteoros
- `updateDrones` → `js/engine/drones.js` (`NV.updateDrones`): recibe `dt, drones, player, bullets, MAX_BULLETS, findTarget`; devuelve el array filtrado. Wrapper en `game.js` reasigna `drones`; `findTarget` (closure) inyectado como callback.
- `updateMeteors` → `js/engine/meteors.js` (`NV.updateMeteors`): recibe `dt, meteors, ctxState{H, enemies, boss, shake}, cbs{killEnemy, applyKnockback, spawnExplosion}`; devuelve `{meteors, shake}`. Callbacks inyectados preservan las closures del monolito; `shake` (let) vuelve del return.
- Orden de carga: `... render/hud.js` → `engine/fx.js, drones.js, meteors.js` → `game.js`.
- Verificación: `node --check` OK en drones/meteors/game; smoke runtime **5/5** (dispara+expira drones; daño a enemigo/boss por meteoros; salida de pantalla; filtro correcto).

### v31 — Fase D del refactor: engine pickups (armas + shards)
- `spawnWeaponPickup`, `updatePickups`, `updateWeaponPickups` → `js/engine/pickups.js` (`NV.*`).
  - `NV.spawnWeaponPickup(WEAPONS, weaponPickups, W, H, showBanner, RARITY_COLORS)`: empuja un pickup por ref + banner.
  - `NV.updatePickups(dt, pickups, player, addFloatText, pickupSfx)` → `{ pickups, shards }`: recolecta shards/coins.
  - `NV.updateWeaponPickups(dt, weaponPickups, player, inventory, INVENTORY_SLOTS, currentWeapon, addFloatText, RARITY_COLORS, pickupSfx)` → `{ weaponPickups, currentWeapon }`: guarda en inventario o equipa si está lleno.
- Callbacks inyectados (`showBanner`, `addFloatText`, `sfx.pickup`) preservan closures del monolito; `shards` (let) y `currentWeapon` se reasignan desde el return del wrapper.
- Orden de carga: `... render/hud.js` → `engine/fx.js, drones.js, meteors.js, pickups.js` → `game.js`.
- Verificación: `node --check` OK en todos los engine modules + game.js; smoke runtime **4/4** (spawn dentro de pantalla; recolección de shard con filtro; guardar vs equipar según inventario).

### v50 — Tanda C1: cofres del jefe
- Al matar un jefe, suelta un **cofre de botín** dorado en su posición. Al tocarlo libera **1-3 pickups** (55% chance de shards de valor alto deja 3-6, 45% un arma aleatoria).
- El cofre queda en el campo hasta recogerlo; expira tras 30s. Visual: cofre dorado pulsante con glow (reutiliza la paleta del jefe/tienda).
- `NV.updateBossChests(dt, chests, player, pickups, weaponPickups, WEAPONS, addFloatText, pickupSfx)` puro y testeable en `pickups.js`; `spawnBossChest` se invoca desde `boss.js` al morir (callback opcional, no rompe la lógica de jefe existente). Tests `boss_chest` 7/7.
### v50 — Tanda B2: venta de armas desde el inventario
- El botón de "quitar" (✕) ahora es **vender** (💰): da 💎 según rareza, siempre por debajo del precio de compra (25) para no farmear economías.
- Tabla centralizada `WEAPON_SELL_PRICES` en balance.js (common 6 · uncommon 9 · rare 12 · epic 16 · legendary 20); `NV.weaponSellValue(weapon, sellMap)` puro y testeable.
- Vender libera el slot, y si era la equipada vuelve a Pistola. Muestra "+X 💎" y actualiza el contador de la tienda.
- Visual: botón dorado coherente con la paleta (antes era una ✕ rosa de interfaz web). Tests `weapon_sell` 5/5.
### v50 — Tanda B1: fusión de armas repetidas
- **Drops**: recoger un arma que ya poseés NO ocupa slot nuevo — sube su **nivel de fusión** (aviso "FUSIÓN Nv X"). Al alcanzar el tope, el drop queda en el suelo con "FUSIÓN MÁX".
- **Daño**: `NV.weaponFusionDamage(base, fus, 0.2)` = +20% de daño por nivel de fusión (cap 3, aplicado sobre base+nivel, críticos incluidos). Puro y testeable.
- **Tienda**: comprar un arma repetida ahora ofrece **FUSIONAR** (15💎, más barato que comprar 25) subiendo el nivel; al máximo no se ofrece. Las ofertas no repetidas se compran igual que siempre.
- **Visual**: badge dorado "Fusión NvX" en el slot del inventario (`inv-fuse`).
- Constantes centralizadas en `balance.js`: `MAX_WEAPON_FUSION:3`, `WEAPON_FUSION_DMG:0.20`, `WEAPON_FUSE_PRICE:15`. Retrocompat: `updateWeaponPickups` acepta `tryFusion` opcional (tests viejos siguen verdes). Tests `weapon_fusion` 6/6.
### v49 — Tanda A: identidad visual y feedback (juego "vivo")
- **A1 · Ojos**: todos los enemigos tienen ojos que **miran al jugador** (`NV.drawEnemyEyes`, esclerótica blanca + pupila orientada por `atan2`); pupilas rojas en élites. Firma `drawEnemy(ctx, e, frame, player)` extendida con retrocompatibilidad (sin player no dibuja ojos). Tests `enemy_eyes` 3/3.
- **A2 · Reacción de jefes**: golpe ≥2,5% de su HP máx => globo de enojo (`@%$#!`, 😡, 💢…) sobre el jefe (`NV.bossHitReaction`) con cooldown de 1,6s decrementado en `updateBoss`. Conectado desde `bullets.js` al aplicar daño. Tests `boss_rage` 4/4.
- **A3 · Feedback ambiental**: campo de 90 estrellas con **parallax de 3 capas** contra la posición del jugador + titileo (`NV.drawStarfield` puro y determinista, canvas.js); **polvo de propulsión** cian detrás del jugador mientras desliza (Shift). Tests `ambient_fx` 4/4.
- Robustez: `init()` tolera entornos sin `window.location` (sandboxes de tests).


### v48 — recoger armas nunca auto-equipa
- **Fix**: con inventario lleno (6/6), pisar un drop de arma ya NO reemplaza/equipa la que tenías (antes la perdía y cambiaba sola). Ahora el drop queda en el suelo, avisa "INVENTARIO LLENO" (con anti-spam de 1.2s) y se recoge normalmente apenas liberes un slot.
- El cambio de arma sigue siendo 100% explícito: teclas 1-6, rueda del mouse o tienda.
- Tests: nuevo `tests/weapon_pickup.js` (4/4).


### v47 — modo testing sin persistencia + tope de consumibles
- **`index.html?fresh=1`**: arranca con permanentes y meta-shards en cero y **congela el guardado** (`metaFrozen`) — ideal para testear balance desde cero sin pisar el progreso real de `localStorage`. Sin el flag, todo funciona exactamente igual que antes.
- **`NV.resetMeta()`** en consola: borra `neonVoidMeta` al instante (recargar aplica el reset).
- **Tope de consumibles**: máximo **3 compras por tipo por visita** a la tienda (`CONSUMABLE_CAP`, contador `consumableBought` reseteado en `showShop`). La oferta muestra `(n/3)` y desaparece al agotarse — mismo patrón que los topes de mejoras. Los 3 consumibles unificados en una tabla declarativa (`consumableDefs`).
- Tests: nuevo `tests/shop_meta.js` (4/4). Resto de suites verdes.


### v46b — fix HUD de oleada + transición de tienda pulida
- **Fix real del orden**: el `wave++` se ejecutaba inmediatamente al ganar la oleada (tanto en la victoria normal como dentro de `boss.js` al morir el jefe), así que `updateHUD()` pintaba "OLEADA n+1" durante la celebración. Ahora el incremento vive únicamente en `skipShop()`: el HUD conserva el número y progreso de la oleada completada hasta que el jugador sale de la tienda.
- **Transición con personalidad** (timing total ≤550ms, CSS puro): título que cae con blur→foco y asentamiento de letter-spacing; secciones en cascada (fade-up con retardos escalonados); barrido de luz superior en cian/violeta (paleta del juego) con glow.
- Tests: economy 3/3, boss_ai 5/5.


### v46 — transición fin de oleada → tienda
- **Fix de orden**: durante la celebración de victoria (`transition > 0`) ya no corren spawns ni el countdown de la oleada siguiente — antes se veían arrancar los primeros enemigos de la próxima oleada antes de que apareciera la tienda. Ahora durante la celebración solo siguen las partículas/efectos, y la oleada nueva arranca recién al salir de la tienda (`skipShop` → `nextWave`).
- **Transición visual**: entrada animada de la pantalla de tienda vía CSS puro (`@keyframes shop-in`: fade + leve zoom-out 1.04→1, 400ms ease-out). Se reinicia sola al pasar de `display:none` a visible, sin JS adicional. Mismo lenguaje visual (paleta y easing suaves del juego).
- Sin cambios en timing de oleadas, tienda, boss rounds ni economía (tests economy 3/3, boss_ai 5/5, char_skills 3/3).


### v45 — cambio de arma con la rueda del mouse
- **Rueda del mouse en partida**: rueda abajo = arma siguiente, arriba = anterior, ciclo circular sobre [pistola base + inventario]. Funciona para todos los personajes (el inventario es compartido). Ignorado en menús/pausa.
- Lógica centralizada y pura: `NV.cycleWeapon(current, list, dir)` en `core/utils.js` (devuelve instancias por referencia, conserva nivel/rareza del arma del inventario).
- El wrapper `cycleWeapon` en `game.js` reutiliza el mismo feedback que equipar por tecla (texto flotante + sonido + HUD).
- Hint de tienda actualizado: "teclas 1-6 o rueda del mouse".
- Tests: nuevo `tests/weapon_wheel.js` (5/5) — orden circular, dirección, identidad de instancia, casos límite.


### v41–v44 — rework de habilidades (kit de personajes + FX legibles)
- **ENJAMBRE (v41)**: los drones targetean al enemigo/jefe más cercano al jugador dentro de **300px** (antes solo la órbita de 55px). VFX: línea de puntería punteada del dron al objetivo con marca, se desvanece en 0.3s. Test `tests/drone_targeting.js` (4).
- **NOVA numérico (v42)**: aura de Fase Fantasma `12→40 dps`, radio `45→70px`, y ahora **también daña al jefe** (×`PHASE_AURA_BOSS_MULT 0.3`). Constantes en `balance.js`. VFX: zona de daño visible (relleno pulsante + borde rotante en guiones) separada del aura espectral del personaje. Test `tests/nova_aura.js` (3).
- **ROOK (v43)**: Muralla gana **Onda de Choque**: aturde 1s y empuja a enemigos en ≤120px al activar; el reflejo sube `20→30` (+50%). Nuevo **sistema reutilizable de shockwaves** (`fx.js`: spawn/update + render con doble anillo y easing ease-out). Test `tests/rook_shockwave.js` (4).
- **NOVA Detonación Espectral (v44)**: al terminar la fase, estallido que pega **50% del DoT acumulado** (`PHASE_DETONATION_MULT`) por enemigo tocado (el jefe aplica además su mult anti-boss). Lógica testeable en `NV.detonatePhase`. VFX: doble anillo espectral (#caa7ff + blanco) + explosión + flash, claramente distinto del aura. Test `tests/nova_detonation.js` (4).


### v40 — rebalance de habilidades: nerf quirúrgico a Lluvia Estelar (BOTI)
- **Cooldown** `6 → 14s` (sigue siendo fuerte, pero ya no cada 6 segundos).
- **Anti one-shot contra jefes**: nueva constante `METEOR_BOSS_DMG_MULT: 0.3` en `balance.js` — el daño de meteoro al jefe pasa de 30 fijo a **9 por impacto** (~108 máx por uso vs ~360 antes). Daño contra enemigos comunes intacto (40).
- **Tests**: nuevo `tests/char_skills.js` (3/3) — cooldown, multiplicador anti-jefe y daño a comunes sin cambios.


### v39 — rango de activación por arma (attack range)
- Nuevo campo **`range` (px) en cada arma** de `data/gameData.js` — centralizado en la config, sin hardcodeos.
- `NV.shoot` solo dispara si hay objetivo y está dentro del alcance del arma; devuelve `false` si está fuera de rango o no hay objetivo, y `game.js` reintenta en ~1 frame (`MIN_FIRE_INTERVAL`) sin consumir la cadencia del arma ni reproducir sonido.
- Rangos: railgun 800 · sniper 700 · bow 540 · plasma 520 · rifle 480 · laser 450 · pistol 380 · smg 320 · shotgun 240 · flamethrower 170.
- **Tests**: nuevo `tests/weapon_range.js` (4/4) — range definido en todas, orden relativo coherente, no-disparo fuera de rango, disparo dentro de rango y en el límite exacto.


### v38 — IA de jefes: puntería predictiva, ataques adaptativos, stun y más durabilidad
- **Durabilidad**: multiplicador global de HP de jefe `×1.5 → ×1.8` (oleada 10 ≈ 3.690 HP).
- **IA predictiva**: nueva `NV.predictAim` — los proyectiles del jefe apuntan a donde *estará* el jugador (lead al 80% del tiempo de vuelo, esquivable cambiando de dirección). Integrada en `spawnBossProj`.
- **IA adaptativa**: nueva `NV.selectBossAttack` — cada jefe conserva su ataque primario como identidad pero re-evalúa cada 8s (5s en FASE 2): invocador sigue invocando salvo arena saturada; remata con `volley` si el jugador está herido (<35% HP) y cerca; presión a distancia (`spread`) si el jugador está lejos; en FASE 2 con arena limpia cambia de registro vía pool secundario propio (`NV.AI_SECONDARY`). Al entrar en FASE 2 fuerza re-selección inmediata.
- **Stun por ataque**: subset de ataques ahora puede aturdir — heavy 25%, bomba 30%, láser cargado (beam) 35%. El resto usa el `stunChance` base del jefe.
- **Patrones variados**: `spread` ahora dispara **espiral rotante** (offset +0.35 rad por ráfaga); `volley` encadena ráfaga principal + seguimiento rápido (0.18s).
- **Tests**: nuevo `tests/boss_ai.js` (5/5) — fórmula de HP, lead predictivo, stun por disparo, árbol de decisión adaptativo e integración en `updateBoss`.


### v37 — rebalancing duro (ronda 2): jefes con pelea larga y PvE que molesta
- **Jefes**: HP ahora **cuadrático en la oleada**: `(bt.hp + wave²×12 + wave×40) × 1.5` — oleada 5 ≈ 1425 HP, oleada 10 ≈ 3075, oleada 15 ≈ 5625, oleada 25 ≈ 13425 (antes ~945 en la 10; morían en segundos).
- **PvE**: HP enemigo escala `0.30/oleada` (antes 0.22); **daño enemigo escala** `+1.5/oleada` (cap +60) y élites `+2/oleada` (cap +80) — antes el daño era plano y la armadura lo anulaba; HP de élite cuadrático (`90 + wave²×1.5`).
- **Densidad**: intervalo de spawn `máx(0.25s, 1.3 − oleada×0.035)` (antes piso 0.45 y pendiente 0.018) → oleadas mucho más pobladas.


### v36 — rebalancing (tienda, economía y dificultad)
- **Topes de tienda por partida** (`SHOP_CAPS`): +25 HP ×8, Armadura +3 ×5, Suerte +2 ×7. La oferta desaparece al agotar el tope (muestra `n/max`); se resetean en cada partida (`shopBought`). Agilidad ya tenía tope propio.
- **Economía de 💎**: élite garantiza un shard de **valor 3** (`p.value`, soportado por `updatePickups`); jefe paga **50 + wave×5** (antes 30 fijos); fin de oleada da **8 + wave×2** (antes 10).
- **PvE más difícil**: escala de HP enemiga `0.18→0.22/oleada`; velocidad `+2.5/oleada` con cap `+40`; crítico enemigo base `8%→10%`; élites desde oleada **3**, en oleadas impares (antes desde la 2, pares).
- **Jefes realmente difíciles**: **+35% HP** (`(bt.hp + wave*25)×1.35`); FASE 2 acelera ataques ×1.4 (antes ×0.9) y movimiento ×0.6; cadencias reducidas: heavy 1.8→1.35, summon 3.5→2.6 (cap esbirros 26), spread 1.7→1.25, volley 1.3→0.95, bomb 2.0→1.6, orbs 1.4→1.1, split 1.5→1.15, rage cd `0.55+hpct×1.2`, default 1.5→1.1, beam 4.6→3.6.
- **Tests**: nuevo `tests/economy.js` (3/3) — recompensa de jefe, valor de shards y topes definidos; `tests/space_special.js` sigue 4/4.


### v35 — fix: crash del ataque especial (barra espaciadora)
- **Bug**: al lanzar el especial con cualquier personaje salvo `swarm` (Enjambre), el juego se congelaba en el frame siguiente. Causa: el wrapper de `useSpecial` en `game.js` no pasaba `drones` en el estado a `NV.useSpecial`, que devolvía `drones: undefined`; la rama hivemind lo reasignaba (`drones = []`) y por eso era el único inmune. El siguiente frame, `updateDrones` recibía `undefined` y la excepción cortaba el `requestAnimationFrame`.
- **Fix**: 1 línea — pasar `drones` en el estado (game.js).
- **`tests/space_special.js`** (nuevo): arnés headless que carga todos los módulos con stubs de DOM/canvas/audio, arranca partida con cada personaje, dispara Espacio y corre 300 frames verificando que no haya excepciones. Resultado: 4/4 ok.


### v34 — engine: weapons + special (fin de la desmonopolización del gameplay)
- **`js/engine/weapons.js`**: `NV.shoot` (proyectiles del jugador: crítico por suerte, overdrive ×2, tier visual), `NV.findTarget`, `NV.applyKnockback`.
- **`js/engine/special.js`**: `NV.useSpecial` (Lluvia Estelar, Fase Fantasma, Baluarte, Enjambre); retorna `{ specialVFX, drones, shake }`.
- Smoke: 5/5. `game.js`: ~1323 → ~1236 líneas. Queda como orquestador puro (init/update/loop, flujo de oleadas/tienda/menú, guardado).


### v33 — engine: combat + boss + bullets
- **`js/engine/combat.js`**: `NV.enemyCritChance`, `NV.calcEnemyDamage`, `NV.computePlayerHit` (IA de crítico/daño enemigo y resolución de golpes al jugador: esquiva, armadura, bulwark, escudo).
- **`js/engine/boss.js`**: `NV.updateBoss`, `NV.spawnBossProj`, `NV.spawnMinion`, `NV.runBossAttack` (patrones del jefe, muerte → score/wave, ataques).
- **`js/engine/bullets.js`**: `NV.updateBullets` (balas amistosas/enemigas, colisiones, pierce, knockback, escudos).
- Patrón **ctxState+callbacks**: reciben un objeto de estado y callbacks (`killEnemy`, `spawnExplosion`, `computePlayerHit`, …) y retornan el estado mutado; `game.js` solo conserva wrappers que reasignan el resultado.
- Smoke: 9/9 (combat 2, boss 3, boss+bullets 4). `game.js`: ~1521 → ~1323 líneas.


### v32 — Fase E del refactor: engine enemigos (spawns + comportamiento + derribo)
- `spawnEnemy`, `spawnElite`, `killEnemy`, `updateEnemies` → `js/engine/enemies.js` (`NV.*`).
  - `NV.spawnEnemy(st)` / `NV.spawnElite(st)`: push por ref (respeta `MAX_ENEMIES`, no durante jefe; élites solo waves pares ≥ 2).
  - `NV.killEnemy(st)` → devuelve el **nuevo `score`** (primitivo `let`); muta `player` (xp/nivel/hp), `weaponLevels`/`weaponKills`/`pickups` por ref; usa callbacks `addFloatText`, `sfx`, `triggerFlash`, `spawnExplosion`, `weaponKillProgress`.
  - `NV.updateEnemies(dt, st)` → `{ enemies, shake, gameOver }`: comportamientos (chase/erratic/swarm/shield/ranged + disparo), knockback decay, daño al jugador (vía `computePlayerHit`). `enemies` filtrado y `shake`/`gameOver` vuelven del retorno.
- Patrón **ctxState + callbacks**: se pasan en un objeto `st` las constantes/arrays/closures; SOLO los primitivos `let` que cambian (`score`, `enemies` filtrado, `shake`) o flags (`gameOver`) se devuelven por el return.
- Orden de carga: `... render/hud.js` → `engine/fx.js, drones.js, meteors.js, pickups.js, enemies.js` → `game.js`.
- Verificación: `node --check` OK en todos los engine modules + game.js; smoke runtime **6/6** (spawn tope-máx + élite; killEnemy score/xp/level/arma; chase avanza; ranged dispara). `game.js` baja a ~1521 líneas.

---

## 🚀 Cómo ejecutar
El proyecto es **100% front-end, sin build ni servidor**. Para jugar:

1. Abrí `index.html` directamente en un navegador moderno (Chrome, Edge, Firefox) haciendo doble clic o arrastrándolo.
   - No requiere `npm install`, ni `node_modules`, ni dependencias externas.
   - El audio usa la **Web Audio API**; el navegador puede pedir permiso para reproducir sonido tras interactuar con el botón **COMENZAR**.
   - La progresión permanente se guarda en `localStorage` de tu navegador (clave `neonVoidMeta`).

2. (Opcional) Para desarrollo podés servir la carpeta con cualquier servidor estático, p. ej.:
   ```sh
   python -m http.server 8000        # desde la raíz de JuegoDemo
   ```
   y abrir `http://localhost:8000`. Es exactamente lo mismo que abrir el archivo.

### Comandos / verificación útiles

| Comando | Propósito |
|--------|-----------|
| `node --check js/game.js` | Valida sintaxis de `game.js` sin ejecutarlo (devuelve `0` si pasa). |
| `node tests/space_special.js` | Smoke headless del especial: 4 personajes × 300 frames (`ok` = sin crash). |
| Abrir `index.html` | Ejecutar el juego en el navegador. |

> No hay tests automatizados, linter ni CI configurados.

---

## 🧭 Estado actual del desarrollo

El **README describe fielmente el juego jugable** (motor, 4 personajes, 10 armas, 7 enemigos, 8 élites, 10 jefes, tienda, inventario, niveles, audio y meta persistente). Todo esto está implementado y verificado con `node --check`.

### Estado actual (tras v14 — revisión completa en sesión de retoma · 14/08/2026)

> Estado verificado a fecha de esta sesión: `git status` limpio en el commit `4999dc9` ("version Juego Demo Danel 1.0"), `node --check js/game.js` pasa sin errores. No hay cambios sin commitear. El juego es 100% jugable tal como se describe aquí.

| Tema | Estado real |
|------|-------------|
| Controles táctiles móviles | **Sin implementar (decisión)**: el juego es web, no mobile. Botones ocultos y sin listeners. |
| Tienda de mejoras permanentes (`metaShards`) | **Implementada** (v7): pantalla `#permShop` en el menú; `PERM_UPGRADES` (daño, velocidad, vida, suerte) con coste creciente. |
| Consumibles | **Implementado** (v7): se compran y guardan en `consumableItems`; se usan con la tecla `F` en partida. |
| Nivel de armas | **Implementado** (v7): cada arma sube de nivel por derribos (6 por nivel) y se conserva al cambiar (`weaponLevels`). |
| Escudo del `shielder` | **Implementado** (v7): bloquea balas que llegan desde el frente (frente = hacia el jugador). |
| Suerte permanente (`permUpgrades.luck`) | **Aplicada** (v7/v8): +10 suerte por nivel; suma a `player.luck` y reduce el crítico enemigo. |
| Código muerto | **Limpiado** (v7): `selectedWeapon`, `dom.offers`, `WX/WY`, `sfx.shoot`, `sfx.menu`. |
| `js/utils.js` | **Eliminado** (v7): archivo vacío, sin uso. |
| Deslizamiento (SHIFT) | **Implementado** (v9): acelera hasta 2.15× mientras se mantiene; desacelera suave al soltar (`player.moveVx/moveVy`). |
| Hitbox de proyectiles de jefe | **Implementado** (v9): cada proyectil enemigo guarda/dibuja su propio radio real (`updateBullets`). |
| HUD compacto y alerta de vida crítica | **Implementado** (v10–v14): chips con iconos, barra roja a ≤25% HP, contorno rojo pulsante, indicador de habilidad circular 26px y lista dorada. |
---

## ✅ Funcionalidades implementadas

- Motor Canvas 2D con bucle `requestAnimationFrame`, `dt` limitado (`0.03`) y `resizeCanvas()` responsive (escala lógica 900×520).
- Estados de juego: `menu`, `playing`, `shop`, `gameover`; pausa (`P`), stats (`TAB`), mostrar/ocultar HUD (`👁️`).
- 4 personajes (`CHARACTERS`) con stats, pasiva y habilidad especial únicas (meteor, phase, bulwark, hivemind).
- 10 armas (`WEAPONS`) con rareza, daño, velocidad y cadencia determinista escalada por la oleada **y** por el nivel del arma (`weaponFireInterval`, v15-v17) y propiedades especiales (escopeta multi-disparo, láser/arco/riel con penetración, plasma doble).
- Estética de disparos con identidad geométrica por arma (`BULLET_DEFS`, v19) + tier visual cada 10 niveles (`weaponVisualTier`, v18): bala, flecha, rayo, orbe, perdigones y llama, con glow/color por tier, todo sin tocar colisiones.
- Disparo automático hacia enemigo más cercano (`findTarget`); knockback; crítico de armas; `overdrive` duplica disparos.
- Spawn de enemigos (7 tipos) y élites (8 tipos) con escalado progresivo por oleada (HP `1 + wave*0.18`, velocidad, cantidad por lote) y `spawnElite()` cada oleada par.
- Jefes (`BOSS_TYPES`, 10) cada 5 oleadas, cada uno con patrón de movimiento y ataque distinto (repeater, heavy, summon, spread, beam, volley, bomb, orbs, split, rage), barra de HP y `hitFlash`.
- Daño enemigo con críticos escalables (`enemyCritChance`), armadura con reducción plana, stuns de élite.
- Sistema de oleadas con timer (los jefes no dejan ganar por tiempo), transiciones, victoria épica y apertura de tienda.
- Tienda del Vacío (3 secciones: mejoras / armas / consumibles) con renders dinámicos (`generateOffers`/`renderOffers`) y arte pixelado procedural de armas (`drawWeaponPixelArt`).
- Inventario de 6 slots con equipar (click o teclas 1–6), soltar y quitar.
- XP / niveles por partida (`+10 maxHp`, `+20 hp` al subir).
- Meta persistente en `localStorage` (`metaShards`, `permUpgrades`), aplicada en `selectCharacter` y `startGame()`.
- Audio procedural synthwave por Web Audio API (música kick/snare/hihat/bajo/lead/drone + SFX por arma y por ataque de jefe; toggle de sonido).
- FX: screen shake, hitstop, flash, partículas, textos flotantes, estelas, drones, meteoritos, jumpscare de muerte, pausa.
- HUD DOM (HP, especial, oleada, score, shards) + HUD canvas (armas, habilidad, stats, barra de oleada).
- **Pasivas de personaje activas** (`computePlayerHit`): NOVA recibe +20%, ROOK −15%, ENJAMBRE 15% de esquiva.
- **Crítico real de armas** (×2, chance según suerte) y **resistencias** de enemigos tanque (TANQUE/GOLIATH −3 por bala).
- **FASE 2 de jefes** al 50% de HP (ataque y movimiento más rápidos, anillo rojo) y **tope de esbirros invocados** a 40.
- **Meta con Armadura** (+1 por nivel), **tope MÁX** (10) por mejora, y **sin élites durante jefes**.
- Tienda de **mejoras permanentes** con `metaShards` (`#permShop`, `PERM_UPGRADES`, `renderPermOffers`) accesible desde el menú.
- **Consumibles de uso en combate**: se compran en la tienda, se guardan en `consumableItems` y se usan con `F` (poción/overdrive/escudo).
- **Nivel por arma**: `weaponLevels`/`weaponKills`; cada arma sube de nivel con derribos (6 por nivel) y mantiene su daño al cambiar. Desde v16 el progreso por derribo pesa según la oleada (`min(3, 1 + 0.06*wave)`), por lo que es proporcional a la dificultad.
- **Escudo frontal del `shielder`**: bloquea balas del frente (`updateBullets`).
- **Suerte permanente** `permUpgrades.luck` (+10 por nivel) aplicada a `player.luck` y reductora del crítico enemigo.

---

## ⏳ Funcionalidades pendientes / a revisar (prioridad sugerida)

1. **(No implementado, por decisión)** Controles táctiles móviles (`.controls`): el juego es web, no mobile. Para retomarlo: darles listeners (`left`/`right`/`specialBtn`) y quitar `display:none`.
2. **Balance y testing** del nuevo sistema de armas por nivel, consumibles (F) y tienda de mejoras permanentes.
3. **Ideas a futuro**: más enemigos/jefes, guardado de mejores puntajes, dificultad selectable.
(El resto de los puntos originales —mejoras permanentes, consumibles, nivel de armas, escudo `shielder` y limpieza de código— se resolvieron en v7.)
<!-- fin de pendientes -->

---

## 🐛 Bugs / problemas conocidos

> ✅ **Corregidos en v7:** mojibake de caracteres, bug de Overdrive (velocidad inflada), patrón `teleport` de NÉMESIS, `player.stun` duplicado y código muerto.

- **Controles táctiles móviles** inactivos (`display:none` y sin listeners) — **intencional** (juego web, no mobile).
- **NOVA — pasiva "+20% daño" NO aplicada**: el personaje define `takeDmgMult: 1.2` (recibe +20%) pero **no existe** multiplicador de daño saliente en el código; `baseDmg` en `shoot()` no lo considera. Solo el "+20% de daño recibido" está activo. (Bug real pendiente de corregir.)
- **`ESC` no pausa**: solo hay listener para `KeyP`; el atajo con `ESC` nunca se implementó (la documentación anterior lo afirmaba por error).
- **Código muerto menor**: la paleta y el branch `rocket` en `drawWeaponPixelArt()` no se usan (no existe el arma “rocket” en `WEAPONS`).
- Queda testing de balance de los sistemas nuevos.
<!-- CRLF fixes -->
<!-- CRLF fixes -->
<!-- CRLF fixes -->
<!-- CRLF fixes -->

---

## 🧨 Zonas delicadas al modificar el código

- **`js/game.js` es un archivo monolítico en una IIFE** (`(() => { 'use strict' ... })();`). Toda la lógica, render y audio viven ahí. Al agregar código mantené la indentación dentro de la IIFE: un desbalance de llaves (como pasó con `gameOver()` en v6) saca funciones y rompe el juego con `ReferenceError`.
- **Estados globales compartidos**: `state`, `player`, `wave`, `currentWeapon`, `inventory`, `boss` y los arrays de entidades. Si se cambia un sistema, verificá dependencias cruzadas (p. ej. `spawnEnemy` no corre durante jefe; `update()` retorna antes de `frame++` fuera de `playing`).
- **Fin de oleada y tienda (crítico)**: el orden de evaluación entre `waveTimer`, `transition` y `showShop()` causó el bug v4 de "oleadas que se ganan solas". No reorganices ese bloque sin entender la secuencia.
- **Escalado del canvas**: `resizeCanvas()` + `ctx.setTransform(scaleX, ...)` dibuja en coordenadas lógicas 900×520; la lógica usa esas unidades.
- **Audio**: está en `js/audio/synth.js` (IIFE). Estado mutable en `NV.*` (`NV.soundOn`, `NV.audioCtx` creado al pulsar COMENZAR, `NV.musicState`, `NV.musicTime`); cada función chequea `!NV.audioCtx || !NV.soundOn`. Lee estado del juego vía getters definidos en `game.js` (`NV.getState`/`getBoss`/`getFrame`). `game.js` consume el audio por aliases locales (`NV.initAudio`, `NV.updateMusic`, `NV.playWeaponSound`, `NV.sfx`). Se carga `synth.js` ANTES de `game.js`. No llamar a audio antes de `initAudio()`.
- **Meta permanencia**: `loadMeta()`/`saveMeta()` manejan `localStorage`; `permUpgrades.*` ya se aplica en `selectCharacter` y `startGame()`.
- **README = fuente de verdad**: por regla del proyecto, todo cambio de código debe reflejarse aquí en el mismo cambio.

---

## 🧠 Notas de implementación y observaciones de auditoría (14/08/2026)

Comportamientos reales verificados al leer el código completo (`js/game.js`, ~2155 líneas en una IIFE; el audio ya no está inline — pasó a `js/audio/synth.js` (~186 líneas); `css/styles.css` ~380 líneas; `index.html` ~136 líneas). Útil para retomar desarrollo sin re-descubrir.

### Flujo y estado clave
- **`frame` solo avanza durante `playing`**: `frame++` está dentro de `update()`, que retorna antes si `state !== 'playing' || paused`. Por eso todas las animaciones basadas en `frame` (grid, trail, regen, flotación de personaje, FASE 2 del jefe, jumpscare) se "congelan" fuera del combate. Si agregás FX basados en `frame`, tenelo presente.
- **Regeneración de BOTI atada a `frame`**: `frame % 300 === 0` (~5 s a 60 fps). Si llegara a no jugarse a 60 fps estable, el timing real cambia.
- **Movimiento**: no es instantáneo; `player.moveVx/moveVy` integran hacia `targetVx/targetVy` con `maxDelta` (1800 al deslizar, 2600 normal). `SHIFT` multiplica la velocidad por `2.15`.
- **Disparo automático**: `shoot()` apunta al enemigo más cercano (`findTarget`, incluye al jefe); no hay puntería manual. NOVA NO tiene multiplicador de daño saliente (bug documentado abajo).

### Datos que NO se limpian (menor, no bloqueante)
- `nextWave()` y `startGame()` limpian `enemies/bullets/pickups/floatTexts/trails/weaponPickups`, pero **NO** `drones` ni `meteors`. Los drones duran 5 s y caen los meteoros, y `updateDrones/updateMeteors` solo corren en `playing`, así que pueden quedar congelados al pasar a `shop` y continuar después. Si se quiere un reset perfecto de partida, limpiar también `drones = []; meteors = [];` en `startGame()`/`nextWave()`.

### Balance / escalado (valores reales)
- HP de enemigos básicos: `1 + wave*0.18`; velocidad `+wave*2`; score/xp se escalan `*(1 + wave*0.1)` (dan decimales; `score` acumula floats).
- **Élites**: HP `+wave*4`, velocidad `+wave`, pero `score`/`xp` son **planos** (sin escalar por oleada). Probablemente intencional, pero es asimétrico frente a los básicos.
- Spawn por tick: `2 + min(6, floor(wave/2))`; frecuencia `max(0.45, 1.3 - wave*0.018)`; élites en oleadas pares (`wave%2===0`), nunca durante jefes.
- `waveTimer = max(15, 25 - wave*0.4)`; jefe cada `wave%5===0` (HP `base + wave*25`).
- Cadencia efectiva del arma: `max(MIN_FIRE_INTERVAL, (fireRate/60) × max(0.55, 1−0.01×wave) × max(0.6, 1−0.004×(nivel−1)))` (v15–v17).
- Daño de arma total: `weapon.damage + permUpgrades.damage*2 + currentWeaponLevel()`. `currentWeaponLevel()` devuelve `weaponLevels[id] || 1` (mínimo 1).
- Nivel de arma: sube con `weaponKills` (umbral `6 * nivelActual`); cada derribo suma `min(3, 1 + 0.06*wave)` puntos (v16); se conserva por arma durante la partida.
- Daño recibido: `computePlayerHit` → crit (`0.08 + wave*0.018`, tope 0.35, reducida por `luck`) → `max(1, dmg - armor)` → `* takeDmgMult` (inc. esquiva `dodge`).

### Bugs reales confirmados (sin corregir, registrados aquí)
1. **NOVA — "+20% daño" NO aplicado**: solo existe `takeDmgMult: 1.2` (recibe +20%); no hay multiplicador de daño saliente en `shoot()`/`baseDmg`. Faltaría, p. ej., `const dmgSource = player.character === 'nova' ? 1.2 : 1;` en `shoot()`.
2. **`ESC` no pausa**: solo hay listener para `KeyP`.
3. **Código muerto**: la paleta `rocket` y el branch `name.includes("rocket")` en `drawWeaponPixelArt()` no se usan (no existe el arma "rocket" en `WEAPONS`).
4. **Controles táctiles móviles** (`.controls`): `display:none` y sin listeners — **intencional** (juego web, no mobile).

### Integraciones frágiles (no mover sin entender)
- El bloque fin de oleada ↔ `transition` ↔ `showShop()` debe evaluarse **antes** del countdown (bug v4).
- `computePlayerHit` es el único punto donde se resuelven esquiva/crit/armadura/pasiva: NOVA (+20% recibe), ROOK (−15%), ENJAMBRE (15% dodge), BOTI sin mod.
- `shielder` bloquea balas solo desde el frente (ángulo respecto al jugador); `bulwark` (ROOK) refleja balas enemigas.
- El arma por defecto es siempre `WEAPONS[0]` (pistola); cualquier soltado/quitado vuelve a pistola.

---

## 📦 Estructura actualizada de archivos

```
JuegoDemo/
├── index.html          # Página principal: DOM, HUD, overlays (menú, tienda, game over), nav táctil (oculto)
├── README.md           # Este documento (fuente de verdad)
├── tests/
│   └── space_special.js # Arnés headless: especial de cada personaje × 300 frames sin crash
├── css/
│   └── styles.css      # Estilo visual: neon, HUD, menú, tarjetas, tienda, inventario, ofertas
└── js/
    ├── core/
    │   ├── state.js    # Namespace global window.NV (se carga primero)
    │   └── utils.js    # Utilidades puras: NV.formatPoints
    ├── data/
    │   ├── gameData.js   # Datos puros: personajes, armas, élites, jefes, mejoras
    │   ├── balance.js    # Datos de balance/tuning (NV.BALANCE)
    │   └── consumables.js # Datos de consumibles (NV.CONSUMABLES)
    ├── audio/
    │   └── synth.js    # Audio synthwave + SFX (estado en NV.*; fue inline en game.js)
    ├── render/
    │   ├── canvas.js      # canvas + ctx base (NV.canvas/NV.ctx)
    │   ├── projectiles.js # NV.drawBulletShape + NV.drawSpecialVFX
    │   ├── enemies.js     # NV.drawEnemy
    │   ├── bosses.js      # NV.drawBoss
    │   ├── player.js      # NV.drawPlayer
    │   └── hud.js         # NV.drawSpecialCooldown/drawWeaponHUD/drawStats
    ├── ui/
    │   └── dom.js      # Árbol DOM (NV.dom)
    ├── engine/
    │   ├── fx.js        # NV.spawnExplosion/updateParticles/addFloatText/updateFloatTexts/updateTrails
    │   ├── drones.js     # NV.updateDrones (disparo de drones ENJAMBRE)
    │   ├── meteors.js     # NV.updateMeteors (Lluvia Estelar)
    │   ├── pickups.js     # NV.spawnWeaponPickup/updatePickups/updateWeaponPickups (drop de armas + shards)
    │   ├── enemies.js     # NV.spawnEnemy/spawnElite/killEnemy/updateEnemies
    │   ├── combat.js      # NV.enemyCritChance/calcEnemyDamage/computePlayerHit
    │   ├── boss.js        # NV.updateBoss/spawnBossProj/spawnMinion/runBossAttack
    │   ├── bullets.js     # NV.updateBullets (colisiones, bulwark, escudos)
    │   ├── weapons.js     # NV.shoot/findTarget/applyKnockback (disparo del jugador)
    │   └── special.js     # NV.useSpecial (habilidades: meteor/phase/bulwark/hivemind)
    └── game.js         # Motor restante (lógica, render, estado de entidades) — IIFE
```

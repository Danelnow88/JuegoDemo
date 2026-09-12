# Testing

Las pruebas automáticas son headless y se ejecutan con Node.js. Validan lógica, integración estática y contratos de módulos; no sustituyen pruebas visuales en navegadores y dispositivos reales.

## Syntax checks

```bash
node --check js/core/viewport.js
node --check js/game.js
```

Resultado esperado actual: ambos procesos terminan con código `0` y sin salida.

## Targeted mobile tests

```bash
node tests/mobile_compat.js
node tests/world_metrics_noop.js
node tests/dynamic_viewport.js
node tests/dynamic_arena.js
node tests/lobby_foundation.js
node tests/ui_foundation.js
node tests/settings_foundation.js
node tests/enemy_family_lod.js
node tests/weapon_sfx_engine.js
node tests/player_damage_pipeline.js
node tests/hostile_budget.js
```

Conteos verificados el 7 de septiembre de 2026:

| Suite | Pass | Fail |
| --- | ---: | ---: |
| `mobile_compat` | 38 | 0 |
| `world_metrics_noop` | 10 | 0 |
| `dynamic_viewport` | 16 | 0 |
| `dynamic_arena` | 12 | 0 |
| `lobby_foundation` | 5 | 0 |
| `ui_foundation` | 5 | 0 |
| `settings_foundation` | 5 | 0 |
| `enemy_family_lod` | 5 | 0 |
| `weapon_sfx_engine` | 11 | 0 |
| `rifle_manual_aim` | 14 | 0 |
| `enemy_intent_foundation` | 21 | 0 |
| `runner_flank` | 17 | 0 |
| `player_damage_pipeline` | 9 | 0 |
| `hostile_budget` | 14 | 0 |
| `loadout_slots` | 12 | 0 |
| `consum_hud` | 8 | 0 |
| `hud_layout` | 14 | 0 |
| `performance_foundation` | 15 | 0 |
| `stress_harness` | 8 | 0 |
| `speaker_mines` | 30 | 0 |
| `rhythm_analysis_render` | 17 | 0 |
| `meta_widget_integration` | 13 | 0 |

## Weapon audio tests

```bash
node tests/audio_mixer.js
node tests/audio_spatial_mix.js
node tests/audio_menu_fatigue.js
node tests/weapon_sfx_engine.js
```

`weapon_sfx_engine` instrumenta un contexto Web Audio falso y valida presets, crack directo y comprimido, muzzle, sub/thump, tail, boom puff, crackle, split y saturación de tres bandas, dos ecos, Haas, escopeta inmediata, adaptación decorativa del SMG, barrido de plasma, lanzallamas continuo, mute y propiedad de gameplay sobre cadencia/proyectiles.

Las pruebas headless verifican arquitectura y secuencias de eventos, no calidad perceptual. Antes de aprobar definitivamente los presets deben escucharse en gameplay real: disparo único, tres disparos, un segundo a cadencia real y varios segundos sostenidos para rifle, subfusil y lanzallamas.

## Rifle manual aim (F04)

```bash
node tests/rifle_manual_aim.js
```

Verifica la identidad del Rifle como primera arma habilidosa sobre los módulos reales (`weapons`, `bullets`, `inputIntent`, `boss`, datos): disparo manual exacto a lo largo de `aimVector` sin autocorregir al enemigo, precisión sin spread/recoil (serie de disparos idéntica), cadencia que respeta el intervalo `25/60` con un press = un disparo, legacy-auto con la MISMA pipeline apuntando al más cercano, contrato de pierce explícito (`pierce` = TOTAL de objetivos; rifle 2 = primario + 1), penetración finita exacta (daña 2, tercero intacto, bala muere), conservación de nivel/fusión, pausa/reset sin doble disparo, cambio de política sin duplicado, móvil→legacy-auto por la misma pipeline, independencia del dash (no altera daño/pierce/cadencia/velocidad) y `waveWeaponMult` desconectado en producción (documentado, sin habilitar el scaler global).

## Responsive browser check

Con `node tools/serve.js` ejecutándose:

```bash
node tools/verify_viewports.js
```

La herramienta calibra el viewport interno de Edge headless y cubre, entre otros casos, móvil landscape `915x412`, móvil landscape `844x390` y desktop reference `900x520`. Verifica clases de capacidad/orientación, Dynamic View en landscape móvil, canvas/lobby inicializados y ausencia de excepciones JavaScript. Las fórmulas runtime se validan por separado en `dynamic_viewport` y `dynamic_arena`. Sigue siendo validación automatizada de navegador, no prueba en dispositivo físico.

## Performance diagnostics

```bash
node tools/diagnostics/enemy_anim_profiler.js
node tools/diagnostics/hydra_lod_benchmark.js
```

Estos comandos reportan CPU headless, operaciones y unidades raster ponderadas. No son mediciones de FPS real. `hydra_lod_benchmark.js` compara 1, 6, 7, 10 y 12 instancias de la familia visual Hidra en `high`, `auto` y `performance`.

### Stress harness (P2/P3/P3.1/P3.1.1)

```bash
node tools/performance/stress_harness.js [--frames N]
```

Ejecuta A–J (baseline P2), K–O (mines base), P–R (seis mines `MUSIC_GROOVE`; seis detonaciones secuenciales con notas; 23+7+flamethrower+seis mines musicales) y S (seis mines `IDLE_GROOVE`) sobre módulos reales de engine/render en sandbox headless. Verifica `hostiles<=30`, `heavy<=7`, `speakerMines<=6`, `musicalNotes<=24` y `particles<=200`. P3.1.1 además prueba que el widget y Canvas comparten `computeRhythmGroove`, sin DOM/analyser/loop por mina y con stretch acotado. **Es baseline CPU comparativo, no frame real de browser ni garantía de FPS.**

## Full suite

```bash
npm test
```

`npm test` ejecuta `tests/run_all.js`, que descubre todos los archivos `tests/*.js` excepto su propio runner.

### Input foundation

```bash
node tests/input_foundation.js
```

Verifica aim mundial normalizado, independencia movimiento/aim, hold-LMB con cadencia, ausencia de autocorrección manual, compatibilidad nearest-target, cambio de política sin doble pipeline, pausa/reanudación, fallback móvil y transforms de viewport.

### Controlled movement

```bash
node tests/controlled_movement.js
```

Simula a 120 Hz aceleración, parada, inversión, diagonal, Overdrive y el sistema de dash (F03) sobre el módulo real (`engine/movement.js`). Verifica identidad por personaje, cap permanente, compatibilidad de saves, ausencia de mutación de stats base, pausa/reanudación, ruta móvil compartida y update O(1) sin allocations explícitas. En dash cubre: coste exacto (`100→0` en dos dashes), rechazo por debajo del coste, delay `0.8–1.0s`, recuperación completa (`~3–4s`), press-edge (mantener Shift no re-dispara), re-press, dirección `move→aim→último`, sin invuln/daño, pausa/latch sin dash espurio y reset.

Baseline verificado el 9 de agosto de 2026:

```text
RESULT run_all: total=80 failed=2
```

### Rifle manual-aim identity (F04)

```bash
node tests/rifle_manual_aim.js
```

Verifica identidad del Rifle (damage 20, cadencia 25, rango 480, pierce 2), disparo manual exacto a lo largo de `aimVector` sin autocorrección, precisión sin spread/recoil, cadencia respetada, legacy-auto por la misma pipeline, contrato pierce explícito (2 = primario + 1), penetración finita exacta, conservación de nivel/fusión, pausa/reanudación sin doble disparo, cambio de política sin duplicado, móvil por pipeline compartida, dash sin alterar stats, `waveWeaponMult` desconectado y proyectil legible.

### Enemy intent/state foundation (F05)

```bash
node tests/enemy_intent_foundation.js
```

Valida el vocabulario mínimo de estado/intent (`idle`/`positioning`/`windup`/`attack`/`recovery`/`retreat`), helpers baratos (preferredRange, flankOffset, retreatVector, attackMovementFactor, separationCandidate), ciclo de vida (create/update/reset), timers, no compartición de estado entre enemigos, persistencia entre ticks, compatibilidad legacy (`updateEnemies` funciona con o sin intents), presupuesto intacto (30/7) y pausa sin drenar timers.

### Runner as Flanker (F06)

```bash
node tests/runner_flank.js
```

Convirtió el Runner (`id: 'runner'`) de persecución directa a flanqueador. Verifica selección/persistencia de lado (`flankSide`), state machine (`APPROACH`/`COMMIT`/`RECOVERY`), objetivo desplazado del centro durante COMMIT (sin corrección magnética), recuperación que crea separación, sin cambio rápido de lado, death-on-contact preservado, speed caps (145 base, ~177 en minas, cap 260), presupuesto intacto (30/7) y stress con múltiples Runners.

Baseline verificado el 10 de septiembre de 2026:

```text
RESULT run_all: total=82 failed=2
```

## Fallos baseline conocidos

### `kamikaze`

```text
RESULT kamikaze: pass=10 fail=1
```

Falla la prueba de separación de varios enemigos chase apilados: la distancia medida no disminuye el amontonamiento esperado.

### `lab_model_hitbox`

```text
RESULT lab_model_hitbox: pass=6 fail=1
```

Falla la expectativa de hitbox de `specter_lite`: el test obtiene radio `11.25` frente al valor esperado por el modelo.

## Política de regresiones

**Fallo conocido no significa fallo ignorado.** Los dos casos anteriores forman el baseline pendiente. Cualquier suite adicional fallida, aumento en el número de fallos o cambio inesperado en una prueba dirigida es una regresión hasta investigarlo.

Antes de desplegar:

1. comparar los resultados con este baseline;
2. detener el deploy si aparece una regresión nueva;
3. documentar el resultado exacto;
4. realizar validación visual/manual cuando el cambio afecte layout, input, audio o render.
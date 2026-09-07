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
```

Conteos verificados el 7 de septiembre de 2026:

| Suite | Pass | Fail |
| --- | ---: | ---: |
| `mobile_compat` | 38 | 0 |
| `world_metrics_noop` | 10 | 0 |
| `dynamic_viewport` | 16 | 0 |
| `dynamic_arena` | 12 | 0 |

## Full suite

```bash
npm test
```

`npm test` ejecuta `tests/run_all.js`, que descubre todos los archivos `tests/*.js` excepto su propio runner.

Baseline verificado el 7 de septiembre de 2026:

```text
RESULT run_all: total=66 failed=2
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
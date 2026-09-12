# NEON VOID

Roguelite arcade de supervivencia con estética synthwave/neón. El juego comparte una única implementación de gameplay entre desktop y móvil; la presentación, el viewport y la entrada se adaptan por capacidad y orientación.

## Tecnología

- HTML5, CSS y JavaScript sin framework ni proceso de build.
- Canvas2D para gameplay y render principal.
- Web Audio API para música procedural y efectos.
- Three.js 0.160.0 disponible por CDN para el overlay espectral legacy/opcional; está desactivado por defecto.
- Pruebas headless con Node.js.

## Ejecutar localmente

Requisito: Node.js.

```bash
node tools/serve.js
```

Abrir `http://localhost:8080/`. También puede abrirse `index.html` directamente, pero el servidor local reproduce mejor el entorno de GitHub Pages y permite probar desde otros dispositivos de la red.

## URLs importantes

- Producción: <https://danelnow88.github.io/JuegoDemo/>
- Repositorio: <https://github.com/Danelnow88/JuegoDemo.git>
- Fallback móvil legacy para depuración: `?dynamicView=0`
- Alias de compatibilidad: `?dynamicView=1` (ya no es necesario)

## Arquitectura resumida

- Los módulos IIFE publican APIs compartidas en `window.NV`.
- `js/core/viewport.js` es la única fuente de métricas de referencia, vista y arena.
- `js/game.js` coordina estado, loop, gameplay compartido y transiciones UI.
- `js/engine/` contiene sistemas de gameplay; `js/render/` contiene renderers; `js/data/` contiene definiciones de contenido y balance.
- `NV.applyPlayerDamage` es la autoridad de daño al jugador; `NV.getHostileBudget` deriva el presupuesto vivo con topes de 30 hostiles y 7 heavy, boss incluido.
- Teclado y controles táctiles escriben en la misma abstracción lógica `NV.input`.
- El lobby, Game Over y Settings usan DOM compartido con presentación responsive.
- `js/core/settings.js` centraliza calidad visual y persistencia sin alterar gameplay.

Detalles: [Arquitectura](docs/ARCHITECTURE.md).

## Comportamiento móvil

- **Desktop:** referencia/vista/arena `900x520`; presentación legacy contain.
- **Móvil landscape:** Dynamic World View y Dynamic Arena se activan automáticamente. La altura lógica permanece en `520` y el ancho lógico/arena se expande para llenar el viewport sin stretch, crop ni gutters laterales.
- **Móvil portrait:** se conserva el overlay de orientación y el comportamiento legacy de métricas.
- `?dynamicView=0` fuerza temporalmente contain `900x520` en móvil landscape para diagnóstico.
- El HUD móvil usa datos DOM arriba, menú único arriba-derecha y selectores de arma/item abajo-centro; el panel Canvas redundante se conserva solo en desktop.

## Ajustes gráficos

El panel compartido **Ajustes** ofrece calidad `Auto`, `Alta` y `Rendimiento`, además de toggles para partículas y VFX intensos de élites. El valor por defecto es **Alta**, equivalente a la calidad visual previa. Los modos alternativos solo reducen coste visual secundario; no cambian enemigos, daño, vida, spawns ni dificultad.

La familia visual élite `RB6 / Entidad Hidra` dispone de un presupuesto LOD estable por proximidad al jugador en `Auto` y `Rendimiento`. Todas las entidades siguen visibles y funcionales.

Contrato completo: [Arquitectura móvil](docs/MOBILE_ARCHITECTURE.md) y [Estados UI](docs/UI_STATES.md).

## Pruebas

```bash
node --check js/core/viewport.js
node --check js/game.js
node tests/mobile_compat.js
node tests/world_metrics_noop.js
node tests/dynamic_viewport.js
node tests/dynamic_arena.js
npm test
```

Baseline actual: 77 suites; 2 fallos conocidos (`kamikaze` y `lab_model_hitbox`). P3.1 añade Campo Minado táctico, `IDLE_GROOVE`/`MUSIC_GROOVE` y notas musicales decorativas; P3.1.1 hace que el widget de ritmo y Speaker Mines compartan groove math puro sin DOM por hazard. Cualquier fallo adicional es una regresión hasta investigarlo. Conteos y política: [Testing](docs/TESTING.md).

## Despliegue

GitHub Pages publica la rama `master`. El flujo normal es validar, hacer staging selectivo, crear un commit nuevo y ejecutar `git push origin master`; nunca se usa force push para un deploy normal.

Procedimiento completo: [Deployment](docs/DEPLOYMENT.md).

## Documentación

- [Arquitectura](docs/ARCHITECTURE.md)
- [Arquitectura móvil](docs/MOBILE_ARCHITECTURE.md)
- [Estados UI](docs/UI_STATES.md)
- [Workflow para agentes de IA](docs/AI_WORKFLOW.md)
- [Testing](docs/TESTING.md)
- [Deployment](docs/DEPLOYMENT.md)

## Referencias de herramientas visuales

Los iconos de consumibles se renderizan mediante `js/render/consumableIcons.js` y la API `NV.drawConsumableIcon`. La comprobación visual integrada está en `previews/consumable-icons-integration-preview.html`.

## Limitaciones conocidas

- Una arena móvil más ancha puede reducir la dificultad efectiva y la densidad aparente de spawns.
- Los patrones de jefes usan mayormente amplitudes absolutas en unidades de mundo.
- La distribución de pickups y meteoritos puede sentirse distinta en arenas anchas.
- Permanecen los dos fallos baseline de pruebas indicados arriba; no se consideran resueltos ni deben ocultar regresiones nuevas.
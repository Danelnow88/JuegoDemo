# Workflow para agentes de IA

## Antes de editar

1. Leer `README.md`.
2. Leer el documento de arquitectura relevante.
3. Inspeccionar el código real; la documentación no reemplaza la verificación.
4. Ejecutar `git status --short --branch` y preservar trabajo ajeno.

## Reglas obligatorias

- No duplicar gameplay para móvil.
- No crear un segundo viewport manager.
- No crear una segunda fuente de `worldMetrics`; `NV.worldMetrics` vive en `js/core/viewport.js`.
- Bounds, clamps, spawns y culling usan métricas `arena*`.
- Render, cámara y región visible usan métricas `view*`.
- Constantes de diseño/reference usan métricas `ref*`.
- UI móvil usa coordenadas del viewport físico y safe areas.
- No hardcodear layouts para Samsung, iPhone u otros modelos concretos.
- No anexar parches CSS conflictivos sin auditar reglas y especificidad existentes.
- No modificar balance salvo que la tarea lo solicite explícitamente.
- No considerar checks headless o estáticos como validación en dispositivo real.
- No crear ramas mobile-only para world features que deberían heredar métricas.
- World/data features nuevas deben reutilizar las mismas entidades y fuentes de datos en desktop/móvil.
- Toda UI nueva debe definir y verificar presentación responsive desktop, móvil landscape y ownership por estado.
- No duplicar lobby, HUD, Settings, tienda ni Game Over por plataforma.
- Los modos gráficos solo pueden cambiar coste visual; nunca conteos, HP, daño, spawns o dificultad.
- No hacer commit ni push salvo solicitud explícita.
- No usar amend, rebase, reset destructivo ni force push para trabajo normal.
- No stagear diagnósticos, logs o temporales.

## Después de editar

1. Ejecutar checks de sintaxis.
2. Ejecutar las pruebas dirigidas relevantes.
3. Ejecutar `npm test`.
4. Revisar `git diff` y `git status`.
5. Reportar archivos cambiados exactos.
6. Reportar regresiones nuevas y distinguirlas de fallos baseline.
7. Reportar explícitamente si cambiaron gameplay, balance o world metrics.
8. Para UI, verificar al menos desktop reference, `915x412` y `844x390`; declarar si la comprobación fue headless o en dispositivo real.

Para comandos y baseline actual, consultar [TESTING.md](TESTING.md). Para despliegue, consultar [DEPLOYMENT.md](DEPLOYMENT.md).
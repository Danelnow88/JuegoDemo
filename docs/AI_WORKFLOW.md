# AI workflow para cambios de viewport/móvil

## Reglas de métricas del mundo

- Bounds y reglas de gameplay usan métricas de arena: `NV.worldMetrics.arenaW` / `arenaH`.
- Render, cámara, overlays y efectos centrados en lo visible usan métricas de vista: `NV.worldMetrics.viewW` / `viewH` / `viewX` / `viewY`.
- Constantes de diseño/base legacy usan métricas de referencia: `NV.worldMetrics.refW` / `refH`.
- La UI móvil/DOM no debe mutar ni reinterpretar coordenadas de gameplay.

## Restricciones arquitectónicas

- No crear otro viewport manager.
- No crear otro world metrics manager.
- `NV.worldMetrics` es la estructura central para separar referencia, vista runtime y arena.
- Dynamic world view es el comportamiento por defecto en móvil landscape.
- No restaurar contain fijo `900x520` en móvil landscape salvo pedido explícito; `?dynamicView=0` existe solo como fallback/debug legacy.
- Desktop permanece legacy `900x520` y no debe activar arena dinámica.
- Las features móviles futuras deben respetar `NV.worldMetrics` (`view*` para render/cámara y `arena*` para gameplay bounds).
- No añadir parches CSS móviles conflictivos al final del archivo sin auditar las reglas existentes.

## Validación obligatoria

- Ejecutar pruebas móviles después de cambios arquitectónicos: `node tests/mobile_compat.js`.
- Ejecutar la suite completa: `npm test`.
- Ejecutar cualquier prueba nueva relacionada con métricas/viewport.
- Verificar visualmente desktop y mobile contain cuando el cambio afecte presentación.

## Git safety

- No hacer commit ni push salvo pedido explícito.
- No hacer reset, restore de archivos completos, rebase, amend ni force push.
- Preservar trabajo sin commitear del usuario.
- No agregar archivos temporales/diagnóstico al control de versiones.
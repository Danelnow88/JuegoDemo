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
- No activar arena dinámica fuera de la aprobación explícita Stage 3: solo `?dynamicView=1` + móvil + landscape.
- No activar viewport dinámico por defecto. Dynamic view/arena siguen detrás de `?dynamicView=1` + móvil + landscape.
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
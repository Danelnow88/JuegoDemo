# Arquitectura de datos de contenido

Este documento registra el estado actual y el rumbo de mantenibilidad para agregar contenido nuevo con fricción mínima, sin alterar comportamiento existente.

## Objetivo

Reducir la cantidad de archivos que hay que tocar para agregar o rebalancear:

- consumibles
- armas
- mejoras permanentes
- personajes

Regla base: cada paso de reorganización debe ser chico, testeable, reversible y no debe cambiar balance ni comportamiento salvo aprobación explícita.

## Estado actual

### Armas

Fuente principal actual:

- `js/data/gameData.js` → `NV.WEAPONS`

Datos relacionados:

- `js/data/gameData.js` → `NV.BULLET_DEFS`, `NV.RARITY_COLORS`
- `js/render/weaponIcons.js` → colores y dibujo de iconos por `weapon.id`
- `js/audio/synth.js` → `playWeaponSound(weapon)` con `switch (weapon.id)`
- `js/engine/weapons.js` → lógica genérica de disparo que consume campos del arma

Fricción actual para agregar un arma:

1. Agregar entrada a `NV.WEAPONS`.
2. Agregar definición visual de proyectil en `NV.BULLET_DEFS` si no se quiere fallback visual.
3. Agregar icono/color en `weaponIcons.js` si no se quiere fallback de pistola.
4. Agregar sonido en `synth.js` si no se quiere fallback.
5. Actualizar tests que enumeran IDs conocidos.

Puntos de cuidado:

- `WEAPONS[0]` funciona como arma inicial implícita; hoy debe seguir siendo `pistol`.
- Los IDs de arma están repetidos en datos, render, audio y tests.

### Consumibles

Fuente declarada actual:

- `js/data/consumables.js` → `NV.CONSUMABLES`

Pero antes de esta reorganización, la tienda y los efectos reales estaban repartidos en:

- `js/game.js` → lista hardcodeada de ofertas de consumibles
- `js/game.js` → `useConsumable()` con ramas por `item.type`
- `js/render/consumableIcons.js` → colores/iconos por ID
- `js/audio/synth.js` → tono de consumo por tipo

Consumibles reales actuales:

- `potion`
- `overdrive`
- `shield`
- `bomb`
- `freeze`
- `magnet`
- `bounty`

Fricción actual para agregar un consumible:

1. Definir datos/display/precio.
2. Agregarlo a la tienda.
3. Agregar efecto en `useConsumable()`.
4. Agregar icono si corresponde.
5. Agregar sonido si corresponde.
6. Agregar tests.

Rumbo inmediato aprobado:

- `NV.CONSUMABLES` debe contener los 7 consumibles actuales con sus datos de tienda.
- La tienda debe leer desde `NV.consumableList()`.
- Los efectos todavía quedan en `game.js` hasta aprobar una extracción futura.

### Mejoras permanentes

Fuente principal actual:

- `js/data/gameData.js` → `NV.PERM_UPGRADES`
- `js/data/balance.js` → constantes de escala/tope

Fricción actual:

- Las claves default de `permUpgrades` estaban duplicadas en `game.js`.
- Agregar una mejora permanente requería recordar actualizar defaults, carga de guardado y aplicación del efecto.

Rumbo inmediato aprobado:

- `NV.defaultPermUpgrades()` genera defaults desde `NV.PERM_UPGRADES`.
- `NV.normalizePermUpgrades(saved)` completa guardados antiguos con nuevas claves.

### Personajes

Fuente principal actual:

- `js/data/gameData.js` → `NV.CHARACTERS`

Datos/lógica relacionados:

- `index.html` → cards del menú hardcodeadas
- `js/engine/special.js` → ramas por `char.special`
- `js/render/metaSkillIcons.js` → iconos de habilidades
- `js/game.js` → aplicación de stats/pasivas

Fricción actual para agregar personaje:

1. Agregarlo a `NV.CHARACTERS`.
2. Agregar card HTML.
3. Agregar/ajustar CSS de preview si corresponde.
4. Agregar habilidad en `special.js` si es nueva.
5. Agregar pasiva en lógica si es nueva.
6. Agregar icono si corresponde.

Punto de deuda conocido:

- La regeneración de BOTI se detecta por texto (`passive.includes('Regenera')`). Conviene reemplazarlo más adelante por un ID/metadato de pasiva, con aprobación específica porque puede afectar comportamiento.

## Reglas para futuros cambios de contenido

- No cambiar valores de balance junto con refactors estructurales salvo aprobación explícita.
- Mantener commits chicos por dominio.
- Correr suite completa antes de cada commit.
- Preservar orden visible de listas cuando se centralicen datos.
- Mantener fallbacks para iconos/audio nuevos mientras no haya assets custom.
- Preferir helpers puros y testeables sobre strings duplicados.

## Próximos pasos seguros

1. Centralizar defaults de permanentes.
2. Completar `NV.CONSUMABLES` y usarlo como fuente de tienda.
3. Más adelante, con aprobación: extraer handlers de consumibles a `js/engine/consumables.js`.

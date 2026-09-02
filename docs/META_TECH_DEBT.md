# META_TECH_DEBT

Baseline de referencia: `JUEGO--DANEL-V1.0` (`30d2019`).

Estos puntos se documentan para análisis posterior. **No deben corregirse como parte de META-VIS**, porque pueden cambiar el balance real actualmente jugado:

1. `waveWeaponMult` existe en `weapons.js`, pero el wrapper real de `game.js` no pasa `wave` a `NV.shoot`.
2. Las explosiones de minas y kamikazes llaman `computePlayerHit`, pero debe verificarse por separado si aplican el daño resultante al HP.
3. Una esquiva de contacto no asigna invulnerabilidad ni `contactCd`; el enemigo puede reintentar inmediatamente.
4. El contacto usa radio fijo de jugador `20`, mientras las balas usan `CHARACTERS[player.character].size * 0.45`.
5. Kills indirectos pueden acreditar progreso al arma equipada en el momento del derribo.
6. La probabilidad de shard (`0.15 + luck*0.01 + greed*0.03`) no tiene clamp explícito.
7. Comprar un arma con inventario lleno la equipa sin almacenarla en el inventario.

Toda decisión sobre estos puntos requiere prueba aislada y aprobación explícita.
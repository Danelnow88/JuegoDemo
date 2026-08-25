// ===== ENGINE: pickups (monedas/shards + armas recolectables) =====
// updatePickups/updateWeaponPickups: filtran arrays por ref y devuelven el array + estado acumulativo
// (shards / currentWeapon) que en game.js son `let` y deben reasignarse. Los callbacks preservan
// las closures del monolito (addFloatText, pickup sfx, showBanner).
(() => {
  'use strict';
  const NV = window.NV;

  // ---- spawn ----
  NV.spawnWeaponPickup = function (WEAPONS, weaponPickups, W, H, showBanner, RARITY_COLORS) {
    const weapon = WEAPONS[Math.floor(Math.random() * WEAPONS.length)];
    weaponPickups.push({
      x: 40 + Math.random() * (W - 80),
      y: 80 + Math.random() * (H - 160),
      weapon: weapon,
      dead: false,
    });
    showBanner('¡' + weapon.name + '! 💎', RARITY_COLORS[weapon.rarity]);
  };

  // ---- update genérico de shards/coins ----
  // devuelve { pickups, shards }
  NV.updatePickups = function (dt, pickups, player, addFloatText, pickupSfx) {
    let shards = 0;
    for (const p of pickups) {
      if (p.dead) continue;
      const d = Math.hypot(p.x - player.x, p.y - player.y);
      if (d < 30) {
        p.dead = true;
        const v = p.value || 1;
        shards += v;
        addFloatText(p.x, p.y - 10, '+' + v, '#7cf8ff');
        pickupSfx();
      }
    }
    return { pickups: pickups.filter((p) => !p.dead), shards };
  };

  // ---- update de pickups de arma ----
  // devuelve { weaponPickups, currentWeapon } (currentWeapon reasignado por el wrapper si cambió)
  // tryFusion(weapon) => { fused, level } | { maxed } | { owned:false }; retrocompatible si no se pasa.
  NV.updateWeaponPickups = function (dt, weaponPickups, player, inventory, INVENTORY_SLOTS, currentWeapon, addFloatText, RARITY_COLORS, pickupSfx, tryFusion) {
    for (const wp of weaponPickups) {
      if (wp.dead) continue;
      const d = Math.hypot(wp.x - player.x, wp.y - player.y);
      if (d < 30) {
        if (tryFusion) {
          const r = tryFusion(wp.weapon);
          if (r && r.fused) {
            wp.dead = true;
            addFloatText(wp.x, wp.y - 10, 'FUSIÓN Nv' + r.level, '#ffd700');
            pickupSfx();
            continue;
          }
          if (r && r.maxed) {
            // Ya la tenés y está en el tope de fusión: no la consumes ni ocupás slot.
            if (!wp.fullMsg || wp.fullMsg <= 0) {
              addFloatText(wp.x, wp.y - 10, 'FUSIÓN MÁX', '#ff5f9b');
              wp.fullMsg = 1.2;
            }
            continue;
          }
          // no poseída -> cae al flujo normal (guardar/llenar)
        }
        if (inventory.length < INVENTORY_SLOTS) {
          wp.dead = true;
          inventory.push(wp.weapon);
          addFloatText(wp.x, wp.y - 10, 'GUARDADO', '#ffcf76');
          pickupSfx();
        } else {
          // Inventario lleno: NO se recoge NI se auto-equipa.
          if (!wp.fullMsg || wp.fullMsg <= 0) {
            addFloatText(wp.x, wp.y - 10, 'INVENTARIO LLENO', '#ff5f9b');
            wp.fullMsg = 1.2;
          }
        }
      } else if (wp.fullMsg > 0) {
        wp.fullMsg -= dt;
      }
    }
    return { weaponPickups: weaponPickups.filter((wp) => !wp.dead), currentWeapon };
  };
})();

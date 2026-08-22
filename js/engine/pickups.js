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
        shards += 1;
        addFloatText(p.x, p.y - 10, '+1', '#7cf8ff');
        pickupSfx();
      }
    }
    return { pickups: pickups.filter((p) => !p.dead), shards };
  };

  // ---- update de pickups de arma ----
  // devuelve { weaponPickups, currentWeapon } (currentWeapon reasignado por el wrapper si cambió)
  NV.updateWeaponPickups = function (dt, weaponPickups, player, inventory, INVENTORY_SLOTS, currentWeapon, addFloatText, RARITY_COLORS, pickupSfx) {
    for (const wp of weaponPickups) {
      if (wp.dead) continue;
      const d = Math.hypot(wp.x - player.x, wp.y - player.y);
      if (d < 30) {
        wp.dead = true;
        if (inventory.length < INVENTORY_SLOTS) {
          inventory.push(wp.weapon);
          addFloatText(wp.x, wp.y - 10, 'GUARDADO', '#ffcf76');
        } else {
          currentWeapon = wp.weapon;
          addFloatText(wp.x, wp.y - 10, currentWeapon.name, RARITY_COLORS[currentWeapon.rarity]);
        }
        pickupSfx();
      }
    }
    return { weaponPickups: weaponPickups.filter((wp) => !wp.dead), currentWeapon };
  };
})();

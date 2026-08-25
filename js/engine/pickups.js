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
// ---- Cofre de jefe: al matar al jefe suelta un cofre que al tocarlo libera 1-3 pickups ----
  // Abre si el jugador está cerca; suelta shards (pickups) y/o armas (weaponPickups).
  // Expira tras CHEST_TTL. Devuelve el array de cofres filtrado (no-muertos).
  const CHEST_TTL = 30;
  NV.updateBossChests = function (dt, bossChests, player, pickups, weaponPickups, WEAPONS, addFloatText, pickupSfx) {
    const alive = [];
    for (const c of bossChests) {
      if (c.dead) continue;
      c.timer = (c.timer || 0) + dt;
      if (c.timer > CHEST_TTL) continue; // expira: se descarta
      const d = Math.hypot(c.x - player.x, c.y - player.y);
      if (d < 34) {
        c.dead = true;
        addFloatText(c.x, c.y - 18, 'TESORO DEL JEFE! 💎', '#ffd700');
        const n = 1 + Math.floor(Math.random() * 3); // 1..3
        for (let i = 0; i < n; i++) {
          const ox = c.x + (Math.random() - 0.5) * 26;
          const oy = c.y + (Math.random() - 0.5) * 26;
          if (Math.random() < 0.55) {
            pickups.push({ x: ox, y: oy, value: 3 + Math.floor(Math.random() * 4), dead: false });
          } else {
            weaponPickups.push({ x: ox, y: oy, weapon: WEAPONS[Math.floor(Math.random() * WEAPONS.length)], dead: false });
          }
        }
        pickupSfx();
      } else {
        alive.push(c);
      }
    }
    return alive;
  };
})();

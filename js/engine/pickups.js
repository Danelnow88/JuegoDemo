// ===== ENGINE: pickups (monedas/shards + armas recolectables) =====
// updatePickups/updateWeaponPickups: filtran arrays por ref y devuelven el array + estado acumulativo
// (shards / currentWeapon) que en game.js son `let` y deben reasignarse. Los callbacks preservan
// las closures del monolito (addFloatText, pickup sfx, showBanner).
(() => {
  'use strict';
  const NV = window.NV;

  // ---- spawn ----
  // isEligible(weapon) opcional: filtra el pool ANTES de elegir (pool de elegibles,
  // nunca retry aleatorio sin límite). Sin elegibles: no genera pickup ni banner.
  NV.spawnWeaponPickup = function (WEAPONS, weaponPickups, W, H, showBanner, RARITY_COLORS, isEligible) {
    const pool = (typeof isEligible === 'function') ? WEAPONS.filter(isEligible) : WEAPONS;
    if (pool.length === 0) return false; // todas las candidatas inelegibles: no se genera drop
    const weapon = pool[Math.floor(Math.random() * pool.length)];
    weaponPickups.push({
      x: 40 + Math.random() * (W - 80),
      y: 80 + Math.random() * (H - 160),
      weapon: weapon,
      dead: false,
    });
    showBanner('¡' + weapon.name + '! ◆', RARITY_COLORS[weapon.rarity]);
    return true;
  };

  // ---- update genérico de shards/coins ----
  // devuelve { pickups, shards }
  NV.updatePickups = function (dt, pickups, player, addFloatText, pickupSfx) {
    let shards = 0;
    for (const p of pickups) {
      if (p.dead) continue;
      if (p.magnetPull) {
        const dxp = player.x - p.x, dyp = player.y - p.y;
        const dist = Math.max(1, Math.hypot(dxp, dyp));
        const speed = Math.min(1400, 520 + dist * 5.5);
        p.x += (dxp / dist) * speed * dt;
        p.y += (dyp / dist) * speed * dt;
        p.magnetLife = Math.max(0, (p.magnetLife || 0) - dt);
      }
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
    const playPickup = () => {
      if (!pickupSfx) return;
      if (typeof pickupSfx === 'function') pickupSfx();
      else if (pickupSfx.pickup) pickupSfx.pickup();
    };
    const playFuse = (level) => {
      if (pickupSfx && pickupSfx.fuse) pickupSfx.fuse(level);
      else playPickup();
    };
    for (const wp of weaponPickups) {
      if (wp.dead) continue;
      if (wp.magnetPull) {
        const dxp = player.x - wp.x, dyp = player.y - wp.y;
        const dist = Math.max(1, Math.hypot(dxp, dyp));
        const speed = Math.min(1400, 520 + dist * 5.5);
        wp.x += (dxp / dist) * speed * dt;
        wp.y += (dyp / dist) * speed * dt;
        wp.magnetLife = Math.max(0, (wp.magnetLife || 0) - dt);
      }
      const d = Math.hypot(wp.x - player.x, wp.y - player.y);
      if (d < 30) {
        if (tryFusion) {
          const r = tryFusion(wp.weapon);
          if (r && r.fused) {
            wp.dead = true;
            addFloatText(wp.x, wp.y - 10, 'FUSIÓN Nv' + r.level, '#ffd700');
            playFuse(r.level);
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
          playPickup();
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
  // Consumible imán: selecciona una vez los pickups más cercanos, hasta un límite duro.
  // Los excedentes permanecen en el mundo y no se ordenan de nuevo durante la atracción.
  NV.magnetCollect = function (pickups, weaponPickups, player) {
    const cap = (NV.BALANCE && NV.BALANCE.MAGNET_CAP) || 50;
    const eligible = [];
    for (const p of pickups) {
      if (!p.dead && !p.magnetPull) eligible.push({ obj: p, distSq: (p.x - player.x) ** 2 + (p.y - player.y) ** 2 });
    }
    for (const w of weaponPickups) {
      if (!w.dead && !w.magnetPull) eligible.push({ obj: w, distSq: (w.x - player.x) ** 2 + (w.y - player.y) ** 2 });
    }
    eligible.sort((a, b) => a.distSq - b.distSq);
    let n = 0;
    for (let i = 0; i < eligible.length && n < cap; i++) {
      eligible[i].obj.magnetPull = true;
      eligible[i].obj.magnetLife = 0.8;
      n++;
    }
    return n;
  };
  // Abre un cofre de jefe: suelta 1-3 drops (shards y/o armas) con la MISMA
  // lógica/RNG siempre (pickup manual y auto-recogida comparten esta ruta).
  // Cada drop liberado se etiqueta con fromBossChest para poder distinguirlo
  // de drops normales (la auto-recogida de transición sólo toca éstos).
  // isEligible(weapon) opcional: filtra el pool de armas del cofre (pool de elegibles).
  // Sin elegibles: ese slot del cofre no suelta arma (seguro: sin crash/loop/undefined).
  const CHEST_TTL = 30;
  function openBossChest(c, pickups, weaponPickups, WEAPONS, addFloatText, pickupSfx, isEligible) {
    c.dead = true;
    addFloatText(c.x, c.y - 18, 'TESORO DEL JEFE! ◆', '#7cf8ff');
    const n = 1 + Math.floor(Math.random() * 3); // 1..3
    for (let i = 0; i < n; i++) {
      const ox = c.x + (Math.random() - 0.5) * 26;
      const oy = c.y + (Math.random() - 0.5) * 26;
      if (Math.random() < 0.55) {
        pickups.push({ x: ox, y: oy, value: 3 + Math.floor(Math.random() * 4), dead: false, fromBossChest: true });
      } else {
        const pool = (typeof isEligible === 'function') ? WEAPONS.filter(isEligible) : WEAPONS;
        if (pool.length > 0) {
          weaponPickups.push({ x: ox, y: oy, weapon: pool[Math.floor(Math.random() * pool.length)], dead: false, fromBossChest: true });
        }
      }
    }
    pickupSfx();
  }
  NV.updateBossChests = function (dt, bossChests, player, pickups, weaponPickups, WEAPONS, addFloatText, pickupSfx, isEligible) {
    const alive = [];
    for (const c of bossChests) {
      if (c.dead) continue;
      // Tarea #8c: un cofre con autoCollect (en vuelo de auto-pickup) queda bajo
      // control EXCLUSIVO de la animación (chestAnim): NO se abre por proximidad
      // manual ni expira por TTL; sólo se conserva vivo hasta que el vuelo termine.
      if (c.autoCollect) { alive.push(c); continue; }
      c.timer = (c.timer || 0) + dt;
      if (c.timer > CHEST_TTL) continue; // expira: se descarta
      const d = Math.hypot(c.x - player.x, c.y - player.y);
      if (d < 34) {
        openBossChest(c, pickups, weaponPickups, WEAPONS, addFloatText, pickupSfx, isEligible);
      } else {
        alive.push(c);
      }
    }
    return alive;
  };
  // Red de seguridad (Tarea #8): antes de una transición que descartaría el botín
  // del jefe (wave_end -> shop_enter), recoge automáticamente SOLO las recompensas
  // de boss pendientes. NO toca drops normales (sin fromBossChest).
  //  1) Cofres aún sin abrir: se abren por la MISMA ruta del pickup manual (mismo
  //     RNG/elegibilidad); no se inventan recompensas nuevas.
  //  2) Drops de cofre (fromBossChest) aún en el suelo: se acreditan una sola vez
  //     (los ya recogidos están muertos/filtrados => sin duplicados).
  // collectShard(value, x, y): acredita el shard (game.js suma y da feedback).
  // collectWeapon(weapon, x, y): aplica las reglas existentes de fusión/inventario;
  //   debe devolver true si consumió el arma. Si devuelve false (max fusión /
  //   inventario lleno) el pickup queda en el mundo, como en el pickup manual.
  NV.autoCollectBossRewards = function (opts) {
    const o = opts || {};
    const bossChests = o.bossChests || [];
    const pickups = o.pickups || [];
    const weaponPickups = o.weaponPickups || [];
    const collectShard = o.collectShard || (() => {});
    const collectWeapon = o.collectWeapon || (() => false);
    const addFloatText = o.addFloatText || (() => {});
    const pickupSfx = o.pickupSfx || (() => {});
    const res = { chestsOpened: 0, shards: 0, weapons: 0 };
    for (const c of bossChests) {
      if (!c || c.dead) continue;
      openBossChest(c, pickups, weaponPickups, o.WEAPONS || [], addFloatText, pickupSfx, o.isEligible);
      res.chestsOpened++;
    }
    for (const p of pickups) {
      if (!p || p.dead || !p.fromBossChest) continue;
      p.dead = true;
      const v = p.value || 1;
      res.shards += v;
      collectShard(v, p.x, p.y);
    }
    for (const w of weaponPickups) {
      if (!w || w.dead || !w.fromBossChest) continue;
      if (collectWeapon(w.weapon, w.x, w.y)) {
        w.dead = true;
        res.weapons++;
      }
      // No acreditada (inventario lleno / max fusión): queda en el mundo con su
      // marca fromBossChest, como en el pickup manual. La auto-recogida del
      // margen la vuelve a intentar si sigue pendiente al vencer.
    }
    return res;
  };
})();

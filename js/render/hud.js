// ===== RENDER: HUD en canvas (cooldown especial, panel de arma, stats) =====
// Funciones de dibujo PUROS. game.js aporta ctx y los valores de su closure al llamarlas.
(() => {
  'use strict';
  const NV = window.NV;

  // Anillo de cooldown alrededor del personaje.
  NV.drawSpecialCooldown = function (ctx, W, H, CHARACTERS, player) {
    const char = CHARACTERS[player.character];
    const cx = player.x, cy = player.y;
    const radius = char.size + 16;

    if (player.specialCd > 0) {
      const progress = 1 - player.specialCd / char.maxCd;
      ctx.strokeStyle = 'rgba(124, 248, 255, 0.5)';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke();

      ctx.strokeStyle = char.color;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      const startAngle = -Math.PI / 2;
      ctx.arc(cx, cy, radius, startAngle, startAngle + progress * Math.PI * 2);
      ctx.stroke();
      ctx.lineCap = 'default';
    } else {
      ctx.fillStyle = char.color;
      ctx.font = 'bold 18px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(char.skillIcon, cx, cy - radius - 8);
    }
  };

  // Dibuja una grilla de celdas 3x2 reutilizable para paneles de slots.
  function drawSlotGrid(ctx, gx, gy, entries, selIdx, cw, ch) {
    const cols = 3, gap = 4;
    for (let i = 0; i < 6; i++) {
      const e = entries[i];
      const x = gx + (i % cols) * (cw + gap), y = gy + Math.floor(i / cols) * (ch + gap);
      const selected = i === selIdx && !!e;
      ctx.fillStyle = selected ? 'rgba(124,248,255,0.22)' : (e ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)');
      ctx.fillRect(x, y, cw, ch);
      ctx.strokeStyle = selected ? '#7cf8ff' : (e ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)');
      ctx.lineWidth = selected ? 2 : 1;
      ctx.strokeRect(x, y, cw, ch);
      if (e) {
        ctx.font = 'bold 14px system-ui';
        ctx.fillStyle = e.color || '#fff';
        ctx.fillText(e.icon, x + 5, y + ch / 2 + 5);
        if (e.badge) {
          ctx.font = 'bold 9px system-ui';
          ctx.textAlign = 'right';
          ctx.fillStyle = '#fff';
          ctx.fillText(e.badge, x + cw - 4, y + ch - 5);
          ctx.textAlign = 'left';
        }
      }
    }
  }

  // Panel derecho: ARMAS (grilla 6 slots) + HABILIDAD + CONSUMIBLES (grilla 6 slots con selección).
  NV.drawWeaponHUD = function (ctx, W, H, CHARACTERS, RARITY_COLORS, player, currentWeapon, currentWeaponLevel, inventory, consumGroups, consumSel, showHUD) {
    if (!showHUD) return;
    const char = CHARACTERS[player.character];
    const weapon = currentWeapon;
    const iconColor = RARITY_COLORS[weapon.rarity];
    const pw = 154, wh = 92, sh = 40, chh = 92;
    const wx = W - pw - 10, wy = 10;

    ctx.textAlign = 'left';

    // === ARMAS: cabecera (arma equipada) + grilla de inventario (teclas 1-6) ===
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.strokeStyle = iconColor; ctx.lineWidth = 1.5;
    ctx.fillRect(wx, wy, pw, wh); ctx.strokeRect(wx, wy, pw, wh);
    ctx.font = 'bold 15px system-ui';
    ctx.fillStyle = iconColor;
    ctx.fillText(weapon.emoji, wx + 7, wy + 17);
    ctx.font = 'bold 9px system-ui';
    ctx.fillStyle = '#fff';
    ctx.fillText(weapon.name, wx + 27, wy + 12);
    ctx.font = '8px system-ui';
    ctx.fillStyle = '#aaa';
    ctx.fillText('Nv ' + currentWeaponLevel() + ' · rueda o teclas 1-6', wx + 27, wy + 23);
    drawSlotGrid(ctx, wx + 5, wy + 28, inventory.map((wItem, i) => ({
      icon: wItem.emoji,
      color: RARITY_COLORS[wItem.rarity],
      badge: String(i + 1),
      equipped: wItem === weapon,
    })), -1, 45, 28);
    // El arma equipada se resalta aparte (puede ser la Pistola base, fuera del inventario).
    for (let i = 0; i < 6 && i < inventory.length; i++) {
      if (inventory[i] === weapon) {
        const gx = wx + 5 + (i % 3) * 49, gy = wy + 28 + Math.floor(i / 3) * 32;
        ctx.strokeStyle = iconColor; ctx.lineWidth = 2;
        ctx.strokeRect(gx, gy, 45, 28);
        break;
      }
    }

    // === HABILIDAD (panel pequeño + relleno de cooldown) ===
    const sy = wy + wh + 6;
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.strokeStyle = char.color; ctx.lineWidth = 1.5;
    ctx.fillRect(wx, sy, pw, sh); ctx.strokeRect(wx, sy, pw, sh);

    const cd = player.specialCd > 0 ? 1 - player.specialCd / char.maxCd : 1;
    const fillH = Math.max(0, Math.min(1, cd)) * (sh - 2);
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = char.color;
    ctx.fillRect(wx + 1, sy + sh - 1 - fillH, pw - 2, fillH);
    ctx.globalAlpha = 1;

    ctx.font = 'bold 15px system-ui';
    ctx.fillStyle = char.color;
    ctx.fillText(char.skillIcon, wx + 7, sy + 24);
    ctx.font = 'bold 8px system-ui';
    ctx.fillStyle = cd >= 1 ? '#fff' : '#aaa';
    ctx.fillText(cd >= 1 ? '¡LISTO! ✓' : 'CD ' + Math.ceil(player.specialCd) + 's', wx + 30, sy + 16);
    ctx.fillText(char.skillName, wx + 30, sy + 30);

    // === CONSUMIBLES: grilla por TIPO (selección con Q, uso con F) ===
    const cy = sy + sh + 6;
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.strokeStyle = '#7cf8ff'; ctx.lineWidth = 1.5;
    ctx.fillRect(wx, cy, pw, chh); ctx.strokeRect(wx, cy, pw, chh);
    ctx.font = 'bold 9px system-ui';
    ctx.fillStyle = consumGroups.length ? '#7cf8ff' : '#555';
    ctx.fillText(consumGroups.length ? 'F usar · Q elegir' : 'SIN CONSUMIBLES', wx + 7, cy + 13);
    drawSlotGrid(ctx, wx + 5, cy + 18, consumGroups.slice(0, 6).map((g) => ({
      icon: g.icon,
      color: '#fff',
      badge: 'x' + g.count,
    })), consumGroups.length ? consumSel : -1, 45, 28);
    // Rects para hit-test de click en game.js (selección de consumible con el mouse).
    NV.consumSlotRects = consumGroups.slice(0, 6).map((g, i) => ({
      type: g.type, x: wx + 5 + (i % 3) * 49, y: cy + 18 + Math.floor(i / 3) * 32, w: 45, h: 28,
    }));
  };

    // Combo de kills (E1): contador ABAJO-CENTRO (libre de paneles laterales y barra de oleada).
  NV.drawCombo = function (ctx, W, H, combo) {
    if (!combo || combo.count < 2) return; // no molesta con 0/1
    const cx = W / 2, y = H - 64;
    const heat = Math.min(1, combo.count / 15); // escala: mas kills = mas caliente
    const col = heat > 0.66 ? '#ff5f5f' : heat > 0.33 ? '#ffd700' : '#7cf8ff';
    const pulse = 1 + Math.min(0.35, combo.timer * 0.12); // latido mientras queda ventana
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = 'bold ' + Math.round(22 * pulse) + "px 'Courier New', monospace";
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = col;
    ctx.shadowColor = col; ctx.shadowBlur = 12;
    ctx.fillText('COMBO x' + combo.count, cx, y);
    ctx.shadowBlur = 0;
    const barW = 60;
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(cx - barW / 2, y + 7, barW, 3);
    ctx.fillStyle = col;
    ctx.fillRect(cx - barW / 2, y + 7, barW * Math.max(0, combo.timer / 2), 3);
    ctx.restore();
  };

  // Panel TAB de estadísticas.
  NV.drawStats = function (ctx, CHARACTERS, RARITY_COLORS, player, currentWeapon, currentWeaponLevel, weaponVisualTier, BULLET_TIER_COLORS, permUpgrades, inventory, INVENTORY_SLOTS, consumableItems) {
    const char = CHARACTERS[player.character];
    const weapon = currentWeapon;
    const panelX = 10, panelY = 60, panelW = 260, panelH = 250;

    ctx.fillStyle = 'rgba(0,0,0,0.9)';
    ctx.fillRect(panelX, panelY, panelW, panelH);
    ctx.strokeStyle = RARITY_COLORS[weapon.rarity];
    ctx.lineWidth = 2;
    ctx.strokeRect(panelX, panelY, panelW, panelH);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px system-ui';
    ctx.textAlign = 'left';
    ctx.fillText('ESTADÍSTICAS', panelX + 10, panelY + 20);

    ctx.font = '12px system-ui';
    ctx.fillStyle = '#aaa';
    const lines = [
      `Personaje: ${char.name}`,
      `Pasiva: ${char.passive}`,
      `Habilidad: ${char.skillIcon} ${char.skillName} (CD: ${char.maxCd}s)`,
      `Nivel: ${player.level}  |  XP: ${player.xp}/${player.xpToNext}`,
      `HP: ${Math.round(player.hp)}/${player.maxHp}  |  Armadura: ${player.armor}`,
      `Velocidad: ${Math.round(player.speed)}  |  Suerte: ${player.luck}`,
      `Agilidad: ${player.agility.toFixed(2)}x (maniobralidad)`,
      `Arma: ${weapon.name} (${weapon.rarity}) | Nv ${currentWeaponLevel()}` + (weaponVisualTier() > 0 ? ` | Tier ${weaponVisualTier()} (${BULLET_TIER_COLORS[weaponVisualTier()]})` : ''),
      `Daño: ${weapon.damage + permUpgrades.damage * 2 + currentWeaponLevel()}`,
      `Inventario: ${inventory.length}/${INVENTORY_SLOTS}  |  Consumibles: ${consumableItems.length}`,
    ];
    lines.forEach((line, i) => ctx.fillText(line, panelX + 10, panelY + 45 + i * 18));
  };
})();
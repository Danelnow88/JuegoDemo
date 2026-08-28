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

    // Dibuja una fila horizontal de 6 celdas (HUD minimalista de una sola linea).
  function drawSlotRow(ctx, gx, gy, entries, selIdx, equippedIdx, eqColor, cw, ch, gap) {
    for (let i = 0; i < 6; i++) {
      const e = entries[i];
      const x = gx + i * (cw + gap);
      const selected = i === selIdx && !!e;
      const equipped = i === equippedIdx;
      ctx.fillStyle = selected || equipped ? 'rgba(124,248,255,0.25)' : (e ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)');
      ctx.fillRect(x, gy, cw, ch);
      ctx.strokeStyle = equipped && eqColor ? eqColor : selected ? '#7cf8ff' : (e ? 'rgba(255,255,255,0.30)' : 'rgba(255,255,255,0.08)');
      ctx.lineWidth = selected || equipped ? 2 : 1;
      ctx.strokeRect(x, gy, cw, ch);
      if (e) {
        ctx.font = 'bold 14px system-ui';
        ctx.fillStyle = e.color || '#fff';
        ctx.textAlign = 'center';
        ctx.fillText(e.icon, x + cw / 2, gy + ch / 2 + 4);
        if (e.badge !== undefined && e.badge !== '') {
          ctx.font = 'bold 9px system-ui';
          ctx.textAlign = 'right';
          ctx.fillStyle = '#fff';
          ctx.fillText(e.badge, x + cw - 3, gy + ch - 3);
        }
        ctx.textAlign = 'left';
      }
    }
  }

  // Panel derecho minimalista: tres tiras horizontales finas de 6 slots en una sola fila.
  // Orden vertical: ARMAS (slot 0 = pistola fija) + nombre/nivel -> CONSUMIBLES -> HABILIDAD.
  NV.drawWeaponHUD = function (ctx, W, H, CHARACTERS, RARITY_COLORS, player, currentWeapon, currentWeaponLevel, inventory, consumGroups, consumSel, showHUD) {
    if (!showHUD) return;
    const char = CHARACTERS[player.character];
    const weapon = currentWeapon;
    const iconColor = RARITY_COLORS[weapon.rarity];
    const cw = 20, ch = 20, gap = 3;
    const pw = 6 * (cw + gap) - gap;
    const bx = W - pw - 8;
    let by = 10;
    ctx.textAlign = 'left';
    const pistol = NV.WEAPONS[0];
    const wEntries = [{ icon: pistol.emoji, color: RARITY_COLORS[pistol.rarity] }].concat(
      inventory.slice(0, 5).map((wItem) => ({ icon: wItem.emoji, color: RARITY_COLORS[wItem.rarity] }))
    );
    let equippedIdx = weapon === pistol ? 0 : inventory.indexOf(weapon) + 1;
    if (equippedIdx < 0 || equippedIdx > 5) equippedIdx = -1;
    ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.strokeStyle = iconColor; ctx.lineWidth = 1.5;
    ctx.fillRect(bx, by, pw, 6); ctx.strokeRect(bx, by, pw, 6);
    ctx.font = 'bold 7px system-ui'; ctx.fillStyle = iconColor;
    ctx.fillText(weapon.emoji + ' ' + weapon.name + ' Nv' + currentWeaponLevel(), bx + 3, by + 5);
    drawSlotRow(ctx, bx, by + 8, wEntries, -1, equippedIdx, iconColor, cw, ch, gap);
    by += 8 + ch + gap + 3;
    if (consumGroups.length) {
      const cEntries = consumGroups.slice(0, 6).map((g) => ({ icon: g.icon, color: '#fff', badge: 'x' + g.count }));
      drawSlotRow(ctx, bx, by, cEntries, consumGroups.length ? consumSel : -1, -1, null, cw, ch, gap);
      NV.consumSlotRects = consumGroups.slice(0, 6).map((g, i) => ({ type: g.type, x: bx + i * (cw + gap), y: by, w: cw, h: ch }));
      ctx.font = 'bold 7px system-ui'; ctx.fillStyle = '#7cf8ff';
      ctx.fillText('F usar - Q/E elegir', bx, by + ch + 3);
    } else {
      NV.consumSlotRects = [];
      drawSlotRow(ctx, bx, by, [], -1, -1, null, cw, ch, gap);
      ctx.font = 'bold 7px system-ui'; ctx.fillStyle = '#555'; ctx.textAlign = 'center';
      ctx.fillText('SIN CONSUMIBLES', bx + pw / 2, by + ch / 2 + 3); ctx.textAlign = 'left';
    }
    by += ch + gap + 3;
    const sh = 14;
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.strokeStyle = char.color; ctx.lineWidth = 1.5;
    ctx.fillRect(bx, by, pw, sh); ctx.strokeRect(bx, by, pw, sh);
    const cd = player.specialCd > 0 ? 1 - player.specialCd / char.maxCd : 1;
    const fillW = Math.max(0, Math.min(1, cd)) * (pw - 2);
    ctx.globalAlpha = 0.55; ctx.fillStyle = char.color;
    ctx.fillRect(bx + 1, by + 1, fillW, sh - 2);
    ctx.globalAlpha = 1;
    ctx.font = 'bold 11px system-ui';
    ctx.fillStyle = char.color;
    ctx.fillText(char.skillIcon, bx + 4, by + sh / 2 + 3);
    ctx.font = 'bold 7px system-ui';
    ctx.fillStyle = cd >= 1 ? '#fff' : '#aaa';
    ctx.fillText(cd >= 1 ? 'LISTO' : 'CD ' + Math.ceil(player.specialCd) + 's', bx + 20, by + sh / 2 + 1);
    ctx.fillText(char.skillName, bx + 20, by + sh);
  };

  NV.drawSlotRow = drawSlotRow;  // Combo de kills (E1): contador ABAJO-CENTRO (libre de paneles laterales y barra de oleada).
  NV.drawCombo = function (ctx, W, H, combo) {
    if (!combo || combo.count < 2) return;
    const x = 10, y = 20;
    const heat = Math.min(1, combo.count / 15);
    const col = heat > 0.66 ? '#ff5f5f' : heat > 0.33 ? '#ffd700' : '#7cf8ff';
    const pulse = 1 + Math.min(0.35, combo.timer * 0.12);
    ctx.save();
    ctx.textAlign = 'left';
    ctx.font = 'bold ' + Math.round(18 * pulse) + "px 'Courier New', monospace";
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = col;
    ctx.shadowColor = col; ctx.shadowBlur = 10;
    ctx.fillText('x' + combo.count, x, y);
    ctx.shadowBlur = 0;
    const barW = 36;
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(x, y + 5, barW, 2);
    ctx.fillStyle = col;
    ctx.fillRect(x, y + 5, barW * Math.max(0, combo.timer / 2), 2);
    ctx.restore();
  };
  // Panel TAB de estadÃ­sticas.
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
    ctx.fillText('ESTADÃSTICAS', panelX + 10, panelY + 20);

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
      `DaÃ±o: ${weapon.damage + permUpgrades.damage * 2 + currentWeaponLevel()}`,
      `Inventario: ${inventory.length}/${INVENTORY_SLOTS}  |  Consumibles: ${consumableItems.length}`,
    ];
    lines.forEach((line, i) => ctx.fillText(line, panelX + 10, panelY + 45 + i * 18));
  };
})();


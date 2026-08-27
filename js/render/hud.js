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

  // Panel superior derecho: arma + habilidad + consumibles.
  NV.drawWeaponHUD = function (ctx, W, H, CHARACTERS, RARITY_COLORS, player, currentWeapon, currentWeaponLevel, consumableItems, showHUD) {
    if (!showHUD) return;
    const weapon = currentWeapon;
    const char = CHARACTERS[player.character];
    const iconColor = RARITY_COLORS[weapon.rarity];
    const w = 118, h = 40;
    const wx = W - w - 12, wy = 10;

    ctx.textAlign = 'left';

    // === ARMA (panel pequeño) ===
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.strokeStyle = iconColor; ctx.lineWidth = 1.5;
    ctx.fillRect(wx, wy, w, h); ctx.strokeRect(wx, wy, w, h);
    ctx.font = 'bold 15px system-ui';
    ctx.fillStyle = iconColor;
    ctx.fillText(weapon.emoji, wx + 7, wy + 24);
    ctx.font = 'bold 9px system-ui';
    ctx.fillStyle = '#fff';
    ctx.fillText(weapon.name, wx + 30, wy + 16);
    ctx.font = '8px system-ui';
    ctx.fillStyle = '#aaa';
    ctx.fillText('Nv ' + currentWeaponLevel() + ' · teclas 1-6', wx + 30, wy + 30);

    // === HABILIDAD (panel pequeño + relleno de cooldown) ===
    const sy = wy + h + 6;
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.strokeStyle = char.color; ctx.lineWidth = 1.5;
    ctx.fillRect(wx, sy, w, h); ctx.strokeRect(wx, sy, w, h);

    const cd = player.specialCd > 0 ? 1 - player.specialCd / char.maxCd : 1;
    const fillH = Math.max(0, Math.min(1, cd)) * (h - 2);
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = char.color;
    ctx.fillRect(wx + 1, sy + h - 1 - fillH, w - 2, fillH);
    ctx.globalAlpha = 1;

    ctx.font = 'bold 15px system-ui';
    ctx.fillStyle = char.color;
    ctx.fillText(char.skillIcon, wx + 7, sy + 24);
    ctx.font = 'bold 8px system-ui';
    ctx.fillStyle = cd >= 1 ? '#fff' : '#aaa';
    ctx.fillText(cd >= 1 ? '¡LISTO! ✓' : 'CD ' + Math.ceil(player.specialCd) + 's', wx + 30, sy + 16);
    ctx.font = '8px system-ui';
    ctx.fillStyle = '#aaa';
    ctx.fillText(char.skillName, wx + 30, sy + 30);

    // === CONSUMIBLES (indicador con la tecla F) ===
    if (consumableItems.length > 0) {
      const cy = sy + h + 6;
      ctx.fillStyle = 'rgba(0,0,0,0.72)';
      ctx.strokeStyle = '#7cf8ff'; ctx.lineWidth = 1.5;
      ctx.fillRect(wx, cy, w, h); ctx.strokeRect(wx, cy, w, h);
      ctx.font = 'bold 15px system-ui';
      ctx.fillText(consumableItems[0].icon, wx + 7, cy + 24);
      ctx.font = 'bold 9px system-ui';
      ctx.fillStyle = '#fff';
      ctx.fillText('x' + consumableItems.length, wx + 30, cy + 16);
      ctx.font = '8px system-ui';
      ctx.fillStyle = '#aaa';
      ctx.fillText('F: usar consumible', wx + 30, cy + 30);
    }
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
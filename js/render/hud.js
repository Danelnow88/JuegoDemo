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

    
  var ANIM = {
    lastSel: {},
    lastFill: {},
    lastFuse: {},
    selPulse: {},
    fillFlash: {},
    fuseFlash: {},
    lastCd: null,
    readyPulse: 0,
    lastWeaponText: null,
    weaponFadeAt: 0
  };
  function nowMs() {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') return performance.now();
    return Date.now();
  }
  function easeOut(t) { return 1 - (1 - t) * (1 - t); }

  var GLOW_BY_RARITY = { common: 0.32, uncommon: 0.42, rare: 0.52, epic: 0.76, legendary: 1 };

  function roundedFill(ctx, x, y, w, h, r) {
    if (typeof ctx.roundRect === 'function') { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); return; }
    ctx.fillRect(x, y, w, h);
  }
  function roundedStroke(ctx, x, y, w, h, r) {
    if (typeof ctx.roundRect === 'function') { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.stroke(); return; }
    ctx.strokeRect(x, y, w, h);
  }
  function slotGradient(ctx, x, y, w, h, c) {
    if (typeof ctx.createLinearGradient === 'function') {
      var g = ctx.createLinearGradient(x, y, x + w, y + h);
      g.addColorStop(0, 'rgba(' + c + ',0.16)');
      g.addColorStop(1, 'rgba(' + c + ',0.02)');
      return g;
    }
    return null;
  }
  function rgbaNum(hex, a) {
    var h = hex.replace('#', '');
    if (h.length === 6) { return parseInt(h.substr(0, 2), 16) + ',' + parseInt(h.substr(2, 2), 16) + ',' + parseInt(h.substr(4, 2), 16); }
    return '124,248,255';
  }

  function truncateToWidth(ctx, text, font, maxW) {
    ctx.font = font;
    if (typeof ctx.measureText === 'function' && ctx.measureText(text).width <= maxW) return text;
    var approx = function (t) { if (typeof ctx.measureText === 'function') return ctx.measureText(t).width; return t.length * 4.5; };
    if (approx(text) <= maxW) return text;
    var out = text;
    while (out.length > 1 && approx(out + '\u2026') > maxW) { out = out.slice(0, -1); }
    return out + '\u2026';
  }
  function vyBaseline(ctx, font, yTop, h) {
    ctx.font = font;
    var m = null;
    try { if (typeof ctx.measureText === 'function') m = ctx.measureText('Mg'); } catch (e) { m = null; }
    if (m && typeof m.actualBoundingBoxAscent === 'number') {
      var asc = m.actualBoundingBoxAscent, desc = m.actualBoundingBoxDescent;
      return yTop + (h - (asc + desc)) / 2 + asc;
    }
    return yTop + h / 2 + 1;
  }
  function drawSlotRow(ctx, gx, gy, entries, selIdx, equippedIdx, eqColor, cw, ch, gap, key) {
    var RAD = 5;
    var now = nowMs();
    var filled = entries.map(function (e) { return !!e; });
    var fuses = entries.map(function (e) { return e && e.fuse ? e.fuse : 0; });
    if (ANIM.lastFill[key]) {
      for (var i = 0; i < 6; i++) {
        if (!ANIM.lastFill[key][i] && filled[i]) { ANIM.fillFlash[key + ':' + i] = now; }
      }
    }
    ANIM.lastFill[key] = filled;
    if (ANIM.lastFuse[key]) {
      for (var j = 0; j < 6; j++) {
        if ((ANIM.lastFuse[key][j] || 0) < fuses[j]) { ANIM.fuseFlash[key + ':' + j] = now; }
      }
    }
    ANIM.lastFuse[key] = fuses;
    if (ANIM.lastSel[key] !== undefined && ANIM.lastSel[key] !== selIdx && selIdx >= 0 && entries[selIdx]) {
      ANIM.selPulse[key] = now;
    }
    ANIM.lastSel[key] = selIdx;

    var selectionPulseT = 1;
    if (ANIM.selPulse[key]) { selectionPulseT = Math.max(0, 1 - (now - ANIM.selPulse[key]) / 320); }

    for (var k = 0; k < 6; k++) {
      var e = entries[k];
      var x = gx + k * (cw + gap), y = gy;
      var selected = k === selIdx && !!e;
      var equipped = k === equippedIdx;
      var glow = e ? (e.glow !== undefined ? e.glow : 0.3) : 0;
      var cnum = rgbaNum(e ? e.color : '#7cf8ff');
      var pulseA = selected ? easeOut(selectionPulseT) : 0;
      var scale = 1 + 0.13 * pulseA;
      var ccx = x + cw / 2, ccy = y + ch / 2;
      var usedGlow = (equipped ? glow + 0.3 : selected ? glow + 0.35 : glow);
      var grad = slotGradient(ctx, x, y, cw, ch, cnum);
      ctx.save();
      if (scale > 1.01) { ctx.translate(ccx, ccy); ctx.scale(scale, scale); ctx.translate(-ccx, -ccy); }
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = grad || (e ? 'rgba(' + cnum + ',0.10)' : 'rgba(255,255,255,0.03)');
      roundedFill(ctx, x, y, cw, ch, RAD);
      ctx.globalAlpha = 1;
      ctx.lineWidth = (selected || equipped) ? 2 : 1;
      ctx.strokeStyle = selected || equipped
        ? (equipped && eqColor ? eqColor : '#7cf8ff')
        : (e ? 'rgba(' + cnum + ',' + (0.28 + glow * 0.35).toFixed(2) + ')' : 'rgba(255,255,255,0.08)');
      ctx.shadowColor = selected || equipped ? (equipped && eqColor ? eqColor : '#7cf8ff') : '#7cf8ff';
      ctx.shadowBlur = selected || equipped ? 6 + 12 * (usedGlow * pulseA + glow * 0.4) * 2 : 3 + usedGlow * 6;
      roundedStroke(ctx, x, y, cw, ch, RAD);
      ctx.shadowBlur = 0;
      if (e && typeof ctx.roundRect === 'function') {
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.beginPath(); ctx.roundRect(x, y, cw, 3, RAD); ctx.fill();
      }
      if (e) {
        if (e.weapon && typeof NV.drawWeaponIcon === 'function') {
          NV.drawWeaponIcon(ctx, e.weapon, x + cw / 2, y + ch / 2, 18, { glow: selected || equipped ? 5 : 2 });
        } else {
          ctx.font = 'bold 14px system-ui';
          ctx.fillStyle = e.color || '#fff';
          ctx.textAlign = 'center';
          ctx.shadowColor = e.color || '#7cf8ff';
          ctx.shadowBlur = selected || equipped ? 10 + 10 * (glow * pulseA) : 5 + glow * 6;
          ctx.fillText(e.icon, x + cw / 2, y + ch / 2 + 4);
          ctx.shadowBlur = 0;
        }
        if (e.badge !== undefined && e.badge !== '') {
          ctx.font = 'bold 8px system-ui';
          ctx.textAlign = 'right';
          ctx.fillStyle = '#fff';
          ctx.fillText(e.badge, x + cw - 3, y + ch - 3);
        }
        ctx.textAlign = 'left';
      }
      ctx.restore();
      var flT = 0;
      if (ANIM.fillFlash[key + ':' + k]) {
        flT = Math.max(0, 1 - (now - ANIM.fillFlash[key + ':' + k]) / 260);
        if (flT === 0) delete ANIM.fillFlash[key + ':' + k];
      }
      var fuT = 0;
      if (ANIM.fuseFlash[key + ':' + k]) {
        fuT = Math.max(0, 1 - (now - ANIM.fuseFlash[key + ':' + k]) / 300);
        if (fuT === 0) delete ANIM.fuseFlash[key + ':' + k];
      }
      if (flT > 0) {
        ctx.fillStyle = 'rgba(255,255,255,' + (flT * 0.45).toFixed(2) + ')';
        roundedFill(ctx, x, y, cw, ch, RAD);
      }
      if (fuT > 0) {
        ctx.fillStyle = 'rgba(255,207,118,' + (fuT * 0.5).toFixed(2) + ')';
        roundedFill(ctx, x, y, cw, ch, RAD);
      }
    }
  }


  NV.drawWeaponHUD = function (ctx, W, H, CHARACTERS, RARITY_COLORS, player, currentWeapon, currentWeaponLevel, inventory, consumGroups, consumSel, showHUD) {
    if (!showHUD) return;
    var char = CHARACTERS[player.character];
    var weapon = currentWeapon;
    var iconColor = RARITY_COLORS[weapon.rarity];
    var cw = 22, ch = 22, gap = 5;
    var pw = 6 * (cw + gap) - gap;
    var bx = W - pw - 10;
    var by = 10;
    ctx.textAlign = 'left';
    var pistol = NV.WEAPONS[0];
    var wEntries = [{ weapon: pistol, color: RARITY_COLORS[pistol.rarity], glow: GLOW_BY_RARITY[pistol.rarity] || 0.3, fuse: 0 }].concat(
      inventory.slice(0, 5).map(function (wItem) { return { weapon: wItem, color: RARITY_COLORS[wItem.rarity], glow: GLOW_BY_RARITY[wItem.rarity] || 0.3, fuse: wItem.fuseLevel || 0 }; })
    );
    var equippedIdx = weapon === pistol ? 0 : inventory.indexOf(weapon) + 1;
    if (equippedIdx < 0 || equippedIdx > 5) equippedIdx = -1;
    var hCnum = rgbaNum(iconColor);
    ctx.fillStyle = 'rgba(0,0,0,0.62)';
    ctx.strokeStyle = 'rgba(' + hCnum + ',0.45)'; ctx.lineWidth = 1.5;
    var hh = 16;
    var htxt = weapon.name + ' Nv' + currentWeaponLevel();
    if (ANIM.lastWeaponText !== htxt) { ANIM.lastWeaponText = htxt; ANIM.weaponFadeAt = nowMs(); }
    var wf = ANIM.weaponFadeAt ? Math.max(0, 1 - (nowMs() - ANIM.weaponFadeAt) / 300) : 1;
    ctx.shadowColor = iconColor; ctx.shadowBlur = 3 + 6 * wf;
    roundedFill(ctx, bx, by, pw, hh, 5);
    roundedStroke(ctx, bx, by, pw, hh, 5);
    ctx.shadowBlur = 0;
    var hfont = 'bold 8px system-ui';
    ctx.fillStyle = iconColor; ctx.globalAlpha = 0.5 + 0.5 * wf;
    var fitted = truncateToWidth(ctx, htxt, hfont, pw - 27);
    ctx.font = hfont; ctx.textAlign = 'left';
    if (typeof NV.drawWeaponIcon === 'function') NV.drawWeaponIcon(ctx, weapon, bx + 13, by + hh / 2, 12, { glow: 2 });
    ctx.fillText(fitted, bx + 23, vyBaseline(ctx, hfont, by + 2, hh - 4));
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    drawSlotRow(ctx, bx, by + hh + 3, wEntries, -1, equippedIdx, iconColor, cw, ch, gap, 'w');

    by += 16 + 3 + ch + gap + 3;

  var consY = by; // fila de consumibles
  if (consumGroups.length) {
    var cEntries = consumGroups.slice(0, 6).map(function (g) { return { icon: g.icon, color: '#7cf8ff', glow: 0.5, badge: 'x' + g.count }; });
    drawSlotRow(ctx, bx, consY, cEntries, consumGroups.length ? consumSel : -1, -1, null, cw, ch, gap, 'c');
    NV.consumSlotRects = consumGroups.slice(0, 6).map(function (g, i) { return { type: g.type, x: bx + i * (cw + gap), y: consY, w: cw, h: ch }; });
    ctx.font = 'bold 7px system-ui'; ctx.fillStyle = '#7cf8ff'; ctx.shadowColor = '#7cf8ff'; ctx.shadowBlur = 3;
    ctx.fillText('F usar - Q/E elegir', bx, consY + 36);
    ctx.shadowBlur = 0;
  } else {
    NV.consumSlotRects = [];
    drawSlotRow(ctx, bx, consY, [], -1, -1, null, cw, ch, gap, 'c');
    ctx.font = 'bold 7px system-ui'; ctx.fillStyle = '#555'; ctx.textAlign = 'center';
    ctx.fillText('SIN CONSUMIBLES', bx + pw / 2, consY + ch / 2 + 3); ctx.textAlign = 'left';
  }

  // === HABILIDAD: slot cuadrado 22x22 (mismo tam que un slot) + anillo de cooldown ===
  var ssy = consY + 46;         // bajo el hint, con separacion (offset +8)
  var sl = 22;                  // igual a un slot de armas/consumibles
  var cd = player.specialCd > 0 ? 1 - player.specialCd / char.maxCd : 1;
  if (ANIM.lastCd !== null && ANIM.lastCd > 0 && player.specialCd <= 0) { ANIM.readyPulse = nowMs(); }
  ANIM.lastCd = player.specialCd;
  var rt = ANIM.readyPulse ? Math.max(0, 1 - (nowMs() - ANIM.readyPulse) / 500) : 0;
  var sCnum = rgbaNum(char.color);
  var skillGrad = slotGradient(ctx, bx, ssy, sl, sl, sCnum);
  ctx.fillStyle = skillGrad || 'rgba(' + sCnum + ',0.12)';
  roundedFill(ctx, bx, ssy, sl, sl, 5);
  // icono centrado
  ctx.font = 'bold 13px system-ui'; ctx.textAlign = 'center';
  ctx.fillStyle = (cd >= 1 || rt > 0) ? char.color : '#9a9a9a';
  ctx.shadowColor = char.color; ctx.shadowBlur = (cd >= 1) ? (6 + 10 * rt) : 0;
  ctx.fillText(char.skillIcon, bx + sl / 2, vyBaseline(ctx, 'bold 13px system-ui', ssy, sl));
  ctx.shadowBlur = 0; ctx.textAlign = 'left';
  // anillo de progreso (se completa con el cooldown): base atenuada + aro de avance
  var rcx = bx + sl / 2, rcy = ssy + sl / 2, rrad = sl / 2 + 1, rstart = -Math.PI / 2;
  ctx.globalAlpha = 0.9; ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(' + sCnum + ',0.18)'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(rcx, rcy, rrad, 0, Math.PI * 2); ctx.stroke();
  // glow atenuado mientras carga, pleno + pulso al listo
  var ren = rstart + (cd >= 1 ? Math.PI * 2 : Math.max(0.06, cd * Math.PI * 2));
  ctx.strokeStyle = cd >= 1 ? char.color : 'rgba(' + sCnum + ',' + (0.4 + rt * 0.4).toFixed(2) + ')';
  ctx.lineWidth = cd >= 1 ? 3 : 2.5;
  ctx.shadowColor = char.color; ctx.shadowBlur = cd >= 1 ? (8 + 14 * rt) : 2.5;
  ctx.beginPath(); ctx.arc(rcx, rcy, rrad, rstart, ren); ctx.stroke();
  ctx.shadowBlur = 0; ctx.globalAlpha = 1; ctx.lineCap = 'butt';
  // texto a la derecha (aprovecha el ancho sobrante): CD/LISTO + nombre truncado
  var tx = bx + sl + 8;
  var maxTxt = pw - (sl + 14);
  ctx.font = 'bold 8px system-ui';
  ctx.fillStyle = cd >= 1 ? char.color : '#aaa';
  ctx.fillText(cd >= 1 ? 'LISTO' : 'CD ' + Math.ceil(player.specialCd) + 's', tx, ssy + 8);
  ctx.font = 'bold 7px system-ui';
  ctx.fillStyle = cd >= 1 ? char.color : '#ddd';
  var fitted = truncateToWidth(ctx, char.skillName, 'bold 7px system-ui', maxTxt);
  ctx.fillText(fitted, tx, ssy + 16);
  ctx.shadowBlur = 0;

  };

  NV.drawSlotRow = drawSlotRow;

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


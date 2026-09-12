// ===== ENGINE: IA de daño (cálculo de críticos enemigos y daño recibido por el jugador) =====
// Funciones puras de cálculo. Reciben el estado que necesitan (wave/player/CHARACTERS + la fn de
// crítico y de cálculo de daño) en lugar de usar closures del monolito.
(() => {
  'use strict';
  const NV = window.NV;

  // Crit: la "suerte" del jugador baja la chance de crítico enemigo.
  NV.enemyCritChance = function (wave, player) {
    return Math.max(0.05, Math.min(0.35, 0.10 + wave * 0.018 - player.luck * 0.0008));
  };

  NV.calcEnemyDamage = function (base, enemyCritChanceFn) {
    const crit = Math.random() < enemyCritChanceFn();
    return { dmg: crit ? Math.round(base * 1.6) : base, crit };
  };

  NV.characterDodgeChance = function (char) {
    if (!char) return 0;
    if (char.passiveId === 'swarm_dodge') return 0.15;
    return char.dodge || 0;
  };

  NV.characterTakeDmgMult = function (char) {
    if (!char) return 1;
    if (char.passiveId === 'nova_glass_cannon') return 1.2;
    if (char.passiveId === 'rook_tank') return 0.85;
    return char.takeDmgMult || 1;
  };

  // Cálculo de daño recibido. Defaults conservan el combate histórico de proyectiles/contacto:
  // esquiva y crítico habilitados. Hazards pueden deshabilitarlos explícitamente.
  NV.computePlayerHit = function (base, st) {
    const char = st.CHARACTERS[st.player.character];
    const allowDodge = st.allowDodge !== false;
    const allowCrit = st.allowCrit !== false;
    // Esquiva: pasiva del personaje + mejora permanente (+0.4%/nivel).
    const dodge = NV.characterDodgeChance(char) + (st.player.permDodge || 0) * NV.BALANCE.DODGE_PERM_CHANCE;
    if (allowDodge && dodge > 0 && Math.random() < dodge) {
      return { dodged: true };
    }
    const c = allowCrit ? st.calcEnemyDamage(base) : { dmg: base, crit: false };
    let dmg = Math.max(1, c.dmg - st.player.armor);
    const mult = NV.characterTakeDmgMult(char);
    dmg = Math.max(1, Math.round(dmg * mult));
    return { dodged: false, dmg, crit: c.crit };
  };

  // Única autoridad de APLICACIÓN de daño al jugador. El cálculo permanece puro arriba;
  // esta función resuelve invulnerabilidad, HP y feedback/hook compartido.
  NV.applyPlayerDamage = function (baseDamage, st) {
    st = st || {};
    const player = st.player;
    const cause = st.cause || 'unknown';
    if (!player) return { applied: false, dodged: false, crit: false, damage: 0, killed: false, cause, reason: 'no-player' };
    if (st.respectInvulnerability !== false && player.invuln > 0) {
      return { applied: false, dodged: false, crit: false, damage: 0, hpBefore: player.hp, hpAfter: player.hp, killed: player.hp <= 0, cause, reason: 'invulnerable' };
    }
    const hit = NV.computePlayerHit(baseDamage, {
      player,
      CHARACTERS: st.CHARACTERS,
      calcEnemyDamage: st.calcEnemyDamage,
      allowCrit: st.allowCrit,
      allowDodge: st.allowDodge,
    });
    if (hit.dodged) {
      if (st.addFloatText) st.addFloatText(player.x, player.y - 20, 'ESQUIVA', '#8dfaff');
      return { applied: false, dodged: true, crit: false, damage: 0, hpBefore: player.hp, hpAfter: player.hp, killed: false, cause, reason: 'dodged' };
    }
    const damage = hit.dmg;
    const hpBefore = player.hp;
    player.hp -= damage;
    const result = {
      applied: true, dodged: false, crit: !!hit.crit, damage,
      hpBefore, hpAfter: player.hp, killed: player.hp <= 0, cause,
    };
    if (st.addFloatText) {
      const style = NV.damageFloatStyle ? NV.damageFloatStyle(damage, !!hit.crit) : { color: hit.crit ? '#FF2A4B' : '#FFFFFF', size: hit.crit ? 17 : 13 };
      st.addFloatText(player.x, player.y - 20, '-' + damage, style.color, style.size);
    }
    if (st.onPlayerDamaged) st.onPlayerDamaged(Object.assign({}, st.event || {}, result));
    if (st.sfx && st.sfx.playerHit && !result.killed) st.sfx.playerHit();
    return result;
  };
})();
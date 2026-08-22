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

  // Daño que recibe el jugador: crítica → armadura (plano) → pasiva del personaje → esquiva.
  NV.computePlayerHit = function (base, st) {
    const char = st.CHARACTERS[st.player.character];
    if ((char.dodge || 0) > 0 && Math.random() < char.dodge) {
      return { dodged: true };
    }
    const c = st.calcEnemyDamage(base);
    let dmg = Math.max(1, c.dmg - st.player.armor);
    const mult = char.takeDmgMult || 1;
    dmg = Math.max(1, Math.round(dmg * mult));
    return { dodged: false, dmg, crit: c.crit };
  };
})();
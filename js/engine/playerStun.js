// ===== ENGINE: stun del jugador (F4) — aplicación central y anti-stunlock =====
// Autoridad ÚNICA de aplicación de stun al jugador. No es un framework de
// estados: es UN helper con UN lockout escalar (player.stunReapplyLockout).
// Reglas:
//  - El roll de chance ocurre aquí y SOLO aquí: ningún impacto lo duplica.
//  - Sin stack aditivo: si ya hay stun, el nuevo duration SOLO aplica si es
//    mayor que el restante; nunca suma duraciones.
//  - Anti-stunlock: tras un stun exitoso, PLAYER_STUN_REAPPLY_LOCKOUT bloquea
//    cualquier reintento (de cualquier fuente) sin extender stun.
//  - El stun NO concede invulnerabilidad: el daño del ataque que stunea (y de
//    cualquier otro) sigue aplicando por el pipeline central con normalidad.
//  - O(1): sin arrays, sin búsquedas, sin setTimeout. Los timers (stun y
//    reapply lockout) se ticlean por dt en game.js; pausa los congela.
(() => {
  'use strict';
  const NV = window.NV;

  NV.tryApplyPlayerStun = function (player, duration, chance, source, ctx) {
    ctx = ctx || {};
    const result = { applied: false, blocked: false, reason: null, duration: 0 };
    if (!player) { result.reason = 'no-player'; return result; }
    const dur = Number(duration);
    if (!Number.isFinite(dur) || dur <= 0) { result.reason = 'invalid-duration'; return result; }
    const ch = Number(chance) || 0;
    if (!(ch > 0)) { result.reason = 'no-stun-source'; return result; }
    const rand = ctx.random || Math.random;
    if (!(rand() < ch)) { result.reason = 'roll-failed'; return result; }
    if ((player.stunReapplyLockout || 0) > 0) {
      result.blocked = true;
      result.reason = 'reapply-lockout';
      return result;
    }
    // Sin stack: solo extiende al duration entrante si es mayor que el restante.
    const current = Number.isFinite(player.stun) ? Math.max(0, player.stun) : 0;
    player.stun = Math.max(current, dur);
    player.stunReapplyLockout = NV.BALANCE.PLAYER_STUN_REAPPLY_LOCKOUT;
    result.applied = true;
    result.duration = player.stun;
    if (ctx.addFloatText) ctx.addFloatText(player.x, player.y - 30, 'STUN', '#ff0');
    return result;
  };
})();
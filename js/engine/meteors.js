// ===== ENGINE: meteoritos (habilidad Lluvia Estelar de BOTI) =====
// updateMeteors mueve/impacta meteoros. Depende de H, enemies/boss por ref, y callbacks
// (killEnemy, applyKnockback, spawnExplosion). Devuelve {meteors, shake} porque ambos
// se reasignan en game.js.
(() => {
  'use strict';
  const NV = window.NV;

  NV.updateMeteors = function (dt, meteors, ctxState, cbs) {
    const { H, enemies, boss } = ctxState;
    const { killEnemy, applyKnockback, spawnExplosion } = cbs;
    let shake = ctxState.shake || 0;
    if (meteors.length === 0) return { meteors, shake };
    for (const m of meteors) {
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      if (m.y > H + 20) { m.dead = true; continue; }
      // Impacto
      for (const e of enemies) {
        if (e.dead) continue;
        const d = Math.hypot(e.x - m.x, e.y - m.y);
        if (d < m.radius + e.radius) {
          e.hp -= 40;
          if (e.hp <= 0) killEnemy(e);
          applyKnockback(e, m.x, m.y, 150);
        }
      }
      if (boss && !boss.dead) {
        const d = Math.hypot(boss.x - m.x, boss.y - m.y);
        if (d < m.radius + boss.radius) { boss.hp -= 30; boss.hitFlash = 0.2; }
      }
      if (m.y > H - 20) {
        m.dead = true;
        spawnExplosion(m.x, m.y, 8, m.color, 0.4);
        shake = Math.max(shake, 0.1);
      }
    }
    return { meteors: meteors.filter((m) => !m.dead), shake };
  };
})();
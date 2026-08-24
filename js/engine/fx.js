// ===== ENGINE: efectos visuales / FX (partículas, textos flotantes, estelas) =====
// Funciones de efecto que operan sobre sus arrays y los devuelven (los que filter)
// o mutan por referencia (los que push). game.js las llama vía wrappers locales.
(() => {
  'use strict';
  const NV = window.NV;

  // Empuja partículas de explosión al array (lo recibe por referencia; no lo reasigna).
  NV.spawnExplosion = function (particles, MAX_PARTICLES, x, y, count, color, speedMult) {
    for (let i = 0; i < count && particles.length < MAX_PARTICLES; i++) {
      const a = (i / count) * Math.PI * 2;
      particles.push({ x, y, vx: Math.cos(a) * 300 * speedMult, vy: Math.sin(a) * 300 * speedMult, life: 1, color });
    }
  };

  // Actualiza posiciones y vida de las partículas; devuelve el array filtrado.
  NV.updateParticles = function (dt, particles) {
    for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
    return particles.filter((p) => p.life > 0);
  };

  // Empuja un texto flotante al array (por referencia).
  NV.addFloatText = function (floatTexts, x, y, text, color) {
    floatTexts.push({ x, y, text, color, life: 0.8 });
  };

  // Actualiza los textos flotantes; devuelve el array filtrado.
  NV.updateFloatTexts = function (dt, floatTexts) {
    for (const ft of floatTexts) { ft.y -= 60 * dt; ft.life -= dt; }
    return floatTexts.filter((ft) => ft.life > 0);
  };

  // Actualiza las estelas; devuelve el array filtrado.
  NV.updateTrails = function (dt, trails) {
    for (const t of trails) { t.life -= dt; t.size *= 0.9; }
    return trails.filter((t) => t.life > 0);
  };

  // ---- Shockwave reutilizable (onda expansiva radial): ROOK, detonación de NOVA, futuros FX ----
  // spawnShockwave(shockwaves, x, y, opts) — opts: { maxRadius, color, width }
  NV.spawnShockwave = function (shockwaves, x, y, opts) {
    const o = opts || {};
    shockwaves.push({ x, y, life: 1, maxRadius: o.maxRadius || 130, color: o.color || '#ffcf76', width: o.width || 5 });
  };

  // Avanza la vida de cada onda; devuelve el array filtrado.
  NV.updateShockwaves = function (dt, shockwaves) {
    if (!shockwaves) return [];
    for (const s of shockwaves) s.life -= dt * 2.2; // ~0.45s de expansión con easing rápido
    return shockwaves.filter((s) => s.life > 0);
  };
})();
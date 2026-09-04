// ===== ENGINE: efectos visuales / FX (partículas, textos flotantes, estelas) =====
// Funciones de efecto que operan sobre sus arrays y los devuelven (los que filter)
// o mutan por referencia (los que push). game.js las llama vía wrappers locales.
(() => {
  'use strict';
  const NV = window.NV;

  // ---- Pool de partículas: elimina la presión de GC cuando mueren grupos ----
  // grandes de enemigos a la vez. Los objetos muertos se reciclan en lugar de
  // ser recolectados; el pool tiene tope para acotar la memoria en el peor caso.
  const PARTICLE_POOL = [];
  const PARTICLE_POOL_MAX = 512;
  NV.particlePoolSize = function () { return PARTICLE_POOL.length; };

    // Presupuesto de explosión (optimización sin perder la dirección de arte):
  //  - count ×0.7  → ~30% menos partículas por estallido.
  //  - speed ×0.65 → radio de la onda ~35% más corto.
  //  - life 0.75   → ~25% menos vida; el alpha decae más rápido (fadeSpeed).
  //  - size 1.5-3  → partículas restantes más finas/nítidas (antes 4px fijos).
  NV.spawnExplosion = function (particles, MAX_PARTICLES, x, y, count, color, speedMult) {
    const n = Math.max(3, Math.round((count || 0) * 0.7));
    const sm = speedMult || 1;
    for (let i = 0; i < n && particles.length < MAX_PARTICLES; i++) {
      const a = (i / n) * Math.PI * 2;
      const sp = 195 * sm * (0.6 + Math.random() * 0.4); // velocidad variable: estallido más orgánico
      const p = PARTICLE_POOL.length ? PARTICLE_POOL.pop() : {};
      p.x = x; p.y = y;
      p.vx = Math.cos(a) * sp;
      p.vy = Math.sin(a) * sp;
      p.life = 0.75;
      p.fade = 0.45 + Math.random() * 0.3;  // fadeSpeed individual (alpha = life/fade)
      p.size = 1.5 + Math.random() * 1.5;   // partícula fina
      p.color = color;
      particles.push(p);
    }
    // --- PISTILLO DE TINTA DE MUERTE (Pilar 2A): micro-partículas finas del color del enemigo ---
    const inkCount = Math.min(12, Math.max(4, Math.floor((count || 0) * 0.5)));
    for (let i = 0; i < inkCount && particles.length < MAX_PARTICLES; i++) {
      const a = (i / inkCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.6;
      const sp = 80 * sm * (0.4 + Math.random() * 0.4);
      const p = PARTICLE_POOL.length ? PARTICLE_POOL.pop() : {};
      p.x = x; p.y = y;
      p.vx = Math.cos(a) * sp;
      p.vy = Math.sin(a) * sp;
      p.life = 0.25;           // ~250ms — rápido decay de tinta
      p.fade = 0.6 + Math.random() * 0.3;
      p.size = 2 + Math.random() * 2;   // gota de tinta pequeña
      p.color = color;
      particles.push(p);
    }
  };

  // Actualiza posiciones y vida; compactación IN-PLACE (cero allocations por
  // frame) y las partículas muertas vuelven al pool. Devuelve el mismo array.
  NV.updateParticles = function (dt, particles) {
    let w = 0;
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96; p.vy *= 0.96; // fricción: acota el radio efectivo de la onda
      p.life -= dt;
      if (p.life > 0) { particles[w++] = p; }
      else if (PARTICLE_POOL.length < PARTICLE_POOL_MAX) { PARTICLE_POOL.push(p); }
    }
    particles.length = w;
    return particles;
  };

  // Empuja un texto flotante al array (por referencia). size opcional en px.
  NV.addFloatText = function (floatTexts, x, y, text, color, size) {
    floatTexts.push({ x, y, text, color, life: 0.8, size: size || 14 });
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
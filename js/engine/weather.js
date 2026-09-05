// ===== ENGINE: clima / weather de oleada =====
// Gestiona los efectos ambientales (nubes, minas estáticas, niebla densa) que se
// superponen al clima base (starfield). Se apoya en el sistema de waveEvent ya
// existente: cada oleada con evento activa un "clima" visual + mecánico propio.
// - fog    : nubes de niebla densa + velo oscuro (mejora el existente).
// - mines  : minas estáticas en el suelo que dañan al jugador al pisarlas.
// - elites : zonas de energía élite (marcadores visuales de spawn).
// - payday : chispas de bonificación (zonas doradas).
(() => {
  'use strict';
  const NV = window.NV;

  const weather = {
    type: null,
    zones: [],
    mines: [],
    fogIntensity: 0,
    bgTint: null,
    time: 0,
  };
  NV.weather = weather;

  function rand(min, max) { return min + Math.random() * (max - min); }

  function zoneColor(type) {
    switch (type) {
      case 'fog':    return { r: 190, g: 190, b: 210 };
      case 'mines':  return { r: 255, g: 95,  b: 155 };
      case 'elites': return { r: 255, g: 215, b: 0 };
      case 'payday': return { r: 124, g: 248, b: 255 };
      default:       return { r: 124, g: 248, b: 255 };
    }
  }

  function illuminationFor(type, musicTrack) {
    let r = 1, g = 3, b = 13, a = 0;
    if (type === 'fog')    { a = 0.10; r = 60; g = 50; b = 90; }
    else if (type === 'mines')  { a = 0.06; r = 80; g = 20; b = 50; }
    else if (type === 'elites') { a = 0.06; r = 70; g = 55; b = 10; }
    else if (type === 'payday') { a = 0.05; r = 40; g = 60; b = 30; }
    if (musicTrack === 1) { r += 10; g += 4; b -= 4; }
    return { r, g, b, a };
  }

  NV.initWeather = function (type, W, H) {
    weather.type = type || null;
    weather.zones = [];
    weather.mines = [];
    weather.fogIntensity = 0;
    weather.time = 0;
    weather.bgTint = illuminationFor(weather.type, NV.musicTrack);
    if (!type) return;
    const zoneCount = 6;
    for (let i = 0; i < zoneCount; i++) {
      const c = zoneColor(type);
      weather.zones.push({
        x: rand(0, W), y: rand(0, H), r: rand(70, 150),
        vx: rand(-18, 18), vy: rand(-12, 12),
        alpha: rand(0.05, 0.13), col: c, phase: rand(0, Math.PI * 2),
      });
    }
    if (type === 'mines') {
      const mineCount = 5 + Math.floor(Math.random() * 4);
      for (let i = 0; i < mineCount; i++) {
        weather.mines.push({
          x: rand(50, W - 50), y: rand(70, H - 70), r: 13,
          active: true, pulse: rand(0, Math.PI * 2),
        });
      }
    }
    if (type === 'fog') weather.fogIntensity = 1;
  };

  NV.updateWeather = function (dt, player, st) {
    weather.time += dt;
    const W = st && st.W, H = st && st.H;
    for (const z of weather.zones) {
      z.x += z.vx * dt; z.y += z.vy * dt;
      if (z.x < -z.r) z.x = W + z.r;
      if (z.x > W + z.r) z.x = -z.r;
      if (z.y < -z.r) z.y = H + z.r;
      if (z.y > H + z.r) z.y = -z.r;
    }
    if (weather.mines.length && player && st && st.computePlayerHit) {
      for (const m of weather.mines) {
        if (!m.active) continue;
        const d = Math.hypot(player.x - m.x, player.y - m.y);
        if (d < m.r + 16) {
          m.active = false;
          st.computePlayerHit(22);
          if (st.spawnExplosion) st.spawnExplosion(m.x, m.y, 26, '#ff5f9b', 0.7);
          if (typeof st.shake === 'number') st.shake = Math.max(st.shake, 0.25);
        }
      }
    }
  };

  // Dibuja el clima (sobre el fondo base, debajo de entidades)
  NV.drawWeather = function (ctx, W, H) {
    if (!weather.type) return;
    for (const z of weather.zones) {
      const pulse = 0.85 + 0.15 * Math.sin(weather.time * 1.5 + z.phase);
      const a = z.alpha * pulse;
      const g = ctx.createRadialGradient(z.x, z.y, 0, z.x, z.y, z.r);
      g.addColorStop(0, `rgba(${z.col.r},${z.col.g},${z.col.b},${a})`);
      g.addColorStop(1, `rgba(${z.col.r},${z.col.g},${z.col.b},0)`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2); ctx.fill();
    }
    if (weather.type === 'fog' && weather.fogIntensity > 0) {
      ctx.save();
      ctx.fillStyle = `rgba(8, 10, 22, ${0.32 * weather.fogIntensity})`;
      ctx.fillRect(0, 0, W, H);
      const px = NV.getPlayer ? NV.getPlayer().x : W / 2;
      const py = NV.getPlayer ? NV.getPlayer().y : H / 2;
      const rx = W * 0.3, ry = H * 0.35;
      const grad = ctx.createRadialGradient(px, py, Math.min(rx, ry) * 0.4, px, py, Math.max(W, H) * 0.75);
      grad.addColorStop(0, 'rgba(8, 10, 22, 0)');
      grad.addColorStop(1, `rgba(8, 10, 22, ${0.85 * weather.fogIntensity})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
    if (weather.mines.length) {
      for (const m of weather.mines) {
        if (!m.active) continue;
        const pulse = 0.5 + 0.5 * Math.sin(weather.time * 4 + m.pulse);
        ctx.save();
        ctx.translate(m.x, m.y);
        ctx.shadowBlur = 12; ctx.shadowColor = '#ff5f9b';
        ctx.fillStyle = `rgba(255,95,155,${0.25 + 0.25 * pulse})`;
        ctx.beginPath(); ctx.arc(0, 0, m.r + 4, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = `rgba(255,95,155,${0.7 + 0.3 * pulse})`;
        ctx.beginPath();
        ctx.moveTo(0, -m.r); ctx.lineTo(m.r, 0); ctx.lineTo(0, m.r); ctx.lineTo(-m.r, 0);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    }
  };

  NV.clearWeather = function () {
    weather.type = null; weather.zones = []; weather.mines = [];
    weather.fogIntensity = 0; weather.bgTint = null; weather.time = 0;
  };

  NV.refreshWeatherIllumination = function () {
    weather.bgTint = illuminationFor(weather.type, NV.musicTrack);
  };
})();
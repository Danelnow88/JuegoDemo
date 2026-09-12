// ===== ENGINE: telemetría de playtest (F08 gate humano) =====
// Diagnóstico AGREGADO y MUESTREADO para la primera puerta de playtest humano.
// Reglas de diseño:
//  - OFF por defecto: cada punto de integración es un guard booleano
//    (`if (NV.playtest ...)`), cero coste medible en producción normal.
//  - Se activa con `?playtest=1` (game.js init) o desde consola con
//    `NV.playtest.enable()`. Se desactiva con `NV.playtest.disable()`.
//  - Sin console spam, sin DOM, sin allocations por frame (WeakMap para
//    detectar transiciones de intent sin mutar entidades de gameplay).
//  - `NV.playtest.snapshot()` devuelve un objeto plano para pegar en un issue.
//  - Módulo independiente: el juego funciona idéntico sin este archivo
//    (todos los consumers hacen guard `if (NV.playtest ...)`).
(() => {
  'use strict';
  const NV = window.NV = window.NV || {};
  let enabled = false;
  let data = null;

  function fresh() {
    return {
      frames: 0,
      dash: { attempted: 0, succeeded: 0, failed: 0, exhaustedFrames: 0 },
      combat: { shots: 0, hits: 0, pierce2Plus: 0, maxHitsPerBullet: 0, fireMode: null },
      runner: { stateTime: {}, commits: 0 },
      spitter: { stateTime: {}, windups: 0, shots: 0, recoveryCycles: 0 },
    };
  }
  function bump(map, key, dt) { map[key] = (map[key] || 0) + dt; }
  let prevStates = new WeakMap(); // identidad de enemigo -> último estado de intent (solo lectura de e)

  NV.playtest = {
    get enabled() { return enabled; },
    enable() { enabled = true; },
    disable() { enabled = false; },
    reset() { data = fresh(); prevStates = new WeakMap(); },
    // --- eventos de dash (movement.js) ---
    dashEvent(kind) {
      if (!enabled) return;
      if (kind === 'succeeded' || kind === 'failed') {
        data.dash.attempted++;
        data.dash[kind]++;
      }
    },
    setExhaustedFrame() { if (enabled) data.dash.exhaustedFrames++; },
    // --- eventos de combate (game.js / bullets.js) ---
    setFireMode(mode) { if (enabled) data.combat.fireMode = mode || null; },
    shot() { if (enabled) data.combat.shots++; },
    bulletHit(hitCount) {
      if (!enabled) return;
      data.combat.hits++;
      if (hitCount > data.combat.maxHitsPerBullet) data.combat.maxHitsPerBullet = hitCount;
      if (hitCount >= 2) data.combat.pierce2Plus++; // balas que atravesaron 2+ objetivos (alineación Rifle)
    },
    // --- muestreo de intents Runner/Spitter (game.js, 1 llamada por enemigo/frame) ---
    observeEnemy(e, dt) {
      if (!enabled || !e || e.dead || !e.intent) return;
      const s = e.intent.state;
      const prev = prevStates.get(e);
      if (e.behavior === 'flank') {
        bump(data.runner.stateTime, s, dt);
        if (prev === 'attack' && s !== 'attack') data.runner.commits++; // COMMIT -> RECOVERY completado
      } else if (e.behavior === 'ranged') {
        bump(data.spitter.stateTime, s, dt);
        if (prev !== 'windup' && s === 'windup') data.spitter.windups++;
        if (prev === 'windup' && s !== 'windup') data.spitter.shots++; // windup -> disparo único
        if (prev === 'recovery' && s !== 'recovery') data.spitter.recoveryCycles++;
      }
      prevStates.set(e, s);
    },
    frame() { if (enabled) data.frames++; },
    snapshot() { return JSON.parse(JSON.stringify(data)); },
  };
  NV.playtest.reset();
})();
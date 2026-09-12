// ===== RENDER: visual budget (P2 Performance Foundation) =====
// Política de calidad visual runtime. COMPLETAMENTE SEPARADA del presupuesto
// autoritativo de hostiles: NUNCA decide spawns, daño, cadencia, cantidad de
// proyectiles, HP, velocidad, AI, cooldowns ni hitboxes. SOLO calidad decorativa.
//
// Autoridad = preferencia del usuario (NV.settings.graphics.quality):
//   high        → tier runtime 'full' (solo protección de emergencia decorativa)
//   auto        → tier runtime 'full' con auto-quality por histéresis
//   performance → tier runtime 'reduced' fijo
// El tier runtime NO se persiste: nunca sobrescribe la preferencia guardada.
(() => {
  'use strict';
  const NV = window.NV = window.NV || {};

  // Histéresis (ms de p95 de frame). Bajar relativamente rápido si hay overload
  // sostenido; recuperar mucho más lento; un spike aislado no reacciona.
  // Evaluación externa a ~2 Hz (500ms). Ventanas en nº de evaluaciones.
  const OVERLOAD_P95 = 20;      // auto: p95 sostenido por encima → degradar
  const EMERGENCY_P95 = 26.5;   // high: overload serio → protección de emergencia
  const RECOVERY_P95 = 14.5;    // p95 sostenido por debajo → recuperar
  const DOWNGRADE_STREAK = 4;   // ~2s de overload → bajar un tier
  const EMERGENCY_STREAK = 2;   // ~1s de overload serio en 'high'
  const RECOVERY_STREAK = 16;   // ~8s sanos → subir un tier

  function preference() {
    return (NV.settings && NV.settings.graphics && NV.settings.graphics.quality) || 'high';
  }
  function baseTier(q) { return q === 'performance' ? 'reduced' : 'full'; }
  function floorTier(q) { return q === 'high' ? 'reduced' : 'minimal'; }

  // Pocos controles semánticos; los consumidores son decorativos.
  function policyFor(tier, reason) {
    const g = (NV.settings && NV.settings.graphics) || {};
    return {
      tier,
      reason,
      preference: q_(g.quality),
      // Hidras con modelo completo: fracción máxima del candidato más cercano.
      spectralDetail: tier === 'full' ? 1 : (tier === 'reduced' ? 0.5 : 0),
      // Partículas decorativas (pistillo de tinta, sparks secundarios).
      decorativeParticleScale: (!g.particles || tier === 'minimal') ? 0 : (tier === 'reduced' ? 0.5 : 1),
      // Glows y sombras caras no esenciales para legibilidad.
      secondaryGlow: !!g.heavyVfx && tier === 'full',
      heavyShadow: !!g.heavyVfx && tier === 'full',
      // Densidad de estelas (jugador/meteoros): 1, 1/2, 1/4 de frecuencia.
      trailDensity: tier === 'full' ? 1 : (tier === 'reduced' ? 0.5 : 0.25),
      // Ondas expansivas secundarias (la principal de cada evento se conserva).
      secondaryShockwaves: !!g.heavyVfx && tier !== 'minimal',
      // Capa rítmica de fondo: 1 = cada frame, 0.5 = cada 2, 0.25 = cada 4.
      rhythmBackgroundDetail: tier === 'full' ? 1 : (tier === 'reduced' ? 0.5 : 0.25),
    };
  }
  function q_(q) { return q === 'auto' || q === 'performance' ? q : 'high'; }

  let tier = baseTier(preference());
  let reason = 'preference';
  let downStreak = 0, emergencyStreak = 0, recoverStreak = 0;
  let policy = policyFor(tier, reason);

  NV.getVisualBudget = function () { return policy; };

  // Evaluación de baja frecuencia con el p95 de frame real del monitor.
  NV.updateVisualBudget = function (p95FrameMs) {
    const q = preference();
    if (q === 'performance') {
      // Preferencia mínima: fija, sin auto-quality encima.
      tier = 'reduced'; reason = 'preference';
      downStreak = emergencyStreak = recoverStreak = 0;
      policy = policyFor(tier, reason);
      return policy;
    }
    if (!Number.isFinite(p95FrameMs)) { policy = policyFor(tier, reason); return policy; }
    const healthy = p95FrameMs <= RECOVERY_P95;
    const serious = p95FrameMs >= EMERGENCY_P95;
    const overloaded = p95FrameMs >= OVERLOAD_P95;
    recoverStreak = healthy ? recoverStreak + 1 : 0;

    if (q === 'high') {
      // Máxima calidad como intención. Solo sacrificio decorativo en overload serio.
      emergencyStreak = serious ? emergencyStreak + 1 : 0;
      downStreak = 0;
      if (tier === 'full' && emergencyStreak >= EMERGENCY_STREAK) {
        tier = 'reduced'; reason = 'emergency'; recoverStreak = 0;
      } else if (tier === 'reduced' && reason === 'emergency' && recoverStreak >= RECOVERY_STREAK) {
        tier = 'full'; reason = 'preference'; recoverStreak = 0;
      }
    } else { // auto
      downStreak = overloaded ? downStreak + 1 : 0;
      emergencyStreak = serious ? emergencyStreak + 1 : 0;
      if (overloaded && downStreak >= DOWNGRADE_STREAK && tier !== floorTier(q)) {
        tier = tier === 'full' ? 'reduced' : 'minimal';
        reason = 'auto'; downStreak = 0; recoverStreak = 0;
      } else if (healthy && recoverStreak >= RECOVERY_STREAK && tier !== baseTier(q)) {
        tier = tier === 'minimal' ? 'reduced' : 'full';
        reason = tier === 'full' ? 'preference' : 'auto';
        recoverStreak = 0;
      }
    }
    policy = policyFor(tier, reason);
    return policy;
  };

  // Reset del estado runtime (no persiste nada): vuelve al tier de la preferencia.
  NV.resetVisualBudget = function () {
    tier = baseTier(preference()); reason = 'preference';
    downStreak = emergencyStreak = recoverStreak = 0;
    policy = policyFor(tier, reason);
  };
  // La preferencia del usuario siempre gana: un cambio de settings resetea el runtime.
  if (typeof NV.onSettingsChange === 'function') NV.onSettingsChange(() => NV.resetVisualBudget());
})();

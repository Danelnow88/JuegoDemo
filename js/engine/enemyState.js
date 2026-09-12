// ===== ENGINE: vocabulario mínimo de intent/estado para enemigos =====
// ===== ENGINE: enemy state/intent foundation (FEATURE 05) =====
// Minimal reusable vocabulary so future enemies can express
// positioning / windup / attack / recovery without bespoke hacks.
// Separates WHAT an enemy wants (intent/state) from HOW velocity
// is reached (steering). Not every enemy needs every state; legacy
// enemies are untouched unless they explicitly adopt the vocabulary.
//
// Architecture rules (FEATURE 05):
//  - Intent/state is cheap per-enemy and per-frame (no O(n^2)).
//  - State persists across frames with explicit timers/flags.
//  - No per-frame random side/offset jitter in the model.
//  - Helpers exist only where they reduce bespoke math for multiple
//    future enemies (range band, flank, retreat, etc.).
//  - Legacy AI/bosses are preserved; this is NOT a conversion.

(() => {
  'use strict';
  const NV = window.NV;

  // ---- Shared state vocabulary (conceptual) ----
  const STATE = {
    IDLE: 'idle',
    POSITIONING: 'positioning',
    WINDUP: 'windup',
    ATTACK: 'attack',
    RECOVERY: 'recovery',
    RETREAT: 'retreat',
  };

  // ---- Cheap helpers (only added where they reduce bespoke math) ----

  // Squared distance for range-band decisions without Math.sqrt when
  // only comparison against a radius is needed.
  function distSq(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
  }

  // Preferred range band: returns how far the enemy WANTS to be from
  // the reference point. Default flows through `e.preferredRange`; if
  // absent, returns null to signal "no preference expressed".
  function preferredRangeOf(e) {
    if (e == null || !isFinite(e.preferredRange)) return null;
    return e.preferredRange;
  }

  // Returns true when the enemy is within its preferred band relative
  // to `ref`. Settled semantics: inside means distance <= preferredRange.
  function inPreferredBand(e, ref) {
    const r = preferredRangeOf(e);
    if (r == null) return false;
    return distSq(e, ref) <= r * r;
  }

  // Flank offset: lateral offset from the direct line to `ref`.
  // A future enemy can set `e.flankOffset` and this resolves a
  // concrete target point without baking per-enemy math.
  function flankTargetOf(e, ref) {
    if (e == null || !isFinite(e.flankOffset)) return null;
    const dx = e.x - ref.x;
    const dy = e.y - ref.y;
    const d = Math.hypot(dx, dy);
    if (d < 1e-6) return null;
    const px = -dy / d;
    const py = dx / d;
    return { x: e.x + px * e.flankOffset, y: e.y + py * e.flankOffset };
  }

  // Retreat vector: a simple flight-from-target direction.
  function retreatVectorFrom(e, ref, out) {
    const dx = e.x - ref.x;
    const dy = e.y - ref.y;
    const d = Math.hypot(dx, dy);
    if (d < 1e-6) {
      if (out) { out.x = 0; out.y = 0; return out; }
      return { x: 0, y: 0 };
    }
    const inv = 1 / d;
    if (out) { out.x = dx * inv; out.y = dy * inv; return out; }
    return { x: dx * inv, y: dy * inv };
  }

  // Separation contribution hint. Lightweight; real separation loops
  // remain in updateEnemies where they can reuse the existing grid pass.
  function separationContributionCandidate(e, others, radius) {
    return { candidate: e, radius: radius == null ? e.radius : radius };
  }

  // Attack-state movement lock/reduction: an explicit factor so an
  // attack phase can reduce or freeze movement without each behavior
  // reimplementing the same clamp (1 = full, 0 = locked).
  function attackMovementFactor(e) {
    if (e == null || e.attackMoveLock == null) return 1;
    return Math.max(0, Math.min(1, e.attackMoveLock));
  }

  // ---- Default intent initializer ----
  // Future enemies call this to get a baseline intent object they then
  // customize. Legacy enemies do NOT automatically get this attached.
  function createEnemyIntent(e) {
    return {
      state: STATE.IDLE,
      phaseUntil: null,
      stateTimer: 0,
      preferredRange: null,
      flankOffset: null,
      retreatTarget: null,
      attackLocked: false,
      desiredVelocity: null,
      movementFactor: 1,
    };
  }

  // ---- Intent/state tick ----
  // Cheap per-enemy update. Only enemies that opted into shared intent
  // have `e.intent`; others are skipped safely.
  function updateEnemyIntent(e, dt) {
    if (!e || !e.intent) return;
    const intent = e.intent;
    if (intent.stateTimer != null) {
      intent.stateTimer -= dt;
      if (intent.stateTimer <= 0) intent.stateTimer = 0;
    }
  }

  // ---- Steering helper ----
  // Consumes intent and produces a cheap desired velocity / factor. Does
  // NOT override legacy movement directly; new enemies can delegate to it.
  function computeEnemySteering(e) {
    if (!e || !e.intent) return;
    const intent = e.intent;
    intent.movementFactor = attackMovementFactor(e);
    intent.desiredVelocity = null;
  }

  // ---- Pause/reset support ----
  // State persistence across pauses is explicit: we do NOT clear timers
  // automatically. A pause handler may freeze or drain timers.
  function resetEnemyIntent(e) {
    if (!e || !e.intent) return;
    const intent = e.intent;
    intent.state = STATE.IDLE;
    intent.phaseUntil = null;
    intent.stateTimer = 0;
    intent.attackLocked = false;
    intent.desiredVelocity = null;
    intent.movementFactor = 1;
  }

  NV.enemyState = {
    STATE,
    createIntent: createEnemyIntent,
    updateIntent: updateEnemyIntent,
    computeSteering: computeEnemySteering,
    resetIntent: resetEnemyIntent,

    distSq,
    preferredRangeOf,
    inPreferredBand,
    flankTargetOf,
    retreatVectorFrom,
    attackMovementFactor,
    separationContributionCandidate,
  };
})();

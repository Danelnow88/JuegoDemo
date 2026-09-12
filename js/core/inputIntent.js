// ===== INPUT INTENTS: modelo lógico compartido de combate =====
(() => {
  'use strict';
  const NV = window.NV = window.NV || {};
  const FIRE_POLICIES = Object.freeze(['manual', 'legacy-auto']);

  function normalizeVector(x, y) {
    x = Number(x) || 0;
    y = Number(y) || 0;
    const length = Math.hypot(x, y);
    if (length <= 0.000001) return { x: 0, y: 0, active: false };
    return { x: x / length, y: y / length, active: true };
  }

  function createCombatIntent(firePolicy) {
    return {
      moveX: 0, moveY: 0,
      aimX: 0, aimY: 0,
      aimWorldX: 0, aimWorldY: 0,
      aimActive: false,
      fireIntent: false,
      dashIntent: false,
      abilityIntent: false,
      firePolicy: FIRE_POLICIES.indexOf(firePolicy) >= 0 ? firePolicy : 'manual',
    };
  }

  function setMoveFromButtons(intent, buttons) {
    const x = (buttons.right ? 1 : 0) - (buttons.left ? 1 : 0);
    const y = (buttons.down ? 1 : 0) - (buttons.up ? 1 : 0);
    const v = normalizeVector(x, y);
    intent.moveX = v.x;
    intent.moveY = v.y;
    return intent;
  }

  function setAimWorld(intent, worldX, worldY, originX, originY) {
    const v = normalizeVector(worldX - originX, worldY - originY);
    intent.aimWorldX = worldX;
    intent.aimWorldY = worldY;
    intent.aimX = v.x;
    intent.aimY = v.y;
    intent.aimActive = v.active;
    return intent;
  }

  function effectiveFirePolicy(intent, isMobile) {
    return isMobile ? 'legacy-auto' : (FIRE_POLICIES.indexOf(intent.firePolicy) >= 0 ? intent.firePolicy : 'manual');
  }

  function advanceFireCadence(timer, dt, active, blocked, tryFire, interval, retryInterval) {
    timer -= dt;
    if (!active || blocked || timer > 0) return { timer, fired: false };
    const fired = tryFire() !== false;
    return { timer: fired ? interval : retryInterval, fired };
  }

  NV.inputIntent = {
    FIRE_POLICIES,
    normalizeVector,
    createCombatIntent,
    setMoveFromButtons,
    setAimWorld,
    effectiveFirePolicy,
    advanceFireCadence,
  };
})();
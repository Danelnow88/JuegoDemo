// engine/movement.js — Movimiento controlado del jugador, sin input ni allocations por frame.
(() => {
  'use strict';
  const NV = window.NV;

  function clampLevel(level) {
    level = Number(level);
    if (!Number.isFinite(level)) return 0;
    return Math.max(0, Math.min(NV.BALANCE.MAX_PERM_LEVEL, Math.floor(level)));
  }

  NV.movementPermanentProfile = function (level) {
    level = clampLevel(level);
    return {
      level,
      speedMultiplier: 1 + level * NV.BALANCE.PERM_MOVE_SPEED_PER_LEVEL,
      controlMultiplier: 1 + level * NV.BALANCE.PERM_MOVE_CONTROL_PER_LEVEL,
    };
  };

  NV.configurePlayerMovement = function (player, baseMoveSpeed, permanentLevel) {
    const profile = NV.movementPermanentProfile(permanentLevel);
    player.baseMoveSpeed = Math.max(1, Number(baseMoveSpeed) || 200);
    player.moveSpeedPermanentMult = profile.speedMultiplier;
    player.moveControlPermanentMult = profile.controlMultiplier;
    player.moveSpeedTemporaryMult = 1;
    player.effectiveMoveSpeed = player.baseMoveSpeed * player.moveSpeedPermanentMult;
    // Alias de compatibilidad para HUD/diagnósticos existentes; nunca es fuente base.
    player.speed = player.effectiveMoveSpeed;
    player.acceleration = player.effectiveMoveSpeed / NV.BALANCE.MOVE_ACCEL_TIME;
    player.deceleration = player.effectiveMoveSpeed / NV.BALANCE.MOVE_DECEL_TIME;
    player.turnControl = player.effectiveMoveSpeed / NV.BALANCE.MOVE_TURN_TIME;
    player.reversalControl = (player.effectiveMoveSpeed * 2) / NV.BALANCE.MOVE_REVERSE_TIME;
    player.moveReversing = false;
    player.lastMoveDirX = 0;
    player.lastMoveDirY = -1;
    return player;
  };

  NV.configurePlayerDash = function (player) {
    player.dashStaminaMax = NV.BALANCE.DASH_STAMINA_MAX;
    player.dashStamina = player.dashStaminaMax;
    player.dashCost = NV.BALANCE.DASH_STAMINA_COST;
    player.dashTime = 0;
    player.dashRechargeDelay = 0;
    player.dashDirX = 0;
    player.dashDirY = -1;
    player.dashInputHeld = false;
    player.dashActive = false;
    return player;
  };

  function setDashDirection(player, moveX, moveY, aimX, aimY, aimActive) {
    let x = moveX, y = moveY;
    let length = Math.hypot(x, y);
    if (length <= 0.000001 && aimActive) {
      x = aimX; y = aimY; length = Math.hypot(x, y);
    }
    if (length <= 0.000001) {
      x = player.lastMoveDirX || 0;
      y = player.lastMoveDirY || -1;
      length = Math.hypot(x, y);
    }
    if (length <= 0.000001) { x = 0; y = -1; length = 1; }
    player.dashDirX = x / length;
    player.dashDirY = y / length;
  }

  NV.resetDashPauseLatch = function (player, dashIntentPressed) {
    if (!player) return player;
    player.dashInputHeld = !!dashIntentPressed;
    return player;
  };

  NV.updatePlayerDash = function (player, dashIntent, moveX, moveY, aimX, aimY, aimActive, dt) {
    dt = Math.max(0, Number(dt) || 0);
    const pressed = !!dashIntent;
    const pressEdge = pressed && !player.dashInputHeld;
    player.dashInputHeld = pressed;

    if (pressEdge && !player.dashActive && player.stun <= 0) {
      if (player.dashStamina >= player.dashCost) {
        setDashDirection(player, moveX, moveY, aimX, aimY, aimActive);
        player.dashStamina = Math.max(0, player.dashStamina - player.dashCost);
        player.dashTime = NV.BALANCE.DASH_DURATION;
        player.dashRechargeDelay = NV.BALANCE.DASH_RECHARGE_DELAY;
        player.dashActive = true;
        player.moveReversing = false;
        if (NV.playtest) NV.playtest.dashEvent('succeeded'); // telemetría opt-in F08
      } else if (NV.playtest) {
        NV.playtest.dashEvent('failed'); // press-edge válido sin stamina suficiente
      }
    }
    // Telemetría opt-in F08: frames sosteniendo dash sin stamina para un uso completo.
    if (NV.playtest && pressed && player.dashStamina < player.dashCost) NV.playtest.setExhaustedFrame();

    if (player.dashActive) {
      const activeDt = Math.min(dt, player.dashTime);
      player.moveVx = player.dashDirX * NV.BALANCE.DASH_SPEED;
      player.moveVy = player.dashDirY * NV.BALANCE.DASH_SPEED;
      player.x += player.moveVx * activeDt;
      player.y += player.moveVy * activeDt;
      player.dashTime = Math.max(0, player.dashTime - dt);
      if (player.dashTime <= 0) {
        player.dashActive = false;
        player.moveVx = 0;
        player.moveVy = 0;
      }
      return true;
    }

    if (player.dashRechargeDelay > 0) {
      player.dashRechargeDelay = Math.max(0, player.dashRechargeDelay - dt);
    } else if (player.dashStamina < player.dashStaminaMax) {
      player.dashStamina = Math.min(player.dashStaminaMax, player.dashStamina + NV.BALANCE.DASH_REGEN_PER_SECOND * dt);
    }
    return false;
  };

  NV.updatePlayerMovement = function (player, moveX, moveY, dt) {
    dt = Math.max(0, Number(dt) || 0);
    moveX = Number(moveX) || 0;
    moveY = Number(moveY) || 0;
    let inputLength = Math.hypot(moveX, moveY);
    if (inputLength > 1) { moveX /= inputLength; moveY /= inputLength; inputLength = 1; }
    if (inputLength > 0.000001) {
      player.lastMoveDirX = moveX;
      player.lastMoveDirY = moveY;
    }

    const overdriveMult = player.overdrive > 0 ? NV.CONSUMABLES.overdrive.speedMult : 1;
    player.moveSpeedTemporaryMult = overdriveMult;
    player.effectiveMoveSpeed = player.baseMoveSpeed * player.moveSpeedPermanentMult * player.moveSpeedTemporaryMult;
    player.speed = player.effectiveMoveSpeed;

    const agility = Math.max(1, Number(player.agility) || 1);
    const controlMult = agility * player.moveControlPermanentMult;
    player.acceleration = (player.effectiveMoveSpeed / NV.BALANCE.MOVE_ACCEL_TIME) * controlMult;
    player.deceleration = (player.effectiveMoveSpeed / NV.BALANCE.MOVE_DECEL_TIME) * controlMult;
    player.turnControl = (player.effectiveMoveSpeed / NV.BALANCE.MOVE_TURN_TIME) * controlMult;
    player.reversalControl = ((player.effectiveMoveSpeed * 2) / NV.BALANCE.MOVE_REVERSE_TIME) * controlMult;

    const canMove = inputLength > 0 && player.stun <= 0;
    const targetVx = canMove ? moveX * player.effectiveMoveSpeed : 0;
    const targetVy = canMove ? moveY * player.effectiveMoveSpeed : 0;
    const currentSpeed = Math.hypot(player.moveVx, player.moveVy);
    const controlSpeed = Math.max(player.effectiveMoveSpeed, currentSpeed);
    player.deceleration = (controlSpeed / NV.BALANCE.MOVE_DECEL_TIME) * controlMult;
    player.reversalControl = ((controlSpeed * 2) / NV.BALANCE.MOVE_REVERSE_TIME) * controlMult;
    let rate = player.acceleration;
    if (!canMove) {
      player.moveReversing = false;
      rate = player.deceleration;
    } else if (currentSpeed > 0.0001) {
      const dot = (player.moveVx * moveX + player.moveVy * moveY) / currentSpeed;
      if (dot < -0.1) player.moveReversing = true;
      if (player.moveReversing) rate = player.reversalControl;
      else if (dot < 0.85) rate = player.turnControl;
    }

    const deltaX = targetVx - player.moveVx;
    const deltaY = targetVy - player.moveVy;
    const deltaLength = Math.hypot(deltaX, deltaY);
    const maxDelta = rate * dt;
    if (deltaLength <= maxDelta || deltaLength <= 0.000001) {
      player.moveVx = targetVx;
      player.moveVy = targetVy;
      player.moveReversing = false;
    } else {
      const scale = maxDelta / deltaLength;
      player.moveVx += deltaX * scale;
      player.moveVy += deltaY * scale;
    }

    player.x += player.moveVx * dt;
    player.y += player.moveVy * dt;
    return player;
  };
})();
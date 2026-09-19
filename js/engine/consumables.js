// engine/consumables.js — Handlers de consumibles.
// Reciben un contexto explícito para mantener la lógica testeable y sin acoplarse a game.js.
(() => {
  'use strict';
  const NV = window.NV;
  const CONSUMABLES = NV.CONSUMABLES;

  NV.CONSUMABLE_HANDLERS = {
    potion(ctx) {
      ctx.player.hp = Math.min(ctx.player.maxHp, ctx.player.hp + CONSUMABLES.potion.hp);
      ctx.addFloatText(ctx.player.x, ctx.player.y, '+40 HP', '#0f0');
      if (ctx.spawnConsumableVfx) ctx.spawnConsumableVfx('potion', { x: ctx.player.x, y: ctx.player.y });
    },
    overdrive(ctx) {
      // Solo renueva el timer. movement.js deriva el multiplicador efectivo sin mutar base stats.
      ctx.player.overdrive = CONSUMABLES.overdrive.duration;
      if (ctx.spawnShockwave) ctx.spawnShockwave(ctx.player.x, ctx.player.y, { maxRadius: 80, color: '#caa7ff', width: 3 });
      ctx.addFloatText(ctx.player.x, ctx.player.y, 'OVERDRIVE', '#caa7ff');
      ctx.triggerFlash('#caa7ff');
      if (ctx.spawnConsumableVfx) ctx.spawnConsumableVfx('overdrive', { x: ctx.player.x, y: ctx.player.y });
    },
    shield(ctx) {
      // Timer dedicado al escudo de consumible: deja el flag `invuln` libre para
      // que phase/bulwark mantengan su identidad visual. Duración ÚNICA fuente:
      // CONSUMABLES.shield.duration (invuln y shield siempre iguales).
      ctx.player.invuln = CONSUMABLES.shield.duration;
      ctx.player.shield = CONSUMABLES.shield.duration;
      ctx.addFloatText(ctx.player.x, ctx.player.y, 'ESCUDO', '#7cf8ff');
      ctx.triggerFlash('#7cf8ff');
      if (ctx.spawnConsumableVfx) ctx.spawnConsumableVfx('shield', { x: ctx.player.x, y: ctx.player.y });
    },
    bomb(ctx) {
      // #11: el daño NO es inmediato. Se registra un impacto pendiente que el game
      // loop aplica al cruzar el umbral de detonación (mismo timing que el VFX).
      // Sin cola disponible (harness mínimo), degrada a impacto inmediato.
      if (ctx.registerBombImpact) {
        ctx.registerBombImpact(NV.createBombImpact(ctx.enemies, ctx.boss, ctx.killEnemy));
      } else {
        NV.voidBomb(ctx.enemies, ctx.boss, ctx.killEnemy);
      }
      const cx = ctx.player.x, cy = ctx.player.y;
      if (ctx.spawnExplosion) ctx.spawnExplosion(cx, cy, 28, '#ff5f9b', 0.9);
      if (ctx.spawnShockwave) ctx.spawnShockwave(cx, cy, { maxRadius: 100, color: '#ff5f9b', width: 4 });
      ctx.addFloatText(cx, cy, '¡BOMBA DE VACÍO!', '#ff5f9b');
      ctx.triggerFlash('#ff5f9b');
      if (ctx.spawnConsumableVfx) ctx.spawnConsumableVfx('bomb', { x: cx, y: cy });
    },
    freeze(ctx) {
      NV.freezeEnemies(ctx.enemies, 4);
      ctx.addFloatText(ctx.player.x, ctx.player.y, '¡CONGELADO!', '#caa7ff');
      ctx.triggerFlash('#caa7ff');
      if (ctx.spawnConsumableVfx) ctx.spawnConsumableVfx('freeze', { x: ctx.player.x, y: ctx.player.y });
    },
    magnet(ctx) {
      const n = NV.magnetCollect(ctx.pickups, ctx.weaponPickups, ctx.player);
      if (ctx.spawnShockwave) ctx.spawnShockwave(ctx.player.x, ctx.player.y, { maxRadius: 70, color: '#7cf8ff', width: 3 });
      ctx.addFloatText(ctx.player.x, ctx.player.y, 'IMÁN (' + n + ')', '#7cf8ff');
      ctx.triggerFlash('#7cf8ff');
    },
    bounty(ctx) {
      ctx.player.bounty = 10;
      if (ctx.spawnShockwave) ctx.spawnShockwave(ctx.player.x, ctx.player.y, { maxRadius: 75, color: '#ffd700', width: 3 });
      ctx.addFloatText(ctx.player.x, ctx.player.y, 'RECOMPENSA 10s', '#ffd700');
      ctx.triggerFlash('#ffd700');
      if (ctx.spawnConsumableVfx) ctx.spawnConsumableVfx('bounty', { x: ctx.player.x, y: ctx.player.y });
    },
  };

  NV.applyConsumable = function (item, ctx) {
    if (!item || !ctx) return false;
    const handler = NV.CONSUMABLE_HANDLERS[item.type];
    if (!handler) return false;
    handler(ctx);
    return true;
  };

  NV.applyBotiPassiveRegen = function (char, player, frame, addFloatText) {
    if (!char || char.passiveId !== 'boti_regen' || frame % 300 !== 0 || player.hp >= player.maxHp) return false;
    player.hp = Math.min(player.maxHp, player.hp + 1);
    addFloatText(player.x, player.y - 40, '+1', '#7cf8ff');
    return true;
  };
})();
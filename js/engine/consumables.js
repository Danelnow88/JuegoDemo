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
    },
    overdrive(ctx) {
      // Solo se multiplica la velocidad una vez para no inflarla con compras repetidas.
      if (ctx.player.overdrive <= 0) ctx.player.speed *= CONSUMABLES.overdrive.speedMult;
      ctx.player.overdrive = CONSUMABLES.overdrive.duration;
      ctx.addFloatText(ctx.player.x, ctx.player.y, 'OVERDRIVE', '#caa7ff');
    },
    shield(ctx) {
      ctx.player.invuln = CONSUMABLES.shield.duration;
      ctx.addFloatText(ctx.player.x, ctx.player.y, 'ESCUDO', '#ffcf76');
    },
    bomb(ctx) {
      NV.voidBomb(ctx.enemies, ctx.boss);
      ctx.addFloatText(ctx.player.x, ctx.player.y, '¡BOMBA DE VACÍO!', '#ff5f9b');
      ctx.triggerFlash('#ff5f9b');
    },
    freeze(ctx) {
      NV.freezeEnemies(ctx.enemies, 4);
      ctx.addFloatText(ctx.player.x, ctx.player.y, '¡CONGELADO!', '#caa7ff');
      ctx.triggerFlash('#caa7ff');
    },
    magnet(ctx) {
      const n = NV.magnetCollect(ctx.pickups, ctx.weaponPickups, ctx.player);
      ctx.addFloatText(ctx.player.x, ctx.player.y, 'IMÁN (' + n + ')', '#7cf8ff');
    },
    bounty(ctx) {
      ctx.player.bounty = 10;
      ctx.addFloatText(ctx.player.x, ctx.player.y, 'RECOMPENSA 10s', '#ffd700');
      ctx.triggerFlash('#ffd700');
    },
  };

  NV.applyConsumable = function (item, ctx) {
    if (!item || !ctx) return false;
    const handler = NV.CONSUMABLE_HANDLERS[item.type];
    if (!handler) return false;
    handler(ctx);
    return true;
  };
})();
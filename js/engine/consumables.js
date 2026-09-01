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
      if (ctx.spawnShockwave) ctx.spawnShockwave(ctx.player.x, ctx.player.y, { maxRadius: 80, color: '#caa7ff', width: 3 });
      ctx.addFloatText(ctx.player.x, ctx.player.y, 'OVERDRIVE', '#caa7ff');
      ctx.triggerFlash('#caa7ff');
    },
    shield(ctx) {
      // Timer dedicado al escudo de consumible: deja el flag `invuln` libre para
      // que phase/bulwark mantengan su identidad visual. 2s de invulnerabilidad.
      ctx.player.invuln = CONSUMABLES.shield.duration;
      ctx.player.shield = CONSUMABLES.shield.duration;
      ctx.addFloatText(ctx.player.x, ctx.player.y, 'ESCUDO', '#7cf8ff');
      ctx.triggerFlash('#7cf8ff');
    },
    bomb(ctx) {
      // Daña a todos los enemigos comunes y al jefe (voidBomb). El daño ya es correcto
      // (no hay bug de alcance): este handler solo agrega la retroalimentación visual
      // que faltaba (explosión + onda expansiva desde el jugador).
      NV.voidBomb(ctx.enemies, ctx.boss);
      const cx = ctx.player.x, cy = ctx.player.y;
      if (ctx.spawnExplosion) ctx.spawnExplosion(cx, cy, 28, '#ff5f9b', 0.9);
      if (ctx.spawnShockwave) ctx.spawnShockwave(cx, cy, { maxRadius: 100, color: '#ff5f9b', width: 4 });
      ctx.addFloatText(cx, cy, '¡BOMBA DE VACÍO!', '#ff5f9b');
      ctx.triggerFlash('#ff5f9b');
    },
    freeze(ctx) {
      NV.freezeEnemies(ctx.enemies, 4);
      ctx.addFloatText(ctx.player.x, ctx.player.y, '¡CONGELADO!', '#caa7ff');
      ctx.triggerFlash('#caa7ff');
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
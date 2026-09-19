// Tests Tarea #9: rescate limitado de shards normales al terminar la oleada.
const fs = require('fs'), vm = require('vm'), assert = require('assert');
let pass = 0, fail = 0;
function t(desc, fn) {
  try { fn(); pass++; console.log('  ok  ' + desc); }
  catch (e) { fail++; console.log('  FAIL ' + desc + ' -> ' + e.message); }
}

const balanceSource = fs.readFileSync('js/data/balance.js', 'utf8');
const pickupsSource = fs.readFileSync('js/engine/pickups.js', 'utf8');
const gameSource = fs.readFileSync('js/game.js', 'utf8');
const sbx = { window: { NV: {} }, console, Math };
vm.runInNewContext(balanceSource, sbx, { filename: 'balance.js' });
vm.runInNewContext(pickupsSource, sbx, { filename: 'pickups.js' });
const NV = sbx.window.NV;

function functionBlock(source, name, nextName) {
  const start = source.indexOf('NV.' + name + ' = function');
  if (start < 0) throw new Error('falta helper ' + name);
  const end = source.indexOf('NV.' + nextName + ' = function', start + 1);
  return source.slice(start, end < 0 ? source.length : end);
}

function normal(x, y, extra) {
  return Object.assign({ x, y, dead: false }, extra || {});
}

function selected(pickups) {
  return pickups.filter((p) => p && p.waveEndCollect === true);
}

t('balance define WAVE_END_SHARD_CAP=15 sin modificar MAGNET_CAP', () => {
  assert.strictEqual(NV.BALANCE.WAVE_END_SHARD_CAP, 15);
  assert.strictEqual(NV.BALANCE.MAGNET_CAP, 50);
});

t('con menos de 15 selecciona todos los normales válidos y excluye dead/boss', () => {
  const player = { x: 0, y: 0 };
  const pickups = Array.from({ length: 8 }, (_, i) => normal(i + 1, 0));
  const dead = normal(0, 0, { dead: true });
  const boss = normal(0, 0, { fromBossChest: true });
  pickups.push(dead, boss);
  NV.activateNormalShardMagnetPull(pickups, player);
  assert.strictEqual(selected(pickups).length, 8);
  assert(pickups.slice(0, 8).every((p) => p.magnetPull === true));
  assert.strictEqual(dead.waveEndCollect, undefined);
  assert.strictEqual(dead.magnetPull, undefined);
  assert.strictEqual(boss.waveEndCollect, undefined);
  assert.strictEqual(boss.magnetPull, undefined);
});

t('con exactamente 15 selecciona exactamente 15', () => {
  const pickups = Array.from({ length: 15 }, (_, i) => normal(i, 0));
  NV.activateNormalShardMagnetPull(pickups, { x: 0, y: 0 });
  assert.strictEqual(selected(pickups).length, 15);
  assert.strictEqual(pickups.filter((p) => p.magnetPull === true).length, 15);
});

t('con más de 15 selecciona exactamente los 15 más cercanos por distancia cuadrada', () => {
  const player = { x: 100, y: 50 };
  const pickups = [];
  for (let i = 30; i >= 1; i--) pickups.push(normal(100 + i, 50, { id: i }));
  NV.activateNormalShardMagnetPull(pickups, player);
  const ids = selected(pickups).map((p) => p.id).sort((a, b) => a - b);
  assert.deepStrictEqual(ids, Array.from({ length: 15 }, (_, i) => i + 1));
  assert.strictEqual(selected(pickups).length, NV.BALANCE.WAVE_END_SHARD_CAP);
  const block = functionBlock(pickupsSource, 'activateNormalShardMagnetPull', 'collectRemainingNormalShards');
  if (!block.includes('(p.x - player.x) ** 2 + (p.y - player.y) ** 2')) throw new Error('no usa distancia cuadrada al jugador');
  if (block.includes('MAGNET_CAP') || block.includes('magnetCollect')) throw new Error('usa el cap/ruta del consumible imán');
});

t('sólo seleccionados reciben metadata y magnetPull nuevo', () => {
  const pickups = Array.from({ length: 20 }, (_, i) => normal(i + 1, 0));
  NV.activateNormalShardMagnetPull(pickups, { x: 0, y: 0 });
  assert(pickups.slice(0, 15).every((p) => p.waveEndCollect === true && p.magnetPull === true));
  assert(pickups.slice(15).every((p) => p.waveEndCollect === undefined && p.magnetPull === undefined));
});

t('no seleccionado conserva magnetPull preexistente y otro queda sin magnetizar', () => {
  const pickups = Array.from({ length: 17 }, (_, i) => normal(i + 1, 0));
  pickups[15].magnetPull = true;
  NV.activateNormalShardMagnetPull(pickups, { x: 0, y: 0 });
  assert.strictEqual(pickups[15].waveEndCollect, undefined);
  assert.strictEqual(pickups[15].magnetPull, true);
  assert.strictEqual(pickups[16].waveEndCollect, undefined);
  assert.strictEqual(pickups[16].magnetPull, undefined);
});

t('seleccionado vuela con updatePickups y persigue player.x/y actuales', () => {
  const p = normal(0, 0);
  const player = { x: 1000, y: 0 };
  NV.activateNormalShardMagnetPull([p], player);
  NV.updatePickups(0.01, [p], player, () => {}, () => {});
  const firstX = p.x;
  assert(firstX > 0, 'no avanzó hacia la posición inicial');
  player.x = firstX;
  player.y = 1000;
  NV.updatePickups(0.01, [p], player, () => {}, () => {});
  assert(p.y > 0, 'no corrigió el vuelo hacia la posición actual');
});

t('llegada por updatePickups acredita value custom una sola vez', () => {
  const p = normal(220, 0, { value: 7 });
  const player = { x: 0, y: 0 };
  let texts = 0, sounds = 0, credited = 0;
  NV.activateNormalShardMagnetPull([p], player);
  let pickups = [p];
  for (let i = 0; i < 120 && pickups.length; i++) {
    const r = NV.updatePickups(1 / 60, pickups, player, () => { texts++; }, () => { sounds++; });
    pickups = r.pickups;
    credited += r.shards;
  }
  assert.strictEqual(credited, 7);
  assert.strictEqual(texts, 1);
  assert.strictEqual(sounds, 1);
  const again = NV.updatePickups(1 / 60, pickups, player, () => { texts++; }, () => { sounds++; });
  assert.strictEqual(again.shards, 0);
  assert.strictEqual(texts, 1);
  assert.strictEqual(sounds, 1);
});

t('fallback consume sólo seleccionados, respeta value y conserva el resto', () => {
  const selectedCustom = normal(10, 10, { value: 5, waveEndCollect: true, magnetPull: true });
  const selectedDefault = normal(20, 20, { waveEndCollect: true, magnetPull: true });
  const unselected = normal(30, 30, { value: 100 });
  const preMagnetized = normal(40, 40, { value: 200, magnetPull: true });
  const deadSelected = normal(50, 50, { value: 300, dead: true, waveEndCollect: true });
  const bossSelected = normal(60, 60, { value: 400, fromBossChest: true, waveEndCollect: true });
  const first = NV.collectRemainingNormalShards([
    selectedCustom, selectedDefault, unselected, preMagnetized, deadSelected, bossSelected,
  ]);
  assert.strictEqual(first.shards, 6);
  assert.strictEqual(selectedCustom.dead, true);
  assert.strictEqual(selectedDefault.dead, true);
  assert.deepStrictEqual(Array.from(first.pickups), [unselected, preMagnetized, deadSelected, bossSelected]);
  assert.strictEqual(unselected.dead, false);
  assert.strictEqual(preMagnetized.dead, false);
  assert.strictEqual(bossSelected.dead, false);
  const second = NV.collectRemainingNormalShards(first.pickups);
  assert.strictEqual(second.shards, 0);
  assert.deepStrictEqual(Array.from(second.pickups), [unselected, preMagnetized, deadSelected, bossSelected]);
});

t('fallback es silencioso', () => {
  const block = functionBlock(pickupsSource, 'collectRemainingNormalShards', 'updateWeaponPickups');
  for (const forbidden of ['addFloatText', 'pickupSfx', 'showBanner', 'sfx.']) {
    if (block.includes(forbidden)) throw new Error('feedback prohibido: ' + forbidden);
  }
});

t('weaponPickups permanece intacto', () => {
  const weaponPickups = [{ x: 3, y: 4, dead: false, weapon: { id: 'rifle' } }];
  const before = JSON.stringify(weaponPickups);
  NV.activateNormalShardMagnetPull([normal(0, 0)], { x: 0, y: 0 });
  NV.collectRemainingNormalShards([normal(0, 0, { waveEndCollect: true })]);
  assert.strictEqual(JSON.stringify(weaponPickups), before);
});

t('triggerWaveVictory pasa player después de wave_end y antes del cleanup #10', () => {
  const start = gameSource.indexOf('function triggerWaveVictory');
  const end = gameSource.indexOf('function triggerFlash', start);
  const block = gameSource.slice(start, end);
  const state = block.indexOf("state = 'wave_end';");
  const activate = block.indexOf('NV.activateNormalShardMagnetPull(pickups, player);');
  const cleanup = block.indexOf('// #10:');
  if (!(state >= 0 && state < activate && activate < cleanup)) throw new Error('orden/firma de activación incorrecto');
});

t('game.js mantiene fallback al inicio y antes de preparar tienda', () => {
  const start = gameSource.indexOf('function beginShopEntrance()');
  const end = gameSource.indexOf('function finishShopEntrance()', start);
  const block = gameSource.slice(start, end);
  const guard = block.indexOf("if (state !== 'wave_end') return;");
  const collect = block.indexOf('NV.collectRemainingNormalShards(pickups);');
  const reassign = block.indexOf('pickups = result.pickups;');
  const credit = block.indexOf('shards += result.shards;');
  const prepare = block.indexOf('prepareShopContent();');
  if (!(guard >= 0 && guard < collect && collect < reassign && reassign < credit && credit < prepare)) {
    throw new Error('orden del fallback incorrecto');
  }
  if (block.includes('weaponPickups =')) throw new Error('beginShopEntrance modificó weaponPickups');
});

console.log('RESULT wave_end_shard_autocollect: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
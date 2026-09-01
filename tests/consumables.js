// Tests D1: consumibles nuevos — bomba, congelante, imán y recompensa (funciones puras).
const fs = require('fs'), vm = require('vm');
let pass = 0, fail = 0;
function t(d, fn) { try { fn(); pass++; console.log('  ok  ' + d); } catch (e) { fail++; console.log('  FAIL ' + d + ' -> ' + e.message); } }

function load() {
  const sbx = { window: { NV: {} }, console, Math };
  vm.runInNewContext(fs.readFileSync('js/data/balance.js', 'utf8'), sbx, { filename: 'b' });
  vm.runInNewContext(fs.readFileSync('js/data/gameData.js', 'utf8'), sbx, { filename: 'g' });
  vm.runInNewContext(fs.readFileSync('js/data/consumables.js', 'utf8'), sbx, { filename: 'c' });
  vm.runInNewContext(fs.readFileSync('js/engine/enemies.js', 'utf8'), sbx, { filename: 'e' });
  vm.runInNewContext(fs.readFileSync('js/engine/pickups.js', 'utf8'), sbx, { filename: 'p' });
  vm.runInNewContext(fs.readFileSync('js/engine/consumables.js', 'utf8'), sbx, { filename: 'co' });
  return sbx.window.NV;
}

t('CONSUMABLES centraliza los 7 consumibles reales en orden/precio actual', () => {
  const NV = load();
  const expected = ['potion', 'overdrive', 'shield', 'bomb', 'freeze', 'magnet', 'bounty'];
  if (NV.CONSUMABLE_ORDER.join(',') !== expected.join(',')) throw new Error('orden=' + NV.CONSUMABLE_ORDER.join(','));
  const list = NV.consumableList();
  if (list.map((c) => c.key).join(',') !== expected.join(',')) throw new Error('lista=' + list.map((c) => c.key).join(','));
  const prices = { potion: 10, overdrive: 18, shield: 22, bomb: 34, freeze: 26, magnet: 20, bounty: 30 };
  for (const key of expected) {
    if (!NV.CONSUMABLES[key]) throw new Error('falta ' + key);
    if (NV.CONSUMABLES[key].price !== prices[key]) throw new Error(key + ' price=' + NV.CONSUMABLES[key].price);
  }
});

t('voidBomb: baja 25% HP máx a todos y al jefe, nunca a 0', () => {
  const NV = load();
  const enemies = [{ dead: false, hp: 100, maxHp: 100 }, { dead: false, hp: 40, maxHp: 80 }];
  const boss = { dead: false, hp: 400, maxHp: 400 };
  NV.voidBomb(enemies, boss);
  if (enemies[0].hp !== 75) throw new Error('e0 hp=' + enemies[0].hp);
  if (enemies[1].hp !== 20) throw new Error('e1 hp=' + enemies[1].hp);
  if (boss.hp !== 300) throw new Error('boss hp=' + boss.hp);
});

t('voidBomb con enemigo muy débil no lo deja en 0 (piso 1)', () => {
  const NV = load();
  const enemies = [{ dead: false, hp: 2, maxHp: 50 }];
  NV.voidBomb(enemies, null);
  if (enemies[0].hp !== 1) throw new Error('hp=' + enemies[0].hp);
});

t('freezeEnemies: marca slowUntil en vivos (no en muertos)', () => {
  const NV = load();
  const enemies = [{ dead: false }, { dead: true }];
  NV.freezeEnemies(enemies, 4);
  if (enemies[0].slowUntil !== 4) throw new Error('no congeló');
  if (enemies[1].slowUntil !== undefined) throw new Error('congeló muerto');
});

t('magnetCollect: marca shards y armas para atracción visible y cuenta', () => {
  const NV = load();
  const pickups = [{ dead: false, x: 999, y: 999 }, { dead: true }];
  const wp = [{ dead: false, x: 500, y: 500 }];
  const n = NV.magnetCollect(pickups, wp, { x: 100, y: 100 });
  if (n !== 2) throw new Error('n=' + n);
  if (!pickups[0].magnetPull || !wp[0].magnetPull) throw new Error('no marcó magnetPull');
  if (pickups[0].x !== 999 || wp[0].x !== 500) throw new Error('teletransportó en vez de animar');
  if (pickups[1].magnetPull) throw new Error('marcó pickup muerto');
});

t('updatePickups mueve shards imantados hacia el jugador antes de recogerlos', () => {
  const NV = load();
  const player = { x: 100, y: 100 };
  const pickups = [{ dead: false, x: 400, y: 100 }];
  NV.magnetCollect(pickups, [], player);
  const before = Math.hypot(pickups[0].x - player.x, pickups[0].y - player.y);
  const res = NV.updatePickups(0.1, pickups, player, () => {}, () => {});
  const after = res.pickups[0] ? Math.hypot(res.pickups[0].x - player.x, res.pickups[0].y - player.y) : 0;
  if (!(after < before)) throw new Error('no se acercó: before=' + before + ' after=' + after);
});

t('killEnemy aplica RECOMPENSA: doble score + shard extra', () => {
  const NV = load();
  let shards = [];
  const texts = [];
  const st = {
    e: { dead: false, score: 10, xp: 1, hp: 0, maxHp: 20, color: '#fff' },
    score: 0, player: { bounty: 5, xp: 0, xpToNext: 100, level: 1, luck: 0, x: 0, y: 0 },
    weaponLevels: {}, weaponKills: {}, currentWeapon: { id: 'w' }, WEAPON_KILLS_PER_LEVEL: 6,
    addFloatText(x, y, text, color){ texts.push({ x, y, text, color }); }, spawnExplosion(){}, triggerFlash(){}, sfx: { explosion(){}, levelup(){} },
    pickups: shards, weaponKillProgress: () => 1,
  };
  const sc = NV.killEnemy(st);
  if (sc !== 20) throw new Error('score=' + sc + ' (esperaba doble 20)');
  if (shards.length < 1 || !shards.some((s) => s.value === 1)) throw new Error('sin shard bounty');
  if (!texts.some((t) => t.text === '+1 💎 BONUS' && t.color === '#ffd700')) throw new Error('sin feedback bounty');
});

t('applyConsumable preserva efectos y feedback de los 7 consumibles', () => {
  const NV = load();
  const floatTexts = [], flashes = [];
  const player = { x: 10, y: 20, hp: 70, maxHp: 100, speed: 200, overdrive: 0 };
  const enemies = [{ dead: false, hp: 100, maxHp: 100 }, { dead: false }];
  const boss = { dead: false, hp: 200, maxHp: 200 };
  const pickups = [{ dead: false, x: 999, y: 999 }];
  const weaponPickups = [{ dead: false, x: 500, y: 500 }];
  const ctx = {
    player, enemies, boss, pickups, weaponPickups,
    addFloatText(x, y, text, color) { floatTexts.push({ x, y, text, color }); },
    triggerFlash(color) { flashes.push(color); },
  };
  if (!NV.applyConsumable({ type: 'potion' }, ctx) || player.hp !== 100) throw new Error('potion');
  if (!NV.applyConsumable({ type: 'overdrive' }, ctx) || player.speed !== 300 || player.overdrive !== 5) throw new Error('overdrive');
  if (!NV.applyConsumable({ type: 'shield' }, ctx) || player.invuln !== 2) throw new Error('shield');
  if (!NV.applyConsumable({ type: 'bomb' }, ctx) || enemies[0].hp !== 75 || boss.hp !== 150) throw new Error('bomb');
  if (!NV.applyConsumable({ type: 'freeze' }, ctx) || enemies[0].slowUntil !== 4) throw new Error('freeze');
  if (!NV.applyConsumable({ type: 'magnet' }, ctx) || !pickups[0].magnetPull || !weaponPickups[0].magnetPull) throw new Error('magnet');
  if (!NV.applyConsumable({ type: 'bounty' }, ctx) || player.bounty !== 10) throw new Error('bounty');
  if (NV.applyConsumable({ type: 'unknown' }, ctx) !== false) throw new Error('unknown no devuelve false');
  for (const text of ['+40 HP', 'OVERDRIVE', 'ESCUDO', '¡BOMBA DE VACÍO!', '¡CONGELADO!', 'IMÁN (2)', 'RECOMPENSA 10s']) {
    if (!floatTexts.some((f) => f.text === text)) throw new Error('falta float ' + text);
  }
  for (const color of ['#ff5f9b', '#caa7ff', '#ffd700']) {
    if (!flashes.includes(color)) throw new Error('falta flash ' + color);
  }
});

t('Bomba: explosión + onda expansiva (feedback visual) y daño a todos enemigos + jefe', () => {
  const NV = load();
  let ex = 0, sw = 0;
  const player = { x: 10, y: 20 };
  const enemies = [{ dead: false, hp: 100, maxHp: 100 }, { dead: true, hp: 0, maxHp: 100 }];
  const boss = { dead: false, hp: 200, maxHp: 200 };
  const ctx = {
    player, enemies, boss, pickups: [], weaponPickups: [],
    addFloatText() {}, triggerFlash() {},
    spawnExplosion() { ex++; },
    spawnShockwave() { sw++; },
  };
  if (!NV.applyConsumable({ type: 'bomb' }, ctx)) throw new Error('handler inexistente');
  if (ex !== 1) throw new Error('spawnExplosion llamada ' + ex + ' veces');
  if (sw !== 1) throw new Error('spawnShockwave llamada ' + sw + ' veces');
  if (enemies[0].hp !== 75) throw new Error('e0 hp=' + enemies[0].hp);
  if (enemies[1].hp !== 0) throw new Error('no saltea muerto: hp=' + enemies[1].hp);
  if (boss.hp !== 150) throw new Error('boss hp=' + boss.hp);
});

t('Escudo: timer dedicado player.shield + flash azul + aura render', () => {
  const NV = load();
  const flashes = [];
  const player = { x: 5, y: 6, hp: 10, maxHp: 100 };
  const ctx = {
    player, enemies: [], boss: { dead: true }, pickups: [], weaponPickups: [],
    addFloatText() {},
    triggerFlash(c) { flashes.push(c); },
  };
  NV.applyConsumable({ type: 'shield' }, ctx);
  if (player.invuln !== 2) throw new Error('invuln=' + player.invuln);
  if (player.shield !== 2) throw new Error('player.shield=' + player.shield);
  if (!flashes.includes('#7cf8ff')) throw new Error('flash azul ausente: ' + JSON.stringify(flashes));
});

t('Imán: handler dispara onda visual y marca pickups para pull animado', () => {
  const NV = load();
  let sw = 0;
  const player = { x: 10, y: 20 };
  const pickups = [{ dead: false, x: 300, y: 20 }];
  const weaponPickups = [{ dead: false, x: 500, y: 20 }];
  NV.applyConsumable({ type: 'magnet' }, {
    player, pickups, weaponPickups, enemies: [], boss: null,
    addFloatText() {}, triggerFlash() {},
    spawnShockwave() { sw++; },
  });
  if (sw !== 1) throw new Error('sin onda de imán');
  if (!pickups[0].magnetPull || !weaponPickups[0].magnetPull) throw new Error('sin pull animado');
});

t('Recompensa: handler dispara onda dorada y comunica activación', () => {
  const NV = load();
  let sw = 0;
  const texts = [];
  const player = { x: 10, y: 20 };
  NV.applyConsumable({ type: 'bounty' }, {
    player, pickups: [], weaponPickups: [], enemies: [], boss: null,
    addFloatText(x, y, text, color) { texts.push({ x, y, text, color }); },
    triggerFlash() {}, spawnShockwave() { sw++; },
  });
  if (player.bounty !== 10) throw new Error('bounty=' + player.bounty);
  if (sw !== 1) throw new Error('sin onda dorada');
  if (!texts.some((t) => t.text === 'RECOMPENSA 10s')) throw new Error('sin texto de activación');
});

t('Overdrive: handler dispara onda/flash y render tiene aura violeta persistente', () => {
  const NV = load();
  let sw = 0;
  const flashes = [];
  const player = { x: 10, y: 20, speed: 200, overdrive: 0 };
  NV.applyConsumable({ type: 'overdrive' }, {
    player, pickups: [], weaponPickups: [], enemies: [], boss: null,
    addFloatText() {}, triggerFlash(c) { flashes.push(c); }, spawnShockwave() { sw++; },
  });
  if (player.speed !== 300 || player.overdrive !== 5) throw new Error('overdrive gameplay roto');
  if (sw !== 1) throw new Error('sin onda de overdrive');
  if (!flashes.includes('#caa7ff')) throw new Error('sin flash violeta');
  const r = fs.readFileSync('js/render/player.js', 'utf8');
  if (!r.includes('player.overdrive > 0')) throw new Error('sin condición render overdrive');
  if (!r.includes('char.size + 23')) throw new Error('sin aura exterior overdrive');
});

t('game.js decrementa player.shield', () => {
  const g = fs.readFileSync('js/game.js', 'utf8');
  if (!g.includes('player.shield -= dt')) throw new Error('game.js no decrementa player.shield');
});

t('render/player.js dibuja aura azul del escudo (char.size + 18)', () => {
  const r = fs.readFileSync('js/render/player.js', 'utf8');
  if (!r.includes('player.shield > 0 && player.phase <= 0')) throw new Error('condición de aura ausente');
  if (!r.includes('char.size + 18')) throw new Error('aura de escudo no dibujada');
});

t('game.js conecta los 4 consumibles nuevos y la tienda usa NV.consumableList', () => {
  const g = fs.readFileSync('js/game.js', 'utf8');
  const html = fs.readFileSync('index.html', 'utf8');
  if (!html.includes('js/engine/consumables.js')) throw new Error('script consumables engine no cargado');
  if (!g.includes('NV.applyConsumable(item')) throw new Error('game.js no delega a NV.applyConsumable');
  if (!g.includes('NV.consumableList().forEach')) throw new Error('tienda no usa NV.consumableList');
});

console.log('RESULT consumables: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
// Tests D1: consumibles nuevos — bomba, congelante, imán y recompensa (funciones puras).
const fs = require('fs'), vm = require('vm');
let pass = 0, fail = 0;
function t(d, fn) { try { fn(); pass++; console.log('  ok  ' + d); } catch (e) { fail++; console.log('  FAIL ' + d + ' -> ' + e.message); } }

function load() {
  const sbx = { window: { NV: {} }, console, Math };
  vm.runInNewContext(fs.readFileSync('js/data/balance.js', 'utf8'), sbx, { filename: 'b' });
  vm.runInNewContext(fs.readFileSync('js/data/gameData.js', 'utf8'), sbx, { filename: 'g' });
  vm.runInNewContext(fs.readFileSync('js/data/consumables.js', 'utf8'), sbx, { filename: 'c' });
  vm.runInNewContext(fs.readFileSync('js/render/consumableEffects.js', 'utf8'), sbx, { filename: 'r' });
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

t('voidBomb: normal vivo muere vía onKill exactamente una vez (sin dead manual)', () => {
  const NV = load();
  const enemies = [{ dead: false, hp: 40, maxHp: 80 }];
  const boss = { dead: false, hp: 400, maxHp: 400 };
  const killed = [];
  NV.voidBomb(enemies, boss, (e) => killed.push(e));
  if (killed.length !== 1 || killed[0] !== enemies[0]) throw new Error('onKill=' + killed.length);
  if (enemies[0].hp !== 0) throw new Error('hp=' + enemies[0].hp);
  if (enemies[0].dead) throw new Error('voidBomb marcó dead manualmente');
  if (boss.hp !== 400 - Math.round(400 * NV.BALANCE.VOID_BOMB_BOSS_DAMAGE_MULT)) throw new Error('boss hp=' + boss.hp);
});

t('voidBomb: entidad ya dead es ignorada (sin daño ni onKill)', () => {
  const NV = load();
  const enemies = [{ dead: true, hp: 10, maxHp: 10 }];
  const boss = { dead: true, hp: 500, maxHp: 500 };
  let calls = 0;
  NV.voidBomb(enemies, boss, () => { calls++; });
  if (calls !== 0) throw new Error('onKill=' + calls);
  if (enemies[0].hp !== 10) throw new Error('hp=' + enemies[0].hp);
  if (boss.hp !== 500) throw new Error('boss hp=' + boss.hp);
});

t('voidBomb: élite pierde 50% maxHp; si sobrevive no pasa por onKill', () => {
  const NV = load();
  const elite = { dead: false, isElite: true, hp: 400, maxHp: 400 };
  let calls = 0;
  NV.voidBomb([elite], null, () => { calls++; });
  if (elite.hp !== 400 - Math.round(400 * NV.BALANCE.VOID_BOMB_ELITE_DAMAGE_MULT)) throw new Error('hp=' + elite.hp);
  if (calls !== 0) throw new Error('onKill prematuro=' + calls);
});

t('voidBomb: élite (heavy) que llega a <=0 pasa por onKill exactamente una vez', () => {
  const NV = load();
  const heavy = { dead: false, hostileClass: 'heavy', hp: 50, maxHp: 100 };
  let calls = 0;
  NV.voidBomb([heavy], null, () => { calls++; });
  if (heavy.hp !== 0) throw new Error('hp=' + heavy.hp);
  if (calls !== 1) throw new Error('onKill=' + calls);
});

t('voidBomb: boss pierde 8% maxHp y JAMÁS pasa por el onKill normal', () => {
  const NV = load();
  const boss = { dead: false, hp: 1000, maxHp: 1000 };
  let calls = 0;
  NV.voidBomb([], boss, () => { calls++; });
  if (boss.hp !== 920) throw new Error('boss hp=' + boss.hp);
  if (calls !== 0) throw new Error('boss pasó por onKill=' + calls);
  if (boss.dead) throw new Error('boss marcado dead');
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
  if (!texts.some((t) => t.text === '+1 SHD BONUS' && t.color === '#ffd700')) throw new Error('sin feedback bounty');
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
  const speedBeforeOverdrive = player.speed;
  if (!NV.applyConsumable({ type: 'overdrive' }, ctx) || player.speed !== speedBeforeOverdrive || player.overdrive !== 5) throw new Error('overdrive');
  if (!NV.applyConsumable({ type: 'shield' }, ctx) || player.invuln !== 3) throw new Error('shield');
  if (!NV.applyConsumable({ type: 'bomb' }, ctx) || enemies[0].hp !== 0 || boss.hp !== 184) throw new Error('bomb');
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

t('Bomba: handler reenvía ctx.killEnemy, feedback visual y daño a enemigos + jefe', () => {
  const NV = load();
  let ex = 0, sw = 0;
  const killed = [];
  const player = { x: 10, y: 20 };
  const enemies = [{ dead: false, hp: 100, maxHp: 100 }, { dead: true, hp: 0, maxHp: 100 }];
  const boss = { dead: false, hp: 200, maxHp: 200 };
  const ctx = {
    player, enemies, boss, pickups: [], weaponPickups: [],
    addFloatText() {}, triggerFlash() {},
    spawnExplosion() { ex++; },
    spawnShockwave() { sw++; },
    killEnemy(e) { killed.push(e); e.dead = true; },
  };
  if (!NV.applyConsumable({ type: 'bomb' }, ctx)) throw new Error('handler inexistente');
  if (ex !== 1) throw new Error('spawnExplosion llamada ' + ex + ' veces');
  if (sw !== 1) throw new Error('spawnShockwave llamada ' + sw + ' veces');
  if (killed.length !== 1 || killed[0] !== enemies[0]) throw new Error('killEnemy no reenviado: ' + killed.length);
  if (!enemies[0].dead) throw new Error('normal no pasó por la ruta de muerte real');
  if (enemies[1].hp !== 0) throw new Error('no saltea muerto: hp=' + enemies[1].hp);
  if (boss.hp !== 184) throw new Error('boss hp=' + boss.hp);
  if (killed.some((e) => e === boss)) throw new Error('boss pasó por onKill normal');
});

t('Bomba #11: sin daño inmediato; el impacto se aplica al cruzar el umbral de detonación', () => {
  const NV = load();
  const killed = [];
  const pending = [];
  const enemies = [
    { dead: false, hp: 100, maxHp: 100 },
    { dead: false, isElite: true, hp: 400, maxHp: 400 },
    { dead: true, hp: 0, maxHp: 100 },
  ];
  const boss = { dead: false, hp: 1000, maxHp: 1000 };
  const player = { x: 10, y: 20 };
  NV.applyConsumable({ type: 'bomb' }, {
    player, enemies, boss, pickups: [], weaponPickups: [],
    addFloatText() {}, triggerFlash() {}, spawnExplosion() {}, spawnShockwave() {},
    killEnemy(e) { killed.push(e); e.dead = true; },
    registerBombImpact(imp) { pending.push(imp); },
  });
  if (pending.length !== 1) throw new Error('impacto pendiente no registrado: ' + pending.length);
  if (enemies[0].hp !== 100) throw new Error('daño inmediato durante la carga: hp=' + enemies[0].hp);
  if (enemies[1].hp !== 400) throw new Error('élite dañada durante la carga');
  if (boss.hp !== 1000) throw new Error('boss dañado durante la carga');
  if (killed.length !== 0) throw new Error('muerte durante la carga');
  // Antes del umbral (una fracción del delay): HP intacto.
  let queue = NV.tickBombImpacts(pending, Math.max(0.001, NV.bombImpactDelay() - 0.05));
  if (enemies[0].hp !== 100) throw new Error('daño antes del umbral de detonación');
  if (boss.hp !== 1000) throw new Error('boss dañado antes del umbral');
  // Cruce del umbral: aplica TODO el efecto mecánico una sola vez.
  queue = NV.tickBombImpacts(queue, 0.1);
  if (queue.length !== 0) throw new Error('impacto aplicado no se consumió de la cola');
  if (enemies[0].hp !== 0) throw new Error('normal hp=' + enemies[0].hp);
  if (!enemies[0].dead) throw new Error('normal no murió en el instante de expansión');
  if (killed.length !== 1 || killed[0] !== enemies[0]) throw new Error('onKill=' + killed.length);
  if (enemies[1].hp !== 400 - Math.round(400 * NV.BALANCE.VOID_BOMB_ELITE_DAMAGE_MULT)) throw new Error('élite hp=' + enemies[1].hp);
  if (boss.hp !== 1000 - Math.round(1000 * NV.BALANCE.VOID_BOMB_BOSS_DAMAGE_MULT)) throw new Error('boss hp=' + boss.hp);
  // Frames posteriores (duplicaría el daño): el impacto ya consumido no re-ejecuta.
  NV.tickBombImpacts(queue, 2);
  if (killed.length !== 1) throw new Error('onKill duplicado=' + killed.length);
  if (enemies[1].hp !== 200) throw new Error('élite dañada dos veces');
  if (boss.hp !== 920) throw new Error('boss dañado dos veces');
});

t('Bomba #11: timing mecánico usa la MISMA constante/lifetime que el VFX', () => {
  const NV = load();
  if (NV.BOMB_IMPACT_T == null) throw new Error('sin constante compartida BOMB_IMPACT_T');
  const expected = NV.CONSUMABLE_FX_LIFETIMES.bomb * NV.BOMB_IMPACT_T;
  if (Math.abs(NV.bombImpactDelay() - expected) > 1e-9) throw new Error('delay=' + NV.bombImpactDelay() + ' esperado=' + expected);
  // El cruce detecta el umbral aunque el frame no caiga exacto (>=).
  const imp = NV.createBombImpact([], null, null);
  NV.tickBombImpacts([imp], expected);
  if (!imp.applied) throw new Error('umbral exacto no dispara el impacto');
  // El renderer comparte la constante (mismo archivo, sin duplicación).
  const r = fs.readFileSync('js/render/consumableEffects.js', 'utf8');
  if (!r.includes('NV.BOMB_IMPACT_T')) throw new Error('renderer sin constante compartida');
  if (!r.includes('const DET = NV.BOMB_IMPACT_T')) throw new Error('drawBombActivation no usa la constante compartida');
});

t('game.js pasa killEnemy real al contexto del consumible', () => {
  const g = fs.readFileSync('js/game.js', 'utf8');
  if (!g.includes('spawnConsumableVfx, killEnemy, registerBombImpact')) throw new Error('game.js no pasa killEnemy/registerBombImpact a applyConsumable');
  if (!g.includes('updateBombImpacts(dt)')) throw new Error('game.js no tickea impactos con dt');
  if (!g.includes('let pendingBombImpacts = [];')) throw new Error('sin cola de impactos');
  if ((g.match(/pendingBombImpacts = \[\]/g) || []).length < 5) throw new Error('cleanup de impactos incompleto (reset/oleada/muerte/shop)');
  const c = fs.readFileSync('js/engine/consumables.js', 'utf8');
  if (!c.includes('NV.createBombImpact(ctx.enemies, ctx.boss, ctx.killEnemy)')) throw new Error('handler bomb no registra el impacto con ctx.killEnemy');
  // La sincronía vive en el game loop (dt): sin setTimeout/setInterval en el engine.
  if (/setTimeout|setInterval/.test(c)) throw new Error('sincronía con timers del DOM prohibida en engine');
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
  if (player.invuln !== 3) throw new Error('invuln=' + player.invuln);
  if (player.shield !== 3) throw new Error('player.shield=' + player.shield);
  if (player.invuln !== player.shield) throw new Error('invuln y shield desincronizados');
  if (!flashes.includes('#7cf8ff')) throw new Error('flash azul ausente: ' + JSON.stringify(flashes));
});

t('Escudo #11: duración central 3s, fuente única (invuln == shield == CONSUMABLES.shield.duration)', () => {
  const NV = load();
  if (NV.CONSUMABLES.shield.duration !== 3) throw new Error('duration=' + NV.CONSUMABLES.shield.duration);
  const player = { x: 1, y: 2 };
  NV.applyConsumable({ type: 'shield' }, {
    player, enemies: [], boss: null, pickups: [], weaponPickups: [],
    addFloatText() {}, triggerFlash() {},
  });
  if (player.invuln !== NV.CONSUMABLES.shield.duration || player.shield !== NV.CONSUMABLES.shield.duration) {
    throw new Error('invuln=' + player.invuln + ' shield=' + player.shield + ' duration=' + NV.CONSUMABLES.shield.duration);
  }
  // Ambos timers avanzan con dt en game.js: misma duración mecánica y visual.
  const g = fs.readFileSync('js/game.js', 'utf8');
  if (!g.includes('player.shield -= dt')) throw new Error('game.js no tickea player.shield');
  if (!g.includes('player.invuln -= dt') && !g.includes('player.invuln = Math.max(0, player.invuln - dt)')) throw new Error('game.js no tickea player.invuln');
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
  if (player.speed !== 200 || player.overdrive !== 5) throw new Error('overdrive debe renovar timer sin mutar speed');
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

t('render/player.js delega el escudo al renderer dedicado (guarda shield>0, sin exclusión de phase)', () => {
  const r = fs.readFileSync('js/render/player.js', 'utf8');
  if (!r.includes('if (player.shield > 0) {')) throw new Error('guarda shield ausente');
  if (r.includes('player.shield > 0 && player.phase')) throw new Error('exclusión de phase heredada');
  const fb = r.slice(r.indexOf('if (player.shield > 0) {'));
  const deleg = fb.indexOf("typeof NV.drawPlayerConsumableEffects === 'function'");
  const dashed = fb.indexOf('setLineDash([10, 6])');
  if (deleg < 0) throw new Error('sin delegación al renderer dedicado');
  if (dashed < 0) throw new Error('fallback de aura ausente');
  if (!(deleg < dashed)) throw new Error('aro punteado heredado como efecto principal');
  if (!fb.includes('char.size + 18')) throw new Error('fallback de aura ausente');
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
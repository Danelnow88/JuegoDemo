// Tests D1: consumibles nuevos — bomba, congelante, imán y recompensa (funciones puras).
const fs = require('fs'), vm = require('vm');
let pass = 0, fail = 0;
function t(d, fn) { try { fn(); pass++; console.log('  ok  ' + d); } catch (e) { fail++; console.log('  FAIL ' + d + ' -> ' + e.message); } }

function load() {
  const sbx = { window: { NV: {} }, console, Math };
  vm.runInNewContext(fs.readFileSync('js/data/balance.js', 'utf8'), sbx, { filename: 'b' });
  vm.runInNewContext(fs.readFileSync('js/data/gameData.js', 'utf8'), sbx, { filename: 'g' });
  vm.runInNewContext(fs.readFileSync('js/engine/enemies.js', 'utf8'), sbx, { filename: 'e' });
  vm.runInNewContext(fs.readFileSync('js/engine/pickups.js', 'utf8'), sbx, { filename: 'p' });
  return sbx.window.NV;
}

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

t('magnetCollect: acerca shards y armas al jugador y cuenta', () => {
  const NV = load();
  const pickups = [{ dead: false, x: 999, y: 999 }, { dead: true }];
  const wp = [{ dead: false, x: 500, y: 500 }];
  const n = NV.magnetCollect(pickups, wp, { x: 100, y: 100 });
  if (n !== 2) throw new Error('n=' + n);
  if (Math.abs(pickups[0].x - 100) > 5) throw new Error('shard no acercado x=' + pickups[0].x);
  if (Math.abs(wp[0].y - 100) > 5) throw new Error('arma no aceracada');
});

t('killEnemy aplica RECOMPENSA: doble score + shard extra', () => {
  const NV = load();
  let shards = [];
  const st = {
    e: { dead: false, score: 10, xp: 1, hp: 0, maxHp: 20, color: '#fff' },
    score: 0, player: { bounty: 5, xp: 0, xpToNext: 100, level: 1, luck: 0, x: 0, y: 0 },
    weaponLevels: {}, weaponKills: {}, currentWeapon: { id: 'w' }, WEAPON_KILLS_PER_LEVEL: 6,
    addFloatText(){}, spawnExplosion(){}, triggerFlash(){}, sfx: { explosion(){}, levelup(){} },
    pickups: shards, weaponKillProgress: () => 1,
  };
  const sc = NV.killEnemy(st);
  if (sc !== 20) throw new Error('score=' + sc + ' (esperaba doble 20)');
  if (shards.length < 1 || !shards.some((s) => s.value === 1)) throw new Error('sin shard bounty');
});

t('game.js conecta los 4 consumibles nuevos + defs', () => {
  const g = fs.readFileSync('js/game.js', 'utf8');
  for (const key of ['bomb', 'freeze', 'magnet', 'bounty']) {
    if (!g.includes("key: '" + key + "'")) throw new Error('falta def ' + key);
    if (!g.includes("item.type === '" + key + "'")) throw new Error('falta rama ' + key);
  }
});

console.log('RESULT consumables: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
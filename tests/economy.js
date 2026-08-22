// Smoke de rebalancing v36: recompensa de jefe, valor de shards y topes de tienda.
const fs = require('fs'), vm = require('vm');
const sbx = { window: { NV: {} }, console, Math };
for (const f of ['js/engine/boss.js', 'js/engine/pickups.js']) vm.runInNewContext(fs.readFileSync(f, 'utf8'), sbx, { filename: f });
const NV = sbx.window.NV;
let pass = 0, fail = 0;
function t(desc, fn) { try { fn(); pass++; console.log('  ok  ' + desc); } catch (e) { fail++; console.log('  FAIL ' + desc + ' -> ' + e.message); } }

t('jefe muerto paga 50 + wave*5 (wave 10 => 100)', () => {
  const boss = { pattern: 'chase', timer: 0, hp: 0, maxHp: 500, dead: false, name: 'B', color: '#f00', radius: 30 };
  const res = NV.updateBoss(0.1, { boss, W: 800, H: 600, score: 0, shards: 5, wave: 10, shake: 0,
    sfx: { bossAttack: {} }, enemies: [], bullets: [], MAX_BULLETS: 50, MAX_ENEMY_BULLETS: 50, enemyBulletCount: () => 0,
    showBanner: () => {}, triggerFlash: () => {}, spawnExplosion: () => {}, addFloatText: () => {},
    triggerWaveVictory: () => {}, runBossAttack: () => {}, spawnBossProj: () => {}, spawnMinion: () => {} });
  if (res.shards !== 105) throw new Error('shards=' + res.shards);
});

t('pickup con value suma ese valor (+3 élite)', () => {
  const player = { x: 50, y: 50 };
  const pickups = [{ x: 50, y: 50, type: 'shard', value: 3, dead: false }, { x: 55, y: 55, type: 'shard', dead: false }];
  let texts = [];
  const r = NV.updatePickups(0.1, pickups, player, (x, y, txt) => texts.push(txt), () => {});
  if (r.shards !== 4) throw new Error('shards=' + r.shards);
  if (!texts.includes('+3') || !texts.includes('+1')) throw new Error('texts=' + texts);
});

t('topes de tienda definidos: hp 8 / armor 5 / luck 7', () => {
  const g = fs.readFileSync('js/game.js', 'utf8');
  const m = g.match(/SHOP_CAPS\s*=\s*\{[^}]+\}/);
  if (!m) throw new Error('SHOP_CAPS no encontrado');
  for (const k of ['hp: 8', 'armor: 5', 'luck: 7']) if (!m[0].includes(k)) throw new Error('falta ' + k + ' en ' + m[0]);
  if (!g.includes('shopBought = {}')) throw new Error('reset por partida ausente');
});

console.log('RESULT economy: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
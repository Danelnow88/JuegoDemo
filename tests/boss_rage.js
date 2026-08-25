// Tests A2: reacción de jefes a golpes fuertes (globo de enojo con cooldown).
const fs = require('fs'), vm = require('vm');
let pass = 0, fail = 0;
function t(desc, fn) { try { fn(); pass++; console.log('  ok  ' + desc); } catch (e) { fail++; console.log('  FAIL ' + desc + ' -> ' + e.message); } }
const sbx = { window: { NV: {} }, console, Math };
vm.runInNewContext(fs.readFileSync('js/engine/boss.js', 'utf8'), sbx, { filename: 'boss.js' });
const NV = sbx.window.NV;
function mkBoss() { return { x: 0, y: 0, radius: 30, hp: 1000, maxHp: 1000, dead: false }; }
let texts = [];
const ft = (x, y, txt) => texts.push(txt);

t('golpe fuerte (<2.5% no) => >=2.5% dispara globo', () => {
  texts = []; const b = mkBoss();
  if (NV.bossHitReaction(b, 20, ft) !== false) throw new Error('20/1000=2% no debería');
  if (NV.bossHitReaction(b, 30, ft) !== true) throw new Error('30/1000=3% debería');
  if (!texts.some((t2) => t2.length > 0)) throw new Error('sin texto');
});

t('cooldown: el segundo golpe fuerte inmediato no repite; tras updateBoss vuelve', () => {
  texts = []; const b = mkBoss();
  NV.bossHitReaction(b, 50, ft);
  if (NV.bossHitReaction(b, 50, ft) !== false) throw new Error('no respeta cd');
  // decrementar el cd vía updateBoss (stub mínimo)
  const st = { boss: b, W: 800, H: 600, score: 0, shards: 0, wave: 1, shake: 0,
    enemies: [], bullets: [], MAX_BULLETS: 10, MAX_ENEMY_BULLETS: 10, enemyBulletCount: () => 0,
    sfx: { bossAttack: {} }, showBanner(){}, triggerFlash(){}, spawnExplosion(){}, addFloatText(){},
    triggerWaveVictory(){}, runBossAttack(){}, spawnBossProj(){}, spawnMinion(){} };
  for (let i = 0; i < 200; i++) NV.updateBoss(0.01, st); // 2s
  if (NV.bossHitReaction(b, 50, ft) !== true) throw new Error('cd nunca se agotó');
});

t('boss muerto o nulo: sin crash, devuelve false', () => {
  texts = [];
  if (NV.bossHitReaction(null, 999, ft) !== false) throw new Error('null');
  const d = mkBoss(); d.dead = true;
  if (NV.bossHitReaction(d, 999, ft) !== false) throw new Error('dead');
});

t('bullets.js invoca bossHitReaction al golpear', () => {
  if (!fs.readFileSync('js/engine/bullets.js', 'utf8').includes('NV.bossHitReaction')) throw new Error('no conectado');
});

console.log('RESULT boss_rage: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
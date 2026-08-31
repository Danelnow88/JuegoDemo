// Tests: muerte por proyectil del jefe dispara game over (bug v53: soloBoti revivia por regen).
const fs = require('fs'), vm = require('vm');
let pass = 0, fail = 0;
function t(desc, fn) { try { fn(); pass++; console.log('  ok  ' + desc); } catch (e) { fail++; console.log('  FAIL ' + desc + ' -> ' + e.message); } }
function load(f, sbx) {
  const code = fs.readFileSync(f, 'utf8');
  vm.runInNewContext(code, sbx, { filename: f });
}

function makeSt(bulletDamage) {
  const calls = { gameover: 0 };
  const player = { x: 100, y: 100, character: 'boti', hp: 5, maxHp: 200, bulwark: 0, invuln: 0, stun: 0, luck: 0 };
  const st = {
    bullets: [{ x: 100, y: 100, vx: 0, vy: 0, damage: bulletDamage, color: '#f00', radius: 5, isEnemy: true, dead: false }],
    W: 800, H: 600, player,
    enemies: [], boss: null, MAX_BULLETS: 50, MAX_ENEMY_BULLETS: 50, SHIELD_COOLDOWN: 3,
    CHARACTERS: { boti: { size: 20 } },
    computePlayerHit: (dmg) => ({ dmg }),
    addFloatText: () => {}, killEnemy: () => {}, applyKnockback: () => {}, spawnExplosion: () => {},
    gameOver: () => { calls.gameover++; },
  };
  return { st, calls, player };
}

t('módulo reporta gameOver cuando el proyectil enemigo baja hp a <=0', () => {
  const sbx = { window: { NV: {} }, console, Math };
  load('js/engine/bullets.js', sbx);
  const { st } = makeSt(10);
  const res = sbx.window.NV.updateBullets(0.016, st);
  if (!res.gameOver) throw new Error('res.gameOver=false');
});

t('regresión exacta del bug: wrapper debe LLAMAR gameOver() (boti no revive)', () => {
  const g = fs.readFileSync('js/game.js', 'utf8');
  // Debe existir la llamada dentro del wrapper de updateBullets
  if (!/function updateBullets[\s\S]{0,900}?if \(res\.gameOver\) \{ gameOver\(\); return; \}/.test(g)) {
    throw new Error('wrapper de updateBullets no invoca gameOver()');
  }
});

t('hpDebug: bala enemiga loguea HP DOWN cause enemy-bullet sin crash', () => {
  const sbx = { window: { NV: {} }, console, Math };
  load('js/engine/bullets.js', sbx);
  const logs = [];
  const origLog = console.log;
  console.log = (...a) => { logs.push(a.map((x) => (typeof x === 'object' && x !== null ? JSON.stringify(x) : String(x))).join(' ')); };
  try {
    const { st } = makeSt(10);
    st.hpDebug = true;
    sbx.window.NV.updateBullets(0.016, st);
  } finally {
    console.log = origLog;
  }
  const down = logs.filter((l) => l.includes('[hp-debug] HP DOWN'));
  if (down.length !== 1) throw new Error('esperaba 1 HP DOWN, vi ' + down.length + ': ' + logs.join(' | '));
  if (!down[0].includes('"cause":"enemy-bullet"')) throw new Error('cause incorrecta: ' + down[0]);
});

console.log('RESULT boss_death_fix: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
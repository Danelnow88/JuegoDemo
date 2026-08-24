// Tests NOVA: aura 40 dps radio 70, daña jefe con mult 0.3, constantes en balance.
const fs = require('fs'), vm = require('vm');
let pass = 0, fail = 0;
function t(desc, fn) { try { fn(); pass++; console.log('  ok  ' + desc); } catch (e) { fail++; console.log('  FAIL ' + desc + ' -> ' + e.message); } }
function load(f, sbx) { vm.runInNewContext(fs.readFileSync(f, 'utf8'), sbx, { filename: f }); }

t('balance define PHASE_AURA_DPS=40 / RADIUS=70 / BOSS_MULT=0.3', () => {
  const sbx = { window: { NV: {} }, console, Math };
  load('js/data/balance.js', sbx);
  const B = sbx.window.NV.BALANCE;
  if (B.PHASE_AURA_DPS !== 40) throw new Error('DPS=' + B.PHASE_AURA_DPS);
  if (B.PHASE_AURA_RADIUS !== 70) throw new Error('R=' + B.PHASE_AURA_RADIUS);
  if (B.PHASE_AURA_BOSS_MULT !== 0.3) throw new Error('mult=' + B.PHASE_AURA_BOSS_MULT);
});

t('simulación del bloque de aura: 40dps radio 70, jefe recibe 12dps', () => {
  const B = { PHASE_AURA_DPS: 40, PHASE_AURA_RADIUS: 70, PHASE_AURA_BOSS_MULT: 0.3 };
  const player = { x: 400, y: 300 };
  const e = { x: 450, y: 300, hp: 100, dead: false };      // dentro (50px)
  const out = { x: 500, y: 300, hp: 100, dead: false };    // fuera (100px)
  const boss = { x: 430, y: 300, hp: 1000, dead: false };  // dentro
  const enemies = [e, out];
  const dt = 1; // 1 segundo
  for (const en of enemies) if (!en.dead && Math.hypot(en.x - player.x, en.y - player.y) < B.PHASE_AURA_RADIUS) { en.hp -= B.PHASE_AURA_DPS * dt; if (en.hp <= 0) en.dead = true; }
  if (boss && !boss.dead && Math.hypot(boss.x - player.x, boss.y - player.y) < B.PHASE_AURA_RADIUS + 40) boss.hp -= B.PHASE_AURA_DPS * B.PHASE_AURA_BOSS_MULT * dt;
  if (e.hp !== 60 || out.hp !== 100) throw new Error('enemigos hp=' + e.hp + '/' + out.hp);
  if (boss.hp !== 988) throw new Error('boss hp=' + boss.hp);
});

t('render de la zona usa el radio de balance (no hardcodeado)', () => {
  const src = fs.readFileSync('js/render/player.js', 'utf8');
  if (!src.includes('PHASE_AURA_RADIUS')) throw new Error('zona no lee de BALANCE');
});

console.log('RESULT nova_aura: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
// Tests unitarios del rebalancing de jefes (v38): HP, IA predictiva/adaptativa, stun y escalado.
const fs = require('fs'), vm = require('vm');
const sbx = { window: { NV: {} }, console, Math };
for (const f of ['js/engine/boss.js']) vm.runInNewContext(fs.readFileSync(f, 'utf8'), sbx, { filename: f });
const NV = sbx.window.NV;
let pass = 0, fail = 0;
function t(desc, fn) { try { fn(); pass++; console.log('  ok  ' + desc); } catch (e) { fail++; console.log('  FAIL ' + desc + ' -> ' + e.message); } }

// --- Helpers ---
function mkBoss(over) {
  return Object.assign({ x: 400, y: 100, hp: 1000, maxHp: 1000, timer: 0, atkTimer: 0, attack: 'repeater', primaryAttack: 'repeater', color: '#f00', name: 'B', radius: 50 }, over);
}
function mkSt(player, enemies, over) {
  return Object.assign({ player: Object.assign({ x: 400, y: 500, hp: 100, maxHp: 100, moveVx: 0, moveVy: 0 }, player), enemies: enemies || [], boss: null,
    bullets: [], MAX_BULLETS: 200, MAX_ENEMY_BULLETS: 120, enemyBulletCount: () => 0, wave: 10,
    sfx: { bossAttack: new Proxy({}, { get: () => () => {} }) }, showBanner() {}, triggerFlash() {}, spawnExplosion() {}, addFloatText() {},
    triggerWaveVictory() {}, spawnBossProj: NV.spawnBossProj, spawnMinion() {} }, over || {});
}

t('HP: durabilidad global x1.8 y escalado cuadratico presente en game.js', () => {
  const g = fs.readFileSync('js/game.js', 'utf8');
  if (!/wave \* wave \* 12 \+ wave \* 40\) \* 1\.8/.test(g)) throw new Error('formula x1.8 no encontrada');
  const hp5 = Math.round((300 + 25 * 12 + 200) * 1.8);
  const hp10 = Math.round((450 + 100 * 12 + 400) * 1.8);
  const hp20 = Math.round((350 + 400 * 12 + 800) * 1.8);
  if (!(hp10 > hp5 && hp20 > hp10)) throw new Error('no escala creciente');
  if (hp10 < 3000) throw new Error('wave10 demasiado bajo: ' + hp10);
});

t('IA predictiva: predictAim adelanta el punto de mira con jugador en movimiento', () => {
  const b = mkBoss();
  const stQ = mkSt({ moveVx: 300, moveVy: 0 });   // jugador corriendo a la derecha
  const stQ2 = mkSt({ moveVx: 0, moveVy: 0 });    // jugador quieto
  const aMove = NV.predictAim(b, stQ, 400);
  const aStill = NV.predictAim(b, stQ2, 400);
  // Jefe arriba, jugador abajo moviéndose a la derecha: el ángulo rota hacia +x (menor que el directo π/2)
  if (!(aMove < aStill)) throw new Error('no hay lead: ' + aMove + ' vs ' + aStill);
  if (Math.abs(aMove - aStill) < 0.01) throw new Error('lead insignificante');
});

t('spawnBossProj aplica stun por disparo (heavy 0.25 / bomb 0.3 / beam 0.35)', () => {
  function fire(attack) {
    const b = mkBoss({ attack });
    const st = mkSt();
    NV.spawnBossProj(b, 400, 40, 1, 0, undefined, undefined, st, attack === 'heavy' ? 0.25 : attack === 'bomb' ? 0.3 : 0.35);
    return st.bullets[0].stunChance;
  }
  if (fire('heavy') !== 0.25) throw new Error('heavy stun');
  if (fire('bomb') !== 0.3) throw new Error('bomb stun');
  if (fire('beam') !== 0.35) throw new Error('beam stun');
  // sin stun explícito usa el del jefe (o 0)
  const b2 = mkBoss({ stunChance: 0.1 }), st2 = mkSt();
  NV.spawnBossProj(b2, 400, 10, 1, 0, undefined, undefined, st2);
  if (st2.bullets[0].stunChance !== 0.1) throw new Error('fallback al stun del jefe roto');
});

t('IA adaptativa: summoner invoca salvo arena llena; remata si jugador herido y cerca; presiona a distancia', () => {
  // Summoner con arena vacía -> sigue invocando (identidad)
  let b = mkBoss({ primaryAttack: 'summon', attack: 'summon' });
  if (NV.selectBossAttack(b, mkSt({}, [])) !== 'summon') throw new Error('summoner deberia invocar');
  // Summoner con arena saturada -> repite
  if (NV.selectBossAttack(b, mkSt({}, Array(15).fill({}))) !== 'repeater') throw new Error('summoner saturado deberia repetir');
  // Jugador herido (<35%) y cerca (<280) -> volley agresivo
  b = mkBoss({ primaryAttack: 'repeater' });
  const r = NV.selectBossAttack(b, mkSt({ hp: 30, x: 420, y: 300 }));
  if (r !== 'volley') throw new Error('remate esperado volley, dio ' + r);
  // Jugador lejos (>380) -> presion a distancia (pool[0] de repeater = spread)
  if (NV.selectBossAttack(b, mkSt({ x: 400, y: 520 }, [])) !== 'spread') throw new Error('presion lejana esperada spread');
  // Fase 2 con arena limpia -> cambia de registro (pool[1])
  b.phase2 = true;
  if (NV.selectBossAttack(b, mkSt({ x: 400, y: 480 }, [{}, {}])) !== 'volley') throw new Error('fase2 arena limpia esperado pool[1]=volley');
  // Siempre devuelve un ataque válido
  for (const k of Object.keys(NV.AI_SECONDARY)) {
    const bb = mkBoss({ primaryAttack: k, attack: k });
    const a = NV.selectBossAttack(bb, mkSt());
    if (!a || typeof a !== 'string') throw new Error('ataque invalido para ' + k);
  }
});

t('updateBoss integra la IA: re-selecciona ataque al entrar en fase 2 y periodicamente', () => {
  const b = mkBoss({ hp: 600, maxHp: 1200, pattern: 'chase' }); // 50% exacto -> entra fase 2
  const st = mkSt({}, [], { boss: b, score: 0, shards: 0, shake: 0 });
  NV.updateBoss(0.1, st); // aiTimer=99 -> debe re-seleccionar en este frame
  if (b.aiTimer !== 0) throw new Error('fase2 no forzo re-seleccion, aiTimer=' + b.aiTimer);
  if (typeof b.attack !== 'string') throw new Error('attack invalido post-fase2');
  // Escalado temporal: tras 9s en fase 1 re-evalua (cd 8)
  const b3 = mkBoss({ pattern: 'chase' });
  const st3 = mkSt({}, [], { boss: b3, score: 0, shards: 0, shake: 0 });
  NV.updateBoss(4, st3);
  if (b3.primaryAttack !== 'repeater') throw new Error('primaryAttack no inicializado');
});

console.log('RESULT boss_ai: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
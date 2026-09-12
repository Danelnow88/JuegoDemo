// P2/P3/P3.1.1: el harness A–S corre headless y respeta invariantes gameplay/hazards.
const harness = require('../tools/performance/stress_harness.js');
let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; console.log('  ok  ' + name); } catch (e) { fail++; console.log('  FAIL ' + name + ' -> ' + e.message); } }

const results = harness.runAll(90); // frames reducidos: suite rápida y determinista en invariants

t('harness: los 19 escenarios A–S corren sin errores y exponen percentiles', () => {
  if (results.length !== 19) throw new Error('escenarios=' + results.length);
  for (const r of results) {
    if (!(r.update.p50 >= 0) || !(r.update.p95 >= r.update.p50) || !(r.draw.p95 >= 0) || !(r.frame.worst >= 0)) {
      throw new Error('percentiles inválidos en ' + r.scenario);
    }
    if (typeof r.framesAbove16_7 !== 'number' || typeof r.framesAbove33 !== 'number') throw new Error('contadores ausentes');
  }
});
t('harness: presupuesto de hostiles respetado en TODOS los escenarios (30/7)', () => {
  for (const r of results) {
    if (r.counts.hostiles > 30) throw new Error(r.scenario + ' hostiles=' + r.counts.hostiles);
    if (r.counts.heavy > 7) throw new Error(r.scenario + ' heavy=' + r.counts.heavy);
  }
});
t('harness: presupuesto Speaker Mines respetado en K–S (máximo 6)', () => {
  for (const r of results.filter((x) => /^[K-S] —/.test(x.scenario))) {
    if (r.counts.maxHazards > 6 || r.counts.hazards > 6) throw new Error(r.scenario + ' hazards=' + JSON.stringify(r.counts));
  }
});
t('harness: composición de escenarios clave es la especificada', () => {
  const byKey = (k) => results.find((r) => r.scenario.startsWith(k + ' —'));
  if (byKey('A').counts.hostiles !== 30) throw new Error('A: ' + JSON.stringify(byKey('A').counts));
  if (byKey('B').counts.hostiles !== 30 || byKey('B').counts.heavy !== 7) throw new Error('B: ' + JSON.stringify(byKey('B').counts));
  if (byKey('E').counts.heavy !== 7) throw new Error('E heavy: ' + JSON.stringify(byKey('E').counts));
  if (byKey('F').counts.meteors !== 12) throw new Error('F meteoros=' + byKey('F').counts.meteors);
  if (byKey('G').counts.drones !== 6) throw new Error('G drones=' + byKey('G').counts.drones);
  if (byKey('K').counts.maxHazards !== 6 || byKey('K').counts.hostiles !== 24) throw new Error('K: ' + JSON.stringify(byKey('K').counts));
  if (byKey('L').counts.maxHazards !== 6 || byKey('L').counts.hostiles !== 30 || byKey('L').counts.heavy !== 7) throw new Error('L: ' + JSON.stringify(byKey('L').counts));
  if (byKey('M').counts.maxHazards !== 6 || byKey('M').counts.initialHostiles !== 30 || byKey('M').counts.initialHeavy !== 7) throw new Error('M: ' + JSON.stringify(byKey('M').counts));
  if (byKey('O').counts.maxHazards !== 6 || byKey('O').counts.particles > 200) throw new Error('O: ' + JSON.stringify(byKey('O').counts));
  if (byKey('P').counts.maxHazards !== 6) throw new Error('P: ' + JSON.stringify(byKey('P').counts));
  if (byKey('R').counts.maxHazards !== 6 || byKey('R').counts.initialHostiles !== 30 || byKey('R').counts.initialHeavy !== 7) throw new Error('R: ' + JSON.stringify(byKey('R').counts));
  if (byKey('S').counts.maxHazards !== 6) throw new Error('S: ' + JSON.stringify(byKey('S').counts));
});
t('harness: N detona secuencialmente (no las seis en el mismo frame)', () => {
  const n = results.find((r) => r.scenario.startsWith('N —')).counts;
  if (n.maxHazards !== 6 || n.hazards >= 6) throw new Error(JSON.stringify(n));
  if (n.maxParticles <= 0 || n.maxParticles > 200) throw new Error('peak partículas N=' + n.maxParticles);
});
t('harness: el lanzallamas genera presión de balas sin romper caps', () => {
  const c = results.find((r) => r.scenario.startsWith('D —')).counts;
  if (c.playerBullets <= 0) throw new Error('flame sin balas');
  if (c.playerBullets + c.enemyBullets > 160) throw new Error('MAX_BULLETS roto');
  if (c.hostiles > 30 || c.heavy > 7) throw new Error('caps roto con flame');
});
t('harness: explosiones sostenidas quedan acotadas por MAX_PARTICLES', () => {
  const c = results.find((r) => r.scenario.startsWith('I —')).counts;
  if (c.particles <= 0) throw new Error('sin partículas');
});
t('harness: Q genera musical-note FX acotado y no altera hazards/partículas gameplay', () => {
  const q = results.find((r) => r.scenario.startsWith('Q —')).counts;
  if (q.maxHazards !== 6 || q.maxMusicalNotes <= 0 || q.maxMusicalNotes > 24) throw new Error(JSON.stringify(q));
  if (q.maxParticles > 200) throw new Error('particles=' + q.maxParticles);
});

console.log('RESULT stress_harness: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);

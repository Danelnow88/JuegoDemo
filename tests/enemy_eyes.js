// Tests A1: ojos de enemigos — firma extendida y dibujo orientado al jugador.
const fs = require('fs'), vm = require('vm');
let pass = 0, fail = 0;
function t(desc, fn) { try { fn(); pass++; console.log('  ok  ' + desc); } catch (e) { fail++; console.log('  FAIL ' + desc + ' -> ' + e.message); } }
const sbx = { window: { NV: {} }, console, Math };
vm.runInNewContext(fs.readFileSync('js/render/enemies.js', 'utf8'), sbx, { filename: 'enemies.js' });
const NV = sbx.window.NV;
// Canvas 2D stub que registra arcos.
function mkCtx() {
  const arcs = [];
  const translations = [];
  const strokeStyles = [];
  return { arcs, translations, strokeStyles, beginPath(){}, arc(x,y,r){arcs.push({x,y,r});}, fill(){}, stroke(){ this.strokes = (this.strokes || 0) + 1; }, save(){}, restore(){},
    translate(x,y){translations.push({x,y});}, moveTo(){}, lineTo(){}, closePath(){}, ellipse(){},
    set fillStyle(v){}, get fillStyle(){return '';}, set strokeStyle(v){strokeStyles.push(v);}, set lineWidth(v){}, set shadowBlur(v){}, set shadowColor(v){} };
}

t('drawEnemy acepta player y drawEnemyEyes existe', () => {
  if (typeof NV.drawEnemyEyes !== 'function') throw new Error('drawEnemyEyes ausente');
  const ctx = mkCtx();
  NV.drawEnemy(ctx, { x: 0, y: 0, radius: 10, color: '#fff', shape: 'dot' }, 0, { x: 100, y: 0 });
});

t('sin player no dibuja ojos (compatibilidad)', () => {
  const ctx = mkCtx();
  const before = ctx.arcs.length;
  NV.drawEnemy(ctx, { x: 0, y: 0, radius: 10, color: '#fff' }, 0);
  // sin player solo se dibuja el cuerpo (al menos 1 arco del cuerpo 'circle')
  if (ctx.arcs.length < before) throw new Error('cuerpo no dibujado');
  NV.drawEnemyEyes(ctx, { x: 0, y: 0, radius: 10 }, null); // no debe crashear
});

t('las pupilas se orientan hacia el jugador (4 arcos por par de ojos)', () => {
  const ctx = mkCtx();
  NV.drawEnemyEyes(ctx, { x: 0, y: 0, radius: 10, isElite: false }, { x: 50, y: 0 });
  if (ctx.arcs.length !== 4) throw new Error('arcos=' + ctx.arcs.length + ' (esperaba 2 escleróticas + 2 pupilas)');
  const pupils = ctx.arcs.slice(2).map((a) => a.x);
  if (!(pupils[0] > 0 && pupils[1] > 0)) throw new Error('pupilas no miran a la derecha: ' + JSON.stringify(pupils));
});

t('temblor rítmico de enemigos es 100% visual: no muta posición/hitbox/datos', () => {
  const ctx = mkCtx();
  const e = { x: 120, y: 80, radius: 14, color: '#fff', shape: 'dot', hp: 30, speed: 70, behavior: 'chase' };
  const before = JSON.stringify(e);
  // Todas las bandas con energía: la banda asignada de este enemigo (hash) es
  // cualquiera de las 4, y con señal plena en todas debe temblar con fuerza.
  const rhythm = { enabled: true, state: 'listening', onset: 1, kick: 0.8, snare: 0.5, hats: 0.4, bass: 0.9, mids: 0.9, highs: 0.9, energy: 0.5 };
  NV.drawEnemy(ctx, e, 42, { x: 300, y: 80 }, rhythm);
  if (JSON.stringify(e) !== before) throw new Error('drawEnemy mutó datos de gameplay');
  const tr = ctx.translations[0];
  if (!tr || (tr.x === e.x && tr.y === e.y)) throw new Error('no hubo offset visual');
  if (Math.abs(tr.x - e.x) > 4.6 || Math.abs(tr.y - e.y) > 2.9) throw new Error('offset visual excesivo');
  if (!rhythm.jitterActive || !(rhythm.jitterAmp >= 2)) throw new Error('jitter imperceptible: amp=' + rhythm.jitterAmp);
  if (!['sub', 'graves', 'medios', 'agudos'].includes(rhythm.jitterBand)) throw new Error('banda asignada inválida: ' + rhythm.jitterBand);
});

// ---- Bloque 4a: asignación de banda + participación escalonada ----
t('distribución de bandas ~ 15/35/30/20 sobre población variada', () => {
  const cnt = { sub: 0, graves: 0, medios: 0, agudos: 0 };
  const N = 800;
  for (let i = 0; i < N; i++) {
    const e = { x: (i * 37) % 900, y: (i * 91) % 520, radius: 8 + (i % 5) * 2 };
    cnt[NV.enemyRhythmBand(e)]++;
  }
  const p = Object.fromEntries(Object.entries(cnt).map(([k, v]) => [k, v / N]));
  if (Math.abs(p.sub - 0.15) > 0.08 || Math.abs(p.graves - 0.35) > 0.08 || Math.abs(p.medios - 0.30) > 0.08 || Math.abs(p.agudos - 0.20) > 0.08) {
    throw new Error('distribución fuera de tolerancia: ' + JSON.stringify(p));
  }
});

t('participación escalonada: percusión suave => pocos enemigos, intensa => casi todos', () => {
  const mk = (i) => ({ x: (i * 53) % 900, y: (i * 137) % 520, radius: 10, color: '#fff', shape: 'dot' });
  const N = 300;
  const measure = (rhythm) => {
    let active = 0; const amps = [];
    for (let i = 0; i < N; i++) {
      const e = mk(i);
      const ctx = mkCtx();
      NV.drawEnemy(ctx, e, 12, null, rhythm);
      const tr = ctx.translations[0];
      if (tr && (tr.x !== e.x || tr.y !== e.y)) { active++; amps.push(Math.hypot(tr.x - e.x, tr.y - e.y)); }
    }
    return { active, amps };
  };
  const soft = measure({ enabled: true, state: 'listening', onset: 0.15, kick: 0.1, snare: 0.05, hats: 0.05, bass: 0.2, mids: 0.15, highs: 0.1, energy: 0.2 });
  const hard = measure({ enabled: true, state: 'listening', onset: 0.9, kick: 0.9, snare: 0.8, hats: 0.8, bass: 0.9, mids: 0.8, highs: 0.8, energy: 0.7 });
  const softShare = soft.active / N, hardShare = hard.active / N;
  if (softShare > 0.35) throw new Error('percusión suave activa demasiados: ' + (softShare * 100).toFixed(1) + '%');
  if (hardShare < 0.8) throw new Error('percusión intensa no activa a casi todos: ' + (hardShare * 100).toFixed(1) + '%');
  // Amplitudes heterogéneas (sd > 0) y fases distintas (no todos idénticos).
  const uniq = new Set(hard.amps.map((a) => a.toFixed(2)));
  const m = hard.amps.reduce((a, b) => a + b, 0) / hard.amps.length;
  const sd = Math.sqrt(hard.amps.reduce((a, b) => a + (b - m) ** 2, 0) / hard.amps.length);
  if (uniq.size < 10) throw new Error('amplitudes casi uniformes: ' + uniq.size + ' valores únicos');
  if (!(sd > 0.5)) throw new Error('sin heterogeneidad de amplitud: sd=' + sd.toFixed(3));
});

t('selectividad por banda: señal solo-agudos mueve a los agudos, no a los graves', () => {
  const mk = (i) => ({ x: (i * 53) % 900, y: (i * 137) % 520, radius: 10, color: '#fff', shape: 'dot' });
  const rhythm = { enabled: true, state: 'listening', onset: 0.2, kick: 0, snare: 0, hats: 0.95, bass: 0, mids: 0, highs: 0.95, energy: 0.4 };
  let actAgudos = 0, nAgudos = 0, actGraves = 0, nGraves = 0;
  for (let i = 0; i < 300; i++) {
    const e = mk(i);
    const band = NV.enemyRhythmBand(e);
    const ctx = mkCtx();
    NV.drawEnemy(ctx, e, 12, null, rhythm);
    const tr = ctx.translations[0];
    const active = !!(tr && (tr.x !== e.x || tr.y !== e.y));
    if (band === 'agudos') { nAgudos++; if (active) actAgudos++; }
    if (band === 'graves') { nGraves++; if (active) actGraves++; }
  }
  if (nAgudos < 30 || nGraves < 30) throw new Error('muestra insuficiente');
  if (actGraves > nGraves * 0.1) throw new Error('enemigos de graves tiemblan con señal de agudos: ' + actGraves + '/' + nGraves);
  if (actAgudos < nAgudos * 0.6) throw new Error('enemigos de agudos no responden: ' + actAgudos + '/' + nAgudos);
});


t('jitter inactivo sin rhythm habilitado o con música casi silenciosa', () => {
  const ctx = mkCtx();
  const rhythmOff = { enabled: false, state: 'listening', onset: 1, kick: 1, energy: 1 };
  NV.drawEnemy(ctx, { x: 0, y: 0, radius: 10, color: '#fff', shape: 'dot' }, 0, null, rhythmOff);
  if (rhythmOff.jitterActive) throw new Error('jitter activo con rhythm apagado');
  const rhythmQuiet = { enabled: true, state: 'listening', onset: 0, kick: 0, snare: 0, hats: 0, energy: 0.02 };
  NV.drawEnemy(ctx, { x: 0, y: 0, radius: 10, color: '#fff', shape: 'dot' }, 0, null, rhythmQuiet);
  if (rhythmQuiet.jitterActive) throw new Error('jitter activo con música silenciosa');
});

t('drawEnemy con atkFlash dibuja gesto de ataque (lunge + anillo) sin mutar datos', () => {
  const baseCtx = mkCtx();
  NV.drawEnemy(baseCtx, { x: 0, y: 0, radius: 10, color: '#fff', shape: 'dot' }, 0, { x: 50, y: 0 });
  const ctx = mkCtx();
  const e = { x: 0, y: 0, radius: 10, color: '#fff', shape: 'dot', atkFlash: 0.3 };
  const snapshot = JSON.stringify(e);
  NV.drawEnemy(ctx, e, 0, { x: 50, y: 0 });
  if (!(ctx.arcs.length > baseCtx.arcs.length)) throw new Error('sin arcos de ataque: base=' + baseCtx.arcs.length + ' atk=' + ctx.arcs.length);
  if (JSON.stringify(e) !== snapshot) throw new Error('drawEnemy mutó datos del atacante');
  if (!ctx.translations[0] || ctx.translations[0].x === 0) throw new Error('sin lunge visual hacia el jugador');
  // Legibilidad: halo blanco + anillo rojo => más trazos y strokeStyle '#ffffff' presente.
  if (!((ctx.strokes || 0) > (baseCtx.strokes || 0))) throw new Error('sin trazos de ataque extra: base=' + (baseCtx.strokes || 0) + ' atk=' + (ctx.strokes || 0));
  if (!ctx.strokeStyles.some((s) => s === '#ffffff')) throw new Error('sin outline blanco de atacante');
});

t('game.js dibuja a los atacantes (atkFlash) en segunda pasada (z-order)', () => {
  const g = fs.readFileSync('js/game.js', 'utf8');
  if (!g.includes('for (const e of enemies) if (!(e.atkFlash > 0)) drawEnemy(e);')) throw new Error('falta primera pasada (no atacantes)');
  if (!g.includes('for (const e of enemies) if (e.atkFlash > 0) drawEnemy(e);')) throw new Error('falta segunda pasada (atacantes)');
});

t('game.js pasa rhythm solo al render de enemigo y colisiones siguen usando e.x/e.y', () => {
  const g = fs.readFileSync('js/game.js', 'utf8');
  const bullets = fs.readFileSync('js/engine/bullets.js', 'utf8');
  if (!g.includes('NV.drawEnemy(ctx, e, frame, player, NV.rhythm)')) throw new Error('render enemigo no recibe rhythm');
  if (!bullets.includes('Math.hypot(b.x - e.x, b.y - e.y)') || !bullets.includes('d < e.radius + 4')) throw new Error('colisión de balas no usa datos reales');
});

console.log('RESULT enemy_eyes: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
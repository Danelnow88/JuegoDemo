// Tests #11: identidad visual dedicada por consumible (solo render/estructura).
const fs = require('fs'), vm = require('vm'), assert = require('assert');
let pass = 0, fail = 0;
function t(desc, fn) {
  try { fn(); pass++; console.log('  ok  ' + desc); }
  catch (e) { fail++; console.log('  FAIL ' + desc + ' -> ' + e.message); }
}

const gameSource = fs.readFileSync('js/game.js', 'utf8');
const playerSource = fs.readFileSync('js/render/player.js', 'utf8');
const enemySource = fs.readFileSync('js/render/enemies.js', 'utf8');
const spectralSource = fs.readFileSync('js/render/spectralEnemies2D.js', 'utf8');
const consumablesSource = fs.readFileSync('js/engine/consumables.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');

function loadNV() {
  const sbx = { window: { NV: {} }, console, Math };
  vm.runInNewContext(fs.readFileSync('js/data/gameData.js', 'utf8'), sbx, { filename: 'gameData.js' });
  // #11: la fuente neutral del timing (BOMB_FX_LIFETIME/BOMB_IMPACT_T) vive en
  // js/data/consumables.js y debe cargarse ANTES del renderer, como en index.html.
  vm.runInNewContext(fs.readFileSync('js/data/consumables.js', 'utf8'), sbx, { filename: 'data/consumables.js' });
  vm.runInNewContext(fs.readFileSync('js/render/consumableEffects.js', 'utf8'), sbx, { filename: 'consumableEffects.js' });
  return sbx.window.NV;
}
function loadConsumables() {
  const sbx = { window: { NV: {} }, console, Math };
  vm.runInNewContext(fs.readFileSync('js/data/consumables.js', 'utf8'), sbx, { filename: 'consumables.js' });
  vm.runInNewContext(fs.readFileSync('js/engine/pickups.js', 'utf8'), sbx, { filename: 'pickups.js' });
  sbx.window.NV.voidBomb = () => {};
  sbx.window.NV.freezeEnemies = () => {};
  sbx.window.NV.magnetCollect = () => 0;
  vm.runInNewContext(consumablesSource, sbx, { filename: 'consumables.js' });
  return sbx.window.NV;
}
function loadPlayerNV() {
  const sbx = { window: { NV: {} }, console, Math };
  vm.runInNewContext(fs.readFileSync('js/data/gameData.js', 'utf8'), sbx, { filename: 'gameData.js' });
  vm.runInNewContext(fs.readFileSync('js/data/consumables.js', 'utf8'), sbx, { filename: 'data/consumables.js' });
  vm.runInNewContext(fs.readFileSync('js/render/consumableEffects.js', 'utf8'), sbx, { filename: 'consumableEffects.js' });
  vm.runInNewContext(playerSource, sbx, { filename: 'player.js' });
  return sbx.window.NV;
}
function mkCtx() {
  const calls = { arcs: [], fills: 0, strokes: 0, save: 0, restore: 0, fillStyles: [], strokeStyles: [], shadowColors: [] };
  const ctx = {
    calls, save() { calls.save++; }, restore() { calls.restore++; },
    translate() {}, rotate() {}, scale() {}, setLineDash() {},
    beginPath() {}, closePath() {}, moveTo() {}, lineTo() {},
    quadraticCurveTo() {}, bezierCurveTo() {},
    arc(x, y, r) { calls.arcs.push({ x, y, r }); },
    ellipse() {}, fill() { calls.fills++; }, stroke() { calls.strokes++; },
    moveTo() {}, lineTo() { calls.lineTos = (calls.lineTos || 0) + 1; },
    fillRect() { calls.fills++; },
    createRadialGradient() { return { addColorStop() {} }; },
  };
  Object.defineProperties(ctx, {
    fillStyle: { set(v) { calls.fillStyles.push(v); }, get() { return calls.fillStyles.at(-1); } },
    strokeStyle: { set(v) { calls.strokeStyles.push(v); }, get() { return calls.strokeStyles.at(-1); } },
    shadowColor: { set(v) { calls.shadowColors.push(v); }, get() { return calls.shadowColors.at(-1); } },
  });
  return ctx;
}
function stateOf(src) {
  const save = (src.match(/\.save\(\)/g) || []).length;
  const restore = (src.match(/\.restore\(\)/g) || []).length;
  return { save, restore };
}
// Extrae exactamente UN helper (asignación NV.x = function o function x) hasta su
// cierre al nivel de módulo, evitando ventanas de longitud fija que cortan bloques.
function fnBlock(src, marker) {
  const start = src.indexOf(marker);
  if (start < 0) throw new Error('falta ' + marker);
  const end = src.indexOf('\n  }', start);
  return src.slice(start, end < 0 ? src.length : end + 4);
}
t('renderer dedicado existe y expone la API de consumibles', () => {
  if (!html.includes('js/render/consumableEffects.js')) throw new Error('script no cargado en index.html');
  if (!/js\/render\/consumableEffects\.js\?v=[^"']+/.test(html)) throw new Error('renderer sin cache-buster de versión');
  // Orden real exigido por el PLAN: el renderer dedicado debe cargarse ANTES de
  // los renderers que lo invocan (spectral, enemies, player).
  const order = ['consumableEffects.js', 'spectralEnemies2D.js', 'enemies.js', 'player.js'];
  let last = -1;
  for (const name of order) {
    const i = html.indexOf(name);
    if (i < 0) throw new Error('falta ' + name);
    if (i < last) throw new Error('orden invalido antes de ' + name);
    last = i;
  }
  const NV = loadNV();
  for (const name of ['drawPlayerConsumableEffects', 'drawConsumableActivation', 'drawFrozenStatus', 'spawnConsumableFx', 'updateConsumableFx']) {
    if (typeof NV[name] !== 'function') throw new Error('falta ' + name);
  }
});

t('potion/bomb/freeze/bounty/overdrive/shield notifican evento visual propio', () => {
  const NV = loadConsumables();
  const seen = [];
  const player = { x: 1, y: 2, hp: 10, maxHp: 100, overdrive: 0 };
  const ctx = { player, enemies: [], boss: null, pickups: [], weaponPickups: [], addFloatText() {}, triggerFlash() {}, spawnConsumableVfx(type) { seen.push(type); } };
  NV.applyConsumable({ type: 'potion' }, ctx);
  NV.applyConsumable({ type: 'overdrive' }, ctx);
  NV.applyConsumable({ type: 'shield' }, ctx);
  NV.applyConsumable({ type: 'bomb' }, ctx);
  NV.applyConsumable({ type: 'freeze' }, ctx);
  NV.applyConsumable({ type: 'bounty' }, ctx);
  for (const type of ['potion', 'overdrive', 'shield', 'bomb', 'freeze', 'bounty']) {
    if (!seen.includes(type)) throw new Error('sin evento ' + type);
  }
  if (seen.includes('magnet')) throw new Error('magnet no debe crear evento nuevo');
});

t('potion no crea estado persistente', () => {
  const NV = loadConsumables();
  const player = { x: 1, y: 1, hp: 10, maxHp: 100 };
  NV.applyConsumable({ type: 'potion' }, { player, addFloatText() {}, triggerFlash() {}, spawnConsumableVfx() {} });
  for (const key of ['overdrive', 'shield', 'bounty']) {
    if (player[key]) throw new Error('potion creo estado ' + key);
  }
  if (!/potion\(ctx\)[\s\S]{0,300}?spawnConsumableVfx/.test(consumablesSource)) throw new Error('potion sin evento');
});

t('overdrive usa lenguaje direccional dependiente del movimiento', () => {
  if (!playerSource.includes("NV.drawPlayerConsumableEffects(ctx, player, char, frame, 'behind')")) throw new Error('sin capa behind');
  const NV = loadNV();
  const right = mkCtx();
  NV.drawPlayerConsumableEffects(right, { overdrive: 5, moveVx: 120, moveVy: 0, lastMoveDirX: 1, lastMoveDirY: 0 }, { size: 20 }, 10, 'behind');
  const left = mkCtx();
  NV.drawPlayerConsumableEffects(left, { overdrive: 5, moveVx: -120, moveVy: 0, lastMoveDirX: -1, lastMoveDirY: 0 }, { size: 20 }, 10, 'behind');
  if (right.calls.strokes === 0 || left.calls.strokes === 0) throw new Error('overdrive no dibuja estelas');
  const idle = mkCtx();
  NV.drawPlayerConsumableEffects(idle, { overdrive: 5, moveVx: 0, moveVy: 0, lastMoveDirX: 0, lastMoveDirY: -1 }, { size: 20 }, 10, 'behind');
  if (idle.calls.strokes === 0) throw new Error('overdrive quieto sin energia minima');
});

t('overdrive ya no usa el aro generico como identidad principal', () => {
  if (!playerSource.includes('Overdrive persistente heredado')) throw new Error('aro viejo sigue como principal');
  if (playerSource.includes("if (player.overdrive > 0) {")) throw new Error('bloque viejo sin guarda');
});

t('shield persistente: campo visible con shield>0, ambas capas y coexiste con Phase', () => {
  const NV = loadNV();
  const on = mkCtx();
  NV.drawPlayerConsumableEffects(on, { shield: 2, phase: 0 }, { size: 20 }, 7, 'front');
  if (on.calls.strokes === 0 || on.calls.fills === 0) throw new Error('shield no dibuja campo persistente');
  const onB = mkCtx();
  NV.drawPlayerConsumableEffects(onB, { shield: 2, phase: 0 }, NV.CHARACTERS.boti, 7, 'behind');
  if (onB.calls.fills === 0) throw new Error('sin capa behind (back shell + placas posteriores)');
  const off = mkCtx(), offB = mkCtx();
  NV.drawPlayerConsumableEffects(off, { shield: 0, phase: 0 }, NV.CHARACTERS.boti, 7, 'front');
  NV.drawPlayerConsumableEffects(offB, { shield: 0, phase: 0 }, NV.CHARACTERS.boti, 7, 'behind');
  if (off.calls.fills !== 0 || off.calls.strokes !== 0 || offB.calls.fills !== 0 || offB.calls.strokes !== 0) throw new Error('shield dibuja con timer 0');
  // coexistencia con Phase: NO oculta el campo (guarda es sólo player.shield > 0)
  const phased = mkCtx();
  NV.drawPlayerConsumableEffects(phased, { shield: 2, phase: 1 }, NV.CHARACTERS.boti, 7, 'front');
  if (phased.calls.strokes === 0 || phased.calls.fills === 0) throw new Error('phase oculta el shield');
});

t('shield: silueta facetada multi-vértice con placas (nunca círculo ni dashed ring)', () => {
  const src = fs.readFileSync('js/render/consumableEffects.js', 'utf8');
  const fieldBlock = src.slice(src.indexOf('function drawShieldField'), src.indexOf('function drawShieldDeploy'));
  if ((fieldBlock.match(/ctx\.arc\(/g) || []).length > 0) throw new Error('shell principal usa arc circular');
  if (fieldBlock.includes('setLineDash')) throw new Error('dashed ring como identidad');
  const NV = loadNV();
  const p = { maxHp: 100, x: 3, y: 4 };
  const field = NV.shieldFieldOf(p, 20, 'full');
  if (field.verts.length < 10 || field.verts.length > 14) throw new Error('vértices fuera de 10–14: ' + field.verts.length);
  if (new Set(field.verts.map((v) => v.rr.toFixed(4))).size < 5) throw new Error('silueta casi circular');
  if (field.plates.length < 3) throw new Error('sin placas: ' + field.plates.length);
  if (field.edges.filter((e) => e.on).length < 5) throw new Error('borde sin secciones');
  if (field.highlights.length < 2) throw new Error('sin highlights');
  const ctx = mkCtx();
  NV.drawPlayerConsumableEffects(ctx, { shield: 2, phase: 0 }, NV.CHARACTERS.boti, 7, 'front');
  if ((ctx.calls.lineTos || 0) < 10) throw new Error('campo sin geometría facetada');
  const again = NV.shieldFieldOf(p, 20, 'full');
  if (JSON.stringify(again.verts) !== JSON.stringify(field.verts)) throw new Error('estructura inestable entre frames');
});

t('shield: usa char.size real y LOW conserva campo facetado + placas', () => {
  const NV = loadNV();
  const f20 = NV.shieldFieldOf({ maxHp: 100, x: 0, y: 0 }, 20, 'full');
  const f34 = NV.shieldFieldOf({ maxHp: 100, x: 0, y: 0 }, 34, 'full');
  if (!(f34.R > f20.R)) throw new Error('no escala con char.size');
  const lo = NV.shieldFieldOf({ maxHp: 100, x: 0, y: 0 }, 20, 'minimal');
  if (lo.plates.length < 3) throw new Error('LOW sin placas');
  const ctx = mkCtx();
  NV.drawPlayerConsumableEffects(ctx, { shield: 2, phase: 0 }, NV.CHARACTERS.nova, 7, 'front');
  if ((ctx.calls.lineTos || 0) < 8) throw new Error('LOW degradó a círculo');
  const dep = mkCtx();
  NV.drawPlayerConsumableEffects(dep, { shield: 2, phase: 0 }, NV.CHARACTERS.boti, 7, 'front');
  if (dep.calls.fills === 0) throw new Error('campo sin shell volumétrico');
});

t('shield: activación "desplegado" en 4 fases y duración 3s intacta', () => {
  const src = fs.readFileSync('js/render/consumableEffects.js', 'utf8');
  const deploy = src.slice(src.indexOf('function drawShieldDeploy'), src.indexOf('NV.bombMaxRadius'));
  for (const marker of ['FASE 1', 'FASE 2', 'FASE 3', 'FASE 4']) {
    if (!deploy.includes(marker)) throw new Error('sin ' + marker);
  }
  const NV = loadNV();
  const early = mkCtx(), mid = mkCtx(), late = mkCtx();
  const ev = (t) => ({ type: 'shield', x: 0, y: 0, life: (1 - t) * 0.95, duration: 0.95, size: 20 });
  if (!NV.drawConsumableActivation(early, ev(0.05), {}, NV.CHARACTERS.boti, 3)) throw new Error('deploy no dibuja');
  NV.drawConsumableActivation(mid, ev(0.5), {}, NV.CHARACTERS.boti, 3);
  NV.drawConsumableActivation(late, ev(0.75), {}, NV.CHARACTERS.boti, 3);
  if (mid.calls.fills === 0) throw new Error('placas no se ensamblan');
  if (late.calls.strokes === 0) throw new Error('sin flare');
  const sbx = { window: { NV: {} }, console };
  vm.runInNewContext(fs.readFileSync('js/data/consumables.js', 'utf8'), sbx, { filename: 'consumables.js' });
  if (sbx.window.NV.CONSUMABLES.shield.duration !== 3) throw new Error('duration != 3');
  if (!fs.readFileSync('js/engine/consumables.js', 'utf8').includes('CONSUMABLES.shield.duration')) throw new Error('engine no usa la duración central');
});

t('shield: activación y persistencia usan el color visual dominante real', () => {
  const NV = loadNV();
  const expected = { boti: '#00f0ff', nova: '#ff3300', rook: '#eab308', swarm: '#ffee77' };
  for (const id of Object.keys(expected)) {
    const char = NV.CHARACTERS[id];
    if (!char || char.shieldColor !== expected[id]) throw new Error(id + ' shieldColor real inesperado');
    const persistent = mkCtx();
    NV.drawPlayerConsumableEffects(persistent, { shield: 2, phase: 0 }, char, 7, 'front');
    if (!persistent.calls.strokeStyles.includes(char.shieldColor)) throw new Error(id + ' persistente no usa shieldColor');
    const activation = mkCtx();
    NV.drawConsumableActivation(activation, { type: 'shield', x: 0, y: 0, life: 0.45, duration: 0.65 }, {}, char, 7);
    if (!activation.calls.strokeStyles.includes(char.shieldColor)) throw new Error(id + ' activación no usa shieldColor');
  }
});

t('shield: la paleta derivada conserva el color base sin lavar a blanco', () => {
  const src = fs.readFileSync('js/render/consumableEffects.js', 'utf8');
  if (!src.includes('function shieldBaseColor')) throw new Error('sin base shieldColor');
  if (src.includes('highlight: lighten(base, 0.85)')) throw new Error('highlight todavia lava a blanco');
  if (src.includes('flare: lighten(base, 0.70)')) throw new Error('flare todavia lava a blanco');
  const NV = loadNV();
  const nova = NV.CHARACTERS.nova;
  const persistent = mkCtx();
  NV.drawPlayerConsumableEffects(persistent, { shield: 2, phase: 0 }, nova, 7, 'front');
  if (!persistent.calls.strokeStyles.includes(nova.shieldColor)) throw new Error('NOVA persistente sin base rojo');
  const nearWhite = persistent.calls.strokeStyles.filter((c) => /^#(?:f[be]|e[e-f]|d[f-f])/.test(String(c).toLowerCase()));
  if (nearWhite.length > 0) throw new Error('NOVA con estilos casi blancos: ' + nearWhite.join(','));
  const deploy = mkCtx();
  NV.drawConsumableActivation(deploy, { type: 'shield', x: 0, y: 0, life: 0.90, duration: 0.95 }, {}, nova, 7);
  if (!deploy.calls.strokeStyles.includes(nova.shieldColor)) throw new Error('NOVA deploy F1 sin base rojo');
});

t('bounty usa identidad dorada orbital dependiente del timer', () => {
  const NV = loadNV();
  const on = mkCtx(), off = mkCtx();
  NV.drawPlayerConsumableEffects(on, { bounty: 10 }, { size: 20 }, 42, 'front');
  NV.drawPlayerConsumableEffects(off, { bounty: 0 }, { size: 20 }, 42, 'front');
  if (on.calls.fills < 3) throw new Error('bounty sin pips orbitales');
  if (off.calls.fills !== 0 || off.calls.strokes !== 0) throw new Error('bounty dibuja con timer 0');
  const src = fs.readFileSync('js/render/consumableEffects.js', 'utf8');
  if (!src.includes('#ffd34d') || !src.includes('bounty')) throw new Error('bounty sin identidad dorada');
});

t('magnet conserva feedback funcional sin aura persistente nueva', () => {
  const src = fs.readFileSync('js/render/consumableEffects.js', 'utf8');
  // El renderer dedicado NO debe conocer magnet: no existe aura persistente nueva.
  if (/\bmagnet\b/i.test(src)) throw new Error('magnet recibio aura persistente en el renderer dedicado');
  if (/spawnConsumableVfx\('magnet'/.test(consumablesSource)) throw new Error('magnet con evento nuevo');
  if (!/magnet\(ctx\)[\s\S]{0,420}?magnetCollect/.test(consumablesSource)) throw new Error('magnet funcional alterado');
});

t('bomb y freeze tienen activacion propia diferenciada', () => {
  const NV = loadNV();
  const bomb = mkCtx(), freeze = mkCtx();
  if (!NV.drawConsumableActivation(bomb, { type: 'bomb', x: 0, y: 0, life: 0.5, duration: 0.9 }, {}, { size: 20 }, 3)) throw new Error('bomb sin dibujo');
  if (!NV.drawConsumableActivation(freeze, { type: 'freeze', x: 0, y: 0, life: 0.5, duration: 0.8 }, {}, { size: 20 }, 3)) throw new Error('freeze sin dibujo');
  if (bomb.calls.strokes === 0 || freeze.calls.strokes === 0) throw new Error('activacion sin geometria');
});

t('drawFrozenStatus existe y solo dibuja con slowUntil activo', () => {
  const NV = loadNV();
  const active = mkCtx(), idle = mkCtx();
  if (!NV.drawFrozenStatus(active, { slowUntil: 3, radius: 12 }, 9, 12)) throw new Error('frozen activo no dibuja');
  if (active.calls.fills === 0 || active.calls.strokes === 0) throw new Error('frozen activo sin geometria');
  if (NV.drawFrozenStatus(idle, { slowUntil: 0, radius: 12 }, 9, 12) !== false) throw new Error('frozen inactivo dibuja');
  if (idle.calls.fills !== 0 || idle.calls.strokes !== 0) throw new Error('slowUntil 0 con geometria');
  NV.drawFrozenStatus(mkCtx(), { slowUntil: 2, radius: 12, hp: 40 }, 9, 12);
});

t('render normal y spectral comparten el helper de freeze', () => {
  if (!enemySource.includes('NV.drawFrozenStatus(ctx, e, frame')) throw new Error('renderer normal sin helper');
  if (!spectralSource.includes('NV.drawFrozenStatus(ctx, e, frame')) throw new Error('spectral sin helper');
  if (/if \(e\.slowUntil > 0\) \{\s*const t = frame \* 0\.06;[\s\S]{0,90}?ctx\.fillStyle = 'rgba\(103,232,249/.test(spectralSource)) throw new Error('fillStyle huerfano en spectral');
});

t('ruta lab y elites spectral reciben freeze sin duplicacion', () => {
  const labBody = spectralSource.slice(spectralSource.indexOf('function drawLabSpecterEnemy('), spectralSource.indexOf('function resolveBossProfile('));
  const eliteBody = spectralSource.slice(spectralSource.indexOf('function drawEliteBossEnemy('), spectralSource.indexOf('function drawLabSpecterEnemy('));
  if (!labBody.includes('drawStatusLayers(')) throw new Error('lab no consulta drawStatusLayers');
  if (!eliteBody.includes('drawStatusLayers(')) throw new Error('elite no consulta drawStatusLayers');
  const frozenCalls = (spectralSource.match(/NV\.drawFrozenStatus\(ctx, e, frame/g) || []).length;
  if (frozenCalls !== 1) throw new Error('freeze debe dibujarse una sola vez (llamadas=' + frozenCalls + ')');
});

t('cola consumableVfx acotada y separada de specialVFX', () => {
  const NV = loadNV();
  let q = [];
  for (let i = 0; i < 40; i++) q = NV.spawnConsumableFx(q, 'potion', i, i);
  if (q.length > NV.CONSUMABLE_FX_MAX) throw new Error('cola sin acotar: ' + q.length);
  q = NV.updateConsumableFx(q, 5);
  if (q.length !== 0) throw new Error('cola no expira');
  if (!gameSource.includes('let consumableVfx = [];')) throw new Error('cola ausente en game.js');
  if (!gameSource.includes('updateConsumableVfx(dt);')) throw new Error('cola sin update');
  if (!gameSource.includes('consumableVfx = [];')) throw new Error('cola sin lifecycle');
  if (/specialVFX = NV\.spawnConsumableFx|consumableVfx = res\.specialVFX/.test(gameSource)) throw new Error('cola mezclada con specialVFX');
});

t('render persistente sin Math.random y con estado/char.size', () => {
  const src = fs.readFileSync('js/render/consumableEffects.js', 'utf8');
  const persistent = src.slice(src.indexOf('NV.drawFrozenStatus'), src.indexOf('NV.spawnConsumableFx'));
  const playerFx = src.slice(src.indexOf('NV.drawPlayerConsumableEffects'));
  if (/Math\.random\(\)/.test(persistent + playerFx)) throw new Error('Math.random en render persistente');
  // Los helpers que dibujan geometría deben aislar el estado; el dispatcher sólo
// delega y por eso puede no abrir contexto propio (siempre balanceado).
  for (const name of ['NV.drawFrozenStatus', 'NV.drawPlayerConsumableEffects', 'function drawPotionActivation', 'function drawOverdriveActivation', 'function drawShieldDeploy', 'function drawBombActivation', 'function drawFreezePulse', 'function drawBountyActivation']) {
    const block = fnBlock(src, name);
    const st = stateOf(block);
    if (st.save === 0) throw new Error(name + ' no aísla el estado Canvas');
    if (st.save !== st.restore) throw new Error('save/restore desbalanceado en ' + name + ' (' + st.save + '/' + st.restore + ')');
  }
  const dispatcher = fnBlock(src, 'NV.drawConsumableActivation');
  if (stateOf(dispatcher).save !== stateOf(dispatcher).restore) throw new Error('dispatcher desbalanceado');
  for (const delegate of ['drawPotionActivation(', 'drawOverdriveActivation(', 'drawShieldDeploy(', 'drawBombActivation(', 'drawFreezePulse(', 'drawBountyActivation(']) {
    if (!dispatcher.includes(delegate)) throw new Error('dispatcher sin ' + delegate);
  }
  if (!src.includes('event.size') && !src.includes('char.size')) throw new Error('efectos sin char.size');
  const PNV = loadPlayerNV();
  for (const id of ['boti', 'nova', 'rook', 'swarm']) {
    const ctx = mkCtx();
    PNV.drawPlayer(ctx, { x: 0, y: 0, character: id, hp: 100, maxHp: 100, invuln: 0, stun: 0, phase: 0, bulwark: 0, shield: 1, overdrive: 1, bounty: 1, moveVx: 30, moveVy: 0 }, PNV.CHARACTERS, 11);
    if (ctx.calls.fills === 0 || ctx.calls.strokes === 0) throw new Error(id + ' sin efectos');
  }
});

t('bomb VFX: spawnConsumableFx conserva arenaW/arenaH y el radio no tiene cap', () => {
  const NV = loadNV();
  let q = [];
  q = NV.spawnConsumableFx(q, 'bomb', 640, 650, { arenaW: 1280, arenaH: 720 });
  if (q[0].arenaW !== 1280 || q[0].arenaH !== 720) throw new Error('arena perdida: ' + q[0].arenaW + 'x' + q[0].arenaH);
  const r = NV.bombMaxRadius(q[0]);
  if (!(r > 600)) throw new Error('radio sin superar 600: ' + r);
  const far = Math.max(
    Math.hypot(640, 650),
    Math.hypot(1280 - 640, 650),
    Math.hypot(640, 720 - 650),
    Math.hypot(1280 - 640, 720 - 650)
  );
  if (Math.abs(r - far) > 0.001) throw new Error('no es la esquina más lejana: ' + r + ' vs ' + far);
});

t('bomb VFX: drawConsumableActivation reenvía arenaW/arenaH y la onda alcanza la esquina más lejana', () => {
  const NV = loadNV();
  const ctx = mkCtx();
  const event = { type: 'bomb', x: 200, y: 100, life: 0, duration: 0.9, arenaW: 1280, arenaH: 720, seedAngle: 0 };
  if (!NV.drawConsumableActivation(ctx, event, {}, { size: 20 }, 3)) throw new Error('dispatcher no atiende bomb');
  const maxR = Math.hypot(1280 - 200, 720 - 100);
  const maxArc = ctx.calls.arcs.reduce((m, a) => Math.max(m, a.r), 0);
  if (maxArc < maxR * 0.99) throw new Error('onda no alcanza la esquina más lejana: ' + maxArc + ' < ' + maxR);
  if (!(maxArc > 600)) throw new Error('radio capado: ' + maxArc);
});

t('bombMaxRadius: sin dimensiones de arena degrada a hypot del epicentro sin NaN', () => {
  const NV = loadNV();
  const r = NV.bombMaxRadius({ x: 640, y: 360, arenaW: 0, arenaH: 0 });
  if (!isFinite(r) || Math.abs(r - Math.hypot(640, 360)) > 0.001) throw new Error('r=' + r);
  if (NV.bombMaxRadius(null) !== 0) throw new Error('null debe dar 0');
});

t('bomb VFX: la expansión arranca exactamente en NV.BOMB_IMPACT_T (mismo umbral que la mecánica)', () => {
  const NV = loadNV();
  const maxR = Math.hypot(1280 - 200, 720 - 100);
  const mk = (t) => ({ type: 'bomb', x: 200, y: 100, life: (1 - t) * 0.9, duration: 0.9, arenaW: 1280, arenaH: 720, seedAngle: 0 });
  const before = mkCtx();
  NV.drawConsumableActivation(before, mk(NV.BOMB_IMPACT_T - 0.05), {}, { size: 20 }, 3);
  const maxBefore = before.calls.arcs.reduce((m, a) => Math.max(m, a.r), 0);
  if (maxBefore > 100) throw new Error('onda visible antes del umbral: ' + maxBefore);
  const after = mkCtx();
  const dt = 0.05, k = dt / (1 - NV.BOMB_IMPACT_T);
  const expectedWave = maxR * (1 - Math.pow(1 - k, 3));
  NV.drawConsumableActivation(after, mk(NV.BOMB_IMPACT_T + dt), {}, { size: 20 }, 3);
  const maxAfter = after.calls.arcs.reduce((m, a) => Math.max(m, a.r), 0);
  if (Math.abs(maxAfter - expectedWave) > expectedWave * 0.01) {
    throw new Error('frente de onda desincronizado: ' + maxAfter + ' vs ' + expectedWave);
  }
});

t('freeze VFX: carcasa irregular de hielo facetado adherida al enemigo', () => {
  const NV = loadNV();
  const enemy = { slowUntil: 3, radius: 12, enemyTypeId: 'drone', shape: 'circle', x: 300, y: 200 };
  const ctx = mkCtx();
  if (!NV.drawFrozenStatus(ctx, enemy, 40, 12)) throw new Error('frozen activo no dibuja');
  // carcasa poligonal multi-vértice (NO un arc circular)
  if ((ctx.calls.lineTos || 0) < 10) throw new Error('carcasa sin múltiples vértices: ' + ctx.calls.lineTos);
  if (ctx.calls.fills < 4) throw new Error('sin capas (tint/parches/casing/facetas): ' + ctx.calls.fills);
  for (const a of ctx.calls.arcs) if (a.r >= 12) throw new Error('shell circular detectado r=' + a.r);
  // build determinista: misma carcasa, radios desiguales, acumulaciones asimétricas
  const s1 = NV.frozenShellOf(enemy, 12, { facets: 4, accretions: 3, frost: 5 });
  const s2 = NV.frozenShellOf(enemy, 12, { facets: 4, accretions: 3, frost: 5 });
  if (JSON.stringify(s1) !== JSON.stringify(s2)) throw new Error('carcasa no determinista');
  if (new Set(s1.verts.map((v) => v.rr.toFixed(4))).size < 4) throw new Error('silueta casi circular');
  if (s1.verts.length < 8 || s1.verts.length > 12) throw new Error('vértices fuera de 8–12: ' + s1.verts.length);
  if (new Set(s1.accretions.map((a) => a.size.toFixed(4))).size < 2) throw new Error('acumulaciones uniformes');
  if (s1.facets.length < 3) throw new Error('sin facetas internas');
  // pegado al enemigo: cache PRIVADO del renderer (WeakMap), sin mutar al enemigo
  const first = JSON.stringify(s1.verts);
  NV.drawFrozenStatus(mkCtx(), enemy, 80, 12);
  NV.drawFrozenStatus(mkCtx(), enemy, 81, 12);
  if (JSON.stringify(NV.frozenShellOf(enemy, 12, { facets: 4, accretions: 3, frost: 5 }).verts) !== first) throw new Error('carcasa inestable entre frames');
});

t('freeze VFX: drawFrozenStatus NO muta el enemigo (sin _frozenShell ni props visuales)', () => {
  const NV = loadNV();
  const enemy = { slowUntil: 2, radius: 12, enemyTypeId: 'drone', shape: 'circle', x: 1, y: 2 };
  const keysBefore = Object.keys(enemy).sort().join(',');
  NV.drawFrozenStatus(mkCtx(), enemy, 10, 12);
  NV.drawFrozenStatus(mkCtx(), enemy, 11, 12);
  const keysAfter = Object.keys(enemy).sort().join(',');
  if (keysAfter !== keysBefore) throw new Error('enemy mutado: ' + keysAfter);
  if ('_frozenShell' in enemy) throw new Error('_frozenShell presente en el gameplay object');
  // la geometría del cache es estable: misma carcasa frame a frame
  const a = NV.frozenShellOf(enemy, 12, { facets: 4, accretions: 3, frost: 5 });
  const b = NV.frozenShellOf(enemy, 12, { facets: 4, accretions: 3, frost: 5 });
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error('carcasa no estable');
});

t('freeze VFX: escala con el radio real y los élites tienen casing más denso', () => {
  const NV = loadNV();
  const small = NV.frozenShellOf({ slowUntil: 2, radius: 8, x: 0, y: 0, shape: 'circle' }, 8, { facets: 3, accretions: 2, frost: 3 });
  const elite = NV.frozenShellOf({ slowUntil: 3, radius: 26, isElite: true, x: 9, y: 9, shape: 'hex', enemyTypeId: 'tank' }, 26, { facets: 5, accretions: 4, frost: 5, elite: true, sharp: 0.24 });
  const maxSmall = Math.max.apply(null, small.verts.map((v) => v.rr));
  const maxElite = Math.max.apply(null, elite.verts.map((v) => v.rr));
  if (maxElite < maxSmall * 1.5) throw new Error('no escala con el radio real');
  if (elite.verts.length <= small.verts.length) throw new Error('élite sin casing mayor');
  if (elite.accretions.length < small.accretions.length) throw new Error('élite sin más acumulaciones');
  if (elite.facets.length < small.facets.length) throw new Error('élite sin más facetas');
});

t('freeze VFX: LOW conserva la carcasa irregular (nunca degrada a círculo azul)', () => {
  const NV = loadNV();
  NV.getVisualBudget = () => ({ tier: 'minimal', heavyShadow: false });
  const enemy = { slowUntil: 2, radius: 12, x: 1, y: 2, shape: 'circle' };
  const ctx = mkCtx();
  if (!NV.drawFrozenStatus(ctx, enemy, 3, 12)) throw new Error('LOW no dibuja');
  if ((ctx.calls.lineTos || 0) < 8) throw new Error('LOW degradó a círculo: lineTos=' + ctx.calls.lineTos);
  if (ctx.calls.fills < 2) throw new Error('LOW sin casing');
  const s = NV.frozenShellOf(enemy, 12, { facets: 2, accretions: 2, frost: 2, elite: false, sharp: 0.18 });
  if (s.verts.length < 8) throw new Error('LOW sin polígono irregular');
});

t('freeze VFX: entrada (<150ms) con flash frío y salida con fracturas sin círculo', () => {
  const NV = loadNV();
  const enter = mkCtx();
  NV.drawFrozenStatus(enter, { slowUntil: 4, radius: 12, x: 5, y: 5 }, 0, 12);
  if (enter.calls.arcs.length === 0) throw new Error('sin flash frío de entrada');
  const late = mkCtx();
  NV.drawFrozenStatus(late, { slowUntil: 0.15, radius: 12, x: 6, y: 6 }, 0, 12);
  if (late.calls.strokes === 0) throw new Error('salida sin fracturas');
});

console.log('RESULT consumable_visual_feedback: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);

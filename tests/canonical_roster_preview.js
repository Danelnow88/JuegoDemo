const fs = require('fs'), vm = require('vm');
let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; console.log('  ok  ' + name); } catch (e) { fail++; console.log('  FAIL ' + name + ' -> ' + e.message); } }
function loadNV() {
  const sbx = { window: { NV: {} }, console, Math, Object, Array, WeakSet, Float32Array };
  sbx.window.window = sbx.window;
  for (const f of ['js/data/gameData.js', 'js/render/spectralEnemies2D.js']) vm.runInNewContext(fs.readFileSync(f, 'utf8'), sbx, { filename: f });
  return sbx.window.NV;
}
const NV = loadNV();
t('roster counts 13 normal 8 elite 10 boss', () => {
  console.log('    info: ' + NV.ENEMY_TYPES.length + '/' + NV.ELITE_TYPES.length + '/' + NV.BOSS_TYPES.length);
  console.log('    info normal: ' + NV.ENEMY_TYPES.map((x) => x.id).join(','));
  if (NV.ENEMY_TYPES.length !== 13) throw new Error('normal');
  if (NV.ELITE_TYPES.length !== 8) throw new Error('elite');
  if (NV.BOSS_TYPES.length !== 10) throw new Error('boss');
});
t('unique enemy ids and boss names', () => {
  const a = {}, b = {};
  for (const x of NV.ENEMY_TYPES.concat(NV.ELITE_TYPES)) {
    const key = x.id || x.visualId;
    if (!key) throw new Error('enemy without id/visualId');
    if (a[key]) throw new Error('dup ' + key);
    a[key] = 1;
  }
  for (const x of NV.BOSS_TYPES) {
    if (!x.name || b[x.name]) throw new Error('dup boss');
    b[x.name] = 1;
  }
});
t('preview uses production modules', () => {
  const s = fs.readFileSync('previews/enemy-roster-canonical.html', 'utf8');
  for (const k of ['../js/data/gameData.js', '../js/render/spectralEnemies2D.js', '../js/render/enemies.js', '../js/render/bosses.js']) if (!s.includes(k)) throw new Error(k);
  if (/function drawSpectralEnemy2D|function drawLabEnemyModel/.test(s)) throw new Error('duplicated renderer');
});
t('scale is canvas only', () => {
  const s = fs.readFileSync('previews/enemy-roster-canonical.html', 'utf8');
  if (!s.includes('ctx.scale(scale,scale)')) throw new Error('no scale');
  if (/\.radius\s*=/.test(s)) throw new Error('mutates radius');
});
function mockCtx() {
  const grad = { addColorStop() {} };
  return new Proxy({ canvas: { width: 560, height: 190 } }, {
    get(t, k) {
      if (k === 'canvas') return t.canvas;
      if (k === 'createRadialGradient' || k === 'createLinearGradient') return () => grad;
      if (k === 'measureText') return () => ({ width: 10 });
      return () => {};
    }, set() { return true; }
  });
}
t('production renderer smoke: every type draws', () => {
  const ctx = mockCtx(), player = { x: 9999, y: 9999 };
  for (const x of NV.ENEMY_TYPES) {
    const r = NV.drawSpectralEnemy2D(ctx, { x: 10, y: 10, radius: x.radius, color: x.color, shape: x.shape, behavior: x.behavior, enemyTypeId: x.id, visualId: x.visualId || x.id, isElite: false, dead: false }, 7, player, null);
    if (r !== true) throw new Error('normal ' + x.id);
  }
  for (const x of NV.ELITE_TYPES) {
    const e = { x: 10, y: 10, radius: x.radius, color: x.color, shape: x.shape, enemyTypeId: x.id, visualId: x.visualId, isElite: true, dead: false, hp: 10, maxHp: 10 };
    if (NV.drawSpectralEnemy2D(ctx, e, 7, player, null) !== true) throw new Error('elite ' + (x.id || x.visualId));
  }
  for (const b of NV.BOSS_TYPES) {
    if (NV.drawSpectralBoss2D(ctx, { x: 10, y: 10, radius: b.radius, color: b.color, shape: b.shape, name: b.name, hp: b.hp, maxHp: b.hp, dead: false }, 7, player, null) !== true) throw new Error('boss ' + b.name);
  }
});
console.log('RESULT canonical_roster_preview: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);

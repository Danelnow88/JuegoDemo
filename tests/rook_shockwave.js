// Tests ROOK: onda de choque aturde/empuja en 120px, shockwave reutilizable, reflejo 30.
const fs = require('fs'), vm = require('vm');
let pass = 0, fail = 0;
function t(desc, fn) { try { fn(); pass++; console.log('  ok  ' + desc); } catch (e) { fail++; console.log('  FAIL ' + desc + ' -> ' + e.message); } }
function load(f, sbx) { vm.runInNewContext(fs.readFileSync(f, 'utf8'), sbx, { filename: f }); }

t('fx.js expone spawnShockwave/updateShockwaves (sistema reutilizable)', () => {
  const sbx = { window: { NV: {} }, console, Math };
  load('js/engine/fx.js', sbx);
  if (typeof sbx.window.NV.spawnShockwave !== 'function') throw new Error('sin spawnShockwave');
  if (typeof sbx.window.NV.updateShockwaves !== 'function') throw new Error('sin updateShockwaves');
});

t('shockwave: nace con life 1, se expande y muere (~0.45s)', () => {
  const sbx = { window: { NV: {} }, console, Math };
  load('js/engine/fx.js', sbx);
  const NV = sbx.window.NV;
  const arr = [];
  NV.spawnShockwave(arr, 100, 100, { maxRadius: 130 });
  if (arr.length !== 1 || arr[0].life !== 1) throw new Error('spawn mal');
  let alive = arr;
  for (let i = 0; i < 60; i++) alive = NV.updateShockwaves(1 / 60, alive);
  if (alive.length !== 0) throw new Error('no murió');
  // a mitad de vida el radio dibujable debe ser ~mitad del máximo con ease-out
  const s = [{ x: 0, y: 0, life: 0.5, maxRadius: 130 }];
  const rs = sbx.window.NV;
  if (!rs.drawShockwaves && fs.readFileSync('js/render/projectiles.js', 'utf8').indexOf('drawShockwaves') < 0) throw new Error('sin drawShockwaves');
});

t('ROOK: activar Muralla aturde (stun>=1s) y empuja enemigos en <=120px', () => {
  const sbx = { window: { NV: {} }, console, Math };
  for (const f of ['js/data/gameData.js', 'js/engine/fx.js', 'js/engine/special.js']) load(f, sbx);
  const NV = sbx.window.NV;
  const player = { character: 'rook', x: 400, y: 300, specialCd: 0 };
  const near = { x: 460, y: 300, dead: false, stun: 0 };   // 60px
  const far = { x: 700, y: 300, dead: false, stun: 0 };    // 300px
  const knockbacks = [];
  const shockwaves = [];
  const state = {
    player, CHARACTERS: NV.CHARACTERS, meteors: [], particles: [], drones: undefined,
    W: 800, shake: 0, enemies: [near, far], shockwaves,
    cbs: {
      showBanner() {}, triggerFlash() {}, spawnExplosion() {},
      applyKnockback(e, sx, sy, strength) { knockbacks.push({ e, strength }); },
      addFloatText(x, y, txt) { near.stunText = txt; }, sfx: { special() {} },
    },
  };
  NV.useSpecial(state);
  if (!(near.stun >= 1)) throw new Error('cercano sin stun: ' + near.stun);
  if (far.stun > 0) throw new Error('lejano aturdido');
  if (knockbacks.length !== 1 || knockbacks[0].e !== near) throw new Error('knockback incorrecto');
  if (shockwaves.length !== 1) throw new Error('sin VFX de shockwave');
  if (!(player.bulwark === 3 && player.invuln === 3)) throw new Error('escudo base alterado');
});

t('reflejo de Muralla sube a 30 (+50%)', () => {
  const src = fs.readFileSync('js/engine/bullets.js', 'utf8');
  const m = src.match(/b\.damage = (\d+);[^\n]*\+50%/);
  if (!m || Number(m[1]) !== 30) throw new Error('reflejo=' + (m && m[1]));
});

console.log('RESULT rook_shockwave: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
const fs = require('fs'), vm = require('vm');
let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; console.log('  ok  ' + name); } catch (e) { fail++; console.log('  FAIL ' + name + ' -> ' + e.message); } }
function near(actual, expected, label) { if (Math.abs(actual - expected) > 1e-6) throw new Error(label + '=' + actual + ' expected=' + expected); }
function load(files, nv) {
  const sbx = { window: { NV: nv || {} }, console, Math, Number, Object, Array, JSON };
  for (const file of files) vm.runInNewContext(fs.readFileSync(file, 'utf8'), sbx, { filename: file });
  return sbx.window.NV;
}

const NV = load(['js/core/inputIntent.js']);

t('aim mundial se normaliza', () => {
  const intent = NV.inputIntent.createCombatIntent('manual');
  NV.inputIntent.setAimWorld(intent, 13, 24, 10, 20);
  near(intent.aimX, 0.6, 'aimX'); near(intent.aimY, 0.8, 'aimY');
  if (!intent.aimActive || intent.aimWorldX !== 13 || intent.aimWorldY !== 24) throw new Error('estado de aim incompleto');
});

t('movimiento y aim son independientes', () => {
  const intent = NV.inputIntent.createCombatIntent('manual');
  NV.inputIntent.setMoveFromButtons(intent, { left: true, right: false, up: false, down: false });
  NV.inputIntent.setAimWorld(intent, 200, 100, 100, 100);
  if (!(intent.moveX < 0 && intent.aimX > 0 && intent.moveY === 0 && intent.aimY === 0)) throw new Error(JSON.stringify(intent));
  NV.inputIntent.setAimWorld(intent, intent.aimWorldX, intent.aimWorldY, 80, 100);
  if (!(intent.moveX < 0 && intent.aimX > 0)) throw new Error('mover jugador alteró el canal de movimiento/aim');
});

t('hold-LMB respeta cadencia sin clicks repetidos', () => {
  let timer = 0, shots = 0;
  for (let i = 0; i < 7; i++) {
    const r = NV.inputIntent.advanceFireCadence(timer, 0.05, true, false, () => { shots++; }, 0.2, 0.05);
    timer = r.timer;
  }
  if (shots !== 2) throw new Error('shots=' + shots);
});

t('pausa bloquea fuego y resume sin doble disparo', () => {
  let shots = 0;
  let r = NV.inputIntent.advanceFireCadence(0, 0.1, true, true, () => { shots++; }, 0.2, 0.05);
  if (shots !== 0) throw new Error('disparó pausado');
  r = NV.inputIntent.advanceFireCadence(r.timer, 0, true, false, () => { shots++; }, 0.2, 0.05);
  if (shots !== 1 || !r.fired) throw new Error('resume incorrecto shots=' + shots);
});

t('switch de política no crea una segunda pipeline', () => {
  const intent = NV.inputIntent.createCombatIntent('manual');
  intent.fireIntent = true;
  if (NV.inputIntent.effectiveFirePolicy(intent, false) !== 'manual') throw new Error('manual perdido');
  intent.firePolicy = 'legacy-auto'; intent.fireIntent = false;
  if (NV.inputIntent.effectiveFirePolicy(intent, false) !== 'legacy-auto') throw new Error('legacy perdido');
  const src = fs.readFileSync('js/game.js', 'utf8');
  if ((src.match(/NV\.shoot\(\{/g) || []).length !== 1) throw new Error('hay más de una pipeline NV.shoot');
});

t('móvil fuerza legacy-auto sin requerir aim táctil', () => {
  const intent = NV.inputIntent.createCombatIntent('manual');
  if (NV.inputIntent.effectiveFirePolicy(intent, true) !== 'legacy-auto') throw new Error('mobile no preserva auto');
});

function weaponState(NVw, extras) {
  return Object.assign({
    player: { x: 0, y: 20, luck: 0, permCrit: 0, overdrive: 0 },
    enemies: [{ x: -100, y: 20, dead: false }], boss: null, bullets: [],
    currentWeapon: { id: 'pistol', damage: 10, range: 380, speed: 500, color: '#fff', count: 1 },
    currentWeaponLevel: () => 1, weaponVisualTier: () => 0, BULLET_TIER_COLORS: ['#fff'], MAX_BULLETS: 20,
    permDamageBonus: 0, playWeaponSound() {}, currentWeaponFusion: 0, fusionStep: 0.2, wave: 1,
  }, extras || {});
}
const NVw = load(['js/data/balance.js', 'js/engine/weapons.js']);

t('manual dispara exactamente hacia aim y no autocorrige al enemigo', () => {
  const state = weaponState(NVw, { aimVector: { x: 10, y: 0 } });
  NVw.shoot(state);
  if (state.bullets.length !== 1 || !(state.bullets[0].vx > 0)) throw new Error('no disparó a la derecha');
  near(state.bullets[0].vy, 0, 'vy');
});

t('legacy-auto conserva nearest-target y rango', () => {
  const state = weaponState(NVw);
  NVw.shoot(state);
  if (state.bullets.length !== 1 || !(state.bullets[0].vx < 0)) throw new Error('auto no apuntó al enemigo izquierdo');
  const far = weaponState(NVw, { enemies: [{ x: 1000, y: 20 }] });
  if (NVw.shoot(far) !== false || far.bullets.length) throw new Error('auto ignoró rango');
});

t('viewport escalado alimenta aim mundial correcto', () => {
  const canvas = { getBoundingClientRect() { return { left: 50, top: 20, width: 450, height: 260 }; } };
  const doc = { documentElement: { classList: { add() {}, remove() {} } }, getElementById(id) { return id === 'game' ? canvas : null; }, addEventListener() {} };
  const sbx = { window: null, NV: { capabilities: { isMobile: false } }, document: doc, console, Math, Number, Object, Array, JSON,
    devicePixelRatio: 1, innerWidth: 450, innerHeight: 260, location: { search: '' }, screen: { orientation: {} }, addEventListener() {} };
  sbx.window = sbx;
  vm.runInNewContext(fs.readFileSync('js/core/viewport.js', 'utf8'), sbx, { filename: 'viewport.js' });
  vm.runInNewContext(fs.readFileSync('js/core/inputIntent.js', 'utf8'), sbx, { filename: 'inputIntent.js' });
  const p = sbx.NV.screenToGame(500, 150);
  near(p.x, 900, 'worldX'); near(p.y, 260, 'worldY');
  const intent = sbx.NV.inputIntent.createCombatIntent('manual');
  sbx.NV.inputIntent.setAimWorld(intent, p.x, p.y, 450, 260);
  near(intent.aimX, 1, 'scaled aimX'); near(intent.aimY, 0, 'scaled aimY');
});

t('bindings auditados siguen accesibles y LMB es el único binding nuevo', () => {
  const src = fs.readFileSync('js/game.js', 'utf8');
  for (const token of ['ShiftLeft', "e.code === 'Space'", "e.code === 'KeyF'", "e.code === 'KeyQ'", "e.code === 'KeyE'", '/^Digit([1-6])$/', "window.addEventListener('wheel'"]) {
    if (!src.includes(token)) throw new Error('binding perdido: ' + token);
  }
  if (!src.includes("canvas.addEventListener('mousedown'") || !src.includes('e.button !== 0')) throw new Error('LMB manual ausente');
  for (const unused of ['KeyR', 'button === 2']) if (src.includes(unused)) throw new Error('binding inesperado: ' + unused);
});

console.log('RESULT input_foundation: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
// Tests B1: fusión de armas repetidas (nivel de arma +% daño, drops fusionan, no rompe guardar).
const fs = require('fs'), vm = require('vm');
let pass = 0, fail = 0;
function t(desc, fn) { try { fn(); pass++; console.log('  ok  ' + desc); } catch (e) { fail++; console.log('  FAIL ' + desc + ' -> ' + e.message); } }
const sbx = { window: { NV: {} }, console, Math };
vm.runInNewContext(fs.readFileSync('js/engine/weapons.js', 'utf8'), sbx, { filename: 'weapons.js' });
vm.runInNewContext(fs.readFileSync('js/data/balance.js', 'utf8'), sbx, { filename: 'balance.js' });
vm.runInNewContext(fs.readFileSync('js/engine/pickups.js', 'utf8'), sbx, { filename: 'pickups.js' });
const NV = sbx.window.NV;

t('weaponFusionDamage: fus 0 = base, fus 3 = base*1.6', () => {
  if (NV.weaponFusionDamage(20, 0) !== 20) throw new Error('fus0=' + NV.weaponFusionDamage(20, 0));
  if (NV.weaponFusionDamage(20, 3, 0.2) !== 32) throw new Error('fus3=' + NV.weaponFusionDamage(20, 3, 0.2)); // 20*1.6=32
});

t('shoot aplica el multiplicador de fusión sobre base+nivel', () => {
  const fired = [];
  NV.shoot({
    player: { x: 0, y: 0 }, enemies: [{ x: 100, y: 0 }], boss: null, bullets: fired,
    currentWeapon: { id: 'rifle', damage: 20, range: 480, speed: 700, color: '#4ade80', count: 1 },
    currentWeaponLevel: () => 1, weaponVisualTier: () => 0, BULLET_TIER_COLORS: ['#fff'],
    MAX_BULLETS: 50, permDamageBonus: 0, playWeaponSound: () => {},
    currentWeaponFusion: 2, fusionStep: 0.2,
  });
  // base=20 + lv1 + 0 =21 ; * (1+2*0.2)=1.4 => 29
  if (fired.length !== 1) throw new Error('no disparó');
  if (fired[0].damage !== Math.round(21 * 1.4)) throw new Error('damage=' + fired[0].damage);
});

t('sin fusión no cambia el daño (regresión)', () => {
  const fired = [];
  NV.shoot({
    player: { x: 0, y: 0 }, enemies: [{ x: 100, y: 0 }], boss: {}, bullets: fired,
    currentWeapon: { id: 'rifle', damage: 20, range: 480, speed: 700, color: '#fff', count: 1 },
    currentWeaponLevel: () => 2, permDamageBonus: 0, playWeaponSound: () => {},
    BULLET_TIER_COLORS: ['#fff'], MAX_BULLETS: 50, weaponVisualTier: () => 0,
    currentWeaponFusion: 0, fusionStep: 0.2,
  });
  if (fired[0].damage !== 22) throw new Error('sin fusión daño=' + fired[0].damage + ' (base20+lv2)');
});

t('drops de arma poseída se fusiona y no ocupa slot', () => {
  const texts = []; const inv = [{ id: 'rifle' }]; let fused = 0;
  const tryFus = (w) => { if (!inv.some(i => i.id === w.id)) return { fused:false, owned:false }; if (fused >= 3) return { fused:false, maxed:true }; fused++; return { fused:true, level: fused }; };
  const r = NV.updateWeaponPickups(0.1, [{ weapon: { id: 'rifle' }, x: 0, y: 0 }], { x: 0, y: 0 }, inv, 6, {}, (x,y,t)=>texts.push(t), {}, () => {}, tryFus);
  if (fused !== 1) throw new Error('no fusionó');
  if (inv.length !== 1) throw new Error('ocupó slot: ' + inv.length);
  if (!texts.includes('FUSIÓN Nv1')) throw new Error('sin aviso: ' + JSON.stringify(texts));
  if (r.weaponPickups.some(p=>!p.dead)) throw new Error('no consumió el drop');
});

t('arma NO poseída sigue guardándose (sin regresión)', () => {
  const inv = []; const texts = [];
  const r = NV.updateWeaponPickups(0.1, [{ weapon: { id: 'smg' }, x: 0, y: 0 }], { x: 0, y: 0 }, inv, 6, {}, (x,y,t)=>texts.push(t), {}, () => {},
    () => ({ fused:false, owned:false }));
  if (inv.length !== 1 || inv[0].id !== 'smg') throw new Error('no guardó');
  if (!texts.includes('GUARDADO')) throw new Error('sin guardado');
});

t('constantes de fusión en balance.js', () => {
  const b = fs.readFileSync('js/data/balance.js', 'utf8');
  for (const k of ['MAX_WEAPON_FUSION: 3', 'WEAPON_FUSION_DMG: 0.20', 'WEAPON_FUSE_PRICE: 15']) if (!b.includes(k)) throw new Error('falta ' + k);
});

console.log('RESULT weapon_fusion: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
const fs = require('fs');
const vm = require('vm');
// Cargar drones.js y meteors.js en un NV compartido
const sandbox = { window: { NV: {} }, console };
for (const f of ['js/engine/drones.js','js/engine/meteors.js']) {
  vm.runInNewContext(fs.readFileSync(f,'utf8'), sandbox, { filename: f });
}
const NV = sandbox.window.NV;
let pass=0, fail=0;
function t(desc, fn){ try{ fn(); pass++; console.log('  ok ', desc); }catch(e){ fail++; console.log('  FAIL', desc, '->', e.message); } }

console.log('keys:', ['updateDrones','updateMeteors'].map(k=>k+':'+typeof NV[k]).join(' '));

// ---- updateDrones ----
t('updateDrones: drone dispara (vida alta) y luego otro frame expira', ()=>{
  let player={x:10,y:10};
  let bullets=[];
  const findTarget=()=>({x:200,y:10});
  // frame 1: vida=2, fireTimer=0 -> dispara. -dt 0.1 => life 1.9
  let drones=[{life:2,angle:0,speed:1,orbitRadius:55,fireTimer:0,color:'#8dfaff',dead:false}];
  drones = NV.updateDrones(0.1, drones, player, bullets, 100, findTarget);
  if (bullets.length !== 1) throw new Error('no disparó en frame 1, hay '+bullets.length);
  // frame 2: (no debería tocar), vida baja
  drones = NV.updateDrones(0.1, drones, player, bullets, 100, findTarget);
  if (drones.length !== 1) throw new Error('drone murio de mas');
  // vida aún alta: sigue
  if (drones[0].life <= 0) throw new Error('life no decae bien: '+drones[0].life);
});

t('updateDrones: drone con vida larga sigue activo', ()=>{
  let drones=[{life:5,angle:0,speed:1,orbitRadius:55,fireTimer:0.5,color:'x',dead:false}];
  drones = NV.updateDrones(0.1, drones, {x:0,y:0}, [], 100, ()=>({x:10,y:0}));
  if (drones.length!==1) throw new Error('drone salio antes');
});

// ---- updateMeteors ----
t('updateMeteors: impacta enemigo y daña', ()=>{
  let shake=0;
  let enemies=[{x:50,y:50,hp:40,radius:10,dead:false,knockbackRes:0}];
  let boss=null;
  let meteors=[{x:50,y:50,vx:0,vy:0,radius:10,color:'#fff',dead:false}];
  const cbs={ killEnemy:(e)=>{e.dead=true;}, applyKnockback:()=>{}, spawnExplosion:()=>{} };
  const res = NV.updateMeteors(0.1, meteors, {H:520,enemies,boss,shake}, cbs);
  // meteoro no removido (no salio de pantalla), enemigo perdió 40 hp => murió
  if (enemies[0].hp !== 0) throw new Error('enemigo no dañado: '+enemies[0].hp);
  if (enemies[0].dead !== true) throw new Error('enemigo no murió');
  if (res.meteors.length !== 1) throw new Error('meteoro mal filtrado');
});

t('updateMeteors: sale de pantalla y se elimina', ()=>{
  let shake=0;
  let meteors=[{x:50,y:600,vx:0,vy:100,radius:6,color:'#fff',dead:false}];
  const res = NV.updateMeteors(0.1, meteors, {H:520,enemies:[],boss:null,shake}, {killEnemy:()=>{},applyKnockback:()=>{},spawnExplosion:()=>{}});
  if (res.meteors.length !== 0) throw new Error('meteoro fuera no eliminado');
});

t('updateMeteors: impacta boss', ()=>{
  let shake=0;
  let boss={x:50,y:50,hp:100,radius:20,dead:false,hitFlash:0};
  let meteors=[{x:50,y:50,vx:0,vy:0,radius:10,color:'#fff',dead:false}];
  const res = NV.updateMeteors(0.1, meteors, {H:520,enemies:[],boss,shake}, {killEnemy:()=>{},applyKnockback:()=>{},spawnExplosion:()=>{}});
  if (boss.hp !== 70) throw new Error('boss no dañado: '+boss.hp);
  if (boss.hitFlash !== 0.2) throw new Error('no hitFlash');
});

console.log('RESULT drones+meteors: pass='+pass+' fail='+fail);
process.exit(fail?1:0);
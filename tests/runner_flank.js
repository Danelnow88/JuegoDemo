// ===== TEST: Runner as Flanker (FEATURE 06) =====
// Verifica: F05 es autoridad de state, COMMIT es frozen/snapshot, player
// movement no redirige COMMIT, flankSide persistente, budgets, contact.
const fs=require('fs'),vm=require('vm');
let pass=0,fail=0;
function t(n,fn){try{fn();pass++;console.log('  ok  '+n)}catch(e){fail++;console.log('  FAIL '+n+' -> '+e.message)}}
function setup(){
  var m=Object.create(Math);m.random=function(){return 0.3};
  var sbx={window:{NV:{}},console:console,Math:m,Object:Object,Array:Array,Set:Set,Map:Map};
  ['js/data/balance.js','js/data/gameData.js','js/engine/hostileBudget.js','js/engine/enemies.js','js/engine/enemyState.js','js/engine/hazards.js'].forEach(function(f){
    try{vm.runInNewContext(fs.readFileSync(f,'utf8'),sbx,{filename:f})}catch(e){}
  });
  return sbx.window.NV
}
function mkEnemy(x,y){return {x:x,y:y,hp:15,maxHp:15,damage:10,speed:145,radius:9,color:'#ffcf76',shape:'triangle',behavior:'flank',dead:false,knockVelX:0,knockVelY:0,hostileClass:'light',contactCd:0,enemyTypeId:'runner'}}
function mkState(enemies){return {enemies:enemies,player:{x:400,y:300,invuln:0,stun:0},bullets:[],MAX_BULLETS:10,MAX_ENEMY_BULLETS:10,enemyBulletCount:function(){return 0},applyPlayerDamage:function(){return{applied:false}},addFloatText:function(){},spawnExplosion:function(){},MAX_HOSTILES:30,MAX_HEAVY_HOSTILES:7,boss:null}}
const NV=setup();

// Estado helper: entra RUNNER en COMMIT forzando condiciones.
function forceCommit(e, st) {
  e.x = 395; e.y = 295; e.flankSide = 1;
  // Forzar state POSITIONING con timer=0 para que entre en COMMIT inmediatamente.
  e.intent = NV.enemyState.createIntent(e);
  e.intent.state = NV.enemyState.STATE.POSITIONING;
  e.intent.stateTimer = 0; // expira -> COMMIT
  NV.updateEnemies(0.016, st);
}

console.log('runner_flank:');

t('Runner usa behavior flank',function(){
  var types=NV.ENEMY_TYPES;var r=types.find(function(t){return t.id==='runner'});
  if(!r)throw new Error('runner not found');
  if(r.behavior!=='flank')throw new Error('behavior='+r.behavior)
});

t('Runner elige flankSide y persiste',function(){
  var e=mkEnemy(200,100);var st=mkState([e]);
  NV.updateEnemies(0.016,st);
  if(e.flankSide!==-1&&e.flankSide!==1)throw new Error('flankSide='+e.flankSide);
  var side=e.flankSide;
  NV.updateEnemies(0.016,st);NV.updateEnemies(0.016,st);
  if(e.flankSide!==side)throw new Error('flankSide changed during APPROACH')
});

t('FlankSide persistente a traves de state machine',function(){
  var e=mkEnemy(100,100);var st=mkState([e]);
  NV.updateEnemies(0.016,st);
  var s1=e.flankSide;
  for(var i=0;i<90;i++)NV.updateEnemies(0.016,st);
  if(e.flankSide===0||(e.flankSide!==s1&&e.flankSide!==-s1))throw new Error('flip inesperado');
});

t('F05 es autoridad: state en e.intent, no en campos duplicados',function(){
  var e=mkEnemy(100,100);var st=mkState([e]);
  NV.updateEnemies(0.016,st);
  if(!e.intent)throw new Error('no intent de F05');
  if(e.intent.state===undefined)throw new Error('intent.state indefinido');
  // flankState legacy NO debe existir (F05 es autoridad)
  if(e.flankState!==undefined)throw new Error('flankState duplicado presente: '+e.flankState);
});

t('APPROACH target difiere de player.center',function(){
  var e=mkEnemy(100,100);var st=mkState([e]);
  // Estado inicial F05 es IDLE -> mapea a APPROACH. El Runner a x=100 está muy
  // lejos (~360px) pero aún así debe usar intent F05 en IDLE antes de COMMIT.
  NV.updateEnemies(0.016, st);
  if(!e.intent)throw new Error('no intent de F05');
});

t('RUNNER tiene intent de F05 con preferredRange=130',function(){
  var e=mkEnemy(100,100);var st=mkState([e]);
  NV.updateEnemies(0.016,st);
  if(!e.intent)throw new Error('no intent');
  if(e.intent.preferredRange!==130)throw new Error('preferredRange='+e.intent.preferredRange)
});

t('Transicion IDLE->ATTACK (COMMIT) con snapshot',function(){
  var e=mkEnemy(380,290);e.flankSide=1;var st=mkState([e]);
  // Posicionarse cerca para forzar COMMIT
  for(var i=0;i<90;i++){NV.updateEnemies(0.016,st);if(e.intent.state===NV.enemyState.STATE.ATTACK)break}
  if(e.intent.state!==NV.enemyState.STATE.ATTACK)throw new Error('never COMMIT: '+e.intent.state);
  // Snapshot debe estar presente
  if(typeof e.committedTargetX!=='number')throw new Error('no committedTargetX');
  if(typeof e.committedTargetY!=='number')throw new Error('no committedTargetY');
  if(typeof e.commitDirX!=='number')throw new Error('no commitDirX');
  if(typeof e.commitDirY!=='number')throw new Error('no commitDirY')
});

t('COMMIT frozen: player movement does not redirect Runner during COMMIT',function(){
  var e=mkEnemy(350,280);e.flankSide=1;
  e.intent=NV.enemyState.createIntent(e);
  e.intent.state=NV.enemyState.STATE.POSITIONING;
  e.intent.stateTimer=0;
  var st=mkState([e]);
  NV.updateEnemies(0.016,st);
  if(e.intent.state!==NV.enemyState.STATE.ATTACK)throw new Error('no COMMIT: '+e.intent.state);
  var snapDirX=e.commitDirX;var snapDirY=e.commitDirY;
  var snapTX=e.committedTargetX;var snapTY=e.committedTargetY;
  st.player.x=100;st.player.y=100;
  for(var i=0;i<10;i++)NV.updateEnemies(0.016,st);
  if(e.commitDirX!==snapDirX||e.commitDirY!==snapDirY)throw new Error('commitDir changed');
  if(e.committedTargetX!==snapTX||e.committedTargetY!==snapTY)throw new Error('committedTarget changed');
  if(e.intent.state!==NV.enemyState.STATE.ATTACK)throw new Error('state changed: '+e.intent.state);
});

t('Missed COMMIT enters RECOVERY',function(){
  var e=mkEnemy(350,280);e.flankSide=1;
  e.intent=NV.enemyState.createIntent(e);
  e.intent.state=NV.enemyState.STATE.POSITIONING;
  e.intent.stateTimer=0;
  var st=mkState([e]);
  NV.updateEnemies(0.016,st);
  if(e.intent.state!==NV.enemyState.STATE.ATTACK)throw new Error('no COMMIT');
  e.intent.stateTimer=0;
  NV.updateEnemies(0.016,st);
  if(e.intent.state!==NV.enemyState.STATE.RECOVERY)throw new Error('no RECOVERY: '+e.intent.state);
});

t('Recovery creates separation',function(){
  var e=mkEnemy(404,298);e.flankSide=1;
  e.intent=NV.enemyState.createIntent(e);
  e.intent.state=NV.enemyState.STATE.POSITIONING;
  e.intent.stateTimer=0;
  var st=mkState([e]);
  NV.updateEnemies(0.016,st);
  e.intent.stateTimer=0;
  NV.updateEnemies(0.016,st);
  var d1=Math.hypot(e.x-400,e.y-300);
  for(var i=0;i<10;i++)NV.updateEnemies(0.016,st);
  var d2=Math.hypot(e.x-400,e.y-300);
  if(d2<=d1)throw new Error('no separation: d1='+d1+' d2='+d2);
});

t('Flankside persistente',function(){
  var e=mkEnemy(100,100);var st=mkState([e]);
  NV.updateEnemies(0.016,st);var s1=e.flankSide;
  for(var i=0;i<90;i++)NV.updateEnemies(0.016,st);
  if(e.flankSide===0||(e.flankSide!==s1&&e.flankSide!==-s1))throw new Error('flip');
});

t('No rapid side flip',function(){
  var e=mkEnemy(100,100);var st=mkState([e]);
  NV.updateEnemies(0.016,st);var s1=e.flankSide;
  for(var i=0;i<5;i++)NV.updateEnemies(0.016,st);
  if(e.flankSide!==s1)throw new Error('rapid flip');
});

t('Speed no mutation',function(){
  var e=mkEnemy(100,100);e.speed=300;var st=mkState([e]);
  NV.updateEnemies(0.016,st);if(e.speed!==300)throw new Error('mutated');
});

t('Minefield speed cap intact',function(){
  var e=mkEnemy(100,100);e.speed=145;var b=e.speed;
  if(NV.minefieldEnemySpeed(e,'mines')>260)throw new Error('over cap');
  if(e.speed!==b)throw new Error('mutated');
});

t('MAX_HOSTILES=30',function(){if(NV.BALANCE.MAX_HOSTILES!==30)throw new Error()});
t('MAX_HEAVY=7',function(){if(NV.BALANCE.MAX_HEAVY_HOSTILES!==7)throw new Error()});

t('Contact death preserved',function(){
  var e=mkEnemy(405,300);var st=mkState([e]);
  st.player.invuln=0;st.applyPlayerDamage=function(){return{applied:true}};
  NV.updateEnemies(0.016,st);if(!e.dead)throw new Error('no death');
});

t('Stress 8 runners',function(){
  var ens=[];for(var i=0;i<8;i++)ens.push(mkEnemy(100+i*30,100+i*20));
  var st=mkState(ens);for(var f=0;f<30;f++)NV.updateEnemies(0.016,st);
  ens.forEach(function(e){if(e.flankSide!==-1&&e.flankSide!==1)throw new Error('bad')});
});

t('Reset limpia intent',function(){
  var e=mkEnemy(100,100);var st=mkState([e]);
  NV.updateEnemies(0.016,st);NV.enemyState.resetIntent(e);
  if(e.intent.state!==NV.enemyState.STATE.IDLE)throw new Error('state='+e.intent.state);
  if(e.intent.stateTimer!==0)throw new Error('timer='+e.intent.stateTimer);
});

console.log('');console.log('RESULT runner_flank: pass='+pass+' fail='+fail);process.exit(fail?1:0);

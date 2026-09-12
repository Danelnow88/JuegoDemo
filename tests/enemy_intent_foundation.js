// FEATURE 05: enemy intent/state foundation test
const fs=require('fs'),vm=require('vm');
let pass=0,fail=0;
function t(n,fn){try{fn();pass++;console.log('  ok  '+n)}catch(e){fail++;console.log('  FAIL '+n+' -> '+e.message)}}
function setup(){var m=Object.create(Math);m.random=function(){return 0.5};var sbx={window:{NV:{}},console:console,Math:m,Object:Object,Array:Array,Set:Set,Map:Map};['js/data/balance.js','js/data/gameData.js','js/engine/hostileBudget.js','js/engine/enemies.js','js/engine/enemyState.js'].forEach(function(f){try{vm.runInNewContext(fs.readFileSync(f,'utf8'),sbx,{filename:f})}catch(e){}});return sbx.window.NV}
var NV=setup();var S=NV.enemyState;
console.log('enemy_intent_foundation:');
t('STATE 6 fases',function(){if(!S||!S.STATE)throw new Error('ausente');if(Object.keys(S.STATE).length!==6)throw new Error('fases');['IDLE','POSITIONING','WINDUP','ATTACK','RECOVERY','RETREAT'].forEach(function(k){if(S.STATE[k]!==k.toLowerCase())throw new Error('falta')})});
t('createIntent IDLE defecto',function(){var i=S.createIntent({});if(!i||i.state!==S.STATE.IDLE||i.movementFactor!==1)throw new Error('bad')});
t('updateIntent decrementa timer',function(){var e={intent:S.createIntent({})};e.intent.stateTimer=1;S.updateIntent(e,0.5);if(e.intent.stateTimer!==0.5)throw new Error('t');S.updateIntent(e,1);if(e.intent.stateTimer!==0)throw new Error('neg')});
t('updateIntent safe sin intent',function(){S.updateIntent({x:0,y:0},0.016)});
t('resetIntent limpia',function(){var e={intent:S.createIntent({})};e.intent.state=S.STATE.ATTACK;e.intent.stateTimer=5;e.intent.attackLocked=true;e.intent.movementFactor=0;S.resetIntent(e);if(e.intent.state!==S.STATE.IDLE||e.intent.stateTimer!==0||e.intent.attackLocked!==false||e.intent.movementFactor!==1)throw new Error('bad')});
t('resetIntent safe sin intent',function(){S.resetIntent({x:0})});
t('attackMovementFactor clamp',function(){if(S.attackMovementFactor({attackMoveLock:0.5})!==0.5)throw new Error('0.5');if(S.attackMovementFactor({attackMoveLock:0})!==0)throw new Error('0');if(S.attackMovementFactor({attackMoveLock:1})!==1)throw new Error('1');if(S.attackMovementFactor({attackMoveLock:-1})!==0)throw new Error('neg');if(S.attackMovementFactor({attackMoveLock:2})!==1)throw new Error('2');if(S.attackMovementFactor({})!==1)throw new Error('def')});
t('computeSteering actualiza mf',function(){var e={attackMoveLock:0.3,intent:S.createIntent({})};S.computeSteering(e);if(e.intent.movementFactor!==0.3)throw new Error('mf')});
t('computeSteering safe sin intent',function(){S.computeSteering({x:0})});
t('intents independientes',function(){var a={intent:S.createIntent({})};var b={intent:S.createIntent({})};a.intent.state=S.STATE.ATTACK;if(b.intent.state!==S.STATE.IDLE)throw new Error('comparten')});
t('intent persiste ticks',function(){var e={intent:S.createIntent({})};var r=e.intent;S.updateIntent(e,0.016);S.updateIntent(e,0.016);if(e.intent!==r)throw new Error('recreado')});
t('preferredRangeOf null/pref',function(){if(S.preferredRangeOf({})!==null)throw new Error('null');if(S.preferredRangeOf({preferredRange:100})!==100)throw new Error('100')});
t('inPreferredBand in/out',function(){var e={x:0,y:0,preferredRange:100};if(!S.inPreferredBand(e,{x:50,y:0}))throw new Error('in');if(S.inPreferredBand(e,{x:200,y:0}))throw new Error('out')});
t('flankTargetOf perp',function(){var ft=S.flankTargetOf({x:0,y:0,flankOffset:50},{x:100,y:0});if(!ft||Math.abs(ft.x)>1e-6||Math.abs(Math.abs(ft.y)-50)>1e-6)throw new Error('bad')});
t('flankTargetOf null sin offset',function(){if(S.flankTargetOf({x:0,y:0},{x:100,y:0})!==null)throw new Error('null')});
t('retreatVectorFrom dir',function(){var v=S.retreatVectorFrom({x:0,y:0},{x:100,y:0});if(Math.abs(v.x+1)>1e-6||Math.abs(v.y)>1e-6)throw new Error('bad')});
t('retreatVectorFrom coincid=cero',function(){var v=S.retreatVectorFrom({x:50,y:50},{x:50,y:50});if(v.x!==0||v.y!==0)throw new Error('cero')});
t('updateEnemies legacy ok',function(){var en=[{x:100,y:100,hp:10,maxHp:10,damage:5,speed:30,radius:12,color:'#fff',shape:'circle',behavior:'chase',dead:false,knockVelX:0,knockVelY:0,hostileClass:'light',contactCd:0}];var st={enemies:en,player:{x:500,y:500,invuln:0,stun:0},bullets:[],MAX_BULLETS:10,MAX_ENEMY_BULLETS:10,enemyBulletCount:function(){return 0},applyPlayerDamage:function(){return{applied:false}},addFloatText:function(){},spawnExplosion:function(){},MAX_HOSTILES:30,MAX_HEAVY_HOSTILES:7,boss:null};var r=NV.updateEnemies(0.016,st);if(!r||!Array.isArray(r.enemies)||r.enemies.length!==1)throw new Error('bad')});
t('MAX_HOSTILES=30 MAX_HEAVY=7',function(){if(NV.BALANCE.MAX_HOSTILES!==30||NV.BALANCE.MAX_HEAVY_HOSTILES!==7)throw new Error('budget')});
t('separationCandidate',function(){var e={x:0,y:0,radius:14};var c=S.separationContributionCandidate(e,[]);if(c.candidate!==e||c.radius!==14)throw new Error('c');if(S.separationContributionCandidate(e,[],30).radius!==30)throw new Error('ov')});
t('pause no drena timer',function(){var e={intent:S.createIntent({})};e.intent.stateTimer=2;if(e.intent.stateTimer!==2)throw new Error('muto')});
console.log('');console.log('RESULT enemy_intent_foundation: pass='+pass+' fail='+fail);
process.exit(fail?1:0);
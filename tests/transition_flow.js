// Cinematic transition flow: state ownership, timers, locks, render invariants and settling FX.
const fs = require('fs');
const vm = require('vm');

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  ok  ' + name); }
  catch (error) { fail++; console.log('  FAIL ' + name + ' -> ' + error.message); }
}
function includesAll(source, values) {
  for (const value of values) if (!source.includes(value)) throw new Error('falta ' + value);
}
function count(source, value) {
  return source.split(value).length - 1;
}
function functionBlock(source, name, nextName) {
  const start = source.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('falta función ' + name);
  const end = nextName ? source.indexOf('function ' + nextName + '(', start + 1) : -1;
  return source.slice(start, end > start ? end : source.length);
}

const game = fs.readFileSync('js/game.js', 'utf8');
const fx = fs.readFileSync('js/engine/fx.js', 'utf8');
const meteorsSource = fs.readFileSync('js/engine/meteors.js', 'utf8');
const playerRender = fs.readFileSync('js/render/player.js', 'utf8');
const mobile = fs.readFileSync('js/ui/mobileControls.js', 'utf8');
const css = fs.readFileSync('css/styles.css', 'utf8');
const gameData = fs.readFileSync('js/data/gameData.js', 'utf8');
const synth = fs.readFileSync('js/audio/synth.js', 'utf8');
const bossSource = fs.readFileSync('js/engine/boss.js', 'utf8');

test('timings aprobados y estados explícitos', () => {
  includesAll(game, [
    'const DEATH_TRANSITION_DURATION = 0.82;',
    'const WAVE_END_DURATION = 2.10;',
    'const BOSS_WAVE_END_DURATION = 2.25;',
    'const SHOP_ENTER_DURATION = 0.35;',
    "state = 'player_dying';", "state = 'wave_end';", "state = 'shop_enter';", "state = 'shop';",
  ]);
});

test('muerte no usa setTimeout y finaliza/recompensa una sola vez', () => {
  const start = game.indexOf('function gameOver()');
  const end = game.indexOf('// === UPDATE ===', start);
  const flow = game.slice(start, end);
  if (flow.includes('setTimeout')) throw new Error('setTimeout residual en muerte');
  includesAll(flow, ['function finishPlayerDeath()', 'presentation.finalized', "state !== 'player_dying'", 'saveMeta();']);
});

test('muerte gana carrera contra fin de oleada', () => {
  const waveEnd = game.indexOf("if (transition <= 0 && waveTimer <= 0 && !boss)");
  const bulletUpdate = game.lastIndexOf('updateBullets(dt);', waveEnd);
  if (bulletUpdate < 0 || bulletUpdate > waveEnd) throw new Error('fin de oleada ocurre antes del daño de proyectiles');
  const block = game.slice(waveEnd, waveEnd + 420);
  if (!block.includes('if (player.hp <= 0) { gameOver(); return; }')) throw new Error('guard de prioridad ausente');
  const victoryStart = game.indexOf('function triggerWaveVictory');
  const victoryBlock = game.slice(victoryStart, victoryStart + 900);
  if (!victoryBlock.includes('if (player.hp <= 0) { gameOver(); return false; }')) throw new Error('prioridad ausente en muerte simultánea de boss');
});

test('wave_end bloquea combate y permite solo movimiento/recogida', () => {
  const start = game.indexOf('function updatePresentation(dt)');
  const end = game.indexOf('// === UPDATE ===', start);
  const flow = game.slice(start, end);
  includesAll(flow, [
    "if (state === 'wave_end')",
    'NV.updatePlayerMovement(player, combatIntent.moveX, combatIntent.moveY, dt)',
    'updatePickups(dt);', 'updateWeaponPickups(dt);', 'updateBossChests(dt);',
    'visualOnly: true', 'beginShopEntrance();',
  ]);
  for (const forbidden of ['updateEnemies(dt)', 'updateBoss(dt)', 'updateBullets(dt)', 'updateDrones(dt)']) {
    if (flow.includes(forbidden)) throw new Error('simulación prohibida en presentación: ' + forbidden);
  }
});

test('shop sigue una sola ruta wave_end -> shop_enter -> shop', () => {
  const begin = functionBlock(game, 'beginShopEntrance', 'finishShopEntrance');
  const finish = functionBlock(game, 'finishShopEntrance', 'updatePresentation');
  includesAll(begin, [
    "if (state !== 'wave_end') return;",
    "state = 'shop_enter';",
    'prepareShopContent();',
    'showShop();',
    'syncGameState();',
  ]);
  includesAll(finish, [
    "if (presentation.finalized || state !== 'shop_enter') return;",
    "state = 'shop';",
    "dom.shop.setAttribute('aria-hidden', 'false');",
    'syncGameState();',
  ]);
  if (count(begin, "state = 'shop_enter';") !== 1) throw new Error('shop_enter no es único');
  if (count(finish, "state = 'shop';") !== 1) throw new Error('shop final no es único');
  if (begin.includes('setTimeout') || finish.includes('setTimeout')) throw new Error('timer crítico en entrada de shop');
});

test('contenido, revelado y finalización del shop están separados', () => {
  const prepare = functionBlock(game, 'prepareShopContent', 'showShop');
  const show = functionBlock(game, 'showShop', 'reconcileConsumSel');
  const begin = functionBlock(game, 'beginShopEntrance', 'finishShopEntrance');
  const finish = functionBlock(game, 'finishShopEntrance', 'updatePresentation');
  includesAll(prepare, ['consumableBought = {};', 'generateOffers();', 'renderInventory();']);
  for (const forbidden of ['state =', 'syncGameState()', "classList.remove('hidden')", "classList.add('hidden')", 'resetPresentation()']) {
    if (prepare.includes(forbidden)) throw new Error('prepareShopContent mezcla presentación: ' + forbidden);
  }
  includesAll(show, ["if (state !== 'shop_enter') return false;", "setAttribute('aria-hidden', 'true')", "classList.remove('hidden')"]);
  if (count(show, "classList.remove('hidden')") !== 1) throw new Error('revelado hidden no es único');
  if (finish.includes('classList.') || finish.includes('prepareShopContent') || finish.includes('generateOffers') || finish.includes('renderInventory')) {
    throw new Error('finishShopEntrance reinicia visibilidad o contenido');
  }
  if (count(begin, 'prepareShopContent();') !== 1) throw new Error('contenido no se prepara exactamente una vez');
});

test('flujo normal y boss comparten trigger idempotente de victoria', () => {
  const trigger = functionBlock(game, 'triggerWaveVictory', 'triggerFlash');
  includesAll(game, ['triggerWaveVictory(false, null, null);']);
  includesAll(bossSource, ['st.triggerWaveVictory(true, bossName, bossColor);']);
  includesAll(trigger, ["state === 'wave_end'", "state === 'shop_enter'", "state === 'shop'", "state = 'wave_end';"]);
  if (count(trigger, "state = 'wave_end';") !== 1) throw new Error('wave_end no es único');
});

test('CSS da ownership exclusivo de entrada a shop_enter y deja shop estable', () => {
  includesAll(css, [
    'html[data-game-state="shop_enter"] #shop',
    'html[data-game-state="shop_enter"] #shop .shop-title',
    'html[data-game-state="shop_enter"] #shop .shop-section',
    'html[data-game-state="shop"] #shop',
    'animation: none !important;',
    '#permShop:not(.hidden) { animation: shop-in 0.4s ease-out both; }',
  ]);
  if (css.includes('.shop-screen:not(.hidden)')) throw new Error('selector legacy todavía alcanza #shop');
  const stableStart = css.indexOf('html[data-game-state="shop"] #shop');
  const stable = css.slice(stableStart, css.indexOf('}', stableStart) + 1);
  if (!stable.includes('animation: none !important;')) throw new Error('shop estable conserva animación');
});

test('input, pausa/settings y móvil quedan seguros durante transiciones', () => {
  includesAll(game, [
    'function clearCombatIntent()', 'combatIntent.fireIntent = false;',
    'combatIntent.dashIntent = false;', 'combatIntent.abilityIntent = false;',
    "if (state !== 'playing') return;",
  ]);
  includesAll(mobile, ['nv-game-state-change', 'resetButtons();', 'resetJoystick();']);
  includesAll(css, [
    'html[data-game-state="shop_enter"] #shop', 'pointer-events: none !important;',
    'html[data-game-state="wave_end"] .mobile-actions',
    'html[data-game-state="player_dying"] .mobile-hud',
  ]);
});

test('cámara es render-only y HUD restaura transform base', () => {
  includesAll(game, [
    'function cinematicView(vx, vy, vw, vh)',
    'const worldScaleX = scaleX * cinematic.zoom;',
    'ctx.setTransform(worldScaleX, 0, 0, worldScaleY, worldOffsetX, worldOffsetY);',
    'ctx.setTransform(scaleX, 0, 0, scaleY, -vx * scaleX, -vy * scaleY);',
    'const maxZoom = reduced ? 1.02 : 1.075;',
    'const focusP = Math.max(0, Math.min(1, (presentation.elapsed - 0.02) / 0.28));',
    'const maxZoom = reduced ? 1.02 : (presentation.isBoss ? 1.08 : 1.07);',
  ]);
  const cinematic = game.slice(game.indexOf('function cinematicView'), game.indexOf('function playerPresentationStyle'));
  for (const mutation of ['player.x =', 'player.y =', 'worldMetrics.set', 'setView']) {
    if (cinematic.includes(mutation)) throw new Error('cámara muta gameplay: ' + mutation);
  }
});

test('reset limpia presentación al iniciar, volver al menú y salir de Shop', () => {
  for (const name of ['function prepareMenuState()', 'function startGame()', 'function skipShop()']) {
    const start = game.indexOf(name);
    if (start < 0 || !game.slice(start, start + 1800).includes('resetPresentation();')) throw new Error('reset ausente en ' + name);
  }
});

test('player renderer acepta fade/shrink y flourish sin animación nueva', () => {
  includesAll(playerRender, [
    'presentation.scale', 'presentation.scaleX', 'presentation.scaleY', 'presentation.alpha', 'presentation.flourish',
    'ctx.scale(visualScaleX, visualScaleY);', 'ctx.globalAlpha = visualAlpha;',
  ]);
  includesAll(game, ['function playerPresentationStyle()', 'dissolve', 'flourish: Math.sin(local * Math.PI)']);
});

test('disolución crea 12 partículas espirales y decae', () => {
  const sandbox = { window: { NV: {} }, Math };
  vm.runInNewContext(fx, sandbox, { filename: 'fx.js' });
  const particles = [];
  sandbox.window.NV.spawnPlayerDissolve(particles, 100, 40, 50, '#abc');
  if (particles.length !== 12) throw new Error('count=' + particles.length);
  if (!particles.every((p) => p.spiral && p.color === '#abc')) throw new Error('partículas sin espiral/color');
  const before = particles[0].life;
  sandbox.window.NV.updateParticles(0.1, particles);
  if (!(particles[0].life < before)) throw new Error('life no decae');
});

test('V2 define una firma distinta para los cuatro pilotos', () => {
  includesAll(gameData, [
    'NV.PILOT_TRANSITIONS', 'layered-spiral', 'radial-release',
    'angular-fracture', 'broken-orbit', 'layer-lock',
    'energy-compress', 'shield-reform', 'orbit-sync',
  ]);
});

test('V2 parametriza 12 partículas sin romper el comportamiento por defecto', () => {
  const sandbox = { window: { NV: {} }, Math };
  vm.runInNewContext(fx, sandbox, { filename: 'fx.js' });
  const particles = [];
  sandbox.window.NV.spawnPlayerDissolve(particles, 100, 0, 0, '#abc', {
    colors: ['#1', '#2'], speed: [60, 60], life: [0.8, 0.8],
    size: [2, 2], spiral: [0, 0.12], originRadius: 18,
  });
  if (particles.length !== 12) throw new Error('count=' + particles.length);
  if (new Set(particles.map((p) => p.color)).size !== 2) throw new Error('firma de color no aplicada');
  if (!particles.every((p) => p.life === 0.8 && p.size === 2)) throw new Error('firma física no aplicada');
});

test('V2 usa renderer compartido, audio existente y estabilización pooled', () => {
  includesAll(game, ['NV.PILOT_TRANSITIONS', 'NV.spawnPlayerStabilize', 'sfx.deathTone', 'sfx.stabilizeTone']);
  includesAll(playerRender, ['layer-lock', 'energy-compress', 'shield-reform', 'orbit-sync']);
  includesAll(synth, ['sfx.deathTone', 'sfx.stabilizeTone', 'PILOT_TRANSITION_TONES']);
  includesAll(fx, ['NV.spawnPlayerStabilize', 'PARTICLE_POOL.length ? PARTICLE_POOL.pop() : {}']);
});

test('meteoros visual-only se mueven sin daño y terminan en <=0.8s', () => {
  const sandbox = { window: { NV: { BALANCE: {} } }, Math };
  vm.runInNewContext(meteorsSource, sandbox, { filename: 'meteors.js' });
  const enemy = { x: 10, y: 10, hp: 100, radius: 20, dead: false };
  let killed = 0, knocked = 0, exploded = 0;
  let meteors = [{ x: 10, y: 10, vx: 0, vy: 0, radius: 20, color: '#fff' }];
  for (let i = 0; i < 9; i++) {
    meteors = sandbox.window.NV.updateMeteors(0.1, meteors, {
      H: 500, enemies: [enemy], boss: null, shake: 0, visualOnly: true,
    }, {
      killEnemy() { killed++; }, applyKnockback() { knocked++; }, spawnExplosion() { exploded++; },
    }).meteors;
  }
  if (enemy.hp !== 100 || killed || knocked || exploded) throw new Error('visual-only produjo gameplay');
  if (meteors.length !== 0) throw new Error('meteoro no asentó');
});

test('CSS anima entradas y respeta reduced motion', () => {
  includesAll(css, ['@keyframes nv-shop-enter', '@keyframes nv-gameover-enter', '@media (prefers-reduced-motion: reduce)']);
});

console.log('RESULT transition_flow: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
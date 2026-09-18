// Tests Tarea #2: impacto -> reacción -> poof -> dissolve -> residuos -> respiración -> FIN.
const fs = require('fs'), vm = require('vm'), assert = require('assert');
let pass = 0, fail = 0;
function t(desc, fn) { try { fn(); pass++; console.log('  ok  ' + desc); } catch (e) { fail++; console.log('  FAIL ' + desc + ' -> ' + e.message); } }
const game = fs.readFileSync('js/game.js', 'utf8');
function numConst(name) {
  const m = new RegExp('const ' + name + ' = ([0-9.]+);').exec(game);
  if (!m) throw new Error('falta const ' + name);
  return Number(m[1]);
}
function functionBlock(name, nextName) {
  const start = game.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('falta funcion ' + name);
  const end = nextName ? game.indexOf('function ' + nextName + '(', start + 1) : -1;
  return game.slice(start, end > start ? end : game.length);
}
function loadDeathVisual() {
  const c = {
    PLAYER_DEATH_IMPACT_END: numConst('PLAYER_DEATH_IMPACT_END'),
    PLAYER_DEATH_POP_END: numConst('PLAYER_DEATH_POP_END'),
    PLAYER_DEATH_POOF_T: numConst('PLAYER_DEATH_POOF_T'),
    PLAYER_DEATH_MAIN_PUFF_END: numConst('PLAYER_DEATH_MAIN_PUFF_END'),
    PLAYER_DEATH_DISSOLVE_END: numConst('PLAYER_DEATH_DISSOLVE_END'),
    PLAYER_DEATH_VISUAL_END: numConst('PLAYER_DEATH_VISUAL_END'),
    DEATH_TRANSITION_DURATION: numConst('DEATH_TRANSITION_DURATION'),
  };
  vm.createContext(c);
  const ease = game.slice(game.indexOf('function easeOutCubic('), game.indexOf('function easeInOutCubic('));
  const src = game.slice(game.indexOf('function playerDeathVisualAt('), game.indexOf('function drawPlayerDeathPuff('));
  vm.runInContext(ease + '\n' + src + '\nthis.playerDeathVisualAt = playerDeathVisualAt;', c);
  return { vis: c.playerDeathVisualAt, constants: c };
}

t('1 timeline total 0.82s, visual-end 0.70s y respiracion 0.12s', () => {
  const fin = numConst('DEATH_TRANSITION_DURATION');
  const visualEnd = numConst('PLAYER_DEATH_VISUAL_END');
  assert.strictEqual(fin, 0.82, 'FIN=' + fin);
  assert.strictEqual(visualEnd, 0.70, 'visualEnd=' + visualEnd);
  assert.ok(fin >= 0.75 && fin <= 0.95, 'fuera de rango');
  assert.ok(fin > visualEnd, 'FIN no espera');
  assert.ok(fin - visualEnd >= 0.08 && fin - visualEnd <= 0.15, 'respiracion=' + (fin - visualEnd));
  assert.strictEqual(numConst('WAVE_CLEANUP_DURATION'), 0.4, '#10 tocado');
});
t('2 gameOver entra una vez y finishPlayerDeath esta protegido', () => {
  const start = functionBlock('gameOver', 'finishPlayerDeath');
  const finish = functionBlock('finishPlayerDeath', 'beginShopEntrance');
  assert.strictEqual(start.split("state = 'player_dying';").length - 1, 1, 'player_dying no unico');
  assert.ok(start.includes("if (state === 'player_dying' || state === 'gameover') return false;"), 'guard gameOver');
  assert.ok(finish.includes("if (presentation.finalized || state !== 'player_dying') return;"), 'guard finish');
  assert.strictEqual(finish.split("state = 'gameover';").length - 1, 1, 'gameover no unico');
  assert.ok(!start.includes('setTimeout'), 'setTimeout residual');
});
t('3 dissolve unico conserva identidad y termina antes del fin visual', () => {
  const block = functionBlock('gameOver', 'finishPlayerDeath');
  assert.strictEqual(block.split('NV.spawnPlayerDissolve(').length - 1, 1, 'dissolve no unico');
  for (const s of ['deathStyle.colors', 'deathStyle.speed', 'life: scaleLife', 'deathStyle.size', 'deathStyle.spiral', 'deathStyle.downwardDrift', "deathStyle.deathMotion === 'angular-fracture'", 'PLAYER_DEATH_DISSOLVE_END / baseLifeMax']) assert.ok(block.includes(s), 'falta ' + s);
  assert.ok(numConst('PLAYER_DEATH_DISSOLVE_END') < numConst('PLAYER_DEATH_VISUAL_END'), 'dissolve invade respiracion');
});
t('4 impacto, pop y colapso son fases perceptibles', () => {
  const v = loadDeathVisual().vis;
  const impact = v(0.03), pop = v(0.08), popPeak = v(0.12), collapse = v(0.17);
  assert.strictEqual(impact.bodyAlpha, 1, 'impacto no reconocible');
  assert.ok(impact.bodyScale > 1 && impact.bodyScale < 1.03, 'pulso impacto');
  assert.ok(pop.bodyScale > impact.bodyScale, 'sin anticipacion');
  assert.ok(popPeak.bodyScaleX >= 1.08 && popPeak.bodyScaleY >= 1.07, 'pop debil');
  assert.ok(collapse.bodyScaleY < 0.85 && collapse.bodyScaleX < 0.92, 'sin squash');
  assert.ok(collapse.bodyAlpha > 0.8, 'fade fuerte prematuro');
});
t('5 sustitucion estricta body ON/puff OFF -> body OFF/puff ON', () => {
  const v = loadDeathVisual().vis, poof = numConst('PLAYER_DEATH_POOF_T');
  const before = v(poof - 0.01), at = v(poof), after = v(poof + 0.01);
  assert.strictEqual(before.bodyVisible, true, 'body pre-poof');
  assert.strictEqual(before.puffActive, false, 'puff prematuro');
  assert.strictEqual(at.bodyVisible, false, 'body presente en poof');
  assert.ok(at.puffAlpha >= 0.95, 'nucleo no nace fuerte');
  assert.strictEqual(after.bodyVisible, false, 'body vuelve');
  assert.ok(after.puffActive, 'puff ausente tras poof');
});
t('6 puff multicapa mantiene ventana principal y cola residual', () => {
  const v = loadDeathVisual().vis;
  assert.ok(v(0.19).shockAlpha > 0.6, 'onda debil');
  assert.ok(v(0.20).miniPuffAlpha > 0, 'mini-puffs ausentes');
  assert.ok(v(0.20).accentAlpha > 0, 'acentos ausentes');
  assert.ok(v(0.30).puffAlpha > 0.9, 'puff principal debil');
  assert.ok(v(0.50).puffAlpha > 0 && v(0.50).puffAlpha < v(0.30).puffAlpha, 'sin disipacion');
  assert.ok(v(0.69).puffActive, 'sin cola visual');
  assert.strictEqual(v(0.70).puffActive, false, 'visual no termina exacto');
});
t('7 dissolve acompana poof/disipacion y termina antes de FIN', () => {
  const v = loadDeathVisual().vis;
  assert.strictEqual(v(0).dissolveActive, true, 'dissolve no inicia');
  assert.strictEqual(v(0.30).dissolveActive, true, 'dissolve no acompana explosion');
  assert.strictEqual(v(0.60).dissolveActive, true, 'dissolve no acompana disipacion');
  assert.strictEqual(v(0.68).dissolveActive, false, 'dissolve residual');
  assert.strictEqual(v(0.70).visualActive, false, 'visual residual');
  assert.strictEqual(v(0.81).finVisible, false, 'FIN prematuro');
  assert.strictEqual(v(0.82).finVisible, true, 'FIN tarde');
});
t('8 update llama FIN solo al completar duracion, no al visual-end', () => {
  const flow = game.slice(game.indexOf('function updatePresentation(dt)'), game.indexOf('// === UPDATE ==='));
  assert.ok(flow.includes('if (presentation.elapsed >= presentation.duration) finishPlayerDeath();'), 'FIN no ligado a duracion');
  assert.ok(!flow.includes('presentation.elapsed >= PLAYER_DEATH_VISUAL_END) finishPlayerDeath'), 'FIN ligado al visual-end');
});
t('9 FIN conserva textos, datos y recompensas', () => {
  const block = functionBlock('finishPlayerDeath', 'beginShopEntrance');
  for (const s of ["dom.goTitle.textContent = 'FIN';", "dom.goText.textContent = 'Llegaste a la oleada ' + wave;", 'dom.goScore.textContent = formatPoints(score);', 'dom.goWave.textContent = wave;', 'metaShards += Math.floor(shards / 2) + Math.floor(score / 100);', 'saveMeta();']) assert.ok(block.includes(s), 'FIN modificado: ' + s);
});
t('10 render separa cuerpo y puff, wrapper es determinista', () => {
  const render = game.slice(game.indexOf('function draw() {'), game.indexOf('function drawSpecialVFX'));
  assert.ok(render.includes('presentation.elapsed < PLAYER_DEATH_POOF_T) drawPlayer();'), 'body no gated');
  assert.ok(render.includes('presentation.elapsed >= PLAYER_DEATH_POOF_T) drawPlayerDeathPuff(ctx);'), 'puff no gated');
  const helper = game.slice(game.indexOf('function drawPlayerDeathPuff('), game.indexOf('function drawEnemy('));
  assert.ok(helper.includes('drawCleanupPuff(c2,'), 'no reutiliza base #10');
  assert.ok(helper.includes('vis.shockAlpha') && helper.includes('vis.miniPuffAlpha') && helper.includes('vis.accentAlpha'), 'faltan capas');
  assert.ok(!helper.includes('Math.random') && !helper.includes('particles.push'), 'wrapper no determinista');
});
t('11 #10 conserva helper, constantes y ruta exacta', () => {
  for (const s of ['function drawCleanupPuff(c2, e, progress, puffAlpha, puffScale)', 'const WAVE_CLEANUP_POP_T = 0.08;', 'const WAVE_CLEANUP_POP_SCALE = 1.08;', 'const poofT = 0.105;', 'drawCleanupPuff(ctx, e, cleanupProgress, cleanupPuffAlpha, cleanupPuffScale);']) assert.ok(game.includes(s), '#10 modificado: ' + s);
});
t('12 no hay transformaciones de muerte durante gameplay normal', () => {
  const style = functionBlock('playerPresentationStyle', 'syncGameState');
  assert.ok(style.includes('return null;'), 'gameplay recibe estilo');
  assert.ok(style.includes("if (state === 'player_dying' || state === 'gameover')"), 'estilo fuera de muerte');
});

console.log('RESULT player_death_animation: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
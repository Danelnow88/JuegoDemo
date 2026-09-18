const fs = require('fs');
const vm = require('vm');

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log('  ok  ' + name); }
  catch (error) { fail++; console.log('  FAIL ' + name + ' -> ' + error.message); }
}
function assert(condition, message) { if (!condition) throw new Error(message); }

function makeCtx() {
  const calls = [];
  const ctx = {
    calls,
    font: 'bold 14px system-ui',
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    globalAlpha: 1,
    save() { calls.push({ op: 'save' }); },
    restore() { calls.push({ op: 'restore' }); },
    fillRect(x, y, w, h) { calls.push({ op: 'fillRect', x, y, w, h, color: this.fillStyle }); },
    strokeRect(x, y, w, h) { calls.push({ op: 'strokeRect', x, y, w, h, color: this.strokeStyle }); },
    fillText(text, x, y) { calls.push({ op: 'fillText', text, x, y, color: this.fillStyle, font: this.font, alpha: this.globalAlpha }); },
    strokeText(text, x, y) { calls.push({ op: 'strokeText', text, x, y, color: this.strokeStyle, font: this.font, alpha: this.globalAlpha }); },
    measureText(text) {
      const match = /(\d+)px/.exec(this.font);
      const size = match ? Number(match[1]) : 14;
      return { width: String(text).length * size * 0.58 };
    }
  };
  return ctx;
}

const sandbox = { window: { NV: {} }, console, Math, Date, performance: { now: () => 0 } };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('js/render/hud.js', 'utf8'), sandbox, { filename: 'hud.js' });
vm.runInContext(fs.readFileSync('js/engine/fx.js', 'utf8'), sandbox, { filename: 'fx.js' });
vm.runInContext(fs.readFileSync('js/engine/boss.js', 'utf8'), sandbox, { filename: 'boss.js' });
const NV = sandbox.window.NV;

const boss = { x: 100, y: 80, radius: 42, hp: 600, maxHp: 1000, name: 'TITÁN', dead: false };

t('layout HUD del boss no depende de boss.x ni boss.y', () => {
  const first = makeCtx();
  NV.drawBossHUD(first, 30, 20, 900, 520, boss, false);
  const firstBar = first.calls.find((call) => call.op === 'strokeRect');
  boss.x = 850; boss.y = 5;
  const second = makeCtx();
  NV.drawBossHUD(second, 30, 20, 900, 520, boss, false);
  const secondBar = second.calls.find((call) => call.op === 'strokeRect');
  assert(firstBar.x === secondBar.x && firstBar.y === secondBar.y, 'la barra siguió al boss');
});

t('desktop y mobile colocan boss bar sobre DASH sin overlap', () => {
  for (const mobile of [false, true]) {
    const layout = NV.getBottomCombatHudLayout(15, 10, mobile ? 480 : 900, 520, mobile);
    const dashLabelTop = layout.dashY - (mobile ? 11 : 12);
    assert(layout.bossBarY + layout.bossBarH < dashLabelTop, 'boss bar invade DASH en ' + (mobile ? 'mobile' : 'desktop'));
    assert(dashLabelTop - (layout.bossBarY + layout.bossBarH) === layout.bossDashGap, 'gap incorrecto');
  }
});

t('ancho responsive queda centrado y dentro del viewport', () => {
  const wide = NV.getBottomCombatHudLayout(40, 0, 900, 520, false);
  const narrow = NV.getBottomCombatHudLayout(40, 0, 210, 520, true);
  assert(wide.bossBarW === 260, 'desktop no conserva ancho normal');
  assert(narrow.bossBarW === 186, 'viewport angosto no descuenta márgenes');
  assert(narrow.bossBarX >= 52 && narrow.bossBarX + narrow.bossBarW <= 238, 'barra sale lateralmente');
  assert(narrow.bossBarX + narrow.bossBarW / 2 === 145, 'barra no centrada');
});

t('guards: boss null, muerto o maxHp inválido no dibujan HUD', () => {
  const ctx = makeCtx();
  assert(NV.drawBossHUD(ctx, 0, 0, 900, 520, null, false) === false, 'null visible');
  assert(NV.drawBossHUD(ctx, 0, 0, 900, 520, { ...boss, dead: true }, false) === false, 'dead visible');
  assert(NV.drawBossHUD(ctx, 0, 0, 900, 520, { ...boss, maxHp: 0 }, false) === false, 'maxHp inválido visible');
  assert(ctx.calls.length === 0, 'dibujó con guard activo');
});

t('fill de HP y colores conservan umbrales 40/20', () => {
  const cases = [
    { hp: 600, color: '#7cf8ff', pct: 0.6 },
    { hp: 300, color: '#ffcf76', pct: 0.3 },
    { hp: 200, color: '#ff5f9b', pct: 0.2 }
  ];
  for (const entry of cases) {
    const ctx = makeCtx();
    NV.drawBossHUD(ctx, 0, 0, 900, 520, { ...boss, hp: entry.hp }, false);
    const fills = ctx.calls.filter((call) => call.op === 'fillRect');
    assert(fills[1].color === entry.color, 'color incorrecto para ' + entry.hp);
    assert(Math.abs(fills[1].w / fills[0].w - entry.pct) < 0.0001, 'fill incorrecto para ' + entry.hp);
  }
});

t('HUD se invoca una vez desde capa HUD y no desde renderer normal/spectral', () => {
  const game = fs.readFileSync('js/game.js', 'utf8');
  const normal = fs.readFileSync('js/render/bosses.js', 'utf8');
  const spectral = fs.readFileSync('js/render/spectralEnemies2D.js', 'utf8');
  assert((game.match(/NV\.drawBossHUD\(/g) || []).length === 1, 'invocación HUD duplicada o ausente');
  assert(!normal.includes('barW') && !normal.includes('boss.radius - 40'), 'barra world-space normal sigue presente');
  assert(!spectral.includes('drawBossHpBar'), 'barra world-space spectral sigue presente');
  assert(game.indexOf('NV.drawBossHUD(') > game.indexOf("if (showHUD && (state === 'playing' || state === 'wave_end'))"), 'HUD fuera del guard de gameplay');
});

t('boss centrado usa diálogo arriba y boss superior hace flip abajo', () => {
  const ctx = makeCtx();
  const centered = NV.getBossReactionLayout(ctx, {
    text: '¡PAJERO!', size: 14, life: 0.8, bossReaction: true,
    boss: { x: 450, y: 250, radius: 40, dead: false }
  }, 0, 0, 900, 520, false);
  const top = NV.getBossReactionLayout(ctx, {
    text: '¡PAJERO!', size: 14, life: 0.8, bossReaction: true,
    boss: { x: 450, y: 12, radius: 40, dead: false }
  }, 0, 0, 900, 520, false);
  assert(centered.flipped === false && centered.baseline < 250, 'centro no quedó arriba');
  assert(top.flipped === true && top.baseline > 12, 'borde superior no hizo flip');
});

t('clamp horizontal considera ancho completo a izquierda y derecha', () => {
  const ctx = makeCtx();
  const text = '¡NO ME ROMPAS LAS BOLAS!';
  for (const x of [0, 900]) {
    const layout = NV.getBossReactionLayout(ctx, {
      text, size: 14, life: 0.8, bossReaction: true,
      boss: { x, y: 200, radius: 40, dead: false }
    }, 0, 0, 900, 520, false);
    assert(layout.x - layout.width / 2 >= layout.safe - 0.001, 'corta por izquierda');
    assert(layout.x + layout.width / 2 <= 900 - layout.safe + 0.001, 'corta por derecha');
  }
});

t('frase larga mobile reduce fuente y usa como máximo dos líneas', () => {
  const ctx = makeCtx();
  const layout = NV.getBossReactionLayout(ctx, {
    text: '¡LA RE PUTÍSIMA MADRE!', size: 14, life: 0.8, bossReaction: true,
    boss: { x: 90, y: 100, radius: 30, dead: false }
  }, 0, 0, 180, 320, true);
  assert(layout.fontSize >= 10 && layout.fontSize <= 14, 'font-size ilegible');
  assert(layout.lines.length <= 2, 'creó más de dos líneas');
  assert(layout.width <= 160.001, 'frase excede safe width');
});

t('pool nuevo coincide exactamente y no conserva RAGE/FURY/ALERT', () => {
  const expected = [
    '@%$#!', '#@#$!*', '¡GRRRR!', '¡PAJERO!', '¿AH, SÍ?', '¡VENÍ, DALE!',
    '¡COMEME LOS HUEVOS!', '¡YA VAS A VER!', '¡AHORA VAS A VER!', '¡NO JODAS!',
    '¡AGUANTÁ!', '¡LA PUTA MADRE!', '¡LA RE PUTÍSIMA MADRE!', '¡ME DOLIÓ, FORRO!',
    '¡¿QUÉ HACÉS?!', '¡¿QUÉ MIRÁS TONTÍN?!', '¡DALE PETE, PEGÁ!', '¡ESO NO FUE NADA!',
    '¡¿ESO ES TODO?!', '¡TE ESTOY ESPERANDO!', '¡TE VOY A HACER MIERDA!',
    '¡TE HAGO CACA!', '¡TE VOY A ROMPER TODO!', '¡NO ME ROMPAS LAS BOLAS!'
  ];
  assert(JSON.stringify(Array.from(NV.BOSS_RAGE_TEXTS)) === JSON.stringify(expected), 'pool distinto al solicitado');
  for (const removed of ['RAGE', 'FURY', 'ALERT']) assert(!NV.BOSS_RAGE_TEXTS.includes(removed), 'sigue ' + removed);
});

t('threshold 2.5%, cooldown 1.6s y metadata exclusiva quedan intactos', () => {
  const b = { x: 10, y: 20, radius: 30, hp: 1000, maxHp: 1000, dead: false };
  const texts = [];
  const add = (...args) => texts.push(args);
  assert(NV.bossHitReaction(b, 24.99, add) === false, 'threshold bajó');
  assert(NV.bossHitReaction(b, 25, add) === true, '2.5% no dispara');
  assert(b.rageCd === 1.6, 'cooldown cambió');
  assert(texts[0][5] && texts[0][5].bossReaction === true, 'sin metadata bossReaction');
  assert(NV.bossHitReaction(b, 100, add) === false, 'cooldown no bloquea');
});

t('float texts generales conservan objeto, movimiento y duración', () => {
  const texts = [];
  NV.addFloatText(texts, 50, 80, '+10', '#fff');
  assert(texts.length === 1 && texts[0].bossReaction === undefined, 'metadata contaminó texto general');
  assert(texts[0].life === 0.8 && texts[0].size === 14, 'defaults cambiaron');
  NV.updateFloatTexts(0.1, texts);
  assert(texts[0].y === 74 && Math.abs(texts[0].life - 0.7) < 0.0001, 'update general cambió');
});

t('bossReaction usa life 1.8s con fade-in 0.12s y hold hasta 1.2s', () => {
  const texts = [];
  const reactionBoss = { x: 450, y: 180, radius: 40, dead: false };
  NV.addFloatText(texts, 450, 126, '¡TE VOY A ROMPER TODO!', '#ff5f5f', 14, {
    bossReaction: true, boss: reactionBoss, bossX: 450, bossY: 180, bossRadius: 40
  });
  const ft = texts[0];
  assert(ft.life >= 1.7 && ft.life <= 1.9, 'life fuera del rango 1.7-1.9');
  assert(ft.life === 1.8, 'life no es exactamente 1.8s');
  assert(NV.BOSS_REACTION_TIMING.fadeInEnd === 0.12, 'fade-in distinto de 0.12s');
  assert(NV.BOSS_REACTION_TIMING.holdEnd === 1.2, 'hold no termina en 1.2s');
  assert(NV.BOSS_REACTION_TIMING.fadeOutDuration === 0.6, 'fade-out distinto de 0.6s');
});

t('alpha aparece rápido, queda opaco ~1s y no inicia fade-out inmediatamente', () => {
  const ft = { bossReaction: true, age: 0, life: 1.8 };
  assert(NV.getBossReactionAlpha(ft) === 0, 'no inicia transparente para entrada rápida');
  ft.age = 0.06;
  assert(Math.abs(NV.getBossReactionAlpha(ft) - 0.5) < 0.0001, 'fade-in no progresa rápido');
  for (const age of [0.12, 0.15, 0.5, 1.0, 1.2]) {
    ft.age = age;
    assert(NV.getBossReactionAlpha(ft) >= 0.999, 'alpha bajó durante lectura en t=' + age);
  }
});

t('fade-out final es progresivo, suave y sincroniza outline con relleno', () => {
  const ft = {
    text: '¡ME DOLIÓ, FORRO!', color: '#ff5f5f', size: 14, life: 0.3, age: 1.5,
    bossReaction: true, boss: { x: 450, y: 180, radius: 40, dead: false }
  };
  const mid = NV.getBossReactionAlpha(ft);
  ft.age = 1.65;
  const late = NV.getBossReactionAlpha(ft);
  ft.age = 1.8;
  const end = NV.getBossReactionAlpha(ft);
  assert(mid > late && late > end, 'fade-out no desciende progresivamente');
  assert(Math.abs(mid - 0.5) < 0.0001, 'curva suave no pasa por alpha 0.5 a mitad');
  assert(end === 0, 'alpha final no llega a cero');
  ft.age = 1.5;
  const ctx = makeCtx();
  NV.drawBossReactionText(ctx, ft, 0, 0, 900, 520, false);
  const stroke = ctx.calls.find((call) => call.op === 'strokeText');
  const fill = ctx.calls.find((call) => call.op === 'fillText');
  assert(stroke && fill && stroke.alpha === fill.alpha, 'outline y relleno usan alpha distinto');
  assert(Math.abs(fill.alpha - mid) < 0.0001, 'render no usa la curva bossReaction');
});

t('bossReaction desaparece al terminar 1.8s y se mueve poco durante hold', () => {
  let texts = [];
  const reactionBoss = { x: 450, y: 180, radius: 40, dead: false };
  NV.addFloatText(texts, 450, 126, '¡COMEME LOS HUEVOS!', '#ff5f5f', 14, {
    bossReaction: true, boss: reactionBoss, bossX: 450, bossY: 180, bossRadius: 40
  });
  const ft = texts[0];
  const originalY = ft.y;
  texts = NV.updateFloatTexts(0.12, texts);
  const driftAfterEntry = ft.bossReactionDrift;
  texts = NV.updateFloatTexts(1.08, texts);
  const holdDrift = ft.bossReactionDrift - driftAfterEntry;
  assert(ft.y === originalY, 'bossReaction alteró la coordenada y global');
  assert(holdDrift <= 0.55, 'se desplazó demasiado durante hold: ' + holdDrift);
  assert(texts.length === 1 && Math.abs(ft.life - 0.6) < 0.0001, 'murió antes del fade final');
  texts = NV.updateFloatTexts(0.59, texts);
  assert(texts.length === 1, 'desapareció antes de completar life');
  texts = NV.updateFloatTexts(0.01, texts);
  assert(texts.length === 0, 'sigue activa al terminar life');
});

t('segunda reacción reemplaza sólo la anterior del mismo boss', () => {
  const texts = [];
  const bossA = { x: 200, y: 100, radius: 30, dead: false };
  const bossB = { x: 700, y: 100, radius: 30, dead: false };
  NV.addFloatText(texts, 200, 56, 'PRIMERA', '#ff5f5f', 14, { bossReaction: true, boss: bossA });
  NV.addFloatText(texts, 700, 56, 'OTRO BOSS', '#ff5f5f', 14, { bossReaction: true, boss: bossB });
  NV.addFloatText(texts, 50, 80, '+10', '#fff');
  NV.addFloatText(texts, 200, 56, 'SEGUNDA', '#ff5f5f', 14, { bossReaction: true, boss: bossA });
  assert(texts.filter((ft) => ft.bossReaction && ft.boss === bossA).length === 1, 'quedaron dos reacciones del mismo boss');
  assert(texts.some((ft) => ft.text === 'SEGUNDA'), 'no quedó la reacción nueva');
  assert(!texts.some((ft) => ft.text === 'PRIMERA'), 'no retiró la reacción anterior');
  assert(texts.some((ft) => ft.boss === bossB), 'eliminó reacción de otro boss');
  assert(texts.some((ft) => ft.text === '+10'), 'afectó float text normal');
});

t('flip y clamps siguen válidos durante hold y fade final', () => {
  const ctx = makeCtx();
  for (const age of [0.5, 1.5]) {
    const life = 1.8 - age;
    const top = NV.getBossReactionLayout(ctx, {
      text: '¡NO ME ROMPAS LAS BOLAS!', size: 14, life, age, bossReaction: true,
      bossReactionDrift: age < 1.2 ? 1.4 : 2.4,
      boss: { x: 0, y: 12, radius: 40, dead: false }
    }, 0, 0, 180, 320, true);
    assert(top.flipped === true && top.baseline > 12, 'perdió flip en age=' + age);
    assert(top.x - top.width / 2 >= top.safe - 0.001, 'perdió clamp izquierdo en age=' + age);
    assert(top.x + top.width / 2 <= 180 - top.safe + 0.001, 'perdió clamp derecho en age=' + age);
  }
});

console.log('RESULT boss_hud_readability: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
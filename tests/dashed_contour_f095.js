// F09.5 — regresión: el contorno punteado "Buscando" alrededor del jugador fue eliminado.
// Semántico (no brittle): instrumenta ctx y verifica comportamiento, no strings sueltos.
const fs = require('fs'), vm = require('vm');
let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; console.log('  ok  ' + name); } catch (e) { fail++; console.log('  FAIL ' + name + ' -> ' + e.message); } }

function mkCtx() {
  const rec = { arcs: [], dashes: [], strokes: 0, moves: [] };
  const base = {
    save() {}, restore() {}, beginPath() {},
    stroke() { rec.strokes++; },
    fill() {}, closePath() {},
    arc(x, y, r) { rec.arcs.push({ x, y, r }); },
    moveTo(x, y) { rec.moves.push([x, y]); }, lineTo() {},
    setLineDash(d) { rec.dashes.push(Array.isArray(d) ? d.slice() : d); },
    createRadialGradient() { return { addColorStop() {} }; },
    createLinearGradient() { return { addColorStop() {} }; },
  };
  const ctx = new Proxy(base, {
    get(tt, k) { if (k in rec) return rec[k]; if (k in tt) return tt[k]; return (tt[k] = function () { return tt; }); },
    set() { return true; },
  });
  return { ctx, rec };
}

const NV = {};
vm.runInNewContext(fs.readFileSync('js/render/metaReadability.js', 'utf8'), { window: { NV }, Map, WeakMap, Math });

const player = { x: 400, y: 300 };

t('sin target: NO dibuja contorno punteado alrededor del jugador', () => {
  const { ctx, rec } = mkCtx();
  const ret = NV.drawAutofireTarget(ctx, null, 0, player, false, false, { t: 1 });
  if (ret !== false) throw new Error('debió retornar false sin target');
  const playerArcs = rec.arcs.filter((a) => a.x === player.x && a.y === player.y);
  if (playerArcs.length !== 0) throw new Error('arco centrado en jugador persiste: ' + JSON.stringify(playerArcs));
  if (rec.dashes.some((d) => d.join(',') === '4,4')) throw new Error('dash [4,4] del contorno persiste');
  if (rec.strokes !== 0) throw new Error('strokes=' + rec.strokes + ' (esperaba 0 sin target)');
});

t('sin target muerto: tampoco dibuja contorno', () => {
  const { ctx, rec } = mkCtx();
  const ret = NV.drawAutofireTarget(ctx, { x: 10, y: 10, radius: 8, dead: true }, 0, player, false, false, { t: 1 });
  if (ret !== false) throw new Error('debió retornar false con target muerto');
  if (rec.arcs.some((a) => a.x === player.x && a.y === player.y)) throw new Error('contorno en target muerto');
});

t('con target: retículo sobre el OBJETIVO sigue intacto (no sobre el jugador)', () => {
  const { ctx, rec } = mkCtx();
  const target = { x: 120, y: 130, radius: 10 };
  const ret = NV.drawAutofireTarget(ctx, target, 0, player, true, false, { t: 1 });
  if (ret !== true) throw new Error('debió retornar true con target');
  if (rec.strokes < 1) throw new Error('sin trazos de retículo');
  if (!rec.arcs.some((a) => a.x === target.x && a.y === target.y)) throw new Error('falta aro sobre el objetivo');
  if (rec.arcs.some((a) => a.x === player.x && a.y === player.y)) throw new Error('retículo contamina al jugador');
});

t('HUD: indicadores de habilidad + dash siguen existiendo (no se rompió el panel)', () => {
  const h = fs.readFileSync('js/render/hud.js', 'utf8');
  if (!h.includes('NV.drawWeaponHUD') || !h.includes('NV.drawDashStamina')) throw new Error('HUD ability/dash ausente');
  if (!h.includes('ctx.arc(rcx, rcy, rrad')) throw new Error('sin anillo de cooldown del slot de skill');
  if (!h.includes("'LISTO' : 'CD '")) throw new Error('sin texto CD/LISTO');
  if (/NV\.drawSpecialCooldown\s*=\s*function[^}]*ctx\.arc/.test(h)) throw new Error('se reintrodujo anillo world-space de cooldown');
});

t('F09.4 sigue eliminado: sin aura genérica ni cooldown world-space', () => {
  const g = fs.readFileSync('js/game.js', 'utf8');
  const p = fs.readFileSync('js/render/player.js', 'utf8');
  if (!/function drawSpecialCooldown\(\)\s*\{\s*return;?\s*\}/.test(g)) throw new Error('stub drawSpecialCooldown alterado');
  if (p.includes('auraPulse')) throw new Error('auraPulse reintroducido');
});

t('efectos legítimos por piloto preservados en fuente', () => {
  const p = fs.readFileSync('js/render/player.js', 'utf8');
  for (const needle of ['PHASE_AURA_RADIUS', 'player.bulwark', 'player.shield > 0', 'player.overdrive', 'criticalHealth', 'cid === \'swarm\'', 'ctx.ellipse']) {
    if (!p.includes(needle)) throw new Error('falta efecto legítimo: ' + needle);
  }
});

t('los 4 pilotos renderizan sin error y sin contorno punteado r=34', () => {
  const sbx = { window: { NV: {} }, Math };
  vm.runInNewContext(fs.readFileSync('js/data/gameData.js', 'utf8'), sbx, { filename: 'gameData.js' });
  vm.runInNewContext(fs.readFileSync('js/render/player.js', 'utf8'), sbx, { filename: 'player.js' });
  const PNV = sbx.window.NV;
  for (const id of ['boti', 'nova', 'rook', 'swarm']) {
    const { ctx, rec } = mkCtx();
    const pl = { x: 0, y: 0, character: id, hp: 100, maxHp: 100, invuln: 0, stun: 0, phase: 0, bulwark: 0, shield: 0, overdrive: 0 };
    PNV.drawPlayer(ctx, pl, PNV.CHARACTERS, 10);
    if (rec.arcs.some((a) => a.r === 34)) throw new Error(id + ' dibuja arco r=34 (contorno residual)');
  }
});

t('lobby F09.4 intacto: preview real único, sin órbitas, fondo profundo', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  const css = fs.readFileSync('css/lobby-f093.css', 'utf8');
  const game = fs.readFileSync('js/game.js', 'utf8');
  if ((html.match(/id="lobbyPreview"/g) || []).length !== 1) throw new Error('preview duplicado/ausente');
  if (/class="lobby-orbit"|id="lobbyOrbit"/.test(html)) throw new Error('órbita vieja regresó al HTML');
  if (!game.includes('NV.drawPlayer(lobbyPreviewCtx, previewPlayer, CHARACTERS, frame)')) throw new Error('preview no usa renderer real');
  if (!css.includes('.lobby-atmosphere::before')) throw new Error('starfield CSS ausente');
});

console.log('RESULT dashed_contour_f095: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);

// Diagnostico de curva de dificultad - herramientas de analisis (no corre en la suite).
// Compara la curva ORIGINAL (antes de B1) contra la actual leida de balance.js.
const fs = require('fs'), vm = require('vm');
const sbx = { window: { NV: {} }, console, Math };
vm.runInNewContext(fs.readFileSync('js/data/balance.js', 'utf8'), sbx, { filename: 'js/data/balance.js' });
const NV = sbx.window.NV;

// Curva ORIGINAL: 1 + 0.30*wave (lineal, reemplazada por B1).
const oldHpScale = (w) => 1 + 0.30 * w;
// Otras formulas verificadas en el codigo (game.js / enemies.js):
//  dmgEnemigo = base + min(60, round(wave*1.5))
//  bossHp     = (base + wave^2*12 + wave*40) * 1.8
//  spawnInterval = max(0.25, 1.2 - wave*0.05) aprox, perWave cap 8, MAX_ENEMIES 80
const wv = [1, 5, 10, 15, 20, 25, 30, 40];
for (const w of wv) {
  const hpNew = NV.enemyHpScale(w);
  const hpOld = oldHpScale(w);
  const dmg = Math.min(60, Math.round(w * 1.5));
  console.log(
    'wave=' + String(w).padStart(2) +
    '  hpMult ANTES=' + hpOld.toFixed(2) +
    '  AHORA=' + hpNew.toFixed(2) +
    ' (x' + (hpNew / hpOld).toFixed(2) + ')' +
    '  dmgBase+dmg=' + dmg.toFixed(1) +
    '  bossHpMult=' + ((w*w*12 + w*40) * 1.8).toFixed(0)
  );
}
console.log('DONE');

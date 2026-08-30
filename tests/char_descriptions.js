// Tests de descripciones: clases de resalte definidas, textos actualizados, sin CD viejos.
const fs = require('fs');
let pass = 0, fail = 0;
function t(desc, fn) { try { fn(); pass++; console.log('  ok  ' + desc); } catch (e) { fail++; console.log('  FAIL ' + desc + ' -> ' + e.message); } }

t('CSS define las 4 clases de resalte', () => {
  const css = fs.readFileSync('css/styles.css', 'utf8');
  for (const c of ['.dmg-highlight', '.def-highlight', '.cc-highlight', '.cd-note']) if (!css.includes(c)) throw new Error('falta ' + c);
});

t('index.html: las 4 tarjetas usan los resaltes y ya no muestran "(CD x)" crudo', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  const cards = html.match(/<div class="char-desc">[\s\S]*?<\/div>/g) || [];
  if (cards.length !== 4) throw new Error('cards=' + cards.length);
  for (const card of cards) {
    if (!/class="(dmg|def|cc)-highlight"/.test(card)) throw new Error('sin resaltes: ' + card.slice(0, 60));
    if (/CD \d+s/.test(card)) throw new Error('CD crudo presente');
  }
});

t('index.html: las 4 tarjetas usan canvas de habilidad sin emoji legacy', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  const icons = html.match(/<canvas class="char-skill-icon" data-skill-icon="[^"]+"/g) || [];
  if (icons.length !== 4) throw new Error('icons=' + icons.length);
  for (const id of ['meteor','phase','bulwark','hivemind']) {
    if (!html.includes('data-skill-icon="' + id + '"')) throw new Error('falta ' + id);
  }
  for (const old of ['\u{2604}\u{FE0F}','\u{1F47B}','\u{1F6F8}']) if (html.includes(old)) throw new Error('quedó emoji ' + old);
});

t('textos reflejan el balance actual', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  if (!html.includes('golpea menos a los jefes')) throw new Error('Boti sin nerf documentado');
  if (!html.includes('recarga larga')) throw new Error('Boti sin cooldown largo');
  if (!html.includes('enemigo más cercano')) throw new Error('Enjambre sin targeting');
  if (!html.includes('detona un golpe final')) throw new Error('Nova sin detonación');
  if (!html.includes('atura y empuja') && !html.includes('aturde y empuja')) throw new Error('Rook sin onda de choque');
  const data = fs.readFileSync('js/data/gameData.js', 'utf8');
  for (const k of ['daño reducido contra jefes', 'detona un golpe final', 'aturde y empuja', 'jefe más cercano']) {
    if (!data.includes(k)) throw new Error('gameData falta: ' + k);
  }
});

console.log('RESULT char_descriptions: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
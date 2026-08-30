// Cierre global de remasterización: no quedan emojis legacy visibles de armas/consumibles/meta/skills.
const fs = require('fs'), path = require('path');
let pass = 0, fail = 0;
function t(d, fn) { try { fn(); pass++; console.log('  ok  ' + d); } catch (e) { fail++; console.log('  FAIL ' + d + ' -> ' + e.message); } }

const ROOT = process.cwd();
const SKIP_DIRS = new Set(['.git', 'node_modules']);
const EXTS = new Set(['.js', '.html', '.css', '.md']);
const OLD = [
  0x2694, 0x1F680, 0x2764, 0x1F6E1, 0x1F340, 0x1F4A5, 0x1F4A8, 0x1F504, 0x1FA99,
  0x2604, 0x1F47B, 0x1F6F8,
  0x1F9EA, 0x26A1, 0x1F4A3, 0x23F1, 0x1F9F2, 0x1F3AF,
  0x1F52B, 0x1F526, 0x1F52E, 0x1F525, 0x1F3F9,
  0x1F300, 0x1F49A,
].map(cp => String.fromCodePoint(cp));

function files(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.isDirectory()) { if (!SKIP_DIRS.has(ent.name)) files(path.join(dir, ent.name), out); }
    else if (EXTS.has(path.extname(ent.name))) out.push(path.join(dir, ent.name));
  }
  return out;
}

t('barrido global: cero emojis legacy de los 3 sets remasterizados', () => {
  const hits = [];
  for (const file of files(ROOT)) {
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    const txt = fs.readFileSync(file, 'utf8');
    for (const old of OLD) if (txt.includes(old)) hits.push(rel + ' contiene U+' + old.codePointAt(0).toString(16).toUpperCase());
  }
  if (hits.length) throw new Error(hits.slice(0, 8).join('; ') + (hits.length > 8 ? ' ...' : ''));
});

t('datos runtime principales no conservan icon/emoji legacy de remasterización', () => {
  const data = fs.readFileSync('js/data/gameData.js', 'utf8');
  const cons = fs.readFileSync('js/data/consumables.js', 'utf8');
  const weapons = data.slice(data.indexOf('NV.WEAPONS'), data.indexOf('];', data.indexOf('NV.WEAPONS')));
  const perms = data.slice(data.indexOf('NV.PERM_UPGRADES'), data.indexOf('];', data.indexOf('NV.PERM_UPGRADES')));
  const chars = data.slice(data.indexOf('NV.CHARACTERS'), data.indexOf('};', data.indexOf('NV.CHARACTERS')));
  const consumables = cons.slice(cons.indexOf('NV.CONSUMABLES'), cons.indexOf('};', cons.indexOf('NV.CONSUMABLES')));
  for (const [name, block] of [['WEAPONS', weapons], ['PERM_UPGRADES', perms], ['CONSUMABLES', consumables]]) {
    if (/\b(icon|emoji)\s*:/.test(block)) throw new Error(name + ' conserva icon/emoji');
  }
  if (/skillIcon\s*:/.test(chars)) throw new Error('CHARACTERS conserva skillIcon');
});

console.log('RESULT icon_remaster_closure: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
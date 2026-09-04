// Verifica sintaxis del script del Visual Lab (debug only).
const fs = require('fs');
const url = 'previews/enemy-visual-lab.html';
const h = fs.readFileSync(url, 'utf8');
const re = /<script type="module">([\s\S]*)<\/script>/;
const m = h.match(re);
if (!m) { console.error('NO_SCRIPT'); process.exit(1); }
let s = m[1].replace(/import\s*\*\s*as\s*THREE\s*from\s*'three';\s*/, '');
try {
  // eslint-disable-next-line no-new-func
  new Function('window', 'document', 'NV', 'THREE', s);
  console.log('JS_PARSE_OK');
} catch (e) {
  console.error('JS_PARSE_FAIL:', e.message);
  process.exit(2);
}

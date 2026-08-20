const fs = require('fs');
const f = 'README.md';
const l = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n').split('\n');
let fixed = 0;
for (let i = 0; i < l.length; i++) {
  if (l[i].trimStart() === '├── engine/' && i > 0 && l[i - 1].includes('dom.js')) {
    l[i] = '    │   ├── engine/';
    fixed++;
  }
}
fs.writeFileSync(f, l.join('\n'));
console.log('reparadas ' + fixed + ' líneas engine/');


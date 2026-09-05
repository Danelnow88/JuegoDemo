const fs = require('fs');
const vm = require('vm');
const code = fs.readFileSync('js/render/player.js', 'utf8');
vm.runInNewContext(code);
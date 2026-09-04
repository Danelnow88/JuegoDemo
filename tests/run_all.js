const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const testsDir = path.join(rootDir, 'tests');
const thisFile = path.basename(__filename);

const testFiles = fs.readdirSync(testsDir)
  .filter((file) => file.endsWith('.js') && file !== thisFile)
  .sort();

let failed = 0;

for (const file of testFiles) {
  const relativePath = path.join('tests', file);
  console.log('\n=== ' + relativePath + ' ===');

const result = spawnSync(process.execPath, [relativePath], {
    cwd: rootDir,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    failed++;
    console.log('FAILED ' + relativePath + ' (exit ' + result.status + ')');
  } else if (result.error) {
    failed++;
    console.log('ERRORED ' + relativePath + ' -> ' + result.error.message);
  }
}

console.log('\nRESULT run_all: total=' + testFiles.length + ' failed=' + failed);
process.exit(failed ? 1 : 0);
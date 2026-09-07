const fs = require('fs'), vm = require('vm');
let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; console.log('  ok  ' + name); } catch (e) { fail++; console.log('  FAIL ' + name + ' -> ' + e.message); } }

function load(initial) {
  const store = {};
  if (initial) store.neonVoidSettings = JSON.stringify(initial);
  const sbx = {
    window: { NV: {} }, console, JSON, Object, Array,
    localStorage: {
      getItem(k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
      setItem(k, v) { store[k] = String(v); },
      removeItem(k) { delete store[k]; },
    },
  };
  vm.runInNewContext(fs.readFileSync('js/core/settings.js', 'utf8'), sbx, { filename: 'settings.js' });
  return { NV: sbx.window.NV, store };
}

t('defaults preservan calidad visual actual', () => {
  const { NV } = load();
  const g = NV.settings.graphics;
  if (g.quality !== 'high' || !g.particles || !g.heavyVfx) throw new Error(JSON.stringify(g));
  if (NV.getGraphicsPolicy().hydraFullBudget !== Infinity) throw new Error('Alta no conserva full visuals');
});

t('persistencia round-trip normaliza y recupera settings', () => {
  const first = load();
  first.NV.setGraphicsQuality('performance');
  first.NV.setGraphicsOption('particles', false);
  const saved = JSON.parse(first.store.neonVoidSettings);
  const second = load(saved);
  if (second.NV.settings.graphics.quality !== 'performance' || second.NV.settings.graphics.particles !== false) throw new Error('round-trip falló');
});

t('modos solo cambian política visual', () => {
  const { NV } = load();
  NV.setGraphicsQuality('auto');
  if (NV.getGraphicsPolicy().hydraFullBudget !== 7) throw new Error('Auto budget');
  NV.setGraphicsQuality('performance');
  if (NV.getGraphicsPolicy().hydraFullBudget !== 4) throw new Error('Performance budget');
  const src = fs.readFileSync('js/core/settings.js', 'utf8');
  for (const forbidden of ['MAX_ENEMIES', 'damage', 'enemyHpScale', 'spawnTimer']) if (src.includes(forbidden)) throw new Error('settings toca gameplay: ' + forbidden);
});

t('valores inválidos vuelven a defaults seguros', () => {
  const { NV } = load({ graphics: { quality: 'ultra', particles: 'no', heavyVfx: 1 } });
  if (NV.settings.graphics.quality !== 'high' || NV.settings.graphics.particles !== true || NV.settings.graphics.heavyVfx !== true) throw new Error('normalización insegura');
});

t('UI compartida ofrece entrada desktop, lobby y móvil', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  for (const id of ['settingsBtn', 'lobbySettingsBtn', 'mSettingsBtn', 'settingsPanel', 'settingsClose']) {
    if (!html.includes('id="' + id + '"')) throw new Error('falta ' + id);
  }
  if (!html.includes('value="auto"') || !html.includes('value="high"') || !html.includes('value="performance"')) throw new Error('calidades incompletas');
});

console.log('RESULT settings_foundation: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
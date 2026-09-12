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
  if (NV.settings.audio.sfxVolume !== 1) throw new Error('default SFX no conserva volumen actual');
  if (g.quality !== 'high' || !g.particles || !g.heavyVfx) throw new Error(JSON.stringify(g));
  if (NV.settings.controls.firePolicy !== 'manual') throw new Error('firePolicy default no es manual');
  if (NV.getGraphicsPolicy().hydraFullBudget !== Infinity) throw new Error('Alta no conserva full visuals');
});

t('persistencia round-trip normaliza y recupera settings', () => {
  const first = load();
  first.NV.setGraphicsQuality('performance');
  first.NV.setGraphicsOption('particles', false);
  first.NV.setSfxVolume(0.37);
  first.NV.setFirePolicy('legacy-auto');
  const saved = JSON.parse(first.store.neonVoidSettings);
  const second = load(saved);
  if (second.NV.settings.graphics.quality !== 'performance' || second.NV.settings.graphics.particles !== false || second.NV.settings.audio.sfxVolume !== 0.37 || second.NV.settings.controls.firePolicy !== 'legacy-auto') throw new Error('round-trip falló');
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
  const { NV } = load({ audio: { sfxVolume: 'alto' }, graphics: { quality: 'ultra', particles: 'no', heavyVfx: 1 } });
  if (NV.settings.graphics.quality !== 'high' || NV.settings.graphics.particles !== true || NV.settings.graphics.heavyVfx !== true) throw new Error('normalización insegura');
  if (NV.settings.audio.sfxVolume !== 1) throw new Error('audio inválido no volvió a default');
  if (NV.settings.controls.firePolicy !== 'manual') throw new Error('control inválido no volvió a default');
});

t('volumen SFX se limita y aplica al mixer sin tocar mute', () => {
  const { NV } = load();
  const applied = [];
  NV.soundOn = false;
  NV.applySfxVolume = (value) => applied.push(value);
  if (NV.setSfxVolume(4) !== 1) throw new Error('clamp superior');
  if (NV.setSfxVolume(-2) !== 0) throw new Error('clamp inferior');
  if (NV.soundOn !== false) throw new Error('volumen cambió mute');
  if (applied.join(',') !== '1,0') throw new Error('mixer no recibió valores normalizados');
  NV.resetSettings();
  if (applied[applied.length - 1] !== 1) throw new Error('reset no reaplicó default al mixer');
});

t('UI compartida ofrece entrada desktop, lobby y móvil', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  for (const id of ['settingsBtn', 'lobbySettingsBtn', 'mSettingsBtn', 'settingsPanel', 'settingsClose']) {
    if (!html.includes('id="' + id + '"')) throw new Error('falta ' + id);
  }
  if (!html.includes('value="auto"') || !html.includes('value="high"') || !html.includes('value="performance"')) throw new Error('calidades incompletas');
  if (!html.includes('id="settingsSfxVolume"') || !html.includes('id="settingsSfxVolumeValue"')) throw new Error('slider SFX ausente');
  if (!html.includes('name="firePolicy"') || !html.includes('value="manual"') || !html.includes('value="legacy-auto"')) throw new Error('selector de disparo ausente');
  const ui = fs.readFileSync('js/ui/settingsPanel.js', 'utf8');
  if (!ui.includes("addEventListener('input'") || !ui.includes('NV.setSfxVolume')) throw new Error('slider SFX sin wiring live');
});

t('mute usa una autoridad y sincroniza controles desktop/móvil', () => {
  const game = fs.readFileSync('js/game.js', 'utf8');
  if (!game.includes('NV.setSoundEnabled(!NV.soundOn)')) throw new Error('toggle no usa autoridad del mixer');
  if (/else NV\.soundOn\s*=/.test(game)) throw new Error('existe una segunda implementación de mute');
  if (!game.includes('NV.syncSoundUI = syncSoundUI')) throw new Error('sync de mute no expuesto');
  if (!game.includes('dom.mSoundBtn.textContent') || !game.includes("setAttribute('aria-pressed'")) throw new Error('controles de mute no sincronizados/accesibles');
});

t('cambio de arma libera voz continua explícitamente', () => {
  const game = fs.readFileSync('js/game.js', 'utf8');
  if (!game.includes('function stopCurrentWeaponAudio()')) throw new Error('helper de cleanup ausente');
  // P1.5: se eliminaron dos rutas legítimas (soltar→pistola y equip fantasma en compra);
  // quedan 5 rutas reales de cleanup al cambiar arma.
  if ((game.match(/stopCurrentWeaponAudio\(\);/g) || []).length < 5) throw new Error('faltan rutas de cleanup al cambiar arma');
  if (!/if \(currentWeapon !== r\.currentWeapon\) \{\s*stopCurrentWeaponAudio\(\);/.test(game)) throw new Error('pickup/fusión no libera voz previa');
});

console.log('RESULT settings_foundation: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
// ===== SETTINGS: estado compartido y persistencia centralizada =====
(() => {
  'use strict';
  const NV = window.NV = window.NV || {};
  const STORAGE_KEY = 'neonVoidSettings';
  const QUALITY = ['auto', 'high', 'performance'];
  const DEFAULTS = Object.freeze({
    graphics: Object.freeze({
      quality: 'high',
      particles: true,
      heavyVfx: true,
    }),
  });
  const listeners = [];

  function normalize(raw) {
    const graphics = raw && raw.graphics ? raw.graphics : {};
    return {
      graphics: {
        quality: QUALITY.indexOf(graphics.quality) >= 0 ? graphics.quality : DEFAULTS.graphics.quality,
        particles: typeof graphics.particles === 'boolean' ? graphics.particles : DEFAULTS.graphics.particles,
        heavyVfx: typeof graphics.heavyVfx === 'boolean' ? graphics.heavyVfx : DEFAULTS.graphics.heavyVfx,
      },
    };
  }
  function load() {
    try { return normalize(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')); }
    catch (_) { return normalize(null); }
  }
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(NV.settings)); }
    catch (_) { /* storage puede estar bloqueado; settings siguen válidos en memoria */ }
  }
  function notify() {
    const snapshot = NV.getSettings();
    for (const fn of listeners.slice()) {
      try { fn(snapshot); } catch (_) { /* un listener no bloquea al resto */ }
    }
  }

  NV.settings = load();
  NV.settingsDefaults = DEFAULTS;
  NV.getSettings = function () { return normalize(NV.settings); };
  NV.setGraphicsQuality = function (quality) {
    if (QUALITY.indexOf(quality) < 0) return false;
    NV.settings.graphics.quality = quality;
    save(); notify(); return true;
  };
  NV.setGraphicsOption = function (key, value) {
    if (key !== 'particles' && key !== 'heavyVfx') return false;
    NV.settings.graphics[key] = !!value;
    save(); notify(); return true;
  };
  NV.getGraphicsPolicy = function () {
    const g = NV.settings.graphics;
    return {
      quality: g.quality,
      particles: g.particles,
      heavyVfx: g.heavyVfx,
      hydraFullBudget: !g.heavyVfx ? 0 : (g.quality === 'performance' ? 4 : (g.quality === 'auto' ? 7 : Infinity)),
    };
  };
  NV.onSettingsChange = function (fn) {
    if (typeof fn === 'function') listeners.push(fn);
    return fn;
  };
  NV.resetSettings = function () {
    NV.settings = normalize(DEFAULTS);
    save(); notify();
  };
})();
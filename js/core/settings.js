// ===== SETTINGS: estado compartido y persistencia centralizada =====
(() => {
  'use strict';
  const NV = window.NV = window.NV || {};
  const STORAGE_KEY = 'neonVoidSettings';
  const QUALITY = ['auto', 'high', 'performance'];
  const FIRE_POLICY = ['manual', 'legacy-auto'];
  const DEFAULTS = Object.freeze({
    audio: Object.freeze({
      sfxVolume: 1,
    }),
    graphics: Object.freeze({
      quality: 'high',
      particles: true,
      heavyVfx: true,
    }),
    controls: Object.freeze({
      firePolicy: 'manual',
    }),
    gameplay: Object.freeze({
      difficulty: 'normal',
    }),
  });
  const listeners = [];

  function normalize(raw) {
    const audio = raw && raw.audio ? raw.audio : {};
    const graphics = raw && raw.graphics ? raw.graphics : {};
    const controls = raw && raw.controls ? raw.controls : {};
    const gameplay = raw && raw.gameplay ? raw.gameplay : {};
    const rawSfxVolume = Number(audio.sfxVolume);
    return {
      audio: {
        sfxVolume: Number.isFinite(rawSfxVolume) ? Math.max(0, Math.min(1, rawSfxVolume)) : DEFAULTS.audio.sfxVolume,
      },
      graphics: {
        quality: QUALITY.indexOf(graphics.quality) >= 0 ? graphics.quality : DEFAULTS.graphics.quality,
        particles: typeof graphics.particles === 'boolean' ? graphics.particles : DEFAULTS.graphics.particles,
        heavyVfx: typeof graphics.heavyVfx === 'boolean' ? graphics.heavyVfx : DEFAULTS.graphics.heavyVfx,
      },
      controls: {
        firePolicy: FIRE_POLICY.indexOf(controls.firePolicy) >= 0 ? controls.firePolicy : DEFAULTS.controls.firePolicy,
      },
      gameplay: {
        difficulty: ['easy', 'normal', 'hard'].indexOf(gameplay.difficulty) >= 0 ? gameplay.difficulty : DEFAULTS.gameplay.difficulty,
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
  NV.setSfxVolume = function (value) {
    value = Number(value);
    if (!Number.isFinite(value)) value = DEFAULTS.audio.sfxVolume;
    NV.settings.audio.sfxVolume = Math.max(0, Math.min(1, value));
    if (typeof NV.applySfxVolume === 'function') NV.applySfxVolume(NV.settings.audio.sfxVolume);
    save(); notify(); return NV.settings.audio.sfxVolume;
  };
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
  NV.setFirePolicy = function (policy) {
    if (FIRE_POLICY.indexOf(policy) < 0) return false;
    NV.settings.controls.firePolicy = policy;
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
  NV.setDifficulty = function (id) {
    // balance.js define NV.DIFFICULTY_ORDER; tolerar cualquier orden de carga de scripts.
    var order = (NV.DIFFICULTY_ORDER && NV.DIFFICULTY_ORDER.indexOf)
      ? NV.DIFFICULTY_ORDER
      : ['easy', 'normal', 'hard'];
    if (order.indexOf(id) < 0) return false;
    NV.settings.gameplay.difficulty = id;
    save(); notify(); return true;
  };
  NV.resetSettings = function () {
    NV.settings = normalize(DEFAULTS);
    if (typeof NV.applySfxVolume === 'function') NV.applySfxVolume(NV.settings.audio.sfxVolume);
    save(); notify();
  };
})();
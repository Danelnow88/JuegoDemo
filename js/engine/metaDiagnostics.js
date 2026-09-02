// ===== META VIS: diagnóstico opt-in (sin alterar gameplay) =====
(() => {
  'use strict';
  const NV = window.NV;
  if (typeof NV.META_DEBUG !== 'boolean') NV.META_DEBUG = false;
  const state = { snapshot: null, damageEvents: [], maxEvents: 120 };

  NV.metaDiagnostics = state;
  NV.toggleMetaDebug = function (enabled) {
    NV.META_DEBUG = !!enabled;
    if (!NV.META_DEBUG) state.snapshot = null;
    return NV.META_DEBUG;
  };
  NV.recordMetaDamage = function (event) {
    if (!NV.META_DEBUG || !event) return false;
    state.damageEvents.push(Object.assign({ at: Date.now() }, event));
    if (state.damageEvents.length > state.maxEvents) state.damageEvents.splice(0, state.damageEvents.length - state.maxEvents);
    return true;
  };
  NV.updateMetaSnapshot = function (data) {
    if (!NV.META_DEBUG) return null;
    state.snapshot = Object.assign({}, data);
    return state.snapshot;
  };
  NV.getMetaDiagnostics = function () {
    return { enabled: NV.META_DEBUG, snapshot: state.snapshot, damageEvents: state.damageEvents.slice() };
  };
  NV.clearMetaDiagnostics = function () { state.snapshot = null; state.damageEvents.length = 0; };
})();
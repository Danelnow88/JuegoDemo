// ===== ENGINE: presupuesto autoritativo de hostiles =====
// Deriva siempre el conteo desde entidades vivas; no mantiene contadores que puedan
// desincronizarse. Boss permanece separado de `enemies`, pero cuenta como hostile/heavy.
(() => {
  'use strict';
  const NV = window.NV;

  function alive(entity) { return !!(entity && !entity.dead); }

  NV.hostileClassOf = function (entity) {
    if (!entity) return 'light';
    if (entity.hostileClass === 'heavy' || entity.hostileClass === 'medium') return entity.hostileClass;
    if (entity.isBoss || entity.isElite) return 'heavy';
    return 'light';
  };

  NV.getHostileBudget = function (st) {
    st = st || {};
    const enemies = st.enemies || [];
    const boss = st.boss;
    const balance = NV.BALANCE || {};
    const maxHostiles = st.MAX_HOSTILES == null ? (balance.MAX_HOSTILES || 30) : st.MAX_HOSTILES;
    const maxHeavy = st.MAX_HEAVY_HOSTILES == null ? (balance.MAX_HEAVY_HOSTILES || 7) : st.MAX_HEAVY_HOSTILES;
    let hostiles = 0, heavy = 0, medium = 0, light = 0;
    for (const e of enemies) {
      if (!alive(e)) continue;
      hostiles++;
      const cls = NV.hostileClassOf(e);
      if (cls === 'heavy') heavy++;
      else if (cls === 'medium') medium++;
      else light++;
    }
    if (alive(boss)) {
      hostiles++;
      const cls = NV.hostileClassOf(boss);
      if (cls === 'heavy') heavy++;
      else if (cls === 'medium') medium++;
      else light++;
    }
    return {
      hostiles, heavy, medium, light,
      maxHostiles, maxHeavy,
      remainingHostiles: Math.max(0, maxHostiles - hostiles),
      remainingHeavy: Math.max(0, maxHeavy - heavy),
    };
  };

  NV.canSpawnHostileBatch = function (st, count, heavyCount) {
    if (st && st.ignoreHostileBudget === true) return true;
    const b = NV.getHostileBudget(st);
    return Math.max(0, count || 0) <= b.remainingHostiles
      && Math.max(0, heavyCount || 0) <= b.remainingHeavy;
  };
})();
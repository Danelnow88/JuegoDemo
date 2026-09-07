// ===== VIEWPORT: gestor central de resolución / visor (SIN gameplay) =====
// Centraliza todo lo concerniente a la presentación y entrada posicional:
//  - métricas semánticas del mundo (referencia, vista runtime y arena gameplay);
//  - escala uniforme de display y offsets de letterbox/pillarbox;
//  - devicePixelRatio efectivo (cap en móvil; SIEMPRE 1 en escritorio);
//  - fullscreen + orientation lock (landscape) con fallback silencioso;
//  - safe areas (leídas de custom properties definidas en CSS);
//  - conversión reusable screen↔game y game↔screen;
//  - reacción a resize / orientationchange / visualViewport / fullscreenchange.
// NO contiene lógica de juego. Los entes del mundo siguen usando su sistema de
// coordenadas lógicas 900x520; aquí solo se decide cómo se proyectan a la pantalla.
(() => {
  'use strict';

  const w = typeof window !== 'undefined' ? window : null;
  const d = typeof document !== 'undefined' ? document : null;
  const NV = (w && w.NV) ? w.NV : {};
  if (w) w.NV = NV;

  // Métricas autoritativas del mundo. Stage 3 expande la arena gameplay
  // móvil landscape por defecto para igualar la vista. Desktop conserva legacy.
  const REFERENCE_W = 900;
  const REFERENCE_H = 520;
  const worldMetrics = NV.worldMetrics || {
    refW: REFERENCE_W,
    refH: REFERENCE_H,
    viewW: REFERENCE_W,
    viewH: REFERENCE_H,
    viewX: 0,
    viewY: 0,
    arenaW: REFERENCE_W,
    arenaH: REFERENCE_H,
    scale: 1,
  };
  worldMetrics.refW = REFERENCE_W;
  worldMetrics.refH = REFERENCE_H;
  worldMetrics.viewW = Number(worldMetrics.viewW) || REFERENCE_W;
  worldMetrics.viewH = Number(worldMetrics.viewH) || REFERENCE_H;
  worldMetrics.viewX = Number(worldMetrics.viewX) || 0;
  worldMetrics.viewY = Number(worldMetrics.viewY) || 0;
  worldMetrics.arenaW = REFERENCE_W;
  worldMetrics.arenaH = REFERENCE_H;
  worldMetrics.scale = Number(worldMetrics.scale) || 1;
  NV.worldMetrics = worldMetrics;

  const LOGICAL_W = REFERENCE_W;
  const LOGICAL_H = REFERENCE_H;
  // Cap de DPR en móvil: evita resolver a resoluciones físicas absurdas.
  // En escritorio el DPR efectivo es SIEMPRE 1 → comportamiento original intacto.
  const MOBILE_DPR_CAP = 2;

  let listeners = [];

  function queryCanvas() {
    return (d && typeof d.getElementById === 'function') ? d.getElementById('game') : null;
  }
  function queryRoot() {
    return (d && d.documentElement) ? d.documentElement : null;
  }
  function toPx(v) {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }
  function dynamicViewParam() {
    try {
      const search = (w && w.location && w.location.search) || '';
      if (/(?:^|[?&])dynamicView=0(?:&|$)/.test(search)) return 'off';
      if (/(?:^|[?&])dynamicView=1(?:&|$)/.test(search)) return 'on';
    } catch (_) { /* ignore */ }
    return '';
  }
  function setRootClass(name, on) {
    const root = queryRoot();
    if (!root || !root.classList) return;
    if (on && typeof root.classList.add === 'function') root.classList.add(name);
    else if (!on && typeof root.classList.remove === 'function') root.classList.remove(name);
  }
  function computeDynamicMetrics(stageW, stageH) {
    const viewH = REFERENCE_H;
    const stageAspect = stageH > 0 ? stageW / stageH : REFERENCE_W / REFERENCE_H;
    const viewW = Math.max(REFERENCE_W, viewH * stageAspect);
    return {
      refW: REFERENCE_W,
      refH: REFERENCE_H,
      viewW,
      viewH,
      viewX: 0,
      viewY: 0,
      arenaW: viewW,
      arenaH: REFERENCE_H,
      scale: stageH > 0 ? stageH / viewH : 1,
    };
  }
  function applyWorldMetrics(next) {
    worldMetrics.refW = REFERENCE_W;
    worldMetrics.refH = REFERENCE_H;
    worldMetrics.viewW = next.viewW;
    worldMetrics.viewH = next.viewH;
    worldMetrics.viewX = next.viewX;
    worldMetrics.viewY = next.viewY;
    worldMetrics.arenaW = next.arenaW || REFERENCE_W;
    worldMetrics.arenaH = next.arenaH || REFERENCE_H;
    worldMetrics.scale = next.scale;
  }

  const viewport = {
    logicalW: LOGICAL_W,
    logicalH: LOGICAL_H,
    worldMetrics,
    isMobile: !!(NV.capabilities && NV.capabilities.isMobile),
    dynamicViewFlag: dynamicViewParam() === 'on',
    dynamicViewForcedOff: dynamicViewParam() === 'off',
    dynamicViewActive: false,

    // Caja CSS del canvas (lo que el usuario VE, en píxeles CSS)
    cssW: LOGICAL_W,
    cssH: LOGICAL_H,
    // Escala uniforme (lógico -> CSS): min(cssW/logicalW, cssH/logicalH)
    displayScale: 1,
    // Espacio residual por letterbox/pillarbox dentro de la caja
    offsetX: 0,
    offsetY: 0,
    // DPR efectivo para el backing store (móvil: min(dpr, cap); escritorio: 1)
    dpr: 1,
    dprCap: MOBILE_DPR_CAP,
    isFullscreen: false,
    orientation: 'landscape',
    safe: { top: 0, right: 0, bottom: 0, left: 0 },

    // --- Cálculo puro: escala uniforme que preserva el aspecto (testeable) ---
    computeScale(cssW, cssH, lw, lh) {
      lw = Number(lw) || LOGICAL_W;
      lh = Number(lh) || LOGICAL_H;
      return Math.min(cssW / lw, cssH / lh);
    },
    computeDynamicMetrics,

    readFullscreen() {
      viewport.isFullscreen = !!(
        d && (
          (d.fullscreenElement && !!d.fullscreenElement) ||
          (d.webkitFullscreenElement && !!d.webkitFullscreenElement)
        )
      );
      return viewport.isFullscreen;
    },

    readSafeAreas() {
      const root = queryRoot();
      const cs = (root && w && typeof w.getComputedStyle === 'function') ? w.getComputedStyle(root) : null;
      viewport.safe = {
        top: cs ? toPx(cs.getPropertyValue('--nv-safe-top')) : 0,
        right: cs ? toPx(cs.getPropertyValue('--nv-safe-right')) : 0,
        bottom: cs ? toPx(cs.getPropertyValue('--nv-safe-bottom')) : 0,
        left: cs ? toPx(cs.getPropertyValue('--nv-safe-left')) : 0,
      };
      return viewport.safe;
    },


    refresh() {
      viewport.isMobile = !!(NV.capabilities && NV.capabilities.isMobile);
      const canvas = queryCanvas();
      let cssW = LOGICAL_W, cssH = LOGICAL_H;
      if (canvas && typeof canvas.getBoundingClientRect === 'function') {
        try {
          const r = canvas.getBoundingClientRect();
          if (r && Number.isFinite(r.width) && Number.isFinite(r.height) && r.width > 0 && r.height > 0) {
            cssW = r.width;
            cssH = r.height;
          }
        } catch (_) { /* defensivo */ }
      }
      const orientation = (NV.capabilities && NV.capabilities.orientation)
        || (cssH > cssW ? 'portrait' : 'landscape');
      const dynamicParam = dynamicViewParam();
      viewport.dynamicViewFlag = dynamicParam === 'on';
      viewport.dynamicViewForcedOff = dynamicParam === 'off';
      viewport.dynamicViewActive = !!(viewport.isMobile && orientation === 'landscape' && !viewport.dynamicViewForcedOff);
      setRootClass('nv-dynamic-view', viewport.dynamicViewActive);
      // La clase dinámica puede cambiar la caja CSS; medir de nuevo después de aplicarla.
      if (canvas && typeof canvas.getBoundingClientRect === 'function') {
        try {
          const r = canvas.getBoundingClientRect();
          if (r && Number.isFinite(r.width) && Number.isFinite(r.height) && r.width > 0 && r.height > 0) {
            cssW = r.width;
            cssH = r.height;
          }
        } catch (_) { /* defensivo */ }
      }
      viewport.cssW = cssW;
      viewport.cssH = cssH;
      if (viewport.dynamicViewActive) {
        applyWorldMetrics(computeDynamicMetrics(cssW, cssH));
        viewport.logicalW = worldMetrics.viewW;
        viewport.logicalH = worldMetrics.viewH;
        viewport.displayScale = worldMetrics.scale;
        viewport.offsetX = 0;
        viewport.offsetY = 0;
      } else {
        applyWorldMetrics({ viewW: REFERENCE_W, viewH: REFERENCE_H, viewX: 0, viewY: 0, scale: 1 });
        viewport.logicalW = worldMetrics.viewW;
        viewport.logicalH = worldMetrics.viewH;
        viewport.displayScale = viewport.computeScale(cssW, cssH, worldMetrics.viewW, worldMetrics.viewH);
        viewport.offsetX = Math.max(0, (cssW - worldMetrics.viewW * viewport.displayScale) / 2);
        viewport.offsetY = Math.max(0, (cssH - worldMetrics.viewH * viewport.displayScale) / 2);
      }
      if (viewport.isMobile) {
        viewport.dpr = Math.min((w && w.devicePixelRatio) || 1, MOBILE_DPR_CAP);
      } else {
        viewport.dpr = 1;// escritorio idéntico al comportamiento original
      }
      viewport.orientation = orientation;
      viewport.readSafeAreas();
      viewport.readFullscreen();
      for (let i = 0; i < listeners.length; i++) {
        const fn = listeners[i];
        try { fn(viewport, {}); } catch (_) { /* un suscriptor no puede romper al resto */ }
      }
      return viewport;
    },

    // DPR que debe usar el backing store del canvas (game.js → resizeCanvas()).
    getEffectiveDpr() {
      return viewport.isMobile ? viewport.dpr : 1;
    },

    // --- Conversión SCREEN -> VIEW lógico del juego (reusable, exacta) ---
    // Entra: coordenadas client (viewport CSS px). Sale: coords lógicas viewW x viewH.
    screenToGame(clientX, clientY) {
      const canvas = queryCanvas();
      let rect = { left: 0, top: 0, width: worldMetrics.viewW, height: worldMetrics.viewH };
      if (canvas && typeof canvas.getBoundingClientRect === 'function') {
        try {
          const r = canvas.getBoundingClientRect();
          if (r) rect = r;
        } catch (_) { /* defensivo */ }
      }
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      if (viewport.dynamicViewActive) {
        return {
          x: worldMetrics.viewX + x / viewport.displayScale,
          y: worldMetrics.viewY + y / viewport.displayScale,
        };
      }
      if (!viewport.isMobile) {
        // Escritorio: EXACTAMENTE la fórmula legacy de game.js
        //   mx = (clientX - rect.left) / scaleX   con scaleX = canvas.width / GW,
        // aplicada sobre la caja CSS (aquí DPR=1 ⇒ canvas.width ≈ rect.width).
        const sx = rect.width > 0 ? rect.width / worldMetrics.viewW : 1;
        const sy = rect.height > 0 ? rect.height / worldMetrics.viewH : 1;
        return { x: x / sx, y: y / sy };
      }
      // Móvil: escala uniforme + offsets de letterbox/pillarbox.
      return {
        x: (x - viewport.offsetX) / viewport.displayScale,
        y: (y - viewport.offsetY) / viewport.displayScale,
      };
    },

    // Conversión inversa MUNDO -> SCREEN (para overlays/HUD si hiciera falta).
    gameToScreen(gx, gy) {
      const canvas = queryCanvas();
      let rect = { left: 0, top: 0 };
      if (canvas && typeof canvas.getBoundingClientRect === 'function') {
        try {
          const r = canvas.getBoundingClientRect();
          if (r) rect = r;
        } catch (_) { /* defensivo */ }
      }
      return {
        x: rect.left + viewport.offsetX + (gx - worldMetrics.viewX) * viewport.displayScale,
        y: rect.top + viewport.offsetY + (gy - worldMetrics.viewY) * viewport.displayScale,
      };
    },

    // --- Fullscreen + orientation lock (con fallback) ---
    canFullscreen() {
      return !!(d && (d.fullscreenEnabled || d.webkitFullscreenEnabled));
    },

    requestFullscreen() {
      const root = queryRoot();
      if (!root) return Promise.resolve(false);
      let fn = root.requestFullscreen;
      if (typeof fn !== 'function' && root.webkitRequestFullscreen) {
        fn = root.webkitRequestFullscreen.bind(root);
      }
      if (typeof fn !== 'function') return Promise.resolve(false);
      try {
        const p = fn.call(root);
        return (p && typeof p.then === 'function') ? p.then(() => true).catch(() => false) : Promise.resolve(true);
      } catch (_) {
        return Promise.resolve(false);
      }
    },

    exitFullscreen() {
      if (!d || !viewport.readFullscreen()) return Promise.resolve(false);
      let fn = d.exitFullscreen;
      if (typeof fn !== 'function' && d.webkitExitFullscreen) fn = d.webkitExitFullscreen.bind(d);
      if (typeof fn !== 'function') return Promise.resolve(false);
      try {
        const p = fn.call(d);
        return (p && typeof p.then === 'function') ? p.then(() => true).catch(() => false) : Promise.resolve(true);
      } catch (_) {
        return Promise.resolve(false);
      }
    },

    // Intenta bloquear landscape. Si el navegador no lo permite (iOS sin fullscreen,
    // permisos, etc.) falla en silencio y el juego sigue igualmente funcional.
    lockLandscape() {
      try {
        const so = w && w.screen && w.screen.orientation;
        if (so && typeof so.lock === 'function') {
          const p = so.lock('landscape');
          if (p && typeof p.then === 'function') return p.then(() => true).catch(() => false);
          return Promise.resolve(true);
        }
      } catch (_) { /* fallback */ }
      return Promise.resolve(false);
    },

    toggleFullscreen() {
      if (viewport.readFullscreen()) {
        return viewport.exitFullscreen().then((ok) => { viewport.refresh(); return ok; });
      }
      // El Fullscreen API exige gesto del usuario: se invoca desde el botón (tap).
      return viewport.requestFullscreen().then((ok) => {
        if (ok) {
          viewport.lockLandscape();   // puede rechazar: se ignora
          viewport.refresh();         // recalcular viewport inmediatamente
        }
        return ok;
      });
    },

    onChange(fn) {
      if (typeof fn === 'function') listeners.push(fn);
      return fn;
    },
    offChange(fn) {
      listeners = listeners.filter((l) => l !== fn);
    },
  };

  NV.viewport = viewport;
  NV.screenToGame = (x, y) => viewport.screenToGame(x, y);
  NV.gameToScreen = (x, y) => viewport.gameToScreen(x, y);

  // --- Reacción a todos los cambios de viewport ---
  const onViewportChange = () => viewport.refresh();

  if (w) {
    if (typeof w.addEventListener === 'function') {
      w.addEventListener('resize', onViewportChange);
      w.addEventListener('orientationchange', onViewportChange);
      w.addEventListener('fullscreenchange', onViewportChange);
      w.addEventListener('pageshow', onViewportChange);
    } else if (typeof w.attachEvent === 'function') {
      w.attachEvent('onresize', onViewportChange);
    }
    // Visual viewport (barra de direcciones / cambios de layout en móvil)
    if (w.visualViewport && typeof w.visualViewport.addEventListener === 'function') {
      w.visualViewport.addEventListener('resize', onViewportChange);
      w.visualViewport.addEventListener('scroll', onViewportChange);
    }
  }

  viewport.refresh();
})();
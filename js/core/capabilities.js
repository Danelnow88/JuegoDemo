// ===== CAPABILIDADES: detección de dispositivo (sin gameplay, sin render) =====
// Se carga en <head>, ANTES que el resto. Responsabilidades exclusivas:
//  - decidir si corresponde la capa móvil usando CAPACIDAD (pointer/touch/medidas),
//    NO el string de User-Agent ni fabricantes;
//  - taguear <html> con clases CSS (.nv-mobile, .nv-touch-only, .nv-portrait/landscape);
//  - exponer NV.capabilities;
//  - en móvil, convertir el meta viewport en app-like (anti-zoom accidental, safe areas).
// NO contiene lógica de juego ni de escala (eso vive en viewport.js).
(() => {
  'use strict';

  const w = typeof window !== 'undefined' ? window : null;
  const d = typeof document !== 'undefined' ? document : null;
  const NV = (w && w.NV) ? w.NV : {};
  if (w) w.NV = NV;

  const mm = (w && typeof w.matchMedia === 'function') ? w.matchMedia.bind(w) : null;
  const nav = (w && w.navigator) ? w.navigator : null;

  // --- Señales de capacidad (combinadas y conservadoras) ---
  let coarse = false, fine = false;
  if (mm) {
    try { coarse = !!mm('(pointer: coarse)').matches; } catch (_) { /* fallback */ }
    try { fine = !!mm('(pointer: fine)').matches; } catch (_) { /* fallback */ }
  }
  let maxTouchPoints = 0;
  if (nav) {
    try {
      const n = parseInt(nav.maxTouchPoints, 10);
      maxTouchPoints = Number.isFinite(n) ? Math.max(0, n) : 0;
    } catch (_) { /* fallback */ }
  }
  const hasTouchEvents = !!(w && 'ontouchstart' in w);

  // Móvil = puntero primario grueso (celular/tablet/chrome-emulación) o, si no hay
  // puntero fino primario, señales táctiles residuales. Un laptop táctil conserva
  // pointer:fine como primario y por lo tanto NO se clasifica como móvil.
  let isMobile = !!coarse;
  let isTouchOnly = false;
  if (!isMobile && !fine) {
    isMobile = !!(maxTouchPoints > 0 || hasTouchEvents);
  }
  isTouchOnly = isMobile && !fine;

  // Flag de test/debug: ?mobile=1 fuerza la capa móvil (ideal para emulación
  // headless y DevTools). No es un hack de dispositivo: es una puerta de pruebas.
  let forceMobile = false;
  try {
    if (w && w.location && w.location.search) {
      forceMobile = /[?&]mobile=1/.test(w.location.search);
    }
  } catch (_) { /* fallback */ }
  if (forceMobile) { isMobile = true; isTouchOnly = true; }

  const root = (d && d.documentElement) ? d.documentElement : null;
  function addClass(name) {
    try { if (root && root.classList && root.classList.add) root.classList.add(name); } catch (_) { /* defensivo */ }
  }
  function removeClass(name) {
    try { if (root && root.classList && root.classList.remove) root.classList.remove(name); } catch (_) { /* defensivo */ }
  }

  function orientationNow() {
    if (mm) {
      try {
        return mm('(orientation: portrait)').matches ? 'portrait' : 'landscape';
      } catch (_) { /* fallback */ }
    }
    if (w) return (w.innerHeight > w.innerWidth) ? 'portrait' : 'landscape';
    return 'landscape';
  }
  function applyOrientation() {
    const o = orientationNow();
    addClass(o === 'portrait' ? 'nv-portrait' : 'nv-landscape');
    removeClass(o === 'portrait' ? 'nv-landscape' : 'nv-portrait');
    return o;
  }
  function applyClassTags() {
    if (isMobile) {
      addClass('nv-mobile');
      if (isTouchOnly) addClass('nv-touch-only');
    } else {
      removeClass('nv-mobile');
      removeClass('nv-touch-only');
    }
  }

  NV.capabilities = {
    isMobile,
    isTouchOnly,
    forceMobile,
    coarsePointer: coarse,
    finePointer: fine,
    maxTouchPoints,
    hasTouchEvents,
    orientation: orientationNow(),
  };

  applyClassTags();
  NV.capabilities.orientation = applyOrientation();

    // Listener de orientación con refuerzo extra: en algunos navegadores/emuladores
  // (incl. DevTools), matchMedia('(orientation: portrait)') no dispara suficientemente
  // los cambios, dejando la clase .nv-portrait/.nv-landscape desactualizada y
  // bloqueando la UI con el overlay de rotación. Añadimos listeners redundantes
  // de orientationchange/resize para forzar la sincronía.
  const orientationHandler = () => { NV.capabilities.orientation = applyOrientation(); };
  if (mm) {
    const mq = mm('(orientation: portrait)');
    try {
      if (mq && typeof mq.addEventListener === 'function') mq.addEventListener('change', orientationHandler);
      else if (mq && typeof mq.addListener === 'function') mq.addListener(orientationHandler);
    } catch (_) { /* defensivo */ }
  }
  // Refuerzo: también en los eventos nativos de cambio de orientación/tamaño.
  if (w && typeof w.addEventListener === 'function') {
    try { w.addEventListener('orientationchange', orientationHandler); } catch (_) { /* defensivo */ }
    try { w.addEventListener('resize', orientationHandler); } catch (_) { /* defensivo */ }
  }
  // Garantizar la orientación correcta al cargar (fuerza aplicar la clase antes
  // de que el usuario interactúe).
  NV.capabilities.orientation = applyOrientation();

  // Móvil: meta viewport app-like (evita zoom accidental durante el juego y
  // habilita env(safe-area-inset-*) vía viewport-fit). Escritorio queda intacto.
  if (isMobile && d && d.querySelector) {
    try {
      const meta = d.querySelector('meta[name="viewport"]');
      if (meta && typeof meta.setAttribute === 'function') {
        meta.setAttribute('content',
          'width=device-width, initial-scale=1.0, maximum-scale=1, user-scalable=no, viewport-fit=cover');
      }
    } catch (_) { /* defensivo */ }
  }
})();
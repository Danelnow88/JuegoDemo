// ===== UI MÓVIL: controles táctiles (capa de PRESENTACIÓN/ENTRADA, sin gameplay) =====
// Joystick virtual + botones táctiles. Traduce gestos a los MISMOS canales lógicos
// de entrada ya existentes que usa el teclado (expuestos por game.js como NV.input):
//   moveLeft / moveRight / moveUp / moveDown        (movimiento)
//   slideHeld                                       (Shift / deslizar)
//   specialPressed                                  (Shift? no: Espacio/Z/X — habilidad)
//   useSelected                                     (F — consumible seleccionado)
// NO duplica física ni lógica de movimiento: solo escribe en las variables que el
// propio game.js ya consume en update(). En escritorio (NV.capabilities.isMobile
// false) este módulo permanece inerte y no toca el DOM.
// Requiere Pointer Events cuando existen; usa fallback touch si no.
(() => {
  'use strict';

  const w = typeof window !== 'undefined' ? window : null;
  const d = typeof document !== 'undefined' ? document : null;
  const NV = (w && w.NV) ? w.NV : {};

  // --- Función pura y testeable: vector normalizado -> señales direccionales ---
  // nx, ny ∈ [-1,1]. Aplica dead zone central y umbral por componente.
  function vectorToInput(nx, ny, opts) {
    const o = opts || {};
    const dead = (typeof o.deadZone === 'number') ? o.deadZone : 0.22;
    const thr = (typeof o.threshold === 'number') ? o.threshold : 0.18;
    const mag = Math.hypot(nx, ny);
    if (mag < dead) return { left: false, right: false, up: false, down: false };
    const k = mag > 0 ? mag : 1;
    const ux = nx / k, uy = ny / k; // re-normalizar: la magnitud solo decide activo/inactivo
    return {
      left: ux < -thr,
      right: ux > thr,
      up: uy < -thr,
      down: uy > thr,
    };
  }

  NV.mobileControls = { vectorToInput };

  if (!w || !d) return;
  const isMobile = !!(NV.capabilities && NV.capabilities.isMobile);
  if (!isMobile) return; // escritorio: inerte, no toca DOM ni input

  const input = NV.input || {};
  const viewport = NV.viewport || {};

  const zone = d.getElementById('joystickZone');
  const base = d.getElementById('joystickBase');
  const thumb = d.getElementById('joystickThumb');
  const slideBtn = d.getElementById('touchSlideBtn');
  const specialBtn = d.getElementById('touchSpecialBtn');
  const useBtn = d.getElementById('touchUseBtn');
  const fullscreenBtn = d.getElementById('fullscreenBtn');

  const MAX_R = 40;      // radio máximo de arrastre del thumb (px CSS)
  const DEAD_PX = 8;     // dead zone en píxeles (tolerancia al apoyar el dedo)

  let activePointer = null; // pointerId / touch identifier del joystick activo
  let originX = 0, originY = 0;

  const hasPointerEvents = !!(w.PointerEvent);

  // --- Normalización de eventos (pointer | touch) ---
  function ptOf(e) {
    if (e.touches && e.touches[0]) return e.touches[0];
    if (e.changedTouches && e.changedTouches[0]) return e.changedTouches[0];
    return e;
  }
  function idOf(e) {
    if (e.pointerId !== undefined && e.pointerId !== null) return e.pointerId;
    const p = ptOf(e);
    return (p && p.identifier !== undefined && p.identifier !== null) ? p.identifier : 0;
  }
  function bind(el, type, fn, opts) {
    if (!el || typeof el.addEventListener !== 'function') return;
    const name = hasPointerEvents ? type
      : (type === 'pointerdown' ? 'touchstart'
        : type === 'pointermove' ? 'touchmove'
        : type === 'pointerup' ? 'touchend'
        : type === 'pointercancel' ? 'touchcancel' : type);
    el.addEventListener(name, fn, opts || { passive: false });
  }

  // --- Reset total (evita teclas/direcciones "trabadas" al cambiar de app) ---
  function resetJoystick() {
    activePointer = null;
    if (input.setMoveLeft) input.setMoveLeft(false);
    if (input.setMoveRight) input.setMoveRight(false);
    if (input.setMoveUp) input.setMoveUp(false);
    if (input.setMoveDown) input.setMoveDown(false);
    if (zone) zone.classList.remove('active');
    if (thumb) thumb.style.transform = '';
  }
  function resetButtons() {
    if (input.setSlide) input.setSlide(false);
    if (input.setSpecial) input.setSpecial(false);
  }

  // --- JOYSTICK VIRTUAL (anclado al viewport, multitouch, dead zone) ---
  function joystickCenter() {
    let cx = originX, cy = originY;
    if (base && typeof base.getBoundingClientRect === 'function') {
      try {
        const r = base.getBoundingClientRect();
        cx = r.left + r.width / 2;
        cy = r.top + r.height / 2;
      } catch (_) { /* usa el último origen */ }
    }
    return { x: cx, y: cy };
  }
  function applyJoystickOutput(dx, dy) {
    const mag = Math.hypot(dx, dy);
    if (mag <= DEAD_PX) {
      if (input.setMoveLeft) input.setMoveLeft(false);
      if (input.setMoveRight) input.setMoveRight(false);
      if (input.setMoveUp) input.setMoveUp(false);
      if (input.setMoveDown) input.setMoveDown(false);
      if (thumb) thumb.style.transform = 'translate(0,0)';
      return;
    }
    const clamp = Math.min(1, mag / MAX_R);
    const cx = (dx / mag) * MAX_R * clamp;
    const cy = (dy / mag) * MAX_R * clamp;
    if (thumb) thumb.style.transform = 'translate(' + cx + 'px,' + cy + 'px)';
    const v = vectorToInput(cx / MAX_R, cy / MAX_R, { deadZone: DEAD_PX / MAX_R, threshold: 0.18 });
    if (input.setMoveLeft) input.setMoveLeft(v.left);
    if (input.setMoveRight) input.setMoveRight(v.right);
    if (input.setMoveUp) input.setMoveUp(v.up);
    if (input.setMoveDown) input.setMoveDown(v.down);
  }

  bind(zone, 'pointerdown', (e) => {
    if (activePointer !== null) return; // un solo stick a la vez
    try { e.preventDefault(); } catch (_) { /* defensivo */ }
    activePointer = idOf(e);
    const c = joystickCenter();
    originX = c.x; originY = c.y;
    if (zone && zone.classList) zone.classList.add('active');
    if (thumb) thumb.style.transform = 'translate(0,0)';
  });
  bind(zone, 'pointermove', (e) => {
    if (idOf(e) !== activePointer) return;
    try { e.preventDefault(); } catch (_) { /* defensivo */ }
    const p = ptOf(e);
    const dx = ((p && p.clientX) == null ? 0 : p.clientX) - originX;
    const dy = ((p && p.clientY) == null ? 0 : p.clientY) - originY;
    applyJoystickOutput(dx, dy);
  });
  function endJoystickPointer(e) {
    if (idOf(e) !== activePointer) return;
    resetJoystick();
  }

  // --- BOTONES TÁCTILES ---
  function press(fnSet) {
    return (e) => {
      try { e.preventDefault(); } catch (_) { /* defensivo */ }
      if (typeof fnSet === 'function') fnSet();
    };
  }
  function release(fnSet) {
    return (e) => {
      if (typeof fnSet === 'function') fnSet();
    };
  }

  // ESPECIAL = Espacio/Z/X (habilidad). Se mantiene pulsado como el teclado.
  if (specialBtn) {
    bind(specialBtn, 'pointerdown', press(() => input.setSpecial && input.setSpecial(true)));
    bind(specialBtn, 'pointerup', release(() => input.setSpecial && input.setSpecial(false)));
    bind(specialBtn, 'pointercancel', release(() => input.setSpecial && input.setSpecial(false)));
  }
  // SHIFT = deslizar/acelerar.
  if (slideBtn) {
    bind(slideBtn, 'pointerdown', press(() => input.setSlide && input.setSlide(true)));
    bind(slideBtn, 'pointerup', release(() => input.setSlide && input.setSlide(false)));
    bind(slideBtn, 'pointercancel', release(() => input.setSlide && input.setSlide(false)));
  }
  // USAR = F (consumible seleccionado). Acción one-shot en el down.
  if (useBtn) {
    bind(useBtn, 'pointerdown', press(() => { if (typeof input.useSelected === 'function') input.useSelected(); }));
  }

  // --- FULLSCREEN (género de entrada: el navegador exige un gesto del usuario) ---
  function updateFullscreenUI() {
    if (!fullscreenBtn) return;
    const fs = !!(viewport && viewport.readFullscreen && viewport.readFullscreen());
    fullscreenBtn.textContent = fs ? '✕' : '⛶';
    fullscreenBtn.title = fs ? 'Salir de pantalla completa' : 'Jugar en pantalla completa';
  }
  if (fullscreenBtn) {
    bind(fullscreenBtn, 'pointerdown', (e) => {
      try { e.preventDefault(); } catch (_) { /* defensivo */ }
      if (viewport && typeof viewport.toggleFullscreen === 'function') viewport.toggleFullscreen();
    });
    if (w && typeof w.addEventListener === 'function') {
      w.addEventListener('fullscreenchange', updateFullscreenUI);
      w.addEventListener('orientationchange', updateFullscreenUI);
    }
    updateFullscreenUI();
  }

  // --- Higiene global ---
  if (w && typeof w.addEventListener === 'function') {
    w.addEventListener('blur', () => { resetJoystick(); resetButtons(); });
    w.addEventListener('pointerup', endJoystickPointer);
    w.addEventListener('pointercancel', endJoystickPointer);
  }
  if (d && typeof d.addEventListener === 'function') {
    d.addEventListener('visibilitychange', () => { if (d.hidden) { resetJoystick(); resetButtons(); } });
    // Previene menú contextual largo en los controles táctiles
    bind(zone, 'contextmenu', (e) => { try { e.preventDefault(); } catch (_) { /* defensivo */ } });
  }
})();
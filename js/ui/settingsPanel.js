// ===== UI: panel compartido de settings (desktop + móvil) =====
(() => {
  'use strict';
  const NV = window.NV;
  const panel = document.getElementById('settingsPanel');
  const desktopBtn = document.getElementById('settingsBtn');
  const lobbyBtn = document.getElementById('lobbySettingsBtn');
  const closeBtn = document.getElementById('settingsClose');
  const qualityInputs = [].slice.call(document.querySelectorAll('input[name="graphicsQuality"]'));
  const particles = document.getElementById('settingsParticles');
  const heavyVfx = document.getElementById('settingsHeavyVfx');
  let openState = false;

  function syncControls() {
    if (!NV.settings) return;
    const g = NV.settings.graphics;
    qualityInputs.forEach((input) => { input.checked = input.value === g.quality; });
    if (particles) particles.checked = !!g.particles;
    if (heavyVfx) heavyVfx.checked = !!g.heavyVfx;
  }
  function setOpen(open) {
    if (!panel) return;
    open = !!open;
    if (openState === open) return;
    openState = open;
    panel.classList.toggle('hidden', !open);
    panel.setAttribute('aria-hidden', open ? 'false' : 'true');
    document.documentElement.setAttribute('data-settings-open', open ? 'true' : 'false');
    if (NV.input && typeof NV.input.setSettingsOpen === 'function') NV.input.setSettingsOpen(open);
    if (open) syncControls();
  }
  function open() { setOpen(true); }
  function close() { setOpen(false); }

  if (desktopBtn) desktopBtn.addEventListener('click', open);
  // En móvil el botón se cablea desde mobileControls para compartir el gesto táctil.
  if (lobbyBtn) lobbyBtn.addEventListener('click', open);
  if (closeBtn) closeBtn.addEventListener('click', close);
  if (panel) panel.addEventListener('pointerdown', (e) => { if (e.target === panel) close(); });
  qualityInputs.forEach((input) => input.addEventListener('change', () => {
    if (input.checked) NV.setGraphicsQuality(input.value);
  }));
  if (particles) particles.addEventListener('change', () => NV.setGraphicsOption('particles', particles.checked));
  if (heavyVfx) heavyVfx.addEventListener('change', () => NV.setGraphicsOption('heavyVfx', heavyVfx.checked));
  document.addEventListener('keydown', (e) => { if (e.code === 'Escape' && panel && !panel.classList.contains('hidden')) close(); });

  NV.settingsUI = { open, close, sync: syncControls };
  syncControls();
})();
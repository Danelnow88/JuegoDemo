// ===== UI: panel compartido de settings (desktop + móvil) =====
(() => {
  'use strict';
  const NV = window.NV;
  const panel = document.getElementById('settingsPanel');
  const desktopBtn = document.getElementById('settingsBtn');
  const lobbyBtn = document.getElementById('lobbySettingsBtn');
  const closeBtn = document.getElementById('settingsClose');
  const qualityInputs = [].slice.call(document.querySelectorAll('input[name="graphicsQuality"]'));
  const firePolicyInputs = [].slice.call(document.querySelectorAll('input[name="firePolicy"]'));
  const particles = document.getElementById('settingsParticles');
  const heavyVfx = document.getElementById('settingsHeavyVfx');
  const sfxVolume = document.getElementById('settingsSfxVolume');

  const sfxVolumeValue = document.getElementById('settingsSfxVolumeValue');
  let openState = false;

  function syncControls() {
    if (!NV.settings) return;
    const g = NV.settings.graphics;
    const audio = NV.settings.audio;
    const controls = NV.settings.controls;
    qualityInputs.forEach((input) => { input.checked = input.value === g.quality; });
    if (particles) particles.checked = !!g.particles;
    if (heavyVfx) heavyVfx.checked = !!g.heavyVfx;
    if (sfxVolume) sfxVolume.value = String(Math.round(audio.sfxVolume * 100));
    if (sfxVolumeValue) sfxVolumeValue.textContent = Math.round(audio.sfxVolume * 100) + '%';
    firePolicyInputs.forEach((input) => { input.checked = input.value === controls.firePolicy; });
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
  firePolicyInputs.forEach((input) => input.addEventListener('change', () => {
    if (input.checked) NV.setFirePolicy(input.value);
  }));
  if (particles) particles.addEventListener('change', () => NV.setGraphicsOption('particles', particles.checked));
  if (heavyVfx) heavyVfx.addEventListener('change', () => NV.setGraphicsOption('heavyVfx', heavyVfx.checked));
  if (sfxVolume) sfxVolume.addEventListener('input', () => {
    const value = NV.setSfxVolume(Number(sfxVolume.value) / 100);
    if (sfxVolumeValue) sfxVolumeValue.textContent = Math.round(value * 100) + '%';
  });
  document.addEventListener('keydown', (e) => { if (e.code === 'Escape' && panel && !panel.classList.contains('hidden')) close(); });

  var lobbyDiffButtons = Array.from(document.querySelectorAll('#lobbyDiffOptions .lobby-diff-btn'));

  // settings.js puede cargar después de balance.js o antes; resolver el orden real en runtime.
  function difficultyOrder() {
    if (NV.DIFFICULTY_ORDER && NV.DIFFICULTY_ORDER.indexOf) return NV.DIFFICULTY_ORDER;
    return ['easy', 'normal', 'hard'];
  }

  function currentLobbyDifficulty() {
    var fallback = 'normal';
    if (NV.settings && NV.settings.gameplay && NV.settings.gameplay.difficulty) {
      fallback = NV.settings.gameplay.difficulty;
    }
    if (difficultyOrder().indexOf(fallback) >= 0) return fallback;
    return 'normal';
  }

  function renderLobbyDifficultySelection() {
    var current = currentLobbyDifficulty();

    lobbyDiffButtons.forEach(function(btn) {
      var value = btn.dataset ? btn.dataset.diff : null;
      if (!value && btn.getAttribute) value = btn.getAttribute('data-diff');
      var selected = value === current;
      btn.classList.toggle('is-selected', selected);
      btn.setAttribute('aria-pressed', selected ? 'true' : 'false');
    });
  }

  lobbyDiffButtons.forEach(function(btn) {
    btn.addEventListener('click', function() {
      var value = btn.dataset ? btn.dataset.diff : null;
      if (!value && btn.getAttribute) value = btn.getAttribute('data-diff');
      if (difficultyOrder().indexOf(value) < 0) return;
      if (typeof NV.setDifficulty === 'function') {
        NV.setDifficulty(value);
      } else if (NV.settings && NV.settings.gameplay) {
        // Fallback si settings.js aún no registró el setter: misma escritura + notify.
        NV.settings.gameplay.difficulty = value;
      }
      renderLobbyDifficultySelection();
    });
  });
  NV.onSettingsChange(renderLobbyDifficultySelection);
  NV.renderLobbyDifficultySelection = renderLobbyDifficultySelection;
  renderLobbyDifficultySelection();

  NV.settingsUI = { open, close, sync: syncControls };
  syncControls();
})();
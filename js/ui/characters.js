// ===== UI: render declarativo de personajes del menú =====
// Usa metadata en NV.CHARACTERS para generar la misma estructura/clases que el HTML legacy.
(() => {
  'use strict';
  const NV = window.NV;

  NV.characterCardsHtml = function (characters, selectedId) {
    characters = characters || NV.CHARACTERS;
    selectedId = selectedId || 'boti';
    return NV.characterList().map(({ id, data: char }) => {
      const card = char.card;
      const selected = id === selectedId ? ' selected' : '';
      return '<button data-char="' + id + '" class="char-card' + selected + '" aria-pressed="' + (id === selectedId ? 'true' : 'false') + '">' +
        '<div class="char-visual"><div class="char-preview ' + card.previewClass + '"><div class="char-eye"></div><div class="char-eye"></div></div></div>' +
        '<div class="char-content">' +
          '<div class="char-heading"><div class="char-name">' + char.name + '</div><div class="char-tag">' + card.tag + '</div></div>' +
          '<div class="char-stat">' + card.statLine + '</div>' +
          '<div class="char-desc">' + card.descHtml + '</div>' +
        '</div>' +
      '</button>';
    }).join('');
  };

  NV.renderCharacterCards = function (container, characters, selectedId) {
    if (!container) return;
    const list = NV.characterList();
    container.innerHTML = NV.characterCardsHtml(characters, selectedId);
    const count = document.getElementById('lobbyCharacterCount');
    if (count) count.textContent = list.length + ' disponibles';
  };
})();
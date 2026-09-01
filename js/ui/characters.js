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
      return '<button data-char="' + id + '" class="char-card' + selected + '">' +
        '<div class="char-preview ' + card.previewClass + '"><div class="char-eye"></div><div class="char-eye"></div></div>' +
        '<div class="char-name">' + char.name + '</div>' +
        '<div class="char-tag">' + card.tag + '</div>' +
        '<div class="char-stat">' + card.statLine + '</div>' +
        '<div class="char-desc">' + card.descHtml + '</div>' +
      '</button>';
    }).join('');
  };

  NV.renderCharacterCards = function (container, characters, selectedId) {
    if (!container) return;
    container.innerHTML = NV.characterCardsHtml(characters, selectedId);
  };
})();
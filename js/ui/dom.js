// ===== UI: referencias DOM =====
// Se carga ANTES de game.js. Expone el árbol `dom` en NV; game.js lo aliasa con
// `const dom = NV.dom;` y así ninguna referencia interna (dom.x) cambia.
(() => {
  'use strict';
  const NV = window.NV;

  NV.dom = {
    startScreen: document.getElementById('startScreen'),
    startBtn: document.getElementById('startBtn'),
    shop: document.getElementById('shop'),
    gameOver: document.getElementById('gameOver'),
    waveBanner: document.getElementById('waveBanner'),
    goTitle: document.getElementById('goTitle'),
    goText: document.getElementById('goText'),
    goScore: document.getElementById('goScore'),
    goWave: document.getElementById('goWave'),
    shopShards: document.getElementById('shopShards'),
    upgradesOffers: document.getElementById('upgradesOffers'),
    weaponOffers: document.getElementById('weaponOffers'),
    consumableOffers: document.getElementById('consumableOffers'),
    invSlots: document.getElementById('invSlots'),
    skipWave: document.getElementById('skipWave'),
    restartBtn: document.getElementById('restartBtn'),
    sound: document.getElementById('sound'),
        rwAddMusicBtn: document.getElementById('rwAddMusicBtn'),
    rwStopBtn: document.getElementById('rwStopBtn'),
    rwIcon: document.querySelector('.rw-icon'),
    wave: document.getElementById('wave'),
    score: document.getElementById('score'),
    shards: document.getElementById('shards'),
    hpFill: document.getElementById('hpFill'),
    hpText: document.getElementById('hpText'),
    hpBar: document.querySelector('.hp-bar'),
    specialFill: document.getElementById('specialFill'),
    specialCooldown: document.querySelector('.special-cooldown'),
    hudToggle: document.getElementById('hudToggle'),
    charBtn: document.getElementById('charBtn'),
    permScreen: document.getElementById('permShop'),
    permBtn: document.getElementById('permBtn'),
    permBack: document.getElementById('permBack'),
    permShards: document.getElementById('permShards'),
    permOffers: document.getElementById('permOffers'),
  };
})();

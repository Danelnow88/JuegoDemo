// engine/special.js — Habilidad especial de cada personaje (ctxState+callbacks).
// Retorna { specialVFX, drones, shake }; muta player/meteors/particles vía estado.
(() => {
  'use strict';
  const NV = window.NV;

  // state: { player, CHARACTERS, meteors, particles, W, H?, shake, specialVFX,
  //          cbs: { showBanner, triggerFlash, spawnExplosion, sfx } }
  NV.useSpecial = function (state) {
    const { player, CHARACTERS, meteors, particles } = state;
    const { showBanner, triggerFlash, spawnExplosion, sfx } = state.cbs;
    let { drones, shake } = state;

    const char = CHARACTERS[player.character];
    player.specialCd = char.maxCd + 0.5;
    const specialVFX = { x: player.x, y: player.y, life: 1, type: char.special, color: char.color };
    showBanner(char.skillName.toUpperCase(), char.color);

    if (char.special === 'meteor') {
      // Lluvia Estelar: meteoritos caen del cielo
      triggerFlash('#7cf8ff');
      shake = 0.4;
      for (let i = 0; i < 12; i++) {
        meteors.push({
          x: 30 + Math.random() * (state.W - 60),
          y: -20 - Math.random() * 120,
          vy: 320 + Math.random() * 200,
          vx: (Math.random() - 0.5) * 70,
          radius: 9 + Math.random() * 7,
          color: i % 2 === 0 ? '#7cf8ff' : '#caa7ff',
          dead: false,
        });
      }
      spawnExplosion(player.x, player.y, 30, '#7cf8ff', 0.6);
    } else if (char.special === 'phase') {
      // Fase Fantasma: intangible 3s + rastro de daño
      player.invuln = 3;
      player.phase = 3;
      triggerFlash('#caa7ff');
      for (let i = 0; i < 46; i++) {
        const a = (i / 46) * Math.PI * 2;
        particles.push({ x: player.x, y: player.y, vx: Math.cos(a) * 360, vy: Math.sin(a) * 360, life: 0.7, color: i % 2 ? '#caa7ff' : '#fff' });
      }
    } else if (char.special === 'bulwark') {
      player.invuln = 3;
      player.bulwark = 3;
      shake = 0.5;
      triggerFlash('#ffcf76');
      spawnExplosion(player.x, player.y, 40, '#ffcf76', 0.4);
      spawnExplosion(player.x, player.y, 25, '#fff', 0.5);
    } else if (char.special === 'hivemind') {
      // Drones de Combate: 6 drones que orbitan y disparan por 5s
      triggerFlash('#8dfaff');
      drones = [];
      for (let i = 0; i < 6; i++) {
        drones.push({
          angle: (i / 6) * Math.PI * 2,
          orbitRadius: 55,
          speed: 2.5,
          fireTimer: 0.3 + i * 0.1,
          color: '#8dfaff',
          dead: false,
        });
      }
      spawnExplosion(player.x, player.y, 20, '#8dfaff', 0.6);
    }
    sfx.special();
    return { specialVFX, drones, shake };
  };
})();
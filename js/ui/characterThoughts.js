// ============ characterThoughts.js ==========
// Adds occasional thought bubbles over character cards.
// Requires NV.CHARACTERS to be defined.
// Place this script after characters.js and before game.js.

const characterDialogues = {
  // Gameplay perspective – boti
  boti: [
    "Las oleadas se disparan más rápido que un mate frío.",
    "El balance de enemigos me tiene con la mano en la cintura.",
    "La dificultad sube igual que el precio de la pizza.",
    "Si los movimientos son suaves, el jugador se siente en la pista.",
    "El ritmo de la economía debería estar en sincronía.",
    "El combo entre disparos y la velocidad del enemigo hace que el player sienta ritmo.",
    "La barra de vida del boss debería reflejar el daño real, no solo un indicador.",
    "Los checkpoints podrían ser más visibles para evitar sorpresas desagradables."
  ],
  // Visual perspective – nova
  nova: [
    "El color de los efectos es tan claro como un día de sol, pero las partículas se quedan en el aire.",
    "La iluminación hace que el jugador vea la luna en la arena, pero el HUD se pierde en la sombra.",
    "El contraste entre el boss y el fondo está tan suave que el jugador se confunde.",
    "Los efectos de sangre se ven como confetti, pero no dicen nada al jugador.",
    "Si el juego tuviera más luces, los enemigos se verían como zombies iluminados.",
    "El brillo de los power-ups debería ser más audaz para que el jugador los identifique rápido.",
    "El parpadeo de los efectos de daño necesita un fade más suave para no distraer.",
    "Los textos de eventos deberían usar la fuente del juego para coherencia visual."
  ],
  // Technical perspective – rook
  rook: [
    "El código que dibuja los enemigos es tan repetido que me da idea de crear un generador de código.",
    "Las funciones de render se llaman varias veces, parece que el jugador está mirando un espejo.",
    "La lógica de la IA se vuelve tan compleja que se necesita un manual de instrucciones.",
    "Hay más variables globales que en el armario del abuelito.",
    "El rendimiento se comporta como un carro con aire acondicionado en pleno verano.",
    "El cálculo de colisiones se hace en cada frame, lo cual podría optimizarse con spatial hashing.",
    "Las dependencias de los módulos están muy acopladas, lo que dificulta los test.",
    "El uso de setInterval para render podría sustituirse por requestAnimationFrame para suavizar la FPS."
  ],
  // Experience/Future perspective – swarm
  swarm: [
    "La rejugabilidad es tan buena que el jugador quiere repetir la misma onda una y otra vez.",
    "Si el lobby se animara, la música sería el alma de la experiencia.",
    "El progreso se siente como un viaje sin destino, pero el jugador se queda con la curiosidad.",
    "El juego necesita más momentos épicos para que el jugador grite: ¡Peli!",
    "El futuro del juego es tan incierto como el clima en la costa.",
    "El sistema de logros podría mostrar progreso visible para motivar al jugador.",
    "El uso de narrativas cortas entre niveles ayudaría a contextualizar la historia.",
    "El lobby podría presentar mini-tutoriales para nuevos jugadores."
  ]
};

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

NV.initThoughts = function() {
  if (!NV.CHARACTERS) return;
  // Initial delay: 10 seconds, then every 15s.
  const lastChar = { id: null };
  setTimeout(() => {
    setInterval(() => {
      const ids = Object.keys(NV.CHARACTERS);
      let id = randomChoice(ids);
      // Intercalar para evitar repetición consecutiva
      while (id === lastChar.id && ids.length > 1) {
        id = randomChoice(ids);
      }
      lastChar.id = id;
      const dialogArray = characterDialogues[id] || [];
      if (dialogArray.length === 0) return;
      const text = randomChoice(dialogArray);
      const card = document.querySelector('[data-char="' + id + '"]');
      if (!card) return;
      const bubble = document.createElement('div');
      bubble.className = 'thought-bubble';
      bubble.textContent = text;
      card.appendChild(bubble);
      // Force reflow to apply transition.
      bubble.offsetHeight;
      bubble.style.opacity = '1';
      const duration = 4000 + Math.random() * 2000;
      setTimeout(() => {
        bubble.style.opacity = '0';
        bubble.addEventListener('transitionend', () => {
          bubble.remove();
        }, { once: true });
      }, duration);
    }, 15000);
  }, 10000);
};

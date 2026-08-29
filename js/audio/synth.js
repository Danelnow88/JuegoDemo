// ===== AUDIO SYNTHWAVE + SFX =====
// Estado mutable en NV (soundOn/audioCtx/musicState/musicTime) y getters de game.js
// (getFrame/getBoss/getState) para valores que solo lee. Se carga ANTES de game.js.
(() => {
  'use strict';
  const NV = window.NV;

    NV.soundOn = true;
  NV.audioCtx = null;
  NV.musicState = {
    step: 0,
    lastBeat: 0,
    intensity: 0,
    combo: 0,        // kills sin morir → capas musicales de intensidad (Tarea 1 - audio adaptativo)
    phase: 'normal', // 'normal' | 'boss' | 'shop' | 'menu' (manejado por game.js)
  };
  NV.musicTime = 0;

  // Progresión de acordes y bajo (estilo Karl Casey dark synthwave)
  const CHORD_ROOTS = [65.41, 87.31, 110.00, 146.83]; // C2 - F2 - G2 - C3
  const BASS_LINE = [65.41, 87.31, 65.41, 146.83];    // C - F - C - G (bajo)
  const LEAD_SEQ = [329.63, 440.00, 493.88, 587.33, 659.26, 587.33, 493.88, 440.00];
  const DRUM_PATTERN = [
    [1,0,1,0, 1,0,0,0, 1,0,1,0, 1,0,0,0], // Kick (16 steps)
    [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0], // Snare
    [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1], // Hi-hat
  ];

  // === Identidad sonora de jefe (Tarea 3) ===
  // Capa musical distinta y más oscura/tensa: raíces una octava abajo, progresión
  // más disonante y percusión más densa (más presión rítmica en pelea de jefe).
  const BOSS_CHORD_ROOTS = [49.00, 55.00, 61.74, 73.42]; // G1 - A1 - B1 - D2 (grave y tenso)
  const BOSS_BASS_LINE = [49.00, 61.74, 55.00, 73.42];
  const BOSS_LEAD_SEQ = [220.00, 246.94, 261.63, 293.66, 329.63, 293.66, 261.63, 246.94];
  const BOSS_DRUM_PATTERN = [
    [1,0,1,0, 1,1,0,0, 1,0,1,0, 1,1,0,0], // Kick más denso (doble golpe en el 2do compás)
    [0,0,0,0, 1,0,0,1, 0,0,0,0, 1,0,0,1], // Snare con contratiempo extra
    [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1], // Hi-hat (mismo pulso)
  ];
  // Lookup de capas por fase. 'shop'/'menu' caen a 'normal' hasta que se les
  // asigne identidad propia (Tarea 5 - ambiente de menú).
  const MENU_CHORD_ROOTS = [82.41, 98.00, 123.47, 164.81]; // E2 - G2 - B2 - E3
  const MENU_BASS_LINE = [82.41, 0, 98.00, 0];
  const MENU_LEAD_SEQ = [329.63, 392.00, 493.88, 587.33, 493.88, 392.00, 329.63, 246.94];
  const MENU_DRUM_PATTERN = [
    [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
    [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
    [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
  ];
  const MUSIC_LAYERS = {
    normal: { chordRoots: CHORD_ROOTS, bass: BASS_LINE, lead: LEAD_SEQ, drums: DRUM_PATTERN },
    boss: { chordRoots: BOSS_CHORD_ROOTS, bass: BOSS_BASS_LINE, lead: BOSS_LEAD_SEQ, drums: BOSS_DRUM_PATTERN },
    menu: { chordRoots: MENU_CHORD_ROOTS, bass: MENU_BASS_LINE, lead: MENU_LEAD_SEQ, drums: MENU_DRUM_PATTERN },
    shop: { chordRoots: MENU_CHORD_ROOTS, bass: MENU_BASS_LINE, lead: MENU_LEAD_SEQ, drums: MENU_DRUM_PATTERN },
  };
  function currentLayers() { return MUSIC_LAYERS[NV.musicState.phase] || MUSIC_LAYERS.normal; }

  function initMusic() {
    if (!NV.audioCtx) NV.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }

  // === MEZCLADOR DE CANALES (Tarea 1) ===
  // Canales con GainNode propios sobre destination: permite ducking, volúmenes
  // relativos y prioridad. Se crea de forma perezosa dentro de initAudio() para
  // no romper los tests headless (audioCtx es null hasta COMENZAR).
  //  - music:        música base / capas musicales
  //  - sfxUI:        UI, tienda, pickups, wheel, victoria
  //  - sfxPlayer:    disparos, habilidad, recibir daño, heartbeat
  //  - sfxEnemies:   muerte de enemigos, ataques de jefe
  //  - sfxAmbient:   eventos de Tanda C, cofres, combos
  const CHANNELS = { music:0.6, sfxUI:0.7, sfxPlayer:0.9, sfxEnemies:0.8, sfxAmbient:0.6 };
  // Volubilidad maestra por canal (0..1), configurable futuro -> sliders.
  const MASTER_VOLUME = { music:1, sfxUI:1, sfxPlayer:1, sfxEnemies:1, sfxAmbient:1 };

  // Ducking: un canal puede ser atenuado temporalmente por un evento de otro canal.
  // Usado por SFX importantes (daño, victoria, combo) para bajar la música.
  const ducking = {}; // canal -> { original, target, until }

  // Crea y expone el mixer. Llamado por initAudio(); si audioCtx ya no existe
  // (modo headless/test) simplemente no hace nada → fallback a destination directo.
  function createMixer() {
    if (!NV.audioCtx) return;
    const ctx = NV.audioCtx;
    const mixer = {};
    for (const ch in CHANNELS) {
      const g = ctx.createGain();
      g.gain.value = CHANNELS[ch];
      g.connect(ctx.destination);
      mixer[ch] = g;
    }
    NV.mixer = mixer;
  }

  // Enruta un GainNode a su canal; si no hay mixer (headless), cae a destination.
  function channelFor(name) {
    return (NV.mixer && NV.mixer[name]) || NV.audioCtx.destination;
  }

  function panForX(x, worldWidth) {
    if (typeof x !== 'number') return 0;
    const w = worldWidth || 900;
    return Math.max(-1, Math.min(1, (x / w) * 2 - 1));
  }

  function connectOutput(node, channel, opts) {
    opts = opts || {};
    const target = (channel && channelFor(channel)) || channelFor('sfxPlayer');
    if (NV.audioCtx && typeof NV.audioCtx.createStereoPanner === 'function' && (typeof opts.pan === 'number' || typeof opts.x === 'number')) {
      const pan = NV.audioCtx.createStereoPanner();
      pan.pan.setValueAtTime(typeof opts.pan === 'number' ? opts.pan : panForX(opts.x, opts.worldWidth), NV.audioCtx.currentTime);
      node.connect(pan); pan.connect(target);
    } else {
      node.connect(target);
    }
  }

  function setChannelVolume(name, value) {
    if (!Object.prototype.hasOwnProperty.call(MASTER_VOLUME, name)) return;
    MASTER_VOLUME[name] = Math.max(0, Math.min(1, value));
    if (NV.mixer && NV.mixer[name]) NV.mixer[name].gain.value = MASTER_VOLUME[name] * CHANNELS[name];
  }

  // Ducking temporal: atenúa `byChannel` a `to` hasta `until` segundos de audioCtx.
  function duck(byChannel, to, secs) {
    if (!NV.mixer) return;
    const now = NV.audioCtx.currentTime;
    const g = NV.mixer[byChannel];
    if (!g) return;
    const cur = g.gain.value;
    ducking[byChannel] = ducking[byChannel] || { original: cur };
    ducking[byChannel].original = cur;
    ducking[byChannel].target = to;
    ducking[byChannel].until = now + (secs || 0.15);
    g.gain.setValueAtTime(cur, now);
    g.gain.linearRampToValueAtTime(to, now + 0.01);
  }
  // Restaura gains al volumen maestro correspondiente (llamado cada frame de música).
  function restoreDucking() {
    if (!NV.mixer) return;
    const now = NV.audioCtx.currentTime;
    for (const ch in ducking) {
      const d = ducking[ch];
      if (now >= d.until) {
        const target = MASTER_VOLUME[ch] * CHANNELS[ch];
        NV.mixer[ch].gain.cancelScheduledValues(now);
        NV.mixer[ch].gain.setValueAtTime(d.target, now);
        NV.mixer[ch].gain.linearRampToValueAtTime(target, now + 0.12);
        delete ducking[ch];
      }
    }
  }

  function initAudio() {
    initMusic();
    createMixer(); // perezoso: solo cuando realmente hay contexto
    if (NV.audioCtx.state === 'suspended') NV.audioCtx.resume();
  }
  function createDrone(freq, time, dur) {
    if (!NV.audioCtx || !NV.soundOn) return;
    const osc = NV.audioCtx.createOscillator();
    const lfo = NV.audioCtx.createOscillator();
    const filter = NV.audioCtx.createBiquadFilter();
    const gain = NV.audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(5, time);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq * 2, time);
    gain.gain.setValueAtTime(0.01, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
    lfo.connect(filter.frequency);
    osc.connect(filter); filter.connect(gain); gain.connect(NV.audioCtx.destination);
    lfo.start(time); osc.start(time);
    osc.stop(time + dur); lfo.stop(time + dur);
  }
  function scheduleNote(type, freq, dur, vol) {
    if (!NV.audioCtx || !NV.soundOn) return;
    const osc = NV.audioCtx.createOscillator();
    const filter = NV.audioCtx.createBiquadFilter();
    const gain = NV.audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, NV.audioCtx.currentTime);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3000, NV.audioCtx.currentTime);
    gain.gain.setValueAtTime(vol || 0.03, NV.audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, NV.audioCtx.currentTime + dur);
    osc.connect(filter); filter.connect(gain); gain.connect(NV.audioCtx.destination);
    osc.start(); osc.stop(NV.audioCtx.currentTime + dur);
  }
  function scheduleNoise(dur, vol) {
    if (!NV.audioCtx || !NV.soundOn) return;
    const buffer = NV.audioCtx.createBuffer(1, NV.audioCtx.sampleRate * dur, NV.audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
    const src = NV.audioCtx.createBufferSource();
    const filter = NV.audioCtx.createBiquadFilter();
    const gain = NV.audioCtx.createGain();
    src.buffer = buffer;
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(200 + Math.random() * 200, NV.audioCtx.currentTime);
    gain.gain.setValueAtTime(vol || 0.04, NV.audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, NV.audioCtx.currentTime + dur);
    src.connect(filter); filter.connect(gain); gain.connect(NV.audioCtx.destination);
    src.start(); src.stop(NV.audioCtx.currentTime + dur);
  }
  function scheduleDrum(type, dur, vol) {
    if (!NV.audioCtx || !NV.soundOn) return;
    if (type === 'noise') { scheduleNoise(dur, vol); return; }
    const osc = NV.audioCtx.createOscillator();
    const filter = NV.audioCtx.createBiquadFilter();
    const gain = NV.audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(type === 'kick' ? 60 : 120, NV.audioCtx.currentTime);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(type === 'kick' ? 150 : 4000, NV.audioCtx.currentTime);
    gain.gain.setValueAtTime(vol || 0.04, NV.audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, NV.audioCtx.currentTime + dur);
    osc.connect(filter); filter.connect(gain); gain.connect(NV.audioCtx.destination);
    osc.start(); osc.stop(NV.audioCtx.currentTime + dur);
  }
  function updateMusic(dt) {
    if (!NV.audioCtx || !NV.soundOn) return;
    const gameState = NV.getState ? NV.getState() : 'playing';
    if (gameState !== 'playing' && gameState !== 'menu' && gameState !== 'shop') return;
    // Sincroniza la fase de música con la presencia de jefe (Tarea 3: identidad
    // sonora de jefe). El cambio de capa ocurre en el próximo step, nunca a mitad
    // de nota, así que no hay glitch/corte audible al entrar o salir de fase boss.
    const wantPhase = gameState === 'menu' ? 'menu' : (gameState === 'shop' ? 'shop' : (NV.getBoss && NV.getBoss() ? 'boss' : 'normal'));
    if (wantPhase !== NV.musicState.phase) NV.musicState.phase = wantPhase;
    const layers = currentLayers();
    const comboLayer = Math.min(1, (NV.musicState.combo || 0) / 20);
    const isMenuLike = NV.musicState.phase === 'menu' || NV.musicState.phase === 'shop';
    NV.musicTime += dt * (isMenuLike ? 0.55 : (1 + NV.musicState.intensity * 0.6 + comboLayer * 0.18));
    const stepDur = isMenuLike ? 0.18 : 0.12;
    NV.musicState.intensity = Math.max(0, Math.min(1, NV.musicState.intensity + ((NV.getBoss && NV.getBoss()) ? 0.02 : -0.015) * dt));
    if (NV.musicTime - NV.musicState.lastBeat >= stepDur) {
      NV.musicState.lastBeat = NV.musicTime;
      NV.musicState.step = (NV.musicState.step + 1) % 16;
      const step = NV.musicState.step;
      // Kick (808 punch)
      if (layers.drums[0][step]) scheduleDrum('kick', 0.1, 0.1 + NV.musicState.intensity * 0.05);
      // Snare (808 clap)
      if (layers.drums[1][step]) scheduleDrum('noise', 0.15, 0.06 + NV.musicState.intensity * 0.03);
      // Hi-hats
      if (layers.drums[2][step]) scheduleNote('square', 8000 + (step % 3) * 3000, 0.03, 0.02 + NV.musicState.intensity * 0.015 + comboLayer * 0.012);
      // Capa extra por combo: arpegio fino en contratiempos, aparece progresivamente
      // sin cambiar la base de la oleada.
      if (comboLayer > 0.25 && step % 2 === 1) {
        const note = layers.lead[(step + Math.floor(NV.musicState.combo || 0)) % layers.lead.length] * 2;
        scheduleNote('triangle', note, 0.06, 0.012 + comboLayer * 0.018);
      }
      // Bajo cada 4 steps (subby sawtooth)
      if (step % 4 === 0) {
        const bassIdx = Math.floor(step / 4) % layers.bass.length;
        if (layers.bass[bassIdx]) scheduleNote(isMenuLike ? 'sine' : 'sawtooth', layers.bass[bassIdx], isMenuLike ? 0.5 : 0.2, (isMenuLike ? 0.025 : 0.05) + NV.musicState.intensity * 0.02);
      }
      // Lead melódico (guitarra synth) → solo cada 8 steps
      if (step % 8 === 0 || (NV.musicState.intensity > 0.7 && step % 4 === 0)) {
        const note = layers.lead[Math.floor(step / 2) % layers.lead.length];
        scheduleNote('sawtooth', note, 0.25, 0.04 + NV.musicState.intensity * 0.02 + comboLayer * 0.012);
      }
    }
        // Drone atmosférico continuo (loop)
    if (NV.getFrame() % (isMenuLike ? 180 : 120) === 0) {
      const droneFreq = layers.chordRoots[Math.floor(NV.getFrame() / 120) % layers.chordRoots.length] * (isMenuLike ? 2 : 4);
      createDrone(droneFreq, NV.audioCtx.currentTime, isMenuLike ? 3.4 : 2.5);
    }

    // Restaurar ducking si venció su duración (audio adaptativo de capas - Tarea 1)
    restoreDucking();
  }
  function playTone(freq, dur, type, vol, channel, opts) {
    if (!NV.audioCtx || !NV.soundOn) return;
    const ctx = NV.audioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    // Detune aleatorio leve (±0.8%) evita fatiga auditiva en disparos rápidos (Tarea 1).
    const detune = (Math.random() * 2 - 1) * 0.008;
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq * (1 + detune), ctx.currentTime);
    gain.gain.setValueAtTime(vol || 0.03, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain);
    connectOutput(gain, channel, opts);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  }

  // Variante extendida: permite pasar { channel, detune, priority } desde callers
  // que conocen el contexto del juego (arma rara, combo, daño crítico, etc.).
  // Se usa para la Tarea 4 (anti-fatiga en SMG/railgun) y combo de kills.
  function playToneEx(freq, dur, type, vol, opts) {
    opts = opts || {};
    const det = typeof opts.detune === 'number' ? opts.detune : ((Math.random() * 2 - 1) * 0.008);
    const f = freq * (1 + det);
    return playTone(f, dur, type, vol, opts.channel, opts);
  }
  const rapidFireFatigue = {};
  function rapidFireVolume(id, baseVol) {
    if (!NV.audioCtx || (id !== 'smg' && id !== 'railgun')) return baseVol;
    const now = NV.audioCtx.currentTime;
    const st = rapidFireFatigue[id] || { last: -99, heat: 0 };
    const cadence = now - st.last;
    if (cadence < (id === 'smg' ? 0.09 : 0.22)) st.heat = Math.min(1, st.heat + 0.16);
    else st.heat = Math.max(0, st.heat - cadence * 1.2);
    st.last = now;
    rapidFireFatigue[id] = st;
    return baseVol * (1 - st.heat * 0.32);
  }
  const sfx = {
    // SFX existentes: redirigidos a canales con ducking automático.
    explosion: (enemyType, opts) => { sfx.enemyDeath(enemyType || 'normal', opts); },
    enemyDeath: (enemyType, opts) => {
      opts = opts || {};
      const kind = enemyType || 'normal';
      if (kind === 'boss') {
        duck('music', 0.12, 0.35);
        scheduleNoise(0.38, 0.08);
        playTone(70, 0.42, 'sawtooth', 0.13, 'sfxEnemies', opts);
        playTone(110, 0.25, 'triangle', 0.08, 'sfxEnemies', opts);
      } else if (kind === 'elite') {
        scheduleNoise(0.14, 0.055);
        playTone(165, 0.22, 'sawtooth', 0.085, 'sfxEnemies', opts);
        playTone(95, 0.18, 'square', 0.055, 'sfxEnemies', opts);
      } else {
        playTone(220, 0.12, 'square', 0.045, 'sfxEnemies', opts);
        playTone(140, 0.14, 'sawtooth', 0.035, 'sfxEnemies', opts);
      }
    },
    pickup: () => playTone(1320, 0.12, 'square', 0.04, 'sfxUI'),
    consume: (type) => {
      const f = type === 'bomb' ? 180 : type === 'freeze' ? 520 : type === 'overdrive' ? 900 : type === 'bounty' ? 740 : 620;
      duck('music', 0.42, 0.08);
      playTone(f, 0.1, 'triangle', 0.045, 'sfxPlayer');
      playTone(f * 1.5, 0.12, 'sine', 0.035, 'sfxUI');
    },
    fuse: (level) => {
      duck('music', 0.28, 0.16);
      playTone(440 + (level || 1) * 70, 0.12, 'triangle', 0.055, 'sfxUI');
      playTone(880 + (level || 1) * 90, 0.18, 'square', 0.04, 'sfxAmbient');
    },
    shopBuy: () => { playTone(1040, 0.07, 'square', 0.04, 'sfxUI'); playTone(1560, 0.08, 'triangle', 0.025, 'sfxUI'); },
    shopSell: () => { playTone(780, 0.08, 'triangle', 0.04, 'sfxUI'); playTone(520, 0.09, 'square', 0.03, 'sfxUI'); },
    wheelSelect: () => playTone(1180, 0.045, 'square', 0.03, 'sfxUI'),
    damage: () => { duck('music', 0.2, 0.18); playTone(80, 0.15, 'square', 0.07, 'sfxPlayer'); },
    playerHit: () => { duck('music', 0.32, 0.12); playTone(135, 0.11, 'sawtooth', 0.075, 'sfxPlayer'); playTone(82, 0.18, 'triangle', 0.045, 'sfxPlayer'); },
    special: () => playTone(660, 0.4, 'triangle', 0.05, 'sfxPlayer'),
    playerLevelUp: () => { duck('music', 0.3, 0.14); playTone(523, 0.1, 'square', 0.05, 'sfxUI'); playTone(784, 0.13, 'triangle', 0.04, 'sfxUI'); },
    wave: () => playTone(440, 0.3, 'triangle', 0.06, 'sfxUI'),
  };

  sfx.levelup = () => sfx.playerLevelUp(); // alias legacy

  // Eventos Tanda C: cada modificador de oleada tiene una firma breve e identificable.
  sfx.waveEvent = (eventKey) => {
    if (eventKey === 'mines') {
      duck('music', 0.38, 0.18);
      playTone(95, 0.18, 'sawtooth', 0.075, 'sfxAmbient');
      scheduleNoise(0.16, 0.05);
    } else if (eventKey === 'fog') {
      duck('music', 0.45, 0.12);
      playTone(260, 0.45, 'sine', 0.045, 'sfxAmbient');
      playTone(195, 0.55, 'triangle', 0.03, 'sfxAmbient');
    } else if (eventKey === 'elites') {
      duck('music', 0.32, 0.16);
      playTone(330, 0.14, 'square', 0.055, 'sfxAmbient');
      playTone(660, 0.14, 'square', 0.04, 'sfxAmbient');
    } else if (eventKey === 'payday') {
      playTone(880, 0.09, 'triangle', 0.045, 'sfxUI');
      playTone(1320, 0.1, 'square', 0.04, 'sfxUI');
      playTone(1760, 0.12, 'triangle', 0.035, 'sfxUI');
    }
  };

  // SFX nuevos de la Tarea 1 (esqueleto: hooks de ducking para combo/victoria).
  sfx.combo = (count) => {
    NV.musicState.combo = Math.max(NV.musicState.combo || 0, count || 0);
    duck('music', 0.35, 0.12);
    playTone(880 + (count * 40), 0.08, 'square', 0.05 + count * 0.008, 'sfxAmbient');
  };
  sfx.heartbeat = (intensity) => { playTone(120, 0.3, 'sine', 0.03 + intensity * 0.12, 'sfxPlayer'); };
  sfx.countdown = (sec) => { playTone(660 - sec * 60, 0.12, 'square', 0.04, 'sfxAmbient'); };
  sfx.bossEnter = () => { duck('music', 0.1, 0.4); playTone(90, 0.6, 'sawtooth', 0.12, 'sfxEnemies'); };
  sfx.victory = (wave, opts) => {
    opts = opts || {};
    const big = !!opts.milestone || (wave && (wave % 25 === 0 || wave % 10 === 0 || wave % 5 === 0));
    duck('music', big ? 0.12 : 0.25, big ? 0.38 : 0.2);
    playTone(660, 0.16, 'triangle', 0.055, 'sfxUI');
    playTone(880, 0.18, 'triangle', 0.05, 'sfxUI');
    if (big) {
      playTone(523, 0.26, 'sawtooth', 0.07, 'sfxUI');
      playTone(1046, 0.32, 'square', 0.05, 'sfxAmbient');
      scheduleNoise(0.22, 0.035);
    }
  };
  // Firma sonora de transición de fase de jefe (Tarea 3, idea 6): golpe grave + swell
  // ascendente distinto del bossEnter, para que "entró en fase 2" se sienta único.
  sfx.bossPhaseShift = () => {
    duck('music', 0.15, 0.35);
    playTone(70, 0.35, 'sawtooth', 0.13, 'sfxEnemies');
    playToneEx(220, 0.4, 'sawtooth', 0.07, { channel: 'sfxEnemies', detune: 0 });
    scheduleNoise(0.3, 0.06);
  };

  // Sonido distintivo por tipo de arma
  // opts?: { crit, fusion, channel } → variación de timbre/pitch (Tarea 1).
  // playWeaponSound(weapon) sigue funcionando (backwards compatible).
  function playWeaponSound(weapon, opts) {
    if (!NV.soundOn) return;
    opts = opts || {};
    const fus = opts.fusion > 0 ? 1 + opts.fusion * 0.05 : 1; // pitch ↑ +5% por nivel de fusión
    const vol = (opts.crit ? 1.15 : 1) * (opts.fusion ? 1 + opts.fusion * 0.03 : 1);
    switch (weapon.id) {
      case 'pistol': playToneEx(880, 0.08, 'square', 0.03 * vol, opts); break;
      case 'rifle': playToneEx(640, 0.07, 'square', 0.035 * vol, opts); break;
      case 'smg': playToneEx(990, 0.04, 'square', rapidFireVolume('smg', 0.028 * vol), opts); break;
      case 'shotgun': scheduleNoise(0.18, 0.07); playToneEx(170 * fus, 0.18, 'sawtooth', 0.09 * vol, opts); break;
      case 'sniper': playToneEx(110, 0.45, 'square', 0.11 * vol, opts); scheduleNoise(0.25, 0.05); break;
      case 'laser': playToneEx(1250, 0.12, 'sine', 0.045 * vol, opts); break;
      case 'plasma': playToneEx(720, 0.1, 'triangle', 0.05 * vol, opts); break;
      case 'flamethrower': scheduleNoise(0.14, 0.05); playToneEx(95 * fus, 0.13, 'sawtooth', 0.08 * vol, opts); break;
      case 'bow': playToneEx(430, 0.09, 'sine', 0.045 * vol, opts); break;
      case 'railgun': playToneEx(150 * fus, 0.5, 'sawtooth', rapidFireVolume('railgun', 0.12 * vol), opts); scheduleNoise(0.3, rapidFireVolume('railgun', 0.06)); break;
            default: playToneEx(880, 0.08, 'square', 0.03 * vol, opts);
    }
  }

  // Sonidos de ataque distintos para cada jefe
  sfx.bossAttack = {
    repeater: () => { scheduleNoise(0.04, 0.045); playTone(220, 0.05, 'square', 0.055); },
    heavy: () => { scheduleNoise(0.09, 0.07); playTone(100, 0.3, 'sawtooth', 0.11); },
    summon: () => { scheduleNoise(0.14, 0.06); playTone(75, 0.5, 'sawtooth', 0.11); },
    spread: () => playTone(330, 0.09, 'triangle', 0.07),
    beam: () => { scheduleNoise(0.55, 0.11); playTone(150, 0.7, 'sawtooth', 0.14); },
    volley: () => { playTone(440, 0.05, 'square', 0.05); playTone(880, 0.05, 'square', 0.045); },
    bomb: () => { scheduleNoise(0.22, 0.08); playTone(120, 0.45, 'sawtooth', 0.11); },
    orbs: () => playTone(660, 0.07, 'sine', 0.05),
    split: () => playTone(520, 0.1, 'triangle', 0.07),
    rage: () => { scheduleNoise(0.05, 0.06); playTone(190, 0.06, 'square', 0.07); },
  };

  // Exportar API pública
  NV.initAudio = initAudio;
  NV.updateMusic = updateMusic;
  NV.playWeaponSound = playWeaponSound;
  NV.playToneEx = playToneEx;
  NV.duck = duck;
  NV.channelFor = channelFor;
  NV.panForX = panForX;
  NV.setChannelVolume = setChannelVolume;
  NV.mixerChannels = CHANNELS;
  NV.masterVolume = MASTER_VOLUME;
  NV.sfx = sfx;
})();

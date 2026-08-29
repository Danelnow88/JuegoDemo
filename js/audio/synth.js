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
    bar: 0,          // contador de compases (16 steps) para quiebres/estructura
    groove: 0,       // preset de groove rotativo para breakbeats variados (Bloque 2)
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
  const CHANNELS = { music:0.45, sfxUI:0.7, sfxPlayer:1.0, sfxEnemies:0.8, sfxAmbient:0.6 };
  // Volubilidad maestra por canal (0..1), configurable futuro -> sliders.
  const MASTER_VOLUME = { music:1, sfxUI:1, sfxPlayer:1, sfxEnemies:1, sfxAmbient:1 };
  // EQ leve por canal para separar espectros y evitar enmascaramiento con disparos:
  //  - music:        lowpass → recorta agudos altos (banda del crack del disparo).
  //  - sfxPlayer:    highshelf/lowshelf → refuerza crack (agudo) y punch (grave).
  // Aplica sobre el canal completo (música de oleada vs. todos los SFX de jugador).
  const CHANNEL_EQ = {
    music: [{ type:'lowpass', freq:6200, q:0.7 }],
    sfxPlayer: [
      { type:'highshelf', freq:6000, gain:5 },
      { type:'lowshelf', freq:170, gain:4 },
    ],
  };

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
      let node = g;
      const eqs = CHANNEL_EQ[ch];
      if (eqs) {
        for (const spec of eqs) {
          const f = ctx.createBiquadFilter();
          f.type = spec.type;
          if (f.frequency) f.frequency.value = spec.freq;
          if (f.Q && spec.q != null) f.Q.value = spec.q;
          if (f.gain && spec.gain !== undefined) f.gain.value = spec.gain;
          node.connect(f);
          node = f;
        }
      }
      node.connect(ctx.destination);
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
  // === RUIDO PARA TIROS (Bloque 1: disparos realistas) ===
  // Crea buffer de ruido blanco o marrón (marrón = integración con fuga, espectro
  // más "rojo"/cuerpo, mucho menos silbante que el blanco puro).
  function createNoiseBuffer(dur, shape) {
    const len = Math.max(1, Math.floor(NV.audioCtx.sampleRate * dur));
    const buffer = NV.audioCtx.createBuffer(1, len, NV.audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    if (shape === 'brown') {
      let last = 0;
      for (let i = 0; i < len; i++) {
        const w = (Math.random() * 2 - 1);
        last = (last + 0.02 * w) / 1.02;
        let v = last * 3.5;
        if (v > 1) v = 1; else if (v < -1) v = -1;
        data[i] = v;
      }
    } else {
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
    }
    return buffer;
  }
  // Ruido filtrado con forma, filtro y canal configurables; soporta paneo.
  function scheduleFilteredNoise(dur, vol, opts) {
    if (!NV.audioCtx || !NV.soundOn) return;
    opts = opts || {};
    const shape = opts.shape || 'white';
    const durMs = Math.max(0.01, dur);
    const buffer = createNoiseBuffer(durMs, shape);
    const src = NV.audioCtx.createBufferSource();
    const filter = NV.audioCtx.createBiquadFilter();
    const gain = NV.audioCtx.createGain();
    src.buffer = buffer;
    filter.type = opts.filterType || 'lowpass';
    filter.frequency.setValueAtTime(opts.filterFreq || (shape === 'brown' ? 600 : 3000), NV.audioCtx.currentTime);
    if (opts.filterQ) filter.Q.value = opts.filterQ;
    gain.gain.setValueAtTime(vol || 0.04, NV.audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, NV.audioCtx.currentTime + durMs);
    src.connect(filter); filter.connect(gain);
    connectOutput(gain, opts.channel, opts);
    src.start(); src.stop(NV.audioCtx.currentTime + durMs + 0.01);
  }
  // Disparo procedural: crack (ruido blanco alto-pass abreviado) + cuerpo (marrón
  // bajo-pass) + punch (sine grave con caída de pitch). Sin samples, sin melódico.
  function playGunshot(cfg) {
    if (!NV.audioCtx || !NV.soundOn) return;
    cfg = cfg || {};
    const now = NV.audioCtx.currentTime;
    const base = { channel: cfg.channel, pan: cfg.pan, x: cfg.x, worldWidth: cfg.worldWidth };
    if (cfg.crack && cfg.crack.vol > 0) {
      scheduleFilteredNoise(cfg.crack.dur, cfg.crack.vol, {
        shape: cfg.crack.shape || 'white',
        filterType: 'highpass',
        filterFreq: cfg.crack.hp || 1000,
        ...base,
      });
    }
    if (cfg.body && cfg.body.vol > 0) {
      scheduleFilteredNoise(cfg.body.dur, cfg.body.vol, {
        shape: 'brown',
        filterType: 'lowpass',
        filterFreq: cfg.body.lp || 900,
        ...base,
      });
    }
    if (cfg.punch && cfg.punch.vol > 0) {
      const osc = NV.audioCtx.createOscillator();
      const g = NV.audioCtx.createGain();
      const f0 = cfg.punch.freq;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f0, now);
      osc.frequency.exponentialRampToValueAtTime(Math.max(28, f0 * 0.5), now + cfg.punch.dur);
      g.gain.setValueAtTime(cfg.punch.vol, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + cfg.punch.dur);
      osc.connect(g);
      connectOutput(g, cfg.channel, { pan: base.pan, x: base.x, worldWidth: base.worldWidth });
      osc.start(now); osc.stop(now + cfg.punch.dur + 0.01);
    }
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
  // === HELPERS DE MÚSICA (Bloque 2/3) ===
  // Nota con tiempo de arranque explícito (permite swing humano) y canal multicanal.
  function scheduleNoteAt(type, freq, dur, vol, at, channel) {
    if (!NV.audioCtx || !NV.soundOn) return;
    const ctx = NV.audioCtx;
    const t = (at == null) ? ctx.currentTime : at;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3000, t);
    gain.gain.setValueAtTime(vol || 0.03, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(filter); filter.connect(gain);
    connectOutput(gain, channel, {});
    osc.start(t); osc.stop(t + dur);
  }
  // Tambor con tiempo de arranque explícito (swing).
  function scheduleDrumAt(type, dur, vol, at) {
    if (!NV.audioCtx || !NV.soundOn) return;
    const ctx = NV.audioCtx;
    const t = (at == null) ? ctx.currentTime : at;
    if (type === 'noise') { scheduleNoiseDur(dur, vol, t); return; }
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(type === 'kick' ? 60 : 120, t);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(type === 'kick' ? 150 : 4000, t);
    gain.gain.setValueAtTime(vol || 0.04, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(filter); filter.connect(gain); gain.connect(channelFor('music'));
    osc.start(t); osc.stop(t + dur);
  }
  // Ruido blanco con tiempo de arranque explícito (reutiliza el buffer de scheduleNoise).
  function scheduleNoiseDur(dur, vol, at) {
    if (!NV.audioCtx || !NV.soundOn) return;
    const ctx = NV.audioCtx;
    const t = (at == null) ? ctx.currentTime : at;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
    const src = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    src.buffer = buffer;
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1500, t);
    gain.gain.setValueAtTime(vol || 0.04, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter); filter.connect(gain); gain.connect(channelFor('music'));
    src.start(t); src.stop(t + dur);
  }
  // Nota con textura sucia: 3 osciladores desintonizados + saturación por ganancia.
  function scheduleDirtyNote(freq, dur, vol, at, channel) {
    if (!NV.audioCtx || !NV.soundOn) return;
    const ctx = NV.audioCtx;
    const t = (at == null) ? ctx.currentTime : at;
    const inGain = ctx.createGain();
    const drive = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const out = ctx.createGain();
    drive.gain.value = 1.6;            // saturación suave (aprox. overdrive)
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2400, t);
    out.gain.setValueAtTime(vol || 0.04, t);
    out.gain.exponentialRampToValueAtTime(0.001, t + dur);
    for (const cents of [-6, 3, 8]) {  // detune leve → espesor/punk
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq * Math.pow(2, cents / 1200), t);
      osc.connect(inGain); osc.start(t); osc.stop(t + dur);
    }
    inGain.connect(drive); drive.connect(filter); filter.connect(out);
    connectOutput(out, channel, {});
  }
  // Acorde textural cálido/sucio: detune amplio + capa saw/triangle.
  function scheduleDirtyChord(freq, dur, vol, at, channel) {
    if (!NV.audioCtx || !NV.soundOn) return;
    const ctx = NV.audioCtx;
    const t = (at == null) ? ctx.currentTime : at;
    const inGain = ctx.createGain();
    const drive = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const out = ctx.createGain();
    drive.gain.value = 1.3;
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1800, t);
    out.gain.setValueAtTime(vol || 0.03, t);
    out.gain.exponentialRampToValueAtTime(0.001, t + dur);
    const defs = [['sawtooth', 0], ['sawtooth', 700], ['triangle', 1200]];
    for (const [ty, c] of defs) {
      const osc = ctx.createOscillator();
      osc.type = ty;
      osc.frequency.setValueAtTime(freq * Math.pow(2, c / 1200), t);
      osc.connect(inGain); osc.start(t); osc.stop(t + dur);
    }
    inGain.connect(drive); drive.connect(filter); filter.connect(out);
    connectOutput(out, channel, {});
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
      if (step === 0) NV.musicState.bar++;
      const phase = NV.musicState.phase;
      if (phase === 'normal') {
        scheduleNormalStep(step, stepDur, NV.musicState.intensity, comboLayer, layers);
      } else if (phase === 'boss') {
        scheduleBossStep(step, stepDur, NV.musicState.intensity, layers);
      } else if (phase === 'shop') {
        scheduleShopStep(step, stepDur, layers, comboLayer);
      } else {
        scheduleMenuStep(step, stepDur, layers, comboLayer);
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
  // === PROGRAMACIÓN POR FASE ===
  // Oleada NORMAL: breakbeat crudo con variación, textura sucia y estructura por intensidad (Bloque 2).
  function scheduleNormalStep(step, stepDur, intensity, comboLayer, layers) {
    if (!NV.audioCtx || !NV.soundOn) return;
    const now = NV.audioCtx.currentTime;
    const swing = (step % 2 === 1) ? stepDur * 0.18 : 0; // swing humano en fuera de beat
    const t = now + swing;
    const inten = intensity;
    // Rotar preset de groove cada compás → breakbeat NO fijo/repetitivo
    if (step === 0) NV.musicState.groove = Math.floor(Math.random() * 3);
    const groove = NV.musicState.groove || 0;

    // ---- Batería (D&B) ----
    if (step === 0 || step === 4 || step === 8 || step === 12) {
      if (Math.random() < 0.92) scheduleDrumAt('kick', 0.1, 0.1 + inten * 0.05, t);
    } else if (inten > 0.7 && (step === 6 || step === 14)) {
      scheduleDrumAt('kick', 0.06, 0.06, t + stepDur * 0.5); // doble 16th
    }
    if (step === 4 || step === 12) {
      scheduleDrumAt('noise', 0.15, 0.06 + inten * 0.035, t);
    } else if (inten > 0.6 && step === 8) {
      scheduleDrumAt('noise', 0.08, 0.04, t); // fill
    } else if (groove === 1 && step === 15) {
      scheduleDrumAt('noise', 0.18, 0.07, t); // roll tipo amen al cerrar compás
    }
    // Hi-hat: swing, acentos y open hat ocasional
    if (step % 2 === 0) {
      const open = inten > 0.5 && step % 8 === 6;
      const hatVol = open ? 0.032 : 0.014 + inten * 0.012 + (step % 8 === 0 ? 0.012 : 0);
      scheduleNoteAt('square', open ? 12000 : 8000 + (step % 3) * 3000, open ? 0.06 : 0.03, hatVol, t, 'music');
    }
    // ---- Bajo con saturación ----
    if (step % 2 === 0) {
      const b = layers.bass[Math.floor(step / 2) % layers.bass.length];
      if (b) scheduleDirtyNote(b, 0.32, 0.045 + inten * 0.025, t, 'music');
    }
    // ---- Acorde de textura sucia cada compás ----
    if (step % 4 === 0) {
      const root = layers.chordRoots[Math.floor(step / 4) % layers.chordRoots.length];
      scheduleDirtyChord(root * 2, 0.9, 0.02 + inten * 0.02, t, 'music');
    }
    // ---- Capa granular por combo ----
    if (comboLayer > 0.2 && step % 2 === 1) {
      const n = layers.lead[(step + Math.floor(comboLayer * 10)) % layers.lead.length] * 2;
      scheduleNoteAt('triangle', n, 0.05, 0.01 + comboLayer * 0.016, t, 'music');
    }
  }
  // Oleada de BOSS: mantiene la capa boss (patrones propios), ahora con textura sucia.
  function scheduleBossStep(step, stepDur, intensity, layers) {
    if (!NV.audioCtx || !NV.soundOn) return;
    const now = NV.audioCtx.currentTime;
    const t = now;
    if (layers.drums[0][step]) scheduleDrumAt('kick', 0.1, 0.1 + intensity * 0.05, t);
    if (layers.drums[1][step]) scheduleDrumAt('noise', 0.15, 0.06 + intensity * 0.03, t);
    if (layers.drums[2][step]) scheduleNoteAt('square', 8000 + (step % 3) * 3000, 0.03, 0.02 + intensity * 0.015, t, 'music');
    if (step % 4 === 0) {
      const b = layers.bass[Math.floor(step / 4) % layers.bass.length];
      if (b) scheduleDirtyNote(b, 0.2, 0.05 + intensity * 0.02, t, 'music');
    }
    if (step % 8 === 0 || (intensity > 0.7 && step % 4 === 0)) {
      const n = layers.lead[Math.floor(step / 2) % layers.lead.length];
      scheduleDirtyNote(n, 0.25, 0.04 + intensity * 0.02, t, 'music');
    }
  }
  // Acorde orgánico y cálido (tienda): triangle+sine detuned, lowpass cerrado, sin saturación.
  function scheduleWarmChord(freq, dur, vol, at, channel) {
    if (!NV.audioCtx || !NV.soundOn) return;
    const ctx = NV.audioCtx;
    const t = (at == null) ? ctx.currentTime : at;
    const inGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const out = ctx.createGain();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, t);
    out.gain.setValueAtTime(vol || 0.03, t);
    out.gain.exponentialRampToValueAtTime(0.001, t + dur);
    const defs = [['triangle', 0], ['sine', 0], ['triangle', 1200]];
    for (const [ty, c] of defs) {
      const osc = ctx.createOscillator();
      osc.type = ty;
      osc.frequency.setValueAtTime(freq * Math.pow(2, c / 1200), t);
      osc.connect(inGain); osc.start(t); osc.stop(t + dur);
    }
    inGain.connect(filter); filter.connect(out);
    connectOutput(out, channel, {});
  }
  // Tienda: estilo boom-bap (kick 1&3, clap 2&4) con swing, aire y acordes cálidos (Bloque 3).
  function scheduleShopStep(step, stepDur, layers, comboLayer) {
    if (!NV.audioCtx || !NV.soundOn) return;
    const now = NV.audioCtx.currentTime;
    const swing = (step % 8 === 2 || step % 8 === 6) ? stepDur * 0.22 : 0; // swing en off-beats (8ths)
    const t = now + swing;
    const bar = NV.musicState.bar || 0;
    // Boom-bap: kick en 1 y 3, clap/snare en 2 y 4 (no metronómico, con swing)
    if (step === 0 || step === 8) scheduleDrumAt('kick', 0.12, 0.1, t);
    if (step === 4 || step === 12) scheduleDrumAt('noise', 0.12, 0.058, t);
    // Hi-hat con swing y acento alterno (aire)
    if (step % 2 === 0) {
      const openHat = step % 16 === 14;
      const acc = (step === 0 || step === 8) ? 0.032 : 0.018;
      scheduleNoteAt('square', openHat ? 11000 : 7200, openHat ? 0.05 : 0.025, acc, t, 'music');
    }
    // Aire: solo un fill suave cada 4 compases, sin relleno constante
    if (bar % 4 === 3 && step === 14) scheduleDrumAt('noise', 0.14, 0.05, t);
    // Acordes cálidos/organicos cada compás
    if (step % 8 === 0) {
      const root = layers.chordRoots[Math.floor(step / 8) % layers.chordRoots.length];
      scheduleWarmChord(root * 2, 1.2, 0.04, t, 'music');
    }
    // Bajo con swing (sine cálido, relajado)
    if (step % 4 === 0) {
      const b = layers.bass[Math.floor(step / 4) % layers.bass.length];
      if (b) scheduleNoteAt('sine', b, 0.45, 0.03, t, 'music');
    }
    // Lead tibio y espaciado
    if (step % 16 === 4) {
      const n = layers.lead[Math.floor(step / 16) % layers.lead.length];
      scheduleNoteAt('triangle', n, 0.4, 0.028, t, 'music');
    }
  }
  // Menú/Tienda: placeholder genérico (Bloque 3 lo convierte en boom-bap cálido).
  function scheduleMenuStep(step, stepDur, layers, comboLayer) {
    if (!NV.audioCtx || !NV.soundOn) return;
    const now = NV.audioCtx.currentTime;
    const t = now;
    if (layers.drums[0][step]) scheduleDrumAt('kick', 0.1, 0.1, t);
    if (layers.drums[2][step]) scheduleNoteAt('square', 8000 + (step % 3) * 3000, 0.03, 0.02, t, 'music');
    if (step % 4 === 0) {
      const b = layers.bass[Math.floor(step / 4) % layers.bass.length];
      if (b) scheduleNoteAt('sine', b, 0.5, 0.025, t, 'music');
    }
    if (step % 8 === 0) {
      const n = layers.lead[Math.floor(step / 2) % layers.lead.length];
      scheduleNoteAt('sawtooth', n, 0.25, 0.04, t, 'music');
    }
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

  // Sonido distintivo por tipo de arma, por categoría (Bloque 1 rework de disparos):
  //  - realistas (pistol, rifle, smg, shotgun, sniper, flamethrower, railgun): tiro real,
  //    ruido (crack + cuerpo marrón) + punch grave, sin contenido melódico.
  //  - futuristas (laser, plasma): identidad synth/energética conservada + cuerpo ruidoso.
  //  - intermedio (bow): orgánico, casi sin crack, con cuerpo y punch suave.
  // opts?: { crit, fusion, channel, pan, x, worldWidth } → variación/paneo (Tarea 1/6).
  // playWeaponSound(weapon) sigue funcionando (backwards compatible).
  function playWeaponSound(weapon, opts) {
    if (!NV.soundOn) return;
    opts = opts || {};
    // Ducking de música por disparo: baja la música brevemente para que el tiro
    // no compita a volumen pleno. Duración según cadencia (rápidas= corto).
    if (weapon && NV.mixer) {
      const d = (weapon.id === 'sniper' || weapon.id === 'railgun') ? 0.28
        : (weapon.id === 'smg' ? 0.09 : (weapon.id === 'shotgun' ? 0.16 : 0.13));
      duck('music', 0.3, d);
    }
    const fus = opts.fusion > 0 ? 1 + opts.fusion * 0.05 : 1; // pitch ↑ +5% por nivel de fusión
    const vol = (opts.crit ? 1.15 : 1) * (opts.fusion ? 1 + opts.fusion * 0.03 : 1);
    const base = { channel: opts.channel, pan: opts.pan, x: opts.x, worldWidth: opts.worldWidth };
    switch (weapon.id) {
      // ---- REALISTAS: tiro real procedural ----
      case 'pistol':
        playGunshot({ ...base,
          crack: { dur: 0.014, vol: 0.075 * vol, hp: 1000 },
          body: { dur: 0.05, vol: 0.09 * vol, lp: 1100 },
          punch: { freq: 85 * fus, dur: 0.09, vol: 0.05 * vol },
        }); break;
      case 'rifle':
        playGunshot({ ...base,
          crack: { dur: 0.01, vol: 0.07 * vol, hp: 900 },
          body: { dur: 0.04, vol: 0.085 * vol, lp: 1000 },
          punch: { freq: 90 * fus, dur: 0.07, vol: 0.048 * vol },
        }); break;
      case 'smg':
        playGunshot({ ...base,
          crack: { dur: 0.008, vol: rapidFireVolume('smg', 0.05 * vol), hp: 1200 },
          body: { dur: 0.03, vol: rapidFireVolume('smg', 0.06 * vol), lp: 1200 },
          punch: { freq: 75 * fus, dur: 0.05, vol: rapidFireVolume('smg', 0.042 * vol) },
        }); break;
      case 'shotgun':
        playGunshot({ ...base,
          crack: { dur: 0.02, vol: 0.1 * vol, hp: 700 },
          body: { dur: 0.02, vol: 0.12 * vol, lp: 800 },
          punch: { freq: 55 * fus, dur: 0.18, vol: 0.1 * vol },
        }); break;
      case 'sniper':
        playGunshot({ ...base,
          crack: { dur: 0.008, vol: 0.09 * vol, hp: 800 },
          body: { dur: 0.12, vol: 0.1 * vol, lp: 600 },
          punch: { freq: 50 * fus, dur: 0.45, vol: 0.09 * vol },
        }); break;
      case 'flamethrower':
        playGunshot({ ...base,
          crack: { dur: 0.015, vol: 0.02 * vol, hp: 300 },
          body: { dur: 0.18, vol: 0.07 * vol, lp: 500 },
          punch: { freq: 65 * fus, dur: 0.12, vol: 0.04 * vol },
        }); break;
      case 'railgun':
        playGunshot({ ...base,
          crack: { dur: 0.02, vol: rapidFireVolume('railgun', 0.12 * vol), hp: 600 },
          body: { dur: 0.1, vol: rapidFireVolume('railgun', 0.1 * vol), lp: 700 },
          punch: { freq: 45 * fus, dur: 0.5, vol: rapidFireVolume('railgun', 0.1 * vol) },
        }); break;
      // ---- FUTURISTAS: identidad synth/energética + cuerpo ruidoso ----
      case 'laser':
        playToneEx(1250, 0.12, 'sine', 0.045 * vol, opts);
        scheduleFilteredNoise(0.02, 0.03 * vol, { shape: 'brown', filterType: 'lowpass', filterFreq: 1500, ...base });
        break;
      case 'plasma':
        playToneEx(720, 0.1, 'triangle', 0.05 * vol, opts);
        scheduleFilteredNoise(0.02, 0.03 * vol, { shape: 'brown', filterType: 'lowpass', filterFreq: 1400, ...base });
        break;
      // ---- INTERMEDIO: bow orgánico (cuerpo+punta, casi sin crack) ----
      case 'bow':
        playToneEx(430, 0.09, 'sine', 0.05 * vol, opts);
        scheduleFilteredNoise(0.025, 0.04 * vol, { shape: 'brown', filterType: 'lowpass', filterFreq: 1000, ...base });
        playGunshot({ ...base, punch: { freq: 120 * fus, dur: 0.06, vol: 0.03 * vol } });
        break;
      default:
        playGunshot({ ...base,
          crack: { dur: 0.014, vol: 0.07 * vol, hp: 1000 },
          body: { dur: 0.05, vol: 0.08 * vol, lp: 1000 },
          punch: { freq: 80 * fus, dur: 0.09, vol: 0.05 * vol },
        });
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

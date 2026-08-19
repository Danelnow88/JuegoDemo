// ===== AUDIO SYNTHWAVE + SFX =====
// Estado mutable en NV (soundOn/audioCtx/musicState/musicTime) y getters de game.js
// (getFrame/getBoss/getState) para valores que solo lee. Se carga ANTES de game.js.
(() => {
  'use strict';
  const NV = window.NV;

  NV.soundOn = true;
  NV.audioCtx = null;
  NV.musicState = { step: 0, lastBeat: 0, intensity: 0 };
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

  function initMusic() {
    if (!NV.audioCtx) NV.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  function initAudio() {
    initMusic();
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
    if (!NV.audioCtx || !NV.soundOn || NV.getState() !== 'playing') return;
    NV.musicTime += dt * (1 + NV.musicState.intensity * 0.6);
    const stepDur = 0.12;
    NV.musicState.intensity = Math.min(1, NV.musicState.intensity + (NV.getBoss() ? 0.02 : -0.015) * dt);
    if (NV.musicTime - NV.musicState.lastBeat >= stepDur) {
      NV.musicState.lastBeat = NV.musicTime;
      NV.musicState.step = (NV.musicState.step + 1) % 16;
      const step = NV.musicState.step;
      // Kick (808 punch)
      if (DRUM_PATTERN[0][step]) scheduleDrum('kick', 0.1, 0.1 + NV.musicState.intensity * 0.05);
      // Snare (808 clap)
      if (DRUM_PATTERN[1][step]) scheduleDrum('noise', 0.15, 0.06 + NV.musicState.intensity * 0.03);
      // Hi-hats
      if (DRUM_PATTERN[2][step]) scheduleNote('square', 8000 + (step % 3) * 3000, 0.03, 0.02 + NV.musicState.intensity * 0.015);
      // Bajo cada 4 steps (subby sawtooth)
      if (step % 4 === 0) {
        const bassIdx = Math.floor(step / 4) % BASS_LINE.length;
        scheduleNote('sawtooth', BASS_LINE[bassIdx], 0.2, 0.05 + NV.musicState.intensity * 0.02);
      }
      // Lead melódico (guitarra synth) → solo cada 8 steps
      if (step % 8 === 0 || (NV.musicState.intensity > 0.7 && step % 4 === 0)) {
        const note = LEAD_SEQ[Math.floor(step / 2) % LEAD_SEQ.length];
        scheduleNote('sawtooth', note, 0.25, 0.04 + NV.musicState.intensity * 0.02);
      }
    }
    // Drone atmosférico continuo (loop)
    if (NV.getFrame() % 120 === 0) {
      const droneFreq = CHORD_ROOTS[Math.floor(NV.getFrame() / 120) % CHORD_ROOTS.length] * 4;
      createDrone(droneFreq, NV.audioCtx.currentTime, 2.5);
    }
  }
  function playTone(freq, dur, type, vol) {
    if (!NV.audioCtx || !NV.soundOn) return;
    const osc = NV.audioCtx.createOscillator();
    const gain = NV.audioCtx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, NV.audioCtx.currentTime);
    gain.gain.setValueAtTime(vol || 0.03, NV.audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, NV.audioCtx.currentTime + dur);
    osc.connect(gain);
    gain.connect(NV.audioCtx.destination);
    osc.start();
    osc.stop(NV.audioCtx.currentTime + dur);
  }
  const sfx = {
    explosion: () => playTone(110, 0.25, 'sawtooth', 0.06),
    pickup: () => playTone(1320, 0.12, 'square', 0.04),
    damage: () => playTone(80, 0.15, 'square', 0.07),
    special: () => playTone(660, 0.4, 'triangle', 0.05),
    levelup: () => playTone(523, 0.1, 'square', 0.05),
    wave: () => playTone(440, 0.3, 'triangle', 0.06),
  };

  // Sonido distintivo por tipo de arma
  function playWeaponSound(weapon) {
    if (!NV.soundOn) return;
    switch (weapon.id) {
      case 'pistol': playTone(880, 0.08, 'square', 0.03); break;
      case 'rifle': playTone(640, 0.07, 'square', 0.035); break;
      case 'smg': playTone(990, 0.04, 'square', 0.028); break;
      case 'shotgun': scheduleNoise(0.18, 0.07); playTone(170, 0.18, 'sawtooth', 0.09); break;
      case 'sniper': playTone(110, 0.45, 'square', 0.11); scheduleNoise(0.25, 0.05); break;
      case 'laser': playTone(1250, 0.12, 'sine', 0.045); break;
      case 'plasma': playTone(720, 0.1, 'triangle', 0.05); break;
      case 'flamethrower': scheduleNoise(0.14, 0.05); playTone(95, 0.13, 'sawtooth', 0.08); break;
      case 'bow': playTone(430, 0.09, 'sine', 0.045); break;
      case 'railgun': playTone(150, 0.5, 'sawtooth', 0.12); scheduleNoise(0.3, 0.06); break;
            default: playTone(880, 0.08, 'square', 0.03);
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
  NV.sfx = sfx;
})();

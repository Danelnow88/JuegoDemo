// ===== ENGINE: hazards independientes (P3 Campo Minado) =====
// Speaker mines NO son enemies/bullets/pickups: no cuentan como hostile, kill,
// XP, shard, target de autofire ni condición de fin de wave.
(() => {
  'use strict';
  const NV = window.NV = window.NV || {};
  const TAU = Math.PI * 2;
  const FALLBACK_BPM = 114;

  function bal(key, fallback) {
    const b = NV.BALANCE || {};
    return b[key] == null ? fallback : b[key];
  }
  function aliveMineCount(hazards) {
    let n = 0;
    for (const h of hazards || []) if (h && h.type === 'speakerMine' && h.state !== 'dead') n++;
    return n;
  }
  function sectorFor(x, y, player) {
    let a = Math.atan2(y - player.y, x - player.x);
    if (a < 0) a += TAU;
    return Math.floor(a / (TAU / 8)) % 8;
  }
  function hasEscapeGap(occupied) {
    for (let i = 0; i < 8; i++) if (!occupied[i] && !occupied[(i + 1) % 8]) return true;
    return false;
  }

  NV.speakerMineDamage = function (wave) {
    const raw = bal('SPEAKER_MINE_DAMAGE_BASE', 38) + Math.max(0, wave || 0) * bal('SPEAKER_MINE_DAMAGE_PER_WAVE', 0.5);
    return Math.min(bal('SPEAKER_MINE_DAMAGE_CAP', 52), Math.round(raw));
  };

  // Metadata declarativa local. Los spawns guardan movementClass en la entidad;
  // el fallback evita un refactor masivo del roster y nunca deriva por nombre/id.
  NV.enemyMovementClass = function (entity) {
    if (!entity) return 'normal';
    if (entity.movementClass === 'slow' || entity.movementClass === 'fast' || entity.movementClass === 'normal') return entity.movementClass;
    if (entity.behavior === 'kami' || (entity.speed || 0) >= 150) return 'fast';
    if ((entity.speed || 0) <= 70) return 'slow';
    return 'normal';
  };
  NV.minefieldEnemySpeed = function (enemy, waveEvent) {
    const base = Math.max(0, enemy && enemy.speed || 0);
    if (waveEvent !== 'mines') return base;
    const mult = enemy && (enemy.isElite || enemy.hostileClass === 'heavy')
      ? bal('MINEFIELD_SPEED_ELITE', 1.10)
      : (NV.enemyMovementClass(enemy) === 'fast' ? bal('MINEFIELD_SPEED_FAST', 1.12) : bal('MINEFIELD_SPEED_NORMAL', 1.22));
    return Math.min(bal('MINEFIELD_SPEED_CAP', 260), base * mult);
  };

  NV.createMinefieldState = function () {
    return {
      spawnTimer: 0, serial: 0, spawned: 0, active: false,
      // P3.1.1: una sola base de groove compartida para todas las minas.
      grooveState: NV.createRhythmGrooveState ? NV.createRhythmGrooveState() : null,
      groove: null,
    };
  };
  NV.resetMinefieldState = function (state) {
    state = state || NV.createMinefieldState();
    state.spawnTimer = 0; state.serial = 0; state.spawned = 0; state.active = false;
    state.grooveState = NV.createRhythmGrooveState ? NV.createRhythmGrooveState() : null;
    state.groove = null;
    return state;
  };
  NV.clearHazards = function (hazards, state) {
    if (hazards) hazards.length = 0;
    if (state) NV.resetMinefieldState(state);
    // P3.1: las notas musicales decorativas no deben sobrevivir a una transición.
    if (NV.MUSICAL_NOTES) NV.MUSICAL_NOTES.length = 0;
    return hazards || [];
  };
  NV.speakerMineTargetCount = function (wave) {
    const initial = bal('SPEAKER_MINE_INITIAL_COUNT', 3);
    return Math.min(bal('MAX_SPEAKER_MINES', 6), initial + Math.floor(Math.max(0, (wave || 1) - 3) / 6));
  };

  // Placement acotado. Además de distancia/separación, usa 8 sectores y exige
  // conservar al menos dos sectores angulares contiguos libres cerca del jugador;
  // evita una corona completa sin pathfinding. P3.1 evalúa candidatos: el spawn
  // táctico prefiere interceptar la ruta futura, pero nunca relaja seguridad.
  NV.findSpeakerMinePosition = function (hazards, player, W, H, randomFn, tactical) {
    const rnd = typeof randomFn === 'function' ? randomFn : Math.random;
    const margin = bal('SPEAKER_MINE_ARENA_MARGIN', 42);
    const minPlayer = bal('SPEAKER_MINE_PLAYER_MIN_DIST', 175);
    const separation = bal('SPEAKER_MINE_SEPARATION', 105);
    const attempts = bal('SPEAKER_MINE_PLACEMENT_ATTEMPTS', 24);
    if (!player || W <= margin * 2 || H <= margin * 2) return null;

    const pred = NV.predictedPlayerPosition(player, bal('SPEAKER_MINE_PLAYER_PREDICTION', 0.65));
    // Dirección de marcha: los candidatos tácticos se sitúan por delante de la
    // posición predicha para interferir la ruta, no detrás del jugador.
    const baseAngle = Math.atan2(pred.y - player.y, pred.x - player.x);

    // Generador de candidatos:
    // - siempre una dosis de 'distribuido' (random uniform con seguridad)
    // - si se pidió táctico, genera candidatos alrededor de la posición futura predicha,
    //   priorizando interceptar rutas. 60-70% táctico según balance.TACTICAL_CHANCE.
    const wantTactical = tactical !== false && (tactical === true || rnd() < bal('SPEAKER_MINE_TACTICAL_CHANCE', 0.7));
    if (!wantTactical) {
      for (let attempt = 0; attempt < attempts; attempt++) {
        const x = margin + rnd() * (W - margin * 2);
        const y = margin + rnd() * (H - margin * 2);
        const pd = Math.hypot(x - player.x, y - player.y);
        if (pd < minPlayer) continue;
        if (passesSafety(hazards, player, x, y, separation, minPlayer)) return { x, y };
      }
      return null;
    }

    // Candidatos tácticos: anillos alrededor del punto predicho, sesgados hacia la
    // ruta. Se selecciona el score más alto entre candidatos seguros, no el primero.
    const radii = [minPlayer + 30, minPlayer + 75, minPlayer + 125];
    const r = radii.length;
    let best = null;
    let bestScore = -Infinity;
    const vx = player.moveVx || 0, vy = player.moveVy || 0;
    const vlen = Math.hypot(vx, vy);
    for (let attempt = 0; attempt < attempts; attempt++) {
      let x, y;
      const strategy = attempt % 3;
      if (strategy === 0) {
        // Interceptar ruta predicha
        const a = baseAngle + (rnd() - 0.5) * 1.0;
        const rr = radii[Math.floor(rnd() * r)];
        x = pred.x + Math.cos(a) * rr;
        y = pred.y + Math.sin(a) * rr;
      } else if (strategy === 1) {
        // Anillo angular alrededor del jugador, evitando el sector de escape
        const escapeSector = Math.atan2(player.y - pred.y, player.x - pred.x);
        const a = escapeSector + TAU * rnd();
        const rr = minPlayer + 20 + rnd() * 110;
        x = player.x + Math.cos(a) * rr;
        y = player.y + Math.sin(a) * rr;
      } else {
        // Distribuido de seguridad (fallback táctico)
        x = margin + rnd() * (W - margin * 2);
        y = margin + rnd() * (H - margin * 2);
      }
      // Borde de arena: los anillos tácticos pueden salir del margen; rechazarlos.
      if (x < margin || x > W - margin || y < margin || y > H - margin) continue;
      const pd = Math.hypot(x - player.x, y - player.y);
      if (pd < minPlayer) continue;
      if (!passesSafety(hazards, player, x, y, separation, minPlayer)) continue;
      // Cercanía al punto previsto y alineación delante del vector del jugador.
      // Cuando no hay movimiento, la parte direccional vale 0: sigue siendo seguro
      // y distribuido, sin inventar un rumbo.
      const pdPred = Math.hypot(x - pred.x, y - pred.y);
      const dx = x - player.x, dy = y - player.y;
      const ahead = vlen > 1 ? Math.max(-1, Math.min(1, (dx * vx + dy * vy) / (Math.hypot(dx, dy) * vlen))) : 0;
      const score = (260 - Math.min(260, pdPred)) + ahead * 95 - pd * 0.08;
      if (score > bestScore) { bestScore = score; best = { x, y, tactical: true, score }; }
    }
    if (best) return best;
    // Cada tercer candidato ya es distribuido. No se abre un segundo bucle: los
    // SPEAKER_MINE_PLACEMENT_ATTEMPTS son el límite total, incluso bajo presión.
    return null;
  };
  function passesSafety(hazards, player, x, y, separation, minPlayer) {
    let safe = true, nearCount = 0;
    const occupied = new Array(8).fill(false);
    for (const h of hazards || []) {
      if (!h || h.type !== 'speakerMine' || h.state === 'dead') continue;
      if (Math.hypot(x - h.x, y - h.y) < separation) { safe = false; break; }
      const hd = Math.hypot(h.x - player.x, h.y - player.y);
      if (hd < 340) { occupied[sectorFor(h.x, h.y, player)] = true; nearCount++; }
    }
    if (!safe) return false;
    if (nearCount >= 5 && Math.hypot(x - player.x, y - player.y) < 340) return false;
    if (Math.hypot(x - player.x, y - player.y) < 340) occupied[sectorFor(x, y, player)] = true;
    return hasEscapeGap(occupied);
  }
  NV.predictedPlayerPosition = function (player, prediction) {
    if (!player) return { x: 0, y: 0 };
    const t = Math.max(0, Math.min(2, prediction || 0));
    return { x: player.x + (player.moveVx || 0) * t, y: player.y + (player.moveVy || 0) * t };
  };

  NV.spawnSpeakerMine = function (hazards, state, ctx) {
    const max = bal('MAX_SPEAKER_MINES', 6);
    if (!hazards || aliveMineCount(hazards) >= max || !ctx || ctx.boss) return null;
    const pos = NV.findSpeakerMinePosition(hazards, ctx.player, ctx.W, ctx.H, ctx.random);
    if (!pos) return null;
    const serial = state ? state.serial++ : hazards.length;
    const musicNow = !!ctx.rhythm && ctx.rhythm.enabled && ctx.rhythm.active && ctx.rhythm.state === 'listening';
    const mine = {
      type: 'speakerMine', state: 'spawning', stateTime: 0, simTime: 0,
      x: pos.x, y: pos.y,
      visualRadius: bal('SPEAKER_MINE_VISUAL_RADIUS', 16),
      triggerRadius: bal('SPEAKER_MINE_TRIGGER_RADIUS', 14),
      phaseOffset: (serial * 2.399963229728653) % TAU,
      // P3.1: modo de groove explícito. La posición lógica x/y/radios NUNCA se alteran.
      grooveMode: musicNow ? 'music' : 'idle',
      grooveBlend: musicNow ? 1 : 0,
      // Solo transición idle/music por mina. El envelope musical es shared en
      // minefieldState.grooveState, no seis veces por frame.
      // Posición de aparición es bloqueada (telegraph lock): nunca se mueve tras spawn.
      spawnX: pos.x, spawnY: pos.y,
      // Estado de daño: la transición armed->detonating es única por diseño.
      damageApplied: false,
    };
    hazards.push(mine);
    if (state) state.spawned++;
    if (ctx.sfx && ctx.sfx.speakerMineArm) ctx.sfx.speakerMineArm({ x: mine.x, worldWidth: ctx.W || 900 });
    return mine;
  };

  // Transición estructural: solo ARMED puede entrar a DETONATING. Por eso dos
  // callbacks o múltiples frames superpuestos no pueden aplicar daño dos veces.
    NV.detonateSpeakerMine = function (mine, ctx) {
    if (!mine || mine.state !== 'armed') return false;
    mine.state = 'detonating'; mine.stateTime = 0; mine.damageApplied = true;
    // Squash violento muy corto + flash central (feedback inmediato del impacto).
    if (ctx && ctx.triggerFlash) ctx.triggerFlash('#ff3d8d');
    // Pipeline P0 de daño: una sola aplicación, sin crit/dodge, respeta invuln/armor.
    const hit = ctx && ctx.applyPlayerDamage
      ? ctx.applyPlayerDamage(NV.speakerMineDamage(ctx.wave), {
          cause: 'speaker-mine', hazard: mine, allowCrit: false, allowDodge: false,
        })
      : null;
    if (ctx) {
      if (ctx.spawnExplosion) ctx.spawnExplosion(mine.x, mine.y, 34, '#ff3d8d', 1.05);
      if (ctx.spawnShockwave) {
        ctx.spawnShockwave(mine.x, mine.y, { maxRadius: 105, color: '#ff4da6', width: 6 });
        ctx.spawnShockwave(mine.x, mine.y, { maxRadius: 70, color: '#ffd35a', width: 3, secondary: true });
      }
      // P3.1: notas musicales minimalistas tras la detonación. Decorativas: respetan el
      // visual budget y el tope global MAX_SPEAKER_MINE_MUSICAL_NOTES.
      if (typeof ctx.spawnMusicalNotes === 'function') ctx.spawnMusicalNotes(mine.x, mine.y, { rhythm: ctx.rhythm, policy: ctx.visualPolicy || (ctx.getVisualBudget ? ctx.getVisualBudget() : null) });
      if (ctx.sfx && ctx.sfx.speakerMineExplosion) ctx.sfx.speakerMineExplosion({ x: mine.x, worldWidth: ctx.W || 900 });
      if (typeof ctx.shake === 'number') ctx.shake = Math.max(ctx.shake, 0.65);
      if (hit && hit.killed && ctx.onPlayerKilled) ctx.onPlayerKilled(hit);
    }
    return true;
  };

    NV.updateSpeakerMines = function (dt, hazards, state, ctx) {
    hazards = hazards || [];
    state = state || NV.createMinefieldState();
    ctx = ctx || {};
    const active = ctx.waveEvent === 'mines' && !ctx.boss && !ctx.transitioning;
    state.active = active;
    // Fin de wave/shop/boss/evento distinto: desarmado silencioso. Nunca explota durante
    // una transición ni conserva una mina de la wave anterior.
    if (!active && (ctx.transitioning || ctx.waveEvent !== 'mines' || ctx.boss)) {
      hazards.length = 0;
      if (typeof ctx.clearMusicalNotes === 'function') ctx.clearMusicalNotes();
      return { hazards, state, shake: ctx.shake || 0 };
    }
    if (active) {
      const target = NV.speakerMineTargetCount(ctx.wave);
      const alive = aliveMineCount(hazards);
      const refillCadence = (ctx.wave >= bal('SPEAKER_MINE_REFILL_CADENCE_WAVE_THRESHOLD', 8))
        ? bal('SPEAKER_MINE_REFILL_CADENCE_P3_1', 2.6)
        : bal('SPEAKER_MINE_REFILL_CADENCE', 3.2);
      if (alive < target) state.spawnTimer -= dt;
      else state.spawnTimer = Math.max(state.spawnTimer, refillCadence);
      if (state.spawnTimer <= 0 && alive < target) {
        const mine = NV.spawnSpeakerMine(hazards, state, ctx);
        state.spawnTimer = state.spawned < bal('SPEAKER_MINE_INITIAL_COUNT', 3)
          ? bal('SPEAKER_MINE_INITIAL_CADENCE', 0.28)
          : refillCadence;
        if (!mine) state.spawnTimer = 0.4; // reintento acotado; nunca busy-loop
      }
    }

    const rhythm = ctx.rhythm;
    const musicNow = !!(rhythm && rhythm.enabled && rhythm.active && rhythm.state === 'listening');
    // Misma matemática que #rhythm-widget, calculada UNA vez por tick de hazards.
    // El estado queda en minefieldState, no en cada entidad ni en DOM.
    state.grooveState = state.grooveState || (NV.createRhythmGrooveState && NV.createRhythmGrooveState());
    state.groove = NV.computeRhythmGroove
      ? NV.computeRhythmGroove(state.grooveState, rhythm, dt, { connected: musicNow, idle: !musicNow, idleBpm: FALLBACK_BPM, idleEnergy: 0.18 })
      : null;
    NV.updateMusicalNotes(dt, ctx.musicalNotes || (ctx.musicalNotes = []));
    for (const mine of hazards) {
      if (!mine || mine.type !== 'speakerMine' || mine.state === 'dead') continue;
      mine.simTime += dt;
      mine.stateTime += dt;
      NV.updateGrooveMode(mine, musicNow, dt);

      // Telegraph de 0.9s: posición bloqueada, sin daño ni colisión activa.
      if (mine.state === 'spawning') {
        if (mine.stateTime >= bal('SPEAKER_MINE_TELEGRAPH_DURATION', 0.9)) {
          mine.state = 'armed'; mine.stateTime = 0;
        }
        continue;
      }
      if (mine.state === 'armed' && ctx.player) {
        const playerRadius = Math.max(1, ctx.playerRadius || 10);
        if (Math.hypot(ctx.player.x - mine.x, ctx.player.y - mine.y) <= mine.triggerRadius + playerRadius) {
          NV.detonateSpeakerMine(mine, ctx);
        }
      } else if (mine.state === 'detonating' && mine.stateTime >= bal('SPEAKER_MINE_DETONATE_TIME', 0.12)) {
        mine.state = 'dead';
      }
    }
    let w = 0;
    for (let i = 0; i < hazards.length; i++) if (hazards[i] && hazards[i].state !== 'dead') hazards[w++] = hazards[i];
    hazards.length = w;
    return { hazards, state, groove: state.groove, shake: ctx.shake || 0 };
  };

  // Pose 100% visual: jamás muta x/y/radios. Música activa usa phase/BPM de
  // NV.rhythm; fallback determinista a 114 BPM. Todas comparten BPM y difieren
  // solo por phaseOffset.
      NV.updateGrooveMode = function (mine, musicNow, dt) {
    if (!mine) return;
    mine.musicGrace = mine.musicGrace || 0;
    if (!mine.grooveMode) {
      mine.grooveMode = musicNow ? 'music' : 'idle';
      mine.grooveBlend = musicNow ? 1 : 0;
      return;
    }
    // Histeresis: al cortarse la captura, se mantiene el blend objetivo mientras
    // dura el grace (no flip-flop por peaks). El modo se deriva del blend (>0.5=music).
    let target = musicNow ? 1 : 0;
    if (!musicNow && (mine.grooveBlend || 0) > 0.5) {
      mine.musicGrace += dt;
      if (mine.musicGrace < bal('SPEAKER_MINE_GROOVE_HYSTERESIS_GRACE', 0.4)) target = 1; // hold
    } else {
      mine.musicGrace = 0;
    }
    const speed = target === 1
      ? (1 / Math.max(0.05, bal('SPEAKER_MINE_GROOVE_BLEND_IDLE_TO_MUSIC', 0.5)))
      : (1 / Math.max(0.05, bal('SPEAKER_MINE_GROOVE_BLEND_MUSIC_TO_IDLE', 0.35)));
    let b = mine.grooveBlend || 0;
    b += (target - b) * Math.min(1, speed * dt);
    b = Math.min(1, Math.max(0, b));
    mine.grooveBlend = b;
    mine.grooveMode = b > 0.5 ? 'music' : 'idle';
  };

  // Pose 100% visual: jamás muta x/y/radios. Ambos modos parten de una vida idle
  // lenta, de personaje; MUSIC añade groove continuo y el envelope percusivo que
  // comparte con #rhythm-widget. La escala queda deliberadamente al final.
  NV.speakerMinePose = function (mine, rhythm, groove) {
    const music = !!rhythm && rhythm.enabled && rhythm.active && rhythm.state === 'listening';
    // Fallback puro para renderer/tests aislados: no escribe state sobre la mina.
    // En producción llega `minefieldState.groove`, calculado una sola vez por tick.
    if (!groove) {
      const rawEnergy = music ? Math.max(0, Math.min(1, rhythm.energy || 0)) : 0.18;
      const rawPerc = music ? Math.max(rhythm.beat || 0, (rhythm.kick || 0) * 0.85, (rhythm.onset || 0) * 0.65) : 0;
      const rawPulse = Math.max(0, Math.min(1, rawPerc * 2.1));
      const bpmNow = music && Number.isFinite(rhythm.tempoBpm) ? rhythm.tempoBpm : FALLBACK_BPM;
      const phaseBase = music && Number.isFinite(rhythm._phase)
        ? rhythm._phase * TAU
        : (mine.simTime || 0) * (bpmNow / 60) * TAU;
      groove = {
        breathPhase: phaseBase,
        breath: 0.5 + 0.5 * Math.sin(phaseBase),
        curvedPulse: rawPulse * rawPulse * (3 - 2 * rawPulse),
        energyEnv: rawEnergy,
        smoothSkew: 4.2 * rawPulse,
      };
    }
    const phase = (groove.breathPhase || 0) + mine.phaseOffset;
    const B = Number.isFinite(mine.grooveBlend) ? mine.grooveBlend : (music ? 1 : 0);
    const pulseEnv = groove.pulseEnv || 0;
    const pulse = groove.curvedPulse || 0;
    const breath = groove.breath || 0;
    const energy = groove.energyEnv || 0;
    // Vida idle: ciclo de ~4.4 s, estable aunque no exista audio. El segundo término
    // introduce postura orgánica determinista, no un beat imaginario.
    const idlePhase = (mine.simTime || 0) * (TAU / 4.4) + mine.phaseOffset * 0.35;
    const idleWave = Math.sin(idlePhase);
    const posture = Math.sin(idlePhase * 0.47 + mine.phaseOffset * 0.8);
    const idleSway = idleWave * 1.55 + posture * 0.22;
    const idleBob = -0.20 + Math.sin(idlePhase - 0.82) * 0.45;
    const idleTilt = Math.sin(idlePhase - 0.48) * 0.034 + posture * 0.004;
    const idleFeet = -idleWave * 0.52 + posture * 0.10;
    const idleScaleX = 1 + Math.sin(idlePhase + 0.72) * 0.0035;
    const idleScaleY = 1 - Math.sin(idlePhase + 0.72) * 0.0030;
    const idleWoofer = 1.015 + (0.5 + 0.5 * Math.sin(idlePhase - 0.35)) * 0.020;

    // Groove conectado: la energía solo abre ligeramente la amplitud continua.
    // La personalidad rítmica dominante viene del attack/release de pulseEnv y su
    // smoothstep curvedPulse, exactamente las señales que animan #rhythm-widget.
    const musicWave = Math.sin(phase);
    const musicSway = musicWave * (5.6 + energy * 1.8);
    const musicBob = Math.sin(phase - 0.92) * (0.85 + energy * 0.45);
    const musicTilt = Math.sin(phase - 0.50) * (0.080 + energy * 0.020)
      + (groove.smoothSkew || 0) * Math.PI / 180 * 0.34;
    const musicFeet = -Math.sin(phase - 0.18) * (1.05 + energy * 0.35);

    // Gesto físico de percusión. En attack curvedPulse comprime hacia abajo; durante
    // release pulseEnv-curvedPulse genera una recuperación breve en sentido opuesto.
    const recovery = Math.max(0, pulseEnv - pulse);
    const plantedSide = Math.sign(musicWave || 1);
    const percSway = plantedSide * (pulse * 1.15 - recovery * 0.75);
    const percBob = pulse * 2.25 - recovery * 2.10;
    const percTilt = plantedSide * (pulse * 0.034 - recovery * 0.026);
    const percFeet = -plantedSide * (pulse * 0.70 - recovery * 0.45);

    const sway = idleSway + B * (musicSway + percSway);
    const bob = idleBob + B * (musicBob + percBob);
    const tilt = Math.max(-0.21, Math.min(0.21, idleTilt + B * (musicTilt + percTilt)));
    const feet = idleFeet + B * (musicFeet + percFeet);
    const woofer = idleWoofer + B * (0.025 + energy * 0.035 + pulse * 0.25);

    // Deformación corporal secundaria: rangos reales quedan muy dentro del contrato
    // scaleX 0.95..1.05 / scaleY 0.94..1.06 aun bajo un kick máximo.
    const scaleX = idleScaleX + B * (breath * 0.002 + pulse * 0.009);
    const scaleY = idleScaleY + B * (breath * 0.001 - pulse * 0.016 + recovery * 0.004);

    const mode = mine.grooveMode || (B > 0.5 ? 'music' : 'idle');
    return { phase, sway, bob, tilt, scaleX, scaleY, woofer, feet, grooveMode: mode, grooveBlend: B };
  };

  // --- P3.1: notas musicales minimalistas tras detonación (decorativas) ---
  // Las notas viven en un array manejado por game.js (ctx.musicalNotes); el array
  // global NV.MUSICAL_NOTES es fallback para tests/headless que no pasan ctx.
  NV.MUSICAL_NOTES = [];
  NV.spawnMusicalNotes = function (x, y, opts) {
    opts = opts || {};
    const notes = opts.notes || NV.MUSICAL_NOTES;
    const maxTotal = bal('SPEAKER_MINE_MAX_MUSICAL_NOTES', 24);
    if (notes.length >= maxTotal) return 0;
    const policy = opts.policy || null;
    let count;
    if (!policy || policy.tier === 'full') count = bal('SPEAKER_MINE_NOTE_COUNT_FULL', 7);
    else if (policy.tier === 'reduced') count = bal('SPEAKER_MINE_NOTE_COUNT_REDUCED', 5);
    else count = bal('SPEAKER_MINE_NOTE_COUNT_MINIMAL', 2);
    const room = maxTotal - notes.length;
    count = Math.min(count, room);
    if (count <= 0) return 0;
    const music = !!(opts.rhythm && opts.rhythm.enabled && opts.rhythm.active && opts.rhythm.state === 'listening');
    // Energía/bass pueden modular velocidad inicial, con clamp estricto (nunca counts).
    const kickMul = music ? (1 + Math.max(0, Math.min(0.45, (opts.rhythm.kick || 0) + (opts.rhythm.bass || 0) * 0.5))) : 1;
    const colors = ['#00f0ff', '#ff00e5', '#d100ff', '#ffae00'];
    let spawned = 0;
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI / 2.2 + (i - (count - 1) / 2) * 0.42 + (i * 0.37);
      const speed = (42 + i * 9) * kickMul;
      notes.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        rot: i * 0.6, vrot: 0.9 + i * 0.35,
        life: 0, maxLife: 0.65 + i * 0.06,
        hue: colors[i % colors.length],
        size: 4.2 + i * 0.4,
        type: i % 3 === 0 ? 'single' : (i % 3 === 1 ? 'eighth' : 'flagged'),
      });
      spawned++;
    }
    return spawned;
  };
  NV.updateMusicalNotes = function (dt, notes) {
    if (!notes) return;
    let w = 0;
    for (let i = 0; i < notes.length; i++) {
      const n = notes[i];
      if (!n) continue;
      n.life += dt;
      if (n.life >= n.maxLife) continue;
      n.x += n.vx * dt; n.y += n.vy * dt;
      n.vy += 30 * dt; // gravedad ligera: arco ascendente
      n.rot += n.vrot * dt;
      n.alpha = 1 - n.life / n.maxLife;
      notes[w++] = n;
    }
    notes.length = w;
  };
  NV.clearMusicalNotes = function (notes) {
    if (notes) notes.length = 0;
    else NV.MUSICAL_NOTES.length = 0;
    return NV.MUSICAL_NOTES;
  };
})();
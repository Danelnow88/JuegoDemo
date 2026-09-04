// ===== RENDER: enemigos espectrales Canvas2D =====
(() => {
  'use strict';
  const NV = window.NV;
  const PROFILES = {
    drone: { body: '#b5c6ff', core: '#e8edff', glow: '#9bb0ff', spikes: 4, innerRatio: 0.62, spikeLen: 0.32, pulseRate: 0.9, pulseAmt: 0.06, particles: 3, particleSize: 0.5, eyeStyle: 'round', radiusMul: 1.0 },
    runner: { body: '#4dd6ff', core: '#d4f7ff', glow: '#7de8ff', spikes: 3, innerRatio: 0.5, spikeLen: 0.55, pulseRate: 2.4, pulseAmt: 0.04, particles: 2, particleSize: 0.35, eyeStyle: 'narrow', radiusMul: 1.05, stretch: 1.25 },
    tank: { body: '#9b8cff', core: '#e0d9ff', glow: '#b8a8ff', spikes: 6, innerRatio: 0.78, spikeLen: 0.22, pulseRate: 0.55, pulseAmt: 0.05, particles: 5, particleSize: 0.6, eyeStyle: 'deep', radiusMul: 1.1 },
    shielder: { body: '#5fffa0', core: '#caffebf', glow: '#8fffc0', spikes: 8, innerRatio: 0.7, spikeLen: 0.18, pulseRate: 1.0, pulseAmt: 0.05, particles: 4, particleSize: 0.45, eyeStyle: 'round', radiusMul: 1.05 },
    swarmlet: { body: '#22d3ee', core: '#baf7ff', glow: '#67e8f9', spikes: 4, innerRatio: 0.55, spikeLen: 0.28, pulseRate: 1.8, pulseAmt: 0.05, particles: 3, particleSize: 0.3, eyeStyle: 'single', radiusMul: 0.9 },
    spitter: { body: '#ff8c42', core: '#ffd4a8', glow: '#ffb066', spikes: 6, innerRatio: 0.6, spikeLen: 0.3, pulseRate: 1.1, pulseAmt: 0.06, particles: 4, particleSize: 0.45, eyeStyle: 'round', radiusMul: 1.0 },
    wisp: { body: '#d56fff', core: '#f0d4ff', glow: '#e0a8ff', spikes: 7, innerRatio: 0.66, spikeLen: 0.4, pulseRate: 1.6, pulseAmt: 0.1, particles: 5, particleSize: 0.4, eyeStyle: 'asymmetric', radiusMul: 0.85 },
    kamikaze: { body: '#ff5f3d', core: '#ffd4c2', glow: '#ff8a5f', spikes: 5, innerRatio: 0.5, spikeLen: 0.6, pulseRate: 3.2, pulseAmt: 0.08, particles: 6, particleSize: 0.5, eyeStyle: 'narrow', radiusMul: 1.0 },
    boss_minion: { body: '#9bb5ff', core: '#dde6ff', glow: '#b8c8ff', spikes: 4, innerRatio: 0.6, spikeLen: 0.3, pulseRate: 1.2, pulseAmt: 0.05, particles: 2, particleSize: 0.35, eyeStyle: 'round', radiusMul: 0.9 },
    specter_grunt: { body: '#d8f6ff', core: '#ffffff', glow: '#b8efff', spikes: 4, innerRatio: 0.62, spikeLen: 0.28, pulseRate: 1.1, pulseAmt: 0.06, particles: 3, particleSize: 0.4, eyeStyle: 'round', radiusMul: 1.0 },
    specter_archer: { body: '#ffb24a', core: '#ffe0a8', glow: '#ffc76a', spikes: 6, innerRatio: 0.58, spikeLen: 0.34, pulseRate: 1.3, pulseAmt: 0.06, particles: 4, particleSize: 0.45, eyeStyle: 'narrow', radiusMul: 1.0, cannonGlow: true },
    specter_guard: { body: '#67f8c8', core: '#d8fff2', glow: '#8dffe0', spikes: 6, innerRatio: 0.74, spikeLen: 0.22, pulseRate: 0.75, pulseAmt: 0.05, particles: 5, particleSize: 0.55, eyeStyle: 'deep', radiusMul: 1.1, shieldAura: true },
  };
  // Visual aprobado en previews/enemy-visual-lab.html: seis variantes de fantasma
  // negro con ojos-runa rojos y cola viva. Se aplica SOLO a los seis enemigos
  // espectrales nuevos; no cambia datos, IA, daño, vida, velocidad ni spawn.
  const LAB_SPECTER_IDS = {
    specter_grunt: 0,
    specter_archer: 1,
    specter_guard: 2,
    specter_elite_swift: 3,
    specter_elite_wrath: 4,
    specter_elite_void: 5,
  };
  const LAB_POSES = [
    { body:[1.00,.96], tilt:-.10, head:1.00, mouth:0, eye:.92, eyeStyle:0, tailLen:1.00, tailDir:-1, tailAmp:.54, eyeAng:.03, eyeSep:22, eyeY:-31, mouthY:7 },
    { body:[.94,1.00], tilt:.08,  head:.94, mouth:1, eye:.86, eyeStyle:1, tailLen:.96, tailDir: 1, tailAmp:.42, eyeAng:.02, eyeSep:21, eyeY:-30, mouthY:6 },
    { body:[1.04,.98], tilt:.05,  head:1.02, mouth:0, eye:.96, eyeStyle:2, tailLen:1.06, tailDir: 1, tailAmp:.58, eyeAng:.02, eyeSep:23, eyeY:-32, mouthY:8 },
    { body:[1.06,.96], tilt:-.16, head:1.04, mouth:2, eye:.90, eyeStyle:3, tailLen:.98, tailDir:-1, tailAmp:.50, eyeAng:.03, eyeSep:22, eyeY:-30, mouthY:7 },
    { body:[.98,1.04], tilt:.14,  head:.96, mouth:3, eye:.88, eyeStyle:4, tailLen:1.02, tailDir: 1, tailAmp:.46, eyeAng:.02, eyeSep:21, eyeY:-29, mouthY:8 },
    { body:[1.05,.95], tilt:-.03, head:1.05, eye:.94, mouth:1, eyeStyle:5, tailLen:1.10, tailDir:-1, tailAmp:.60, eyeAng:.03, eyeSep:23, eyeY:-31, mouthY:6 }
  ];
  // Perfiles élite diferenciados por visualId. Mantienen la identidad cromática del
  // élite original pero con estética espectral: halos, spikes reforzados y ojos únicos.
  const ELITE_PROFILES = {
    elite_base:    { body: '#ffe24a', core: '#fffbe0', glow: '#fff08a', spikes: 6, innerRatio: 0.72, spikeLen: 0.28, pulseRate: 1.3, pulseAmt: 0.06, particles: 4, particleSize: 0.55, eyeStyle: 'deep', radiusMul: 1.15, haloColor: '#ffd700', haloWidth: 2.5, haloPulse: 0.12 },
    elite_velocity:{ body: '#4dffba', core: '#caffe8', glow: '#7dffc8', spikes: 3, innerRatio: 0.45, spikeLen: 0.7, pulseRate: 3.0, pulseAmt: 0.05, particles: 3, particleSize: 0.4, eyeStyle: 'narrow', radiusMul: 1.1, stretch: 1.4, haloColor: '#00ffaa', haloWidth: 2, haloPulse: 0.18, trailEffect: true },
    elite_bulwark: { body: '#ff9a3d', core: '#ffd9b0', glow: '#ffb866', spikes: 10, innerRatio: 0.82, spikeLen: 0.25, pulseRate: 0.6, pulseAmt: 0.04, particles: 6, particleSize: 0.65, eyeStyle: 'deep', radiusMul: 1.2, haloColor: '#ff8c00', haloWidth: 3, haloPulse: 0.08, armorRing: true },
    elite_predator:{ body: '#f055ff', core: '#f0c8ff', glow: '#e080ff', spikes: 5, innerRatio: 0.55, spikeLen: 0.5, pulseRate: 2.2, pulseAmt: 0.07, particles: 3, particleSize: 0.4, eyeStyle: 'asymmetric', radiusMul: 1.05, haloColor: '#dd00ff', haloWidth: 2, haloPulse: 0.15, feralEyes: true },
    elite_phantom: { body: '#a0f0ff', core: '#e0ffff', glow: '#c0f0ff', spikes: 6, innerRatio: 0.65, spikeLen: 0.35, pulseRate: 1.4, pulseAmt: 0.12, particles: 7, particleSize: 0.35, eyeStyle: 'single', radiusMul: 1.0, haloColor: '#80f0ff', haloWidth: 2.5, haloPulse: 0.1, ghostly: true },
    elite_chaos:   { body: '#ff5a30', core: '#ffb890', glow: '#ff8060', spikes: 9, innerRatio: 0.6, spikeLen: 0.45, pulseRate: 2.8, pulseAmt: 0.09, particles: 8, particleSize: 0.5, eyeStyle: 'asymmetric', radiusMul: 1.1, haloColor: '#ff4500', haloWidth: 3, haloPulse: 0.2, chaotic: true },
    elite_titan:   { body: '#ff3570', core: '#ffa0b8', glow: '#ff6088', spikes: 8, innerRatio: 0.75, spikeLen: 0.35, pulseRate: 0.4, pulseAmt: 0.04, particles: 8, particleSize: 0.7, eyeStyle: 'deep', radiusMul: 1.25, haloColor: '#ff1493', haloWidth: 3.5, haloPulse: 0.06, massive: true },
    elite_swift:   { body: '#80ff50', core: '#d0ffb0', glow: '#a0ff70', spikes: 2, innerRatio: 0.4, spikeLen: 0.6, pulseRate: 4.0, pulseAmt: 0.04, particles: 2, particleSize: 0.3, eyeStyle: 'narrow', radiusMul: 1.0, stretch: 1.6, haloColor: '#00ff44', haloWidth: 1.5, haloPulse: 0.22, ultraTrail: true },
    elite_specter_swift: { body: '#55f6ff', core: '#d8fbff', glow: '#8cfaff', spikes: 4, innerRatio: 0.42, spikeLen: 0.85, pulseRate: 3.4, pulseAmt: 0.05, particles: 4, particleSize: 0.35, eyeStyle: 'narrow', radiusMul: 1.05, stretch: 1.65, haloColor: '#55f6ff', haloWidth: 2, haloPulse: 0.2, trailEffect: true, doubleAura: true },
    elite_specter_wrath: { body: '#ff3ccf', core: '#ffd0f2', glow: '#ff78dd', spikes: 8, innerRatio: 0.7, spikeLen: 0.45, pulseRate: 1.7, pulseAmt: 0.09, particles: 7, particleSize: 0.6, eyeStyle: 'deep', radiusMul: 1.2, haloColor: '#ff3ccf', haloWidth: 3, haloPulse: 0.16, crown: true, intenseGlow: true },
    elite_specter_void: { body: '#9b4dff', core: '#1a001f', glow: '#c040ff', spikes: 7, innerRatio: 0.62, spikeLen: 0.5, pulseRate: 1.6, pulseAmt: 0.1, particles: 8, particleSize: 0.45, eyeStyle: 'single', radiusMul: 1.15, haloColor: '#c040ff', haloWidth: 2.5, haloPulse: 0.14, voidCore: true, phaseEffect: true },
  };
  // Visual de raid bosses espectrales aprobado en previews/enemy-visual-lab.html.
  // Se aplica a los 8 élites base cuando SPECTRAL_ENEMY_MODE esta activo.
  // No toca datos, IA, dano, vida, velocidad ni spawn: solo silueta, coronas,
  // mantos, sigilos, halos y colas jerarquicas.
  const ELITE_BOSS_POSES = {
    elite_base:    { body:[1.10,1.02], tilt:-.09, head:1.12, mouth:1, eye:1.02, eyeStyle:6,  tailLen:1.20, tailDir:-1, tailAmp:.70, eyeAng:.04, eyeSep:25, eyeY:-34, mouthY:7,  sigil:0, aura:1.24, shoulder:1.00, waist:.84, root:.62, crown:0, mantle:0, halo:0, tailMode:0 },
    elite_velocity:{ body:[1.06,1.10], tilt:.08,  head:1.06, mouth:2, eye:.98, eyeStyle:7,  tailLen:1.28, tailDir: 1, tailAmp:.64, eyeAng:.04, eyeSep:24, eyeY:-33, mouthY:8,  sigil:1, aura:1.18, shoulder:1.18, waist:.82, root:.58, crown:1, mantle:1, halo:1, tailMode:1 },
    elite_bulwark: { body:[1.14,.98], tilt:.04,  head:1.10, mouth:0, eye:1.06, eyeStyle:8,  tailLen:1.18, tailDir: 1, tailAmp:.78, eyeAng:.03, eyeSep:26, eyeY:-35, mouthY:8,  sigil:2, aura:1.26, shoulder:1.04, waist:.76, root:.52, crown:2, mantle:2, halo:2, tailMode:2 },
    elite_predator:{ body:[1.08,1.12], tilt:-.15, head:1.08, mouth:3, eye:1.00, eyeStyle:9,  tailLen:1.24, tailDir:-1, tailAmp:.68, eyeAng:.05, eyeSep:24, eyeY:-33, mouthY:9,  sigil:3, aura:1.22, shoulder:1.20, waist:.88, root:.64, crown:3, mantle:3, halo:3, tailMode:3 },
    elite_phantom: { body:[1.02,1.08], tilt:.14,  head:1.04, mouth:1, eye:.96, eyeStyle:10, tailLen:1.30, tailDir: 1, tailAmp:.74, eyeAng:.04, eyeSep:24, eyeY:-32, mouthY:7,  sigil:4, aura:1.20, shoulder:.96, waist:.72, root:.48, crown:4, mantle:4, halo:4, tailMode:4 },
    elite_chaos:   { body:[1.18,1.00], tilt:-.04, head:1.14, mouth:2, eye:1.08, eyeStyle:11, tailLen:1.26, tailDir:-1, tailAmp:.82, eyeAng:.04, eyeSep:27, eyeY:-35, mouthY:8,  sigil:5, aura:1.30, shoulder:1.26, waist:.90, root:.66, crown:5, mantle:5, halo:5, tailMode:5 },
    elite_titan:   { body:[1.20,1.04], tilt:-.06, head:1.16, mouth:0, eye:1.10, eyeStyle:6,  tailLen:1.32, tailDir:-1, tailAmp:.88, eyeAng:.05, eyeSep:28, eyeY:-36, mouthY:9,  sigil:0, aura:1.34, shoulder:1.30, waist:.92, root:.68, crown:1, mantle:3, halo:4, tailMode:2 },
    elite_swift:   { body:[1.04,1.12], tilt:.10,  head:1.05, mouth:2, eye:.94, eyeStyle:7,  tailLen:1.22, tailDir: 1, tailAmp:.60, eyeAng:.03, eyeSep:23, eyeY:-32, mouthY:7,  sigil:1, aura:1.16, shoulder:1.10, waist:.78, root:.54, crown:2, mantle:1, halo:5, tailMode:1 }
  };
  // Perfiles boss espectrales. Cada jefe tiene identidad visual única: aura masiva,
  // spikes grandes, ojos imponentes y partículas orbitales abundantes.
  const BOSS_PROFILES = {
    boss_jefe:      { body: '#ff5f9b', core: '#ffd0e0', glow: '#ff8ab8', spikes: 8, innerRatio: 0.8, spikeLen: 0.35, pulseRate: 0.8, pulseAmt: 0.06, particles: 8, particleSize: 0.7, eyeStyle: 'deep', radiusMul: 1.3, auraRadius: 2.2, auraAlpha: 0.25, ringCount: 2 },
    boss_titan:     { body: '#ff8c00', core: '#ffd9a0', glow: '#ffb060', spikes: 10, innerRatio: 0.85, spikeLen: 0.4, pulseRate: 0.5, pulseAmt: 0.05, particles: 10, particleSize: 0.8, eyeStyle: 'deep', radiusMul: 1.35, auraRadius: 2.4, auraAlpha: 0.3, ringCount: 3 },
    boss_vacio:     { body: '#dc143c', core: '#ff8090', glow: '#ff4060', spikes: 7, innerRatio: 0.75, spikeLen: 0.5, pulseRate: 1.2, pulseAmt: 0.1, particles: 12, particleSize: 0.5, eyeStyle: 'single', radiusMul: 1.25, auraRadius: 2.5, auraAlpha: 0.35, voidEffect: true },
    boss_guardian:  { body: '#00bfff', core: '#a0e8ff', glow: '#60d0ff', spikes: 9, innerRatio: 0.82, spikeLen: 0.3, pulseRate: 1.0, pulseAmt: 0.05, particles: 9, particleSize: 0.65, eyeStyle: 'round', radiusMul: 1.3, auraRadius: 2.3, auraAlpha: 0.25, shieldRing: true },
    boss_destructor:{ body: '#ff0000', core: '#ff8080', glow: '#ff4040', spikes: 11, innerRatio: 0.78, spikeLen: 0.45, pulseRate: 1.5, pulseAmt: 0.08, particles: 11, particleSize: 0.75, eyeStyle: 'narrow', radiusMul: 1.4, auraRadius: 2.6, auraAlpha: 0.3, aggressive: true },
    boss_nemesis:   { body: '#8b00ff', core: '#d0a0ff', glow: '#b060ff', spikes: 6, innerRatio: 0.7, spikeLen: 0.55, pulseRate: 1.8, pulseAmt: 0.07, particles: 8, particleSize: 0.55, eyeStyle: 'asymmetric', radiusMul: 1.25, auraRadius: 2.2, auraAlpha: 0.28, phaseEffect: true },
    boss_coloso:    { body: '#ff4500', core: '#ffb090', glow: '#ff7040', spikes: 12, innerRatio: 0.88, spikeLen: 0.35, pulseRate: 0.35, pulseAmt: 0.04, particles: 14, particleSize: 0.9, eyeStyle: 'deep', radiusMul: 1.5, auraRadius: 2.8, auraAlpha: 0.3, massive: true },
    boss_fantasma:  { body: '#e0ffff', core: '#f0ffff', glow: '#c0f0ff', spikes: 6, innerRatio: 0.72, spikeLen: 0.5, pulseRate: 1.6, pulseAmt: 0.12, particles: 10, particleSize: 0.45, eyeStyle: 'single', radiusMul: 1.2, auraRadius: 2.3, auraAlpha: 0.2, ghostly: true },
    boss_mutante:   { body: '#32cd32', core: '#a0ffa0', glow: '#60ff60', spikes: 9, innerRatio: 0.76, spikeLen: 0.4, pulseRate: 1.3, pulseAmt: 0.07, particles: 10, particleSize: 0.6, eyeStyle: 'asymmetric', radiusMul: 1.3, auraRadius: 2.4, auraAlpha: 0.25, mutateEffect: true },
    boss_apocalipsis:{ body: '#ff1493', core: '#ffa0d0', glow: '#ff50a0', spikes: 14, innerRatio: 0.85, spikeLen: 0.5, pulseRate: 0.6, pulseAmt: 0.06, particles: 16, particleSize: 0.85, eyeStyle: 'deep', radiusMul: 1.5, auraRadius: 3.0, auraAlpha: 0.35, rageEffect: true },
  };
  function hash01(e, salt) {
    const v = Math.sin((e.x || 0) * 12.9898 + (e.y || 0) * 78.233 + (e.radius || 1) * 37.719 + salt * 43.1234) * 43758.5453;
    return v - Math.floor(v);
  }
  function hexToRgb(hex) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgba(rgb, a) { return 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + a + ')'; }
  function resolveProfile(e) {
    if (e.isElite) {
      const vid = e.visualId || 'elite_base';
      const ep = ELITE_PROFILES[vid] || ELITE_PROFILES.elite_base;
      const base = PROFILES[e.enemyTypeId] || PROFILES.drone;
      return Object.assign({}, base, ep, { elite: true, eliteVisualId: vid });
    }
    return PROFILES[e.enemyTypeId] || PROFILES.drone;
  }
  function drawBody(ctx, e, frame, profile) {
    const r = e.radius * (profile.radiusMul || 1);
    const time = frame * 0.06;
    const pulse = 1 + Math.sin(time * (profile.pulseRate || 1)) * (profile.pulseAmt || 0.05);
    const glowR = r * 1.9;
    const grd = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, glowR);
    grd.addColorStop(0, rgba(hexToRgb(profile.glow), 0.28));
    grd.addColorStop(0.5, rgba(hexToRgb(profile.glow), 0.1));
    grd.addColorStop(1, rgba(hexToRgb(profile.glow), 0));
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(0, 0, glowR, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    if (profile.stretch) ctx.scale(profile.stretch, 1);
    ctx.fillStyle = rgba(hexToRgb(profile.body), 0.85);
    const spikes = profile.spikes;
    const innerR = r * (profile.innerRatio || 0.6);
    const spikeLen = r * (profile.spikeLen || 0.3);
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const a = (i / (spikes * 2)) * Math.PI * 2 + hash01(e, i) * 0.2;
      const isPeak = i % 2 === 0;
      const rad = isPeak ? (innerR + spikeLen) * pulse : innerR * 0.95;
      if (i === 0) ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
      else ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
    }
    ctx.closePath(); ctx.fill();
    ctx.restore();
    const bodyRgb = hexToRgb(profile.body);
    ctx.fillStyle = rgba(bodyRgb, 0.7);
    for (let i = 0; i < (profile.particles || 0); i++) {
      const seed = hash01(e, 100 + i);
      const orbitR = r * (1.3 + seed * 0.6);
      const a = time * (0.3 + seed * 0.5) + seed * Math.PI * 2;
      ctx.beginPath(); ctx.arc(Math.cos(a) * orbitR, Math.sin(a) * orbitR, (profile.particleSize || 0.4) * (0.5 + seed), 0, Math.PI * 2); ctx.fill();
    }
  }
  function drawEyes(ctx, e, player, profile) {
    if (!player) return;
    const r = e.radius * (profile.radiusMul || 1);
    const fwd = Math.atan2(player.y - e.y, player.x - e.x);
    const eyeR = Math.max(1.4, r * 0.17);
    const sep = r * 0.32;
    const pupil = profile.elite ? '#ff2222' : '#10131c';
    if (profile.eyeStyle === 'single') {
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, eyeR, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = pupil; ctx.beginPath(); ctx.arc(Math.cos(fwd) * eyeR * 0.4, Math.sin(fwd) * eyeR * 0.4, eyeR * 0.5, 0, Math.PI * 2); ctx.fill();
    } else if (profile.eyeStyle === 'narrow') {
      for (const side of [-1, 1]) {
        const ex = side * sep * 0.45, ey = -r * 0.08;
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(ex, ey, eyeR * 0.7, eyeR * 0.45, fwd, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = pupil; ctx.beginPath(); ctx.arc(ex + Math.cos(fwd) * eyeR * 0.3, ey + Math.sin(fwd) * eyeR * 0.3, eyeR * 0.3, 0, Math.PI * 2); ctx.fill();
      }
    } else if (profile.eyeStyle === 'asymmetric') {
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(-sep * 0.3, -r * 0.05, eyeR * 0.8, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(sep * 0.4, -r * 0.02, eyeR * 1.0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = pupil;
      ctx.beginPath(); ctx.arc(-sep * 0.3 + Math.cos(fwd) * eyeR * 0.3, -r * 0.05 + Math.sin(fwd) * eyeR * 0.3, eyeR * 0.35, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(sep * 0.4 + Math.cos(fwd) * eyeR * 0.4, -r * 0.02 + Math.sin(fwd) * eyeR * 0.4, eyeR * 0.45, 0, Math.PI * 2); ctx.fill();
    } else {
      for (const side of [-1, 1]) {
        const ex = side * sep * 0.5, ey = -r * 0.05;
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex, ey, eyeR, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = pupil; ctx.beginPath(); ctx.arc(ex + Math.cos(fwd) * eyeR * 0.45, ey + Math.sin(fwd) * eyeR * 0.45, eyeR * 0.5, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  function drawEliteEffects(ctx, e, frame, profile) {
    if (!profile.elite) return;
    const r = e.radius * (profile.radiusMul || 1);
    const time = frame * 0.06;
    // Efecto de estela (velocity, swift): partículas alargadas detrás
    if (profile.trailEffect || profile.ultraTrail) {
      const count = profile.ultraTrail ? 6 : 4;
      for (let i = 0; i < count; i++) {
        const seed = hash01(e, 200 + i);
        const dist = r * (0.8 + i * 0.3);
        const a = time * 2 + seed * Math.PI * 2;
        const trailR = (profile.particleSize || 0.4) * (1 - i / count) * 0.6;
        ctx.globalAlpha = (1 - i / count) * 0.5;
        ctx.fillStyle = profile.glow;
        ctx.beginPath(); ctx.arc(Math.cos(a) * dist, Math.sin(a) * dist, trailR, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    // Anillo de armadura (bulwark): segmentos rotativos
    if (profile.armorRing) {
      ctx.strokeStyle = profile.haloColor;
      ctx.lineWidth = 2;
      const segments = 8;
      for (let i = 0; i < segments; i++) {
        const a0 = (i / segments) * Math.PI * 2 + time * 0.5;
        const a1 = a0 + (Math.PI / segments) * 0.7;
        ctx.globalAlpha = 0.5;
        ctx.beginPath(); ctx.arc(0, 0, r + 12, a0, a1); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    // Apariencia fantasmal (phantom): pulsación de opacidad extra
    if (profile.ghostly) {
      ctx.globalAlpha = 0.7 + Math.sin(time * 2) * 0.3;
      ctx.fillStyle = rgba(hexToRgb(profile.body), 0.15);
      ctx.beginPath(); ctx.arc(0, 0, r * 1.3, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    // Caos (chaos): perturbación irregular de spikes
    if (profile.chaotic) {
      ctx.strokeStyle = profile.glow;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.4 + Math.sin(time * 5) * 0.3;
      for (let i = 0; i < 4; i++) {
        const a = time * 3 + i * Math.PI * 0.5;
        const len = r * (0.5 + hash01(e, 300 + i) * 0.5);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    // Masivo (titan): aura expansiva lenta
    if (profile.massive) {
      const expand = 0.8 + Math.sin(time * 0.5) * 0.2;
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = profile.glow;
      ctx.beginPath(); ctx.arc(0, 0, r * 1.8 * expand, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    // Doble aura (elite_specter_swift): anillo exterior adicional en contra-ritmo
    if (profile.doubleAura) {
      const pulse2 = 0.5 + Math.sin(time * 5) * 0.3;
      ctx.globalAlpha = pulse2 * 0.35;
      ctx.strokeStyle = profile.haloColor || profile.glow;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, 0, r + 16 + Math.sin(time * 4) * 3, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // Corona (elite_specter_wrath): púas triples sobre la parte superior
    if (profile.crown) {
      ctx.fillStyle = profile.glow;
      ctx.globalAlpha = 0.9;
      const spikes = 5;
      for (let i = 0; i < spikes; i++) {
        const a = -Math.PI / 2 + (i / (spikes - 1)) * (Math.PI * 0.7);
        const cx = Math.cos(a) * r * 0.85, cy = Math.sin(a) * r * 0.85;
        ctx.beginPath(); ctx.moveTo(cx - 3, cy - 2); ctx.lineTo(cx, cy - r * 0.3); ctx.lineTo(cx + 3, cy - 2); ctx.closePath(); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    // Núcleo vacío (elite_specter_void): orbe oscuro central con anillo pulsante
    if (profile.voidCore) {
      const vp = 0.5 + Math.sin(time * 2.5) * 0.3;
      ctx.fillStyle = 'rgba(0,0,0,0.85)';
      ctx.beginPath(); ctx.arc(0, 0, r * 0.4 * vp, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = profile.glow; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, r * 0.55 * vp, 0, Math.PI * 2); ctx.stroke();
    }
    // Distorsión de fase (elite_specter_void): arcos espectrales rotativos
    if (profile.phaseEffect) {
      ctx.globalAlpha = 0.3;
      ctx.strokeStyle = profile.glow; ctx.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) {
        const a = time * 2 + i * Math.PI * 0.66;
        ctx.beginPath(); ctx.arc(Math.cos(a) * r * 0.3, Math.sin(a) * r * 0.3, r * (0.8 + i * 0.2), a, a + Math.PI); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    // Aura intensa (elite_specter_wrath): pulso de glow amplificado
    if (profile.intenseGlow) {
      ctx.globalAlpha = 0.2 + Math.sin(time * 3) * 0.1;
      ctx.fillStyle = rgba(hexToRgb(profile.glow), 0.15);
      ctx.beginPath(); ctx.arc(0, 0, r * 1.6, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
  // Extras visuales para enemigos base espectrales (cannonGlow, shieldAura).
  function drawProfileExtras(ctx, e, frame, profile) {
    const r = e.radius * (profile.radiusMul || 1);
    const time = frame * 0.06;
    if (profile.cannonGlow) {
      const a = time * 1.5;
      const gx = Math.cos(a) * r * 0.7, gy = Math.sin(a) * r * 0.7;
      ctx.fillStyle = rgba(hexToRgb(profile.glow), 0.9);
      ctx.beginPath(); ctx.arc(gx, gy, r * 0.28, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = rgba(hexToRgb(profile.core), 0.7); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(gx, gy, r * 0.45, 0, Math.PI * 2); ctx.stroke();
    }
    if (profile.shieldAura) {
      ctx.globalAlpha = 0.35 + Math.sin(time * 2) * 0.15;
      ctx.strokeStyle = profile.glow; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, r + 6, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
  function isLabSpecter(e) {
    if (!e) return false;
    const id = e.enemyTypeId || e.id || e.typeId || e.visualId;
    return Object.prototype.hasOwnProperty.call(LAB_SPECTER_IDS, id);
  }
  function labPoseIndex(e) {
    const id = e.enemyTypeId || e.id || e.typeId || e.visualId;
    return LAB_SPECTER_IDS[id] || 0;
  }
  function labBlobShadow(ctx, x, y, r, a) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,0,32,' + a + ')');
    g.addColorStop(1, 'rgba(255,0,32,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  function drawLabEye(ctx, cx, cy, side, rage, lookX, lookY, eyeScale, extraAngle, eyeStyle) {
    const lx = Math.max(-1.6, Math.min(1.6, lookX * 0.006));
    const ly = Math.max(-1.2, Math.min(1.2, lookY * 0.005));
    const sx = 10.5 * eyeScale;
    const sy = 18.5 * eyeScale;
    ctx.save();
    ctx.translate(cx + lx, cy + ly);
    ctx.rotate(side * (0.055 + rage * 0.028) + extraAngle * 0.18);
    labBlobShadow(ctx, 0, 0, 30 * eyeScale, 0.29);
    ctx.save();
    ctx.shadowColor = 'rgba(255,0,28,.85)';
    ctx.shadowBlur = 10 * eyeScale;
    ctx.fillStyle = '#ff1024';
    ctx.strokeStyle = '#ff1024';
    ctx.lineJoin = 'miter';
    ctx.lineCap = 'round';
    ctx.beginPath();
    switch (eyeStyle % 6) {
      case 0:
        ctx.moveTo(0, -sy); ctx.lineTo(sx * .23, -sy * .30); ctx.lineTo(sx, 0); ctx.lineTo(sx * .23, sy * .30); ctx.lineTo(0, sy); ctx.lineTo(-sx * .23, sy * .30); ctx.lineTo(-sx, 0); ctx.lineTo(-sx * .23, -sy * .30); break;
      case 1:
        ctx.moveTo(0, -sy * 1.08); ctx.lineTo(sx * .32, -sy * .18); ctx.lineTo(sx * .82, sy * .02); ctx.lineTo(sx * .30, sy * .18); ctx.lineTo(0, sy * 1.02); ctx.lineTo(-sx * .18, sy * .22); ctx.lineTo(-sx * .72, 0); ctx.lineTo(-sx * .20, -sy * .22); break;
      case 2:
        ctx.moveTo(0, -sy * .92); ctx.lineTo(sx * .88, -sy * .10); ctx.lineTo(sx * .30, 0); ctx.lineTo(sx * .92, sy * .18); ctx.lineTo(0, sy * .92); ctx.lineTo(-sx * .88, sy * .15); ctx.lineTo(-sx * .30, 0); ctx.lineTo(-sx * .88, -sy * .12); break;
      case 3:
        ctx.moveTo(-sx * .10, -sy); ctx.lineTo(sx * .20, -sy * .28); ctx.lineTo(sx * 1.05, -sy * .08); ctx.lineTo(sx * .32, sy * .22); ctx.lineTo(sx * .10, sy); ctx.lineTo(-sx * .18, sy * .26); ctx.lineTo(-sx * .92, sy * .04); ctx.lineTo(-sx * .28, -sy * .20); break;
      case 4:
        ctx.moveTo(0, -sy); ctx.lineTo(sx * .22, -sy * .26); ctx.lineTo(sx * .92, -sy * .04); ctx.lineTo(sx * .38, sy * .10); ctx.lineTo(sx * .68, sy * .42); ctx.lineTo(0, sy * .98); ctx.lineTo(-sx * .18, sy * .28); ctx.lineTo(-sx * .92, 0); ctx.lineTo(-sx * .24, -sy * .22); break;
      case 5:
        ctx.moveTo(0, -sy); ctx.lineTo(sx * .72, -sy * .22); ctx.lineTo(sx * .22, 0); ctx.lineTo(sx * .78, sy * .18); ctx.lineTo(0, sy); ctx.lineTo(-sx * .78, sy * .18); ctx.lineTo(-sx * .22, 0); ctx.lineTo(-sx * .72, -sy * .22); break;
      // Elites: versiones mutadas/recargadas del mismo idioma visual.
      case 6: // Crown shard
        ctx.moveTo(0, -sy * 1.18); ctx.lineTo(sx * .18, -sy * .54); ctx.lineTo(sx * .58, -sy * .22); ctx.lineTo(sx, 0); ctx.lineTo(sx * .26, sy * .28); ctx.lineTo(0, sy * 1.02); ctx.lineTo(-sx * .26, sy * .28); ctx.lineTo(-sx, 0); ctx.lineTo(-sx * .58, -sy * .22); ctx.lineTo(-sx * .18, -sy * .54); break;
      case 7: // Twin barb lance
        ctx.moveTo(0, -sy * 1.12); ctx.lineTo(sx * .36, -sy * .38); ctx.lineTo(sx * .92, -sy * .08); ctx.lineTo(sx * .34, sy * .04); ctx.lineTo(sx * .74, sy * .30); ctx.lineTo(0, sy * .98); ctx.lineTo(-sx * .74, sy * .30); ctx.lineTo(-sx * .34, sy * .04); ctx.lineTo(-sx * .92, -sy * .08); ctx.lineTo(-sx * .36, -sy * .38); break;
      case 8: // Tyrant diamond
        ctx.moveTo(0, -sy); ctx.lineTo(sx * .50, -sy * .50); ctx.lineTo(sx * 1.06, -sy * .06); ctx.lineTo(sx * .48, 0); ctx.lineTo(sx * .96, sy * .30); ctx.lineTo(0, sy); ctx.lineTo(-sx * .96, sy * .30); ctx.lineTo(-sx * .48, 0); ctx.lineTo(-sx * 1.06, -sy * .06); ctx.lineTo(-sx * .50, -sy * .50); break;
      case 9: // Abyss fork
        ctx.moveTo(0, -sy * 1.14); ctx.lineTo(sx * .18, -sy * .52); ctx.lineTo(sx * .84, -sy * .18); ctx.lineTo(sx * .28, sy * .02); ctx.lineTo(sx * .46, sy * .40); ctx.lineTo(0, sy * .80); ctx.lineTo(-sx * .46, sy * .40); ctx.lineTo(-sx * .28, sy * .02); ctx.lineTo(-sx * .84, -sy * .18); ctx.lineTo(-sx * .18, -sy * .52); break;
      case 10: // Rift hourglass
        ctx.moveTo(0, -sy * 1.06); ctx.lineTo(sx * .84, -sy * .24); ctx.lineTo(sx * .30, -sy * .02); ctx.lineTo(sx * .62, sy * .22); ctx.lineTo(0, sy * 1.02); ctx.lineTo(-sx * .62, sy * .22); ctx.lineTo(-sx * .30, -sy * .02); ctx.lineTo(-sx * .84, -sy * .24); break;
      case 11: // Warlord star
        ctx.moveTo(0, -sy * 1.16); ctx.lineTo(sx * .30, -sy * .44); ctx.lineTo(sx * .98, -sy * .12); ctx.lineTo(sx * .40, sy * .16); ctx.lineTo(sx * .16, sy); ctx.lineTo(0, sy * .70); ctx.lineTo(-sx * .16, sy); ctx.lineTo(-sx * .40, sy * .16); ctx.lineTo(-sx * .98, -sy * .12); ctx.lineTo(-sx * .30, -sy * .44); break;
    }
    ctx.closePath(); ctx.fill(); ctx.restore();
    ctx.fillStyle = 'rgba(0,0,0,.82)';
    ctx.beginPath();
    switch (eyeStyle % 6) {
      case 1: ctx.moveTo(0, -sy * .52); ctx.lineTo(sx * .10, 0); ctx.lineTo(0, sy * .50); ctx.lineTo(-sx * .10, 0); break;
      case 2: ctx.moveTo(0, -sy * .32); ctx.lineTo(sx * .22, 0); ctx.lineTo(0, sy * .32); ctx.lineTo(-sx * .22, 0); break;
      case 3: ctx.moveTo(-sx * .04, -sy * .38); ctx.lineTo(sx * .18, 0); ctx.lineTo(sx * .03, sy * .40); ctx.lineTo(-sx * .16, 0); break;
      case 4: ctx.moveTo(0, -sy * .42); ctx.lineTo(sx * .12, -sy * .02); ctx.lineTo(-sx * .03, sy * .43); ctx.lineTo(-sx * .14, 0); break;
      case 5: ctx.moveTo(0, -sy * .38); ctx.lineTo(sx * .20, 0); ctx.lineTo(0, sy * .38); ctx.lineTo(-sx * .20, 0); break;
      case 6: ctx.moveTo(0, -sy * .52); ctx.lineTo(sx * .10, -sy * .08); ctx.lineTo(sx * .05, sy * .42); ctx.lineTo(-sx * .05, sy * .42); ctx.lineTo(-sx * .10, -sy * .08); break;
      case 7: ctx.moveTo(0, -sy * .44); ctx.lineTo(sx * .18, -sy * .02); ctx.lineTo(0, sy * .50); ctx.lineTo(-sx * .18, -sy * .02); break;
      case 8: ctx.moveTo(0, -sy * .34); ctx.lineTo(sx * .26, 0); ctx.lineTo(0, sy * .34); ctx.lineTo(-sx * .26, 0); break;
      case 9: ctx.moveTo(0, -sy * .46); ctx.lineTo(sx * .12, .5); ctx.lineTo(0, sy * .28); ctx.lineTo(-sx * .12, .5); break;
      case 10: ctx.moveTo(0, -sy * .36); ctx.lineTo(sx * .18, -sy * .02); ctx.lineTo(0, sy * .40); ctx.lineTo(-sx * .18, -sy * .02); break;
      case 11: ctx.moveTo(0, -sy * .50); ctx.lineTo(sx * .11, -sy * .10); ctx.lineTo(sx * .03, sy * .46); ctx.lineTo(-sx * .03, sy * .46); ctx.lineTo(-sx * .11, -sy * .10); break;
      default: ctx.moveTo(0, -sy * .40); ctx.lineTo(sx * .14, 0); ctx.lineTo(0, sy * .40); ctx.lineTo(-sx * .14, 0); break;
    }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,135,145,.78)';
    ctx.beginPath(); ctx.arc(0, 0, 1.25 * eyeScale, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  function drawLabMouth(ctx, type, y) {
    ctx.save();
    ctx.translate(0, y);
    labBlobShadow(ctx, 0, 2, 36, 0.20);
    if (type === 2 || type === 3) {
      const w = type === 3 ? 17 : 14;
      const h = type === 3 ? 24 : 20;
      ctx.fillStyle = '#ff111c';
      ctx.beginPath();
      ctx.moveTo(0, -h);
      ctx.bezierCurveTo(w * .95, -h * .82, w * 1.05, h * .15, w * .20, h);
      ctx.bezierCurveTo(w * .06, h * 1.04, -w * .08, h * 1.04, -w * .24, h);
      ctx.bezierCurveTo(-w * 1.06, h * .10, -w * .94, -h * .82, 0, -h);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(120,0,8,.38)';
      ctx.beginPath();
      ctx.moveTo(0, -h * .56);
      ctx.bezierCurveTo(w * .42, -h * .42, w * .50, h * .04, w * .12, h * .52);
      ctx.bezierCurveTo(0, h * .60, -w * .14, h * .58, -w * .20, h * .52);
      ctx.bezierCurveTo(-w * .52, h * .04, -w * .44, -h * .42, 0, -h * .56);
      ctx.closePath(); ctx.fill();
      ctx.restore();
      return;
    }
    ctx.fillStyle = '#ff111c';
    ctx.beginPath();
    ctx.moveTo(-30, -8); ctx.lineTo(-22, 2); ctx.lineTo(-15, -6); ctx.lineTo(-7, 6);
    ctx.lineTo(1, -4); ctx.lineTo(9, 7); ctx.lineTo(17, -4); ctx.lineTo(24, 4);
    ctx.lineTo(31, -8); ctx.lineTo(28, 10); ctx.lineTo(20, 3); ctx.lineTo(12, 14);
    ctx.lineTo(3, 5); ctx.lineTo(-6, 15); ctx.lineTo(-14, 4); ctx.lineTo(-23, 13);
    ctx.closePath(); ctx.fill();
    if (type === 1) {
      ctx.globalAlpha = .94;
      ctx.beginPath();
      ctx.moveTo(-20, -12); ctx.lineTo(-12, -2); ctx.lineTo(-4, -13); ctx.lineTo(3, -2);
      ctx.lineTo(11, -12); ctx.lineTo(18, -2); ctx.lineTo(24, -13); ctx.lineTo(23, -1);
      ctx.lineTo(15, 6); ctx.lineTo(8, -3); ctx.lineTo(0, 7); ctx.lineTo(-8, -3);
      ctx.lineTo(-16, 6); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }
  // Perf-02: smoothstep hoisted (antes se recreaba por llamada) + pool de
  // buffers reutilizables. buildLabTail corre por cola por frame por enemigo:
  // con 80 enemigos llegaba a ~miles de sub-arrays asignados por frame (presión
  // de GC / micro-hitching). El pool rota slots pre-asignados al máximo de
  // muestras; los consumidores leen solo índices [0..samples] de forma
  // síncrona (glow y contorno del MISMO frame), así que la reutilización es
  // segura. Muestras reducidas 40->24 (no élites) y 88->48 (élites): a la
  // escala de render (radius/54) la diferencia de silueta es imperceptible.
  const TAIL_MAX_SAMPLES = 48;
  const TAIL_POOL = [];
  for (let i = 0; i < 4; i++) {
    const centers = [], left = [], right = [];
    for (let j = 0; j <= TAIL_MAX_SAMPLES; j++) { centers.push([0, 0]); left.push([0, 0]); right.push([0, 0]); }
    TAIL_POOL.push({ centers, left, right, elite: false, count: 0 });
  }
  let tailPoolIdx = 0;
  function tailSmoothstep(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }
  function buildLabTail(startX, startY, p, t, seed) {
    const slot = TAIL_POOL[tailPoolIdx++ % TAIL_POOL.length];
    const centers = slot.centers, left = slot.left, right = slot.right;
    const len = 118 * (p.tailLen || 1);
    const dir = p.tailDir || 1;
    const amp = 17 * (p.tailAmp || .5);
    const samples = p.elite ? 48 : 24;
    // count lógico: los consumidores iteran [0..count) en vez de array.length
    // (los buffers del pool NUNCA se re-dimensionan: truncar+extender crea
    // agujeros undefined y crashea el draw).
    slot.count = samples + 1;
    for (let i = 0; i <= samples; i++) {
      const u = i / samples;
      const motion = tailSmoothstep((u - .10) / .90);
      const baseS = dir * amp * (.33 * Math.sin(u * Math.PI * 1.18) - .23 * Math.sin(u * Math.PI * 2.05));
      const liveWave = motion * (
        Math.sin(t * 5.4 - u * 8.2 + seed) * (3.0 + 6.5 * u) +
        Math.sin(t * 8.6 - u * 13.4 + seed * 1.37) * (1.0 + 2.4 * u) +
        Math.sin(t * 12.2 - u * 18.0 + seed * .73) * (0.25 + 0.9 * u)
      );
      const c = centers[i];
      c[0] = startX + baseS + liveWave;
      c[1] = startY + len * u;
    }
    for (let i = 0; i <= samples; i++) {
      const u = i / samples;
      const prev = centers[i > 0 ? i - 1 : 0], next = centers[i < samples ? i + 1 : samples];
      const dx = next[0] - prev[0], dy = next[1] - prev[1];
      const mag = Math.hypot(dx, dy) || 1;
      const nx = -dy / mag, ny = dx / mag;
      const taper = tailSmoothstep(u);
      const width = 27 * (1 - taper) + .48 * taper;
      const c = centers[i], lv = left[i], rv = right[i];
      lv[0] = c[0] + nx * width; lv[1] = c[1] + ny * width;
      rv[0] = c[0] - nx * width; rv[1] = c[1] - ny * width;
    }
    slot.elite = !!p.elite;
    return slot;
  }
  function drawLabTailGlow(ctx, tail, t, seed) {
    // Perf-01: glow de cola en UNA sola pasada aditiva (antes: 3 trazos con
    // shadowBlur 22/12/7 = ~77% del coste raster de enemigos según
    // tools/diagnostics/enemy_anim_profiler.js). Se conserva el halo ancho
    // difuso con blur moderado; el detalle fino del contorno lo aporta el
    // cuerpo negro que se dibuja justo después encima.
    if (!tail.centers || tail.count < 2) return;
    const pts = tail.centers;
    const nPts = tail.count;
    const pulse = .78 + Math.sin(t * 3.4 + seed) * .12;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < nPts; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.strokeStyle = 'rgba(255,24,42,' + (.15 * pulse) + ')';
    ctx.lineWidth = 14;
    ctx.shadowColor = 'rgba(255,0,26,.55)';
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.restore();
  }
  function drawEliteAura(ctx, p, t, seed) {
    if (!p.elite) return;
    const amp = p.aura || 1.2;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    labBlobShadow(ctx, 0, -28, 64 * amp, .08);
    labBlobShadow(ctx, 0, 10, 88 * amp, .06);
    ctx.restore();
  }
  function drawEliteSigil(ctx, kind, t, seed) {
    if (kind == null || kind < 0) return;
    const pulse = .78 + Math.sin(t * 4.2 + seed) * .18;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(255,18,36,' + (.52 * pulse) + ')';
    ctx.fillStyle = 'rgba(255,18,36,' + (.36 * pulse) + ')';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = 'rgba(255,0,24,.45)';
    ctx.shadowBlur = 10;
    switch (kind % 6) {
      case 0:
        ctx.beginPath(); ctx.moveTo(0, 12); ctx.lineTo(0, 34);
        ctx.moveTo(-8, 22); ctx.lineTo(0, 12); ctx.lineTo(8, 22);
        ctx.moveTo(-6, 28); ctx.lineTo(0, 34); ctx.lineTo(6, 28);
        ctx.stroke(); break;
      case 1:
        for (const x of [-8, 0, 8]) {
          ctx.beginPath(); ctx.moveTo(x, 14); ctx.quadraticCurveTo(x + 2, 24, x - 1, 35); ctx.stroke();
        } break;
      case 2:
        ctx.beginPath(); ctx.moveTo(0, 12); ctx.lineTo(10, 22); ctx.lineTo(0, 35); ctx.lineTo(-10, 22); ctx.closePath(); ctx.fill();
        if (ctx.clearRect) ctx.clearRect(-1, 20, 2, 4); break;
      case 3:
        ctx.beginPath(); ctx.moveTo(-10, 18); ctx.lineTo(0, 26); ctx.lineTo(10, 18);
        ctx.moveTo(-8, 30); ctx.lineTo(0, 38); ctx.lineTo(8, 30); ctx.stroke(); break;
      case 4:
        ctx.beginPath(); ctx.moveTo(0, 10); ctx.lineTo(7, 20); ctx.lineTo(3, 20); ctx.lineTo(9, 32);
        ctx.lineTo(0, 41); ctx.lineTo(-9, 32); ctx.lineTo(-3, 20); ctx.lineTo(-7, 20);
        ctx.closePath(); ctx.fill(); break;
      case 5:
        ctx.beginPath(); ctx.moveTo(0, 12); ctx.lineTo(0, 38);
        ctx.moveTo(-8, 20); ctx.lineTo(-2, 28); ctx.moveTo(8, 20); ctx.lineTo(2, 28);
        ctx.moveTo(0, 12); ctx.lineTo(-6, 18); ctx.moveTo(0, 12); ctx.lineTo(6, 18);
        ctx.stroke(); break;
    }
    ctx.restore();
  }
  function drawBossHalo(ctx, kind, t, seed) {
    const pulse = .78 + Math.sin(t * 4.0 + seed) * .18;
    ctx.save();
    ctx.translate(0, -28);
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(255,22,40,' + (.42 * pulse) + ')';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(255,0,24,.45)';
    ctx.shadowBlur = 10;
    switch (kind % 6) {
      case 0:
        ctx.beginPath(); ctx.arc(0, 2, 39, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); break;
      case 1:
        ctx.beginPath(); ctx.arc(0, 2, 44, Math.PI * 1.2, Math.PI * 1.8); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 2, 34, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); break;
      case 2:
        ctx.beginPath(); ctx.moveTo(0, -32); ctx.lineTo(12, -18); ctx.lineTo(0, -4); ctx.lineTo(-12, -18); ctx.closePath(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-3, -18); ctx.lineTo(3, -18); ctx.stroke(); break;
      case 3:
        for (const x of [-18, -6, 6, 18]) {
          ctx.beginPath(); ctx.moveTo(x - 3, -22); ctx.lineTo(x + 5, -6); ctx.stroke();
        } break;
      case 4:
        ctx.beginPath(); ctx.arc(0, -18, 14, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(-18, -14, 8, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(18, -14, 8, 0, Math.PI * 2); ctx.stroke(); break;
      case 5:
        ctx.beginPath(); ctx.moveTo(-30, -8); ctx.quadraticCurveTo(0, -42, 30, -8); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-20, -14); ctx.lineTo(0, -28); ctx.lineTo(20, -14); ctx.stroke(); break;
    }
    ctx.restore();
  }
  function drawBossCrown(ctx, kind, p, t, seed) {
    const q = Math.sin(t * 1.1 + seed) * 1.4;
    ctx.save();
    ctx.fillStyle = '#020203';
    switch (kind % 6) {
      case 0:
        ctx.beginPath(); ctx.moveTo(-28, -54); ctx.lineTo(-18, -82 - q); ctx.lineTo(-8, -58); ctx.lineTo(0, -88 - q * 1.2);
        ctx.lineTo(10, -58); ctx.lineTo(22, -80 - q); ctx.lineTo(30, -50);
        ctx.quadraticCurveTo(0, -38, -28, -54); ctx.closePath(); ctx.fill(); break;
      case 1:
        ctx.beginPath(); ctx.moveTo(-24, -54); ctx.quadraticCurveTo(-22, -90, -4, -96 - q);
        ctx.quadraticCurveTo(11, -90, 23, -56); ctx.lineTo(10, -54);
        ctx.quadraticCurveTo(2, -72, -6, -54); ctx.closePath(); ctx.fill(); break;
      case 2:
        ctx.beginPath(); ctx.moveTo(-32, -48); ctx.lineTo(-18, -84 - q); ctx.lineTo(-5, -58);
        ctx.lineTo(6, -76 - q * .6); ctx.lineTo(20, -52);
        ctx.quadraticCurveTo(4, -42, -32, -48); ctx.closePath(); ctx.fill(); break;
      case 3:
        ctx.beginPath(); ctx.moveTo(-48, -10); ctx.lineTo(-30, -34); ctx.lineTo(-8, -26); ctx.lineTo(0, -44 - q * .5);
        ctx.lineTo(8, -26); ctx.lineTo(30, -34); ctx.lineTo(48, -10);
        ctx.lineTo(26, -6); ctx.lineTo(0, -2); ctx.lineTo(-26, -6); ctx.closePath(); ctx.fill(); break;
      case 4:
        ctx.beginPath(); ctx.moveTo(-30, -52); ctx.quadraticCurveTo(-46, -70 - q, -40, -22);
        ctx.quadraticCurveTo(-23, -30, -18, -50); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(30, -52); ctx.quadraticCurveTo(46, -70 - q, 40, -22);
        ctx.quadraticCurveTo(23, -30, 18, -50); ctx.closePath(); ctx.fill(); break;
      case 5:
        ctx.beginPath(); ctx.moveTo(-34, -42); ctx.lineTo(-22, -76 - q); ctx.lineTo(-6, -52);
        ctx.lineTo(0, -86 - q); ctx.lineTo(8, -52); ctx.lineTo(26, -76 - q); ctx.lineTo(36, -40);
        ctx.quadraticCurveTo(0, -28, -34, -42); ctx.closePath(); ctx.fill(); break;
    }
    ctx.restore();
  }
  function drawBossMantle(ctx, kind, p, t, seed) {
    const q = Math.sin(t * .9 + seed) * 2.2;
    ctx.save();
    ctx.fillStyle = '#020203';
    switch (kind % 6) {
      case 0:
        ctx.beginPath(); ctx.moveTo(-44, 10); ctx.quadraticCurveTo(-60, 28, -50, 52);
        ctx.quadraticCurveTo(-34, 44, -28, 20); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(44, 10); ctx.quadraticCurveTo(60, 28, 50, 52);
        ctx.quadraticCurveTo(34, 44, 28, 20); ctx.closePath(); ctx.fill(); break;
      case 1:
        ctx.beginPath(); ctx.moveTo(-54, 2); ctx.quadraticCurveTo(-84, 20, -78, 58 + q);
        ctx.quadraticCurveTo(-54, 52, -34, 24); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(54, 2); ctx.quadraticCurveTo(84, 20, 78, 58 - q);
        ctx.quadraticCurveTo(54, 52, 34, 24); ctx.closePath(); ctx.fill(); break;
      case 2:
        ctx.beginPath(); ctx.moveTo(-38, 20); ctx.lineTo(-60, 44); ctx.lineTo(-46, 48);
        ctx.lineTo(-63, 70 + q); ctx.lineTo(-34, 58); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(38, 20); ctx.lineTo(60, 44); ctx.lineTo(46, 48);
        ctx.lineTo(63, 70 - q); ctx.lineTo(34, 58); ctx.closePath(); ctx.fill(); break;
      case 3:
        ctx.beginPath(); ctx.moveTo(-50, 6); ctx.quadraticCurveTo(-74, 20, -66, 74);
        ctx.quadraticCurveTo(-46, 66, -30, 28); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(50, 6); ctx.quadraticCurveTo(74, 20, 66, 74);
        ctx.quadraticCurveTo(46, 66, 30, 28); ctx.closePath(); ctx.fill(); break;
      case 4:
        ctx.beginPath(); ctx.moveTo(-34, 18); ctx.quadraticCurveTo(-52, 42, -46, 84 + q);
        ctx.quadraticCurveTo(-28, 60, -24, 26); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(34, 18); ctx.quadraticCurveTo(52, 42, 46, 84 - q);
        ctx.quadraticCurveTo(28, 60, 24, 26); ctx.closePath(); ctx.fill(); break;
      case 5:
        ctx.beginPath(); ctx.moveTo(-62, 6); ctx.quadraticCurveTo(-90, 24, -78, 66);
        ctx.quadraticCurveTo(-52, 54, -40, 24); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-44, 8); ctx.quadraticCurveTo(-62, 30, -56, 52);
        ctx.quadraticCurveTo(-40, 44, -28, 22); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(62, 6); ctx.quadraticCurveTo(90, 24, 78, 66);
        ctx.quadraticCurveTo(52, 54, 40, 24); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(44, 8); ctx.quadraticCurveTo(62, 30, 56, 52);
        ctx.quadraticCurveTo(40, 44, 28, 22); ctx.closePath(); ctx.fill(); break;
    }
    ctx.restore();
  }
  function getBossTailSpecs(p) {
    switch (p.tailMode % 6) {
      case 0: return [{ x: 0, y: 74, dir: p.tailDir, len: 1.00, amp: 1.00 }];
      case 1: return [
        { x: -7, y: 72, dir: -1, len: .90, amp: .76 },
        { x: 8, y: 74, dir: 1, len: 1.04, amp: .94 }
      ];
      case 2: return [
        { x: -10, y: 72, dir: -1, len: .86, amp: .68 },
        { x: 0, y: 75, dir: p.tailDir, len: 1.04, amp: .92 },
        { x: 10, y: 72, dir: 1, len: .86, amp: .68 }
      ];
      case 3: return [
        { x: -12, y: 72, dir: -1, len: .80, amp: .60 },
        { x: -4, y: 76, dir: 1, len: 1.00, amp: .86 },
        { x: 4, y: 76, dir: -1, len: 1.00, amp: .86 },
        { x: 12, y: 72, dir: 1, len: .80, amp: .60 }
      ];
      case 4: return [
        { x: 0, y: 73, dir: p.tailDir, len: 1.10, amp: 1.00 },
        { x: -14, y: 74, dir: -1, len: .70, amp: .50 },
        { x: 14, y: 74, dir: 1, len: .70, amp: .50 }
      ];
      case 5: return [
        { x: -9, y: 72, dir: -1, len: .92, amp: .74 },
        { x: 0, y: 76, dir: p.tailDir, len: 1.06, amp: .96 },
        { x: 9, y: 72, dir: 1, len: .92, amp: .74 }
      ];
      default: return [{ x: 0, y: 74, dir: p.tailDir, len: 1.00, amp: 1.00 }];
    }
  }
  function resolveEliteBossPose(e) {
    const vid = e.visualId || (e.enemyTypeId ? 'elite_' + e.enemyTypeId.replace('specter_elite_', '').replace('specter_', '') : 'elite_base');
    return ELITE_BOSS_POSES[vid] || ELITE_BOSS_POSES.elite_base;
  }
  function drawEliteBossEnemy(ctx, e, frame, player, profile, rx, ry) {
    const p = resolveEliteBossPose(e);
    const t = (frame || 0) * 0.016;
    const seed = hash01(e, 800) * 9.7;
    const bob = Math.sin(t * 1.65 + seed) * 1.6 + Math.sin(t * 3.15 + seed * .4) * 0.35;
    const sway = Math.sin(t * .95 + seed * .7) * .028 + Math.sin(t * 2.4 + seed) * .008;
    const pulse = 1 + Math.sin(t * 2.35 + seed) * .010;
    const scale = (e.radius || 20) / 54;
    const rage = .95;
    const lookX = player ? player.x - e.x : 0;
    const lookY = player ? player.y - e.y : 0;
    ctx.save();
    ctx.translate(e.x + rx, e.y + ry + bob);
    drawStatusLayers(ctx, e, frame || 0, player, profile);
    ctx.rotate(p.tilt + sway);
    ctx.scale(scale * pulse, scale * pulse);
    drawEliteAura(ctx, p, t, seed);
    drawBossHalo(ctx, p.halo, t, seed);
    drawBossCrown(ctx, p.crown, p, t, seed);
    drawBossMantle(ctx, p.mantle, p, t, seed);
    labBlobShadow(ctx, 0, 10, 118, .09);
    const bw = p.body[0], bh = p.body[1], head = p.head;
    const specs = getBossTailSpecs(p);
    for (const spec of specs) {
      const tail = buildLabTail(spec.x, spec.y * bh, { ...p, tailDir: spec.dir, tailLen: spec.len, tailAmp: spec.amp, elite: true }, t, seed + spec.x);
      drawLabTailGlow(ctx, tail, t, seed + spec.x);
    }
    ctx.fillStyle = '#020203';
    ctx.strokeStyle = '#050507';
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-18 * head, -71);
    ctx.bezierCurveTo(-46 * bw, -70, -57 * bw, -49, -56 * bw, -23);
    ctx.bezierCurveTo(-55 * bw, -4, -49 * bw, 15, -43 * bw, 30);
    ctx.bezierCurveTo(-39 * bw, 43, -33 * bw, 56, -27 * bw * p.shoulder, 64 * p.waist);
    ctx.bezierCurveTo(-20 * bw * p.root, 72, -10 * bh, 74, 0, 74 * bh);
    ctx.bezierCurveTo(10 * bh, 74, 20 * bw * p.root, 72, 27 * bw * p.shoulder, 64 * p.waist);
    ctx.bezierCurveTo(33 * bw, 56, 39 * bw, 43, 43 * bw, 30);
    ctx.bezierCurveTo(49 * bw, 15, 55 * bw, -4, 56 * bw, -23);
    ctx.bezierCurveTo(57 * bw, -49, 46 * bw, -70, 18 * head, -72);
    ctx.bezierCurveTo(7, -74, -7, -74, -18 * head, -71);
    ctx.closePath();
    ctx.fill();
    drawEliteSigil(ctx, p.sigil, t, seed);
    ctx.save();
    ctx.globalAlpha = .11;
    const shade = ctx.createLinearGradient ? ctx.createLinearGradient(-36, -8, 36, 92) : '#222';
    if (shade.addColorStop) {
      shade.addColorStop(0, 'rgba(255,255,255,.22)');
      shade.addColorStop(.42, 'rgba(255,255,255,.05)');
      shade.addColorStop(1, 'rgba(255,255,255,0)');
    }
    ctx.strokeStyle = shade;
    ctx.lineWidth = 1.35;
    ctx.beginPath(); ctx.moveTo(-30, -18); ctx.bezierCurveTo(-26, 18, -18, 46, -8, 75); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(28, -18); ctx.bezierCurveTo(24, 18, 18, 44, 10, 73); ctx.stroke();
    ctx.restore();
    drawLabEye(ctx, -(p.eyeSep || 24), p.eyeY || -30, -1, rage, lookX, lookY, p.eye, -(p.eyeAng || 0), p.eyeStyle || 0);
    drawLabEye(ctx, +(p.eyeSep || 24), p.eyeY || -30, 1, rage, lookX, lookY, p.eye, +(p.eyeAng || 0), p.eyeStyle || 0);
    drawLabMouth(ctx, p.mouth, p.mouthY || 6);
    ctx.restore();
  }
  function drawLabSpecterEnemy(ctx, e, frame, player, profile, rx, ry) {
    const p = LAB_POSES[labPoseIndex(e) % LAB_POSES.length];
    const t = (frame || 0) * 0.016;
    const seed = hash01(e, 700) * 9.7;
    const bob = Math.sin(t * 1.65 + seed) * 1.6 + Math.sin(t * 3.15 + seed * .4) * 0.35;
    const sway = Math.sin(t * .95 + seed * .7) * .028 + Math.sin(t * 2.4 + seed) * .008;
    const pulse = 1 + Math.sin(t * 2.35 + seed) * .010;
    const scale = (e.radius || 12) / 54;
    const rage = e.isElite ? .95 : .75;
    const lookX = player ? player.x - e.x : 0;
    const lookY = player ? player.y - e.y : 0;
    ctx.save();
    ctx.translate(e.x + rx, e.y + ry + bob);
    drawStatusLayers(ctx, e, frame || 0, player, profile);
    ctx.rotate(p.tilt + sway);
    ctx.scale(scale * pulse, scale * pulse);
    labBlobShadow(ctx, 0, 10, e.isElite ? 118 : 92, e.isElite ? .09 : .06);
    const bw = p.body[0];
    const bh = p.body[1];
    const head = p.head;
    const tail = buildLabTail(0, 70 * bh, p, t, seed);
    drawLabTailGlow(ctx, tail, t, seed);
    const L = tail.left, R = tail.right;
    const nPts = tail.count;
    const tipL = L[nPts - 1], tipR = R[nPts - 1];
    const tipX = (tipL[0] + tipR[0]) / 2;
    const tipY = (tipL[1] + tipR[1]) / 2;
    ctx.fillStyle = '#020203';
    ctx.strokeStyle = '#050507';
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-17 * head, -71);
    ctx.bezierCurveTo(-44 * bw, -70, -55 * bw, -49, -54 * bw, -23);
    ctx.bezierCurveTo(-53 * bw, -4, -47 * bw, 15, -41 * bw, 30);
    ctx.bezierCurveTo(-37 * bw, 43, -31 * bw, 56, L[0][0], L[0][1]);
    for (let i = 1; i < nPts; i++) ctx.lineTo(L[i][0], L[i][1]);
    ctx.lineTo(tipX, tipY);
    for (let i = nPts - 2; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]);
    ctx.bezierCurveTo(31 * bw, 56, 37 * bw, 43, 41 * bw, 30);
    ctx.bezierCurveTo(47 * bw, 15, 53 * bw, -4, 54 * bw, -23);
    ctx.bezierCurveTo(55 * bw, -49, 44 * bw, -70, 17 * head, -72);
    ctx.bezierCurveTo(7, -74, -7, -74, -17 * head, -71);
    ctx.closePath(); ctx.fill();
    ctx.save();
    ctx.globalAlpha = .10;
    const shade = ctx.createLinearGradient ? ctx.createLinearGradient(-30, -10, 30, 90) : '#222';
    if (shade.addColorStop) {
      shade.addColorStop(0, 'rgba(255,255,255,.18)');
      shade.addColorStop(.45, 'rgba(255,255,255,.04)');
      shade.addColorStop(1, 'rgba(255,255,255,0)');
    }
    ctx.strokeStyle = shade; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(-30, -18); ctx.bezierCurveTo(-26, 20, -19, 47, -11, 74); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(28, -18); ctx.bezierCurveTo(24, 18, 18, 44, 10, 72); ctx.stroke();
    ctx.restore();
    if (e.isElite) {
      ctx.save();
      ctx.globalAlpha = .35 + Math.sin(t * 4 + seed) * .10;
      ctx.strokeStyle = profile.haloColor || '#ff3040';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(0, -2, 76, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha *= .65;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, -2, 92, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    drawLabEye(ctx, -(p.eyeSep || 24), p.eyeY || -30, -1, rage, lookX, lookY, p.eye, -(p.eyeAng || 0), p.eyeStyle || 0);
    drawLabEye(ctx, +(p.eyeSep || 24), p.eyeY || -30, 1, rage, lookX, lookY, p.eye, +(p.eyeAng || 0), p.eyeStyle || 0);
    drawLabMouth(ctx, p.mouth, p.mouthY || 6);
    ctx.restore();
  }
  function resolveBossProfile(boss) {
    if (!boss) return BOSS_PROFILES.boss_jefe;
    // Mapea por nombre de tipo de boss (BO_TYPE.name) o por índice
    const nameMap = { 'JEFE': 'boss_jefe', 'TITÁN': 'boss_titan', 'SEÑOR DEL VACÍO': 'boss_vacio', 'GUARDIÁN': 'boss_guardian', 'DESTRUCTOR': 'boss_destructor', 'NÉMESIS': 'boss_nemesis', 'COLOSO': 'boss_coloso', 'FANTASMA': 'boss_fantasma', 'MUTANTE': 'boss_mutante', 'APOCALIPSIS': 'boss_apocalipsis' };
    const key = nameMap[boss.name] || 'boss_jefe';
    return BOSS_PROFILES[key] || BOSS_PROFILES.boss_jefe;
  }
  function drawStatusLayers(ctx, e, frame, player, profile) {
    if (e.slowUntil > 0) {
      const t = frame * 0.06;
      const cold = 0.5 + Math.sin(t * 3.5) * 0.5;
      ctx.fillStyle = 'rgba(103,232,249,' + (cold * 0.22) + ')';
      ctx.beginPath(); ctx.arc(0, 0, e.radius, 0, Math.PI * 2); ctx.fill();
    }
    if (e.mine) {
      ctx.strokeStyle = 'rgba(255,215,95,0.7)'; ctx.lineWidth = 1.5;
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + frame * 0.03;
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * (e.radius + 3), Math.sin(a) * (e.radius + 3)); ctx.lineTo(Math.cos(a) * (e.radius + 8), Math.sin(a) * (e.radius + 8)); ctx.stroke();
      }
    }
    if (e.armed) {
      const blink = 0.4 + Math.sin(frame * 0.36) * 0.6;
      ctx.globalAlpha = blink; ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(0, 0, e.radius * 0.5, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (e.isElite) {
      const r = e.radius * (profile.radiusMul || 1);
      const pulse = 0.6 + Math.sin(frame * (profile.haloPulse || 0.12)) * 0.3;
      ctx.globalAlpha = pulse;
      // Halo principal específico del tipo de élite
      ctx.strokeStyle = profile.haloColor || '#ffd700';
      ctx.lineWidth = profile.haloWidth || 2.5;
      ctx.beginPath(); ctx.arc(0, 0, e.radius + 5, 0, Math.PI * 2); ctx.stroke();
      // Anillo exterior tenue
      ctx.globalAlpha = pulse * 0.4;
      ctx.lineWidth = (profile.haloWidth || 2.5) * 0.6;
      ctx.beginPath(); ctx.arc(0, 0, e.radius + 9, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (e.atkFlash > 0 && player) {
      const r = e.radius;
      const atk = Math.min(1, Math.max(0, e.atkFlash / 0.45));
      const fwd = Math.atan2(player.y - e.y, player.x - e.x);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(0, 0, r + 5, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#ff3040'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(0, 0, r + 8 + (1 - atk) * 18, fwd + 1.1 + (1 - atk) * 0.45, fwd - 1.1 - (1 - atk) * 0.45, true); ctx.stroke();
    }
  }
  NV.drawSpectralEnemy2D = function (ctx, e, frame, player, rhythm) {
    if (!e || e.dead || e.shape === 'specter') return false;
    const profile = resolveProfile(e);
    ctx.save();
    let rx = 0, ry = 0;
    if (rhythm && rhythm.enabled && rhythm.state === 'listening') {
      const sig = Math.min(1, (rhythm.bass || 0) * 0.5 + (rhythm.kick || 0) * 0.7);
      const thr = 0.18 + hash01(e, 1) * 0.52;
      const level = Math.max(0, Math.min(1, (sig - thr) / (1 - thr)));
      if (level > 0.02 && ((rhythm.onset || 0) > 0.05 || (rhythm.kick || 0) > 0.05)) {
        const seed = hash01(e, 2) * 6.28318;
        const amp = Math.min(4.5, (0.9 + sig * 3.4) * level);
        rx = Math.sin((frame || 0) * 0.31 + seed) * amp;
        ry = Math.cos((frame || 0) * 0.27 + seed * 1.7) * amp * 0.62;
      }
    }
    if (isLabSpecter(e)) {
      drawLabSpecterEnemy(ctx, e, frame, player, profile, rx, ry);
      ctx.restore();
      return true;
    }
    if (e.isElite && !isLabSpecter(e)) {
      drawEliteBossEnemy(ctx, e, frame, player, profile, rx, ry);
      ctx.restore();
      return true;
    }
    ctx.translate(e.x + rx, e.y + ry);
    drawStatusLayers(ctx, e, frame, player, profile);
    drawEliteEffects(ctx, e, frame, profile);
    drawBody(ctx, e, frame, profile);
    drawProfileExtras(ctx, e, frame, profile);
    drawEyes(ctx, e, player, profile);
    ctx.restore();
    return true;
  };
  function drawBossAura(ctx, boss, frame, profile) {
    const r = boss.radius * (profile.radiusMul || 1.3);
    const time = frame * 0.06;
    const auraR = r * (profile.auraRadius || 2.2);
    const pulse = 1 + Math.sin(time * (profile.pulseRate || 0.8)) * (profile.pulseAmt || 0.06);
    const grd = ctx.createRadialGradient(0, 0, r * 0.5, 0, 0, auraR * pulse);
    grd.addColorStop(0, rgba(hexToRgb(profile.glow), (profile.auraAlpha || 0.25)));
    grd.addColorStop(0.6, rgba(hexToRgb(profile.glow), (profile.auraAlpha || 0.25) * 0.4));
    grd.addColorStop(1, rgba(hexToRgb(profile.glow), 0));
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(0, 0, auraR * pulse, 0, Math.PI * 2); ctx.fill();
    if (profile.ringCount) {
      for (let ring = 0; ring < profile.ringCount; ring++) {
        const ringR = r * (1.3 + ring * 0.4);
        const rotSpeed = (ring % 2 === 0 ? 0.3 : -0.3);
        ctx.globalAlpha = 0.3 - ring * 0.08;
        ctx.strokeStyle = profile.glow;
        ctx.lineWidth = 2 - ring * 0.5;
        ctx.beginPath(); ctx.arc(0, 0, ringR, time * rotSpeed, time * rotSpeed + Math.PI * 1.5); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }
  function drawBossBody(ctx, boss, frame, profile) {
    const r = boss.radius * (profile.radiusMul || 1.3);
    const time = frame * 0.06;
    const pulse = 1 + Math.sin(time * (profile.pulseRate || 0.8)) * (profile.pulseAmt || 0.06);
    ctx.fillStyle = rgba(hexToRgb(profile.body), 0.9);
    ctx.strokeStyle = rgba(hexToRgb(profile.glow), 0.95);
    ctx.lineWidth = 2.5;
    const spikes = profile.spikes;
    const innerR = r * (profile.innerRatio || 0.8);
    const spikeLen = r * (profile.spikeLen || 0.35);
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const a = (i / (spikes * 2)) * Math.PI * 2 + time * 0.05;
      const isPeak = i % 2 === 0;
      const rad = isPeak ? (innerR + spikeLen) * pulse : innerR * 0.95;
      if (i === 0) ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
      else ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = rgba(hexToRgb(profile.core), 0.8);
    ctx.beginPath(); ctx.arc(0, 0, r * 0.4, 0, Math.PI * 2); ctx.fill();
  }
  function drawBossParticles(ctx, boss, frame, profile) {
    const r = boss.radius * (profile.radiusMul || 1.3);
    const time = frame * 0.06;
    const bodyRgb = hexToRgb(profile.body);
    ctx.fillStyle = rgba(bodyRgb, 0.6);
    for (let i = 0; i < (profile.particles || 8); i++) {
      const seed = hash01({ x: boss.x + i * 17, y: boss.y + i * 31, radius: boss.radius }, 100 + i);
      const orbitR = r * (1.5 + seed * 0.8);
      const a = time * (0.2 + seed * 0.4) + seed * Math.PI * 2;
      ctx.beginPath(); ctx.arc(Math.cos(a) * orbitR, Math.sin(a) * orbitR, (profile.particleSize || 0.7) * (0.5 + seed), 0, Math.PI * 2); ctx.fill();
    }
  }
  function drawBossEyes(ctx, boss, player, profile) {
    if (!player) return;
    const r = boss.radius * (profile.radiusMul || 1.3);
    const fwd = Math.atan2(player.y - boss.y, player.x - boss.x);
    const eyeR = Math.max(3, r * 0.12);
    const sep = r * 0.3;
    ctx.fillStyle = '#fff';
    if (profile.eyeStyle === 'single') {
      ctx.beginPath(); ctx.arc(0, 0, eyeR * 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff2222'; ctx.beginPath(); ctx.arc(Math.cos(fwd) * eyeR * 0.5, Math.sin(fwd) * eyeR * 0.5, eyeR * 0.7, 0, Math.PI * 2); ctx.fill();
    } else if (profile.eyeStyle === 'asymmetric') {
      ctx.beginPath(); ctx.arc(-sep * 0.3, -r * 0.05, eyeR * 0.9, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(sep * 0.4, -r * 0.02, eyeR * 1.1, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff2222';
      ctx.beginPath(); ctx.arc(-sep * 0.3 + Math.cos(fwd) * eyeR * 0.3, -r * 0.05 + Math.sin(fwd) * eyeR * 0.3, eyeR * 0.4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(sep * 0.4 + Math.cos(fwd) * eyeR * 0.4, -r * 0.02 + Math.sin(fwd) * eyeR * 0.4, eyeR * 0.5, 0, Math.PI * 2); ctx.fill();
    } else {
      for (const side of [-1, 1]) {
        const ex = side * sep * 0.5, ey = -r * 0.05;
        ctx.beginPath(); ctx.arc(ex, ey, eyeR, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ff2222'; ctx.beginPath(); ctx.arc(ex + Math.cos(fwd) * eyeR * 0.5, ey + Math.sin(fwd) * eyeR * 0.5, eyeR * 0.55, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff';
      }
    }
  }
  function drawBossHpBar(ctx, boss, profile) {
    const r = boss.radius * (profile.radiusMul || 1.3);
    const barW = 280, barH = 18;
    const hpPct = Math.max(0, boss.hp) / boss.maxHp;
    ctx.save();
    ctx.translate(0, -r - 45);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(-barW / 2 - 2, -2, barW + 4, barH + 4);
    const hpColor = hpPct > 0.4 ? profile.glow : (hpPct > 0.2 ? '#ffcf76' : '#ff5f9b');
    ctx.fillStyle = hpColor;
    ctx.fillRect(-barW / 2, 0, barW * hpPct, barH);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.strokeRect(-barW / 2, 0, barW, barH);
    ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
    ctx.fillText(Math.ceil(boss.hp) + ' / ' + boss.maxHp, 0, 14);
    ctx.restore();
  }
  function drawBossName(ctx, boss, profile) {
    const r = boss.radius * (profile.radiusMul || 1.3);
    ctx.save();
    ctx.fillStyle = profile.glow;
    ctx.font = 'bold 14px system-ui';
    ctx.textAlign = 'center';
    ctx.shadowBlur = 8; ctx.shadowColor = profile.glow;
    ctx.fillText(boss.name, 0, -r - 12);
    ctx.shadowBlur = 0;
    ctx.restore();
  }
  function drawBossEffects(ctx, boss, frame, profile) {
    const r = boss.radius * (profile.radiusMul || 1.3);
    const time = frame * 0.06;
    if (profile.voidEffect) {
      const voidPulse = 0.6 + Math.sin(time * 2) * 0.3;
      ctx.globalAlpha = voidPulse * 0.3;
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = voidPulse * 0.5;
      ctx.strokeStyle = profile.glow; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, r * 0.6 * voidPulse, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (profile.shieldRing) {
      ctx.globalAlpha = 0.4 + Math.sin(time) * 0.2;
      ctx.strokeStyle = profile.glow; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, r + 15, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (profile.phaseEffect) {
      ctx.globalAlpha = 0.3 + Math.sin(time * 3) * 0.2;
      ctx.strokeStyle = profile.glow; ctx.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) {
        const a = time * 2 + i * Math.PI * 0.66;
        ctx.beginPath(); ctx.arc(Math.cos(a) * r * 0.3, Math.sin(a) * r * 0.3, r * (0.8 + i * 0.2), a, a + Math.PI); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    if (profile.rageEffect) {
      ctx.globalAlpha = 0.3 + Math.sin(time * 4) * 0.2;
      ctx.fillStyle = '#ff0000';
      ctx.beginPath(); ctx.arc(0, 0, r * (1.2 + Math.sin(time * 4) * 0.15), 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (profile.massive) {
      ctx.globalAlpha = 0.15 + Math.sin(time * 0.3) * 0.05;
      ctx.fillStyle = profile.glow;
      ctx.beginPath(); ctx.arc(0, 0, r * 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (profile.ghostly) {
      ctx.globalAlpha = 0.5 + Math.sin(time * 2) * 0.3;
      ctx.fillStyle = rgba(hexToRgb(profile.body), 0.2);
      ctx.beginPath(); ctx.arc(0, 0, r * 1.1, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
  NV.drawSpectralBoss2D = function (ctx, boss, frame, player, rhythm) {
    if (!boss || boss.dead) return false;
    const profile = resolveBossProfile(boss);
    ctx.save();
    ctx.translate(boss.x, boss.y);
    drawBossAura(ctx, boss, frame, profile);
    drawBossEffects(ctx, boss, frame, profile);
    if (boss.hitFlash > 0) {
      ctx.globalAlpha = boss.hitFlash;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(0, 0, boss.radius * (profile.radiusMul || 1.3), 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (boss.phase2) {
      ctx.strokeStyle = 'rgba(255, 95, 155, 0.85)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, boss.radius * (profile.radiusMul || 1.3) + 12 + Math.sin(frame * 0.1) * 3, 0, Math.PI * 2);
      ctx.stroke();
    }
    drawBossBody(ctx, boss, frame, profile);
    drawBossParticles(ctx, boss, frame, profile);
    drawBossEyes(ctx, boss, player, profile);
    drawBossHpBar(ctx, boss, profile);
    drawBossName(ctx, boss, profile);
    ctx.restore();
    return true;
  };
  NV.SPECTRAL_ENEMY_PROFILES = PROFILES;
  NV.SPECTRAL_ELITE_PROFILES = ELITE_PROFILES;
  NV.SPECTRAL_BOSS_PROFILES = BOSS_PROFILES;
})();

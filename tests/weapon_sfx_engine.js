// Arquitectura de SFX de armas: fidelidad estructural al laboratorio autorizado.
const fs = require('fs');
const vm = require('vm');

let pass = 0;
let fail = 0;
function t(desc, fn) {
  try { fn(); pass++; console.log('  ok  ' + desc); }
  catch (e) { fail++; console.log('  FAIL ' + desc + ' -> ' + e.message); }
}
function near(actual, expected, epsilon = 1e-6) {
  if (Math.abs(actual - expected) > epsilon) throw new Error('esperado ' + expected + ', recibido ' + actual);
}

function makeHarness() {
  const nodes = [];
  const buffers = [];
  const starts = [];
  const stops = [];
  let currentTime = 10;

  function param(owner, name) {
    return {
      value: 0,
      events: [],
      setValueAtTime(value, time) { this.value = value; this.events.push({ kind: 'set', value, time }); },
      linearRampToValueAtTime(value, time) { this.value = value; this.events.push({ kind: 'linear', value, time }); },
      exponentialRampToValueAtTime(value, time) { this.value = value; this.events.push({ kind: 'exponential', value, time }); },
      cancelScheduledValues(time) { this.events.push({ kind: 'cancel', time }); },
      owner,
      name,
    };
  }
  function node(kind) {
    const n = {
      kind,
      id: nodes.length,
      connections: [],
      connect(dest, output, input) { this.connections.push({ dest, output, input }); return dest; },
    };
    nodes.push(n);
    return n;
  }
  function timedNode(kind) {
    const n = node(kind);
    n.start = function (time, offset) { starts.push({ node: n, time, offset }); };
    n.stop = function (time) { stops.push({ node: n, time }); };
    return n;
  }

  const destination = node('destination');
  const ctx = {
    sampleRate: 44100,
    destination,
    get currentTime() { return currentTime; },
    set currentTime(v) { currentTime = v; },
    createBuffer(channels, length, sampleRate) {
      if (arguments.length !== 3) throw new TypeError('createBuffer requiere channels, length y sampleRate');
      if (sampleRate !== ctx.sampleRate) throw new Error('sampleRate de buffer no coincide con AudioContext');
      const b = { kind: 'buffer', channels, length, sampleRate, duration: length / sampleRate };
      b.data = new Float32Array(length);
      b.getChannelData = () => b.data;
      buffers.push(b);
      return b;
    },
    createBufferSource() {
      const n = timedNode('bufferSource');
      n.buffer = null;
      n.loop = false;
      n.playbackRate = param(n, 'playbackRate');
      return n;
    },
    createOscillator() {
      const n = timedNode('oscillator');
      n.type = '';
      n.frequency = param(n, 'frequency');
      n.detune = param(n, 'detune');
      return n;
    },
    createGain() {
      const n = node('gain');
      n.gain = param(n, 'gain');
      return n;
    },
    createBiquadFilter() {
      const n = node('filter');
      n.type = '';
      n.frequency = param(n, 'frequency');
      n.Q = param(n, 'Q');
      n.detune = param(n, 'detune');
      return n;
    },
    createDynamicsCompressor() {
      const n = node('compressor');
      for (const p of ['threshold', 'knee', 'ratio', 'attack', 'release']) n[p] = param(n, p);
      return n;
    },
    createWaveShaper() { const n = node('waveshaper'); n.curve = null; return n; },
    createDelay(maxDelayTime) { const n = node('delay'); n.maxDelayTime = maxDelayTime; n.delayTime = param(n, 'delayTime'); return n; },
    createChannelMerger(channels) { const n = node('merger'); n.channels = channels; return n; },
    createStereoPanner() { const n = node('panner'); n.pan = param(n, 'pan'); return n; },
  };

  const deterministicMath = Object.create(Math);
  deterministicMath.random = () => 0.5;
  const NV = {
    audioCtx: ctx,
    soundOn: true,
    channelFor: () => destination,
    panForX: (x, width) => (x / width) * 2 - 1,
  };
  const sandbox = { console, Math: deterministicMath, Float32Array, Object, Array, Number, String, Boolean, Error, NV };
  sandbox.window = { NV };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(fs.readFileSync('js/audio/weaponSfx.js', 'utf8'), sandbox, { filename: 'weaponSfx.js' });

  return { NV, ctx, nodes, buffers, starts, stops };
}

function firstSet(node, property) {
  const event = node[property].events.find((e) => e.kind === 'set');
  return event && event.value;
}
function findFilter(nodes, type, frequency) {
  return nodes.find((n) => n.kind === 'filter' && n.type === type && Math.abs(firstSet(n, 'frequency') - frequency) < 1e-6);
}
function connected(a, b) { return !!a && !!b && a.connections.some((c) => c.dest === b); }

t('presets de laboratorio exactos para las nueve armas de referencia', () => {
  const p = makeHarness().NV.WEAPON_SFX_PRESETS;
  const expected = {
    rifle: ['ballistic', .95, .25, 5500, .70, .30, .40, 5, 40],
    smg: ['ballistic', 1, .18, 4800, .55, .50, .20, 4, 30],
    shotgun: ['shotgun', .75, .32, 6500, .95, .28, .50, 7, 55],
    sniper: ['ballistic', 1, .58, 7500, .80, .15, .85, 6, 60],
    laser: ['energy', .50, .18, 3200, .20, .12, .22, 5, 15],
    plasma: ['plasma', .55, .30, 4800, .65, .18, .35, 6, 25],
    flamethrower: ['flame', .10, .55, 3000, .20, .50, .15, 5, 25],
    bow: ['bow', .03, .18, 1000, .01, .12, .18, 5, 1],
    railgun: ['railgun', 1, .50, 8500, 1, .12, .65, 7, 55],
  };
  for (const [id, values] of Object.entries(expected)) {
    const actual = p[id];
    if (!actual) throw new Error('falta preset ' + id);
    const got = [actual.type, actual.sharp, actual.tail, actual.drive, actual.thump, actual.jitter, actual.echo, actual.haas, actual.crackle];
    if (JSON.stringify(got) !== JSON.stringify(values)) throw new Error(id + ': ' + JSON.stringify(got));
  }
  const extras = {
    laser: { zapStart: 2800, zapEnd: 700, zapDur: .10, waveform: 'sawtooth' },
    plasma: { subStart: 140, subEnd: 40, burstDur: .18, sweepStart: 2200, sweepEnd: 300, resonanceQ: 10, ringFreqA: 280, ringFreqB: 305, ringDur: .15 },
    flamethrower: { whooshDur: .70, sizzleDur: .70, flameFreq: 65 },
    bow: { pluckFreq: 1300, twangFreq: 550, twangDur: .03, travelStart: 4800, travelEnd: 400, travelDur: .45 },
    railgun: { whineStart: 2200, whineEnd: 80, whineDur: .24 },
  };
  for (const [id, extra] of Object.entries(extras)) {
    if (JSON.stringify(p[id].extra) !== JSON.stringify(extra)) throw new Error(id + ' extra: ' + JSON.stringify(p[id].extra));
  }
  if (!p.pistol || p.pistol.type !== 'ballistic') throw new Error('pistol no deriva del núcleo ballistic');
  for (const key of ['outputGain', 'transientGain', 'bodyGain', 'tailGain']) {
    if (Object.values(p).some((preset) => key in preset)) throw new Error('calibración reinterpretada presente: ' + key);
  }
});

t('rifle crea crack directo y compresión paralela con ganancias del laboratorio', () => {
  const h = makeHarness();
  h.NV.audio.weaponFire('rifle', { x: 450, worldWidth: 900 });
  const crackSource = h.nodes.find((n) => n.kind === 'bufferSource' && n.buffer && Math.abs(n.buffer.duration - .006) < 1e-4);
  const crackHp = findFilter(h.nodes, 'highpass', 1500);
  const compressor = h.nodes.find((n) => n.kind === 'compressor');
  if (!connected(crackSource, crackHp)) throw new Error('crack buffer no alimenta crack HP');
  if (!connected(crackHp, compressor)) throw new Error('falta vía comprimida paralela');
  const directGain = crackHp.connections.map((c) => c.dest).find((n) => n.kind === 'gain' && Math.abs(firstSet(n, 'gain') - 11.4) < 1e-6);
  const compGain = compressor.connections.map((c) => c.dest).find((n) => n.kind === 'gain' && Math.abs(firstSet(n, 'gain') - 1.9) < 1e-6);
  if (!directGain || !compGain) throw new Error('ganancias crack 12*sharp / 2*sharp incorrectas');
  near(firstSet(compressor, 'threshold'), -40);
  near(firstSet(compressor, 'knee'), 4);
  near(firstSet(compressor, 'ratio'), 20);
  near(firstSet(compressor, 'attack'), .0005);
  near(firstSet(compressor, 'release'), .04);
});

t('rifle conserva muzzle, sub/thump, tail y boom puff del laboratorio', () => {
  const h = makeHarness();
  h.NV.audio.weaponFire('rifle');
  const muzzle = h.nodes.find((n) => n.kind === 'bufferSource' && n.buffer && n.buffer.duration > .024 && n.buffer.duration < .046);
  const muzzleLp = findFilter(h.nodes, 'lowpass', 2500);
  if (!connected(muzzle, muzzleLp)) throw new Error('falta muzzle noise → lowpass');
  const muzzleGain = muzzleLp.connections.map((c) => c.dest).find((n) => n.kind === 'gain' && firstSet(n, 'gain') === 6);
  if (!muzzleGain) throw new Error('muzzle gain no es 6.0');
  const sweep = muzzleLp.frequency.events.find((e) => e.kind === 'exponential');
  near(sweep.value, 250); near(sweep.time, 10.03);
  const sub = findFilter(h.nodes, 'bandpass', 80);
  if (!connected(muzzleLp, sub)) throw new Error('sub/thump no deriva del muzzle filter');
  const subGain = sub.connections.map((c) => c.dest).find((n) => n.kind === 'gain');
  near(firstSet(subGain, 'gain'), 4.9);
  const tailSource = h.nodes.find((n) => n.kind === 'bufferSource' && n.buffer && Math.abs(n.buffer.duration - .25) < 1e-4);
  const tailFilter = findFilter(h.nodes, 'bandpass', 600);
  if (!connected(tailSource, tailFilter)) throw new Error('falta tail noise → bandpass');
  near(firstSet(tailFilter.connections[0].dest, 'gain'), 2.5);
  const boom = h.nodes.find((n) => n.kind === 'oscillator' && n.type === 'sine' && firstSet(n, 'frequency') === 110);
  if (!boom) throw new Error('falta boom puff');
  near(firstSet(boom.connections[0].dest, 'gain'), 4 * .70 * .8);
});

t('rifle conserva crackle, split multibanda y tres WaveShapers originales', () => {
  const h = makeHarness();
  h.NV.audio.weaponFire('rifle');
  const crackleFilters = h.nodes.filter((n) => n.kind === 'filter' && n.type === 'highpass' && firstSet(n, 'frequency') > 2500);
  if (crackleFilters.length < 4) throw new Error('capa crackle ausente');
  const low = findFilter(h.nodes, 'lowpass', 200);
  const midBottom = findFilter(h.nodes, 'highpass', 200);
  const midTop = findFilter(h.nodes, 'lowpass', 2800);
  const high = findFilter(h.nodes, 'highpass', 2800);
  if (!low || !midBottom || !midTop || !high || !connected(midBottom, midTop)) throw new Error('split low/mid/high incorrecto');
  const shapers = h.nodes.filter((n) => n.kind === 'waveshaper');
  if (shapers.length !== 3) throw new Error('WaveShapers=' + shapers.length);
  if (!connected(low, shapers[0]) || !connected(midTop, shapers[1]) || !connected(high, shapers[2])) throw new Error('shapers no están en cada banda');
  for (const shaper of shapers) if (!(shaper.curve instanceof Float32Array) || shaper.curve.length !== 4096) throw new Error('curva WaveShaper inválida');
});

t('rifle conserva dos ecos acotados y Haas estéreo aleatorio', () => {
  const h = makeHarness();
  h.NV.audio.weaponFire('rifle', { x: 450, worldWidth: 900 });
  const delays = h.nodes.filter((n) => n.kind === 'delay');
  if (delays.length !== 3) throw new Error('DelayNodes=' + delays.length + ' (esperados 2 ecos + Haas)');
  const times = delays.map((d) => firstSet(d, 'delayTime')).sort((a, b) => a - b);
  near(times[0], .005); near(times[1], .045); near(times[2], .10);
  const echo1 = delays.find((d) => firstSet(d, 'delayTime') === .045);
  const echo2 = delays.find((d) => firstSet(d, 'delayTime') === .10);
  const filter1 = echo1.connections[0].dest;
  const filter2 = echo2.connections[0].dest;
  near(firstSet(filter1, 'frequency'), 2800);
  near(firstSet(filter2, 'frequency'), 1300);
  near(firstSet(filter1.connections[0].dest, 'gain'), .40 * .4);
  near(firstSet(filter2.connections[0].dest, 'gain'), .40 * .2);
  if (!h.nodes.some((n) => n.kind === 'merger' && n.channels === 2)) throw new Error('falta ChannelMerger Haas');
});

t('escopeta dispara inmediatamente y el pump solo existe en reload real', () => {
  const h = makeHarness();
  h.NV.audio.weaponFire('shotgun');
  const crackStart = h.starts.find((e) => e.node.kind === 'bufferSource' && e.node.buffer && Math.abs(e.node.buffer.duration - .006) < 1e-4);
  if (!crackStart) throw new Error('no arrancó crack de escopeta');
  near(crackStart.time, 10);
  if (h.buffers.some((b) => Math.abs(b.duration - .04) < 1e-4)) throw new Error('weaponFire programó pump/reload');
  h.NV.audio.reload('shotgun');
  if (!h.buffers.some((b) => Math.abs(b.duration - .04) < 1e-4)) throw new Error('reload real no dispara pump');
});

t('SMG mantiene ataque balístico y solo adapta capas decorativas en ráfaga', () => {
  const h = makeHarness();
  h.NV.audio.weaponFire('smg');
  const firstCompressors = h.nodes.filter((n) => n.kind === 'compressor').length;
  const firstShapers = h.nodes.filter((n) => n.kind === 'waveshaper').length;
  h.ctx.currentTime = 10.05;
  h.NV.audio.weaponFire('smg');
  if (h.nodes.filter((n) => n.kind === 'compressor').length !== firstCompressors + 1) throw new Error('ráfaga perdió crack comprimido');
  if (h.nodes.filter((n) => n.kind === 'waveshaper').length !== firstShapers + 3) throw new Error('ráfaga perdió cuerpo multibanda');
});

t('plasma no crea doble disparo desde audio y no usa temporizadores', () => {
  const h = makeHarness();
  h.NV.audio.weaponFire('plasma');
  const stats = h.NV.audio.getWeaponSfxStats();
  if (stats.byWeapon.plasma.shots !== 1) throw new Error('audio creó más de un evento plasma');
  const burstSource = h.nodes.find((n) => n.kind === 'bufferSource' && n.buffer && Math.abs(n.buffer.duration - .18) < 1e-4);
  const burstBandpass = findFilter(h.nodes, 'bandpass', 2200);
  if (!connected(burstSource, burstBandpass)) throw new Error('plasma omite el band-pass de barrido del laboratorio');
  const burstShaper = burstBandpass.connections.map((c) => c.dest).find((n) => n.kind === 'waveshaper');
  if (!burstShaper) throw new Error('plasma omite saturación después del barrido');
  const src = fs.readFileSync('js/audio/weaponSfx.js', 'utf8');
  if (/doubleShot|doubleGap|setTimeout|setInterval/.test(src)) throw new Error('audio programa mecánicas/duplicados');
});

t('lanzallamas es una voz continua idempotente hasta weaponStop', () => {
  const h = makeHarness();
  h.NV.audio.weaponFire('flamethrower');
  const nodeCount = h.nodes.length;
  const ignitionStops = h.stops.length;
  if (!h.NV.audio.getWeaponSfxStats().continuous) throw new Error('voz no quedó activa');
  if (h.NV.audio.getWeaponSfxStats().flameIgnitions !== 1) throw new Error('ignición inicial no fue única');
  h.ctx.currentTime = 11;
  h.NV.audio.weaponFire('flamethrower');
  if (h.nodes.length !== nodeCount) throw new Error('cada tick recrea el grafo flame');
  if (h.stops.length !== ignitionStops) throw new Error('la voz se autoextingue antes de weaponStop');
  if (h.NV.audio.getWeaponSfxStats().flameIgnitions !== 1) throw new Error('sustain repitió la ignición');
  h.NV.audio.weaponStop('flamethrower');
  if (h.NV.audio.getWeaponSfxStats().continuous) throw new Error('weaponStop no liberó la voz');
  const releaseStops = h.stops.slice(ignitionStops);
  if (releaseStops.length !== 5) throw new Error('weaponStop no detuvo todas las fuentes persistentes');
  for (const stop of releaseStops) near(stop.time, 11.15);
});

t('lanzallamas libera por pausa, cambio de estado, hidden y watchdog', () => {
  const reasons = [
    { env: { state: 'playing', paused: true, hidden: false }, label: 'pausa' },
    { env: { state: 'shop', paused: false, hidden: false }, label: 'estado' },
    { env: { state: 'playing', paused: false, hidden: true }, label: 'hidden' },
  ];
  for (const reason of reasons) {
    const h = makeHarness();
    h.NV.audio.weaponStart('flamethrower');
    h.NV.audio.update(reason.env);
    if (h.NV.audio.getWeaponSfxStats().continuous) throw new Error(reason.label + ' no liberó la voz');
  }
  const h = makeHarness();
  h.NV.audio.weaponStart('flamethrower');
  h.ctx.currentTime = 10.41;
  h.NV.audio.update({ state: 'playing', paused: false, hidden: false });
  if (h.NV.audio.getWeaponSfxStats().continuous) throw new Error('watchdog no liberó la voz');
});

t('lanzallamas usa ruido filtrado suave sin waveshaper ni crackle', () => {
  const h = makeHarness();
  h.NV.audio.weaponStart('flamethrower');
  if (h.nodes.some((n) => n.kind === 'waveshaper')) throw new Error('flame usa distorsión');
  const looped = h.nodes.filter((n) => n.kind === 'bufferSource' && n.loop);
  if (looped.length !== 2) throw new Error('sustain no tiene exactamente dos capas de ruido');
  const filters = h.nodes.filter((n) => n.kind === 'filter');
  const maxQ = Math.max.apply(null, filters.map((n) => firstSet(n, 'Q') || 0));
  if (maxQ > 0.6) throw new Error('resonancia flame excesiva: Q=' + maxQ);
});

t('mute es autoritativo y no crea nodos de arma', () => {
  const h = makeHarness();
  const before = h.nodes.length;
  h.NV.soundOn = false;
  h.NV.audio.weaponFire('rifle');
  h.NV.audio.weaponStart('flamethrower');
  h.NV.audio.reload('shotgun');
  if (h.nodes.length !== before) throw new Error('mute creó nodos');
});

t('gameplay conserva cadencia/proyectiles y audio consume un único evento', () => {
  const audio = fs.readFileSync('js/audio/weaponSfx.js', 'utf8');
  const engine = fs.readFileSync('js/engine/weapons.js', 'utf8');
  const game = fs.readFileSync('js/game.js', 'utf8');
  if (!engine.includes('state.playWeaponSound(weapon, audioEvent)')) throw new Error('falta evento descriptivo post-proyectil');
  if ((engine.match(/state\.playWeaponSound\(/g) || []).length !== 1) throw new Error('audio se emite más de una vez por acción');
  if (!game.includes('NV.inputIntent.advanceFireCadence(') || !game.includes('weaponFireInterval(), MIN_FIRE_INTERVAL')) throw new Error('gameplay ya no controla cadencia');
  if (/setTimeout|setInterval|doubleShot|doubleGap/.test(audio)) throw new Error('audio contiene scheduling de gameplay');
});

t('fallo de audio no aborta el proyectil ya creado', () => {
  const source = fs.readFileSync('js/engine/weapons.js', 'utf8');
  const bullets = [];
  const target = { x: 100, y: 0 };
  const weapon = { id: 'pistol', count: 1, spread: 0, range: 500, damage: 10, speed: 100, color: '#fff' };
  const sandbox = {
    console: { error() { throw new Error('debug logging should be opt-in'); } },
    window: { NV: null },
    NV: {
      BALANCE: { CRIT_PERM_CHANCE: 0 },
      DEBUG_AUDIO: false,
      findTarget: ({ enemies }) => enemies[0],
      weaponFusionDamage: (base) => base,
      weaponImpactProfile: () => ({ type: 'direct', pierce: 1 }),
      bulletSizeGrowth: () => 0,
      waveWeaponMult: () => 1,
      weaponLevelDamageBonus: () => 0,
    },
  };
  sandbox.window.NV = sandbox.NV;
  vm.runInNewContext(source, sandbox, { filename: 'weapons.js' });
  sandbox.NV.shoot({
    player: { x: 0, y: 0, luck: 0, overdrive: 0 },
    enemies: [target], boss: null, bullets, currentWeapon: weapon,
    currentWeaponLevel: () => 1, weaponVisualTier: () => 0,
    BULLET_TIER_COLORS: ['#fff'], MAX_BULLETS: 10,
    permDamageBonus: 0, currentWeaponFusion: 0, fusionStep: 0.2,
    wave: 1, W: 900, playWeaponSound: () => { throw new Error('synthetic audio failure'); },
  });
  if (bullets.length !== 1) throw new Error('el fallo de audio eliminó o evitó el proyectil');
});

console.log('\nRESULT weapon_sfx_engine: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
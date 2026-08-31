// DIAGNÓSTICO Bloque 4a: participación escalonada + bandas por enemigo.
// Uso: node tools/diagnostics/rhythm_diag_jitter.js
const fs = require('fs'), vm = require('vm');
const sbx = { window: { NV: {} }, navigator: { mediaDevices: {} }, localStorage: { getItem(){return null}, setItem(){}, removeItem(){} }, console, Uint8Array, Promise, Math };
vm.createContext(sbx);
vm.runInContext(fs.readFileSync('js/render/enemies.js', 'utf8'), sbx);
vm.runInContext(fs.readFileSync('js/engine/rhythm.js', 'utf8'), sbx);
const NV = sbx.window.NV;

const mk = (i) => ({ x: (i * 53) % 900, y: (i * 137) % 520, radius: 10, color: '#fff', shape: 'dot' });
const mkCtx = () => ({ translations: [], save(){}, restore(){}, translate(x, y){ this.translations.push({ x, y }); }, beginPath(){}, arc(){}, fill(){}, stroke(){}, ellipse(){}, lineTo(){}, moveTo(){}, closePath(){}, fillStyle: '', strokeStyle: '', lineWidth: 1, shadowBlur: 0, shadowColor: '', globalAlpha: 1 });
const N = 300;

function run(name, r) {
  let act = 0;
  const amps = [], bands = { sub: 0, graves: 0, medios: 0, agudos: 0 };
  for (let i = 0; i < N; i++) {
    const e = mk(i);
    bands[NV.enemyRhythmBand(e)]++;
    const c = mkCtx();
    NV.drawEnemy(c, e, 12, null, r);
    const t = c.translations[0];
    if (t && (t.x !== e.x || t.y !== e.y)) { act++; amps.push(Math.hypot(t.x - e.x, t.y - e.y)); }
  }
  const m = amps.length ? amps.reduce((a, b) => a + b, 0) / amps.length : 0;
  const sd = amps.length ? Math.sqrt(amps.reduce((a, b) => a + (b - m) ** 2, 0) / amps.length) : 0;
  const bd = Object.entries(bands).map(([k, v]) => k + ' ' + (v / N * 100).toFixed(0) + '%').join(' | ');
  console.log(name);
  console.log('  participantes=' + (act / N * 100).toFixed(1) + '%  amp media=' + m.toFixed(2) + 'px  pico=' + (amps.length ? Math.max(...amps) : 0).toFixed(2) + 'px  sd=' + sd.toFixed(2) + 'px  (unicos=' + new Set(amps.map((a) => a.toFixed(2))).size + ')');
  console.log('  dist bandas: ' + bd);
  return { pct: act / N, sd };
}

const base = { enabled: true, state: 'listening' };
run('DIST banda (rhythm intenso):', Object.assign({}, base, { onset: 1, kick: .9, snare: .8, hats: .8, bass: .9, mids: .8, highs: .8, energy: .7 }));
run('PERFIL lofi-suave :', Object.assign({}, base, { onset: .15, kick: .1, snare: .05, hats: .05, bass: .2, mids: .15, highs: .1, energy: .2 }));
run('PERFIL techno-medio:', Object.assign({}, base, { onset: .5, kick: .6, snare: .2, hats: .3, bass: .6, mids: .3, highs: .25, energy: .45 }));
run('PERFIL deathcore   :', Object.assign({}, base, { onset: .9, kick: .9, snare: .8, hats: .8, bass: .9, mids: .8, highs: .8, energy: .7 }));
run('PERFIL solo-agudos :', Object.assign({}, base, { onset: .2, kick: 0, snare: 0, hats: .95, bass: 0, mids: 0, highs: .95, energy: .4 }));

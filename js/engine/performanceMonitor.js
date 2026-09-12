// ===== ENGINE: monitor de performance (P2 Performance Foundation) =====
// Observa SIN tocar gameplay: frame/update/draw con ring buffers preasignados
// (cero allocations por frame, sin shift(), sin sort por frame). Los percentiles
// p50/p95/p99/worst se recalculan a frecuencia baja (caché ~250ms). La decisión
// de degradación vive en js/render/visualBudget.js, no aquí.
(() => {
  'use strict';
  const NV = window.NV = window.NV || {};

  const WINDOW = 240;               // ~4s de historia a 60fps
  const COMPUTE_INTERVAL_MS = 250;  // percentiles recalculados máx 4 veces/segundo
  const MS_16_7 = 1000 / 60;
  const MS_25 = 25;
  const MS_33 = 1000 / 30;

  // Buffers preasignados: nunca crecen, nunca se realocan.
  const frameBuf = new Float32Array(WINDOW);
  const updateBuf = new Float32Array(WINDOW);
  const drawBuf = new Float32Array(WINDOW);
  const scratch = new Float32Array(WINDOW); // copia de trabajo para sort (preasignada)

  let sampleN = 0;          // muestras válidas (0..WINDOW)
  let fIdx = 0, uIdx = 0, dIdx = 0;
  let worstFrame = 0, worstUpdate = 0, worstDraw = 0;
  let lastCompute = -1e9;
  let cached = null;
  let telemetryProvider = null;
  let debugOn = false, lastDebugLog = 0;

  function clampMs(v) {
    if (!Number.isFinite(v) || v < 0) return 0;
    return v > 1000 ? 1000 : v; // pausas/tab-switch no contaminan los percentiles
  }
  function push(buf, idx, val) { buf[idx] = val; return (idx + 1) % WINDOW; }
  function pct(sorted, n, p) {
    if (n <= 0) return 0;
    return sorted[Math.min(n - 1, Math.max(0, Math.round(p * (n - 1))))];
  }
  function stats(buf, count) {
    if (count <= 0) return { p50: 0, p95: 0, p99: 0, worst: 0, mean: 0 };
    for (let i = 0; i < count; i++) scratch[i] = buf[i];
    const view = scratch.subarray(0, count);
    view.sort(); // sort numérico de TypedArray, solo en recompute (≤4Hz, ≤240 elems)
    let sum = 0;
    for (let i = 0; i < count; i++) sum += buf[i];
    return {
      p50: pct(view, count, 0.5),
      p95: pct(view, count, 0.95),
      p99: pct(view, count, 0.99),
      worst: view[count - 1],
      mean: sum / count,
    };
  }

  NV.performanceMonitor = {
    // Una llamada por frame (desde el loop). frameMs = intervalo real entre rAF.
    record(frameMs, updateMs, drawMs) {
      frameMs = clampMs(frameMs); updateMs = clampMs(updateMs); drawMs = clampMs(drawMs);
      fIdx = push(frameBuf, fIdx, frameMs);
      uIdx = push(updateBuf, uIdx, updateMs);
      dIdx = push(drawBuf, dIdx, drawMs);
      if (sampleN < WINDOW) sampleN++;
      if (frameMs > worstFrame) worstFrame = frameMs;
      if (updateMs > worstUpdate) worstUpdate = updateMs;
      if (drawMs > worstDraw) worstDraw = drawMs;
      cached = null;
      if (debugOn) {
        const now = Date.now();
        if (now - lastDebugLog >= 2000) { // log throttleado, nunca por frame
          lastDebugLog = now;
          const s = this.getSnapshot();
          console.log('[perf] p50=' + s.frame.p50.toFixed(1) + ' p95=' + s.frame.p95.toFixed(1) +
            ' p99=' + s.frame.p99.toFixed(1) + ' worst=' + s.frame.worst.toFixed(1) +
            ' upd=' + s.update.p95.toFixed(2) + ' draw=' + s.draw.p95.toFixed(2));
        }
      }
    },
    setTelemetryProvider(fn) { telemetryProvider = typeof fn === 'function' ? fn : null; },
    getSnapshot() {
      const now = Date.now();
      if (cached && now - lastCompute < COMPUTE_INTERVAL_MS) return cached;
      lastCompute = now;
      const count = sampleN;
      let a16 = 0, a25 = 0, a33 = 0;
      for (let i = 0; i < count; i++) {
        const v = frameBuf[i];
        if (v > MS_33) { a33++; a25++; a16++; }
        else if (v > MS_25) { a25++; a16++; }
        else if (v > MS_16_7) { a16++; }
      }
      cached = {
        ts: now,
        frames: count,
        frame: stats(frameBuf, count),
        update: stats(updateBuf, count),
        draw: stats(drawBuf, count),
        framesAbove16_7: a16,
        framesAbove25: a25,
        framesAbove33: a33,
        worstSinceReset: { frame: worstFrame, update: worstUpdate, draw: worstDraw },
        telemetry: telemetryProvider ? telemetryProvider() : null,
      };
      return cached;
    },
    reset() {
      frameBuf.fill(0); updateBuf.fill(0); drawBuf.fill(0); scratch.fill(0);
      sampleN = 0; fIdx = uIdx = dIdx = 0;
      worstFrame = worstUpdate = worstDraw = 0;
      cached = null; lastCompute = -1e9;
    },
    get windowFrames() { return sampleN; },
    get debug() { return debugOn; },
  };

  // Consola/tests/harness. Sin HUD permanente en P2.
  NV.togglePerformanceDebug = function (force) {
    debugOn = typeof force === 'boolean' ? force : !debugOn;
    return debugOn;
  };
})();

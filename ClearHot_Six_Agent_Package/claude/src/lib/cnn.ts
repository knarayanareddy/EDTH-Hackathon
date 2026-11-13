// CNN exploration (TensorFlow.js). Trains ONLY on SIMULATED corruption of SIMULATED scenes.
// A model trained here is a software demonstration, not a validated model for real sensor data.
import type * as TF from '@tensorflow/tfjs';
import { corruptFrame, mulberry32, trainScene } from './synth';
import { percentileSample, lineGeom, medianOf, type Orient } from './dsp';

export type Variant = 'A' | 'B' | 'C';
export type CnnKind = 'dncnn' | 'profile1d' | 'directional';
export const KIND_OF: Record<Variant, CnnKind> = { A: 'dncnn', B: 'profile1d', C: 'directional' };
export const KIND_LABEL: Record<CnnKind, string> = {
  dncnn: 'DnCNN-lite residual (5×conv 3×3, 8 ch, MSE)',
  profile1d: '1-D profile CNN (3×conv1d k=17, column/row offsets, Huber)',
  directional: 'Directional stripe-kernel CNN (15×1 / 1×15 kernels, L1 + gradient loss)',
};
export const S = 100; // ADU normalisation scale for network IO

let tfMod: typeof TF | null = null;
export async function getTf() {
  if (!tfMod) {
    tfMod = await import('@tensorflow/tfjs');
    try { await tfMod.setBackend('webgl'); } catch { /* fall back */ }
    await tfMod.ready();
    if (tfMod.getBackend() !== 'webgl') { await tfMod.setBackend('cpu'); await tfMod.ready(); }
  }
  return tfMod;
}

export interface TrainedCnn {
  kind: CnnKind; model: TF.LayersModel; backend: string; steps: number;
  loss: number[]; val: { step: number; v: number }[]; params: number; macsPerPx: number; trainSeconds: number; savedAt: number;
}
const registry: Partial<Record<Variant, TrainedCnn>> = {};
const listeners = new Set<() => void>();
export const getCnn = (v: Variant) => registry[v];
export const setCnn = (v: Variant, m: TrainedCnn | undefined) => { if (m) registry[v] = m; else delete registry[v]; listeners.forEach((f) => f()); };
export const subscribeCnn = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };

/** Shared 1-D feature: robust wide-reference residual profile (used identically in training and inference). */
export function profileFeature(img: Float32Array, W: number, H: number, o: Orient, R = 8, clipE = 150): Float32Array {
  const { nL, nA, ls, as } = lineGeom(o, W, H);
  const prof = new Float32Array(nL), buf = new Float32Array(nA);
  for (let l = 0; l < nL; l++) {
    let cnt = 0; const j0 = Math.max(0, l - R), j1 = Math.min(nL - 1, l + R);
    for (let t = 0; t < nA; t++) {
      const p = t * as; let s = 0, c = 0;
      for (let j = j0; j <= j1; j++) { if (j === l) continue; s += img[j * ls + p]; c++; }
      const e = img[l * ls + p] - s / c;
      if (Math.abs(e) <= clipE) buf[cnt++] = e;
    }
    prof[l] = medianOf(buf, cnt);
  }
  return prof;
}

function build(tf: typeof TF, kind: CnnKind): TF.LayersModel {
  if (kind === 'dncnn') {
    const inp = tf.input({ shape: [null, null, 1] });
    let x: TF.SymbolicTensor = inp;
    for (let i = 0; i < 4; i++) x = tf.layers.conv2d({ filters: 8, kernelSize: 3, padding: 'same', activation: 'relu' }).apply(x) as TF.SymbolicTensor;
    const out = tf.layers.conv2d({ filters: 1, kernelSize: 3, padding: 'same' }).apply(x) as TF.SymbolicTensor;
    return tf.model({ inputs: inp, outputs: out });
  }
  if (kind === 'profile1d') {
    const inp = tf.input({ shape: [null, 1] });
    let x: TF.SymbolicTensor = inp;
    // (tfjs cannot back-propagate through dilated convolutions, so a wide plain kernel stack is used: receptive field 49)
    for (let i = 0; i < 3; i++) x = tf.layers.conv1d({ filters: 16, kernelSize: 17, padding: 'same', activation: 'relu' }).apply(x) as TF.SymbolicTensor;
    const out = tf.layers.conv1d({ filters: 1, kernelSize: 1 }).apply(x) as TF.SymbolicTensor;
    return tf.model({ inputs: inp, outputs: out });
  }
  const inp = tf.input({ shape: [null, null, 1] });
  const c2 = (f: number, k: [number, number], a?: 'relu') => tf.layers.conv2d({ filters: f, kernelSize: k, padding: 'same', activation: a });
  // column-stripe branch (tall kernels average along the stripe, wide kernel compares neighbours)
  let a = c2(8, [15, 1], 'relu').apply(inp) as TF.SymbolicTensor;
  a = c2(8, [15, 1], 'relu').apply(a) as TF.SymbolicTensor;
  a = c2(8, [1, 7], 'relu').apply(a) as TF.SymbolicTensor;
  a = c2(1, [1, 1]).apply(a) as TF.SymbolicTensor;
  // row-stripe branch
  let b = c2(8, [1, 15], 'relu').apply(inp) as TF.SymbolicTensor;
  b = c2(8, [1, 15], 'relu').apply(b) as TF.SymbolicTensor;
  b = c2(8, [7, 1], 'relu').apply(b) as TF.SymbolicTensor;
  b = c2(1, [1, 1]).apply(b) as TF.SymbolicTensor;
  // small isotropic branch for random noise
  let n = c2(4, [3, 3], 'relu').apply(inp) as TF.SymbolicTensor;
  n = c2(1, [1, 1]).apply(n) as TF.SymbolicTensor;
  const out = tf.layers.add().apply([a, b, n]) as TF.SymbolicTensor;
  return tf.model({ inputs: inp, outputs: out });
}

function macsPerPx(model: TF.LayersModel) {
  let m = 0;
  for (const l of model.layers) {
    const c = l.getConfig() as { kernelSize?: number | number[]; filters?: number };
    if (c.kernelSize && c.filters) {
      const ks = Array.isArray(c.kernelSize) ? c.kernelSize.reduce((p, q) => p * q, 1) : c.kernelSize;
      const inShape = l.inputSpec?.[0]?.axes; void inShape;
      const shp = (l.input as TF.SymbolicTensor).shape; const cin = shp[shp.length - 1] as number;
      m += ks * cin * c.filters;
    }
  }
  return m;
}

// ---------- training data (scene-wise splits by seed range) ----------
export const SEEDS = { train: 1000, val: 9000, bench: 50000 };
const SZ = 256;
const poolCache = new Map<string, Float32Array[]>();
function pool(start: number, n: number) {
  const k = `${start}:${n}`;
  let p = poolCache.get(k);
  if (!p) { p = []; for (let i = 0; i < n; i++) p.push(trainScene(start + i, SZ, SZ)); poolCache.set(k, p); }
  return p;
}

function sampleCorruptionParams(rng: () => number) {
  const mode = rng();
  const v = mode < 0.45 || mode > 0.8 ? rng() * 55 : 0;
  const h = mode > 0.35 && mode < 0.8 ? rng() * 55 : 0;
  const per = rng() < 0.2 ? rng() * 35 : 0;
  return { v: v + (v + h === 0 ? 20 : 0), h, per, period: 4 + rng() * 10, sigma: 3 + rng() * 16, badPx: false };
}

function batch2D(tf: typeof TF, scenes: Float32Array[], B: number, P: number, rng: () => number) {
  const xs = new Float32Array(B * P * P), ys = new Float32Array(B * P * P);
  for (let b = 0; b < B; b++) {
    const sc = scenes[Math.floor(rng() * scenes.length)];
    const x0 = Math.floor(rng() * (SZ - P)), y0 = Math.floor(rng() * (SZ - P));
    const clean = new Float32Array(P * P);
    for (let y = 0; y < P; y++) for (let x = 0; x < P; x++) clean[y * P + x] = sc[(y0 + y) * SZ + x0 + x];
    if (rng() < 0.15) { const cx = 4 + Math.floor(rng() * (P - 8)), cy = 4 + Math.floor(rng() * (P - 8)); for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) clean[(cy + dy) * P + cx + dx] += 2000; }
    const cp = sampleCorruptionParams(rng);
    const { raw } = corruptFrame(clean, P, P, cp, Math.floor(rng() * 1e6), Math.floor(rng() * 1e6));
    const tmp = Float32Array.from(raw); const med = medianOf(tmp, tmp.length);
    for (let i = 0; i < P * P; i++) { xs[b * P * P + i] = Math.max(-6, Math.min(6, (raw[i] - med) / S)); ys[b * P * P + i] = (raw[i] - clean[i]) / S; }
  }
  return { xs: tf.tensor4d(xs, [B, P, P, 1]), ys: tf.tensor4d(ys, [B, P, P, 1]) };
}

function batchProfile(tf: typeof TF, scenes: Float32Array[], B: number, rng: () => number) {
  const xs = new Float32Array(B * SZ), ys = new Float32Array(B * SZ);
  for (let b = 0; b < B; b++) {
    const clean = scenes[Math.floor(rng() * scenes.length)];
    const o: Orient = rng() < 0.5 ? 'col' : 'row';
    const cp = sampleCorruptionParams(rng);
    const { raw, colOff, rowOff } = corruptFrame(clean, SZ, SZ, { ...cp, v: o === 'col' ? cp.v || 25 : 0, h: o === 'row' ? cp.v || 25 : 0 }, Math.floor(rng() * 1e6), Math.floor(rng() * 1e6));
    const off = o === 'col' ? colOff : rowOff;
    const f = profileFeature(Float32Array.from(raw), SZ, SZ, o);
    let m = 0; for (let i = 0; i < SZ; i++) m += off[i]; m /= SZ;
    for (let i = 0; i < SZ; i++) { xs[b * SZ + i] = f[i] / S; ys[b * SZ + i] = (off[i] - m) / S; }
  }
  return { xs: tf.tensor3d(xs, [B, SZ, 1]), ys: tf.tensor3d(ys, [B, SZ, 1]) };
}

export interface Progress { step: number; steps: number; loss: number; val?: number; msPerStep: number; backend: string }

export async function trainCnn(kind: CnnKind, o: { steps: number; batch: number; lr: number; seed: number; onProgress: (p: Progress, h: { loss: number[]; val: { step: number; v: number }[] }) => void; shouldStop: () => boolean }): Promise<TrainedCnn> {
  const tf = await getTf();

  const model = build(tf, kind);
  const huber = (yT: TF.Tensor, yP: TF.Tensor) => tf.losses.huberLoss(yT, yP, undefined, 0.3);
  const gradL1 = (yT: TF.Tensor, yP: TF.Tensor) => tf.tidy(() => {
    const l1 = tf.mean(tf.abs(tf.sub(yT, yP)));
    const d = tf.sub(yT, yP);
    const gx = tf.abs(tf.sub(d.slice([0, 0, 1, 0], [-1, -1, -1, -1]), d.slice([0, 0, 0, 0], [-1, -1, (d.shape[2] as number) - 1, -1])));
    const gy = tf.abs(tf.sub(d.slice([0, 1, 0, 0], [-1, -1, -1, -1]), d.slice([0, 0, 0, 0], [-1, (d.shape[1] as number) - 1, -1, -1])));
    return tf.add(l1, tf.mul(tf.scalar(0.5), tf.add(tf.mean(gx), tf.mean(gy))));
  });
  model.compile({ optimizer: tf.train.adam(o.lr), loss: kind === 'dncnn' ? 'meanSquaredError' : kind === 'profile1d' ? huber : gradL1 });
  const trainScenes = pool(SEEDS.train, 24), valScenes = pool(SEEDS.val, 8);
  const rng = mulberry32(o.seed), vrng = mulberry32(777);
  const mk = (sc: Float32Array[], r: () => number, B: number) => (kind === 'profile1d' ? batchProfile(tf, sc, B, r) : batch2D(tf, sc, B, 64, r));
  const vb = mk(valScenes, vrng, 8);
  const loss: number[] = [], val: { step: number; v: number }[] = [];
  const t0 = performance.now(); let tl = t0;
  let done = 0;
  for (let s = 1; s <= o.steps; s++) {
    if (o.shouldStop()) break;
    const b = mk(trainScenes, rng, o.batch);
    const l = (await model.trainOnBatch(b.xs, b.ys)) as number;
    b.xs.dispose(); b.ys.dispose();
    loss.push(l); done = s;
    let v: number | undefined;
    if (s % 20 === 0 || s === o.steps) {
      const r = model.evaluate(vb.xs, vb.ys, { batchSize: 8 }) as TF.Scalar; v = (await r.data())[0]; r.dispose(); val.push({ step: s, v });
    }
    if (s % 4 === 0 || s === o.steps) {
      const now = performance.now();
      o.onProgress({ step: s, steps: o.steps, loss: l, val: v, msPerStep: (now - tl) / 4, backend: tf.getBackend() }, { loss, val }); tl = now;
      await tf.nextFrame();
    }
  }
  vb.xs.dispose(); vb.ys.dispose();
  const m: TrainedCnn = { kind, model, backend: tf.getBackend(), steps: done, loss, val, params: model.countParams(), macsPerPx: macsPerPx(model), trainSeconds: (performance.now() - t0) / 1000, savedAt: Date.now() };
  return m;
}

export async function cnnRestore(m: TrainedCnn, img: Float32Array, W: number, H: number, strength: number): Promise<Float32Array> {
  const tf = await getTf();
  const out = Float32Array.from(img);
  const med = percentileSample(img, 0.5, 5);
  if (m.kind === 'profile1d') {
    for (const o of ['col', 'row'] as Orient[]) {
      const f = profileFeature(out, W, H, o);
      const L = f.length;
      const inp = new Float32Array(L); for (let i = 0; i < L; i++) inp[i] = f[i] / S;
      const res = tf.tidy(() => m.model.predict(tf.tensor3d(inp, [1, L, 1])) as TF.Tensor);
      const d = await res.data(); res.dispose();
      let mean = 0; for (let i = 0; i < L; i++) mean += d[i]; mean /= L;
      const off = new Float32Array(L); for (let i = 0; i < L; i++) off[i] = (d[i] - mean) * S * strength;
      if (o === 'col') for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) out[y * W + x] -= off[x];
      else for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) out[y * W + x] -= off[y];
    }
    return out;
  }
  const inp = new Float32Array(W * H);
  for (let i = 0; i < inp.length; i++) inp[i] = Math.max(-6, Math.min(6, (img[i] - med) / S));
  const res = tf.tidy(() => m.model.predict(tf.tensor4d(inp, [1, H, W, 1])) as TF.Tensor);
  const d = await res.data(); res.dispose();
  for (let i = 0; i < out.length; i++) if (Math.abs(img[i] - med) < 5.9 * S) out[i] = img[i] - strength * S * d[i];
  return out;
}

// ---------- persistence (IndexedDB via tfjs) ----------
export async function saveCnn(v: Variant, m: TrainedCnn) {
  try {
    await m.model.save(`indexeddb://clearhot-${v}`);
    localStorage.setItem(`clearhot-meta-${v}`, JSON.stringify({ steps: m.steps, loss: m.loss.filter((_, i) => i % Math.max(1, Math.floor(m.loss.length / 200)) === 0), val: m.val, trainSeconds: m.trainSeconds, savedAt: Date.now() }));
  } catch { /* storage unavailable */ }
}
export async function loadSavedCnn(v: Variant): Promise<TrainedCnn | null> {
  try {
    const meta = localStorage.getItem(`clearhot-meta-${v}`);
    if (!meta) return null;
    const tf = await getTf();
    const model = await tf.loadLayersModel(`indexeddb://clearhot-${v}`);
    const mt = JSON.parse(meta);
    return { kind: KIND_OF[v], model, backend: tf.getBackend(), steps: mt.steps, loss: mt.loss, val: mt.val, params: model.countParams(), macsPerPx: macsPerPx(model), trainSeconds: mt.trainSeconds, savedAt: mt.savedAt };
  } catch { return null; }
}


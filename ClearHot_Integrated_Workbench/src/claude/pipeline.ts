// ClearHot pipelines. 'O' = faithful port of the existing ClearHot Lab pipeline (baseline).
// 'A' / 'B' / 'C' = the same stages + three different technique packs.
import {
  applyLineOffsets, bilateral5, boxBlur, clahe, estimateLineOffsetsLocal, estimateLineOffsetsSpectral,
  guidedSelf, noiseSigma, percentileSample, robustBadPixels,
} from './dsp';
import { cnnRestore, getCnn, type Variant } from './cnn-disabled';

export type PVariant = 'O' | Variant;

export interface Cfg {
  // --- original stages / controls ---
  stage1: boolean; stage2: boolean; stage3: boolean; stage4: boolean; spatialOnly: boolean;
  split: number; agcSlew: number; detailGain: number; vStr: number; hStr: number;
  // --- technique selection ---
  lineMethod: 'orig' | 'new' | 'off';
  badPixel: 'orig' | 'robust';
  detailMethod: 'orig' | 'guided' | 'multiscale';
  toneMode: 'quantile' | 'plateau';
  // --- CNN ---
  cnn: boolean; cnnStrength: number;
  // --- A ---
  clahe: boolean; claheClip: number; claheAmount: number;
  // --- B ---
  fpnPixel: number; window: number; tdenoise: boolean; tdStrength: number; pheAmount: number; plateau: number; coring: number;
  // --- C ---
  specMode: 'both' | 'broadband' | 'peaks'; specCutoff: number; specPeak: number; bilateral: boolean; bilStrength: number; baseCompress: number;
}

const BASE: Cfg = {
  stage1: true, stage2: true, stage3: true, stage4: true, spatialOnly: true,
  split: 50, agcSlew: 18, detailGain: 1.4, vStr: 0.65, hStr: 0,
  lineMethod: 'orig', badPixel: 'orig', detailMethod: 'orig', toneMode: 'quantile',
  cnn: false, cnnStrength: 1,
  clahe: false, claheClip: 3, claheAmount: 0.5,
  fpnPixel: 0.5, window: 12, tdenoise: false, tdStrength: 0.5, pheAmount: 0.6, plateau: 6, coring: 1.5,
  specMode: 'both', specCutoff: 0.02, specPeak: 4, bilateral: false, bilStrength: 0.6, baseCompress: 0.15,
};
export function defaultCfg(v: PVariant): Cfg {
  if (v === 'O') return { ...BASE };
  const shared = { ...BASE, lineMethod: 'new' as const, badPixel: 'robust' as const, vStr: 1, hStr: 1 };
  if (v === 'A') return { ...shared, clahe: true };
  if (v === 'B') return { ...shared, detailMethod: 'guided', toneMode: 'plateau', tdenoise: true };
  return { ...shared, detailMethod: 'multiscale', bilateral: true };
}

export interface PState {
  lastKey: string; hasPrev: boolean; hasPrevB: boolean;
  lo: number; hi: number; loB: number; hiB: number;
  prevNorm: Float32Array | null; prevNormB: Float32Array | null;
  lut: Float32Array | null; lutB: Float32Array | null;
}
export const newState = (): PState => ({ lastKey: '', hasPrev: false, hasPrevB: false, lo: 7100, hi: 7950, loB: 7100, hiB: 7950, prevNorm: null, prevNormB: null, lut: null, lutB: null });

export interface FrameCtx {
  raw: Uint16Array; W: number; H: number; key: string; idx: number; total: number;
  /** true when this frame does not directly follow the previously processed one (seek, new file, first frame) */
  reset: boolean;
  getFrame: (i: number) => Promise<Uint16Array | null>;
}
export interface Timings { lines: number; cnn: number; denoise: number; tone: number; detail: number; total: number }
export interface Result {
  out8: Uint8ClampedArray; base8: Uint8ClampedArray; restored: Float32Array; rMin: number; rMax: number;
  pLow: number; pHigh: number; sigma: number; conf: number; timings: Timings; usedCnn: boolean; notes: string[];
}

// ---------------- original stages (ported 1:1 from ThermalClearHotView.tsx) ----------------
function origStage1(raw: Float32Array, W: number, H: number, vS: number, hS: number): Float32Array {
  const out = Float32Array.from(raw);
  const colBias = new Float32Array(W); let globalMed = 0;
  for (let x = 0; x < W; x++) {
    let sum = 0, cnt = 0;
    for (let y = 16; y < H - 16; y += 4) { const v = raw[y * W + x]; if (v > 1000 && v < 12000) { sum += v; cnt++; } }
    colBias[x] = cnt > 0 ? sum / cnt : 7200; globalMed += colBias[x];
  }
  globalMed /= W;
  const rowMean = new Float32Array(H);
  for (let y = 0; y < H; y++) { let s = 0; for (let x = 0; x < W; x += 4) s += raw[y * W + x]; rowMean[y] = s / Math.ceil(W / 4); }
  const rowBias = new Float32Array(H);
  for (let y = 0; y < H; y++) { let s = 0, c = 0; for (let k = -4; k <= 4; k++) { const j = y + k; if (j >= 0 && j < H) { s += rowMean[j]; c++; } } rowBias[y] = rowMean[y] - s / c; }
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const idx = y * W + x;
    let v = raw[idx] - (colBias[x] - globalMed) * vS - rowBias[y] * hS;
    const avgN = (raw[idx - 1] + raw[idx + 1] + raw[idx - W] + raw[idx + W]) * 0.25;
    if (Math.abs(v - avgN) > 1800) v = avgN;
    out[idx] = v;
  }
  return out;
}

function origDetail(norm: Float32Array, W: number, H: number, gain: number): Float32Array {
  const out = Float32Array.from(norm);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x, c = norm[i];
    const lm = (norm[i - 1] + norm[i + 1] + norm[i - W] + norm[i + W]) * 0.25;
    const d = Math.max(-18, Math.min(18, c - lm));
    out[i] = c + d * (gain - 1) * 1.8;
  }
  return out;
}

const softLimit = (d: number, m: number) => (Math.abs(d) <= m ? d : Math.sign(d) * (m + (Math.abs(d) - m) * 0.2));
const coringFn = (d: number, tau: number) => (tau <= 0 ? d : d * ((d * d) / (d * d + tau * tau)));

function guidedDetail(norm: Float32Array, W: number, H: number, gain: number, tau: number): Float32Array {
  const base = guidedSelf(norm, W, H, 4, 100);
  const g = 1 + (gain - 1) * 1.8;
  const out = new Float32Array(norm.length);
  for (let i = 0; i < out.length; i++) out[i] = base[i] + g * softLimit(coringFn(norm[i] - base[i], tau), 30);
  return out;
}

function multiscaleDetail(norm: Float32Array, W: number, H: number, gain: number, tau: number, compress: number): Float32Array {
  const b1 = boxBlur(norm, W, H, 1), b2 = boxBlur(norm, W, H, 3), b3 = boxBlur(boxBlur(norm, W, H, 8), W, H, 8);
  const g = 1 + (gain - 1) * 1.8;
  const out = new Float32Array(norm.length);
  for (let i = 0; i < out.length; i++) {
    const d1 = coringFn(norm[i] - b1[i], tau), d2 = b1[i] - b2[i], d3 = b2[i] - b3[i];
    const base = 128 + (b3[i] - 128) * (1 - compress); // compress large-scale layer -> more local contrast headroom
    out[i] = base + g * (softLimit(d1, 24) * 1.0 + softLimit(d2, 28) * 0.8 + softLimit(d3, 30) * 0.5) * 0.9;
  }
  return out;
}

// ---------------- tone mapping ----------------
function toneMap(x: Float32Array, rMin: number, rMax: number, cfg: Cfg, st: PState, key: string, reset: boolean, mode: 'quantile' | 'plateau') {
  const N = x.length;
  let pLow = rMin, pHigh = rMax;
  const isNew = st.lastKey !== key;
  if (isNew) {
    st.loB = st.lo; st.hiB = st.hi; st.prevNormB = st.prevNorm; st.lutB = st.lut;
    st.hasPrevB = st.hasPrev && !reset; st.lastKey = key;
  }
  if (cfg.stage2) {
    const rawLo = percentileSample(x, 0.02, 11), rawHi = percentileSample(x, cfg.stage3 ? 0.975 : 0.999, 11);
    const m = cfg.agcSlew;
    pLow = st.hasPrevB ? st.loB + Math.max(-m, Math.min(m, rawLo - st.loB)) : rawLo;
    pHigh = st.hasPrevB ? st.hiB + Math.max(-m, Math.min(m, rawHi - st.hiB)) : rawHi;
    st.lo = pLow; st.hi = pHigh;
  }
  const span = Math.max(80, pHigh - pLow);
  const norm = new Float32Array(N);
  let lut: Float32Array | null = null as Float32Array | null;
  if (mode === 'plateau') {
    const BINS = 512, hist = new Float64Array(BINS); let n = 0;
    for (let i = 0; i < N; i += 2) { const v = x[i]; if (v >= pLow && v <= pHigh) { hist[Math.min(BINS - 1, Math.floor(((v - pLow) / span) * BINS))]++; n++; } }
    const T = Math.max(1, (n / BINS) * cfg.plateau);
    const floor = Math.max(0.05 * T, 0.5);
    let cum = 0; const l = new Float32Array(BINS);
    for (let b = 0; b < BINS; b++) { cum += Math.max(floor, Math.min(T, hist[b])); l[b] = cum; }
    for (let b = 0; b < BINS; b++) l[b] /= cum;
    lut = st.hasPrevB && st.lutB && st.lutB.length === BINS ? l.map((v, i) => 0.7 * st.lutB![i] + 0.3 * v) : l;
    st.lut = lut;
  }
  for (let i = 0; i < N; i++) {
    const v = x[i];
    if (v <= pHigh) {
      const lin = Math.max(0, Math.min(232, ((v - pLow) / span) * 232));
      if (lut) {
        const eq = v <= pLow ? 0 : lut[Math.min(lut.length - 1, Math.floor(((v - pLow) / span) * lut.length))] * 232;
        norm[i] = lin * (1 - cfg.pheAmount) + eq * cfg.pheAmount;
      } else norm[i] = lin;
    } else norm[i] = 232 + Math.min(1, (v - pHigh) / 7000) * 23;
  }
  if (!cfg.spatialOnly && st.hasPrevB && st.prevNormB && st.prevNormB.length === N) for (let i = 0; i < N; i++) norm[i] = 0.25 * norm[i] + 0.75 * st.prevNormB[i];
  st.prevNorm = norm.slice(); st.hasPrev = true;
  return { norm, pLow, pHigh, span };
}

// ---------------- Instance B: multi-frame (constant-statistics) estimation ----------------
interface BCorr { col: Float32Array; row: Float32Array; fpn: Float32Array | null; conf: number }
async function destripeB(ctx: FrameCtx, x: Float32Array, cfg: Cfg, sigma: number): Promise<BCorr> {
  const { W, H } = ctx, N = W * H;
  const K = Math.max(1, Math.min(cfg.window, ctx.total));
  const i0 = Math.max(0, Math.min(ctx.total - K, ctx.idx - K + 1));
  const med = percentileSample(x, 0.5, 5);
  const M = new Float32Array(N); let used = 0; let first: Float32Array | null = null, last: Float32Array | null = null;
  for (let k = 0; k < K; k++) {
    const f = k + i0 === ctx.idx ? ctx.raw : await ctx.getFrame(i0 + k);
    if (!f) continue;
    const c = new Float32Array(N);
    for (let i = 0; i < N; i++) c[i] = Math.max(med - 1000, Math.min(med + 1000, f[i] & 0x3fff));
    for (let i = 0; i < N; i++) M[i] += c[i];
    if (!first) first = c; last = c; used++;
  }
  if (used === 0) return { col: new Float32Array(W), row: new Float32Array(H), fpn: null, conf: 0 };
  for (let i = 0; i < N; i++) M[i] /= used;
  let conf = 0;
  if (used >= 4 && first && last) {
    let s = 0; for (let i = 0; i < N; i += 3) s += Math.abs(last[i] - first[i]); s /= N / 3;
    conf = Math.max(0, Math.min(1, (s - 1.3 * sigma) / (4 * sigma)));
  }
  const col = cfg.vStr > 0 ? estimateLineOffsetsLocal(M, W, H, "col", 4, 3) : new Float32Array(W);
  applyLineOffsets(M, W, H, 'col', col, 1);
  const row = cfg.hStr > 0 ? estimateLineOffsetsLocal(M, W, H, "row", 4, 3) : new Float32Array(H);
  applyLineOffsets(M, W, H, 'row', row, 1);
  let fpn: Float32Array | null = null;
  if (cfg.fpnPixel > 0 && conf > 0) {
    const bl = boxBlur(M, W, H, 6); fpn = new Float32Array(N);
    const g = conf * cfg.fpnPixel;
    for (let i = 0; i < N; i++) fpn[i] = Math.max(-40, Math.min(40, M[i] - bl[i])) * g;
  }
  return { col, row, fpn, conf };
}
function applyB(img: Float32Array, W: number, H: number, c: BCorr, cfg: Cfg) {
  applyLineOffsets(img, W, H, 'col', c.col, cfg.vStr);
  applyLineOffsets(img, W, H, 'row', c.row, cfg.hStr);
  if (c.fpn) for (let i = 0; i < img.length; i++) img[i] -= c.fpn[i];
}

// ---------------- main entry ----------------
export async function runPipeline(v: PVariant, ctx: FrameCtx, cfg: Cfg, st: PState): Promise<Result> {
  const T0 = performance.now();
  const { W, H, raw } = ctx, N = W * H;
  const notes: string[] = [];
  const tm: Timings = { lines: 0, cnn: 0, denoise: 0, tone: 0, detail: 0, total: 0 };
  const raw14 = new Float32Array(N);
  let rMin = 16383, rMax = 0;
  for (let i = 0; i < N; i++) { const q = raw[i] & 0x3fff; raw14[i] = q; if (q < rMin) rMin = q; if (q > rMax) rMax = q; }

  // naive baseline (left side of the split)
  const base8 = new Uint8ClampedArray(N), nspan = Math.max(1, rMax - rMin);
  for (let i = 0; i < N; i++) base8[i] = Math.round(((raw14[i] - rMin) / nspan) * 255);

  // ---- Stage 1: bad pixels + line correction ----
  let t = performance.now();
  let x: Float32Array = raw14;
  let sigma = noiseSigma(raw14, W, H), conf = 0;
  let bcorr: BCorr | null = null;
  if (cfg.stage1) {
    if (cfg.badPixel === 'robust') x = robustBadPixels(x, W, H, sigma);
    if (cfg.lineMethod === 'orig') x = origStage1(x, W, H, cfg.vStr, cfg.hStr);
    else if (cfg.lineMethod === 'new') {
      x = Float32Array.from(x);
      if (v === 'B') { bcorr = await destripeB(ctx, x, cfg, sigma); conf = bcorr.conf; applyB(x, W, H, bcorr, cfg); }
      else if (v === 'C') {
        if (cfg.vStr > 0) applyLineOffsets(x, W, H, 'col', estimateLineOffsetsSpectral(x, W, H, 'col', cfg.specCutoff, cfg.specPeak, cfg.specMode), cfg.vStr);
        if (cfg.hStr > 0) applyLineOffsets(x, W, H, 'row', estimateLineOffsetsSpectral(x, W, H, 'row', cfg.specCutoff, cfg.specPeak, cfg.specMode), cfg.hStr);
      } else { // A and O (O has no 'new' technique pack in the UI, so reuse A's estimator if forced)
        if (cfg.vStr > 0) applyLineOffsets(x, W, H, 'col', estimateLineOffsetsLocal(x, W, H, "col", 4, 3), cfg.vStr);
        if (cfg.hStr > 0) applyLineOffsets(x, W, H, 'row', estimateLineOffsetsLocal(x, W, H, "row", 4, 3), cfg.hStr);
      }
    }
    if (cfg.badPixel === 'orig' && cfg.lineMethod !== 'orig') x = origStage1(x, W, H, 0, 0);
  }
  tm.lines = performance.now() - t;

  // ---- CNN residual restoration ----
  let usedCnn = false;
  if (cfg.cnn && v !== 'O') {
    const m = getCnn(v);
    if (m) {
      t = performance.now();
      try { x = await cnnRestore(m, x, W, H, cfg.cnnStrength); usedCnn = true; } catch (e) { notes.push('CNN inference failed: ' + (e instanceof Error ? e.message : String(e))); }
      tm.cnn = performance.now() - t;
    } else notes.push('CNN enabled but no model trained/loaded for this instance.');
  }

  // ---- denoising ----
  t = performance.now();
  if (v === 'B' && cfg.tdenoise && cfg.stage1) {
    const pi = ctx.idx > 0 ? ctx.idx - 1 : ctx.idx + 1;
    const prev = ctx.total > 1 ? await ctx.getFrame(pi) : null;
    if (prev) {
      const p = new Float32Array(N); for (let i = 0; i < N; i++) p[i] = prev[i] & 0x3fff;
      if (bcorr) applyB(p, W, H, bcorr, cfg);
      const s = noiseSigma(x, W, H), k = 3.5 * s;
      const y = Float32Array.from(x);
      for (let i = 0; i < N; i++) { const d = Math.abs(x[i] - p[i]) / k; y[i] = x[i] + (p[i] - x[i]) * cfg.tdStrength * Math.exp(-d * d); }
      x = y;
    }
  }
  if (v === 'C' && cfg.bilateral) { const s = noiseSigma(x, W, H); x = bilateral5(x, W, H, Math.max(4, 2.2 * s), cfg.bilStrength); }
  tm.denoise = performance.now() - t;
  sigma = noiseSigma(x, W, H);

  // ---- tone mapping ----
  t = performance.now();
  const mode = v === 'B' || cfg.toneMode === 'plateau' ? (cfg.toneMode) : 'quantile';
  const { norm, pLow, pHigh, span } = toneMap(x, rMin, rMax, cfg, st, ctx.key, ctx.reset, mode);
  tm.tone = performance.now() - t;

  // ---- enhancement ----
  t = performance.now();
  let e: Float32Array = norm;
  if (v === 'A' && cfg.clahe) {
    const c = clahe(e, W, H, 8, 8, cfg.claheClip), a = cfg.claheAmount;
    e = new Float32Array(N); for (let i = 0; i < N; i++) e[i] = norm[i] * (1 - a) + c[i] * a;
  }
  if (cfg.stage4) {
    const sn = (sigma * 232) / span;
    if (cfg.detailMethod === 'guided') e = guidedDetail(e, W, H, cfg.detailGain, cfg.coring * sn);
    else if (cfg.detailMethod === 'multiscale') e = multiscaleDetail(e, W, H, cfg.detailGain, cfg.coring * sn, cfg.baseCompress);
    else e = origDetail(e, W, H, cfg.detailGain);
  }
  const out8 = new Uint8ClampedArray(N);
  for (let i = 0; i < N; i++) out8[i] = Math.max(0, Math.min(255, Math.round(e[i])));
  tm.detail = performance.now() - t;
  tm.total = performance.now() - T0;
  return { out8, base8, restored: x, rMin, rMax, pLow, pHigh, sigma, conf, timings: tm, usedCnn, notes };
}

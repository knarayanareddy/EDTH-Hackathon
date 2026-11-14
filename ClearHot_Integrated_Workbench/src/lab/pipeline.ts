import {
  applyProfile,
  clahe,
  detailEnhance,
  estimateNoiseSigma,
  lineProfile,
  temporalFilter,
  type Axis,
  type DetailParams,
  type TemporalState,
} from "./dsp";

export const ALGO_VERSION = "clearhot-lab-0.1.0";
export const MAX_CODE_14 = 16383;

export type LineMode = "off" | "columns" | "rows" | "both";
export type ToneMode = "fixed" | "percentile";

export interface PipelineConfig {
  line: { mode: LineMode; strength: number; clampAdu: number; halfWidth: number; gateK: number };
  tone: {
    mode: ToneMode;
    fixedLo: number;
    fixedHi: number;
    pLo: number;
    pHi: number;
    gamma: number; // 1 = linear
    knee: number; // 1 = hard clip at hi; <1 = soft highlight compression above knee
  };
  detail: { on: boolean; radius: number; edgeAdu: number; gain: number; coringK: number; maxBoostAdu: number };
  clahe: { on: boolean; tiles: number; clip: number; blend: number };
  temporal: { on: boolean; alpha: number; gateK: number };
}

export const DEFAULT_CONFIG: PipelineConfig = {
  line: { mode: "columns", strength: 1, clampAdu: 400, halfWidth: 32, gateK: 3 },
  tone: { mode: "fixed", fixedLo: 4000, fixedHi: 9000, pLo: 1, pHi: 99, gamma: 1, knee: 1 },
  detail: { on: true, radius: 6, edgeAdu: 150, gain: 2.5, coringK: 2, maxBoostAdu: 250 },
  clahe: { on: false, tiles: 8, clip: 3, blend: 0.5 },
  temporal: { on: false, alpha: 0.4, gateK: 4 },
};

export function cloneConfig(c: PipelineConfig): PipelineConfig {
  return JSON.parse(JSON.stringify(c)) as PipelineConfig;
}

// ---------------- tone mapping ----------------

export interface ToneParams {
  lo: number;
  hi: number;
  gamma: number;
  knee: number;
}

/** Global, spatially-invariant, monotone (non-decreasing) mapping from ADU to 0..255. */
export function toneFn(p: ToneParams): (x: number) => number {
  const span = Math.max(1, p.hi - p.lo);
  const knee = Math.min(1, Math.max(0.05, p.knee));
  const g = Math.max(0.1, p.gamma);
  return (x: number) => {
    let t = (x - p.lo) / span;
    if (t <= 0) return 0;
    if (knee < 1 && t > knee) t = knee + (1 - knee) * Math.tanh((t - knee) / (1 - knee));
    if (t > 1) t = 1;
    if (g !== 1) t = Math.pow(t, 1 / g);
    return Math.round(255 * t);
  };
}

export interface MonotonicReport {
  nonDecreasing: boolean;
  distinctLevels: number;
  aduPerLevel: number; // approx. width of the linear part per display level
  lowClipBelow: number; // all codes <= this map to the minimum level
  highClipFrom: number; // all codes >= this map to the maximum level
  clippedFractionOfRange: number;
}

export function checkMonotonic(fn: (x: number) => number, maxCode = MAX_CODE_14): MonotonicReport {
  let prev = fn(0);
  const first = prev;
  let nonDecreasing = true;
  const levels = new Set<number>([prev]);
  let lowClip = 0;
  let last = prev;
  for (let c = 1; c <= maxCode; c++) {
    const v = fn(c);
    if (v < prev) nonDecreasing = false;
    if (v === first) lowClip = c;
    levels.add(v);
    prev = v;
    last = v;
  }
  let highFrom = maxCode;
  for (let c = maxCode; c >= 0; c--) {
    if (fn(c) === last) highFrom = c;
    else break;
  }
  const active = Math.max(1, highFrom - lowClip);
  return {
    nonDecreasing,
    distinctLevels: levels.size,
    aduPerLevel: active / Math.max(1, levels.size - 1),
    lowClipBelow: lowClip,
    highClipFrom: highFrom,
    clippedFractionOfRange: (lowClip + (maxCode - highFrom)) / maxCode,
  };
}

export function percentileWindow(
  data: Float32Array,
  pLo: number,
  pHi: number,
): { lo: number; hi: number } {
  const hist = new Uint32Array(MAX_CODE_14 + 1);
  for (let i = 0; i < data.length; i++) {
    const v = Math.min(MAX_CODE_14, Math.max(0, Math.round(data[i])));
    hist[v]++;
  }
  const n = data.length;
  const tLo = (pLo / 100) * n;
  const tHi = (pHi / 100) * n;
  let acc = 0;
  let lo = 0;
  let hi = MAX_CODE_14;
  let gotLo = false;
  for (let i = 0; i <= MAX_CODE_14; i++) {
    acc += hist[i];
    if (!gotLo && acc >= tLo) {
      lo = i;
      gotLo = true;
    }
    if (acc >= tHi) {
      hi = i;
      break;
    }
  }
  if (hi <= lo) hi = lo + 1;
  return { lo, hi };
}

export function frameStats(raw: ArrayLike<number>): { min: number; max: number; p1: number; p50: number; p99: number } {
  const hist = new Uint32Array(MAX_CODE_14 + 1);
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < raw.length; i++) {
    const v = raw[i];
    if (v < min) min = v;
    if (v > max) max = v;
    hist[Math.min(MAX_CODE_14, v)]++;
  }
  const q = (p: number) => {
    const t = p * raw.length;
    let acc = 0;
    for (let i = 0; i <= MAX_CODE_14; i++) {
      acc += hist[i];
      if (acc >= t) return i;
    }
    return MAX_CODE_14;
  };
  return { min, max, p1: q(0.01), p50: q(0.5), p99: q(0.99) };
}

export function applyTone(src: Float32Array, fn: (x: number) => number): Uint8Array {
  const out = new Uint8Array(src.length);
  for (let i = 0; i < src.length; i++) out[i] = fn(src[i]);
  return out;
}

/** Reference path: raw ADU, user-fixed window, linear, no spatial processing. */
export function referenceDisplay(raw: Uint16Array, cfg: PipelineConfig): Uint8Array {
  const fn = toneFn({ lo: cfg.tone.fixedLo, hi: cfg.tone.fixedHi, gamma: 1, knee: 1 });
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = fn(raw[i]);
  return out;
}

// ---------------- full pipeline ----------------

export interface PipelineResult {
  corrected: Float32Array; // after line correction (ADU)
  enhanced: Float32Array; // after temporal + detail (ADU)
  display: Uint8Array; // final 8-bit display
  tone: { lo: number; hi: number; gamma: number; knee: number };
  toneReport: MonotonicReport;
  clipLowFrac: number; // enhanced values below window lo
  clipHighFrac: number; // enhanced values above window hi
  sat0Frac: number; // display pixels at 0
  sat255Frac: number; // display pixels at 255
  noiseSigma: number;
  profiles: { col: Float32Array | null; row: Float32Array | null };
  temporal: { used: boolean; frames: number; movingFrac: number };
  timingsMs: { line: number; temporal: number; detail: number; tone: number; clahe: number; total: number };
}

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

export function runPipeline(
  raw: Uint16Array,
  w: number,
  h: number,
  cfg: PipelineConfig,
  tstate?: TemporalState,
): PipelineResult {
  const t0 = now();
  let cur: Float32Array = new Float32Array(raw);
  const profiles: { col: Float32Array | null; row: Float32Array | null } = { col: null, row: null };

  // 1) line correction
  const axes: Axis[] = cfg.line.mode === "columns" ? ["col"] : cfg.line.mode === "rows" ? ["row"] : cfg.line.mode === "both" ? ["col", "row"] : [];
  for (const ax of axes) {
    const { profile } = lineProfile(cur, w, h, ax, cfg.line.halfWidth, cfg.line.gateK);
    profiles[ax] = profile;
    cur = applyProfile(cur, w, h, ax, profile, cfg.line.strength, cfg.line.clampAdu);
  }
  const corrected = cur;
  const t1 = now();

  // 2) noise estimate + causal temporal
  const noiseSigma = estimateNoiseSigma(corrected, w, h);
  let temporal = { used: false, frames: 0, movingFrac: 0 };
  if (cfg.temporal.on && tstate) {
    const r = temporalFilter(cur, tstate, cfg.temporal.alpha, cfg.temporal.gateK, noiseSigma);
    cur = r.out;
    temporal = { used: true, frames: tstate.frames, movingFrac: r.movingFrac };
  }
  const t2 = now();

  // 3) detail
  if (cfg.detail.on) {
    const dp: DetailParams = {
      radius: cfg.detail.radius,
      edgeAdu: cfg.detail.edgeAdu,
      gain: cfg.detail.gain,
      coringK: cfg.detail.coringK,
      maxBoostAdu: cfg.detail.maxBoostAdu,
    };
    cur = detailEnhance(cur, w, h, dp, noiseSigma);
  }
  const enhanced = cur;
  const t3 = now();

  // 4) global monotone tone map
  let lo = cfg.tone.fixedLo;
  let hi = cfg.tone.fixedHi;
  if (cfg.tone.mode === "percentile") {
    const pw = percentileWindow(enhanced, cfg.tone.pLo, cfg.tone.pHi);
    lo = pw.lo;
    hi = pw.hi;
  }
  const tone = { lo, hi, gamma: cfg.tone.gamma, knee: cfg.tone.knee };
  const fn = toneFn(tone);
  let display = applyTone(enhanced, fn);
  let below = 0;
  let above = 0;
  for (let i = 0; i < enhanced.length; i++) {
    if (enhanced[i] < lo) below++;
    else if (enhanced[i] > hi) above++;
  }
  const t4 = now();

  // 5) optional local histogram stage (non-monotone, interpretive)
  if (cfg.clahe.on) display = clahe(display, w, h, cfg.clahe.tiles, cfg.clahe.clip, cfg.clahe.blend);
  const t5 = now();

  let s0 = 0;
  let s255 = 0;
  for (let i = 0; i < display.length; i++) {
    if (display[i] === 0) s0++;
    else if (display[i] === 255) s255++;
  }
  const n = display.length;
  return {
    corrected,
    enhanced,
    display,
    tone,
    toneReport: checkMonotonic(fn),
    clipLowFrac: below / n,
    clipHighFrac: above / n,
    sat0Frac: s0 / n,
    sat255Frac: s255 / n,
    noiseSigma,
    profiles,
    temporal,
    timingsMs: { line: t1 - t0, temporal: t2 - t1, detail: t3 - t2, tone: t4 - t3, clahe: t5 - t4, total: t5 - t0 },
  };
}

// ---------------- ablation presets ----------------

export interface AblationStage {
  id: string;
  label: string;
  cfg: PipelineConfig;
  note: string;
}

export function ablationStages(base: PipelineConfig): AblationStage[] {
  const refTone = { ...base.tone, mode: "fixed" as ToneMode, gamma: 1, knee: 1 };
  const off = (c: PipelineConfig): PipelineConfig => {
    c.line.mode = "off";
    c.detail.on = false;
    c.clahe.on = false;
    c.temporal.on = false;
    return c;
  };
  const mk = (f: (c: PipelineConfig) => void, tone: "ref" | "cfg"): PipelineConfig => {
    const c = off(cloneConfig(base));
    c.tone = tone === "ref" ? { ...refTone } : { ...base.tone };
    f(c);
    return c;
  };
  const lineMode: LineMode = base.line.mode === "off" ? "columns" : base.line.mode;
  const combined = cloneConfig(base);
  combined.temporal.on = false;
  return [
    { id: "raw", label: "0. Raw, fixed window (reference)", cfg: mk(() => {}, "ref"), note: "Linear, global, monotone. No spatial processing." },
    { id: "line", label: "1. Line correction only", cfg: mk((c) => (c.line = { ...base.line, mode: lineMode }), "ref"), note: "Reference tone map." },
    { id: "tone", label: "2. Tone map only", cfg: mk(() => {}, "cfg"), note: "Selected window/gamma/knee; global and monotone." },
    { id: "detail", label: "3. Detail enhancement only", cfg: mk((c) => (c.detail = { ...base.detail, on: true }), "ref"), note: "Reference tone map." },
    { id: "clahe", label: "4. CLAHE only", cfg: mk((c) => (c.clahe = { ...base.clahe, on: true }), "ref"), note: "Local, non-monotone, interpretive." },
    { id: "combined", label: "5. Combined (current settings, temporal off)", cfg: combined, note: "All enabled stages, single frame." },
  ];
}

// ---------------- frozen benchmark variants (ADU-domain only) ----------------

export const FROZEN_VARIANTS: { id: string; label: string; cfg: PipelineConfig }[] = (() => {
  const base = cloneConfig(DEFAULT_CONFIG);
  base.clahe.on = false;
  base.temporal.on = false;
  const mk = (line: LineMode, detail: boolean): PipelineConfig => {
    const c = cloneConfig(base);
    c.line.mode = line;
    c.detail.on = detail;
    return c;
  };
  return [
    { id: "identity", label: "Identity (raw)", cfg: mk("off", false) },
    { id: "line", label: "Line correction (columns)", cfg: mk("columns", false) },
    { id: "detail", label: "Detail only", cfg: mk("off", true) },
    { id: "line+detail", label: "Line + detail", cfg: mk("columns", true) },
  ];
})();

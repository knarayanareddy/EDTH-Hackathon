// Deterministic synthetic 14-bit thermal frames WITH ground truth.
// Everything here is SIMULATED. Scores computed from it are not evidence about real sensor data.

export function mulberry32(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function gauss(rng: () => number) {
  let u = 0;
  while (u === 0) u = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}

function valueNoise(W: number, H: number, cell: number, rng: () => number) {
  const gw = Math.ceil(W / cell) + 2, gh = Math.ceil(H / cell) + 2;
  const g = new Float32Array(gw * gh);
  for (let i = 0; i < g.length; i++) g[i] = rng() * 2 - 1;
  const out = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    const fy = y / cell, y0 = Math.floor(fy);
    let ty = fy - y0; ty = ty * ty * (3 - 2 * ty);
    for (let x = 0; x < W; x++) {
      const fx = x / cell, x0 = Math.floor(fx);
      let tx = fx - x0; tx = tx * tx * (3 - 2 * tx);
      const a = g[y0 * gw + x0], b = g[y0 * gw + x0 + 1], c = g[(y0 + 1) * gw + x0], d = g[(y0 + 1) * gw + x0 + 1];
      out[y * W + x] = (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
    }
  }
  return out;
}

export interface Scene {
  W: number; H: number;
  base: Float32Array;      // scene without thin features
  thin: Float32Array;      // additive thin features (wires / poles)
  thinMask: Uint8Array;
}

export function makeScene(seed: number, W: number, H: number, fullLines = false): Scene {
  const rng = mulberry32(seed);
  const horizon = Math.round(H * (0.28 + 0.18 * rng()));
  const skyBase = 7000 + rng() * 150, gndBase = 7250 + rng() * 200;
  const n1 = valueNoise(W, H, Math.max(8, Math.round(W / 7)), rng);
  const n2 = valueNoise(W, H, Math.max(4, Math.round(W / 28)), rng);
  const n3 = valueNoise(W, H, 4, rng);
  const base = new Float32Array(W * H);
  const roadX = W * (0.25 + 0.5 * rng()), roadSlope = (rng() - 0.5) * 0.9, roadW = W * 0.03;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (y < horizon) base[i] = skyBase + 40 * n1[i] + 6 * n3[i] + (y / horizon) * 30;
      else {
        let v = gndBase + 90 * n1[i] + 45 * n2[i] + 14 * n3[i];
        const d = Math.abs(x - (roadX + (y - horizon) * roadSlope));
        if (d < roadW * (1 + ((y - horizon) / H) * 3)) v += 120;
        base[i] = v;
      }
    }
  }
  // buildings: true vertical + horizontal edges
  const nb = 1 + Math.floor(rng() * 3);
  for (let b = 0; b < nb; b++) {
    const bw = Math.round(W * (0.06 + 0.08 * rng())), bh = Math.round(H * (0.08 + 0.15 * rng()));
    const bx = Math.round(rng() * (W - bw));
    for (let y = horizon - bh; y < horizon + 4; y++) for (let x = bx; x < bx + bw; x++) {
      if (y >= 0 && y < H) base[y * W + x] = gndBase + 150 + 25 * n2[y * W + x] + 10 * n3[y * W + x];
    }
  }
  // warm blobs
  const nblob = 2 + Math.floor(rng() * 4);
  for (let k = 0; k < nblob; k++) {
    const cx = rng() * W, cy = horizon + rng() * (H - horizon), r = 4 + rng() * 10, amp = 80 + rng() * 140;
    for (let y = Math.max(0, Math.floor(cy - 3 * r)); y < Math.min(H, cy + 3 * r); y++)
      for (let x = Math.max(0, Math.floor(cx - 3 * r)); x < Math.min(W, cx + 3 * r); x++)
        base[y * W + x] += amp * Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / (2 * r * r));
  }
  // thin real structures
  const thin = new Float32Array(W * H), thinMask = new Uint8Array(W * H);
  const addV = (x: number, y0: number, y1: number, amp: number) => { for (let y = y0; y < y1; y++) { thin[y * W + x] = amp; thinMask[y * W + x] = 1; } };
  const addH = (y: number, x0: number, x1: number, amp: number) => { for (let x = x0; x < x1; x++) { thin[y * W + x] = amp; thinMask[y * W + x] = 1; } };
  const np = 1 + Math.floor(rng() * 2);
  for (let p = 0; p < np; p++) {
    const px = Math.round(W * (0.1 + 0.8 * rng())), ph = Math.round((H - horizon) * 0.7);
    addV(px, horizon + Math.round((H - horizon) * 0.1), horizon + Math.round((H - horizon) * 0.1) + ph, 55);
  }
  addH(Math.round(horizon + (H - horizon) * (0.35 + 0.3 * rng())), Math.round(W * 0.1), Math.round(W * 0.7), 45);
  if (fullLines) {
    addV(Math.round(W * 0.4), 0, H, 40);
    addV(Math.round(W * 0.73), 0, H, -40);
    addH(Math.round(H * 0.8), 0, W, 40);
  }
  return { W, H, base, thin, thinMask };
}

export type Preset = 'hot_object' | 'horizon_pan' | 'hot_scene';
export const PRESET_LABEL: Record<Preset, string> = {
  hot_object: 'Synthetic 1: hot object',
  horizon_pan: 'Synthetic 2: horizon pan',
  hot_scene: 'Synthetic 3: hot scene',
};
const PRESET_SEED: Record<Preset, number> = { hot_object: 11, horizon_pan: 23, hot_scene: 37 };

export interface Corruption {
  v: number; h: number; per: number; period: number; sigma: number; badPx: boolean;
}
export type CorrKey = 'vertical' | 'horizontal' | 'both' | 'periodic' | 'strong' | 'noise_only' | 'none';
export const CORR: Record<CorrKey, Corruption> = {
  vertical: { v: 28, h: 0, per: 0, period: 7, sigma: 8, badPx: true },
  horizontal: { v: 0, h: 28, per: 0, period: 7, sigma: 8, badPx: true },
  both: { v: 22, h: 22, per: 0, period: 7, sigma: 10, badPx: true },
  periodic: { v: 6, h: 0, per: 30, period: 7, sigma: 8, badPx: true },
  strong: { v: 60, h: 0, per: 0, period: 7, sigma: 16, badPx: true },
  noise_only: { v: 0, h: 0, per: 0, period: 7, sigma: 8, badPx: true },
  none: { v: 0, h: 0, per: 0, period: 7, sigma: 0, badPx: false },
};
export const CORR_LABEL: Record<CorrKey, string> = {
  vertical: 'Vertical stripes (28 ADU rms)',
  horizontal: 'Horizontal stripes (28 ADU rms)',
  both: 'Vertical + horizontal (22 ADU rms)',
  periodic: 'Periodic vertical lines (7 px period)',
  strong: 'Strong vertical + heavy noise',
  noise_only: 'Noise + bad pixels only (no stripes)',
  none: 'No corruption (clean)',
};

export interface SynthFrame {
  raw: Uint16Array; clean: Float32Array; cleanNoThin: Float32Array; thinMask: Uint8Array;
  colOff: Float32Array; rowOff: Float32Array; W: number; H: number;
}

const sceneCache = new Map<string, Scene>();
const PADX = 48, PADY = 32;
function getScene(seed: number, W: number, H: number, fullLines: boolean) {
  const key = `${seed}:${W}x${H}:${fullLines}`;
  let s = sceneCache.get(key);
  if (!s) {
    s = makeScene(seed, W + 2 * PADX, H + 2 * PADY, fullLines);
    if (sceneCache.size > 24) sceneCache.clear();
    sceneCache.set(key, s);
  }
  return s;
}

function composeClean(scene: Scene, preset: Preset | null, idx: number, W: number, H: number) {
  const pan = preset === 'horizon_pan' || preset === null;
  const dx = PADX + (pan ? Math.round(40 * Math.sin(idx * 0.12)) : 0);
  const dy = PADY + (pan ? Math.round(20 * Math.sin(idx * 0.07 + 1)) : 0);
  const SW = scene.W;
  const clean = new Float32Array(W * H), noThin = new Float32Array(W * H), mask = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const s = (y + dy) * SW + x + dx, i = y * W + x;
    noThin[i] = scene.base[s]; clean[i] = scene.base[s] + scene.thin[s]; mask[i] = scene.thinMask[s];
  }
  const sc = W / 320;
  if (preset) {
    const tx = Math.round((idx * 5 * sc) % (W - 40 * sc)) + 20 * sc;
    const ty = (preset === 'hot_object' ? 64 : 155) * sc;
    for (let ddy = -10 * sc; ddy <= 10 * sc; ddy++) for (let ddx = -16 * sc; ddx <= 16 * sc; ddx++) {
      const px = Math.round(tx + ddx), py = Math.round(ty + ddy);
      if (px < 0 || px >= W || py < 0 || py >= H) continue;
      const dist = Math.sqrt((ddx / sc) ** 2 + ((ddy / sc) ** 2) * 1.8);
      const i = py * W + px;
      if (dist < 4.2) { clean[i] = 14900; noThin[i] = 14900; }
      else if (dist < 11) { clean[i] += 290; noThin[i] += 290; }
    }
    if (preset === 'hot_scene' || (preset === 'horizon_pan' && idx % 8 < 4)) {
      for (let y = Math.round(180 * sc); y < Math.min(H, Math.round(210 * sc)); y++)
        for (let x = Math.round(45 * sc); x < Math.round(75 * sc); x++) { clean[y * W + x] = 15600; noThin[y * W + x] = 15600; }
    }
  }
  return { clean, noThin, mask };
}

const patternCache = new Map<string, { col: Float32Array; row: Float32Array; bad: number[] }>();
function getPattern(c: Corruption, W: number, H: number, seed: number) {
  const key = `${JSON.stringify(c)}:${W}x${H}:${seed}`;
  let p = patternCache.get(key);
  if (!p) {
    const rng = mulberry32(seed * 7919 + 13);
    const col = new Float32Array(W), row = new Float32Array(H);
    for (let x = 0; x < W; x++) col[x] = gauss(rng) * c.v + c.per * Math.sin((2 * Math.PI * x) / c.period + 0.7);
    for (let y = 0; y < H; y++) row[y] = gauss(rng) * c.h;
    const bad: number[] = [];
    if (c.badPx) { const n = Math.round(25 * ((W * H) / 81920)); for (let k = 0; k < n; k++) bad.push(Math.floor(rng() * W * H)); }
    if (patternCache.size > 40) patternCache.clear();
    p = { col, row, bad };
    patternCache.set(key, p);
  }
  return p;
}

/** Corrupt a clean frame. Stripe pattern is stationary over time (like real FPN); temporal noise changes per frame. */
export function corruptFrame(clean: Float32Array, W: number, H: number, c: Corruption, patSeed: number, noiseSeed: number) {
  const pat = getPattern(c, W, H, patSeed);
  const rng = mulberry32(noiseSeed * 104729 + 7);
  const raw = new Uint16Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    const v = clean[i] + pat.col[x] + pat.row[y] + (c.sigma > 0 ? gauss(rng) * c.sigma : 0);
    raw[i] = Math.max(0, Math.min(16383, Math.round(v)));
  }
  pat.bad.forEach((i, k) => { raw[i] = k % 2 === 0 ? 16380 : 120; });
  return { raw, colOff: pat.col, rowOff: pat.row };
}

export function synthFrame(preset: Preset, idx: number, W: number, H: number, corr: CorrKey, opts?: { seed?: number; fullLines?: boolean; sigmaScale?: number; stripeScale?: number }): SynthFrame {
  const seed = opts?.seed ?? PRESET_SEED[preset];
  const scene = getScene(seed, W, H, !!opts?.fullLines);
  const { clean, noThin, mask } = composeClean(scene, preset, idx, W, H);
  const base = CORR[corr];
  const ss = opts?.stripeScale ?? 1, ns = opts?.sigmaScale ?? 1;
  const c: Corruption = { ...base, v: base.v * ss, h: base.h * ss, per: base.per * ss, sigma: base.sigma * ns };
  const { raw, colOff, rowOff } = corruptFrame(clean, W, H, c, seed, seed * 1000 + idx);
  return { raw, clean, cleanNoThin: noThin, thinMask: mask, colOff, rowOff, W, H };
}

/** Training/validation scene used by CNN code: clean scene crop + corruption without presets/targets. */
export function trainScene(seed: number, W: number, H: number, fullLines = false) {
  const s = makeScene(seed, W, H, fullLines);
  const clean = new Float32Array(W * H);
  for (let i = 0; i < clean.length; i++) clean[i] = s.base[i] + s.thin[i];
  return clean;
}

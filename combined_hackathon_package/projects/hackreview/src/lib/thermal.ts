// Small thermal ISP engine used by the previews. Works on uint16 14-bit frames (any WxH).

export interface IspCfg {
  bad: boolean; // isolated bad-pixel replacement
  stripe: boolean; // column fixed-pattern removal
  temporal: boolean; // motion-adaptive recursive denoise
  agc: "minmax" | "plateau";
  lutSmooth: boolean; // temporally smooth the tone curve
  detail: number; // 0..1.5 guarded unsharp
}

export const FULL_CFG: IspCfg = { bad: true, stripe: true, temporal: true, agc: "plateau", lutSmooth: true, detail: 0.6 };

export interface FrameStats {
  ms: number;
  roiMean: number;
  clipped: number; // fraction of pixels at 0 or 255
}

const BINS = 1024;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

export class Scene {
  w: number;
  h: number;
  period = 240;
  private bg: Float32Array;
  private col: Float32Array;
  private bad: { i: number; v: number }[] = [];
  private rnd = mulberry32(7);

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.bg = new Float32Array(w * h);
    this.col = new Float32Array(w);
    const r = mulberry32(99);
    for (let x = 0; x < w; x++) this.col[x] = (r() - 0.5) * 36;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const fy = y / h;
        const fx = x / w;
        let v = 7600 + 520 * smooth(0.38, 0.5, fy); // cold sky -> warm ground
        v += 90 * fy;
        if (fx > 0.08 && fx < 0.3 && fy > 0.25 && fy < 0.62) v += 260; // building
        if (fy > 0.4 && fy < 0.52) v += 70 * (Math.sin(x * 0.19) + Math.sin(x * 0.43 + 1)); // tree line
        this.bg[y * w + x] = v;
      }
    }
    for (let k = 0; k < 6; k++) this.bad.push({ i: Math.floor(r() * w * h), v: k % 2 ? 16200 : 120 });
  }

  frame(t: number, out: Uint16Array) {
    const { w, h, bg, col, rnd } = this;
    const drift = 90 * Math.sin(t / 70);
    const ph = t % this.period;
    const hot = smooth(70, 90, ph) * (1 - smooth(150, 170, ph));
    const wx = (0.1 + 0.8 * ((t * 0.006) % 1)) * w;
    const wy = 0.78 * h;
    const ws = 0.03 * h;
    const hx0 = 0.6 * w;
    const hy0 = 0.42 * h;
    const hx1 = hx0 + 0.14 * w;
    const hy1 = hy0 + 0.1 * h;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        let v = bg[i] + drift + col[x];
        const dx = x - wx;
        const dy = y - wy;
        v += 260 * Math.exp(-(dx * dx + dy * dy * 0.5) / (2 * ws * ws)); // walking person
        if (hot > 0.001 && x > hx0 - 6 && x < hx1 + 6 && y > hy0 - 6 && y < hy1 + 6) {
          const e = smooth(-4, 4, Math.min(x - hx0, hx1 - x, y - hy0, hy1 - y));
          v += 5200 * hot * e; // hot engine / fire
        }
        v += (rnd() + rnd() + rnd() - 1.5) * 24; // temporal noise ~12 counts
        out[i] = Math.max(0, Math.min(16383, v));
      }
    }
    for (const b of this.bad) out[b.i] = b.v;
  }
}

export class Isp {
  w: number;
  h: number;
  n: number;
  private f: Float32Array;
  private prev: Float32Array;
  private hasPrev = false;
  private colOff: Float32Array;
  private acc: Float32Array;
  private pre: Float32Array;
  private lut: Float32Array;
  private lutInit = false;
  private hist: Uint32Array;
  private gray: Uint8ClampedArray;
  private tmp: Float32Array;
  private tlut: Float32Array;
  private frames = 0;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.n = w * h;
    this.f = new Float32Array(this.n);
    this.prev = new Float32Array(this.n);
    this.colOff = new Float32Array(w);
    this.acc = new Float32Array(w);
    this.pre = new Float32Array(w + 1);
    this.lut = new Float32Array(BINS);
    this.hist = new Uint32Array(BINS);
    this.gray = new Uint8ClampedArray(this.n);
    this.tmp = new Float32Array(this.n);
    this.tlut = new Float32Array(1024);
    const sig = 45;
    for (let k = 0; k < 1024; k++) {
      const d = k * 4;
      this.tlut[k] = 1 - 0.78 * Math.exp(-(d * d) / (2 * sig * sig));
    }
  }

  process(raw: Uint16Array, cfg: IspCfg, out: Uint8ClampedArray): FrameStats {
    const t0 = performance.now();
    const { w, h, n, f } = this;
    for (let i = 0; i < n; i++) f[i] = raw[i];

    // 1. isolated bad pixels: compare with its 4 neighbours (edges of real objects have a similar neighbour)
    if (cfg.bad) {
      const T = 500;
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const i = y * w + x;
          const p = raw[i];
          const a = raw[i - 1];
          const b = raw[i + 1];
          const c = raw[i - w];
          const d = raw[i + w];
          const mx = Math.max(a, b, c, d);
          const mn = Math.min(a, b, c, d);
          if (p > mx + T || p < mn - T) f[i] = (a + b + c + d - mx - mn) * 0.5;
        }
      }
    }

    // 2. column fixed-pattern: robust high-pass averaged down each column, slowly adapted
    if (cfg.stripe) {
      const { colOff, acc, pre } = this;
      acc.fill(0);
      const R = 7;
      for (let y = 0; y < h; y++) {
        const row = y * w;
        pre[0] = 0;
        for (let x = 0; x < w; x++) {
          f[row + x] -= colOff[x];
          pre[x + 1] = pre[x] + f[row + x];
        }
        for (let x = 0; x < w; x++) {
          const x0 = Math.max(0, x - R);
          const x1 = Math.min(w - 1, x + R);
          const m = (pre[x1 + 1] - pre[x0]) / (x1 - x0 + 1);
          let d = f[row + x] - m;
          if (d > 30) d = 30;
          else if (d < -30) d = -30;
          acc[x] += d;
        }
      }
      const gain = this.frames < 12 ? 0.6 : 0.06;
      for (let x = 0; x < w; x++) {
        const est = (acc[x] / h) * gain;
        colOff[x] += est;
        for (let y = 0; y < h; y++) f[y * w + x] -= est;
      }
    }

    // 3. motion-adaptive temporal recursive filter (static: heavy averaging, moving: pass-through)
    const prev = this.prev;
    if (cfg.temporal && this.hasPrev) {
      const tl = this.tlut;
      for (let i = 0; i < n; i++) {
        const d = f[i] - prev[i];
        const ad = d < 0 ? -d : d;
        const k = ad * 0.25;
        const a = tl[k > 1023 ? 1023 : k | 0];
        f[i] = prev[i] + a * d;
      }
    }
    prev.set(f);
    this.hasPrev = true;
    this.frames++;

    // 4. tone mapping
    const gray = this.gray;
    if (cfg.agc === "minmax") {
      const [lo, hi] = percentileRange(f, n);
      const s = 255 / Math.max(1, hi - lo);
      for (let i = 0; i < n; i++) gray[i] = (f[i] - lo) * s;
    } else {
      const hist = this.hist;
      hist.fill(0);
      for (let i = 0; i < n; i++) {
        let b = (f[i] * 0.0625) | 0;
        if (b < 0) b = 0;
        else if (b > BINS - 1) b = BINS - 1;
        hist[b]++;
      }
      let cum = 0;
      let bLo = 0;
      let bHi = BINS - 1;
      for (let b = 0; b < BINS; b++) {
        cum += hist[b];
        if (cum >= n * 0.0005) {
          bLo = b;
          break;
        }
      }
      cum = 0;
      for (let b = BINS - 1; b >= 0; b--) {
        cum += hist[b];
        if (cum >= n * 0.0005) {
          bHi = b;
          break;
        }
      }
      if (bHi <= bLo) bHi = bLo + 1;
      const T = Math.max(8, n * 0.004);
      const floor = T * 0.02;
      let total = 0;
      for (let b = bLo; b <= bHi; b++) total += Math.min(hist[b], T) + floor;
      const next = new Float32Array(BINS);
      let c = 0;
      for (let b = 0; b < BINS; b++) {
        if (b < bLo) next[b] = 0;
        else if (b > bHi) next[b] = 255;
        else {
          c += Math.min(hist[b], T) + floor;
          const eq = (255 * c) / total;
          const lin = (255 * (b - bLo)) / (bHi - bLo);
          next[b] = 0.85 * eq + 0.15 * lin;
        }
      }
      const lut = this.lut;
      if (!this.lutInit || !cfg.lutSmooth) {
        lut.set(next);
        this.lutInit = true;
      } else {
        let diff = 0;
        for (let b = 0; b < BINS; b++) diff += Math.abs(next[b] - lut[b]);
        diff /= BINS * 255;
        const k = diff > 0.15 ? 0.4 : 0.07; // fast attack on real scene change, slow otherwise
        for (let b = 0; b < BINS; b++) lut[b] += k * (next[b] - lut[b]);
      }
      for (let i = 0; i < n; i++) {
        const x = f[i] * 0.0625;
        let b = x | 0;
        if (b < 0) b = 0;
        if (b > BINS - 2) b = BINS - 2;
        const fr = Math.max(0, Math.min(1, x - b));
        gray[i] = lut[b] * (1 - fr) + lut[b + 1] * fr;
      }
    }

    // 5. guarded detail boost (unsharp with clamp to avoid halos)
    if (cfg.detail > 0) {
      const tmp = this.tmp;
      for (let y = 0; y < h; y++) {
        const r = y * w;
        tmp[r] = gray[r];
        tmp[r + w - 1] = gray[r + w - 1];
        for (let x = 1; x < w - 1; x++) tmp[r + x] = (gray[r + x - 1] + gray[r + x] + gray[r + x + 1]) / 3;
      }
      const g = cfg.detail;
      for (let y = 1; y < h - 1; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          const blur = (tmp[i - w] + tmp[i] + tmp[i + w]) / 3;
          let d = gray[i] - blur;
          if (d > 22) d = 22;
          else if (d < -22) d = -22;
          gray[i] = gray[i] + g * d;
        }
      }
    }

    return finish(gray, out, w, h, performance.now() - t0);
  }
}

function finish(gray: Uint8ClampedArray, out: Uint8ClampedArray, w: number, h: number, ms: number): FrameStats {
  const n = w * h;
  let clipped = 0;
  for (let i = 0; i < n; i++) {
    const g = gray[i];
    if (g === 0 || g === 255) clipped++;
    const o = i * 4;
    out[o] = g;
    out[o + 1] = g;
    out[o + 2] = g;
    out[o + 3] = 255;
  }
  // ROI: upper-left sky region, not touched by the hot object
  const x0 = Math.floor(w * 0.02);
  const x1 = Math.floor(w * 0.25);
  const y0 = Math.floor(h * 0.04);
  const y1 = Math.floor(h * 0.2);
  let s = 0;
  let c = 0;
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      s += gray[y * w + x];
      c++;
    }
  return { ms, roiMean: s / Math.max(1, c), clipped: clipped / n };
}

const scratch: { g: Uint8ClampedArray | null } = { g: null };
const pHist = new Uint32Array(BINS);

// Naive auto-stretch used as the baseline: 0.5th to 99.5th percentile, recomputed every frame.
function percentileRange(v: ArrayLike<number>, n: number): [number, number] {
  pHist.fill(0);
  for (let i = 0; i < n; i++) {
    let b = (v[i] * 0.0625) | 0;
    if (b < 0) b = 0;
    else if (b > BINS - 1) b = BINS - 1;
    pHist[b]++;
  }
  let c = 0;
  let lo = 0;
  let hi = BINS - 1;
  for (let b = 0; b < BINS; b++) {
    c += pHist[b];
    if (c >= n * 0.005) {
      lo = b;
      break;
    }
  }
  c = 0;
  for (let b = BINS - 1; b >= 0; b--) {
    c += pHist[b];
    if (c >= n * 0.005) {
      hi = b;
      break;
    }
  }
  return [lo * 16, Math.max(lo * 16 + 16, hi * 16 + 16)];
}

export function baselineMinMax(raw: Uint16Array, w: number, h: number, out: Uint8ClampedArray): FrameStats {
  const t0 = performance.now();
  const n = w * h;
  if (!scratch.g || scratch.g.length !== n) scratch.g = new Uint8ClampedArray(n);
  const gray = scratch.g;
  const [lo, hi] = percentileRange(raw, n);
  const s = 255 / Math.max(1, hi - lo);
  for (let i = 0; i < n; i++) gray[i] = (raw[i] - lo) * s;
  return finish(gray, out, w, h, performance.now() - t0);
}

export function gray8FromRgba(rgba: Uint8ClampedArray, n: number): Uint8Array {
  const g = new Uint8Array(n);
  for (let i = 0; i < n; i++) g[i] = rgba[i * 4];
  return g;
}

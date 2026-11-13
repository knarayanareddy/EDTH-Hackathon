// A small streaming-style thermal ISP (14-bit post-NUC → 8-bit white-hot) + a synthetic scene generator.
// Works on any W×H, including the real 640×512 uint16 dump.
import { gauss, mulberry32 } from "../utils/rng";

export interface IspCfg {
  bad: boolean; // isolated bad-pixel replacement (3 line buffers)
  stripe: boolean; // residual column FPN removal (1×W vector, temporal)
  temporal: boolean; // motion-adaptive recursive denoise (1 frame buffer)
  plateau: boolean; // plateau-limited histogram AGC with smoothed LUT (vs per-frame min/max)
  detail: number; // 0..2 halo-guarded detail gain
  tstr: number; // static-area temporal strength (0.05 strong … 0.6 weak)
  plat: number; // plateau clip, multiples of mean bin count
  lin: number; // blend with linear mapping (0 = full equalisation)
}
export const DEFAULT_ISP: IspCfg = { bad: true, stripe: true, temporal: true, plateau: true, detail: 0.8, tstr: 0.2, plat: 2.5, lin: 0.35 };

export class Scene {
  w: number; h: number; t = 0; flare = true;
  private bg: Float32Array; private col: Float32Array; private bads: { i: number; v: number }[] = [];
  private r = mulberry32(5);
  constructor(w: number, h: number) {
    this.w = w; this.h = h;
    const r = mulberry32(11);
    this.bg = new Float32Array(w * h);
    this.col = new Float32Array(w);
    for (let x = 0; x < w; x++) this.col[x] = (r() - 0.5) * 60;
    const lf = new Float32Array(w * h); // low-frequency clutter
    for (let k = 0; k < 40; k++) {
      const cx = r() * w, cy = r() * h, rad = 12 + r() * 40, a = (r() - 0.5) * 120;
      for (let y = Math.max(0, cy - rad | 0); y < Math.min(h, cy + rad); y++) for (let x = Math.max(0, cx - rad | 0); x < Math.min(w, cx + rad); x++) lf[y * w + x] += a * Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / (rad * rad));
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const fy = y / h, fx = x / w;
      let v = 7400 + 600 * Math.min(1, Math.max(0, (fy - 0.38) / 0.12)) + 120 * fy + lf[y * w + x];
      if (fx > 0.08 && fx < 0.3 && fy > 0.25 && fy < 0.62) { v += 320; if (((x / w * 40) | 0) % 3 === 0 && ((y / h * 30) | 0) % 3 === 0) v += 130; }
      if (fx > 0.55 && fx < 0.62 && fy > 0.5 && fy < 0.75) v += 180; // pole / vegetation
      this.bg[y * w + x] = v;
    }
    for (let i = 0; i < Math.round(w * h / 4000); i++) this.bads.push({ i: (r() * w * h) | 0, v: r() < 0.5 ? 2400 : -2400 });
  }
  next(out: Uint16Array) {
    const { w, h } = this; const t = this.t++; const r = this.r;
    const drift = 150 * Math.sin(t / 90) + (t % 420 > 417 ? 160 : 0);
    const px = ((t * 0.9) % (w * 1.1)) | 0, pw = Math.max(3, w / 55 | 0), ph = h / 6 | 0, py = (h * 0.62) | 0;
    const cx = w - ((t * 2.2) % (w * 1.6)), cy = (h * 0.8) | 0;
    const fOn = this.flare && (t % 300) > 110 && (t % 300) < 200;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let v = this.bg[y * w + x];
      if (x >= px && x < px + pw && y >= py && y < py + ph) v += 850 + (y < py + ph / 4 ? 250 : 0);
      if (x >= cx && x < cx + w / 14 && y > cy - h / 28 && y < cy + h / 28) v += 1500 + ((x - cx) < w / 40 ? 900 : 0);
      if (fOn && (x - w * 0.82) ** 2 + (y - h * 0.18) ** 2 < (h / 14) ** 2) v = 15800;
      out[y * w + x] = Math.max(0, Math.min(16383, v + drift + this.col[x] + gauss(r) * 30));
    }
    for (const b of this.bads) out[b.i] = Math.max(0, Math.min(16383, out[b.i] + b.v));
  }
}

export interface Frames { naive: Uint8ClampedArray; out: Uint8ClampedArray }
export interface Stats { ms: number; roiNaive: number; roiOut: number }

export class Isp {
  w: number; h: number; n: number;
  private a: Float32Array; private b: Float32Array; private prev: Float32Array; private havePrev = false;
  private colAcc: Float32Array; private haveCol = false;
  private lut = new Float32Array(1024); private haveLut = false; private lo = 0; private hi = 1;
  private hist = new Uint32Array(16384); private tone: Float32Array; private tmp: Float32Array;
  constructor(w: number, h: number) {
    this.w = w; this.h = h; this.n = w * h;
    this.a = new Float32Array(this.n); this.b = new Float32Array(this.n); this.prev = new Float32Array(this.n);
    this.colAcc = new Float32Array(w); this.tone = new Float32Array(this.n); this.tmp = new Float32Array(this.n);
  }
  reset() { this.havePrev = false; this.haveCol = false; this.haveLut = false; }

  process(raw: ArrayLike<number>, c: IspCfg, outFrames: Frames): number {
    const t0 = performance.now();
    const { w, h, n } = this;
    const a = this.a;
    for (let i = 0; i < n; i++) a[i] = raw[i];

    // naive baseline: per-frame min/max
    let mn = 1e9, mx = -1e9;
    for (let i = 0; i < n; i++) { const v = a[i]; if (v < mn) mn = v; if (v > mx) mx = v; }
    const ks = 255 / Math.max(1, mx - mn);
    for (let i = 0; i < n; i++) outFrames.naive[i] = (a[i] - mn) * ks;

    // 1. isolated bad pixels: outside the 4-neighbour range by > T (needs 3 line buffers)
    if (c.bad) {
      const T = 260;
      const b = this.b; b.set(a);
      for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
        const i = y * w + x, v = a[i];
        const l = a[i - 1], r = a[i + 1], u = a[i - w], d = a[i + w];
        const lo = Math.min(l, r, u, d), hi = Math.max(l, r, u, d);
        if (v > hi + T || v < lo - T) b[i] = (l + r + u + d) / 4;
      }
      a.set(b);
    }
    // 2. residual column FPN: per-column mean of (pixel − local horizontal mean), clamped, recursively averaged over time
    if (c.stripe) {
      const est = new Float32Array(w);
      const R = 6;
      for (let y = 0; y < h; y += 2) {
        const o = y * w;
        let s = 0, cnt = 0;
        for (let x = 0; x <= R && x < w; x++) { s += a[o + x]; cnt++; }
        for (let x = 0; x < w; x++) {
          const m = s / cnt;
          const d = a[o + x] - m;
          est[x] += d < -40 ? -40 : d > 40 ? 40 : d;
          const add = x + R + 1, rem = x - R;
          if (add < w) { s += a[o + add]; cnt++; }
          if (rem >= 0) { s -= a[o + rem]; cnt--; }
        }
      }
      const rows = Math.ceil(h / 2);
      const al = this.haveCol ? 0.04 : 1;
      for (let x = 0; x < w; x++) this.colAcc[x] += al * (est[x] / rows - this.colAcc[x]);
      this.haveCol = true;
      // remove the DC of the estimate so only column-to-column differences are subtracted
      let mean = 0; for (let x = 0; x < w; x++) mean += this.colAcc[x]; mean /= w;
      for (let y = 0; y < h; y++) { const o = y * w; for (let x = 0; x < w; x++) a[o + x] -= this.colAcc[x] - mean; }
    }
    // 3. motion-adaptive recursive temporal filter (1 frame buffer). Large |diff| → pass through (no ghosting)
    if (c.temporal) {
      const p = this.prev;
      if (this.havePrev) {
        const Tm = 260;
        for (let i = 0; i < n; i++) {
          const d = a[i] - p[i];
          const ad = d < 0 ? -d : d;
          const k = Math.min(1, Math.max(c.tstr, ad / Tm));
          a[i] = p[i] + k * d;
        }
      }
      p.set(a); this.havePrev = true;
    } else this.havePrev = false;

    // 4. AGC on a FIXED 1024-bin axis (16 counts/bin). Plateau-clipped CDF means a small hot object adds only a clipped
    //    amount of mass far away, so the background mapping does not move when it appears (no pumping).
    //    The LUT built from the PREVIOUS frame is applied to this frame (streaming) and is smoothed in time.
    const tone = this.tone;
    const NB = 1024, SC = (NB - 1) / 16383;
    if (c.plateau && this.haveLut) {
      const L = this.lut;
      for (let i = 0; i < n; i++) {
        const v = a[i] < 0 ? 0 : a[i] > 16383 ? 16383 : a[i];
        const f = v * SC, i0 = f | 0, fr = f - i0;
        tone[i] = L[i0] * (1 - fr) + L[i0 + 1 > NB - 1 ? NB - 1 : i0 + 1] * fr;
      }
    } else {
      const sc = 255 / Math.max(1, mx - mn);
      for (let i = 0; i < n; i++) tone[i] = (a[i] - mn) * sc;
    }
    if (c.plateau) {
      const H = this.hist; H.fill(0);
      const bins = new Float32Array(NB);
      for (let i = 0; i < n; i++) { const v = a[i] < 0 ? 0 : a[i] > 16383 ? 16383 : a[i]; H[v | 0]++; bins[(v * SC + 0.5) | 0]++; }
      // robust linear range from percentiles (p98 on purpose: a ~1% hot object must not stretch it)
      let acc = 0, p1 = 0, p98 = 16383; const c1 = n * 0.01, c2 = n * 0.98;
      for (let v = 0; v < 16384; v++) { acc += H[v]; if (acc < c1) p1 = v; if (acc < c2) p98 = v; }
      const hiN = p98 + 0.25 * (p98 - p1);
      const al = this.haveLut ? 0.05 : 1;
      this.lo += al * (p1 - this.lo); this.hi += al * (hiN - this.hi);
      let occ = 0; for (let i = 0; i < NB; i++) if (bins[i] > 0) occ++;
      const clip = (n / Math.max(1, occ)) * c.plat;
      let ct = 0; for (let i = 0; i < NB; i++) ct += Math.min(bins[i], clip);
      const next = new Float32Array(NB);
      let cum = 0;
      const span = Math.max(300, this.hi - this.lo);
      for (let i = 0; i < NB; i++) {
        cum += Math.min(bins[i], clip);
        const eq = 255 * (cum / Math.max(1, ct));
        const lin = Math.min(255, Math.max(0, ((i / (NB - 1)) * 16383 - this.lo) * 255 / span));
        next[i] = c.lin * lin + (1 - c.lin) * eq;
      }
      const sm = this.haveLut ? 0.08 : 1;
      for (let i = 0; i < NB; i++) this.lut[i] += sm * (next[i] - this.lut[i]);
      this.haveLut = true;
    } else this.haveLut = false;

    // 5. halo-guarded detail: base = 9×9 box; detail gain falls off for large (edge) details; hard clamp
    let detailed = false;
    if (c.detail > 0.01) {
      const base = this.tmp, b2 = this.b; const R = 4;
      for (let y = 0; y < h; y++) { // horizontal running sum
        const o = y * w; let s = 0;
        for (let x = -R; x <= R; x++) s += tone[o + Math.min(w - 1, Math.max(0, x))];
        for (let x = 0; x < w; x++) { b2[o + x] = s / (2 * R + 1); s += tone[o + Math.min(w - 1, x + R + 1)] - tone[o + Math.max(0, x - R)]; }
      }
      for (let x = 0; x < w; x++) { // vertical running sum
        let s = 0;
        for (let y = -R; y <= R; y++) s += b2[Math.min(h - 1, Math.max(0, y)) * w + x];
        for (let y = 0; y < h; y++) { base[y * w + x] = s / (2 * R + 1); s += b2[Math.min(h - 1, y + R + 1) * w + x] - b2[Math.max(0, y - R) * w + x]; }
      }
      const g = c.detail * 2.2;
      for (let i = 0; i < n; i++) {
        const d = tone[i] - base[i]; const ad = d < 0 ? -d : d;
        const gain = g / (1 + (ad / 14) * (ad / 14));
        outFrames.out[i] = tone[i] + gain * d;
      }
      detailed = true;
    }
    if (!detailed) for (let i = 0; i < n; i++) outFrames.out[i] = tone[i];
    return performance.now() - t0;
  }
}

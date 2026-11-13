import { boxBlur, percentileSample, noiseSigma } from './dsp';

export interface GT { clean: Float32Array; cleanNoThin: Float32Array; thinMask: Uint8Array }

function grad(img: Float32Array, W: number, H: number) {
  const gx = new Float32Array(W * H), gy = new Float32Array(W * H);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x; gx[i] = (img[i + 1] - img[i - 1]) * 0.5; gy[i] = (img[i + W] - img[i - W]) * 0.5;
  }
  return { gx, gy };
}

/** Gradient-projection "edge keep" over the strongest 5 % reference edges: 1 = preserved, <1 smoothed away, noise does not inflate it. */
export function edgeKeep(test: Float32Array, ref: Float32Array, W: number, H: number): number {
  const a = grad(test, W, H), b = grad(ref, W, H);
  const mag = new Float32Array(W * H); for (let i = 0; i < mag.length; i++) mag[i] = Math.hypot(b.gx[i], b.gy[i]);
  const thr = percentileSample(mag, 0.95, 3);
  let num = 0, den = 0;
  for (let i = 0; i < mag.length; i++) if (mag[i] >= thr && mag[i] > 0) { num += a.gx[i] * b.gx[i] + a.gy[i] * b.gy[i]; den += mag[i] * mag[i]; }
  return den > 0 ? num / den : 1;
}

export interface GTMetrics { psnr: number; ssim: number; colRes: number; rowRes: number; edgeKeep: number; thinRet: number }

export function evalGT(r: Float32Array, gt: GT, W: number, H: number): GTMetrics {
  const N = W * H;
  const lo = percentileSample(gt.clean, 0.01, 3), hi = Math.max(lo + 100, percentileSample(gt.clean, 0.99, 3));
  const L = hi - lo;
  const a = new Float32Array(N), b = new Float32Array(N);
  let mse = 0;
  for (let i = 0; i < N; i++) {
    a[i] = (Math.max(lo, Math.min(hi, r[i])) - lo) / L * 255; b[i] = (Math.max(lo, Math.min(hi, gt.clean[i])) - lo) / L * 255;
    mse += (a[i] - b[i]) ** 2;
  }
  mse = Math.max(1e-6, mse / N);
  const psnr = 10 * Math.log10((255 * 255) / mse);
  // SSIM (7x7 uniform window)
  const mu1 = boxBlur(a, W, H, 3), mu2 = boxBlur(b, W, H, 3);
  const a2 = new Float32Array(N), b2 = new Float32Array(N), ab = new Float32Array(N);
  for (let i = 0; i < N; i++) { a2[i] = a[i] * a[i]; b2[i] = b[i] * b[i]; ab[i] = a[i] * b[i]; }
  const s11 = boxBlur(a2, W, H, 3), s22 = boxBlur(b2, W, H, 3), s12 = boxBlur(ab, W, H, 3);
  const C1 = 6.5025, C2 = 58.5225; let ss = 0;
  for (let i = 0; i < N; i++) {
    const v1 = s11[i] - mu1[i] ** 2, v2 = s22[i] - mu2[i] ** 2, cv = s12[i] - mu1[i] * mu2[i];
    ss += ((2 * mu1[i] * mu2[i] + C1) * (2 * cv + C2)) / ((mu1[i] ** 2 + mu2[i] ** 2 + C1) * (v1 + v2 + C2));
  }
  // remaining stripe energy = rms of column / row means of (restored - clean), excluding hot pixels
  const colM = new Float64Array(W), colC = new Float64Array(W), rowM = new Float64Array(H), rowC = new Float64Array(H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, d = r[i] - gt.clean[i];
    if (Math.abs(d) < 300 && gt.clean[i] < 12000) { colM[x] += d; colC[x]++; rowM[y] += d; rowC[y]++; }
  }
  const rms = (m: Float64Array, c: Float64Array) => {
    const v: number[] = []; for (let i = 0; i < m.length; i++) if (c[i] > 0) v.push(m[i] / c[i]);
    const mean = v.reduce((p, q) => p + q, 0) / Math.max(1, v.length);
    return Math.sqrt(v.reduce((p, q) => p + (q - mean) ** 2, 0) / Math.max(1, v.length));
  };
  let tn = 0, td = 0;
  for (let i = 0; i < N; i++) if (gt.thinMask[i] && gt.clean[i] < 12000) { tn += r[i] - gt.cleanNoThin[i]; td += gt.clean[i] - gt.cleanNoThin[i]; }
  return { psnr, ssim: ss / N, colRes: rms(colM, colC), rowRes: rms(rowM, rowC), edgeKeep: edgeKeep(r, gt.clean, W, H), thinRet: td !== 0 ? tn / td : 1 };
}

export interface NoRefMetrics { colProxy: number; rowProxy: number; sigma: number; edgeKeep: number; clipPct: number }

/** Reference-free proxies. They can be gamed by over-smoothing; read together with edgeKeep. */
export function evalNoRef(r: Float32Array, input: Float32Array, out8: Uint8ClampedArray, W: number, H: number): NoRefMetrics {
  const proxy = (horizontal: boolean) => {
    const nL = horizontal ? W : H, nA = horizontal ? H : W;
    const st = horizontal ? 1 : W, as = horizontal ? W : 1;
    const g: number[] = [];
    for (let l = 1; l < nL - 1; l += 4) for (let t = 1; t < nA - 1; t += 4) g.push(Math.abs(r[l * st + (t + 1) * as] - r[l * st + (t - 1) * as]));
    const ga = Float32Array.from(g); ga.sort(); const thr = ga[Math.floor(ga.length * 0.5)] || 1;
    const prof: number[] = [];
    for (let l = 1; l < nL - 1; l++) {
      let s = 0, c = 0;
      for (let t = 1; t < nA - 1; t++) {
        const p = t * as; if (Math.abs(r[l * st + p + as] - r[l * st + p - as]) > thr) continue;
        const d = r[l * st + p] - 0.5 * (r[(l - 1) * st + p] + r[(l + 1) * st + p]);
        if (Math.abs(d) < 150) { s += d; c++; }
      }
      if (c > 10) prof.push(s / c);
    }
    return Math.sqrt(prof.reduce((p, q) => p + q * q, 0) / Math.max(1, prof.length));
  };
  let clip = 0; for (let i = 0; i < out8.length; i++) if (out8[i] === 0 || out8[i] === 255) clip++;
  return { colProxy: proxy(true), rowProxy: proxy(false), sigma: noiseSigma(r, W, H), edgeKeep: edgeKeep(r, input, W, H), clipPct: (100 * clip) / out8.length };
}

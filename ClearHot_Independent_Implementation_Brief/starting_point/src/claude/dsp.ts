// Pure DSP helpers (no DOM). Operate on Float32Array images, row-major.

export function quickselect(a: Float32Array, n: number, k: number): number {
  let l = 0, r = n - 1;
  while (l < r) {
    const pivot = a[(l + r) >> 1];
    let i = l, j = r;
    while (i <= j) {
      while (a[i] < pivot) i++;
      while (a[j] > pivot) j--;
      if (i <= j) { const t = a[i]; a[i] = a[j]; a[j] = t; i++; j--; }
    }
    if (k <= j) r = j; else if (k >= i) l = i; else return a[k];
  }
  return a[k];
}
export function medianOf(a: Float32Array, n: number) { return n === 0 ? 0 : quickselect(a, n, n >> 1); }

export function percentileSample(src: ArrayLike<number>, q: number, step = 7): number {
  const n = Math.ceil(src.length / step);
  const buf = new Float32Array(n);
  let m = 0;
  for (let i = 0; i < src.length; i += step) buf[m++] = src[i];
  return quickselect(buf, m, Math.min(m - 1, Math.floor(q * m)));
}

export function boxBlur(src: Float32Array, W: number, H: number, rx: number, ry = rx): Float32Array {
  const tmp = new Float32Array(W * H), out = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    const o = y * W;
    let sum = 0;
    for (let x = 0; x <= Math.min(rx, W - 1); x++) sum += src[o + x];
    for (let x = 0; x < W; x++) {
      if (x > 0) { if (x + rx < W) sum += src[o + x + rx]; if (x - rx - 1 >= 0) sum -= src[o + x - rx - 1]; }
      tmp[o + x] = sum / (Math.min(W - 1, x + rx) - Math.max(0, x - rx) + 1);
    }
  }
  for (let x = 0; x < W; x++) {
    let sum = 0;
    for (let y = 0; y <= Math.min(ry, H - 1); y++) sum += tmp[y * W + x];
    for (let y = 0; y < H; y++) {
      if (y > 0) { if (y + ry < H) sum += tmp[(y + ry) * W + x]; if (y - ry - 1 >= 0) sum -= tmp[(y - ry - 1) * W + x]; }
      out[y * W + x] = sum / (Math.min(H - 1, y + ry) - Math.max(0, y - ry) + 1);
    }
  }
  return out;
}

/** Self-guided edge-preserving filter (He et al.). eps in squared image units. */
export function guidedSelf(I: Float32Array, W: number, H: number, r: number, eps: number): Float32Array {
  const m = boxBlur(I, W, H, r);
  const sq = new Float32Array(I.length);
  for (let i = 0; i < I.length; i++) sq[i] = I[i] * I[i];
  const mm = boxBlur(sq, W, H, r);
  const a = new Float32Array(I.length), b = new Float32Array(I.length);
  for (let i = 0; i < I.length; i++) {
    const v = Math.max(0, mm[i] - m[i] * m[i]);
    a[i] = v / (v + eps); b[i] = m[i] - a[i] * m[i];
  }
  const ma = boxBlur(a, W, H, r), mb = boxBlur(b, W, H, r);
  const out = new Float32Array(I.length);
  for (let i = 0; i < I.length; i++) out[i] = ma[i] * I[i] + mb[i];
  return out;
}

/** Robust single-frame noise sigma (Immerkaer Laplacian-difference kernel, median-based). */
export function noiseSigma(I: ArrayLike<number>, W: number, H: number): number {
  const bins = new Uint32Array(2048); let n = 0;
  for (let y = 1; y < H - 1; y += 2) for (let x = 1; x < W - 1; x += 2) {
    const i = y * W + x;
    const r = I[i - W - 1] - 2 * I[i - W] + I[i - W + 1] - 2 * I[i - 1] + 4 * I[i] - 2 * I[i + 1] + I[i + W - 1] - 2 * I[i + W] + I[i + W + 1];
    const b = Math.min(2047, Math.floor(Math.abs(r) * 4));
    bins[b]++; n++;
  }
  let c = 0, k = 0;
  while (k < 2048 && c < n / 2) { c += bins[k]; k++; }
  return Math.max(0.3, (k / 4) / 4.047);
}

// ---------- FFT (radix-2, in place) ----------
export function fft(re: Float64Array, im: Float64Array, inverse = false) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = ((inverse ? 2 : -2) * Math.PI) / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = i + k + len / 2;
        const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        const ncr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = ncr;
      }
    }
  }
  if (inverse) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
}

// ---------- Line (row / column) offset estimation ----------
export type Orient = 'col' | 'row';
export function lineGeom(o: Orient, W: number, H: number) {
  return o === 'col' ? { nL: W, nA: H, ls: 1, as: W } : { nL: H, nA: W, ls: W, as: 1 };
}

/** Along-stripe gradient gate: stripes do not affect gradients along their own direction, so this
 *  gate does not bias against strongly striped lines. It excludes edges that cross the stripe direction. */
function alongGate(img: Float32Array, W: number, H: number, o: Orient, pct: number) {
  const { nL, nA, ls, as } = lineGeom(o, W, H);
  const samp: number[] = [];
  for (let l = 0; l < nL; l += 3) for (let t = 1; t < nA - 1; t += 3) samp.push(Math.abs(img[l * ls + (t + 1) * as] - img[l * ls + (t - 1) * as]));
  const a = Float32Array.from(samp);
  return quickselect(a, a.length, Math.floor(pct * (a.length - 1)));
}

/** Cross-line step magnitude |mean(left kg lines) - mean(right kg lines)| (centre line excluded, so it does not
 *  depend on the offset of the line being estimated). Large values = a scene edge running along the stripes
 *  (e.g. horizon seen by the row estimator). */
function stepThreshold(img: Float32Array, W: number, H: number, o: Orient, kg: number, pct: number) {
  const { nL, nA, ls, as } = lineGeom(o, W, H);
  const samp: number[] = [];
  for (let l = kg; l < nL - kg; l += 3) for (let t = 1; t < nA - 1; t += 3) {
    let a = 0, b = 0;
    for (let j = 1; j <= kg; j++) { a += img[(l - j) * ls + t * as]; b += img[(l + j) * ls + t * as]; }
    samp.push(Math.abs(a - b) / kg);
  }
  const arr = Float32Array.from(samp);
  return quickselect(arr, arr.length, Math.floor(pct * (arr.length - 1)));
}

export interface LineEstOpts { k: number; kg: number; segs: number; clipE: number; thrAlong: number; thrStep: number }

/** One estimation sweep. For each line: robust residual vs the mean of neighbouring lines (their current offsets removed),
 *  only from samples that (a) are flat along the stripe direction and (b) are not on a cross-line step edge.
 *  The per-line value is the minimum-magnitude, sign-consistent median over `segs` segments along the line:
 *  a true stripe spans the whole line, whereas a pole / wire / edge segment only covers part of it. */
function lineSweep(img: Float32Array, W: number, H: number, o: Orient, off: Float32Array | null, op: LineEstOpts): Float32Array {
  const { nL, nA, ls, as } = lineGeom(o, W, H);
  const out = new Float32Array(nL);
  const segLen = Math.ceil(nA / op.segs);
  const bufs = Array.from({ length: op.segs }, () => new Float32Array(segLen));
  const cnt = new Int32Array(op.segs), med = new Float32Array(op.segs);
  for (let l = 0; l < nL; l++) {
    cnt.fill(0);
    const j0 = Math.max(0, l - op.k), j1 = Math.min(nL - 1, l + op.k);
    const haveBoth = l - op.kg >= 0 && l + op.kg <= nL - 1;
    for (let t = 1; t < nA - 1; t++) {
      const p = t * as;
      if (Math.abs(img[l * ls + p + as] - img[l * ls + p - as]) > op.thrAlong) continue;
      let s = 0, c = 0, sl = 0, sr = 0;
      for (let j = j0; j <= j1; j++) {
        if (j === l) continue;
        const v = img[j * ls + p] - (off ? off[j] : 0);
        s += v; c++;
        if (j < l && l - j <= op.kg) sl += v; else if (j > l && j - l <= op.kg) sr += v;
      }
      if (haveBoth && Math.abs(sl - sr) / op.kg > op.thrStep) continue;
      const e = img[l * ls + p] - (off ? off[l] : 0) - s / c;
      if (Math.abs(e) > op.clipE) continue;
      const sg = Math.min(op.segs - 1, Math.floor(t / segLen));
      bufs[sg][cnt[sg]++] = e;
    }
    let nv = 0, pos = 0, neg = 0, minAbs = Infinity;
    for (let g = 0; g < op.segs; g++) {
      if (cnt[g] < segLen * 0.12) continue;
      const m = medianOf(bufs[g], cnt[g]); med[nv++] = m;
      if (m > 0) pos++; else if (m < 0) neg++;
      minAbs = Math.min(minAbs, Math.abs(m));
    }
    if (nv < Math.min(2, op.segs) || (pos > 0 && neg > 0 && Math.min(pos, neg) > 0 && Math.min(pos, neg) >= 1 && minAbs < Infinity && pos !== nv && neg !== nv)) { out[l] = 0; continue; }
    const sign = pos >= neg ? 1 : -1;
    out[l] = sign * minAbs;
  }
  return out;
}

/** Instance A / B core: iterated robust local-neighbour offset estimator. */
export function estimateLineOffsetsLocal(img: Float32Array, W: number, H: number, o: Orient, k = 4, iters = 3, gatePct = 0.75, clipE = 300, segs = 4): Float32Array {
  const { nL } = lineGeom(o, W, H);
  const op: LineEstOpts = { k, kg: Math.min(4, k), segs, clipE, thrAlong: alongGate(img, W, H, o, gatePct) + 1e-3, thrStep: stepThreshold(img, W, H, o, Math.min(4, k), 0.7) + 1e-3 };
  const off = new Float32Array(nL);
  for (let it = 0; it < iters; it++) {
    const d = lineSweep(img, W, H, o, off, op);
    for (let l = 0; l < nL; l++) off[l] += d[l];
  }
  let m = 0; for (let l = 0; l < nL; l++) m += off[l]; m /= nL;
  for (let l = 0; l < nL; l++) off[l] -= m;
  return off;
}

/** Instance C core: wide-reference residual profile + spectral shrinkage / periodic-peak notch, iterated. */
export function estimateLineOffsetsSpectral(img: Float32Array, W: number, H: number, o: Orient, cutoff: number, peakK: number, mode: 'both' | 'broadband' | 'peaks', R = 8, clipE = 300, iters = 3): Float32Array {
  const { nL } = lineGeom(o, W, H);
  const op: LineEstOpts = { k: R, kg: 4, segs: 4, clipE, thrAlong: alongGate(img, W, H, o, 0.75) + 1e-3, thrStep: stepThreshold(img, W, H, o, 4, 0.7) + 1e-3 };
  const off = new Float32Array(nL);
  let n = 1; while (n < nL * 2) n <<= 1;
  const win = (l: number) => 0.3 + 0.7 * (0.5 - 0.5 * Math.cos((2 * Math.PI * (l + 0.5)) / nL));
  for (let it = 0; it < iters; it++) {
    const prof = lineSweep(img, W, H, o, off, op);
    const re = new Float64Array(n), im = new Float64Array(n);
    let mean = 0; for (let l = 0; l < nL; l++) mean += prof[l]; mean /= nL;
    for (let l = 0; l < nL; l++) re[l] = (prof[l] - mean) * win(l);
    fft(re, im);
    const half = n / 2, amp = new Float64Array(half + 1);
    for (let f = 0; f <= half; f++) amp[f] = Math.hypot(re[f], im[f]);
    const mask = new Float64Array(half + 1);
    for (let f = 1; f <= half; f++) {
      const hp = 1 - Math.exp(-(((f / n) / Math.max(1e-4, cutoff)) ** 2));
      const w0 = Math.max(1, f - 12), w1 = Math.min(half, f + 12);
      const loc = new Float32Array(w1 - w0 + 1); for (let q = w0; q <= w1; q++) loc[q - w0] = amp[q];
      const peak = amp[f] > peakK * (medianOf(loc, loc.length) + 1e-9) ? 1 : 0;
      mask[f] = mode === 'broadband' ? hp : mode === 'peaks' ? peak : Math.max(hp, peak);
    }
    for (let f = 0; f <= half; f++) { const g = mask[f]; re[f] *= g; im[f] *= g; if (f > 0 && f < half) { re[n - f] *= g; im[n - f] *= g; } }
    fft(re, im, true);
    for (let l = 0; l < nL; l++) off[l] += re[l] / win(l);
  }
  let m2 = 0; for (let l = 0; l < nL; l++) m2 += off[l]; m2 /= nL;
  for (let l = 0; l < nL; l++) off[l] -= m2;
  return off;
}

export function applyLineOffsets(img: Float32Array, W: number, H: number, o: Orient, off: Float32Array, strength: number) {
  if (strength === 0) return;
  if (o === 'col') { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) img[y * W + x] -= off[x] * strength; }
  else { for (let y = 0; y < H; y++) { const v = off[y] * strength; for (let x = 0; x < W; x++) img[y * W + x] -= v; } }
}

// ---------- Bad pixel: robust, isolation-aware ----------
export function robustBadPixels(img: Float32Array, W: number, H: number, sigma: number): Float32Array {
  const out = Float32Array.from(img);
  const thr = Math.max(8 * sigma, 150);
  const nb = new Float32Array(8);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x, v = img[i];
    const m4 = (img[i - 1] + img[i + 1] + img[i - W] + img[i + W]) * 0.25;
    if (Math.abs(v - m4) <= thr) continue;
    nb[0] = img[i - W - 1]; nb[1] = img[i - W]; nb[2] = img[i - W + 1]; nb[3] = img[i - 1];
    nb[4] = img[i + 1]; nb[5] = img[i + W - 1]; nb[6] = img[i + W]; nb[7] = img[i + W + 1];
    const med = (quickselect(nb, 8, 3) + quickselect(nb, 8, 4)) * 0.5;
    const dev = v - med;
    if (Math.abs(dev) <= thr) continue;
    let close = 0;
    for (let k = 0; k < 8; k++) if (Math.abs(nb[k] - v) < Math.abs(dev) * 0.5) close++;
    if (close === 0) out[i] = med; // isolated spike only; 2+ px hot objects are kept
  }
  return out;
}

// ---------- Bilateral 5x5 ----------
export function bilateral5(img: Float32Array, W: number, H: number, sigmaR: number, mix: number): Float32Array {
  const out = Float32Array.from(img);
  const sw = [1, 0.8, 0.45]; // spatial weight by radius index (approx gaussian, sigma~1.4)
  const lut = new Float32Array(4096);
  for (let i = 0; i < 4096; i++) { const d = i / 8; lut[i] = Math.exp(-(d * d) / (2 * sigmaR * sigmaR)); }
  for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
    const i = y * W + x, c = img[i];
    let sum = 0, ws = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const v = img[i + dy * W + dx];
      const d = Math.min(4095, Math.round(Math.abs(v - c) * 8));
      const w = lut[d] * sw[Math.max(Math.abs(dx), Math.abs(dy))] ;
      sum += w * v; ws += w;
    }
    out[i] = c + (sum / ws - c) * mix;
  }
  return out;
}

// ---------- CLAHE on 0..255 floats ----------
export function clahe(img: Float32Array, W: number, H: number, tilesX: number, tilesY: number, clip: number): Float32Array {
  const tw = W / tilesX, th = H / tilesY;
  const luts = new Float32Array(tilesX * tilesY * 256);
  for (let ty = 0; ty < tilesY; ty++) for (let tx = 0; tx < tilesX; tx++) {
    const x0 = Math.floor(tx * tw), x1 = Math.floor((tx + 1) * tw), y0 = Math.floor(ty * th), y1 = Math.floor((ty + 1) * th);
    const hist = new Float64Array(256); let n = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { hist[Math.max(0, Math.min(255, Math.round(img[y * W + x])))]++; n++; }
    const limit = Math.max(1, (clip * n) / 256);
    let excess = 0;
    for (let b = 0; b < 256; b++) if (hist[b] > limit) { excess += hist[b] - limit; hist[b] = limit; }
    const add = excess / 256;
    let cum = 0; const base = (ty * tilesX + tx) * 256;
    for (let b = 0; b < 256; b++) { hist[b] += add; cum += hist[b]; luts[base + b] = (cum / n) * 255; }
  }
  const out = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    const fy = Math.max(0, Math.min(tilesY - 1, (y + 0.5) / th - 0.5));
    const ty0 = Math.floor(fy), ty1 = Math.min(tilesY - 1, ty0 + 1), wy = fy - ty0;
    for (let x = 0; x < W; x++) {
      const fx = Math.max(0, Math.min(tilesX - 1, (x + 0.5) / tw - 0.5));
      const tx0 = Math.floor(fx), tx1 = Math.min(tilesX - 1, tx0 + 1), wx = fx - tx0;
      const v = Math.max(0, Math.min(255, Math.round(img[y * W + x])));
      const a = luts[(ty0 * tilesX + tx0) * 256 + v], b = luts[(ty0 * tilesX + tx1) * 256 + v];
      const c = luts[(ty1 * tilesX + tx0) * 256 + v], d = luts[(ty1 * tilesX + tx1) * 256 + v];
      out[y * W + x] = (a * (1 - wx) + b * wx) * (1 - wy) + (c * (1 - wx) + d * wx) * wy;
    }
  }
  return out;
}

// Core image-processing primitives for ClearHot Lab (pure functions, no DOM).
// All "ADU" arithmetic is on raw sensor counts. Nothing here converts counts to temperature.

export type Axis = "col" | "row";

export function robustSigma(values: ArrayLike<number>, step = 1): { median: number; sigma: number } {
  const n = Math.ceil(values.length / step);
  if (n === 0) return { median: 0, sigma: 0 };
  const tmp = new Float32Array(n);
  for (let i = 0, k = 0; i < values.length; i += step, k++) tmp[k] = values[i];
  tmp.sort();
  const med = tmp[n >> 1];
  for (let i = 0; i < n; i++) tmp[i] = Math.abs(tmp[i] - med);
  tmp.sort();
  return { median: med, sigma: 1.4826 * tmp[n >> 1] };
}

/** Robust per-pixel noise estimate from the residual to the mean of 4 neighbours (includes some scene texture). */
export function estimateNoiseSigma(src: Float32Array, w: number, h: number): number {
  const res = new Float32Array(Math.max(1, (w - 2) * (h - 2)));
  let k = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      res[k++] = src[i] - 0.25 * (src[i - 1] + src[i + 1] + src[i - w] + src[i + w]);
    }
  }
  return robustSigma(res, 3).sigma / Math.sqrt(1.25);
}

/**
 * Estimates a per-line (column or row) additive offset profile with a differential method:
 *  1. d[l] = trimmed mean over the line of (pixel on line l+1 - pixel on line l), trimmed at gateK robust-sigmas
 *     around the median so that scene edges crossing the line are excluded;
 *  2. integrate d to a profile and remove its slow trend with a moving average of half-width hw lines.
 * Slow variations across lines (wider than ~hw) are NOT corrected because they cannot be told apart from scene content.
 * LIMITATION: a genuine full-length scene line is indistinguishable from a stripe and will be partly removed.
 */
export function lineProfile(
  src: Float32Array,
  w: number,
  h: number,
  axis: Axis,
  hw: number,
  gateK: number,
): { profile: Float32Array; sigma: number } {
  const nLines = axis === "col" ? w : h;
  const nAlong = axis === "col" ? h : w;
  const lineStride = axis === "col" ? 1 : w;
  const alongStride = axis === "col" ? w : 1;
  const d = new Float32Array(nLines);
  const col = new Float32Array(nAlong);
  const dev = new Float32Array(nAlong);
  let sigSum = 0;
  for (let l = 0; l < nLines - 1; l++) {
    for (let t = 0; t < nAlong; t++) {
      col[t] = src[(l + 1) * lineStride + t * alongStride] - src[l * lineStride + t * alongStride];
    }
    const sorted = col.slice().sort();
    const med = sorted[nAlong >> 1];
    for (let t = 0; t < nAlong; t++) dev[t] = Math.abs(col[t] - med);
    dev.sort();
    const sg = Math.max(1e-3, 1.4826 * dev[nAlong >> 1]);
    sigSum += sg;
    const lim = gateK * sg;
    let s = 0;
    let k = 0;
    for (let t = 0; t < nAlong; t++) {
      if (Math.abs(col[t] - med) <= lim) {
        s += col[t];
        k++;
      }
    }
    d[l] = k > 0.2 * nAlong ? s / k : med;
  }
  const p = new Float64Array(nLines);
  for (let l = 1; l < nLines; l++) p[l] = p[l - 1] + d[l - 1];
  const ps = new Float64Array(nLines + 1);
  for (let l = 0; l < nLines; l++) ps[l + 1] = ps[l] + p[l];
  const profile = new Float32Array(nLines);
  for (let l = 0; l < nLines; l++) {
    const lo = Math.max(0, l - hw);
    const hi = Math.min(nLines - 1, l + hw);
    profile[l] = p[l] - (ps[hi + 1] - ps[lo]) / (hi - lo + 1);
  }
  return { profile, sigma: sigSum / Math.max(1, nLines - 1) };
}

export function applyProfile(
  src: Float32Array,
  w: number,
  h: number,
  axis: Axis,
  profile: Float32Array,
  strength: number,
  clampAdu: number,
): Float32Array {
  const out = new Float32Array(src.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = profile[axis === "col" ? x : y];
      const c = Math.max(-clampAdu, Math.min(clampAdu, p)) * strength;
      out[y * w + x] = src[y * w + x] - c;
    }
  }
  return out;
}

/** Box filter with edge-normalised window, float64 intermediates for numerical safety. */
export function boxFilter(src: Float64Array, w: number, h: number, r: number): Float64Array {
  const tmp = new Float64Array(w * h);
  const out = new Float64Array(w * h);
  const ps = new Float64Array(Math.max(w, h) + 1);
  for (let y = 0; y < h; y++) {
    const b = y * w;
    ps[0] = 0;
    for (let x = 0; x < w; x++) ps[x + 1] = ps[x] + src[b + x];
    for (let x = 0; x < w; x++) {
      const lo = Math.max(0, x - r);
      const hi = Math.min(w - 1, x + r);
      tmp[b + x] = (ps[hi + 1] - ps[lo]) / (hi - lo + 1);
    }
  }
  for (let x = 0; x < w; x++) {
    ps[0] = 0;
    for (let y = 0; y < h; y++) ps[y + 1] = ps[y] + tmp[y * w + x];
    for (let y = 0; y < h; y++) {
      const lo = Math.max(0, y - r);
      const hi = Math.min(h - 1, y + r);
      out[y * w + x] = (ps[hi + 1] - ps[lo]) / (hi - lo + 1);
    }
  }
  return out;
}

/** Self-guided edge-aware smoothing (He et al. guided filter). eps is in ADU^2. */
export function guidedFilter(src: Float32Array, w: number, h: number, r: number, eps: number): Float32Array {
  const n = w * h;
  let mean = 0;
  for (let i = 0; i < n; i++) mean += src[i];
  mean /= n;
  const I = new Float64Array(n);
  const II = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const v = src[i] - mean;
    I[i] = v;
    II[i] = v * v;
  }
  const mI = boxFilter(I, w, h, r);
  const mII = boxFilter(II, w, h, r);
  const a = new Float64Array(n);
  const b = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const v = Math.max(0, mII[i] - mI[i] * mI[i]);
    a[i] = v / (v + eps);
    b[i] = mI[i] - a[i] * mI[i];
  }
  const ma = boxFilter(a, w, h, r);
  const mb = boxFilter(b, w, h, r);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = ma[i] * I[i] + mb[i] + mean;
  return out;
}

export interface DetailParams {
  radius: number;
  edgeAdu: number; // edge threshold in ADU (eps = edgeAdu^2)
  gain: number; // >= 1
  coringK: number; // amplification only for |detail| above coringK * noiseSigma
  maxBoostAdu: number; // hard bound on the amount added per pixel
}

/**
 * Noise-aware base/detail enhancement. Detail below the coring threshold is passed through UNCHANGED
 * (never suppressed, never amplified); only the excess above it is amplified by (gain-1), bounded.
 */
export function detailEnhance(
  src: Float32Array,
  w: number,
  h: number,
  p: DetailParams,
  noiseSigma: number,
): Float32Array {
  const base = guidedFilter(src, w, h, p.radius, p.edgeAdu * p.edgeAdu);
  const out = new Float32Array(src.length);
  const thr = p.coringK * noiseSigma;
  const g = Math.max(1, p.gain) - 1;
  for (let i = 0; i < src.length; i++) {
    const d = src[i] - base[i];
    const ex = Math.max(0, Math.abs(d) - thr);
    let add = g * ex;
    if (add > p.maxBoostAdu) add = p.maxBoostAdu;
    out[i] = src[i] + (d < 0 ? -add : add);
  }
  return out;
}

// ---------------- CLAHE (operates on 8-bit DISPLAY values; local, non-monotone) ----------------

export function clahe(
  src: Uint8Array,
  w: number,
  h: number,
  tilesX: number,
  clip: number,
  blend: number,
): Uint8Array {
  const tilesY = Math.max(1, Math.round((tilesX * h) / w));
  const luts = new Uint8Array(tilesX * tilesY * 256);
  const hist = new Float64Array(256);
  for (let ty = 0; ty < tilesY; ty++) {
    const y0 = Math.floor((ty * h) / tilesY);
    const y1 = Math.floor(((ty + 1) * h) / tilesY);
    for (let tx = 0; tx < tilesX; tx++) {
      const x0 = Math.floor((tx * w) / tilesX);
      const x1 = Math.floor(((tx + 1) * w) / tilesX);
      hist.fill(0);
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) hist[src[y * w + x]]++;
      const area = (y1 - y0) * (x1 - x0);
      const limit = Math.max(1, (clip * area) / 256);
      let excess = 0;
      for (let i = 0; i < 256; i++) {
        if (hist[i] > limit) {
          excess += hist[i] - limit;
          hist[i] = limit;
        }
      }
      const add = excess / 256;
      let cdf = 0;
      const base = (ty * tilesX + tx) * 256;
      for (let i = 0; i < 256; i++) {
        cdf += hist[i] + add;
        luts[base + i] = Math.min(255, Math.round((255 * cdf) / area));
      }
    }
  }
  const out = new Uint8Array(src.length);
  for (let y = 0; y < h; y++) {
    const fy = Math.min(tilesY - 1, Math.max(0, (y + 0.5) / (h / tilesY) - 0.5));
    const ty0 = Math.floor(fy);
    const ty1 = Math.min(tilesY - 1, ty0 + 1);
    const wy = fy - ty0;
    for (let x = 0; x < w; x++) {
      const fx = Math.min(tilesX - 1, Math.max(0, (x + 0.5) / (w / tilesX) - 0.5));
      const tx0 = Math.floor(fx);
      const tx1 = Math.min(tilesX - 1, tx0 + 1);
      const wx = fx - tx0;
      const v = src[y * w + x];
      const a = luts[(ty0 * tilesX + tx0) * 256 + v];
      const b = luts[(ty0 * tilesX + tx1) * 256 + v];
      const c = luts[(ty1 * tilesX + tx0) * 256 + v];
      const d = luts[(ty1 * tilesX + tx1) * 256 + v];
      const eq = (1 - wy) * ((1 - wx) * a + wx * b) + wy * ((1 - wx) * c + wx * d);
      out[y * w + x] = Math.round((1 - blend) * v + blend * eq);
    }
  }
  return out;
}

// ---------------- causal temporal stabilisation ----------------

export interface TemporalState {
  buf: Float32Array | null;
  frames: number; // frames accumulated since last reset
  key: string;
  lastIndex: number;
}

export function freshTemporal(key = ""): TemporalState {
  return { buf: null, frames: 0, key, lastIndex: -1 };
}

export function cloneTemporal(s: TemporalState): TemporalState {
  return { buf: s.buf ? new Float32Array(s.buf) : null, frames: s.frames, key: s.key, lastIndex: s.lastIndex };
}

/**
 * Causal exponential averaging with a motion gate: pixels whose change exceeds gateK*noiseSigma restart
 * from the current value (reduces ghosting but cannot eliminate it). First frame is passed through.
 */
export function temporalFilter(
  cur: Float32Array,
  st: TemporalState,
  alpha: number,
  gateK: number,
  noiseSigma: number,
): { out: Float32Array; movingFrac: number } {
  if (!st.buf || st.buf.length !== cur.length) {
    st.buf = new Float32Array(cur);
    st.frames = 1;
    return { out: new Float32Array(cur), movingFrac: 0 };
  }
  const buf = st.buf;
  const thr = gateK * Math.max(noiseSigma, 1e-3);
  let moving = 0;
  for (let i = 0; i < cur.length; i++) {
    const d = cur[i] - buf[i];
    if (Math.abs(d) > thr) {
      buf[i] = cur[i];
      moving++;
    } else buf[i] += alpha * d;
  }
  st.frames++;
  return { out: new Float32Array(buf), movingFrac: moving / cur.length };
}

export function dilateBox(mask: Uint8Array, w: number, h: number, r: number): Uint8Array {
  const tmp = new Uint8Array(w * h);
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!mask[y * w + x]) continue;
      for (let k = Math.max(0, x - r); k <= Math.min(w - 1, x + r); k++) tmp[y * w + k] = 1;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!tmp[y * w + x]) continue;
      for (let k = Math.max(0, y - r); k <= Math.min(h - 1, y + r); k++) out[k * w + x] = 1;
    }
  }
  return out;
}

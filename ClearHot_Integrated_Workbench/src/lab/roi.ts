import { robustSigma } from "./dsp";

export type RoiRole = "animal" | "background" | "bridge";

export interface Roi {
  id: string;
  role: RoiRole;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface RoiStats {
  n: number;
  median: number;
  sigma: number; // robust (MAD) spread INSIDE the ROI; includes real texture, not only noise
  min: number;
  max: number;
  satFrac: number; // fraction at/above satHigh or at/below 0
  validFrac: number; // 1 - satFrac
}

export function roiStats(data: ArrayLike<number>, W: number, H: number, r: Roi, satHigh: number): RoiStats {
  const x0 = Math.max(0, Math.floor(r.x));
  const y0 = Math.max(0, Math.floor(r.y));
  const x1 = Math.min(W, Math.ceil(r.x + r.w));
  const y1 = Math.min(H, Math.ceil(r.y + r.h));
  const n = Math.max(0, x1 - x0) * Math.max(0, y1 - y0);
  if (n === 0) return { n: 0, median: NaN, sigma: NaN, min: NaN, max: NaN, satFrac: 0, validFrac: 0 };
  const vals = new Float32Array(n);
  let k = 0;
  let sat = 0;
  let min = Infinity;
  let max = -Infinity;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const v = data[y * W + x];
      vals[k++] = v;
      if (v >= satHigh || v <= 0) sat++;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  const { median, sigma } = robustSigma(vals);
  return { n, median, sigma, min, max, satFrac: sat / n, validFrac: 1 - sat / n };
}

/** |median(ROI) - median(bg)| / robust sigma(bg). A proxy statistic: not evidence of true temperature difference. */
export function cnr(roi: RoiStats, bg: RoiStats): number | null {
  if (!isFinite(roi.median) || !isFinite(bg.median) || !(bg.sigma > 1e-6)) return null;
  return Math.abs(roi.median - bg.median) / bg.sigma;
}

export function nearestBackground(r: Roi, rois: Roi[]): Roi | null {
  const bgs = rois.filter((q) => q.role === "background");
  if (!bgs.length) return null;
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  let best = bgs[0];
  let bd = Infinity;
  for (const b of bgs) {
    const d = Math.hypot(b.x + b.w / 2 - cx, b.y + b.h / 2 - cy);
    if (d < bd) {
      bd = d;
      best = b;
    }
  }
  return best;
}

export interface RoiRow {
  roi: Roi;
  bg: Roi | null;
  raw: RoiStats;
  corrected: RoiStats;
  refDisp: RoiStats;
  procDisp: RoiStats;
  cnrRaw: number | null;
  cnrCorrected: number | null;
  cnrRef: number | null;
  cnrProc: number | null;
}

export interface PairRow {
  animal: Roi;
  bridge: Roi;
  rawDelta: number; // median(animal) - median(bridge) in ADU
  rawSpread: number; // pooled robust spread
  rawRatio: number | null;
  refDelta: number;
  procDelta: number;
  verdict: string;
}

export function computeRows(
  rois: Roi[],
  W: number,
  H: number,
  raw: ArrayLike<number>,
  corrected: ArrayLike<number>,
  refDisp: ArrayLike<number>,
  procDisp: ArrayLike<number>,
  satHigh: number,
): { rows: RoiRow[]; pairs: PairRow[] } {
  const stats = new Map<string, { raw: RoiStats; corrected: RoiStats; refDisp: RoiStats; procDisp: RoiStats }>();
  for (const r of rois) {
    stats.set(r.id, {
      raw: roiStats(raw, W, H, r, satHigh),
      corrected: roiStats(corrected, W, H, r, satHigh),
      refDisp: roiStats(refDisp, W, H, r, 255),
      procDisp: roiStats(procDisp, W, H, r, 255),
    });
  }
  const rows: RoiRow[] = rois.map((r) => {
    const s = stats.get(r.id)!;
    const bg = r.role === "background" ? null : nearestBackground(r, rois);
    const b = bg ? stats.get(bg.id)! : null;
    return {
      roi: r,
      bg,
      ...s,
      cnrRaw: b ? cnr(s.raw, b.raw) : null,
      cnrCorrected: b ? cnr(s.corrected, b.corrected) : null,
      cnrRef: b ? cnr(s.refDisp, b.refDisp) : null,
      cnrProc: b ? cnr(s.procDisp, b.procDisp) : null,
    };
  });
  const pairs: PairRow[] = [];
  for (const a of rois.filter((r) => r.role === "animal")) {
    for (const br of rois.filter((r) => r.role === "bridge")) {
      const sa = stats.get(a.id)!;
      const sb = stats.get(br.id)!;
      const rawDelta = sa.raw.median - sb.raw.median;
      const spread = Math.sqrt((sa.raw.sigma ** 2 + sb.raw.sigma ** 2) / 2);
      const ratio = spread > 1e-6 ? Math.abs(rawDelta) / spread : null;
      const refDelta = sa.refDisp.median - sb.refDisp.median;
      const procDelta = sa.procDisp.median - sb.procDisp.median;
      let verdict: string;
      if (ratio === null) verdict = "Spread too small to judge.";
      else if (ratio < 3) {
        verdict =
          "Raw medians are NOT separable above the ROI spread (<3x). Enhancement cannot recover a trustworthy difference here; this is a limit of the data/ROIs.";
      } else if (Math.abs(refDelta) < 2) {
        verdict = "Raw ADU differ, but the fixed display window shows <2 levels difference: separation is lost in window/quantisation. Narrow the window.";
      } else if (Math.sign(procDelta) !== Math.sign(refDelta) && Math.abs(procDelta) >= 2) {
        verdict = "Processed view reverses the intensity order vs the monotone reference (local operators can do this). Do not read as temperature.";
      } else {
        verdict = "Raw ADU separable; fixed-window display preserves the ordering.";
      }
      pairs.push({ animal: a, bridge: br, rawDelta, rawSpread: spread, rawRatio: ratio, refDelta, procDelta, verdict });
    }
  }
  return { rows, pairs };
}

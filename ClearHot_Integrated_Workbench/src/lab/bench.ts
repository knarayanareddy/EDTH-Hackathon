// Synthetic benchmark with known ground truth. ADU-domain stages only (line correction, detail).
// Tone mapping / CLAHE are display transforms, so PSNR vs the clean ADU image is not meaningful for them.
// SYNTHETIC ONLY: results do not transfer to real data. Development and held-out use disjoint seed blocks.

import { dilateBox } from "./dsp";
import { ALGO_VERSION, FROZEN_VARIANTS, MAX_CODE_14, runPipeline } from "./pipeline";
import { SCENARIOS, generateScene, type SynthScene } from "./synth";

export interface BenchMetrics {
  psnr: number; // dB vs clean ADU, peak = 16383
  stripeRms: number; // RMS of column-mean residual in flat region (ADU)
  thinRetention: number; // thin-feature contrast vs clean (1 = preserved, <1 = suppressed, >1 = boosted)
  changeRms: number; // RMS(out - input) in ADU
}

export function evaluate(scene: SynthScene, out: Float32Array): BenchMetrics {
  const { w, h, clean, noisy, thinMask, flat } = scene;
  let se = 0;
  let ch = 0;
  for (let i = 0; i < out.length; i++) {
    const d = out[i] - clean[i];
    se += d * d;
    const c = out[i] - noisy[i];
    ch += c * c;
  }
  const mse = se / out.length;
  const psnr = 10 * Math.log10((MAX_CODE_14 * MAX_CODE_14) / Math.max(mse, 1e-9));
  // stripe residual
  const colMeans = new Float64Array(flat.w);
  for (let x = 0; x < flat.w; x++) {
    let s = 0;
    for (let y = 0; y < flat.h; y++) {
      const i = (flat.y + y) * w + flat.x + x;
      s += out[i] - clean[i];
    }
    colMeans[x] = s / flat.h;
  }
  let m = 0;
  for (const v of colMeans) m += v;
  m /= flat.w;
  let vr = 0;
  for (const v of colMeans) vr += (v - m) ** 2;
  const stripeRms = Math.sqrt(vr / flat.w);
  // thin retention: mean contrast of (mask) vs ring (dilate 5 minus dilate 2)
  const d5 = dilateBox(thinMask, w, h, 5);
  const d2 = dilateBox(thinMask, w, h, 2);
  let fo = 0, fc = 0, ro = 0, rc = 0, nf = 0, nr = 0;
  for (let i = 0; i < thinMask.length; i++) {
    if (thinMask[i]) {
      fo += out[i];
      fc += clean[i];
      nf++;
    } else if (d5[i] && !d2[i]) {
      ro += out[i];
      rc += clean[i];
      nr++;
    }
  }
  const cOut = fo / Math.max(1, nf) - ro / Math.max(1, nr);
  const cClean = fc / Math.max(1, nf) - rc / Math.max(1, nr);
  return {
    psnr,
    stripeRms,
    thinRetention: Math.abs(cClean) > 1e-6 ? cOut / cClean : NaN,
    changeRms: Math.sqrt(ch / out.length),
  };
}

export interface BenchRow {
  split: "development" | "held-out";
  scenarioId: string;
  scenarioName: string;
  variantId: string;
  variantLabel: string;
  n: number;
  mean: BenchMetrics;
  sd: BenchMetrics;
}

const KEYS: (keyof BenchMetrics)[] = ["psnr", "stripeRms", "thinRetention", "changeRms"];

export interface BenchReport {
  algoVersion: string;
  generatedAt: string;
  synthetic: true;
  seeds: { development: number[]; heldOut: number[] };
  size: { w: number; h: number };
  frozenVariants: { id: string; cfg: unknown }[];
  rows: BenchRow[];
  caveats: string[];
}

export async function runBenchmark(
  seedsPerSplit: number,
  size: { w: number; h: number },
  onProgress?: (frac: number) => void,
): Promise<BenchReport> {
  const dev = Array.from({ length: seedsPerSplit }, (_, i) => 1 + i);
  const held = Array.from({ length: seedsPerSplit }, (_, i) => 1001 + i);
  const splits: { name: BenchRow["split"]; seeds: number[] }[] = [
    { name: "development", seeds: dev },
    { name: "held-out", seeds: held },
  ];
  const total = splits.length * SCENARIOS.length * seedsPerSplit;
  let done = 0;
  const rows: BenchRow[] = [];
  for (const sp of splits) {
    for (const sc of SCENARIOS) {
      const acc = new Map<string, BenchMetrics[]>();
      for (const seed of sp.seeds) {
        const scene = generateScene(sc, seed, size.w, size.h);
        for (const v of FROZEN_VARIANTS) {
          const res = runPipeline(scene.noisy, scene.w, scene.h, v.cfg);
          const arr = acc.get(v.id) ?? [];
          arr.push(evaluate(scene, res.enhanced));
          acc.set(v.id, arr);
        }
        done++;
        onProgress?.(done / total);
        await new Promise((r) => setTimeout(r, 0));
      }
      for (const v of FROZEN_VARIANTS) {
        const arr = acc.get(v.id) ?? [];
        const mean = {} as BenchMetrics;
        const sd = {} as BenchMetrics;
        for (const k of KEYS) {
          const vals = arr.map((a) => a[k]).filter((x) => isFinite(x));
          const mu = vals.reduce((s, x) => s + x, 0) / Math.max(1, vals.length);
          mean[k] = mu;
          sd[k] = Math.sqrt(vals.reduce((s, x) => s + (x - mu) ** 2, 0) / Math.max(1, vals.length - 1));
        }
        rows.push({ split: sp.name, scenarioId: sc.id, scenarioName: sc.name, variantId: v.id, variantLabel: v.label, n: arr.length, mean, sd });
      }
    }
  }
  return {
    algoVersion: ALGO_VERSION,
    generatedAt: new Date().toISOString(),
    synthetic: true,
    seeds: { development: dev, heldOut: held },
    size,
    frozenVariants: FROZEN_VARIANTS.map((v) => ({ id: v.id, cfg: v.cfg })),
    rows,
    caveats: [
      "Synthetic scenes generated by this tool; known clean truth. Not real sensor data.",
      "Configurations are frozen constants in pipeline.ts (FROZEN_VARIANTS); they were not tuned on the held-out seed block.",
      "Seeds differ but the generator, scene layout and noise model are shared: this is NOT cross-scene or cross-device generalisation.",
      "PSNR penalises deliberate detail gain; thin-retention >1 means boosted contrast, <1 means suppression.",
      "Only ADU-domain stages are evaluated. Tone map / CLAHE are display transforms. No CNN is implemented.",
    ],
  };
}

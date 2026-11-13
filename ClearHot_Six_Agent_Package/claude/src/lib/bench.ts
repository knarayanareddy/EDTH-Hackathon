// Held-out SYNTHETIC benchmark. Scenes use seeds disjoint from CNN training/validation seeds.
import { defaultCfg, newState, runPipeline, type Cfg, type PVariant } from './pipeline';
import { CORR_LABEL, synthFrame, type CorrKey, type Preset } from './synth';
import { evalGT, type GTMetrics } from './metrics';
import { SEEDS } from './cnn';

export interface Method { id: string; label: string; variant: PVariant; cfg: Cfg; raw?: boolean }
export interface Scenario { id: string; label: string; corr: CorrKey; fullLines?: boolean; stripeScale?: number }

export const SCENARIOS: Scenario[] = [
  { id: 'v', label: CORR_LABEL.vertical, corr: 'vertical' },
  { id: 'h', label: CORR_LABEL.horizontal, corr: 'horizontal' },
  { id: 'b', label: CORR_LABEL.both, corr: 'both' },
  { id: 'p', label: CORR_LABEL.periodic, corr: 'periodic' },
  { id: 's', label: CORR_LABEL.strong, corr: 'strong' },
  { id: 'f', label: 'FALSE-POSITIVE TEST: real full-height / full-width scene lines, no sensor stripes', corr: 'noise_only', fullLines: true },
];
const PRESETS: Preset[] = ['hot_object', 'horizon_pan', 'hot_scene'];

export interface Row { id: string; label: string; n: number; ms: number; m: GTMetrics; byScenario: Record<string, GTMetrics> }

const avg = (a: GTMetrics[]): GTMetrics => {
  const k = (f: keyof GTMetrics) => a.reduce((p, q) => p + q[f], 0) / a.length;
  return { psnr: k('psnr'), ssim: k('ssim'), colRes: k('colRes'), rowRes: k('rowRes'), edgeKeep: k('edgeKeep'), thinRet: k('thinRet') };
};

export function standardMethods(has: { A: boolean; B: boolean; C: boolean }): Method[] {
  const noTone = (c: Cfg): Cfg => c;
  const list: Method[] = [
    { id: 'raw', label: 'Raw input (no processing)', variant: 'O', cfg: { ...defaultCfg('O'), stage1: false }, raw: true },
    { id: 'O', label: 'Original ClearHot Stage 1 (v=0.65, h=0)', variant: 'O', cfg: defaultCfg('O') },
    { id: 'O2', label: 'Original ClearHot Stage 1 (v=0.65, h=0.65)', variant: 'O', cfg: { ...defaultCfg('O'), hStr: 0.65 } },
    { id: 'A', label: 'Instance A · robust local-median destripe', variant: 'A', cfg: noTone(defaultCfg('A')) },
    { id: 'B', label: 'Instance B · multi-frame constant-statistics', variant: 'B', cfg: defaultCfg('B') },
    { id: 'C', label: 'Instance C · spectral profile notch + bilateral', variant: 'C', cfg: defaultCfg('C') },
  ];
  if (has.A) list.push({ id: 'A+cnn', label: 'A + DnCNN-lite (trained here)', variant: 'A', cfg: { ...defaultCfg('A'), cnn: true } });
  if (has.B) list.push({ id: 'B+cnn', label: 'B + 1-D profile CNN (trained here)', variant: 'B', cfg: { ...defaultCfg('B'), cnn: true } });
  if (has.C) list.push({ id: 'C+cnn', label: 'C + directional CNN (trained here)', variant: 'C', cfg: { ...defaultCfg('C'), cnn: true } });
  return list;
}

export async function runBenchmark(methods: Method[], W: number, H: number, onProgress?: (p: number, label: string) => void, scenes = 3): Promise<Row[]> {
  const rows: Row[] = methods.map((m) => ({ id: m.id, label: m.label, n: 0, ms: 0, m: { psnr: 0, ssim: 0, colRes: 0, rowRes: 0, edgeKeep: 0, thinRet: 0 }, byScenario: {} }));
  const acc = methods.map(() => ({ all: [] as GTMetrics[], ms: 0, by: {} as Record<string, GTMetrics[]> }));
  const IDX = 20; let done = 0; const total = SCENARIOS.length * scenes;
  for (const sc of SCENARIOS) {
    for (let s = 0; s < scenes; s++) {
      const preset = PRESETS[s % PRESETS.length], seed = SEEDS.bench + s * 3 + SCENARIOS.indexOf(sc);
      const cache = new Map<number, ReturnType<typeof synthFrame>>();
      const get = (i: number) => { let f = cache.get(i); if (!f) { f = synthFrame(preset, i, W, H, sc.corr, { seed, fullLines: sc.fullLines }); cache.set(i, f); } return f; };
      const fr = get(IDX);
      for (let k = 0; k < methods.length; k++) {
        const m = methods[k];
        const ctx = { raw: fr.raw, W, H, key: `b:${sc.id}:${s}`, idx: IDX, total: 60, reset: true, getFrame: async (i: number) => get(i).raw };
        const res = await runPipeline(m.variant, ctx, m.cfg, newState());
        const g = evalGT(res.restored, fr, W, H);
        acc[k].all.push(g); (acc[k].by[sc.id] ||= []).push(g); acc[k].ms += res.timings.total;
      }
      done++; onProgress?.(done / total, `${sc.label} · scene ${s + 1}/${scenes}`);
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  rows.forEach((r, k) => {
    r.n = acc[k].all.length; r.ms = acc[k].ms / r.n; r.m = avg(acc[k].all);
    for (const sc of SCENARIOS) r.byScenario[sc.id] = avg(acc[k].by[sc.id]);
  });
  return rows;
}

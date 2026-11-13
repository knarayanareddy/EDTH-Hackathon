import { newState, runPipeline, type Cfg, type PState, type PVariant, type Result } from './pipeline';
import type { FrameSource } from './source';
import { evalGT, evalNoRef, type GTMetrics, type NoRefMetrics } from './metrics';

export interface Analysis { rawNo: NoRefMetrics; procNo: NoRefMetrics; rawGT?: GTMetrics; procGT?: GTMetrics }
export interface Out { res: Result; raw: Uint16Array; W: number; H: number; idx: number; analysis: Analysis }

/** Owns the temporal state of one pipeline instance and serialises runs (latest request wins). */
export class Processor {
  st: PState = newState();
  private lastIdx = -1; private sourceId = '';
  private chain: Promise<unknown> = Promise.resolve(); private ticket = 0;

  reset() { this.st = newState(); this.lastIdx = -1; }

  async process(v: PVariant, source: FrameSource, idx: number, cfg: Cfg, withAnalysis = true, forceReset = false): Promise<Out> {
    if (source.id !== this.sourceId) { this.reset(); this.sourceId = source.id; }
    const raw = await source.getFrame(idx);
    if (!raw) throw new Error('frame unavailable');
    const reset = forceReset || this.lastIdx < 0 || (idx !== this.lastIdx && idx !== (this.lastIdx + 1) % source.total);
    this.lastIdx = idx;
    const ctx = { raw, W: source.W, H: source.H, key: `${source.id}:${idx}`, idx, total: source.total, reset, getFrame: (i: number) => source.getFrame(i) };
    const res = await runPipeline(v, ctx, cfg, this.st);
    let analysis: Analysis = { rawNo: null as unknown as NoRefMetrics, procNo: null as unknown as NoRefMetrics };
    if (withAnalysis) {
      const input = new Float32Array(raw.length); for (let i = 0; i < raw.length; i++) input[i] = raw[i] & 0x3fff;
      analysis = { rawNo: evalNoRef(input, input, res.base8, source.W, source.H), procNo: evalNoRef(res.restored, input, res.out8, source.W, source.H) };
      if (source.hasGT) {
        const g = await source.getSynth(idx);
        analysis.rawGT = evalGT(input, g, source.W, source.H);
        analysis.procGT = evalGT(res.restored, g, source.W, source.H);
      }
    }
    return { res, raw, W: source.W, H: source.H, idx, analysis };
  }

  /** Latest-wins scheduling: if a newer request arrives while one is running, older queued ones are dropped. */
  latest(v: PVariant, source: FrameSource, idx: number, cfg: Cfg, withAnalysis = true): Promise<Out | null> {
    const t = ++this.ticket;
    const p = this.chain.then(async () => (t !== this.ticket ? null : this.process(v, source, idx, cfg, withAnalysis)));
    this.chain = p.catch(() => null);
    return p.then((o) => (t !== this.ticket ? null : o));
  }
}

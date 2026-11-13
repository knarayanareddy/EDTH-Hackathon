import { CORR_LABEL, synthFrame, type CorrKey, type Preset, type SynthFrame } from './synth';

export type SourceSpec =
  | { kind: 'synthetic'; preset: Preset; corr: CorrKey; full: boolean; stripeScale: number; sigmaScale: number }
  | { kind: 'file'; file: File; endian: 'le' | 'be'; half: boolean };

const FW = 640, FH = 512, FBYTES = FW * FH * 2;
const LE_HOST = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1;

export class FrameSource {
  readonly W: number; readonly H: number; readonly total: number; readonly id: string; readonly label: string;
  readonly hasGT: boolean;
  private cache = new Map<number, Uint16Array>();
  private gt = new Map<number, SynthFrame>();
  constructor(readonly spec: SourceSpec) {
    if (spec.kind === 'synthetic') {
      this.W = spec.full ? 640 : 320; this.H = spec.full ? 512 : 256; this.total = 120; this.hasGT = true;
      this.id = `syn:${spec.preset}:${spec.corr}:${this.W}:${spec.stripeScale}:${spec.sigmaScale}`;
      this.label = `${spec.preset} · ${CORR_LABEL[spec.corr]}`;
    } else {
      this.W = spec.half ? 320 : 640; this.H = spec.half ? 256 : 512; this.total = Math.floor(spec.file.size / FBYTES); this.hasGT = false;
      this.id = `file:${spec.file.name}:${spec.file.size}:${spec.endian}:${spec.half}`;
      this.label = spec.file.name;
    }
  }
  static validateFile(f: File): string | null {
    if (!f.size || f.size % FBYTES !== 0) return `File must contain whole 640 × 512 uint16 frames (${FBYTES.toLocaleString()} bytes each); this file is ${f.size.toLocaleString()} bytes. Not loaded. A matching size alone would still not prove the bit layout.`;
    return null;
  }
  async getSynth(i: number): Promise<SynthFrame> {
    if (this.spec.kind !== 'synthetic') throw new Error('no ground truth for files');
    let f = this.gt.get(i);
    if (!f) {
      f = synthFrame(this.spec.preset, i, this.W, this.H, this.spec.corr, { stripeScale: this.spec.stripeScale, sigmaScale: this.spec.sigmaScale });
      if (this.gt.size > 40) this.gt.delete(this.gt.keys().next().value as number);
      this.gt.set(i, f);
    }
    return f;
  }
  async getFrame(i: number): Promise<Uint16Array | null> {
    if (i < 0 || i >= this.total) return null;
    const hit = this.cache.get(i);
    if (hit) return hit;
    let out: Uint16Array;
    if (this.spec.kind === 'synthetic') out = (await this.getSynth(i)).raw;
    else {
      const buf = await this.spec.file.slice(i * FBYTES, (i + 1) * FBYTES).arrayBuffer();
      let full: Uint16Array;
      if (this.spec.endian === 'le' && LE_HOST) full = new Uint16Array(buf);
      else { const dv = new DataView(buf); full = new Uint16Array(FW * FH); for (let k = 0; k < full.length; k++) full[k] = dv.getUint16(k * 2, this.spec.endian === 'le'); }
      if (this.spec.half) {
        out = new Uint16Array(320 * 256);
        for (let y = 0; y < 256; y++) for (let x = 0; x < 320; x++) out[y * 320 + x] = full[y * 2 * FW + x * 2];
      } else out = full;
    }
    if (this.cache.size > 40) this.cache.delete(this.cache.keys().next().value as number);
    this.cache.set(i, out);
    return out;
  }
}

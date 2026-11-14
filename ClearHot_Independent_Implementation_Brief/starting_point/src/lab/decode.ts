// Local-only decoding of headerless uint16 thermal frames.
// Every parameter here is a HYPOTHESIS until confirmed against the official sensor/file spec.
// Files are never uploaded: frames are read with File.slice() one at a time.

export interface DecodeConfig {
  width: number;
  height: number;
  headerBytes: number; // bytes skipped at the start of the file
  littleEndian: boolean;
  bits: number; // number of low bits kept (hypothesis: 14)
  shift: number; // right shift applied before masking (hypothesis: 0)
}

export const DEFAULT_DECODE: DecodeConfig = {
  width: 640,
  height: 512,
  headerBytes: 0,
  littleEndian: true,
  bits: 14,
  shift: 0,
};

export function frameBytes(c: DecodeConfig): number {
  return c.width * c.height * 2;
}

export function maxCode(c: DecodeConfig): number {
  return (1 << c.bits) - 1;
}

export function frameCountFor(size: number, c: DecodeConfig): { frames: number; remainder: number } {
  const usable = Math.max(0, size - c.headerBytes);
  const fb = frameBytes(c);
  return { frames: Math.floor(usable / fb), remainder: usable % fb };
}

export function decodeBuffer(buf: ArrayBuffer, c: DecodeConfig): Uint16Array {
  const n = c.width * c.height;
  const out = new Uint16Array(n);
  const dv = new DataView(buf);
  const mask = maxCode(c);
  const avail = Math.min(n, Math.floor(buf.byteLength / 2));
  for (let i = 0; i < avail; i++) {
    out[i] = (dv.getUint16(i * 2, c.littleEndian) >> c.shift) & mask;
  }
  return out;
}

export async function readFrame(file: Blob, c: DecodeConfig, index: number): Promise<Uint16Array> {
  const fb = frameBytes(c);
  const start = c.headerBytes + index * fb;
  const buf = await file.slice(start, start + fb).arrayBuffer();
  return decodeBuffer(buf, c);
}

export interface FormatDiagnostic {
  littleEndian: { highBitFraction: number; meanAbsNeighbourDiff: number };
  bigEndian: { highBitFraction: number; meanAbsNeighbourDiff: number };
  note: string;
}

/**
 * Heuristic hints only. A correct byte order usually yields (a) few words with bits above the assumed
 * bit-depth and (b) a smoother image. This does NOT establish the file format.
 */
export async function diagnoseFormat(file: Blob, c: DecodeConfig, index: number): Promise<FormatDiagnostic> {
  const fb = frameBytes(c);
  const start = c.headerBytes + index * fb;
  const buf = await file.slice(start, start + fb).arrayBuffer();
  const dv = new DataView(buf);
  const n = Math.floor(buf.byteLength / 2);
  const evalOrder = (le: boolean) => {
    let high = 0;
    let diff = 0;
    let cnt = 0;
    let prev = 0;
    for (let i = 0; i < n; i++) {
      const v = dv.getUint16(i * 2, le);
      if (v >> c.bits !== 0) high++;
      if (i % c.width !== 0) {
        diff += Math.abs(v - prev);
        cnt++;
      }
      prev = v;
    }
    return { highBitFraction: n ? high / n : 0, meanAbsNeighbourDiff: cnt ? diff / cnt : 0 };
  };
  return {
    littleEndian: evalOrder(true),
    bigEndian: evalOrder(false),
    note: "Heuristic only: file size matching and these statistics do not establish format, bit alignment, headers or radiometric calibration.",
  };
}

// ---------- streaming SHA-256 (local, no upload, constant memory) ----------

const PRIMES: number[] = [];
for (let p = 2; PRIMES.length < 64; p++) {
  let ok = true;
  for (let d = 2; d * d <= p; d++) if (p % d === 0) ok = false;
  if (ok) PRIMES.push(p);
}
const frac32 = (x: number) => Math.floor((x - Math.floor(x)) * 4294967296) >>> 0;
const K256 = new Uint32Array(PRIMES.map((p) => frac32(Math.cbrt(p))));
const H256 = new Uint32Array(PRIMES.slice(0, 8).map((p) => frac32(Math.sqrt(p))));

const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));

export class Sha256 {
  private h = new Uint32Array(H256);
  private buf = new Uint8Array(64);
  private bl = 0;
  private total = 0;
  private w = new Uint32Array(64);

  private block(b: Uint8Array, o: number) {
    const w = this.w;
    for (let t = 0; t < 16; t++) {
      w[t] = ((b[o + 4 * t] << 24) | (b[o + 4 * t + 1] << 16) | (b[o + 4 * t + 2] << 8) | b[o + 4 * t + 3]) >>> 0;
    }
    for (let t = 16; t < 64; t++) {
      const s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3);
      const s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
    }
    let [a, b2, c, d, e, f, g, hh] = this.h;
    for (let t = 0; t < 64; t++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + K256[t] + w[t]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b2) ^ (a & c) ^ (b2 & c);
      const t2 = (S0 + maj) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b2;
      b2 = a;
      a = (t1 + t2) >>> 0;
    }
    const h = this.h;
    h[0] = (h[0] + a) >>> 0;
    h[1] = (h[1] + b2) >>> 0;
    h[2] = (h[2] + c) >>> 0;
    h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0;
    h[5] = (h[5] + f) >>> 0;
    h[6] = (h[6] + g) >>> 0;
    h[7] = (h[7] + hh) >>> 0;
  }

  update(d: Uint8Array) {
    this.total += d.length;
    let i = 0;
    if (this.bl > 0) {
      while (i < d.length && this.bl < 64) this.buf[this.bl++] = d[i++];
      if (this.bl === 64) {
        this.block(this.buf, 0);
        this.bl = 0;
      }
    }
    while (i + 64 <= d.length) {
      this.block(d, i);
      i += 64;
    }
    while (i < d.length) this.buf[this.bl++] = d[i++];
  }

  digestHex(): string {
    const totalBits = this.total * 8;
    const hi = Math.floor(totalBits / 4294967296) >>> 0;
    const lo = totalBits >>> 0;
    const pad: number[] = [0x80];
    while ((this.bl + pad.length) % 64 !== 56) pad.push(0);
    pad.push((hi >>> 24) & 255, (hi >>> 16) & 255, (hi >>> 8) & 255, hi & 255);
    pad.push((lo >>> 24) & 255, (lo >>> 16) & 255, (lo >>> 8) & 255, lo & 255);
    const savedTotal = this.total;
    this.update(new Uint8Array(pad));
    this.total = savedTotal;
    return Array.from(this.h)
      .map((x) => x.toString(16).padStart(8, "0"))
      .join("");
  }
}

export async function sha256File(file: Blob, onProgress?: (frac: number) => void): Promise<string> {
  const sha = new Sha256();
  const chunk = 4 * 1024 * 1024;
  for (let off = 0; off < file.size; off += chunk) {
    const ab = await file.slice(off, Math.min(file.size, off + chunk)).arrayBuffer();
    sha.update(new Uint8Array(ab));
    onProgress?.(Math.min(1, (off + chunk) / file.size));
    await new Promise((r) => setTimeout(r, 0));
  }
  return sha.digestHex();
}

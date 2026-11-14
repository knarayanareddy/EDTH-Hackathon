// Loader/validator for the local CNN inference cache written by `python -m clearhot_cnn infer`.
// Pure functions (no DOM, no network) so they are unit-tested in Node. The cache is only ever read from a local Blob/File.

export interface CnnManifest {
  schema: 'clearhot-cnn-cache-v1';
  source: { name: string; size_bytes: number; sha256: string; sha256_kind: string };
  decoder: { width: number; height: number; headerBytes: number; shift: number; littleEndian: boolean; bits: number };
  frames: { sourceTotal: number; remainderBytes: number; cachedFirst: number; cachedCount: number };
  cache: { file: string; dtype: string; frameBytes: number; sizeBytes: number; sha256: string; domain: string };
  model: { id: string; status: string; approved: boolean; label: string; checkpointSha256: string; weightsSha256: string; archSha256: string; dataDomain: string; simulatedDemo: boolean; validationPassed: boolean; approval: { reviewer: string; time: string } | null };
  inference: { contract: string; tile: number };
  warnings: string[];
}

const isHex = (s: unknown) => typeof s === 'string' && /^[0-9a-f]{64}$/.test(s);
const isInt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0;

export function parseCnnManifest(text: string): CnnManifest {
  let m: any;
  try { m = JSON.parse(text); } catch { throw new Error('CNN manifest is not valid JSON.'); }
  if (!m || m.schema !== 'clearhot-cnn-cache-v1') throw new Error('Not a clearhot-cnn-cache-v1 manifest.');
  const d = m.decoder, f = m.frames, c = m.cache, s = m.source, md = m.model;
  if (!d || !f || !c || !s || !md) throw new Error('CNN manifest is missing required sections.');
  if (![d.width, d.height, d.headerBytes, d.shift, f.sourceTotal, f.cachedFirst, f.cachedCount, c.frameBytes, c.sizeBytes, s.size_bytes].every(isInt)) throw new Error('CNN manifest has invalid numeric fields.');
  if (d.bits !== 14 || typeof d.littleEndian !== 'boolean') throw new Error('Only the 14-bit decoder contract is supported.');
  if (!isHex(s.sha256) || !isHex(c.sha256) || !isHex(md.checkpointSha256)) throw new Error('CNN manifest has malformed SHA-256 values.');
  if (c.dtype !== 'uint16-le' || c.frameBytes !== d.width * d.height * 2) throw new Error('Cache dtype/frame size does not match the declared geometry.');
  if (f.cachedCount < 1 || f.cachedFirst + f.cachedCount > f.sourceTotal) throw new Error('Cached frame range lies outside the source frame count.');
  if (c.sizeBytes !== f.cachedCount * c.frameBytes) throw new Error('Cache size does not equal cachedCount × frameBytes.');
  if (typeof md.id !== 'string' || typeof md.approved !== 'boolean' || typeof md.status !== 'string' || !isHex(md.weightsSha256) || !isHex(md.archSha256) || !Array.isArray(m.warnings) || m.warnings.some((x:unknown)=>typeof x!=='string')) throw new Error('CNN manifest model section is malformed.');
  if (md.approved && (md.status !== 'active' || md.validationPassed !== true || !md.approval || typeof md.approval.reviewer !== 'string' || typeof md.approval.time !== 'string')) throw new Error('CNN manifest has inconsistent claimed approval metadata.');
  return m as CnnManifest;
}

/** Returns a list of mismatches; an empty list means the cache may be attached to this exact source/decoder. */
export function checkCnnCompat(m: CnnManifest, src: { size: number; sha256: string | null }, dec: { width: number; height: number; headerBytes: number; shift: number; littleEndian: boolean }, totalFrames: number, cacheSize: number): string[] {
  const e: string[] = [];
  if (!src.sha256) e.push('The recording\'s full SHA-256 has not been computed; it is required before a cache can be attached.');
  else if (src.sha256 !== m.source.sha256) e.push(`Source SHA-256 differs (viewer ${src.sha256.slice(0, 12)}…, cache ${m.source.sha256.slice(0, 12)}…).`);
  if (src.size !== m.source.size_bytes) e.push(`Source size differs (${src.size} vs ${m.source.size_bytes}).`);
  for (const k of ['width', 'height', 'headerBytes', 'shift', 'littleEndian'] as const) if (dec[k] !== m.decoder[k]) e.push(`Decoder ${k} differs (viewer ${dec[k]}, cache ${m.decoder[k]}).`);
  if (totalFrames !== m.frames.sourceTotal) e.push(`Frame count differs (viewer ${totalFrames}, cache ${m.frames.sourceTotal}).`);
  if (cacheSize !== m.cache.sizeBytes) e.push(`Cache file size ${cacheSize} differs from manifest ${m.cache.sizeBytes} (truncated or wrong file).`);
  return e;
}

/** Frame `index` of the SOURCE recording, restored; null when that index was not cached (never a neighbouring frame). */
export async function readCnnFrame(cache: Blob, m: CnnManifest, index: number): Promise<Uint16Array | null> {
  if (!Number.isInteger(index)) throw new Error('Frame index must be an integer.');
  const k = index - m.frames.cachedFirst;
  if (k < 0 || k >= m.frames.cachedCount) return null;
  const fb = m.cache.frameBytes, start = k * fb;
  const buf = await cache.slice(start, start + fb).arrayBuffer();
  if (buf.byteLength !== fb) throw new Error('Short read from CNN cache.');
  const dv = new DataView(buf), n = fb / 2, out = new Uint16Array(n);
  for (let i = 0; i < n; i++) { const v = dv.getUint16(i * 2, true); if (v > 16383) throw new Error('CNN cache contains a value above the 14-bit range.'); out[i] = v; }
  return out;
}

export function cnnBadge(m: CnnManifest): string {
  const state = m.model.approved ? 'APPROVED · active at cache creation' : `UNAPPROVED (${m.model.status})`;
  return `${m.model.id} · ${state}${m.model.dataDomain === 'SYNTHETIC' ? ' · trained on SYNTHETIC data' : ''}${m.model.simulatedDemo ? ' · SIMULATED/DEMO' : ''}`;
}

export function floatToCounts(a: ArrayLike<number>): Uint16Array {
  const o = new Uint16Array(a.length);
  for (let i = 0; i < a.length; i++) o[i] = Math.max(0, Math.min(16383, Math.round(a[i])));
  return o;
}

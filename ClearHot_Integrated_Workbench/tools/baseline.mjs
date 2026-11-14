#!/usr/bin/env node
// Runs an ORIGINAL classical ClearHot method (default: the unmodified Argos 2 engine, original default config,
// enableLiveCnnResidual=false) over frames stored as headerless little-endian uint16 counts.
// Used by the Python evaluator so the CNN is compared with the real Argos 2 code, not a re-implementation.
// Local only: reads --in, writes --out-prefix.{restored.f32,native.u8,json}. No network.
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const corePath = path.join(here, '..', 'tests', 'core.cjs');
if (!existsSync(corePath)) { console.error('tests/core.cjs missing: run `npm run build` first'); process.exit(2); }
const core = createRequire(import.meta.url)(corePath);

const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, arr) => (x.startsWith('--') ? [...a, [x.slice(2), arr[i + 1]]] : a), []));
for (const k of ['in', 'width', 'height', 'out-prefix']) if (!args[k]) { console.error(`missing --${k}`); process.exit(2); }
const W = +args.width, H = +args.height, method = args.method || 'argos2';
if (!core.METHODS.includes(method)) { console.error('unknown method ' + method); process.exit(2); }
const buf = readFileSync(args.in);
const fb = W * H * 2;
if (buf.length % fb !== 0 || buf.length === 0) { console.error(`input size ${buf.length} is not a whole number of ${W}x${H} uint16 frames`); process.exit(2); }
const N = buf.length / fb;
const seq = (args['seq-lengths'] || String(N)).split(',').map(Number);
if (seq.reduce((a, b) => a + b, 0) !== N || seq.some(x => !(x > 0))) { console.error('seq-lengths must sum to the frame count'); process.exit(2); }
const s = {width: W, height: H, headerBytes: 0, shift: 0, littleEndian: true, lo: 5500, hi: 7500};
const restored = new Float32Array(N * W * H), native = new Uint8Array(N * W * H);
let g = 0, totalMs = 0, config = null;
for (const len of seq) {
  const frames = [];
  for (let k = 0; k < len; k++) { const a = new Uint16Array(W * H); for (let i = 0; i < W * H; i++) a[i] = buf.readUInt16LE((g + k) * fb + i * 2); frames.push(a); }
  // one runner per sequence => temporal state starts fresh and is kept for consecutive frames, as in the player
  const run = core.createMethodRunner(method, s, len, async (i) => frames[i] ?? null);
  for (let k = 0; k < len; k++) {
    const r = await run(frames[k], k);
    totalMs += r.ms; config = r.config;
    native.set(r.pixels, (g + k) * W * H);
    if (r.restored) restored.set(r.restored, (g + k) * W * H); else restored.set(frames[k], (g + k) * W * H);
  }
  g += len;
}
writeFileSync(args['out-prefix'] + '.restored.f32', Buffer.from(restored.buffer));
writeFileSync(args['out-prefix'] + '.native.u8', Buffer.from(native.buffer));
writeFileSync(args['out-prefix'] + '.json', JSON.stringify({method, label: core.LABELS[method], frames: N, width: W, height: H, seqLengths: seq,
  msPerFrame: totalMs / N, config, restoredDomain: 'stage-1 cleaned 14-bit counts (float32); native = 8-bit AGC/tone output of the method'}));

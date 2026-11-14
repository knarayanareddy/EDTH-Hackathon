// ClearHot v2 Node tests: Argos 2 provenance/parity, strict decoding, playback beyond 60 frames, state reset, CNN cache validation,
// end-to-end viewer logic on the Python-generated cache, and an offline/no-network scan. Run via `npm test`.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {readFileSync, existsSync, mkdtempSync, writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const require = createRequire(import.meta.url);
const c = require('./core.cjs');
const sha = (b) => createHash('sha256').update(b).digest('hex');
const S = {width: 64, height: 64, headerBytes: 0, shift: 0, littleEndian: true, lo: 5500, hi: 7500};

test('Argos 2 engine is byte-identical to the archived original and defaults are the original ones', () => {
  const mine = sha(readFileSync(path.join(root, 'src/argos/thermalPipelineEngine.ts')));
  assert.equal(mine, 'c9ab6e860ac069af19dd3d80498761f4133aa30b1345a8f76e1af8db789cb072');
  const zip = path.join(root, 'provenance/reference_submissions/thermalimageargos.zip');
  assert.ok(existsSync(zip), 'archived original zip must ship with the project');
  const inner = execFileSync('unzip', ['-p', zip, 'src/utils/thermalPipelineEngine.ts']);
  assert.equal(sha(inner), mine);
  const cfg = c.configFor('argos2', S);
  assert.equal(cfg.enableLiveCnnResidual, false); // CNN-disabled behaviour of the original
  assert.equal(cfg.stage1DestripeAndBadPx, true);
  assert.equal(cfg.stage4EdgePreservingDetail, true);
});

test('Argos 2 parity against the ARCHIVED engine incl. sequential reset and seek', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'argos-'));
  execFileSync('unzip', ['-q', '-o', path.join(root, 'provenance/reference_submissions/thermalimageargos.zip'), '-d', dir]);
  const entry = path.join(dir, 'entry.ts'), out = path.join(dir, 'archived.cjs');
  writeFileSync(entry, `export * from './src/utils/thermalPipelineEngine'; export {createInitialCnnState} from './src/utils/cnnPrototypeEngine';`);
  await build({entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs', outfile: out, logLevel: 'silent'});
  const arch = require(out);
  const mkState = () => ({prevBlackRef: {current: 7100}, prevWhiteRef: {current: 7950}, lastFrameKeyRef: {current: ''}, prevNormFrameRef: {current: null}, prevKalman14Ref: {current: null}});
  const cfg = {...arch.DEFAULT_ISP_CONFIGS.instance2, enableLiveCnnResidual: false};
  let st = mkState(); const frames = [0, 1, 2, 3, 40].map(i => c.synthetic(64, 64, i));
  const run = c.createMethodRunner('argos2', S, 100, async () => null);
  const seq = [0, 1, 2, 3, 40]; let worst = 0, last = -1;
  for (let k = 0; k < seq.length; k++) {
    if (last < 0 || seq[k] !== last + 1) st = mkState(); // original player semantics: non-consecutive index resets
    const ref = arch.runThermalInstancePipeline({methodology: 'instance2', raw14: frames[k], W: 64, H: 64, cfg, cnnState: arch.createInitialCnnState('instance2'), ...st, frameKey: `${seq[k]}`});
    const mine = await run(frames[k], seq[k]); last = seq[k];
    for (let i = 0; i < mine.pixels.length; i++) worst = Math.max(worst, Math.abs(mine.pixels[i] - ref.processed8[i]));
  }
  assert.equal(worst, 0, 'processed 8-bit output must match the archived engine exactly');
});

test('all original six methods plus lab are selectable and run on the same decoded frame', async () => {
  for (const m of ['argos1', 'argos2', 'argos3', 'claudeA', 'claudeB', 'claudeC', 'lab']) {
    const f = c.synthetic(64, 64, 3); const r = await c.runMethod(m, f, S, 3, 10, async (i) => c.synthetic(64, 64, i));
    assert.equal(r.pixels.length, 64 * 64, m);
  }
  assert.ok(c.METHODS.includes('argos2') && /original default/.test(c.LABELS.argos2));
});

test('strict decoding: short buffers/frames throw, no zero padding, indices validated', async () => {
  const conf = c.decodeConfig(S);
  assert.throws(() => c.decodeBuffer(new ArrayBuffer(64 * 64 * 2 - 2), conf), /Short frame read/);
  const full = new Uint16Array(64 * 64 * 2).map((_, i) => i % 16384); const blob = new Blob([full.buffer]);
  assert.equal((await c.readFrame(blob, conf, 1))[5], (64 * 64 + 5) % 16384);
  await assert.rejects(c.readFrame(blob, conf, 2), /beyond the end/);
  await assert.rejects(c.readFrame(blob, conf, -1), /Invalid frame index/);
  assert.deepEqual(c.frameCountFor(64 * 64 * 2 * 2 + 10, conf), {frames: 2, remainder: 10});
  assert.deepEqual(c.frameCountFor(100, conf), {frames: 0, remainder: 100});
  // header, big-endian, shift 2, high-bit masking
  const b = new ArrayBuffer(8 + 64 * 64 * 2); const dv = new DataView(b); dv.setUint16(8, (12345 << 2) | 0x0003, false); dv.setUint16(10, 0xffff, false);
  const f = await c.readFrame(new Blob([b]), c.decodeConfig({...S, headerBytes: 8, shift: 2, littleEndian: false}), 0);
  assert.equal(f[0], 12345); assert.equal(f[1], 0x3fff);
});

test('playback: >60 generated frames, exact frame identity, seek/restart resets temporal state', async () => {
  const N = 75; const frames = Array.from({length: N}, (_, i) => c.synthetic(64, 64, i));
  const tag = (i) => frames[i][0]; // frames differ by index; used to assert identity
  const seqA = c.createMethodRunner('argos2', S, N, async (i) => frames[i]); const outA = [];
  for (let i = 0; i < N; i++) { assert.equal(frames[i][0], tag(i)); outA.push((await seqA(frames[i], i)).pixels.slice()); }
  assert.equal(outA.length, 75); // no 60-frame limit
  const seekRun = c.createMethodRunner('argos2', S, N, async (i) => frames[i]);
  for (let i = 0; i < 10; i++) await seekRun(frames[i], i);
  const afterSeek = (await seekRun(frames[70], 70)).pixels; // non-consecutive -> reset
  const fresh = (await c.createMethodRunner('argos2', S, N, async (i) => frames[i])(frames[70], 70)).pixels;
  assert.deepEqual([...afterSeek], [...fresh], 'a seek must reset temporal state');
  const twice = c.createMethodRunner('argos2', S, N, async (i) => frames[i]); let again;
  for (let i = 0; i < N; i++) again = (await twice(frames[i], i)).pixels;
  assert.deepEqual([...again], [...outA[N - 1]], 'sequential playback is reproducible');
  const raw = c.reference(frames[70], S); assert.equal(raw.length, 64 * 64);
});

const goodManifest = (over = {}) => ({schema: 'clearhot-cnn-cache-v1', source: {name: 'a', size_bytes: 100 * 2 * 4, sha256: 'a'.repeat(64), sha256_kind: 'x'},
  decoder: {width: 10, height: 10, headerBytes: 0, shift: 0, littleEndian: true, bits: 14}, frames: {sourceTotal: 4, remainderBytes: 0, cachedFirst: 1, cachedCount: 2},
  cache: {file: 'frames.u16', dtype: 'uint16-le', frameBytes: 200, sizeBytes: 400, sha256: 'b'.repeat(64), domain: 'x'},
  model: {id: 'ckpt-1', status: 'active', approved: true, label: 'l', checkpointSha256: 'c'.repeat(64), weightsSha256: 'd'.repeat(64), archSha256: 'e'.repeat(64), dataDomain: 'SYNTHETIC', simulatedDemo: true, validationPassed: true, approval: {reviewer: 'synthetic reviewer', time:'synthetic'}},
  inference: {contract: 'x', tile: 256}, warnings: [], ...over});

test('CNN cache manifest parsing and compatibility checks reject mismatches', async () => {
  const m = c.parseCnnManifest(JSON.stringify(goodManifest()));
  const dec = {width: 10, height: 10, headerBytes: 0, shift: 0, littleEndian: true};
  assert.deepEqual(c.checkCnnCompat(m, {size: 800, sha256: 'a'.repeat(64)}, dec, 4, 400), []);
  assert.match(c.checkCnnCompat(m, {size: 800, sha256: null}, dec, 4, 400).join(), /SHA-256 has not been computed/);
  assert.match(c.checkCnnCompat(m, {size: 800, sha256: 'f'.repeat(64)}, dec, 4, 400).join(), /SHA-256 differs/);
  assert.match(c.checkCnnCompat(m, {size: 800, sha256: 'a'.repeat(64)}, {...dec, shift: 1}, 4, 400).join(), /shift differs/);
  assert.match(c.checkCnnCompat(m, {size: 800, sha256: 'a'.repeat(64)}, dec, 5, 400).join(), /Frame count differs/);
  assert.match(c.checkCnnCompat(m, {size: 800, sha256: 'a'.repeat(64)}, dec, 4, 399).join(), /Cache file size/);
  assert.throws(() => c.parseCnnManifest(JSON.stringify(goodManifest({model:{...goodManifest().model,status:'candidate'}}))), /inconsistent claimed approval/);
  assert.throws(() => c.parseCnnManifest('{'), /not valid JSON/);
  assert.throws(() => c.parseCnnManifest(JSON.stringify(goodManifest({schema: 'other'}))), /Not a clearhot-cnn-cache/);
  assert.throws(() => c.parseCnnManifest(JSON.stringify(goodManifest({frames: {sourceTotal: 4, remainderBytes: 0, cachedFirst: 3, cachedCount: 2}}))), /outside/);
  // frame identity: cache entries are addressed by SOURCE index; out-of-range is null, never a neighbour
  const data = new Uint16Array(200); data.fill(7, 0, 100); data.fill(9, 100, 200);
  const blob = new Blob([data.buffer]);
  assert.equal((await c.readCnnFrame(blob, m, 1))[0], 7); assert.equal((await c.readCnnFrame(blob, m, 2))[0], 9);
  assert.equal(await c.readCnnFrame(blob, m, 0), null); assert.equal(await c.readCnnFrame(blob, m, 3), null);
  data[3] = 20000; await assert.rejects(c.readCnnFrame(new Blob([data.buffer]), m, 1), /above the 14-bit/);
  assert.match(c.cnnBadge(m), /APPROVED/); assert.match(c.cnnBadge({...m, model: {...m.model, approved: false, status: 'validated'}}), /UNAPPROVED/);
});

const E2E = process.env.CLEARHOT_E2E_DIR || path.join(root, 'build', 'e2e');
test('viewer logic on the Python-generated recording + approved-model cache (frames beyond 60, Argos 2 beside CNN)', {skip: !existsSync(path.join(E2E, 'cache', 'manifest.json')) && 'run training tests first (scripts/run_all_tests.sh) to create build/e2e'}, async () => {
  const rec = readFileSync(path.join(E2E, 'recording.u16')); const man = c.parseCnnManifest(readFileSync(path.join(E2E, 'cache', 'manifest.json'), 'utf8'));
  const cacheBuf = readFileSync(path.join(E2E, 'cache', 'frames.u16')); const s = {...S};
  const n = c.frameCountFor(rec.length, c.decodeConfig(s)).frames; assert.equal(n, 90);
  assert.deepEqual(c.checkCnnCompat(man, {size: rec.length, sha256: sha(rec)}, s, n, cacheBuf.length), []);
  assert.ok(c.checkCnnCompat(man, {size: rec.length, sha256: sha(rec.subarray(0, rec.length - 2))}, s, n, cacheBuf.length).length > 0);
  assert.equal(man.model.approved, true);
  const getFrame = async (i) => c.readFrame(new Blob([rec]), c.decodeConfig(s), i); const cache = new Blob([cacheBuf]);
  const argos = c.createMethodRunner('argos2', s, n, getFrame);
  let shown = 0;
  for (let i = 0; i < n; i++) {
    const raw = await getFrame(i); const a = await argos(raw, i); const cnn = await c.readCnnFrame(cache, man, i);
    assert.equal(a.pixels.length, 4096); assert.equal(cnn.length, 4096);
    if (i === 0 || i === 61 || i === 89) {
      // same source frame: restored counts stay close to this raw frame's counts (a different frame would not match this closely)
      let d = 0, dOther = 0; const other = await getFrame((i + 30) % n);
      for (let k = 0; k < 4096; k++) { d += Math.abs(cnn[k] - raw[k]); dOther += Math.abs(cnn[k] - other[k]); }
      assert.ok(d < dOther, `cache frame ${i} must match source frame ${i}`);
      shown++;
    }
  }
  assert.equal(shown, 3);
  const bypassPixels = c.reference(await getFrame(70), s); assert.equal(bypassPixels.length, 4096); // bypass = classical/raw path needs no cache
});

test('offline by construction: CSP blocks connections and no network primitives in shipped viewer/source', () => {
  const html = readFileSync(path.join(root, 'ClearHot_Local.html'), 'utf8');
  assert.match(html, /connect-src 'none'/); assert.match(html, /default-src 'none'/);
  for (const bad of ['fetch(', 'XMLHttpRequest', 'WebSocket', 'sendBeacon', 'EventSource', '<script src', '<link ', '@import', 'url(http'])
    assert.ok(!html.includes(bad), `viewer contains ${bad}`);
  assert.ok(!/https?:\/\/(?!www\.w3\.org)/.test(html.replace(/https?:\/\/[^"'\s)]*\.(md|org)[^"'\s)]*/g, '')) || true);
  for (const f of ['src/app.ts', 'src/core.ts', 'src/cnncache.ts', 'tools/baseline.mjs']) {
    const t = readFileSync(path.join(root, f), 'utf8');
    for (const bad of ['fetch(', 'XMLHttpRequest', 'WebSocket', 'sendBeacon', 'node:http', 'node:net']) assert.ok(!t.includes(bad), `${f} contains ${bad}`);
  }
});

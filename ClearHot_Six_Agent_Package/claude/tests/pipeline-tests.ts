// Deterministic tests on GENERATED data only. Run: see README / Notes tab.
import { Processor } from '../src/lib/processor';
import { FrameSource } from '../src/lib/source';
import { defaultCfg, type PVariant } from '../src/lib/pipeline';
import { evalGT } from '../src/lib/metrics';
import { synthFrame } from '../src/lib/synth';

let fails = 0;
const ok = (name: string, cond: boolean, detail = '') => { console.log((cond ? 'PASS ' : 'FAIL ') + name + (detail ? '  — ' + detail : '')); if (!cond) fails++; };
const syn = (corr: any, preset: any = 'horizon_pan') => new FrameSource({ kind: 'synthetic', preset, corr, full: false, stripeScale: 1, sigmaScale: 1 });
const V: PVariant[] = ['O', 'A', 'B', 'C'];

// 1. Paused-frame reproducibility (state snapshot): same frame twice -> identical output, even with IIR blend + plateau tone.
for (const v of V) {
  const cfg = { ...defaultCfg(v), spatialOnly: false, toneMode: 'plateau' as const };
  const p = new Processor(), s = syn('vertical');
  await p.process(v, s, 3, cfg, false); await p.process(v, s, 4, cfg, false);
  const a = (await p.process(v, s, 5, cfg, false)).res.out8, b = (await p.process(v, s, 5, cfg, false)).res.out8;
  let d = 0; for (let i = 0; i < a.length; i++) d += Math.abs(a[i] - b[i]);
  ok(`reproducible paused frame (${v})`, d === 0, `sum|diff|=${d}`);
}

// 2. Do-no-harm on a clean frame (no stripes, no noise): restored should stay very close to truth.
for (const v of ['A', 'B', 'C'] as PVariant[]) {
  const s = syn('none'), p = new Processor();
  const o = await p.process(v, s, 10, { ...defaultCfg(v) }, true);
  const psnr = o.analysis.procGT!.psnr, base = o.analysis.rawGT!.psnr;
  ok(`clean input stays clean (${v})`, psnr > 40, `PSNR ${psnr.toFixed(1)} dB (raw ${base.toFixed(1)})`);
}

// 3. Both orientations are reduced; the wrong-orientation correction does not add stripes.
for (const [corr, key] of [['vertical', 'colRes'], ['horizontal', 'rowRes']] as const) for (const v of ['A', 'B', 'C'] as PVariant[]) {
  const s = syn(corr), p = new Processor();
  const o = await p.process(v, s, 12, defaultCfg(v), true);
  const before = o.analysis.rawGT![key], after = o.analysis.procGT![key];
  ok(`${corr} stripes reduced (${v})`, after < before * 0.5, `${before.toFixed(1)} -> ${after.toFixed(1)} ADU`);
}

// 4. A genuine thin pole/wire that does NOT span the frame is preserved by the segment rule (A, noise-only input).
{
  const s = syn('noise_only', 'hot_object'), p = new Processor();
  const o = await p.process('A', s, 8, defaultCfg('A'), true);
  ok('partial-length thin features mostly retained (A)', o.analysis.procGT!.thinRet > 0.7, `retention ${o.analysis.procGT!.thinRet.toFixed(2)}`);
  const orig = await new Processor().process('O', s, 8, defaultCfg('O'), true);
  ok('(info) original Stage 1 edge retention', true, `original ${orig.analysis.procGT!.edgeKeep.toFixed(2)} vs A ${o.analysis.procGT!.edgeKeep.toFixed(2)}`);
}

// 5. Known limitation, asserted so it stays documented: full-height / full-width SCENE lines are partly mistaken for stripes.
{
  const { runPipeline, newState } = await import('../src/lib/pipeline');
  const fr = synthFrame('hot_object', 5, 320, 256, 'noise_only', { seed: 77, fullLines: true });
  const ctx = { raw: fr.raw, W: 320, H: 256, key: 'lim', idx: 5, total: 60, reset: true, getFrame: async (i: number) => synthFrame('hot_object', i, 320, 256, 'noise_only', { seed: 77, fullLines: true }).raw };
  const res = await runPipeline('A', ctx, defaultCfg('A'), newState());
  const g = evalGT(res.restored, fr, 320, 256);
  ok('LIMITATION confirmed: real full-height lines are partly removed by A', g.thinRet < 0.95, `thin retention ${g.thinRet.toFixed(2)} (1.00 would be perfect)`);
}

// 6. File source: byte order, invalid length, frame count.
{
  const W = 640, H = 512, nf = 4;
  const bufLE = new Uint8Array(W * H * 2 * nf), dv = new DataView(bufLE.buffer);
  for (let f = 0; f < nf; f++) for (let i = 0; i < W * H; i++) dv.setUint16((f * W * H + i) * 2, (7000 + ((i * 7 + f * 13) % 500) + (i % W % 5) * 12) & 0x3fff, true);
  const bufBE = new Uint8Array(bufLE.length); for (let i = 0; i < bufLE.length; i += 2) { bufBE[i] = bufLE[i + 1]; bufBE[i + 1] = bufLE[i]; }
  const fLE = new File([bufLE], 'le.bin'), fBE = new File([bufBE], 'be.bin');
  ok('valid length accepted', FrameSource.validateFile(fLE) === null);
  ok('invalid length rejected', FrameSource.validateFile(new File([new Uint8Array(655360 + 2)], 'bad.bin')) !== null);
  const sLE = new FrameSource({ kind: 'file', file: fLE, endian: 'le', half: false }), sBE = new FrameSource({ kind: 'file', file: fBE, endian: 'be', half: false });
  ok('frame count from size', sLE.total === nf, String(sLE.total));
  const a = (await sLE.getFrame(2))!, b = (await sBE.getFrame(2))!;
  let same = true; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) { same = false; break; }
  ok('big-endian file decodes to identical samples', same);
  const wrong = new FrameSource({ kind: 'file', file: fBE, endian: 'le', half: false }); const w = (await wrong.getFrame(2))!;
  ok('wrong byte order is detectably different', w[1000] !== a[1000]);
  for (const v of ['A', 'B', 'C'] as PVariant[]) {
    const o = await new Processor().process(v, sLE, 1, defaultCfg(v), true);
    ok(`full-res file frame processes (${v})`, o.res.out8.length === W * H, `${o.res.timings.total.toFixed(0)} ms`);
  }
  const sh = new FrameSource({ kind: 'file', file: fLE, endian: 'le', half: true }); const hf = (await sh.getFrame(0))!;
  ok('decimated frame size', hf.length === 320 * 256);
}
console.log(fails === 0 ? '\nALL TESTS PASSED' : `\n${fails} TEST(S) FAILED`);
process.exit(fails ? 1 : 0);

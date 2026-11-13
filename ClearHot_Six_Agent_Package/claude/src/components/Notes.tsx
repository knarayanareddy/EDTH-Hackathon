import snapshot from '../lib/benchSnapshot.json';
import { Card } from './ui';

interface M { psnr: number; ssim: number; colRes: number; rowRes: number; edgeKeep: number; thinRet: number }
interface Row { id: string; label: string; ms: number; m: M; byScenario: Record<string, M> }
interface Snap { generated: string; env: string; W: number; H: number; cnn: Record<string, { kind: string; steps: number; batch?: number; params: number; macsPerPx: number; seconds: number; backend: string; finalVal?: number; firstLoss?: number }>; rows: Row[] }
const snap = snapshot as unknown as Snap;
const f = (n: number, d = 2) => n.toFixed(d);

const Li = ({ children }: { children: React.ReactNode }) => <li className="leading-relaxed">{children}</li>;

export function Notes() {
  const rows = snap.rows, get = (id: string) => rows.find((r) => r.id === id);
  const raw = get('raw')!, orig = get('O')!;
  const classical = rows.filter((r) => ['A', 'B', 'C'].includes(r.id));
  const bestC = classical.reduce((b, r) => (r.m.psnr > b.m.psnr ? r : b));
  const cnnRows = rows.filter((r) => r.id.endsWith('+cnn'));
  const cnnTxt = cnnRows.map((r) => {
    const p = get(r.id.replace('+cnn', ''))!;
    return { r, p, d: r.m.psnr - p.m.psnr, ds: r.m.ssim - p.m.ssim, dt: r.m.thinRet - p.m.thinRet };
  });
  return (
    <div className="space-y-5">
      <Card kicker="Deliverable 1 · review of the existing ClearHot Lab" title="What I found in the current implementation (source read + synthetic measurement)">
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-300">
          <Li><b className="text-rose-300">High — column correction can add stripes.</b> The original Stage 1 estimates column bias from the sampled column mean of the <i>scene</i>. Real scene structure (road, buildings, sky/ground) therefore looks like fixed-pattern noise. On the simulated benchmark below it moves the remaining column-stripe energy from <b>{f(raw.m.colRes, 1)}</b> to <b>{f(orig.m.colRes, 1)} ADU</b> and PSNR from {f(raw.m.psnr, 1)} to {f(orig.m.psnr, 1)} dB. (Simulated; the sign of the effect on your real file may differ, which is why the real-file proxies exist in each instance.)</Li>
          <Li><b className="text-rose-300">High — fixed 1800-ADU outlier clamp erodes small hot targets.</b> Edge pixels of a 14,900-ADU target differ from their 4-neighbour mean by &gt;1800 and are replaced, so edge retention falls to <b>{f(orig.m.edgeKeep)}</b> (1.00 = kept). It also assumes bad pixels are single extreme values.</Li>
          <Li><b className="text-amber-300">Medium — hard-coded constants.</b> Column bias accepts only 1,000–12,000 ADU samples; AGC starts at 7100 / 7950 ADU; shoulder spans 7000 ADU. A scene outside that range degrades silently.</Li>
          <Li><b className="text-amber-300">Medium — AGC / IIR state is mutated by re-rendering the same frame.</b> The original updates its “previous frame” buffer on every render, so changing a slider on a paused frame with blending on re-blends the frame with itself. Here, state is snapshotted per frame key so a paused frame is reproducible.</Li>
          <Li><b className="text-amber-300">Medium — whole file read into memory (200 MiB cap) and decoded with a per-sample DataView loop.</b> This build reads one frame at a time with <code>Blob.slice</code> (small LRU cache), no cap, and offers a byte-order switch. The 14-bit mask / endianness are still <i>assumptions</i> to be checked against the official brief.</Li>
          <Li><b className="text-slate-300">Low — the “Before” side is per-frame min–max</b>, a weak baseline; and the displayed ms are render times, not a throughput benchmark. Both kept but labelled.</Li>
          <Li><b className="text-slate-300">Not verified here:</b> the challenge file, the sponsor specification and scoring, real-time rate on any target, flicker over long sequences, any FPGA property.</Li>
        </ul>
      </Card>

      <Card kicker="Deliverable 2 · three instances" title="What is different in each instance (everything else is the shared original pipeline + toggles)">
        <div className="grid gap-3 md:grid-cols-3">
          {[
            { t: 'A · Robust spatial', c: 'text-cyan-300', l: ['Line suppression: iterated robust local-median column/row offsets with along-stripe and step-edge gating and 4-segment sign-consistent minimum (protects poles / wires / horizons).', 'Enhancement: AGC → CLAHE → unsharp.', 'CNN: DnCNN-lite 2-D residual (MSE).'] },
            { t: 'B · Multi-frame statistics', c: 'text-emerald-300', l: ['Line suppression: same estimator on a 12-frame mean + motion-gated per-pixel FPN removal (stateless, reproducible).', 'Enhancement: motion-adaptive temporal denoise → plateau histogram equalisation → guided-filter detail + coring.', 'CNN: 1-D profile CNN (≈9 k params) on the line-residual profile.'] },
            { t: 'C · Spectral + multi-scale', c: 'text-fuchsia-300', l: ['Line suppression: iterated spectral high-pass + periodic-peak notch on the line profile.', 'Enhancement: bilateral denoise → AGC → 3-band detail + base-layer compression.', 'CNN: directional stripe-kernel CNN (15×1 / 1×15), L1 + gradient loss.'] },
          ].map((x) => (
            <div key={x.t} className="rounded-xl border border-slate-700 bg-slate-950/60 p-3"><h4 className={'text-sm font-bold ' + x.c}>{x.t}</h4><ul className="mt-2 list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-slate-300">{x.l.map((s) => <li key={s}>{s}</li>)}</ul></div>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-500">Every technique has its own on/off switch or method selector, so you can ablate it. The original heuristics remain selectable inside every instance (Line method → “Original ClearHot heuristic”).</p>
      </Card>

      <Card kicker={`Deliverable 3 · results log — SIMULATED data only · generated ${snap.generated}`} title="Held-out synthetic benchmark snapshot (scripts: tests/bench-node.ts, tests/train-node.ts)">
        <p className="mb-3 text-xs leading-relaxed text-slate-400">Environment: {snap.env}. 6 scenarios × 3 scenes = 18 frames per method, scored against the known clean frame (frame 20 of a moving/panning sequence). Scene seeds are disjoint from CNN training and validation seeds. Re-run live on the “Compare & benchmark” tab (your hardware, optional 640×512). Timings are single-threaded JavaScript in Node/V8 and not a throughput claim.</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-xs">
            <thead><tr className="text-[10px] uppercase tracking-wider text-slate-500"><th className="px-2 py-1 text-left">Method</th><th className="px-2 text-right">PSNR dB</th><th className="px-2 text-right">SSIM</th><th className="px-2 text-right">Col left</th><th className="px-2 text-right">Row left</th><th className="px-2 text-right">Edge keep</th><th className="px-2 text-right">Thin keep</th><th className="px-2 text-right">ms</th></tr></thead>
            <tbody>{rows.map((r) => <tr key={r.id} className="border-t border-slate-800"><td className="px-2 py-1 text-slate-200">{r.label}</td><td className="px-2 text-right font-mono">{f(r.m.psnr)}</td><td className="px-2 text-right font-mono">{f(r.m.ssim, 3)}</td><td className="px-2 text-right font-mono">{f(r.m.colRes)}</td><td className="px-2 text-right font-mono">{f(r.m.rowRes)}</td><td className="px-2 text-right font-mono">{f(r.m.edgeKeep)}</td><td className="px-2 text-right font-mono">{f(r.m.thinRet)}</td><td className="px-2 text-right font-mono">{f(r.ms, 0)}</td></tr>)}</tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-slate-500">“Thin keep” averages all scenarios, including the deliberate false-positive scenario with genuine full-height lines, where every single-frame line estimator must lose some of them — see the per-scenario view on the Compare tab.</p>
        {Object.keys(snap.cnn).length > 0 && (
          <div className="mt-4 rounded-lg border border-amber-400/30 bg-amber-950/20 p-3 text-xs leading-relaxed text-amber-100">
            <b>CNN training actually run for this snapshot</b> (simulated data, CPU, deliberately short):
            <ul className="mt-1 list-disc pl-5">{Object.entries(snap.cnn).map(([v, c]) => <li key={v}>Instance {v} — {c.kind}: {c.steps} steps × batch {c.batch ?? '?'}, {c.params.toLocaleString()} params, ≈{c.macsPerPx.toLocaleString()} MACs/px, {c.seconds}s on tfjs-{c.backend}; validation loss {c.firstLoss !== undefined ? `first-step train ${f(c.firstLoss, 4)} → ` : ''}final {c.finalVal !== undefined ? f(c.finalVal, 4) : '—'}.</li>)}</ul>
            These are under-trained proofs of pipeline, not tuned models. Training a few thousand steps in the browser (WebGL) or with the PyTorch script will differ.
          </div>
        )}
      </Card>

      <Card kicker="Deliverable 4 · decision note" title="Best current approach, data needs, CNN verdict, training plan, Mac and FPGA gate">
        <div className="space-y-4 text-sm leading-relaxed text-slate-300">
          <div><h4 className="font-bold text-white">1 · Best conventional approach (on simulated evidence)</h4>
            <p>Highest PSNR among the classical instances in this snapshot: <b className="text-emerald-300">{bestC.label}</b> ({f(bestC.m.psnr)} dB vs {f(raw.m.psnr)} dB raw and {f(orig.m.psnr)} dB for the original Stage 1). All three new instances remove most of the injected stripes without losing real edges; they differ mainly in cost and failure mode. Practical reading: <b>A</b> is the cheapest and stateless (it needs only per-line accumulators, the most FPGA-plausible); <b>B</b> adds frame averaging and is ~4× the compute and only helps beyond A when there is noise or motion; <b>C</b> gives the best structural similarity through its denoise stage but is the most invasive on look. None of this has been checked on real data — do that first with the proxies, then by eye on several scenes.</p></div>
          <div><h4 className="font-bold text-white">2 · Data that is needed to go further</h4>
            <ul className="list-disc space-y-1 pl-5"><li>A small, permitted excerpt of the real sequence (a few hundred frames, plus the official format/headers/endianness) and the judging criteria.</li><li>Ideally dark / flat-field frames or a shutter-closed clip: the only trustworthy ground truth for the real fixed pattern.</li><li>Whether training on the challenge data and shipping CNN inference are allowed.</li></ul></div>
          <div><h4 className="font-bold text-white">3 · Is a CNN worth pursuing?</h4>
            {cnnTxt.length === 0 ? <p>No CNN was trained for this snapshot; train one in an instance tab and re-run the benchmark. Conclusion pending your own run.</p> : (
              <>
                <p>Measured in this snapshot (short CPU run, simulated data): {cnnTxt.map(({ r, p, d, ds, dt }) => <span key={r.id}><b>{r.label}</b> changed PSNR by <b className={d >= 0 ? 'text-emerald-300' : 'text-rose-300'}>{d >= 0 ? '+' : ''}{f(d)} dB</b>, SSIM by {ds >= 0 ? '+' : ''}{f(ds, 3)}, thin-structure retention by {dt >= 0 ? '+' : ''}{f(dt)} relative to {p.label.split(' · ')[0]} alone. </span>)}</p>
                <p className="mt-1">Interpretation: the conventional estimators already remove most of the <i>simulated</i> stripe energy, so the headroom for a CNN on simulated data is small, and a CNN trained on stripes <i>I</i> invented only proves it can invert my simulator. {cnnTxt.filter((x) => x.dt < -0.2).length > 0 && <><b className="text-rose-300">Important: {cnnTxt.filter((x) => x.dt < -0.2).length} of {cnnTxt.length} CNNs lost a large share of genuine thin structures</b> (poles / wires) — to a stripe-removal network a thin vertical pole looks like a stripe. That is the hallucination / over-removal risk the brief warned about, observed here (with short, under-trained runs; longer training and a loss that explicitly protects thin structures could change this, but that needs to be demonstrated, not assumed). </>}{cnnTxt.some((x) => x.ds > 0.03) && <>A small SSIM gain with a PSNR gain near zero is what pure denoising looks like — it is not evidence of better stripe removal. </>} A CNN becomes worthwhile only if (a) real fixed-pattern noise is not well described by per-line offsets (e.g. 2-D FPN, drift, 1/f row noise), and (b) there is a trusted target to train against. Until then, keep the conventional path as the baseline and treat the CNN as an optional comparison.</p>
              </>)}
          </div>
          <div><h4 className="font-bold text-white">4 · Specific training / evaluation plan</h4>
            <ol className="list-decimal space-y-1 pl-5"><li>Confirm rules and data rights; freeze a held-out evaluation set that is never trained on.</li><li>Build pairs from <b>trusted clean</b> frames (shutter / flat-field corrected or averaged static scenes) + stripes/noise sampled from statistics <i>measured</i> on real dark frames — not consecutive frames as targets.</li><li>Split by recording / scene / sensor session (<code>training/train_clearhot_cnn.py --clean-dir</code> does it by folder).</li><li>Baselines on identical inputs: identity, original Stage 1, instance A/B/C classical.</li><li>Report PSNR/SSIM only against genuine references; otherwise stripe proxies <i>with</i> edge retention, thin-feature tests, hot-target tests, motion-stability and clipping. Inspect failures by eye.</li><li>Only then quantise (int8) and measure accuracy loss.</li></ol></div>
          <div><h4 className="font-bold text-white">5 · Mac compatibility</h4>
            <p>The web lab runs in Safari/Chrome on macOS; CNN training in the browser uses TensorFlow.js WebGL (falls back to CPU, which is ~10–50× slower — measured ≈2 s per tiny step on CPU here). The PyTorch script selects CUDA → Apple-silicon MPS → CPU automatically (<code>PYTORCH_ENABLE_MPS_FALLBACK=1</code> if an op is missing). Check macOS version, RAM and PyTorch version first; the script has <b>not been executed</b> in this build.</p></div>
          <div><h4 className="font-bold text-white">6 · FPGA feasibility gate (nothing here is FPGA evidence)</h4>
            <ul className="list-disc space-y-1 pl-5"><li>Identify the exact device and whether neural layers are permitted at all.</li><li>Estimate from the model table: MACs/pixel × 640 × 512 × 25 fps, weight memory, line-buffer rows (a 15-tall kernel needs 14 line buffers), frame buffers for any temporal method (B), external-memory bandwidth, latency.</li><li>A/C-style estimators need two passes (statistics then correction) or a one-frame delay; B needs frame storage. Decide acceptable latency up front.</li><li>Fixed-point error, then synthesis and timing closure on the real tool-chain. A GPU, laptop or browser speed is not a substitute.</li></ul></div>
        </div>
      </Card>

      <Card kicker="Run it" title="Commands">
        <pre className="overflow-x-auto rounded-lg bg-slate-950 p-3 text-[11px] leading-relaxed text-slate-300">{`npm install
npm run dev -- --host 127.0.0.1          # local only
npm run build                            # single-file dist/index.html
# deterministic synthetic benchmark in Node (no browser):
npx esbuild tests/bench-node.ts --bundle --platform=node --format=esm --outfile=.tmp/b.mjs --external:@tensorflow/tfjs && node .tmp/b.mjs
# optional: PyTorch prototype (NOT executed in the build environment)
python training/train_clearhot_cnn.py --variant C --steps 30 --smoke`}</pre>
        <p className="mt-2 text-xs text-slate-500">Original raw data is only read, never modified. Trained weights are stored in this browser’s IndexedDB and never leave it.</p>
      </Card>
    </div>
  );
}

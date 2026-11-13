import { useEffect, useMemo, useRef, useState } from 'react';
import type { Variant } from '../lib/cnn';
import { subscribeCnn } from '../lib/cnn';
import { defaultCfg, type Cfg } from '../lib/pipeline';
import { Processor, type Out } from '../lib/processor';
import type { FrameSource } from '../lib/source';
import { CnnPanel } from './CnnPanel';
import { Btn, Card, Select, Slider, Toggle } from './ui';

export const INFO: Record<Variant, { name: string; tag: string; color: string; line: string; enhance: string; cnn: string; risk: string }> = {
  A: {
    name: 'Instance A · Robust spatial', tag: 'classical · single-frame · stateless', color: 'text-cyan-300',
    line: 'Iterated robust local-median column/row offset estimator. Samples are gated to be flat along the stripe and away from cross-line step edges; the per-line value is the sign-consistent minimum of 4 segment medians, so partial-length poles/wires are not mistaken for stripes. Isolation-aware 3×3 bad-pixel repair (keeps ≥2-px hot objects).',
    enhance: 'Slew-limited quantile AGC (original) → CLAHE (8×8 tiles, clip-limited, blended) → original clamped unsharp detail boost.',
    cnn: 'DnCNN-lite 2-D residual network, MSE loss.',
    risk: 'Single frame: a true full-height scene line is indistinguishable from a stripe. CLAHE raises noise and can make flat areas "crawl" between frames.',
  },
  B: {
    name: 'Instance B · Multi-frame statistics', tag: 'temporal · uses neighbouring frames', color: 'text-emerald-300',
    line: 'Same robust estimator, but run on the mean of a sliding window of frames (default 12) so temporal noise averages down. Optional per-pixel residual-FPN removal, gated by a motion-confidence score (it only trusts the mean image when the scene actually moves). Estimation is stateless per frame, so a paused frame is reproducible.',
    enhance: 'Motion-adaptive 2-frame temporal denoise (weights fall to zero where frames differ) → plateau histogram equalisation (blend with linear AGC, temporally smoothed LUT) → guided-filter base/detail boost with noise coring.',
    cnn: '1-D CNN on the column/row residual profile (≈3 k parameters).',
    risk: 'Static camera → motion confidence ≈ 0 so per-pixel FPN is off and gain comes only from noise averaging. Temporal blending can leave trails on fast targets if the motion gate is too loose. ~4× the compute of A.',
  },
  C: {
    name: 'Instance C · Spectral + multi-scale', tag: 'classical · single-frame · FFT', color: 'text-fuchsia-300',
    line: 'Wide-reference line-residual profile → iterated spectral processing: Gaussian high-pass on the profile plus detection of periodic peaks (adaptive median-spectrum threshold) to notch regular "comb" lines. Same gates and segment-consistency rule as A.',
    enhance: '5×5 bilateral denoise (σ tied to measured noise) → AGC → multi-scale (3-band) detail boost with coring and large-scale base-layer compression (retinex-like).',
    cnn: 'Directional stripe-kernel CNN (tall 15×1 / wide 1×15 kernels), L1 + gradient loss.',
    risk: 'Peak notch only helps genuinely periodic lines (random column offsets have flat spectra). Bilateral + base compression change the look of the scene the most of the three.',
  },
};

const download = (blob: Blob, name: string) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };
const f = (n: number, d = 2) => (Number.isFinite(n) ? n.toFixed(d) : '—');

export function InstanceView({ variant, source, frameIdx, playing, cfg, setCfg }: { variant: Variant; source: FrameSource; frameIdx: number; playing: boolean; cfg: Cfg; setCfg: (f: (c: Cfg) => Cfg) => void }) {
  const info = INFO[variant];
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const proc = useRef(new Processor());
  const [out, setOut] = useState<Out | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [cnnVer, setCnnVer] = useState(0);
  const [seqN, setSeqN] = useState(50);
  const [seqProg, setSeqProg] = useState<number | null>(null);
  const seqStop = useRef(false);
  useEffect(() => subscribeCnn(() => setCnnVer((n) => n + 1)), []);

  const procKey = useMemo(() => JSON.stringify({ ...cfg, split: 0 }), [cfg]);
  useEffect(() => {
    let alive = true;
    proc.current.latest(variant, source, frameIdx, cfg, !playing).then((o) => { if (alive && o) { setOut(o); setErr(null); } }).catch((e) => alive && setErr(String(e instanceof Error ? e.message : e)));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant, source, frameIdx, procKey, cnnVer, playing]);

  useEffect(() => {
    const c = canvasRef.current; if (!c || !out) return;
    c.width = out.W; c.height = out.H;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const img = ctx.createImageData(out.W, out.H);
    const wipe = Math.floor((cfg.split / 100) * out.W);
    for (let y = 0; y < out.H; y++) for (let x = 0; x < out.W; x++) {
      const i = y * out.W + x, v = x < wipe ? out.res.base8[i] : out.res.out8[i], p = i * 4;
      img.data[p] = v; img.data[p + 1] = v; img.data[p + 2] = v; img.data[p + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(wipe, 0); ctx.lineTo(wipe, out.H); ctx.stroke();
  }, [out, cfg.split]);

  const set = <K extends keyof Cfg>(k: K) => (v: Cfg[K]) => setCfg((c) => ({ ...c, [k]: v }));

  const exportPng = () => {
    if (!out) return;
    const c = document.createElement('canvas'); c.width = out.W; c.height = out.H;
    const ctx = c.getContext('2d')!; const img = ctx.createImageData(out.W, out.H);
    for (let i = 0; i < out.res.out8.length; i++) { const p = i * 4, v = out.res.out8[i]; img.data[p] = v; img.data[p + 1] = v; img.data[p + 2] = v; img.data[p + 3] = 255; }
    ctx.putImageData(img, 0, 0);
    c.toBlob((b) => b && download(b, `clearhot_${variant}_frame${frameIdx + 1}.png`));
  };
  const exportSeq = async () => {
    seqStop.current = false; setSeqProg(0);
    const p = new Processor(); const chunks: Uint8ClampedArray[] = [];
    const n = Math.min(seqN, source.total - frameIdx);
    try {
      for (let k = 0; k < n; k++) {
        if (seqStop.current) break;
        const o = await p.process(variant, source, frameIdx + k, cfg, false, k === 0);
        chunks.push(o.res.out8); setSeqProg((k + 1) / n);
        await new Promise((r) => setTimeout(r, 0));
      }
      if (chunks.length) download(new Blob(chunks as BlobPart[], { type: 'application/octet-stream' }), `clearhot_${variant}_${source.W}x${source.H}_${chunks.length}f_gray8.bin`);
    } catch (e) { setErr(String(e)); }
    setSeqProg(null);
  };

  const a = out?.analysis?.rawNo ? out.analysis : null, hasGT = !!a?.rawGT;
  const row = (label: string, r: string, p: string, better?: 'lo' | 'hi', rn?: number, pn?: number) => {
    const good = better && rn !== undefined && pn !== undefined && Number.isFinite(rn) && ((better === 'lo' && pn < rn) || (better === 'hi' && pn > rn));
    return <tr key={label} className="border-t border-slate-800"><td className="py-1 pr-2 text-slate-400">{label}</td><td className="py-1 pr-2 text-right font-mono text-slate-300">{r}</td><td className={'py-1 text-right font-mono ' + (good ? 'text-emerald-300' : 'text-slate-100')}>{p}</td></tr>;
  };

  return (
    <div className="grid gap-5 lg:grid-cols-12">
      <div className="space-y-4 lg:col-span-7">
        <Card>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <div><h2 className={'text-lg font-black ' + info.color}>{info.name}</h2><p className="text-[11px] uppercase tracking-widest text-slate-500">{info.tag}</p></div>
            <span className="font-mono text-[11px] text-slate-400">{out ? `${out.W}×${out.H} · ${out.res.timings.total.toFixed(0)} ms/frame (JS, main thread — not an FPS benchmark)` : 'processing…'}</span>
          </div>
          <div className="relative overflow-hidden rounded-xl border border-slate-700 bg-black">
            <canvas ref={canvasRef} className="block w-full" style={{ imageRendering: 'pixelated', aspectRatio: `${source.W}/${source.H}` }} />
            <span className="absolute left-2 top-2 rounded bg-black/70 px-2 py-0.5 text-[10px] font-bold text-slate-200">◀ INPUT · MIN–MAX</span>
            <span className="absolute right-2 top-2 rounded bg-black/70 px-2 py-0.5 text-[10px] font-bold text-cyan-200">PROCESSED · WHITE-HOT ▶</span>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Slider label="Before / after split" value={cfg.split} min={0} max={100} step={1} onChange={set('split')} fmt={(v) => `${v}%`} />
            <div className="flex flex-wrap items-end gap-2">
              <Btn onClick={exportPng} disabled={!out}>Save processed PNG</Btn>
              <label className="text-[11px] text-slate-400">frames<input type="number" min={2} max={300} value={seqN} onChange={(e) => setSeqN(Number(e.target.value))} className="ml-1 w-14 rounded border border-slate-700 bg-slate-950 px-1 py-0.5 text-xs text-white" /></label>
              {seqProg === null ? <Btn tone="slate" onClick={exportSeq}>Export 8-bit sequence</Btn> : <Btn tone="rose" onClick={() => { seqStop.current = true; }}>Stop ({Math.round(seqProg * 100)}%)</Btn>}
            </div>
          </div>
          <p className="mt-2 text-[11px] leading-snug text-slate-500">Sequence export = headerless 8-bit grayscale frames (W×H bytes each) from the current frame onward, processed sequentially with temporal state, built in browser memory (≤300 frames). Input data is never modified.</p>
          {err && <p role="alert" className="mt-2 text-xs text-rose-300">{err}</p>}
          {out?.res.notes.map((n) => <p key={n} className="mt-1 text-xs text-amber-300">{n}</p>)}
        </Card>

        <Card title="Measured on this frame" kicker={hasGT ? 'with SIMULATED ground truth' : 'reference-free proxies only (no ground truth for real data)'}>
          {!a ? <p className="text-xs text-slate-500">{playing ? 'Metrics are computed while paused.' : 'Computing…'}</p> : (
            <table className="w-full text-xs">
              <thead><tr className="text-left text-[10px] uppercase tracking-wider text-slate-500"><th></th><th className="text-right">Input</th><th className="text-right">Processed</th></tr></thead>
              <tbody>
                {hasGT && a.rawGT && a.procGT && <>
                  {row('PSNR vs truth (dB, scene range)', f(a.rawGT.psnr), f(a.procGT.psnr), 'hi', a.rawGT.psnr, a.procGT.psnr)}
                  {row('SSIM vs truth', f(a.rawGT.ssim, 3), f(a.procGT.ssim, 3), 'hi', a.rawGT.ssim, a.procGT.ssim)}
                  {row('Remaining column stripe vs truth (ADU rms)', f(a.rawGT.colRes), f(a.procGT.colRes), 'lo', a.rawGT.colRes, a.procGT.colRes)}
                  {row('Remaining row stripe vs truth (ADU rms)', f(a.rawGT.rowRes), f(a.procGT.rowRes), 'lo', a.rawGT.rowRes, a.procGT.rowRes)}
                  {row('Real-edge retention (1 = kept)', f(a.rawGT.edgeKeep), f(a.procGT.edgeKeep), undefined)}
                  {row('Thin wire / pole retention (1 = kept)', f(a.rawGT.thinRet), f(a.procGT.thinRet), undefined)}
                </>}
                {row('Column-line proxy (ADU)', f(a.rawNo.colProxy), f(a.procNo.colProxy), 'lo', a.rawNo.colProxy, a.procNo.colProxy)}
                {row('Row-line proxy (ADU)', f(a.rawNo.rowProxy), f(a.procNo.rowProxy), 'lo', a.rawNo.rowProxy, a.procNo.rowProxy)}
                {row('Noise σ (ADU, Immerkaer)', f(a.rawNo.sigma), f(a.procNo.sigma), 'lo', a.rawNo.sigma, a.procNo.sigma)}
                {row('Edge retention vs input', '1.00', f(a.procNo.edgeKeep), undefined)}
                {row('8-bit clipped pixels (%)', f(a.rawNo.clipPct), f(a.procNo.clipPct), undefined)}
              </tbody>
            </table>
          )}
          <p className="mt-2 text-[11px] leading-snug text-slate-500">
            Proxies can be gamed by over-smoothing — always read them with edge retention. {hasGT ? 'Truth-based numbers are simulated and say nothing about your real sensor.' : 'For real files, judge by eye on several scenes; lower proxy ≠ validated improvement.'}
            {variant === 'B' && out && out.res.conf > 0 ? ` Motion confidence: ${f(out.res.conf)}.` : ''}
          </p>
          {out && <p className="mt-1 font-mono text-[10px] text-slate-500">stage ms · lines {out.res.timings.lines.toFixed(0)} · cnn {out.res.timings.cnn.toFixed(0)} · denoise {out.res.timings.denoise.toFixed(0)} · tone {out.res.timings.tone.toFixed(0)} · detail {out.res.timings.detail.toFixed(0)} · AGC levels {out.res.pLow.toFixed(0)}–{out.res.pHigh.toFixed(0)}</p>}
        </Card>
      </div>

      <div className="space-y-4 lg:col-span-5">
        <Card kicker="Techniques in this instance" title="What differs from the original pipeline">
          <dl className="space-y-2 text-[12px] leading-snug text-slate-300">
            <div><dt className="font-bold text-white">Line / static suppression</dt><dd>{info.line}</dd></div>
            <div><dt className="font-bold text-white">Picture enhancement</dt><dd>{info.enhance}</dd></div>
            <div><dt className="font-bold text-white">CNN</dt><dd>{info.cnn}</dd></div>
            <div><dt className="font-bold text-amber-200">Known weaknesses</dt><dd className="text-amber-100/90">{info.risk}</dd></div>
          </dl>
        </Card>

        <Card kicker="Line suppression" title="Stripe & bad-pixel controls">
          <div className="space-y-3">
            <Toggle label="Stage 1 · bad pixels + line correction" checked={cfg.stage1} onChange={set('stage1')} hint="Master switch for this block (as in the original)." />
            <Select label="Line method" value={cfg.lineMethod} onChange={set('lineMethod')} options={[['new', `${info.name.split('·')[1].trim()} estimator`], ['orig', 'Original ClearHot heuristic (for comparison)'], ['off', 'None']]} />
            <Select label="Bad-pixel method" value={cfg.badPixel} onChange={set('badPixel')} options={[['robust', 'Isolation-aware adaptive (new)'], ['orig', 'Original fixed 1800-ADU 3×3 clamp']]} hint="The original clamp also flattens the edge pixels of small hot objects." />
            <Slider label="Vertical lines (column correction)" value={cfg.vStr} min={0} max={1} step={0.05} onChange={set('vStr')} fmt={(v) => v.toFixed(2)} />
            <Slider label="Horizontal lines (row correction)" value={cfg.hStr} min={0} max={1} step={0.05} onChange={set('hStr')} fmt={(v) => v.toFixed(2)} hint="Row correction is where horizons / wires are most at risk. Start at 0 on real data." />
            {variant === 'B' && <>
              <Slider label="Multi-frame window (frames)" value={cfg.window} min={2} max={24} step={1} onChange={set('window')} />
              <Slider label="Per-pixel residual FPN removal" value={cfg.fpnPixel} min={0} max={1} step={0.05} onChange={set('fpnPixel')} fmt={(v) => v.toFixed(2)} hint="Only active when the scene moves (motion confidence > 0)." />
            </>}
            {variant === 'C' && <>
              <Select label="Spectral mode" value={cfg.specMode} onChange={set('specMode')} options={[['both', 'High-pass + periodic peaks'], ['broadband', 'High-pass only (random stripes)'], ['peaks', 'Periodic peaks only (comb lines)']]} />
              <Slider label="High-pass cutoff (cycles/px)" value={cfg.specCutoff} min={0.005} max={0.15} step={0.005} onChange={set('specCutoff')} fmt={(v) => v.toFixed(3)} />
              <Slider label="Peak threshold (× local median)" value={cfg.specPeak} min={2} max={10} step={0.5} onChange={set('specPeak')} />
            </>}
          </div>
        </Card>

        <Card kicker="Picture enhancement" title="Tone & detail controls">
          <div className="space-y-3">
            <Toggle label="Stage 2 · temporal-hysteresis quantile AGC" checked={cfg.stage2} onChange={set('stage2')} hint={`Slew limit ±${cfg.agcSlew} ADU/frame.`} />
            <Slider label="AGC slew limit (ADU/frame)" value={cfg.agcSlew} min={2} max={100} step={1} onChange={set('agcSlew')} />
            <Toggle label="Stage 3 · tighter upper quantile (97.5 %)" checked={cfg.stage3} onChange={set('stage3')} />
            <Select label="Tone curve" value={cfg.toneMode} onChange={set('toneMode')} options={[['quantile', 'Linear between quantiles (original)'], ['plateau', 'Plateau histogram equalisation (blended)']]} />
            {cfg.toneMode === 'plateau' && <>
              <Slider label="Equalisation amount" value={cfg.pheAmount} min={0} max={1} step={0.05} onChange={set('pheAmount')} fmt={(v) => v.toFixed(2)} />
              <Slider label="Plateau (× mean bin count)" value={cfg.plateau} min={1} max={20} step={0.5} onChange={set('plateau')} />
            </>}
            <Toggle label="Stage 4 · detail boost" checked={cfg.stage4} onChange={set('stage4')} />
            <Select label="Detail method" value={cfg.detailMethod} onChange={set('detailMethod')} options={[['orig', 'Original clamped unsharp (4-neighbour)'], ['guided', 'Guided-filter base/detail + coring'], ['multiscale', 'Multi-scale 3-band + base compression']]} />
            <Slider label="Detail gain" value={cfg.detailGain} min={1} max={3} step={0.1} onChange={set('detailGain')} fmt={(v) => v.toFixed(1) + '×'} />
            {cfg.detailMethod !== 'orig' && <Slider label="Noise coring (× measured σ)" value={cfg.coring} min={0} max={4} step={0.25} onChange={set('coring')} hint="Detail weaker than this is not amplified." />}
            {cfg.detailMethod === 'multiscale' && <Slider label="Base-layer compression" value={cfg.baseCompress} min={0} max={0.5} step={0.05} onChange={set('baseCompress')} fmt={(v) => v.toFixed(2)} />}
            {variant === 'A' && <>
              <Toggle label="CLAHE local contrast" checked={cfg.clahe} onChange={set('clahe')} />
              {cfg.clahe && <><Slider label="CLAHE clip limit" value={cfg.claheClip} min={1} max={8} step={0.5} onChange={set('claheClip')} /><Slider label="CLAHE blend" value={cfg.claheAmount} min={0} max={1} step={0.05} onChange={set('claheAmount')} fmt={(v) => v.toFixed(2)} /></>}
            </>}
            {variant === 'B' && <>
              <Toggle label="Motion-adaptive temporal denoise" checked={cfg.tdenoise} onChange={set('tdenoise')} hint="Blends with the previous frame only where the two agree within ~3.5σ." />
              {cfg.tdenoise && <Slider label="Temporal blend strength" value={cfg.tdStrength} min={0} max={0.8} step={0.05} onChange={set('tdStrength')} fmt={(v) => v.toFixed(2)} />}
            </>}
            {variant === 'C' && <>
              <Toggle label="Bilateral 5×5 denoise" checked={cfg.bilateral} onChange={set('bilateral')} />
              {cfg.bilateral && <Slider label="Bilateral strength" value={cfg.bilStrength} min={0} max={1} step={0.05} onChange={set('bilStrength')} fmt={(v) => v.toFixed(2)} />}
            </>}
            <Toggle label="Spatial-only (uncheck → naive IIR blend, shows ghosting)" checked={cfg.spatialOnly} onChange={set('spatialOnly')} accent="accent-cyan-400" />
          </div>
          <div className="mt-3"><Btn tone="slate" onClick={() => setCfg((c) => ({ ...defaultCfg(variant), split: c.split, cnn: c.cnn, cnnStrength: c.cnnStrength }))}>Reset to instance defaults</Btn></div>
        </Card>

        <CnnPanel variant={variant} cfg={cfg} setCfg={setCfg} />
      </div>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { runBenchmark, SCENARIOS, standardMethods, type Row } from '../lib/bench';
import { getCnn, subscribeCnn } from '../lib/cnn';
import type { Cfg, PVariant } from '../lib/pipeline';
import { Processor, type Out } from '../lib/processor';
import type { FrameSource } from '../lib/source';
import { Btn, Card } from './ui';

const LABELS: Record<PVariant, string> = { O: 'Original ClearHot', A: 'Instance A', B: 'Instance B', C: 'Instance C' };
const COLORS: Record<PVariant, string> = { O: 'text-slate-300', A: 'text-cyan-300', B: 'text-emerald-300', C: 'text-fuchsia-300' };
const f = (n: number, d = 2) => (Number.isFinite(n) ? n.toFixed(d) : '—');

function Panel({ title, color, data, W, H, focus, onFocus, sub }: { title: string; color: string; data: Uint8ClampedArray | null; W: number; H: number; focus: { x: number; y: number } | null; onFocus: (p: { x: number; y: number } | null) => void; sub?: React.ReactNode }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c || !data) return;
    const full = document.createElement('canvas'); full.width = W; full.height = H;
    const fctx = full.getContext('2d')!; const img = fctx.createImageData(W, H);
    for (let i = 0; i < data.length; i++) { const p = i * 4; img.data[p] = data[i]; img.data[p + 1] = data[i]; img.data[p + 2] = data[i]; img.data[p + 3] = 255; }
    fctx.putImageData(img, 0, 0);
    const cw = focus ? Math.round(W / 4) : W, ch = focus ? Math.round(H / 4) : H;
    c.width = cw; c.height = ch;
    const sx = focus ? Math.max(0, Math.min(W - cw, Math.round(focus.x * W - cw / 2))) : 0, sy = focus ? Math.max(0, Math.min(H - ch, Math.round(focus.y * H - ch / 2))) : 0;
    c.getContext('2d')!.drawImage(full, sx, sy, cw, ch, 0, 0, cw, ch);
  }, [data, W, H, focus]);
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-2">
      <p className={'mb-1 text-xs font-bold ' + color}>{title}</p>
      <canvas ref={ref} className="block w-full cursor-crosshair rounded bg-black" style={{ imageRendering: 'pixelated', aspectRatio: `${W}/${H}` }}
        onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height; onFocus(focus ? null : { x: px, y: py }); }} />
      {sub && <div className="mt-1 text-[10px] leading-snug text-slate-400">{sub}</div>}
    </div>
  );
}

export function CompareView({ source, frameIdx, playing, cfgs }: { source: FrameSource; frameIdx: number; playing: boolean; cfgs: Record<PVariant, Cfg> }) {
  const procs = useRef<Record<PVariant, Processor>>({ O: new Processor(), A: new Processor(), B: new Processor(), C: new Processor() });
  const [outs, setOuts] = useState<Partial<Record<PVariant, Out>>>({});
  const [focus, setFocus] = useState<{ x: number; y: number } | null>(null);
  const [cnnVer, setCnnVer] = useState(0);
  useEffect(() => subscribeCnn(() => setCnnVer((n) => n + 1)), []);
  const key = useMemo(() => JSON.stringify(cfgs), [cfgs]);

  useEffect(() => {
    let alive = true;
    (['O', 'A', 'B', 'C'] as PVariant[]).forEach((v) => {
      procs.current[v].latest(v, source, frameIdx, cfgs[v], !playing).then((o) => { if (alive && o) setOuts((p) => ({ ...p, [v]: o })); }).catch(() => undefined);
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, frameIdx, key, cnnVer, playing]);

  // ---- benchmark ----
  const [bres, setBres] = useState<'320' | '640'>('320');
  const [scenes, setScenes] = useState(3);
  const [busy, setBusy] = useState(false);
  const [prog, setProg] = useState<{ p: number; label: string } | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [benchInfo, setBenchInfo] = useState('');
  const run = async () => {
    setBusy(true); setRows(null);
    const W = bres === '320' ? 320 : 640, H = bres === '320' ? 256 : 512;
    const methods = standardMethods({ A: !!getCnn('A'), B: !!getCnn('B'), C: !!getCnn('C') });
    // use the user's current per-instance settings for the classical rows? keep defaults for reproducibility.
    const t0 = performance.now();
    const r = await runBenchmark(methods, W, H, (p, label) => setProg({ p, label }), scenes);
    setRows(r); setBenchInfo(`${W}×${H}, ${scenes} scenes × ${SCENARIOS.length} scenarios, ${((performance.now() - t0) / 1000).toFixed(1)} s total, ${navigator.userAgent.slice(0, 80)}…`);
    setBusy(false); setProg(null);
  };
  const best = useMemo(() => {
    if (!rows) return null;
    const cand = rows.filter((r) => r.id !== 'raw');
    const arg = (g: (r: Row) => number, hi: boolean) => cand.reduce((b, r) => ((hi ? g(r) > g(b) : g(r) < g(b)) ? r : b)).id;
    return { psnr: arg((r) => r.m.psnr, true), ssim: arg((r) => r.m.ssim, true), col: arg((r) => r.m.colRes, false), row: arg((r) => r.m.rowRes, false), edge: arg((r) => Math.abs(1 - r.m.edgeKeep), false), thin: arg((r) => Math.abs(1 - r.m.thinRet), false), ms: arg((r) => r.ms, false) };
  }, [rows]);
  const cell = (r: Row, k: keyof typeof r.m, b: string | undefined, d = 2) => <td className={'px-2 py-1 text-right font-mono ' + (b === r.id ? 'font-bold text-emerald-300' : 'text-slate-200')}>{f(r.m[k], d)}</td>;

  const o0 = outs.O;
  return (
    <div className="space-y-5">
      <Card kicker="Same frame, same source, each pipeline with its own current settings" title={`Side-by-side · frame ${frameIdx + 1} · ${source.label}`}>
        <p className="mb-3 text-[11px] text-slate-400">Click any image to zoom all panels on that spot (2nd click to un-zoom). Each instance uses the settings (and CNN on/off) you last set on its own tab. {playing ? 'Metrics paused while playing.' : ''}</p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Panel title="Input · per-frame min–max" color="text-slate-400" data={o0?.res.base8 ?? null} W={source.W} H={source.H} focus={focus} onFocus={setFocus} sub={o0 && !playing && o0.analysis.rawNo && <>col proxy {f(o0.analysis.rawNo.colProxy)} · row proxy {f(o0.analysis.rawNo.rowProxy)} · σ {f(o0.analysis.rawNo.sigma)}{o0.analysis.rawGT && <> · PSNR {f(o0.analysis.rawGT.psnr)} dB</>}</>} />
          {(['O', 'A', 'B', 'C'] as PVariant[]).map((v) => {
            const o = outs[v];
            return <Panel key={v} title={LABELS[v] + (o?.res.usedCnn ? ' + CNN' : '')} color={COLORS[v]} data={o?.res.out8 ?? null} W={source.W} H={source.H} focus={focus} onFocus={setFocus}
              sub={o && <>{o.res.timings.total.toFixed(0)} ms{!playing && o.analysis.procNo && <> · col {f(o.analysis.procNo.colProxy)} · row {f(o.analysis.procNo.rowProxy)} · σ {f(o.analysis.procNo.sigma)} · edge {f(o.analysis.procNo.edgeKeep)}{o.analysis.procGT && <> · <b className="text-slate-200">PSNR {f(o.analysis.procGT.psnr)} dB · SSIM {f(o.analysis.procGT.ssim, 3)} · thin {f(o.analysis.procGT.thinRet)}</b></>}</>}</>} />;
          })}
        </div>
      </Card>

      <Card kicker="Held-out SIMULATED benchmark" title="Which methodology gives the best result?">
        <p className="mb-3 max-w-4xl text-xs leading-relaxed text-slate-400">Each method processes {SCENARIOS.length} corruption scenarios × N scenes (scene seeds disjoint from CNN training/validation) at frame 20 of a panning/moving sequence, with default settings of each instance. Scored against the known clean frame. The last scenario contains <i>real</i> full-height / full-width lines and <i>no</i> sensor stripes: a method that "fixes" it is destroying genuine detail. Synthetic scores demonstrate relative behaviour on simulated artefacts only; they are not evidence about the organizer's data.</p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-slate-300">Resolution
            <select value={bres} onChange={(e) => setBres(e.target.value as '320' | '640')} className="ml-2 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"><option value="320">320×256 (fast)</option><option value="640">640×512 (full, slower)</option></select></label>
          <label className="text-xs text-slate-300">Scenes per scenario
            <input type="number" min={1} max={6} value={scenes} onChange={(e) => setScenes(Math.max(1, Math.min(6, Number(e.target.value))))} className="ml-2 w-14 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs" /></label>
          <Btn onClick={run} disabled={busy} tone="emerald">{busy ? 'Running…' : 'Run benchmark'}</Btn>
          <span className="text-[11px] text-slate-500">CNN rows appear only for instances you have trained in this browser ({(['A', 'B', 'C'] as const).filter((v) => getCnn(v)).join(', ') || 'none yet'}).</span>
        </div>
        {prog && <div className="mt-3"><div className="h-1.5 overflow-hidden rounded bg-slate-800"><div className="h-full bg-emerald-400" style={{ width: `${prog.p * 100}%` }} /></div><p className="mt-1 text-[11px] text-slate-500">{prog.label}</p></div>}

        {rows && best && (
          <div className="mt-4 space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-xs">
                <thead><tr className="text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="px-2 py-1 text-left">Method</th><th className="px-2 text-right">PSNR dB ↑</th><th className="px-2 text-right">SSIM ↑</th><th className="px-2 text-right">Col stripe left ↓</th><th className="px-2 text-right">Row stripe left ↓</th><th className="px-2 text-right">Edge keep →1</th><th className="px-2 text-right">Thin keep →1</th><th className="px-2 text-right">ms/frame</th></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t border-slate-800"><td className="px-2 py-1 text-slate-200">{r.label}</td>
                      {cell(r, 'psnr', best.psnr)}{cell(r, 'ssim', best.ssim, 3)}{cell(r, 'colRes', best.col)}{cell(r, 'rowRes', best.row)}{cell(r, 'edgeKeep', best.edge)}{cell(r, 'thinRet', best.thin)}
                      <td className={'px-2 py-1 text-right font-mono ' + (best.ms === r.id ? 'font-bold text-emerald-300' : 'text-slate-200')}>{f(r.ms, 0)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="overflow-x-auto">
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">PSNR (dB) per scenario</p>
              <table className="w-full min-w-[720px] text-xs">
                <thead><tr className="text-[10px] text-slate-500"><th className="px-2 text-left">Method</th>{SCENARIOS.map((s) => <th key={s.id} className="px-2 text-right" title={s.label}>{s.id === 'f' ? 'real lines ⚠' : s.label.split(' (')[0].replace('Vertical + horizontal', 'V+H').replace('Periodic vertical lines', 'Periodic').replace('Strong vertical + heavy noise', 'Strong')}</th>)}</tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t border-slate-800"><td className="px-2 py-1 text-slate-300">{r.label}</td>
                      {SCENARIOS.map((s) => { const col = rows.map((q) => q.byScenario[s.id].psnr); const isBest = r.id !== 'raw' && r.byScenario[s.id].psnr === Math.max(...rows.filter((q) => q.id !== 'raw').map((q) => q.byScenario[s.id].psnr)); void col; return <td key={s.id} className={'px-2 py-1 text-right font-mono ' + (isBest ? 'font-bold text-emerald-300' : 'text-slate-200')}>{f(r.byScenario[s.id].psnr, 1)}</td>; })}</tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950/70 p-3 text-xs leading-relaxed text-slate-300">
              <b className="text-white">Reading this run:</b> best PSNR → <b className="text-emerald-300">{rows.find((r) => r.id === best.psnr)?.label}</b>; best SSIM → <b className="text-emerald-300">{rows.find((r) => r.id === best.ssim)?.label}</b>; fewest residual column stripes → {rows.find((r) => r.id === best.col)?.label}; fewest residual row stripes → {rows.find((r) => r.id === best.row)?.label}; best preserved thin structures → {rows.find((r) => r.id === best.thin)?.label}; fastest → {rows.find((r) => r.id === best.ms)?.label}.
              Compare the "real lines" column with the raw input row: any drop there is genuine detail being removed. Timings are JavaScript on the browser main thread and exclude display; they are not a 25 fps or FPGA result.
              <p className="mt-1 font-mono text-[10px] text-slate-500">{benchInfo}</p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

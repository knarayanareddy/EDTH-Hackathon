import { useEffect, useMemo, useState } from 'react';
import { CompareView } from './components/CompareView';
import { INFO, InstanceView } from './components/InstanceView';
import { Notes } from './components/Notes';
import { Btn } from './components/ui';
import { defaultCfg, type Cfg, type PVariant } from './lib/pipeline';
import { FrameSource, type SourceSpec } from './lib/source';
import { CORR_LABEL, PRESET_LABEL, type CorrKey, type Preset } from './lib/synth';

type Tab = 'A' | 'B' | 'C' | 'compare' | 'notes';

export default function App() {
  const [tab, setTab] = useState<Tab>('A');
  const [cfgs, setCfgs] = useState<Record<PVariant, Cfg>>({ O: defaultCfg('O'), A: defaultCfg('A'), B: defaultCfg('B'), C: defaultCfg('C') });
  const setCfgFor = (v: PVariant) => (fn: (c: Cfg) => Cfg) => setCfgs((p) => ({ ...p, [v]: fn(p[v]) }));

  // ---- shared data source (every instance sees exactly the same frames) ----
  const [kind, setKind] = useState<'synthetic' | 'file'>('synthetic');
  const [preset, setPreset] = useState<Preset>('horizon_pan');
  const [corr, setCorr] = useState<CorrKey>('vertical');
  const [full, setFull] = useState(false);
  const [stripeScale, setStripeScale] = useState(1);
  const [sigmaScale, setSigmaScale] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [endian, setEndian] = useState<'le' | 'be'>('le');
  const [half, setHalf] = useState(false);
  const [fileErr, setFileErr] = useState<string | null>(null);
  const [frameIdx, setFrameIdx] = useState(0);
  const [playing, setPlaying] = useState(false);

  const spec: SourceSpec = useMemo(() => (kind === 'file' && file ? { kind: 'file', file, endian, half } : { kind: 'synthetic', preset, corr, full, stripeScale, sigmaScale }), [kind, file, endian, half, preset, corr, full, stripeScale, sigmaScale]);
  const source = useMemo(() => new FrameSource(spec), [spec]);
  useEffect(() => { setFrameIdx(0); }, [source]);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => setFrameIdx((f) => (f + 1) % Math.max(1, source.total)), 110);
    return () => window.clearInterval(id);
  }, [playing, source]);

  const onFile = (f: File | undefined) => {
    if (!f) return;
    const e = FrameSource.validateFile(f);
    if (e) { setFileErr(e); return; }
    setFileErr(null); setFile(f); setKind('file'); setPlaying(false);
  };

  // Integration bridge for the local six-method comparison shell.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window.parent || event.data?.channel !== 'six-thermal-v1') return;
      const d = event.data;
      if (d.kind === 'select' && ['A','B','C','compare','notes'].includes(d.tab)) { setTab(d.tab); setPlaying(false); }
      if (d.kind === 'frame' && Number.isInteger(d.frame) && d.frame >= 0) { setFrameIdx(d.frame); setPlaying(false); }
      if (d.kind === 'file' && d.file instanceof File) { const ok = !FrameSource.validateFile(d.file); onFile(d.file); window.parent.postMessage({channel:'six-thermal-v1',kind:'loaded',engine:'claude',ok,fileName:d.file.name}, '*'); }
    };
    window.addEventListener('message', onMessage);
    window.parent.postMessage({channel:'six-thermal-v1',kind:'ready',engine:'claude'}, '*');
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const tabs: [Tab, string, string][] = [
    ['A', 'Instance A', 'Robust spatial'], ['B', 'Instance B', 'Multi-frame'], ['C', 'Instance C', 'Spectral + multi-scale'],
    ['compare', 'Compare & benchmark', 'which is best?'], ['notes', 'Findings & plan', 'review · CNN · FPGA gate'],
  ];
  const showSource = tab !== 'notes';
  const sel = 'rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100';

  return (
    <div className="min-h-screen bg-[#060c15] text-slate-100">
      <header className="border-b border-slate-800 bg-[#0c1725]">
        <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[.25em] text-cyan-300">Thermal image processing · three-way methodology comparison</p>
              <h1 className="mt-1 text-3xl font-black tracking-tight text-white">ClearHot Lab <span className="text-slate-500">×3</span></h1>
              <p className="mt-1 max-w-3xl text-sm text-slate-400">The existing ClearHot pipeline plus three independent technique packs for line / static suppression, picture enhancement and CNN training — each in its own instance so they can be compared on identical frames.</p>
            </div>
            <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1.5 text-xs font-semibold text-cyan-200">Local files · nothing is uploaded</span>
          </div>
          <nav aria-label="Sections" className="mt-4 flex flex-wrap gap-2">
            {tabs.map(([k, l, s]) => (
              <button key={k} aria-pressed={tab === k} onClick={() => setTab(k)} className={'rounded-xl border px-4 py-2 text-left transition ' + (tab === k ? 'border-cyan-300 bg-cyan-400/15 text-white' : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500')}>
                <span className={'block text-sm font-bold ' + (k === 'A' || k === 'B' || k === 'C' ? INFO[k].color : '')}>{l}</span><span className="block text-[10px] uppercase tracking-wider text-slate-500">{s}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6">
        <div role="note" className="mb-4 rounded-xl border border-amber-400/40 bg-amber-950/30 p-3 text-xs leading-relaxed text-amber-100">
          <strong>Experimental, not a validated FPGA ISP.</strong> Synthetic frames and every score derived from them are <b>simulated</b>. The challenge file was not available to this build; nothing here claims real-data accuracy, 25 fps, flicker-free output or FPGA readiness. CNNs exist only if you train them in this tab, on simulated data.
        </div>

        {showSource && (
          <section className="mb-5 rounded-2xl border border-slate-700 bg-slate-900/80 p-4" aria-label="Data source">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex rounded-lg border border-slate-700 p-0.5 text-xs font-bold">
                <button onClick={() => setKind('synthetic')} className={'rounded-md px-3 py-1.5 ' + (kind === 'synthetic' ? 'bg-cyan-500/25 text-white' : 'text-slate-400')}>Synthetic + truth</button>
                <button onClick={() => file && setKind('file')} disabled={!file} className={'rounded-md px-3 py-1.5 disabled:opacity-40 ' + (kind === 'file' ? 'bg-cyan-500/25 text-white' : 'text-slate-400')}>Your .bin file</button>
              </div>
              {kind === 'synthetic' ? (<>
                <label className="text-[11px] text-slate-400">Scene<select value={preset} onChange={(e) => setPreset(e.target.value as Preset)} className={'mt-0.5 block ' + sel}>{(Object.keys(PRESET_LABEL) as Preset[]).map((p) => <option key={p} value={p}>{PRESET_LABEL[p]}</option>)}</select></label>
                <label className="text-[11px] text-slate-400">Injected artefact<select value={corr} onChange={(e) => setCorr(e.target.value as CorrKey)} className={'mt-0.5 block ' + sel}>{(Object.keys(CORR_LABEL) as CorrKey[]).map((p) => <option key={p} value={p}>{CORR_LABEL[p]}</option>)}</select></label>
                <label className="text-[11px] text-slate-400">Stripe ×{stripeScale.toFixed(1)}<input type="range" min={0} max={3} step={0.1} value={stripeScale} onChange={(e) => setStripeScale(Number(e.target.value))} className="mt-1 block w-24 accent-cyan-400" /></label>
                <label className="text-[11px] text-slate-400">Noise ×{sigmaScale.toFixed(1)}<input type="range" min={0} max={3} step={0.1} value={sigmaScale} onChange={(e) => setSigmaScale(Number(e.target.value))} className="mt-1 block w-24 accent-cyan-400" /></label>
                <label className="flex items-center gap-1.5 pb-1.5 text-xs text-slate-300"><input type="checkbox" checked={full} onChange={(e) => setFull(e.target.checked)} className="accent-cyan-400" />640×512</label>
              </>) : (<>
                <span className="pb-1.5 text-xs text-slate-300">{file?.name} · {source.total} frames</span>
                <label className="text-[11px] text-slate-400">Byte order<select value={endian} onChange={(e) => setEndian(e.target.value as 'le' | 'be')} className={'mt-0.5 block ' + sel}><option value="le">little-endian</option><option value="be">big-endian</option></select></label>
                <label className="flex items-center gap-1.5 pb-1.5 text-xs text-slate-300"><input type="checkbox" checked={half} onChange={(e) => setHalf(e.target.checked)} className="accent-cyan-400" />decimate to 320×256 (faster)</label>
              </>)}
              <label className="cursor-pointer rounded-lg border border-cyan-400/50 bg-cyan-500/15 px-3 py-1.5 text-xs font-bold text-cyan-100 hover:bg-cyan-500/25">
                Load 640×512 uint16 .bin…<input type="file" accept=".bin,.raw" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
              </label>
            </div>
            {fileErr && <p role="alert" className="mt-2 text-xs text-rose-300">{fileErr}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Btn onClick={() => setPlaying((p) => !p)} tone={playing ? 'rose' : 'cyan'}>{playing ? 'Pause' : 'Play'}</Btn>
              <span className="font-mono text-xs text-slate-300">Frame {frameIdx + 1} / {source.total}</span>
              <input aria-label="Frame" type="range" min={0} max={Math.max(0, source.total - 1)} value={frameIdx} onChange={(e) => { setPlaying(false); setFrameIdx(Number(e.target.value)); }} className="min-w-40 flex-1 accent-cyan-400" />
              <span className="text-[11px] text-slate-500">{source.W}×{source.H} · assumed headerless little-endian uint16, low 14 bits (verify against the official spec). Pause on a frame for fair comparisons; playback is a preview, not a speed test.</span>
            </div>
          </section>
        )}

        {(tab === 'A' || tab === 'B' || tab === 'C') && <InstanceView key={tab} variant={tab} source={source} frameIdx={frameIdx} playing={playing} cfg={cfgs[tab]} setCfg={setCfgFor(tab)} />}
        {tab === 'compare' && <CompareView source={source} frameIdx={frameIdx} playing={playing} cfgs={cfgs} />}
        {tab === 'notes' && <Notes />}
      </main>
      <footer className="mt-10 border-t border-slate-800 px-4 py-5 text-center text-xs text-slate-500">ClearHot Lab ×3 · local-only research prototype · derived from the EDTH-Hackathon ClearHot Lab</footer>
    </div>
  );
}

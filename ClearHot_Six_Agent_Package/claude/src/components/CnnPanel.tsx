import { useEffect, useRef, useState } from 'react';
import { getCnn, KIND_LABEL, KIND_OF, loadSavedCnn, saveCnn, setCnn, subscribeCnn, trainCnn, type Progress, type Variant } from '../lib/cnn';
import type { Cfg } from '../lib/pipeline';
import { Btn, Card, LossChart, Slider, Toggle } from './ui';

const WHY: Record<Variant, string> = {
  A: 'Plain DnCNN-style residual network with a small 11×11 receptive field. Cheap and conventional, but it cannot see that a stripe is constant along the whole column, so it mostly acts as a denoiser / local corrector.',
  B: 'Operates only on the 1-D column / row residual profile (≈ 640 values), not the image. Tiny, FPGA-friendly (needs only line accumulators), cannot hallucinate 2-D texture, but cannot fix noise or anything that is not a line.',
  C: 'Stripe-shaped kernels (tall 15×1, wide 1×15) average along the stripe direction, with a small isotropic branch for noise. L1 + gradient-difference loss discourages blurring edges. Biggest receptive field along the artifact.',
};

export function CnnPanel({ variant, cfg, setCfg }: { variant: Variant; cfg: Cfg; setCfg: (f: (c: Cfg) => Cfg) => void }) {
  const [, force] = useState(0);
  const [steps, setSteps] = useState(variant === 'B' ? 400 : 300);
  const [batch, setBatch] = useState(variant === 'B' ? 16 : 8);
  const [lr, setLr] = useState(0.003);
  const [prog, setProg] = useState<Progress | null>(null);
  const [hist, setHist] = useState<{ loss: number[]; val: { step: number; v: number }[] }>({ loss: [], val: [] });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const stop = useRef(false);
  const m = getCnn(variant);

  useEffect(() => subscribeCnn(() => force((n) => n + 1)), []);
  useEffect(() => { if (!getCnn(variant)) loadSavedCnn(variant).then((s) => { if (s) setCnn(variant, s); }); }, [variant]);

  const train = async () => {
    setBusy(true); setErr(null); stop.current = false; setHist({ loss: [], val: [] });
    try {
      const t = await trainCnn(KIND_OF[variant], {
        steps, batch, lr, seed: 42 + variant.charCodeAt(0),
        onProgress: (p, h) => { setProg(p); setHist({ loss: h.loss.slice(), val: h.val.slice() }); },
        shouldStop: () => stop.current,
      });
      if (t.steps > 0) { setCnn(variant, t); await saveCnn(variant, t); setCfg((c) => ({ ...c, cnn: true })); }
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    setBusy(false);
  };

  const h = m && hist.loss.length === 0 ? { loss: m.loss, val: m.val } : hist;
  return (
    <Card kicker={`CNN exploration · instance ${variant}`} title={KIND_LABEL[KIND_OF[variant]]}>
      <p className="mb-3 text-[11px] leading-relaxed text-slate-400">{WHY[variant]}</p>
      <div className="mb-3 rounded-lg border border-amber-400/30 bg-amber-950/25 p-2 text-[11px] leading-snug text-amber-100">
        Trains in <b>this browser tab</b> (TensorFlow.js) on <b>simulated</b> stripes + noise added to <b>simulated</b> scenes. Validation uses different scene seeds than training; the benchmark uses a third set. It is a software demonstration, not a model validated on real sensor data.
      </div>
      <div className="grid grid-cols-3 gap-2">
        <label className="text-[11px] text-slate-400">Steps<input type="number" min={20} max={5000} value={steps} onChange={(e) => setSteps(Number(e.target.value))} className="mt-0.5 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white" /></label>
        <label className="text-[11px] text-slate-400">Batch<input type="number" min={2} max={64} value={batch} onChange={(e) => setBatch(Number(e.target.value))} className="mt-0.5 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white" /></label>
        <label className="text-[11px] text-slate-400">Learn rate<input type="number" step={0.0005} min={0.0001} max={0.02} value={lr} onChange={(e) => setLr(Number(e.target.value))} className="mt-0.5 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white" /></label>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Btn onClick={train} disabled={busy} tone="emerald">{busy ? 'Training…' : m ? 'Retrain from scratch' : 'Train CNN'}</Btn>
        {busy && <Btn onClick={() => { stop.current = true; }} tone="rose">Stop (keep current weights)</Btn>}
        {m && !busy && <Btn tone="slate" onClick={() => { setCnn(variant, undefined); setCfg((c) => ({ ...c, cnn: false })); setHist({ loss: [], val: [] }); }}>Discard model</Btn>}
      </div>
      {busy && prog && (
        <div className="mt-2">
          <div className="h-1.5 overflow-hidden rounded bg-slate-800"><div className="h-full bg-emerald-400" style={{ width: `${(100 * prog.step) / prog.steps}%` }} /></div>
          <p className="mt-1 font-mono text-[11px] text-slate-400">step {prog.step}/{prog.steps} · loss {prog.loss.toFixed(4)} · {prog.msPerStep.toFixed(0)} ms/step · backend {prog.backend}</p>
        </div>
      )}
      {err && <p role="alert" className="mt-2 text-xs text-rose-300">{err}</p>}
      <div className="mt-3"><LossChart loss={h.loss} val={h.val} /></div>
      {m ? (
        <div className="mt-3 space-y-3">
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 rounded-lg bg-slate-950/70 p-2 font-mono text-[11px] text-slate-300">
            <dt className="text-slate-500">parameters</dt><dd>{m.params.toLocaleString()}</dd>
            <dt className="text-slate-500">MACs / pixel (est.)</dt><dd>{m.macsPerPx.toLocaleString()}</dd>
            <dt className="text-slate-500">steps trained</dt><dd>{m.steps}</dd>
            <dt className="text-slate-500">train time</dt><dd>{m.trainSeconds.toFixed(1)} s ({m.backend})</dd>
            <dt className="text-slate-500">final val loss</dt><dd>{m.val.length ? m.val[m.val.length - 1].v.toFixed(4) : '—'}</dd>
          </dl>
          <Toggle label="Apply CNN in pipeline (after line correction)" checked={cfg.cnn} onChange={(v) => setCfg((c) => ({ ...c, cnn: v }))} hint="Disable to see exactly what the CNN changes. Hot cores (>5.9·100 ADU from median) are left untouched." />
          <Slider label="CNN correction strength" value={cfg.cnnStrength} min={0} max={1} step={0.05} onChange={(v) => setCfg((c) => ({ ...c, cnnStrength: v }))} fmt={(v) => v.toFixed(2)} />
          <p className="text-[11px] leading-snug text-slate-500">MACs/pixel × 640×512 × 25 fps is the raw arithmetic demand; it says nothing about FPGA feasibility until a device, precision and buffering are chosen.</p>
        </div>
      ) : <p className="mt-3 text-[11px] text-slate-500">No model yet. Nothing in this instance uses a CNN until you train (or reload a previously saved) one. Weights are stored locally in this browser (IndexedDB) only.</p>}
    </Card>
  );
}

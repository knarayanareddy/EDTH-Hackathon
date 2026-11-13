import { useEffect, useMemo, useRef, useState } from "react";
import { Btn, Callout, MockBadge, Panel, Pill, SectionTitle, Slider, Stat, Toggle } from "../components/ui";
import { DEFAULT_ISP, Isp, Scene, type Frames, type IspCfg } from "../sim/isp";

const SW = 320;
const SH = 256;
const RW = 640;
const RH = 512;

function paint(cv: HTMLCanvasElement | null, d: Uint8ClampedArray, w: number, h: number, img: { current: ImageData | null }) {
  if (!cv) return;
  const ctx = cv.getContext("2d")!;
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; img.current = null; }
  if (!img.current) img.current = ctx.createImageData(w, h);
  const px = img.current.data;
  for (let i = 0, j = 0; i < w * h; i++, j += 4) { const v = d[i]; px[j] = v; px[j + 1] = v; px[j + 2] = v; px[j + 3] = 255; }
  ctx.putImageData(img.current, 0, 0);
}

export default function ClearHot() {
  const [cfg, setCfg] = useState<IspCfg>(DEFAULT_ISP);
  const [flare, setFlare] = useState(true);
  const [play, setPlay] = useState(true);
  const [real, setReal] = useState<{ frames: Uint16Array[]; name: string } | null>(null);
  const [err, setErr] = useState("");
  const [fps, setFps] = useState({ ms: 0, naiveSD: 0, outSD: 0 });
  const cfgRef = useRef(cfg); cfgRef.current = cfg;
  const playRef = useRef(play); playRef.current = play;
  const flareRef = useRef(flare); flareRef.current = flare;
  const cN = useRef<HTMLCanvasElement>(null);
  const cO = useRef<HTMLCanvasElement>(null);
  const cT = useRef<HTMLCanvasElement>(null);
  const [W, H] = real ? [RW, RH] : [SW, SH];

  useEffect(() => {
    const scene = new Scene(W, H);
    const isp = new Isp(W, H);
    const raw = new Uint16Array(W * H);
    const fr: Frames = { naive: new Uint8ClampedArray(W * H), out: new Uint8ClampedArray(W * H) };
    const iN = { current: null as ImageData | null };
    const iO = { current: null as ImageData | null };
    const trN: number[] = [];
    const trO: number[] = [];
    let raf = 0, last = 0, fi = 0, msAvg = 0, k = 0;
    const roi = (img: Uint8ClampedArray) => {
      let s = 0, c = 0;
      const y0 = Math.floor(H * 0.78), y1 = Math.floor(H * 0.94), x0 = Math.floor(W * 0.35), x1 = Math.floor(W * 0.5);
      for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) { s += img[y * W + x]; c++; }
      return s / c;
    };
    const sd = (a: number[]) => { if (a.length < 5) return 0; const m = a.reduce((x, y) => x + y, 0) / a.length; return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length); };
    const tick = (ts: number) => {
      raf = requestAnimationFrame(tick);
      if (!playRef.current || ts - last < 40) return; // 25 fps
      last = ts;
      scene.flare = flareRef.current;
      if (real) { raw.set(real.frames[fi % real.frames.length]); fi++; } else scene.next(raw);
      const ms = isp.process(raw, cfgRef.current, fr);
      msAvg = msAvg * 0.9 + ms * 0.1;
      trN.push(roi(fr.naive)); trO.push(roi(fr.out));
      if (trN.length > 300) { trN.shift(); trO.shift(); }
      paint(cN.current, fr.naive, W, H, iN);
      paint(cO.current, fr.out, W, H, iO);
      const cv = cT.current;
      if (cv) {
        const g = cv.getContext("2d")!;
        g.fillStyle = "#020817"; g.fillRect(0, 0, cv.width, cv.height);
        g.strokeStyle = "#1e293b"; g.lineWidth = 1;
        for (let y = 0; y <= 255; y += 64) { g.beginPath(); g.moveTo(0, cv.height - (y / 255) * cv.height); g.lineTo(cv.width, cv.height - (y / 255) * cv.height); g.stroke(); }
        const line = (a: number[], col: string) => { g.strokeStyle = col; g.lineWidth = 1.6; g.beginPath(); a.forEach((v, i) => { const x = (i / 300) * cv.width, y = cv.height - (v / 255) * cv.height; i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke(); };
        line(trN, "#f59e0b"); line(trO, "#22d3ee");
      }
      if (++k % 10 === 0) setFps({ ms: msAvg, naiveSD: sd(trN), outSD: sd(trO) });
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [real, W, H]);

  const onFile = async (f: File | undefined) => {
    setErr("");
    if (!f) return;
    const fb = RW * RH * 2;
    if (f.size % fb !== 0) { setErr(`File size ${f.size} is not a multiple of ${fb} bytes (640×512×2). Is it the right file?`); return; }
    const n = Math.min(f.size / fb, 150);
    const buf = await f.slice(0, n * fb).arrayBuffer();
    const all = new Uint16Array(buf);
    const frames: Uint16Array[] = [];
    for (let i = 0; i < n; i++) frames.push(all.subarray(i * RW * RH, (i + 1) * RW * RH));
    let mx = 0;
    for (let i = 0; i < all.length; i += 997) mx = Math.max(mx, all[i]);
    if (mx > 16383) { setErr(`Max sample ${mx} > 16383: not 14-bit little-endian uint16?`); return; }
    setReal({ frames, name: `${f.name} · ${f.size / fb} frames total, first ${n} loaded` });
  };

  const mem = useMemo(() => {
    const L = (lines: number, bytesPer: number) => lines * W * bytesPer;
    const rows = [
      { stage: "Bad-pixel (4-neighbour)", note: "3 line buffers × 16 bit", bytes: L(3, 2) },
      { stage: "Column-FPN removal", note: "1×W accumulator + running sum, 16 bit", bytes: L(1, 2) * 2 },
      { stage: "Temporal filter", note: "ONE frame store, 14 bit packed", bytes: Math.ceil((W * H * 14) / 8) },
      { stage: "AGC histogram + LUT", note: "1024 × (19-bit hist ×2 banks + 8-bit LUT ×2)", bytes: 1024 * 4 * 2 + 1024 * 2 },
      { stage: "Detail (9×9 box, separable)", note: "8 line buffers × 8 bit + 1 for base", bytes: L(9, 1) },
    ];
    return { rows, total: rows.reduce((a, r) => a + r.bytes, 0) };
  }, [W, H]);
  const kB = (b: number) => (b >= 1024 ? `${(b / 1024).toFixed(1)} kB` : `${b} B`);

  return (
    <div className="space-y-5">
      <SectionTitle kicker="Concept B · Thermal ISP, improved" title="CLEARHOT – stable, contrasty, no ghosts, and measured">
        The jury compares video by eye, so the pipeline is built around the four named defects – <b>flicker, lost scene, ghosting, new artifacts</b> – and gives you a live flicker trace
        so you stop judging stability by squinting. This engine actually runs in your browser, on synthetic frames or on your real 640×512 .bin.
      </SectionTitle>
      <div className="flex flex-wrap items-center gap-2">
        {real ? <Pill tone="green">REAL DATA: {real.name}</Pill> : <MockBadge>Synthetic 14-bit scene: FPN, noise, drift, bad pixels, moving targets, 1.3 % hot flare</MockBadge>}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Panel title="Naive: per-frame min/max → 8-bit" kicker="Baseline" className="p-3">
              <canvas ref={cN} width={W} height={H} className="w-full rounded bg-black [image-rendering:pixelated]" style={{ aspectRatio: `${W}/${H}` }} />
            </Panel>
            <Panel title="ClearHot pipeline" kicker="Output" className="p-3" right={<Pill tone="cyan">{fps.ms.toFixed(1)} ms/frame @ {W}×{H}</Pill>}>
              <canvas ref={cO} width={W} height={H} className="w-full rounded bg-black [image-rendering:pixelated]" style={{ aspectRatio: `${W}/${H}` }} />
            </Panel>
          </div>

          <Panel title="Flicker trace – mean brightness of a fixed background patch" kicker="Evidence, not opinion" right={<div className="flex gap-3 text-[11px]"><span className="text-amber-300">■ naive σ={fps.naiveSD.toFixed(1)}</span><span className="text-cyan-300">■ pipeline σ={fps.outSD.toFixed(1)}</span></div>}>
            <canvas ref={cT} width={900} height={110} className="w-full rounded" />
            <p className="mt-1 text-[11px] text-slate-500">The patch is static scenery. Any movement of the line is the AGC pumping, not the scene. Watch the amber line when the flare appears or the sensor drifts. σ in grey levels (0–255), last 300 frames.</p>
          </Panel>

          <Panel title="Defect → stage → what it changes → what it must not break" kicker="Reasoning (the jury's tiebreaker)">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="py-1 pr-3">Defect</th><th className="pr-3">Stage</th><th className="pr-3">Change</th><th>Guard</th></tr></thead>
                <tbody className="divide-y divide-slate-800 align-top text-slate-300">
                  {[
                    ["Salt-and-pepper dead/hot pixels", "Bad-pixel replace", "Outliers beyond the 4-neighbour range by > T become the neighbour mean", "Only isolated pixels: real small hot targets are ≥ 2 px"],
                    ["Residual vertical stripes after NUC", "Column-FPN, temporal", "Per-column offset from (pixel − local row mean), clamped, averaged over time, subtracted", "Clamp ±40 + slow time constant: scene edges don't burn in"],
                    ["Grainy flat areas", "Motion-adaptive recursive filter", "out = prev + k·(cur − prev), k = max(k₀, |Δ|/T)", "Large |Δ| → k = 1 → no trails behind movers (ghosting)"],
                    ["Flicker & pumping", "Plateau-HE AGC on a fixed 1024-bin axis, LUT smoothed in time", "One tone curve, moved slowly; histogram of frame N is applied to N+1", "Fixed axis + plateau clip: a hot object adds clipped mass only"],
                    ["Lost scene (one hot object flattens the rest)", "Plateau clip + p98 linear anchor", "Hot pixels get few output levels; background keeps the range", "Linear anchor uses p98, so a ~1 % object cannot stretch it"],
                    ["Flat, soft detail", "Base/detail with edge-aware gain", "Detail = tone − 9×9 box; gain falls as 1/(1+(|d|/14)²)", "Gain roll-off on strong edges = no halos; no plastic look"],
                  ].map((r) => (<tr key={r[0]}>{r.map((c, i) => <td key={i} className={i === 0 ? "py-2 pr-3 font-medium text-slate-100" : "py-2 pr-3"}>{c}</td>)}</tr>))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Pipeline" kicker="Toggle a stage to see what it fixes">
            <div className="space-y-1">
              <Toggle label="1 · Bad-pixel replace" checked={cfg.bad} onChange={(v) => setCfg({ ...cfg, bad: v })} />
              <Toggle label="2 · Column-FPN removal" checked={cfg.stripe} onChange={(v) => setCfg({ ...cfg, stripe: v })} />
              <Toggle label="3 · Motion-adaptive temporal" checked={cfg.temporal} onChange={(v) => setCfg({ ...cfg, temporal: v })} />
              <Toggle label="4 · Plateau-HE AGC, smoothed LUT" checked={cfg.plateau} onChange={(v) => setCfg({ ...cfg, plateau: v })} hint="Off = per-frame min/max like the baseline" />
            </div>
            <div className="mt-3 space-y-3">
              <Slider label="5 · Detail gain" value={cfg.detail} min={0} max={2} step={0.05} onChange={(v) => setCfg({ ...cfg, detail: v })} hint="Push it up to see halos/plastic appear" />
              <Slider label="Static-area temporal weight k₀" value={cfg.tstr} min={0.05} max={0.8} step={0.05} onChange={(v) => setCfg({ ...cfg, tstr: v })} hint="Lower = cleaner, but slower to follow slow change" />
              <Slider label="Plateau clip (× mean bin)" value={cfg.plat} min={1} max={8} step={0.25} onChange={(v) => setCfg({ ...cfg, plat: v })} />
              <Slider label="Blend with linear" value={cfg.lin} min={0} max={1} step={0.05} onChange={(v) => setCfg({ ...cfg, lin: v })} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Btn onClick={() => setPlay(!play)} tone={play ? "amber" : "green"}>{play ? "Pause" : "Play"}</Btn>
              <Btn onClick={() => setCfg(DEFAULT_ISP)} tone="slate">Defaults</Btn>
              <Btn onClick={() => setCfg({ ...cfg, bad: false, stripe: false, temporal: false, plateau: false, detail: 0 })} tone="red">All off</Btn>
            </div>
            <div className="mt-2"><Toggle label="Hot flare in scene" checked={flare} onChange={setFlare} hint="The 'lost scene' stress test" /></div>
          </Panel>

          <Panel title="Your real data" kicker="Thermal challenge file">
            <label className="block cursor-pointer rounded-lg border border-dashed border-slate-600 bg-slate-950/60 p-3 text-center text-xs text-slate-400 hover:border-cyan-500/60">
              Load the .bin (640×512, uint16 LE, no header)
              <input type="file" accept=".bin" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            </label>
            {err && <p className="mt-2 text-xs text-rose-300">{err}</p>}
            {real && <div className="mt-2"><Btn onClick={() => setReal(null)} tone="slate">Back to synthetic</Btn></div>}
            <p className="mt-2 text-[11px] leading-relaxed text-slate-500">Everything stays in your browser. Frame count = file size ÷ 655 360 B. Only the first 150 frames are read to keep memory small. This is the fastest way to find out what really stands in the way of a good image on <i>their</i> data.</p>
          </Panel>

          <Panel title="Resource note (computed for current size)" kicker="Streaming claim, quantified">
            <table className="w-full text-xs">
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {mem.rows.map((r) => (<tr key={r.stage}><td className="py-1 pr-2"><div className="text-slate-100">{r.stage}</div><div className="text-[10px] text-slate-500">{r.note}</div></td><td className="text-right font-mono">{kB(r.bytes)}</td></tr>))}
                <tr className="font-semibold text-white"><td className="py-1.5">Total state</td><td className="text-right font-mono text-cyan-300">{kB(mem.total)}</td></tr>
              </tbody>
            </table>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Stat label="Speed (this browser)" value={`${fps.ms.toFixed(1)} ms`} sub={fps.ms < 40 ? "within 40 ms budget" : "over 25 fps budget"} tone={fps.ms < 40 ? "green" : "amber"} />
              <Stat label="Frame stores" value="1" sub="temporal only" tone="cyan" />
            </div>
          </Panel>
        </div>
      </div>

      <Callout tone="amber" title="Correcting an over-claim in the original draft">
        The first draft said a 573 kB frame store is "trivial even for a small FPGA". It is not: the smallest Artix-class parts have roughly 225 kB of block RAM, a Zynq-7020 about 630 kB. The honest
        story is: line buffers (≈ 15 kB total) fit anywhere; the single temporal frame store needs either a bigger part, a reduced-precision state (e.g. 10-bit), or the external DDR that SoC boards have anyway.
        Also, this JavaScript runs whole-frame passes: it is a <i>reference model</i> whose every stage has a bounded vertical support (≤ 9 lines), which is what makes a line-by-line port possible – it is not itself an FPGA design.
      </Callout>
    </div>
  );
}

import { useMemo, useState } from "react";
import { Slider, Toggle, Stat, Callout } from "../components/ui";

const DEVICES = [
  { name: "Artix-7 35T (≈1.8 Mb BRAM)", mb: 1.8 },
  { name: "Zynq-7020 (≈4.9 Mb BRAM)", mb: 4.86 },
  { name: "Zynq UltraScale+ ZU3EG (≈7.6 Mb BRAM)", mb: 7.6 },
];

export default function ResourceCalc() {
  const [w, setW] = useState(640);
  const [h, setH] = useState(512);
  const [bits, setBits] = useState(14);
  const [fps, setFps] = useState(25);
  const [on, setOn] = useState({ stripe: true, temporal: true, agc: true, detail: true });
  const [tBits, setTBits] = useState(14);
  const [dev, setDev] = useState(1);

  const rows = useMemo(() => {
    const r: { name: string; mb: number; note: string; latency: string }[] = [];
    if (on.stripe) r.push({ name: "Column stripe estimate", mb: (w * 16) / 1e6, note: `${w}-entry offset vector + 11-pixel horizontal window (shift register). No line buffer.`, latency: "~6 px" });
    if (on.temporal) r.push({ name: "Temporal denoise", mb: (w * h * tBits) / 1e6, note: `1 frame buffer at ${tBits} bit. The dominant cost. Reduce by storing fewer bits or tiling.`, latency: "0 lines" });
    if (on.agc) r.push({ name: "Histogram + plateau LUT", mb: (256 * 20 + 2 * 256 * 8 + 256 * 16) / 1e6, note: "256 bins × 20 b, double-buffered 256×8 LUT, smoothed LUT 256×16 b. Histogram of frame N applied to N+1.", latency: "1 frame" });
    if (on.detail) r.push({ name: "Detail enhancement (5×5)", mb: (4 * w * 8) / 1e6, note: "4 line buffers × 8 bit after AGC. Separable box blur + clamp.", latency: "2 lines" });
    return r;
  }, [w, h, bits, on, tBits]);
  const total = rows.reduce((s, r) => s + r.mb, 0);
  const raw = (w * h * bits) / 1e6;
  const mpx = (w * h * fps) / 1e6;
  const fits = total <= DEVICES[dev].mb * 0.8;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
      <div className="space-y-3">
        <Slider label="Width" value={w} min={320} max={1280} step={32} onChange={setW} />
        <Slider label="Height" value={h} min={256} max={1024} step={32} onChange={setH} />
        <Slider label="Raw bit depth" value={bits} min={10} max={16} onChange={setBits} />
        <Slider label="Temporal buffer bit depth" value={tBits} min={8} max={16} onChange={setTBits} />
        <Slider label="Frame rate" value={fps} min={9} max={60} unit=" fps" onChange={setFps} />
        <Toggle label="Stripe removal" on={on.stripe} onChange={(v) => setOn({ ...on, stripe: v })} />
        <Toggle label="Temporal denoise" on={on.temporal} onChange={(v) => setOn({ ...on, temporal: v })} />
        <Toggle label="AGC (plateau HE + smoothed LUT)" on={on.agc} onChange={(v) => setOn({ ...on, agc: v })} />
        <Toggle label="Detail enhancement" on={on.detail} onChange={(v) => setOn({ ...on, detail: v })} />
        <label className="block text-xs text-slate-400">Target device
          <select value={dev} onChange={(e) => setDev(+e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-200">{DEVICES.map((d, i) => <option key={d.name} value={i}>{d.name}</option>)}</select>
        </label>
      </div>
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Pixel rate" value={`${mpx.toFixed(1)} Mpx/s`} tone="cyan" sub="visible pixels only" />
          <Stat label="One raw frame" value={`${raw.toFixed(2)} Mb`} sub={`${(raw / 8 * 1000).toFixed(0)} kB`} />
          <Stat label="On-chip total" value={`${total.toFixed(2)} Mb`} tone={fits ? "green" : "red"} />
        </div>
        <div className="overflow-hidden rounded-lg border border-white/10">
          {rows.map((r) => (
            <div key={r.name} className="border-b border-white/5 px-3 py-2 last:border-0">
              <div className="flex items-center justify-between text-xs"><span className="font-semibold text-slate-100">{r.name}</span><span className="font-mono text-slate-300">{r.mb.toFixed(3)} Mb · latency {r.latency}</span></div>
              <div className="mt-1 h-1.5 rounded bg-white/10"><div className="h-1.5 rounded bg-amber-400" style={{ width: `${Math.min(100, (r.mb / Math.max(0.001, total)) * 100)}%` }} /></div>
              <div className="mt-1 text-[11px] text-slate-500">{r.note}</div>
            </div>
          ))}
        </div>
        <Callout tone={fits ? "green" : "amber"}>
          {fits ? `Fits in ${DEVICES[dev].name.split(" (")[0]} block RAM with ~20% margin.` : `Does not fit on-chip in ${DEVICES[dev].name.split(" (")[0]} (80% budget). Say so: use external DDR for the temporal buffer, or reduce its depth/resolution.`}
          {" "}Bandwidth for the DDR option ≈ {(2 * w * h * tBits * fps / 8 / 1e6).toFixed(0)} MB/s (read + write). Figures are first-order estimates for discussion, not synthesis results.
        </Callout>
      </div>
    </div>
  );
}

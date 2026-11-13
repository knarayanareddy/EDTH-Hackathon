import { useMemo, useState } from "react";
import { Slider, Toggle, Stat, Pill, Callout } from "../components/ui";

type Cls = "tanker" | "cargo" | "ferry" | "fishing" | "sailing";
interface Vessel {
  id: string;
  cls: Cls;
  x: number;
  y: number;
  sog: number;
  div: number; // heading vs COG divergence (deg)
  dwell: number; // minutes over corridor
  tort: number; // 0 straight .. 1 looping
  laneDev: number; // km off nominal lane
  gap: number; // AIS gap in minutes
  cross: number; // crossing angle vs cable (deg)
  truth: string;
}

const CABLE: [[number, number], [number, number]] = [
  [72, 43],
  [28, 12],
];
const BASE: [number, number] = [82, 42];
const ANCH = { x1: 46, y1: 27, x2: 56, y2: 33 };
const TRAWL = { x1: 32, y1: 19, x2: 44, y2: 29 };
const NORM: Record<Cls, number> = { tanker: 11.5, cargo: 11, ferry: 15, fishing: 3.5, sailing: 5 };

const FLEET: Vessel[] = [
  { id: "V01", cls: "tanker", x: 59, y: 34, sog: 11.8, div: 1, dwell: 6, tort: 0.02, laneDev: 0.2, gap: 0, cross: 55, truth: "Normal transit" },
  { id: "V02", cls: "tanker", x: 45, y: 24.3, sog: 9.4, div: 13, dwell: 38, tort: 0.05, laneDev: 4.5, gap: 0, cross: 70, truth: "Anchor-drag analogue (fast: speed gate misses it)" },
  { id: "V03", cls: "cargo", x: 60, y: 34.4, sog: 4.6, div: 18, dwell: 52, tort: 0.08, laneDev: 3.1, gap: 12, cross: 80, truth: "Anchor-drag analogue (slow)" },
  { id: "V04", cls: "cargo", x: 51, y: 29.5, sog: 0.8, div: 40, dwell: 600, tort: 0.6, laneDev: 6, gap: 0, cross: 0, truth: "Waiting at anchorage" },
  { id: "V05", cls: "cargo", x: 53, y: 31, sog: 0.6, div: 55, dwell: 540, tort: 0.6, laneDev: 6, gap: 0, cross: 0, truth: "Waiting at anchorage" },
  { id: "V06", cls: "tanker", x: 48, y: 28.6, sog: 1.1, div: 35, dwell: 420, tort: 0.5, laneDev: 6, gap: 0, cross: 0, truth: "Waiting at anchorage" },
  { id: "V07", cls: "fishing", x: 36, y: 21.8, sog: 3.4, div: 8, dwell: 140, tort: 0.8, laneDev: 5, gap: 0, cross: 60, truth: "Trawling" },
  { id: "V08", cls: "fishing", x: 40, y: 22.4, sog: 3.1, div: 9, dwell: 120, tort: 0.75, laneDev: 5, gap: 0, cross: 65, truth: "Trawling" },
  { id: "V09", cls: "ferry", x: 66, y: 38.6, sog: 6.2, div: 2, dwell: 4, tort: 0.02, laneDev: 0.3, gap: 0, cross: 20, truth: "Ferry decelerating into port" },
  { id: "V10", cls: "cargo", x: 57.6, y: 33.6, sog: 6.5, div: 2, dwell: 9, tort: 0.03, laneDev: 0.3, gap: 0, cross: 55, truth: "Slow steaming for fuel" },
  { id: "V11", cls: "sailing", x: 40.5, y: 21, sog: 1.8, div: 60, dwell: 70, tort: 0.5, laneDev: 4, gap: 0, cross: 40, truth: "Weather drift" },
  { id: "V12", cls: "cargo", x: 47, y: 25.2, sog: 5.2, div: 9, dwell: 30, tort: 0.06, laneDev: 3.8, gap: 25, cross: 65, truth: "Ambiguous: AIS went quiet over the corridor" },
  { id: "V13", cls: "tanker", x: 20, y: 42, sog: 12, div: 1, dwell: 0, tort: 0.01, laneDev: 0.1, gap: 0, cross: 0, truth: "Normal transit (off corridor)" },
  { id: "V14", cls: "cargo", x: 84, y: 22, sog: 11, div: 2, dwell: 0, tort: 0.01, laneDev: 0.2, gap: 0, cross: 0, truth: "Normal transit (off corridor)" },
];

function distToCable(x: number, y: number) {
  const [[ax, ay], [bx, by]] = CABLE;
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
}
const inRect = (v: Vessel, r: typeof ANCH) => v.x >= r.x1 && v.x <= r.x2 && v.y >= r.y1 && v.y <= r.y2;

const COLORS: Record<Cls, string> = { tanker: "#f59e0b", cargo: "#94a3b8", ferry: "#22d3ee", fishing: "#34d399", sailing: "#c084fc" };

export default function Mantavia() {
  const [mode, setMode] = useState<"speed" | "context">("context");
  const [thr, setThr] = useState(4);
  const [f, setF] = useState({ norm: true, cross: true, div: true, dev: true, dwell: true, gap: true, supp: true });
  const [station, setStation] = useState(4);
  const [sel, setSel] = useState<string>("V02");

  const rows = useMemo(() => {
    return FLEET.map((v) => {
      const corridor = distToCable(v.x, v.y) <= 2.5;
      const anch = inRect(v, ANCH);
      const trawl = inRect(v, TRAWL);
      const parts: { label: string; v: number }[] = [];
      const norm = f.norm ? NORM[v.cls] : 11;
      const deficit = Math.max(0, 1 - v.sog / norm);
      if (f.norm || true) parts.push({ label: `speed ${v.sog} kn vs ${norm} kn typical${f.norm ? ` for ${v.cls}` : ""}`, v: 2 * deficit });
      if (f.cross && v.cross >= 45 && v.sog > 2) parts.push({ label: `crosses cable at ${v.cross}°`, v: 1.5 });
      if (f.div && v.div >= 10 && v.sog > 2) parts.push({ label: `heading/COG differ by ${v.div}°`, v: 1.5 });
      if (f.dev && v.laneDev >= 2) parts.push({ label: `${v.laneDev} km off normal lane`, v: 1.5 });
      if (f.dwell && v.dwell >= 25 && v.sog > 2) parts.push({ label: `${v.dwell} min over corridor`, v: 1.5 });
      if (f.gap && v.gap > 10) parts.push({ label: `AIS gap ${v.gap} min`, v: 1.0 });
      if (f.supp) {
        if (anch && v.sog < 1.5) parts.push({ label: "inside anchorage and effectively stationary", v: -4 });
        if (trawl && v.cls === "fishing" && v.tort > 0.5) parts.push({ label: "fishing vessel on trawl ground with looping track", v: -4 });
        if (v.cls === "ferry") parts.push({ label: "ferry on scheduled route", v: -3 });
        if (v.sog < 2.5 && v.div > 45 && !anch) parts.push({ label: "low speed + swinging heading = weather drift", v: -2 });
        if (v.tort > 0.4 && !trawl && !anch) parts.push({ label: "looping track, unlike a drag", v: -1.5 });
      }
      const ctxScore = parts.reduce((s, p) => s + p.v, 0);
      const speedAlert = corridor && v.sog <= 8 && v.sog >= 0.5;
      const ctxAlert = corridor && ctxScore >= thr;
      const alert = mode === "speed" ? speedAlert : ctxAlert;
      const score = mode === "speed" ? 1 + (8 - v.sog) / 8 : ctxScore;
      return { v, corridor, parts, ctxScore, speedAlert, ctxAlert, alert, score };
    });
  }, [f, thr, mode]);

  const alerts = rows.filter((r) => r.alert);
  const truePos = alerts.filter((r) => r.v.truth.startsWith("Anchor-drag")).length;
  const missed = rows.filter((r) => r.v.truth.startsWith("Anchor-drag") && !r.alert).length;

  // ISR plan
  const plan = useMemo(() => {
    const speed = 1.5; // km/min at 25 m/s
    const budget = 60;
    let pos: [number, number] = BASE;
    let t = 0;
    const order: { id: string; eta: number; leg: number }[] = [];
    const left = [...alerts];
    const pts: [number, number][] = [BASE];
    while (left.length) {
      let best = -1;
      let bestVal = -Infinity;
      left.forEach((c, i) => {
        const trav = Math.hypot(c.v.x - pos[0], c.v.y - pos[1]) / speed;
        const back = Math.hypot(c.v.x - BASE[0], c.v.y - BASE[1]) / speed;
        if (t + trav + station + back > budget) return;
        const val = Math.max(0.1, c.score) / (trav + station);
        if (val > bestVal) {
          bestVal = val;
          best = i;
        }
      });
      if (best < 0) break;
      const c = left.splice(best, 1)[0];
      const trav = Math.hypot(c.v.x - pos[0], c.v.y - pos[1]) / speed;
      t += trav + station;
      order.push({ id: c.v.id, eta: t - station, leg: trav });
      pos = [c.v.x, c.v.y];
      pts.push(pos);
    }
    const back = Math.hypot(pos[0] - BASE[0], pos[1] - BASE[1]) / speed;
    pts.push(BASE);
    return { order, used: t + back, pts, dropped: alerts.length - order.length };
  }, [alerts, station]);

  const sr = rows.find((r) => r.v.id === sel)!;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-white/10 p-0.5 text-xs">
          {(["speed", "context"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} className={`rounded-md px-3 py-1.5 transition ${mode === m ? "bg-amber-400 text-slate-950" : "text-slate-300 hover:bg-white/5"}`}>
              {m === "speed" ? "Speed-only rule (≤ 8 kn in corridor)" : "Contextual rule"}
            </button>
          ))}
        </div>
        <Pill tone="slate">synthetic traffic - illustration only</Pill>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <div>
          <svg viewBox="0 0 100 60" className="w-full rounded-lg border border-white/10 bg-[#0a1620]">
            <path d="M0 0 H62 L44 7 L24 12 L0 19 Z" fill="#1f2a30" />
            <path d="M70 40 L78 35 L90 37 L95 46 L87 53 L74 51 Z" fill="#1f2a30" />
            <text x="3" y="6" fontSize="2.2" fill="#64748b">SWEDEN</text>
            <text x="76" y="46" fontSize="2.2" fill="#64748b">BORNHOLM</text>
            <path d="M0 40 L100 30" stroke="#38bdf8" strokeOpacity="0.12" strokeWidth="5" />
            <text x="2" y="39" fontSize="1.8" fill="#38bdf8" fillOpacity="0.5">shipping lane</text>
            <rect x={ANCH.x1} y={ANCH.y1} width={ANCH.x2 - ANCH.x1} height={ANCH.y2 - ANCH.y1} fill="#a78bfa" fillOpacity="0.1" stroke="#a78bfa" strokeOpacity="0.5" strokeDasharray="1 1" strokeWidth="0.25" />
            <text x={ANCH.x1 + 0.5} y={ANCH.y2 + 2} fontSize="1.8" fill="#c4b5fd">anchorage</text>
            <rect x={TRAWL.x1} y={TRAWL.y1} width={TRAWL.x2 - TRAWL.x1} height={TRAWL.y2 - TRAWL.y1} fill="#34d399" fillOpacity="0.07" stroke="#34d399" strokeOpacity="0.4" strokeDasharray="1 1" strokeWidth="0.25" />
            <text x={TRAWL.x1 + 0.5} y={TRAWL.y1 - 0.8} fontSize="1.8" fill="#6ee7b7">trawl ground</text>
            <line x1={CABLE[0][0]} y1={CABLE[0][1]} x2={CABLE[1][0]} y2={CABLE[1][1]} stroke="#fb7185" strokeOpacity="0.25" strokeWidth="5" strokeLinecap="round" />
            <line x1={CABLE[0][0]} y1={CABLE[0][1]} x2={CABLE[1][0]} y2={CABLE[1][1]} stroke="#fb7185" strokeWidth="0.4" strokeDasharray="1.2 0.8" />
            <polyline points={plan.pts.map((p) => p.join(",")).join(" ")} fill="none" stroke="#fbbf24" strokeWidth="0.4" strokeDasharray="1 0.8" />
            <rect x={BASE[0] - 1} y={BASE[1] - 1} width="2" height="2" fill="#fbbf24" />
            <text x={BASE[0] + 1.6} y={BASE[1] + 0.6} fontSize="1.8" fill="#fbbf24">ISR base</text>
            {rows.map((r) => (
              <g key={r.v.id} onClick={() => setSel(r.v.id)} className="cursor-pointer">
                {r.alert && <circle cx={r.v.x} cy={r.v.y} r="2.2" fill="none" stroke="#f43f5e" strokeWidth="0.45" />}
                {sel === r.v.id && <circle cx={r.v.x} cy={r.v.y} r="3.2" fill="none" stroke="white" strokeOpacity="0.6" strokeWidth="0.2" />}
                <circle cx={r.v.x} cy={r.v.y} r="1" fill={COLORS[r.v.cls]} />
                <text x={r.v.x + 1.4} y={r.v.y - 1.2} fontSize="1.6" fill="#cbd5e1">{r.v.id}</text>
              </g>
            ))}
          </svg>
          <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-slate-400">
            {Object.entries(COLORS).map(([k, c]) => (
              <span key={k} className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: c }} />{k}</span>
            ))}
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full border border-rose-500" />alert</span>
            <span className="text-amber-300">- - ISR route</span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Alerts" value={alerts.length} tone={alerts.length > 4 ? "red" : "green"} sub="this snapshot" />
            <Stat label="Real drags caught" value={`${truePos}/2`} tone={truePos === 2 ? "green" : "amber"} />
            <Stat label="Missed" value={missed} tone={missed ? "red" : "green"} />
          </div>
          <div className="rounded-lg border border-white/10 bg-black/20 p-3">
            <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-slate-100">
              {sr.v.id} · {sr.v.cls}
              <Pill tone={sr.alert ? "red" : "slate"}>{sr.alert ? "alert" : "no alert"}</Pill>
            </div>
            <div className="mb-2 text-[11px] text-slate-500">Ground truth in this toy set: <span className="text-slate-300">{sr.v.truth}</span></div>
            {mode === "speed" ? (
              <div className="text-xs text-slate-400">Speed-only reason: {sr.corridor ? `${sr.v.sog} kn inside the corridor` : "outside corridor"}. No context, so it cannot say why this one matters.</div>
            ) : (
              <>
                {sr.parts.map((p, i) => (
                  <div key={i} className="flex justify-between gap-2 text-xs">
                    <span className={p.v < 0 ? "text-emerald-300" : "text-slate-300"}>{p.label}</span>
                    <span className="font-mono text-slate-400">{p.v > 0 ? "+" : ""}{p.v.toFixed(1)}</span>
                  </div>
                ))}
                <div className="mt-1 flex justify-between border-t border-white/10 pt-1 text-xs font-semibold text-slate-100">
                  <span>score (threshold {thr})</span>
                  <span className="font-mono">{sr.ctxScore.toFixed(1)}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {mode === "context" && (
        <div className="grid gap-3 lg:grid-cols-3">
          <div className="space-y-2">
            <div className="font-mono text-[10px] uppercase tracking-widest text-slate-500">Evidence features</div>
            <Toggle label="Class-aware speed norm" on={f.norm} onChange={(v) => setF({ ...f, norm: v })} hint="Off: one speed norm for all classes" />
            <Toggle label="Cable crossing angle" on={f.cross} onChange={(v) => setF({ ...f, cross: v })} />
            <Toggle label="Heading vs COG divergence" on={f.div} onChange={(v) => setF({ ...f, div: v })} hint="A dragged anchor makes a ship crab" />
          </div>
          <div className="space-y-2">
            <div className="font-mono text-[10px] uppercase tracking-widest text-slate-500">&nbsp;</div>
            <Toggle label="Lane deviation" on={f.dev} onChange={(v) => setF({ ...f, dev: v })} />
            <Toggle label="Dwell over corridor" on={f.dwell} onChange={(v) => setF({ ...f, dwell: v })} />
            <Toggle label="AIS gap as evidence" on={f.gap} onChange={(v) => setF({ ...f, gap: v })} />
          </div>
          <div className="space-y-3">
            <Toggle label="Innocent-pattern suppression" on={f.supp} onChange={(v) => setF({ ...f, supp: v })} hint="Anchorage, trawling, ferry, weather drift" />
            <Slider label="Alert threshold" value={thr} min={1} max={8} step={0.5} onChange={setThr} />
          </div>
        </div>
      )}

      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-100">ISR cueing: one asset, 60 min at 25 m/s (90 km of flight)</div>
            <div className="text-xs text-slate-500">Greedy value-per-minute with a hard return-to-base check. Vessels are treated as static here; a real planner must predict motion.</div>
          </div>
          <div className="w-56"><Slider label="Time on station" value={station} min={1} max={12} unit=" min" onChange={setStation} /></div>
        </div>
        <div className="grid gap-4 md:grid-cols-[1fr_220px]">
          <div className="space-y-1">
            {plan.order.length === 0 && <div className="text-xs text-slate-500">No alerts to cue.</div>}
            {plan.order.map((o, i) => (
              <div key={o.id} className="flex items-center gap-3 rounded border border-white/10 bg-black/20 px-3 py-1.5 text-xs">
                <span className="font-mono text-amber-300">#{i + 1}</span>
                <span className="font-semibold text-slate-100">{o.id}</span>
                <span className="text-slate-400">leg {o.leg.toFixed(1)} min · arrive T+{o.eta.toFixed(0)} min</span>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <Stat label="Endurance used" value={`${plan.used.toFixed(0)} / 60 min`} tone={plan.used > 55 ? "amber" : "cyan"} />
            {plan.dropped > 0 && <Callout tone="amber">{plan.dropped} alert(s) cannot be reached and returned within endurance. Say so explicitly to the operator.</Callout>}
          </div>
        </div>
      </div>
    </div>
  );
}

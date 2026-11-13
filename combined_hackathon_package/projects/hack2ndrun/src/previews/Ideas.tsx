import { useEffect, useRef, useState } from "react";
import { Slider, Toggle, Pill, Panel, Callout, Bullets, Btn } from "../components/ui";

/* ---------- Trust Rail ---------- */
function TrustRail() {
  const [age, setAge] = useState(8);
  const [ready, setReady] = useState(true);
  const [cov, setCov] = useState(true);
  const state = !ready ? "offline" : age > 45 ? "stale" : age > 15 ? "ageing" : "fresh";
  const tone = { fresh: "green", ageing: "amber", stale: "red", offline: "red" }[state] as "green" | "amber" | "red";
  const wind = 9;
  const use = state === "fresh" ? "Used as-is in task planning." : state === "ageing" ? "Used, but safety limits are derated 15% and the badge stays visible." : state === "stale" ? "Not used silently. Planner switches to conservative defaults and asks for a human confirmation once." : "No data. Planner uses defaults and says so.";
  return (
    <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
      <div className="space-y-3">
        <Slider label="Feed age" value={age} min={0} max={90} unit=" min" onChange={setAge} />
        <Toggle label="Feed ready (heartbeat OK)" on={ready} onChange={setReady} />
        <Toggle label="Position inside feed coverage" on={cov} onChange={setCov} hint="Out of coverage ≠ calm" />
      </div>
      <div className="space-y-3">
        <div className="rounded-lg border border-white/10 bg-black/20 p-3" style={{ opacity: state === "fresh" ? 1 : state === "ageing" ? 0.85 : 0.55 }}>
          <div className="flex items-center justify-between"><span className="text-sm font-semibold text-slate-100">Wind at site · OSINT</span><Pill tone={tone}>{state}</Pill></div>
          <div className="mt-1 flex items-end gap-2"><span className={`text-3xl font-semibold tabular-nums ${state === "stale" || state === "offline" ? "text-slate-500 line-through decoration-rose-400" : "text-white"}`}>{wind} m/s</span><span className="pb-1 text-xs text-slate-500">from 240°</span></div>
          <div className="mt-2 grid grid-cols-3 gap-2 font-mono text-[10px] text-slate-500"><span>source: station KNMI-like</span><span>age {age} min</span><span>{cov ? "in coverage" : "OUT of coverage"}</span></div>
          <div className="mt-2 h-1.5 rounded bg-white/10"><div className={`h-1.5 rounded ${state === "fresh" ? "bg-emerald-400" : state === "ageing" ? "bg-amber-400" : "bg-rose-400"}`} style={{ width: `${Math.max(4, 100 - (age / 90) * 100)}%` }} /></div>
        </div>
        <Callout tone={tone === "green" ? "green" : tone === "amber" ? "amber" : "red"}>{use}{!cov ? " Location is outside the station's coverage, so the reading is treated as unrepresentative." : ""}</Callout>
      </div>
    </div>
  );
}

/* ---------- Misclick-proof controls ---------- */
function Misclick() {
  const [p, setP] = useState(0);
  const [phase, setPhase] = useState<"idle" | "holding" | "undo" | "sent">("idle");
  const [left, setLeft] = useState(5);
  const timer = useRef<number | null>(null);
  const [target] = useState("V02 · tanker · 45.0E 24.3N");
  useEffect(() => {
    if (phase === "holding") {
      timer.current = window.setInterval(() => setP((x) => Math.min(100, x + 5)), 60);
      return () => { if (timer.current) clearInterval(timer.current); };
    }
  }, [phase]);
  useEffect(() => { if (p >= 100 && phase === "holding") { setPhase("undo"); setLeft(5); } }, [p, phase]);
  useEffect(() => {
    if (phase === "undo") {
      const i = setInterval(() => setLeft((l) => { if (l <= 1) { setPhase("sent"); return 0; } return l - 1; }), 1000);
      return () => clearInterval(i);
    }
  }, [phase]);
  const start = () => { if (phase === "idle") { setP(0); setPhase("holding"); } };
  const stop = () => { if (phase === "holding") { setPhase("idle"); setP(0); } };
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-3">
        <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-xs"><div className="text-slate-500">Selected target (shown on the button itself)</div><div className="font-mono text-slate-100">{target}</div><div className="mt-1 text-slate-400">Effect preview: ISR drone leaves base now, arrives T+9 min, 31 of 60 min endurance used.</div></div>
        <button onMouseDown={start} onMouseUp={stop} onMouseLeave={stop} onTouchStart={start} onTouchEnd={stop} disabled={phase === "undo" || phase === "sent"} className="relative w-full select-none overflow-hidden rounded-lg border border-amber-400/50 bg-amber-400/10 px-4 py-4 text-left disabled:opacity-50">
          <span className="absolute inset-y-0 left-0 bg-amber-400/30 transition-[width]" style={{ width: `${p}%` }} />
          <span className="relative block text-sm font-semibold text-amber-100">{phase === "holding" ? "Keep holding…" : "Hold to dispatch ISR"}</span>
          <span className="relative block text-[11px] text-amber-200/70">A click or brush does nothing. Release cancels.</span>
        </button>
      </div>
      <div className="space-y-3">
        {phase === "undo" && (<div className="rounded-lg border border-amber-400/40 bg-amber-400/10 p-3 text-sm text-amber-100">Dispatching in {left}s <Btn tone="amber" className="ml-2" onClick={() => { setPhase("idle"); setP(0); }}>Undo</Btn></div>)}
        {phase === "sent" && (<div className="rounded-lg border border-emerald-400/40 bg-emerald-400/10 p-3 text-sm text-emerald-100">Dispatched. Can still be recalled from the task list (recall = one hold).<div className="mt-2"><Btn onClick={() => { setPhase("idle"); setP(0); }}>Reset demo</Btn></div></div>)}
        <Bullets items={["Irreversible actions need a deliberate gesture, reversible ones need one tap.", "The button names the object it will act on and the consequence in resources.", "A short undo window beats a confirmation dialog people click through under stress.", "After the fact: recall must be as easy as dispatch."]} tone="cyan" />
      </div>
    </div>
  );
}

/* ---------- Ghost track ---------- */
function Ghost() {
  const [t, setT] = useState(20);
  const [v, setV] = useState(8);
  const [road, setRoad] = useState(true);
  const roads: [number, number][][] = [
    [[50, 50], [30, 38], [16, 20]],
    [[50, 50], [68, 40], [90, 36]],
    [[50, 50], [52, 28], [60, 6]],
  ];
  const sc = 0.25; // px per m on a 100 unit view => 1 unit = 4 m
  const dist = v * t / 4; // in units
  const rU = Math.min(60, dist);
  const poly = (pts: [number, number][], d: number) => {
    const out: [number, number][] = [pts[0]];
    let rem = d;
    for (let i = 0; i < pts.length - 1; i++) {
      const L = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
      if (rem <= L) { out.push([pts[i][0] + ((pts[i + 1][0] - pts[i][0]) * rem) / L, pts[i][1] + ((pts[i + 1][1] - pts[i][1]) * rem) / L]); return out; }
      out.push(pts[i + 1]); rem -= L;
    }
    return out;
  };
  const discArea = Math.PI * (v * t) ** 2;
  const roadLen = roads.reduce((s, r) => { let L = 0; for (let i = 0; i < r.length - 1; i++) L += Math.hypot(r[i + 1][0] - r[i][0], r[i + 1][1] - r[i][1]); return s + Math.min(L * 4, v * t); }, 0);
  const roadArea = roadLen * 40;
  void sc;
  return (
    <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
      <svg viewBox="0 0 100 60" className="w-full rounded-lg border border-white/10 bg-[#0c1218]">
        {roads.map((r, i) => (<polyline key={i} points={r.map((p) => p.join(",")).join(" ")} fill="none" stroke="#475569" strokeWidth="1.2" />))}
        {!road && <circle cx="50" cy="50" r={rU} fill="#f43f5e" fillOpacity="0.12" stroke="#f43f5e" strokeDasharray="1.5 1" strokeWidth="0.3" />}
        {road && roads.map((r, i) => (<polyline key={i} points={poly(r, dist).map((p) => p.join(",")).join(" ")} fill="none" stroke="#f43f5e" strokeOpacity="0.55" strokeWidth="2.4" strokeLinecap="round" />))}
        <circle cx="50" cy="50" r="1.5" fill="#fbbf24" />
        <text x="53" y="53" fontSize="2.3" fill="#fde68a">last seen · {t}s ago</text>
      </svg>
      <div className="space-y-3">
        <Slider label="Time since target left the video" value={t} min={0} max={120} unit=" s" onChange={setT} />
        <Slider label="Assumed max speed" value={v} min={2} max={25} unit=" m/s" onChange={setV} />
        <Toggle label="Constrain to road network" on={road} onChange={setRoad} hint="Off: uncertainty is a growing disc" />
        <Callout tone="cyan">Search region ≈ <b>{road ? `${(roadArea / 1e4).toFixed(1)} ha` : `${(discArea / 1e4).toFixed(1)} ha`}</b>. {road ? `That is ${Math.max(1, Math.round(discArea / Math.max(1, roadArea)))}× smaller than the unconstrained disc, with an honest statement of the assumption.` : "The honest default when nothing else is known."}</Callout>
      </div>
    </div>
  );
}

/* ---------- Overhead window ---------- */
function Overhead() {
  const [now, setNow] = useState(40);
  const passes = [
    { sat: "EO-sat A (illustrative)", s: 25, d: 6, tone: "#f59e0b" },
    { sat: "SAR-sat B (illustrative)", s: 78, d: 8, tone: "#22d3ee" },
    { sat: "EO-sat C (illustrative)", s: 140, d: 5, tone: "#f59e0b" },
    { sat: "SAR-sat B (illustrative)", s: 250, d: 8, tone: "#22d3ee" },
  ];
  const next = passes.find((p) => p.s + p.d > now);
  const inWin = next && next.s <= now;
  return (
    <div className="space-y-3">
      <svg viewBox="0 0 400 90" className="w-full rounded-lg border border-white/10 bg-black/20">
        {passes.map((p, i) => (<g key={i}><rect x={20 + (p.s / 300) * 360} y={14 + (i % 2) * 28} width={(p.d / 300) * 360 + 3} height="20" rx="3" fill={p.tone} fillOpacity="0.6" /><text x={24 + (p.s / 300) * 360} y={28 + (i % 2) * 28} fontSize="8" fill="#0f172a">{p.sat.split(" ")[0]}</text></g>))}
        <line x1={20 + (now / 300) * 360} x2={20 + (now / 300) * 360} y1="4" y2="80" stroke="white" strokeWidth="1.2" />
        <text x="20" y="88" fontSize="8" fill="#64748b">next 5 h →</text>
      </svg>
      <Slider label="Now (minutes from start)" value={now} min={0} max={300} onChange={setNow} />
      {next && (<Callout tone={inWin ? "red" : "amber"}>{inWin ? `Overhead now: ${next.sat}. Suggest halting emitters / moving under cover for ${Math.max(0, next.s + next.d - now)} more min.` : `Next overhead: ${next.sat} in ${next.s - now} min (window ${next.d} min).`}</Callout>)}
      <div className="text-[11px] text-slate-500">All passes above are made-up. A real build would pull public orbital elements (e.g. CelesTrak GP data) and propagate with SGP4 (satellite.js / Skyfield). The "readiness" story is the age of those elements: stale TLEs drift by km per day, so display it.</div>
    </div>
  );
}

const IDEAS: { id: string; tag: string; title: string; why: string; how: string; judge: string; risk: string; node?: React.ReactNode }[] = [
  { id: "trust", tag: "Nexus · cross-cutting", title: "Trust Rail: every number carries its age, source and readiness", why: "The Nexus brief literally says judges look at 'staleness and readiness of the integrated OSINT and its effect on the application'. Most teams will show a pretty feed. Few will show what the system does when it goes bad.", how: "A tiny wrapper around any Nexus data source/map item adding {source, observedAt, coverage, ready}. Visuals degrade (opacity, strike-through, badge), and downstream logic changes behaviour visibly (derate, ask once, fall back).", judge: "Trust & explainability, alarm fatigue (ask once, not repeatedly), operational relevance.", risk: "Needs the extension API to let you attach metadata to map items; if not, render it in your own panel.", node: <TrustRail /> },
  { id: "misclick", tag: "UI/UX under stress", title: "Misclick-proof controls", why: "'What happens after a misclick under stress?' is an explicit judging question. A hold-to-confirm + undo pattern is cheap to build and instantly demonstrable.", how: "Hold gesture for irreversible actions, effect preview in resources, undo window, symmetric recall. Log every operator action.", judge: "UI/UX, demo quality (judges can try it).", risk: "Low. Make sure it also works with gloves/touch and not only mouse.", node: <Misclick /> },
  { id: "ghost", tag: "Nexus problem 2 add-on", title: "Ghost track: honest uncertainty after the target leaves the video", why: "The brief mentions 'a target that appears in video for only a few seconds'. A pin that stays frozen where it was last seen is a silent lie.", how: "Predict forward from last geolocation with a speed prior; inflate the region over time; constrain to roads/terrain when available. Show the assumption, hand off to the operator when the region is too large to be useful.", judge: "Operational relevance, trust, error estimate that holds up.", risk: "Needs road/terrain data; fall back to a disc.", node: <Ghost /> },
  { id: "overhead", tag: "Nexus problem 3 (OSINT)", title: "Overhead window: when can satellites see us?", why: "A concrete answer to 'argue why the integration is useful to operators': emission control and movement timing against known imaging passes. Live satellite constellations are one of the brief's own examples.", how: "Public orbital elements → SGP4 propagation → pass windows over the operating area → map layer + countdown. Show element age and its effect on timing uncertainty.", judge: "Argument for usefulness, staleness/readiness, simple clear UI.", risk: "Only public catalogued satellites; don't claim to know classified assets. Pass prediction is an approximation.", node: <Overhead /> },
  { id: "decoy", tag: "Nexus · counter-UAS", title: "Decoy or drone? Triage for a mixed swarm", why: "The brief names 'a swarm mixed with decoys'. Operators can't engage everything; the useful output is a short ranked list with reasons, not 40 tracks.", how: "Simulate tracks (SITL) with kinematic features (speed variance, climb profile, formation, heading toward the asset). Score 'likelihood of real threat', cluster formations, and show uncertainty. Interrupt only when a track crosses a threat threshold toward a protected zone.", judge: "Alarm fatigue, explainability, operational relevance.", risk: "Without real data, your 'decoy' model is your assumption. Say so and show sensitivity." },
  { id: "bridge", tag: "Combo", title: "Cable Watch → Nexus ISR cueing", why: "Mantavia asks for an ISR cueing decision; Nexus is an ISR C2. Showing an episode become a proposed drone task with approval is a natural bridge.", how: "Run the AIS detector as a Python Nexus extension that publishes episodes as map items and proposes ISR tasks the operator approves. Do this only after the Mantavia requirements (real incident, weekly burden, spot check) are met.", judge: "Demo quality; fits Mantavia 'cue an asset'.", risk: "Two stacks to integrate; keep the detector standalone as the primary deliverable." },
  { id: "dark", tag: "Mantavia add-on", title: "Dark-vessel and AIS-gap watcher", why: "Several publicly reported cases involve vessels with AIS off or intermittent. Gaps over a corridor are evidence in themselves (and a data limitation).", how: "Detect gaps by expected reporting interval per class; mark 'unobserved interval' on tracks; estimate the reachable region during the gap. Report both 'behaviour' and 'blind time' per episode.", judge: "Honest evaluation: shows what you could not see.", risk: "Gaps are often coverage artefacts; compare with receiver coverage." },
  { id: "isp", tag: "Cross-challenge", title: "Thermal ISP as a Nexus video-processing extension", why: "Nexus lists 'video processing' as an extension type. A good ISP is a visible improvement on operators' screens, and it satisfies two briefs with one asset.", how: "Wrap the ISP pipeline as a stream processor in front of the drone video; show before/after toggle in the operator UI.", judge: "Demo quality; but ensure the Thermal challenge deliverables are met first.", risk: "Needs thermal-like input in the SITL; only worth it if you have the pipeline done." },
];

export default function Ideas() {
  return (
    <div className="space-y-6">
      <Callout tone="amber" title="My ranking of these for the Nexus challenge">
        1) Trust Rail + Misclick-proof controls on top of Problem 2, 2) Ghost track as the demo 'wow', 3) Overhead window if you want a simple OSINT argument. The others are strong but target other challenges.
      </Callout>
      {IDEAS.map((i) => (
        <Panel key={i.id} title={i.title} kicker={i.tag}>
          <div className="grid gap-4 lg:grid-cols-3">
            <div><div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-slate-500">Why it matters</div><p className="text-sm leading-relaxed text-slate-300">{i.why}</p></div>
            <div><div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-slate-500">How it works</div><p className="text-sm leading-relaxed text-slate-300">{i.how}</p></div>
            <div><div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-slate-500">Judges / risk</div><p className="text-sm leading-relaxed text-slate-300"><span className="text-emerald-300">{i.judge}</span> <span className="text-slate-500">Risk: {i.risk}</span></p></div>
          </div>
          {i.node && <div className="mt-4 border-t border-white/10 pt-4">{i.node}</div>}
        </Panel>
      ))}
    </div>
  );
}

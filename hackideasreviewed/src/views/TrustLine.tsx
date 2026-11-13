import { useEffect, useMemo, useRef, useState } from "react";
import { Bar, Btn, Callout, HoldButton, MockBadge, Panel, Pill, SectionTitle, Slider, Stat, Toggle, type Tone } from "../components/ui";
import { IMG_H, IMG_W, SOURCES, backproject, coverage, estimate, project, realityDraw, sigmasFrom, type Inputs, type Pose } from "../sim/geo";
import { cn } from "../utils/cn";

const TARGETS: { id: string; name: string; at: [number, number] }[] = [
  { id: "T1", name: "Truck (90 m)", at: [10, 90] },
  { id: "T2", name: "Car (180 m)", at: [20, 180] },
  { id: "T3", name: "Van (320 m)", at: [30, 320] },
];
const inEll = (dx: number, dy: number, a: number, b: number, angDeg: number) => {
  const t = (angDeg * Math.PI) / 180;
  const p1 = dx * Math.cos(t) + dy * Math.sin(t), p2 = -dx * Math.sin(t) + dy * Math.cos(t);
  return (p1 * p1) / (a * a) + (p2 * p2) / (b * b) <= 1;
};

type LogE = { k: "action" | "interrupt" | "quiet"; text: string };
type Fit = "strike" | "second" | "cue";
const FIT: Record<Fit, { label: string; tone: Tone; rank: number }> = {
  strike: { label: "STRIKE-QUALITY", tone: "green", rank: 2 },
  second: { label: "NEEDS SECOND LOOK", tone: "amber", rank: 1 },
  cue: { label: "CUE ONLY", tone: "red", rank: 0 },
};

export default function TrustLine() {
  const [alt, setAlt] = useState(120);
  const [pitch, setPitch] = useState(35);
  const [fov, setFov] = useState(60);
  const [inputs, setInputs] = useState<Inputs>({ telemetryAge: 0.4, gnssLevel: 0, gnssLayerAgeMin: 12, dem: false });
  const [req, setReq] = useState(25);
  const [inflate, setInflate] = useState(true);
  const [sel, setSel] = useState<number | null>(1);
  const [free, setFree] = useState<[number, number] | null>(null);
  const [seed, setSeed] = useState(1);
  const [tally, setTally] = useState({ inside: 0, n: 0 });
  const [cov, setCov] = useState<ReturnType<typeof coverage>>(null);
  const [cand, setCand] = useState<"none" | "candidate" | "promoted">("candidate");
  const [lost, setLost] = useState(0);
  const [vmax, setVmax] = useState(8);
  const [log, setLog] = useState<LogE[]>([]);
  const prevFit = useRef<Fit | null>(null);
  const prevA = useRef(0);
  const suppressed = useRef(0);
  const interrupts = useRef(0);

  const nom: Pose = useMemo(() => ({ h: alt, pitch, hdg: 0, roll: 0, fov, gx: 0, gy: 0, terr: 0 }), [alt, pitch, fov]);
  const sg = useMemo(() => sigmasFrom(inputs), [inputs]);
  const T = sel !== null ? TARGETS[sel].at : null;
  const infl = inflate ? 1.35 : 1;

  // the operator's click
  const reality = useMemo(() => (T ? realityDraw(T, nom, sg.s, seed * 101 + 7, true) : null), [T, nom, sg, seed]);
  const click: [number, number] | null = T ? reality?.px ?? null : free;
  const est = useMemo(() => (click ? estimate(click[0], click[1], nom, sg.s) : null), [click, nom, sg]);
  const a95 = est ? est.ell.a * infl : 0;
  const fit: Fit | null = est ? (a95 <= req ? "strike" : a95 <= req * 3 ? "second" : "cue") : null;

  // what-if variants (the "what would fix it" list)
  const a95For = (n: Pose, i: Inputs): number | null => {
    if (!T) return null;
    const px = project(T, n);
    if (!px) return null;
    const e = estimate(px[0], px[1], n, sigmasFrom(i).s, 260, false);
    return e ? e.ell.a * infl : null;
  };
  const fixes = useMemo(() => {
    if (!T || !est) return [];
    const out: { text: string; to: number }[] = [];
    if (inputs.telemetryAge > 0.5) { const v = a95For(nom, { ...inputs, telemetryAge: 0.2 }); if (v !== null) out.push({ text: "Telemetry fresh (≤ 0.2 s)", to: v }); }
    if (!inputs.dem) { const v = a95For(nom, { ...inputs, dem: true }); if (v !== null) out.push({ text: "Load DEM tile", to: v }); }
    if (pitch < 70) { const v = a95For({ ...nom, pitch: pitch + 15 }, inputs); if (v !== null) out.push({ text: `Steepen gimbal to ${pitch + 15}°`, to: v }); }
    if (inputs.gnssLevel > 0 || sg.stale) { const v = a95For(nom, { ...inputs, gnssLevel: 0, gnssLayerAgeMin: 0 }); if (v !== null) out.push({ text: "Clean GNSS (or fresh layer says so)", to: v }); }
    return out.filter((f) => f.to < a95 - 1).sort((a, b) => a.to - b.to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [T, est, inputs, nom, pitch, infl, sg.stale]);

  const idealFor = (k: "tel" | "gnss" | "dem") => {
    if (!T) return 0;
    const i2: Inputs = k === "tel" ? { ...inputs, telemetryAge: 0 } : k === "gnss" ? { ...inputs, gnssLevel: 0, gnssLayerAgeMin: 0 } : { ...inputs, dem: true };
    const v = a95For(nom, i2);
    return v === null ? 0 : Math.max(0, a95 - v);
  };
  const effects = useMemo(() => ({ tel: idealFor("tel"), gnss: idealFor("gnss"), dem: idealFor("dem") }), // eslint-disable-line react-hooks/exhaustive-deps
    [T, est, inputs, nom, infl]);

  // notification budget: only a downward state change interrupts
  useEffect(() => {
    if (!fit || cand === "none") { prevFit.current = fit; prevA.current = a95; return; }
    const pf = prevFit.current;
    if (pf && pf !== fit) {
      if (FIT[fit].rank < FIT[pf].rank) { interrupts.current++; setLog((l): LogE[] => [{ k: "interrupt" as const, text: `INTERRUPT – candidate dropped to ${FIT[fit].label} (95% error ${a95.toFixed(0)} m > ${fit === "second" ? req : req * 3} m)` }, ...l].slice(0, 7)); }
      else setLog((l): LogE[] => [{ k: "quiet" as const, text: `quiet – improved to ${FIT[fit].label}, no alert` }, ...l].slice(0, 7));
    } else if (prevA.current && Math.abs(a95 - prevA.current) / prevA.current > 0.1) suppressed.current++;
    prevFit.current = fit; prevA.current = a95;
  }, [fit, a95, cand, req]);

  const reroll = () => {
    if (T && est) {
      const r = realityDraw(T, nom, sg.s, seed * 101 + 7, true);
      if (r) setTally((t) => ({ inside: t.inside + (inEll(T[0] - r.est[0], T[1] - r.est[1], est.ell.a * infl, est.ell.b * infl, est.ell.angDeg) ? 1 : 0), n: t.n + 1 }));
    }
    setSeed((s) => s + 1);
  };

  const pushLog = (text: string) => setLog((l): LogE[] => [{ k: "action" as const, text }, ...l].slice(0, 7));
  const fpPoly = useMemo(() => {
    const c: [number, number][] = [[0, 0], [IMG_W, 0], [IMG_W, IMG_H], [0, IMG_H]];
    return c.map(([u, v]) => backproject(u, v, nom) ?? [((u - IMG_W / 2) / IMG_W) * 1200, 650] as [number, number]);
  }, [nom]);
  const horizonV = IMG_H / 2 - (IMG_W / 2 / Math.tan((fov * Math.PI) / 360)) * Math.tan((pitch * Math.PI) / 180);

  const ghostR = est ? a95 + vmax * lost : 0;
  const lostState = lost === 0 ? null : ghostR > 150 ? "hand-off" : ghostR > 60 ? "wide" : "narrow";

  return (
    <div className="space-y-5">
      <SectionTitle kicker="Concept C · Nexus Problem 2 + 3, improved" title="TRUSTLINE – a click that tells you how much to trust it, right now">
        Every number carries its error, its age and its source. Degrade an input (stale telemetry, GNSS interference from an OSINT layer, no terrain model) and the ellipse grows, the handoff state falls,
        and the operator is interrupted <b>once</b> – only when the decision changes. The ellipse is validated against a simulated world with errors it does not model.
      </SectionTitle>
      <div className="flex flex-wrap items-center gap-2">
        <MockBadge>Simulated drone, camera, targets &amp; sensor errors · pure maths library, SDK wrapper pending mentors</MockBadge>
        <Pill tone="slate">Assumed from Nexus: pose + gimbal + timestamp per frame (verify day 1)</Pill>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Drone video (simulated)" kicker="Click a vehicle – creates a candidate, never a target" right={<Pill tone="slate">{alt} m AGL · {pitch}° down · {fov}° FOV</Pill>}>
          <svg viewBox={`0 0 ${IMG_W} ${IMG_H}`} className="w-full cursor-crosshair rounded-lg" style={{ aspectRatio: `${IMG_W}/${IMG_H}` }}
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              const u = ((e.clientX - r.left) / r.width) * IMG_W, v = ((e.clientY - r.top) / r.height) * IMG_H;
              let best = -1, bd = 36;
              TARGETS.forEach((t, i) => { const p = project(t.at, nom); if (p) { const d = Math.hypot(p[0] - u, p[1] - v); if (d < bd) { bd = d; best = i; } } });
              if (best >= 0) { setSel(best); setFree(null); } else { setSel(null); setFree([u, v]); }
              setCand("candidate"); setLost(0); prevFit.current = null;
              pushLog(best >= 0 ? `click → CANDIDATE on ${TARGETS[best].name} (nothing published)` : "click → CANDIDATE on ground point (no truth known)");
            }}>
            <defs>
              <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1e293b" /><stop offset="1" stopColor="#334155" /></linearGradient>
              <linearGradient id="gnd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3f4a3a" /><stop offset="1" stopColor="#252e22" /></linearGradient>
            </defs>
            <rect width={IMG_W} height={IMG_H} fill="url(#gnd)" />
            <rect width={IMG_W} height={Math.max(0, Math.min(IMG_H, horizonV))} fill="url(#sky)" />
            {[-3, -2, -1, 0, 1, 2, 3].map((i) => <line key={i} x1={IMG_W / 2 + i * 12} y1={Math.max(horizonV, 0)} x2={IMG_W / 2 + i * 180} y2={IMG_H} stroke="#52525b" strokeOpacity={0.35} />)}
            {TARGETS.map((t, i) => {
              const p = project(t.at, nom);
              if (!p || p[0] < 0 || p[0] > IMG_W || p[1] < 0 || p[1] > IMG_H) return null;
              const sc = Math.max(0.5, 24 / (1 + Math.hypot(t.at[0], t.at[1]) / 60));
              return (
                <g key={t.id}>
                  <rect x={p[0] - sc} y={p[1] - sc * 0.55} width={sc * 2} height={sc * 1.1} fill="#a3a3a3" stroke={sel === i ? "#22d3ee" : "#171717"} strokeWidth={1.5} rx={2} />
                  <text x={p[0]} y={p[1] - sc * 0.55 - 4} fontSize={11} fill="#e2e8f0" textAnchor="middle">{t.id}</text>
                </g>
              );
            })}
            {click && (
              <g>
                <circle cx={click[0]} cy={click[1]} r={11} fill="none" stroke={cand === "promoted" ? "#34d399" : "#fbbf24"} strokeWidth={2} strokeDasharray={cand === "promoted" ? "" : "4 3"} />
                <line x1={click[0] - 16} x2={click[0] + 16} y1={click[1]} y2={click[1]} stroke="#fbbf24" strokeWidth={1} />
                <line y1={click[1] - 16} y2={click[1] + 16} x1={click[0]} x2={click[0]} stroke="#fbbf24" strokeWidth={1} />
              </g>
            )}
            <rect x={6} y={6} width={186} height={22} rx={4} fill="#000" fillOpacity={0.55} />
            <text x={12} y={21} fontSize={11} fill="#fbbf24">{cand === "none" ? "no candidate" : cand === "candidate" ? "CANDIDATE – not published" : "PROMOTED – published to Nexus"}</text>
          </svg>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <Slider label="Altitude AGL" value={alt} min={40} max={300} step={5} unit=" m" onChange={setAlt} />
            <Slider label="Gimbal pitch" value={pitch} min={12} max={85} unit="°" onChange={setPitch} hint="↓ shallow = long, thin ellipse" />
            <Slider label="FOV" value={fov} min={35} max={90} unit="°" onChange={setFov} />
          </div>
        </Panel>

        <Panel title="Map – estimate, truth, and honest uncertainty" kicker="Top-down, drone at origin facing north" right={<Pill tone="cyan">truth = simulation only</Pill>}>
          <svg viewBox="-180 -380 360 420" className="w-full rounded-lg bg-[#06121f]" style={{ aspectRatio: "360/420" }}>
            {[-100, 0, 100].map((x) => <line key={"gx" + x} x1={x} x2={x} y1={-380} y2={40} stroke="#1e293b" strokeWidth={0.5} />)}
            {[0, 100, 200, 300].map((y) => <g key={"gy" + y}><line x1={-180} x2={180} y1={-y} y2={-y} stroke="#1e293b" strokeWidth={0.5} /><text x={-176} y={-y - 3} fontSize={9} fill="#475569">{y} m</text></g>)}
            <polygon points={fpPoly.map(([x, y]) => `${x},${-y}`).join(" ")} fill="#22d3ee" fillOpacity={0.06} stroke="#22d3ee" strokeOpacity={0.4} strokeDasharray="4 3" />
            <polygon points="0,-8 6,6 0,2 -6,6" fill="#34d399" transform="rotate(0)" />
            {TARGETS.map((t, i) => <g key={t.id}><circle cx={t.at[0]} cy={-t.at[1]} r={3} fill={sel === i ? "#fff" : "#64748b"} /><text x={t.at[0] + 6} y={-t.at[1] + 3} fontSize={9} fill="#94a3b8">{t.id}</text></g>)}
            {est && fit && (
              <g>
                <ellipse cx={est.est[0]} cy={-est.est[1]} rx={est.ell.a * infl} ry={est.ell.b * infl} transform={`rotate(${-est.ell.angDeg} ${est.est[0]} ${-est.est[1]})`} fill={fit === "strike" ? "#10b981" : fit === "second" ? "#f59e0b" : "#f43f5e"} fillOpacity={0.18} stroke={fit === "strike" ? "#34d399" : fit === "second" ? "#fbbf24" : "#fb7185"} strokeWidth={1.4} strokeDasharray={cand === "promoted" ? "" : "5 3"} />
                <circle cx={est.est[0]} cy={-est.est[1]} r={2.5} fill="#22d3ee" />
                {lost > 0 && <circle cx={est.est[0]} cy={-est.est[1]} r={ghostR} fill="none" stroke="#a78bfa" strokeWidth={1.2} strokeDasharray="2 3" />}
              </g>
            )}
            {T && <circle cx={T[0]} cy={-T[1]} r={5} fill="none" stroke="#fff" strokeWidth={1} />}
          </svg>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
            <span><span className="text-cyan-300">●</span> estimate</span><span><span className="text-white">○</span> simulated truth</span><span><span className="text-violet-300">┄</span> ghost region after target leaves view</span>
            <span className="ml-auto flex items-center gap-2">
              <Btn onClick={reroll} tone="slate">Re-roll sensor errors</Btn>
              <Pill tone={tally.n ? (tally.inside / tally.n >= 0.9 ? "green" : "amber") : "slate"}>truth inside: {tally.inside}/{tally.n}</Pill>
            </span>
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Trust rail – inputs with age and effect" kicker="Every input shows how it is moving the ellipse">
          <div className="space-y-3 text-xs">
            <div>
              <div className="flex items-center justify-between"><span className="font-medium text-slate-100">Telemetry (MAVLink)</span><Pill tone={inputs.telemetryAge < 0.8 ? "green" : inputs.telemetryAge < 2 ? "amber" : "red"}>{inputs.telemetryAge.toFixed(1)} s old</Pill></div>
              <Slider label="Age" value={inputs.telemetryAge} min={0} max={5} step={0.1} unit=" s" onChange={(v) => setInputs({ ...inputs, telemetryAge: v })} />
              <div className="text-[11px] text-slate-500">at 15 m/s the drone moved {(inputs.telemetryAge * 15).toFixed(0)} m since this pose · costs ≈ +{effects.tel.toFixed(0)} m</div>
            </div>
            <div>
              <div className="flex items-center justify-between"><span className="font-medium text-slate-100">GNSS-interference layer (OSINT)</span><Pill tone={sg.stale ? "red" : inputs.gnssLevel === 0 ? "green" : "amber"}>{sg.stale ? "STALE – assumed degraded" : ["clean", "mild", "degraded", "severe"][inputs.gnssLevel]}</Pill></div>
              <div className="my-1 flex gap-1">{([0, 1, 2, 3] as const).map((l) => <Btn key={l} active={inputs.gnssLevel === l} tone={l === 0 ? "green" : l === 3 ? "red" : "amber"} onClick={() => setInputs({ ...inputs, gnssLevel: l })}>{["clean", "mild", "deg.", "severe"][l]}</Btn>)}</div>
              <Slider label="Layer age" value={inputs.gnssLayerAgeMin} min={0} max={180} step={5} unit=" min" onChange={(v) => setInputs({ ...inputs, gnssLayerAgeMin: v })} />
              <div className="text-[11px] text-slate-500">σ(GNSS) = {sg.s.gnss.toFixed(1)} m · derived from public ADS-B integrity fields · a stale layer is never read as "clean" · ≈ +{effects.gnss.toFixed(0)} m</div>
            </div>
            <div>
              <div className="flex items-center justify-between"><span className="font-medium text-slate-100">Terrain model</span><Pill tone={inputs.dem ? "green" : "amber"}>{inputs.dem ? "DEM loaded" : "flat-earth assumed"}</Pill></div>
              <Toggle label="DEM tile loaded" checked={inputs.dem} onChange={(v) => setInputs({ ...inputs, dem: v })} />
              <div className="text-[11px] text-slate-500">relief σ {sg.s.terrain} m · ≈ +{effects.dem.toFixed(0)} m</div>
            </div>
          </div>
        </Panel>

        <Panel title="Handoff fitness" kicker="Thresholds are visible and operator-set">
          {!est || !fit ? <p className="text-xs text-slate-500">Click a vehicle in the video.</p> : (
            <div className="space-y-3">
              <div className={cn("rounded-lg border p-3 text-center", fit === "strike" ? "border-emerald-500/50 bg-emerald-500/10" : fit === "second" ? "border-amber-500/50 bg-amber-500/10" : "border-rose-500/50 bg-rose-500/10")}>
                <div className="text-lg font-bold tracking-wide text-white">{FIT[fit].label}</div>
                <div className="text-xs text-slate-300">95% region: ±{(est.ell.along * infl).toFixed(0)} m along range · ±{(est.ell.cross * infl).toFixed(0)} m cross-range</div>
              </div>
              <Slider label="Required 95% error for strike-quality" value={req} min={10} max={100} step={5} unit=" m" onChange={setReq} hint={`second look ≤ ${req * 3} m · cue-only above`} />
              <Toggle label="Inflate for un-modelled error (×1.35)" checked={inflate} onChange={setInflate} hint="Lens scale, compass bias, relief: see validation" />
              <div>
                <div className="mb-1 text-[11px] uppercase tracking-wider text-slate-500">What drives the worst axis</div>
                {SOURCES.map((s) => ({ s, v: est.share[s] })).sort((a, b) => b.v - a.v).slice(0, 4).map((x) => (
                  <div key={x.s} className="mb-1"><div className="flex justify-between text-[11px] text-slate-400"><span>{x.s}</span><span className="font-mono">{(x.v * 100).toFixed(0)}%</span></div><Bar value={x.v} max={1} tone="cyan" /></div>
                ))}
              </div>
              {fit !== "strike" && fixes.length > 0 && (
                <div className="rounded-lg bg-slate-950/70 p-2 text-[11px] text-slate-300">
                  <div className="mb-1 font-semibold text-slate-200">What would fix it (computed):</div>
                  {fixes.map((f) => <div key={f.text} className="flex justify-between"><span>{f.text}</span><span className="font-mono text-emerald-300">{a95.toFixed(0)} → {f.to.toFixed(0)} m</span></div>)}
                </div>
              )}
              {est.ell.dropped > 0.05 && <Callout tone="red">{(est.ell.dropped * 100).toFixed(0)}% of sampled rays miss the ground: near the horizon the region is effectively unbounded. Treat as cue-only.</Callout>}
            </div>
          )}
        </Panel>

        <Panel title="Validation against an independent truth" kicker="'An error estimate that holds up'" right={<Btn onClick={() => T && setCov(coverage(T, nom, sg.s, 1500))} disabled={!T}>Run 1 500 trials</Btn>}>
          <p className="mb-2 text-xs leading-relaxed text-slate-400">Each trial builds a world with all modelled errors <i>plus</i> errors the estimator does not know about (lens scale ±1.5 %, compass bias, roll bias, relief), makes the click, and checks if the true point lies inside the reported 95 % region.</p>
          {!cov ? <p className="text-xs text-slate-500">Select a vehicle and run. Takes ~1 s.</p> : (
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <Stat label="Modelled only" value={`${(cov.model * 100).toFixed(0)}%`} sub="should be ≈ 95" tone={cov.model > 0.9 ? "green" : "amber"} />
                <Stat label="+ unmodelled" value={`${(cov.plain * 100).toFixed(0)}%`} sub="the honest number" tone={cov.plain > 0.9 ? "green" : "red"} />
                <Stat label="+ ×1.35 inflation" value={`${(cov.inflated * 100).toFixed(0)}%`} sub="conservative" tone={cov.inflated > 0.93 ? "green" : "amber"} />
              </div>
              <p className="text-[11px] leading-relaxed text-slate-500">n = {cov.n} trials, seeded and reproducible. Where "+ unmodelled" falls under 95 %, the plain ellipse over-promises; that is why inflation is on by default. A real validation replaces this simulated truth with SITL ground truth on the hosted stack.</p>
            </div>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Operator controls – misclick-proof" kicker="Cheap to undo, hard to do by accident">
          <div className="space-y-2 text-xs">
            <div className="rounded-lg bg-slate-950/70 p-2 text-slate-300">
              <div className="mb-0.5 text-[10px] uppercase tracking-wider text-slate-500">What will happen if you promote</div>
              {est && fit ? <>Publish map item <b>TGT-{String(seed).padStart(2, "0")}</b> with 95% region ±{(est.ell.along * infl).toFixed(0)} × ±{(est.ell.cross * infl).toFixed(0)} m, state <b>{FIT[fit].label}</b>. <b>No tasking is created.</b> Recall is available for 30 s.</> : "Click a vehicle first."}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <HoldButton label="Hold 1.2 s to promote" tone="green" disabled={cand !== "candidate"} onConfirm={() => { setCand("promoted"); pushLog("PROMOTED to target (undo available 30 s)"); }} />
              <Btn tone="amber" disabled={cand === "none"} onClick={() => { setCand("none"); pushLog(cand === "promoted" ? "UNDO – target recalled" : "candidate discarded"); }}>{cand === "promoted" ? "Undo / recall" : "Discard"}</Btn>
              <span className="text-[11px] text-slate-500">A tap on "promote" does nothing – you must hold.</span>
            </div>
            <div className="flex items-center gap-3"><Pill tone="red">interruptions: {interrupts.current}</Pill><Pill tone="slate">updates kept quiet: {suppressed.current}</Pill></div>
            <div className="space-y-1">
              {log.length === 0 && <p className="text-slate-500">Action &amp; alert log. Interrupts only on a downward change of the handoff state.</p>}
              {log.map((l, i) => <div key={i} className={cn("rounded px-2 py-1", l.k === "interrupt" ? "bg-rose-500/15 text-rose-200" : l.k === "quiet" ? "bg-slate-800/60 text-slate-400" : "bg-slate-800 text-slate-200")}>{l.text}</div>)}
            </div>
          </div>
        </Panel>

        <Panel title="Ghost track – when the target leaves the video" kicker="A frozen pin is a silent lie">
          <Slider label="Seconds since target last seen" value={lost} min={0} max={60} unit=" s" onChange={setLost} />
          <Slider label="Assumed max target speed" value={vmax} min={2} max={20} unit=" m/s" onChange={setVmax} hint="Speed prior – visible and changeable (8 m/s ≈ 29 km/h off-road)" />
          {est && lost > 0 ? (
            <div className="mt-2 space-y-2">
              <div className="grid grid-cols-2 gap-2"><Stat label="Possible-position radius" value={`${ghostR.toFixed(0)} m`} sub={`${a95.toFixed(0)} m fix error + ${(vmax * lost).toFixed(0)} m movement`} tone={lostState === "hand-off" ? "red" : lostState === "wide" ? "amber" : "cyan"} /><Stat label="Area" value={`${(Math.PI * ghostR * ghostR / 10000).toFixed(1)} ha`} tone="slate" /></div>
              <Callout tone={lostState === "hand-off" ? "red" : "violet"} title={lostState === "hand-off" ? "Hand-off to operator" : "Region only – not a position"}>
                {lostState === "hand-off" ? "The region is too large to cue anything. Ask a human to re-acquire; do not keep displaying a point." : "Displayed as a growing region with its assumption stated. With road/terrain constraints (not modelled here) it would shrink."}
              </Callout>
            </div>
          ) : <p className="mt-2 text-xs text-slate-500">Drag the slider to see the region grow instead of a pin staying put.</p>}
        </Panel>
      </div>
    </div>
  );
}

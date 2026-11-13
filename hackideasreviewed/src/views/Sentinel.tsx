import { useEffect, useMemo, useState } from "react";
import { Bar, Btn, Callout, MockBadge, Panel, Pill, SectionTitle, Slider, Stat, Toggle, type Tone } from "../components/ui";
import { DEFAULT_SCN, evalCell, runSim, type Cell, type Frame, type Policy, type Scn } from "../sim/swarm";
import { cn } from "../utils/cn";

const JAMS = [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9];
const DECOYS = [0, 0.5, 1, 1.5, 2, 3, 4];
const ACCEPT = 0.1;
const R = 4800;

function Engagement({ f, truth }: { f: Frame; truth: boolean }) {
  return (
    <svg viewBox={`${-R} ${-R} ${2 * R} ${2 * R}`} className="mx-auto w-full max-w-[560px] rounded-lg bg-[#06121f]" style={{ aspectRatio: "1/1" }}>
      {[1000, 2500, 4000].map((r) => <circle key={r} r={r} fill="none" stroke={r === 2500 ? "#22d3ee" : "#1e293b"} strokeOpacity={r === 2500 ? 0.35 : 1} strokeDasharray={r === 2500 ? "60 40" : ""} strokeWidth={14} />)}
      <text x={40} y={-2520} fontSize={160} fill="#22d3ee" fillOpacity={0.6}>sensor range 2.5 km</text>
      <rect x={-70} y={-70} width={140} height={140} fill="#34d399" />
      <text x={110} y={60} fontSize={170} fill="#34d399">asset</text>
      {f.tg.map((g) => {
        if (!g.alive) return null;
        const col = !g.confirmed ? "#64748b" : g.cls === "civil" ? "#34d399" : g.cls === "threat" ? "#f43f5e" : "#60a5fa";
        const ring = truth ? (g.kind === "threat" ? "#fff" : g.kind === "civil" ? "#34d399" : "#475569") : "none";
        return (
          <g key={g.id}>
            {truth && <circle cx={g.x} cy={g.y} r={95} fill="none" stroke={ring} strokeWidth={14} strokeDasharray={g.kind === "decoy" ? "20 20" : ""} />}
            <circle cx={g.x} cy={g.y} r={g.confirmed ? 50 : 36} fill={col} fillOpacity={g.confirmed ? 0.35 + 0.65 * g.conf : 0.5} />
            {g.assigned && <circle cx={g.x} cy={g.y} r={130} fill="none" stroke="#fbbf24" strokeWidth={14} />}
          </g>
        );
      })}
      {f.it.filter((i) => !i.spent).map((i) => {
        const tgt = i.target !== null ? f.tg[i.target] : null;
        return (<g key={i.id}>{tgt && tgt.alive && <line x1={i.x} y1={i.y} x2={tgt.x} y2={tgt.y} stroke="#fbbf24" strokeWidth={10} strokeDasharray="30 30" strokeOpacity={0.6} />}<rect x={i.x - 35} y={i.y - 35} width={70} height={70} fill="#fbbf24" transform={`rotate(45 ${i.x} ${i.y})`} /></g>);
      })}
    </svg>
  );
}

export default function Sentinel() {
  const [tab, setTab] = useState<"ops" | "red">("ops");
  const [scn, setScn] = useState<Scn>(DEFAULT_SCN);
  const [seed, setSeed] = useState(4);
  const [t, setT] = useState(60);
  const [play, setPlay] = useState(false);
  const [truth, setTruth] = useState(false);
  const res = useMemo(() => runSim(scn, seed, true), [scn, seed]);
  const other = useMemo(() => runSim({ ...scn, policy: scn.policy === "triage" ? "naive" : "triage" }, seed, false), [scn, seed]);
  const f = res.frames[Math.min(t, res.frames.length - 1)];

  useEffect(() => {
    if (!play) return;
    const id = setInterval(() => setT((x) => (x >= res.frames.length - 1 ? 0 : x + 1)), 90);
    return () => clearInterval(id);
  }, [play, res.frames.length]);

  // Red-team state
  const [seeds, setSeeds] = useState(30);
  const [calib, setCalib] = useState(1);
  const [grids, setGrids] = useState<Record<Policy, Cell[][]> | null>(null);
  const [running, setRunning] = useState(0);
  const [boundary, setBoundary] = useState<{ jam: number; at: number }[] | null>(null);
  const [runs, setRuns] = useState({ grid: 0, adaptive: 0 });
  const [pick, setPick] = useState<{ pol: Policy; i: number; j: number } | null>(null);
  const [hist, setHist] = useState<{ label: string; safe: Record<Policy, number> }[]>([]);

  const baseScn = { ...scn, pdetScale: calib };
  const runSweep = async (label: string) => {
    setRunning(0.01); setBoundary(null);
    const g: Record<Policy, Cell[][]> = { naive: [], triage: [] };
    let n = 0;
    for (const pol of ["naive", "triage"] as Policy[]) for (let i = 0; i < JAMS.length; i++) {
      g[pol].push(DECOYS.map((d) => evalCell({ ...baseScn, policy: pol }, JAMS[i], d, seeds)));
      n++; setRunning(n / (2 * JAMS.length));
      await new Promise((r) => setTimeout(r, 0));
    }
    setGrids(g); setRuns({ grid: 2 * JAMS.length * DECOYS.length * seeds, adaptive: 0 }); setRunning(0);
    const safe = (p: Policy) => g[p].flat().filter((c) => c.hi < ACCEPT).length;
    setHist((h) => [...h, { label, safe: { naive: safe("naive"), triage: safe("triage") } }].slice(-4));
  };
  const runBoundary = async () => {
    let evals = 0;
    const pts: { jam: number; at: number }[] = [];
    for (const j of JAMS) {
      let lo = 0, hi = 4;
      const ev = (d: number) => { evals++; return evalCell({ ...baseScn, policy: scn.policy }, j, d, seeds).p; };
      if (ev(hi) < ACCEPT) pts.push({ jam: j, at: hi });
      else if (ev(lo) >= ACCEPT) pts.push({ jam: j, at: 0 });
      else { for (let k = 0; k < 5; k++) { const mid = (lo + hi) / 2; if (ev(mid) >= ACCEPT) hi = mid; else lo = mid; } pts.push({ jam: j, at: (lo + hi) / 2 }); }
      await new Promise((r) => setTimeout(r, 0));
    }
    setBoundary(pts); setRuns((r) => ({ ...r, adaptive: evals * seeds }));
  };

  const cellTone = (c: Cell) => (c.hi < ACCEPT ? "bg-emerald-500/25 text-emerald-200 border-emerald-500/40" : c.lo > ACCEPT ? "bg-rose-500/25 text-rose-200 border-rose-500/40" : "bg-amber-500/20 text-amber-200 border-amber-500/40");
  const sel = pick && grids ? grids[pick.pol][pick.i][pick.j] : null;
  const failCauses = useMemo(() => {
    if (!sel || !pick) return null;
    const causes = { burned: 0, held: 0, miss: 0 };
    let shown = 0, firstSeed: number | null = null;
    for (let sd = 1; sd <= 60 && shown < 12; sd++) {
      const r = runSim({ ...baseScn, policy: pick.pol, jam: sel.jam, decoyRatio: sel.decoy }, sd);
      if (!r.failed) continue;
      shown++; if (firstSeed === null) firstSeed = sd;
      if (r.interceptorsLeft === 0 && r.wastedOnDecoy >= 2) causes.burned++; else if (r.interceptorsLeft >= 2) causes.held++; else causes.miss++;
    }
    return { ...causes, total: shown, firstSeed };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, pick, calib, scn.threats, scn.interceptors, scn.sensorFail, scn.civil]);

  const evs = res.events.filter((e) => e.t <= f.t).slice(-9).reverse();
  const tracks = f.tg.filter((g) => g.alive && g.confirmed).sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y));
  const statusOf = (g: Frame["tg"][number]): { text: string; tone: Tone } =>
    g.cls === "civil" ? { text: "ignored · ADS-B match", tone: "green" } : g.assigned ? { text: "engaged", tone: "amber" } : g.cls === "threat" ? (g.conf >= 0.85 ? { text: "queued", tone: "red" } : { text: "waiting for evidence", tone: "slate" }) : { text: "likely decoy · held", tone: "slate" };

  return (
    <div className="space-y-5">
      <SectionTitle kicker="Concept D · merges Nexus P1 + P3 with the team's swarm project" title="AIRBASE SENTINEL + RED-TEAM – a counter-UAS extension, and the proof it holds">
        The brief names "a cheap drone over an airbase" and "a swarm mixed with decoys". Sentinel is the operator view (triage, tasking, interruptions only when a human is needed). Red-Team is the other half
        of the original swarm ask – an automatic <b>failure-boundary finder</b> that tells a buyer where the policy breaks, with confidence bounds.
      </SectionTitle>
      <div className="flex flex-wrap items-center gap-2">
        <MockBadge>Toy 2-D engagement sim – real computation, invented physics. Replace with PX4/Gazebo SITL behind the same harness.</MockBadge>
        <div className="ml-auto flex gap-1"><Btn active={tab === "ops"} onClick={() => setTab("ops")}>Operator view</Btn><Btn active={tab === "red"} tone="violet" onClick={() => setTab("red")}>Red-Team proof</Btn></div>
      </div>

      {tab === "ops" && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-4">
            <Panel>
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <Btn onClick={() => setPlay(!play)} tone={play ? "amber" : "green"}>{play ? "Pause" : "Play"}</Btn>
                <input type="range" min={0} max={res.frames.length - 1} value={Math.min(t, res.frames.length - 1)} onChange={(e) => setT(parseInt(e.target.value))} className="h-1.5 flex-1 accent-cyan-400" />
                <span className="w-16 text-right font-mono text-sm text-cyan-300">T+{f.t}s</span>
              </div>
              <Engagement f={f} truth={truth} />
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[11px] text-slate-400">
                <span><span className="text-slate-500">●</span> unconfirmed</span><span><span className="text-rose-400">●</span> assessed threat</span><span><span className="text-blue-400">●</span> assessed decoy</span><span><span className="text-emerald-400">●</span> civil (ADS-B)</span><span><span className="text-amber-400">◆</span> interceptor</span>
                <span>opacity = confidence</span>
                <span className="ml-auto"><Toggle label="Show ground truth (judges only)" checked={truth} onChange={setTruth} /></span>
              </div>
            </Panel>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat label="Real attackers leaked" value={res.leaked} sub={`of ${scn.threats}`} tone={res.leaked ? "red" : "green"} />
              <Stat label="Interceptors burnt on decoys" value={res.wastedOnDecoy} sub={`${other.wastedOnDecoy} under ${scn.policy === "triage" ? "naive" : "triage"}`} tone="amber" />
              <Stat label="Civil aircraft engaged" value={res.civilEngaged} sub="must be 0" tone={res.civilEngaged ? "red" : "green"} />
              <Stat label="Human interruptions" value={res.interrupts} sub={`${scn.policy === "triage" ? `vs ${other.interrupts} alerts if every track alerted` : "one per confirmed track"}`} tone="cyan" />
            </div>
            <Panel title="Decision log" kicker="Plain language, time-ordered">
              <div className="space-y-1 text-xs">
                {evs.length === 0 && <p className="text-slate-500">Nothing yet.</p>}
                {evs.map((e, i) => <div key={i} className={cn("flex gap-2 rounded px-2 py-1", e.level === "interrupt" ? "bg-rose-500/15 text-rose-200" : e.level === "bad" ? "bg-amber-500/10 text-amber-200" : "bg-slate-800/60 text-slate-300")}><span className="font-mono text-slate-500">T+{e.t}</span>{e.text}</div>)}
              </div>
            </Panel>
          </div>

          <div className="space-y-4">
            <Panel title="Scenario" kicker="Change it and the run recomputes (seeded)">
              <div className="space-y-2.5">
                <div className="flex gap-1"><Btn active={scn.policy === "triage"} onClick={() => setScn({ ...scn, policy: "triage" })} tone="green">Triage policy</Btn><Btn active={scn.policy === "naive"} onClick={() => setScn({ ...scn, policy: "naive" })} tone="red">Naive (engage everything)</Btn></div>
                <Slider label="Real attackers" value={scn.threats} min={2} max={12} onChange={(v) => setScn({ ...scn, threats: v })} />
                <Slider label="Decoys per attacker" value={scn.decoyRatio} min={0} max={4} step={0.5} onChange={(v) => setScn({ ...scn, decoyRatio: v })} />
                <Slider label="Interceptors" value={scn.interceptors} min={4} max={20} onChange={(v) => setScn({ ...scn, interceptors: v })} />
                <Slider label="Jamming" value={scn.jam} min={0} max={0.9} step={0.05} onChange={(v) => setScn({ ...scn, jam: v })} hint="Fewer observations, weaker cues, lossy commands" />
                <Slider label="Sensor failure" value={scn.sensorFail} min={0} max={0.6} step={0.05} onChange={(v) => setScn({ ...scn, sensorFail: v })} />
                <div className="flex gap-2"><Btn tone="slate" onClick={() => { setSeed(seed + 1); setT(60); }}>New random seed ({seed})</Btn><Btn tone="slate" onClick={() => setScn(DEFAULT_SCN)}>Reset</Btn></div>
              </div>
            </Panel>
            <Panel title={`Tracks · ${tracks.length} confirmed`} kicker="Sorted by closeness – why each is treated as it is">
              <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
                {tracks.length === 0 && <p className="text-xs text-slate-500">No confirmed tracks yet.</p>}
                {tracks.map((g) => { const st = statusOf(g); return (
                  <div key={g.id} className="rounded-lg border border-slate-800 bg-slate-950/60 p-2 text-xs">
                    <div className="flex items-center gap-2"><span className="font-mono text-slate-400">#{g.id}</span><Pill tone={st.tone}>{st.text}</Pill><span className="ml-auto font-mono text-slate-400">{(Math.hypot(g.x, g.y) / 1000).toFixed(1)} km</span></div>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-400"><span className="w-28">{g.cls} {(g.conf * 100).toFixed(0)}%</span><div className="flex-1"><Bar value={g.conf} max={1} tone={g.conf >= 0.85 ? "green" : "amber"} /></div></div>
                    {truth && <div className="mt-0.5 text-[10px] text-slate-500">ground truth: {g.kind}</div>}
                  </div>); })}
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-slate-500">Triage commits an interceptor when confidence ≥ 85 % (or ≥ 65 % with &lt; 35 s to impact, or when spare interceptors exceed unresolved tracks). Ambiguous &amp; close = the only time a human is asked. The human's answer is not simulated here – ambiguous tracks are simply held.</p>
            </Panel>
          </div>
        </div>
      )}

      {tab === "red" && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4">
            <Panel title="Failure map: P(at least one real attacker leaks)" kicker="Jamming × decoys-per-attacker" right={<div className="flex items-center gap-2"><Btn onClick={() => runSweep(calib === 1 ? "sim defaults" : `calibrated p_det×${calib.toFixed(2)}`)} disabled={running > 0}>{running > 0 ? `Running ${(running * 100).toFixed(0)}%` : grids ? "Re-run sweep" : "Run sweep"}</Btn><Btn tone="violet" onClick={runBoundary} disabled={!grids}>Adaptive boundary</Btn></div>}>
              {!grids ? <p className="py-8 text-center text-sm text-slate-500">Press <b>Run sweep</b>. It runs {2 * JAMS.length * DECOYS.length * seeds} seeded simulations in your browser (~2 s).</p> : (
                <div className="grid gap-4 md:grid-cols-2">
                  {(["naive", "triage"] as Policy[]).map((pol) => (
                    <div key={pol}>
                      <div className="mb-1 flex items-center justify-between"><Pill tone={pol === "triage" ? "green" : "red"}>{pol === "triage" ? "Triage policy" : "Naive policy"}</Pill><span className="text-[11px] text-slate-500">{grids[pol].flat().filter((c) => c.hi < ACCEPT).length}/49 cells certified safe</span></div>
                      <div className="relative">
                        <div className="grid" style={{ gridTemplateColumns: `28px repeat(${DECOYS.length}, 1fr)` }}>
                          <div />{DECOYS.map((d) => <div key={d} className="text-center text-[10px] text-slate-500">{d}</div>)}
                          {grids[pol].map((row, i) => (<div key={i} className="contents"><div className="flex items-center text-[10px] text-slate-500">{JAMS[i]}</div>{row.map((c, j) => (
                            <button key={j} onClick={() => setPick({ pol, i, j })} className={cn("m-px aspect-square rounded border text-[10px] font-mono leading-none", cellTone(c), pick && pick.pol === pol && pick.i === i && pick.j === j && "ring-2 ring-white")} title={`leak ${(c.p * 100).toFixed(0)}% (95% CI ${(c.lo * 100).toFixed(0)}–${(c.hi * 100).toFixed(0)}%, n=${c.n})`}>{(c.p * 100).toFixed(0)}</button>))}</div>))}
                        </div>
                        {boundary && scn.policy === pol && (
                          <svg className="pointer-events-none absolute" style={{ left: 28, top: 16, right: 0, bottom: 0, width: "calc(100% - 28px)", height: "calc(100% - 16px)" }} viewBox="0 0 100 100" preserveAspectRatio="none">
                            <polyline fill="none" stroke="#fff" strokeWidth={1.2} vectorEffect="non-scaling-stroke" strokeDasharray="3 2" points={boundary.map((b, i) => `${(b.at / 4) * 100},${((i + 0.5) / JAMS.length) * 100}`).join(" ")} />
                          </svg>
                        )}
                      </div>
                      <div className="mt-1 flex justify-between text-[10px] text-slate-500"><span>↓ jamming (rows)</span><span>decoys per attacker →</span></div>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                <span className="rounded border border-emerald-500/40 bg-emerald-500/20 px-1.5 text-emerald-200">upper CI &lt; {ACCEPT * 100}% – certified</span>
                <span className="rounded border border-rose-500/40 bg-rose-500/20 px-1.5 text-rose-200">lower CI &gt; {ACCEPT * 100}% – fails</span>
                <span className="rounded border border-amber-500/40 bg-amber-500/20 px-1.5 text-amber-200">uncertain – needs more runs</span>
                <span>cell value = leak % · Wilson 95 % interval</span>
              </div>
              {boundary && <p className="mt-2 text-xs text-slate-300">Adaptive boundary (white dashed, {scn.policy}): {runs.adaptive} runs located the {ACCEPT * 100}%-leak edge at 0.125 decoys/attacker resolution. A uniform grid at that resolution needs ≈ {JAMS.length * 33 * seeds} runs (<b>{Math.round((JAMS.length * 33 * seeds) / Math.max(1, runs.adaptive))}× more</b>). Assumes leak rate rises monotonically with decoys – stated, not hidden.</p>}
            </Panel>

            <Panel title="Where it breaks – selected cell" kicker="Report, not just a number">
              {!sel || !pick ? <p className="text-xs text-slate-500">Click a cell.</p> : (
                <div className="space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                    <Stat label="Leak rate" value={`${(sel.p * 100).toFixed(0)}%`} sub={`95% CI ${(sel.lo * 100).toFixed(0)}–${(sel.hi * 100).toFixed(0)}%`} tone={sel.hi < ACCEPT ? "green" : sel.lo > ACCEPT ? "red" : "amber"} />
                    <Stat label="Failing seeds" value={`${sel.k}/${sel.n}`} tone="slate" />
                    <Stat label="Jamming" value={sel.jam} tone="slate" />
                    <Stat label="Decoys/attacker" value={sel.decoy} tone="slate" />
                  </div>
                  {failCauses && failCauses.total > 0 && (
                    <div className="rounded-lg bg-slate-950/70 p-2">
                      <div className="mb-1 font-semibold text-slate-200">Failure causes across {failCauses.total} failing seeds (heuristic labels)</div>
                      {[["Interceptors burnt on decoys, none left", failCauses.burned], ["Held back or mis-classified: evidence too slow, interceptors left unused", failCauses.held], ["Kill misses with no reserve", failCauses.miss]].map(([l, v]) => (
                        <div key={l as string} className="mb-1"><div className="flex justify-between text-[11px] text-slate-400"><span>{l}</span><span className="font-mono">{v}</span></div><Bar value={v as number} max={failCauses.total} tone="amber" /></div>
                      ))}
                    </div>
                  )}
                  {failCauses?.firstSeed != null && <Btn tone="violet" onClick={() => { setScn({ ...baseScn, policy: pick.pol, jam: sel.jam, decoyRatio: sel.decoy }); setSeed(failCauses.firstSeed!); setT(100); setTab("ops"); }}>Replay failing seed {failCauses.firstSeed} in the operator view →</Btn>}
                </div>
              )}
            </Panel>
          </div>

          <div className="space-y-4">
            <Panel title="Sweep settings" kicker="Seeded & reproducible">
              <div className="space-y-3">
                <Slider label="Seeds per cell" value={seeds} min={10} max={60} step={5} onChange={setSeeds} hint="More seeds narrow the confidence interval" />
                <Slider label="Detection reliability (sim-to-real)" value={calib} min={0.5} max={1} step={0.05} onChange={setCalib} hint="Fitted from field logs in a real build" />
                <div className="rounded-lg bg-slate-950/70 p-2 text-[11px] leading-relaxed text-slate-400">Mock field log says: measured detection reliability under comparable jamming was <b className="text-slate-200">0.70</b> of the simulator's.
                  <div className="mt-1.5 flex gap-2"><Btn tone="amber" onClick={() => setCalib(0.7)}>Apply field calibration</Btn><Btn tone="slate" onClick={() => setCalib(1)}>Back to sim default</Btn></div></div>
              </div>
            </Panel>
            <Panel title="Feedback loop" kicker="Field data → simulator → new envelope">
              {hist.length === 0 ? <p className="text-xs text-slate-500">Run a sweep, apply the field calibration, run again. The change in certified-safe area is the point: the simulator is only as honest as its calibration.</p> : (
                <table className="w-full text-xs"><thead className="text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="py-1 text-left">Run</th><th className="text-right">Naive safe</th><th className="text-right">Triage safe</th></tr></thead>
                  <tbody className="divide-y divide-slate-800 font-mono text-slate-300">{hist.map((h, i) => <tr key={i}><td className="py-1 text-left font-sans">{h.label}</td><td className="text-right">{h.safe.naive}/49</td><td className="text-right text-emerald-300">{h.safe.triage}/49</td></tr>)}</tbody></table>
              )}
            </Panel>
            <Callout tone="amber" title="What a buyer would still ask">
              "Is the physics real?" No – this is a toy, and it says so. The deliverable is the <b>harness</b>: scenario space, seeded runs, rare-event intervals, failure replay, and a calibration hook. Swap the engine for PX4 SITL and the report format stays.
              Also not modelled: the operator's response to an interrupt, multi-sensor correlation, weather, and collateral risk.
            </Callout>
          </div>
        </div>
      )}
    </div>
  );
}

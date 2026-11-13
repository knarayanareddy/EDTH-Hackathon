import { useEffect, useMemo, useState } from "react";
import { Bar, Btn, Callout, MockBadge, Panel, Pill, SectionTitle, Slider, Stat, Toggle, type Tone } from "../components/ui";
import {
  ANCHORAGE, BASE, BORNHOLM, CABLES, DEFAULT_CONFIG, FERRY, FISHING, H, INCIDENT_T, LANES, SWEDEN, W,
  configHash, detect, fmtT, genDay, learnBaseline, speedOnly, toLL, type Cls, type Config, type Vessel,
} from "../sim/ais";
import { candidates, plan, DEFAULT_ENDURANCE } from "../sim/isr";
import { cn } from "../utils/cn";

const CLS_COL: Record<Cls, string> = { tanker: "#fbbf24", cargo: "#38bdf8", ferry: "#34d399", fishing: "#f472b6" };
const CAB_COL = { power: "#f59e0b", telecom: "#22d3ee", pipeline: "#a78bfa" };
const tierTone: Record<string, Tone> = { cue: "red", review: "amber", watch: "slate" };

const TRAIN_DAYS = ["2026-09-01", "2026-09-02", "2026-09-03"];
let baseCache: ReturnType<typeof learnBaseline> | null = null;
const getBase = () => (baseCache ??= learnBaseline(TRAIN_DAYS));
const dayCache = new Map<string, Vessel[]>();
const getDay = (d: string, planted: boolean) => {
  const k = d + planted;
  if (!dayCache.has(k)) dayCache.set(k, genDay(d, planted));
  return dayCache.get(k)!;
};
const addDays = (iso: string, n: number) => new Date(Date.parse(iso + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10);
const Y = (y: number) => H - y;

function posAt(v: Vessel, now: number) {
  for (let i = v.pts.length - 1; i >= 0; i--) if (v.pts[i].t <= now) return now - v.pts[i].t <= 16 ? v.pts[i] : null;
  return null;
}

interface WeekRow { date: string; vessels: number; so: number; review: number; cue: number }

export default function CableGuard() {
  const [mode, setMode] = useState<"replay" | "spot">("replay");
  const [date, setDate] = useState("2026-09-11");
  const [now, setNow] = useState(5 * 60 + 12);
  const [play, setPlay] = useState(false);
  const [cfg, setCfg] = useState<Config>(DEFAULT_CONFIG);
  const [sel, setSel] = useState<string | null>(null);
  const [showSO, setShowSO] = useState(false);
  const [endur, setEndur] = useState(DEFAULT_ENDURANCE);
  const [week, setWeek] = useState<WeekRow[] | null>(null);

  const dayKey = mode === "replay" ? "2022-02-26" : date;
  const base = getBase();
  const vessels = useMemo(() => getDay(dayKey, mode === "replay"), [dayKey, mode]);
  const eps = useMemo(() => detect(vessels, base, cfg), [vessels, base, cfg]);
  const so = useMemo(() => speedOnly(vessels), [vessels]);
  const visible = eps.filter((e) => e.tFirst <= now);
  const selEp = eps.find((e) => e.id === sel) ?? null;
  const planted = vessels.find((v) => v.truth.startsWith("PLANTED"));
  const plantedEp = eps.find((e) => e.vessel.id === planted?.id);
  const cands = useMemo(() => candidates(eps, now), [eps, now]);
  const isr = useMemo(() => plan(cands, endur), [cands, endur]);
  const hash = configHash(cfg);
  const frozen = hash === configHash(DEFAULT_CONFIG);

  useEffect(() => { setWeek(null); setSel(null); }, [mode, date, cfg]);
  useEffect(() => {
    if (!play) return;
    const id = setInterval(() => setNow((n) => (n >= 1439 ? 0 : n + 3)), 120);
    return () => clearInterval(id);
  }, [play]);

  const runWeek = () => {
    const start = mode === "replay" ? "2022-02-23" : date;
    const rows: WeekRow[] = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(start, i);
      const v = getDay(d, mode === "replay" && d === "2022-02-26");
      const e = detect(v, base, cfg);
      rows.push({ date: d, vessels: v.length, so: speedOnly(v).length, review: e.filter((x) => x.tier === "review").length, cue: e.filter((x) => x.tier === "cue").length });
    }
    setWeek(rows);
  };
  const tot = week?.reduce((a, r) => ({ so: a.so + r.so, rev: a.rev + r.review, cue: a.cue + r.cue }), { so: 0, rev: 0, cue: 0 });

  const damagePos = planted ? planted.pts.reduce((b, p) => (Math.abs(p.t - INCIDENT_T) < Math.abs(b.t - INCIDENT_T) ? p : b), planted.pts[0]) : null;
  const lead = plantedEp ? INCIDENT_T - plantedEp.tFirst : null;

  return (
    <div className="space-y-5">
      <SectionTitle kicker="Concept A · Mantavia, improved" title="CABLEGUARD – anchor-drag episodes, not alerts">
        What changed versus the first draft: features are <b>computed from raw positions</b> (not typed in); "slow" is judged against the ship's own history and the learned class × lane norm; AIS
        gaps count as evidence; alerts merge into <b>episodes</b>; the ISR plan chases <b>moving</b> targets with a hard return-to-base check; and the config is hashed for the blind spot-check.
      </SectionTitle>
      <div className="flex flex-wrap items-center gap-2">
        <MockBadge>Synthetic AIS · schematic geometry · numbers are illustrative</MockBadge>
        <Pill tone="slate">Real run: same code, DMA CSV → Parquet instead of genDay()</Pill>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        {/* LEFT: controls + map */}
        <div className="space-y-4">
          <Panel>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex gap-1">
                <Btn active={mode === "replay"} onClick={() => { setMode("replay"); setNow(5 * 60 + 12); }}>Incident replay · 26 Feb 2022</Btn>
                <Btn active={mode === "spot"} tone="violet" onClick={() => { setMode("spot"); setNow(9 * 60); }}>Spot check · ordinary day</Btn>
              </div>
              {mode === "spot" && (
                <select value={date} onChange={(e) => setDate(e.target.value)} className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200">
                  {Array.from({ length: 10 }, (_, i) => `2026-09-${String(7 + i).padStart(2, "0")}`).map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
              )}
              <div className="ml-auto flex items-center gap-2 text-xs">
                <Pill tone={frozen ? "green" : "amber"}>config {hash} {frozen ? "· frozen ✓" : "· modified since freeze"}</Pill>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <Btn onClick={() => setPlay(!play)} tone={play ? "amber" : "green"}>{play ? "Pause" : "Play"}</Btn>
              <input type="range" min={0} max={1439} value={now} onChange={(e) => setNow(parseInt(e.target.value))} className="h-1.5 flex-1 accent-cyan-400" />
              <span className="w-24 text-right font-mono text-sm text-cyan-300">{fmtT(now)} UTC</span>
            </div>
          </Panel>

          <Panel className="p-2">
            <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto w-full max-w-[720px] rounded-lg bg-[#06121f]" style={{ aspectRatio: `${W}/${H}` }}>
              <polygon points={SWEDEN.map(([x, y]) => `${x},${Y(y)}`).join(" ")} fill="#16202e" stroke="#2b3b50" strokeWidth={0.4} />
              <ellipse cx={BORNHOLM.cx} cy={Y(BORNHOLM.cy)} rx={BORNHOLM.rx} ry={BORNHOLM.ry} fill="#16202e" stroke="#2b3b50" strokeWidth={0.4} />
              <text x={BORNHOLM.cx} y={Y(BORNHOLM.cy)} fontSize={3.2} fill="#475569" textAnchor="middle">BORNHOLM</text>
              <text x={8} y={Y(150)} fontSize={3.2} fill="#475569">SWEDEN</text>
              <rect x={FISHING.x0} y={Y(FISHING.y1)} width={FISHING.x1 - FISHING.x0} height={FISHING.y1 - FISHING.y0} fill="#f472b6" fillOpacity={0.05} stroke="#f472b6" strokeOpacity={0.4} strokeDasharray="2 1.5" strokeWidth={0.3} />
              <text x={FISHING.x0 + 1} y={Y(FISHING.y1) + 3} fontSize={2.6} fill="#f472b6" fillOpacity={0.7}>fishing ground</text>
              <circle cx={ANCHORAGE.x} cy={Y(ANCHORAGE.y)} r={ANCHORAGE.r + 1} fill="none" stroke="#94a3b8" strokeOpacity={0.5} strokeDasharray="2 1.5" strokeWidth={0.3} />
              <text x={ANCHORAGE.x} y={Y(ANCHORAGE.y) - ANCHORAGE.r - 2} fontSize={2.6} fill="#94a3b8" textAnchor="middle">anchorage</text>
              {LANES.map((l) => <polyline key={l.id} fill="none" stroke="#334155" strokeWidth={0.35} strokeDasharray="1.5 1.5" points={l.poly.map(([x, y]) => `${x},${Y(y)}`).join(" ")} />)}
              <polyline fill="none" stroke="#10b981" strokeOpacity={0.25} strokeWidth={0.3} strokeDasharray="1 1" points={FERRY.map(([x, y]) => `${x},${Y(y)}`).join(" ")} />
              {CABLES.map((c) => (
                <g key={c.id}>
                  <polyline fill="none" stroke={CAB_COL[c.kind]} strokeOpacity={0.12} strokeWidth={cfg.corridorKm * 2} strokeLinejoin="round" points={c.poly.map(([x, y]) => `${x},${Y(y)}`).join(" ")} />
                  <polyline fill="none" stroke={CAB_COL[c.kind]} strokeWidth={0.5} points={c.poly.map(([x, y]) => `${x},${Y(y)}`).join(" ")} />
                  <text x={c.poly[0][0] + 1.5} y={Y(c.poly[0][1]) - 1.5} fontSize={3} fill={CAB_COL[c.kind]}>{c.id}</text>
                </g>
              ))}
              {/* reported damage */}
              {mode === "replay" && damagePos && (
                <g>
                  <circle cx={damagePos.x} cy={Y(damagePos.y)} r={4} fill="none" stroke="#f43f5e" strokeWidth={0.5} strokeDasharray="1 1" />
                  <text x={damagePos.x + 5} y={Y(damagePos.y) + 1} fontSize={3} fill="#fb7185">reported damage 05:17 UTC</text>
                </g>
              )}
              {/* trails for episodes */}
              {visible.map((e) => (
                <polyline key={"tr" + e.id} fill="none" stroke={e.tier === "cue" ? "#f43f5e" : "#f59e0b"} strokeWidth={0.5} strokeOpacity={0.8} points={e.vessel.pts.filter((p) => p.t <= now && p.t >= now - 90).map((p) => `${p.x},${Y(p.y)}`).join(" ")} />
              ))}
              {/* ISR plan */}
              <polyline fill="none" stroke="#34d399" strokeWidth={0.6} strokeDasharray="2 1.2" points={isr.path.map(([x, y]) => `${x},${Y(y)}`).join(" ")} />
              {isr.legs.map((l, i) => (
                <g key={l.cand.ep.id}>
                  <circle cx={l.toX} cy={Y(l.toY)} r={2.6} fill="#064e3b" stroke="#34d399" strokeWidth={0.4} />
                  <text x={l.toX} y={Y(l.toY) + 1.1} fontSize={3} fill="#a7f3d0" textAnchor="middle" fontWeight="bold">{i + 1}</text>
                </g>
              ))}
              <g>
                <rect x={BASE.x - 1.6} y={Y(BASE.y) - 1.6} width={3.2} height={3.2} fill="#34d399" />
                <text x={BASE.x + 3} y={Y(BASE.y) + 5} fontSize={2.6} fill="#34d399">ISR base</text>
              </g>
              {/* vessels */}
              {vessels.map((v) => {
                const p = posAt(v, now);
                if (!p) return null;
                const e = visible.find((q) => q.vessel.id === v.id);
                const so1 = showSO && so.some((s) => s.vessel.id === v.id && s.tFirst <= now);
                return (
                  <g key={v.id} onClick={() => e && setSel(e.id)} className={e ? "cursor-pointer" : ""}>
                    {e && <circle cx={p.x} cy={Y(p.y)} r={3.2} fill="none" stroke={e.tier === "cue" ? "#f43f5e" : "#f59e0b"} strokeWidth={0.7} />}
                    {so1 && !e && <circle cx={p.x} cy={Y(p.y)} r={2.4} fill="none" stroke="#e2e8f0" strokeWidth={0.35} strokeDasharray="0.8 0.8" />}
                    <circle cx={p.x} cy={Y(p.y)} r={e ? 1.3 : 0.9} fill={CLS_COL[v.cls]} opacity={e ? 1 : 0.75} />
                  </g>
                );
              })}
              {selEp && <circle cx={selEp.x} cy={Y(selEp.y)} r={6} fill="none" stroke="#fff" strokeWidth={0.4} strokeDasharray="1 1" />}
            </svg>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 px-2 pb-1 text-[11px] text-slate-400">
              {(Object.keys(CLS_COL) as Cls[]).map((c) => (
                <span key={c} className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: CLS_COL[c] }} />{c}</span>
              ))}
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full border-2 border-rose-500" />cue-ISR</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full border-2 border-amber-500" />review</span>
              <span className="flex items-center gap-1"><span className="h-0.5 w-4 border-t-2 border-dashed border-emerald-400" />ISR plan</span>
              <span className="ml-auto"><Toggle label="Overlay speed-only rule (dashed rings)" checked={showSO} onChange={setShowSO} /></span>
            </div>
          </Panel>

          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {mode === "replay" ? (
              <>
                <Stat label="Reported damage" value="05:17" sub="UTC · 06:17 local (public)" tone="red" />
                <Stat label="First alert (computed)" value={plantedEp ? fmtT(plantedEp.tFirst) : "MISSED"} sub={plantedEp ? plantedEp.tier + " tier" : "no episode"} tone={plantedEp ? "cyan" : "red"} />
                <Stat label="Lead time" value={lead === null ? "–" : `${lead > 0 ? "+" : ""}${lead} min`} sub={lead !== null && lead <= 0 ? "alert AFTER damage – say so" : "before damage (synthetic onset 20 min prior)"} tone={lead !== null && lead > 0 ? "green" : "red"} />
                <Stat label="Speed-only rule" value={so.some((s) => s.vessel.id === planted?.id) ? "caught" : "MISSES it"} sub={`${so.length} episodes that day`} tone="amber" />
              </>
            ) : (
              <>
                <Stat label="Planted incidents" value="0" sub="ordinary traffic: every alert is a false positive to explain" tone="slate" />
                <Stat label="Contextual episodes" value={eps.length} sub={`${eps.filter((e) => e.tier === "cue").length} cue-ISR · ${eps.filter((e) => e.tier === "review").length} review`} tone="cyan" />
                <Stat label="Speed-only episodes" value={so.length} sub="same day, same traffic" tone="amber" />
                <Stat label="Vessels in AOI" value={vessels.length} sub="mock traffic" tone="slate" />
              </>
            )}
          </div>

          {/* Week burden */}
          <Panel title="Alert burden over the surrounding week" kicker="Success criterion #2" right={<Btn onClick={runWeek}>Run 7 days</Btn>}>
            {!week ? (
              <p className="text-xs text-slate-500">Runs the frozen config over 7 consecutive days ({mode === "replay" ? "23 Feb – 1 Mar 2022, incident on the 26th" : `${date} + 6 days`}) with no code change.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-[10px] uppercase tracking-wider text-slate-500">
                    <tr><th className="py-1 text-left">Day</th><th className="text-right">Vessels</th><th className="text-right">Speed-only</th><th className="text-right">Review</th><th className="text-right">Cue-ISR</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 font-mono text-slate-300">
                    {week.map((r) => (
                      <tr key={r.date}><td className="py-1 text-left">{r.date}{r.date === "2022-02-26" && " ★"}</td><td className="text-right">{r.vessels}</td><td className="text-right text-amber-300">{r.so}</td><td className="text-right">{r.review}</td><td className="text-right text-rose-300">{r.cue}</td></tr>
                    ))}
                    <tr className="font-semibold text-white"><td className="py-1 text-left">7-day total</td><td /><td className="text-right text-amber-300">{tot?.so}</td><td className="text-right">{tot?.rev}</td><td className="text-right text-rose-300">{tot?.cue}</td></tr>
                  </tbody>
                </table>
                <p className="mt-2 text-[11px] text-slate-500">Unit = distinct <b>episodes</b> (consecutive flags on the same vessel merged). ★ contains the planted analogue. Mock traffic ≈ 55 vessels/day; the real AOI has far more, so absolute numbers will differ – the ratio and the explanation of each alert are the point.</p>
              </div>
            )}
          </Panel>
        </div>

        {/* RIGHT: queue, detail, ISR, config */}
        <div className="space-y-4">
          <Panel title={`Alert queue · ${visible.length} episode${visible.length === 1 ? "" : "s"} so far`} kicker="Only what is known at the clock time">
            <div className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
              {visible.length === 0 && <p className="text-xs text-slate-500">Nothing raised yet at {fmtT(now)}. Quiet is the goal.</p>}
              {visible.map((e) => (
                <button key={e.id} onClick={() => setSel(e.id)} className={cn("w-full rounded-lg border p-2 text-left text-xs transition", sel === e.id ? "border-cyan-500/60 bg-slate-800" : "border-slate-800 bg-slate-950/60 hover:border-slate-700")}>
                  <div className="flex items-center gap-2">
                    <Pill tone={tierTone[e.tier]}>{e.tier === "cue" ? "CUE ISR" : "REVIEW"}</Pill>
                    <span className="font-semibold text-slate-100">{e.vessel.name}</span>
                    <span className="text-slate-500">{e.vessel.cls}</span>
                    <span className="ml-auto font-mono text-slate-400">{fmtT(e.tFirst)}</span>
                  </div>
                  <div className="mt-1 line-clamp-2 text-[11px] text-slate-400">{e.reason}</div>
                </button>
              ))}
            </div>
          </Panel>

          <Panel title={selEp ? `Why: ${selEp.vessel.name}` : "Why this alert?"} kicker="Explainability">
            {!selEp ? (
              <p className="text-xs text-slate-500">Pick an episode or click a ringed vessel. You will see each context feature and how much it contributed – no opaque score.</p>
            ) : (
              <div className="space-y-2 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <Stat label="Score" value={selEp.peak.toFixed(1)} sub={`threshold ${cfg.thr.toFixed(1)}`} tone={tierTone[selEp.tier]} />
                  <Stat label="Position" value={`${toLL(selEp.x, selEp.y).lat.toFixed(2)}N ${toLL(selEp.x, selEp.y).lon.toFixed(2)}E`} sub={`MMSI ${selEp.vessel.mmsi} (check validity)`} tone="slate" />
                </div>
                {[
                  ["Crossing angle to " + selEp.feats.cable, selEp.feats.cross, 90, `${selEp.feats.cross.toFixed(0)}°`],
                  ["Speed deficit (own history & class norm)", selEp.feats.deficit, 4, `${selEp.feats.deficit.toFixed(1)} kn`],
                  ["Heading ≠ course", selEp.feats.hdgDiv, 14, `${selEp.feats.hdgDiv.toFixed(0)}°`],
                  ["Lane deviation", selEp.feats.laneDev, 3, `${selEp.feats.laneDev.toFixed(1)} km`],
                  ["Time over corridor", selEp.feats.dwell, 20, `${selEp.feats.dwell.toFixed(0)} min`],
                  ["AIS blind time", selEp.feats.gap, 20, `${selEp.feats.gap.toFixed(0)} min`],
                ].map(([l, v, m, t]) => (
                  <div key={l as string}>
                    <div className="flex justify-between text-[11px] text-slate-400"><span>{l}</span><span className="font-mono text-slate-200">{t}</span></div>
                    <Bar value={v as number} max={m as number} tone={(v as number) / (m as number) > 0.6 ? "amber" : "slate"} />
                  </div>
                ))}
                <p className="rounded bg-slate-950/70 p-2 leading-relaxed text-slate-300">{selEp.reason}</p>
                <p className="text-[11px] text-slate-500">Mock ground truth (hidden from the detector): <span className="text-slate-300">{selEp.truth}</span></p>
              </div>
            )}
          </Panel>

          <Panel title="ISR recommendation" kicker="1 platform · 25 m/s · moving targets" right={<span className="text-[11px] text-slate-500">{endur} min = {(endur * 1.5).toFixed(0)} km</span>}>
            <Slider label="Endurance" value={endur} min={30} max={90} step={5} unit=" min" onChange={setEndur} />
            {isr.legs.length === 0 ? (
              <p className="mt-2 text-xs text-slate-500">No episode currently justifies a sortie ({cands.length} candidate{cands.length === 1 ? "" : "s"}). Not sending is a valid answer.</p>
            ) : (
              <div className="mt-2 space-y-1.5 text-xs">
                {isr.legs.map((l, i) => (
                  <div key={l.cand.ep.id} className="flex items-center gap-2 rounded bg-slate-950/70 px-2 py-1.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 font-bold text-emerald-300">{i + 1}</span>
                    <span className="font-semibold text-slate-100">{l.cand.ep.vessel.name}</span>
                    <span className="ml-auto font-mono text-slate-400">+{l.tArrive.toFixed(0)} min · {l.km.toFixed(0)} km</span>
                  </div>
                ))}
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <Stat label="Used" value={`${isr.used.toFixed(0)}m`} tone="cyan" />
                  <Stat label="Return" value={`${isr.returnKm.toFixed(0)}km`} tone="slate" />
                  <Stat label="Margin" value={`${isr.margin.toFixed(0)}m`} tone={isr.margin < 8 ? "amber" : "green"} />
                </div>
              </div>
            )}
            {isr.dropped.map((d) => (
              <p key={d.cand.ep.id} className="mt-1.5 text-[11px] text-amber-300/90">Not tasked: {d.cand.ep.vessel.name} – {d.why}.</p>
            ))}
            <p className="mt-2 rounded bg-slate-950/70 p-2 text-[11px] leading-relaxed text-slate-400">Try it: in the replay, scrub the clock from 05:14 onward. The margin shrinks as the ship steams away and the sortie becomes infeasible. A one-hour asset only helps if it is cued <i>early</i> – that is why lead time matters more than detection accuracy.</p>
            <p className="mt-2 text-[10px] leading-relaxed text-slate-500">Vessel positions are extrapolated from the last AIS fix to the intercept time; stale fixes are down-weighted. Exhaustive search over ≤ 8 candidates, hard return-to-base check, 4 min on-station.</p>
          </Panel>

          <Panel title="Frozen configuration" kicker="Trust the spot-check">
            <div className="space-y-2">
              <Slider label="Alert threshold" value={cfg.thr} min={2} max={5} step={0.1} onChange={(v) => setCfg({ ...cfg, thr: v })} />
              <Slider label="Feature window" value={cfg.windowMin} min={8} max={40} step={1} unit=" min" onChange={(v) => setCfg({ ...cfg, windowMin: v })} hint="Shorter = earlier alerts, noisier. Longer = steadier, later." />
              <Slider label="Corridor half-width" value={cfg.corridorKm} min={1} max={5} step={0.5} unit=" km" onChange={(v) => setCfg({ ...cfg, corridorKm: v })} />
              <Btn onClick={() => setCfg(DEFAULT_CONFIG)} tone="slate">Reset to frozen config</Btn>
              <p className="text-[11px] leading-relaxed text-slate-500">On stage you would not touch these. The hash is printed so judges can see the same config produced the incident, week and blind-date numbers. Try the window slider on the replay: lead time and week burden trade off.</p>
            </div>
          </Panel>
        </div>
      </div>

      <Callout tone="amber" title="What the real build must still prove">
        (1) Real DMA files for 26 Feb 2022 and the ten September days, clipped to 54.5–56.0 N / 13.5–16.0 E and cached as Parquet. (2) Real cable geometry (EMODnet, plus a hand-digitised Bornholm–Sweden route, stated openly).
        (3) Baselines learned from real traffic. (4) The lead time here is a property of a <i>planted</i> onset; on the real incident it may be minutes or negative – report whichever it is.
      </Callout>
    </div>
  );
}

import { useMemo, useState } from "react";
import { Bar, Btn, Callout, Panel, Pill, SectionTitle, Slider } from "../components/ui";
import { cn } from "../utils/cn";

type K = "rubric" | "prove" | "demo" | "feas" | "risk" | "relev";
const CRIT: { k: K; label: string; hint: string; w: number }[] = [
  { k: "rubric", label: "Rubric fit", hint: "Hits what judges explicitly score", w: 3 },
  { k: "prove", label: "Provable number", hint: "A defensible, independent measurement", w: 3 },
  { k: "demo", label: "Demo punch", hint: "Lands in 3 minutes, live", w: 2 },
  { k: "feas", label: "36-h feasibility", hint: "Small team, one weekend", w: 3 },
  { k: "risk", label: "Low env. risk", hint: "No dependence on unseen SDK / hardware / data", w: 2 },
  { k: "relev", label: "Path to deployment", hint: "EDTH's stated goal: continue after the weekend", w: 2 },
];

interface Idea {
  id: string;
  name: string;
  origin: "original" | "new";
  s: Record<K, number>;
  why: string;
  tag: string;
}

const IDEAS: Idea[] = [
  { id: "n5", name: "AIRBASE SENTINEL – decoy-aware counter-UAS on Nexus", origin: "new", tag: "Nexus P1+P3 + swarm", s: { rubric: 5, prove: 4, demo: 5, feas: 3, risk: 3, relev: 5 }, why: "Merges intent→tasks, OSINT civil-traffic filtering and the team's swarm project into one operator story, then proves it with a Red-Team sweep. The brief literally names 'cheap drone over an airbase' and 'swarm mixed with decoys'." },
  { id: "n1", name: "TRUSTLINE – click-to-target with an honest, live-degrading error", origin: "new", tag: "Nexus P2 + trust", s: { rubric: 5, prove: 4, demo: 5, feas: 3, risk: 3, relev: 5 }, why: "Original GeoClick plus ghost track, input staleness (telemetry, wind, GNSS interference) widening the ellipse, handoff-fitness states and misclick-proof control. Pure maths library first, SDK wrapper second." },
  { id: "n2", name: "CABLEGUARD – context-aware anchor-drag episodes + moving-target ISR cueing", origin: "new", tag: "Mantavia", s: { rubric: 5, prove: 5, demo: 4, feas: 3, risk: 4, relev: 5 }, why: "Upgrades Mantavia: context (cable crossing angle × class × lane) instead of speed, episodes not alerts, gaps as evidence, orienteering with predicted vessel motion, frozen config hash for the spot check." },
  { id: "n4", name: "SWARM RED-TEAM – automated failure-boundary finder", origin: "new", tag: "Own project, narrow slice", s: { rubric: 3, prove: 5, demo: 4, feas: 3, risk: 4, relev: 5 }, why: "The only slice of the 'whole platform' ask that is demoable in a weekend: search the scenario space (jamming, decoy ratio, dropouts), return a failure map with confidence bounds. Buyers' real question: 'where does it break?'" },
  { id: "n3", name: "CLEARHOT – streaming thermal ISP + flicker evidence", origin: "new", tag: "Thermal", s: { rubric: 5, prove: 3, demo: 4, feas: 4, risk: 5, relev: 4 }, why: "Stable-LUT AGC, motion-adaptive temporal filter, stripe removal, halo-guarded detail, designed as line buffers + one frame store. Also offered as a Nexus video-processing extension." },
  { id: "n6", name: "GNSS-INTERFERENCE LAYER from ADS-B integrity fields", origin: "new", tag: "Nexus P3 (OSINT)", s: { rubric: 4, prove: 4, demo: 4, feas: 4, risk: 3, relev: 4 }, why: "Public ADS-B navigation-integrity values show where GNSS is degraded. Feeds TRUSTLINE directly: a concrete 'why this OSINT matters' that derates drone geolocation. Needs staleness shown per cell." },
  { id: "o4", name: "Mantavia as drafted (speed + corridor + greedy ISR)", origin: "original", tag: "Mantavia", s: { rubric: 5, prove: 4, demo: 3, feas: 3, risk: 4, relev: 4 }, why: "Good bones; weak where the one real incident was a 10-kn ship, and ISR planning ignores vessel motion." },
  { id: "o1", name: "Nexus P2 GeoClick as drafted", origin: "original", tag: "Nexus P2", s: { rubric: 4, prove: 3, demo: 4, feas: 3, risk: 2, relev: 4 }, why: "Right core, but validation is circular and no input-staleness story." },
  { id: "o5", name: "Thermal ISP as drafted", origin: "original", tag: "Thermal", s: { rubric: 5, prove: 2, demo: 4, feas: 4, risk: 5, relev: 3 }, why: "Safest start; judged purely by eye so 'good' is invisible among many teams." },
  { id: "o2", name: "Nexus P1 Intent Compiler", origin: "original", tag: "Nexus P1", s: { rubric: 3, prove: 2, demo: 4, feas: 3, risk: 2, relev: 4 }, why: "Easy to turn into an LLM toy that cannot be trusted; strong only as a part of Sentinel." },
  { id: "o3", name: "Nexus P3 OSINT Readiness Board", origin: "original", tag: "Nexus P3", s: { rubric: 3, prove: 3, demo: 3, feas: 5, risk: 3, relev: 3 }, why: "Buildable, but shallow alone. Works as the trust input of TRUSTLINE / SENTINEL." },
  { id: "o6", name: "Grey-Zone sensor network (ESP32/LoRa)", origin: "original", tag: "Own", s: { rubric: 3, prove: 2, demo: 5, feas: 2, risk: 1, relev: 4 }, why: "Great pitch; hardware + radio + field risk in 36 h." },
  { id: "o7", name: "Whole swarm platform (sim + train + test + HIL + feedback)", origin: "original", tag: "Own", s: { rubric: 2, prove: 3, demo: 3, feas: 1, risk: 2, relev: 5 }, why: "Right problem, impossible scope. Slice it: Red-Team is the narrow end that carries the value." },
  { id: "o8", name: "Ground Truth evidence view", origin: "original", tag: "Own", s: { rubric: 3, prove: 4, demo: 3, feas: 4, risk: 4, relev: 3 }, why: "Good component; fold into trust kernel." },
  { id: "o9", name: "Last Mile offline reporting", origin: "original", tag: "Own", s: { rubric: 2, prove: 4, demo: 3, feas: 5, risk: 5, relev: 2 }, why: "Safe, but off-theme for defence judges." },
];

export default function Scorecard() {
  const [w, setW] = useState<Record<K, number>>(() => Object.fromEntries(CRIT.map((c) => [c.k, c.w])) as Record<K, number>);
  const [filter, setFilter] = useState<"all" | "new" | "original">("all");
  const [open, setOpen] = useState<string | null>("n5");

  const ranked = useMemo(() => {
    const tot = Object.values(w).reduce((a, b) => a + b, 0) || 1;
    return IDEAS.filter((i) => filter === "all" || i.origin === filter)
      .map((i) => ({ ...i, score: (CRIT.reduce((a, c) => a + i.s[c.k] * w[c.k], 0) / (tot * 5)) * 100 }))
      .sort((a, b) => b.score - a.score);
  }, [w, filter]);

  return (
    <div className="space-y-6">
      <SectionTitle kicker="Part 2 · Ideas, scored" title="Original ideas vs. improved and merged versions">
        Scores are my judgement (1–5) after reading the briefs and the original reviews – not measurements. Move the weights to match your team's situation; the ranking recomputes. Rows are
        clickable.
      </SectionTitle>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Panel title="Weights" kicker="Your priorities" className="h-fit">
          <div className="space-y-3">
            {CRIT.map((c) => (
              <Slider key={c.k} label={c.label} value={w[c.k]} min={0} max={5} onChange={(v) => setW({ ...w, [c.k]: v })} hint={c.hint} />
            ))}
            <div className="flex flex-wrap gap-2 pt-1">
              <Btn onClick={() => setW({ rubric: 5, prove: 5, demo: 1, feas: 1, risk: 1, relev: 1 })}>Judge-optimiser</Btn>
              <Btn onClick={() => setW({ rubric: 1, prove: 1, demo: 1, feas: 5, risk: 5, relev: 0 })} tone="green">
                Play safe
              </Btn>
              <Btn onClick={() => setW({ rubric: 1, prove: 1, demo: 2, feas: 1, risk: 0, relev: 5 })} tone="violet">
                Startup path
              </Btn>
            </div>
          </div>
        </Panel>

        <div className="space-y-3">
          <div className="flex gap-2">
            {(["all", "new", "original"] as const).map((f) => (
              <Btn key={f} active={filter === f} onClick={() => setFilter(f)} tone={f === "new" ? "green" : "slate"}>
                {f === "all" ? "All" : f === "new" ? "New / merged" : "Original drafts"}
              </Btn>
            ))}
          </div>
          {ranked.map((i, idx) => (
            <button key={i.id} onClick={() => setOpen(open === i.id ? null : i.id)} className={cn("w-full rounded-xl border p-3 text-left transition", open === i.id ? "border-cyan-500/50 bg-slate-900" : "border-slate-800 bg-slate-900/50 hover:border-slate-700")}>
              <div className="flex items-center gap-3">
                <div className="w-6 shrink-0 text-center font-mono text-sm text-slate-500">{idx + 1}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-100">{i.name}</span>
                    <Pill tone={i.origin === "new" ? "green" : "slate"}>{i.origin === "new" ? "new / merged" : "original"}</Pill>
                    <Pill tone="violet">{i.tag}</Pill>
                  </div>
                  <div className="mt-1.5">
                    <Bar value={i.score} max={100} tone={i.origin === "new" ? "green" : "slate"} />
                  </div>
                </div>
                <div className="w-14 shrink-0 text-right font-mono text-lg font-semibold text-cyan-300">{i.score.toFixed(0)}</div>
              </div>
              {open === i.id && (
                <div className="mt-3 border-t border-slate-800 pt-3">
                  <p className="text-[13px] leading-relaxed text-slate-300">{i.why}</p>
                  <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
                    {CRIT.map((c) => (
                      <div key={c.k} className="rounded bg-slate-950/70 px-2 py-1">
                        <div className="text-[9px] uppercase tracking-wider text-slate-500">{c.label}</div>
                        <div className="font-mono text-sm text-slate-200">{i.s[c.k]}/5</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      <Callout tone="cyan" title="How to read this">
        With default weights the top entries are all <i>new / merged</i>, but note why: they are the original ideas with a stated, independent number attached (coverage, first-alert lead time,
        leak rate) and a narrower scope. If your team has no one with a strong ML/geo background, drag "Play safe" and see Thermal and Mantavia rise – they have no unseen-environment risk.
      </Callout>
    </div>
  );
}

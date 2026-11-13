import { useState } from "react";
import { cn } from "./utils/cn";
import { Pill } from "./components/ui";
import Review from "./views/Review";
import Scorecard from "./views/Scorecard";
import CableGuard from "./views/CableGuard";
import ClearHot from "./views/ClearHot";
import TrustLine from "./views/TrustLine";
import Sentinel from "./views/Sentinel";
import Plan from "./views/Plan";

type TabKey = "home" | "review" | "score" | "cable" | "thermal" | "trust" | "sentinel" | "plan";
const TABS: { k: TabKey; n: string; label: string; sub: string }[] = [
  { k: "home", n: "·", label: "Overview", sub: "the short version" },
  { k: "review", n: "1", label: "Review", sub: "what's in the repo" },
  { k: "score", n: "2", label: "Scorecard", sub: "ideas, re-ranked" },
  { k: "cable", n: "A", label: "CableGuard", sub: "Mantavia, improved" },
  { k: "thermal", n: "B", label: "ClearHot", sub: "Thermal ISP, live" },
  { k: "trust", n: "C", label: "TrustLine", sub: "Nexus geolocation" },
  { k: "sentinel", n: "D", label: "Sentinel + Red-Team", sub: "counter-UAS + proof" },
  { k: "plan", n: "4", label: "Plan", sub: "recommendation" },
];

function Home({ go }: { go: (k: TabKey) => void }) {
  const cards: { k: TabKey; tag: string; title: string; line: string; num: string; numLabel: string; tone: string }[] = [
    { k: "cable", tag: "A · Mantavia", title: "CABLEGUARD", line: "Anchor-drag episodes from context (cable crossing × class × lane × AIS gaps), not speed. Moving-target ISR cueing with a hard return-to-base check.", num: "10 kn", numLabel: "the real incident was not 'slow' – a speed gate misses it", tone: "from-amber-500/20" },
    { k: "thermal", tag: "B · Thermal ISP", title: "CLEARHOT", line: "Plateau-HE AGC on a fixed axis, motion-adaptive temporal filter, halo-guarded detail. Runs in your browser, loads your real .bin, and plots flicker.", num: "~3×", numLabel: "steadier brightness vs. min/max in the synthetic test (computed live)", tone: "from-cyan-500/20" },
    { k: "trust", tag: "C · Nexus P2 + P3", title: "TRUSTLINE", line: "Click-to-target with an ellipse that degrades with stale telemetry, GNSS interference and no terrain model – validated against a world with un-modelled errors.", num: "85 → 97%", numLabel: "empirical coverage of the 95% ellipse: plain vs. inflated (run it)", tone: "from-emerald-500/20" },
    { k: "sentinel", tag: "D · Nexus P1+P3 + own swarm", title: "SENTINEL + RED-TEAM", line: "Decoy-aware counter-UAS triage that interrupts a human rarely, plus an automatic failure-boundary finder with confidence intervals and failure replay.", num: "≈1 vs 18", numLabel: "human interruptions: triage vs. one-alert-per-track, default scenario, seeds 1–6 (toy sim)", tone: "from-violet-500/20" },
  ];
  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/40 p-6 md:p-8">
        <Pill tone="cyan">End-to-end review · EDTH combined_hackathon_package</Pill>
        <h1 className="mt-3 max-w-4xl text-3xl font-bold leading-tight tracking-tight text-white md:text-4xl">The ideas were a good map. The winning move is one hero with a number you can defend.</h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-300">
          I read both projects in the repo, verified their bugs and facts against the code and public sources, then rebuilt the strongest ideas so each one carries an <b>independent, computed
          number</b> instead of an assertion. Four working previews follow. All data in them is <b>mock</b> and labelled as such; the logic is real and runs in your browser.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {[["Verified in code", "6 findings: 2 high (open API, lost-save bug), 3 validity gaps, 1 duplication."], ["Facts corrected", "Incident is 26 Feb 2022 05:17 UTC, ~10 kn – not 28 Feb, not 'slow'."], ["Rubric insight", "Explainability, alarm fatigue and staleness are one thing: calibrated trust."]].map(([a, b]) => (
            <div key={a} className="rounded-lg bg-slate-950/60 p-3"><div className="text-xs font-semibold uppercase tracking-wider text-cyan-300">{a}</div><div className="mt-1 text-sm text-slate-300">{b}</div></div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-white">Four previews to open</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {cards.map((c) => (
            <button key={c.k} onClick={() => go(c.k)} className={cn("group rounded-xl border border-slate-800 bg-gradient-to-br to-slate-900 p-5 text-left transition hover:border-cyan-500/50", c.tone)}>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{c.tag}</div>
              <div className="mt-0.5 text-xl font-bold text-white">{c.title}</div>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">{c.line}</p>
              <div className="mt-4 flex items-end gap-3"><span className="font-mono text-2xl font-semibold text-cyan-300">{c.num}</span><span className="pb-1 text-[11px] leading-tight text-slate-400">{c.numLabel}</span></div>
              <div className="mt-3 text-xs font-medium text-cyan-300 opacity-0 transition group-hover:opacity-100">Open preview →</div>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"><div className="text-sm font-semibold text-white">If you only read one paragraph</div><p className="mt-2 text-sm leading-relaxed text-slate-400">Pick one hero by team skill (see Plan). Python/geo → CableGuard (most provable, offline). Image processing → ClearHot. Frontend/backend → TrustLine. Autonomy → Sentinel + Red-Team. Reuse the same trust kernel everywhere: every number shows its error, age and source.</p></div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"><div className="text-sm font-semibold text-white">What is real here</div><p className="mt-2 text-sm leading-relaxed text-slate-400">Detector features computed from raw positions; learned baselines; a moving-target ISR planner; a running thermal ISP; sampled error propagation with an independent truth; a seeded engagement sim with Wilson intervals. Only the <i>inputs</i> are synthetic.</p></div>
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4"><div className="text-sm font-semibold text-amber-200">What is not claimed</div><p className="mt-2 text-sm leading-relaxed text-slate-400">No real AIS, no real thermal frames (unless you load them), no live Nexus integration, no operational accuracy. Lead times, leak rates and coverage here are properties of invented worlds – the build must reproduce them on real inputs.</p></div>
      </div>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState<TabKey>("home");
  const go = (k: TabKey) => { setTab(k); window.scrollTo({ top: 0, behavior: "smooth" }); };
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 antialiased" style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}>
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] items-center gap-4 px-4 py-2.5">
          <button onClick={() => go("home")} className="flex shrink-0 items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded bg-cyan-500/20 font-mono text-xs font-bold text-cyan-300">EDTH</span>
            <span className="hidden text-sm font-semibold text-white sm:block">Review &amp; previews</span>
          </button>
          <nav className="flex min-w-0 flex-1 gap-1 overflow-x-auto" aria-label="Sections">
            {TABS.map((t) => (
              <button key={t.k} onClick={() => go(t.k)} className={cn("shrink-0 rounded-md px-3 py-1.5 text-left transition", tab === t.k ? "bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-500/40" : "text-slate-400 hover:bg-slate-800/70 hover:text-slate-200")}>
                <div className="flex items-center gap-1.5 text-xs font-semibold"><span className="font-mono text-[10px] text-slate-500">{t.n}</span>{t.label}</div>
                <div className="hidden text-[10px] text-slate-500 lg:block">{t.sub}</div>
              </button>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-[1500px] px-4 py-6">
        {tab === "home" && <Home go={go} />}
        {tab === "review" && <Review />}
        {tab === "score" && <Scorecard />}
        {tab === "cable" && <CableGuard />}
        {tab === "thermal" && <ClearHot />}
        {tab === "trust" && <TrustLine />}
        {tab === "sentinel" && <Sentinel />}
        {tab === "plan" && <Plan />}
      </main>
      <footer className="border-t border-slate-800 px-4 py-4 text-center text-[11px] text-slate-500">All previews use deterministic mock data unless you load your own file. Simulations are illustrations, not evidence of operational performance.</footer>
    </div>
  );
}

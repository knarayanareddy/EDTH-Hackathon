import { useEffect, useState, type ReactNode } from "react";
import { GROUPS, REVIEWS, type Review } from "./content";
import Overview from "./Overview";
import { Bullets, Callout, H, Panel, Pill, ScoreBars } from "./components/ui";
import { MantaviaExtra, NexusExtra, ThermalExtra } from "./extras";
import NexusGeo from "./previews/NexusGeo";
import NexusIntent from "./previews/NexusIntent";
import Mantavia from "./previews/Mantavia";
import ThermalLab from "./previews/ThermalLab";
import GreyZone from "./previews/GreyZone";
import LifelineHandover from "./previews/LifelineHandover";
import LastMile from "./previews/LastMile";
import GroundTruth from "./previews/GroundTruth";
import SignalIntegrity from "./previews/SignalIntegrity";
import InfraPulse from "./previews/InfraPulse";
import Floodline from "./previews/Floodline";
import ResourceCalc from "./previews/ResourceCalc";
import HandoverPressure from "./previews/HandoverPressure";
import Ideas from "./previews/Ideas";
import { cn } from "./utils/cn";

const PREVIEWS: Record<string, ReactNode> = {
  mantavia: <Mantavia />,
  thermal: <ThermalLab />,
  greyzone: <GreyZone />,
  lifeline: <LifelineHandover />,
  lastmile: <LastMile />,
  groundtruth: <GroundTruth />,
  signal: <SignalIntegrity />,
  pulse: <InfraPulse />,
  floodline: <Floodline />,
  thermaltruth: <ResourceCalc />,
  handover: <HandoverPressure />,
};

const EXTRAS: Record<string, ReactNode> = { nexus: <NexusExtra />, mantavia: <MantaviaExtra />, thermal: <ThermalExtra /> };

function ReviewView({ r, prev, next, go }: { r: Review; prev?: Review; next?: Review; go: (id: string) => void }) {
  const isIdeas = r.id === "ideas";
  return (
    <article>
      <header className="mb-6">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Pill tone={r.group === "official" ? "amber" : r.group === "own" ? "violet" : r.group === "suggested" ? "cyan" : "green"}>{GROUPS.find((g) => g.key === r.group)!.label}</Pill>
          {r.org && <Pill>{r.org}</Pill>}
        </div>
        <h1 className="text-3xl font-semibold text-white">{r.code}</h1>
        <div className="mt-1 text-lg text-slate-300">{r.title}</div>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">{r.tagline}</p>
      </header>

      {r.overlap && <div className="mb-6"><Callout tone="cyan" title="Overlap">{r.overlap}</Callout></div>}

      {!isIdeas && (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div>
            <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-amber-400/80">What I make of it</div>
            <div className="space-y-3">{r.take.map((t, i) => <p key={i} className="text-[15px] leading-relaxed text-slate-300">{t}</p>)}</div>
          </div>
          <Panel title="Scorecard" kicker="My rating (1-5)"><ScoreBars scores={r.scores} /></Panel>
        </div>
      )}
      {isIdeas && <p className="max-w-3xl text-[15px] leading-relaxed text-slate-300">{r.take[0]}</p>}

      {!isIdeas && (
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <Panel title="Strengths" kicker="Why it could win"><Bullets items={r.strengths} tone="green" /></Panel>
          <Panel title="Risks" kicker="What could sink it"><Bullets items={r.risks} tone="red" /></Panel>
        </div>
      )}

      {!isIdeas && (
        <>
          <H kicker="Suggested changes">What I'd change</H>
          <Bullets items={r.changes} tone="amber" />
        </>
      )}

      {EXTRAS[r.id]}

      <H kicker="Preview">{isIdeas ? "Ideas and concept previews" : r.previewTitle}</H>
      {!isIdeas && <p className="mb-3 max-w-3xl text-sm text-slate-400">{r.previewBlurb}</p>}
      {isIdeas ? (
        <Ideas />
      ) : r.id === "nexus" ? (
        <div className="space-y-6">
          <Panel title="Problem 2 · click-to-geolocate" kicker="Interactive"><NexusGeo /></Panel>
          <div>
            <div className="mb-2 text-sm font-semibold text-white">Problem 1 · intent → tasks, with OSINT staleness in the loop</div>
            <Panel kicker="Interactive"><NexusIntent /></Panel>
          </div>
        </div>
      ) : (
        <Panel kicker="Interactive">{PREVIEWS[r.id]}</Panel>
      )}

      {!isIdeas && (
        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <div>
            <H kicker="Plan">Build order</H>
            <ol className="space-y-2">
              {r.build.map((b, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-400/15 font-mono text-[10px] text-amber-300">{i + 1}</span>
                  <span className="text-slate-300">{b.step} <span className="font-mono text-[11px] text-slate-500">· {b.when}</span></span>
                </li>
              ))}
            </ol>
          </div>
          <div>
            <H kicker="Stage">Demo script</H>
            <Bullets items={r.demo} tone="cyan" />
            <H kicker="Mentors">Questions to ask</H>
            <Bullets items={r.ask} tone="amber" />
          </div>
        </div>
      )}

      <div className="mt-10 rounded-xl border border-amber-400/30 bg-amber-400/[0.06] p-5">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber-400">Verdict</div>
        <p className="mt-1 text-[15px] leading-relaxed text-amber-50">{r.verdict}</p>
      </div>

      <div className="mt-8 flex justify-between gap-3 border-t border-white/10 pt-4 text-sm">
        {prev ? <button onClick={() => go(prev.id)} className="text-left text-slate-400 hover:text-white">← {prev.code}</button> : <span />}
        {next ? <button onClick={() => go(next.id)} className="text-right text-slate-400 hover:text-white">{next.code} →</button> : <span />}
      </div>
    </article>
  );
}

export default function App() {
  const read = () => window.location.hash.replace("#", "") || "overview";
  const [id, setId] = useState(read());
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const f = () => { setId(read()); window.scrollTo({ top: 0 }); };
    window.addEventListener("hashchange", f);
    return () => window.removeEventListener("hashchange", f);
  }, []);
  const go = (to: string) => { window.location.hash = to; setOpen(false); };
  const idx = REVIEWS.findIndex((r) => r.id === id);
  const current = idx >= 0 ? REVIEWS[idx] : null;

  const nav = (
    <nav className="space-y-6">
      <button onClick={() => go("overview")} className={cn("block w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition", id === "overview" ? "bg-amber-400/15 text-amber-200" : "text-slate-300 hover:bg-white/5")}>Overview & ranking</button>
      {GROUPS.map((g) => (
        <div key={g.key}>
          <div className="mb-1 px-3 font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">{g.label}</div>
          {REVIEWS.filter((r) => r.group === g.key).map((r) => (
            <button key={r.id} onClick={() => go(r.id)} className={cn("block w-full rounded-lg px-3 py-1.5 text-left text-sm transition", id === r.id ? "bg-amber-400/15 text-amber-200" : "text-slate-400 hover:bg-white/5 hover:text-slate-200")}>
              {r.code}
              {r.org && <span className="block text-[10px] text-slate-600">{r.org}</span>}
            </button>
          ))}
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-[#0a0e13] text-slate-200" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-white/10 bg-[#0a0e13]/90 px-4 py-3 backdrop-blur lg:hidden">
        <span className="text-sm font-semibold text-white">Challenge review</span>
        <button onClick={() => setOpen(!open)} className="rounded-lg border border-white/15 px-3 py-1 text-xs text-slate-300">{open ? "Close" : "Sections"}</button>
      </div>
      {open && <div className="fixed inset-x-0 bottom-0 top-[49px] z-20 overflow-auto bg-[#0a0e13] p-4 lg:hidden">{nav}</div>}
      <div className="mx-auto flex max-w-[1500px]">
        <aside className="sticky top-0 hidden h-screen w-72 shrink-0 overflow-auto border-r border-white/10 p-5 lg:block">
          <div className="mb-6">
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-amber-400">Almere 2026</div>
            <div className="text-lg font-semibold text-white">Challenge review</div>
          </div>
          {nav}
        </aside>
        <main className="min-w-0 flex-1 px-4 py-8 md:px-10">
          <div className="mx-auto max-w-5xl">
            {id === "overview" || !current ? <Overview go={go} /> : <ReviewView r={current} prev={REVIEWS[idx - 1]} next={REVIEWS[idx + 1]} go={go} />}
          </div>
        </main>
      </div>
    </div>
  );
}

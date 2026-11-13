import Link from "next/link";
import { IDEAS, TRACKS, weighted } from "@/lib/ideas";
import { Panel } from "@/components/ui";

const SPARKS = [
  {
    title: "Alarm Budget",
    track: "Cross-cutting (Nexus UX)",
    body: "A visible interruptions-per-hour counter in the operator UI, with a rule: every alert must declare ‘what would the operator do with this?’ or be demoted to a passive list. Show the budget live in your demo. It speaks directly to ‘alarm fatigue’ and ‘only interrupted when a human is really needed’.",
  },
  {
    title: "Misclick-Safe Action Kit",
    track: "Cross-cutting (Nexus UX)",
    body: "A tiny library of patterns: hold-to-confirm for consequential actions, a 10-second undo toast, scoped selection (what exactly will this affect?), and distinct sizes/positions for ‘approve’ and ‘reject’. Judges explicitly ask what happens after a misclick; demonstrate one on purpose.",
  },
  {
    title: "Why-Not-Alert Explorer",
    track: "Mantavia",
    body: "Pick any vessel and time and see its feature values against each threshold, with ‘would have alerted if speed drop were 2 kn larger’. It is excellent for judge Q&A, builds trust, and is a natural by-product of interpretable scoring.",
  },
  {
    title: "Frozen-Config Harness",
    track: "Mantavia",
    body: "One command: given a date, it downloads/loads data, runs, and prints the config hash, runtime, coverage, alert episodes, and a timeline. Prevents the ‘judges pick a date, you touch the code’ failure and makes your week-long alert-burden table reproducible.",
  },
  {
    title: "Wind-Drift Cone",
    track: "Nexus OSINT",
    body: "From wind speed/direction (and its age) draw a drift cone for a descending payload or loitering drone on the map, widening as the data ages. A compact way to make OSINT staleness visible and consequential.",
  },
  {
    title: "Overhead Window",
    track: "Nexus OSINT",
    body: "Use public satellite orbital elements to show when imaging satellites can see a site, as a planning aid for concealment or movement. Be honest about limits: public elements are only a subset, accuracy decays with age (itself a staleness story), and it says nothing about what a sensor actually captured.",
  },
  {
    title: "Streaming ISP Core Model",
    track: "Thermal",
    body: "Write the pipeline as a line-based fixed-point C++ model with explicit line buffers and a one-frame-latency AGC. Report bits, buffers and operations per pixel. Even without Verilog, this earns the ‘streaming’ tie-breaker.",
  },
];

export default function More() {
  const fresh = IDEAS.filter((i) => i.group === "new");
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header>
        <p className="text-xs font-bold uppercase tracking-widest text-cyan-400">Beyond your list</p>
        <h1 className="mt-1 text-3xl font-bold text-white">More ideas worth exploring</h1>
        <p className="mt-2 max-w-3xl text-slate-300">
          Four full ideas, each with a preview, built from reading the judging criteria rather than the problem titles.
          Then seven smaller sparks you can bolt onto whichever track you choose.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {fresh.map((i) => (
          <Link
            key={i.slug}
            href={`/ideas/${i.slug}`}
            className="group rounded-xl border border-slate-800 bg-slate-900/70 p-4 transition hover:border-cyan-500/60"
          >
            <div className="flex items-center justify-between">
              <span className={`rounded-md border px-1.5 py-0.5 text-[11px] font-semibold ${TRACKS[i.track].chip}`}>
                {TRACKS[i.track].label}
              </span>
              <span className="text-xs text-slate-400">Score {weighted(i.scores).toFixed(2)}</span>
            </div>
            <h2 className="mt-2 text-xl font-bold text-white group-hover:text-cyan-300">
              {i.n}. {i.title}
            </h2>
            <p className="mt-1 text-sm italic text-slate-300">{i.tagline}</p>
            <p className="mt-3 text-sm text-slate-200">{i.verdict}</p>
            <p className="mt-3 text-xs font-semibold text-cyan-300">Open review + live preview →</p>
          </Link>
        ))}
      </div>

      <Panel title="Seven smaller sparks">
        <div className="grid gap-3 md:grid-cols-2">
          {SPARKS.map((s) => (
            <div key={s.title} className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{s.track}</p>
              <p className="font-semibold text-white">{s.title}</p>
              <p className="mt-1 text-sm text-slate-300">{s.body}</p>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Principles that held across every idea">
        <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-200">
          <li>
            <strong className="text-white">Unknown is a state.</strong> ‘No data’, ‘no activity’ and ‘nothing wrong’ must look
            different.
          </li>
          <li>
            <strong className="text-white">Show the hypothesis, not the verdict.</strong> Group, flag and estimate, but keep the
            raw evidence one click away.
          </li>
          <li>
            <strong className="text-white">Effects over displays.</strong> A feature that changes a decision beats one that
            changes a colour.
          </li>
          <li>
            <strong className="text-white">Interpretable beats clever.</strong> Judges, operators and mentors can’t interrogate a
            black box on stage.
          </li>
          <li>
            <strong className="text-white">Rehearse the failure.</strong> The best demo moment in every idea is something
            breaking and the system handling it honestly.
          </li>
        </ol>
      </Panel>
    </div>
  );
}

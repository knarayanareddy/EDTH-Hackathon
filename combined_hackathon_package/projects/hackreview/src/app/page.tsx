import Link from "next/link";
import { Matrix } from "@/components/Matrix";
import { Panel } from "@/components/ui";

const STRATEGIES = [
  {
    title: "Nexus, safest",
    tone: "border-cyan-500/40",
    pick: "OSINT Readiness Board + BlindSpot (+ Handover timeline as a stretch)",
    why: "Judges name ‘staleness and readiness of the integrated OSINT and its effect on the application’ as an example of operational relevance. You answer that sentence literally, and the live ‘pull the feed’ demo is easy to run.",
    links: [
      ["osint-readiness", "OSINT Readiness"],
      ["blindspot", "BlindSpot"],
    ],
  },
  {
    title: "Nexus, high reward",
    tone: "border-violet-500/40",
    pick: "GeoClick: click on video → geolocated target with an error ellipse that holds up",
    why: "The only problem where the judges tell you what they will test (‘an error estimate that holds up’). Ground truth is known in SITL so you can prove calibration.",
    links: [["geoclick", "GeoClick"]],
  },
  {
    title: "Mantavia (needs data people)",
    tone: "border-amber-500/40",
    pick: "CableWatch with AIS Integrity as stage one, ISR cueing by reachability",
    why: "Objective judging: first alert vs damage time, weekly alert count, unseen day. Context modelling beats speed thresholds, and the Samus Swan case proves it (it was at ~9–10 kn).",
    links: [
      ["cablewatch", "CableWatch"],
      ["ais-integrity", "AIS Integrity"],
    ],
  },
  {
    title: "Thermal (needs a CV/perf person)",
    tone: "border-rose-500/40",
    pick: "SteadyThermal, with a 3-hour ThermalLab for yourselves",
    why: "Self-contained, no external dependencies, and judged by eye on four named defects. Plateau AGC with temporally smoothed LUT is your best weapon against flicker and lost scene.",
    links: [
      ["steadythermal", "SteadyThermal"],
      ["thermallab", "ThermalLab"],
    ],
  },
];

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="space-y-3">
        <p className="text-xs font-bold uppercase tracking-widest text-cyan-400">EuroDefense Tech · Almere 2026</p>
        <h1 className="text-3xl font-bold text-white md:text-5xl">Idea dossier</h1>
        <p className="max-w-3xl text-lg text-slate-300">
          Nine ideas reviewed against the three challenges (Intelic Nexus, Mantavia subsea AIS, Odd Systems thermal ISP),
          each with a live, simulated preview, concrete changes and questions to ask the mentors, plus four new ideas I
          think are worth your time.
        </p>
      </header>

      <Panel title="Bottom line">
        <div className="space-y-3 text-[15px] leading-relaxed text-slate-200">
          <p>
            <strong className="text-white">Don’t build nine things.</strong> Ideas 1–4 (SensorBridge, BlindSpot,
            Handover, SignalCheck) are four facets of one product: an honest information layer that says how old,
            how complete and how consistent the picture is. Build that once, aim it at the OSINT problem, and make it
            visibly change a decision.
          </p>
          <p>
            <strong className="text-white">Pick your track by the people you have.</strong> Data engineers → Mantavia.
            One strong image-processing developer → thermal. Backend + front-end + a UX tester → Nexus. The judging
            language across all tracks rewards teams that <em>understand the problem</em> over teams with the most
            code, so a narrow thing that is honest about its limits beats a wide thing that isn’t.
          </p>
          <p>
            <strong className="text-white">Three findings change the advice</strong> (details in{" "}
            <Link className="text-cyan-300 underline" href="/research">
              research notes
            </Link>
            ): the Samus Swan incident was on <strong>26 Feb 2022</strong> (not 28th) and the tanker was making about
            <strong> 9–10 kn</strong>, so a ‘slow vessel’ detector would miss it; EMODnet’s power-cable layers list
            German, French, Dutch and Norwegian sources, so the Bornholm–Sweden cable may be absent; and the Nexus
            extension surface described in the brief is telemetry, vehicle commands and map items, so don’t design
            around notes storage or custom UI panels until Intelic confirms them.
          </p>
        </div>
      </Panel>

      <section>
        <h2 className="mb-3 text-xl font-bold text-white">Four ways I would spend the weekend</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {STRATEGIES.map((s) => (
            <div key={s.title} className={`rounded-xl border bg-slate-900/70 p-4 ${s.tone}`}>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{s.title}</p>
              <p className="mt-1 font-semibold text-white">{s.pick}</p>
              <p className="mt-2 text-sm text-slate-300">{s.why}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {s.links.map(([slug, label]) => (
                  <Link
                    key={slug}
                    href={`/ideas/${slug}`}
                    className="rounded-md border border-slate-600 px-2 py-1 text-xs text-slate-200 hover:border-cyan-400 hover:text-cyan-300"
                  >
                    {label} →
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <Matrix />
      <p className="text-xs text-slate-500">
        Scores are my judgement, not data. Open any idea to change your own scores, status and notes; they are saved to
        the database and reflected here.
      </p>
    </div>
  );
}

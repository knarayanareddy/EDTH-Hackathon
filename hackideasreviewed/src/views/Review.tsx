import { Callout, Panel, Pill, SectionTitle, type Tone } from "../components/ui";

type Sev = "high" | "med" | "low";
const sevTone: Record<Sev, Tone> = { high: "red", med: "amber", low: "slate" };

const FINDINGS: { sev: Sev; where: string; what: string; fix: string; how: string }[] = [
  {
    sev: "high",
    where: "hackreview · api/state/*",
    what: "PUT /api/state/[slug] and GET /api/state have no authentication, rate limit or ownership check. Anyone who finds the URL can overwrite every note, score and status.",
    fix: "Add a shared-secret header or session cookie before any public deploy; or drop the database and store triage in localStorage + JSON export.",
    how: "Read both route files in full: no auth code.",
  },
  {
    sev: "high",
    where: "hackreview · IdeaWorkspace.tsx",
    what: "persist() keeps ONE shared timer and each call sends only the changed field. Change status, then edit a note inside the debounce window: the status save is cancelled and never sent. This is a real, reproducible data-loss bug.",
    fix: "Keep a pending-patch object, merge every change into it, and send the merged patch when the timer fires (or one timer per field).",
    how: "Read lines 20–60: timer.current cleared on each call; patch is not merged.",
  },
  {
    sev: "med",
    where: "hack2ndrun · previews/NexusGeo.tsx",
    what: "The Monte-Carlo 'coverage' check samples from the same Gaussian, flat-earth model that produced the ellipse. It checks the linearisation, not the real world. It also ignores roll, click-pixel error, lens-intrinsics error, terrain relief and target motion, and it silently drops samples whose ray misses the ground (conditioning bias at shallow angles).",
    fix: "Validate against an independent ground truth: a SITL that renders a known target with injected, un-modelled errors (terrain, roll, latency). Report empirical coverage there. Use unscented / sampled propagation near the horizon instead of a Jacobian.",
    how: "Read gp(), the covariance block and runMC().",
  },
  {
    sev: "med",
    where: "hack2ndrun · previews/Mantavia.tsx",
    what: "13 hand-authored vessels whose features were typed in to make the contextual rule win. 'Real drags caught: n/2' is therefore true by construction, and the label wrongly implies real data. The ISR planner is greedy and treats vessels as static.",
    fix: "Rename to 'planted drags found'. Replace with real DMA tracks and a replay of the Feb-2022 incident. Plan with predicted vessel positions (intercept geometry) and a hard return-to-base check.",
    how: "Read VESSELS table and the 'Real drags caught' stat.",
  },
  {
    sev: "med",
    where: "hack2ndrun · previews/GroundTruth.tsx",
    what: "'Independent sensors' is implemented as 'distinct sensor IDs'. Two nodes on one mesh, one power source or one radio cell are not independent evidence. The tests show software behaviour, not detection performance.",
    fix: "Add a 'shared-cause group' field (same gateway / site / modality) and count corroboration per group, not per ID.",
    how: "Line 27: present.size >= 2 → 'corroborated'.",
  },
  {
    sev: "low",
    where: "both repos",
    what: "Two codebases (Next.js + Postgres vs Vite) implement ~8 overlapping ideas twice with diverging logic (GeoClick vs NexusGeo, Handover ×2, SignalCheck vs GroundTruth…). Neither was run end-to-end against the real challenge inputs (thermal .bin, AIS, Nexus SDK).",
    fix: "Keep one app. Delete the database. Treat idea pages as data (one JSON), previews as pure-logic libraries with unit tests.",
    how: "Compared both file trees.",
  },
];

const FACTS: { claim: string; status: "confirmed" | "corrected" | "open"; note: string }[] = [
  { claim: "Samus Swan cable failure on 28 Feb 2022 (brief)", status: "corrected", note: "Energinet, Maritime Executive, Baltic Wind and the Danish court all say 26 Feb 2022, 06:17 local = 05:17 UTC. Ask Mantavia which file they mean; build for 26 Feb." },
  { claim: "Signature is 'a few knots'", status: "corrected", note: "Pole Star AIS shows Samus Swan making ~9–10 kn at 05:18 UTC, ~17 km from Sweden and ~26 km from Bornholm. A speed gate misses the one incident you must detect." },
  { claim: "Date window 7–16 Sep 2026 might be in the future", status: "confirmed", note: "EDTH events run 6 Nov–Dec 2026, so the window is already past. DMA posts one zip per day ~3 days behind – download all ten days now." },
  { claim: "Eagle S charges dismissed on jurisdiction", status: "confirmed", note: "Helsinki District Court, Oct 2025: damage in the EEZ, not territorial waters. Another reason alerts must say 'behaviour to verify', not 'culprit'." },
  { claim: "Danish civil case vs Samus Swan owner", status: "confirmed", note: "Court found no gross negligence (Jul 2025); Energinet's ~DKK 38 M claim largely failed. Attribution disputes are the norm, not the exception." },
  { claim: "Fitburg (31 Dec 2025) drag of ~130 km", status: "open", note: "One secondary source reports convictions; verify with primary Finnish court / police material before quoting on stage." },
  { claim: "Nexus 'runs in Ukraine'", status: "confirmed", note: "Intelic says deployed since 2025; Dutch MoD signed a ~€30 M, 3-year software-first deal in 2026. Judges are from a live product team – 'works on their stack' matters." },
  { claim: "Nexus SDK / MAVLink per-frame metadata", status: "open", note: "Not public. Everything about the extension contract is an assumption until mentors confirm it on day 1." },
];

const statusTone: Record<string, Tone> = { confirmed: "green", corrected: "amber", open: "slate" };

export default function Review() {
  return (
    <div className="space-y-6">
      <SectionTitle kicker="Part 1 · Critical review" title="What is actually in the package – and what to do with it">
        I read the README, the full idea index of both apps, and the source of the previews that make quantitative claims (error ellipse, anomaly gate, ISR planner,
        thermal lab, sensor corroboration, state API). Bugs below were confirmed in code; facts were re-checked against public sources.
      </SectionTitle>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Verdict" kicker="TL;DR" className="lg:col-span-2">
          <ul className="space-y-2 text-sm leading-relaxed text-slate-300">
            <li>
              <b className="text-white">Strong decision-support, no product yet.</b> 29 idea pages and ~25 interactive previews give a good map of the options, a sharp rubric reading
              ("calibrated trust = explainability + alarm-fatigue + staleness"), and honest risk notes. Nothing yet touches a real input: no AIS file, no thermal .bin frame, no Nexus SDK call.
            </li>
            <li>
              <b className="text-white">The best insights are buried.</b> Three are worth a whole entry: (1) the incident you must detect was a ~10 kn tanker, so context beats speed; (2) a click-to-target ellipse
              must be validated against an <i>independent</i> truth; (3) every judging criterion is "can the operator trust this number right now?".
            </li>
            <li>
              <b className="text-white">Breadth is the failure mode.</b> The package invites a team to "keep options open". The brief itself says winners understand the problem best, not those with most code.
              The fix is one hero demo with a measured number, not 29 previews.
            </li>
            <li>
              <b className="text-white">Simulations are labelled well, but a few metrics are circular</b> (planted drags "caught", Monte-Carlo on its own model). Fix the wording and the validation, and the credibility of the rest goes up.
            </li>
          </ul>
        </Panel>
        <Panel title="Package at a glance" kicker="Inventory">
          <table className="w-full text-xs">
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {[
                ["hackreview", "Next.js · Postgres · 13 ideas · 13 previews"],
                ["hack2ndrun", "Vite · static · 16 reviews · 15 previews"],
                ["Overlap", "GeoClick/NexusGeo, Handover, SignalCheck/GroundTruth, ThermalLab ×2, CableWatch/Mantavia"],
                ["Real data used", "None (thermal loader exists but unvalidated)"],
                ["Tests run before", "hack2ndrun: build + tsc. hackreview: not run"],
              ].map(([a, b]) => (
                <tr key={a}>
                  <td className="py-1.5 pr-2 font-semibold text-slate-200">{a}</td>
                  <td className="py-1.5">{b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>

      <Panel title="Code findings (verified by reading the source)" kicker="Bugs & validity gaps">
        <div className="space-y-3">
          {FINDINGS.map((f, i) => (
            <div key={i} className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <Pill tone={sevTone[f.sev]}>{f.sev.toUpperCase()}</Pill>
                <code className="text-[11px] text-slate-400">{f.where}</code>
              </div>
              <p className="text-sm text-slate-200">{f.what}</p>
              <p className="mt-1 text-[13px] text-emerald-300/90">
                <b>Fix:</b> {f.fix}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">How I verified: {f.how}</p>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Fact-check ledger" kicker="Source-backed vs assumed">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-1 pr-3">Claim</th>
                <th className="py-1 pr-3">Status</th>
                <th className="py-1">Evidence / action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 align-top text-slate-300">
              {FACTS.map((f) => (
                <tr key={f.claim}>
                  <td className="py-2 pr-3 font-medium text-slate-100">{f.claim}</td>
                  <td className="py-2 pr-3">
                    <Pill tone={statusTone[f.status]}>{f.status}</Pill>
                  </td>
                  <td className="py-2 leading-relaxed">{f.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Keep" kicker="Worth carrying forward">
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-300">
            <li>The "calibrated trust" reading of the Nexus rubric, and the Trust-Rail / misclick-proof / ghost-track demo moments.</li>
            <li>Episodes (not raw alerts) as the unit of success; tiered watch / review / cue-ISR output; AIS gaps as evidence; config hash printed at the spot check.</li>
            <li>Thermal: stable LUT rather than optimal frame, plateau-HE, motion-adaptive temporal filter, halo guard, and an A/B flicker plot.</li>
            <li>Plain-language limits on every panel ("not a verdict", "single source = cue").</li>
          </ul>
        </Panel>
        <Panel title="Change" kicker="What I would not ship as-is">
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-300">
            <li>Self-validating metrics → validate against an independent truth and report the failure cases too.</li>
            <li>Static-vessel greedy ISR → moving-target orienteering with intercept time and return-to-base margin.</li>
            <li>Idea-by-idea silos → shared "trust kernel" (value + error + age + provenance + readiness) used by every demo.</li>
            <li>Database-backed notes → none. A hackathon shortlist does not need Postgres.</li>
          </ul>
        </Panel>
      </div>

      <Callout tone="amber" title="Honest limit of this review">
        I could not download the thermal .bin (Google Drive), the Nexus SDK, or the AIS archive from here, so the previews that follow run on <b>deterministic mock data</b> and are marked as such.
        They are designed so the same code can later be pointed at the real inputs without changing the UI.
      </Callout>
    </div>
  );
}

import { useState } from "react";
import { Btn, Callout, Panel, Pill, SectionTitle } from "../components/ui";
import { cn } from "../utils/cn";

type Prof = "geo" | "cv" | "sys" | "auto" | "mixed";
const PROFILES: { k: Prof; label: string; pick: string; why: string; second: string; hours: [string, string][] }[] = [
  {
    k: "geo", label: "Python / geo / data", pick: "CABLEGUARD (Mantavia)",
    why: "The only brief where success is three public numbers you can rehearse alone, at home, with no hosted-environment risk. Judges can't argue with a first-alert time, a weekly alert count and a blind-date run.",
    second: "Add the Nexus bridge only if all three numbers are done: episodes → map items + an ISR task proposal with approval.",
    hours: [["Before the event", "Download all 10 days + 26 Feb 2022, clip to AOI, Parquet. Clean (MMSI validity, jumps, SOG > 40 kn, dup timestamps; ignore free-text). Digitise Bornholm–Sweden route openly."], ["Hours 0–8", "Class × lane baselines; episode detector; reason text from features."], ["Hours 8–16", "Incident replay, weekly burden table, suppression rules, freeze config + hash."], ["Hours 16–26", "Moving-target ISR planner, map UI, one-command run script."], ["Final", "Rehearse the blind-date run; record a fallback video."]],
  },
  {
    k: "cv", label: "Image processing / embedded", pick: "CLEARHOT (Thermal ISP)",
    why: "Data in hand, deterministic, judged on the screen. The edge comes from stable AGC and a flicker trace that proves what the jury sees, plus a credible streaming/resource story.",
    second: "Package as a Nexus video-processing extension (before/after toggle) only if the main videos are final.",
    hours: [["Hour 0–1", "Load .bin, frame count, naive min/max and percentile baselines."], ["Hours 1–4", "Explore: per-column mean over time, histogram drift, shutter/FFC steps, hot-object frames."], ["Hours 4–14", "Stripe + temporal + plateau AGC with smoothed LUT; A/B flicker plot."], ["Hours 14–22", "Halo-guarded detail, then speed (NumPy → Numba/C++)."], ["Hours 22–30", "Line-buffer rewrite, resource note, MP4 export, 3-pane before/after demo."]],
  },
  {
    k: "sys", label: "Frontend + backend (Rust/Go/Python)", pick: "TRUSTLINE (Nexus Problem 2 + trust layer)",
    why: "Nexus judges score UI under stress, trust and explainability: TrustLine is those criteria made into a product. The maths is a pure library, so it survives SDK surprises.",
    second: "Feed it a real OSINT input (GNSS-interference layer from public ADS-B integrity values) so Problem 3's 'why is this useful' is answered inside Problem 2.",
    hours: [["Before the event", "Pure library: pixel + pose → ground point + sampled covariance; validator vs simulated truth; unit tests."], ["Hours 0–8", "Wrap as extension: click on video → candidate map item with ellipse + provenance (confirm what metadata Nexus gives)."], ["Hours 8–16", "Handoff states, hold-to-promote + undo, notification budget."], ["Hours 16–22", "Live degrade demo (stale telemetry / GNSS layer) + ghost track."], ["Final", "Show empirical coverage plot and the failure case honestly."]],
  },
  {
    k: "auto", label: "Autonomy / simulation / swarm", pick: "AIRBASE SENTINEL + RED-TEAM",
    why: "It is the team's own project cut to the one slice that demos in a weekend: a decoy-aware counter-UAS policy and the harness that finds where it breaks. It also hits the Nexus brief's own example threats.",
    second: "Wrap Sentinel as a Nexus extension (tracks as map items, tasks as proposals). Keep Red-Team standalone: it is the part nobody else will have.",
    hours: [["Before the event", "Engagement sim (swap for PX4 SITL later), policies, seeded runner, Wilson intervals."], ["Hours 0–8", "Sentinel triage + tasking on SITL or toy sim; explainable track list; interrupt rules."], ["Hours 8–16", "Sweep: scenario space, failure map, adaptive boundary, failure replay."], ["Hours 16–24", "Sim-to-real hook: fit one parameter from any real flight log you can get."], ["Final", "Demo: operator quiet run, then the red-team map and a replayed failure."]],
  },
  {
    k: "mixed", label: "Mixed / undecided", pick: "CABLEGUARD, with TRUST KERNEL reused",
    why: "Lowest regret: public data, offline prep, three crisp numbers, and a good 'honest uncertainty' story. Reuse the trust kernel (value + error + age + provenance) in the UI so nothing is shown without its limits.",
    second: "If two people want Nexus, they build TrustLine's maths library in parallel and merge only if the SDK cooperates on day 1.",
    hours: [["This week", "Everyone downloads their data (AIS, thermal .bin, SDK docs) and runs a baseline."], ["Day 0 evening", "Decision meeting using the Scorecard weights; one hero, one support module, no third thing."], ["Hours 0–24", "Hero build; support module only as a thin wrapper."], ["Hours 24–30", "Demo rehearsal ×3; fallback video."]],
  },
];

const EXTRAS: { name: string; tag: string; why: string; data: string; risk: string; fit: string }[] = [
  { name: "GNSS-interference map from ADS-B integrity fields", tag: "OSINT · Nexus P3", why: "Civil aircraft broadcast navigation-accuracy/integrity categories. Aggregated over a grid they show where GNSS is degraded – the one OSINT input that directly changes an operator's number (drone position error).", data: "Public ADS-B (OpenSky / ADSB-style feeds), cell age shown per tile", risk: "Sparse coverage at low altitude and in remote areas: show 'no data' explicitly, never 'clean'.", fit: "Feeds TRUSTLINE σ(GNSS)." },
  { name: "Overhead window: when can satellites see us?", tag: "OSINT · Nexus P3", why: "Public orbital elements → SGP4 → pass windows over the area, with element age widening the timing uncertainty. A concrete answer to 'argue why this integration is useful'.", data: "CelesTrak-style public TLEs", risk: "Only catalogued satellites; prediction is approximate; don't imply knowledge of classified assets.", fit: "Small, fast module for Nexus; good staleness story." },
  { name: "AIS integrity desk (spoofing, jumps, identity)", tag: "Maritime · Mantavia", why: "Before asking what a vessel does, ask if the track is usable: teleporting positions, MMSI collisions, impossible speeds, duplicated identities. Doubles as the cleaning step the brief demands.", data: "Same DMA files", risk: "Easy to over-claim 'spoofing'. Report 'inconsistent', with the rule that fired.", fit: "Part of CABLEGUARD's ingest." },
  { name: "Evidence ledger / handover timeline", tag: "Nexus UX", why: "Shift change in a bunker: what is confirmed, contradicted, unresolved, stale. Each item carries source and age.", data: "Operator action log + extension events", risk: "Low wow on its own; strong as a module.", fit: "Reuse inside TRUSTLINE/SENTINEL." },
  { name: "Acoustic drone-detection mesh (phones/ESP32)", tag: "Counter-UAS", why: "Cheap, distributed detection of small drones; silent nodes count as unknowns, not as 'clear'.", data: "Own recordings / public acoustic datasets", risk: "Hardware + field risk in 36 h; weak without real recordings.", fit: "Simulator-first, hardware as a flourish." },
  { name: "Thermal ISP as a Nexus video extension", tag: "Cross-challenge", why: "Nexus lists video processing as an extension type; a visible before/after on the operator's screen.", data: "Thermal challenge file", risk: "Needs thermal-like video in the SITL; only after the ISP is final.", fit: "Bridge for CLEARHOT." },
];

const ASK: { who: string; qs: string[] }[] = [
  { who: "Intelic (Nexus)", qs: ["What metadata arrives with the MAVLink video: intrinsics, gimbal attitude, per-frame timestamp?", "Can an extension publish an ellipse/polygon as a map item, attach provenance fields, and propose (not execute) a task?", "Is there a DEM/terrain service, or only the flat-earth surface?", "Is there an existing approval/proposal object we should reuse?"] },
  { who: "Mantavia", qs: ["Samus Swan: 26 Feb (06:17 local, 05:17 UTC) or 28 Feb? Which file and which cable geometry is intended?", "Confirm the AOI dates/year and that the spot-check reads a DMA file as-is.", "Is the ISR platform cued on static positions, or should the plan predict vessel motion?"] },
  { who: "The Fourth Law / Odd Systems", qs: ["How many sequences and what do they contain (static, handheld, vehicle)? Preferred codec/fps for MP4s?", "For the FPGA bonus: is a bit-accurate C/HLS model enough, or is Verilog expected?"] },
];

const CHECK: [string, string][] = [
  ["AIS", "All ten days 7–16 Sep 2026 + 26 Feb 2022 (DMA daily zips ≈ 3 days behind). Clip to 54.5–56.0 N / 13.5–16.0 E → Parquet. Verify file for the incident day contains the Bornholm area."],
  ["Thermal", "Download the .bin now; frames = size ÷ 655 360. Plot per-frame min/max/mean and per-column mean before designing anything."],
  ["Nexus", "Ask for SDK/offline portal early; build the maths library against the mock API; don't assume metadata."],
  ["Evidence", "Label every number: measured / simulated / assumed. Put the config hash and git commit on the demo screen."],
  ["Demo", "Record a fallback video of each path. Prepare the 'what we could not see' slide first – judges reward honesty."],
];

export default function Plan() {
  const [prof, setProf] = useState<Prof>("mixed");
  const p = PROFILES.find((x) => x.k === prof)!;
  return (
    <div className="space-y-6">
      <SectionTitle kicker="Part 4 · Recommendation & research" title="What I would actually do, and what else is worth knowing">
        One hero, one supporting module, evidence for every number. Pick your team profile to see the recommended path and a 36-hour plan.
      </SectionTitle>

      <Panel title="Team profile → recommended entry" kicker="Interactive">
        <div className="mb-3 flex flex-wrap gap-2">{PROFILES.map((x) => <Btn key={x.k} active={prof === x.k} onClick={() => setProf(x.k)}>{x.label}</Btn>)}</div>
        <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
          <div className="space-y-3">
            <div className="rounded-xl border border-cyan-500/40 bg-cyan-500/10 p-4"><div className="text-[10px] uppercase tracking-widest text-cyan-300">Build</div><div className="text-xl font-bold text-white">{p.pick}</div></div>
            <p className="text-sm leading-relaxed text-slate-300"><b className="text-white">Why:</b> {p.why}</p>
            <p className="text-sm leading-relaxed text-slate-300"><b className="text-white">Only then:</b> {p.second}</p>
          </div>
          <ol className="space-y-2">{p.hours.map(([w, t], i) => <li key={i} className="flex gap-3 rounded-lg bg-slate-950/60 p-2.5 text-sm"><span className="w-28 shrink-0 font-mono text-xs text-cyan-300">{w}</span><span className="text-slate-300">{t}</span></li>)}</ol>
        </div>
      </Panel>

      <Panel title="The pattern behind every winning-shaped idea here" kicker="Trust kernel">
        <div className="grid gap-3 md:grid-cols-4">
          {[["1 · Every number has an error", "An ellipse, an interval, a range – never a bare value."], ["2 · Every input has an age", "Stale = visibly degraded and the downstream number gets worse, automatically."], ["3 · Validate on an independent truth", "Simulated world with un-modelled errors, public incident, blind date. Report the miss, too."], ["4 · Interrupt rarely, say why", "A budget of 2–3 situations. Everything else stays quiet and logged."]].map(([a, b]) => (
            <div key={a} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3"><div className="text-sm font-semibold text-white">{a}</div><div className="mt-1 text-xs leading-relaxed text-slate-400">{b}</div></div>
          ))}
        </div>
      </Panel>

      <Panel title="Other ideas surfaced by the research" kicker="Components and alternates">
        <div className="grid gap-3 md:grid-cols-2">
          {EXTRAS.map((e) => (
            <div key={e.name} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs">
              <div className="mb-1 flex flex-wrap items-center gap-2"><span className="text-sm font-semibold text-white">{e.name}</span><Pill tone="violet">{e.tag}</Pill></div>
              <p className="leading-relaxed text-slate-300">{e.why}</p>
              <p className="mt-1 text-slate-400"><b className="text-slate-300">Data:</b> {e.data}</p>
              <p className="text-amber-300/90"><b>Risk:</b> {e.risk}</p>
              <p className="text-emerald-300/90"><b>Fit:</b> {e.fit}</p>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Questions to put to mentors on day 1" kicker="Resolve before you build on it">
          <div className="space-y-3">{ASK.map((a) => <div key={a.who}><div className="mb-1 text-xs font-semibold uppercase tracking-wider text-cyan-300">{a.who}</div><ul className="list-disc space-y-1 pl-5 text-xs text-slate-300">{a.qs.map((q) => <li key={q}>{q}</li>)}</ul></div>)}</div>
        </Panel>
        <Panel title="Before the event" kicker="Checklist">
          <ul className="space-y-2">{CHECK.map(([a, b]) => <li key={a} className={cn("flex gap-3 rounded-lg bg-slate-950/60 p-2.5 text-xs")}><span className="w-16 shrink-0 font-semibold text-cyan-300">{a}</span><span className="text-slate-300">{b}</span></li>)}</ul>
        </Panel>
      </div>

      <Callout tone="amber" title="Sources used for the facts in this review">
        Energinet / Maritime Executive / Baltic Wind / Danish court reporting (Samus Swan: 26 Feb 2022, 06:17 local; ~9–10 kn; no gross negligence found, Jul 2025); gCaptain, Small Wars Journal and Submarine Networks (Eagle S, Fitburg, Baltic Sentry);
        DMA AIS page and a public loader note on its daily-zip cadence; Intelic press coverage (Nexus in Ukraine since 2025; Dutch MoD agreement); EDTH event listings (Nov 2026 events). Treat single-source claims as "to verify".
      </Callout>
    </div>
  );
}

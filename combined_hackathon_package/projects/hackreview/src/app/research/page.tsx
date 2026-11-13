import { Panel } from "@/components/ui";

const FACTS: { claim: string; status: "verified" | "corrected" | "unverified" | "caution"; evidence: string; action: string }[] = [
  {
    claim: "Samus Swan cable incident date: 28 Feb 2022 (challenge brief)",
    status: "corrected",
    evidence:
      "Maritime Executive, the 2025 court-ruling coverage and Energinet-related reporting all give 26 February 2022. Power to Bornholm was lost at 06:17 local time (about 05:17 UTC); Pole Star’s AIS snapshot is timed 06:18 local.",
    action:
      "Replay 26 Feb. Ask the mentors which timestamp they treat as ‘time of reported damage’. Pull 25–27 Feb to cover either reading.",
  },
  {
    claim: "Dragging vessels move at a few knots",
    status: "caution",
    evidence:
      "AIS showed Samus Swan passing at about 9–10 kn, and the court found the crew did not realise the anchor had dropped; the master noticed speed loss and focused on the engines. Longer drags in the Gulf of Finland (Eagle S) and Yi Peng 3 / NewNew Polar Bear covered tens to over a hundred kilometres.",
    action:
      "Model deviation from the vessel’s own baseline (speed drop, course drift) in context, not an absolute slow-speed rule.",
  },
  {
    claim: "Fault location",
    status: "verified",
    evidence:
      "TGS 4C citing Energinet: the fault may be about 17 km from Sweden and 26 km from Bornholm on the 60 kV Hasle–Borrby cable (three ~50 km XLPE cables, commissioned 1980).",
    action: "Use as a sanity check for your corridor geometry; if the cable layer is off by kilometres, you will see it.",
  },
  {
    claim: "EMODnet has the infrastructure layer",
    status: "unverified",
    evidence:
      "Power and telecom ‘actual route’ datasets are CC BY 4.0 and available through WFS/WMS or downloads. The power layer’s published sub-layers are BSH/Contis (DE), SHOM (FR), Rijkswaterstaat (NL) and NVE (NO). I could not confirm a Danish or Swedish contributor for the Bornholm–Sweden cable.",
    action:
      "Fetch it in week one and test whether the cable appears near 55.3°N, 14.4°E. If not, digitise from a documented public source (OpenStreetMap power=cable, charts or TSO maps) and record provenance.",
  },
  {
    claim: "DMA AIS archive is large",
    status: "verified",
    evidence:
      "Secondary sources describe daily CSVs of roughly 10–20 million rows and several GB uncompressed for Danish waters. The columns include timestamp, type of mobile, MMSI, lat/lon, nav status, ROT, SOG, COG, heading, IMO, call sign, name, ship type, cargo type, dimensions, draught, destination and ETA.",
    action:
      "Stream-filter to the bbox (54.5–56.0 N, 13.5–16.0 E) as you unzip; keep only the columns you need; store Parquet. Check decimal separators and timezone on the first file.",
  },
  {
    claim: "Demo window 7–16 Sep 2026 sits inside free coverage",
    status: "caution",
    evidence:
      "The archive is the Danish authority’s; coverage thins towards the eastern edge of the bbox (16° E is near the Swedish and Polish areas). Public documentation also warns that ship-reported data contain errors.",
    action:
      "Compute a coverage map per day (messages per cell per hour). Report ‘insufficient coverage’ explicitly.",
  },
  {
    claim: "Nexus extension surface",
    status: "caution",
    evidence:
      "The brief lists: Extension SDK (Go, Rust, Python), intelic-cli, Hub and C4I APIs for telemetry, vehicle commands and map items (Swagger on port 2998), an offline mock portal, and mentors. Public reporting describes Nexus as a platform-agnostic C2 layer for unmanned systems, used in Ukraine since 2025 and planned for Dutch forces. Nothing public confirms notes storage, custom UI panels, or event subscriptions.",
    action:
      "Ask in the first hour. Design against telemetry + map items + commands, and treat anything else as a bonus.",
  },
  {
    claim: "Thermal data format",
    status: "verified",
    evidence:
      "640×512 uint16 little-endian, no header; frames = bytes / 655,360. A full frame is 327,680 px × 14 bit ≈ 4.59 Mbit. At 25 fps the pixel rate is about 8.2 Mpx/s: trivial for an FPGA, so the real constraint is frame-buffer memory, not clock speed.",
    action: "Check the file size is an integer multiple of 655,360 before anything else.",
  },
];

const STATUS_STYLE = {
  verified: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  corrected: "border-red-500/40 bg-red-500/10 text-red-300",
  unverified: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  caution: "border-violet-500/40 bg-violet-500/10 text-violet-300",
} as const;

const CRITERIA = [
  {
    track: "Nexus (Intelic)",
    items: [
      "Operational relevance: for problem 2 an error estimate that holds up; for problem 3 staleness and readiness and their effect on the application.",
      "UI/UX: reduce cognitive load and alarm fatigue; design for a bunker; what happens after a misclick?",
      "Trust and explainability: why does the system recommend this; interrupt the human only when needed.",
      "Demo: end to end, live, on your own Nexus stack.",
    ],
    tips: [
      "Every alert should answer ‘what would you do with this?’. If nothing, demote it.",
      "Use text + shape + colour for state; never colour alone.",
      "Make every consequential action confirmable and undoable. Demonstrate a deliberate misclick in your demo.",
      "Rehearse the failure path, not just the happy path.",
    ],
  },
  {
    track: "Mantavia",
    items: [
      "A real incident with time of first alert vs reported damage.",
      "Alert burden over the surrounding week in the same area.",
      "A live spot check on a judge-chosen date from the window, with no code changes.",
    ],
    tips: [
      "Freeze config; print its hash on screen.",
      "Report alert episodes, not messages.",
      "Know the answer to ‘why was the alert late/early?’ and ‘what did you not alert on?’.",
      "Do not claim an anchor drag; claim behaviour consistent with it, for verification.",
    ],
  },
  {
    track: "Odd Systems (Thermal)",
    items: [
      "Image quality by eye on the same test sequences.",
      "Tie-breakers: speed, resources, streaming, reasoning.",
      "Defects: flicker, lost scene, ghosting, new artifacts (halos, stripes, plastic texture).",
    ],
    tips: [
      "Find the hardest segment first and tune on it.",
      "Show the four defects absent on a split screen against the naive baseline.",
      "Bring a one-slide resource note: buffers, bit widths, ops per pixel.",
    ],
  },
];

export default function Research() {
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header>
        <p className="text-xs font-bold uppercase tracking-widest text-cyan-400">Research notes</p>
        <h1 className="mt-1 text-3xl font-bold text-white">Fact-check & what the judges said they want</h1>
        <p className="mt-2 text-slate-300">
          I checked the claims in your suggested ideas against public sources. Where I couldn’t verify something, I say
          so. Nothing here is based on non-public Intelic or Mantavia material.
        </p>
      </header>

      <Panel title="Claim-by-claim">
        <div className="space-y-4">
          {FACTS.map((f) => (
            <div key={f.claim} className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-md border px-1.5 py-0.5 text-[11px] font-bold uppercase ${STATUS_STYLE[f.status]}`}>
                  {f.status}
                </span>
                <p className="font-semibold text-white">{f.claim}</p>
              </div>
              <p className="mt-2 text-sm text-slate-300">
                <span className="font-semibold text-slate-400">Evidence: </span>
                {f.evidence}
              </p>
              <p className="mt-1 text-sm text-cyan-200">
                <span className="font-semibold text-cyan-400">What to do: </span>
                {f.action}
              </p>
            </div>
          ))}
        </div>
      </Panel>

      <section>
        <h2 className="mb-3 text-xl font-bold text-white">Judging criteria, translated into actions</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          {CRITERIA.map((c) => (
            <Panel key={c.track} title={c.track}>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">They said</p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-slate-300">
                {c.items.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
              <p className="mb-1 mt-4 text-xs font-semibold uppercase tracking-wide text-cyan-400">So you should</p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-slate-200">
                {c.tips.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </Panel>
          ))}
        </div>
      </section>

      <Panel title="Mantavia: pre-event checklist (the part that decides the result)">
        <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-200">
          <li>Download all ten days (7–16 Sep 2026) as soon as published, plus the surrounding week for your incident (around 26 Feb 2022). Verify checksums.</li>
          <li>
            Stream-filter on the way in. Example:{" "}
            <code className="rounded bg-slate-800 px-1 text-cyan-200">unzip -p day.zip | duckdb -c &quot;…&quot;</code> using a
            bbox filter on latitude/longitude, then write Parquet.
          </li>
          <li>Pull EMODnet power and telecom cables; clip to the bbox; test they contain the Bornholm–Sweden cable.</li>
          <li>Digitise a documented fallback cable geometry. Record the source and date.</li>
          <li>Build polygons for anchorages, fishing grounds, port approaches and ferry lanes from public sources.</li>
          <li>Run the whole pipeline on a single day, end to end, before improving any model.</li>
          <li>Write the one-command run: <code className="rounded bg-slate-800 px-1 text-cyan-200">run --date 2026-09-10</code>, printing the config hash and runtime.</li>
        </ol>
      </Panel>

      <Panel title="Nexus: the first-hour questions">
        <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-200">
          <li>Can an extension register non-vehicle entities and style map items (status, hatching, tooltips)?</li>
          <li>Is there an event stream, or do we poll? What are the rate limits?</li>
          <li>Can we persist anything (notes, state) inside Nexus? If not, what is the sanctioned companion pattern?</li>
          <li>What video SITL and gimbal telemetry do we get for the click-to-geolocate problem?</li>
          <li>Can an extension create a draft task that waits for operator approval?</li>
          <li>Which OSINT feeds and licences are acceptable for a demo?</li>
        </ol>
      </Panel>

      <Panel title="Method literature and context">
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {[
            ["https://peerj.com/articles/cs-1572", "PeerJ CS: AIS anomaly detection (listed by Mantavia)"],
            ["https://www.ejiltalk.org/christmas-day-cable-cuts-in-the-baltic-sea/", "EJIL:Talk: anchor-drag lengths and chronology"],
            ["https://www.nist.gov/itl/ai-risk-management-framework", "NIST AI RMF: transparency and human oversight"],
            ["https://www.ogc.org/standards/sensorthings/", "OGC SensorThings: data-model vocabulary"],
            ["https://www.dma.dk/safety-at-sea/navigational-information/ais-data", "DMA: AIS data and limitations"],
          ].map(([u, l]) => (
            <li key={u}>
              <a className="text-cyan-300 hover:underline" href={u} target="_blank" rel="noreferrer">
                {l}
              </a>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

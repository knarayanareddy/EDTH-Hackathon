import { Callout, H, Panel, Pill } from "./components/ui";

function Table({ head, rows }: { head: string[]; rows: (string | React.ReactNode)[][] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-white/10">
      <table className="w-full text-left text-xs">
        <thead className="bg-white/5 text-slate-400"><tr>{head.map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-white/5 align-top">{r.map((c, j) => <td key={j} className={`px-3 py-2 ${j === 0 ? "font-semibold text-slate-100" : "text-slate-300"}`}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

export function NexusExtra() {
  return (
    <>
      <H kicker="Deep dive">The three example problems, compared</H>
      <Table
        head={["Problem", "What's actually hard", "How it can be proven", "Trap", "My rating"]}
        rows={[
          ["1 · Commander intent → tasks", "Safety and explainability across vehicles with different limits; resolving conflicts between tasks.", "Constraint tests (wind, battery, geofence) and an explanation per assignment.", "Dressing a text box as 'AI'. Judges ask 'why this vehicle?'", <Pill key="a" tone="amber">good, needs rigour</Pill>],
          ["2 · Recon-to-strike from video", "Camera geometry, time sync, terrain, and an error estimate that is actually calibrated.", "Monte-Carlo coverage test; compare to SITL ground truth.", "A single pin with a made-up '90% confidence'.", <Pill key="b" tone="green">best fit</Pill>],
          ["3 · OSINT integration", "Choosing a feed worth integrating, and handling staleness/coverage honestly.", "Show behaviour under stale/offline/out-of-coverage inputs.", "A pretty layer with no argument for operator value.", <Pill key="c" tone="amber">easy to do shallowly</Pill>],
        ]}
      />
      <H kicker="Why it matters">Where each judging criterion points</H>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[
          ["Operational relevance", "Pick the situation first (e.g. a drone seen for 5 s), then the code."],
          ["UI/UX", "Bunker test: one action per decision, no modal chains, undo, big targets."],
          ["Trust & explainability", "Every output has a reason line and an uncertainty. Interrupt only when human needed."],
          ["Demo quality", "Live, end-to-end, with one deliberate failure injected on stage."],
        ].map(([t, d]) => (
          <Panel key={t} title={t}><p className="text-xs leading-relaxed text-slate-400">{d}</p></Panel>
        ))}
      </div>
      <Callout tone="cyan" title="Prepare offline">The brief offers an offline API portal with mock APIs. Spend pre-event time on the pure maths library and a test harness, and only wire it into the extension contract once your team VM is live.</Callout>
    </>
  );
}

export function MantaviaExtra() {
  return (
    <>
      <H kicker="Research notes">Reference incidents (public reporting)</H>
      <Table
        head={["Case", "What the public record says", "What it means for a detector"]}
        rows={[
          ["Bornholm (Samus Swan), 26 Feb 2022", "Power cable Hasle-Borrby failed at 06:17 local (05:17 UTC) per Energinet reporting; fault about 17 km from Sweden / 26 km from Bornholm at ~50 m depth. A Danish court later found the master negligent but limited liability. Pole Star AIS capture shows ~9-10 kn near the time. Repair found older anchor/trawl damage as well.", "Your validation case may not look slow. Expect weather (heavy) as a confounder. Brief says 28 Feb: confirm."],
          ["Balticconnector (NewNew Polar Bear), Oct 2023", "Gas pipeline and data cable damaged; investigators attributed it to a dragged anchor. China said accident in a storm; Finnish/Estonian investigators were sceptical.", "Intent disputes are normal. Your output must not argue intent."],
          ["Yi Peng 3, Nov 2024", "Two data cables damaged; the ship was reportedly present at both. Allowed only observer access to an investigation, no charges.", "AIS gaps and attribution limits again."],
          ["Eagle S, 25 Dec 2024", "Estlink 2 and four telecom cables damaged; a drag mark of several dozen km (up to ~100 km) was found; a Finnish court dismissed charges on jurisdiction.", "Dragging can span tens of km: early warning is possible in principle, which is the point of the challenge."],
        ]}
      />
      <Callout tone="amber" title="Caveat">The numbers above come from news and trade-press summaries. Re-verify against primary sources (Energinet, court rulings, AIS itself) before putting any figure on a slide.</Callout>

      <H kicker="Back-of-envelope">The ISR budget</H>
      <div className="grid gap-3 md:grid-cols-4">
        {[
          ["25 m/s", "= 90 km/h = 1.5 km/min"],
          ["60 min", "→ 90 km total path"],
          ["≤ 45 km", "maximum radius with zero time on target"],
          ["≈ 35 km", "radius with ~10 min on station (rough)"],
        ].map(([a, b]) => (
          <Panel key={a}><div className="text-2xl font-semibold text-amber-300">{a}</div><div className="text-xs text-slate-400">{b}</div></Panel>
        ))}
      </div>
      <p className="mt-2 text-xs text-slate-500">The Hasle-Borrby route is ~50 km long, so the asset can't cover the whole corridor in one sortie. Where the base sits matters more than any model tweak, and it must be explicit in the planner.</p>

      <H kicker="Data prep checklist">Do these before the event</H>
      <Table
        head={["Task", "Detail"]}
        rows={[
          ["Download all days", "Daily zipped CSV from aisdata.ais.dk. Ask the organisers to confirm the exact year/dates of the 7-16 Sept window; data for future dates cannot exist."],
          ["Clip to the AOI", "54.5-56.0 N, 13.5-16.0 E. Convert each day to Parquet with only the columns you need. A spot check should load in seconds."],
          ["Expected columns (verify on first file)", "Timestamp, Type of mobile, MMSI, Latitude, Longitude, Navigational status, ROT, SOG, COG, Heading, IMO, Callsign, Name, Ship type, Cargo type, Width, Length, Position fixing device, Draught, Destination, ETA, Data source type, A-D."],
          ["Cleaning", "Drop invalid MMSI (not 9 digits, placeholder values), lat/lon out of range (91/181 sentinels), implied speed > ~50 kn, duplicate timestamps; treat Name/Destination/Ship type as unreliable; prefer Length/Width and kinematics for vessel class."],
          ["Class model", "Derive class from ship type + length + behaviour; fall back to 'unknown' instead of guessing. Class B (small craft) report less often: normalise by reporting interval."],
          ["Cable layer", "EMODnet Human Activities cable/pipeline layers plus a hand-digitised Bornholm-Sweden route; buffer by a documented corridor width."],
          ["Frozen config", "One YAML with thresholds; print its hash on screen at the spot check."],
        ]}
      />
    </>
  );
}

export function ThermalExtra() {
  return (
    <>
      <H kicker="Reasoning map">Defect → likely cause → stage that fixes it</H>
      <Table
        head={["Jury-defect", "Likely cause in the data", "Stage", "Watch out for"]}
        rows={[
          ["Flicker", "AGC min/max or histogram jumping; shutter/FFC offset; thermal drift.", "Temporal smoothing of the LUT / gain-offset, FFC event detection.", "Over-smoothing → slow reaction to real scene change."],
          ["Lost scene", "Hot object stretches the range; HE gives all levels to a big flat area.", "Plateau (clipped) histogram equalisation with a linear component.", "Too high a plateau looks over-processed."],
          ["Ghosting", "Plain temporal averaging on moving objects.", "Motion-adaptive weights (per pixel), or motion-compensated denoise.", "Noise 'boils' at the boundary of the motion mask."],
          ["Stripes", "Residual column/row FPN after NUC, varying with temperature.", "Column offset estimation with temporal low-pass; guard against vertical edges.", "Real vertical structures (poles, buildings) getting erased."],
          ["Halos / plastic", "Detail enhancement with a wide kernel and high gain.", "Edge-aware base/detail split, gain limit, clamp of detail term.", "Gain looks great on frame 1 and bad on frame 300."],
          ["Low contrast", "Signal occupies a small part of 14 bit.", "AGC after denoise, not before.", "Noise gets stretched along with signal if order is wrong."],
        ]}
      />
      <Callout tone="cyan" title="Order matters">Stripe removal and denoise belong before AGC (otherwise you stretch the noise); detail enhancement belongs after (it works in display space and must be bounded). The streaming FPGA version should compute histograms on frame N and apply them to N+1.</Callout>
    </>
  );
}

export type Track = "nexus" | "mantavia" | "thermal" | "independent";
export type Rec = "Pursue" | "Merge" | "Component" | "Stretch" | "Park";

export interface Scores {
  fit: number; // how directly it scores against the judging criteria
  feasibility: number; // realistic in one hackathon weekend
  demo: number; // live-demo impact
  edge: number; // how different from what other teams will build
}

export interface Idea {
  slug: string;
  n: string;
  group: "review" | "new";
  title: string;
  tagline: string;
  track: Track;
  trackNote: string;
  verdict: string;
  rec: Rec;
  scores: Scores;
  take: string[];
  strengths: string[];
  risks: string[];
  changes: string[];
  ask: string[];
  plan: { when: string; what: string }[];
  team: string[];
  sources: { label: string; url: string }[];
  previewTitle: string;
  previewHow: string[];
}

export const TRACKS: Record<Track, { label: string; chip: string; dot: string }> = {
  nexus: {
    label: "Intelic · Nexus",
    chip: "text-cyan-300 bg-cyan-500/10 border-cyan-500/30",
    dot: "bg-cyan-400",
  },
  mantavia: {
    label: "Mantavia · Subsea AIS",
    chip: "text-amber-300 bg-amber-500/10 border-amber-500/30",
    dot: "bg-amber-400",
  },
  thermal: {
    label: "Odd Systems · Thermal ISP",
    chip: "text-rose-300 bg-rose-500/10 border-rose-500/30",
    dot: "bg-rose-400",
  },
  independent: {
    label: "Independent / open project",
    chip: "text-violet-300 bg-violet-500/10 border-violet-500/30",
    dot: "bg-violet-400",
  },
};

export const SCORE_LABELS: Record<keyof Scores, string> = {
  fit: "Challenge fit",
  feasibility: "Weekend feasibility",
  demo: "Live-demo impact",
  edge: "Edge vs other teams",
};

export function weighted(s: Scores): number {
  return s.fit * 0.35 + s.feasibility * 0.25 + s.demo * 0.2 + s.edge * 0.2;
}

const SRC = {
  events: { label: "Challenge page (Almere 2026)", url: "https://events.eurodefense.tech/almere-2026/challenges" },
  nist: { label: "NIST AI Risk Management Framework", url: "https://www.nist.gov/itl/ai-risk-management-framework" },
  sta: { label: "OGC SensorThings API", url: "https://www.ogc.org/standards/sensorthings/" },
  samus: {
    label: "Maritime Executive – Energinet sues Uni-Tankers (AIS ~9–10 kn, 26 Feb 2022)",
    url: "https://maritime-executive.com/article/utility-sues-uni-tankers-over-severed-power-cable-to-bornholm",
  },
  court: {
    label: "Maritime Executive – 2025 court ruling (negligence, anchor not noticed)",
    url: "https://maritime-executive.com/article/uni-tanker-s-financial-liability-limited-in-2022-anchor-dragging-incident",
  },
  tgs: {
    label: "TGS 4C – Bornholm–Sweden cable fault location (17 km from Sweden)",
    url: "https://www.tgs4c.com/news/failure-occurred-on-mvac-cable-connecting-bornholm-and-sweden-nid25074.html",
  },
  emodnetP: {
    label: "EMODnet – Cables, Power, Actual Routes (CC BY 4.0)",
    url: "https://emodnet.ec.europa.eu/geonetwork/srv/api/records/41b339f8-b29c-4550-b787-3d68f08fdbcc",
  },
  emodnetT: {
    label: "EMODnet – Cables, Telecommunication, Actual Routes",
    url: "https://ows.emodnet-humanactivities.eu/geonetwork/srv/api/records/39ebe289-410b-4a5d-88a4-51bfcde538de",
  },
  dma: { label: "Danish Maritime Authority – AIS data", url: "https://www.dma.dk/safety-at-sea/navigational-information/ais-data" },
  ejil: {
    label: "EJIL:Talk – anchor drag lengths (Eagle S, Yi Peng 3, NewNew Polar Bear)",
    url: "https://www.ejiltalk.org/christmas-day-cable-cuts-in-the-baltic-sea/",
  },
  peerj: { label: "PeerJ CS – AIS anomaly detection (method literature)", url: "https://peerj.com/articles/cs-1572" },
  intelic: {
    label: "Intelic BASE / Nexus background",
    url: "https://www.eu-startups.com/2026/05/europe-to-strengthen-drone-sovereignty-as-intelic-launches-unmanned-systems-procurement-hub/",
  },
};

export const IDEAS: Idea[] = [
  /* ------------------------------------------------------------------ 1 */
  {
    slug: "sensorbridge",
    n: "1",
    group: "review",
    title: "SensorBridge",
    tagline: "Different sensors speak different languages. Give the operator one understandable picture.",
    track: "nexus",
    trackNote: "Own-problem on Nexus (the grey-zone sensor plugin, de-risked)",
    verdict:
      "Good seed, wrong scope. Strong as the input layer of a bigger product; weak as a standalone screen.",
    rec: "Merge",
    scores: { fit: 3, feasibility: 4, demo: 3, edge: 2 },
    take: [
      "The best sentence in the pitch is ‘a missing report is not the same as absence of activity’. That is a real operator problem and the ‘device goes quiet → UNAVAILABLE, not all-clear’ moment is demoable in ten seconds. Keep that moment as the centrepiece.",
      "As written, though, it is a display of data. Nexus already displays data. What it was probably not built for is observations from things that are not vehicles. So the value you add is the common observation model, not the table. Pick the schema on day zero (SensorThings-lite: thing, observed property, phenomenonTime, resultTime, result, quality) and make every other feature consume it.",
      "The grey-zone team’s ESP32/Meshtastic hardware is the most likely thing to burn 12 hours: antenna, airtime limits, flashing, power. Treat hardware as garnish. If you have a real device, it should replace a simulator at the end, not shape the architecture.",
    ],
    strengths: [
      "Directly extensible: every new sensor type is a driver, which is the ‘toolkit that adapts’ story Intelic is selling.",
      "Easy to explain, easy to demo, low algorithmic risk.",
      "SensorThings gives you a credible, standard vocabulary for free.",
    ],
    risks: [
      "Four other ideas on this list are really facets of the same thing; building them separately dilutes everything.",
      "It does not yet show a decision. Judges reward ‘only interrupted when a human is really needed’, and a table never interrupts anyone.",
      "Unknown how the Extensions API represents non-vehicle assets; you may need to model sensors as static ‘vehicles’ or map items.",
    ],
    changes: [
      "Make the sensor’s health a first-class, computed state (LIVE / LATE / UNAVAILABLE) driven by expected report interval, not by a boolean.",
      "Add one decision: when a sensor goes silent near an asset the operator cares about, propose a check (e.g. a drone pass) and let the operator approve. This is the bridge to the grey-zone pitch.",
      "Push sensor state into Nexus as map items (icon + status in properties). Do not rely on custom UI panels until Intelic confirms they exist.",
      "Label every simulated device as SIMULATED in the UI. Honest labelling is part of trust.",
    ],
    ask: [
      "Can an extension register non-vehicle entities (static sensors) and show them on the map with custom status?",
      "Is there an event/subscription API, or do extensions poll?",
      "Is there any persistence available to extensions (for notes, state), or do we keep a companion service?",
    ],
    plan: [
      { when: "Hour 0–2", what: "Define the observation schema; write a simulator for 3 devices (JSON over MQTT or HTTP)." },
      { when: "Hour 2–6", what: "Extension ingests observations, computes freshness state, publishes map items." },
      { when: "Hour 6–10", what: "Operator drill-down: observation, source, age, ‘what this does not tell you’." },
      { when: "Hour 10+", what: "Kill-a-device demo, silent-sensor → proposed check. Hardware only if everything else is solid." },
    ],
    team: ["Python/Go API developer", "Map/front-end developer", "Optional embedded dev (ESP32/LoRa)", "Someone to play the operator in tests"],
    sources: [SRC.events, SRC.sta, SRC.intelic],
    previewTitle: "Three simulated sensors, one of which you can kill",
    previewHow: [
      "Each device reports on its own interval. Kill one and watch it go LIVE → LATE → UNAVAILABLE.",
      "The site banner never says ‘clear’. It says how many sensors are actually reporting.",
      "Open a device to see the SensorThings-style record and add an operator note (tagged as human text).",
    ],
  },

  /* ------------------------------------------------------------------ 2 */
  {
    slug: "blindspot",
    n: "2",
    group: "review",
    title: "BlindSpot",
    tagline: "Don’t just show what the system sees. Show what it might be missing.",
    track: "nexus",
    trackNote: "Maps straight onto the OSINT problem’s judging criterion: staleness and readiness",
    verdict:
      "The strongest of the Nexus-flavoured ideas. Narrow, demoable, and it names exactly what judges said they value.",
    rec: "Pursue",
    scores: { fit: 5, feasibility: 5, demo: 4, edge: 4 },
    take: [
      "Read the Nexus brief again: under problem 3 the explicit example of operational relevance is ‘the staleness and readiness of the integrated OSINT and its effect on the application’. BlindSpot is that sentence turned into a product. If you combine it with a real OSINT feed (wind, ADS-B, AIS), you are answering problem 3 with the exact lens the judges named.",
      "The four states (normal, delayed, unavailable, conflicting) are the right minimal taxonomy. I would add one more: ‘degraded’ (arriving but with reduced quality, for example GPS-less or low-confidence). Resist adding more than five; operators in a bunker cannot learn a taxonomy.",
      "The real depth is in effects, not display. A stale wind reading should visibly change something downstream (launch go/no-go margin widens, confidence drops), and the operator should see that change attributed to the stale feed. ‘Effect on the application’ is the phrase to hit.",
    ],
    strengths: [
      "Easy live demo: ‘watch what happens when I pull this feed’.",
      "Naturally minimises alarm fatigue if you only escalate when a stale feed actually changes a decision.",
      "Uses no ML, so there is nothing to explain away; explainability is plain-language by design.",
    ],
    risks: [
      "If it is only a coloured badge, it will look like every dashboard. The downstream-effect link is what makes it stand out.",
      "Colour-only states fail under stress and for colour-blind operators. Use shape + text + hatching, not colour alone.",
      "Over-alerting: a stale feed that nobody is using right now should not interrupt anyone.",
    ],
    changes: [
      "Compute ‘readiness’ per feed = freshness × completeness × provenance, and show the number only in the drill-down; show a 4-state glyph on the main view.",
      "Connect each feed to the decisions that depend on it (e.g. launch window, deconfliction). Show ‘3 decisions currently rely on a stale feed’.",
      "Hatch the map area a feed covers when it is not NORMAL. Missing coverage must look different from ‘clear’.",
      "Keep conflicting reports side by side with an explicit ‘not merged’ label. That is the bridge to SignalCheck.",
      "Add an event timeline: ‘14:02:11 wind feed stopped; 14:04:11 marked DELAYED; 14:09:11 marked UNAVAILABLE’. Staleness history is a trust feature.",
    ],
    ask: [
      "How do extensions surface warnings to the operator: toasts, map item styling, a panel? What is the least intrusive channel?",
      "Is there a native notion of link loss/last-contact time on vehicles that I should reuse rather than reinvent?",
      "Which OSINT feeds would Intelic find most credible for a demo (wind, ADS-B, AIS)?",
    ],
    plan: [
      { when: "Hour 0–3", what: "Feed adapter interface (poll, expected interval, last-success). Two real feeds plus one simulated." },
      { when: "Hour 3–7", what: "State machine + readiness calc + timeline log. Publish as map items." },
      { when: "Hour 7–12", what: "Downstream effect: wind-aware launch margin (or similar) that visibly changes with feed age." },
      { when: "Hour 12+", what: "Cut a feed live, show the hatch, the explanation, the timeline, and the changed decision. Rehearse the 90 seconds." },
    ],
    team: ["SDK/backend developer", "Front-end developer", "UX-minded tester who has never seen the system"],
    sources: [SRC.events, SRC.nist],
    previewTitle: "Break the feeds, watch the picture honestly degrade",
    previewHow: [
      "Freeze a feed (delayed), take it down (unavailable) or inject a conflict. Nothing is silently discarded.",
      "The map hatches uncovered areas; the timeline records when each state began.",
      "Select a feed for the plain-language ‘what we know / don’t know / what changes’ panel.",
    ],
  },

  /* ------------------------------------------------------------------ 3 */
  {
    slug: "handover",
    n: "3",
    group: "review",
    title: "Handover",
    tagline: "The next operator should understand what happened, not just inherit a screen.",
    track: "nexus",
    trackNote: "Own-problem on Nexus; storage/permissions are the unknown",
    verdict:
      "Genuinely valuable in real operations, but the least certain on the SDK. Best as a feature of a bigger extension.",
    rec: "Component",
    scores: { fit: 3, feasibility: 3, demo: 3, edge: 3 },
    take: [
      "Shift change is where real C2 loses information, and the distinction between ‘acknowledged’ and ‘checked’ is a sharp, true insight. Most dashboards collapse them into one tick.",
      "The distinction you propose, observation vs human note vs system text, is the core of trust. I would make it visual and permanent: three provenance chips on every line. That is also your answer to ‘can the operator tell why the system says something?’.",
      "The pitch’s own risk is right: whether extensions can store and retrieve notes. The Extension API as described covers telemetry, vehicle commands and map items. Notes may not exist. Do not build a standalone app and call it a Nexus extension; the brief says a standalone mock is not a substitute.",
    ],
    strengths: [
      "Operators will immediately recognise the problem.",
      "Explainability is built in: every line has a source and a timestamp.",
      "No generative AI is a feature. Deterministic output can be audited.",
    ],
    risks: [
      "Persistence may not be available. A fallback companion service is allowed only if it is integrated visibly.",
      "It is hard to show value in a 3-minute demo without a long-running scenario to hand over from.",
      "Free-text notes under stress are slow. Use one-tap reasons (duplicate / irrelevant / uncertain) before free text.",
    ],
    changes: [
      "Replace the single ‘reviewed’ state with five: new, acknowledged, checked, needs follow-up, dismissed (with reason).",
      "Show information age at handover time, not only the timestamp: ‘based on a report 11 min old’.",
      "Auto-build the handover from state, never from memory: unresolved items first, then what changed in the last N minutes.",
      "Export as plain text or Markdown; show the source record IDs, so every line can be audited.",
    ],
    ask: [
      "Can an extension write operator annotations onto a map item or vehicle, and read them back?",
      "Is the operator identity available to extensions (for who-wrote-this)?",
      "Is there an audit log we can read?",
    ],
    plan: [
      { when: "Hour 0–2", what: "Settle storage: Nexus-native annotations, or companion service with a clear boundary." },
      { when: "Hour 2–6", what: "Event capture into a timeline model with provenance chips." },
      { when: "Hour 6–10", what: "Operator actions (acknowledge, check, follow-up, dismiss + reason)." },
      { when: "Hour 10+", what: "Handover view and export; run the shift-change story with a fresh tester." },
    ],
    team: ["Backend/SDK developer", "Front-end developer", "Workflow-minded UX/product person"],
    sources: [SRC.events, SRC.nist],
    previewTitle: "Three reports, three outcomes, one handover view",
    previewHow: [
      "Acknowledge, check, flag for follow-up or dismiss each report (with a reason).",
      "Switch to the handover view: observations, human notes and system text are visibly different.",
      "Information age is computed at handover time; export produces an auditable text summary.",
    ],
  },

  /* ------------------------------------------------------------------ 4 */
  {
    slug: "signalcheck",
    n: "4",
    group: "review",
    title: "SignalCheck",
    tagline: "When two reports disagree, show the disagreement.",
    track: "nexus",
    trackNote: "Nexus extension, SDK-dependent; also a standalone information-quality idea",
    verdict:
      "Intellectually the cleanest idea on the list. Make it a mode of BlindSpot instead of a separate product.",
    rec: "Merge",
    scores: { fit: 3, feasibility: 3, demo: 3, edge: 3 },
    take: [
      "‘Don’t merge into a confident-looking answer’ is exactly right for C2 and is rare in practice. Fusion engines are rewarded for producing a single track; human reviewers pay the price.",
      "The risk is a bland demo: two boxes with different times. Strengthen it with a transparent grouping trace, ‘grouped because: same type, 310 m apart, 4 min apart’, and make the thresholds visible and adjustable. Showing that your grouping is a hypothesis is the whole point.",
      "It overlaps with BlindSpot’s ‘conflicting’ state. Rather than two products, treat SignalCheck as what happens when the operator clicks a conflicting item.",
    ],
    strengths: [
      "Transparent rules are easy to defend to judges.",
      "‘Separate incorrectly grouped reports’ is a nice, safe operator action with a clear undo.",
      "No ML needed, so no black box.",
    ],
    risks: [
      "Needs a convincing scenario. Without a story, grouping two JSON records is not exciting.",
      "Easy to over-engineer correlation logic. Keep it to 3 rules.",
      "‘Late report’ handling requires an event-time vs arrival-time model. Do it properly or not at all.",
    ],
    changes: [
      "Show the rule trace and let the operator move the threshold sliders to see grouping change.",
      "Always keep raw reports one click away; the grouped card is a lens, never a replacement.",
      "Record the operator’s ‘separate’ decision so the system does not regroup the same pair.",
      "Add confidence language that does not sound like a probability: ‘possibly related (2 of 3 rules)’.",
    ],
    ask: [
      "Do reports come into Nexus as map items, messages, or something else, and can an extension subscribe to them?",
      "Is there a way to attach metadata (like group ID) back to an item?",
    ],
    plan: [
      { when: "Hour 0–2", what: "Report model with event time, arrival time, source, position." },
      { when: "Hour 2–5", what: "Three deterministic rules + rule trace output." },
      { when: "Hour 5–9", what: "Side-by-side diff card; separate/regroup action with note." },
      { when: "Hour 9+", what: "Late-arriving report scenario; integrate as a drill-down of BlindSpot conflicts." },
    ],
    team: ["Backend/API developer", "UI developer", "Data-quality-minded tester"],
    sources: [SRC.events, SRC.nist],
    previewTitle: "Group by transparent rules, then show what disagrees",
    previewHow: [
      "Move the time and distance thresholds and watch the grouping change.",
      "The diff table highlights every field where the reports disagree.",
      "‘Separate’ pulls a report out of the group and records it.",
    ],
  },

  /* ------------------------------------------------------------------ 5 */
  {
    slug: "cablewatch",
    n: "5",
    group: "review",
    title: "CableWatch",
    tagline: "Help an analyst review unusual vessel behaviour near subsea infrastructure.",
    track: "mantavia",
    trackNote: "This is the Mantavia challenge itself, with an honest-evaluation framing",
    verdict:
      "The best idea if you have data engineers. High reward, but it is won or lost on data plumbing, not on the map.",
    rec: "Pursue",
    scores: { fit: 5, feasibility: 2, demo: 4, edge: 4 },
    take: [
      "Your review file already spotted the key facts. I verified two more that matter. First, the Samus Swan incident date is 26 February 2022 (the brief says 28th). The power loss was at 06:17 local, about 05:17 UTC. Second, Pole Star AIS showed the tanker making roughly 9–10 knots as it passed, and the 2025 court found the crew did not realise the anchor had dropped, with speed loss noticed later. That is not the ‘few knots’ in the brief’s description. A pure low-speed detector would not fire on the one incident the judges will replay. That is the most important modelling fact in the whole challenge.",
      "So the detector cannot be ‘slow near cable’. Think ‘behaviour deviates from this vessel’s own recent baseline, in this lane, at this location, and the deviation persists across the infrastructure’. A speed drop from 10 to ~7 kn with a small course drift while crossing a cable is the signature in the Samus case; a trawler at 3 kn in a fishing ground is not. Context beats kinematics, as the brief says.",
      "Alert burden is graded. The best way to win it is to make ‘how many alerts per day’ a tunable operating point and show the curve, then freeze it. Also pre-register your configuration. Judges name a date at the demo, and you must run without code changes.",
      "Treat the ISR cueing as a small optimisation problem, not a sort. One hour at 25 m/s is 90 km of flight total. Fly out and back and the usable radius is at most 45 km with zero loiter; every minute on station costs 0.75 km of radius. That makes prioritisation a reachability + value + time-to-act calculation, which is a lovely thing to show on a map.",
    ],
    strengths: [
      "Objective criteria (time of first alert, alert count, unseen day) leave little room for hand-waving. If you are strong, that is good for you.",
      "Context modelling (anchorage polygons, fishing grounds, ferry routes, port approaches) is a real differentiator and explainable.",
      "The ISR reachability ring is a visual that makes the cueing logic obvious to a non-expert judge.",
    ],
    risks: [
      "Data readiness: DMA daily files are very large (about 20 M rows and several GB uncompressed per day for all of Danish waters). Ten days plus a surrounding week for your incident is real work.",
      "Infrastructure layer: EMODnet’s power-cable layers are listed with BSH, SHOM, Rijkswaterstaat and NVE sources. The Bornholm–Sweden 60 kV cable (Hasle–Borrby) may not be in it. Verify before relying on it; plan a fallback (OpenStreetMap, charts, public TSO maps) and document its provenance.",
      "Coverage: the Danish archive thins near the eastern edge of the demo bounding box. A gap in AIS must be reported as ‘insufficient coverage’, not as ‘no anomaly’.",
      "Weather drift and legitimate slow behaviour are common; there is no ground truth for the unseen day, so alert burden is your only quantitative evidence.",
    ],
    changes: [
      "Day 0 deliverable: filter all ten demo days to the bounding box and store as Parquet/DuckDB. Run the same pipeline end to end on one day before touching modelling.",
      "Build the incident replay first (Samus Swan, 26 Feb 2022). Report time of first alert vs 06:17 local damage. Even if the answer is ‘first alert 12 min before’, you have a result.",
      "Build baselines per (grid cell × vessel class × hour band), so ‘normal’ is empirical, not a guess. Use shrinkage when a cell has few samples.",
      "Score with a small number of interpretable features and show contributions. Do not use a black-box model; you cannot explain it to the judges or the operator.",
      "Add an AIS Integrity gate (idea 6) so gaps and jumps downgrade confidence rather than create alerts.",
      "Report alert episodes, not raw messages: merge all flags for one vessel within a corridor into one episode.",
      "State clearly: behavioural alert for verification, not a verdict. Never say ‘anchor dragging’; say ‘behaviour consistent with…’.",
    ],
    ask: [
      "Which timezone do the DMA timestamps use, and how should we treat the demo-day boundaries?",
      "Are manually entered fields (ship type, destination) expected to be trusted or ignored?",
      "For ISR cueing, is the base position given, and may we assume constant 25 m/s and no wind?",
      "Is reported damage time the first alert’s comparator, or the time of vessel closest approach?",
    ],
    plan: [
      { when: "Pre-event", what: "Download all ten days. Pre-filter to bbox; store Parquet. Pull EMODnet layers and a fallback cable geometry. Write down your incident coordinates and times." },
      { when: "Hour 0–4", what: "Ingest and cleaning module; per-vessel track objects; corridor buffer; unit tests on a synthetic anchor-drag track." },
      { when: "Hour 4–10", what: "Baselines by area × class; feature scoring; episode merging; incident replay." },
      { when: "Hour 10–16", what: "Alert list with reasons; ISR cueing with reachability; map UI; alert burden table for the week." },
      { when: "Hour 16+", what: "Freeze config. Dry-run with a date you did not tune on. Rehearse the three required slides." },
    ],
    team: ["Python data engineer", "Geospatial developer", "Front-end/map developer", "Domain mentor/analyst"],
    sources: [SRC.samus, SRC.court, SRC.tgs, SRC.dma, SRC.emodnetP, SRC.emodnetT, SRC.ejil, SRC.peerj],
    previewTitle: "Synthetic tracks → interpretable scores → ISR cueing",
    previewHow: [
      "Synthetic vessels (tanker, trawler, anchored ship, ferry, a drag-like track and a ‘Samus-like’ hard case).",
      "Scores are computed from the track, not hard-coded. Click a vessel to see feature contributions.",
      "Drag the alert threshold: the alert count responds. The ISR panel ranks reachable alerts.",
    ],
  },

  /* ------------------------------------------------------------------ 6 */
  {
    slug: "ais-integrity",
    n: "6",
    group: "review",
    title: "AIS Integrity Desk",
    tagline: "Before asking what a vessel is doing, ask whether the track is usable.",
    track: "mantavia",
    trackNote: "A required sub-step of Mantavia; not a full entry alone",
    verdict:
      "Do it, but as the first stage of CableWatch. It is where the false-positive reduction is quietly won.",
    rec: "Component",
    scores: { fit: 3, feasibility: 4, demo: 3, edge: 3 },
    take: [
      "The Mantavia brief literally lists ‘position jumps, coverage gaps, implausible identifiers and unreliable manually entered fields’ as ingest tasks. So integrity is not optional; the question is whether you make it visible. A visible integrity layer is a differentiator, because most teams will clean silently.",
      "The three-way output (unusual / data unreliable / not enough information) is the right product idea. The practical version is a per-track, per-window quality score that gates the alert system: poor data lowers confidence, or yields an explicit ‘insufficient coverage’ record, and never silently produces an alert.",
      "On the real archive, expect: duplicate messages (the same row repeated), multiple transponders per MMSI, MMSI with wrong digit count, positions at 0,0 or 91°, SOG that does not match displacement, and class B messages at lower rates. Create synthetic fixtures so you know ground truth, then show real examples labelled ‘unverified’.",
    ],
    strengths: [
      "Concrete, testable rules with known ground truth in a synthetic fixture.",
      "Directly reduces false alerts, which is the headline success criterion.",
      "Good story for judges: ‘we show when we cannot tell’.",
    ],
    risks: [
      "Alone it has no behavioural detector, so it is not a Mantavia entry.",
      "Thresholds are context-dependent (a 20-minute gap is normal for class B in the open sea).",
      "Risk of misreading spoofing or genuine manoeuvres as errors. Label as ‘needs review’, never ‘bad’.",
    ],
    changes: [
      "Implement 6 rules and no more: duplicate row, impossible speed jump, gap over threshold, SOG vs displacement mismatch, invalid MMSI/IMO, out-of-range position.",
      "Every flag carries the original rows and a one-sentence reason.",
      "Output a track quality tier (Usable / Degraded / Insufficient) per hour and pass it to CableWatch.",
      "Make gap rules class-aware: Class A at 10 s to 3 min, Class B at 30 s; ‘gap’ means gap relative to the expected interval.",
    ],
    ask: [
      "Do the judges expect MMSI de-duplication or only flagging?",
      "How should we treat vessels with changing identifiers mid-track?",
    ],
    plan: [
      { when: "Hour 0–2", what: "Synthetic fixture with known injected defects." },
      { when: "Hour 2–5", what: "Six rules with unit tests; run on real day." },
      { when: "Hour 5–8", what: "Quality tiers per window; wiring to CableWatch gating." },
    ],
    team: ["Python data engineer", "Test-case designer", "Visualisation developer"],
    sources: [SRC.dma, SRC.peerj, SRC.events],
    previewTitle: "Inject defects, then see exactly which rule caught them",
    previewHow: [
      "A synthetic track has a gap, a duplicate, a jump, an invalid MMSI and an SOG mismatch.",
      "Toggle rules and tune thresholds; the table keeps the raw record behind each flag.",
      "The tier at the top is what would be handed to the alert stage.",
    ],
  },

  /* ------------------------------------------------------------------ 7 */
  {
    slug: "steadythermal",
    n: "7",
    group: "review",
    title: "SteadyThermal",
    tagline: "Make thermal video clearer without making it unstable.",
    track: "thermal",
    trackNote: "Direct entry in the thermal ISP challenge",
    verdict:
      "The most self-contained and most winnable if you have a strong CV/performance person. Judged by eye, so craft matters.",
    rec: "Pursue",
    scores: { fit: 5, feasibility: 4, demo: 4, edge: 3 },
    take: [
      "The brief names four defects: flicker, lost scene, ghosting, new artifacts. The winning pipeline is the one that visibly avoids all four on the hard section of the sequence (probably a hot object entering the frame). So design backwards from those four defects.",
      "Order matters. Fix fixed-pattern artifacts first (column stripes, bad pixels), then temporal noise (motion-adaptive, so no ghosts), then dynamic-range compression (plateau-limited histogram so a hot object cannot flatten the scene), then temporal smoothing of the mapping itself (so brightness cannot flicker), and only then a gentle detail boost. Each step undoes a specific defect, which is also the ‘justify every step’ requirement.",
      "The ‘bonus’ for streaming is more achievable than it looks. Everything except temporal denoising can run line by line. The histogram is computed on frame N and applied to frame N+1 (one-frame latency, invisible). Column offsets are the same trick. Only the recursive temporal filter needs a full-frame buffer: 640×512×14 bit ≈ 4.6 Mbit, which is the honest number for the resource note.",
    ],
    strengths: [
      "No dependency on other people’s APIs or data; you can start the moment you have the file.",
      "Defects are visible and the jury compares by eye, so careful engineering shows.",
      "The FPGA streaming note is a cheap differentiator.",
    ],
    risks: [
      "Many teams will do CLAHE + temporal averaging and get ghosts or plastic texture. Differentiation is in avoiding those.",
      "Over-enhancement: halos around hot objects from local contrast operators, or amplified column noise.",
      "Python at 640×512 in 40 ms needs vectorised NumPy or a compiled path (Numba/C++).",
    ],
    changes: [
      "Inspect the data first: per-frame mean/min/max over time, a column-mean plot, a histogram of a bright frame. You may find drift or stripes that decide your design.",
      "Use plateau equalisation (clip histogram bins at a plateau, add a small floor) instead of plain HE or CLAHE; blend 70/30 with linear.",
      "Smooth the LUT across frames with a fast-attack, slow-decay filter, so scene changes are followed but noise is not.",
      "Make temporal noise reduction motion-adaptive per pixel, so a moving person cannot leave a trail.",
      "Replace isolated outlier pixels with the local median before anything else. One dead pixel can set the range.",
      "Document an explicit per-step ‘what it fixes’ card with before/after crops. The jury sees reasoning.",
    ],
    ask: [
      "Is the sequence one continuous capture, or separate clips with scene cuts?",
      "Is a one-frame latency acceptable for AGC?",
    ],
    plan: [
      { when: "Hour 0–1", what: "Load the .bin, plot frame statistics, view raw min–max baseline." },
      { when: "Hour 1–4", what: "Bad pixels, column/row FPN, temporal recursive filter." },
      { when: "Hour 4–8", what: "Plateau AGC with temporal LUT smoothing; tune on the hardest segment." },
      { when: "Hour 8–12", what: "Detail boost (guarded), speed profiling, MP4 export, resource note." },
    ],
    team: ["Image-processing/CV developer", "Python/C++ performance developer", "Someone to run visual A/B tests"],
    sources: [SRC.events],
    previewTitle: "A live ISP in your browser, with a loader for the real .bin",
    previewHow: [
      "Left: naive per-frame auto-stretch. Right: the pipeline, with each step switchable.",
      "A synthetic scene has stripes, drift and a hot object arriving; the flicker plot compares both.",
      "Load the real 640×512 uint16 .bin file to run the same pipeline on your actual data.",
    ],
  },

  /* ------------------------------------------------------------------ 8 */
  {
    slug: "thermallab",
    n: "8",
    group: "review",
    title: "ThermalLab",
    tagline: "Show what the enhancement changed, and what it may have hidden.",
    track: "thermal",
    trackNote: "Support tool for the thermal track; not an entry on its own",
    verdict:
      "Build a minimal version for yourself on day one, not as the project. It will make your ISP decisions faster and your demo more convincing.",
    rec: "Component",
    scores: { fit: 2, feasibility: 4, demo: 3, edge: 3 },
    take: [
      "The brief says the jury compares images by eye, with no metrics. A lab environment does not win a by-eye contest by itself. But for you it is a huge force multiplier: stepping through the hard section frame by frame, with clipping highlighted, is how you find the flicker you cannot see at 25 fps.",
      "The most useful pieces are cheap: a side-by-side split, frame stepping, a clipping overlay, and a mean-brightness-over-time plot. That is a one-evening build. Anything beyond this is a different product.",
      "If the jury asks ‘how do you know it does not flicker?’, a plot of background brightness vs frame is a stronger answer than ‘it looks fine’. Even though they said no metrics, a single plot shown for 10 seconds tends to land.",
    ],
    strengths: [
      "Cheap, and improves your actual entry.",
      "The plots become demo material for the ‘reasoning’ criterion.",
    ],
    risks: [
      "Tool-building is a trap: it feels productive but doesn’t improve the image.",
      "A fancy viewer cannot compensate for a mediocre pipeline.",
    ],
    changes: [
      "Time-box it to three hours. Use whatever is quickest (OpenCV window or matplotlib; the web is optional).",
      "Add a ‘hardest frames’ bookmark list: frames with the largest brightness jumps.",
      "Show clipping as a count, not just a red overlay, in the demo.",
    ],
    ask: ["Is a plot or overlay acceptable in the demo video, or must it be raw video?"],
    plan: [
      { when: "Hour 0–1", what: "Split viewer with frame stepping." },
      { when: "Hour 1–2", what: "Clip overlay + stats per frame." },
      { when: "Hour 2–3", what: "Brightness-over-time plot + ‘largest jump’ jump list." },
    ],
    team: ["Python developer", "Image-processing teammate"],
    sources: [SRC.events],
    previewTitle: "Frame-by-frame lab: split view, clipping overlay, stats plots",
    previewHow: [
      "Scrub frames; drag the split to compare baseline and processed.",
      "Toggle clipping overlay; see per-frame clipped percentage and brightness traces.",
      "Bookmarks jump to frames with the largest brightness jump in the baseline.",
    ],
  },

  /* ------------------------------------------------------------------ 9 */
  {
    slug: "spatial-debrief",
    n: "9",
    group: "review",
    title: "Spatial Debrief",
    tagline: "Walk through what happened, what was known, and what wasn’t.",
    track: "independent",
    trackNote: "Independent; would need re-framing to count as a Nexus extension",
    verdict:
      "Appealing concept, weakest fit for these challenges. Do it only if the team’s real goal is a product outside the three tracks.",
    rec: "Park",
    scores: { fit: 1, feasibility: 3, demo: 4, edge: 4 },
    take: [
      "The ‘what was known vs what was true’ replay is a good training and after-action idea. It is the replay cousin of BlindSpot. But XR and the ControlAnything connectors are a distraction from any of the three tracks, and you said yourself it is not a safety-critical tool.",
      "If you want to keep the core idea, it is a strong stretch feature for a Nexus extension: ‘replay what the operator knew at time T’. A scrubber that rewinds the map to the information state at that moment, with information age on each item, is both a handover and an AAR tool.",
      "Skip WebXR entirely at a hackathon unless someone owns a headset and has used it. The 2D scrubber gets 90% of the insight.",
    ],
    strengths: [
      "The ‘known at T vs true at T’ framing is distinctive.",
      "A 2D version is quick and visually strong.",
    ],
    risks: [
      "Scope creep into XR.",
      "Does not map to any judging criterion unless attached to a track.",
      "Generated connectors run with local user permissions; don’t use any live control.",
    ],
    changes: [
      "Drop headset and connectors; build a 2D replay.",
      "Make ‘decision made on information N minutes old’ the headline output.",
      "If attached to Nexus, reuse the telemetry history to rebuild the picture at any past time.",
    ],
    ask: ["Does the API expose historical telemetry/state for replay, or only the live feed?"],
    plan: [
      { when: "Hour 0–3", what: "Scenario script: truth path, sensor events with observed/received time, decisions." },
      { when: "Hour 3–7", what: "Scrubber and ‘known at T’ filter." },
      { when: "Hour 7+", what: "Decision cards with information age; counterfactual hint." },
    ],
    team: ["Web developer", "Scenario designer", "Optional WebXR developer"],
    sources: [SRC.events],
    previewTitle: "Scrub time and see what was known when",
    previewHow: [
      "Move the slider: only events already received are visible; truth is hidden by default.",
      "Each decision shows how old its supporting information was.",
      "Reveal ground truth to compare it with what the operator saw.",
    ],
  },

  /* ------------------------------------------------------------------ N1 */
  {
    slug: "geoclick",
    n: "A",
    group: "new",
    title: "GeoClick",
    tagline: "A click on drone video becomes a geolocated point with an error ellipse that holds up.",
    track: "nexus",
    trackNote: "Nexus problem 2 (recon-to-strike handoff), with the honest-error angle",
    verdict:
      "My top pick for a Nexus entry. Maths is tractable, the demo is dramatic, and the judging criterion is explicit: ‘an error estimate that holds up’.",
    rec: "Pursue",
    scores: { fit: 5, feasibility: 3, demo: 5, edge: 4 },
    take: [
      "The brief says: ‘turn a click on drone video into a geolocated target with an honest error estimate’, and the example operational-relevance criterion is ‘an error estimate that holds up’. This is the only idea on the list where the judges have told you the exact thing they will test.",
      "The core is ray–terrain intersection from camera pose: where is the aircraft, which way is the camera pointing, what is the field of view, where did the operator click. Error comes from position, attitude, pixel pick, terrain height and time sync. The key insight, which you can show live, is that error explodes at shallow depression angles because range is altitude / tan(angle). A good system tells the operator ‘this click is only good to 90 m because the camera is nearly horizontal’ and suggests a fix: ‘descend, or look more steeply, to get under 15 m’.",
      "Honesty means validating the ellipse. Run Monte Carlo over the error sources and check that the true point lands inside the 95% ellipse about 95% of the time on simulated flights. A one-slide calibration plot is stronger than any amount of code. In MAVLink SITL you know the ground truth exactly, so this is easy to demonstrate.",
    ],
    strengths: [
      "Ground truth is known in SITL, so you can prove your error model.",
      "Tangible demo: click, ellipse appears, move the drone, ellipse shrinks.",
      "Natural ‘only interrupt a human when needed’ hook: refuse to hand off when the ellipse is too large for the task.",
    ],
    risks: [
      "Requires a working video-simulation SITL early; ask Intelic about the sim available on your VM.",
      "Camera intrinsics, gimbal conventions and frames (NED vs ENU) are classic bug sources.",
      "Terrain: a flat-earth assumption is fine for a demo only if declared; show the DEM error term.",
    ],
    changes: [
      "State up front: ‘Target location candidate for verification’. Never imply authorisation or fire-control accuracy.",
      "Return an ellipse (semi-axes, orientation) and the dominant error source, not a single CEP number.",
      "Add a ‘how to improve this fix’ hint: change altitude, angle, or add a second look from another bearing and fuse.",
      "Show the error budget per source as a bar chart. This is the explainability layer.",
      "Handle time sync: video frame time vs telemetry time; a 200 ms offset at 20 m/s is 4 m.",
    ],
    ask: [
      "What video sim does the VM provide, and does telemetry include gimbal angles?",
      "Is there an existing map item type for a target with uncertainty (ellipse), or do we draw a polygon?",
    ],
    plan: [
      { when: "Hour 0–3", what: "Pose → ground projection on flat earth; verify against SITL ground truth." },
      { when: "Hour 3–6", what: "Error model (Monte Carlo and analytic) and ellipse as map polygon." },
      { when: "Hour 6–10", what: "Operator UI: click, ellipse, error budget, ‘improve fix’ hint." },
      { when: "Hour 10+", what: "Calibration plot from 500 SITL clicks; second-look fusion as stretch." },
    ],
    team: ["Geometry/robotics developer", "Nexus/SDK developer", "UI developer"],
    sources: [SRC.events],
    previewTitle: "Click the video frame; get an ellipse that changes with geometry",
    previewHow: [
      "Click anywhere in the synthetic frame. A Monte Carlo of position, attitude, pixel and terrain errors gives the 95% ellipse.",
      "Lower the camera depression angle and watch the ellipse stretch along the line of sight.",
      "The bar chart shows which error source dominates; the hint says how to improve the fix.",
    ],
  },

  /* ------------------------------------------------------------------ N2 */
  {
    slug: "osint-readiness",
    n: "B",
    group: "new",
    title: "OSINT Readiness Board",
    tagline: "Every open feed shows its age, its trust, and what it is currently changing.",
    track: "nexus",
    trackNote: "Nexus problem 3 (OSINT integration), BlindSpot-style",
    verdict:
      "A very safe, very judge-aligned entry: the OSINT idea expressed through the criterion the judges named, with a visible effect on a decision.",
    rec: "Pursue",
    scores: { fit: 5, feasibility: 4, demo: 4, edge: 5 },
    take: [
      "Most teams will integrate one OSINT feed and draw it on a map. Judges asked for the argument: why is this useful, in which scenarios, and what is the staleness and readiness of the feed and its effect on the application? So the product is not the feed; it is the readiness wrapper around several feeds, and one decision that depends on them.",
      "The scenario ties in with the brief’s own examples: a cheap drone over an airbase. Wind speed and direction determine where a drone can launch and drift; civil ADS-B traffic gives deconfliction and anomaly baselines; AIS and satellite passes inform when others can see you. Pick two feeds and one decision: ‘Is it safe to launch interceptor drones now, from which pad?’",
      "The distinctive feature is propagating uncertainty. If the wind data is 25 minutes old, the system should widen its gust margin, say so, and tell the operator what would restore confidence (a local anemometer reading, or a refresh). That is trust and explainability in one move.",
    ],
    strengths: [
      "Hits ‘staleness and readiness’ and ‘effect on the application’ literally.",
      "Free public APIs exist for wind and ADS-B-style data, so a live demo is realistic.",
      "Few teams will make freshness the main character.",
    ],
    risks: [
      "Public API rate limits and outages in the venue network. Cache last-good with timestamps (which is also the demo).",
      "Terms of use for ADS-B and AIS feeds vary; read them before integrating.",
      "Wind forecast skill is not the same as measurement. Label source type (model vs observation).",
    ],
    changes: [
      "Separate source type (observation / model / derived) from age; both matter.",
      "Show readiness as three parts (freshness, completeness, provenance) in the drill-down only.",
      "Record the feed history so you can show ‘wind was stale for 11 minutes during this launch’ in the handover.",
      "Plan for the network to fail at the venue; pre-record a replay mode and label it REPLAY on screen.",
    ],
    ask: [
      "Which OSINT feeds does Intelic already consider in scope and which licences are acceptable for a demo?",
      "Can the extension run a decision function and publish its result as a map item or vehicle command suggestion?",
    ],
    plan: [
      { when: "Hour 0–3", what: "Adapters for wind and one traffic feed with last-success, interval and source type." },
      { when: "Hour 3–6", what: "Readiness model and decision (launch margin) with uncertainty widening." },
      { when: "Hour 6–10", what: "Operator view with age, effect, explanation; cut-the-network demo." },
    ],
    team: ["Python/Go backend developer", "Front-end developer", "Operator-minded tester"],
    sources: [SRC.events, SRC.nist],
    previewTitle: "Slide feed age; watch the launch decision change and say why",
    previewHow: [
      "Each feed has an expected update interval; sliders set how long ago it was last refreshed.",
      "The launch decision widens its margin with age and flips to HOLD when confidence is too low.",
      "The explanation names the feed responsible and what would fix it.",
    ],
  },

  /* ------------------------------------------------------------------ N3 */
  {
    slug: "intent-compiler",
    n: "C",
    group: "new",
    title: "Intent Compiler",
    tagline: "Commander intent in, explainable tasks out, and an interruption only when a human is needed.",
    track: "nexus",
    trackNote: "Nexus problem 1 (commander intent to tasks)",
    verdict:
      "Most ambitious of the Nexus problems, and the one most teams will under-explain. Worth it only if you can make the explanations excellent.",
    rec: "Stretch",
    scores: { fit: 5, feasibility: 2, demo: 4, edge: 2 },
    take: [
      "It is tempting to use an LLM to parse intent. For a hackathon and for trust, I would parse a constrained intent template and use deterministic planning. The judges reward explainability and a deterministic planner can show its work: ‘Fixed-wing 2 assigned the gate because endurance 90 min ≥ 60 min, no handover needed’.",
      "The best demo is not the happy path, it’s the change. Take the fixed-wing offline and show the plan recompute with a diff, and the only interruption is when the plan introduces a real gap: ‘gate coverage gap 4 min during swap; approve?’. That demonstrates alarm-fatigue discipline.",
      "Safety checks are the product. Battery reserve, geofence, comms range, no-fly zone and de-confliction between tasks should each be a visible check with pass/fail and reason. Anything non-obvious goes to the human; everything else proceeds.",
    ],
    strengths: [
      "Clear operator value and a natural fit with ‘a mixed fleet’.",
      "Constraint checks and diffs make explainability tangible.",
    ],
    risks: [
      "Spinning up several SITLs is time-consuming. Start with two vehicle types.",
      "LLM-parsed intent is a trust and reliability liability.",
      "Many teams will pick this; edge comes from the explanation quality.",
    ],
    changes: [
      "Constrained intent grammar with a form fallback (area, task type, constraint).",
      "Three outputs only: plan, per-task reasons, and the ‘needs human’ list.",
      "Visual diff on every replan.",
    ],
    ask: ["How are tasks sent to different vehicle types through the Extensions API (missions, goto, orbit)?"],
    plan: [
      { when: "Hour 0–4", what: "Two SITLs + task primitives (search area, orbit point)." },
      { when: "Hour 4–8", what: "Planner + constraint checks + reasons." },
      { when: "Hour 8–12", what: "Replan on vehicle loss, diff view, approval gate." },
    ],
    team: ["Autonomy/planning developer", "Nexus developer", "UI developer"],
    sources: [SRC.events],
    previewTitle: "Pick an intent, remove a vehicle, read the diff",
    previewHow: [
      "The planner assigns tasks with reasons and shows each safety check.",
      "Take a vehicle offline: the plan recomputes and a diff explains what changed.",
      "Only unresolved gaps are escalated to the operator.",
    ],
  },

  /* ------------------------------------------------------------------ N4 */
  {
    slug: "grey-zone-queue",
    n: "D",
    group: "new",
    title: "Grey-Zone Check Queue",
    tagline: "Weak signals become check priorities, silent sensors count as unknowns, and the operator approves each recon.",
    track: "nexus",
    trackNote: "The idea your friends pitched, rebuilt as a coherent product",
    verdict:
      "The most coherent use of BlindSpot + SensorBridge. It gives the ‘so what’ the SensorBridge idea lacks.",
    rec: "Merge",
    scores: { fit: 4, feasibility: 3, demo: 4, edge: 4 },
    take: [
      "The original pitch does the right thing by keeping the operator in the loop, but it risks overclaiming (‘turns weak signals into check priorities’). Define a check priority as an evidence score from a few transparent rules, and always list which sensors were silent and whether the silence is trustworthy (healthy but quiet) or untrustworthy (offline).",
      "The most defensible logic is spatiotemporal coherence: single weak events are noise; a chain of events whose spacing is consistent with a person walking (0.3–3 m/s) is worth a look. That is explainable in one line, doesn’t need ML, and degrades gracefully when a sensor drops out.",
      "Approval gating needs to withstand a misclick under stress. Use a two-step approval (select, then confirm with a distinct control), show the cost (drone ETA, time off its current task), and make reject one tap. A proposal should expire if not acted on; stale proposals are a hazard.",
    ],
    strengths: [
      "Complete end-to-end story: sensor → evidence → proposal → approval → drone.",
      "Explicit handling of silent sensors makes it honest.",
    ],
    risks: [
      "Hardware can consume the whole weekend. Keep the hardware optional.",
      "The ‘drone mission proposal’ depends on how Nexus exposes vehicle commands.",
      "Radio rules: if using Meshtastic or LoRa in the Netherlands, check region settings and duty cycle.",
    ],
    changes: [
      "Make each proposal include: what triggered it, which sensors support it, which are silent (and why), expected value, cost.",
      "Make every proposal expire.",
      "Show a ‘why not’ for suppressed signals.",
    ],
    ask: ["Can an extension create a draft mission that requires human approval in Nexus rather than executing directly?"],
    plan: [
      { when: "Hour 0–3", what: "Observation schema + simulated sensors." },
      { when: "Hour 3–7", what: "Coherence scoring + silent-sensor logic." },
      { when: "Hour 7–11", what: "Proposal card and approval flow with confirm-step." },
    ],
    team: ["Python/MQTT developer", "Map UI developer", "Optional ESP32 developer"],
    sources: [SRC.events],
    previewTitle: "Weak events, a coherent chain, then a proposal to approve",
    previewHow: [
      "Toggle sensors on or off and replay events. Isolated events do not trigger anything.",
      "A coherent chain raises a check priority and proposes a recon; silent sensors are listed as unknowns.",
      "Approval is a two-step action with the cost shown.",
    ],
  },
];

export const BY_SLUG: Record<string, Idea> = Object.fromEntries(IDEAS.map((i) => [i.slug, i]));

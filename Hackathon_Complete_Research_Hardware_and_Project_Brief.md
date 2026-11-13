# Hackathon master research, hardware and project brief

**Purpose:** A single, detailed handover of the work and discussion so far: the available hardware, the three sponsor challenges, independent ideas, other teams’ pitches, project recommendations, the source-code reviews and remaining questions.

**Audience:** The project owner, potential teammates, hackathon mentors and a future development assistant.

**Status:** Research and planning, not an operational or validated system. The sponsor briefs are paraphrased from text the owner supplied; the event challenge page was inaccessible without membership. Consult the full original briefs and organizers before treating any detail here as a contractual requirement.

> **The most important framing:** The team does **not** have to choose one of the three sponsor challenges. Independent ideas should be evaluated on their own merits, subject to confirmation of the event’s competition rules. The hardware is an opportunity, not a reason to force a hardware project.

---

## Contents

1. Executive summary and recommendations
2. Evidence and confidence labels
3. Hardware inventory, Atech platform and access gaps
4. What the hardware does and does not enable
5. Challenge comparison
6. Intelic Nexus challenge
7. Mantavia AIS challenge
8. Thermal imaging challenge
9. Independent ideas: detailed shortlist and pitches
10. Other teams’ example projects
11. Earlier idea catalogue and research-app concepts
12. Review of `hackideasreviewed.zip`
13. Review of earlier code packages
14. How to generate and select other ideas
15. Decision plan and questions to ask
16. Deliverables and files
17. Source register
18. Full previously delivered Mantavia evidence pack and evaluation plan

---

# 1. Executive summary

## 1.1 What the owner wants

- Explore ambitious, credible and team-recruitment-ready hackathon ideas, including ideas **unrelated** to the sponsor challenges.
- Compare those ideas with two especially ambitious benchmarks: a human-approved sensor-to-reconnaissance workflow and an end-to-end robotics development and validation platform.
- Use the available hardware and fabrication resources when they create genuine advantage, without confusing a broad product vision with a weekend deliverable.
- Carry out careful, end-to-end research, distinguish verified results from assumptions, and avoid fabricated data, performance figures and operational claims.
- Identify which additional hardware or access the owner should enquire about.

The owner has a Mac, and the composition and skills of the eventual team remain mixed or undecided. It is not yet established whether independent entries and sponsor-track entries compete on identical terms.

## 1.2 Current provisional recommendations

**Independent entry: ProofLoop / Robot Evidence Lab**, with a focused **BlindSpot** scenario. Use the owner’s Atech board and Raspberry Pi, if functional, to run a repeatable test of a device-to-dashboard observation stream. Deliberately interrupt that *test stream*, show fresh → stale/unknown → recovered, record the event timeline, and export a test report. This is a credible small piece of the larger robotics/connected-systems validation vision; it is not a complete robotics safety platform.

**Best operator-facing alternative: FieldLink.** Turn a real physical observation into a source- and freshness-aware human-review workflow. It can be independent or, if the Nexus environment and appropriate API are confirmed, a sponsor-track integration. Show a reviewed proposal, not an automatically executed action.

**Best narrower operational idea: BlindSpot.** Make missing or stale monitoring visible rather than incorrectly treating silence as safety. It can stand alone or be ProofLoop’s first test subject.

**Closest narrow slice of the Phalanx vision: Robot Handover.** Capture a field incident, relevant observations, software version, expected behavior and a replayable test case. Use clearly labelled mock telemetry unless real read-only robot data is available.

**If a sponsor track is preferable:**

- **Intelic Nexus:** FieldLink, BlindSpot or a carefully scoped source/freshness and handover extension, but a live hosted Nexus demo is required and the API must be verified.
- **Mantavia:** Public AIS evidence, explainable review and sequential prioritization of a single ISR asset; only after the archive, incident identity, area and times are checked.
- **Thermal ISP:** Choose if the team has image-processing strength and the raw files are accessible; visual quality on the real data is the central outcome.

These are provisional recommendations, not verified rankings or a user decision. Team interest, available skills, real device access, event rules and what the sponsors actually expose can change the choice.

## 1.3 Work completed and not completed

**Completed:** desk research, visual inspection of 14 earlier hardware photographs plus one latest photograph, review of several supplied applications, build/type checks for two React/Vite projects, targeted synthetic tests of the latest review package, a Mantavia evidence/evaluation document, an offline-friendly research hub and a handoff ZIP.

**Not completed:** a real AIS dataset download or incident replay; actual raw thermal file processing; a Nexus SDK or hosted-service integration; a robot or drone SDK integration; a real flight, live radio test, user study, field evaluation, external security audit or product-market validation. No quoted synthetic metric is a field result.

---

# 2. How to read evidence in this document

| Label | Meaning |
|---|---|
| **Owner-reported** | The owner says a resource, rule or goal exists. Access or condition may still need checking. |
| **Photo-observed** | A visible object or label was seen in a photograph. Its functionality, internal contents and exact model may not be proven. |
| **Source-supported** | A cited public source supports a stated fact within its scope. Vendor marketing is not independent validation. |
| **Code-inspected** | A claim follows from reading supplied source code; this does not establish deployed behavior. |
| **Synthetic test** | A controlled, artificial test was run; it is not a challenge-data or real-world result. |
| **Hypothesis / proposed** | A product or engineering idea to investigate, not an established result or market opportunity. |
| **Unverified** | Needs confirmation from a device, dataset, organizer, user or primary source. |

### General guardrails

- “No observation” is not “nothing happened.” Missing telemetry is not proof of jamming, sabotage or a safe environment.
- Different sensor IDs do not necessarily constitute statistically or physically independent evidence.
- A retrospective replay is not proof that the same data arrived early enough for a live operator.
- Unreviewed anomaly alerts are **not** verified false positives.
- Synthetic demos should be visibly identified; simulated labels and results do not become operational performance.
- An uncalibrated “confidence” number, threshold or uncertainty ellipse must not be presented as validated.
- A human approval button does not, by itself, establish lawful authority, safety, usability or reliable decision-making.
- For handling people, recordings, locations or equipment, consider privacy, consent, data retention, permissions and venue rules. Do not present prototypes as field-ready security or life-safety systems.

---

# 3. Hardware and facilities inventory

## 3.1 Access and ownership

The owner reports access to the hardware in the earlier 14 Google Drive photos, a 3D-printing lab, soldering kits, a drone and a quadruped robot. The owner additionally says the equipment in the latest photo is theirs and accessible. **Usable condition, exact quantities, batteries, power supplies, permissions and software access are not yet verified.**

The 14 earlier photos were inspected; 12 were viewed as full-resolution downloads and two via larger Drive previews after transfer failures. Drive metadata and downloaded filename mappings were inconsistent in at least one case, so the labels below are not a reliable per-photo chain of custody. The latest additional image is `20261113_141212.jpg`.

## 3.2 Main computing and development hardware

| Item | Status and observed details | Potential use | Unknowns / cautions |
|---|---|---|---|
| Raspberry Pi 4 Model B, 8 GB | **Owner-accessible; photo-observed box label.** The actual Pi was not visible in the box. | Local Linux gateway, test controller, logging service, small dashboard/backend, data collection. | Confirm board in box, working condition, microSD/storage, OS, USB-C power, networking, cooling and accessories. A Pi is not a dedicated AI accelerator. |
| Atech Frame 10 / Frame 2.1 | **Owner identified; photo-observed modular boards.** Atech documents 10-port and 14-port board layouts and ESP32-S3-based modular boards. | Rapid device inputs/outputs, a real sensor event if an appropriate module is owned, local USB-connected node. | Confirm exact board-to-SDK mapping, revision support, which modules are available, which port they occupy, and the firmware/connection mode. |
| ESP32-S3-DevKitC-1 | A box and board(s) were visible in earlier photos. | Wi-Fi/BLE embedded prototyping and custom sensors. | Exact model, quantity, working condition, code and available interfaces. Wi-Fi/BLE are not LoRa. |
| Raspberry Pi Pico W | Board marking visible in earlier photos. | Additional microcontroller/sensor node. | It is not the same as a Linux Raspberry Pi. Check cable, firmware, pins and functioning. |
| Owner’s Mac | Owner-reported. | Development, browser UI, data analysis and potentially simulation. | Exact model, Apple Silicon vs Intel, RAM, storage, OS and installed tooling unknown. |

A Pi 4 Model B provides Wi-Fi, Ethernet and USB; a suitable 5 V / 3 A USB-C supply and working storage should be checked. Raspberry Pi OS supports Tailscale, but access to an organizer’s tailnet and compatibility with the actual challenge service must be arranged. See [Pi 4 specifications](https://www.digikey.com/en/product-highlight/r/raspberry-pi/raspberry-pi-4-model-b) and [Tailscale Linux installation](https://tailscale.com/kb/1031/install-linux).

## 3.3 Robotics and flight equipment

| Item | Status | Useful possibilities | Critical unknowns |
|---|---|---|---|
| LiteWing miniature drone | Photo-observed hardware resembling LiteWing; public references describe an ESP32-S3-based Wi-Fi drone with open hardware and modified Crazyflie-related software. | Potential read-only telemetry, controlled bench test or eventual flight experiment. | Verify exact revision, firmware, battery, API, operating condition and venue rules. Optional position/height sensors cannot be assumed. |
| Quadruped robot | Owner reports access; photographed robot resembles a Unitree Go2, but identity/edition is **not confirmed**. | Potential inspection, telemetry or field-test subject. | Exact manufacturer, model, edition, developer interface, permissions, camera access, network, safety supervision, battery and availability. Do not assume Go2 EDU/SDK/ROS access from appearance. |
| Additional “drone” | Owner reports access to a drone. It may or may not be the photographed LiteWing. | Future telemetry and testing. | Identify exact model, whether it is distinct from LiteWing, flight restrictions, documentation, batteries and accessible API. |

Public context: [LiteWing](https://circuitdigest.com/wiki/litewing/), [LiteWing product description](https://www.tindie.com/products/semicon_lab/litewing-esp32-based-programmable-drone/), [Unitree Go2](https://www.unitree.com/go2/) and [Unitree repositories](https://github.com/unitreerobotics). These sources do not establish what the pictured devices actually are or what access the owner has.

## 3.4 Modules, components and fabrication

**Observed across the images, with exact quantities unverified:**

- Atech modular displays, including a small screen on the black board.
- Two apparent 3×3 LED-grid modules on the white Atech board.
- At least one loose Atech module visibly labelled **Button**.
- Other Atech modules and plug-in enclosures; some have symbols but their function cannot be confidently inferred from the photos.
- Breadboards and jumper/connection wires.
- Electrolytic capacitor assortment; one of the lower-resolution previews was identified as a capacitor kit.
- Joystick / potentiometer-style inputs and a likely potentiometer module in a partially obscured bag.
- LCD modules including a 1602A-type display.
- A relay module and small DC motor.
- Solder and other basic electronics/prototyping supplies.
- Other Adeept-branded modules and an expansion board, with exact functions unconfirmed.
- **Owner-reported:** 3D-printing lab and soldering kits.

**Not yet confirmed:** a thermal camera, a usable microphone, IMU/orientation sensor, distance sensor, GNSS receiver, LoRa radio, geophone/seismic sensor, optical-flow sensor for the drone, waterproof enclosures, sufficient batteries or any particular wireless range. The Atech catalogue offers some of these module classes, but catalogue availability is not evidence of ownership.

## 3.5 Atech: what the documentation says

Atech’s [documentation](https://atech.dev/docs) describes a modular ESP32-based ecosystem, numbered ports, JSON events/actions, browser upload and an open-source Python SDK. The following describe the documented platform, not functionality independently tested on these particular boards:

- The documentation shows separate pin layouts for **10-port** and **14-port** boards. Verify which SDK board identifier corresponds to Frame 10 and Frame 2.1.
- A documented board sends events such as button presses and sensor readings; actions can drive supported outputs. Event keys depend on the firmware and configured modules.
- **USB mode:** direct local/offline connection, documented as newline-delimited JSON at 115200 baud. One program ordinarily holds the serial port at a time.
- **Documented editor Wi-Fi mode:** communicates through an Atech-hosted WebSocket gateway. It must not be described as local-first or offline without a separate implementation and test.
- Atech’s SDK requires Python 3.10+ according to the documentation. Its first ESP32 compiler download is described as approximately **2.4 GB**. Validate the current documentation and your environment before relying on that estimate.
- Browser flashing requires a desktop Chromium-based browser and a USB **data** cable. Safari and charge-only cables are not equivalent for the documented workflow.
- The listed catalogue includes an orientation sensor, 8×8 distance sensor, microphone, camera, microSD, temperature/humidity and other modules. These are **possible additions, not confirmed owner inventory**.
- The port headers include shared power rails; verify the exact pin map and device requirements before connecting or energizing anything. Do not assume all modules, board revisions or external peripherals are electrically interchangeable.

If code is later developed using the SDK, check `atech list-boards`, `atech list-modules` and the current Atech guide, ask the owner to confirm modules and port assignments, and do not overwrite existing firmware without permission. No Atech SDK installation, upload or device check was run in this workspace.

## 3.6 What different interruptions actually mean

1. **Device → Pi interrupted:** the Pi cannot record observations it never received. Events can survive only if the device itself buffers them and later sends them, which is not established.
2. **Pi → dashboard/service interrupted:** the Pi can retain events it has already received if local persistence is implemented and remains working.
3. **Pi loses power:** whether stored events survive depends on the persistence design, storage behavior and testing.
4. **Atech hosted gateway disconnected:** this is not equivalent to local USB behavior. The documented Wi-Fi path uses a hosted service.

Do not claim exactly-once delivery, offline operation, losslessness, secure communications or durable buffering without implementing and testing the relevant boundary.

---

# 4. What is realistically buildable with this hardware?

## Good first-weekend candidates

- A real physical button event entering a Pi or laptop application.
- A heartbeat and stale/unknown-state demo, if the board and data connection function.
- An event timeline with a source ID, receive timestamp, sequence number if implemented, and human annotation.
- A deterministic interruption of the test stream and a measured recovery in a controlled setup.
- A 3D-printed case or test fixture, labelled as a prototype rather than a certified waterproof device.
- A real orientation, distance or other sensor observation **only after the corresponding module is confirmed and tested**.
- Read-only robot/drone telemetry as a stretch if the actual interface is confirmed early.

## Promising, but substantially dependent on extra access

- Distributed multi-node network with independently powered devices.
- Real robot incident replay or performance tests using accessible telemetry.
- External sensor integration, radio transport or a hosted Nexus connection.
- Thermal processing of the actual challenge sequence.
- Reproducible multi-condition evaluation with a suitably specified physical apparatus.

## Do not promise from the current evidence

- An autonomous drone–quadruped swarm.
- A field-ready intrusion or acoustic drone detector.
- A LoRa or Meshtastic mesh, long-range operation, jamming detection or resistance.
- A thermal sensing payload.
- A weatherproof enclosure, certified robot, guaranteed safety or validated interception.
- Reliable person/threat classification, identity or intent from weak sensor signals.

For physical robotics testing, NIST’s [response-robot test-method resources](https://www.nist.gov/el/intelligent-systems-division-73500/standard-test-methods-response-robots/ground-robot-tests) are useful context: define the apparatus, procedure, measure and conditions rather than implying that a demonstration certifies a device.

---

# 5. Comparison of sponsor challenges and independent projects

| Option | Core problem | Required input / interface | Weekend strengths | Main risks |
|---|---|---|---|---|
| **Intelic Nexus** | Extend a hosted command-and-control environment in a useful, explainable way. | Hosted Nexus, Tailscale, applicable SDK/API, mentors. | Clear operator-oriented demo and potential software integration. | Live environment and exact API contract are unknown; simulated standalone software is not a substitute for the challenge’s hosted demo. |
| **Mantavia AIS** | Use public AIS and context to identify vessel behavior for human review and prioritize limited ISR attention. | Historical public AIS, incident/week data, blind-day data, infrastructure context. | Concrete evaluation and strong analytical story. | Large data, incident-date ambiguity, weak ground truth, data availability, and real sequential asset constraints. |
| **Thermal ISP** | Produce visually good, stable white-hot 8-bit video from raw thermal sequences. | Actual 640×512 post-NUC files and processing/export tools. | Strong before/after visual demo and reproducible engineering artifact. | Real-data image quality and runtime unmeasured; 25 fps is a target, not achieved evidence. |
| **Independent hardware/software** | Define a credible product and test a narrow slice, e.g., ProofLoop or BlindSpot. | Owned Atech hardware and Pi, plus whatever modules are actually available. | Avoids sponsor API dependence; useful physical demo and future product story. | Competition rules, device compatibility and customer need remain to verify. |
| **Independent software-only** | Solve an accessible workflow problem such as a narrow compliance evidence pack. | Current sources, domain expertise and software. | No hardware integration dependency. | Accuracy, legal/domain validation and competition from existing tools. |

Judging and access details must be checked directly with the event organizers. Prior app scores and rankings are subjective heuristics, not evidence that a team will win.

---

# 6. Intelic Nexus challenge

## 6.1 Supplied-brief summary

The owner supplied a description of a hosted Nexus stack reachable using Tailscale, with SDK examples in Go, Rust and Python, a CLI, Hub and C4I APIs, Swagger at port 2998, an offline documentation/mock portal, and mentors. The intended entry must demonstrate a working extension on the **hosted Nexus environment**. Exact endpoints, object models, permissions, available UI surfaces and metadata remain unverified.

The earlier apps interpreted example themes as intent-to-task workflows, video-to-map/geolocation, and integrating relevant external information. Treat these as leads from the supplied material and apps, not a replacement for the original brief.

## 6.2 Good candidate directions

- **FieldLink / SensorBridge:** ingest a real or clearly simulated observation, retain source and age, offer human review, and publish an appropriate item or proposal if the actual SDK permits it.
- **BlindSpot / OSINT Readiness:** show freshness, missing feeds and the effect on information quality. Silence must not look like a clear scene.
- **Handover / evidence ledger:** distinguish an observation, an operator note and a proposed action, and summarize unresolved items for a new operator.
- **TrustLine / GeoClick:** an uncertainty-aware geolocation concept. Treat it as a mathematical visualization prototype until the camera, timing, terrain and calibration inputs and independent validation are established. Avoid action-quality or weapon-quality claims.
- **Intent Compiler:** turn human intent into proposed tasks with deliberate review; exact tasking API and approval semantics are unknown. Avoid presenting generated output as verified operational planning.
- **AIS Integrity or external-context layer:** expose source age and inconsistent inputs, but do not assert spoofing or interference on weak evidence.

## 6.3 Critical questions for Intelic

1. How does an extension authenticate and reach the hosted instance through Tailscale?
2. What entity types, persistence, events/subscriptions, external services and UI extension points are supported?
3. Can it publish a source-labelled map item and a **proposal** without executing a command? Are approval, undo and audit trails available?
4. What actual camera, pose, gimbal, timestamps and terrain data are supplied, if pursuing a video/geolocation idea?
5. What works in mocks vs. on the live stack? What must judges see in the live demo?
6. Can the Pi or laptop use local USB/network hardware while remaining connected to the hosted environment?

Do not assume APIs or trust thresholds from public marketing. See [Intelic Nexus](https://intelic.ai/nexus).

---

# 7. Mantavia public AIS challenge

## 7.1 Supplied-brief requirements

- Use **public data**, particularly AIS and relevant contextual baselines.
- Produce ranked, explainable map alerts for **human verification**, not claims of intent, confirmed anchor state or confirmed cable damage.
- Replay a real incident and report the first relevant alert relative to a defensible incident time.
- Report the alert burden over the surrounding week under a defined counting rule.
- Support a judge-selected date from **7–16 September 2026** in the area **54.5–56°N, 13.5–16°E**, without code changes.
- Explicitly prioritize/cue **one ISR asset in sequence**, with approximately **one hour endurance at 25 m/s**. Do not imply that one asset simultaneously checks every alert.

The precise full brief, incident region for the week, timestamps and evaluation rules should be reconfirmed with Mantavia.

## 7.2 Critical incident correction

The supplied brief referred to the *Samus Swan* incident as **28 February 2022**; the Danish Maritime and Commercial Court’s public summary says **26 February 2022**. Ask Mantavia to confirm the intended incident, archive and timestamp. The legal-analysis account describes approximately 06:17, but the timezone for that exact timestamp needs confirmation. A separate report gives an AIS illustration around 06:18 local / 05:18 GMT. Do not state 05:17 UTC as conclusively verified from the legal account alone.

Public reporting indicates approximately 9–10 knots near the incident, not proof of a precise 10-to-7-knot signature. It is a warning against assuming that one simplistic low-speed condition necessarily describes the incident; it does not validate an alternative detector.

Sources: [Danish court summary](https://www.domstol.dk/soeoghandelsretten/aktuelt/2025/7/begraensningsfond-opretholdes/) and [Maritime Executive account](https://maritime-executive.com/article/utility-sues-uni-tankers-over-severed-power-cable-to-bornholm).

## 7.3 Data readiness and limitations

- Archive listings for the ten September days were previously indexed at approximately **6.37 GB compressed** in total; a February 2022 monthly archive was indexed around **14 GB compressed**. These are historical listing observations, not confirmed current downloads or disk-space estimates. Decompressed files require more space.
- The AIS archive endpoints returned HTTP 500 in the earlier research session. **No real AIS files were downloaded or parsed.**
- EMODnet has a public **power-cable actual routes** dataset with CC BY 4.0 metadata; whether the relevant cable is included and historically accurate for 2022 is unverified. A later revision can introduce hindsight. [EMODnet metadata](https://emodnet.ec.europa.eu/geonetwork/srv/api/records/41b339f8-b29c-4550-b787-3d68f08fdbcc)
- Historical file replay is not evidence of actual real-time delivery. An AIS gap can have many causes; AIS does not by itself establish an anchor’s state, damage or hostile intent.
- A literature review found limited accessible validated ground truth across AIS anomaly research. One known case does not establish system-wide recall. [AIS review](https://www.mdpi.com/2077-1312/10/1/112)

## 7.4 A defensible evaluation

Before seeing evaluation results, freeze the configuration, time/area definitions, alert episode grouping, case association rule and review policy. Preserve data source, version, timestamps, identity ambiguity and known quality issues. Distinguish observation time from actual availability time.

Report these possible incident outcomes honestly: **pre-damage alert**, **late alert**, **no alert**, or **not evaluable**. Report surrounding-week *alert episodes* and review outcomes—not unreviewed “false positives.” For the blind date, apply the same frozen configuration and show coverage and failure conditions. The ISR prioritization must account for a single platform and its total travel/endurance budget; no plan should be represented as an operational deployment.

The complete earlier evidence pack and proposed evaluation protocol is reproduced in Section 18.

---

# 8. Thermal image-processing challenge

## 8.1 Input and goal

The supplied brief describes raw **640×512**, **14-bit post-NUC** samples stored as **little-endian uint16**, converted to **8-bit white-hot video**. The stated target is **25 fps**—equivalent to a 40 ms/frame budget—on an average PC. Visual quality is the main judging criterion; speed, resources and streaming are secondary considerations.

A frame stored as uint16 is **640 × 512 × 2 = 655,360 bytes**. That is the input storage size, not a measured memory requirement for the complete pipeline.

The Drive metadata for `normal_nuc_2.bin` reported **180,224,000 bytes**. If—and only if—the file is a headerless contiguous sequence in the described format, its size corresponds to **275 frames**. The file was not downloaded because it exceeded the connector’s 100 MB transfer limit; its header, content, sequence boundaries, validity and any associated metadata remain unverified.

## 8.2 Proposed work

1. Access the real file(s), verify byte length, little-endian interpretation and frame boundaries.
2. Create a simple, reproducible linear and percentile-stretch baseline.
3. Inspect actual content before choosing corrections: spatial nonuniformities, noise, clipping, fast motion and brightness variation are hypotheses until seen.
4. Investigate tone mapping and temporal stability; compare visual artifacts, lost detail, flicker and ghosting with synchronized playback.
5. Export required full-length output videos and code. Measure speed, memory and buffering on named hardware.
6. Treat FPGA/streaming friendliness as an implementation question requiring a real design and resource accounting, not something proved by a rough pixel-rate calculation.

Thermal research background: [tone-mapping tradeoffs](https://arxiv.org/html/2305.00691) and an existing analysis tool, [IRimage](https://github.com/gpereyrairujo/IRimage). Neither validates a specific approach on the challenge data.

---

# 9. Independent ideas: detailed shortlist

## 9.1 ProofLoop / Robot Evidence Lab — leading provisional choice

**Problem:** Small teams building connected devices and robots may not know how their systems behave when telemetry is delayed, stops or recovers, and may struggle to produce a reproducible account of a test.

**Initial user hypothesis:** A small robotics or connected-device engineering team that needs a lightweight, repeatable fault-test and reporting workflow. This is an untested hypothesis; interview actual teams.

**Weekend MVP:**

1. An Atech board or other confirmed device emits a real button event and/or heartbeat over a known connection.
2. A Pi or laptop receives and logs it, including source and receive time. Add a sequence number in firmware if supported and implemented.
3. A small dashboard shows freshness and a test timeline.
4. The team pauses the **test stream**, not a robot’s safety or control link; the interface goes from fresh to stale/unknown after a declared timeout.
5. Restore the stream, record recovery, and export a report containing procedure, threshold, timestamps, configuration, outcome and limitations.
6. Optional stretch: add read-only robot telemetry once the exact interface is verified.

**What can be measured:** events received, missing/duplicate sequence numbers if produced and observed, state-transition times, the configured timeout, and reproducibility of the defined bench procedure. Use a single clock for time differences when possible; otherwise explicitly synchronize clocks and report uncertainty.

**What cannot be inferred:** robot safety, absence of a threat, jamming, real-world detection accuracy, safe operation under all faults, certification or a buyer-accepted assurance case.

**Long-term vision:** test scenarios, adapters for real logs or simulators, run comparisons, field-to-test handover, and reviewable evidence packages. This is not delivered by the MVP.

**Team recruitment:** embedded/ESP32; Python/backend; frontend/visualization; robotics testing or human factors. One person can cover more than one role.

**Competition and differentiation:** [Foxglove](https://foxglove.dev/product) already offers capture, visualization and replay; [Applied Intuition](https://www.appliedintuition.com/physical-ai) describes an end-to-end physical-AI platform. A possible wedge is a low-friction, reproducible **physical fault-test** workflow for small teams, not the invention of replay or an unproven cheaper replacement for enterprise tooling.

**Pitch:**

> **ProofLoop — test the failure before the field does.** We are building a portable test and evidence kit using modular ESP32 hardware and a Raspberry Pi. Our first demo runs a real device-to-dashboard workflow, introduces a controlled interruption, shows what the operator sees when data becomes stale, and exports a replayable test record. Long term, we want to make field failures easier to reproduce and investigate. Looking for embedded, backend, visualization and robotics-testing teammates.

## 9.2 BlindSpot — first application or standalone entry

**Problem:** A monitoring interface can look reassuring even after its sources stop reporting. The operator needs to see which information is stale or absent.

**MVP:** Real or clearly simulated source(s); heartbeat; explicit fresh/stale/unavailable state; last-received time; a timeline of the deliberate outage and recovery; optional human acknowledgement. If there are two actual nodes, show one remaining active while the other goes silent.

**Distinction from First Signal:** It asks whether the monitoring system itself is providing trustworthy current observations, not whether it can identify an approaching threat. Missing data does not reveal cause.

**Product hypothesis:** Teams with temporary sensor installations or connected systems may value explicit visibility gaps. Whether this solves a sufficiently painful problem requires operator interviews.

**Recruitment pitch:** “When the sensor goes quiet, don’t call the site safe. We’re building a transparent monitoring-health workflow with a live controlled outage and recovery.”

**Limit:** Freshness alone does not prove sensor coverage, correct calibration or absence of events. The same name appears in an earlier Nexus-oriented app; this version is an independent/generalized interpretation.

## 9.3 FieldLink — evidence-aware observation handover

**Problem:** An event is not the same as a usable handover. A person needs source, age, interpretation, uncertainty and a record of what happened next.

**MVP:** A button or confirmed sensor event reaches the Pi; a laptop UI displays the observation and last update; an operator chooses review, defer or dismiss with a reason; the history distinguishes raw observations from human notes and proposed actions. Suggest a neutral check, not a confirmed intrusion.

**Optional sponsor path:** If Nexus permissions and a suitable endpoint exist, publish a reviewed item or proposal to the actual hosted instance. Do not call the standalone dashboard a completed Nexus extension.

**Long-term vision:** multiple source adapters, loss/recovery behavior, workflow integration and reliable handover. Those require separate implementation and testing.

**Overlap:** Close to the other team’s grey-zone plugin, so differentiate with a specific use case such as temporary equipment inspection, transparency of source health and a disciplined human decision trail—not another claim of detecting infiltrators.

## 9.4 Robot Handover — turn a field incident into a test

**Problem:** A field operator observes unexpected robot behavior, but the engineering team cannot easily reconstruct what happened or check whether a later change fixed it.

**MVP:** A labelled mock robot-data stream and a real device event; annotate an issue; collect a time window, version, expected/observed behavior and notes; export a small test case; replay the same inputs through a simple revised rule.

**Stretch:** Substitute verified read-only robot telemetry for the mock. This requires confirmed model, SDK access and data permissions. No robot movement or autonomous flight is required.

**Competitive reality:** Existing robotics tools already capture, visualize, annotate and replay data. The proposed wedge is the specific **operator-to-engineer test handover**, and its usefulness remains to be validated. See [Foxglove’s product](https://foxglove.dev/product) and [Scout AI customer story](https://foxglove.dev/customers/scout-ai).

## 9.5 RapidDeploy — instrument and hand over a temporary site

**Problem:** A temporary installation needs more than sensor placement: a team needs to know which devices are installed, whether they responded to a check, and what gaps remain.

**MVP:** Two confirmed nodes, or one real and one clearly simulated if necessary; register their operator-entered locations and intended purpose; trigger a known test at each; show passed, failed and untested checks; export a handover sheet. Include a simple 3D-printed mounting fixture if it helps repeatability.

**Limit:** A passed bench check is not proof of coverage, resistance to weather or dependable field operation.

## 9.6 Equipment Witness — handling and movement history

**Problem hypothesis:** A recipient of equipment wants a reviewable record of handling or movement during handover.

**MVP if an IMU/orientation module is confirmed:** Mount a sensor on a small box; record deliberate tilt/movement; show configured thresholds, missing periods and human annotations. If only a button is available, describe it as a workflow stand-in, not a movement measurement.

**Competitive reality:** Asset monitoring and tamper/movement logging already exist, for example [AITHA Protection](https://aitha.es/en/products/aitha/) and other commercial products. A specific user and workflow would be needed to differentiate.

## 9.7 EdgeBench / device-health monitor / physical fixture

- **EdgeBench:** A small bench for measuring source-to-gateway behavior under explicitly controlled application-level delay, disconnection and restart. Report the exact setup and raw results rather than extrapolating to a contested network.
- **Device-health monitor:** Indicate expected heartbeat, last report, device state and power/connectivity information where actually available. Treat unmeasured states as unknown.
- **Physical test fixture:** A printed repeatable mount or enclosure for consistent button presses, sensor orientation or installation checks. Useful as an enabling component; not automatically a strong standalone product.

## 9.8 Phalanx-style autonomy development platform

**Vision supplied by another team:** A platform for interceptor/swarm developers covering simulation, AI training, automatic edge-case discovery, hardware testing, feedback into simulation, and buyer evidence.

**Why it attracts interest:** Strong articulation of a difficult buyer problem and a development lifecycle. It matches the owner’s request for an ambitious independent product vision.

**Why not build the whole thing in a weekend:** Each component is a substantial product; access to a real flight stack, data and expert testing is unverified. Existing commercial and open-source tools cover many layers.

**Credible slices:** ProofLoop’s physical observation test; Robot Handover; a generic, clearly synthetic scenario replay or failure-case registry. A toy simulation can test the software harness; it cannot prove field performance or interception effectiveness.

PX4 offers simulation/failure-testing capabilities, with limitations and configuration caveats; Mac setup exists but was not tested on the owner’s machine. See [PX4 failsafe simulation](https://docs.px4.io/main/en/simulation/failsafes), [failure injection](https://docs.px4.io/main/en/debug/failure_injection) and [Mac development setup](https://docs.px4.io/main/en/dev_setup/dev_env_mac). The referenced Isaac Sim alpha installation docs do not support macOS/non-NVIDIA hardware; verify the exact release before planning around it: [Isaac Sim installation](https://docs.isaacsim.omniverse.nvidia.com/7.0.0a1/installation.html).

## 9.9 Passage-style compliance workflow

**Problem supplied by another team:** A small defence/dual-use company must assemble export classification, sanctions screening, end-use and licensing information across borders.

**Narrow independent version:** For one defined origin, destination and product category, collect facts, cite current official sources, record source dates and unresolved questions, and produce an evidence pack for a qualified human. Do not state that goods are legal to export or that screening is complete based on a hackathon prototype.

**Key dependency:** Access to export-control expertise and up-to-date authoritative lists. Existing vendors already offer screening, classification and export automation; see [Descartes Visual Compliance](https://www.visualcompliance.com/). The potential niche would need customer and expert validation.

---

# 10. Other teams’ example projects, as supplied by the owner

These are **other teams’ descriptions**, not established capabilities or claims validated by this research.

| Team / idea | Owner-supplied concept | Assessment and possible collaboration |
|---|---|---|
| **First Signal — Early threat detection** | Protect critical infrastructure with active/passive detection when signals may be jammed and data incomplete. | Strong problem story, but a prototype must distinguish missing data from jamming and avoid unvalidated threat classification. ProofLoop or BlindSpot could complement their testing. |
| **Nexus grey-zone awareness plugin** | Combine own and third-party ground sensors, turn weak signals into check priorities, propose drone reconnaissance through Nexus, and require operator approval. Requested embedded/ESP32/LoRa/Meshtastic and software/MQTT/map help. | Compelling end-to-end benchmark; high integration and validation risk. Useful to join/partner if the team truly has complementary radio/sensor expertise and Nexus access. Human approval is important but is not evidence that detection is accurate. |
| **Phalanx** | Simulation, training, failure/edge-case testing, real hardware, field-data feedback and evidence for developers of swarm/interceptor systems. | Strong long-term vision; far too large to deliver as a complete weekend system. A targeted test or field-to-test evidence workflow is a credible first slice. |
| **On Your Radar** | Research underused radar markets; define constraints, components/interfaces and signal processing; produce an order-ready FMCW PCB design. | Potentially distinctive for RF experts. An order-ready design is not a demonstrated radar, and RF/legal/compliance review matters. Do not claim an operational tracking system without real testing. |
| **3D-printed sensor enclosure** | CAD, printing, embedded and waterproofing skills. | An excellent supporting workstream for a defined sensor use case. Waterproofing and ingress ratings need actual test methods and equipment. |
| **Hive Mind** | Distributed sensors and mesh networking. | Tangible networking theme; available radios, power, limits and real network behavior must be checked. A mesh alone is not a user problem. |
| **Passage** | Guided defence/dual-use export classification, sanctions, end-use and licensing workflow; initial Ukraine/EU corridor. | Strong user and business narrative; legal correctness, ownership screening, jurisdiction and source freshness are difficult. Existing products exist. A small source-linked human-reviewed workflow is safer than a broad legal conclusion. |

---

# 11. Earlier idea catalogue and research-app concepts

Some names below overlap or are variants of the same underlying concept. They are preserved so earlier work is not lost, **not** as a recommendation to build each idea separately. Descriptions reflect inspected project structure and stated intent, not proof of working integrations.

## 11.1 Ideas from `hackreview`

| Name | Concept and status |
|---|---|
| **SensorBridge** | Normalize observations from multiple sensor types and expose source health; a potential component of FieldLink. Nexus mapping/entity APIs unverified. |
| **BlindSpot** | Show stale, unavailable, delayed or conflicting information and its downstream impact; the independent version is described above. |
| **Handover** | Capture unresolved observations and operator decisions for a shift change. Persistence and identity support in Nexus unknown. |
| **SignalCheck** | Inspect corroborating/conflicting observations; different IDs alone are not independent sources. |
| **CableWatch** | AIS behavior and cable-context review, with the same public-data/ground-truth limitations as Mantavia. |
| **AIS Integrity Desk** | Flag inconsistent positions, duplicate identifiers, gaps or questionable data; do not label inconsistencies as proven spoofing. |
| **SteadyThermal** | Explore temporal stability and visual quality for a thermal ISP; requires actual sequence testing. |
| **ThermalLab** | Compare thermal-processing stages and preview data. The earlier raw loader was not validated on the challenge file. |
| **Spatial Debrief** | A spatial/timeline-oriented review or after-action concept; an interface idea, not independently validated. |
| **GeoClick** | Video click-to-location and uncertainty visualization; depends on camera geometry, timing, terrain and independent validation. |
| **OSINT Readiness Board** | Show age, source status and relevance of external information. Unknown feed does not mean a clean situation. |
| **Intent Compiler** | Translate human intent into proposed tasks; task semantics and trustworthy review remain open. |
| **Grey-Zone Check Queue** | Prioritize potential checks from sensor observations with operator control; detection accuracy and tasking integration unverified. |

## 11.2 Additional names and variants from `hack2ndrun`

| Name | Concept and status |
|---|---|
| **NexusGeo / Nexus Intent** | Variants of click-geolocation and human-reviewed intent/task proposals. Geometry simulations do not validate operational accuracy. |
| **Mantavia / Lifeline Watch** | Public AIS monitoring and analyst handover; full challenge includes single-asset cueing and real evaluation. |
| **Ground Truth** | Expose the strength/health of a multi-sensor evidence picture. Its toy sensor-ID independence logic is not real independence. |
| **Signal Integrity** | Warn that location or input data may be misleading; avoid attributing a cause without evidence. |
| **Lifeline Handover / Handover Pressure** | Operator handover and attention/decision-workflow concepts. User studies not performed. |
| **Last Mile** | Field reports that survive a broken connection. Real durability and exactly-once delivery need implementation and failure tests. |
| **InfraPulse** | Visualize the potential impact and context around infrastructure incidents; depends on authoritative data and careful uncertainty language. |
| **Floodline** | Disaster mapping plus incoming reports; label source, timestamp and uncertainty, and do not imply live emergency-service integration. |
| **Thermal Truth / ThermalLab** | Thermal quality workflow and synthetic stage comparisons; no real output quality benchmark established. |
| **GreyZone** | Synthetic sensor-to-check/recon proposal workflow; not a validated real sensor network or drone tasking system. |
| **ResourceCalc / Ideas** | Planning, concept comparison and resource estimation utilities; estimates are not measured results. |

## 11.3 Ideas surfaced by `hackideasreviewed`

- **CableGuard:** context-aware AIS episodes and single-asset cueing; see the critical future-data leakage below.
- **ClearHot:** thermal processing with a synthetic demo and a partial raw-file loader; real file and full export remain untested.
- **TrustLine:** uncertainty-aware click-to-map concept; per-frame metadata and error calibration are not verified.
- **Airbase Sentinel / Swarm Red-Team:** synthetic multi-agent threat/decoy policy and failure-boundary concept; hidden simulated labels contaminate the operator-facing result and it is not a real sensor or autonomy benchmark.
- **GNSS/ADS-B context layer:** aircraft navigation-quality reports can offer contextual data, but poor reported accuracy is not proof of jamming and is not direct evidence for a low-altitude drone. See [GPSJam FAQ](https://gpsjam.org/faq).
- **Satellite overhead windows:** a public-orbit-data visualization idea; only catalogued objects and approximate predictions would be represented. Source freshness and coverage matter.
- **Acoustic detection mesh:** high hardware, recording, labelling and field-validation risk; no confirmed microphone or real dataset is currently available.
- **Thermal-to-Nexus bridge:** cross-challenge idea only after the thermal output is finished and actual Nexus video extension support is verified.

A useful pattern across the projects is to preserve **source, age, context, missing data, human decisions and test conditions**. It is a design principle, not a validated universal scoring formula.

---

# 12. Detailed review: `hackideasreviewed.zip`

## 12.1 What the archive is

- A **standalone React/Vite/TypeScript** review and prototype application, not a literal source-code merger of the two earlier projects.
- The archive contains review, scorecard and planning views plus interactive CableGuard, ClearHot, TrustLine and Sentinel prototypes.
- It is useful as a research map and demonstration of ideas, but synthetic outputs and assertions require independent verification.
- The extracted source is at `hackideasreviewed_inspect/`; original archive is `google_drive/hackideasreviewed.zip`.

## 12.2 Checks performed

| Check | Result | What it does not establish |
|---|---|---|
| ZIP integrity | Passed. | Source correctness or security. |
| Dependency installation, build and TypeScript checks | Passed in the review environment; the single-file output was approximately **395.28 kB**. | Browser behavior, real data quality, operational integration or performance. |
| Targeted CableGuard test | Synthetic future-information leakage reproduced. | Real AIS detection performance. |
| Thermal smoke test | **20 synthetic thermal frames** processed. | Real challenge-data quality, full-file export or 25 fps. |
| Browser test | Attempted but failed because Chromium required missing `libnspr4.so`. | The app was not browser-validated in this environment. |

Targeted test script: `hackideasreviewed_lab/check.cjs`. Generated `node_modules` and `dist` directories may not persist in workspace snapshots; the original source and archive do.

## 12.3 Critical: CableGuard future-data leakage

**Location:** `src/views/CableGuard.tsx:47–54` and `src/sim/ais.ts:329–352` in the extracted archive.

**Issue:** The application detects episodes over the entire day, then filters episodes based on start time. The displayed episode contains later peak score, tier and features. This lets an earlier displayed alert incorporate information that occurred later in the synthetic sequence.

**Reproduced example:** At **05:14**, the causal synthetic score was **3.27 / review**; the UI-associated episode showed **4.34 / cue**, a peak occurring at **05:36**, **22 minutes later**. These are synthetic test values, not facts about an actual vessel or incident.

**Consequence:** An apparent early alert or ISR recommendation may depend on data not yet available at the purported alert time. Historical replay results and first-alert claims would be invalid until corrected.

**Fix direction:** Run the detector incrementally on a time-ordered stream. At each replay time, expose only records and episode state available up to that instant; preserve later updates as separate time-stamped revisions. Test with a deliberate late spike and assert it does not change earlier outputs. Separately document source availability vs observation time.

**Other caveats:** The simulated ISR planner resets from base rather than necessarily continuing from the asset’s previous position; verify sequential travel and return/endurance behavior. A configuration hash alone does not enforce a blind evaluation or prevent tuning. No real AIS run occurred.

## 12.4 ClearHot thermal prototype

**What exists:** An actual processing engine, synthetic frames and a browser raw-file loader. A synthetic 20-frame smoke test ran.

**Limitations:**

- The loader uses only the **first 150 frames**, while the Drive metadata would imply **275 frames** under the headerless assumption. It therefore would truncate that assumed file.
- A zero-byte input can be accepted; validation should reject empty or misaligned files.
- Some preview/analysis uses sparse sampling, which may miss temporal or spatial problems.
- Use explicit little-endian decoding rather than assuming native-endian `Uint16Array` behavior.
- Full-file video export, real-file loading, browser behavior, visual quality, flicker ROIs, absence of ghosting, buffering budget and 25 fps are not validated.

**Fix direction:** Validate file size and format, process all frames in bounded-memory chunks, decode little-endian explicitly, add robust error handling, and test synchronized outputs on the actual sequences. Measure runtime and peak memory.

## 12.5 TrustLine uncertainty prototype

**What exists:** A synthetic geolocation/uncertainty concept intended to make input quality visible.

**Limitations:** Synthetic coverage or stress tests are not real-world calibration. The actual Nexus extension contract, camera model, per-frame pose/timing, gimbal metadata, terrain, latency and available map objects were not established. A nominal ellipse must not be called an operationally validated error bound merely because it works on the model that generated it.

**Fix direction:** First verify interfaces. Then validate against independently generated known truth and deliberately unmodelled errors, report failures/coverage and distinguish simulation from field results.

## 12.6 Sentinel / Red-Team prototype

**Issue:** In `src/sim/swarm.ts:96`, the toy simulation uses hidden `g.kind === "threat"` when producing operator-facing alerts. That leaks a ground-truth label an actual detector would not have.

**Other limitations:** Policy comparisons may consume different random streams, confounding comparisons. No real sensors, PX4/SITL, human response, field test or validated detection/interception performance was demonstrated.

**Fix direction:** Ensure the policy sees only synthetic observations it would have access to, not hidden ground-truth labels. Use controlled seeds and shared scenario inputs when comparing policies. Label output as simulation and report modeled assumptions.

## 12.7 Treat the app’s own fact-check and scorecard cautiously

The app contains useful review notes, but some text asserts more certainty than independent research supports—for example an exact UTC conversion of the incident time, specific AIS signatures, SDK assumptions and subjective high scores. Use the court date and time caveats in this document and the evidence pack, not an unqualified UI assertion. Prior hard-coded results are not measured outcomes.

---

# 13. Review of earlier code packages

## 13.1 `hackreview.zip`

- Next.js/React/TypeScript project with PostgreSQL-backed state, an idea index and multiple previews.
- **Static inspection only**; it was not installed or run during the earlier review.
- The state routes appeared to lack authentication, rate limiting and ownership checks. Treat that as a security concern to verify and fix before any public deployment, not a complete security audit.
- `IdeaWorkspace.tsx` uses a shared debounce timer for different field updates. Source inspection indicates that one pending save can cancel another if updates occur close together. A merged pending patch or per-field queues would be a possible fix; it was not independently browser-tested.
- Thermal preview can load a raw-format file, but it was not tested against the supplied challenge file.
- Nexus and maritime previews are simulations, not proof of live API access or real-data performance.

## 13.2 `hack2ndrun.zip`

- Separate React/Vite/TypeScript decision and prototype app.
- `npm ci --ignore-scripts`, build and TypeScript checks passed; this is not a browser, security or actual-data test.
- A synthetic Mantavia view contains hand-authored examples and a greedy sequential-routing illustration. A label such as **“Real drags caught”** is misleading for synthetic examples and should be changed to a clearly synthetic description.
- Ground Truth treats distinct sensor IDs as independent evidence. This does not account for shared power, site, gateway, modality or common causes.
- The Nexus geolocation prototype’s model-based coverage check is not an independent real-world validation. Its assumptions and rejected/missing samples must be disclosed.
- Thermal processing is synthetic at a reduced resolution, not a completed challenge submission.

## 13.3 Combined package

`combined_hackathon_package.zip` was created with the two projects, exact original archives and checksums. It is a **collection**, not a merged source application. The archive passed an integrity check. Its `README.md` describes prior checks, caveats and possible follow-up. No real data, credentials, database content or live integration were bundled.

## 13.4 Earlier research apps

- `researching-nexus-c2-extensions.zip`: React/Vite research sections on Nexus, AIS and thermal.
- `geminiresearch.zip`: another research/workbench app. Some hard-coded counts, timings and validation-like assertions were not supported by actual data and must not be used as measured results.
- The independent research hub was built as a cleaner offline-friendly preparation tool; its content is planning guidance, not an operational system.

---

# 14. How to explore genuinely new ideas

## 14.1 Start with a user and a decision, not the hardware

For each new idea, write:

1. **Who** has the problem? Identify a concrete operator, technician, engineer or organization—not “defence” in general.
2. **What decision or job** is difficult today?
3. **What evidence or capability** is missing, and how is the job handled now?
4. **Why is the problem costly or consequential?** This is a hypothesis until you speak with users.
5. **What existing tools compete or substitute?** Vendor claims are leads, not independent verification.
6. **What can the team demonstrate in a weekend with real inputs?**
7. **What could go wrong or be misunderstood?** Include privacy, accuracy, permissions and safety.
8. **What would falsify the idea?** For example, a target user says the handover already takes one minute, or the intended API is inaccessible.

## 14.2 Idea-generation directions beyond the three sponsor briefs

- **Robotics engineering:** converting incidents to reproducible tests; test-fixture repeatability; health and logging workflows; benchmarking clearly defined device behavior.
- **Physical operations:** temporary-site setup and handover; traceable equipment checks; missing-data awareness; inspection records.
- **Resilience:** local collection, upstream outage visibility and tested recovery for a precisely defined connection boundary.
- **Human factors:** decision handover, source age, conflicting information, acknowledgment vs verification, avoiding unnecessary interruptions.
- **Engineering productivity:** configuration provenance, logs and test evidence for small hardware teams.
- **Non-hardware workflows:** source-linked compliance preparation, investigation handovers, public-data quality or other customer problems surfaced through interviews.

These are directions, not verified market gaps. If another team already addresses a problem, consider whether to join, collaborate or select a distinctly different user and outcome.

## 14.3 Lightweight decision matrix

Score candidates qualitatively or with team-selected weights; never present a numerical score as objective validation.

- Importance to a specific user and ability to interview them.
- Originality relative to existing products and other event teams.
- Availability of inputs and hardware.
- Ability to demonstrate an honest end-to-end slice.
- Technical and safety risk.
- Fit with actual teammates’ skills and motivation.
- Realism of data, validation and sponsor access.
- Ongoing product potential if the team wants to continue.

Pick **one hero workflow**, an optional supporting component, and a clear stop rule for stretch goals. Avoid building six partial products.

---

# 15. Prioritized next questions and action plan

## 15.1 Questions for the owner

1. Which Atech modules do you actually own? In particular: orientation/IMU, distance, microphone, camera, temperature/humidity and microSD. A photo of modules laid out separately is enough for a first pass.
2. Are Frame 10 and Frame 2.1 functioning, and do you have compatible data USB cables and permission to reflash them?
3. Is the Pi board in the box, working, and supplied with storage, an OS and suitable power?
4. What kind of teammates do you expect—embedded, Python, frontend, robotics, computer vision, geospatial, domain or legal?
5. Would you prefer building your own team, joining one of the teams described, or collaborating with them?
6. Is the goal primarily to win a sponsor prize, build an independent startup-like concept, learn, or maximize a live hardware demo? These can be weighted rather than treated as mutually exclusive.

## 15.2 Questions to ask organizers / hardware owners

1. Do independent projects compete on the same terms as the three sponsor challenges? What are the actual judging categories and prizes?
2. Exact quadruped manufacturer, model, edition and firmware; can participants access **read-only telemetry and SDK**? Are there safety/usage restrictions?
3. Exact drone model(s), telemetry/API access, batteries and venue flight rules; is the photographed LiteWing the same as the separately mentioned drone?
4. Are USB webcams, IMUs, distance sensors, microphones, contact switches, geophones or other specific sensors available to borrow?
5. Are LoRa/Meshtastic radios, suitable antennas and legal/venue permission available? If not, use USB or ordinary local networking rather than calling Wi-Fi a mesh.
6. Are reliable local Wi-Fi, Ethernet, USB data cables, power supplies, microSD cards and 3D printing materials available?
7. For Nexus: can the Pi/laptop join the challenge tailnet, and what entities, proposal actions and UI surfaces are supported?
8. For Mantavia: confirm the incident date/time, dataset and boundaries, AIS availability, cable geometry and ISR rules.
9. For thermal: confirm raw-file access, sequence/frame boundaries, output format and evaluation setup.

## 15.3 Suggested preparation sequence

**Before choosing the final project**

- Inventory the actual Atech modules, firmware and board revisions.
- Verify the Pi boots and a USB data cable works.
- Confirm event rules and seek exact robot/drone interfaces.
- Speak with at least one plausible end user or domain mentor about the problem.
- Compare the shortlisted idea against at least one existing tool or competing team.

**If ProofLoop is chosen**

1. Define one observation and one test-stream failure condition.
2. Establish a local USB device-to-Pi data path; log raw records.
3. Specify heartbeat interval, freshness threshold and expected result.
4. Run a controlled interruption and recovery; preserve the original log.
5. Build a simple view and export including actual measured timestamps and explicit unknowns.
6. Rehearse with a fresh reviewer; improve clarity rather than adding more devices.
7. Only if stable, add robot read-only telemetry or another real sensor.

**Decision gates:** If Atech board compatibility fails, use the Pico/ESP32 or a laptop-generated test stream, explicitly labelled; if the Pi fails, use the Mac as the gateway; if the API is unavailable, keep the demo independent; if real robot access is unavailable, do not imply integration.

---

# 16. Existing files and deliverables

Paths below are workspace-relative and may be useful if the original workspace remains available. This document includes the full Mantavia pack in Section 18 so it can be read standalone; the other archives and images are not embedded in this Markdown file.

| Path | Contents |
|---|---|
| `Hackathon_Complete_Research_Hardware_and_Project_Brief.md` | This consolidated master document. |
| `Mantavia_Evidence_Pack_and_Evaluation_Plan.md` | Original standalone detailed public-AIS evidence pack and evaluation plan, reproduced below. |
| `combined_research_hub/index.html` | Offline-friendly three-challenge research and preparation hub; no live data/SDK integration. |
| `combined_hackathon_package.zip` | Earlier handoff with two separate projects, original archives and checksums. |
| `combined_hackathon_package/README.md` | Description of combined package and prior verification limits. |
| `google_drive/hackideasreviewed.zip` | Latest review/prototype archive. |
| `hackideasreviewed_inspect/` | Extracted source of the latest review app. |
| `hackideasreviewed_lab/check.cjs` | Targeted synthetic CableGuard/thermal test script. |
| `google_drive/hackreview.zip`, `google_drive/hack2ndrun.zip` | Earlier supplied source archives. |
| `hackreview_inspect/`, `hack2ndrun_inspect/` | Their inspected extracted source. |
| `google_drive/researching-nexus-c2-extensions.zip`, `google_drive/geminiresearch.zip` | Earlier supplied research apps. |
| `google_drive/20261113_141212.jpg` | Latest Atech/Pi photograph. |
| `google_drive/20261113_135*.jpg` | Earlier hardware photo downloads; filename/ID mapping was not consistently reliable. |
| `hardware_thumbnails/` | Resized/rotated views and crops used for visual inspection, including two larger Drive previews. |

The thermal raw file `normal_nuc_2.bin` was identified in Drive metadata but **is not present in the workspace** as a downloaded dataset. AIS files were likewise not downloaded.

---

# 17. Selected source register

Links support the specific claims above; they do not validate the proposed products or replace organizer confirmation.

### Event and challenge background

- [Event challenge page](https://events.eurodefense.tech/almere-2026/challenges) — membership-gated when previously checked; briefs came from the owner.
- [Intelic Nexus](https://intelic.ai/nexus) — public platform background; exact event SDK functionality remains unverified.

### Atech and hardware

- [Atech documentation and module reference](https://atech.dev/docs) — board layouts, module catalogue, documented JSON/USB/Wi-Fi and SDK workflow.
- [Atech product catalogue](https://atech.dev/buy) — modules sold, not evidence of owner inventory.
- [Raspberry Pi 4 overview](https://www.digikey.com/en/product-highlight/r/raspberry-pi/raspberry-pi-4-model-b) — Pi hardware specifications.
- [Tailscale Linux documentation](https://tailscale.com/kb/1031/install-linux) — includes Raspberry Pi OS.
- [Raspberry Pi Pico series](https://www.raspberrypi.com/documentation/microcontrollers/pico-series.html) — microcontroller distinction.
- [Espressif ESP32-S3 DevKitC-1](https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32s3/esp32-s3-devkitc-1/index.html) — development board; does not imply LoRa.
- [LiteWing overview](https://circuitdigest.com/wiki/litewing/) and [LiteWing listing](https://www.tindie.com/products/semicon_lab/litewing-esp32-based-programmable-drone/) — relevant leads; identify actual pictured revision.
- [Unitree Go2](https://www.unitree.com/go2/) and [Unitree GitHub](https://github.com/unitreerobotics) — public robot information, not proof of model or SDK access.

### AIS and incident evidence

- [Danish court summary](https://www.domstol.dk/soeoghandelsretten/aktuelt/2025/7/begraensningsfond-opretholdes/) — date of the *Samus Swan* cable incident.
- [English legal analysis](https://cdn.prod.website-files.com/6183d750c2a4a2d74e966763/68f0f309d894bca7719b5d8f_The%20Maritime%20and%20Commercial%20High%20Courts%20ruling%20of%204%20July%202025.pdf) — detailed account; verify exact time basis.
- [Maritime Executive incident report](https://maritime-executive.com/article/utility-sues-uni-tankers-over-severed-power-cable-to-bornholm) — secondary context and reported AIS illustration.
- [Danish Maritime Authority AIS page](https://www.dma.dk/safety-at-sea/navigational-information/ais-data) — historical-data access and AIS caveats.
- [EMODnet power cable actual routes metadata](https://emodnet.ec.europa.eu/geonetwork/srv/api/records/41b339f8-b29c-4550-b787-3d68f08fdbcc) — dataset and licensing metadata; specific cable/historical accuracy not checked.
- [Wolsing et al. AIS anomaly review](https://www.mdpi.com/2077-1312/10/1/112) and [AIS loitering research](https://peerj.com/articles/cs-1572/) — research background, not validation of our proposed model.
- [IMO AIS operational guidelines PDF](https://wwwcdn.imo.org/localresources/en/OurWork/Safety/Documents/AIS/Resolution%20A.1106(29).pdf) — AIS limitations and operational context.

### Robotics, existing products and evaluation

- [NIST robot test methods](https://www.nist.gov/el/intelligent-systems-division-73500/standard-test-methods-response-robots/ground-robot-tests) — repeatable testing context.
- [PX4 simulation failsafes](https://docs.px4.io/main/en/simulation/failsafes), [failure injection](https://docs.px4.io/main/en/debug/failure_injection), [Mac setup](https://docs.px4.io/main/en/dev_setup/dev_env_mac) — simulation tooling leads with documented limits.
- [Foxglove product](https://foxglove.dev/product) and [visualization](https://foxglove.dev/product/visualization) — established robot-data capture/replay capabilities.
- [Applied Intuition physical AI](https://www.appliedintuition.com/physical-ai) — vendor-described broader simulation and validation platform.
- [Wireless condition-monitoring example](https://avtreliability.com/wireless-sensors-for-condition-monitoring/) — existing sensor/gateway market.
- [Descartes Visual Compliance](https://www.visualcompliance.com/) — existing screening and trade-compliance tooling.
- [Meshtastic integrations](https://meshtastic.org/docs/software/integrations/), [ATAK plugin](https://github.com/meshtastic/ATAK-Plugin), [MeshTAK](https://github.com/AkitaEngineering/Akita-MeshTAK) — examples of existing integrations; not evidence of user hardware or secure deployment.
- [GPSJam FAQ](https://gpsjam.org/faq) — cautions on interpreting aviation-derived navigation-quality observations.
- [Thermal tone-mapping research](https://arxiv.org/html/2305.00691) and [IRimage](https://github.com/gpereyrairujo/IRimage) — thermal processing context.

---

# 18. Full previously delivered Mantavia evidence pack and evaluation plan

The following is included in full for completeness. It was written as a standalone research/evaluation document, before the later decision to broaden the search to independent projects. Its findings remain subject to the same unverified-data caveats stated above.


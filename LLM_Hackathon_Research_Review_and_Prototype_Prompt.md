# Prompt: End-to-end hackathon research, idea review and interactive prototypes

You are acting as a multidisciplinary research, product, software and prototyping team. I want a rigorous, independent review of the material below and a set of strong hackathon project recommendations, backed by research and visualized through working interactive prototypes.

**Do not limit your work to the three sponsor challenges.** The hackathon explicitly welcomes teams bringing their own projects. A strong independent product vision with a credible weekend demonstration may be better than a sponsor-track submission.

Please go deep rather than giving me a quick summary. Read the linked material, critically examine the existing ideas and code, broaden the research, propose better ideas, and build interactive previews using clearly labelled mock data.

---

## 1. What I want at the end

Produce the following, with a clear distinction between what you actually tested and what remains a concept:

1. **An end-to-end review of the existing hackathon package:** what it contains, which ideas and components are useful, what is duplicated, where it misrepresents capabilities or contains bugs, and what should be retained, merged, reworked or discarded.
2. **A review of my separate `benchmark` repository:** what it actually does, its architecture, inputs, outputs, strengths and limitations, and whether any part could credibly support a hackathon project or an independent product. Do not assume what this repository does before inspecting it.
3. **Extensive, up-to-date research** into the operational and civilian problems discussed below, with sources, dates, uncertainty and comparisons to existing solutions.
4. **A broad portfolio of project ideas**, including improved existing ideas, sensible combinations and genuinely new independent ideas. Compare them against the existing projects and the ambitions of the examples below.
5. **A defensible shortlist and recommendation:** explain why the leading projects are promising, what could make each fail, which assumptions would change the ranking and which team skills are required.
6. **Working interactive previews** for the strongest shortlisted ideas, using mock data where real data or hardware is unavailable, so I can understand what the finished products might look like and how their workflows would feel.
7. **A detailed handover:** research report, source register, code-review findings, project briefs, demo scripts, assumptions, open questions and instructions to run the prototypes.

If your environment can create files, put the report and prototype code in the workspace. Provide an obvious entry point and present or link the final deliverables. If you can run a live preview, do so. If you cannot build or run an application, say so explicitly and provide the most complete runnable code or alternative visual artifacts your environment allows.

---

## 2. Materials to inspect

### A. Existing hackathon research and prototypes

Review this directory **end to end**:

https://github.com/knarayanareddy/EDTH-Hackathon/tree/main/combined_hackathon_package

Inspect the README, directory structure, manifests, important source files, interfaces and existing previews before deciding what to reuse. This package contains multiple projects and should not automatically be treated as one integrated application.

### B. Consolidated research and hardware brief

Read this in full:

https://github.com/knarayanareddy/EDTH-Hackathon/blob/main/Hackathon_Complete_Research_Hardware_and_Project_Brief.md

It consolidates our prior research, inventory, challenge summaries, project ideas, reviews and the Mantavia evidence pack. Treat its claims and recommendations as **starting points to verify**, not as authoritative conclusions. It also contains findings about a separate `hackideasreviewed.zip`; do not assume that archive is inside the combined package unless you verify it.

### C. My separate project

Inspect:

https://github.com/knarayanareddy/benchmark

Investigate what it really implements and whether it can be adapted, integrated, used as inspiration or should be left separate. I want a concrete assessment grounded in actual files, not speculation based on the repository name.

### D. If anything is inaccessible

Try reasonable lightweight alternatives such as the repository file browser, GitHub API or individual raw text files. Record exactly which files you did and did not inspect. If a repository or specific material cannot be accessed, state the limitation and continue with the accessible material; ask me only if a missing item is necessary for an important conclusion.

**Do not download large files or datasets.** This workspace cannot accommodate them. Inspect metadata, file trees and individual small text/source files instead. Do not clone large repositories or download large archives, models, videos, raw thermal files or AIS datasets. When a required file is large, report its name, stated size, purpose and what would need testing later. Use small, transparently synthetic fixtures for prototypes.

Avoid modifying either GitHub repository, deploying publicly, using credentials or transmitting data without asking me first. Check dependencies and scripts before executing untrusted code.

---

## 3. Event context and the three sponsor challenges

The event aims to bring together technologists, the public sector, investors and operators in dual-use and defence technology. Teams may take inspiration from the prepared challenges **or bring their own project**. The objective includes receiving feedback from people with frontline experience and being in a position to continue toward deployment.

The following is an accurate working summary of the challenge material I was given. Confirm exact wording with the official brief if accessible; distinguish a sponsor requirement from your own proposed design.

### 3.1 Intelic: Extending Nexus

Build an extension for Intelic’s Nexus command-and-control platform that addresses a real operational problem. Extensions may add vehicles, sensor feeds, map layers, video processing or operator applications without modifying the Nexus core.

Examples in the brief include: translating commander intent into explainable mixed-fleet tasks; a video observation with a geolocation/error estimate; and operationally relevant OSINT integrations. Teams can propose another problem.

Teams are to receive a hosted Nexus instance accessible via Tailscale, an extension SDK with Go/Rust/Python examples, `intelic-cli`, Hub and C4I APIs documented via Swagger on the team VM at port 2998, an offline documentation/mock API portal, an optional coding-assistant plugin and on-site mentors. Hosted environments are available shortly before the event.

**Success:** a live demo on the team’s actual hosted Nexus stack, judged for operational relevance, UI/UX under stress, trust/explainability and end-to-end demo quality. A standalone mockup is useful preparation but is not the required hosted integration. Verify SDK capabilities rather than inventing endpoints or permissions.

### 3.2 Mantavia: Early detection of threats to subsea infrastructure from open AIS

Using **public data only**, ingest and clean AIS, model normal behavior in context, present ranked explainable behavioral alerts on a map, and prioritize which alerts one limited-endurance ISR asset should investigate **and in what order**. Alerts are for verification, not verdicts about intent, anchor state or damage.

The asset has roughly **one hour endurance at 25 m/s**, starting from a fixed base. The deliverable is a live laptop demonstration, including:

- A real publicly reported incident, with first alert time compared to reported damage time.
- Alert burden over the surrounding week in the same area.
- A judge-selected date from **7–16 September 2026**, in **54.5–56.0° N, 13.5–16.0° E**, run without changing code.

Do not download the large AIS archives here. Research data access and demonstrate workflows using mock data; identify precisely what needs real-data validation.

**Known issue to recheck:** the supplied brief calls the Bornholm *Samus Swan* case 28 February 2022, while a Danish court summary gives 26 February 2022. The precise incident timestamp and timezone also need confirmation. Do not invent a measured alert time, call unreviewed alerts false positives, or treat a retrospective replay as proof of live data availability.

### 3.3 The Fourth Law / Odd Systems: Thermal ISP

Develop a pipeline from raw post-NUC thermal frames to stable, contrasty, artifact-minimized **8-bit white-hot video**. Input is a headerless raw dump of **640 × 512**, 14-bit values stored as **little-endian uint16**, frames back to back. The target is **25 fps / 40 ms per frame** on an average PC. A truly streaming, low-buffer design suitable for an FPGA is a bonus.

Deliverables include code with one-command instructions, 8-bit white-hot MP4 output for each sequence, a speed/memory note, and a before/after demo with the rationale for processing decisions. Main judging criterion is image quality by eye; speed, resources, streaming and reasoning are secondary. Flicker, loss of scene, ghosting and new artifacts count against the result.

The raw `.bin` is a large file: **do not download it here**. If you prototype thermal processing, use small synthetic images, clearly identify them and make no claim about visual quality on the real data, throughput or FPGA suitability without testing.

---

## 4. A benchmark for ambition: independent autonomy-development project

One team proposed an ambitious product around the problem that small drone and autonomy developers must stitch together simulation, AI training, autopilot software, CAD and flight testing. Their proposed long-term platform would simulate and train systems, find failures and edge cases, test on real hardware, feed field observations back into simulation, and produce evidence a buyer can evaluate.

Use this as a **benchmark for ambition and product thinking**, not as a scope that must be completed during a hackathon. Critically examine whether a narrow slice is more credible and differentiated. Consider, for example, repeatable fault tests, simulation-to-field evidence, incident-to-test handover, robustness evaluation or test-report generation—but do not force the answer to be a robotics platform.

Do not claim that a toy simulation proves swarm performance, interception, safety, resilience under jamming or buyer readiness. Compare against existing commercial and open-source tools and identify a realistic initial user and potential gap.

---

## 5. Research focus: Ukraine, real needs and existing infrastructure

I especially want you to investigate **Ukraine and the wider European security/dual-use context**, while keeping the research broad enough to uncover better ideas elsewhere.

Research questions:

1. What kinds of problems have Ukrainian civilians, infrastructure operators, emergency responders, service providers and military personnel faced in recent attacks or sustained disruption? Look for recurring, severe or operationally difficult “nightmare scenarios,” not just the most sensational headlines.
2. What is known about the effects on critical infrastructure, continuity of essential services, warnings, communications, situational awareness, repair, logistics, medical/emergency response, data quality and human coordination?
3. What existing organizations, public systems, tools, products, practices or community-led solutions are already addressing these needs? What appears to work, where, for whom and with what evidence? What limitations or contested claims are visible?
4. What gaps remain credible opportunities for a small team? Distinguish verified needs from hypotheses inferred from public reporting. Speak in terms of realistic users and constraints, not generic “AI for defence.”
5. Which problems could be explored safely through a dual-use or civilian-resilience prototype, and which would require access, expertise, data, permissions or real-world validation we do not have?
6. How might the existing hackathon ideas, the Atech/Pi hardware, or the actual capabilities of my `benchmark` repository help—if at all? Do not force a fit.

Use current, reputable sources where available: primary institutional sources, public authorities, humanitarian organizations, research institutions, credible journalism and company documentation where relevant. For fast-changing claims, report the **publication date and the date of the underlying event**, and distinguish confirmed findings, public claims, estimates and uncertainty. Prioritize aggregation and retrospective analysis over exposing real-time sensitive locations, vulnerable sites or personal information.

Frame potential solutions around protection, safety, resilience, evidence, repair, warning, human decision support and evaluation. Do not turn incomplete public information into actionable targeting, interception, autonomous attack or real-time tracking instructions. Respect privacy and do not reproduce sensitive personal records. Where an idea touches a military workflow, explain the access, legal, safety and human-accountability constraints.

If web access or current sources are unavailable, explicitly say so and do not present training-data assumptions as current research.

---

## 6. Available hardware and constraints

Use the consolidated brief for the full inventory. At a high level:

- I own and have access to **Atech Frame 10 and Frame 2.1 modular boards**, with a visible button, display and LED grids in the photos; the exact set of additional modules needs confirmation.
- A box is labelled **Raspberry Pi 4 Model B, 8 GB**; confirm the board and accessories are actually working.
- There are ESP32-class development boards, a Raspberry Pi Pico W, breadboards, basic electronic components and inputs, plus access to soldering equipment and a 3D-printing lab.
- I have reported access to a drone and a quadruped. The precise models, developer interfaces, permissions, battery state and ability to obtain telemetry remain unconfirmed.
- I have a Mac. Team skills and composition are not yet fixed.

Atech’s catalogue includes other sensors, but do not infer that I own a microphone, IMU, distance sensor, camera, geophone, GNSS or LoRa radio merely because the manufacturer sells one. Likewise, do not infer robot SDK access or flight permission from a photograph.

Atech’s documented USB mode is local/offline; its documented editor Wi-Fi mode uses a hosted gateway. Verify compatibility with my board revisions and modules. A stopped device-to-gateway connection is not automatically buffered; loss/recovery claims require an implementation at the correct boundary.

For any recommended project, list:

- Hardware I appear to have or have said I can access.
- Which components and interfaces must be verified.
- What complementary hardware would help, prioritized as **essential / useful / optional**.
- A fallback if the robot, drone, sensor, hosted API or network is unavailable.

I can ask the event organizers or equipment owners about additional hardware. Give me a concise, prioritized list of specific questions to ask.

---

## 7. How to review and improve the existing ideas

For each significant existing concept or group of overlapping concepts:

- Explain the user, actual problem, proposed workflow and why it might matter.
- Assess feasibility, genuine novelty, existing competitors, access and integration risk, data and validation requirements, team fit and live-demo potential.
- Identify hidden assumptions, misleading confidence metrics, simulated outcomes, data leakage, security/privacy concerns and operational overclaims.
- Recommend **keep / merge / improve / park / discard**, with reasons.
- Where combining features helps, explain exactly what becomes one product, what remains a supporting feature and what should be left out of the weekend MVP.
- Consider an independent entry as seriously as the sponsor challenges.

The consolidated brief includes prior candidates such as ProofLoop, BlindSpot, FieldLink, Robot Handover, RapidDeploy, equipment monitoring, thermal processing and AIS integrity. Assess them critically rather than endorsing them because they were previously recommended. Propose entirely different ideas if the research supports them.

Also compare the overall product directions against the other team examples described in the brief: early detection, sensor-to-human-approved reconnaissance, a simulation/validation platform, FMCW radar, a 3D-printed enclosure, distributed/mesh sensors and export-control assistance. You do not need to reproduce these teams’ work. Explain overlap, possible collaboration and how our strongest idea would differ.

---

## 8. Requirements for the interactive previews

Build a coherent interactive prototype experience for the **strongest shortlisted concepts**. Prefer depth and a usable end-to-end story over a large number of shallow screens.

For each prototype, include as appropriate:

1. A concise problem/user context and visible **MOCK / SIMULATED** label.
2. A believable but fictional scenario and data, without real vulnerable infrastructure locations or personal details.
3. A clear flow from input/observation → processing or decision support → human review → outcome/handover/report.
4. Interactive controls that let me explore a normal case and at least one failure, uncertainty, data-gap or edge case.
5. Explicit source, time, freshness, assumptions and uncertainty where relevant.
6. Evidence or a log that shows what the mock system actually did; do not display invented outcomes as measured real-world results.
7. An explanation of what is simulated, what would require actual integration and how the real product might evolve after the hackathon.
8. Accessibility-minded, legible layouts and useful empty/loading/error states. Do not rely on color alone for critical states.

If several ideas overlap, build a shared shell with separate workflows rather than duplicating everything. Use deterministic local fixtures and clearly document how to reset them. Avoid external APIs, runtime secrets and network-dependent assets unless explicitly necessary; if you use any, explain the dependency and provide a local fallback.

**Technical expectations:**

- Use an appropriate modern stack for the available environment; prioritize reliability and ease of running over unnecessary complexity.
- Inspect existing code before reusing it. Fix or avoid known data leakage, hidden-label leakage and misleading simulated metrics.
- Provide a README, dependencies, exact commands, project structure and a list of implemented versus proposed features.
- Run appropriate build/type checks and, if possible, a browser or interaction smoke test. Report exact successes, failures and limitations. Do not call an untested feature complete.
- Do not claim real Nexus integration, actual AIS incident detection, actual thermal quality, robot connectivity or a secure/offline system unless verified.

---

## 9. Deliverable structure

Please structure the final report roughly as follows:

1. **Executive summary:** best ideas and why; what I should do next.
2. **Evidence and access ledger:** repositories/files inspected, current-source research, tests run, unavailable inputs and dates.
3. **Existing package review:** architecture, ideas, UI/prototypes, bugs, security/privacy and recommendations, with file paths or line references.
4. **`benchmark` review:** actual functionality, reusable pieces, limits, possible applications and a recommendation.
5. **Research on Ukraine and related real-world needs:** evidence, existing responses, unresolved gaps, source dates and limitations.
6. **Comparative idea catalogue:** existing, improved, combined and new ideas, including independent concepts.
7. **Top project briefs:** user, problem, existing alternatives, differentiator hypothesis, weekend MVP, long-term vision, hardware/data dependencies, risks, evaluation, team roles and a recruitment-ready pitch.
8. **Prototype guide:** what each preview demonstrates, how to run it, mock-data boundaries, tests and screenshots or live-preview links if available.
9. **Decision matrix:** clear criteria and weights; identify subjective judgments and avoid fabricated market or performance scores.
10. **Implementation and demo plan:** first hours, integration gates, fallback and a concise presentation story.
11. **Prioritized questions:** what I should ask the organizers, hardware owners, mentors and potential users.
12. **Source register:** direct links, publication/event dates where relevant, what each source supports and its limitations.

Clearly label **observed**, **source-supported**, **code-inspected**, **tested**, **simulated**, **unverified** and **proposed** claims. If an important step fails, document it rather than filling the gap with invented results.

---

## 10. Working style

- Be skeptical, precise and constructive. I want the strongest idea, not validation of my prior preferences.
- Research broadly, but converge on a small number of well-developed candidates.
- Distinguish a compelling long-term product story from a credible hackathon MVP.
- Make the prototypes genuinely interactive and useful for visualization, not just concept descriptions.
- Do the work that can be done now. Ask me questions when they materially block progress, but otherwise make transparent assumptions and proceed.
- Do not download large files or datasets. Do not modify the source repositories or deploy publicly without permission.

import { useMemo, useState } from "react";
import { Bullets, Callout, CRITERIA, H, Panel, Slider } from "./components/ui";
import { REVIEWS, SKILLS, Skill } from "./content";
import { cn } from "./utils/cn";

export default function Overview({ go }: { go: (id: string) => void }) {
  const [w, setW] = useState({ feas: 3, wow: 2, proof: 3, ready: 2, fit: 3 });
  const [skills, setSkills] = useState<Skill[]>([]);

  const ranked = useMemo(() => {
    const tot = Object.values(w).reduce((a, b) => a + b, 0) || 1;
    return REVIEWS.filter((r) => r.id !== "ideas")
      .map((r) => {
        const base = CRITERIA.reduce((s, c) => s + r.scores[c.key] * w[c.key], 0) / tot;
        const share = skills.length ? r.skills.filter((s) => skills.includes(s)).length / r.skills.length : 1;
        return { r, base, share, total: base * (0.55 + 0.45 * share) };
      })
      .sort((a, b) => b.total - a.total);
  }, [w, skills]);

  return (
    <div>
      <div className="mb-8">
        <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-amber-400">Almere 2026 · Eurodefense hackathon</div>
        <h1 className="mt-2 text-3xl font-semibold leading-tight text-white md:text-4xl">Challenge review & decision brief</h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-400">
          A critical read of the three official challenges, the grey-zone plugin idea and the eight suggested alternatives, each with an interactive preview of the core mechanic, plus extra ideas. Everything marked "synthetic" is an illustration, not a result. Scores are my judgement and are adjustable below.
        </p>
      </div>

      <Callout tone="amber" title="Honesty note">
        I couldn't load the event's challenge page, so I worked from the text you pasted plus public sources (DMA, Energinet reporting, trade press, Intelic's site). I have not seen the Nexus SDK, the thermal .bin, or the Mantavia data. Anything about those is flagged as an assumption to verify.
      </Callout>

      <H kicker="Research findings">What I found that changes the picture</H>
      <div className="grid gap-3 md:grid-cols-2">
        {[
          ["The Nexus rubric is a 'calibrated trust' rubric", "Explainability, alarm fatigue, staleness/readiness and 'what happens after a misclick' are one theme. A small honest trust layer can beat a large feature set. 'Not the most code' is stated in the brief."],
          ["The Bornholm vessel was not 'slow'", "Public reporting puts the Samus Swan at roughly 9-10 kn when the cable failed. A 'few knots' rule would miss your own validation case; contextual features carry the discrimination."],
          ["Two date traps", "Incident date: Energinet says 26 Feb 2022 (06:17 local), the brief says 28 Feb. And the AIS window is '7-16 Sept 2026'. If the event is earlier, that data can't exist yet. Ask both questions now."],
          ["Half the suggestions are the official challenges", "Lifeline Watch = Mantavia, ThermalTruth = Thermal ISP. The other six are independent projects with weak or no challenge fit. Their reusable parts (evidence states, staleness UI, handover) work best as components."],
          ["Environment timing is the biggest Nexus risk", "Hosted VMs appear 'shortly before' the start. Build the maths and test harness offline using the mock portal, and keep it SDK-independent."],
          ["The grey-zone idea and Ground Truth are the same product", "Grey zone asks 'which signals deserve follow-up?', Ground Truth asks 'when should we trust the combination?'. Joining them gives the stronger pitch."],
        ].map(([t, d]) => (
          <Panel key={t} title={t}><p className="text-sm leading-relaxed text-slate-400">{d}</p></Panel>
        ))}
      </div>

      <H kicker="Compare">Weighted ranking (adjust the weights)</H>
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
          {CRITERIA.map((c) => (
            <Slider key={c.key} label={c.label} value={w[c.key]} min={0} max={5} onChange={(v) => setW({ ...w, [c.key]: v })} />
          ))}
          <div className="border-t border-white/10 pt-3">
            <div className="mb-2 text-xs text-slate-400">Skills on your team</div>
            <div className="flex flex-wrap gap-1.5">
              {SKILLS.map((s) => (
                <button key={s.key} onClick={() => setSkills((p) => (p.includes(s.key) ? p.filter((x) => x !== s.key) : [...p, s.key]))} className={cn("rounded-full border px-2.5 py-1 text-[11px] transition", skills.includes(s.key) ? "border-amber-400 bg-amber-400/20 text-amber-200" : "border-white/10 text-slate-400 hover:bg-white/5")}>{s.label}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="overflow-hidden rounded-xl border border-white/10">
          {ranked.map(({ r, base, share, total }, i) => (
            <button key={r.id} onClick={() => go(r.id)} className="flex w-full items-center gap-3 border-b border-white/5 px-4 py-2.5 text-left transition last:border-0 hover:bg-white/5">
              <span className="w-5 font-mono text-xs text-slate-500">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-slate-100">{r.code}</span>
                <span className="block truncate text-[11px] text-slate-500">{r.org ?? r.title}</span>
              </span>
              {skills.length > 0 && <span className="hidden font-mono text-[11px] text-cyan-300 sm:block">team fit {Math.round(share * 100)}%</span>}
              <span className="hidden w-32 sm:block"><span className="block h-1.5 rounded bg-white/10"><span className="block h-1.5 rounded bg-amber-400" style={{ width: `${(total / 5) * 100}%` }} /></span></span>
              <span className="w-10 text-right font-mono text-sm text-amber-300">{total.toFixed(1)}</span>
              <span className="hidden w-10 text-right font-mono text-[11px] text-slate-500 md:block">{base.toFixed(1)}</span>
            </button>
          ))}
        </div>
      </div>
      <p className="mt-2 text-[11px] text-slate-500">Right-hand small number = score before skill adjustment. Scores are subjective 1-5 ratings; the tool is for thinking, not deciding.</p>

      <H kicker="My recommendation">Three paths, depending on who you are</H>
      <div className="grid gap-3 md:grid-cols-3">
        {[
          ["nexus", "Max rubric, product-minded team", "Nexus Problem 2 + Trust Rail + Misclick-proof controls + Ghost track. Highest ceiling; build maths offline first.", "Risk: environment timing"],
          ["mantavia", "Python/geo team that wants certainty", "Mantavia, framed as Lifeline Watch (episodes, handover, honest evaluation). Start downloading now.", "Risk: data wrangling and incident fidelity"],
          ["thermal", "You have an image-processing specialist", "Thermal ISP with a streaming design and a defect gallery. Self-contained and visual.", "Risk: invisible if merely 'good'"],
        ].map(([id, t, d, r]) => (
          <button key={id} onClick={() => go(id)} className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-left transition hover:border-amber-400/40 hover:bg-white/[0.06]">
            <div className="text-sm font-semibold text-amber-300">{t}</div>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">{d}</p>
            <p className="mt-2 text-xs text-slate-500">{r}</p>
          </button>
        ))}
      </div>
      <div className="mt-3">
        <Callout tone="cyan" title="If you're joining the grey-zone team">
          Don't try to out-sensor them. Offer the failure-aware evidence view (Ground Truth) as the part that makes their proposals trustworthy, then show the approval gate and the quiet path. It is the piece most likely to be missing from their demo.
        </Callout>
      </div>

      <H kicker="Ask early">Questions to put to organisers and mentors this week</H>
      <Bullets tone="amber" items={[
        "Mantavia: which date and AIS file define the Bornholm incident (26 vs 28 Feb 2022)? Which year is the 7-16 Sept window? Is the cable geometry provided?",
        "Mantavia: is the ISR asset cued with static positions, or should vessel motion be predicted?",
        "Intelic: what per-frame metadata arrives with the MAVLink video sims (intrinsics, gimbal, timestamps)? Is there a terrain/DEM service?",
        "Intelic: can extensions publish uncertainty geometry (ellipses) and a task-proposal/approval primitive?",
        "Fourth Law: how many test sequences, what scenes, and is a Verilog model required for the streaming bonus?",
        "Organisers: can a team pick a self-defined project and still be judged by the problem owners, or is it a separate track?",
      ]} />
    </div>
  );
}

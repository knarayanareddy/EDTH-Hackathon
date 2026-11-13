import { useState } from "react";
import { Btn, Pill, Callout } from "../components/ui";

interface Rep { src: string; ageMin: number; q: "good" | "degraded"; note: string }
const LIMITS: Record<string, string> = {
  "R1 (simulated receiver)": "Single point receiver. Says nothing about the area around it.",
  "R2 (simulated receiver)": "Different antenna and firmware. Can disagree with R1 for benign reasons.",
};
const SC: Record<string, Rep[]> = {
  "Good report": [{ src: "R1 (simulated receiver)", ageMin: 3, q: "good", note: "HDOP 0.9, 14 satellites" }],
  "Degraded report": [{ src: "R1 (simulated receiver)", ageMin: 4, q: "degraded", note: "HDOP 6.8, 5 satellites, position jumps 120 m" }],
  "Stale report": [{ src: "R1 (simulated receiver)", ageMin: 42, q: "degraded", note: "HDOP 5.9, 6 satellites" }],
  "Conflicting reports": [
    { src: "R1 (simulated receiver)", ageMin: 5, q: "degraded", note: "HDOP 6.1" },
    { src: "R2 (simulated receiver)", ageMin: 6, q: "good", note: "HDOP 1.1" },
  ],
};

function wording(reps: Rep[]) {
  const fresh = reps.filter((r) => r.ageMin <= 15);
  if (!fresh.length) return { s: `Last report is ${Math.min(...reps.map((r) => r.ageMin))} min old: current state unknown.`, tone: "slate" as const };
  const deg = fresh.filter((r) => r.q === "degraded");
  if (deg.length && deg.length < fresh.length) return { s: "Sources disagree: inconclusive. Independent verification needed.", tone: "amber" as const };
  if (deg.length) return { s: "Report is consistent with degraded position quality at this receiver. Cause not determined.", tone: "amber" as const };
  return { s: "No degradation reported by the sources available. This is not a guarantee of integrity.", tone: "green" as const };
}

export default function SignalIntegrity() {
  const [k, setK] = useState("Degraded report");
  const [log, setLog] = useState<string[]>([]);
  const reps = SC[k];
  const w = wording(reps);
  const tests = Object.entries(SC).map(([name, r]) => ({ name, text: wording(r).s, ok: !/(jamm|spoof|attack|confirmed|interference detected)/i.test(wording(r).s) }));
  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">{Object.keys(SC).map((n) => <Btn key={n} tone={n === k ? "amber" : "slate"} onClick={() => setK(n)}>{n}</Btn>)}</div>
        <div className="rounded-lg border border-white/10 bg-black/20 p-3">
          <svg viewBox="0 0 400 110" className="w-full">
            <line x1="20" y1="80" x2="380" y2="80" stroke="white" strokeOpacity="0.2" />
            {[0, 15, 30, 45, 60].map((m) => (<g key={m}><line x1={380 - (m / 60) * 360} x2={380 - (m / 60) * 360} y1="76" y2="84" stroke="white" strokeOpacity="0.3" /><text x={380 - (m / 60) * 360} y="98" fontSize="9" textAnchor="middle" fill="#64748b">{m === 0 ? "now" : `-${m}m`}</text></g>))}
            <rect x={380 - (15 / 60) * 360} y="20" width={(15 / 60) * 360} height="56" fill="#34d399" fillOpacity="0.05" />
            <text x={380 - (15 / 120) * 360} y="16" fontSize="9" textAnchor="middle" fill="#6ee7b7">freshness window</text>
            {reps.map((r, i) => (
              <g key={i}>
                <circle cx={380 - (r.ageMin / 60) * 360} cy={r.src.startsWith("R1") ? 48 : 64} r="7" fill={r.q === "good" ? "#34d399" : "#f59e0b"} fillOpacity={r.ageMin > 15 ? 0.35 : 1} stroke={r.ageMin > 15 ? "#94a3b8" : "none"} strokeDasharray="2 2" />
                <text x={380 - (r.ageMin / 60) * 360 - 12} y={r.src.startsWith("R1") ? 52 : 68} fontSize="9" textAnchor="end" fill="#cbd5e1">{r.src.slice(0, 2)}</text>
              </g>
            ))}
          </svg>
        </div>
        <div className={`rounded-lg border px-4 py-3 text-sm ${w.tone === "green" ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100" : w.tone === "amber" ? "border-amber-400/30 bg-amber-400/10 text-amber-100" : "border-white/15 bg-white/5 text-slate-200"}`}>{w.s}</div>
        <div className="space-y-2">
          {reps.map((r, i) => (
            <div key={i} className="rounded-lg border border-white/10 p-3 text-xs">
              <div className="flex items-center justify-between"><span className="font-semibold text-slate-100">{r.src}</span><Pill tone={r.ageMin > 15 ? "slate" : r.q === "good" ? "green" : "amber"}>{r.ageMin > 15 ? "stale" : r.q}</Pill></div>
              <div className="text-slate-400">{r.note} · observed {r.ageMin} min ago</div>
              <div className="mt-1 text-slate-500">Limitation: {LIMITS[r.src]}</div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2"><Btn tone="amber" onClick={() => setLog((l) => [`Independent verification requested (${k}) · ${new Date().toLocaleTimeString([], { hour12: false })}`, ...l])}>Request independent verification</Btn><span className="text-[11px] text-slate-500">Recorded, not executed.</span></div>
        {log.map((l, i) => <div key={i} className="text-[11px] text-slate-400">• {l}</div>)}
      </div>
      <div>
        <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-slate-500">Wording test: no 'jamming' or 'attack' language</div>
        <div className="space-y-2">{tests.map((t) => (<div key={t.name} className="rounded-lg border border-white/10 p-3 text-xs"><div className="flex items-center justify-between"><span className="text-slate-200">{t.name}</span><Pill tone={t.ok ? "green" : "red"}>{t.ok ? "pass" : "fail"}</Pill></div><div className="mt-1 text-slate-500">"{t.text}"</div></div>))}</div>
        <div className="mt-3"><Callout tone="cyan">Only three families of statements are allowed: consistent with / inconclusive / unknown. Anything stronger would need independent evidence the system doesn't have.</Callout></div>
      </div>
    </div>
  );
}

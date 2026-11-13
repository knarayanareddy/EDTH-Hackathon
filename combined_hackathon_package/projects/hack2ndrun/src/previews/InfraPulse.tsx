import { useState } from "react";
import { Btn, Pill, Callout } from "../components/ui";

type St = "possible" | "confirmed-down" | "verified-ok" | "mitigated";
const SERV = [
  { id: "clinic", name: "Base clinic telemetry", y: 40, dep: "needs L1, no fallback" },
  { id: "pump", name: "Water pump SCADA", y: 110, dep: "needs L1, local fallback exists" },
  { id: "gate", name: "Fuel depot gate control", y: 180, dep: "needs L1 for remote unlock only" },
];
const INFO: Record<St, { label: string; tone: "amber" | "red" | "green" | "cyan"; color: string }> = {
  possible: { label: "POSSIBLE IMPACT · unverified", tone: "amber", color: "#f59e0b" },
  "confirmed-down": { label: "CONFIRMED DOWN · report R2", tone: "red", color: "#f43f5e" },
  "verified-ok": { label: "VERIFIED OPERATIONAL · contradicts assumption", tone: "green", color: "#34d399" },
  mitigated: { label: "POSSIBLE · fallback reported active", tone: "cyan", color: "#22d3ee" },
};

export default function InfraPulse() {
  const [st, setSt] = useState<Record<string, St>>({ clinic: "possible", pump: "possible", gate: "possible" });
  const [log, setLog] = useState<string[]>(["R1 12:02 · Comms link L1 reported unavailable (single source)"]);
  const act = (id: string, s: St, msg: string) => { setSt((p) => ({ ...p, [id]: s })); setLog((l) => [...l, msg]); };
  const unverified = Object.values(st).filter((s) => s === "possible" || s === "mitigated").length;
  const failedWithoutEvidence = Object.entries(st).filter(([, s]) => s === "confirmed-down").length - log.filter((l) => /confirm/i.test(l)).length;

  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
      <div>
        <svg viewBox="0 0 440 230" className="w-full rounded-lg border border-white/10 bg-[#0c1218]">
          <rect x="14" y="85" width="120" height="60" rx="8" fill="#f43f5e" fillOpacity="0.1" stroke="#f43f5e" />
          <text x="74" y="108" textAnchor="middle" fontSize="11" fill="#fda4af" fontWeight="600">Comms link L1</text>
          <text x="74" y="124" textAnchor="middle" fontSize="9" fill="#fda4af">REPORTED unavailable</text>
          <text x="74" y="136" textAnchor="middle" fontSize="9" fill="#94a3b8">1 source · unconfirmed</text>
          {SERV.map((s) => (
            <g key={s.id}>
              <line x1="134" y1="115" x2="270" y2={s.y + 20} stroke={INFO[st[s.id]].color} strokeDasharray="5 4" strokeOpacity="0.7" />
              <rect x="270" y={s.y} width="156" height="40" rx="6" fill={INFO[st[s.id]].color} fillOpacity="0.1" stroke={INFO[st[s.id]].color} strokeDasharray={st[s.id] === "possible" || st[s.id] === "mitigated" ? "4 3" : "0"} />
              <text x="348" y={s.y + 16} textAnchor="middle" fontSize="10" fill="#e2e8f0" fontWeight="600">{s.name}</text>
              <text x="348" y={s.y + 30} textAnchor="middle" fontSize="8.5" fill="#94a3b8">{s.dep}</text>
            </g>
          ))}
        </svg>
        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-400"><span>dashed = assumed</span><span>solid = evidenced</span><span>Dependency alone never turns a service red.</span></div>
        <div className="mt-3 space-y-2">{SERV.map((s) => (<div key={s.id} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 p-2 text-xs"><span className="text-slate-200">{s.name}</span><Pill tone={INFO[st[s.id]].tone}>{INFO[st[s.id]].label}</Pill></div>))}</div>
      </div>
      <div className="space-y-3">
        <div className="font-mono text-[10px] uppercase tracking-widest text-slate-500">Inject a simulated report</div>
        <div className="flex flex-wrap gap-2">
          <Btn onClick={() => act("clinic", "confirmed-down", "R2 12:09 · Clinic telemetry confirmed down (site report)")}>Clinic: confirmed down</Btn>
          <Btn onClick={() => act("pump", "mitigated", "R3 12:11 · Pump station reports fallback path active")}>Pump: fallback active</Btn>
          <Btn onClick={() => act("gate", "verified-ok", "R4 12:14 · Gate control tested OK locally")}>Gate: tested OK</Btn>
          <Btn onClick={() => { setSt({ clinic: "possible", pump: "possible", gate: "possible" }); setLog(["R1 12:02 · Comms link L1 reported unavailable (single source)"]); }}>Reset</Btn>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/20 p-3">
          <div className="mb-1 text-xs font-semibold text-slate-100">Handover</div>
          <div className="text-xs text-slate-400">{unverified} impact(s) still unverified. Next best check: <span className="text-slate-200">{st.clinic === "possible" ? "clinic telemetry (no fallback, highest consequence)" : st.pump === "possible" || st.pump === "mitigated" ? "pump SCADA local status" : "none needed"}</span>.</div>
          <div className="mt-2 space-y-1">{log.map((l, i) => <div key={i} className="font-mono text-[11px] text-slate-500">{l}</div>)}</div>
        </div>
        <Callout tone={failedWithoutEvidence > 0 ? "red" : "green"} title="Design assertion">Services marked failed without direct evidence: <span className="font-mono">{Math.max(0, failedWithoutEvidence)}</span>. If this is ever above zero the UI has a serious bug.</Callout>
      </div>
    </div>
  );
}

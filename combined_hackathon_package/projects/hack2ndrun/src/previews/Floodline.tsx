import { useState } from "react";
import { Slider, Btn, Pill, Callout } from "../components/ui";

const REPORTS = [
  { id: "R-A", at: 22, text: "Bridge B-12: passable for light vehicles", x: 54, y: 30, tone: "green" as const },
  { id: "R-B", at: 66, text: "Bridge B-12 approach flooded, not passable", x: 52, y: 33, tone: "red" as const },
];

export default function Floodline() {
  const [now, setNow] = useState(70);
  const [checks, setChecks] = useState<string[]>([]);
  const mapAge = now;
  const op = Math.max(0.15, 1 - mapAge / 110);
  const vis = REPORTS.filter((r) => r.at <= now);
  const contested = vis.length === 2;
  return (
    <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
      <div>
        <svg viewBox="0 0 100 60" className="w-full rounded-lg border border-white/10 bg-[#0c1319]">
          <defs><pattern id="hatch" width="2" height="2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="2" stroke="#38bdf8" strokeWidth="0.5" /></pattern></defs>
          <path d="M0 40 Q20 36 35 30 T65 22 T100 14 L100 30 Q75 36 60 40 T30 50 T0 56 Z" fill="#38bdf8" fillOpacity={op * 0.45} />
          <path d="M0 40 Q20 36 35 30 T65 22 T100 14 L100 30 Q75 36 60 40 T30 50 T0 56 Z" fill="url(#hatch)" opacity={mapAge > 48 ? 0.5 : 0} />
          <path d="M0 18 H100" stroke="#64748b" strokeWidth="0.6" />
          <path d="M54 4 V58" stroke="#64748b" strokeWidth="0.6" />
          <rect x="51.5" y="28" width="5" height="1.6" fill="#cbd5e1" />
          <text x="58" y="27" fontSize="2" fill="#cbd5e1">Bridge B-12</text>
          {vis.map((r) => (<g key={r.id}><circle cx={r.x} cy={r.y} r="1.8" fill={r.tone === "green" ? "#34d399" : "#f43f5e"} /><text x={r.x + 2.5} y={r.y + 4.5} fontSize="1.9" fill="#e2e8f0">{r.id}</text></g>))}
          <text x="2" y="4" fontSize="2.1" fill="#7dd3fc">Flood extent (map produced T0){mapAge > 48 ? " · STALE" : ""}</text>
        </svg>
        <div className="mt-3"><Slider label="Time since map was produced" value={now} min={0} max={96} unit=" h" onChange={setNow} hint="Reports arrive at +22 h and +66 h" /></div>
      </div>
      <div className="space-y-3">
        <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-xs">
          <div className="flex items-center justify-between"><span className="font-semibold text-slate-100">Map layer</span><Pill tone={mapAge > 48 ? "red" : mapAge > 24 ? "amber" : "green"}>{mapAge > 48 ? "stale" : mapAge > 24 ? "ageing" : "fresh"}</Pill></div>
          <div className="text-slate-400">Produced T0 · age {mapAge} h · opacity reduced to {Math.round(op * 100)}% to show confidence decay.</div>
        </div>
        {vis.map((r) => (<div key={r.id} className="rounded-lg border border-white/10 p-3 text-xs"><div className="flex items-center justify-between"><span className="font-semibold text-slate-100">{r.id} · fictional field report</span><Pill tone="slate">{now - r.at} h old</Pill></div><div className="text-slate-300">{r.text}</div><div className="text-slate-500">{r.at > 0 ? `Arrived T0+${r.at} h` : ""} · {r.at > mapAge ? "" : "newer than map"}</div></div>))}
        {vis.length === 0 && <div className="text-xs text-slate-500">No reports yet. Slide time forward.</div>}
        {contested ? (<Callout tone="red" title="Bridge B-12: contested">The older report says passable, the newer says flooded. Both are preserved. The system does <b>not</b> declare the route safe or unsafe.</Callout>) : vis.length === 1 ? (<Callout tone="amber" title="Bridge B-12: single report">One report only, and the map is {mapAge} h old. Treat as unverified.</Callout>) : null}
        <Btn tone="amber" onClick={() => setChecks((c) => (c.includes("Verify B-12 by second source") ? c : [...c, "Verify B-12 by second source"]))}>Request verification</Btn>
        {checks.map((c) => <div key={c} className="text-[11px] text-slate-400">• Handover item: {c}</div>)}
      </div>
    </div>
  );
}

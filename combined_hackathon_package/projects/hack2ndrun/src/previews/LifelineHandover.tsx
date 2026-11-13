import { useState } from "react";
import { Btn, Callout, Pill } from "../components/ui";

const BANNED: { re: RegExp; why: string; use: string }[] = [
  { re: /sabotag/i, why: "AIS cannot show intent", use: "\"behaviour for review\"" },
  { re: /\banchor (is|was|has been) (down|dragging|dropped)/i, why: "AIS does not report anchor state", use: "\"track consistent with slow movement over the corridor\"" },
  { re: /\b(attack|hostile|guilty|culprit|responsible)\b/i, why: "attribution is not supported by this data", use: "\"vessel of interest for verification\"" },
  { re: /\b(confirmed|proves?|certain|definitely)\b/i, why: "overstates certainty", use: "\"observed\" / \"consistent with\"" },
  { re: /\bdeliberate(ly)?\b/i, why: "intent claim", use: "omit" },
];

export default function LifelineHandover() {
  const [note, setNote] = useState("Track stays over the cable corridor for ~50 min at reduced speed with a heading/COG offset. AIS went quiet for 12 min mid-episode. Recommend one ISR look if available; otherwise keep watching.");
  const [dispo, setDispo] = useState("Request verification");
  const hits = BANNED.filter((b) => b.re.test(note));
  const md = `# Episode EP-0417 handover
Status: ${dispo}

## Observed (auto-filled)
- Vessel class: cargo (AIS-declared; manual fields not relied on)
- Window: 03:12-04:04 UTC (52 min) · corridor: Bornholm-Borrby 60 kV
- Speed 4.6 kn vs 11.0 kn typical for class in this lane
- Crossing angle 80° · heading/COG offset 18° · 3.1 km off nominal lane
- AIS gap: 12 min (03:41-03:53 UTC)

## Not observable from AIS
- Anchor state, vessel intent, cause of the movement

## Analyst note
${note}
`;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-3">
        <div className="rounded-lg border border-white/10 bg-black/20 p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-100">Episode EP-0417 <Pill tone="amber">review</Pill></div>
          <svg viewBox="0 0 300 110" className="w-full">
            <line x1="0" y1="62" x2="300" y2="30" stroke="#fb7185" strokeOpacity="0.4" strokeWidth="10" strokeLinecap="round" />
            <line x1="0" y1="62" x2="300" y2="30" stroke="#fb7185" strokeDasharray="4 3" />
            <polyline points="10,95 60,88 110,70 150,60 175,50 185,44" fill="none" stroke="#fbbf24" strokeWidth="2" />
            <polyline points="185,44 215,38" fill="none" stroke="#fbbf24" strokeWidth="2" strokeDasharray="2 5" />
            <text x="190" y="30" fontSize="8" fill="#fbbf24">gap 12 min</text>
            <polyline points="215,38 245,30 285,18" fill="none" stroke="#fbbf24" strokeWidth="2" />
            {[10, 60, 110, 150, 175, 185, 215, 245, 285].map((x, i) => (
              <circle key={i} cx={x} cy={[95, 88, 70, 60, 50, 44, 38, 30, 18][i]} r="2.2" fill="#fde68a" />
            ))}
            <text x="6" y="108" fontSize="8" fill="#94a3b8">03:12</text>
            <text x="262" y="12" fontSize="8" fill="#94a3b8">04:04</text>
          </svg>
          <div className="text-[11px] text-slate-500">Track with observation dots, data gap shown as a dotted bridge, never interpolated silently.</div>
        </div>
        <label className="block text-xs text-slate-400">Disposition
          <select value={dispo} onChange={(e) => setDispo(e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-200">
            <option>Request verification</option>
            <option>Keep watching</option>
            <option>Dismiss (explained pattern)</option>
          </select>
        </label>
        <label className="block text-xs text-slate-400">Analyst note
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={5} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-200" />
        </label>
        {hits.length > 0 ? (
          <Callout tone="red" title="Handover blocked by language guardrail">
            {hits.map((h, i) => <div key={i}>• Contains wording that {h.why}. Try {h.use}.</div>)}
          </Callout>
        ) : (
          <Callout tone="green">Language check passed. Wording stays at the level of observation.</Callout>
        )}
        <div className="text-[11px] text-slate-500">Try typing "the anchor is down, this is sabotage".</div>
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500">
          <span>Generated handover (markdown)</span>
          <Btn onClick={() => navigator.clipboard?.writeText(md)} disabled={hits.length > 0}>Copy</Btn>
        </div>
        <pre className={`max-h-[420px] overflow-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-black/30 p-3 font-mono text-[11px] leading-relaxed ${hits.length ? "opacity-40" : "text-slate-300"}`}>{md}</pre>
      </div>
    </div>
  );
}

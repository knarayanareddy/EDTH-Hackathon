import { useState } from "react";
import { Pill } from "../components/ui";

type S = "unchecked" | "confirmed" | "contradicted" | "unresolved";
const ITEMS = [
  { id: "1", src: "Patrol 2 radio", ago: 12, text: "Gate east open and unattended" },
  { id: "2", src: "Camera feed C-4", ago: 41, text: "Two vehicles at the fuel depot" },
  { id: "3", src: "Sensor net E4", ago: 4, text: "Movement along the treeline" },
];

export default function HandoverPressure() {
  const [st, setSt] = useState<Record<string, S>>({ "1": "confirmed", "2": "unchecked", "3": "unresolved" });
  const by = (s: S) => ITEMS.filter((i) => st[i.id] === s);
  const stale = ITEMS.filter((i) => i.ago > 30);
  const oldest = [...ITEMS].sort((a, b) => b.ago - a.ago)[0];
  const needs = ITEMS.filter((i) => st[i.id] === "unresolved" || st[i.id] === "unchecked");
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-2">
        <div className="font-mono text-[10px] uppercase tracking-widest text-slate-500">Operator's record</div>
        {ITEMS.map((i) => (
          <div key={i.id} className="rounded-lg border border-white/10 p-3 text-xs">
            <div className="flex items-center justify-between gap-2"><span className="font-semibold text-slate-100">{i.src}</span><span className={`font-mono ${i.ago > 30 ? "text-amber-300" : "text-slate-500"}`}>{i.ago} min ago{i.ago > 30 ? " · STALE" : ""}</span></div>
            <div className="my-1 text-slate-300">{i.text}</div>
            <div className="flex flex-wrap gap-1">{(["unchecked", "confirmed", "contradicted", "unresolved"] as S[]).map((s) => (<button key={s} onClick={() => setSt({ ...st, [i.id]: s })} className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${st[i.id] === s ? "border-amber-400 bg-amber-400/20 text-amber-200" : "border-white/10 text-slate-400 hover:bg-white/5"}`}>{s}</button>))}</div>
          </div>
        ))}
      </div>
      <div className="space-y-3">
        <div className="rounded-lg border border-white/10 bg-black/20 p-3">
          <div className="mb-2 text-xs font-semibold text-slate-100">Generated handover (needs decision first)</div>
          <Sec title="Needs a decision" items={needs.map((i) => `${i.text} (${st[i.id]})`)} t="amber" />
          <Sec title="Confirmed" items={by("confirmed").map((i) => i.text)} t="green" />
          <Sec title="Contradicted" items={by("contradicted").map((i) => i.text)} t="red" />
          <Sec title="Stale sources" items={stale.map((i) => `${i.src} (${i.ago} min)`)} t="slate" />
        </div>
        <div className="rounded-lg border border-white/10 p-3 text-xs">
          <div className="mb-2 font-semibold text-slate-100">The stranger test: can they answer from this page alone?</div>
          <QA q="What is confirmed?" a={by("confirmed").map((i) => i.text).join("; ") || "nothing"} />
          <QA q="What remains unknown?" a={needs.map((i) => i.text).join("; ") || "nothing"} />
          <QA q="Which source is oldest?" a={`${oldest.src} (${oldest.ago} min)`} />
          <QA q="What needs a decision?" a={needs[0] ? needs[0].text : "nothing"} />
        </div>
      </div>
    </div>
  );
}
const Sec = ({ title, items, t }: { title: string; items: string[]; t: "slate" | "amber" | "green" | "red" }) => (
  <div className="mb-2"><Pill tone={t}>{title}</Pill>{items.length ? items.map((x, i) => <div key={i} className="mt-1 text-xs text-slate-300">• {x}</div>) : <div className="mt-1 text-xs text-slate-600">none</div>}</div>
);
const QA = ({ q, a }: { q: string; a: string }) => (<div className="mb-1 flex gap-2"><span className="w-40 shrink-0 text-slate-500">{q}</span><span className="text-slate-200">{a}</span></div>);

import { useEffect, useState } from "react";
import { Btn, Pill, Stat, Callout } from "../components/ui";

interface Rep { id: string; subject: string; v: number; text: string; observed: number; status: "queued" | "sent" | "acked" }
interface DeskItem { id: string; subject: string; v: number; text: string; observed: number; received: number; acked: boolean }
interface S { online: boolean; reps: Rep[]; desk: DeskItem[]; dups: number; pendingAcks: string[]; resolved: string[]; n: number }

const SUBJECTS = ["Bridge B-12", "Checkpoint North", "Fuel depot"];
const TEXTS: Record<string, string[]> = {
  "Bridge B-12": ["passable, light traffic", "flooded approach, not passable"],
  "Checkpoint North": ["quiet", "two vehicles waiting"],
  "Fuel depot": ["stock OK", "stock low"],
};
const clock = (t: number) => new Date(t).toLocaleTimeString([], { hour12: false });
const age = (a: number, now: number) => { const s = Math.max(0, Math.round((now - a) / 1000)); return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`; };

function deliver(s: S, r: Rep): S {
  const exists = s.desk.some((d) => d.id === r.id);
  if (exists) return { ...s, dups: s.dups + 1, reps: s.reps.map((x) => (x.id === r.id && x.status === "queued" ? { ...x, status: "sent" } : x)) };
  return { ...s, reps: s.reps.map((x) => (x.id === r.id ? { ...x, status: "sent" } : x)), desk: [...s.desk, { id: r.id, subject: r.subject, v: r.v, text: r.text, observed: r.observed, received: Date.now(), acked: false }] };
}

export default function LastMile() {
  const [s, setS] = useState<S>({ online: true, reps: [], desk: [], dups: 0, pendingAcks: [], resolved: [], n: 0 });
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [, setTick] = useState(0);
  useEffect(() => { const i = setInterval(() => setTick((t) => t + 1), 1000); return () => clearInterval(i); }, []);
  const now = Date.now();

  const submit = (text?: string) => setS((p) => {
    const v = p.reps.filter((r) => r.subject === subject).length + 1;
    const r: Rep = { id: `R-${p.n + 1}`, subject, v, text: text ?? TEXTS[subject][Math.min(v - 1, 1)], observed: Date.now(), status: "queued" };
    let next: S = { ...p, n: p.n + 1, reps: [...p.reps, r] };
    if (p.online) next = deliver(next, r);
    return next;
  });
  const setOnline = (on: boolean) => setS((p) => {
    let next: S = { ...p, online: on };
    if (on) {
      p.reps.filter((r) => r.status === "queued").forEach((r) => { next = deliver(next, r); });
      next = { ...next, reps: next.reps.map((r) => (next.pendingAcks.includes(r.id) ? { ...r, status: "acked" } : r)), pendingAcks: [] };
    }
    return next;
  });
  const retry = () => setS((p) => {
    const last = [...p.reps].reverse().find((r) => r.status !== "queued");
    return last && p.online ? deliver(p, last) : p;
  });
  const ack = (id: string) => setS((p) => {
    const desk = p.desk.map((d) => (d.id === id ? { ...d, acked: true } : d));
    return p.online ? { ...p, desk, reps: p.reps.map((r) => (r.id === id ? { ...r, status: "acked" } : r)) } : { ...p, desk, pendingAcks: [...p.pendingAcks, id] };
  });

  const queued = s.reps.filter((r) => r.status === "queued").length;
  const acked = s.desk.filter((d) => d.acked).length;
  const conflicts = SUBJECTS.filter((sub) => s.desk.filter((d) => d.subject === sub).length > 1 && !s.resolved.includes(sub));

  const badge = (st: Rep["status"]) => st === "queued" ? <Pill tone="amber">queued locally · NOT delivered</Pill> : st === "sent" ? <Pill tone="cyan">sent · awaiting desk ack</Pill> : <Pill tone="green">acknowledged by desk</Pill>;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-5">
        <Stat label="Submitted" value={s.reps.length} />
        <Stat label="Still queued" value={queued} tone={queued ? "amber" : "slate"} />
        <Stat label="Received (unique)" value={s.desk.length} tone="cyan" />
        <Stat label="Duplicates suppressed" value={s.dups} tone="slate" />
        <Stat label="Acknowledged" value={acked} tone="green" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-white/[0.03]">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
            <div className="text-sm font-semibold text-slate-100">Field device</div>
            <button onClick={() => setOnline(!s.online)} className={`rounded-full border px-3 py-1 font-mono text-[11px] ${s.online ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300" : "border-rose-400/40 bg-rose-400/10 text-rose-300"}`}>
              LINK {s.online ? "ONLINE" : "CUT"} · click to toggle
            </button>
          </div>
          <div className="space-y-3 p-4">
            <div className="flex gap-2">
              <select value={subject} onChange={(e) => setSubject(e.target.value)} className="flex-1 rounded-lg border border-white/10 bg-slate-900 px-2 py-1.5 text-sm text-slate-200">{SUBJECTS.map((x) => <option key={x}>{x}</option>)}</select>
              <Btn tone="amber" onClick={() => submit()}>Submit observation</Btn>
            </div>
            <div className="text-[11px] text-slate-500">Each submit on the same subject creates the next version with a different text.</div>
            <div className="space-y-2">
              {s.reps.length === 0 && <div className="text-xs text-slate-500">No reports yet. Cut the link, then submit.</div>}
              {[...s.reps].reverse().map((r) => (
                <div key={r.id} className="rounded-lg border border-white/10 bg-black/20 p-2 text-xs">
                  <div className="flex items-center justify-between"><span className="font-semibold text-slate-100">{r.id} · {r.subject} v{r.v}</span>{badge(r.status)}</div>
                  <div className="text-slate-400">"{r.text}" · observed {clock(r.observed)}</div>
                </div>
              ))}
            </div>
            <Btn onClick={retry} disabled={!s.online || !s.reps.some((r) => r.status !== "queued")}>Simulate retry storm (resend last)</Btn>
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03]">
          <div className="border-b border-white/10 px-4 py-2 text-sm font-semibold text-slate-100">Coordination desk</div>
          <div className="space-y-2 p-4">
            {conflicts.map((c) => (
              <Callout key={c} tone="red" title={`Conflict on ${c}`}>
                Two versions disagree. Both are kept with their observation times; nothing is overwritten.
                <div className="mt-2"><Btn tone="red" onClick={() => setS((p) => ({ ...p, resolved: [...p.resolved, c] }))}>Mark resolved (keep history)</Btn></div>
              </Callout>
            ))}
            {s.desk.length === 0 && <div className="text-xs text-slate-500">Nothing received yet.</div>}
            {[...s.desk].reverse().map((d) => (
              <div key={d.id} className="rounded-lg border border-white/10 bg-black/20 p-2 text-xs">
                <div className="flex items-center justify-between"><span className="font-semibold text-slate-100">{d.id} · {d.subject} v{d.v}</span>{d.acked ? <Pill tone="green">acked</Pill> : <Btn tone="green" onClick={() => ack(d.id)}>Acknowledge</Btn>}</div>
                <div className="text-slate-300">"{d.text}"</div>
                <div className="mt-1 grid grid-cols-3 gap-1 font-mono text-[10px] text-slate-500"><span>observed {clock(d.observed)}</span><span>arrived {clock(d.received)}</span><span className={now - d.observed > 15000 ? "text-amber-300" : ""}>age {age(d.observed, now)}</span></div>
              </div>
            ))}
            {s.pendingAcks.length > 0 && <div className="text-[11px] text-amber-300">{s.pendingAcks.length} ack(s) waiting for the link: the field user still sees 'awaiting desk ack'.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

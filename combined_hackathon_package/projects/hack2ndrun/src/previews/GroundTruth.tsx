import { useMemo, useState } from "react";
import { Toggle, Pill, Callout } from "../components/ui";

interface Obs { sensor: "A" | "B" | "C"; t: number; recv: number; value: "present" | "absent"; echo?: boolean }
interface Input { obs: Obs[]; offline: string[] }
const NAMES = { A: "A · seismic", B: "B · acoustic", C: "C · camera trap" };

function evaluate(inp: Input) {
  const seen = new Set<string>();
  const uniq: Obs[] = [];
  let collapsed = 0;
  inp.obs.forEach((o) => {
    const k = `${o.sensor}-${o.t}-${o.value}`;
    if (seen.has(k)) collapsed++;
    else { seen.add(k); uniq.push(o); }
  });
  const present = new Set(uniq.filter((o) => o.value === "present").map((o) => o.sensor));
  const absent = uniq.filter((o) => o.value === "absent");
  const late = uniq.filter((o) => o.recv - o.t > 60);
  const flags: string[] = [];
  if (collapsed) flags.push(`duplicates collapsed (${collapsed + uniq.length - 0}→${uniq.length})`);
  if (late.length) flags.push(`late input (${late.map((l) => l.sensor + " +" + (l.recv - l.t) + "s").join(", ")})`);
  if (inp.offline.length) flags.push(`degraded: ${inp.offline.join(", ")} offline`);
  let state = "insufficient";
  let why = "No usable observations. Nothing to review.";
  if (present.size && absent.length) { state = "conflicting"; why = `${[...present].join(",")} reports presence while ${absent.map((a) => a.sensor).join(",")} reports none. Check source.`; }
  else if (present.size >= 2) { state = "corroborated"; why = `${present.size} independent sensors agree.`; }
  else if (present.size === 1) { state = "single-source"; why = "Only one independent source. Treat as a cue, not a finding."; }
  return { state, flags, why, uniq, collapsed };
}

const SCEN: { name: string; inp: Input; expect: { state: string; flag?: string } }[] = [
  { name: "Two independent observations", inp: { obs: [{ sensor: "A", t: 0, recv: 3, value: "present" }, { sensor: "B", t: 4, recv: 6, value: "present" }], offline: [] }, expect: { state: "corroborated" } },
  { name: "Duplicate (mesh rebroadcast)", inp: { obs: [{ sensor: "A", t: 0, recv: 3, value: "present" }, { sensor: "A", t: 0, recv: 9, value: "present", echo: true }], offline: [] }, expect: { state: "single-source", flag: "duplicates" } },
  { name: "Delayed observation", inp: { obs: [{ sensor: "A", t: 0, recv: 3, value: "present" }, { sensor: "C", t: 5, recv: 145, value: "present" }], offline: [] }, expect: { state: "corroborated", flag: "late" } },
  { name: "Missing device", inp: { obs: [{ sensor: "A", t: 0, recv: 3, value: "present" }], offline: ["B"] }, expect: { state: "single-source", flag: "degraded" } },
  { name: "Conflicting observations", inp: { obs: [{ sensor: "A", t: 0, recv: 3, value: "present" }, { sensor: "C", t: 6, recv: 9, value: "absent" }], offline: [] }, expect: { state: "conflicting" } },
  { name: "No data", inp: { obs: [], offline: [] }, expect: { state: "insufficient" } },
];

const tone = (s: string) => (s === "corroborated" ? "green" : s === "conflicting" ? "red" : s === "single-source" ? "amber" : "slate") as "green" | "red" | "amber" | "slate";

export default function GroundTruth() {
  const [killB, setKillB] = useState(false);
  const [delayC, setDelayC] = useState(false);
  const [dupA, setDupA] = useState(false);
  const [conflict, setConflict] = useState(false);

  const inp: Input = useMemo(() => {
    const obs: Obs[] = [{ sensor: "A", t: 0, recv: 3, value: "present" }];
    if (!killB) obs.push({ sensor: "B", t: 4, recv: 6, value: "present" });
    obs.push({ sensor: "C", t: 6, recv: delayC ? 150 : 9, value: conflict ? "absent" : "present" });
    if (dupA) obs.push({ sensor: "A", t: 0, recv: 12, value: "present", echo: true });
    return { obs, offline: killB ? ["B"] : [] };
  }, [killB, delayC, dupA, conflict]);
  const r = evaluate(inp);
  const results = SCEN.map((s) => { const e = evaluate(s.inp); const ok = e.state === s.expect.state && (!s.expect.flag || e.flags.some((f) => f.includes(s.expect.flag!))); return { s, e, ok }; });

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
      <div className="space-y-3">
        <div className="font-mono text-[10px] uppercase tracking-widest text-slate-500">Inject failures live</div>
        <Toggle label="Kill sensor B" on={killB} onChange={setKillB} hint="Heartbeat lost; observation never arrives" />
        <Toggle label="Delay sensor C by ~2.5 min" on={delayC} onChange={setDelayC} />
        <Toggle label="Mesh rebroadcast duplicates A" on={dupA} onChange={setDupA} hint="Same sensor, same timestamp, arrives again" />
        <Toggle label="C reports 'nothing seen'" on={conflict} onChange={setConflict} />
        <div className="rounded-lg border border-white/10 bg-black/20 p-3">
          <div className="mb-2 flex items-center gap-2"><span className="text-xs font-semibold text-slate-100">Case #12 · grid sector E4</span><Pill tone={tone(r.state)}>{r.state}</Pill></div>
          <div className="text-xs text-slate-300">{r.why}</div>
          <div className="mt-2 flex flex-wrap gap-1">{r.flags.map((f) => <Pill key={f} tone="amber">{f}</Pill>)}</div>
          <div className="mt-3 space-y-1">
            {inp.obs.map((o, i) => (
              <div key={i} className={`flex items-center justify-between rounded border px-2 py-1 text-[11px] ${o.echo ? "border-dashed border-white/20 text-slate-500" : "border-white/10 text-slate-300"}`}>
                <span>{NAMES[o.sensor]}</span><span>{o.value}</span><span className="font-mono">obs T+{o.t}s · recv T+{o.recv}s</span>{o.echo && <span>(echo)</span>}
              </div>
            ))}
            {killB && <div className="rounded border border-rose-400/30 bg-rose-400/5 px-2 py-1 text-[11px] text-rose-300">{NAMES.B} · OFFLINE · last heartbeat 3 min ago</div>}
          </div>
          <div className="mt-3 text-[11px] text-slate-500">What would change the state: {r.state === "corroborated" ? "a conflicting report from any sensor." : r.state === "single-source" ? "a fresh report from a second independent sensor." : r.state === "conflicting" ? "a re-check by the sensor that disagrees." : "any new observation."}</div>
        </div>
      </div>
      <div>
        <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-slate-500">Labelled scenario set (software behaviour tests)</div>
        <div className="overflow-hidden rounded-lg border border-white/10">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/5 text-slate-400"><tr><th className="px-3 py-2">Scenario</th><th className="px-3 py-2">Expected</th><th className="px-3 py-2">Actual</th><th className="px-3 py-2">Result</th></tr></thead>
            <tbody>
              {results.map(({ s, e, ok }) => (
                <tr key={s.name} className="border-t border-white/5">
                  <td className="px-3 py-2 text-slate-200">{s.name}</td>
                  <td className="px-3 py-2 text-slate-400">{s.expect.state}{s.expect.flag ? ` + ${s.expect.flag}` : ""}</td>
                  <td className="px-3 py-2 text-slate-300">{e.state}{e.flags.length ? ` (${e.flags.length} flag)` : ""}</td>
                  <td className="px-3 py-2"><Pill tone={ok ? "green" : "red"}>{ok ? "pass" : "fail"}</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3"><Callout tone="cyan">Independence is the key modelling decision: a rebroadcast is the same observation, so it never counts as corroboration. These tests show software behaviour, not real-world detection performance.</Callout></div>
      </div>
    </div>
  );
}

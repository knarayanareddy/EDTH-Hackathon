import { useMemo, useState } from "react";
import { Slider, Pill, Callout } from "../components/ui";

interface Veh {
  id: string;
  name: string;
  kind: "drone" | "ground";
  endurance: number; // min
  windLimit: number; // m/s
  rate: number; // ha/min coverage
  hover: boolean;
}

const FLEET: Veh[] = [
  { id: "Q1", name: "Quad-1 (EO)", kind: "drone", endurance: 25, windLimit: 9, rate: 1.5, hover: true },
  { id: "FW1", name: "Fixed-wing-1 (EO/IR)", kind: "drone", endurance: 90, windLimit: 13, rate: 8, hover: false },
  { id: "UGV1", name: "Ground robot-1", kind: "ground", endurance: 360, windLimit: 99, rate: 0.2, hover: true },
];

export default function NexusIntent() {
  const [wind, setWind] = useState(6);
  const [windAge, setWindAge] = useState(10);
  const [battery, setBattery] = useState(80);
  const [dur, setDur] = useState(40);
  const [area, setArea] = useState(40);

  const plan = useMemo(() => {
    const stale = windAge > 30;
    const factor = stale ? 0.7 : 1;
    const checks: Record<string, { ok: boolean; why: string }> = {};
    FLEET.forEach((v) => {
      const lim = v.windLimit * factor;
      const endur = v.id === "Q1" ? (v.endurance * battery) / 100 : v.endurance;
      if (wind > lim) checks[v.id] = { ok: false, why: `wind ${wind} m/s > limit ${lim.toFixed(1)} m/s${stale ? " (derated 30% because wind data is stale)" : ""}` };
      else if (endur < 8) checks[v.id] = { ok: false, why: `only ${endur.toFixed(0)} min of endurance left` };
      else checks[v.id] = { ok: true, why: `wind margin ${(lim - wind).toFixed(1)} m/s, endurance ${endur.toFixed(0)} min` };
    });
    const endurOf = (v: Veh) => (v.id === "Q1" ? (v.endurance * battery) / 100 : v.endurance);
    type Opt = { gate?: Veh; field?: Veh; score: number; notes: string[] };
    const opts: Opt[] = [];
    const drones = FLEET.filter((v) => v.kind === "drone" && checks[v.id].ok);
    // enumerate
    for (const g of [undefined, ...drones]) {
      for (const f of [undefined, ...FLEET.filter((v) => checks[v.id].ok)]) {
        if (g && f && g.id === f.id) continue;
        let score = 0;
        const notes: string[] = [];
        if (g) {
          score += g.hover ? 5 : 3;
          if (endurOf(g) >= dur) score += 3;
          else {
            score -= 2;
            notes.push(`${g.name} cannot hold the gate for ${dur} min (has ${endurOf(g).toFixed(0)}). Relief needed.`);
          }
        } else score -= 10;
        if (f) {
          const t = area / f.rate;
          if (t <= endurOf(f)) score += 6 - Math.min(5, t / 10);
          else {
            score -= 3;
            notes.push(`${f.name} needs ${t.toFixed(0)} min for ${area} ha but has ${endurOf(f).toFixed(0)}.`);
          }
        } else score -= 8;
        opts.push({ gate: g, field: f, score, notes });
      }
    }
    opts.sort((a, b) => b.score - a.score);
    return { best: opts[0], alt: opts[1], checks, stale };
  }, [wind, windAge, battery, dur, area]);

  const { best, checks, stale } = plan;
  const needsHuman = stale || !best?.gate || !best?.field || best.notes.length > 0;

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <div className="space-y-3">
        <div className="rounded-lg border border-white/10 bg-black/30 p-3">
          <div className="font-mono text-[10px] uppercase tracking-widest text-amber-400/80">Commander intent</div>
          <div className="mt-1 text-sm text-slate-100">"Search the north field, keep one drone over the gate."</div>
        </div>
        <Slider label="Wind speed (OSINT feed)" value={wind} min={0} max={16} step={0.5} unit=" m/s" onChange={setWind} />
        <Slider label="Wind data age" value={windAge} min={0} max={120} unit=" min" hint="Over 30 min the planner stops trusting it silently." onChange={setWindAge} />
        <Slider label="Quad battery" value={battery} min={0} max={100} unit="%" onChange={setBattery} />
        <Slider label="Gate watch duration" value={dur} min={10} max={120} unit=" min" onChange={setDur} />
        <Slider label="North field area" value={area} min={10} max={120} unit=" ha" onChange={setArea} />
      </div>
      <div className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-3">
          {FLEET.map((v) => (
            <div key={v.id} className={`rounded-lg border p-3 text-xs ${checks[v.id].ok ? "border-emerald-400/30 bg-emerald-400/[0.05]" : "border-rose-400/30 bg-rose-400/[0.05]"}`}>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-100">{v.name}</span>
                <Pill tone={checks[v.id].ok ? "green" : "red"}>{checks[v.id].ok ? "eligible" : "grounded"}</Pill>
              </div>
              <div className="mt-1 text-slate-400">{checks[v.id].why}</div>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-white/10 bg-white/[0.03]">
          <div className="border-b border-white/10 px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-slate-500">Proposed tasks (explainable)</div>
          <div className="divide-y divide-white/5">
            <TaskRow title="Hold overwatch over the gate" veh={best?.gate} reason={best?.gate ? (best.gate.hover ? "Hover-capable drone gives persistent stare; intent says 'drone', so ground vehicles were excluded." : "No hover-capable drone is eligible, so an orbit pattern is proposed (wider footprint).") : "No eligible drone. Intent cannot be met as stated."} />
            <TaskRow title={`Search the north field (${area} ha)`} veh={best?.field} reason={best?.field ? `Coverage ≈ ${(area / best.field.rate).toFixed(0)} min at ${best.field.rate} ha/min. Chosen to leave the gate vehicle untouched.` : "No feasible vehicle for the search task."} />
          </div>
        </div>

        {best?.notes.map((n, i) => (
          <Callout key={i} tone="amber">{n}</Callout>
        ))}
        {needsHuman ? (
          <Callout tone="red" title="Needs operator decision">
            {stale ? "Wind data is stale, so limits were derated and the plan is a proposal only. " : ""}
            {!best?.gate || !best?.field ? "The intent can't be met in full. " : ""}
            {best?.notes.length ? "At least one task is only partially feasible. " : ""}
            Nothing is dispatched until approved.
          </Callout>
        ) : (
          <Callout tone="green" title="Quiet path">All checks pass with margin. The operator sees a single 'Approve plan' action and no interruptions.</Callout>
        )}
      </div>
    </div>
  );
}

function TaskRow({ title, veh, reason }: { title: string; veh?: Veh; reason: string }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <div className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${veh ? "bg-amber-400" : "bg-rose-400"}`} />
      <div className="flex-1">
        <div className="text-sm font-medium text-slate-100">{title}</div>
        <div className="text-xs text-slate-400">{reason}</div>
      </div>
      <Pill tone={veh ? "amber" : "red"}>{veh ? veh.name : "unassigned"}</Pill>
    </div>
  );
}

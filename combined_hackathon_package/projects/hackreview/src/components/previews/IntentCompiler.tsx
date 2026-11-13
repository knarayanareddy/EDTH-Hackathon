"use client";

import { useMemo, useState } from "react";
import { Badge, Btn, type Tone } from "../ui";

type Veh = { id: string; name: string; endurance: number; speed: number; swath: number; air: boolean };
const VEHICLES: Veh[] = [
  { id: "F2", name: "Fixed-wing F2", endurance: 90, speed: 22, swath: 200, air: true },
  { id: "Q1", name: "Quadcopter Q1", endurance: 25, speed: 12, swath: 120, air: true },
  { id: "Q4", name: "Quadcopter Q4", endurance: 25, speed: 12, swath: 120, air: true },
  { id: "G3", name: "Ground robot G3", endurance: 180, speed: 2, swath: 20, air: false },
];

const RESERVE = 0.2;
const SWAP_GAP = 4; // minutes of coverage lost when no overlapping relief is available

type Check = { name: string; status: "pass" | "warn" | "fail"; detail: string };
type Assign = { task: string; vehicles: string[]; why: string[]; checks: Check[]; gapMin: number; attention: string[] };

function usable(v: Veh) {
  return v.endurance * (1 - RESERVE);
}

function plan(intent: "A" | "B", duration: number, online: Record<string, boolean>, nfz: boolean): Assign[] {
  const avail = VEHICLES.filter((v) => online[v.id] && v.air);
  const out: Assign[] = [];
  const used = new Set<string>();

  const overwatch = (site: string, mins: number) => {
    const sorted = [...avail].filter((v) => !used.has(v.id)).sort((a, b) => b.endurance - a.endurance);
    const why: string[] = [];
    const attention: string[] = [];
    const checks: Check[] = [];
    if (sorted.length === 0) {
      out.push({ task: `Hold ${site} for ${mins} min`, vehicles: [], why: ["No airborne vehicle is available."], checks: [{ name: "Vehicle available", status: "fail", detail: "none online" }], gapMin: mins, attention: [`No drone can hold ${site}.`] });
      return;
    }
    const lead = sorted[0];
    used.add(lead.id);
    const sortie = usable(lead);
    why.push(`${lead.name} chosen: longest endurance among available drones (${lead.endurance} min, ${Math.round(sortie)} min usable after ${RESERVE * 100}% reserve).`);
    const vehicles = [lead.id];
    let gap = 0;
    if (sortie >= mins) {
      why.push(`One sortie covers the ${mins} min; no relief needed.`);
      checks.push({ name: "Battery reserve", status: "pass", detail: `${mins} min ≤ ${Math.round(sortie)} min usable` });
    } else {
      const sorties = Math.ceil(mins / sortie);
      const relief = sorted.slice(1);
      checks.push({ name: "Battery reserve", status: "warn", detail: `needs ${sorties} sorties of ~${Math.round(sortie)} min` });
      for (let i = 1; i < sorties; i++) {
        const r = relief[(i - 1) % Math.max(1, relief.length)];
        if (r) {
          vehicles.push(r.id);
          used.add(r.id);
        }
      }
      if (relief.length === 0) {
        gap = (sorties - 1) * SWAP_GAP;
        why.push(`No second drone to overlap: ${sorties - 1} handover(s) with the same airframe, ~${SWAP_GAP} min gap each.`);
      } else {
        why.push(`Relief by ${vehicles.slice(1).join(", ")}, launched before the handover so coverage overlaps.`);
        if (relief.length < sorties - 1) {
          gap = SWAP_GAP;
          why.push(`Only ${relief.length} relief airframe(s) for ${sorties - 1} handover(s): one gap of ~${SWAP_GAP} min.`);
        }
      }
      if (gap > 0) {
        attention.push(`Coverage gap of ${gap} min over ${site}. Accept, or swap in the ground robot G3 (180 min endurance; intent says ‘drone’, so this needs your decision)?`);
      }
    }
    checks.push({ name: "Geofence", status: "pass", detail: `${site} inside the approved area` });
    checks.push({ name: "Comms range", status: "pass", detail: "within link range of the relay" });
    checks.push({ name: "Deconfliction", status: "pass", detail: `own altitude band ${lead.id === "F2" ? "120 m" : "60 m"}` });
    out.push({ task: `Hold ${site} for ${mins} min`, vehicles, why, checks, gapMin: gap, attention });
  };

  const search = (area: string, km2: number) => {
    const cands = avail.filter((v) => !used.has(v.id)).sort((a, b) => b.speed * b.swath - a.speed * a.swath);
    const checks: Check[] = [];
    const attention: string[] = [];
    const why: string[] = [];
    if (cands.length === 0) {
      out.push({ task: `Search ${area}`, vehicles: [], why: ["No free drone for the search."], checks: [{ name: "Vehicle available", status: "fail", detail: "all assigned or offline" }], gapMin: 0, attention: [`Nothing is free to search ${area}.`] });
      return;
    }
    const v = cands[0];
    used.add(v.id);
    const effKm2 = nfz ? km2 * 0.88 : km2;
    const minutes = (effKm2 * 1e6) / (v.swath * v.speed) / 60;
    const sorties = Math.ceil(minutes / usable(v));
    why.push(`${v.name} chosen: fastest coverage rate (${v.swath} m swath at ${v.speed} m/s).`);
    why.push(`${effKm2.toFixed(2)} km² takes about ${Math.round(minutes)} min; ${Math.round(usable(v))} min usable per sortie.`);
    const vehicles = [v.id];
    if (sorties > 1) {
      const extra = cands.slice(1, sorties);
      for (const e of extra) {
        vehicles.push(e.id);
        used.add(e.id);
      }
      why.push(`${sorties} sorties needed; ${extra.length ? `${extra.map((e) => e.id).join(", ")} flies the remainder` : "same airframe relaunches after a battery swap"}.`);
      checks.push({ name: "Battery reserve", status: "warn", detail: `${sorties} sorties` });
      if (extra.length < sorties - 1) attention.push(`Search of ${area} needs a battery swap and relaunch (~${SWAP_GAP * 2} min pause). Approve?`);
    } else checks.push({ name: "Battery reserve", status: "pass", detail: `${Math.round(minutes)} min ≤ ${Math.round(usable(v))} min` });
    if (nfz) {
      checks.push({ name: "No-fly zone", status: "warn", detail: "north-east corner overlaps; path trimmed (12% of area not searched)" });
      attention.push(`12% of ${area} lies in a no-fly zone and will not be searched. Confirm that is acceptable.`);
    } else checks.push({ name: "No-fly zone", status: "pass", detail: "no overlap" });
    checks.push({ name: "Geofence", status: "pass", detail: "inside approved area" });
    checks.push({ name: "Deconfliction", status: "pass", detail: "separate altitude band from the overwatch drone" });
    out.push({ task: `Search ${area}`, vehicles, why, checks, gapMin: 0, attention });
  };

  if (intent === "A") {
    overwatch("the gate", duration);
    search("the north field", 2.4);
  } else {
    overwatch("the east road", Math.min(duration, 60));
    search("the tree line", 0.9);
  }
  return out;
}

const CT: Record<Check["status"], Tone> = { pass: "ok", warn: "warn", fail: "bad" };

export function IntentCompiler() {
  const [intent, setIntent] = useState<"A" | "B">("A");
  const [duration, setDuration] = useState(120);
  const [online, setOnline] = useState<Record<string, boolean>>({ F2: true, Q1: true, Q4: true, G3: true });
  const [nfz, setNfz] = useState(false);
  const [approved, setApproved] = useState(false);

  const base = useMemo(() => plan(intent, duration, { F2: true, Q1: true, Q4: true, G3: true }, false), [intent, duration]);
  const cur = useMemo(() => plan(intent, duration, online, nfz), [intent, duration, online, nfz]);
  const attention = cur.flatMap((a) => a.attention);
  const changes = cur
    .map((a, i) => {
      const b = base[i];
      const same = a.vehicles.join() === b.vehicles.join() && a.gapMin === b.gapMin;
      return same ? null : `${a.task}: ${b.vehicles.join(" + ") || "—"} → ${a.vehicles.join(" + ") || "—"}${a.gapMin !== b.gapMin ? `, gap ${b.gapMin} → ${a.gapMin} min` : ""}`;
    })
    .filter(Boolean) as string[];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Commander intent (constrained template)</p>
          <div className="space-y-2">
            <button
              onClick={() => {
                setIntent("A");
                setApproved(false);
              }}
              className={`block w-full rounded border p-2 text-left text-sm ${intent === "A" ? "border-cyan-500 bg-cyan-500/10 text-white" : "border-slate-700 text-slate-300"}`}
            >
              “Search the north field, keep one drone over the gate for <strong>{duration}</strong> minutes.”
            </button>
            <button
              onClick={() => {
                setIntent("B");
                setApproved(false);
              }}
              className={`block w-full rounded border p-2 text-left text-sm ${intent === "B" ? "border-cyan-500 bg-cyan-500/10 text-white" : "border-slate-700 text-slate-300"}`}
            >
              “Keep eyes on the east road for up to an hour, then search the tree line.”
            </button>
          </div>
          <label className="mt-3 block text-xs text-slate-300">
            Hold duration: <strong className="text-white">{duration} min</strong>
            <input type="range" min={20} max={180} step={10} value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="w-full" />
          </label>
          <label className="mt-2 flex items-center gap-2 text-xs text-slate-300">
            <input type="checkbox" checked={nfz} onChange={(e) => setNfz(e.target.checked)} />
            A no-fly zone overlaps the north-east corner of the search area
          </label>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Fleet (toggle availability)</p>
          <ul className="space-y-1.5">
            {VEHICLES.map((v) => (
              <li key={v.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-slate-200">
                  {v.name} <span className="text-xs text-slate-500">{v.endurance} min · {v.speed} m/s{v.air ? "" : " · ground"}</span>
                </span>
                <Btn tone={online[v.id] ? "danger" : "primary"} onClick={() => setOnline({ ...online, [v.id]: !online[v.id] })}>
                  {online[v.id] ? "Take offline" : "Bring online"}
                </Btn>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="space-y-3">
        {cur.map((a) => (
          <div key={a.task} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-white">{a.task}</p>
              <div className="flex gap-1">
                {a.vehicles.length ? a.vehicles.map((v) => <Badge key={v} tone="info">{v}</Badge>) : <Badge tone="bad">unassigned</Badge>}
              </div>
            </div>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-slate-300">
              {a.why.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
            <div className="mt-2 flex flex-wrap gap-2">
              {a.checks.map((c) => (
                <span key={c.name} title={c.detail}>
                  <Badge tone={CT[c.status]}>
                    {c.status === "pass" ? "✓" : c.status === "warn" ? "!" : "✕"} {c.name}
                  </Badge>
                </span>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-slate-500">{a.checks.map((c) => `${c.name}: ${c.detail}`).join(" · ")}</p>
          </div>
        ))}
      </div>

      <div className={`rounded-lg border p-3 ${attention.length ? "border-amber-500/50 bg-amber-500/10" : "border-emerald-500/40 bg-emerald-500/10"}`}>
        <p className="text-sm font-semibold text-white">
          {attention.length ? `Needs your decision: ${attention.length}` : "Operator attention needed: 0. All checks pass; the plan proceeds."}
        </p>
        {attention.length > 0 && (
          <>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-100">
              {attention.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
            <div className="mt-2 flex gap-2">
              <Btn tone="primary" onClick={() => setApproved(true)}>
                Accept plan with these limits
              </Btn>
              <Btn onClick={() => setApproved(false)}>Edit plan</Btn>
              {approved && <Badge tone="ok">Accepted (simulated)</Badge>}
            </div>
          </>
        )}
      </div>

      {changes.length > 0 && (
        <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-3 text-sm text-slate-200">
          <p className="text-xs font-bold uppercase tracking-widest text-cyan-300">What changed vs the full-fleet plan</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {changes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { Badge, fmtAge, type Tone } from "../ui";

type Feed = { id: string; name: string; type: string; interval: number; unit: string; scenario: string; completeness: number };

const FEEDS: Feed[] = [
  { id: "wind", name: "Wind speed and direction", type: "Observation", interval: 600, unit: "10 min", scenario: "drone launch, drift, parachute/payload drop", completeness: 1 },
  { id: "adsb", name: "Civil flight traffic (ADS-B)", type: "Observation", interval: 10, unit: "10 s", scenario: "airspace deconfliction near the airbase", completeness: 0.85 },
  { id: "ais", name: "Civil vessel traffic (AIS)", type: "Observation", interval: 60, unit: "1 min", scenario: "coastal / port picture, dark-vessel context", completeness: 0.7 },
  { id: "sat", name: "Satellite orbital elements", type: "Derived", interval: 86400, unit: "1 day", scenario: "when others can image the site", completeness: 1 },
];

function fresh(ratio: number) {
  if (ratio <= 1.5) return 1;
  return Math.max(0, 1 - (ratio - 1.5) / 6.5);
}

function cls(r: number): { label: "READY" | "DEGRADED" | "NOT READY"; tone: Tone; icon: string } {
  if (r >= 0.75) return { label: "READY", tone: "ok", icon: "●" };
  if (r >= 0.4) return { label: "DEGRADED", tone: "warn", icon: "◐" };
  return { label: "NOT READY", tone: "bad", icon: "✕" };
}

export function OsintReadiness() {
  const [ratio, setRatio] = useState<Record<string, number>>({ wind: 1, adsb: 1, ais: 1, sat: 1 });
  const [windModel, setWindModel] = useState(false);
  const [gust, setGust] = useState(9);

  const rows = FEEDS.map((f) => {
    const prov = f.id === "wind" && windModel ? 0.75 : 1;
    const fr = fresh(ratio[f.id]);
    const readiness = fr * f.completeness * prov;
    return { f, ageSec: ratio[f.id] * f.interval, fr, prov, readiness, c: cls(readiness) };
  });
  const w = rows[0];
  const ageMin = w.ageSec / 60;
  const unc = 0.4 + 0.1 * Math.min(ageMin, 60) + (windModel ? 1 : 0);
  const worst = gust + unc;
  const LIMIT = 12;
  const margin = LIMIT - worst;
  const decision = w.readiness < 0.4 || margin <= 0 ? "HOLD" : margin <= 1 ? "GO, REDUCED MARGIN" : "GO";
  const dTone: Tone = decision === "GO" ? "ok" : decision === "HOLD" ? "bad" : "warn";

  const adsb = rows[1];
  const sat = rows[3];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        {rows.map(({ f, ageSec, readiness, c, fr, prov }) => (
          <div key={f.id} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-white">{f.name}</p>
                <p className="text-[11px] text-slate-400">
                  {f.id === "wind" && windModel ? "Forecast model" : f.type} · expected every {f.unit}
                </p>
              </div>
              <Badge tone={c.tone}>
                {c.icon} {c.label} {Math.round(readiness * 100)}%
              </Badge>
            </div>
            <label className="mt-2 block text-xs text-slate-300">
              Last successful refresh: <strong className="text-white">{fmtAge(ageSec)} ago</strong>{" "}
              <span className="text-slate-500">({ratio[f.id].toFixed(1)}× expected)</span>
              <input type="range" min={0} max={20} step={0.5} value={ratio[f.id]} onChange={(e) => setRatio({ ...ratio, [f.id]: Number(e.target.value) })} className="w-full" />
            </label>
            <p className="text-[11px] text-slate-500">
              freshness {Math.round(fr * 100)}% × completeness {Math.round(f.completeness * 100)}% × provenance {Math.round(prov * 100)}%
            </p>
            {f.id === "wind" && (
              <label className="mt-1 flex items-center gap-2 text-xs text-slate-300">
                <input type="checkbox" checked={windModel} onChange={(e) => setWindModel(e.target.checked)} />
                Source is a forecast model, not a local measurement
              </label>
            )}
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-3">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm font-semibold text-white">Decision: launch interceptor drones from pad A?</p>
          <Badge tone={dTone}>{decision}</Badge>
        </div>
        <label className="mt-2 block text-xs text-slate-300">
          Last reported gust: <strong className="text-white">{gust} m/s</strong> (airframe limit {LIMIT} m/s)
          <input type="range" min={5} max={13} step={0.5} value={gust} onChange={(e) => setGust(Number(e.target.value))} className="w-full" />
        </label>
        <div className="mt-2 grid gap-2 text-sm text-slate-200 md:grid-cols-3">
          <div className="rounded border border-slate-800 p-2">
            <p className="text-[11px] uppercase text-slate-400">Reading</p>
            <p>{gust} m/s gust, reported {fmtAge(w.ageSec)} ago</p>
          </div>
          <div className="rounded border border-slate-800 p-2">
            <p className="text-[11px] uppercase text-slate-400">Uncertainty added for age</p>
            <p>±{unc.toFixed(1)} m/s → worst case {worst.toFixed(1)} m/s</p>
          </div>
          <div className="rounded border border-slate-800 p-2">
            <p className="text-[11px] uppercase text-slate-400">Margin to limit</p>
            <p className={margin <= 0 ? "text-red-300" : margin <= 1 ? "text-amber-300" : "text-emerald-300"}>{margin.toFixed(1)} m/s</p>
          </div>
        </div>
        <p className="mt-2 text-sm text-slate-200">
          <span className="font-semibold text-white">Why: </span>
          {decision === "GO"
            ? "Fresh enough wind data and a comfortable margin."
            : decision === "HOLD"
              ? `The wind feed is ${w.c.label.toLowerCase()} (${Math.round(w.readiness * 100)}%) and the worst case no longer fits under the limit. To restore confidence: refresh the feed (target ≤ ${FEEDS[0].unit}) or read the local anemometer.`
              : "Allowed, but the margin is thin because the data is ageing. The operator is told which feed is responsible."}
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-sm">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Airspace picture (civil traffic)</p>
          {adsb.readiness >= 0.75 ? (
            <p className="text-slate-200">Civil traffic shown is current. ‘No aircraft shown’ can be read as ‘no ADS-B emitters nearby’ (not as ‘empty airspace’).</p>
          ) : (
            <p className="text-amber-200">Feed is {adsb.c.label.toLowerCase()}. The airspace is shown as UNKNOWN, not clear. Do not rely on absence of tracks.</p>
          )}
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-sm">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Satellite pass planning</p>
          {ratio.sat <= 3 ? (
            <p className="text-slate-200">Orbital elements are recent: predicted pass times are good to roughly a minute.</p>
          ) : (
            <p className="text-amber-200">
              Elements are {ratio.sat.toFixed(0)} days old: pass times may be off by several minutes and drift grows with age. Show windows as wider bands, not lines.
            </p>
          )}
          <p className="mt-1 text-[11px] text-slate-500">Public elements cover only part of the real satellite population.</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <table className="w-full min-w-[520px] text-left text-xs">
          <thead className="bg-slate-900 text-[10px] uppercase text-slate-400">
            <tr>
              <th className="px-3 py-2">Feed</th>
              <th className="px-3 py-2">Scenario where it earns its place</th>
              <th className="px-3 py-2">Status now</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ f, c }) => (
              <tr key={f.id} className="border-t border-slate-800">
                <td className="px-3 py-2 text-slate-100">{f.name}</td>
                <td className="px-3 py-2 text-slate-300">{f.scenario}</td>
                <td className="px-3 py-2">
                  <Badge tone={c.tone}>
                    {c.icon} {c.label}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

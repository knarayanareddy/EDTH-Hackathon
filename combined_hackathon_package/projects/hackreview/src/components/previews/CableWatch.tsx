"use client";

import { useMemo, useState } from "react";
import {
  CABLE,
  CORRIDOR_KM,
  ISR_BASE,
  ISR_ENDURANCE_MIN,
  ISR_SPEED_KM_MIN,
  MAP_H,
  MAP_W,
  NOW,
  ZONES,
  buildVessels,
  isrPlan,
  scoreVessel,
} from "@/lib/cablesim";
import { Badge } from "../ui";

const PX = 8; // px per km

export function CableWatch() {
  const [threshold, setThreshold] = useState(0.35);
  const [useContext, setUseContext] = useState(true);
  const [sel, setSel] = useState("V5");

  const vessels = useMemo(() => buildVessels(), []);
  const scored = useMemo(() => vessels.map((v) => scoreVessel(v, useContext)), [vessels, useContext]);
  const alerts = scored.filter((s) => s.score >= threshold);
  const plan = useMemo(() => isrPlan(alerts), [alerts]);
  const speedOnly = scored.filter((s) => s.speedOnlyAlert);
  const cur = scored.find((s) => s.vessel.id === sel) ?? scored[0];

  const rings = [0, 15, 30].map((m) => ({ m, r: ((ISR_ENDURANCE_MIN - m) * ISR_SPEED_KM_MIN) / 2 }));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
          <svg viewBox={`0 0 ${MAP_W * PX} ${MAP_H * PX}`} className="w-full" style={{ background: "#07111f" }}>
            <defs>
              <clipPath id="cw-clip">
                <rect width={MAP_W * PX} height={MAP_H * PX} />
              </clipPath>
            </defs>
            <g clipPath="url(#cw-clip)">
              {/* corridor buffer */}
              <polyline
                points={CABLE.map(([x, y]) => `${x * PX},${y * PX}`).join(" ")}
                fill="none"
                stroke="rgba(251,191,36,0.12)"
                strokeWidth={CORRIDOR_KM * 2 * PX}
                strokeLinecap="round"
              />
              {/* zones */}
              {Object.entries(ZONES).map(([k, z]) => (
                <g key={k}>
                  <rect
                    x={z.x0 * PX}
                    y={z.y0 * PX}
                    width={(z.x1 - z.x0) * PX}
                    height={(z.y1 - z.y0) * PX}
                    fill="rgba(148,163,184,0.08)"
                    stroke="#64748b"
                    strokeDasharray="5 4"
                  />
                  <text x={z.x0 * PX + 5} y={z.y0 * PX + 13} fontSize="11" fill="#94a3b8">
                    {z.label}
                  </text>
                </g>
              ))}
              {/* ISR range rings */}
              {rings.map((r) => (
                <g key={r.m}>
                  <circle cx={ISR_BASE.x * PX} cy={ISR_BASE.y * PX} r={r.r * PX} fill="none" stroke="#22d3ee" strokeOpacity={0.4} strokeDasharray="3 5" />
                  <text x={ISR_BASE.x * PX + r.r * PX * 0.707 + 2} y={ISR_BASE.y * PX - r.r * PX * 0.707} fontSize="10" fill="#67e8f9">
                    {r.m === 0 ? "reach, 0 min on station" : `${r.m} min on station`}
                  </text>
                </g>
              ))}
              {/* cable */}
              <polyline points={CABLE.map(([x, y]) => `${x * PX},${y * PX}`).join(" ")} fill="none" stroke="#fbbf24" strokeWidth={2.5} strokeDasharray="10 4" />
              <text x={8} y={38 * PX - 10} fontSize="11" fill="#fbbf24">
                Subsea cable (synthetic geometry)
              </text>
              {/* tracks */}
              {scored.map((s) => {
                const isAlert = s.score >= threshold;
                const col = isAlert ? "#f87171" : "#94a3b8";
                const pts = s.vessel.pts;
                const old = pts.slice(NOW - 120, NOW - 59);
                const recent = pts.slice(NOW - 60);
                const end = pts[NOW];
                const active = sel === s.vessel.id;
                return (
                  <g key={s.vessel.id} onClick={() => setSel(s.vessel.id)} className="cursor-pointer">
                    <polyline points={old.map((p) => `${p.x * PX},${p.y * PX}`).join(" ")} fill="none" stroke={col} strokeOpacity={0.3} strokeWidth={1.5} />
                    <polyline points={recent.map((p) => `${p.x * PX},${p.y * PX}`).join(" ")} fill="none" stroke={col} strokeWidth={active ? 3.5 : 2.2} />
                    <g transform={`translate(${end.x * PX},${end.y * PX}) rotate(${end.hdg})`}>
                      <polygon points="0,-9 6,7 0,3 -6,7" fill={col} stroke="#020617" />
                    </g>
                    <text x={end.x * PX + 10} y={end.y * PX + 4} fontSize="11" fontWeight="700" fill={isAlert ? "#fecaca" : "#cbd5e1"}>
                      {s.vessel.id} {isAlert ? "⚠ " : ""}
                      {s.score.toFixed(2)}
                    </text>
                  </g>
                );
              })}
              {/* base */}
              <g transform={`translate(${ISR_BASE.x * PX},${ISR_BASE.y * PX})`}>
                <rect x={-6} y={-6} width={12} height={12} fill="#22d3ee" stroke="#020617" />
                <text x={10} y={4} fontSize="11" fill="#67e8f9" fontWeight="700">
                  ISR base
                </text>
              </g>
            </g>
          </svg>
          <p className="border-t border-slate-800 px-3 py-1.5 text-[11px] text-slate-400">
            Synthetic 120 × 60 km area. Bold = last hour, faint = hour before. Red = alert at current threshold. Click a vessel.
          </p>
        </div>

        <div className="space-y-3">
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
            <label className="text-sm text-slate-300">
              Alert threshold: <strong className="text-white">{threshold.toFixed(2)}</strong>
              <input type="range" min={0.2} max={0.9} step={0.01} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} className="mt-1 w-full" />
            </label>
            <label className="mt-2 flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={useContext} onChange={(e) => setUseContext(e.target.checked)} />
              Use area + vessel-class context (anchorage, trawling, port)
            </label>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded border border-slate-800 p-2">
                <p className="text-2xl font-bold text-white">{alerts.length}</p>
                <p className="text-[11px] text-slate-400">alerts (this method)</p>
              </div>
              <div className="rounded border border-slate-800 p-2">
                <p className="text-2xl font-bold text-amber-300">{speedOnly.length}</p>
                <p className="text-[11px] text-slate-400">alerts (speed-only 1–6 kn)</p>
              </div>
              <div className="rounded border border-slate-800 p-2">
                <p className="text-2xl font-bold text-slate-300">{scored.length}</p>
                <p className="text-[11px] text-slate-400">vessels in view</p>
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Speed-only baseline flags {speedOnly.map((s) => s.vessel.id).join(", ") || "nothing"}
              {speedOnly.some((s) => s.vessel.id === "V2") ? " (including the trawler)" : ""} and misses V6 (7.5–10 kn).
            </p>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Ranked alerts → ISR cueing</p>
            {plan.length === 0 ? (
              <p className="text-sm text-slate-400">No alerts at this threshold.</p>
            ) : (
              <ol className="space-y-2">
                {plan.map((r, i) => (
                  <li key={r.s.vessel.id} className="rounded border border-slate-800 p-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white">
                        {r.reachable ? `#${i + 1}` : "–"} {r.s.vessel.id} {r.s.vessel.name}
                      </span>
                      {r.reachable ? <Badge tone="ok">Send ISR</Badge> : <Badge tone="bad">Out of reach</Badge>}
                    </div>
                    <p className="text-xs text-slate-400">
                      score {r.s.score.toFixed(2)} · {r.distKm.toFixed(0)} km out · transit {((r.distKm / ISR_SPEED_KM_MIN)).toFixed(0)} min ·{" "}
                      {r.reachable ? `${r.onStationMin.toFixed(0)} min on station` : "cannot loiter and return"}
                    </p>
                  </li>
                ))}
              </ol>
            )}
            <p className="mt-2 text-[11px] text-slate-500">
              Priority = score × min(1, on-station / 15 min). 25 m/s for 60 min = 90 km total, so usable radius ≤ 45 km. Target motion during transit is ignored in this preview.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-white">
            {cur.vessel.id} · {cur.vessel.name}
          </span>
          <Badge tone="mute">{cur.vessel.cls}</Badge>
          <Badge tone={cur.score >= threshold ? "bad" : "ok"}>{cur.score >= threshold ? "Alert for verification" : "Below threshold"}</Badge>
          {cur.f.context !== "none" && <Badge tone="info">context: {cur.f.context}</Badge>}
        </div>
        <p className="mt-1 text-sm text-slate-300">{cur.vessel.note}</p>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {cur.parts.map((p) => (
            <div key={p.name}>
              <div className="flex justify-between text-xs text-slate-300">
                <span>{p.name}</span>
                <span className="font-mono">+{p.contrib.toFixed(2)}</span>
              </div>
              <div className="mt-0.5 h-1.5 overflow-hidden rounded bg-slate-800">
                <div className="h-full bg-cyan-400" style={{ width: `${p.value * 100}%` }} />
              </div>
              <p className="text-[11px] text-slate-500">{p.text}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm text-slate-200">
          <span className="font-semibold text-white">Reason shown to the operator: </span>
          Behaviour consistent with something dragging, for verification (not a verdict). {cur.reason}
          {cur.f.suppress > 0 && ` Score reduced by ${Math.round(cur.f.suppress * 100)}% for context.`}
        </p>
      </div>
    </div>
  );
}

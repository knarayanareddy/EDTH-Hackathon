"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, Btn } from "../ui";

type Sensor = { id: string; kind: string; x: number; y: number };
const SENSORS: Sensor[] = [
  { id: "S1", kind: "seismic", x: 60, y: 240 },
  { id: "S2", kind: "acoustic", x: 140, y: 200 },
  { id: "S3", kind: "seismic", x: 230, y: 170 },
  { id: "S4", kind: "PIR", x: 330, y: 120 },
  { id: "S5", kind: "PIR", x: 420, y: 260 },
  { id: "S6", kind: "acoustic", x: 400, y: 60 },
];

// t in seconds, w = weak-signal weight
const EVENTS = [
  { id: "E1", s: "S1", t: 0, w: 0.4 },
  { id: "E2", s: "S2", t: 95, w: 0.3 },
  { id: "E3", s: "S5", t: 130, w: 0.3 }, // isolated noise
  { id: "E4", s: "S3", t: 190, w: 0.5 },
  { id: "E5", s: "S4", t: 300, w: 0.4 },
];

const THRESH = 1.0;
const TMAX = 420;

const sensor = (id: string) => SENSORS.find((s) => s.id === id)!;

function evaluate(enabled: Record<string, boolean>, upTo: number) {
  const ev = EVENTS.filter((e) => enabled[e.s] && e.t <= upTo).sort((a, b) => a.t - b.t);
  const best: Record<string, { score: number; chain: string[]; speeds: number[] }> = {};
  for (const e of ev) {
    let top = { score: e.w, chain: [e.id], speeds: [] as number[] };
    for (const p of ev) {
      if (p.t >= e.t) continue;
      const a = sensor(p.s);
      const b = sensor(e.s);
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const sp = d / (e.t - p.t);
      if (sp >= 0.3 && sp <= 3 && e.t - p.t <= 240) {
        const cand = best[p.id].score + 0.15 + e.w;
        if (cand > top.score) top = { score: cand, chain: [...best[p.id].chain, e.id], speeds: [...best[p.id].speeds, sp] };
      }
    }
    best[e.id] = top;
  }
  const vals = Object.values(best);
  const top = vals.sort((a, b) => b.score - a.score)[0] ?? { score: 0, chain: [] as string[], speeds: [] as number[] };
  return { ev, top };
}

export function GreyZoneQueue() {
  const [enabled, setEnabled] = useState<Record<string, boolean>>({ S1: true, S2: true, S3: true, S4: true, S5: true, S6: false });
  const [t, setT] = useState(0);
  const [play, setPlay] = useState(false);
  const [step, setStep] = useState<"idle" | "confirm" | "approved" | "rejected">("idle");

  useEffect(() => {
    if (!play) return;
    const id = setInterval(() => setT((p) => (p >= TMAX ? TMAX : p + 5)), 120);
    return () => clearInterval(id);
  }, [play]);

  const { ev, top } = useMemo(() => evaluate(enabled, t), [enabled, t]);
  const crossedAt = useMemo(() => {
    for (let s = 0; s <= TMAX; s += 5) if (evaluate(enabled, s).top.score >= THRESH) return s;
    return null;
  }, [enabled]);

  const proposalActive = crossedAt !== null && t >= crossedAt;
  const expired = crossedAt !== null && t > crossedAt + 120;
  const lastSensor = top.chain.length ? sensor(EVENTS.find((e) => e.id === top.chain[top.chain.length - 1])!.s) : null;
  const eta = lastSensor ? Math.round(Math.hypot(lastSensor.x - 20, lastSensor.y - 280) / 12) : 0;
  const silent = SENSORS.filter((s) => !ev.some((e) => e.s === s.id));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Btn tone="primary" onClick={() => setPlay((p) => !p)}>
          {play ? "Pause" : "Replay events"}
        </Btn>
        <Btn
          onClick={() => {
            setT(0);
            setStep("idle");
            setPlay(false);
          }}
        >
          Reset
        </Btn>
        <label className="flex min-w-[220px] flex-1 items-center gap-2 text-sm text-slate-300">
          T+<strong className="w-10 font-mono text-white">{t}s</strong>
          <input type="range" min={0} max={TMAX} step={5} value={t} onChange={(e) => setT(Number(e.target.value))} className="flex-1" />
        </label>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
          <svg viewBox="0 0 480 300" className="w-full" style={{ background: "#07111f" }}>
            {top.chain.length > 1 &&
              top.chain.slice(1).map((id, i) => {
                const a = sensor(EVENTS.find((e) => e.id === top.chain[i])!.s);
                const b = sensor(EVENTS.find((e) => e.id === id)!.s);
                return <line key={id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#fbbf24" strokeWidth="3" strokeDasharray="6 3" />;
              })}
            {SENSORS.map((s) => {
              const fired = ev.filter((e) => e.s === s.id);
              const off = !enabled[s.id];
              return (
                <g key={s.id}>
                  {fired.length > 0 && <circle cx={s.x} cy={s.y} r={22} fill="rgba(251,191,36,0.15)" stroke="#fbbf24" />}
                  <rect x={s.x - 7} y={s.y - 7} width={14} height={14} fill={off ? "none" : "#0ea5e9"} stroke={off ? "#ef4444" : "#0ea5e9"} strokeDasharray={off ? "3 3" : undefined} strokeWidth={2} />
                  <text x={s.x + 11} y={s.y - 10} fontSize="11" fill="#e2e8f0" fontWeight="700">
                    {s.id} {s.kind}
                  </text>
                  {off && (
                    <text x={s.x + 11} y={s.y + 20} fontSize="10" fill="#fca5a5">
                      ✕ offline (no heartbeat)
                    </text>
                  )}
                </g>
              );
            })}
            <polygon points="20,272 14,286 26,286" fill="#22d3ee" />
            <text x={32} y={284} fontSize="10" fill="#67e8f9">
              Drone Q1 (standby)
            </text>
          </svg>
          <p className="border-t border-slate-800 px-3 py-1.5 text-[11px] text-slate-400">
            Synthetic site, 1 px ≈ 1 m. Amber ring = sensor fired. Dashed amber = events that fit a walking-speed chain.
          </p>
        </div>

        <div className="space-y-3">
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Sensors (disable to simulate failure)</p>
            <div className="flex flex-wrap gap-2">
              {SENSORS.map((s) => (
                <Btn key={s.id} tone={enabled[s.id] ? "mute" : "danger"} onClick={() => setEnabled({ ...enabled, [s.id]: !enabled[s.id] })}>
                  {s.id} {enabled[s.id] ? "on" : "OFF"}
                </Btn>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Evidence</p>
            <p className="text-sm text-slate-200">
              Strongest chain: <strong className="font-mono text-white">{top.chain.join(" → ") || "none"}</strong> · evidence score{" "}
              <strong className="text-white">{top.score.toFixed(2)}</strong> / {THRESH.toFixed(1)} needed
            </p>
            <div className="mt-1 h-2 overflow-hidden rounded bg-slate-800">
              <div className={top.score >= THRESH ? "h-full bg-amber-400" : "h-full bg-cyan-400"} style={{ width: `${Math.min(100, (top.score / THRESH) * 100)}%` }} />
            </div>
            {top.speeds.length > 0 && <p className="mt-1 text-[11px] text-slate-400">Implied speeds between links: {top.speeds.map((s) => `${s.toFixed(1)} m/s`).join(", ")} (walking range 0.3–3)</p>}
            <p className="mt-2 text-[11px] text-slate-400">
              Single weak events never cross the threshold. {ev.some((e) => e.id === "E3") && enabled.S5 && "E3 at S5 is far off the chain: speed needed ≈ 8 m/s, so it is ignored (not deleted)."}
            </p>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Silent sensors, with the reason</p>
            <ul className="space-y-1 text-sm">
              {silent.map((s) => (
                <li key={s.id} className="text-slate-200">
                  <Badge tone={enabled[s.id] ? "ok" : "bad"}>{enabled[s.id] ? "● healthy, quiet" : "✕ offline, unknown"}</Badge> {s.id} {s.kind}
                </li>
              ))}
              {silent.length === 0 && <li className="text-slate-500">All sensors have reported.</li>}
            </ul>
          </div>
        </div>
      </div>

      {proposalActive ? (
        <div className={`rounded-lg border p-3 ${expired ? "border-slate-700 bg-slate-900" : "border-amber-500/50 bg-amber-500/10"}`}>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={expired ? "mute" : "warn"}>{expired ? "Expired" : "Proposal awaiting approval"}</Badge>
            <p className="text-sm font-semibold text-white">Recon: Drone Q1 to {lastSensor?.id} ({lastSensor?.kind}) area</p>
          </div>
          <div className="mt-2 grid gap-2 text-sm text-slate-200 md:grid-cols-4">
            <div>
              <p className="text-[11px] uppercase text-slate-400">Why</p>
              Chain {top.chain.join(" → ")} fits a walking-speed path.
            </div>
            <div>
              <p className="text-[11px] uppercase text-slate-400">Cost</p>
              ETA ≈ {eta}s; Q1 leaves standby.
            </div>
            <div>
              <p className="text-[11px] uppercase text-slate-400">Unknowns</p>
              {silent.filter((s) => !enabled[s.id]).map((s) => s.id).join(", ") || "none"} offline.
            </div>
            <div>
              <p className="text-[11px] uppercase text-slate-400">Expires</p>
              {expired ? "now" : `in ${Math.max(0, crossedAt! + 120 - t)}s`}
            </div>
          </div>
          {!expired && step === "idle" && (
            <div className="mt-3 flex gap-2">
              <Btn tone="primary" onClick={() => setStep("confirm")}>
                Review & approve…
              </Btn>
              <Btn onClick={() => setStep("rejected")}>Reject</Btn>
            </div>
          )}
          {!expired && step === "confirm" && (
            <div className="mt-3 rounded border border-cyan-500/40 bg-slate-950 p-2">
              <p className="text-sm text-slate-100">
                Confirm: send Q1 to {lastSensor?.id}? It will leave standby and cannot cover another task for about {eta * 2 + 60}s.
              </p>
              <div className="mt-2 flex gap-2">
                <Btn tone="primary" onClick={() => setStep("approved")}>
                  Confirm send
                </Btn>
                <Btn onClick={() => setStep("idle")}>Back</Btn>
              </div>
            </div>
          )}
          {step === "approved" && <p className="mt-2 text-sm text-emerald-300">Approved (simulated). The mission is created in Nexus and logged with who approved, when and why.</p>}
          {step === "rejected" && <p className="mt-2 text-sm text-slate-300">Rejected. Logged; the evidence stays visible and can re-trigger if it strengthens.</p>}
        </div>
      ) : (
        <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-400">No proposal. The operator is not interrupted: evidence is below the threshold.</div>
      )}
    </div>
  );
}

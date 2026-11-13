"use client";

import { useEffect, useState } from "react";
import { Badge, Btn } from "../ui";

const SENSORS = [
  { id: "S1", kind: "seismic", x: 100, y: 205 },
  { id: "S2", kind: "acoustic", x: 250, y: 140 },
  { id: "S3", kind: "PIR", x: 390, y: 105 },
];

// minutes after start
const EVENTS = [
  { id: "e1", s: "S1", observed: 4, received: 4.2, text: "weak ground vibration" },
  { id: "e2", s: "S2", observed: 9, received: 12.5, text: "1–2 kHz sound, 12 dB above baseline (link was degraded)" },
  { id: "e3", s: "S3", observed: 14, received: 14.1, text: "2 motion events within 10 s" },
  { id: "e4", s: "S1", observed: 18.5, received: 19, text: "vibration, stronger than before" },
];

const DECISIONS = [
  { id: "d1", at: 13, who: "Operator", text: "Ignored S1 vibration as a single weak event", basedOn: ["e1"] },
  { id: "d2", at: 15, who: "Operator", text: "Requested drone check along the gate road", basedOn: ["e1", "e2", "e3"] },
  { id: "d3", at: 21, who: "Drone Q1", text: "Arrived at S3: nothing seen; thermal clear", basedOn: ["e3", "e4"] },
];

const PATH = [
  { t: 0, x: 40, y: 250 },
  { t: 6, x: 100, y: 205 },
  { t: 10, x: 250, y: 145 },
  { t: 15, x: 390, y: 110 },
  { t: 24, x: 450, y: 40 },
  { t: 30, x: 470, y: 20 },
];

function truthAt(t: number) {
  for (let i = 1; i < PATH.length; i++) {
    if (t <= PATH[i].t) {
      const a = PATH[i - 1];
      const b = PATH[i];
      const f = (t - a.t) / (b.t - a.t);
      return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
    }
  }
  return PATH[PATH.length - 1];
}

const mmss = (m: number) => `${String(Math.floor(m)).padStart(2, "0")}:${String(Math.round((m % 1) * 60)).padStart(2, "0")}`;

export function SpatialDebrief() {
  const [t, setT] = useState(10);
  const [truth, setTruth] = useState(false);
  const [play, setPlay] = useState(false);

  useEffect(() => {
    if (!play) return;
    const id = setInterval(() => setT((p) => (p >= 30 ? 0 : Math.round((p + 0.25) * 100) / 100)), 120);
    return () => clearInterval(id);
  }, [play]);

  const known = EVENTS.filter((e) => e.received <= t);
  const inFlight = EVENTS.filter((e) => e.observed <= t && e.received > t);
  const tp = truthAt(t);
  const decisions = DECISIONS.filter((d) => d.at <= t);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Btn tone="primary" onClick={() => setPlay((p) => !p)}>
          {play ? "Pause" : "Replay"}
        </Btn>
        <label className="flex min-w-[240px] flex-1 items-center gap-3 text-sm text-slate-300">
          T = <strong className="w-12 font-mono text-white">{mmss(t)}</strong>
          <input type="range" min={0} max={30} step={0.25} value={t} onChange={(e) => setT(Number(e.target.value))} className="flex-1" />
        </label>
        <Btn active={truth} onClick={() => setTruth((x) => !x)}>
          {truth ? "Hide ground truth" : "Reveal ground truth"}
        </Btn>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
          <svg viewBox="0 0 500 290" className="w-full" style={{ background: "#07111f" }}>
            <polyline points="40,250 100,205 250,145 390,110 450,40" fill="none" stroke="#334155" strokeWidth="14" strokeLinecap="round" opacity={0.35} />
            {SENSORS.map((s) => {
              const ev = known.filter((e) => e.s === s.id);
              const last = ev[ev.length - 1];
              const fly = inFlight.filter((e) => e.s === s.id);
              return (
                <g key={s.id}>
                  <circle cx={s.x} cy={s.y} r={ev.length ? 26 : 16} fill={ev.length ? "rgba(34,211,238,0.12)" : "none"} stroke={ev.length ? "#22d3ee" : "#475569"} strokeDasharray={ev.length ? undefined : "3 4"} />
                  <rect x={s.x - 6} y={s.y - 6} width={12} height={12} fill="#0ea5e9" />
                  <text x={s.x + 10} y={s.y - 12} fontSize="11" fill="#e2e8f0" fontWeight="700">
                    {s.id} · {s.kind}
                  </text>
                  <text x={s.x + 10} y={s.y + 22} fontSize="10" fill="#94a3b8">
                    {last ? `last report seen: obs ${mmss(last.observed)}` : "no report received yet"}
                  </text>
                  {truth && fly.length > 0 && (
                    <text x={s.x + 10} y={s.y + 34} fontSize="10" fill="#fbbf24">
                      ⚠ observed but not yet received
                    </text>
                  )}
                </g>
              );
            })}
            {truth && (
              <g>
                <circle cx={tp.x} cy={tp.y} r={7} fill="#f87171" stroke="#020617" />
                <text x={tp.x + 10} y={tp.y + 4} fontSize="11" fill="#fecaca" fontWeight="700">
                  actual position (hidden from operator)
                </text>
              </g>
            )}
          </svg>
          <p className="border-t border-slate-800 px-3 py-1.5 text-[11px] text-slate-400">
            Scripted synthetic scenario. By default only information already <em>received</em> by T is visible.
          </p>
        </div>

        <div className="space-y-3">
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Known at {mmss(t)}</p>
            {known.length === 0 ? (
              <p className="text-sm text-slate-500">Nothing received yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {known.map((e) => (
                  <li key={e.id} className="text-sm text-slate-200">
                    <Badge tone="mute">{e.s}</Badge> {e.text}
                    <span className="block text-[11px] text-slate-500">
                      observed {mmss(e.observed)} · received {mmss(e.received)} · age now {(t - e.observed).toFixed(1)} min
                      {e.received - e.observed > 1 && <span className="text-amber-300"> · delayed {(e.received - e.observed).toFixed(1)} min in transit</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Decisions so far</p>
            {decisions.length === 0 ? (
              <p className="text-sm text-slate-500">No decisions yet.</p>
            ) : (
              <ul className="space-y-2">
                {decisions.map((d) => {
                  const based = EVENTS.filter((e) => d.basedOn.includes(e.id));
                  const maxAge = Math.max(...based.map((e) => d.at - e.observed));
                  const unknown = EVENTS.filter((e) => e.observed <= d.at && e.received > d.at);
                  return (
                    <li key={d.id} className="rounded border border-slate-800 p-2 text-sm">
                      <p className="text-slate-100">
                        <span className="font-mono text-xs text-slate-400">{mmss(d.at)}</span> <Badge tone="info">{d.who}</Badge> {d.text}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Based on {based.map((e) => e.id).join(", ")} · oldest input {maxAge.toFixed(1)} min old
                      </p>
                      {unknown.length > 0 && (
                        <p className="text-[11px] text-amber-300">
                          Not yet known then: {unknown.map((e) => `${e.id} (${e.s}, observed ${mmss(e.observed)})`).join(", ")}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

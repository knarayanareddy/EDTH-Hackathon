"use client";

import { useMemo, useState } from "react";
import { Badge } from "../ui";

type Rec = { i: number; t: number; x: number; y: number; sog: number; mmsi: string };
type Flag = { i: number; rule: string; why: string };

const KM_PER_KN_S = 0.514444 / 1000;

function makeTrack(): Rec[] {
  const out: Rec[] = [];
  let x = 5;
  let y = 30;
  let t = 0;
  for (let k = 0; k < 90; k++) {
    // 10 s class-A style reporting, 12 kn heading ENE
    const step = 10;
    const sog = 12;
    out.push({ i: out.length, t, x, y, sog, mmsi: "219012345" });
    x += Math.cos(0.3) * sog * KM_PER_KN_S * step * 6; // exaggerated scale (x6) for visibility
    y -= Math.sin(0.3) * sog * KM_PER_KN_S * step * 6;
    t += step;
  }
  // inject defects (we know the ground truth)
  // 1. gap: remove records 30..44 (150 s) then shift
  const gapped = out.filter((r) => r.i < 30 || r.i >= 45);
  // 2. duplicate record
  const dupSrc = gapped.find((r) => r.i === 12)!;
  gapped.splice(13, 0, { ...dupSrc });
  // 3. position jump
  const j = gapped.find((r) => r.i === 60)!;
  j.x += 9;
  j.y += 6;
  // 4. invalid MMSI
  gapped.find((r) => r.i === 72)!.mmsi = "2190123";
  // 5. SOG mismatch: reports 0.1 kn while moving
  for (const r of gapped.filter((r) => r.i >= 78 && r.i <= 84)) r.sog = 0.1;
  return gapped.map((r, idx) => ({ ...r, i: idx }));
}

export function AisIntegrity() {
  const [gapSec, setGapSec] = useState(60);
  const [jumpKn, setJumpKn] = useState(60);
  const [on, setOn] = useState({ dup: true, gap: true, jump: true, sog: true, id: true });
  const [sel, setSel] = useState<number | null>(null);

  const track = useMemo(makeTrack, []);

  const flags = useMemo(() => {
    const f: Flag[] = [];
    for (let k = 1; k < track.length; k++) {
      const a = track[k - 1];
      const b = track[k];
      const dt = b.t - a.t;
      const d = Math.hypot(b.x - a.x, b.y - a.y); // map km (scaled x6, so divide)
      const realKm = d / 6;
      if (on.dup && dt === 0 && d < 1e-9) f.push({ i: k, rule: "Duplicate record", why: "identical timestamp and position as the previous row" });
      else {
        if (on.gap && dt > gapSec) f.push({ i: k, rule: "Reporting gap", why: `${dt}s since previous message (expected ~10 s, threshold ${gapSec}s)` });
        if (on.jump && dt > 0) {
          const impliedKn = realKm / dt / KM_PER_KN_S;
          if (impliedKn > jumpKn) f.push({ i: k, rule: "Position jump", why: `implied ${Math.round(impliedKn)} kn between consecutive fixes (threshold ${jumpKn} kn)` });
        }
        if (on.sog && dt > 0) {
          const impliedKn = realKm / dt / KM_PER_KN_S;
          if (b.sog < 1 && impliedKn > 6 && impliedKn <= jumpKn) f.push({ i: k, rule: "SOG mismatch", why: `reported ${b.sog} kn but position change implies ${Math.round(impliedKn)} kn` });
        }
      }
      if (on.id && b.mmsi.length !== 9) f.push({ i: k, rule: "Invalid MMSI", why: `‘${b.mmsi}’ has ${b.mmsi.length} digits, expected 9` });
    }
    return f;
  }, [track, gapSec, jumpKn, on]);

  const flaggedIdx = new Set(flags.map((f) => f.i));
  const badFrac = flaggedIdx.size / track.length;
  const hasGapOrJump = flags.some((f) => f.rule === "Reporting gap" || f.rule === "Position jump");
  const tier = badFrac > 0.12 ? "Insufficient" : hasGapOrJump || badFrac > 0.03 ? "Degraded" : "Usable";
  const tierTone = tier === "Usable" ? "ok" : tier === "Degraded" ? "warn" : "bad";

  const W = 700;
  const H = 300;
  const sx = (x: number) => 20 + (x / 60) * (W - 40);
  const sy = (y: number) => 20 + (y / 36) * (H - 40);
  const rec = sel != null ? track[sel] : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-slate-300">Track quality handed to the alert stage:</span>
        <Badge tone={tierTone}>{tier}</Badge>
        <span className="text-xs text-slate-400">
          {flaggedIdx.size} of {track.length} records flagged · {tier === "Usable" ? "alerts may proceed" : tier === "Degraded" ? "alerts keep but lower confidence, with a data-quality note" : "emit ‘insufficient data’, not an alert"}
        </span>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ background: "#07111f" }}>
            {track.slice(1).map((b, k) => {
              const a = track[k];
              const bad = flags.some((f) => f.i === k + 1 && (f.rule === "Reporting gap" || f.rule === "Position jump"));
              return (
                <line
                  key={k}
                  x1={sx(a.x)}
                  y1={sy(a.y)}
                  x2={sx(b.x)}
                  y2={sy(b.y)}
                  stroke={bad ? "#f59e0b" : "#38bdf8"}
                  strokeWidth={bad ? 2 : 1.5}
                  strokeDasharray={bad ? "5 4" : undefined}
                />
              );
            })}
            {track.map((r) => {
              const fl = flags.filter((f) => f.i === r.i);
              return (
                <circle
                  key={r.i}
                  cx={sx(r.x)}
                  cy={sy(r.y)}
                  r={fl.length ? 5 : 2}
                  fill={fl.length ? "#ef4444" : "#7dd3fc"}
                  stroke={sel === r.i ? "#fff" : "none"}
                  strokeWidth={2}
                  onClick={() => setSel(r.i)}
                  className="cursor-pointer"
                />
              );
            })}
          </svg>
          <p className="border-t border-slate-800 px-3 py-1.5 text-[11px] text-slate-400">
            Synthetic track with five known injected defects. Dashed amber = gap/jump segment. Red dots = flagged record.
          </p>
        </div>

        <div className="space-y-3">
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-300">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Rules</p>
            {(
              [
                ["dup", "Duplicate record"],
                ["gap", "Reporting gap"],
                ["jump", "Position jump"],
                ["sog", "SOG vs displacement"],
                ["id", "Invalid identifier"],
              ] as const
            ).map(([k, l]) => (
              <label key={k} className="mr-4 inline-flex items-center gap-1.5">
                <input type="checkbox" checked={on[k]} onChange={(e) => setOn({ ...on, [k]: e.target.checked })} />
                {l}
              </label>
            ))}
            <label className="mt-3 block">
              Gap threshold: <strong className="text-white">{gapSec}s</strong>
              <input type="range" min={20} max={300} step={10} value={gapSec} onChange={(e) => setGapSec(Number(e.target.value))} className="w-full" />
            </label>
            <label className="block">
              Jump threshold: <strong className="text-white">{jumpKn} kn implied</strong>
              <input type="range" min={20} max={200} step={5} value={jumpKn} onChange={(e) => setJumpKn(Number(e.target.value))} className="w-full" />
            </label>
          </div>

          <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/60 scroll-thin">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-900 text-[10px] uppercase text-slate-400">
                <tr>
                  <th className="px-2 py-1.5">Row</th>
                  <th className="px-2 py-1.5">Rule</th>
                  <th className="px-2 py-1.5">Why</th>
                </tr>
              </thead>
              <tbody>
                {flags.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-2 py-3 text-slate-500">
                      No flags with these rules.
                    </td>
                  </tr>
                )}
                {flags.map((f, k) => (
                  <tr key={k} onClick={() => setSel(f.i)} className="cursor-pointer border-t border-slate-800 hover:bg-slate-800/50">
                    <td className="px-2 py-1 font-mono text-slate-400">{f.i}</td>
                    <td className="px-2 py-1 font-semibold text-amber-300">{f.rule}</td>
                    <td className="px-2 py-1 text-slate-300">{f.why}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-3 text-sm text-slate-200">
        <p className="text-xs font-bold uppercase tracking-widest text-cyan-300">Original records behind the selection</p>
        {rec ? (
          <pre className="mt-1 overflow-x-auto font-mono text-xs text-cyan-100">
{[track[Math.max(0, rec.i - 1)], rec, track[Math.min(track.length - 1, rec.i + 1)]]
  .map((r) => `row ${String(r.i).padStart(3)}  t=${String(r.t).padStart(4)}s  mmsi=${r.mmsi}  sog=${r.sog.toFixed(1)}  pos=(${r.x.toFixed(2)}, ${r.y.toFixed(2)})`)
  .join("\n")}
          </pre>
        ) : (
          <p className="mt-1 text-slate-400">Click a point or a row in the table to see the raw rows before and after it.</p>
        )}
      </div>
    </div>
  );
}

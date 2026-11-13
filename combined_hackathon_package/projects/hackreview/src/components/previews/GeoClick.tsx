"use client";

import { useMemo, useState } from "react";
import { Badge } from "../ui";

const IW = 640;
const IH = 360;
const HFOV = 60;
const F = IW / 2 / Math.tan((HFOV * Math.PI) / 360);
const DEG = Math.PI / 180;
const NS = 1500;
const UAV_SPEED = 15; // m/s

// fixed standard-normal samples so the picture is stable between slider moves
const NORM = (() => {
  let a = 12345;
  const r = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = new Float32Array(NS * 10);
  for (let i = 0; i < out.length; i += 2) {
    const u = Math.max(1e-9, r());
    const v = r();
    const m = Math.sqrt(-2 * Math.log(u));
    out[i] = m * Math.cos(2 * Math.PI * v);
    out[i + 1] = m * Math.sin(2 * Math.PI * v);
  }
  return out;
})();

interface P {
  alt: number;
  depr: number;
  gps: number;
  att: number;
  pix: number;
  terr: number;
  sync: number;
}
type Src = keyof Omit<P, "alt" | "depr"> | "all";

function project(px: number, py: number, alt: number, depr: number, e: { de: number; dn: number; dalt: number; dpix: [number, number]; pitch: number; yaw: number; roll: number; dnSync: number }) {
  let dx = px - IW / 2 + e.dpix[0];
  let dy = py - IH / 2 + e.dpix[1];
  if (e.roll) {
    const c = Math.cos(e.roll);
    const s = Math.sin(e.roll);
    const rx = dx * c - dy * s;
    const ry = dx * s + dy * c;
    dx = rx;
    dy = ry;
  }
  const d = depr * DEG + e.pitch;
  const fw = F * Math.cos(d) - dy * Math.sin(d);
  const dn = F * Math.sin(d) + dy * Math.cos(d);
  if (dn <= 0.02 * F) return null;
  const k = (alt + e.dalt) / dn;
  let east = dx * k;
  let north = fw * k;
  if (e.yaw) {
    const c = Math.cos(e.yaw);
    const s = Math.sin(e.yaw);
    const ex = east * c + north * s;
    const ny = -east * s + north * c;
    east = ex;
    north = ny;
  }
  return { e: east + e.de, n: north + e.dn + e.dnSync };
}

function mc(p: P, px: number, py: number, only: Src, count = NS) {
  const nom = project(px, py, p.alt, p.depr, { de: 0, dn: 0, dalt: 0, dpix: [0, 0], pitch: 0, yaw: 0, roll: 0, dnSync: 0 });
  if (!nom) return null;
  const on = (s: Src) => only === "all" || only === s;
  const sigAlt = Math.hypot(1.5 * p.gps, p.terr);
  const sigSync = (UAV_SPEED * p.sync) / 1000 / 2;
  const pts: [number, number][] = [];
  for (let i = 0; i < count; i++) {
    const o = i * 10;
    const r = project(px, py, p.alt, p.depr, {
      de: on("gps") ? NORM[o] * p.gps : 0,
      dn: on("gps") ? NORM[o + 1] * p.gps : 0,
      dalt: on("terr") ? NORM[o + 2] * sigAlt : 0,
      dpix: on("pix") ? [NORM[o + 3] * p.pix, NORM[o + 4] * p.pix] : [0, 0],
      pitch: on("att") ? NORM[o + 5] * p.att * DEG : 0,
      yaw: on("att") ? NORM[o + 6] * p.att * DEG : 0,
      roll: on("att") ? NORM[o + 7] * p.att * DEG : 0,
      dnSync: on("sync") ? NORM[o + 8] * sigSync : 0,
    });
    if (r) pts.push([r.e, r.n]);
  }
  if (pts.length < 20) return { nom, pts, a: Infinity, b: Infinity, ang: 0, rms: Infinity, lost: count - pts.length };
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const [x, y] of pts) {
    const dx = x - nom.e;
    const dy = y - nom.n;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }
  sxx /= pts.length;
  syy /= pts.length;
  sxy /= pts.length;
  const tr = sxx + syy;
  const det = sxx * syy - sxy * sxy;
  const disc = Math.sqrt(Math.max(0, (tr * tr) / 4 - det));
  const l1 = tr / 2 + disc;
  const l2 = Math.max(0, tr / 2 - disc);
  const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const k = Math.sqrt(5.991);
  return { nom, pts, a: k * Math.sqrt(l1), b: k * Math.sqrt(l2), ang, rms: Math.sqrt(tr), lost: count - pts.length };
}

const SRC_LABEL: Record<Exclude<Src, "all">, string> = {
  gps: "Aircraft position (GPS)",
  att: "Attitude (pitch/yaw/roll)",
  pix: "Click placement (pixels)",
  terr: "Height / terrain model",
  sync: "Video–telemetry time offset",
};

export function GeoClick() {
  const [p, setP] = useState<P>({ alt: 120, depr: 35, gps: 3, att: 0.8, pix: 6, terr: 5, sync: 100 });
  const [click, setClick] = useState<[number, number]>([360, 260]);

  const res = useMemo(() => mc(p, click[0], click[1], "all"), [p, click]);
  const budget = useMemo(
    () =>
      (Object.keys(SRC_LABEL) as Exclude<Src, "all">[])
        .map((k) => {
          const r = mc(p, click[0], click[1], k, 800);
          return { k, rms: r ? r.rms : NaN };
        })
        .sort((a, b) => b.rms - a.rms),
    [p, click],
  );
  const curve = useMemo(() => {
    const out: { d: number; a: number }[] = [];
    for (let d = 15; d <= 85; d += 5) {
      const r = mc({ ...p, depr: d }, click[0], click[1], "all", 500);
      out.push({ d, a: r && isFinite(r.a) ? r.a : NaN });
    }
    return out;
  }, [p, click]);
  const better = useMemo(() => {
    const r = mc({ ...p, depr: Math.min(80, p.depr + 20) }, click[0], click[1], "all", 800);
    return r;
  }, [p, click]);

  const horizonY = IH / 2 - F * Math.tan(p.depr * DEG);
  const set = (k: keyof P, v: number) => setP((s) => ({ ...s, [k]: v }));

  // top-down view scaling
  let view = 100;
  if (res) {
    const ext = Math.max(Math.abs(res.nom.n) + res.a + 20, Math.abs(res.nom.e) + res.a + 20, 60);
    view = isFinite(ext) ? Math.min(ext, 3000) : 300;
  }
  const VW = 340;
  const sc = VW / 2 / view;
  const X = (e: number) => VW / 2 + e * sc;
  const Y = (n: number) => VW - 24 - n * sc * 0.9;

  const maxCurve = Math.max(...curve.filter((c) => isFinite(c.a)).map((c) => c.a), 1);
  const major = res?.a ?? Infinity;
  const tooBig = major > 25;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
        <div className="space-y-3">
          <div className="overflow-hidden rounded-lg border border-slate-800 bg-black">
            <svg
              viewBox={`0 0 ${IW} ${IH}`}
              className="w-full cursor-crosshair"
              onClick={(e) => {
                const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
                setClick([((e.clientX - r.left) / r.width) * IW, ((e.clientY - r.top) / r.height) * IH]);
              }}
            >
              <defs>
                <linearGradient id="gc-sky" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#1e3a5f" />
                  <stop offset="1" stopColor="#5b7a99" />
                </linearGradient>
                <linearGradient id="gc-ground" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#47563b" />
                  <stop offset="1" stopColor="#2a3320" />
                </linearGradient>
              </defs>
              <rect width={IW} height={IH} fill="url(#gc-ground)" />
              {horizonY > 0 && <rect width={IW} height={Math.min(IH, horizonY)} fill="url(#gc-sky)" />}
              {horizonY > 0 && horizonY < IH && <line x1={0} x2={IW} y1={horizonY} y2={horizonY} stroke="#fff" strokeOpacity={0.4} strokeDasharray="4 4" />}
              {[0.35, 0.5, 0.7].map((f) => (
                <line key={f} x1={IW * 0.5} y1={IH} x2={IW * f * 1.4 - IW * 0.2} y2={Math.max(horizonY, 0)} stroke="#d4c9a1" strokeOpacity={0.15} strokeWidth="3" />
              ))}
              <line x1={click[0] - 14} x2={click[0] + 14} y1={click[1]} y2={click[1]} stroke="#22d3ee" strokeWidth="2" />
              <line x1={click[0]} x2={click[0]} y1={click[1] - 14} y2={click[1] + 14} stroke="#22d3ee" strokeWidth="2" />
              <circle cx={click[0]} cy={click[1]} r={18} fill="none" stroke="#22d3ee" />
              <text x={8} y={IH - 8} fill="#e2e8f0" fontSize="12">
                Synthetic video frame · click to pick a target · dashed line = horizon
              </text>
            </svg>
          </div>

          <div className="grid gap-x-4 gap-y-2 rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-300 sm:grid-cols-2">
            {(
              [
                ["alt", "Height above ground (m)", 30, 400, 10],
                ["depr", "Camera depression (° below horizon)", 5, 85, 1],
                ["gps", "GPS σ (m)", 0.5, 10, 0.5],
                ["att", "Attitude σ (°)", 0.1, 3, 0.1],
                ["pix", "Click σ (pixels)", 1, 25, 1],
                ["terr", "Terrain/height σ (m)", 0, 25, 1],
                ["sync", "Video–telemetry offset (ms)", 0, 500, 10],
              ] as [keyof P, string, number, number, number][]
            ).map(([k, label, min, max, step]) => (
              <label key={k}>
                {label}: <strong className="text-white">{p[k]}</strong>
                <input type="range" min={min} max={max} step={step} value={p[k]} onChange={(e) => set(k, Number(e.target.value))} className="w-full" />
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
            <svg viewBox={`0 0 ${VW} ${VW}`} className="w-full" style={{ background: "#07111f" }}>
              {res &&
                res.pts.slice(0, 400).map(([e, n], i) => <circle key={i} cx={X(e)} cy={Y(n)} r={1} fill="#38bdf8" opacity={0.35} />)}
              {res && isFinite(res.a) && (
                <ellipse
                  cx={X(res.nom.e)}
                  cy={Y(res.nom.n)}
                  rx={res.a * sc}
                  ry={res.b * sc * 0.9}
                  transform={`rotate(${(-res.ang * 180) / Math.PI} ${X(res.nom.e)} ${Y(res.nom.n)})`}
                  fill="rgba(34,211,238,0.12)"
                  stroke="#22d3ee"
                  strokeWidth="2"
                />
              )}
              {res && <circle cx={X(res.nom.e)} cy={Y(res.nom.n)} r={4} fill="#f87171" />}
              <polygon points={`${X(0)},${Y(0) - 8} ${X(0) - 6},${Y(0) + 6} ${X(0) + 6},${Y(0) + 6}`} fill="#fbbf24" />
              {res && <line x1={X(0)} y1={Y(0)} x2={X(res.nom.e)} y2={Y(res.nom.n)} stroke="#fbbf24" strokeOpacity={0.4} strokeDasharray="4 4" />}
              <text x={8} y={VW - 8} fontSize="10" fill="#94a3b8">
                top-down, N up · grid scale ±{Math.round(view)} m · UAV = triangle
              </text>
            </svg>
          </div>

          {res ? (
            <div className={`rounded-lg border p-3 ${tooBig ? "border-amber-500/50 bg-amber-500/10" : "border-emerald-500/40 bg-emerald-500/10"}`}>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={tooBig ? "warn" : "ok"}>{tooBig ? "Poor fix for precision tasks" : "Good fix"}</Badge>
                <span className="text-sm font-semibold text-white">
                  95% ellipse {isFinite(res.a) ? `${res.a.toFixed(0)} × ${res.b.toFixed(0)} m` : "unbounded"}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-300">
                Range to point ≈ {Math.hypot(res.nom.e, res.nom.n, p.alt).toFixed(0)} m. Dominant source: <strong className="text-white">{SRC_LABEL[budget[0].k]}</strong>.
                {better && isFinite(better.a) && isFinite(res.a) && better.a < res.a * 0.8 && (
                  <> Looking {Math.min(80, p.depr + 20) - p.depr}° steeper (same click) would shrink the major axis from {res.a.toFixed(0)} m to about {better.a.toFixed(0)} m.</>
                )}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                Candidate location for verification. Not an authorisation. {res.lost > 0 && `${res.lost} of ${NS} samples had no ground intersection.`}
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
              The click is at or above the horizon for this camera angle. There is no ground intersection, so no location is returned.
            </div>
          )}

          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Error budget (RMS radial error if only this source were present)</p>
            <ul className="space-y-1.5">
              {budget.map((b) => {
                const m = Math.max(...budget.map((x) => (isFinite(x.rms) ? x.rms : 0)), 1);
                return (
                  <li key={b.k} className="grid grid-cols-[170px_1fr_52px] items-center gap-2 text-xs text-slate-300">
                    <span>{SRC_LABEL[b.k]}</span>
                    <div className="h-2 overflow-hidden rounded bg-slate-800">
                      <div className="h-full bg-cyan-400" style={{ width: `${isFinite(b.rms) ? (b.rms / m) * 100 : 100}%` }} />
                    </div>
                    <span className="text-right font-mono">{isFinite(b.rms) ? b.rms.toFixed(1) : "∞"} m</span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">95% major axis vs camera depression (this click, current errors)</p>
            <svg viewBox="0 0 300 80" className="w-full">
              <polyline
                fill="none"
                stroke="#22d3ee"
                strokeWidth="1.5"
                points={curve
                  .filter((c) => isFinite(c.a))
                  .map((c) => `${((c.d - 15) / 70) * 290 + 5},${75 - (Math.min(c.a, maxCurve) / maxCurve) * 70}`)
                  .join(" ")}
              />
              <line x1={((p.depr - 15) / 70) * 290 + 5} x2={((p.depr - 15) / 70) * 290 + 5} y1={0} y2={80} stroke="#fff" strokeOpacity={0.5} />
            </svg>
            <p className="text-[11px] text-slate-500">Error explodes at shallow angles: ground range = height / tan(angle).</p>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useMemo, useState } from "react";
import { Slider, Stat, Btn, Pill } from "../components/ui";

const W = 640;
const H = 360;

type V2 = [number, number];

function gp(h: number, p: number, dx: number, dy: number, f: number): V2 | null {
  const east = dx;
  const north = f * Math.cos(p) - dy * Math.sin(p);
  const up = -f * Math.sin(p) - dy * Math.cos(p);
  if (up >= -1e-6) return null;
  const t = h / -up;
  return [east * t, north * t];
}

function randn() {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export default function NexusGeo() {
  const [h, setH] = useState(120);
  const [pitchDeg, setPitchDeg] = useState(35);
  const [fov, setFov] = useState(60);
  const [sH, setSH] = useState(4);
  const [sP, setSP] = useState(0.6);
  const [sPsi, setSPsi] = useState(1.0);
  const [sG, setSG] = useState(3);
  const [age, setAge] = useState(0.4);
  const [req, setReq] = useState(25);
  const [click, setClick] = useState<V2>([360, 250]);
  const [mc, setMc] = useState<{ cov: number; n: number } | null>(null);
  const speed = 15;

  const calc = useMemo(() => {
    const f = W / 2 / Math.tan((fov * Math.PI) / 360);
    const p = (pitchDeg * Math.PI) / 180;
    const dx = click[0] - W / 2;
    const dy = click[1] - H / 2;
    const g = gp(h, p, dx, dy, f);
    if (!g) return { f, p, dx, dy, g: null as V2 | null };
    const d = 1e-4;
    const gh = gp(h + 0.01, p, dx, dy, f)!;
    const gpp = gp(h, p + d, dx, dy, f)!;
    const Jh: V2 = [(gh[0] - g[0]) / 0.01, (gh[1] - g[1]) / 0.01];
    const Jp: V2 = [(gpp[0] - g[0]) / d, (gpp[1] - g[1]) / d];
    const Jpsi: V2 = [-g[1], g[0]];
    const sp = (sP * Math.PI) / 180;
    const spsi = (sPsi * Math.PI) / 180;
    const sAge = (speed * age) / 2;
    // covariance
    const parts: { name: string; J: V2; s: number }[] = [
      { name: "Altitude", J: Jh, s: sH },
      { name: "Gimbal pitch", J: Jp, s: sp },
      { name: "Heading", J: Jpsi, s: spsi },
      { name: "GNSS position", J: [1, 0], s: sG },
      { name: "GNSS position", J: [0, 1], s: sG },
      { name: "Telemetry age", J: [0, 1], s: sAge },
    ];
    let cxx = 0;
    let cxy = 0;
    let cyy = 0;
    parts.forEach((q) => {
      cxx += q.J[0] * q.J[0] * q.s * q.s;
      cxy += q.J[0] * q.J[1] * q.s * q.s;
      cyy += q.J[1] * q.J[1] * q.s * q.s;
    });
    const tr = cxx + cyy;
    const det = cxx * cyy - cxy * cxy;
    const disc = Math.sqrt(Math.max(0, (tr * tr) / 4 - det));
    const l1 = tr / 2 + disc;
    const l2 = Math.max(1e-9, tr / 2 - disc);
    const ang = 0.5 * Math.atan2(2 * cxy, cxx - cyy);
    const k = Math.sqrt(5.991);
    const a95 = k * Math.sqrt(l1);
    const b95 = k * Math.sqrt(l2);
    const vmaj: V2 = [Math.cos(ang), Math.sin(ang)];
    const contrib: Record<string, number> = {};
    parts.forEach((q) => {
      const proj = q.J[0] * vmaj[0] + q.J[1] * vmaj[1];
      contrib[q.name] = (contrib[q.name] || 0) + (proj * proj * q.s * q.s) / l1;
    });
    return { f, p, dx, dy, g, cxx, cxy, cyy, a95, b95, ang, contrib, sp, spsi, sAge, l1, l2 };
  }, [h, pitchDeg, fov, sH, sP, sPsi, sG, age, click]);

  const runMC = () => {
    if (!calc.g || calc.a95 === undefined) return;
    const { f, p, dx, dy, g, cxx, cxy, cyy, sp, spsi, sAge } = calc as Required<typeof calc>;
    const det = cxx * cyy - cxy * cxy;
    const N = 4000;
    let inside = 0;
    let valid = 0;
    for (let i = 0; i < N; i++) {
      const hh = h + randn() * sH;
      const pp = p + randn() * sp;
      const psi = randn() * spsi;
      const e = gp(hh, pp, dx, dy, f);
      if (!e) continue;
      valid++;
      const c = Math.cos(psi);
      const s = Math.sin(psi);
      const ex = e[0] * c - e[1] * s + randn() * sG;
      const ny = e[0] * s + e[1] * c + randn() * sG + randn() * sAge;
      const ex0 = ex - g[0];
      const ey0 = ny - g[1];
      const m2 = (cyy * ex0 * ex0 - 2 * cxy * ex0 * ey0 + cxx * ey0 * ey0) / det;
      if (m2 <= 5.991) inside++;
    }
    setMc({ cov: inside / Math.max(1, valid), n: valid });
  };

  const onClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setClick([((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H]);
    setMc(null);
  };

  // video overlays
  const f = calc.f;
  const p = calc.p;
  const horizonY = H / 2 - f * Math.tan(p);
  const rangeLines = [50, 100, 200, 300, 500, 800].map((n) => {
    const fw = n * Math.cos(p) + h * Math.sin(p);
    const upc = n * Math.sin(p) - h * Math.cos(p);
    if (fw <= 0) return null;
    return { n, y: H / 2 - (f * upc) / fw };
  });

  // top view
  const gN = calc.g ? calc.g[1] : 200;
  const a95 = calc.a95 ?? 0;
  const extent = Math.max(160, Math.abs(gN) * 1.25 + a95, a95 * 1.3);
  const TW = 360;
  const TH = 360;
  const sc = (TH - 60) / extent;
  const ox = TW / 2;
  const oy = TH - 24;
  const tx = (e: number) => ox + e * sc;
  const ty = (n: number) => oy - n * sc;

  const state = !calc.g
    ? { label: "NO GROUND INTERSECTION", tone: "red" as const, why: "The click is at or above the horizon. No honest position exists." }
    : a95 <= req
    ? { label: "STRIKE-QUALITY", tone: "green" as const, why: `95% semi-major ${a95.toFixed(0)} m ≤ required ${req} m.` }
    : a95 <= req * 3
    ? { label: "NEEDS SECOND LOOK", tone: "amber" as const, why: `95% semi-major ${a95.toFixed(0)} m is ${(a95 / req).toFixed(1)}× the requirement. Re-image from steeper angle or fuse a second view.` }
    : { label: "CUE ONLY", tone: "red" as const, why: `95% semi-major ${a95.toFixed(0)} m. Good for 'look here', not for engagement.` };

  const tones = { green: "text-emerald-300 border-emerald-400/40 bg-emerald-400/10", amber: "text-amber-300 border-amber-400/40 bg-amber-400/10", red: "text-rose-300 border-rose-400/40 bg-rose-400/10" };
  const contribList = calc.contrib ? Object.entries(calc.contrib).sort((a, b) => b[1] - a[1]) : [];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <div>
          <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500">
            <span>Simulated drone video - click anywhere to geolocate</span>
            <Pill tone="cyan">pitch {pitchDeg}° · FOV {fov}°</Pill>
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} onClick={onClick} className="w-full cursor-crosshair rounded-lg border border-white/10">
            <defs>
              <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#1e2f45" />
                <stop offset="1" stopColor="#4b6178" />
              </linearGradient>
              <linearGradient id="gnd" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#5b5d46" />
                <stop offset="1" stopColor="#2c2d22" />
              </linearGradient>
            </defs>
            <rect width={W} height={H} fill="url(#gnd)" />
            <rect width={W} height={Math.max(0, Math.min(H, horizonY))} fill="url(#sky)" />
            {rangeLines.map(
              (r) =>
                r &&
                r.y > 0 &&
                r.y < H && (
                  <g key={r.n}>
                    <line x1={0} x2={W} y1={r.y} y2={r.y} stroke="white" strokeOpacity={0.18} strokeDasharray="4 6" />
                    <text x={8} y={r.y - 3} fontSize={10} fill="white" fillOpacity={0.5} fontFamily="monospace">
                      {r.n} m
                    </text>
                  </g>
                )
            )}
            <rect x={300} y={Math.min(H - 30, Math.max(horizonY + 20, 160))} width={34} height={14} rx={2} fill="#8a8f6f" opacity={0.8} />
            <line x1={W / 2 - 10} x2={W / 2 + 10} y1={H / 2} y2={H / 2} stroke="white" strokeOpacity={0.3} />
            <line y1={H / 2 - 10} y2={H / 2 + 10} x1={W / 2} x2={W / 2} stroke="white" strokeOpacity={0.3} />
            <g>
              <circle cx={click[0]} cy={click[1]} r={12} fill="none" stroke="#fbbf24" strokeWidth={2} />
              <circle cx={click[0]} cy={click[1]} r={2} fill="#fbbf24" />
            </g>
            <text x={W - 8} y={16} textAnchor="end" fontSize={11} fill="white" fillOpacity={0.6} fontFamily="monospace">
              ALT {h} m AGL · REC
            </text>
          </svg>
        </div>
        <div>
          <div className="mb-1 text-[11px] text-slate-500">Top-down: drone at bottom, looking north</div>
          <svg viewBox={`0 0 ${TW} ${TH}`} className="w-full rounded-lg border border-white/10 bg-[#0c1218]">
            {[0.25, 0.5, 0.75, 1].map((q) => (
              <circle key={q} cx={ox} cy={oy} r={(extent * q) * sc} fill="none" stroke="white" strokeOpacity={0.07} />
            ))}
            <path d={`M ${ox} ${oy} L ${tx(-Math.tan((fov * Math.PI) / 360) * extent)} ${ty(extent)} L ${tx(Math.tan((fov * Math.PI) / 360) * extent)} ${ty(extent)} Z`} fill="#22d3ee" fillOpacity={0.05} />
            <circle cx={ox} cy={oy} r={5} fill="#22d3ee" />
            <text x={ox + 9} y={oy + 4} fontSize={10} fill="#67e8f9" fontFamily="monospace">UAV</text>
            {calc.g && calc.a95 !== undefined && (
              <g>
                <ellipse cx={tx(calc.g[0])} cy={ty(calc.g[1])} rx={Math.max(1, calc.a95 * sc)} ry={Math.max(1, calc.b95! * sc)} transform={`rotate(${(-(calc.ang! * 180) / Math.PI)} ${tx(calc.g[0])} ${ty(calc.g[1])})`} fill="#fbbf24" fillOpacity={0.15} stroke="#fbbf24" strokeWidth={1.5} />
                <circle cx={tx(calc.g[0])} cy={ty(calc.g[1])} r={3} fill="#fbbf24" />
                <circle cx={tx(calc.g[0])} cy={ty(calc.g[1])} r={Math.max(2, req * sc)} fill="none" stroke="#34d399" strokeDasharray="3 3" strokeOpacity={0.8} />
              </g>
            )}
            <text x={8} y={TH - 8} fontSize={10} fill="white" fillOpacity={0.4} fontFamily="monospace">scale: {Math.round(extent)} m to top</text>
            <text x={8} y={16} fontSize={10} fill="#34d399" fillOpacity={0.9} fontFamily="monospace">- - required accuracy ({req} m)</text>
          </svg>
        </div>
      </div>

      <div className={`rounded-lg border px-4 py-3 ${tones[state.tone]}`}>
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-xs tracking-widest">{state.label}</span>
          <span className="text-sm text-slate-200">{state.why}</span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-3">
          <div className="font-mono text-[10px] uppercase tracking-widest text-slate-500">Platform & camera</div>
          <Slider label="Altitude AGL" value={h} min={30} max={500} step={5} unit=" m" onChange={(v) => { setH(v); setMc(null); }} />
          <Slider label="Gimbal pitch (below horizon)" value={pitchDeg} min={5} max={85} onChange={(v) => { setPitchDeg(v); setMc(null); }} unit="°" hint="Shallow angles look further but are far less accurate." />
          <Slider label="Horizontal FOV" value={fov} min={20} max={100} onChange={(v) => { setFov(v); setMc(null); }} unit="°" />
        </div>
        <div className="space-y-3">
          <div className="font-mono text-[10px] uppercase tracking-widest text-slate-500">Error budget (1σ)</div>
          <Slider label="Altitude error" value={sH} min={0} max={30} step={0.5} unit=" m" onChange={(v) => { setSH(v); setMc(null); }} />
          <Slider label="Pitch error" value={sP} min={0} max={3} step={0.1} unit="°" onChange={(v) => { setSP(v); setMc(null); }} />
          <Slider label="Heading error" value={sPsi} min={0} max={5} step={0.1} unit="°" onChange={(v) => { setSPsi(v); setMc(null); }} />
          <Slider label="GNSS error" value={sG} min={0} max={15} step={0.5} unit=" m" onChange={(v) => { setSG(v); setMc(null); }} />
          <Slider label="Telemetry age (UAV @ 15 m/s)" value={age} min={0} max={5} step={0.1} unit=" s" hint="Stale telemetry widens the ellipse along the flight path." onChange={(v) => { setAge(v); setMc(null); }} />
        </div>
        <div className="space-y-3">
          <div className="font-mono text-[10px] uppercase tracking-widest text-slate-500">Result</div>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Ground range" value={calc.g ? `${Math.round(Math.hypot(calc.g[0], calc.g[1]))} m` : "-"} />
            <Stat label="95% semi-major" value={calc.a95 !== undefined ? `${a95.toFixed(1)} m` : "-"} tone="amber" />
            <Stat label="95% semi-minor" value={calc.b95 !== undefined ? `${calc.b95.toFixed(1)} m` : "-"} tone="amber" />
            <Stat label="Hand-off bar" value={`${req} m`} tone="green" />
          </div>
          <Slider label="Required accuracy (95%)" value={req} min={5} max={100} unit=" m" onChange={setReq} />
          <div>
            <div className="mb-1 text-[11px] text-slate-500">Dominant error source (share of major-axis variance)</div>
            {contribList.map(([n, v]) => (
              <div key={n} className="mb-1 flex items-center gap-2 text-xs">
                <span className="w-28 text-slate-400">{n}</span>
                <div className="h-2 flex-1 rounded bg-white/10">
                  <div className="h-2 rounded bg-cyan-400" style={{ width: `${Math.min(100, v * 100)}%` }} />
                </div>
                <span className="w-10 text-right font-mono text-slate-300">{(v * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-white/10 bg-black/20 p-3">
        <Btn tone="amber" onClick={runMC} disabled={!calc.g}>Run Monte-Carlo check (4000 draws)</Btn>
        {mc ? (
          <div className="text-sm text-slate-300">
            Nominal 95% ellipse actually contained the truth <span className={`font-mono font-semibold ${Math.abs(mc.cov - 0.95) < 0.03 ? "text-emerald-300" : "text-rose-300"}`}>{(mc.cov * 100).toFixed(1)}%</span> of the time.
            {Math.abs(mc.cov - 0.95) >= 0.03 && <span className="text-rose-300"> Linearisation is breaking down at this geometry - widen it or refuse to hand off.</span>}
          </div>
        ) : (
          <div className="text-sm text-slate-500">This is the "error estimate that holds up" test. Try a pitch of 8-10° and run it.</div>
        )}
      </div>
    </div>
  );
}

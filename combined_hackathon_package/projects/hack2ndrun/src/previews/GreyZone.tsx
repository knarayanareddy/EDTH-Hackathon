import { useMemo, useState } from "react";
import { Slider, Toggle, Btn, Pill, Stat } from "../components/ui";

type Typ = "seismic" | "acoustic" | "motion";
interface Node {
  id: string;
  typ: Typ;
  x: number;
  y: number;
}
const NODES: Node[] = [
  { id: "S1", typ: "seismic", x: 14, y: 14 },
  { id: "A1", typ: "acoustic", x: 24, y: 10 },
  { id: "M1", typ: "motion", x: 30, y: 20 },
  { id: "S2", typ: "seismic", x: 40, y: 24 },
  { id: "A2", typ: "acoustic", x: 52, y: 22 },
  { id: "M2", typ: "motion", x: 58, y: 30 },
  { id: "S3", typ: "seismic", x: 66, y: 36 },
  { id: "A3", typ: "acoustic", x: 76, y: 38 },
  { id: "M3", typ: "motion", x: 84, y: 46 },
  { id: "A4", typ: "acoustic", x: 20, y: 44 },
  { id: "S4", typ: "seismic", x: 45, y: 48 },
];
const RAD: Record<Typ, number> = { seismic: 6, acoustic: 9, motion: 4.5 };
const P: Record<Typ, number> = { seismic: 0.8, acoustic: 0.6, motion: 0.9 };
const COL: Record<Typ, string> = { seismic: "#f59e0b", acoustic: "#22d3ee", motion: "#c084fc" };
const PATH: [number, number][] = [[4, 8], [30, 18], [58, 28], [72, 38], [96, 50]];
const UNIT = 20; // m per map unit
const WALK = 1.2; // m/s
const DRONE_BASE: [number, number] = [92, 8];

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 1000) / 1000;
};

function posAt(tMin: number): [number, number] {
  let s = WALK * tMin * 60 / UNIT;
  for (let i = 0; i < PATH.length - 1; i++) {
    const [ax, ay] = PATH[i];
    const [bx, by] = PATH[i + 1];
    const L = Math.hypot(bx - ax, by - ay);
    if (s <= L) return [ax + ((bx - ax) * s) / L, ay + ((by - ay) * s) / L];
    s -= L;
  }
  return PATH[PATH.length - 1];
}

interface Ev {
  id: string;
  node: Node;
  t: number;
  noise: boolean;
}

export default function GreyZone() {
  const [now, setNow] = useState(34);
  const [group, setGroup] = useState(true);
  const [wild, setWild] = useState(true);
  const [dead, setDead] = useState(false);
  const [truth, setTruth] = useState(false);
  const [decision, setDecision] = useState<{ kind: "ok" | "no"; len: number } | null>(null);

  const events = useMemo(() => {
    const ev: Ev[] = [];
    if (group) {
      NODES.forEach((n) => {
        if (dead && n.id === "M2") return;
        let best = 1e9;
        let bt = 0;
        for (let t = 0; t <= 45; t += 0.1) {
          const p = posAt(t);
          const d = Math.hypot(p[0] - n.x, p[1] - n.y);
          if (d < best) {
            best = d;
            bt = t;
          }
        }
        if (best <= RAD[n.typ] && hash("g" + n.id) < P[n.typ]) ev.push({ id: "E-" + n.id, node: n, t: bt, noise: false });
      });
    }
    if (wild) {
      for (let i = 0; i < 9; i++) {
        const n = NODES[Math.floor(hash("wn" + i) * NODES.length)];
        if (dead && n.id === "M2") continue;
        ev.push({ id: "W" + i, node: n, t: hash("wt" + i) * 45, noise: true });
      }
      // windy acoustic burst
      for (let i = 0; i < 4; i++) {
        const n = NODES.filter((q) => q.typ === "acoustic")[i];
        ev.push({ id: "WIND" + i, node: n, t: 36 + hash("wind" + i) * 6, noise: true });
      }
    }
    return ev.sort((a, b) => a.t - b.t);
  }, [group, wild, dead]);

  const analysis = useMemo(() => {
    const vis = events.filter((e) => e.t <= now);
    const chain = new Array(vis.length).fill(1);
    const prev = new Array(vis.length).fill(-1);
    for (let i = 0; i < vis.length; i++)
      for (let j = 0; j < i; j++) {
        const dt = (vis[i].t - vis[j].t) * 60;
        if (dt < 20) continue;
        const dist = Math.hypot(vis[i].node.x - vis[j].node.x, vis[i].node.y - vis[j].node.y) * UNIT;
        const v = dist / dt;
        if (v >= 0.25 && v <= 2.5 && chain[j] + 1 > chain[i]) {
          chain[i] = chain[j] + 1;
          prev[i] = j;
        }
      }
    let bi = -1;
    for (let i = 0; i < vis.length; i++) if (bi < 0 || chain[i] > chain[bi]) bi = i;
    const members: number[] = [];
    for (let k = bi; k >= 0; k = prev[k]) members.unshift(k);
    const types = new Set(members.map((m) => vis[m].node.typ));
    const len = bi >= 0 ? chain[bi] : 0;
    const score = len * (1 + 0.5 * (types.size - 1));
    let pred: [number, number] | null = null;
    let speed = 0;
    if (members.length >= 2) {
      const a = vis[members[members.length - 2]];
      const b = vis[members[members.length - 1]];
      const dtm = Math.max(0.1, b.t - a.t);
      const vx = (b.node.x - a.node.x) / dtm;
      const vy = (b.node.y - a.node.y) / dtm;
      speed = (Math.hypot(vx, vy) * UNIT) / 60;
      const ahead = 6 + Math.max(0, now - b.t);
      pred = [Math.max(0, Math.min(100, b.node.x + vx * ahead)), Math.max(0, Math.min(60, b.node.y + vy * ahead))];
    }
    return { vis, members: new Set(members.map((m) => vis[m].id)), len, score, types: types.size, pred, speed, memberList: members.map((m) => vis[m]) };
  }, [events, now]);

  const level = analysis.score >= 3.5 ? "recon" : analysis.score >= 2 ? "watch" : "log";
  const rejectedHold = decision?.kind === "no" && analysis.len < decision.len + 2;
  const showProposal = level === "recon" && !rejectedHold && decision?.kind !== "ok";
  const eta = analysis.pred ? Math.hypot(analysis.pred[0] - DRONE_BASE[0], analysis.pred[1] - DRONE_BASE[1]) * UNIT / 15 / 60 : 0;
  const w = posAt(now);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <svg viewBox="0 0 100 60" className="w-full rounded-lg border border-white/10 bg-[#0b1511]">
          <defs>
            <pattern id="gz" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M5 0H0V5" fill="none" stroke="white" strokeOpacity="0.04" strokeWidth="0.2" /></pattern>
          </defs>
          <rect width="100" height="60" fill="url(#gz)" />
          <path d="M0 4 Q30 14 55 25 T100 55" fill="none" stroke="#8b5e34" strokeOpacity="0.35" strokeWidth="1.2" strokeDasharray="2 1" />
          <text x="2" y="3" fontSize="1.8" fill="#8b5e34" fillOpacity="0.8">track / treeline (illustrative)</text>
          {NODES.map((n) => {
            const off = dead && n.id === "M2";
            return (
              <g key={n.id} opacity={off ? 0.35 : 1}>
                <circle cx={n.x} cy={n.y} r={RAD[n.typ]} fill={COL[n.typ]} fillOpacity="0.04" stroke={COL[n.typ]} strokeOpacity="0.25" strokeWidth="0.2" />
                <rect x={n.x - 0.9} y={n.y - 0.9} width="1.8" height="1.8" fill={COL[n.typ]} />
                <text x={n.x + 1.4} y={n.y - 1.2} fontSize="1.6" fill="#cbd5e1">{n.id}{off ? " ✕" : ""}</text>
              </g>
            );
          })}
          {analysis.memberList.length > 1 && <polyline points={analysis.memberList.map((e) => `${e.node.x},${e.node.y}`).join(" ")} fill="none" stroke="#fbbf24" strokeWidth="0.5" />}
          {analysis.vis.map((e) => {
            const inChain = analysis.members.has(e.id);
            const age = now - e.t;
            return <circle key={e.id} cx={e.node.x} cy={e.node.y} r={2 + Math.min(3, age / 6)} fill="none" stroke={inChain ? "#fbbf24" : "#64748b"} strokeOpacity={Math.max(0.15, 1 - age / 20)} strokeWidth={inChain ? 0.5 : 0.25} />;
          })}
          {analysis.pred && level === "recon" && (
            <g>
              <circle cx={analysis.pred[0]} cy={analysis.pred[1]} r="5" fill="#f43f5e" fillOpacity="0.12" stroke="#f43f5e" strokeDasharray="1 1" strokeWidth="0.3" />
              <text x={analysis.pred[0] + 1} y={analysis.pred[1] - 5.5} fontSize="1.7" fill="#fda4af">predicted position</text>
            </g>
          )}
          <rect x={DRONE_BASE[0] - 1} y={DRONE_BASE[1] - 1} width="2" height="2" fill="#38bdf8" />
          <text x={DRONE_BASE[0] - 12} y={DRONE_BASE[1] + 0.6} fontSize="1.7" fill="#7dd3fc">drone base</text>
          {truth && group && <circle cx={w[0]} cy={w[1]} r="1" fill="#f43f5e" />}
        </svg>

        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Raw triggers" value={analysis.vis.length} />
            <Stat label="In best chain" value={analysis.len} tone="amber" />
            <Stat label="Modalities" value={analysis.types} tone="cyan" />
          </div>
          <div className="rounded-lg border border-white/10 bg-black/20 p-3">
            <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-slate-100">
              Priority <Pill tone={level === "recon" ? "red" : level === "watch" ? "amber" : "slate"}>{level === "recon" ? "propose recon" : level === "watch" ? "keep watching" : "log only"}</Pill>
              <span className="font-mono text-slate-400">score {analysis.score.toFixed(1)}</span>
            </div>
            <div className="text-xs leading-relaxed text-slate-400">
              {analysis.len >= 2
                ? `${analysis.len} triggers form a consistent chain at ~${analysis.speed.toFixed(1)} m/s across ${analysis.types} modality type(s). Isolated triggers (${analysis.vis.length - analysis.len}) are not escalated.`
                : analysis.vis.length
                ? "Triggers exist but none are spatio-temporally consistent with a person moving. Nothing for the operator to do."
                : "No triggers yet."}
            </div>
          </div>
          {showProposal && (
            <div className="rounded-lg border border-rose-400/40 bg-rose-400/[0.08] p-3">
              <div className="text-xs font-semibold text-rose-200">Proposed recon (requires approval)</div>
              <div className="mt-1 text-xs text-slate-300">Fly Drone-1 to the predicted position, ETA {eta.toFixed(1)} min. Evidence: chain of {analysis.len} triggers, modalities {analysis.types}.</div>
              <div className="mt-2 flex gap-2">
                <Btn tone="green" onClick={() => setDecision({ kind: "ok", len: analysis.len })}>Approve</Btn>
                <Btn tone="red" onClick={() => setDecision({ kind: "no", len: analysis.len })}>Reject</Btn>
              </div>
            </div>
          )}
          {decision?.kind === "ok" && <div className="rounded-lg border border-emerald-400/40 bg-emerald-400/10 p-3 text-xs text-emerald-200">Approved → Drone-1 tasked via Nexus (SITL). The operator approved exactly one mission.</div>}
          {rejectedHold && <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-slate-300">Rejected. Will only re-propose if the chain grows by ≥ 2 more consistent triggers (anti-nagging).</div>}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_260px]">
        <div className="space-y-3">
          <Slider label="Time" value={now} min={0} max={45} step={0.5} unit=" min" onChange={setNow} />
          <div className="max-h-40 overflow-auto rounded-lg border border-white/10 bg-black/20">
            {analysis.vis.slice().reverse().map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-2 border-b border-white/5 px-3 py-1 text-xs">
                <span className="font-mono text-slate-400">T+{e.t.toFixed(1)}</span>
                <span className="text-slate-200">{e.node.id} · {e.node.typ}</span>
                <Pill tone={analysis.members.has(e.id) ? "amber" : "slate"}>{analysis.members.has(e.id) ? "in chain" : "isolated"}</Pill>
              </div>
            ))}
            {!analysis.vis.length && <div className="px-3 py-2 text-xs text-slate-500">No events yet.</div>}
          </div>
        </div>
        <div className="space-y-2">
          <Toggle label="Group moving through" on={group} onChange={(v) => { setGroup(v); setDecision(null); }} />
          <Toggle label="Wildlife + wind noise" on={wild} onChange={(v) => { setWild(v); setDecision(null); }} hint="Random triggers, acoustic gusts at T+36" />
          <Toggle label="Node M2 offline" on={dead} onChange={(v) => { setDead(v); setDecision(null); }} hint="Does the chain survive a missing sensor?" />
          <Toggle label="Show ground truth" on={truth} onChange={setTruth} />
        </div>
      </div>
    </div>
  );
}

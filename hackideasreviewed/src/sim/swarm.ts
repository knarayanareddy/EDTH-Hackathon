// Toy 2-D engagement sim: interceptors defend a point asset against real attackers mixed with decoys and civil traffic,
// under jamming and sensor failure. It is a TOY: real value comes from running the same harness on SITL.
// The point is the harness: seeded runs, a scenario space, rare-event statistics, failure replay.
import { gauss, mulberry32 } from "../utils/rng";

export type Policy = "naive" | "triage";
export interface Scn {
  threats: number; decoyRatio: number; civil: number; interceptors: number;
  jam: number; sensorFail: number; pdetScale: number; policy: Policy;
}
export const DEFAULT_SCN: Scn = { threats: 6, decoyRatio: 1.5, civil: 3, interceptors: 12, jam: 0.2, sensorFail: 0.1, pdetScale: 1, policy: "triage" };

type Kind = "threat" | "decoy" | "civil";
interface Tgt {
  id: number; kind: Kind; x: number; y: number; vx: number; vy: number; alive: boolean; impacted: boolean;
  det: number; confirmedAt: number | null; cls: Kind | "unknown"; conf: number; assigned: number | null; adsb: boolean; sp: number; S: number; pT: number;
}
interface Int { id: number; x: number; y: number; target: number | null; spent: boolean; flown: number }
export interface FrameT { id: number; x: number; y: number; kind: Kind; alive: boolean; cls: Kind | "unknown"; conf: number; confirmed: boolean; assigned: boolean }
export interface FrameI { id: number; x: number; y: number; target: number | null; spent: boolean }
export interface Frame { t: number; tg: FrameT[]; it: FrameI[] }
export interface Ev { t: number; text: string; level: "info" | "interrupt" | "bad" }
export interface Result {
  leaked: number; wastedOnDecoy: number; civilEngaged: number; interceptorsLeft: number; confirmedTracks: number; interrupts: number;
  frames: Frame[]; events: Ev[]; failed: boolean;
}

const RADAR = 2500, SPAWN = 3500, V_INT = 45, T_END = 170;

export function runSim(s: Scn, seed: number, trace = false): Result {
  const r = mulberry32(Math.imul(seed + 1, 2654435761) >>> 0);
  const tg: Tgt[] = [];
  const nDecoy = Math.round(s.threats * s.decoyRatio);
  const th0 = r() * Math.PI * 2;
  let id = 0;
  const addSwarm = (kind: Kind, n: number) => {
    for (let i = 0; i < n; i++) {
      const brg = th0 + (r() - 0.5) * 1.2;
      const sp = kind === "threat" ? 30 + gauss(r) * 1.5 : 30 + gauss(r) * 0.2;
      const d = SPAWN + r() * 40 * 30; // staggered arrival
      const x = Math.cos(brg) * d, y = Math.sin(brg) * d;
      const aim = Math.atan2(-y, -x) + gauss(r) * 0.03;
      tg.push({ id: id++, kind, x, y, vx: Math.cos(aim) * sp, vy: Math.sin(aim) * sp, alive: true, impacted: false, det: 0, confirmedAt: null, cls: "unknown", conf: 0.5, assigned: null, adsb: false, sp, S: 0, pT: 0.5 });
    }
  };
  addSwarm("threat", s.threats);
  addSwarm("decoy", nDecoy);
  for (let i = 0; i < s.civil; i++) { // civil aircraft crossing, ADS-B matched with p = 0.92 (the OSINT feed)
    const x = -3200 + r() * 800, y = -1500 + r() * 3000;
    const aim = (r() - 0.5) * 0.6 + (y > 0 ? -0.35 : 0.35);
    const sp = 60 + r() * 30;
    tg.push({ id: id++, kind: "civil", x, y, vx: Math.cos(aim) * sp, vy: Math.sin(aim) * sp, alive: true, impacted: false, det: 0, confirmedAt: null, cls: "unknown", conf: 0.5, assigned: null, adsb: r() < 0.92, sp, S: 0, pT: 0.5 });
  }
  const its: Int[] = Array.from({ length: s.interceptors }, (_, i) => ({ id: i, x: 0, y: 0, target: null, spent: false, flown: 0 }));
  const frames: Frame[] = [];
  const events: Ev[] = [];
  let leaked = 0, wasted = 0, civilEng = 0, interrupts = 0, confirmed = 0;
  const flagged = new Set<number>();
  let exhaustedFlag = false;
  const pdet = 0.9 * s.pdetScale * (1 - 0.8 * s.jam) * (1 - s.sensorFail);
  const cmdOk = 1 - 0.8 * s.jam;
  const log = (t: number, text: string, level: Ev["level"] = "info") => { if (trace) events.push({ t, text, level }); };
  const eta = (g: Tgt) => Math.hypot(g.x, g.y) / Math.max(1, g.sp);

  for (let t = 0; t <= T_END; t++) {
    // 1. move targets, impacts
    for (const g of tg) if (g.alive) {
      g.x += g.vx; g.y += g.vy;
      if (g.kind !== "civil" && Math.hypot(g.x, g.y) < 40) { // decoys arriving are harmless; real attackers are a LEAK
        g.alive = false; g.impacted = true;
        if (g.kind === "threat") { leaked++; log(t, `LEAK – real attacker #${g.id} reached the asset`, "bad"); }
      }
    }
    // 2. detection → confirmation → evidence accumulation. Each observed second adds a noisy kinematic cue
    //    (threat +mu, decoy −mu, un-matched civil 0). Jamming/sensor loss = fewer observations and a weaker cue.
    const mu = 0.4 * (1 - 0.6 * s.jam);
    for (const g of tg) if (g.alive) {
      const seen = Math.hypot(g.x, g.y) < RADAR && r() < pdet;
      if (seen) g.det++;
      if (g.det >= 3 && g.confirmedAt === null) { g.confirmedAt = t; confirmed++; log(t, `track #${g.id} confirmed at ${Math.hypot(g.x, g.y).toFixed(0)} m`); }
      if (g.confirmedAt !== null) {
        if (g.kind === "civil" && g.adsb) { g.cls = "civil"; g.conf = 0.97; g.pT = 0; }
        else {
          if (seen) g.S += (g.kind === "threat" ? mu : g.kind === "decoy" ? -mu : 0) + gauss(r);
          g.pT = 1 / (1 + Math.exp(-2 * mu * g.S));
          g.cls = g.pT >= 0.5 ? "threat" : "decoy";
          g.conf = Math.max(g.pT, 1 - g.pT);
        }
      }
    }
    // 3. operator interrupts (triage policy only): ambiguous + close, or out of interceptors
    if (s.policy === "triage") {
      for (const g of tg) if (g.alive && g.confirmedAt !== null && g.cls !== "civil" && g.conf < 0.7 && eta(g) < 35 && !flagged.has(g.id)) {
        flagged.add(g.id); interrupts++; log(t, `HUMAN NEEDED – ambiguous track #${g.id} (confidence ${(g.conf * 100).toFixed(0)}%, ETA ${eta(g).toFixed(0)} s)`, "interrupt");
      }
      const open = tg.some((g) => g.alive && g.kind === "threat" && g.confirmedAt !== null && g.assigned === null);
      if (!exhaustedFlag && open && its.every((i) => i.spent || i.target !== null)) { exhaustedFlag = true; interrupts++; log(t, "HUMAN NEEDED – interceptors exhausted while threats are inbound", "interrupt"); }
    }
    // 4. assignment
    const free = its.filter((i) => !i.spent && i.target === null);
    // triage: spend interceptors on evidence when they are scarce, and use slack early when they are not
    const unresolved = tg.filter((g) => g.alive && g.confirmedAt !== null && g.assigned === null && g.cls !== "civil" && g.pT > 0.15).length;
    const slack = free.length - unresolved;
    const cands = tg.filter((g) => g.alive && g.confirmedAt !== null && g.assigned === null && g.cls !== "civil" && (s.policy === "naive" || (g.cls === "threat" && (g.pT >= 0.85 || (eta(g) < 35 && g.pT >= 0.65) || (slack > 0 && g.pT >= 0.6))))).sort((a, b) => eta(a) - eta(b));
    for (const g of cands) {
      if (free.length === 0) break;
      if (s.policy === "triage" && free.length === 1 && eta(g) > 25) continue; // keep a reserve unless it is urgent
      if (r() > cmdOk) { continue; } // command lost to jamming this second
      const it = free.shift()!;
      it.target = g.id; g.assigned = it.id;
      log(t, `assign interceptor ${it.id} → #${g.id} (${g.cls}, conf ${(g.conf * 100).toFixed(0)}%, ETA ${eta(g).toFixed(0)} s)`);
    }
    // 5. interceptor flight and engagement
    for (const it of its) {
      if (it.spent || it.target === null) continue;
      const g = tg[it.target];
      if (!g.alive) { it.target = null; continue; } // target already gone → retarget next second
      const d = Math.hypot(g.x - it.x, g.y - it.y);
      const lead = d / V_INT;
      const ax = g.x + g.vx * lead - it.x, ay = g.y + g.vy * lead - it.y, al = Math.hypot(ax, ay) || 1;
      const step = Math.min(V_INT, d);
      it.x += (ax / al) * step; it.y += (ay / al) * step; it.flown += step;
      if (Math.hypot(g.x - it.x, g.y - it.y) < 30) {
        it.spent = true;
        const kill = r() < 0.85;
        if (kill) { g.alive = false; }
        else g.assigned = null;
        if (g.kind === "decoy") { wasted++; log(t, `interceptor ${it.id} spent on a DECOY #${g.id}`, "bad"); }
        else if (g.kind === "civil") { civilEng++; log(t, `interceptor ${it.id} engaged a CIVIL aircraft #${g.id}`, "bad"); }
        else log(t, `interceptor ${it.id} ${kill ? "destroyed" : "missed"} attacker #${g.id}`);
      } else if (it.flown > 3200) { it.spent = true; log(t, `interceptor ${it.id} out of range`, "bad"); }
    }
    if (trace) frames.push({
      t,
      tg: tg.map((g) => ({ id: g.id, x: g.x, y: g.y, kind: g.kind, alive: g.alive, cls: g.cls, conf: g.conf, confirmed: g.confirmedAt !== null, assigned: g.assigned !== null })),
      it: its.map((i) => ({ id: i.id, x: i.x, y: i.y, target: i.target, spent: i.spent })),
    });
    if (tg.every((g) => !g.alive || g.kind === "civil" && Math.hypot(g.x, g.y) > 6000)) break;
  }
  return { leaked, wastedOnDecoy: wasted, civilEngaged: civilEng, interceptorsLeft: its.filter((i) => !i.spent).length, confirmedTracks: confirmed, interrupts: s.policy === "naive" ? confirmed : interrupts, frames, events, failed: leaked > 0, };
}

// Wilson score interval – honest for small n and for rates near 0/1
export function wilson(k: number, n: number, z = 1.96): [number, number] {
  if (n === 0) return [0, 1];
  const p = k / n, d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d;
  const h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, c - h), Math.min(1, c + h)];
}

export interface Cell { jam: number; decoy: number; k: number; n: number; lo: number; hi: number; p: number; firstFail: number | null }
export function evalCell(base: Scn, jam: number, decoy: number, seeds: number): Cell {
  let k = 0, firstFail: number | null = null;
  for (let sd = 0; sd < seeds; sd++) {
    const res = runSim({ ...base, jam, decoyRatio: decoy }, sd + 1);
    if (res.failed) { k++; if (firstFail === null) firstFail = sd + 1; }
  }
  const [lo, hi] = wilson(k, seeds);
  return { jam, decoy, k, n: seeds, lo, hi, p: k / seeds, firstFail };
}

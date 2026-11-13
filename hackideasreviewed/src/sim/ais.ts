// Mock AIS world + detector for the CableGuard preview.
// Everything here is SYNTHETIC. Geometry is schematic (not real cable routes). Features are COMPUTED from
// the raw positions, they are not typed in per vessel.
import { clamp, gauss, hashStr, mulberry32 } from "../utils/rng";

export const KM_LAT = 111;
export const KM_LON = 63.4; // at ~55.25N
export const W = 158.6; // 13.5E..16.0E
export const H = 166.5; // 54.5N..56.0N
export const toLL = (x: number, y: number) => ({ lat: 54.5 + y / KM_LAT, lon: 13.5 + x / KM_LON });

export type Cls = "tanker" | "cargo" | "ferry" | "fishing";
export type Poly = [number, number][];
export interface Pt { t: number; x: number; y: number; sog: number; cog: number; hdg: number }
export interface Vessel { id: string; mmsi: number; name: string; cls: Cls; truth: string; pts: Pt[] }

export const LANES: { id: string; poly: Poly }[] = [
  { id: "L1", poly: [[0, 90], [40, 92], [70, 96], [110, 92], [158, 96]] },
  { id: "L2", poly: [[0, 45], [60, 46], [110, 36], [158, 34]] },
  { id: "L3", poly: [[105, 0], [108, 50], [112, 100], [110, 166]] },
];
export const CABLES: { id: string; name: string; kind: "power" | "telecom" | "pipeline"; poly: Poly }[] = [
  { id: "C1", name: "C1 Bornholm–Sweden power (schematic)", kind: "power", poly: [[42, 105], [77, 75]] },
  { id: "C2", name: "C2 N–S telecom (schematic)", kind: "telecom", poly: [[125, 0], [122, 50], [128, 100], [120, 166]] },
  { id: "C3", name: "C3 E–W pipeline (schematic)", kind: "pipeline", poly: [[0, 30], [60, 34], [110, 30], [158, 28]] },
];
export const FERRY: Poly = [[76, 67], [60, 85], [42, 100], [21, 103]];
export const FISHING = { x0: 92, y0: 12, x1: 135, y1: 48 };
export const ANCHORAGE = { x: 38, y: 74, r: 7 };
export const BASE = { x: 76, y: 76, name: "ISR launch point (assumed, Hasle)" };
export const BORNHOLM = { cx: 88.8, cy: 70, rx: 20, ry: 14 };
export const SWEDEN: Poly = [[0, 100], [21, 103], [54, 118], [76, 150], [95, 166.5], [0, 166.5]];

// ───────── geometry helpers
const polyLen = (p: Poly) => p.slice(1).reduce((a, q, i) => a + Math.hypot(q[0] - p[i][0], q[1] - p[i][1]), 0);
function pointAt(p: Poly, s: number) {
  let r = clamp(s, 0, polyLen(p));
  for (let i = 1; i < p.length; i++) {
    const L = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
    if (r <= L || i === p.length - 1) {
      const u = L ? r / L : 0;
      const dx = (p[i][0] - p[i - 1][0]) / (L || 1);
      const dy = (p[i][1] - p[i - 1][1]) / (L || 1);
      return { x: p[i - 1][0] + (p[i][0] - p[i - 1][0]) * u, y: p[i - 1][1] + (p[i][1] - p[i - 1][1]) * u, dx, dy };
    }
    r -= L;
  }
  return { x: p[0][0], y: p[0][1], dx: 1, dy: 0 };
}
export function distToPoly(x: number, y: number, p: Poly) {
  let best = 1e9;
  let brg = 0;
  for (let i = 1; i < p.length; i++) {
    const [ax, ay] = p[i - 1];
    const [bx, by] = p[i];
    const vx = bx - ax;
    const vy = by - ay;
    const L2 = vx * vx + vy * vy || 1;
    const u = clamp(((x - ax) * vx + (y - ay) * vy) / L2, 0, 1);
    const d = Math.hypot(x - (ax + u * vx), y - (ay + u * vy));
    if (d < best) {
      best = d;
      brg = (Math.atan2(vx, vy) * 180) / Math.PI;
    }
  }
  return { d: best, brg };
}
const angDiff = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);
const acute = (a: number, b: number) => {
  const d = angDiff(a, b) % 180;
  return d > 90 ? 180 - d : d;
};
const kn2kmmin = (kn: number) => (kn * 1.852) / 60;

// ───────── track generation
interface Opt {
  poly: Poly; s0: number; dir: 1 | -1; t0: number; t1: number;
  speed: (t: number) => number; lat?: (t: number) => number; hdgOff?: (t: number) => number; gaps?: [number, number][];
}
function follow(o: Opt, r: () => number): Pt[] {
  const L = polyLen(o.poly);
  const out: Pt[] = [];
  let s = o.s0;
  for (let t = o.t0; t <= o.t1; t += 2) {
    if (s < 0 || s > L) break;
    const a = pointAt(o.poly, s);
    const off = o.lat ? o.lat(t) : 0;
    const x = a.x + -a.dy * off;
    const y = a.y + a.dx * off;
    const v = Math.max(0, o.speed(t));
    const inGap = o.gaps?.some(([g0, g1]) => t >= g0 && t <= g1);
    if (t >= 0 && !inGap && x >= 0 && x <= W && y >= 0 && y <= H) out.push({ t, x, y, sog: v + gauss(r) * 0.12, cog: 0, hdg: (o.hdgOff ? o.hdgOff(t) : 0) });
    s += o.dir * kn2kmmin(v) * 2;
  }
  fixCog(out, r);
  return out;
}
function fixCog(pts: Pt[], r: () => number) {
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const c = (Math.atan2(b.x - a.x, b.y - a.y) * 180) / Math.PI;
    pts[i].cog = (c + 360 + gauss(r) * 0.8) % 360;
    pts[i].hdg = (pts[i].cog + pts[i].hdg + gauss(r) * 1.3 + 360) % 360;
  }
}
function closestS(poly: Poly, target: Poly) {
  let best = 1e9;
  let bs = 0;
  for (let s = 0; s <= polyLen(poly); s += 0.1) {
    const p = pointAt(poly, s);
    const d = distToPoly(p.x, p.y, target).d;
    if (d < best) { best = d; bs = s; }
  }
  return bs;
}

export const INCIDENT_T = 317; // 05:17 UTC (06:17 local) – Samus Swan analogue
let counter = 0;
const mk = (cls: Cls, name: string, truth: string, pts: Pt[]): Vessel => {
  counter++;
  return { id: `V${String(counter).padStart(3, "0")}`, mmsi: 200000000 + ((counter * 7919) % 99999999), name, cls, truth, pts };
};
const NAMES = ["NORDIC", "BALTIC", "SVEA", "AURORA", "HELGA", "MARTA", "OSTSEE", "VEGA", "THOR", "LINNEA", "ARKONA", "FREJA", "IDA", "ODIN", "ROSA"];

export function genDay(date: string, planted: boolean): Vessel[] {
  counter = 0;
  const r = mulberry32(hashStr(date));
  const V: Vessel[] = [];
  const nm = () => `${NAMES[Math.floor(r() * NAMES.length)]} ${["STAR", "TRADER", "SPIRIT", "PRIDE", "WAVE"][Math.floor(r() * 5)]}`;

  // transit traffic on lanes
  const nT = 30 + Math.floor(r() * 10);
  for (let i = 0; i < nT; i++) {
    const lane = LANES[r() < 0.4 ? 0 : r() < 0.7 ? 1 : 2];
    const cls: Cls = r() < 0.5 ? "tanker" : "cargo";
    const slow = r() < 0.12;
    const v0 = slow ? 6.4 + r() * 0.8 : (cls === "tanker" ? 11.8 : 10.8) + gauss(r) * 1.1;
    const dir = r() < 0.5 ? 1 : -1;
    const L = polyLen(lane.poly);
    const ph = r() * 6;
    const amp = 0.5 + r() * 0.5;
    V.push(mk(cls, nm(), slow ? "Slow-steaming (fuel economy)" : "Normal transit", follow({ poly: lane.poly, s0: dir === 1 ? 0 : L, dir, t0: -200 + r() * 1500, t1: 1500, speed: () => v0 + Math.sin(ph) * 0.2, lat: (t) => Math.sin(t / 90 + ph) * amp }, r)));
    if (r() < 0.06) { // coverage gap (innocent)
      const v = V[V.length - 1];
      const g0 = 300 + r() * 600;
      v.pts = v.pts.filter((p) => p.t < g0 || p.t > g0 + 45);
    }
  }
  // weather-affected cargo: slow, yawing, wandering – an innocent that looks odd
  if (r() < 0.45) {
    const lane = LANES[0];
    const L = polyLen(lane.poly);
    const t0 = 200 + r() * 700;
    V.push(mk("cargo", nm(), "Weather-affected cargo (crosswind/current)", follow({ poly: lane.poly, s0: 0, dir: 1, t0, t1: 1500, speed: () => 8.4 + r() * 0.2, lat: (t) => 1.6 + Math.sin((t - t0) / 25) * 0.9, hdgOff: (t) => 8 + Math.sin((t - t0) / 18) * 3 }, r)));
    void L;
  }
  // ferries Rønne–Ystad (decelerate into port)
  const Lf = polyLen(FERRY);
  for (let k = 0; k < 6; k++) {
    const dir = k % 2 === 0 ? 1 : -1;
    const t0 = 60 + k * 230 + r() * 20;
    const sp = (t: number, s: () => number) => {
      void t;
      return s();
    };
    let sPos = dir === 1 ? 0 : Lf;
    const pts: Opt = { poly: FERRY, s0: sPos, dir, t0, t1: t0 + 190, speed: () => 0 };
    // speed profile depends on position: easier to hand-roll
    const out: Pt[] = [];
    for (let t = t0; t <= t0 + 190; t += 2) {
      if (sPos < 0 || sPos > Lf) break;
      const a = pointAt(FERRY, sPos);
      const toEnd = Math.min(sPos, Lf - sPos);
      const v = 4 + Math.min(1, toEnd / 8) * 10.5;
      if (t >= 0) out.push({ t, x: a.x, y: a.y, sog: v + gauss(r) * 0.15, cog: 0, hdg: 0 });
      sPos += dir * kn2kmmin(v) * 2;
    }
    void pts; void sp;
    fixCog(out, r);
    V.push(mk("ferry", "BORNHOLM FERRY " + (k + 1), "Scheduled ferry (decelerates into port)", out));
  }
  // trawlers in the fishing ground (slow, turning, over cables)
  const nF = 6 + Math.floor(r() * 4);
  for (let i = 0; i < nF; i++) {
    const out = trawl(r, FISHING.x0 + r() * (FISHING.x1 - FISHING.x0), FISHING.y0 + r() * (FISHING.y1 - FISHING.y0), 200 + r() * 600, 400 + r() * 500, true);
    V.push(mk("fishing", "FV " + nm().split(" ")[0], "Trawling in fishing ground", out));
  }
  if (r() < 0.5) V.push(mk("fishing", "FV STRAY", "Trawling outside the usual ground, over C2", trawl(r, 124, 78 + r() * 15, 300 + r() * 500, 120, false)));
  // anchored waiters
  const nA = 5 + Math.floor(r() * 3);
  for (let i = 0; i < nA; i++) {
    const a = r() * 6.28;
    const rr = r() * ANCHORAGE.r;
    const x = ANCHORAGE.x + Math.cos(a) * rr;
    const y = ANCHORAGE.y + Math.sin(a) * rr;
    const out: Pt[] = [];
    for (let t = 0; t <= 1440; t += 2) out.push({ t, x: x + Math.sin(t / 60 + i) * 0.15, y: y + Math.cos(t / 70 + i) * 0.15, sog: 0.2 + r() * 0.2, cog: 0, hdg: (t / 4 + i * 40) % 360 });
    V.push(mk(r() < 0.5 ? "tanker" : "cargo", nm(), "Waiting at anchorage", out));
  }
  // anchored on the pipeline corridor (stationary, not dragging)
  const out: Pt[] = [];
  for (let t = 0; t <= 1440; t += 2) out.push({ t, x: 80 + Math.sin(t / 80) * 0.1, y: 32 + Math.cos(t / 90) * 0.1, sog: 0.2 + r() * 0.15, cog: 0, hdg: 200 + Math.sin(t / 50) * 30 });
  V.push(mk("cargo", "HOLM ANCHOR", "Stationary at anchor on C3 corridor", out));

  if (planted) {
    // Samus Swan ANALOGUE: tanker on L1 passes C1 at 05:17 UTC; from 20 min earlier speed drops, heading ≠ course, lateral drift.
    const lane = LANES[0];
    const sCross = closestS(lane.poly, CABLES[0].poly);
    const onset = INCIDENT_T - 20;
    const speed = (t: number) => (t < onset ? 11.6 : 11.6 - clamp((t - onset) / 20, 0, 1) * 2.1);
    const lat = (t: number) => (t < onset ? 0.3 : 0.3 + clamp((t - onset) / 20, 0, 1) * 2.2);
    const hdgOff = (t: number) => (t < onset ? 0 : clamp((t - onset) / 8, 0, 1) * 14);
    // integrate distance from t0 to INCIDENT_T to place start
    const tStart = 150;
    let dist = 0;
    for (let t = tStart; t < INCIDENT_T + 1; t += 2) dist += kn2kmmin(speed(t)) * 2;
    // vessel travels west (dir = -1): starts east of the crossing point
    const sStart = sCross + dist;
    V.push(mk("tanker", "SAMUS-ANALOGUE", "PLANTED: anchor-drag analogue (synthetic)", follow({ poly: lane.poly, s0: sStart, dir: -1, t0: tStart, t1: 800, speed, lat, hdgOff }, r)));
  }
  return V;
}

function trawl(r: () => number, x: number, y: number, t0: number, dur: number, bound: boolean): Pt[] {
  const out: Pt[] = [];
  let hd = r() * 360;
  let nextTurn = t0 + 40 + r() * 40;
  for (let t = t0; t <= t0 + dur; t += 2) {
    if (t >= nextTurn) { hd += 130 + r() * 50; nextTurn = t + 40 + r() * 40; }
    const v = 3.1 + gauss(r) * 0.25;
    const rad = (hd * Math.PI) / 180;
    x += Math.sin(rad) * kn2kmmin(v) * 2;
    y += Math.cos(rad) * kn2kmmin(v) * 2;
    if (bound) {
      if (x < FISHING.x0 || x > FISHING.x1) { hd = 360 - hd; x = clamp(x, FISHING.x0, FISHING.x1); }
      if (y < FISHING.y0 || y > FISHING.y1) { hd = 180 - hd; y = clamp(y, FISHING.y0, FISHING.y1); }
    }
    if (t >= 0 && t <= 1440) out.push({ t, x, y, sog: v, cog: 0, hdg: 0 });
  }
  fixCog(out, r);
  return out;
}

// ───────── learn "normal": median on-lane speed per class from training days
export type Baseline = Record<Cls, number>;
export function learnBaseline(days: string[]): Baseline {
  const bucket: Record<Cls, number[]> = { tanker: [], cargo: [], ferry: [], fishing: [] };
  for (const d of days)
    for (const v of genDay(d, false))
      for (const p of v.pts) {
        const onLane = LANES.some((l) => distToPoly(p.x, p.y, l.poly).d < 3);
        if ((onLane || v.cls === "fishing") && p.sog > 2.5) bucket[v.cls].push(p.sog);
      }
  const med = (a: number[], f: number) => (a.length ? a.sort((x, y) => x - y)[Math.floor(a.length / 2)] : f);
  return { tanker: med(bucket.tanker, 11.8), cargo: med(bucket.cargo, 10.8), ferry: med(bucket.ferry, 12), fishing: med(bucket.fishing, 3.1) };
}

// ───────── detector
export interface Config { thr: number; cueDelta: number; windowMin: number; corridorKm: number; lookaheadMin: number }
export const DEFAULT_CONFIG: Config = { thr: 3.0, cueDelta: 1.2, windowMin: 15, corridorKm: 2.5, lookaheadMin: 15 };
export type Tier = "watch" | "review" | "cue";
export interface Feats { cross: number; speed: number; base: number; deficit: number; hdgDiv: number; laneDev: number; dwell: number; gap: number; cable: string; adj: number }
export interface Episode {
  id: string; vessel: Vessel; tier: Tier; tStart: number; tFirst: number; tEnd: number; peak: number; peakT: number;
  feats: Feats; reason: string; x: number; y: number; truth: string;
}
const inFishing = (x: number, y: number) => x >= FISHING.x0 && x <= FISHING.x1 && y >= FISHING.y0 && y <= FISHING.y1;

function scoreAt(v: Vessel, i: number, base: Baseline, c: Config): { s: number; f: Feats } | null {
  const pts = v.pts;
  const p = pts[i];
  const win: Pt[] = [];
  for (let j = i; j >= 0 && pts[j].t >= p.t - c.windowMin; j--) win.push(pts[j]);
  if (win.length < 5) return null;
  const speed = win.reduce((a, q) => a + q.sog, 0) / win.length;
  if (speed < 1.0) return null; // stationary / anchored ≠ dragging
  const hdgDiv = win.reduce((a, q) => a + angDiff(q.hdg, q.cog), 0) / win.length;
  const now = distToPoly(p.x, p.y, nearestCableOf(p.x, p.y).poly);
  const ahead = (kn2kmmin(p.sog) * c.lookaheadMin);
  const px = p.x + Math.sin((p.cog * Math.PI) / 180) * ahead;
  const py = p.y + Math.cos((p.cog * Math.PI) / 180) * ahead;
  const nc2 = nearestCableOf(px, py);
  const fut = distToPoly(px, py, nc2.poly);
  const nearNow = now.d <= c.corridorKm;
  const nearAhead = fut.d <= c.corridorKm;
  if (!nearNow && !nearAhead) return null;
  const cab = nearNow ? nearestCableOf(p.x, p.y) : nc2;
  const brg = nearNow ? now.brg : fut.brg;
  const cross = acute(p.cog, brg);
  const dl = Math.min(...LANES.map((l) => distToPoly(p.x, p.y, l.poly).d));
  const laneDev = v.cls === "tanker" || v.cls === "cargo" ? dl : 0;
  // speed deficit: recent speed (last ~8 min) vs BOTH the class norm on lanes AND the vessel's own earlier speed.
  // A slow-steamer is slow all along (own history = slow) and so is not penalised; a ship that slows down is.
  const recent = win.filter((q) => q.t >= p.t - 8);
  const speedNow = recent.reduce((a, q) => a + q.sog, 0) / recent.length;
  const prior = pts.filter((q) => q.t >= p.t - 120 && q.t <= p.t - 30);
  const ownPrev = prior.length >= 5 ? prior.reduce((a, q) => a + q.sog, 0) / prior.length : base[v.cls];
  const ref = Math.min(base[v.cls], ownPrev);
  const deficit = dl < 8 && (v.cls === "tanker" || v.cls === "cargo") ? Math.max(0, ref - speedNow) : 0;
  const dwell = win.filter((q) => distToPoly(q.x, q.y, cab.poly).d <= c.corridorKm).length * 2;
  let gap = 0;
  for (let k = 1; k < win.length; k++) if (win[k - 1].t - win[k].t > 12) gap = Math.max(gap, win[k - 1].t - win[k].t);
  let adj = 0;
  if (v.cls === "ferry") adj -= 3;
  if (v.cls === "fishing" && inFishing(p.x, p.y)) adj -= 2.5;
  const s = 0.8 * clamp(cross / 60, 0, 1) + 1.6 * clamp(deficit / 4, 0, 1) + 1.6 * clamp(hdgDiv / 12, 0, 1) + 1.0 * clamp(laneDev / 3, 0, 1) + 0.6 * clamp(dwell / 20, 0, 1) + (gap ? 1 : 0) + adj;
  return { s, f: { cross, speed, base: base[v.cls], deficit, hdgDiv, laneDev, dwell, gap, cable: cab.id, adj } };
}
function nearestCableOf(x: number, y: number) {
  let best = CABLES[0];
  let bd = 1e9;
  for (const c of CABLES) {
    const d = distToPoly(x, y, c.poly).d;
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

export function reasonText(v: Vessel, f: Feats, tier: Tier): string {
  const parts: string[] = [`${v.cls} crossed/approached ${f.cable} at ${f.cross.toFixed(0)}°`];
  if (f.deficit > 0.8) parts.push(`speed ${f.speed.toFixed(1)} kn vs ${f.base.toFixed(1)} kn typical for ${v.cls}s on this lane`);
  if (f.hdgDiv > 5) parts.push(`heading differs from course by ${f.hdgDiv.toFixed(0)}°`);
  if (f.laneDev > 1) parts.push(`${f.laneDev.toFixed(1)} km off lane centre`);
  if (f.gap) parts.push(`AIS silent for ${f.gap.toFixed(0)} min (blind time)`);
  return `${parts.join("; ")}. ${tier === "cue" ? "Several independent context features agree." : "Some features agree, others do not."} Behaviour to verify – not an attribution.`;
}

export function detect(vessels: Vessel[], base: Baseline, c: Config): Episode[] {
  const eps: Episode[] = [];
  for (const v of vessels) {
    let cur: { tStart: number; tFirst: number; tEnd: number; peak: number; peakT: number; f: Feats; i: number } | null = null;
    const close = () => {
      if (!cur) return;
      const tier: Tier = cur.peak >= c.thr + c.cueDelta ? "cue" : "review";
      const pk = v.pts[cur.i];
      eps.push({ id: `${v.id}-${Math.round(cur.tFirst)}`, vessel: v, tier, tStart: cur.tStart, tFirst: cur.tFirst, tEnd: cur.tEnd, peak: cur.peak, peakT: cur.peakT, feats: cur.f, reason: reasonText(v, cur.f, tier), x: pk.x, y: pk.y, truth: v.truth });
      cur = null;
    };
    for (let i = 0; i < v.pts.length; i++) {
      const r = scoreAt(v, i, base, c);
      const t = v.pts[i].t;
      if (r && r.s >= c.thr) {
        if (cur && t - cur.tEnd > 20) close();
        if (!cur) cur = { tStart: t, tFirst: t, tEnd: t, peak: r.s, peakT: t, f: r.f, i };
        cur.tEnd = t;
        if (r.s > cur.peak) { cur.peak = r.s; cur.peakT = t; cur.f = r.f; cur.i = i; }
      } else if (cur && t - cur.tEnd > 20) close();
    }
    close();
  }
  return eps.sort((a, b) => b.peak - a.peak);
}

// speed-only baseline: 1 kn < 30-min mean speed < 6 kn, anywhere in AOI
export function speedOnly(vessels: Vessel[]): { id: string; vessel: Vessel; tFirst: number }[] {
  const out: { id: string; vessel: Vessel; tFirst: number }[] = [];
  for (const v of vessels) {
    let last = -999;
    let open = false;
    for (let i = 0; i < v.pts.length; i++) {
      const p = v.pts[i];
      const win = v.pts.filter((q, j) => j <= i && q.t >= p.t - 30);
      if (win.length < 8) continue;
      const m = win.reduce((a, q) => a + q.sog, 0) / win.length;
      const hit = m > 1 && m < 6;
      if (hit) {
        if (!open || p.t - last > 20) out.push({ id: `${v.id}-${p.t}`, vessel: v, tFirst: p.t });
        open = true;
        last = p.t;
      } else if (p.t - last > 20) open = false;
    }
  }
  return out;
}

export const fmtT = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(Math.floor(m % 60)).padStart(2, "0")}`;
export const configHash = (c: Config) => (hashStr(JSON.stringify(c)) >>> 0).toString(16).padStart(8, "0");

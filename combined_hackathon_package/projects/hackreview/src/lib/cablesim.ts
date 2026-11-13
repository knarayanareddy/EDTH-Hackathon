// Synthetic vessel tracks + interpretable scoring for the CableWatch preview.
// Map units are km (x east, y south). All tracks are SYNTHETIC.

export const KN = (0.514444 * 60) / 1000; // km per minute per knot
export type Cls = "cargo" | "tanker" | "fishing" | "passenger";
export type Pt = { x: number; y: number; sog: number; hdg: number };
export interface Vessel {
  id: string;
  name: string;
  cls: Cls;
  note: string;
  pts: Pt[];
}

export const MAP_W = 120;
export const MAP_H = 60;
export const NOW = 180;
export const CORRIDOR_KM = 2.5;

export const CABLE: [number, number][] = [
  [4, 38],
  [40, 34],
  [75, 26],
  [116, 14],
];

type Rect = { x0: number; y0: number; x1: number; y1: number };
export const ZONES: Record<"anchorage" | "fishing" | "port", Rect & { label: string }> = {
  anchorage: { x0: 18, y0: 36, x1: 34, y1: 46, label: "Anchorage" },
  fishing: { x0: 50, y0: 27, x1: 70, y1: 43, label: "Trawling ground" },
  port: { x0: 100, y0: 6, x1: 118, y1: 20, label: "Port approach" },
};

export const ISR_BASE = { x: 70, y: 54 };
export const ISR_SPEED_KM_MIN = 1.5; // 25 m/s
export const ISR_ENDURANCE_MIN = 60;

const inRect = (p: { x: number; y: number }, r: Rect) => p.x >= r.x0 && p.x <= r.x1 && p.y >= r.y0 && p.y <= r.y1;

function distSeg(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
export function distToCable(p: { x: number; y: number }) {
  let m = Infinity;
  for (let i = 0; i < CABLE.length - 1; i++) {
    m = Math.min(m, distSeg(p.x, p.y, CABLE[i][0], CABLE[i][1], CABLE[i + 1][0], CABLE[i + 1][1]));
  }
  return m;
}

function integrate(start: { x: number; y: number }, hdg: (t: number) => number, sog: (t: number) => number): Pt[] {
  const pts: Pt[] = [];
  let x = start.x;
  let y = start.y;
  for (let t = 0; t <= NOW; t++) {
    const h = hdg(t);
    const s = sog(t);
    pts.push({ x, y, sog: s, hdg: ((h % 360) + 360) % 360 });
    const r = (h * Math.PI) / 180;
    x += Math.sin(r) * s * KN;
    y -= Math.cos(r) * s * KN;
  }
  return pts;
}

function alignAt(pts: Pt[], t: number, target: { x: number; y: number }): Pt[] {
  const dx = target.x - pts[t].x;
  const dy = target.y - pts[t].y;
  return pts.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy }));
}

function ferry(): Pt[] {
  const A = { x: 40, y: 52 };
  const B = { x: 112, y: 14 };
  const L = Math.hypot(B.x - A.x, B.y - A.y);
  const ux = (B.x - A.x) / L;
  const uy = (B.y - A.y) / L;
  const hdg = (Math.atan2(ux, -uy) * 180) / Math.PI;
  const pts: Pt[] = [];
  let s = 0;
  for (let t = 0; t <= NOW; t++) {
    const v = s < L - 20 ? 18 : Math.max(4, 18 - (14 * (s - (L - 20))) / 17);
    pts.push({ x: A.x + ux * Math.min(s, L), y: A.y + uy * Math.min(s, L), sog: v, hdg });
    s += v * KN;
  }
  return pts;
}

function trawler(): Pt[] {
  const pts: Pt[] = [];
  let x = 60;
  let y = 30.2;
  let dir = 1;
  for (let t = 0; t <= NOW; t++) {
    pts.push({ x, y, sog: 3.2, hdg: dir > 0 ? 90 : 270 });
    x += dir * 3.2 * KN;
    if (x > 68 || x < 52) {
      dir = -dir;
      y += 1.5;
    }
  }
  return pts;
}

export function buildVessels(): Vessel[] {
  const tanker = integrate({ x: 84, y: -32.2 }, () => 180, () => 12);

  const anchored: Pt[] = [];
  for (let t = 0; t <= NOW; t++) {
    anchored.push({
      x: 26 + 0.35 * Math.cos(t / 25),
      y: 37.2 + 0.35 * Math.sin(t / 25),
      sog: 0.3,
      hdg: 120 + 40 * Math.sin(t / 18),
    });
  }

  const drag = alignAt(
    integrate(
      { x: 0, y: 0 },
      (t) => 20 + (t > 110 ? 0.25 * (t - 110) : 0),
      (t) => (t < 105 ? 11 : t < 125 ? 11 - (7 * (t - 105)) / 20 : 4),
    ),
    130,
    { x: 46, y: 33.4 },
  );

  const samus = alignAt(
    integrate(
      { x: 0, y: 0 },
      (t) => 350 + (t > 125 ? 0.2 * (t - 125) : 0),
      (t) => (t < 130 ? 10 : 10 - (2.5 * (t - 130)) / 50),
    ),
    165,
    { x: 76, y: 25.6 },
  );

  return [
    { id: "V1", name: "NORDIC ARROW", cls: "tanker", note: "Southbound in the traffic lane at a steady 12 kn, crossing the cable.", pts: tanker },
    { id: "V2", name: "FV HAVFRUE", cls: "fishing", note: "Trawler working the trawling ground at ~3 kn, back and forth over the cable.", pts: trawler() },
    { id: "V3", name: "BALTIC MERIT", cls: "cargo", note: "Cargo ship at anchor in the anchorage, swinging slightly.", pts: anchored },
    { id: "V4", name: "MS BORNHOLM EXPRESS", cls: "passenger", note: "Ferry decelerating from 18 kn into the port approach.", pts: ferry() },
    { id: "V5", name: "SEA ORCHID", cls: "cargo", note: "Leaves cruising speed, drops to 4 kn, straight track, slowly drifting course, over the cable, outside any known context.", pts: drag },
    { id: "V6", name: "SAMUS-LIKE (hard case)", cls: "tanker", note: "Speed only falls from 10 to 7.5 kn with ~6° course drift while crossing the cable. Modelled loosely on the public account of the 2022 Bornholm event, not real data.", pts: samus },
  ];
}

const median = (a: number[]) => {
  const s = [...a].sort((p, q) => p - q);
  return s[Math.floor(s.length / 2)];
};
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
function angDiff(a: number, b: number) {
  return Math.abs(((a - b + 540) % 360) - 180);
}
function meanHdg(h: number[]) {
  let sx = 0;
  let sy = 0;
  for (const v of h) {
    sx += Math.sin((v * Math.PI) / 180);
    sy += Math.cos((v * Math.PI) / 180);
  }
  return ((Math.atan2(sx, sy) * 180) / Math.PI + 360) % 360;
}

export interface Features {
  sogPrior: number;
  sogNow: number;
  dropFrac: number;
  corridorMin: number;
  driftDeg: number;
  straight: number;
  context: "none" | "anchorage" | "fishing" | "port";
  suppress: number;
}
export interface Scored {
  vessel: Vessel;
  f: Features;
  parts: { name: string; value: number; weight: number; contrib: number; text: string }[];
  raw: number;
  score: number;
  reason: string;
  speedOnlyAlert: boolean;
}

export function scoreVessel(v: Vessel, useContext: boolean): Scored {
  const cur = v.pts.slice(NOW - 60, NOW + 1);
  const prior = v.pts.slice(NOW - 120, NOW - 60);
  const last30 = v.pts.slice(NOW - 30, NOW + 1);

  const sogNow = median(cur.map((p) => p.sog));
  const sogPrior = median(prior.map((p) => p.sog));
  const dropFrac = sogPrior > 0 ? Math.max(0, (sogPrior - sogNow) / sogPrior) : 0;
  const corridorMin = cur.filter((p) => distToCable(p) <= CORRIDOR_KM).length;

  let path = 0;
  for (let i = 1; i < last30.length; i++) path += Math.hypot(last30[i].x - last30[i - 1].x, last30[i].y - last30[i - 1].y);
  const net = Math.hypot(last30[last30.length - 1].x - last30[0].x, last30[last30.length - 1].y - last30[0].y);
  const straight = path > 0 ? net / path : 0;

  const hd = angDiff(meanHdg(cur.map((p) => p.hdg)), meanHdg(prior.map((p) => p.hdg)));
  const driftDeg = straight > 0.9 && hd <= 30 ? hd : 0;

  const stationary = sogNow < 0.8;
  const sSpeed = stationary ? 0 : clamp01(dropFrac / 0.5);
  const sCable = clamp01(corridorMin / 30);
  const sDrift = clamp01((driftDeg - 2) / 12);
  const sStraight = clamp01((straight - 0.9) / 0.1);

  const inFrac = (r: Rect) => cur.filter((p) => inRect(p, r)).length / cur.length;
  let context: Features["context"] = "none";
  let suppress = 0;
  if (inFrac(ZONES.anchorage) > 0.6) {
    context = "anchorage";
    suppress = 0.8;
  } else if (v.cls === "fishing" && inFrac(ZONES.fishing) > 0.6) {
    context = "fishing";
    suppress = 0.75;
  } else if (inFrac(ZONES.port) > 0.3) {
    context = "port";
    suppress = 0.6;
  }
  if (!useContext) suppress = 0;

  const parts = [
    { name: "Speed fell vs own baseline", value: sSpeed, weight: 0.3, text: stationary ? "stationary, which is not dragging" : `${sogPrior.toFixed(1)} → ${sogNow.toFixed(1)} kn (−${Math.round(dropFrac * 100)}%)` },
    { name: "Time over cable corridor", value: sCable, weight: 0.3, text: `${corridorMin} of 60 min within ${CORRIDOR_KM} km` },
    { name: "Course drift on a straight track", value: sDrift, weight: 0.25, text: `${driftDeg.toFixed(0)}° change, straightness ${(straight * 100).toFixed(0)}%` },
    { name: "Steady, straight motion", value: sStraight, weight: 0.15, text: `${(straight * 100).toFixed(0)}% straight over 30 min` },
  ].map((p) => ({ ...p, contrib: p.value * p.weight }));

  const raw = parts.reduce((s, p) => s + p.contrib, 0);
  const score = raw * (1 - suppress);

  const ctxText =
    context === "none"
      ? "no known anchorage, trawling or port context explains it"
      : `context discount: ${context}${useContext ? "" : " (disabled)"}`;
  const reason = `${parts[0].text}; ${parts[1].text}; ${parts[2].text}; ${ctxText}.`;

  const speedOnlyAlert = sogNow >= 1 && sogNow <= 6 && corridorMin > 0;

  return { vessel: v, f: { sogPrior, sogNow, dropFrac, corridorMin, driftDeg, straight, context, suppress }, parts, raw, score, reason, speedOnlyAlert };
}

export interface IsrRow {
  s: Scored;
  distKm: number;
  onStationMin: number;
  reachable: boolean;
  priority: number;
}

export function isrPlan(alerts: Scored[]): IsrRow[] {
  return alerts
    .map((s) => {
      const p = s.vessel.pts[NOW];
      const distKm = Math.hypot(p.x - ISR_BASE.x, p.y - ISR_BASE.y);
      const onStationMin = ISR_ENDURANCE_MIN - (2 * distKm) / ISR_SPEED_KM_MIN;
      const reachable = onStationMin >= 3;
      const priority = reachable ? s.score * Math.min(1, onStationMin / 15) : 0;
      return { s, distKm, onStationMin, reachable, priority };
    })
    .sort((a, b) => b.priority - a.priority);
}

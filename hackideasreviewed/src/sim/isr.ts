// ISR cueing as a small orienteering problem WITH moving targets and a hard return-to-base check.
// One platform, 25 m/s = 1.5 km/min, 60 min endurance → 90 km of total path.
import { BASE, type Episode, type Pt } from "./ais";

export const SPEED_KM_MIN = 1.5;
export const DEFAULT_ENDURANCE = 60;
export const DWELL_MIN = 4;

export interface Cand { ep: Episode; x: number; y: number; vx: number; vy: number; value: number; ageMin: number }
export interface Leg { cand: Cand; tArrive: number; tLeave: number; fromX: number; fromY: number; toX: number; toY: number; km: number }
export interface Plan { legs: Leg[]; value: number; used: number; returnKm: number; margin: number; dropped: { cand: Cand; why: string }[]; path: [number, number][] }

function stateAt(pts: Pt[], now: number) {
  let i = pts.length - 1;
  while (i > 0 && pts[i].t > now) i--;
  const a = pts[Math.max(0, i - 4)];
  const b = pts[i];
  const dt = Math.max(1, b.t - a.t);
  return { x: b.x, y: b.y, vx: (b.x - a.x) / dt, vy: (b.y - a.y) / dt, last: b.t };
}

export function candidates(eps: Episode[], now: number): Cand[] {
  return eps
    .filter((e) => e.tFirst <= now && e.vessel.pts.some((p) => p.t <= now) && now - e.tEnd < 90)
    .map((e) => {
      const s = stateAt(e.vessel.pts, now);
      const age = Math.max(0, now - s.last); // staleness of the last AIS fix
      const x = s.x + s.vx * age; // extrapolated to "now" – uncertainty grows with age
      const y = s.y + s.vy * age;
      const tierW = e.tier === "cue" ? 1.6 : 1;
      const value = e.peak * tierW * (1 / (1 + age / 30));
      return { ep: e, x, y, vx: s.vx, vy: s.vy, value, ageMin: age };
    });
}

// Minutes for a platform at (ax,ay) to catch a target at (px,py) moving (vx,vy). null if impossible.
function intercept(ax: number, ay: number, px: number, py: number, vx: number, vy: number) {
  const rx = px - ax;
  const ry = py - ay;
  const c = SPEED_KM_MIN;
  const a = vx * vx + vy * vy - c * c;
  const b = 2 * (rx * vx + ry * vy);
  const k = rx * rx + ry * ry;
  if (Math.abs(a) < 1e-9) return b < 0 ? -k / b : null;
  const disc = b * b - 4 * a * k;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  const t1 = (-b - s) / (2 * a);
  const t2 = (-b + s) / (2 * a);
  const ts = [t1, t2].filter((t) => t >= 0).sort((p, q) => p - q);
  return ts.length ? ts[0] : null;
}

export function plan(cands: Cand[], endurance = DEFAULT_ENDURANCE, maxCands = 8): Plan {
  const list = [...cands].sort((a, b) => b.value - a.value).slice(0, maxCands);
  let best: Leg[] = [];
  let bestVal = -1;
  let bestUsed = 0;

  const dfs = (legs: Leg[], used: Set<number>, t: number, ax: number, ay: number, val: number) => {
    // option: stop here and return home
    const retKm = Math.hypot(ax - BASE.x, ay - BASE.y);
    const tHome = t + retKm / SPEED_KM_MIN;
    if (tHome <= endurance && (val > bestVal + 1e-9 || (Math.abs(val - bestVal) < 1e-9 && tHome < bestUsed))) {
      best = legs;
      bestVal = val;
      bestUsed = tHome;
    }
    list.forEach((c, i) => {
      if (used.has(i)) return;
      // target position after t minutes
      const px = c.x + c.vx * t;
      const py = c.y + c.vy * t;
      const d = intercept(ax, ay, px, py, c.vx, c.vy);
      if (d === null) return;
      const arrive = t + d;
      const leave = arrive + DWELL_MIN;
      const ex = c.x + c.vx * leave;
      const ey = c.y + c.vy * leave;
      const back = Math.hypot(ex - BASE.x, ey - BASE.y) / SPEED_KM_MIN;
      if (leave + back > endurance) return;
      const tx = c.x + c.vx * arrive;
      const ty = c.y + c.vy * arrive;
      const leg: Leg = { cand: c, tArrive: arrive, tLeave: leave, fromX: ax, fromY: ay, toX: tx, toY: ty, km: Math.hypot(tx - ax, ty - ay) };
      const nu = new Set(used);
      nu.add(i);
      dfs([...legs, leg], nu, leave, ex, ey, val + c.value);
    });
  };
  dfs([], new Set(), 0, BASE.x, BASE.y, 0);

  const chosen = new Set(best.map((l) => l.cand.ep.id));
  const last = best[best.length - 1];
  const endX = last ? last.cand.x + last.cand.vx * last.tLeave : BASE.x;
  const endY = last ? last.cand.y + last.cand.vy * last.tLeave : BASE.y;
  const returnKm = Math.hypot(endX - BASE.x, endY - BASE.y);
  const used = bestVal < 0 ? 0 : bestUsed;
  const dropped = cands
    .filter((c) => !chosen.has(c.ep.id))
    .map((c) => {
      const d0 = intercept(BASE.x, BASE.y, c.x, c.y, c.vx, c.vy);
      const alone = d0 !== null && d0 + DWELL_MIN + Math.hypot(c.x + c.vx * (d0 + DWELL_MIN) - BASE.x, c.y + c.vy * (d0 + DWELL_MIN) - BASE.y) / SPEED_KM_MIN <= endurance;
      return { cand: c, why: !alone ? "cannot be reached and recovered within endurance" : "lower value than the chosen set for the remaining time budget" };
    });
  const path: [number, number][] = [[BASE.x, BASE.y]];
  best.forEach((l) => path.push([l.toX, l.toY]));
  path.push([endX, endY], [BASE.x, BASE.y]);
  return { legs: best, value: Math.max(0, bestVal), used, returnKm, margin: endurance - used, dropped, path };
}

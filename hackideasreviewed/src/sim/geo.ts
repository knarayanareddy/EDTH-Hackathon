// Click-to-ground geolocation with sampled (not linearised) error propagation, validated against a
// simulated TRUTH world that contains errors the estimator does NOT model.
import { gauss, mulberry32 } from "../utils/rng";

export const IMG_W = 640;
export const IMG_H = 360;
const D2R = Math.PI / 180;

export interface Pose { h: number; pitch: number; hdg: number; roll: number; fov: number; gx: number; gy: number; terr: number }
export interface Sigmas {
  h: number; pitch: number; hdg: number; roll: number; gnss: number; ageS: number; speed: number; px: number; terrain: number;
}
export interface Inputs { // trust inputs that change sigmas
  telemetryAge: number; // s
  gnssLevel: 0 | 1 | 2 | 3; // interference level from OSINT layer
  gnssLayerAgeMin: number; // staleness of that layer
  dem: boolean;
}
export const GNSS_MULT = [1, 3, 8, 25];

export function sigmasFrom(i: Inputs): { s: Sigmas; effLevel: number; stale: boolean } {
  const stale = i.gnssLayerAgeMin > 60;
  const effLevel = stale ? Math.max(1, i.gnssLevel) : i.gnssLevel; // stale layer ⇒ do NOT assume clean air
  return {
    s: { h: 3, pitch: 0.5 * D2R, hdg: 1.0 * D2R, roll: 0.3 * D2R, gnss: 2.5 * GNSS_MULT[effLevel], ageS: i.telemetryAge, speed: 15, px: 2.5, terrain: i.dem ? 1.5 : 4 },
    effLevel,
    stale,
  };
}

const focal = (fov: number) => IMG_W / 2 / Math.tan((fov * D2R) / 2);

function basis(p: Pose) {
  const ps = p.pitch * D2R, hd = p.hdg * D2R;
  const f = [Math.sin(hd) * Math.cos(ps), Math.cos(hd) * Math.cos(ps), -Math.sin(ps)];
  const r = [Math.cos(hd), -Math.sin(hd), 0];
  const u = [Math.sin(hd) * Math.sin(ps), Math.cos(hd) * Math.sin(ps), Math.cos(ps)];
  return { f, r, u };
}

export function backproject(u: number, v: number, p: Pose): [number, number] | null {
  const F = focal(p.fov);
  const a0 = (u - IMG_W / 2) / F, b0 = (v - IMG_H / 2) / F;
  const rl = p.roll * D2R;
  const a = a0 * Math.cos(rl) - b0 * Math.sin(rl);
  const b = a0 * Math.sin(rl) + b0 * Math.cos(rl);
  const { f, r, u: up } = basis(p);
  const d = [f[0] + a * r[0] - b * up[0], f[1] + a * r[1] - b * up[1], f[2] + a * r[2] - b * up[2]];
  if (d[2] >= -1e-4) return null;
  const t = (p.h - p.terr) / -d[2];
  if (t * Math.hypot(d[0], d[1]) > 3000) return null;
  return [p.gx + t * d[0], p.gy + t * d[1]];
}

export function project(T: [number, number], p: Pose): [number, number] | null {
  const w = [T[0] - p.gx, T[1] - p.gy, p.terr - p.h];
  const { f, r, u } = basis(p);
  const df = w[0] * f[0] + w[1] * f[1] + w[2] * f[2];
  if (df <= 1) return null;
  const a = (w[0] * r[0] + w[1] * r[1] + w[2] * r[2]) / df;
  const b = -(w[0] * u[0] + w[1] * u[1] + w[2] * u[2]) / df;
  const rl = p.roll * D2R;
  const a0 = a * Math.cos(rl) + b * Math.sin(rl);
  const b0 = -a * Math.sin(rl) + b * Math.cos(rl);
  const F = focal(p.fov);
  return [IMG_W / 2 + F * a0, IMG_H / 2 + F * b0];
}

export type Source = "Altitude" | "Gimbal pitch" | "Heading" | "Roll" | "GNSS position" | "Telemetry age" | "Click (pixels)" | "Terrain relief";
export const SOURCES: Source[] = ["Altitude", "Gimbal pitch", "Heading", "Roll", "GNSS position", "Telemetry age", "Click (pixels)", "Terrain relief"];

export interface Unmodelled { on: boolean }
// Draw one "true world" perturbation of the nominal pose. `only` restricts to one source. `extra` adds unmodelled effects.
function perturb(nom: Pose, s: Sigmas, r: () => number, only: Source | null, extra: boolean): { pose: Pose; dpx: [number, number] } {
  const on = (k: Source) => only === null || only === k;
  const p: Pose = { ...nom };
  if (on("Altitude")) p.h += gauss(r) * s.h;
  if (on("Gimbal pitch")) p.pitch += (gauss(r) * s.pitch) / D2R;
  if (on("Heading")) p.hdg += (gauss(r) * s.hdg) / D2R;
  if (on("Roll")) p.roll += (gauss(r) * s.roll) / D2R;
  if (on("GNSS position")) { p.gx += gauss(r) * s.gnss; p.gy += gauss(r) * s.gnss; }
  if (on("Telemetry age")) { // pose is stale: drone has moved ahead along its heading
    const d = s.speed * s.ageS * (0.6 + 0.4 * r());
    p.gx += Math.sin(nom.hdg * D2R) * d; p.gy += Math.cos(nom.hdg * D2R) * d;
  }
  if (on("Terrain relief")) p.terr += gauss(r) * s.terrain;
  if (extra && only === null) { // NOT in the estimator's model
    p.fov *= 1 + gauss(r) * 0.015; // lens scale / intrinsics error
    p.hdg += gauss(r) * 0.8 + 0.5; // magnetometer bias
    p.roll += 0.6; // roll bias
    p.terr += gauss(r) * 2.5; // relief/slope not in the model
  }
  const dpx: [number, number] = on("Click (pixels)") ? [gauss(r) * s.px, gauss(r) * s.px] : [0, 0];
  return { pose: p, dpx };
}

export interface Ellipse { cx: number; cy: number; a: number; b: number; angDeg: number; along: number; cross: number; dropped: number; var1: number }

function cov2(xs: number[], ys: number[]) {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let cxx = 0, cxy = 0, cyy = 0;
  for (let i = 0; i < n; i++) { const dx = xs[i] - mx, dy = ys[i] - my; cxx += dx * dx; cxy += dx * dy; cyy += dy * dy; }
  return { cxx: cxx / n, cxy: cxy / n, cyy: cyy / n, mx, my };
}

/** For a clicked pixel under the nominal pose, estimate the ground point and its 95% ellipse by sampling the modelled errors. */
export function estimate(u: number, v: number, nom: Pose, s: Sigmas, N = 500, withShare = true): { est: [number, number]; ell: Ellipse; share: Record<Source, number> } | null {
  const est = backproject(u, v, nom);
  if (!est) return null;
  const run = (only: Source | null, n: number) => {
    const rnd = mulberry32(777);
    const xs: number[] = [], ys: number[] = [];
    let miss = 0;
    for (let i = 0; i < n; i++) {
      const { pose, dpx } = perturb(nom, s, rnd, only, false);
      const px = project(est, pose);
      if (!px) { miss++; continue; }
      const g = backproject(px[0] + dpx[0], px[1] + dpx[1], nom);
      if (!g) { miss++; continue; }
      xs.push(g[0] - est[0]); ys.push(g[1] - est[1]);
    }
    return { xs, ys, miss: miss / n };
  };
  const all = run(null, N);
  if (all.xs.length < 50) return null;
  const c = cov2(all.xs, all.ys);
  const tr = c.cxx + c.cyy, det = c.cxx * c.cyy - c.cxy * c.cxy;
  const disc = Math.sqrt(Math.max(0, (tr * tr) / 4 - det));
  const l1 = tr / 2 + disc, l2 = Math.max(1e-6, tr / 2 - disc);
  const ang = 0.5 * Math.atan2(2 * c.cxy, c.cxx - c.cyy);
  const k = Math.sqrt(5.991);
  const ux = Math.cos(ang), uy = Math.sin(ang);
  // along/cross range: project the ellipse onto the LOS direction (drone → target)
  const lx = est[0] - nom.gx, ly = est[1] - nom.gy, ll = Math.hypot(lx, ly) || 1;
  const nx = lx / ll, ny = ly / ll;
  const vAlong = nx * nx * c.cxx + 2 * nx * ny * c.cxy + ny * ny * c.cyy;
  const vCross = ny * ny * c.cxx - 2 * nx * ny * c.cxy + nx * nx * c.cyy;
  const share = {} as Record<Source, number>;
  let tot = 0;
  for (const src of withShare ? SOURCES : []) {
    const r = run(src, 220);
    const cv = cov2(r.xs.length > 5 ? r.xs : [0, 0, 0, 0, 0, 0], r.ys.length > 5 ? r.ys : [0, 0, 0, 0, 0, 0]);
    const vv = ux * ux * cv.cxx + 2 * ux * uy * cv.cxy + uy * uy * cv.cyy;
    share[src] = vv;
    tot += vv;
  }
  for (const src of SOURCES) share[src] = tot > 0 ? share[src] / tot : 0;
  return {
    est,
    ell: { cx: est[0] + c.mx, cy: est[1] + c.my, a: k * Math.sqrt(l1), b: k * Math.sqrt(l2), angDeg: (ang * 180) / Math.PI, along: k * Math.sqrt(vAlong), cross: k * Math.sqrt(vCross), dropped: all.miss, var1: l1 },
    share,
  };
}

/** One "reality": true pose = nominal + modelled AND unmodelled errors. Returns operator-visible pixel + the estimate they would get. */
export function realityDraw(T: [number, number], nom: Pose, s: Sigmas, seed: number, withUnmodelled: boolean) {
  const rnd = mulberry32(seed);
  const { pose, dpx } = perturb(nom, s, rnd, null, withUnmodelled);
  const px = project(T, pose);
  if (!px) return null;
  const clicked: [number, number] = [px[0] + dpx[0], px[1] + dpx[1]];
  const est = backproject(clicked[0], clicked[1], nom);
  return est ? { px: clicked, est } : null;
}

export function coverage(T: [number, number], nom: Pose, s: Sigmas, trials = 1500): { plain: number; inflated: number; model: number; n: number } | null {
  const e0 = project(T, nom);
  if (!e0) return null;
  const e = estimate(e0[0], e0[1], nom, s, 400);
  if (!e) return null;
  // covariance that the estimator reports (re-derive from ellipse axes)
  const ang = (e.ell.angDeg * Math.PI) / 180, k2 = 5.991;
  const l1 = (e.ell.a * e.ell.a) / k2, l2 = (e.ell.b * e.ell.b) / k2;
  const m2 = (dx: number, dy: number) => {
    const p1 = dx * Math.cos(ang) + dy * Math.sin(ang), p2 = -dx * Math.sin(ang) + dy * Math.cos(ang);
    return (p1 * p1) / l1 + (p2 * p2) / l2;
  };
  const run = (unm: boolean) => {
    let inP = 0, inI = 0, n = 0;
    for (let i = 0; i < trials; i++) {
      const r = realityDraw(T, nom, s, 9000 + i, unm);
      if (!r) continue;
      n++;
      // the reported ellipse is centred on the operator's estimate r.est; is the true point T inside it?
      const dd = m2(T[0] - r.est[0], T[1] - r.est[1]);
      if (dd <= k2) inP++;
      if (dd <= k2 * 1.35 * 1.35) inI++;
    }
    return { p: inP / Math.max(1, n), i: inI / Math.max(1, n), n };
  };
  const model = run(false);
  const real = run(true);
  return { plain: real.p, inflated: real.i, model: model.p, n: real.n };
}

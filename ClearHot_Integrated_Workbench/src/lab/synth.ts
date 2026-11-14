// SYNTHETIC scene generator with known clean ground truth. Results derived from these scenes are
// synthetic-only and say nothing about real sensor data.

import { boxFilter } from "./dsp";
import type { Roi } from "./roi";

export interface ScenarioSpec {
  id: string;
  name: string;
  animalDelta: number; // ADU above local background
  bridgeDelta: number;
  noiseSigma: number;
  colStripeSigma: number;
  rowStripeSigma: number;
  fullHeightLine: boolean;
}

export const SCENARIOS: ScenarioSpec[] = [
  { id: "clean", name: "No stripes (false-correction test)", animalDelta: 350, bridgeDelta: 500, noiseSigma: 10, colStripeSigma: 0, rowStripeSigma: 0, fullHeightLine: false },
  { id: "mild", name: "Mild column stripes", animalDelta: 350, bridgeDelta: 500, noiseSigma: 12, colStripeSigma: 20, rowStripeSigma: 0, fullHeightLine: false },
  { id: "strong", name: "Strong column stripes", animalDelta: 350, bridgeDelta: 500, noiseSigma: 15, colStripeSigma: 80, rowStripeSigma: 0, fullHeightLine: false },
  { id: "fullline", name: "Stripes + genuine full-height line", animalDelta: 350, bridgeDelta: 500, noiseSigma: 12, colStripeSigma: 40, rowStripeSigma: 0, fullHeightLine: true },
  { id: "lowcontrast", name: "Low contrast, noisy", animalDelta: 60, bridgeDelta: 60, noiseSigma: 20, colStripeSigma: 30, rowStripeSigma: 0, fullHeightLine: false },
  { id: "similar", name: "Animal ≈ bridge apparent signal", animalDelta: 400, bridgeDelta: 400, noiseSigma: 12, colStripeSigma: 30, rowStripeSigma: 0, fullHeightLine: false },
];

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rnd: () => number) {
  const u = Math.max(1e-12, rnd());
  const v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export interface SynthScene {
  noisy: Uint16Array;
  clean: Float32Array;
  thinMask: Uint8Array; // thin structures (bridge deck, pillars, genuine line)
  flat: { x: number; y: number; w: number; h: number };
  rois: Roi[]; // truth ROIs for the Lab (animal / bridge / background)
  w: number;
  h: number;
}

export function generateScene(spec: ScenarioSpec, seed: number, w = 640, h = 512): SynthScene {
  const rnd = mulberry32(seed * 7919 + 13);
  const sx = w / 640;
  const sy = h / 512;
  const clean64 = new Float64Array(w * h);
  const thin = new Uint8Array(w * h);
  const phase = rnd() * 6.28;
  const groundY = Math.round(0.62 * h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sky = y < groundY;
      const grad = sky ? 6400 - 500 * (y / groundY) : 5700 + 150 * ((y - groundY) / (h - groundY));
      const tex = 35 * Math.sin(x / (45 * sx) + phase) * Math.cos(y / (37 * sy)) + 15 * Math.sin((x + y) / (11 * sx));
      clean64[y * w + x] = grad + tex;
    }
  }
  const setPix = (x: number, y: number, d: number, thinFlag: boolean) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    clean64[y * w + x] += d;
    if (thinFlag) thin[y * w + x] = 1;
  };
  // bridge deck + pillars
  const deckY = Math.round(0.45 * h);
  const deckT = Math.max(2, Math.round(4 * sy));
  for (let x = Math.round(0.1 * w); x < Math.round(0.9 * w); x++) {
    for (let t = 0; t < deckT; t++) setPix(x, deckY + t, spec.bridgeDelta, true);
  }
  for (const f of [0.2, 0.4, 0.6, 0.8]) {
    const px = Math.round(f * w);
    for (let y = deckY + deckT; y < groundY; y++) for (let t = 0; t < 3; t++) setPix(px + t, y, spec.bridgeDelta * 0.8, true);
  }
  if (spec.fullHeightLine) {
    const lx = Math.round(0.55 * w) + 1;
    for (let y = 0; y < h; y++) for (let t = 0; t < 2; t++) setPix(lx + t, y, 150, true);
  }
  // animals: warm ellipses with a cooler belly stripe and legs (interior detail)
  const animals = [
    { cx: 0.25, cy: 0.78, rx: 24, ry: 11 },
    { cx: 0.5, cy: 0.84, rx: 20, ry: 9 },
    { cx: 0.75, cy: 0.76, rx: 26, ry: 12 },
  ];
  const rois: Roi[] = [];
  animals.forEach((a, i) => {
    const cx = a.cx * w;
    const cy = a.cy * h;
    const rx = a.rx * sx;
    const ry = a.ry * sy;
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
      for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
        const e = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
        if (e <= 1) {
          let d = spec.animalDelta;
          if (Math.abs(y - cy) < 1.2 * sy) d *= 0.75; // belly line
          if (Math.abs(x - cx) > rx * 0.6 && y > cy) d *= 0.6; // cooler legs/edge
          setPix(x, y, d, false);
        }
      }
    }
    rois.push({
      id: `s-a${i}`,
      role: "animal",
      label: `animal ${i + 1}`,
      x: Math.round(cx - rx * 0.4),
      y: Math.round(cy - ry * 0.4),
      w: Math.max(4, Math.round(rx * 0.8)),
      h: Math.max(4, Math.round(ry * 0.8)),
    });
  });
  rois.push({ id: "s-b0", role: "bridge", label: "bridge deck", x: Math.round(0.3 * w), y: deckY, w: Math.round(0.08 * w), h: deckT });
  rois.push({ id: "s-bg0", role: "background", label: "background (sky)", x: Math.round(0.04 * w), y: Math.round(0.05 * h), w: Math.round(0.16 * w), h: Math.round(0.14 * h) });

  // 3x3 box PSF
  const blurred = boxFilter(clean64, w, h, 1);
  const clean = new Float32Array(w * h);
  for (let i = 0; i < clean.length; i++) clean[i] = blurred[i];

  // corruption: column/row stripes + temporal noise
  const colOff = new Float32Array(w);
  const rowOff = new Float32Array(h);
  for (let x = 0; x < w; x++) colOff[x] = spec.colStripeSigma * gaussian(rnd);
  for (let y = 0; y < h; y++) rowOff[y] = spec.rowStripeSigma * gaussian(rnd);
  const noisy = new Uint16Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = clean[y * w + x] + colOff[x] + rowOff[y] + spec.noiseSigma * gaussian(rnd);
      noisy[y * w + x] = Math.max(0, Math.min(16383, Math.round(v)));
    }
  }
  return {
    noisy,
    clean,
    thinMask: thin,
    flat: { x: Math.round(0.03 * w), y: Math.round(0.04 * h), w: Math.round(0.3 * w), h: Math.round(0.25 * h) },
    rois,
    w,
    h,
  };
}

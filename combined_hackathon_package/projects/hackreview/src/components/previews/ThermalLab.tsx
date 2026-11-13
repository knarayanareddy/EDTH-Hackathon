"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FULL_CFG, Isp, Scene, baselineMinMax, gray8FromRgba } from "@/lib/thermal";
import { Btn } from "../ui";

const W = 160;
const H = 128;
const N = 240;

interface Data {
  base: Uint8Array[];
  proc: Uint8Array[];
  baseRoi: number[];
  procRoi: number[];
  baseClip: number[];
  procClip: number[];
  ms: number;
}

function build(): Data {
  const scene = new Scene(W, H);
  const isp = new Isp(W, H);
  const raw = new Uint16Array(W * H);
  const rgbaA = new Uint8ClampedArray(W * H * 4);
  const rgbaB = new Uint8ClampedArray(W * H * 4);
  const d: Data = { base: [], proc: [], baseRoi: [], procRoi: [], baseClip: [], procClip: [], ms: 0 };
  let msSum = 0;
  for (let t = 0; t < N; t++) {
    scene.frame(t, raw);
    const a = baselineMinMax(raw, W, H, rgbaA);
    const b = isp.process(raw, FULL_CFG, rgbaB);
    d.base.push(gray8FromRgba(rgbaA, W * H));
    d.proc.push(gray8FromRgba(rgbaB, W * H));
    d.baseRoi.push(a.roiMean);
    d.procRoi.push(b.roiMean);
    d.baseClip.push(a.clipped * 100);
    d.procClip.push(b.clipped * 100);
    msSum += b.ms;
  }
  d.ms = msSum / N;
  return d;
}

export function ThermalLab() {
  const [data, setData] = useState<Data | null>(null);
  const [k, setK] = useState(80);
  const [split, setSplit] = useState(50);
  const [clip, setClip] = useState(false);
  const [play, setPlay] = useState(false);
  const can = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const id = setTimeout(() => setData(build()), 30);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!play) return;
    const id = setInterval(() => setK((p) => (p + 1) % N), 40);
    return () => clearInterval(id);
  }, [play]);

  const draw = useCallback(() => {
    const c = can.current;
    if (!c || !data) return;
    const img = new ImageData(W, H);
    const A = data.base[k];
    const B = data.proc[k];
    const sx = Math.round((split / 100) * W);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const g = x < sx ? A[i] : B[i];
        const o = i * 4;
        if (clip && g === 255) {
          img.data[o] = 255;
          img.data[o + 1] = 40;
          img.data[o + 2] = 40;
        } else if (clip && g === 0) {
          img.data[o] = 40;
          img.data[o + 1] = 90;
          img.data[o + 2] = 255;
        } else {
          img.data[o] = g;
          img.data[o + 1] = g;
          img.data[o + 2] = g;
        }
        img.data[o + 3] = 255;
        if (x === sx) {
          img.data[o] = 34;
          img.data[o + 1] = 211;
          img.data[o + 2] = 238;
        }
      }
    c.getContext("2d")!.putImageData(img, 0, 0);
  }, [data, k, split, clip]);

  useEffect(() => {
    draw();
  }, [draw]);

  const bookmarks = useMemo(() => {
    if (!data) return [];
    const jumps = data.baseRoi.map((v, i) => ({ i, j: i ? Math.abs(v - data.baseRoi[i - 1]) : 0 }));
    return jumps.sort((a, b) => b.j - a.j).slice(0, 5);
  }, [data]);

  if (!data) return <p className="text-sm text-slate-400">Rendering {N} synthetic frames and processing them twice…</p>;

  const CW = 440;
  const CH = 80;
  const line = (v: number[], lo: number, hi: number) =>
    v.map((y, i) => `${(i / (N - 1)) * CW},${CH - ((y - lo) / Math.max(1e-6, hi - lo)) * CH}`).join(" ");
  const roiAll = [...data.baseRoi, ...data.procRoi];
  const roiLo = Math.min(...roiAll);
  const roiHi = Math.max(...roiAll);
  const clipHi = Math.max(1, ...data.baseClip, ...data.procClip);
  const cursor = (k / (N - 1)) * CW;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,420px)_1fr]">
        <div>
          <canvas ref={can} width={W} height={H} className="w-full rounded-lg border border-slate-800 bg-black [image-rendering:pixelated]" />
          <div className="mt-1 flex justify-between text-[11px] text-slate-400">
            <span>◀ Baseline (per-frame percentile stretch)</span>
            <span>Processed ▶</span>
          </div>
          <label className="mt-2 block text-xs text-slate-300">
            Split position
            <input type="range" min={0} max={100} value={split} onChange={(e) => setSplit(Number(e.target.value))} className="w-full" />
          </label>
          <label className="block text-xs text-slate-300">
            Frame <strong className="text-white">{k}</strong> / {N - 1}
            <input type="range" min={0} max={N - 1} value={k} onChange={(e) => setK(Number(e.target.value))} className="w-full" />
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            <Btn onClick={() => setK((p) => Math.max(0, p - 1))}>◀ Step</Btn>
            <Btn onClick={() => setK((p) => Math.min(N - 1, p + 1))}>Step ▶</Btn>
            <Btn tone="primary" onClick={() => setPlay((p) => !p)}>
              {play ? "Pause" : "Play"}
            </Btn>
            <Btn active={clip} onClick={() => setClip((c) => !c)}>
              Clipping overlay
            </Btn>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            Overlay: red = saturated white (255), blue = crushed black (0).
          </p>
        </div>

        <div className="space-y-3">
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-300">
            <p className="font-semibold text-white">Config shown on the right of the split</p>
            <p className="font-mono text-cyan-200">
              bad-pixel · column-FPN · motion-adaptive-TNR · plateau-AGC (smoothed LUT) · detail 0.6
            </p>
            <p className="mt-1 text-slate-400">Measured here: {data.ms.toFixed(2)} ms/frame at 160×128 in this tab (not representative of 640×512 or your target).</p>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Background brightness per frame</p>
            <svg viewBox={`0 0 ${CW} ${CH}`} className="w-full">
              <polyline points={line(data.baseRoi, roiLo, roiHi)} fill="none" stroke="#f87171" strokeWidth="1.5" />
              <polyline points={line(data.procRoi, roiLo, roiHi)} fill="none" stroke="#22d3ee" strokeWidth="1.5" />
              <line x1={cursor} x2={cursor} y1={0} y2={CH} stroke="#fff" strokeOpacity={0.5} />
            </svg>
            <p className="text-[11px] text-slate-500">
              <span className="text-red-300">baseline</span> · <span className="text-cyan-300">processed</span>. The sky isn’t changing, so ideally flat.
            </p>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Clipped pixels (%) per frame</p>
            <svg viewBox={`0 0 ${CW} ${CH}`} className="w-full">
              <polyline points={line(data.baseClip, 0, clipHi)} fill="none" stroke="#f87171" strokeWidth="1.5" />
              <polyline points={line(data.procClip, 0, clipHi)} fill="none" stroke="#22d3ee" strokeWidth="1.5" />
              <line x1={cursor} x2={cursor} y1={0} y2={CH} stroke="#fff" strokeOpacity={0.5} />
            </svg>
            <p className="text-xs text-slate-300">
              This frame: baseline {data.baseClip[k].toFixed(1)}% · processed {data.procClip[k].toFixed(1)}%
            </p>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Hardest frames (largest baseline brightness jump)</p>
            <div className="flex flex-wrap gap-2">
              {bookmarks.map((b) => (
                <Btn key={b.i} onClick={() => setK(b.i)}>
                  Frame {b.i} (Δ{b.j.toFixed(0)})
                </Btn>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

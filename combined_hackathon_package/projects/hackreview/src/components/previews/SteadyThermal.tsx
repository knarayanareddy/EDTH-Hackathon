"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FULL_CFG, Isp, Scene, baselineMinMax, type IspCfg } from "@/lib/thermal";
import { Btn } from "../ui";

const SW = 320;
const SH = 256;
const FW = 640;
const FH = 512;
const FRAME_BYTES = FW * FH * 2;
const HIST = 160;

type Trace = { a: number[]; b: number[] };

function flicker(v: number[]) {
  if (v.length < 3) return 0;
  const d: number[] = [];
  for (let i = 1; i < v.length; i++) d.push(v[i] - v[i - 1]);
  const m = d.reduce((s, x) => s + x, 0) / d.length;
  return Math.sqrt(d.reduce((s, x) => s + (x - m) * (x - m), 0) / d.length);
}

const STEPS: { key: keyof IspCfg | "agc"; title: string; fixes: string }[] = [
  { key: "bad", title: "Bad-pixel replacement", fixes: "A single dead/hot pixel can set min–max and flatten the whole frame. Replaced when it exceeds all 4 neighbours by a margin (real edges have a similar neighbour)." },
  { key: "stripe", title: "Column pattern removal", fixes: "Residual column offsets after NUC show as vertical stripes once contrast is stretched. Robust high-pass, averaged down each column, adapted slowly." },
  { key: "temporal", title: "Motion-adaptive temporal filter", fixes: "Averages static pixels (noise ↓) but passes changing ones straight through, so the walking person leaves no trail." },
  { key: "agc", title: "Plateau tone mapping", fixes: "Histogram bins are capped, so a large hot object cannot take the whole range and wash the scene out (‘lost scene’)." },
  { key: "lutSmooth", title: "Temporal tone-curve smoothing", fixes: "Slow-decay, fast-attack smoothing of the curve itself removes brightness flicker while still following real scene changes." },
  { key: "detail", title: "Guarded detail boost", fixes: "Small unsharp with a clamp on the correction, so edges gain definition without halos or a plastic look." },
];

export function SteadyThermal() {
  const [cfg, setCfg] = useState<IspCfg>(FULL_CFG);
  const [playing, setPlaying] = useState(true);
  const [dims, setDims] = useState({ w: SW, h: SH });
  const [fileInfo, setFileInfo] = useState<string>("Synthetic scene");
  const [trace, setTrace] = useState<Trace>({ a: [], b: [] });
  const [perf, setPerf] = useState({ base: 0, isp: 0, frame: 0, frames: 0 });
  const [err, setErr] = useState("");

  const canA = useRef<HTMLCanvasElement>(null);
  const canB = useRef<HTMLCanvasElement>(null);
  const cfgRef = useRef(cfg);
  const frameRef = useRef(0);
  const ispRef = useRef<Isp | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const bufRef = useRef<ArrayBuffer | null>(null);
  const framesRef = useRef(0);
  const traceRef = useRef<Trace>({ a: [], b: [] });
  const emaRef = useRef({ base: 0, isp: 0 });

  useEffect(() => {
    cfgRef.current = cfg;
  }, [cfg]);

  const draw = useCallback(() => {
    const { w, h } = dims;
    const a = canA.current;
    const b = canB.current;
    if (!a || !b) return;
    if (!ispRef.current || ispRef.current.w !== w || ispRef.current.h !== h) ispRef.current = new Isp(w, h);
    if (!bufRef.current && (!sceneRef.current || sceneRef.current.w !== w)) sceneRef.current = new Scene(w, h);

    const raw = new Uint16Array(w * h);
    const k = frameRef.current;
    if (bufRef.current) {
      raw.set(new Uint16Array(bufRef.current, (k % framesRef.current) * FRAME_BYTES, w * h));
    } else {
      sceneRef.current!.frame(k, raw);
    }

    const ia = new ImageData(w, h);
    const ib = new ImageData(w, h);
    const sa = baselineMinMax(raw, w, h, ia.data);
    const sb = ispRef.current.process(raw, cfgRef.current, ib.data);
    a.getContext("2d")!.putImageData(ia, 0, 0);
    b.getContext("2d")!.putImageData(ib, 0, 0);

    const e = emaRef.current;
    e.base = e.base ? e.base * 0.9 + sa.ms * 0.1 : sa.ms;
    e.isp = e.isp ? e.isp * 0.9 + sb.ms * 0.1 : sb.ms;
    const tr = traceRef.current;
    tr.a.push(sa.roiMean);
    tr.b.push(sb.roiMean);
    if (tr.a.length > HIST) {
      tr.a.shift();
      tr.b.shift();
    }
    if (k % 4 === 0) {
      setTrace({ a: [...tr.a], b: [...tr.b] });
      setPerf({ base: e.base, isp: e.isp, frame: k, frames: framesRef.current });
    }
  }, [dims]);

  useEffect(() => {
    let id = 0;
    let last = 0;
    const loop = (ts: number) => {
      if (ts - last >= 40) {
        last = ts;
        draw();
        frameRef.current++;
      }
      id = requestAnimationFrame(loop);
    };
    if (playing) id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [playing, draw]);

  useEffect(() => {
    if (!playing) draw();
  }, [cfg, playing, draw]);

  async function onFile(file: File) {
    setErr("");
    if (file.size % FRAME_BYTES !== 0) {
      setErr(`File size ${file.size} is not a multiple of ${FRAME_BYTES} (640×512×2). Is it the right file?`);
      return;
    }
    if (file.size > 1.2e9) {
      setErr("File larger than ~1.2 GB: use the first part (this preview loads it into memory).");
      return;
    }
    const buf = await file.arrayBuffer();
    bufRef.current = buf;
    framesRef.current = file.size / FRAME_BYTES;
    ispRef.current = null;
    traceRef.current = { a: [], b: [] };
    emaRef.current = { base: 0, isp: 0 };
    frameRef.current = 0;
    setFileInfo(`${file.name}: ${framesRef.current} frames of 640×512`);
    setDims({ w: FW, h: FH });
  }

  function useSynthetic() {
    bufRef.current = null;
    framesRef.current = 0;
    ispRef.current = null;
    sceneRef.current = null;
    traceRef.current = { a: [], b: [] };
    emaRef.current = { base: 0, isp: 0 };
    frameRef.current = 0;
    setFileInfo("Synthetic scene");
    setDims({ w: SW, h: SH });
  }

  const W = 420;
  const H = 90;
  const all = [...trace.a, ...trace.b];
  const lo = all.length ? Math.min(...all) - 4 : 0;
  const hi = all.length ? Math.max(...all) + 4 : 255;
  const path = (v: number[]) =>
    v.map((y, i) => `${(i / (HIST - 1)) * W},${H - ((y - lo) / Math.max(1, hi - lo)) * H}`).join(" ");

  const fa = flicker(trace.a);
  const fb = flicker(trace.b);
  const ms = perf.isp;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Btn tone="primary" onClick={() => setPlaying((p) => !p)}>
          {playing ? "Pause" : "Play"}
        </Btn>
        <span className="text-xs text-slate-400">
          {fileInfo} · frame {perf.frame}
          {perf.frames ? ` / ${perf.frames}` : ""}
        </span>
        <label className="ml-auto cursor-pointer rounded-md border border-slate-600 bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700">
          Load your 640×512 .bin
          <input type="file" accept=".bin" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        </label>
        {bufRef.current && <Btn onClick={useSynthetic}>Back to synthetic</Btn>}
      </div>
      {err && <p className="rounded border border-red-500/40 bg-red-500/10 p-2 text-sm text-red-300">{err}</p>}

      <div className="grid gap-3 md:grid-cols-2">
        <figure>
          <canvas ref={canA} width={dims.w} height={dims.h} className="w-full rounded-lg border border-slate-800 bg-black [image-rendering:pixelated]" />
          <figcaption className="mt-1 text-xs text-slate-400">Baseline: per-frame auto-stretch (0.5–99.5 percentile) to 8 bit ({perf.base.toFixed(1)} ms)</figcaption>
        </figure>
        <figure>
          <canvas ref={canB} width={dims.w} height={dims.h} className="w-full rounded-lg border border-slate-800 bg-black [image-rendering:pixelated]" />
          <figcaption className="mt-1 text-xs text-slate-400">
            Pipeline: {ms.toFixed(1)} ms/frame in this browser tab ({ms > 0 ? Math.round(1000 / ms) : 0} fps capacity; budget 40 ms)
          </figcaption>
        </figure>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Brightness of an unchanged region (sky, upper-left) over time
          </p>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
            <polyline points={path(trace.a)} fill="none" stroke="#f87171" strokeWidth="1.5" />
            <polyline points={path(trace.b)} fill="none" stroke="#22d3ee" strokeWidth="1.5" />
          </svg>
          <div className="mt-1 flex flex-wrap gap-4 text-xs">
            <span className="text-red-300">Baseline flicker: {fa.toFixed(2)} levels/frame</span>
            <span className="text-cyan-300">Pipeline flicker: {fb.toFixed(2)} levels/frame</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            A flat line is good: the sky did not change, so its displayed brightness should not either. Watch the red line when the hot object enters.
          </p>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Pipeline steps (toggle to see what each fixes)</p>
          <ul className="space-y-2">
            {STEPS.map((s) => {
              const on =
                s.key === "agc" ? cfg.agc === "plateau" : s.key === "detail" ? cfg.detail > 0 : (cfg[s.key as "bad" | "stripe" | "temporal" | "lutSmooth"] as boolean);
              return (
                <li key={s.title} className="text-xs">
                  <label className="flex cursor-pointer items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={on}
                      onChange={(e) => {
                        const v = e.target.checked;
                        setCfg((c) =>
                          s.key === "agc"
                            ? { ...c, agc: v ? "plateau" : "minmax" }
                            : s.key === "detail"
                              ? { ...c, detail: v ? 0.6 : 0 }
                              : { ...c, [s.key]: v },
                        );
                      }}
                    />
                    <span>
                      <span className="font-semibold text-slate-100">{s.title}</span>
                      <span className="block text-slate-400">{s.fixes}</span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          {cfg.detail > 0 && (
            <label className="mt-3 block text-xs text-slate-300">
              Detail amount: {cfg.detail.toFixed(1)}
              <input type="range" min={0.1} max={1.5} step={0.1} value={cfg.detail} onChange={(e) => setCfg({ ...cfg, detail: Number(e.target.value) })} className="w-full" />
            </label>
          )}
        </div>
      </div>
      <p className="text-[11px] text-slate-500">
        Synthetic scene: fixed column noise, temporal noise, slow drift, 6 bad pixels, a walking person and a hot object that appears
        and disappears (frames 70–170 of each 240). The synthetic data is for illustrating each step; judge your real sequence with the loader above. Timing is
        JavaScript in a browser tab, not a benchmark of your final implementation.
      </p>
    </div>
  );
}

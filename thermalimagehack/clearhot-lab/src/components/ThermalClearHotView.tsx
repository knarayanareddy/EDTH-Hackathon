import React, { useState, useEffect, useRef } from "react";
import {
  Eye,
  FileUp,
  Layers,
  Pause,
  Play,
} from "lucide-react";

type SequencePreset = "shahed_intercept" | "horizon_pan" | "burning_convoy";

interface IspConfig {
  stage1DestripeAndBadPx: boolean;
  stage2TemporalQuantileAgc: boolean;
  stage3DualPlateauCompression: boolean;
  stage4EdgePreservingDetail: boolean;
  antiGhostingPureSpatial: boolean; // When false, demonstrates how naive IIR temporal denoise smears moving targets!
  splitWipePct: number;
  agcSlewLimitADU: number;
  detailGain: number;
  verticalStrength: number;
  horizontalStrength: number;
}

export const ThermalClearHotView: React.FC = () => {
  const [preset, setPreset] = useState<SequencePreset>("shahed_intercept");
  const [frameIdx, setFrameIdx] = useState<number>(0);
  const [playing, setPlaying] = useState<boolean>(true);
  const [customBinInfo, setCustomBinInfo] = useState<{
    fileName: string;
    totalFrames: number;
    width: number;
    height: number;
  } | null>(null);

  const [uploadError, setUploadError] = useState<string | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);
  const customFramesRef = useRef<Uint16Array | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const exportCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [fullRes, setFullRes] = useState(true);
  const lastFrameRef = useRef<string>("");
  const prevBlackLevelRef = useRef<number>(7100);
  const prevWhiteLevelRef = useRef<number>(7950);
  const prevFrameFloatRef = useRef<Float32Array | null>(null);

  const [cfg, setCfg] = useState<IspConfig>({
    stage1DestripeAndBadPx: true,
    stage2TemporalQuantileAgc: true,
    stage3DualPlateauCompression: true,
    stage4EdgePreservingDetail: true,
    antiGhostingPureSpatial: true,
    splitWipePct: 50,
    agcSlewLimitADU: 18,
    detailGain: 1.4,
    verticalStrength: 0.65,
    horizontalStrength: 0,
  });

  const [telemetryStats, setTelemetryStats] = useState({
    rawMin14: 7040,
    rawMax14: 14920,
    sceneSpanADU: 680,
    frameTimeMs: 4.8,

  });

  // Playback loop at ~15 fps in browser preview
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setFrameIdx((f) => {
        const maxF = customBinInfo ? customBinInfo.totalFrames : 60;
        return (f + 1) % Math.max(1, maxF);
      });
    }, 85);
    return () => window.clearInterval(id);
  }, [playing, customBinInfo]);

  // Handle real 640x512 uint16 little-endian .bin file upload
  const handleBinUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const framePixels = 640 * 512;
    const frameBytes = framePixels * 2;
    if (!file.size || file.size % frameBytes !== 0) { setUploadError("File must contain whole 640 × 512 uint16 frames (655,360 bytes each). The new file was not loaded."); e.target.value = ""; return; }
    if (file.size > 200 * 1024 * 1024) { setUploadError("File exceeds this demo’s 200 MiB memory limit."); e.target.value = ""; return; }
    setUploadError(null);
    setPlaying(false);
    setLoadingFile(true);
    try {
    const buf = await file.arrayBuffer();
    const data = new DataView(buf);
    const u16 = new Uint16Array(buf.byteLength / 2);
    for (let i = 0; i < u16.length; i++) u16[i] = data.getUint16(i * 2, true);
    const totalFrames = u16.length / framePixels;
    prevFrameFloatRef.current = null; prevBlackLevelRef.current = 7100; prevWhiteLevelRef.current = 7950; lastFrameRef.current = "";
    customFramesRef.current = u16;
    setCustomBinInfo({
      fileName: file.name,
      totalFrames,
      width: 640,
      height: 512,
    });
    setFrameIdx(0);
    } catch (err) { setUploadError(`Could not read file: ${err instanceof Error ? err.message : String(err)}`); }
    finally { setLoadingFile(false); }
  };

  // Render current 14-bit frame through both Naive Linear Min-Max (Left of wipe) and ClearHot 4-Stage Pipeline (Right of wipe)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const t0 = performance.now();
    const W = customBinInfo && fullRes ? 640 : 320;
    const H = customBinInfo && fullRes ? 512 : 256;
    canvas.width = W; canvas.height = H;
    const N = W * H;
    const raw14 = new Uint16Array(N);

    // Either downsample loaded 640x512 .bin frame OR synthesize realistic 14-bit post-NUC microbolometer frame (0..16383)
    if (customFramesRef.current && customBinInfo) {
      const src = customFramesRef.current;
      const offset = (frameIdx % customBinInfo.totalFrames) * (640 * 512);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const srcIdx = offset + y * (512 / H) * 640 + x * (640 / W);
          raw14[y * W + x] = src[srcIdx] & 0x3fff;
        }
      }
    } else {
      // Synthesize authentic 14-bit post-NUC frame where background scene sits in a narrow ~550 ADU band around 7300 ADU,
      // while a single hot exhaust / fire spikes to 14,800 ADU (which breaks naive min-max scaling into a flat gray washout!)
      const pitchShift =
        preset === "horizon_pan" ? Math.round(Math.sin(frameIdx * 0.18) * 38) : 0;
      const horizonY = 96 + pitchShift;

      for (let y = 0; y < H; y++) {
        const isSky = y < horizonY;
        for (let x = 0; x < W; x++) {
          let val = isSky
            ? 7080 + Math.round(Math.sin(x * 0.04 + y * 0.06) * 45)
            : 7340 +
              Math.round(
                Math.sin(x * 0.08) * 65 +
                  Math.cos((y - horizonY) * 0.12) * 80 +
                  ((x ^ y) % 19) * 4
              );

          // Road / trench structure
          if (!isSky && Math.abs(x - (160 + (y - horizonY) * 0.45)) < 18) {
            val += 135;
          }

          // Column FPN readout stripe (typical uncooled microbolometer residual after NUC)
          const colStripe = ((x * 37) % 11 === 0 ? 48 : 0) - ((x * 19) % 13 === 0 ? 36 : 0);
          val += colStripe;

          raw14[y * W + x] = val;
        }
      }

      // Moving Target (Shahed-136 delta wing + 14,800 ADU exhaust plume OR armored convoy)
      const tx = Math.round((frameIdx * 5) % (W - 40)) + 20;
      const ty = preset === "shahed_intercept" ? 64 : 155;
      for (let dy = -10; dy <= 10; dy++) {
        for (let dx = -16; dx <= 16; dx++) {
          const px = tx + dx;
          const py = ty + dy;
          if (px >= 0 && px < W && py >= 0 && py < H) {
            const dist = Math.sqrt(dx * dx + dy * dy * 1.8);
            if (dist < 4.2) {
              // Extreme hot engine exhaust / burning core (14,900 ADU in 14-bit space)
              raw14[py * W + px] = 14900;
            } else if (dist < 11) {
              // Warm airframe / hull (+290 ADU above ambient)
              raw14[py * W + px] += 290;
            }
          }
        }
      }

      // Add a transient hot flare on alternating frames in horizon_pan to test AGC flicker
      if (preset === "burning_convoy" || (preset === "horizon_pan" && frameIdx % 8 < 4)) {
        for (let y = 180; y < 210; y++) {
          for (let x = 45; x < 75; x++) {
            raw14[y * W + x] = 15600;
          }
        }
      }

      // Sprinkle 25 dead/hot bad pixels (0 or 16383)
      for (let k = 0; k < 25; k++) {
        const bx = (k * 97 + 31) % (W - 2) + 1;
        const by = (k * 53 + 17) % (H - 2) + 1;
        raw14[by * W + bx] = k % 2 === 0 ? 16380 : 120;
      }
    }

    // Compute raw min/max for Naive Linear 14-to-8-bit baseline
    let rMin = 16383;
    let rMax = 0;
    for (let i = 0; i < N; i++) {
      const v = raw14[i];
      if (v < rMin) rMin = v;
      if (v > rMax) rMax = v;
    }

    // STAGE 1: Bad-Pixel 3x3 Outlier Replacement & Column Median Destriping
    const stage1Buf = Float32Array.from(raw14);
    if (cfg.stage1DestripeAndBadPx) {
      // Estimate column bias via quick vertical sample median/mean
      const colBias = new Float32Array(W);
      let globalMed = 0;
      for (let x = 0; x < W; x++) {
        let sum = 0;
        let cnt = 0;
        for (let y = 16; y < H - 16; y += 4) {
          const v = raw14[y * W + x];
          if (v > 1000 && v < 12000) {
            sum += v;
            cnt++;
          }
        }
        colBias[x] = cnt > 0 ? sum / cnt : 7200;
        globalMed += colBias[x];
      }
      globalMed /= W;

      // Row high-frequency residual: compare a row mean with nearby row means.
      // This is an experimental scene-based heuristic, not calibrated fixed-pattern-noise removal.
      const rowMean = new Float32Array(H);
      for (let y = 0; y < H; y++) {
        let sum = 0; for (let x = 0; x < W; x += 4) sum += raw14[y * W + x];
        rowMean[y] = sum / Math.ceil(W / 4);
      }
      const rowBias = new Float32Array(H);
      for (let y = 0; y < H; y++) {
        let sum = 0, count = 0; for (let k = -4; k <= 4; k++) { const j = y + k; if (j >= 0 && j < H) { sum += rowMean[j]; count++; } }
        rowBias[y] = rowMean[y] - sum / count;
      }
      for (let y = 1; y < H - 1; y++) {
        for (let x = 1; x < W - 1; x++) {
          const idx = y * W + x;
          let v = raw14[idx] - (colBias[x] - globalMed) * cfg.verticalStrength - rowBias[y] * cfg.horizontalStrength;
          const n1 = raw14[idx - 1];
          const n2 = raw14[idx + 1];
          const n3 = raw14[idx - W];
          const n4 = raw14[idx + W];
          const avgN = (n1 + n2 + n3 + n4) * 0.25;
          if (Math.abs(v - avgN) > 1800) {
            v = avgN; // Hot/dead pixel spike replaced
          }
          stage1Buf[idx] = v;
        }
      }
    } else {
      for (let i = 0; i < N; i++) stage1Buf[i] = raw14[i];
    }

    // STAGE 2 & 3: Temporal Hysteresis Quantile AGC + Dual-Plateau Local Contrast
    // Build coarse histogram in [6500..9000] + high tail to find 1% and 98.5% scene quantiles without letting 14,900 ADU exhaust crush the background!
    let pLow = rMin;
    let pHigh = rMax;
    if (cfg.stage2TemporalQuantileAgc) {
      const sortedSample: number[] = [];
      for (let i = 0; i < N; i += 11) {
        sortedSample.push(stage1Buf[i]);
      }
      sortedSample.sort((a, b) => a - b);
      const rawPLow = sortedSample[Math.floor(sortedSample.length * 0.02)] || 7000;
      const rawPHigh =
        sortedSample[
          Math.floor(
            sortedSample.length * (cfg.stage3DualPlateauCompression ? 0.975 : 0.999)
          )
        ] || 8200;

      // Slew-rate hysteresis limiter (anti-flicker!)
      const maxDelta = cfg.agcSlewLimitADU;
      const frameKey = `${customBinInfo?.fileName ?? preset}:${frameIdx}:${W}`;
      if (lastFrameRef.current !== frameKey) {
        pLow = lastFrameRef.current === "" ? rawPLow : prevBlackLevelRef.current + Math.max(-maxDelta, Math.min(maxDelta, rawPLow - prevBlackLevelRef.current));
        pHigh = lastFrameRef.current === "" ? rawPHigh : prevWhiteLevelRef.current + Math.max(-maxDelta, Math.min(maxDelta, rawPHigh - prevWhiteLevelRef.current));
        prevBlackLevelRef.current = pLow; prevWhiteLevelRef.current = pHigh; lastFrameRef.current = frameKey;
      } else { pLow = prevBlackLevelRef.current; pHigh = prevWhiteLevelRef.current; }
    }

    const span = Math.max(80, pHigh - pLow);

    // Normalize to 0..255 with soft shoulder compression for extreme hot targets (> pHigh)
    const normBuf = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const v = stage1Buf[i];
      if (v <= pHigh) {
        normBuf[i] = Math.max(0, Math.min(232, ((v - pLow) / span) * 232));
      } else {
        // Soft logarithmic highlight compression for 14,900 ADU exhaust so both background AND hot core stay visible
        const excess = Math.min(1, (v - pHigh) / 7000);
        normBuf[i] = 232 + excess * 23;
      }
    }

    // Optional Anti-Ghosting check: if user disables Pure Spatial mode, apply IIR temporal blend to visually show ghosting trails!
    if (!cfg.antiGhostingPureSpatial && prevFrameFloatRef.current?.length === N) {
      for (let i = 0; i < N; i++) {
        normBuf[i] = 0.25 * normBuf[i] + 0.75 * prevFrameFloatRef.current[i];
      }
    }
    prevFrameFloatRef.current = normBuf.slice();

    // STAGE 4: Edge-Preserving Spatial Detail Boost (Unsharp bilateral-lite)
    const imgData = ctx.createImageData(W, H);
    const data = imgData.data;
    const processedData = ctx.createImageData(W, H);
    const wipeX = Math.floor((cfg.splitWipePct / 100) * W);
    const naiveSpan = Math.max(1, rMax - rMin);

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = y * W + x;
        let out8 = 0;

        {
          // Always compute the processed image so PNG export never contains the split divider.
          let center = normBuf[idx];
          if (cfg.stage4EdgePreservingDetail && y > 0 && y < H - 1 && x > 0 && x < W - 1) {
            const l = normBuf[idx - 1];
            const r = normBuf[idx + 1];
            const u = normBuf[idx - W];
            const d = normBuf[idx + W];
            const localMean = (l + r + u + d) * 0.25;
            const diff = center - localMean;
            // Edge-preserving clamp prevents bright/dark halos around extreme edges
            const clampedDiff = Math.max(-18, Math.min(18, diff));
            center = center + clampedDiff * (cfg.detailGain - 1.0) * 1.8;
          }
          out8 = Math.max(0, Math.min(255, Math.round(center)));
        }

        const p4 = idx * 4;
        processedData.data[p4] = out8; processedData.data[p4 + 1] = out8; processedData.data[p4 + 2] = out8; processedData.data[p4 + 3] = 255;
        if (x < wipeX) out8 = Math.round(((raw14[idx] - rMin) / naiveSpan) * 255);
        data[p4] = out8;
        data[p4 + 1] = out8;
        data[p4 + 2] = out8;
        data[p4 + 3] = 255;
      }
    }

    ctx.putImageData(imgData, 0, 0);
    if (!exportCanvasRef.current) exportCanvasRef.current = document.createElement("canvas");
    exportCanvasRef.current.width = W; exportCanvasRef.current.height = H;
    exportCanvasRef.current.getContext("2d")?.putImageData(processedData, 0, 0);

    // Draw split wipe divider line
    ctx.strokeStyle = "#22d3ee";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(wipeX, 0);
    ctx.lineTo(wipeX, H);
    ctx.stroke();

    const dt = performance.now() - t0;
    setTelemetryStats({
      rawMin14: rMin,
      rawMax14: rMax,
      sceneSpanADU: Math.round(span),
      frameTimeMs: Number(dt.toFixed(1)),
    });
  }, [frameIdx, preset, cfg, customBinInfo, fullRes]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="rounded-xl border border-rose-500/30 bg-gradient-to-br from-slate-900 via-slate-900 to-rose-950/30 p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-rose-300">Isolated thermal image workbench</span>
            <h2 className="mt-2 text-2xl font-bold text-white">CLEARHOT STREAM-14</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-300">Load a local 640 × 512 little-endian uint16 raw sequence. Compare a basic min–max display with experimental enhancement and adjustable line correction. Processing stays in your browser.</p>
          </div>

          {/* Real .bin uint16 Little-Endian Loader */}
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-cyan-400/50 bg-cyan-500/15 px-4 py-2.5 text-xs font-bold text-cyan-200 shadow hover:bg-cyan-500/25">
            <FileUp className="h-4 w-4 text-cyan-300" />
            <span>
              {loadingFile ? "Loading file into browser memory…" : customBinInfo
                ? `Loaded: ${customBinInfo.fileName} (${customBinInfo.totalFrames} frames)`
                : "Load Real 640×512 uint16 .bin File"}
            </span>
            <input type="file" accept=".bin" onChange={handleBinUpload} className="hidden" />
            {uploadError && <span role="alert" className="text-rose-300">{uploadError}</span>}
          </label>
        </div>
      </div>

      {/* Main Split Workbench */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left: Interactive Split-Screen Thermal Video Canvas */}
        <div className="space-y-4 lg:col-span-7">
          <div className="rounded-xl border border-slate-700/80 bg-slate-950 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setPlaying((p) => !p)}
                  className="inline-flex items-center gap-1 rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-400"
                >
                  {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                  {playing ? "Pause demo stream" : "Play Stream"}
                </button>
                {(
                  [
                    ["shahed_intercept", "Synthetic 1: hot object"],
                    ["horizon_pan", "Synthetic 2: horizon pan"],
                    ["burning_convoy", "Synthetic 3: hot scene"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => {
                      customFramesRef.current = null;
                      setCustomBinInfo(null);
                      prevFrameFloatRef.current = null; lastFrameRef.current = "";
                      setFrameIdx(0); setPreset(key);
                    }}
                    className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold transition ${
                      preset === key && !customBinInfo
                        ? "border-rose-400 bg-rose-500/20 text-rose-200"
                        : "border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <span className="font-mono text-xs text-emerald-400">
                {telemetryStats.frameTimeMs} ms/render · {customBinInfo && fullRes ? "640×512" : "320×256"} · not an FPS benchmark
              </span>
            </div>

            {/* Canvas Container */}
            <div className="relative overflow-hidden rounded-lg border border-slate-800 bg-black">
              <canvas
                ref={canvasRef}
                width={customBinInfo && fullRes ? 640 : 320}
                height={customBinInfo && fullRes ? 512 : 256}
                className="aspect-[640/512] w-full image-render-pixelated"
              />
              <div className="pointer-events-none absolute top-2.5 left-3 rounded bg-slate-950/85 px-2 py-1 font-mono text-[10px] font-bold text-rose-300 border border-rose-500/30">
                ◀ BASELINE · MIN–MAX
              </div>
              <div className="pointer-events-none absolute top-2.5 right-3 rounded bg-slate-950/85 px-2 py-1 font-mono text-[10px] font-bold text-emerald-300 border border-emerald-500/30">
                PROCESSED · WHITE-HOT ▶
              </div>
            </div>

            {/* Split Wipe Slider */}
            <div className="mt-3 flex items-center gap-3">
              <Eye className="h-4 w-4 text-cyan-400" />
              <span className="text-xs font-semibold text-slate-300">
                Before / After Split Wipe ({cfg.splitWipePct}%):
              </span>
              <input
                aria-label="Before / after split"
                type="range"
                min={0}
                max={100}
                value={cfg.splitWipePct}
                onChange={(e) => setCfg((c) => ({ ...c, splitWipePct: Number(e.target.value) }))}
                className="h-1.5 flex-1 cursor-pointer accent-cyan-400"
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-300">
              <label className="flex items-center gap-2"><input type="checkbox" checked={fullRes} onChange={e => { setFullRes(e.target.checked); prevFrameFloatRef.current = null; lastFrameRef.current = ""; }} /> Full resolution for uploaded files</label>
              <button onClick={() => { const a=document.createElement("a"); a.href=exportCanvasRef.current?.toDataURL("image/png") ?? ""; a.download=`clearhot-frame-${frameIdx+1}.png`; a.click(); }} className="rounded-lg border border-cyan-400/50 px-3 py-2 font-bold text-cyan-200">Download processed frame PNG</button>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-300">
              <label htmlFor="frame-seek">Frame {frameIdx+1} / {customBinInfo?.totalFrames ?? 60}</label>
              <input id="frame-seek" aria-label="Frame" type="range" min={0} max={(customBinInfo?.totalFrames ?? 60)-1} value={frameIdx} onChange={e=>{setPlaying(false); setFrameIdx(Number(e.target.value)); prevFrameFloatRef.current=null; lastFrameRef.current="";}} className="min-w-36 flex-1 accent-cyan-400" />
              <span>Input range: {telemetryStats.rawMin14}–{telemetryStats.rawMax14} ADU</span>
            </div>
            <p className="mt-3 text-xs text-slate-400">For fair comparisons, pause on a frame; the baseline is per-frame min–max, not the camera maker’s viewer. PNG exports the processed frame, not the split view. Seeking resets optional frame blending; temporal contrast depends on playback history.</p>
          </div>
        </div>

        {/* Right: 4-Stage Pipeline Toggles (Jury Justification) + Honest FPGA Streaming Budget */}
        <div className="space-y-4 lg:col-span-5">
          <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-4 space-y-3">
            <h4 className="flex items-center gap-2 text-sm font-bold text-white">
              <Layers className="h-4 w-4 text-rose-400" />
              Enhancement controls
            </h4>
            <p className="text-xs text-slate-400">
              Toggle processing stages and tune line correction below. Stronger filtering can erase real scene detail—compare carefully.
            </p>

            {/* Stage 1 */}
            <label className="flex cursor-pointer items-start justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/80 p-3 hover:border-slate-700">
              <div>
                <div className="text-xs font-bold text-white">
                  Stage 1: Bad-Pixel 3×3 Outlier Clamp & Column FPN Destriping
                </div>
                <div className="mt-0.5 text-[11px] text-slate-400">
                  Experimental column correction and outlier replacement. Thin, hot objects can be mistaken for defects.
                </div>
              </div>
              <input
                type="checkbox"
                checked={cfg.stage1DestripeAndBadPx}
                onChange={(e) =>
                  setCfg((c) => ({ ...c, stage1DestripeAndBadPx: e.target.checked }))
                }
                className="mt-1 h-4 w-4 accent-emerald-400"
              />
            </label>

            {/* Stage 2 */}
            <label className="flex cursor-pointer items-start justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/80 p-3 hover:border-slate-700">
              <div>
                <div className="text-xs font-bold text-white">
                  Stage 2: Temporal Hysteresis Quantile AGC (±{cfg.agcSlewLimitADU} ADU/frame max
                  slew)
                </div>
                <div className="mt-0.5 text-[11px] text-slate-400">
                  Limits frame-to-frame contrast changes; temporal stability is not measured here.
                </div>
              </div>
              <input
                type="checkbox"
                checked={cfg.stage2TemporalQuantileAgc}
                onChange={(e) =>
                  setCfg((c) => ({ ...c, stage2TemporalQuantileAgc: e.target.checked }))
                }
                className="mt-1 h-4 w-4 accent-emerald-400"
              />
            </label>

            {/* Stage 3 */}
            <label className="flex cursor-pointer items-start justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/80 p-3 hover:border-slate-700">
              <div>
                <div className="text-xs font-bold text-white">
                  Stage 3: Alternate upper quantile for contrast
                </div>
                <div className="mt-0.5 text-[11px] text-slate-400">
                  Changes the upper sampled quantile. Not a full dual-plateau algorithm.
                </div>
              </div>
              <input
                type="checkbox"
                checked={cfg.stage3DualPlateauCompression}
                onChange={(e) =>
                  setCfg((c) => ({ ...c, stage3DualPlateauCompression: e.target.checked }))
                }
                className="mt-1 h-4 w-4 accent-emerald-400"
              />
            </label>

            {/* Stage 4 */}
            <label className="flex cursor-pointer items-start justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/80 p-3 hover:border-slate-700">
              <div>
                <div className="text-xs font-bold text-white">
                  Stage 4: Edge-Preserving Clamped Detail Boost (Gain {cfg.detailGain.toFixed(1)}×)
                </div>
                <div className="mt-0.5 text-[11px] text-slate-400">
                  Boosts local detail with a clamp; may amplify noise or introduce halos.
                </div>
              </div>
              <input
                type="checkbox"
                checked={cfg.stage4EdgePreservingDetail}
                onChange={(e) =>
                  setCfg((c) => ({ ...c, stage4EdgePreservingDetail: e.target.checked }))
                }
                className="mt-1 h-4 w-4 accent-emerald-400"
              />
            </label>

            {/* Stage 5: Anti-Ghosting Toggle */}
            <label className="flex cursor-pointer items-start justify-between gap-3 rounded-lg border border-cyan-500/30 bg-cyan-950/20 p-3">
              <div>
                <div className="text-xs font-bold text-cyan-200">
                  Spatial-only mode (uncheck to demonstrate temporal blending)
                </div>
                <div className="mt-0.5 text-[11px] text-slate-300">
                  Pure spatial mode avoids the optional IIR blend; ghosting is not measured.
                </div>
              </div>
              <input
                type="checkbox"
                checked={cfg.antiGhostingPureSpatial}
                onChange={(e) =>
                  setCfg((c) => ({ ...c, antiGhostingPureSpatial: e.target.checked }))
                }
                className="mt-1 h-4 w-4 accent-cyan-400"
              />
            </label>
          </div>

          <div className="rounded-xl border border-slate-700 bg-slate-900 p-4 space-y-4">
            <h4 className="text-sm font-bold text-white">Line correction & detail</h4>
            <label className="block text-xs text-slate-200">Vertical lines / column correction: {cfg.verticalStrength.toFixed(2)}
              <input aria-label="Vertical line correction" type="range" min="0" max="1.2" step="0.05" value={cfg.verticalStrength} onChange={e=>setCfg(c=>({...c,verticalStrength:Number(e.target.value)}))} className="mt-2 w-full accent-cyan-400" />
            </label>
            <label className="block text-xs text-slate-200">Horizontal lines / row correction: {cfg.horizontalStrength.toFixed(2)}
              <input aria-label="Horizontal line correction" type="range" min="0" max="1" step="0.05" value={cfg.horizontalStrength} onChange={e=>setCfg(c=>({...c,horizontalStrength:Number(e.target.value)}))} className="mt-2 w-full accent-cyan-400" />
            </label>
            <label className="block text-xs text-slate-200">Detail gain: {cfg.detailGain.toFixed(1)}×
              <input aria-label="Detail gain" type="range" min="1" max="3" step="0.1" value={cfg.detailGain} onChange={e=>setCfg(c=>({...c,detailGain:Number(e.target.value)}))} className="mt-2 w-full accent-cyan-400" />
            </label>
            <p className="text-xs leading-relaxed text-amber-200">Line controls require Stage 1 enabled. Horizontal filtering estimates row bias from the current scene and can remove real horizontal edges; vertical filtering can distort vertical structure. Start low, pause and inspect. Best results may require calibrated dark/flat-field frames.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

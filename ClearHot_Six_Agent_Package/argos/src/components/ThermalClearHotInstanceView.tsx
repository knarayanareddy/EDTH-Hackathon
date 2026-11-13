import React, { useState, useEffect, useRef } from "react";
import {
  BrainCircuit,
  Code2,
  Download,
  Eye,
  FileUp,
  Layers,
  Pause,
  Play,
  RotateCcw,
  Sliders,
  Sparkles,
  Zap,
} from "lucide-react";
import {
  CnnWeightsState,
  CustomBinInfo,
  FrameTelemetryStats,
  IspConfig,
  MethodologyId,
  SequencePreset,
} from "../types/thermal";
import {
  DEFAULT_ISP_CONFIGS,
  extractOrSynthesizeFrame14,
  runThermalInstancePipeline,
} from "../utils/thermalPipelineEngine";
import {
  createInitialCnnState,
  getPyTorchScriptForMethodology,
  trainCnnInBrowser,
} from "../utils/cnnPrototypeEngine";

interface ThermalClearHotInstanceViewProps {
  methodology: MethodologyId;
  instanceNumber: 1 | 2 | 3;
  title: string;
  subtitle: string;
  badgeText: string;
  accentColor: "cyan" | "emerald" | "violet";
  sharedBinFrames: Uint16Array | null;
  sharedBinInfo: CustomBinInfo | null;
  onSharedBinUpload: (frames: Uint16Array, info: CustomBinInfo) => void;
  sharedPreset: SequencePreset;
  onSharedPresetChange: (preset: SequencePreset) => void;
  sharedFrameIdx: number;
  onSharedFrameIdxChange: (idx: number) => void;
  sharedPlaying: boolean;
  onSharedPlayingChange: (playing: boolean) => void;
  onMetricsReport?: (methodology: MethodologyId, stats: FrameTelemetryStats) => void;
}

const METHODOLOGY_DESCRIPTIONS: Record<
  MethodologyId,
  {
    lineTechniqueTitle: string;
    lineTechniqueDesc: string;
    enhanceTechniqueTitle: string;
    enhanceTechniqueDesc: string;
    cnnTitle: string;
    cnnDesc: string;
    fpgaNote: string;
  }
> = {
  instance1: {
    lineTechniqueTitle:
      "Methodology A1 · Edge-Gated Huber Differential Destriping + 8-Neighbor Rank Gate",
    lineTechniqueDesc:
      "Accumulates adjacent column (Δx) and row (Δy) differences strictly where local gradient is below the Edge Gate threshold, preventing real vertical walls, masts, or horizontal horizons from turning into reverse ghost bands. Replaces the 4-neighbor average outlier clamp with an 8-neighbor sorted rank gate that preserves 2×2+ hot targets while eliminating 1px static spikes.",
    enhanceTechniqueTitle:
      "Methodology A2 · Dual-Plateau Histogram Blending (DPHE) + 2-Scale DoG with Deadzone Coring",
    enhanceTechniqueDesc:
      "Blends Temporal Quantile AGC with a Dual-Plateau CDF (upper plateau stops uniform sky/ground from hogging dynamic range; lower plateau reserves grayscale slope for small warm targets) plus a 2-scale Difference-of-Gaussians detail booster with noise-floor deadzone coring so flat background static is not amplified.",
    cnnTitle:
      "Methodology A3 · StripeResNet-1D2D (Directional 1×7 / 7×1 Separable Residual CNN)",
    cnnDesc:
      "Compact separable residual network operating on normalized 14-bit linear data BEFORE tone mapping. Uses orthogonal 1×7 and 7×1 depthwise directional kernels with Huber gradient clamping to isolate column/row FPN and static grain.",
    fpgaNote:
      "Streaming budget estimate: 7 line buffers (640×14-bit), ~148 MACs/pixel in full CNN or 14 ops/pixel in conventional Stage 1+. Unverified in RTL synthesis.",
  },
  instance2: {
    lineTechniqueTitle:
      "Methodology B1 · Multi-Level 1D Haar Wavelet Garrote Shrinkage + Spectral Comb Notch",
    lineTechniqueDesc:
      "Decomposes column and row profiles into 3-level 1D Haar wavelet detail subbands (d¹, d², d³) and applies Non-Negative Garrote shrinkage plus periodic spectral comb damping. Suppresses both narrow parallel lines and wider periodic readout bands while leaving large step edges intact.",
    enhanceTechniqueTitle:
      "Methodology B2 · Fast O(N) Edge-Preserving Guided Filter Base/Detail Split + S-Curve Compression",
    enhanceTechniqueDesc:
      "Splits the 14-bit frame into a large-scale radiometric Base layer and a fine Detail layer using local variance guidance (a_k = σ² / (σ² + ε)). Applies smooth S-curve contrast compression to the Base layer (zero dark/bright halos around hot plumes or horizons) and amplifies the Detail layer cleanly.",
    cnnTitle:
      "Methodology B3 · HaarWaveletCNN (2D DWT Subband HL/LH/HH Learned Shrinkage Network)",
    cnnDesc:
      "Transforms the 14-bit frame via 2D Discrete Haar Wavelet Transform into half-resolution LL, HL (vertical lines), LH (horizontal lines), and HH (diagonal static) subbands. Learns subband shrinkage weights on HL/LH/HH while leaving the LL radiometric base untouched, then applies Inverse 2D DWT.",
    fpgaNote:
      "2×2 Haar DWT halves spatial dimensions (320×256 subbands), cutting CNN MAC throughput by 4× (~48 MACs/pixel equivalent) using only 2 line buffers per DWT stage.",
  },
  instance3: {
    lineTechniqueTitle:
      "Methodology C1 · 1D Cross-Bilateral Strip Filter + Motion-Gated Temporal Kalman Filter",
    lineTechniqueDesc:
      "Applies a radiometrically weighted 1D Cross-Bilateral filter across neighboring columns and rows coupled with a per-pixel 14-bit Motion-Gated Temporal Kalman filter (|I_t − I_{t-1}| < τ_motion). Stationary background gets strong static-line jitter smoothing, while moving targets immediately bypass temporal blending for zero ghosting trails.",
    enhanceTechniqueTitle:
      "Methodology C2 · Integral-Image (Summed-Area Table) Local Variance ACE Contrast Boost",
    enhanceTechniqueDesc:
      "Builds an O(1) Summed-Area Table to compute 13×13 local mean μ(x,y) and standard deviation σ(x,y) at every pixel. Applies bounded inverse-variance Adaptive Contrast Enhancement (ACE) so subtle cold-sky and warm-ground textures become simultaneously visible without global AGC pumping.",
    cnnTitle:
      "Methodology C3 · BurstTempCNN (Self-Supervised Orthogonal Stripe-Nulling CNN)",
    cnnDesc:
      "Addresses the core challenge where NO clean ground-truth video exists: trains self-supervised using an Orthogonal Stripe Projection Nulling + Edge-Weighted Total Variation loss directly on unpaired noisy 14-bit patches without needing clean target pairs.",
    fpgaNote:
      "Requires 1 external frame buffer (640×512×16-bit = 655 KiB SRAM/DDR) for the motion-gated temporal Kalman state plus 5 line buffers for spatial cross-bilateral + ACE.",
  },
};

export const ThermalClearHotInstanceView: React.FC<
  ThermalClearHotInstanceViewProps
> = ({
  methodology,
  instanceNumber,
  title,
  subtitle,
  badgeText,
  sharedBinFrames,
  sharedBinInfo,
  onSharedBinUpload,
  sharedPreset,
  onSharedPresetChange,
  sharedFrameIdx,
  onSharedFrameIdxChange,
  sharedPlaying,
  onSharedPlayingChange,
  onMetricsReport,
}) => {
  const [cfg, setCfg] = useState<IspConfig>(() => ({
    ...DEFAULT_ISP_CONFIGS[methodology],
  }));
  const [fullRes, setFullRes] = useState(true);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);
  const [showPyTorchModal, setShowPyTorchModal] = useState(false);

  // Live in-browser CNN state for this instance
  const [cnnState, setCnnState] = useState<CnnWeightsState>(() =>
    createInitialCnnState(methodology)
  );

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const exportCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const latestClean14Ref = useRef<Float32Array | null>(null);

  const lastFrameRef = useRef<string>("");
  const continuityRef = useRef<{source: string; frame: number; W: number} | null>(null);
  const prevBlackLevelRef = useRef<number>(7100);
  const prevWhiteLevelRef = useRef<number>(7950);
  const prevFrameFloatRef = useRef<Float32Array | null>(null);
  const prevKalman14Ref = useRef<Float32Array | null>(null);

  const [telemetryStats, setTelemetryStats] = useState<FrameTelemetryStats>({
    rawMin14: 7040,
    rawMax14: 14920,
    sceneSpanADU: 680,
    frameTimeMs: 4.2,
    colStripeResidual: 12.4,
    rowStripeResidual: 8.6,
    staticGrainMad: 6.1,
    thinFeatureRetentionPct: 96.4,
    hotTargetPeakPct: 98.8,
    haloOvershootIndex: 1.4,
    colProfileRaw: [],
    colProfileProc: [],
    rowProfileRaw: [],
    rowProfileProc: [],
  });

  // Handle real 640x512 uint16 little-endian .bin file upload
  const handleBinUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const framePixels = 640 * 512;
    const frameBytes = framePixels * 2;
    if (!file.size || file.size % frameBytes !== 0) {
      setUploadError(
        "File must contain whole 640 × 512 uint16 frames (655,360 bytes each). The new file was not loaded."
      );
      e.target.value = "";
      return;
    }
    if (file.size > 200 * 1024 * 1024) {
      setUploadError("File exceeds this demo’s 200 MiB memory limit.");
      e.target.value = "";
      return;
    }
    setUploadError(null);
    onSharedPlayingChange(false);
    setLoadingFile(true);
    try {
      const buf = await file.arrayBuffer();
      const data = new DataView(buf);
      const u16 = new Uint16Array(buf.byteLength / 2);
      let max16 = 0;
      let min16 = 65535;
      let highBitsCount = 0;
      let swappedMin = 65535;
      let swappedMax = 0;

      for (let i = 0; i < u16.length; i++) {
        const le = data.getUint16(i * 2, true);
        u16[i] = le;
        if (le > max16) max16 = le;
        if (le < min16) min16 = le;
        if ((le & 0xc000) !== 0) highBitsCount++;
        if (i < framePixels) {
          const be = data.getUint16(i * 2, false) & 0x3fff;
          if (be < swappedMin) swappedMin = be;
          if (be > swappedMax) swappedMax = be;
        }
      }
      const totalFrames = u16.length / framePixels;
      prevFrameFloatRef.current = null;
      prevKalman14Ref.current = null;
      prevBlackLevelRef.current = 7100;
      prevWhiteLevelRef.current = 7950;
      lastFrameRef.current = "";

      onSharedBinUpload(u16, {
        fileName: file.name,
        totalFrames,
        width: 640,
        height: 512,
        fileSizeBytes: file.size,
        maxRaw16Seen: max16,
        minRaw16Seen: min16,
        highBitsNonZeroPct: Number(((highBitsCount / u16.length) * 100).toFixed(2)),
        swappedEndiannessSpan: swappedMax - swappedMin,
      });
      onSharedFrameIdxChange(0);
    } catch (err) {
      setUploadError(
        `Could not read file: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setLoadingFile(false);
    }
  };

  // Render current 14-bit frame through pipeline
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = sharedBinInfo && fullRes ? 640 : 320;
    const H = sharedBinInfo && fullRes ? 512 : 256;
    canvas.width = W;
    canvas.height = H;

    const raw14 = extractOrSynthesizeFrame14(
      W,
      H,
      sharedFrameIdx,
      sharedPreset,
      sharedBinFrames,
      sharedBinInfo
    );

    const frameKey = `${sharedBinInfo?.fileName ?? sharedPreset}:${sharedFrameIdx}:${W}`;
    const sourceKey = sharedBinInfo ? `file:${sharedBinInfo.fileName}:${sharedBinInfo.fileSizeBytes}` : `synthetic:${sharedPreset}`;
    const old = continuityRef.current;
    if (old && (old.source !== sourceKey || old.W !== W || (sharedFrameIdx !== old.frame && sharedFrameIdx !== old.frame + 1))) {
      lastFrameRef.current = "";
      prevBlackLevelRef.current = 7100;
      prevWhiteLevelRef.current = 7950;
      prevFrameFloatRef.current = null;
      prevKalman14Ref.current = null;
    }
    continuityRef.current = {source: sourceKey, frame: sharedFrameIdx, W};

    const { processed8, leftBaseline8, stage1Clean14, telemetry } =
      runThermalInstancePipeline({
        methodology,
        raw14,
        W,
        H,
        cfg,
        cnnState,
        prevBlackRef: prevBlackLevelRef,
        prevWhiteRef: prevWhiteLevelRef,
        lastFrameKeyRef: lastFrameRef,
        prevNormFrameRef: prevFrameFloatRef,
        prevKalman14Ref,
        frameKey,
      });

    latestClean14Ref.current = stage1Clean14;

    const imgData = ctx.createImageData(W, H);
    const data = imgData.data;
    const processedData = ctx.createImageData(W, H);
    const wipeX = Math.floor((cfg.splitWipePct / 100) * W);

    for (let y = 0; y < H; y++) {
      const rowOff = y * W;
      for (let x = 0; x < W; x++) {
        const idx = rowOff + x;
        const procVal = processed8[idx];
        const p4 = idx * 4;

        processedData.data[p4] = procVal;
        processedData.data[p4 + 1] = procVal;
        processedData.data[p4 + 2] = procVal;
        processedData.data[p4 + 3] = 255;

        const dispVal = x < wipeX ? leftBaseline8[idx] : procVal;
        data[p4] = dispVal;
        data[p4 + 1] = dispVal;
        data[p4 + 2] = dispVal;
        data[p4 + 3] = 255;
      }
    }

    ctx.putImageData(imgData, 0, 0);
    if (!exportCanvasRef.current)
      exportCanvasRef.current = document.createElement("canvas");
    exportCanvasRef.current.width = W;
    exportCanvasRef.current.height = H;
    exportCanvasRef.current.getContext("2d")?.putImageData(processedData, 0, 0);

    // Draw split wipe divider line
    ctx.strokeStyle = "#22d3ee";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(wipeX, 0);
    ctx.lineTo(wipeX, H);
    ctx.stroke();

    setTelemetryStats(telemetry);
    if (onMetricsReport) {
      onMetricsReport(methodology, telemetry);
    }
  }, [
    sharedFrameIdx,
    sharedPreset,
    cfg,
    cnnState,
    sharedBinInfo,
    sharedBinFrames,
    fullRes,
    methodology,
  ]);

  const handleTrainCnn = () => {
    const updated = trainCnnInBrowser(cnnState, 35);
    setCnnState(updated);
    setCfg((c) => ({ ...c, enableLiveCnnResidual: true }));
  };

  const handleResetCnn = () => {
    setCnnState(createInitialCnnState(methodology));
    setCfg((c) => ({ ...c, enableLiveCnnResidual: false }));
  };

  // Export single processed 14-bit raw .bin frame (uint16 little-endian)
  const handleDownload14BitFrameBin = () => {
    const clean14 = latestClean14Ref.current;
    if (!clean14) return;
    const buf = new ArrayBuffer(clean14.length * 2);
    const dv = new DataView(buf);
    for (let i = 0; i < clean14.length; i++) {
      const clamped14 = Math.max(0, Math.min(16383, Math.round(clean14[i])));
      dv.setUint16(i * 2, clamped14, true);
    }
    const blob = new Blob([buf], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clearhot-${methodology}-frame-${sharedFrameIdx + 1}-14bit.bin`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const meta = METHODOLOGY_DESCRIPTIONS[methodology];

  return (
    <div className="space-y-6">
      {/* Instance Header Banner */}
      <div className="rounded-xl border border-cyan-500/30 bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/30 p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-cyan-500/20 border border-cyan-400/40 px-2.5 py-0.5 text-xs font-extrabold uppercase tracking-wider text-cyan-200">
                Instance #{instanceNumber}
              </span>
              <span className="text-xs font-bold uppercase tracking-widest text-rose-300">
                {badgeText}
              </span>
            </div>
            <h2 className="mt-2 text-2xl font-bold text-white">{title}</h2>
            <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-slate-300">
              {subtitle}
            </p>
          </div>

          {/* Real .bin uint16 Little-Endian Loader */}
          <div className="flex flex-col items-end gap-1.5">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-cyan-400/50 bg-cyan-500/15 px-4 py-2.5 text-xs font-bold text-cyan-200 shadow hover:bg-cyan-500/25">
              <FileUp className="h-4 w-4 text-cyan-300" />
              <span>
                {loadingFile
                  ? "Loading file into browser memory…"
                  : sharedBinInfo
                  ? `Loaded: ${sharedBinInfo.fileName} (${sharedBinInfo.totalFrames} frames)`
                  : "Load Real 640×512 uint16 .bin File"}
              </span>
              <input
                type="file"
                accept=".bin"
                onChange={handleBinUpload}
                className="hidden"
              />
            </label>
            {uploadError && (
              <span role="alert" className="text-xs text-rose-300">
                {uploadError}
              </span>
            )}
            {sharedBinInfo && (
              <span className="text-[11px] font-mono text-slate-400">
                Raw uint16 range: {sharedBinInfo.minRaw16Seen}–{sharedBinInfo.maxRaw16Seen} ·
                Bits 14–15 non-zero: {sharedBinInfo.highBitsNonZeroPct}%
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Split Workbench */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left: Interactive Split-Screen Thermal Video Canvas + Telemetry Profiles */}
        <div className="space-y-4 lg:col-span-7">
          <div className="rounded-xl border border-slate-700/80 bg-slate-950 p-4">
            {/* Preset & Stream Controls */}
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  onClick={() => onSharedPlayingChange(!sharedPlaying)}
                  className="inline-flex items-center gap-1 rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-400"
                >
                  {sharedPlaying ? (
                    <Pause className="h-3.5 w-3.5" />
                  ) : (
                    <Play className="h-3.5 w-3.5" />
                  )}
                  {sharedPlaying ? "Pause stream" : "Play Stream"}
                </button>
                {(
                  [
                    ["shahed_intercept", "Syn 1: Hot object"],
                    ["horizon_pan", "Syn 2: Horizon pan"],
                    ["burning_convoy", "Syn 3: Hot scene"],
                    ["stripe_vs_scene_wire", "Test 4: Wire vs Stripe Trap"],
                    ["multi_freq_grid_fpn", "Test 5: Heavy Parallel Static"],
                    ["point_target_and_badpx", "Test 6: 1px/2px Hot Targets"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => {
                      prevFrameFloatRef.current = null;
                      prevKalman14Ref.current = null;
                      lastFrameRef.current = "";
                      onSharedFrameIdxChange(0);
                      onSharedPresetChange(key);
                    }}
                    className={`rounded-lg border px-2 py-1 text-[11px] font-bold transition ${
                      sharedPreset === key && !sharedBinInfo
                        ? "border-cyan-400 bg-cyan-500/20 text-cyan-200"
                        : "border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <span className="font-mono text-xs text-emerald-400">
                {telemetryStats.frameTimeMs} ms/render ·{" "}
                {sharedBinInfo && fullRes ? "640×512" : "320×256"} · JS render time
              </span>
            </div>

            {/* Canvas Container */}
            <div className="relative overflow-hidden rounded-lg border border-slate-800 bg-black">
              <canvas
                ref={canvasRef}
                width={sharedBinInfo && fullRes ? 640 : 320}
                height={sharedBinInfo && fullRes ? 512 : 256}
                className="aspect-[640/512] w-full image-render-pixelated"
              />
              <div className="pointer-events-none absolute top-2.5 left-3 rounded bg-slate-950/85 px-2 py-1 font-mono text-[10px] font-bold text-rose-300 border border-rose-500/30">
                ◀{" "}
                {cfg.leftBaselineMode === "original_clearhot"
                  ? "ORIGINAL CLEARHOT BASELINE"
                  : "BASELINE · PER-FRAME MIN–MAX"}
              </div>
              <div className="pointer-events-none absolute top-2.5 right-3 rounded bg-slate-950/85 px-2 py-1 font-mono text-[10px] font-bold text-emerald-300 border border-emerald-500/30">
                INSTANCE #{instanceNumber} PROCESSED · WHITE-HOT ▶
              </div>
              {cfg.enableLiveCnnResidual && (
                <div className="pointer-events-none absolute bottom-2.5 right-3 rounded bg-violet-950/90 px-2 py-0.5 font-mono text-[10px] font-bold text-violet-200 border border-violet-400/50">
                  CNN RESIDUAL ACTIVE ({cnnState.trainedEpochs} ep)
                </div>
              )}
            </div>

            {/* Split Wipe Slider + Left Baseline Selector */}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-60 flex-1 items-center gap-3">
                <Eye className="h-4 w-4 text-cyan-400" />
                <span className="text-xs font-semibold text-slate-300">
                  Split Wipe ({cfg.splitWipePct}%):
                </span>
                <input
                  aria-label="Before / after split"
                  type="range"
                  min={0}
                  max={100}
                  value={cfg.splitWipePct}
                  onChange={(e) =>
                    setCfg((c) => ({ ...c, splitWipePct: Number(e.target.value) }))
                  }
                  className="h-1.5 flex-1 cursor-pointer accent-cyan-400"
                />
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400">Left side reference:</span>
                <select
                  aria-label="Left baseline mode"
                  value={cfg.leftBaselineMode}
                  onChange={(e) =>
                    setCfg((c) => ({
                      ...c,
                      leftBaselineMode: e.target.value as
                        | "naive_minmax"
                        | "original_clearhot",
                    }))
                  }
                  className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-semibold text-cyan-200"
                >
                  <option value="naive_minmax">Per-Frame Linear Min–Max</option>
                  <option value="original_clearhot">
                    Original Unmodified ClearHot
                  </option>
                </select>
              </div>
            </div>

            {/* Export & Resolution Controls */}
            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-300">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={fullRes}
                  onChange={(e) => {
                    setFullRes(e.target.checked);
                    prevFrameFloatRef.current = null;
                    prevKalman14Ref.current = null;
                    lastFrameRef.current = "";
                  }}
                />
                Full resolution (640×512) for uploaded files
              </label>
              <button
                onClick={() => {
                  const a = document.createElement("a");
                  a.href = exportCanvasRef.current?.toDataURL("image/png") ?? "";
                  a.download = `clearhot-${methodology}-frame-${
                    sharedFrameIdx + 1
                  }.png`;
                  a.click();
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-400/50 bg-cyan-500/10 px-3 py-1.5 font-bold text-cyan-200 hover:bg-cyan-500/20"
              >
                <Download className="h-3.5 w-3.5" />
                Save 8-bit PNG
              </button>
              <button
                onClick={handleDownload14BitFrameBin}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-3 py-1.5 font-bold text-emerald-200 hover:bg-emerald-500/20"
              >
                <Download className="h-3.5 w-3.5" />
                Save 14-bit Destriped Frame (.bin)
              </button>
            </div>

            {/* Frame Seek Slider */}
            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-300">
              <label htmlFor={`frame-seek-${methodology}`}>
                Frame {sharedFrameIdx + 1} / {sharedBinInfo?.totalFrames ?? 60}
              </label>
              <input
                id={`frame-seek-${methodology}`}
                aria-label="Frame"
                type="range"
                min={0}
                max={(sharedBinInfo?.totalFrames ?? 60) - 1}
                value={sharedFrameIdx}
                onChange={(e) => {
                  onSharedPlayingChange(false);
                  onSharedFrameIdxChange(Number(e.target.value));
                  prevFrameFloatRef.current = null;
                  prevKalman14Ref.current = null;
                  lastFrameRef.current = "";
                }}
                className="min-w-36 flex-1 accent-cyan-400"
              />
              <span className="font-mono">
                14-bit Input: {telemetryStats.rawMin14}–{telemetryStats.rawMax14} ADU
              </span>
            </div>

            {/* Live Quantitative Proxy Metrics Strip */}
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              <div className="rounded-lg border border-slate-800 bg-slate-900/90 p-2.5">
                <div className="text-[10px] font-bold uppercase text-slate-400">
                  Col Stripe σ (Flat ROI)
                </div>
                <div className="mt-1 font-mono text-sm font-bold text-cyan-300">
                  {telemetryStats.colStripeResidual} ADU
                </div>
                <div className="text-[10px] text-slate-500">Lower = less vert line</div>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900/90 p-2.5">
                <div className="text-[10px] font-bold uppercase text-slate-400">
                  Row Stripe σ (Flat ROI)
                </div>
                <div className="mt-1 font-mono text-sm font-bold text-cyan-300">
                  {telemetryStats.rowStripeResidual} ADU
                </div>
                <div className="text-[10px] text-slate-500">Lower = less horiz line</div>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900/90 p-2.5">
                <div className="text-[10px] font-bold uppercase text-slate-400">
                  Static Grain MAD
                </div>
                <div className="mt-1 font-mono text-sm font-bold text-emerald-300">
                  {telemetryStats.staticGrainMad} ADU
                </div>
                <div className="text-[10px] text-slate-500">3×3 flat-ROI residual</div>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900/90 p-2.5">
                <div className="text-[10px] font-bold uppercase text-slate-400">
                  Structure Retention
                </div>
                <div className="mt-1 font-mono text-sm font-bold text-amber-300">
                  {telemetryStats.thinFeatureRetentionPct}%
                </div>
                <div className="text-[10px] text-slate-500">Higher = edges safe</div>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900/90 p-2.5">
                <div className="text-[10px] font-bold uppercase text-slate-400">
                  Hot Target Peak
                </div>
                <div className="mt-1 font-mono text-sm font-bold text-rose-300">
                  {telemetryStats.hotTargetPeakPct}%
                </div>
                <div className="text-[10px] text-slate-500">Peak 8-bit headroom</div>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900/90 p-2.5">
                <div className="text-[10px] font-bold uppercase text-slate-400">
                  Halo Overshoot Proxy
                </div>
                <div className="mt-1 font-mono text-sm font-bold text-violet-300">
                  {telemetryStats.haloOvershootIndex}
                </div>
                <div className="text-[10px] text-slate-500">Lower = fewer halos</div>
              </div>
            </div>

            {/* Live Column & Row Stripe Profile Sparklines (Before vs After Destriping) */}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-slate-300">
                    Flat-ROI Column Mean Profile (Vertical Stripes)
                  </span>
                  <span className="font-mono text-[10px] text-cyan-300">
                    Rose: Raw · Cyan: Destriped
                  </span>
                </div>
                <ProfileSparkline
                  rawProfile={telemetryStats.colProfileRaw}
                  procProfile={telemetryStats.colProfileProc}
                />
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-slate-300">
                    Flat-ROI Row Mean Profile (Horizontal Lines)
                  </span>
                  <span className="font-mono text-[10px] text-cyan-300">
                    Rose: Raw · Cyan: Destriped
                  </span>
                </div>
                <ProfileSparkline
                  rawProfile={telemetryStats.rowProfileRaw}
                  procProfile={telemetryStats.rowProfileProc}
                />
              </div>
            </div>
          </div>

          {/* Interactive CNN Exploration & Live 14-Bit Training Sandbox for this Instance */}
          <div className="rounded-xl border border-violet-500/35 bg-gradient-to-br from-slate-900 via-slate-950 to-violet-950/25 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-violet-300">
                  <BrainCircuit className="h-4 w-4 text-violet-400" />
                  <span>{meta.cnnTitle}</span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
                  {meta.cnnDesc}
                </p>
              </div>
              <button
                onClick={() => setShowPyTorchModal((s) => !s)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-violet-400/40 bg-violet-500/15 px-3 py-1.5 text-xs font-bold text-violet-200 hover:bg-violet-500/25"
              >
                <Code2 className="h-3.5 w-3.5" />
                {showPyTorchModal ? "Hide PyTorch MPS Script" : "View PyTorch MPS/CPU Script"}
              </button>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                onClick={handleTrainCnn}
                className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3.5 py-2 text-xs font-bold text-white shadow hover:bg-violet-500"
              >
                <Zap className="h-3.5 w-3.5" />
                {cnnState.isTrained
                  ? "Train +35 More Epochs in Browser"
                  : "Train 35 Epochs in Browser (14-Bit Patches)"}
              </button>
              <button
                onClick={handleResetCnn}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300 hover:border-slate-500"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset Weights
              </button>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-violet-400/40 bg-violet-950/40 px-3 py-2 text-xs font-bold text-violet-200">
                <input
                  type="checkbox"
                  checked={cfg.enableLiveCnnResidual}
                  onChange={(e) =>
                    setCfg((c) => ({
                      ...c,
                      enableLiveCnnResidual: e.target.checked,
                    }))
                  }
                  className="h-4 w-4 accent-violet-400"
                />
                Apply Live 14-Bit CNN Residual on Canvas
              </label>
            </div>

            {/* CNN Training Telemetry & Blend Slider */}
            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-2.5 text-xs">
                <span className="text-slate-400">Status / Epochs:</span>
                <div className="mt-1 font-mono font-bold text-white">
                  {cnnState.isTrained
                    ? `Trained (${cnnState.trainedEpochs} ep · ${cnnState.lastTrainTimeMs} ms)`
                    : "Untrained (Init Weights)"}
                </div>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-2.5 text-xs">
                <span className="text-slate-400">Train Patch RMSE:</span>
                <div className="mt-1 font-mono font-bold text-emerald-300">
                  {cnnState.isTrained
                    ? `${cnnState.initialLoss} → ${cnnState.currentLoss} ADU`
                    : "Run training to measure"}
                </div>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-2.5 text-xs">
                <span className="text-slate-400">Held-Out Scene Val RMSE:</span>
                <div className="mt-1 font-mono font-bold text-cyan-300">
                  {cnnState.isTrained
                    ? `${cnnState.valLoss} ADU`
                    : "Not evaluated yet"}
                </div>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-2.5 text-xs">
                <label className="block text-slate-300">
                  CNN Residual Blend: {cfg.cnnBlendStrength.toFixed(2)}
                  <input
                    type="range"
                    min={0}
                    max={1.2}
                    step={0.05}
                    value={cfg.cnnBlendStrength}
                    onChange={(e) =>
                      setCfg((c) => ({
                        ...c,
                        cnnBlendStrength: Number(e.target.value),
                      }))
                    }
                    className="mt-1.5 w-full accent-violet-400"
                  />
                </label>
              </div>
            </div>

            <p className="mt-3 text-[11px] leading-relaxed text-amber-200/90">
              <strong>Evidence boundary:</strong> In-browser training optimizes a{" "}
              {cnnState.paramCount}-parameter residual kernel on synthetic 64×64
              14-bit patches (with separate scene geometry and stripe periods for
              validation) to demonstrate pre-tone-map residual subtraction. It is
              a working algorithmic prototype, not a large-scale model trained on
              proprietary challenge ground truth. {meta.fpgaNote}
            </p>

            {showPyTorchModal && (
              <div className="mt-4 rounded-xl border border-slate-700 bg-slate-950 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-violet-300">
                    train_{methodology}_mps.py (Apple Silicon MPS / CPU)
                  </span>
                  <button
                    onClick={() => {
                      const blob = new Blob(
                        [getPyTorchScriptForMethodology(methodology)],
                        { type: "text/x-python" }
                      );
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `train_${methodology}_mps.py`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="inline-flex items-center gap-1 rounded bg-violet-500/20 px-2.5 py-1 text-xs font-bold text-violet-200 hover:bg-violet-500/30"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download .py Script
                  </button>
                </div>
                <pre className="max-h-72 overflow-auto rounded-lg bg-black/80 p-3 font-mono text-[11px] leading-relaxed text-slate-200">
                  {getPyTorchScriptForMethodology(methodology)}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* Right: Existing 4-Stage Pipeline Controls + Instance-Specific Methodology Controls */}
        <div className="space-y-4 lg:col-span-5">
          {/* Instance-Specific Additional Methodology Controls */}
          <div className="rounded-xl border border-cyan-500/40 bg-slate-900/95 p-4 space-y-4 shadow-lg">
            <div className="flex items-center justify-between">
              <h4 className="flex items-center gap-2 text-sm font-bold text-cyan-200">
                <Sparkles className="h-4 w-4 text-cyan-400" />
                Instance #{instanceNumber} Additional Techniques
              </h4>
              <span className="rounded bg-cyan-500/15 px-2 py-0.5 font-mono text-[10px] font-bold text-cyan-300">
                ON TOP OF EXISTING PIPELINE
              </span>
            </div>

            {/* Toggle 1: Instance Parallel Line & Static Technique */}
            <div className="rounded-lg border border-slate-800 bg-slate-950/90 p-3 space-y-2.5">
              <label className="flex cursor-pointer items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-white">
                    {meta.lineTechniqueTitle}
                  </div>
                  <div className="mt-1 text-[11px] leading-relaxed text-slate-400">
                    {meta.lineTechniqueDesc}
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={cfg.enableMethodologyDestripe}
                  onChange={(e) =>
                    setCfg((c) => ({
                      ...c,
                      enableMethodologyDestripe: e.target.checked,
                    }))
                  }
                  className="mt-1 h-4 w-4 accent-cyan-400"
                />
              </label>

              {/* Instance-specific line/static sliders */}
              {methodology === "instance1" && cfg.enableMethodologyDestripe && (
                <div className="space-y-2 border-t border-slate-800 pt-2.5 text-xs">
                  <label className="block text-slate-200">
                    Edge-Gate Structure Protection Threshold:{" "}
                    <span className="font-mono font-bold text-cyan-300">
                      {cfg.edgeGateThresholdADU} ADU
                    </span>
                    <input
                      type="range"
                      min={40}
                      max={320}
                      step={5}
                      value={cfg.edgeGateThresholdADU}
                      onChange={(e) =>
                        setCfg((c) => ({
                          ...c,
                          edgeGateThresholdADU: Number(e.target.value),
                        }))
                      }
                      className="mt-1 w-full accent-cyan-400"
                    />
                  </label>
                  <label className="flex items-center justify-between text-slate-300 pt-1">
                    <span>8-Neighbor Rank Gate (protects 2×2 hot drones)</span>
                    <input
                      type="checkbox"
                      checked={cfg.rankImpulseProtection}
                      onChange={(e) =>
                        setCfg((c) => ({
                          ...c,
                          rankImpulseProtection: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 accent-cyan-400"
                    />
                  </label>
                </div>
              )}

              {methodology === "instance2" && cfg.enableMethodologyDestripe && (
                <div className="space-y-2 border-t border-slate-800 pt-2.5 text-xs">
                  <label className="block text-slate-200">
                    1D Haar Wavelet Garrote Shrinkage Threshold:{" "}
                    <span className="font-mono font-bold text-cyan-300">
                      {cfg.waveletShrinkThreshold} ADU
                    </span>
                    <input
                      type="range"
                      min={12}
                      max={110}
                      step={2}
                      value={cfg.waveletShrinkThreshold}
                      onChange={(e) =>
                        setCfg((c) => ({
                          ...c,
                          waveletShrinkThreshold: Number(e.target.value),
                        }))
                      }
                      className="mt-1 w-full accent-cyan-400"
                    />
                  </label>
                  <label className="block text-slate-200">
                    Periodic Spectral Comb & Static Grain Damping:{" "}
                    <span className="font-mono font-bold text-cyan-300">
                      {cfg.spectralCombNotch.toFixed(2)}
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={cfg.spectralCombNotch}
                      onChange={(e) =>
                        setCfg((c) => ({
                          ...c,
                          spectralCombNotch: Number(e.target.value),
                        }))
                      }
                      className="mt-1 w-full accent-cyan-400"
                    />
                  </label>
                </div>
              )}

              {methodology === "instance3" && cfg.enableMethodologyDestripe && (
                <div className="space-y-2 border-t border-slate-800 pt-2.5 text-xs">
                  <label className="block text-slate-200">
                    1D Cross-Bilateral Radiometric Sigma (σ_r):{" "}
                    <span className="font-mono font-bold text-cyan-300">
                      {cfg.bilateralRangeSigmaADU} ADU
                    </span>
                    <input
                      type="range"
                      min={30}
                      max={260}
                      step={5}
                      value={cfg.bilateralRangeSigmaADU}
                      onChange={(e) =>
                        setCfg((c) => ({
                          ...c,
                          bilateralRangeSigmaADU: Number(e.target.value),
                        }))
                      }
                      className="mt-1 w-full accent-cyan-400"
                    />
                  </label>
                  <label className="block text-slate-200">
                    Kalman Motion-Gate Threshold (anti-ghosting):{" "}
                    <span className="font-mono font-bold text-cyan-300">
                      {cfg.kalmanMotionGateADU} ADU
                    </span>
                    <input
                      type="range"
                      min={20}
                      max={250}
                      step={5}
                      value={cfg.kalmanMotionGateADU}
                      onChange={(e) =>
                        setCfg((c) => ({
                          ...c,
                          kalmanMotionGateADU: Number(e.target.value),
                        }))
                      }
                      className="mt-1 w-full accent-cyan-400"
                    />
                  </label>
                  <label className="block text-slate-200">
                    Static Background Temporal Smoothing (α):{" "}
                    <span className="font-mono font-bold text-cyan-300">
                      {cfg.kalmanTemporalAlpha.toFixed(2)}
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={0.85}
                      step={0.05}
                      value={cfg.kalmanTemporalAlpha}
                      onChange={(e) =>
                        setCfg((c) => ({
                          ...c,
                          kalmanTemporalAlpha: Number(e.target.value),
                        }))
                      }
                      className="mt-1 w-full accent-cyan-400"
                    />
                  </label>
                </div>
              )}
            </div>

            {/* Toggle 2: Instance Digital Picture Enhancement Technique */}
            <div className="rounded-lg border border-slate-800 bg-slate-950/90 p-3 space-y-2.5">
              <label className="flex cursor-pointer items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-white">
                    {meta.enhanceTechniqueTitle}
                  </div>
                  <div className="mt-1 text-[11px] leading-relaxed text-slate-400">
                    {meta.enhanceTechniqueDesc}
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={cfg.enableMethodologyEnhancement}
                  onChange={(e) =>
                    setCfg((c) => ({
                      ...c,
                      enableMethodologyEnhancement: e.target.checked,
                    }))
                  }
                  className="mt-1 h-4 w-4 accent-emerald-400"
                />
              </label>

              {methodology === "instance1" && cfg.enableMethodologyEnhancement && (
                <div className="space-y-2 border-t border-slate-800 pt-2.5 text-xs">
                  <label className="block text-slate-200">
                    Dual-Plateau Histogram Equalization Blend:{" "}
                    <span className="font-mono font-bold text-emerald-300">
                      {(cfg.dualPlateauBlend * 100).toFixed(0)}%
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={0.85}
                      step={0.05}
                      value={cfg.dualPlateauBlend}
                      onChange={(e) =>
                        setCfg((c) => ({
                          ...c,
                          dualPlateauBlend: Number(e.target.value),
                        }))
                      }
                      className="mt-1 w-full accent-emerald-400"
                    />
                  </label>
                  <label className="block text-slate-200">
                    2-Scale DoG Static-Grain Deadzone Coring:{" "}
                    <span className="font-mono font-bold text-emerald-300">
                      {cfg.dogNoiseCoring.toFixed(1)} DN
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={10}
                      step={0.5}
                      value={cfg.dogNoiseCoring}
                      onChange={(e) =>
                        setCfg((c) => ({
                          ...c,
                          dogNoiseCoring: Number(e.target.value),
                        }))
                      }
                      className="mt-1 w-full accent-emerald-400"
                    />
                  </label>
                </div>
              )}

              {methodology === "instance2" && cfg.enableMethodologyEnhancement && (
                <div className="space-y-2 border-t border-slate-800 pt-2.5 text-xs">
                  <label className="block text-slate-200">
                    Guided Filter Edge Regularization (ε):{" "}
                    <span className="font-mono font-bold text-emerald-300">
                      {cfg.guidedFilterEps} ADU²
                    </span>
                    <input
                      type="range"
                      min={400}
                      max={6000}
                      step={200}
                      value={cfg.guidedFilterEps}
                      onChange={(e) =>
                        setCfg((c) => ({
                          ...c,
                          guidedFilterEps: Number(e.target.value),
                        }))
                      }
                      className="mt-1 w-full accent-emerald-400"
                    />
                  </label>
                  <label className="block text-slate-200">
                    Base-Layer S-Curve Dynamic Contrast:{" "}
                    <span className="font-mono font-bold text-emerald-300">
                      {cfg.sCurveContrast.toFixed(2)}
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={0.8}
                      step={0.04}
                      value={cfg.sCurveContrast}
                      onChange={(e) =>
                        setCfg((c) => ({
                          ...c,
                          sCurveContrast: Number(e.target.value),
                        }))
                      }
                      className="mt-1 w-full accent-emerald-400"
                    />
                  </label>
                </div>
              )}

              {methodology === "instance3" && cfg.enableMethodologyEnhancement && (
                <div className="space-y-2 border-t border-slate-800 pt-2.5 text-xs">
                  <label className="block text-slate-200">
                    Integral-Image Local Variance ACE Strength:{" "}
                    <span className="font-mono font-bold text-emerald-300">
                      {cfg.localAceStrength.toFixed(2)}
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={0.95}
                      step={0.05}
                      value={cfg.localAceStrength}
                      onChange={(e) =>
                        setCfg((c) => ({
                          ...c,
                          localAceStrength: Number(e.target.value),
                        }))
                      }
                      className="mt-1 w-full accent-emerald-400"
                    />
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* Original 4-Stage Pipeline Controls (Preserved from ThermalClearHotView) */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-4 space-y-3">
            <h4 className="flex items-center gap-2 text-sm font-bold text-white">
              <Layers className="h-4 w-4 text-rose-400" />
              Existing ClearHot 4-Stage Pipeline Controls
            </h4>
            <p className="text-xs text-slate-400">
              Underlying pipeline stages preserved from ClearHot Lab. Toggle individual stages to isolate their contribution.
            </p>

            {/* Stage 1 */}
            <label className="flex cursor-pointer items-start justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/80 p-3 hover:border-slate-700">
              <div>
                <div className="text-xs font-bold text-white">
                  Stage 1: Bad-Pixel Outlier Clamp & Column/Row FPN Destriping
                </div>
                <div className="mt-0.5 text-[11px] text-slate-400">
                  Master enable for Stage 1 line suppression and bad-pixel replacement.
                </div>
              </div>
              <input
                type="checkbox"
                checked={cfg.stage1DestripeAndBadPx}
                onChange={(e) =>
                  setCfg((c) => ({
                    ...c,
                    stage1DestripeAndBadPx: e.target.checked,
                  }))
                }
                className="mt-1 h-4 w-4 accent-emerald-400"
              />
            </label>

            {/* Stage 2 */}
            <label className="flex cursor-pointer items-start justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/80 p-3 hover:border-slate-700">
              <div>
                <div className="text-xs font-bold text-white">
                  Stage 2: Temporal Hysteresis Quantile AGC (±{cfg.agcSlewLimitADU}{" "}
                  ADU/frame max slew)
                </div>
                <div className="mt-0.5 text-[11px] text-slate-400">
                  Limits frame-to-frame contrast jumps during sudden thermal flares.
                </div>
              </div>
              <input
                type="checkbox"
                checked={cfg.stage2TemporalQuantileAgc}
                onChange={(e) =>
                  setCfg((c) => ({
                    ...c,
                    stage2TemporalQuantileAgc: e.target.checked,
                  }))
                }
                className="mt-1 h-4 w-4 accent-emerald-400"
              />
            </label>

            {/* Stage 3 */}
            <label className="flex cursor-pointer items-start justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/80 p-3 hover:border-slate-700">
              <div>
                <div className="text-xs font-bold text-white">
                  Stage 3: Upper Quantile Ceiling Compression (97.5% vs 99.9%)
                </div>
                <div className="mt-0.5 text-[11px] text-slate-400">
                   allocates 0–232 DN to ambient terrain and 232–255 DN soft shoulder to extreme hot targets.
                </div>
              </div>
              <input
                type="checkbox"
                checked={cfg.stage3DualPlateauCompression}
                onChange={(e) =>
                  setCfg((c) => ({
                    ...c,
                    stage3DualPlateauCompression: e.target.checked,
                  }))
                }
                className="mt-1 h-4 w-4 accent-emerald-400"
              />
            </label>

            {/* Stage 4 */}
            <label className="flex cursor-pointer items-start justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/80 p-3 hover:border-slate-700">
              <div>
                <div className="text-xs font-bold text-white">
                  Stage 4: Edge-Preserving Clamped Detail Boost (Gain{" "}
                  {cfg.detailGain.toFixed(1)}×)
                </div>
                <div className="mt-0.5 text-[11px] text-slate-400">
                  Boosts local high-frequency detail with ±18 DN halo clamp.
                </div>
              </div>
              <input
                type="checkbox"
                checked={cfg.stage4EdgePreservingDetail}
                onChange={(e) =>
                  setCfg((c) => ({
                    ...c,
                    stage4EdgePreservingDetail: e.target.checked,
                  }))
                }
                className="mt-1 h-4 w-4 accent-emerald-400"
              />
            </label>

            {/* Stage 5 */}
            <label className="flex cursor-pointer items-start justify-between gap-3 rounded-lg border border-cyan-500/30 bg-cyan-950/20 p-3">
              <div>
                <div className="text-xs font-bold text-cyan-200">
                  Spatial-only mode (uncheck to demonstrate naive IIR ghosting)
                </div>
                <div className="mt-0.5 text-[11px] text-slate-300">
                  Avoids un-gated 8-bit IIR frame blending.
                </div>
              </div>
              <input
                type="checkbox"
                checked={cfg.antiGhostingPureSpatial}
                onChange={(e) =>
                  setCfg((c) => ({
                    ...c,
                    antiGhostingPureSpatial: e.target.checked,
                  }))
                }
                className="mt-1 h-4 w-4 accent-cyan-400"
              />
            </label>
          </div>

          {/* Line Correction & Detail Sliders */}
          <div className="rounded-xl border border-slate-700 bg-slate-900 p-4 space-y-4">
            <h4 className="flex items-center gap-2 text-sm font-bold text-white">
              <Sliders className="h-4 w-4 text-cyan-400" />
              Line correction & detail sliders
            </h4>
            <label className="block text-xs text-slate-200">
              Vertical lines / column correction: {cfg.verticalStrength.toFixed(2)}
              <input
                aria-label="Vertical line correction"
                type="range"
                min="0"
                max="1.2"
                step="0.05"
                value={cfg.verticalStrength}
                onChange={(e) =>
                  setCfg((c) => ({
                    ...c,
                    verticalStrength: Number(e.target.value),
                  }))
                }
                className="mt-2 w-full accent-cyan-400"
              />
            </label>
            <label className="block text-xs text-slate-200">
              Horizontal lines / row correction:{" "}
              {cfg.horizontalStrength.toFixed(2)}
              <input
                aria-label="Horizontal line correction"
                type="range"
                min="0"
                max="1.2"
                step="0.05"
                value={cfg.horizontalStrength}
                onChange={(e) =>
                  setCfg((c) => ({
                    ...c,
                    horizontalStrength: Number(e.target.value),
                  }))
                }
                className="mt-2 w-full accent-cyan-400"
              />
            </label>
            <label className="block text-xs text-slate-200">
              Detail gain: {cfg.detailGain.toFixed(1)}×
              <input
                aria-label="Detail gain"
                type="range"
                min="1"
                max="3"
                step="0.1"
                value={cfg.detailGain}
                onChange={(e) =>
                  setCfg((c) => ({
                    ...c,
                    detailGain: Number(e.target.value),
                  }))
                }
                className="mt-2 w-full accent-cyan-400"
              />
            </label>
            <p className="text-xs leading-relaxed text-amber-200">
              Tip: Select <strong>Test 4: Wire vs Stripe Trap</strong> above to verify that
              this instance suppresses parallel background stripes while preserving the
              genuine 1-pixel vertical mast (at x=78%) and 1-pixel horizontal wire (at
              y=28%).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Lightweight SVG sparkline comparing raw vs destriped 1D row/column profiles
 */
const ProfileSparkline: React.FC<{
  rawProfile: number[];
  procProfile: number[];
}> = ({ rawProfile, procProfile }) => {
  if (!rawProfile.length || !procProfile.length) {
    return <div className="h-12" />;
  }
  const all = [...rawProfile, ...procProfile];
  let min = Infinity;
  let max = -Infinity;
  for (const v of all) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const span = Math.max(10, max - min);
  const W = 260;
  const H = 48;

  const toPoints = (arr: number[]) =>
    arr
      .map((v, i) => {
        const x = (i / Math.max(1, arr.length - 1)) * W;
        const y = H - 4 - ((v - min) / span) * (H - 8);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="mt-1.5 h-12 w-full overflow-visible rounded bg-slate-950/90 p-1"
    >
      <polyline
        fill="none"
        stroke="#fb7185"
        strokeWidth="1.3"
        strokeOpacity="0.7"
        points={toPoints(rawProfile)}
      />
      <polyline
        fill="none"
        stroke="#22d3ee"
        strokeWidth="1.6"
        points={toPoints(procProfile)}
      />
    </svg>
  );
};

import React, { useState, useEffect, useCallback } from "react";
import {
  Award,
  Columns3,
  FileUp,
  Layers,
  Pause,
  Play,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  CustomBinInfo,
  FrameTelemetryStats,
  MethodologyId,
  SequencePreset,
} from "./types/thermal";
import { ThermalClearHotInstanceView } from "./components/ThermalClearHotInstanceView";
import { AuditAndComparisonPanel } from "./components/AuditAndComparisonPanel";

type ActiveTab = "all3" | "inst1" | "inst2" | "inst3" | "audit" | "guide";

export function App() {
  const [tab, setTab] = useState<ActiveTab>("inst1");
  const [sharedPreset, setSharedPreset] =
    useState<SequencePreset>("shahed_intercept");
  const [sharedFrameIdx, setSharedFrameIdx] = useState<number>(0);
  const [sharedPlaying, setSharedPlaying] = useState<boolean>(false);
  const [sharedBinFrames, setSharedBinFrames] = useState<Uint16Array | null>(
    null
  );
  const [sharedBinInfo, setSharedBinInfo] = useState<CustomBinInfo | null>(null);
  const [fileRevision, setFileRevision] = useState(0);
  const [globalUploadError, setGlobalUploadError] = useState<string | null>(
    null
  );
  const [globalLoading, setGlobalLoading] = useState<boolean>(false);

  const [metricsMap, setMetricsMap] = useState<
    Record<MethodologyId, FrameTelemetryStats | null>
  >({
    instance1: null,
    instance2: null,
    instance3: null,
  });

  // Shared playback timer across all 3 instances (~12-15 fps preview)
  useEffect(() => {
    if (!sharedPlaying) return;
    const id = window.setInterval(() => {
      setSharedFrameIdx((f) => {
        const maxF = sharedBinInfo ? sharedBinInfo.totalFrames : 60;
        return (f + 1) % Math.max(1, maxF);
      });
    }, 90);
    return () => window.clearInterval(id);
  }, [sharedPlaying, sharedBinInfo]);

  const handleSharedBinUpload = useCallback(
    (frames: Uint16Array, info: CustomBinInfo) => {
      setFileRevision(v => v + 1);
      setSharedBinFrames(frames);
      setSharedBinInfo(info);
      setSharedFrameIdx(0);
      setSharedPlaying(false);
    },
    []
  );

  const handleGlobalFileLoad = async (file: File | undefined) => {
    if (!file) return false;
    const framePixels = 640 * 512;
    const frameBytes = framePixels * 2;
    if (!file.size || file.size % frameBytes !== 0) {
      setGlobalUploadError(
        "File must contain whole 640 × 512 uint16 frames (655,360 bytes each). The file was not loaded."
      );
      return false;
    }
    if (file.size > 200 * 1024 * 1024) {
      setGlobalUploadError("File exceeds this demo’s 200 MiB memory limit.");
      return false;
    }
    setGlobalUploadError(null);
    setSharedPlaying(false);
    setGlobalLoading(true);
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
      handleSharedBinUpload(u16, {
        fileName: file.name,
        totalFrames,
        width: 640,
        height: 512,
        fileSizeBytes: file.size,
        maxRaw16Seen: max16,
        minRaw16Seen: min16,
        highBitsNonZeroPct: Number(
          ((highBitsCount / u16.length) * 100).toFixed(2)
        ),
        swappedEndiannessSpan: swappedMax - swappedMin,
      });
      return true;
    } catch (err) {
      setGlobalUploadError(
        `Could not read file: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
      return false;
    } finally {
      setGlobalLoading(false);
    }
  };

  const handleGlobalFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.currentTarget.files?.[0];
    e.currentTarget.value = "";
    void handleGlobalFileLoad(f);
  };
  // Integration bridge for the local six-method comparison shell.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window.parent || event.data?.channel !== "six-thermal-v1") return;
      const d = event.data;
      if (d.kind === "select" && ["inst1", "inst2", "inst3", "all3", "audit"].includes(d.tab)) { setTab(d.tab); setSharedPlaying(false); }
      if (d.kind === "frame" && Number.isInteger(d.frame) && d.frame >= 0) { setSharedFrameIdx(d.frame); setSharedPlaying(false); }
      if (d.kind === "file" && d.file instanceof File) { void handleGlobalFileLoad(d.file).then(ok => window.parent.postMessage({channel:"six-thermal-v1",kind:"loaded",engine:"argos",ok,fileName:d.file.name}, "*")); }
    };
    window.addEventListener("message", onMessage);
    window.parent.postMessage({channel:"six-thermal-v1",kind:"ready",engine:"argos"}, "*");
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const handleMetricsReport = useCallback(
    (methodology: MethodologyId, stats: FrameTelemetryStats) => {
      setMetricsMap((prev) => {
        const cur = prev[methodology];
        if (
          cur &&
          cur.colStripeResidual === stats.colStripeResidual &&
          cur.rowStripeResidual === stats.rowStripeResidual &&
          cur.staticGrainMad === stats.staticGrainMad &&
          cur.thinFeatureRetentionPct === stats.thinFeatureRetentionPct
        ) {
          return prev;
        }
        return { ...prev, [methodology]: stats };
      });
    },
    []
  );

  const activeFrameLabel = sharedBinInfo
    ? `${sharedBinInfo.fileName} · Frame ${sharedFrameIdx + 1}/${
        sharedBinInfo.totalFrames
      }`
    : `Preset: ${sharedPreset} · Frame ${sharedFrameIdx + 1}/60`;

  return (
    <div className="min-h-screen bg-[#060c15] text-slate-100">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-[#0c1725]">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.25em] text-cyan-300">
                EDTH Hackathon · Thermal Image Processing & CNN Workbench
              </p>
              <h1 className="mt-1.5 text-3xl font-black tracking-tight text-white">
                ClearHot Multi-Methodology Lab (3 Instances)
              </h1>
              <p className="mt-1 text-sm text-slate-300">
                Compare 3 distinct methodologies built on top of the existing ClearHot
                pipeline for parallel-line/static suppression, digital picture
                enhancement, and 14-bit CNN residual training.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-cyan-400/50 bg-cyan-500/20 px-4 py-2 text-xs font-bold text-cyan-100 shadow hover:bg-cyan-500/30">
                <FileUp className="h-4 w-4 text-cyan-300" />
                <span>
                  {globalLoading
                    ? "Loading .bin into all 3 instances…"
                    : sharedBinInfo
                    ? `Shared File: ${sharedBinInfo.fileName} (${sharedBinInfo.totalFrames} frames)`
                    : "Upload .bin Once to All 3 Instances"}
                </span>
                <input
                  type="file"
                  accept=".bin"
                  onChange={handleGlobalFileChange}
                  className="hidden"
                />
              </label>
              <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-200">
                Local browser processing · No external upload
              </span>
            </div>
          </div>

          {globalUploadError && (
            <div
              role="alert"
              className="mt-3 rounded-lg border border-rose-500/40 bg-rose-950/50 px-3 py-2 text-xs font-semibold text-rose-200"
            >
              {globalUploadError}
            </div>
          )}

          {/* Navigation Tabs + Master Sync Controls */}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <nav
              aria-label="ClearHot sections"
              className="flex flex-wrap items-center gap-2"
            >
              {(
                [
                  ["all3", "Compare All 3 Instances", Columns3],
                  ["inst1", "Instance #1 · Methodology A", Layers],
                  ["inst2", "Instance #2 · Methodology B", Sparkles],
                  ["inst3", "Instance #3 · Methodology C", Award],
                  ["audit", "Code Audit & CNN Plan", ShieldCheck],
                  ["guide", "How to Test", FileUp],
                ] as const
              ).map(([key, label, Icon]) => (
                <button
                  key={key}
                  aria-pressed={tab === key}
                  onClick={() => setTab(key)}
                  className={
                    "inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs sm:text-sm font-bold transition " +
                    (tab === key
                      ? "border-cyan-300 bg-cyan-400/20 text-white shadow"
                      : "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-400")
                  }
                >
                  <Icon className="h-3.5 w-3.5 text-cyan-300" />
                  {label}
                </button>
              ))}
            </nav>

            {/* Synchronized Stream Bar */}
            <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/90 px-3 py-1.5 text-xs">
              <button
                onClick={() => setSharedPlaying((p) => !p)}
                className="inline-flex items-center gap-1 rounded-lg bg-rose-500 px-2.5 py-1 font-bold text-white hover:bg-rose-400"
              >
                {sharedPlaying ? (
                  <Pause className="h-3 w-3" />
                ) : (
                  <Play className="h-3 w-3" />
                )}
                {sharedPlaying ? "Pause All" : "Play All"}
              </button>
              <span className="font-mono text-slate-300">
                Frame {sharedFrameIdx + 1}/{sharedBinInfo?.totalFrames ?? 60}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 space-y-8">
        {/* Technical Honesty Note */}
        <div
          role="note"
          className="rounded-xl border border-amber-400/40 bg-amber-950/30 p-4 text-xs sm:text-sm leading-relaxed text-amber-100"
        >
          <strong>Experimental thermal processing & algorithmic exploration, not a validated operational FPGA ISP.</strong>{" "}
          The input is assumed to be 640 × 512 14-bit post-NUC stored in 16-bit little-endian words;
          browser display and PNG export are 8-bit white-hot (14-bit destriped frame export is also
          provided). Each of the 3 instances preserves the existing ClearHot 4-stage pipeline and
          layers a distinct methodology for (1) parallel-line/static reduction, (2) digital picture
          enhancement, and (3) a live 14-bit pre-tone-map residual CNN prototype.
        </div>

        {/* Live 3-Instance Summary Comparison Banner when viewing "all3" */}
        {tab === "all3" && (
          <AuditAndComparisonPanel
            metricsMap={metricsMap}
            activeFrameLabel={activeFrameLabel}
            onSelectInstanceTab={(t) => setTab(t)}
          />
        )}

        {/* INSTANCE #1: METHODOLOGY A */}
        <div hidden={tab !== "all3" && tab !== "inst1"}>
          <ThermalClearHotInstanceView
            key={"instance1:" + fileRevision}
            methodology="instance1"
            instanceNumber={1}
            title="CLEARHOT STREAM-14 · INSTANCE #1 (METHODOLOGY A)"
            subtitle="Existing ClearHot 4-Stage Pipeline + Edge-Gated Huber Differential Destriping & 8-Neighbor Rank Impulse Gate + Dual-Plateau Histogram Blending & 2-Scale DoG Coring + StripeResNet-1D2D Separable Residual CNN."
            badgeText="Methodology A · Spatial Edge-Gated Differential + DPHE + 1D/2D Separable CNN"
            accentColor="cyan"
            sharedBinFrames={sharedBinFrames}
            sharedBinInfo={sharedBinInfo}
            onSharedBinUpload={handleSharedBinUpload}
            sharedPreset={sharedPreset}
            onSharedPresetChange={setSharedPreset}
            sharedFrameIdx={sharedFrameIdx}
            onSharedFrameIdxChange={setSharedFrameIdx}
            sharedPlaying={sharedPlaying}
            onSharedPlayingChange={setSharedPlaying}
            onMetricsReport={handleMetricsReport}
          />
        </div>

        {/* INSTANCE #2: METHODOLOGY B */}
        <div hidden={tab !== "all3" && tab !== "inst2"}>
          <ThermalClearHotInstanceView
            key={"instance2:" + fileRevision}
            methodology="instance2"
            instanceNumber={2}
            title="CLEARHOT STREAM-14 · INSTANCE #2 (METHODOLOGY B)"
            subtitle="Existing ClearHot 4-Stage Pipeline + Multi-Level 1D Haar Wavelet Garrote Shrinkage & Spectral Comb Notch + Fast Edge-Preserving Guided Filter Base/Detail Split & S-Curve Compression + HaarWaveletCNN 2D Subband Network."
            badgeText="Methodology B · Wavelet Subband Shrinkage + Guided Base/Detail + 2D Haar DWT CNN"
            accentColor="emerald"
            sharedBinFrames={sharedBinFrames}
            sharedBinInfo={sharedBinInfo}
            onSharedBinUpload={handleSharedBinUpload}
            sharedPreset={sharedPreset}
            onSharedPresetChange={setSharedPreset}
            sharedFrameIdx={sharedFrameIdx}
            onSharedFrameIdxChange={setSharedFrameIdx}
            sharedPlaying={sharedPlaying}
            onSharedPlayingChange={setSharedPlaying}
            onMetricsReport={handleMetricsReport}
          />
        </div>

        {/* INSTANCE #3: METHODOLOGY C */}
        <div hidden={tab !== "all3" && tab !== "inst3"}>
          <ThermalClearHotInstanceView
            key={"instance3:" + fileRevision}
            methodology="instance3"
            instanceNumber={3}
            title="CLEARHOT STREAM-14 · INSTANCE #3 (METHODOLOGY C)"
            subtitle="Existing ClearHot 4-Stage Pipeline + 1D Cross-Bilateral Strip Filter & Motion-Gated Temporal Kalman Filter + Integral-Image O(1) Local Variance ACE Enhancement + BurstTempCNN Self-Supervised Orthogonal Nulling CNN."
            badgeText="Methodology C · Cross-Bilateral & Motion-Gated Kalman + Integral ACE + Self-Supervised CNN"
            accentColor="violet"
            sharedBinFrames={sharedBinFrames}
            sharedBinInfo={sharedBinInfo}
            onSharedBinUpload={handleSharedBinUpload}
            sharedPreset={sharedPreset}
            onSharedPresetChange={setSharedPreset}
            sharedFrameIdx={sharedFrameIdx}
            onSharedFrameIdxChange={setSharedFrameIdx}
            sharedPlaying={sharedPlaying}
            onSharedPlayingChange={setSharedPlaying}
            onMetricsReport={handleMetricsReport}
          />
        </div>

        {/* Dedicated Audit & CNN Exploration Tab */}
        {tab === "audit" && (
          <AuditAndComparisonPanel
            metricsMap={metricsMap}
            activeFrameLabel={activeFrameLabel}
            onSelectInstanceTab={(t) => setTab(t)}
          />
        )}

        {/* How to Test Tab */}
        {tab === "guide" && (
          <div className="grid gap-4 md:grid-cols-2">
            <section className="rounded-2xl border border-slate-700 bg-slate-900 p-6">
              <p className="text-xs font-bold uppercase tracking-widest text-cyan-300">
                01 · Side-by-Side Methodology Testing
              </p>
              <h2 className="mt-3 text-xl font-bold">
                Load your .bin file once and compare all 3 instances
              </h2>
              <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-slate-300">
                <li>
                  Click <strong>Upload .bin Once to All 3 Instances</strong> in the top header
                  (or inside any instance). All 3 instances immediately share the loaded{" "}
                  <code>640 × 512</code> uint16 little-endian buffer and frame slider.
                </li>
                <li>
                  In each instance, you can switch the <strong>Left side reference</strong> of
                  the split wipe between <em>Per-Frame Linear Min–Max</em> and{" "}
                  <em>Original Unmodified ClearHot</em> so you can directly see the improvement
                  over the existing ClearHot implementation!
                </li>
                <li>
                  Use the deterministic test presets (especially{" "}
                  <strong>Test 4: Wire vs Stripe Trap</strong> and{" "}
                  <strong>Test 6: 1px/2px Hot Targets</strong>) to verify that parallel lines
                  are suppressed without erasing thin wires, vertical masts, or small hot drones.
                </li>
                <li>
                  Export either an 8-bit processed PNG still or a 14-bit destriped{" "}
                  <code>.bin</code> frame from whichever instance performs best on your scene.
                </li>
              </ol>
            </section>
            <section className="rounded-2xl border border-slate-700 bg-slate-900 p-6">
              <p className="text-xs font-bold uppercase tracking-widest text-cyan-300">
                02 · Testing the 3 CNN Prototypes
              </p>
              <h2 className="mt-3 text-xl font-bold">
                In-Browser 14-Bit Residual Training & PyTorch MPS Scripts
              </h2>
              <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-slate-300">
                <li>
                  Inside each instance, locate the violet{" "}
                  <strong>Methodology CNN Sandbox</strong> below the video canvas.
                </li>
                <li>
                  Click <strong>Train 35 Epochs in Browser (14-Bit Patches)</strong>. Watch the
                  training RMSE and held-out validation scene RMSE drop in real time, and toggle{" "}
                  <strong>Apply Live 14-Bit CNN Residual on Canvas</strong> to inspect its
                  effect before tone mapping.
                </li>
                <li>
                  Click <strong>View PyTorch MPS/CPU Script</strong> in any of the 3 instances
                  to inspect or download the standalone Python script (<code>StripeResNet1D2D</code>,{" "}
                  <code>HaarWaveletDestripeCNN</code>, or <code>SelfSupervisedBurstCNN</code>)
                  configured for Apple Silicon <code>mps</code> and <code>cpu</code>.
                </li>
              </ol>
            </section>
          </div>
        )}
      </main>

      <footer className="mt-12 border-t border-slate-800 px-4 py-6 text-center text-xs text-slate-500">
        ClearHot Multi-Methodology Lab · 3 Instances Built on Existing ClearHot Pipeline ·
        Local-Only Browser Prototype
      </footer>
    </div>
  );
}

export default App;

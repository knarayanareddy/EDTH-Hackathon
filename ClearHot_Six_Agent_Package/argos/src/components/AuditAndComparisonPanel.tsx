import React from "react";
import {
  Award,
  CheckCircle2,
  Cpu,
  FileWarning,
  Layers,
  ShieldAlert,
  Terminal,
} from "lucide-react";
import { FrameTelemetryStats, MethodologyId } from "../types/thermal";

interface AuditAndComparisonPanelProps {
  metricsMap: Record<MethodologyId, FrameTelemetryStats | null>;
  activeFrameLabel: string;
  onSelectInstanceTab: (tab: "all3" | "inst1" | "inst2" | "inst3") => void;
}

const CODE_AUDIT_FINDINGS = [
  {
    severity: "HIGH",
    location: "ThermalClearHotView.tsx · Lines 214–228 (Stage 1 Column Bias Estimator)",
    title:
      "Hardcoded [1,000..12,000] ADU intensity gate & 7,200 ADU fallback corrupt scenes outside assumed post-NUC offset",
    evidence:
      "Original code accumulates column mean `if (v > 1000 && v < 12000)` and falls back to `7200` when `cnt === 0`. If a real 14-bit sensor sequence sits at e.g. 12,200–14,500 ADU (warm ambient calibration) or 200–1,000 ADU, or if a vertical column contains a tall warm structure >12,000 ADU, `colBias[x]` drops samples or snaps to 7,200 ADU, injecting severe artificial vertical stripes.",
    reproduction:
      "Load a 14-bit frame where ambient background >12,000 ADU or place a vertical hot pipe spanning y=16..H-16. Enable Stage 1 with Vertical Strength > 0.5: a dark shadow band appears across the entire column.",
    resolutionInInstances:
      "Instance #1 uses range-independent adjacent column differences (Δx = I(x,y) − I(x−1,y)) gated by local gradient; Instance #2 uses 1D Haar wavelet detail shrinkage; Instance #3 uses radiometric cross-bilateral differences.",
  },
  {
    severity: "HIGH",
    location: "ThermalClearHotView.tsx · Lines 231–244 (Stage 1 Horizontal Row Bias Heuristic)",
    title:
      "Scene-blind 9-row moving-average residual (`rowBias[y]`) erases real horizontal wires and creates horizon Mach bands",
    evidence:
      "Original code computes `rowMean[y]` across all columns `x += 4` without any edge gating and subtracts `rowMean[y] - local9RowMean`. Any genuine horizontal scene edge (sky/ground horizon, building roof, horizontal powerline wire) shifts `rowMean[y]` and is subtracted across the full image width.",
    reproduction:
      "Select 'Test 4: Wire vs Stripe Trap' or 'Syn 2: Horizon pan', set Left side reference to 'Original Unmodified ClearHot' and increase Horizontal line correction to 0.70. Notice the 1px horizontal wire loses contrast and dark/bright overshoot bands appear above and below the horizon.",
    resolutionInInstances:
      "Instance #1 gates vertical row differences (|Δy| < τ_edge); Instance #2 applies Garrote wavelet shrinkage that preserves large step transitions; Instance #3 weights row neighbors by bilateral radiometric similarity.",
  },
  {
    severity: "HIGH",
    location: "ThermalClearHotView.tsx · Lines 246–253 (Stage 1 Bad-Pixel Outlier Clamp)",
    title:
      "4-neighbor average outlier check (`|v - avgN| > 1800`) compares destriped `v` against raw `raw14` neighbors and clips real 1px/2px hot targets",
    evidence:
      "Original loop computes `avgN = (raw14[idx-1] + raw14[idx+1] + raw14[idx-W] + raw14[idx+W]) * 0.25`. For a distant 1×1 or 2×2 hot point target (e.g., 12,800 ADU drone engine against 7,200 ADU sky), `v - avgN` exceeds 1,800 ADU and the target core is overwritten with `avgN`.",
    reproduction:
      "Select 'Test 6: 1px/2px Hot Targets' and toggle Stage 1 ON/OFF in Original ClearHot vs Instance #1 (8-Neighbor Rank Impulse Gate).",
    resolutionInInstances:
      "Instance #1 sorts the 8 neighbors and compares against the 2nd-highest neighbor (`nbrs[6]`), preserving 100% of 2×2+ hot targets while still removing isolated 1-pixel dead/hot sensor defects.",
  },
  {
    severity: "MEDIUM",
    location: "ThermalClearHotView.tsx · Lines 308–313 (Stage 5 Temporal IIR Buffer Mutation on Paused Frame)",
    title:
      "Non-reproducible output on paused frames: `prevFrameFloatRef` updates on every slider change even when `frameIdx` has not advanced",
    evidence:
      "When `antiGhostingPureSpatial` is unchecked, lines 309–313 blend `0.25 * normBuf + 0.75 * prevFrameFloatRef` and overwrite `prevFrameFloatRef.current` inside the render `useEffect`. Dragging `splitWipePct` or `detailGain` while paused repeatedly re-runs the IIR filter on the same frame, changing the image depending on how many times a slider was moved.",
    reproduction:
      "Pause on any frame with a moving target, uncheck 'Spatial-only mode', and drag the Split Wipe slider back and forth 10 times: the ghost trail progressively fades on a paused frame.",
    resolutionInInstances:
      "Instance #3 replaces naive 8-bit IIR with a 14-bit Motion-Gated Temporal Kalman filter whose state updates strictly when `lastFrameKeyRef.current !== frameKey`.",
  },
  {
    severity: "MEDIUM",
    location: "ThermalClearHotView.tsx · Lines 130–134 & Line 266 (Downsampling Aliasing & Quantile Falsy Fallback)",
    title:
      "Stride-2 point sampling (`x * (640/W)`) hides odd-column FPN stripes at 320×256; `sortedSample[...] || 7000` treats 0 ADU as falsy",
    evidence:
      "At 320×256 (`fullRes = false`), `x * 2` reads only even columns (0, 2, 4, …), completely skipping odd columns. If sensor readout stripes alternate between odd/even ADC channels, 320×256 hides them entirely. Furthermore, `sortedSample[...] || 7000` evaluates `0` as falsy and substitutes `7000`.",
    reproduction:
      "Upload a 640×512 `.bin` with alternating odd/even column offset and toggle 'Full resolution (640×512)' ON and OFF.",
    resolutionInInstances:
      "Explicit `!== undefined` quantile check implemented; full 640×512 resolution enabled by default for uploaded `.bin` files with bit-occupancy and endianness diagnostics reported on load.",
  },
];

export const AuditAndComparisonPanel: React.FC<AuditAndComparisonPanelProps> = ({
  metricsMap,
  activeFrameLabel,
  onSelectInstanceTab,
}) => {
  const m1 = metricsMap.instance1;
  const m2 = metricsMap.instance2;
  const m3 = metricsMap.instance3;

  // Determine best instance on current frame using composite score (lowest stripe + static residual, highest structure retention)
  const computeScore = (m: FrameTelemetryStats | null) => {
    if (!m) return 9999;
    return (
      m.colStripeResidual * 1.2 +
      m.rowStripeResidual * 1.2 +
      m.staticGrainMad * 0.8 +
      m.haloOvershootIndex * 1.5 -
      m.thinFeatureRetentionPct * 0.35
    );
  };

  const scores = [
    { id: "instance1" as const, label: "Instance #1 (Methodology A)", score: computeScore(m1) },
    { id: "instance2" as const, label: "Instance #2 (Methodology B)", score: computeScore(m2) },
    { id: "instance3" as const, label: "Instance #3 (Methodology C)", score: computeScore(m3) },
  ].sort((a, b) => a.score - b.score);

  const bestWinner = scores[0];

  return (
    <div className="space-y-6">
      {/* Live 3-Instance Methodology Comparison Table */}
      <section className="rounded-2xl border border-cyan-500/35 bg-slate-900/95 p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-cyan-300">
              Live Multi-Methodology Evaluation · {activeFrameLabel}
            </p>
            <h2 className="mt-1.5 text-2xl font-bold text-white">
              Which of the 3 Instances Gives the Best Result?
            </h2>
            <p className="mt-1 text-sm text-slate-300">
              Quantitative proxy comparison measured directly on the active 14-bit frame across all 3 methodologies.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-950/40 px-4 py-2.5">
            <Award className="h-5 w-5 text-emerald-300" />
            <div className="text-xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                Best Overall on Active Scene
              </div>
              <div className="font-bold text-white">{bestWinner.label}</div>
            </div>
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-950/80 text-slate-300">
                <th className="p-3 font-bold">Methodology / Instance</th>
                <th className="p-3 font-bold">Parallel Line & Static Technique</th>
                <th className="p-3 font-bold">Digital Picture Enhancement</th>
                <th className="p-3 font-bold">CNN Prototype</th>
                <th className="p-3 font-bold text-cyan-300">Col Stripe σ ↓</th>
                <th className="p-3 font-bold text-cyan-300">Row Stripe σ ↓</th>
                <th className="p-3 font-bold text-emerald-300">Static MAD ↓</th>
                <th className="p-3 font-bold text-amber-300">Edge Retention ↑</th>
                <th className="p-3 font-bold text-violet-300">Halo Index ↓</th>
                <th className="p-3 font-bold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {(
                [
                  {
                    id: "instance1" as const,
                    tab: "inst1" as const,
                    name: "Instance #1 · Methodology A",
                    lineTech: "Edge-Gated Huber Δx/Δy + 8-Nbr Rank Gate",
                    enhTech: "Dual-Plateau Histogram + 2-Scale DoG Coring",
                    cnnTech: "StripeResNet-1D2D (Separable 1×7/7×1)",
                    stats: m1,
                  },
                  {
                    id: "instance2" as const,
                    tab: "inst2" as const,
                    name: "Instance #2 · Methodology B",
                    lineTech: "1D Haar Wavelet Garrote + Comb Notch",
                    enhTech: "Fast Guided Filter Base/Detail + S-Curve",
                    cnnTech: "HaarWaveletCNN (2D DWT Subband Net)",
                    stats: m2,
                  },
                  {
                    id: "instance3" as const,
                    tab: "inst3" as const,
                    name: "Instance #3 · Methodology C",
                    lineTech: "1D Cross-Bilateral + Motion-Gated Kalman",
                    enhTech: "Integral-Image O(1) Local Variance ACE",
                    cnnTech: "BurstTempCNN (Self-Supervised Nulling)",
                    stats: m3,
                  },
                ] as const
              ).map((row) => {
                const isWinner = bestWinner.id === row.id;
                return (
                  <tr
                    key={row.id}
                    className={
                      isWinner
                        ? "bg-emerald-950/25 font-medium text-white"
                        : "bg-slate-900/60 text-slate-200"
                    }
                  >
                    <td className="p-3 font-bold">
                      <div className="flex items-center gap-1.5">
                        {isWinner && (
                          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                        )}
                        <span>{row.name}</span>
                      </div>
                    </td>
                    <td className="p-3 text-slate-300">{row.lineTech}</td>
                    <td className="p-3 text-slate-300">{row.enhTech}</td>
                    <td className="p-3 text-violet-200">{row.cnnTech}</td>
                    <td className="p-3 font-mono font-bold text-cyan-300">
                      {row.stats ? `${row.stats.colStripeResidual} ADU` : "—"}
                    </td>
                    <td className="p-3 font-mono font-bold text-cyan-300">
                      {row.stats ? `${row.stats.rowStripeResidual} ADU` : "—"}
                    </td>
                    <td className="p-3 font-mono font-bold text-emerald-300">
                      {row.stats ? `${row.stats.staticGrainMad} ADU` : "—"}
                    </td>
                    <td className="p-3 font-mono font-bold text-amber-300">
                      {row.stats ? `${row.stats.thinFeatureRetentionPct}%` : "—"}
                    </td>
                    <td className="p-3 font-mono font-bold text-violet-300">
                      {row.stats ? row.stats.haloOvershootIndex : "—"}
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() => onSelectInstanceTab(row.tab)}
                        className="rounded-lg border border-cyan-400/40 bg-cyan-500/15 px-2.5 py-1 text-xs font-bold text-cyan-200 hover:bg-cyan-500/25"
                      >
                        Inspect #{row.id.replace("instance", "")}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Practical Decision Guide across the 3 Methodologies */}
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-700 bg-slate-950/80 p-4 text-xs leading-relaxed text-slate-300">
            <div className="font-bold text-cyan-300">
              When Instance #1 (Methodology A) is Best:
            </div>
            <p className="mt-1.5">
              Best for <strong>single-frame spatial accuracy & small hot point targets</strong>.
              Its Edge-Gated Huber differential accumulator refuses to integrate across sharp
              vertical buildings or horizontal horizons, and its 8-neighbor rank gate preserves
              2×2 hot drones that get erased by standard 3×3 mean clamps. Lowest FPGA memory
              footprint (zero external frame buffer needed).
            </p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-950/80 p-4 text-xs leading-relaxed text-slate-300">
            <div className="font-bold text-emerald-300">
              When Instance #2 (Methodology B) is Best:
            </div>
            <p className="mt-1.5">
              Best for <strong>halo-free high-dynamic-range scenes & periodic readout bands</strong>.
              Splitting Base and Detail via an edge-preserving Guided Filter before tone mapping
              eliminates the dark/bright ringing halos around extreme hot plumes (14,900 ADU) and
              sharp sky/terrain horizons. Its 2D Haar Wavelet CNN also cuts MAC operations by 4×.
            </p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-950/80 p-4 text-xs leading-relaxed text-slate-300">
            <div className="font-bold text-violet-300">
              When Instance #3 (Methodology C) is Best:
            </div>
            <p className="mt-1.5">
              Best for <strong>video playback with temporal static jitter & faint terrain contrast</strong>.
              Its Motion-Gated Temporal Kalman filter quiets shimmering static lines on stationary
              background while immediately disabling temporal blending on moving objects (zero
              ghost trails). Its self-supervised CNN can also adapt without paired clean ground truth.
            </p>
          </div>
        </div>
      </section>

      {/* Deliverable 1: Independently Verified Code Audit of ThermalClearHotView.tsx */}
      <section className="rounded-2xl border border-slate-700 bg-slate-900 p-6">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-rose-300">
          <ShieldAlert className="h-4 w-4 text-rose-400" />
          <span>Deliverable 1 · Independently Verified Code Review of Original ClearHot</span>
        </div>
        <h3 className="mt-2 text-xl font-bold text-white">
          Audited Findings in <code className="text-cyan-300">ThermalClearHotView.tsx</code> (Sorted by Severity)
        </h3>
        <p className="mt-1 text-xs text-slate-400">
          Every finding below was verified directly against the 621-line implementation in{" "}
          <code>thermalimagehack/clearhot-lab/src/components/ThermalClearHotView.tsx</code>.
        </p>

        <div className="mt-4 space-y-3">
          {CODE_AUDIT_FINDINGS.map((item, i) => (
            <div
              key={i}
              className="rounded-xl border border-slate-800 bg-slate-950/90 p-4 text-xs leading-relaxed"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-white">{item.title}</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] text-slate-400">
                    {item.location}
                  </span>
                  <span
                    className={`rounded px-2 py-0.5 font-mono text-[10px] font-extrabold ${
                      item.severity === "HIGH"
                        ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                        : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                    }`}
                  >
                    {item.severity}
                  </span>
                </div>
              </div>
              <p className="mt-2 text-slate-300">
                <strong className="text-slate-200">Root Cause:</strong> {item.evidence}
              </p>
              <p className="mt-1.5 text-amber-200/90">
                <strong>Reproduction Step:</strong> {item.reproduction}
              </p>
              <p className="mt-1.5 text-emerald-300">
                <strong>How Our 3 Instances Fix It:</strong> {item.resolutionInInstances}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Deliverable 4: CNN Feasibility, Apple Silicon MPS Workflow & FPGA Gate */}
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-700 bg-slate-900 p-5 text-xs leading-relaxed text-slate-300">
          <div className="flex items-center gap-2 font-bold text-cyan-300 uppercase tracking-wider">
            <FileWarning className="h-4 w-4" />
            <span>1. Data Rights & Supervision Reality</span>
          </div>
          <h4 className="mt-2 text-base font-bold text-white">
            Is a CNN worth pursuing on the challenge video?
          </h4>
          <p className="mt-2">
            Only as a <strong>constrained pre-tone-map residual corrector</strong> (predicting
            14-bit stripe/static offset ΔS before quantile AGC), never as an end-to-end 14-to-8-bit
            image generator. Why? Because without paired calibrated shutter/blackbody ground truth:
          </p>
          <ul className="mt-2 list-disc space-y-1.5 pl-4">
            <li>
              <strong>Synthetic stripes on clean frames</strong> (Instances #1 & #2) prove software
              mechanics, but may not match real readout nonlinearities.
            </li>
            <li>
              <strong>Naive consecutive-frame Noise2Noise fails</strong> on stationary FPN stripes
              because fixed-pattern columns are correlated across frames t and t+1.
            </li>
            <li>
              <strong>Orthogonal Rank-1 Stripe Projection Loss</strong> (Instance #3) is the safest
              unpaired formulation because a structural rank-1 column/row bias vector cannot
              hallucinate fake objects.
            </li>
          </ul>
        </div>

        <div className="rounded-2xl border border-slate-700 bg-slate-900 p-5 text-xs leading-relaxed text-slate-300">
          <div className="flex items-center gap-2 font-bold text-violet-300 uppercase tracking-wider">
            <Terminal className="h-4 w-4" />
            <span>2. Mac (MPS / CPU) Training Protocol</span>
          </div>
          <h4 className="mt-2 text-base font-bold text-white">
            Reproducible local PyTorch workflow on macOS
          </h4>
          <p className="mt-2">
            Do not assume CUDA. On Apple Silicon Macs (M1/M2/M3/M4), PyTorch uses the{" "}
            <code>mps</code> backend with automatic fallback to <code>cpu</code>:
          </p>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-950 p-2.5 font-mono text-[11px] text-violet-200">
{`python3 -m venv .venv && source .venv/bin/activate
pip install torch numpy
python3 train_instance1_mps.py --epochs 20`}
          </pre>
          <p className="mt-2 text-amber-200">
            <strong>Strict Split Rule:</strong> Split train/val/test by{" "}
            <strong>entire recording or scene</strong>, never by neighboring frames or overlapping
            patches. Hold out the organizer’s evaluation sequence completely if challenge rules
            prohibit training on test data.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-700 bg-slate-900 p-5 text-xs leading-relaxed text-slate-300">
          <div className="flex items-center gap-2 font-bold text-emerald-300 uppercase tracking-wider">
            <Cpu className="h-4 w-4" />
            <span>3. 25 FPS (≤40 ms/frame) & FPGA Gate</span>
          </div>
          <h4 className="mt-2 text-base font-bold text-white">
            Hardware resource comparison across the 3 instances
          </h4>
          <ul className="mt-2 space-y-2">
            <li>
              <strong className="text-white">Instance #1 (Edge-Gated Huber + DPHE):</strong>{" "}
              Purely line-buffered spatial streaming (~7 BRAM line buffers of 640×14-bit, zero
              external DDR frame buffer). Ideal first choice for strict low-latency FPGA targets.
            </li>
            <li>
              <strong className="text-white">Instance #2 (Wavelet + Guided Filter + HaarCNN):</strong>{" "}
              2×2 Haar DWT reduces spatial rate by 4× (81,920 subband tuples/frame), allowing a
              compact INT8 subband CNN to run inside minimal DSP48 slices.
            </li>
            <li>
              <strong className="text-white">Instance #3 (Cross-Bilateral + Temporal Kalman):</strong>{" "}
              Best temporal static suppression, but requires 1 frame buffer (655,360 bytes @
              640×512×16-bit) in on-chip URAM or external memory.
            </li>
          </ul>
          <p className="mt-2 text-[11px] text-slate-400">
            <Layers className="inline h-3.5 w-3.5 mr-1 text-amber-400" />
            Browser render ms/frame measures single-threaded JS execution, not synthesized RTL
            clock speed or FPGA resource utilization.
          </p>
        </div>
      </section>
    </div>
  );
};

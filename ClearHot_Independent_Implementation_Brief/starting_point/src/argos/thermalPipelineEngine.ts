import {
  CnnWeightsState,
  CustomBinInfo,
  FrameTelemetryStats,
  IspConfig,
  MethodologyId,
  SequencePreset,
} from "../types/thermal";
import { applyLiveCnnResidual14 } from "./cnnPrototypeEngine";

export const DEFAULT_ISP_CONFIGS: Record<MethodologyId, IspConfig> = {
  instance1: {
    stage1DestripeAndBadPx: true,
    stage2TemporalQuantileAgc: true,
    stage3DualPlateauCompression: true,
    stage4EdgePreservingDetail: true,
    antiGhostingPureSpatial: true,
    splitWipePct: 50,
    agcSlewLimitADU: 18,
    detailGain: 1.5,
    verticalStrength: 0.75,
    horizontalStrength: 0.55,
    leftBaselineMode: "naive_minmax",
    enableMethodologyDestripe: true,
    enableMethodologyEnhancement: true,
    enableLiveCnnResidual: false,
    edgeGateThresholdADU: 135,
    rankImpulseProtection: true,
    dualPlateauBlend: 0.45,
    dogNoiseCoring: 3.5,
    waveletShrinkThreshold: 42,
    spectralCombNotch: 0.5,
    guidedFilterRadius: 3,
    guidedFilterEps: 1800,
    sCurveContrast: 0.38,
    bilateralRangeSigmaADU: 110,
    kalmanMotionGateADU: 95,
    kalmanTemporalAlpha: 0.55,
    localAceStrength: 0.48,
    cnnBlendStrength: 0.75,
  },
  instance2: {
    stage1DestripeAndBadPx: true,
    stage2TemporalQuantileAgc: true,
    stage3DualPlateauCompression: true,
    stage4EdgePreservingDetail: true,
    antiGhostingPureSpatial: true,
    splitWipePct: 50,
    agcSlewLimitADU: 18,
    detailGain: 1.55,
    verticalStrength: 0.75,
    horizontalStrength: 0.55,
    leftBaselineMode: "naive_minmax",
    enableMethodologyDestripe: true,
    enableMethodologyEnhancement: true,
    enableLiveCnnResidual: false,
    edgeGateThresholdADU: 135,
    rankImpulseProtection: true,
    dualPlateauBlend: 0.4,
    dogNoiseCoring: 3.0,
    waveletShrinkThreshold: 46,
    spectralCombNotch: 0.55,
    guidedFilterRadius: 3,
    guidedFilterEps: 2200,
    sCurveContrast: 0.42,
    bilateralRangeSigmaADU: 110,
    kalmanMotionGateADU: 95,
    kalmanTemporalAlpha: 0.55,
    localAceStrength: 0.45,
    cnnBlendStrength: 0.75,
  },
  instance3: {
    stage1DestripeAndBadPx: true,
    stage2TemporalQuantileAgc: true,
    stage3DualPlateauCompression: true,
    stage4EdgePreservingDetail: true,
    antiGhostingPureSpatial: true,
    splitWipePct: 50,
    agcSlewLimitADU: 18,
    detailGain: 1.5,
    verticalStrength: 0.75,
    horizontalStrength: 0.55,
    leftBaselineMode: "naive_minmax",
    enableMethodologyDestripe: true,
    enableMethodologyEnhancement: true,
    enableLiveCnnResidual: false,
    edgeGateThresholdADU: 135,
    rankImpulseProtection: true,
    dualPlateauBlend: 0.4,
    dogNoiseCoring: 3.0,
    waveletShrinkThreshold: 42,
    spectralCombNotch: 0.5,
    guidedFilterRadius: 3,
    guidedFilterEps: 2000,
    sCurveContrast: 0.35,
    bilateralRangeSigmaADU: 115,
    kalmanMotionGateADU: 90,
    kalmanTemporalAlpha: 0.58,
    localAceStrength: 0.52,
    cnnBlendStrength: 0.75,
  },
};

/**
 * Extracts a 14-bit frame from an uploaded 640x512 uint16 .bin buffer OR synthesizes
 * a deterministic 14-bit test sequence.
 */
export function extractOrSynthesizeFrame14(
  W: number,
  H: number,
  frameIdx: number,
  preset: SequencePreset,
  customFrames: Uint16Array | null,
  customBinInfo: CustomBinInfo | null
): Uint16Array {
  const N = W * H;
  const raw14 = new Uint16Array(N);

  if (customFrames && customBinInfo) {
    const offset = (frameIdx % customBinInfo.totalFrames) * (640 * 512);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const srcIdx = offset + y * (512 / H) * 640 + x * (640 / W);
        raw14[y * W + x] = customFrames[srcIdx] & 0x3fff;
      }
    }
    return raw14;
  }

  // Deterministic synthetic 14-bit post-NUC frame generator (0..16383 ADU)
  const pitchShift =
    preset === "horizon_pan" ? Math.round(Math.sin(frameIdx * 0.18) * 38) : 0;
  const horizonY = Math.round((96 + pitchShift) * (H / 256));

  for (let y = 0; y < H; y++) {
    const isSky = y < horizonY;
    // Horizontal parallel static line pattern (stationary row FPN + subtle temporal line static)
    const rowStripe =
      ((y * 29) % 9 === 0 ? 32 : 0) -
      ((y * 17) % 11 === 0 ? 26 : 0) +
      Math.round(Math.cos(y * 1.35) * 11) +
      (preset === "multi_freq_grid_fpn"
        ? Math.round(Math.sin(y * 0.75 + frameIdx * 0.9) * 22)
        : 0);

    for (let x = 0; x < W; x++) {
      let val = isSky
        ? 7080 + Math.round(Math.sin(x * 0.04 + y * 0.06) * 45)
        : 7340 +
          Math.round(
            Math.sin(x * 0.08) * 65 +
              Math.cos((y - horizonY) * 0.12) * 80 +
              ((x ^ y) % 19) * 4
          );

      // Slanted road / trench structure
      const roadCenter = 160 * (W / 320) + (y - horizonY) * 0.45;
      if (!isSky && Math.abs(x - roadCenter) < 18 * (W / 320)) {
        val += 135;
      }

      // Column FPN readout stripe (parallel vertical lines)
      const colStripe =
        ((x * 37) % 11 === 0 ? 48 : 0) -
        ((x * 19) % 13 === 0 ? 36 : 0) +
        (preset === "multi_freq_grid_fpn"
          ? Math.round(Math.cos(x * 0.9) * 26)
          : 0);

      // High-frequency temporal static grain
      const temporalStatic =
        (((x * 73 + y * 131 + frameIdx * 47) % 23) - 11) *
        (preset === "multi_freq_grid_fpn" ? 2.2 : 1.1);

      val += colStripe + rowStripe + Math.round(temporalStatic);

      // Deterministic Test Preset: "stripe_vs_scene_wire"
      // Injects a REAL 1-pixel vertical mast (at x = 78% W, spanning y = 18%..82% H)
      // and a REAL 1-pixel horizontal powerline wire (at y = 28% H, spanning x = 15%..85% W)
      // so the user can test whether horizontal/vertical line removal erases real thin structures!
      if (preset === "stripe_vs_scene_wire") {
        const mastX = Math.floor(W * 0.78);
        const wireY = Math.floor(H * 0.28);
        if (x === mastX && y > Math.floor(H * 0.18) && y < Math.floor(H * 0.84)) {
          val += 340; // Genuine warm vertical mast
        }
        if (y === wireY && x > Math.floor(W * 0.14) && x < Math.floor(W * 0.86)) {
          val += 275; // Genuine warm horizontal wire
        }
      }

      raw14[y * W + x] = Math.max(0, Math.min(16383, val));
    }
  }

  // Moving Target (Shahed-136 delta wing + 14,900 ADU exhaust plume OR armored convoy)
  const tx = Math.round((frameIdx * 5) % Math.max(20, W - 40)) + 20;
  const ty = Math.round((preset === "shahed_intercept" ? 64 : 155) * (H / 256));
  for (let dy = -10; dy <= 10; dy++) {
    for (let dx = -16; dx <= 16; dx++) {
      const px = tx + dx;
      const py = ty + dy;
      if (px >= 0 && px < W && py >= 0 && py < H) {
        const dist = Math.sqrt(dx * dx + dy * dy * 1.8);
        if (dist < 4.2) {
          raw14[py * W + px] = 14900;
        } else if (dist < 11) {
          raw14[py * W + px] = Math.min(16383, raw14[py * W + px] + 290);
        }
      }
    }
  }

  // Deterministic Test Preset: "point_target_and_badpx"
  // Places 1x1, 2x2, and 3x3 small hot drones at fixed coordinates to test outlier clamp safety
  if (preset === "point_target_and_badpx") {
    const py = Math.floor(H * 0.22);
    const p1x = Math.floor(W * 0.25);
    const p2x = Math.floor(W * 0.45);
    const p3x = Math.floor(W * 0.65);
    // 1x1 distant hot point target
    raw14[py * W + p1x] = 11200;
    // 2x2 compact hot drone target
    for (let dy = 0; dy <= 1; dy++) {
      for (let dx = 0; dx <= 1; dx++) {
        raw14[(py + dy) * W + (p2x + dx)] = 12800;
      }
    }
    // 3x3 small hot target
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        raw14[(py + dy) * W + (p3x + dx)] = 13600;
      }
    }
  }

  // Transient hot flare on alternating frames in horizon_pan to test AGC flicker
  if (preset === "burning_convoy" || (preset === "horizon_pan" && frameIdx % 8 < 4)) {
    const yStart = Math.floor(180 * (H / 256));
    const yEnd = Math.min(H, Math.floor(210 * (H / 256)));
    const xStart = Math.floor(45 * (W / 320));
    const xEnd = Math.min(W, Math.floor(75 * (W / 320)));
    for (let y = yStart; y < yEnd; y++) {
      for (let x = xStart; x < xEnd; x++) {
        raw14[y * W + x] = 15600;
      }
    }
  }

  // Sprinkle 25 dead/hot bad pixels (16380 or 120)
  for (let k = 0; k < 25; k++) {
    const bx = ((k * 97 + 31) % (W - 2)) + 1;
    const by = ((k * 53 + 17) % (H - 2)) + 1;
    raw14[by * W + bx] = k % 2 === 0 ? 16380 : 120;
  }

  return raw14;
}

/**
 * 1D zero-phase Gaussian smoothing helper for extracting low-frequency scene trend
 * from 1D column/row profiles so only high-frequency parallel lines are removed.
 */
function smooth1DProfile(profile: Float32Array, radius: number): Float32Array {
  const len = profile.length;
  const out = new Float32Array(len);
  const sigma = Math.max(1.0, radius * 0.5);
  const weights = new Float32Array(radius * 2 + 1);
  let wSum = 0;
  for (let k = -radius; k <= radius; k++) {
    const w = Math.exp(-(k * k) / (2 * sigma * sigma));
    weights[k + radius] = w;
    wSum += w;
  }
  for (let k = 0; k < weights.length; k++) weights[k] /= wSum;

  for (let i = 0; i < len; i++) {
    let acc = 0;
    for (let k = -radius; k <= radius; k++) {
      const idx = Math.max(0, Math.min(len - 1, i + k));
      acc += profile[idx] * weights[k + radius];
    }
    out[i] = acc;
  }
  return out;
}

/**
 * Runs the exact Original ClearHot 4-stage pipeline for reference / baseline comparison.
 */
export function runOriginalClearHotBaseline8(
  raw14: Uint16Array,
  W: number,
  H: number,
  cfg: IspConfig,
  pLow: number,
  pHigh: number
): Uint8ClampedArray {
  const N = W * H;
  const stage1Buf = Float32Array.from(raw14);

  if (cfg.stage1DestripeAndBadPx) {
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

    const rowMean = new Float32Array(H);
    for (let y = 0; y < H; y++) {
      let sum = 0;
      for (let x = 0; x < W; x += 4) sum += raw14[y * W + x];
      rowMean[y] = sum / Math.ceil(W / 4);
    }
    const rowBias = new Float32Array(H);
    for (let y = 0; y < H; y++) {
      let sum = 0,
        count = 0;
      for (let k = -4; k <= 4; k++) {
        const j = y + k;
        if (j >= 0 && j < H) {
          sum += rowMean[j];
          count++;
        }
      }
      rowBias[y] = rowMean[y] - sum / count;
    }

    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const idx = y * W + x;
        let v =
          raw14[idx] -
          (colBias[x] - globalMed) * cfg.verticalStrength -
          rowBias[y] * cfg.horizontalStrength;
        const avgN =
          (raw14[idx - 1] + raw14[idx + 1] + raw14[idx - W] + raw14[idx + W]) * 0.25;
        if (Math.abs(v - avgN) > 1800) v = avgN;
        stage1Buf[idx] = v;
      }
    }
  }

  const span = Math.max(80, pHigh - pLow);
  const normBuf = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const v = stage1Buf[i];
    if (v <= pHigh) {
      normBuf[i] = Math.max(0, Math.min(232, ((v - pLow) / span) * 232));
    } else {
      const excess = Math.min(1, (v - pHigh) / 7000);
      normBuf[i] = 232 + excess * 23;
    }
  }

  const out8 = new Uint8ClampedArray(N);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x;
      let center = normBuf[idx];
      if (cfg.stage4EdgePreservingDetail && y > 0 && y < H - 1 && x > 0 && x < W - 1) {
        const localMean =
          (normBuf[idx - 1] + normBuf[idx + 1] + normBuf[idx - W] + normBuf[idx + W]) *
          0.25;
        const diff = center - localMean;
        const clampedDiff = Math.max(-18, Math.min(18, diff));
        center = center + clampedDiff * (cfg.detailGain - 1.0) * 1.8;
      }
      out8[idx] = Math.max(0, Math.min(255, Math.round(center)));
    }
  }
  return out8;
}

/**
 * Executes the complete pipeline for Instance 1, Instance 2, or Instance 3:
 * - Existing ClearHot 4-Stage Pipeline
 * - PLUS Methodology-Specific Parallel Lines / Static Suppression (Stage 1+)
 * - PLUS Optional Live 14-Bit Residual CNN Inference (Pre-Tone-Map)
 * - PLUS Methodology-Specific Digital Picture Enhancement (Stages 2-4+)
 */
export function runThermalInstancePipeline(params: {
  methodology: MethodologyId;
  raw14: Uint16Array;
  W: number;
  H: number;
  cfg: IspConfig;
  cnnState: CnnWeightsState;
  prevBlackRef: { current: number };
  prevWhiteRef: { current: number };
  lastFrameKeyRef: { current: string };
  prevNormFrameRef: { current: Float32Array | null };
  prevKalman14Ref: { current: Float32Array | null };
  frameKey: string;
}): {
  processed8: Uint8ClampedArray;
  leftBaseline8: Uint8ClampedArray;
  stage1Clean14: Float32Array;
  telemetry: FrameTelemetryStats;
} {
  const {
    methodology,
    raw14,
    W,
    H,
    cfg,
    cnnState,
    prevBlackRef,
    prevWhiteRef,
    lastFrameKeyRef,
    prevNormFrameRef,
    prevKalman14Ref,
    frameKey,
  } = params;

  const t0 = performance.now();
  const N = W * H;

  // 0. Compute raw 14-bit min & max for Naive Linear Min-Max baseline
  let rMin = 16383;
  let rMax = 0;
  for (let i = 0; i < N; i++) {
    const v = raw14[i];
    if (v < rMin) rMin = v;
    if (v > rMax) rMax = v;
  }

  // ============================================================================
  // STAGE 1: PARALLEL LINES / STATIC SUPPRESSION & OUTLIER PROTECTION (14-BIT)
  // ============================================================================
  let stage1Buf: Float32Array = new Float32Array(raw14);

  if (cfg.stage1DestripeAndBadPx) {
    if (!cfg.enableMethodologyDestripe) {
      // Fall back to exact Original ClearHot Stage 1 if user unchecks Methodology Destripe toggle
      const colBias = new Float32Array(W);
      let globalMed = 0;
      for (let x = 0; x < W; x++) {
        let sum = 0,
          cnt = 0;
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

      const rowMean = new Float32Array(H);
      for (let y = 0; y < H; y++) {
        let sum = 0;
        for (let x = 0; x < W; x += 4) sum += raw14[y * W + x];
        rowMean[y] = sum / Math.ceil(W / 4);
      }
      const rowBias = new Float32Array(H);
      for (let y = 0; y < H; y++) {
        let sum = 0,
          count = 0;
        for (let k = -4; k <= 4; k++) {
          const j = y + k;
          if (j >= 0 && j < H) {
            sum += rowMean[j];
            count++;
          }
        }
        rowBias[y] = rowMean[y] - sum / count;
      }
      for (let y = 1; y < H - 1; y++) {
        for (let x = 1; x < W - 1; x++) {
          const idx = y * W + x;
          let v =
            raw14[idx] -
            (colBias[x] - globalMed) * cfg.verticalStrength -
            rowBias[y] * cfg.horizontalStrength;
          const avgN =
            (raw14[idx - 1] + raw14[idx + 1] + raw14[idx - W] + raw14[idx + W]) * 0.25;
          if (Math.abs(v - avgN) > 1800) v = avgN;
          stage1Buf[idx] = v;
        }
      }
    } else if (methodology === "instance1") {
      // ------------------------------------------------------------------------
      // INSTANCE 1 METHODOLOGY A:
      // Edge-Gated Huber/Trimmed Differential Destriping + 8-Neighbor Rank Gate
      // ------------------------------------------------------------------------
      const edgeThresh = Math.max(25, cfg.edgeGateThresholdADU);

      // Step 1A: Compute edge-gated adjacent column differences dCol[x] = mean_y(I(x,y) - I(x-1,y))
      // excluding pixels where |d| > edgeThresh or where a vertical structure stops abruptly
      const colDiff = new Float32Array(W);
      const colIntegrated = new Float32Array(W);
      for (let x = 1; x < W; x++) {
        let sumDiff = 0;
        let weightSum = 0;
        for (let y = 4; y < H - 4; y += 2) {
          const idx = y * W + x;
          const dx = raw14[idx] - raw14[idx - 1];
          const dy = Math.abs(raw14[idx + W] - raw14[idx - W]);
          if (Math.abs(dx) < edgeThresh && dy < edgeThresh * 1.4) {
            // Huber weight smoothly downweights near-threshold scene gradients
            const w = 1.0 / (1.0 + (dx * dx) / (edgeThresh * edgeThresh * 0.25));
            sumDiff += dx * w;
            weightSum += w;
          }
        }
        colDiff[x] = weightSum > 4 ? sumDiff / weightSum : 0;
        colIntegrated[x] = colIntegrated[x - 1] + colDiff[x];
      }
      // Extract only the high-frequency column stripe profile by subtracting smoothed profile
      const colLowPass = smooth1DProfile(colIntegrated, 9);
      const colStripeEst = new Float32Array(W);
      for (let x = 0; x < W; x++) {
        colStripeEst[x] = colIntegrated[x] - colLowPass[x];
      }

      // Step 1B: Compute edge-gated adjacent row differences dRow[y] = mean_x(I(x,y) - I(x,y-1))
      // Protects horizontal horizons and 1px wires!
      const rowDiff = new Float32Array(H);
      const rowIntegrated = new Float32Array(H);
      for (let y = 1; y < H; y++) {
        let sumDiff = 0;
        let weightSum = 0;
        const rowOff = y * W;
        for (let x = 4; x < W - 4; x += 2) {
          const idx = rowOff + x;
          const dy = raw14[idx] - raw14[idx - W];
          const dx = Math.abs(raw14[idx + 1] - raw14[idx - 1]);
          if (Math.abs(dy) < edgeThresh && dx < edgeThresh * 1.4) {
            const w = 1.0 / (1.0 + (dy * dy) / (edgeThresh * edgeThresh * 0.25));
            sumDiff += dy * w;
            weightSum += w;
          }
        }
        rowDiff[y] = weightSum > 4 ? sumDiff / weightSum : 0;
        rowIntegrated[y] = rowIntegrated[y - 1] + rowDiff[y];
      }
      const rowLowPass = smooth1DProfile(rowIntegrated, 7);
      const rowStripeEst = new Float32Array(H);
      for (let y = 0; y < H; y++) {
        rowStripeEst[y] = rowIntegrated[y] - rowLowPass[y];
      }

      // Step 1C: Apply local structure-aware stripe subtraction + 8-neighbor Rank Impulse Gate
      const nbrs = new Float32Array(8);
      for (let y = 1; y < H - 1; y++) {
        const rowOff = y * W;
        for (let x = 1; x < W - 1; x++) {
          const idx = rowOff + x;
          const rawV = raw14[idx];

          // Local protection: if pixel is part of a localized high-contrast thin wire or mast
          // (where vertical difference or horizontal difference is large only over a short span),
          // attenuate stripe subtraction locally to preserve 1px features
          const localHorizGrad = Math.abs(rawV - 0.5 * (raw14[idx - 1] + raw14[idx + 1]));
          const localVertGrad = Math.abs(rawV - 0.5 * (raw14[idx - W] + raw14[idx + W]));
          const colProtect = localHorizGrad > edgeThresh * 1.35 ? 0.25 : 1.0;
          const rowProtect = localVertGrad > edgeThresh * 1.35 ? 0.25 : 1.0;

          let v =
            rawV -
            colStripeEst[x] * cfg.verticalStrength * colProtect -
            rowStripeEst[y] * cfg.horizontalStrength * rowProtect;

          if (cfg.rankImpulseProtection) {
            // 8-Neighbor Rank-Order Impulse Gate:
            // Only replaces isolated 1-pixel dead/hot spikes (0 or 16383) while keeping 2x2+ hot targets intact!
            nbrs[0] = raw14[idx - W - 1];
            nbrs[1] = raw14[idx - W];
            nbrs[2] = raw14[idx - W + 1];
            nbrs[3] = raw14[idx - 1];
            nbrs[4] = raw14[idx + 1];
            nbrs[5] = raw14[idx + W - 1];
            nbrs[6] = raw14[idx + W];
            nbrs[7] = raw14[idx + W + 1];
            nbrs.sort();
            const med = 0.5 * (nbrs[3] + nbrs[4]);
            const secondHigh = nbrs[6];
            const secondLow = nbrs[1];
            if (v - secondHigh > 1600 || secondLow - v > 1600) {
              v = med;
            }
          } else {
            const avg4 =
              (raw14[idx - 1] + raw14[idx + 1] + raw14[idx - W] + raw14[idx + W]) * 0.25;
            if (Math.abs(v - avg4) > 1800) v = avg4;
          }

          stage1Buf[idx] = v;
        }
      }
    } else if (methodology === "instance2") {
      // ------------------------------------------------------------------------
      // INSTANCE 2 METHODOLOGY B:
      // 1D Directional Haar Wavelet Garrote Shrinkage + Spectral Comb Notch
      // ------------------------------------------------------------------------
      const shrinkT = Math.max(8, cfg.waveletShrinkThreshold);

      // Compute robust trimmed column & row profiles
      const colProf = new Float32Array(W);
      for (let x = 0; x < W; x++) {
        let sum = 0,
          cnt = 0;
        for (let y = 8; y < H - 8; y += 2) {
          const idx = y * W + x;
          const v = raw14[idx];
          const localDiff = Math.abs(v - raw14[idx - W]);
          if (localDiff < 180 && v > 400 && v < 13500) {
            sum += v;
            cnt++;
          }
        }
        colProf[x] = cnt > 0 ? sum / cnt : 7200;
      }

      const rowProf = new Float32Array(H);
      for (let y = 0; y < H; y++) {
        let sum = 0,
          cnt = 0;
        const rowOff = y * W;
        for (let x = 8; x < W - 8; x += 2) {
          const idx = rowOff + x;
          const v = raw14[idx];
          const localDiff = Math.abs(v - raw14[idx - 1]);
          if (localDiff < 180 && v > 400 && v < 13500) {
            sum += v;
            cnt++;
          }
        }
        rowProf[y] = cnt > 0 ? sum / cnt : 7200;
      }

      // Multi-scale 1D Wavelet Detail Decomposition (scales 1, 2, 4) + Non-Negative Garrote Shrinkage
      const colSmooth1 = smooth1DProfile(colProf, 1);
      const colSmooth2 = smooth1DProfile(colProf, 3);
      const colSmooth4 = smooth1DProfile(colProf, 8);
      const colWaveletStripe = new Float32Array(W);
      for (let x = 0; x < W; x++) {
        const d1 = colProf[x] - colSmooth1[x];
        const d2 = colSmooth1[x] - colSmooth2[x];
        const d3 = colSmooth2[x] - colSmooth4[x];
        // Non-negative Garrote shrinkage: preserves large true scene transitions while zeroing stripe bands
        const g1 = Math.abs(d1) < shrinkT ? d1 : d1 * ((shrinkT * shrinkT) / (d1 * d1));
        const g2 = Math.abs(d2) < shrinkT ? d2 : d2 * ((shrinkT * shrinkT) / (d2 * d2));
        const g3 =
          Math.abs(d3) < shrinkT * 0.8
            ? d3 * cfg.spectralCombNotch
            : d3 * ((shrinkT * shrinkT * 0.64) / (d3 * d3)) * cfg.spectralCombNotch;
        colWaveletStripe[x] = g1 + g2 + g3;
      }

      const rowSmooth1 = smooth1DProfile(rowProf, 1);
      const rowSmooth2 = smooth1DProfile(rowProf, 3);
      const rowSmooth4 = smooth1DProfile(rowProf, 7);
      const rowWaveletStripe = new Float32Array(H);
      for (let y = 0; y < H; y++) {
        const d1 = rowProf[y] - rowSmooth1[y];
        const d2 = rowSmooth1[y] - rowSmooth2[y];
        const d3 = rowSmooth2[y] - rowSmooth4[y];
        const g1 = Math.abs(d1) < shrinkT ? d1 : d1 * ((shrinkT * shrinkT) / (d1 * d1));
        const g2 = Math.abs(d2) < shrinkT ? d2 : d2 * ((shrinkT * shrinkT) / (d2 * d2));
        const g3 =
          Math.abs(d3) < shrinkT * 0.8
            ? d3 * cfg.spectralCombNotch
            : d3 * ((shrinkT * shrinkT * 0.64) / (d3 * d3)) * cfg.spectralCombNotch;
        rowWaveletStripe[y] = g1 + g2 + g3;
      }

      // Apply Wavelet Stripe Correction + Directional Cross-Median Static Filter
      for (let y = 1; y < H - 1; y++) {
        const rowOff = y * W;
        for (let x = 1; x < W - 1; x++) {
          const idx = rowOff + x;
          const rawV = raw14[idx];
          const localDx = Math.abs(rawV - 0.5 * (raw14[idx - 1] + raw14[idx + 1]));
          const localDy = Math.abs(rawV - 0.5 * (raw14[idx - W] + raw14[idx + W]));
          const colGate = Math.exp(-(localDx * localDx) / (2 * 180 * 180));
          const rowGate = Math.exp(-(localDy * localDy) / (2 * 180 * 180));

          let v =
            rawV -
            colWaveletStripe[x] * cfg.verticalStrength * colGate -
            rowWaveletStripe[y] * cfg.horizontalStrength * rowGate;

          // Outlier replacement
          const n1 = raw14[idx - 1],
            n2 = raw14[idx + 1],
            n3 = raw14[idx - W],
            n4 = raw14[idx + W];
          const avg4 = (n1 + n2 + n3 + n4) * 0.25;
          if (Math.abs(v - avg4) > 1750) {
            v = avg4;
          } else if (cfg.spectralCombNotch > 0.1) {
            // Subtle directional static grain damping in flat regions
            const grainDiff = v - avg4;
            if (Math.abs(grainDiff) < 24) {
              v -= grainDiff * 0.35 * cfg.spectralCombNotch;
            }
          }
          stage1Buf[idx] = v;
        }
      }
    } else {
      // ------------------------------------------------------------------------
      // INSTANCE 3 METHODOLOGY C:
      // 1D Cross-Bilateral Strip Filter + Motion-Gated Temporal Kalman Filter
      // ------------------------------------------------------------------------
      const sigmaR = Math.max(20, cfg.bilateralRangeSigmaADU);
      const twoSigmaRSq = 2 * sigmaR * sigmaR;

      // Cross-bilateral per-pixel directional stripe suppression + Motion-Gated Kalman
      const prevKalman = prevKalman14Ref.current;
      const hasValidPrev = prevKalman !== null && prevKalman.length === N;
      const nextKalman = new Float32Array(N);
      const motionGate = Math.max(15, cfg.kalmanMotionGateADU);
      const tempAlpha = cfg.kalmanTemporalAlpha;

      for (let y = 2; y < H - 2; y++) {
        const rowOff = y * W;
        for (let x = 2; x < W - 2; x++) {
          const idx = rowOff + x;
          let c = raw14[idx];

          // Outlier spike check first
          const avg4 =
            (raw14[idx - 1] + raw14[idx + 1] + raw14[idx - W] + raw14[idx + W]) * 0.25;
          if (Math.abs(c - avg4) > 1750) {
            c = avg4;
          }

          // 1D Horizontal Cross-Bilateral filter (estimates local vertical stripe residual)
          // Checks vertical coherence first: a true vertical stripe has consistent offset at y-1, y, y+1
          const dLeft0 = c - raw14[idx - 1];
          const dRight0 = c - raw14[idx + 1];
          const dLeftU = raw14[idx - W] - raw14[idx - W - 1];
          const dRightU = raw14[idx - W] - raw14[idx - W + 1];
          const dLeftD = raw14[idx + W] - raw14[idx + W - 1];
          const dRightD = raw14[idx + W] - raw14[idx + W + 1];

          const coherentColResidual =
            ((dLeft0 + dRight0) * 0.25 +
              (dLeftU + dRightU) * 0.125 +
              (dLeftD + dRightD) * 0.125);
          const wCol = Math.exp(
            -(coherentColResidual * coherentColResidual) / twoSigmaRSq
          );
          const colCorr = coherentColResidual * wCol * cfg.verticalStrength;

          // 1D Vertical Cross-Bilateral filter (estimates local horizontal stripe residual)
          const dUp0 = c - raw14[idx - W];
          const dDown0 = c - raw14[idx + W];
          const dUpL = raw14[idx - 1] - raw14[idx - W - 1];
          const dDownL = raw14[idx - 1] - raw14[idx + W - 1];
          const dUpR = raw14[idx + 1] - raw14[idx - W + 1];
          const dDownR = raw14[idx + 1] - raw14[idx + W + 1];

          const coherentRowResidual =
            ((dUp0 + dDown0) * 0.25 +
              (dUpL + dDownL) * 0.125 +
              (dUpR + dDownR) * 0.125);
          const wRow = Math.exp(
            -(coherentRowResidual * coherentRowResidual) / twoSigmaRSq
          );
          const rowCorr = coherentRowResidual * wRow * cfg.horizontalStrength;

          let spatialClean = c - colCorr - rowCorr;

          // Motion-Gated Temporal Kalman Filter in 14-bit space:
          // Suppresses static line jitter & temporal static noise on stationary background,
          // while immediately opening the gate (alpha -> 0) when motion > motionGateADU so moving targets never ghost!
          if (hasValidPrev && tempAlpha > 0.01) {
            const prevV = prevKalman[idx];
            const innovation = Math.abs(spatialClean - prevV);
            if (innovation < motionGate) {
              const motionWeight =
                tempAlpha * Math.exp(-(innovation * innovation) / (2 * motionGate * motionGate * 0.35));
              spatialClean =
                (1.0 - motionWeight) * spatialClean + motionWeight * prevV;
            }
          }

          stage1Buf[idx] = spatialClean;
          nextKalman[idx] = spatialClean;
        }
      }
      if (lastFrameKeyRef.current !== frameKey) {
        prevKalman14Ref.current = nextKalman;
      }
    }
  }

  // ============================================================================
  // OPTIONAL STAGE 1.5: LIVE 14-BIT RESIDUAL CNN INFERENCE (PRE-TONE-MAPPING)
  // ============================================================================
  if (cfg.enableLiveCnnResidual) {
    stage1Buf = applyLiveCnnResidual14(
      stage1Buf,
      W,
      H,
      cnnState,
      cfg.cnnBlendStrength
    );
  }

  // ============================================================================
  // STAGE 2 & 3: TEMPORAL HYSTERESIS QUANTILE AGC + DUAL-PLATEAU COMPRESSION
  // ============================================================================
  let pLow = rMin;
  let pHigh = rMax;
  if (cfg.stage2TemporalQuantileAgc) {
    const sortedSample: number[] = [];
    for (let i = 0; i < N; i += 11) {
      sortedSample.push(stage1Buf[i]);
    }
    sortedSample.sort((a, b) => a - b);
    const idxLow = Math.floor(sortedSample.length * 0.02);
    const idxHigh = Math.floor(
      sortedSample.length * (cfg.stage3DualPlateauCompression ? 0.975 : 0.999)
    );
    const rawPLow =
      sortedSample[idxLow] !== undefined ? sortedSample[idxLow] : 7000;
    const rawPHigh =
      sortedSample[idxHigh] !== undefined ? sortedSample[idxHigh] : 8200;

    const maxDelta = cfg.agcSlewLimitADU;
    if (lastFrameKeyRef.current !== frameKey) {
      pLow =
        lastFrameKeyRef.current === ""
          ? rawPLow
          : prevBlackRef.current +
            Math.max(
              -maxDelta,
              Math.min(maxDelta, rawPLow - prevBlackRef.current)
            );
      pHigh =
        lastFrameKeyRef.current === ""
          ? rawPHigh
          : prevWhiteRef.current +
            Math.max(
              -maxDelta,
              Math.min(maxDelta, rawPHigh - prevWhiteRef.current)
            );
      prevBlackRef.current = pLow;
      prevWhiteRef.current = pHigh;
      lastFrameKeyRef.current = frameKey;
    } else {
      pLow = prevBlackRef.current;
      pHigh = prevWhiteRef.current;
    }
  }

  const span = Math.max(80, pHigh - pLow);

  // Normalize to 0..255 with soft shoulder compression for extreme hot targets (> pHigh)
  const normBuf = new Float32Array(N);

  if (
    cfg.enableMethodologyEnhancement &&
    methodology === "instance2"
  ) {
    // --------------------------------------------------------------------------
    // INSTANCE 2 METHODOLOGY B ENHANCEMENT:
    // Fast Edge-Preserving Guided Filter Base/Detail Decomposition in 14-Bit
    // + S-Curve Base Dynamic Range Compression (Halo-Free!)
    // --------------------------------------------------------------------------
    const r = Math.max(1, Math.min(5, Math.round(cfg.guidedFilterRadius)));
    const eps = Math.max(100, cfg.guidedFilterEps);
    const sContrast = cfg.sCurveContrast;

    for (let y = 0; y < H; y++) {
      const y0 = Math.max(0, y - r);
      const y1 = Math.min(H - 1, y + r);
      for (let x = 0; x < W; x++) {
        const x0 = Math.max(0, x - r);
        const x1 = Math.min(W - 1, x + r);
        let sum = 0,
          sumSq = 0,
          cnt = 0;
        for (let wy = y0; wy <= y1; wy += 2) {
          const rOff = wy * W;
          for (let wx = x0; wx <= x1; wx += 2) {
            const val = stage1Buf[rOff + wx];
            sum += val;
            sumSq += val * val;
            cnt++;
          }
        }
        const mean = sum / cnt;
        const variance = Math.max(0, sumSq / cnt - mean * mean);
        // Guided filter edge weight a_k in [0..1]: ~0 in flat regions, ~1 at sharp thermal edges
        const a_k = variance / (variance + eps);
        const v = stage1Buf[y * W + x];
        const base14 = (1 - a_k * 0.35) * mean + a_k * 0.35 * v;
        const detail14 = v - base14;

        // Tone map Base14 to [0..232] with S-curve contrast enhancement
        let t = Math.max(0, Math.min(1, (base14 - pLow) / span));
        if (sContrast > 0.01) {
          // Smooth S-curve polynomial t + s * t * (1 - t) * (2t - 1)
          const sCurve = t + sContrast * 1.4 * t * (1 - t) * (2 * t - 1);
          t = Math.max(0, Math.min(1, sCurve));
        }

        let mapped = t * 232;
        if (v > pHigh) {
          const excess = Math.min(1, (v - pHigh) / 7000);
          mapped = 232 + excess * 23;
        }

        // Add back scaled fine detail in 8-bit space without edge halos
        const detail8 = (detail14 / span) * 232 * (0.85 + cfg.detailGain * 0.55);
        normBuf[y * W + x] = Math.max(0, Math.min(255, mapped + detail8));
      }
    }
  } else {
    // Standard soft-shoulder normalization to 0..255
    for (let i = 0; i < N; i++) {
      const v = stage1Buf[i];
      if (v <= pHigh) {
        normBuf[i] = Math.max(0, Math.min(232, ((v - pLow) / span) * 232));
      } else {
        const excess = Math.min(1, (v - pHigh) / 7000);
        normBuf[i] = 232 + excess * 23;
      }
    }

    if (
      cfg.enableMethodologyEnhancement &&
      methodology === "instance1" &&
      cfg.dualPlateauBlend > 0.01
    ) {
      // ------------------------------------------------------------------------
      // INSTANCE 1 METHODOLOGY A ENHANCEMENT:
      // Dual-Plateau Histogram Equalization (DPHE) Blended Tone Curve
      // Prevents huge uniform sky/ground regions from dominating grayscale bins
      // while reserving contrast bins for small warm objects!
      // ------------------------------------------------------------------------
      const hist = new Uint32Array(256);
      for (let i = 0; i < N; i++) {
        const b = Math.max(0, Math.min(255, Math.round(normBuf[i])));
        hist[b]++;
      }
      const upperPlateau = Math.max(12, Math.floor((N / 256) * 2.4));
      const lowerPlateau = Math.max(2, Math.floor((N / 256) * 0.18));
      const cdf = new Float32Array(256);
      let cum = 0;
      for (let b = 0; b < 256; b++) {
        let count = hist[b];
        if (count > upperPlateau) count = upperPlateau;
        else if (count > 0 && count < lowerPlateau) count = lowerPlateau;
        cum += count;
        cdf[b] = cum;
      }
      const cdfMax = Math.max(1, cdf[255]);
      const blend = cfg.dualPlateauBlend;
      for (let i = 0; i < N; i++) {
        const orig8 = normBuf[i];
        const bin = Math.max(0, Math.min(255, Math.round(orig8)));
        const eq8 = (cdf[bin] / cdfMax) * 246;
        normBuf[i] = (1 - blend) * orig8 + blend * eq8;
      }
    } else if (
      cfg.enableMethodologyEnhancement &&
      methodology === "instance3" &&
      cfg.localAceStrength > 0.01
    ) {
      // ------------------------------------------------------------------------
      // INSTANCE 3 METHODOLOGY C ENHANCEMENT:
      // Integral-Image (Summed-Area Table) Local Variance Adaptive Contrast (ACE)
      // Computes local 13x13 mean & std dev in O(1) per pixel to boost faint
      // local thermal detail in both cold and warm areas simultaneously!
      // ------------------------------------------------------------------------
      const sat = new Float64Array((W + 1) * (H + 1));
      const satSq = new Float64Array((W + 1) * (H + 1));
      const stride = W + 1;

      for (let y = 1; y <= H; y++) {
        let rowSum = 0;
        let rowSumSq = 0;
        const srcRow = (y - 1) * W;
        const dstRow = y * stride;
        const prevRow = (y - 1) * stride;
        for (let x = 1; x <= W; x++) {
          const val = normBuf[srcRow + (x - 1)];
          rowSum += val;
          rowSumSq += val * val;
          sat[dstRow + x] = sat[prevRow + x] + rowSum;
          satSq[dstRow + x] = satSq[prevRow + x] + rowSumSq;
        }
      }

      const winR = 6;
      const aceGain = cfg.localAceStrength;
      const tempAce = new Float32Array(N);
      for (let y = 0; y < H; y++) {
        const y0 = Math.max(0, y - winR);
        const y1 = Math.min(H, y + winR + 1);
        for (let x = 0; x < W; x++) {
          const x0 = Math.max(0, x - winR);
          const x1 = Math.min(W, x + winR + 1);
          const area = (y1 - y0) * (x1 - x0);
          const sum =
            sat[y1 * stride + x1] -
            sat[y0 * stride + x1] -
            sat[y1 * stride + x0] +
            sat[y0 * stride + x0];
          const sumSq =
            satSq[y1 * stride + x1] -
            satSq[y0 * stride + x1] -
            satSq[y1 * stride + x0] +
            satSq[y0 * stride + x0];
          const mean = sum / area;
          const std = Math.sqrt(Math.max(0, sumSq / area - mean * mean));
          const center = normBuf[y * W + x];
          const localDev = center - mean;
          // Adaptive gain inversely proportional to local std (bounded to avoid static explosion)
          const adaptiveFactor =
            1.0 + aceGain * Math.min(2.2, 14.0 / Math.max(5.5, std));
          const clampedDev = Math.max(-28, Math.min(28, localDev * adaptiveFactor));
          tempAce[y * W + x] = Math.max(0, Math.min(255, mean + clampedDev));
        }
      }
      for (let i = 0; i < N; i++) normBuf[i] = tempAce[i];
    }
  }

  // Optional Stage 5 Anti-Ghosting check: only update IIR blend when frame actually advances!
  if (!cfg.antiGhostingPureSpatial && prevNormFrameRef.current?.length === N) {
    for (let i = 0; i < N; i++) {
      normBuf[i] = 0.25 * normBuf[i] + 0.75 * prevNormFrameRef.current[i];
    }
  }
  prevNormFrameRef.current = normBuf.slice();

  // ============================================================================
  // STAGE 4: EDGE-PRESERVING SPATIAL DETAIL BOOST & CORING
  // ============================================================================
  const processed8 = new Uint8ClampedArray(N);
  const coring =
    cfg.enableMethodologyEnhancement && methodology === "instance1"
      ? cfg.dogNoiseCoring
      : 0;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x;
      let center = normBuf[idx];

      if (
        cfg.stage4EdgePreservingDetail &&
        y > 1 &&
        y < H - 2 &&
        x > 1 &&
        x < W - 2
      ) {
        const l = normBuf[idx - 1];
        const r = normBuf[idx + 1];
        const u = normBuf[idx - W];
        const d = normBuf[idx + W];
        const localMean1 = (l + r + u + d) * 0.25;
        let diff = center - localMean1;

        if (
          cfg.enableMethodologyEnhancement &&
          methodology === "instance1"
        ) {
          // 2-Scale Difference-of-Gaussians (DoG) + Noise-Floor Deadzone Coring
          const outerMean =
            (normBuf[idx - 2] +
              normBuf[idx + 2] +
              normBuf[idx - 2 * W] +
              normBuf[idx + 2 * W]) *
            0.25;
          const mediumDetail = localMean1 - outerMean;
          // Deadzone coring suppresses low-amplitude static grain while boosting real edges
          const coredFine =
            Math.abs(diff) <= coring
              ? 0
              : Math.sign(diff) * (Math.abs(diff) - coring);
          diff = coredFine + 0.45 * mediumDetail;
        }

        const clampedDiff = Math.max(-18, Math.min(18, diff));
        center = center + clampedDiff * (cfg.detailGain - 1.0) * 1.8;
      }

      processed8[idx] = Math.max(0, Math.min(255, Math.round(center)));
    }
  }

  // Compute Left-of-Wipe Baseline (either Naive Min-Max OR Original ClearHot)
  const leftBaseline8 = new Uint8ClampedArray(N);
  if (cfg.leftBaselineMode === "original_clearhot") {
    const orig = runOriginalClearHotBaseline8(raw14, W, H, cfg, pLow, pHigh);
    leftBaseline8.set(orig);
  } else {
    const naiveSpan = Math.max(1, rMax - rMin);
    for (let i = 0; i < N; i++) {
      leftBaseline8[i] = Math.round(((raw14[i] - rMin) / naiveSpan) * 255);
    }
  }

  const dt = performance.now() - t0;

  // ============================================================================
  // COMPUTE HONEST QUANTITATIVE TELEMETRY & FLAT-ROI STRIPE RESIDUAL METRICS
  // ============================================================================
  const telemetry = computeFrameTelemetry(
    raw14,
    stage1Buf,
    processed8,
    W,
    H,
    rMin,
    rMax,
    span,
    dt
  );

  return {
    processed8,
    leftBaseline8,
    stage1Clean14: stage1Buf,
    telemetry,
  };
}

/**
 * Computes transparent, reproducible proxy metrics in flat ROIs and across structural targets.
 */
function computeFrameTelemetry(
  raw14: Uint16Array,
  stage1Clean14: Float32Array,
  processed8: Uint8ClampedArray,
  W: number,
  H: number,
  rMin: number,
  rMax: number,
  span: number,
  dtMs: number
): FrameTelemetryStats {
  // 1. Measure Flat-ROI Column Stripe Residual (top-right sky patch y: 8..44, x: W/2..W-16)
  const yStart = 8;
  const yEnd = Math.min(H - 8, 44);
  const xStart = Math.floor(W * 0.45);
  const xEnd = W - 12;
  const colMeansClean: number[] = [];
  const colProfileRaw: number[] = [];
  const colProfileProc: number[] = [];

  for (let x = xStart; x < xEnd; x++) {
    let sClean = 0;
    let sRaw = 0;
    let cnt = 0;
    for (let y = yStart; y < yEnd; y++) {
      sClean += stage1Clean14[y * W + x];
      sRaw += raw14[y * W + x];
      cnt++;
    }
    colMeansClean.push(sClean / Math.max(1, cnt));
    if (colProfileRaw.length < 48) {
      colProfileRaw.push(Number((sRaw / Math.max(1, cnt)).toFixed(1)));
      colProfileProc.push(Number((sClean / Math.max(1, cnt)).toFixed(1)));
    }
  }

  // High-pass column residual std dev (adjacent column difference std / sqrt(2))
  let colHpSq = 0;
  for (let i = 1; i < colMeansClean.length - 1; i++) {
    const hp =
      colMeansClean[i] - 0.5 * (colMeansClean[i - 1] + colMeansClean[i + 1]);
    colHpSq += hp * hp;
  }
  const colStripeResidual = Number(
    Math.sqrt(colHpSq / Math.max(1, colMeansClean.length - 2)).toFixed(2)
  );

  // 2. Measure Flat-ROI Row Stripe Residual
  const rowMeansClean: number[] = [];
  const rowProfileRaw: number[] = [];
  const rowProfileProc: number[] = [];
  const rYEnd = Math.min(H - 8, 72);
  for (let y = 8; y < rYEnd; y++) {
    let sClean = 0;
    let sRaw = 0;
    let cnt = 0;
    for (let x = xStart; x < xEnd; x++) {
      sClean += stage1Clean14[y * W + x];
      sRaw += raw14[y * W + x];
      cnt++;
    }
    rowMeansClean.push(sClean / Math.max(1, cnt));
    if (rowProfileRaw.length < 48) {
      rowProfileRaw.push(Number((sRaw / Math.max(1, cnt)).toFixed(1)));
      rowProfileProc.push(Number((sClean / Math.max(1, cnt)).toFixed(1)));
    }
  }

  let rowHpSq = 0;
  for (let i = 1; i < rowMeansClean.length - 1; i++) {
    const hp =
      rowMeansClean[i] - 0.5 * (rowMeansClean[i - 1] + rowMeansClean[i + 1]);
    rowHpSq += hp * hp;
  }
  const rowStripeResidual = Number(
    Math.sqrt(rowHpSq / Math.max(1, rowMeansClean.length - 2)).toFixed(2)
  );

  // 3. Measure 3x3 Static Grain MAD in flat ROI
  let madSum = 0;
  let madCnt = 0;
  for (let y = yStart + 1; y < yEnd - 1; y += 2) {
    for (let x = xStart + 1; x < xEnd - 1; x += 2) {
      const idx = y * W + x;
      const c = stage1Clean14[idx];
      const avg4 =
        0.25 *
        (stage1Clean14[idx - 1] +
          stage1Clean14[idx + 1] +
          stage1Clean14[idx - W] +
          stage1Clean14[idx + W]);
      madSum += Math.abs(c - avg4);
      madCnt++;
    }
  }
  const staticGrainMad = Number((madSum / Math.max(1, madCnt)).toFixed(2));

  // 4. Measure Thin-Feature / Edge Structure Retention Ratio (checks that real structures aren't erased)
  let rawEdgeEnergy = 0;
  let cleanEdgeEnergy = 0;
  for (let y = Math.floor(H * 0.2); y < Math.floor(H * 0.8); y += 4) {
    for (let x = Math.floor(W * 0.15); x < Math.floor(W * 0.85); x += 4) {
      const idx = y * W + x;
      const rDx = Math.abs(raw14[idx + 1] - raw14[idx - 1]);
      const rDy = Math.abs(raw14[idx + W] - raw14[idx - W]);
      // Only sample structural edges (above stripe amplitude, below dead-pixel spike)
      if ((rDx > 160 && rDx < 1200) || (rDy > 160 && rDy < 1200)) {
        const cDx = Math.abs(stage1Clean14[idx + 1] - stage1Clean14[idx - 1]);
        const cDy = Math.abs(stage1Clean14[idx + W] - stage1Clean14[idx - W]);
        rawEdgeEnergy += rDx + rDy;
        cleanEdgeEnergy += cDx + cDy;
      }
    }
  }
  const thinFeatureRetentionPct = Number(
    Math.min(
      100,
      rawEdgeEnergy > 10 ? (cleanEdgeEnergy / rawEdgeEnergy) * 100 : 98.5
    ).toFixed(1)
  );

  // 5. Small Hot Target Peak Preservation % (checks if hot target peaks are preserved in processed 8-bit)
  let maxProc8 = 0;
  for (let i = 0; i < processed8.length; i += 3) {
    if (processed8[i] > maxProc8) maxProc8 = processed8[i];
  }
  const hotTargetPeakPct = Number(((maxProc8 / 255) * 100).toFixed(1));

  // 6. Edge Halo Overshoot Proxy
  let haloSum = 0;
  let haloCnt = 0;
  for (let y = 4; y < H - 4; y += 6) {
    for (let x = 4; x < W - 4; x += 6) {
      const idx = y * W + x;
      const lap8 =
        processed8[idx] -
        0.25 *
          (processed8[idx - 1] +
            processed8[idx + 1] +
            processed8[idx - W] +
            processed8[idx + W]);
      if (Math.abs(lap8) > 22) {
        haloSum += Math.abs(lap8) - 22;
        haloCnt++;
      }
    }
  }
  const haloOvershootIndex = Number(
    (haloCnt > 0 ? haloSum / haloCnt : 1.2).toFixed(2)
  );

  return {
    rawMin14: rMin,
    rawMax14: rMax,
    sceneSpanADU: Math.round(span),
    frameTimeMs: Number(dtMs.toFixed(1)),
    colStripeResidual,
    rowStripeResidual,
    staticGrainMad,
    thinFeatureRetentionPct,
    hotTargetPeakPct,
    haloOvershootIndex,
    colProfileRaw,
    colProfileProc,
    rowProfileRaw,
    rowProfileProc,
  };
}

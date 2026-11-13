export type SequencePreset =
  | "shahed_intercept"
  | "horizon_pan"
  | "burning_convoy"
  | "stripe_vs_scene_wire"
  | "multi_freq_grid_fpn"
  | "point_target_and_badpx";

export type MethodologyId = "instance1" | "instance2" | "instance3";

export interface CustomBinInfo {
  fileName: string;
  totalFrames: number;
  width: number;
  height: number;
  fileSizeBytes: number;
  maxRaw16Seen: number;
  minRaw16Seen: number;
  highBitsNonZeroPct: number; // % of words where bits 14-15 are non-zero (checks 14-bit assumption)
  swappedEndiannessSpan: number; // Diagnostic check for little-endian vs big-endian
}

export interface IspConfig {
  // Original 5 stage toggles & sliders (preserved in all 3 instances)
  stage1DestripeAndBadPx: boolean;
  stage2TemporalQuantileAgc: boolean;
  stage3DualPlateauCompression: boolean;
  stage4EdgePreservingDetail: boolean;
  antiGhostingPureSpatial: boolean;
  splitWipePct: number;
  agcSlewLimitADU: number;
  detailGain: number;
  verticalStrength: number;
  horizontalStrength: number;

  // Baseline comparison selector for left side of split wipe
  leftBaselineMode: "naive_minmax" | "original_clearhot";

  // Additional Technique Toggles (applied on top of / enhancing existing pipeline)
  enableMethodologyDestripe: boolean;
  enableMethodologyEnhancement: boolean;
  enableLiveCnnResidual: boolean;

  // Instance 1 specific parameters (Edge-Gated Huber/Median Destripe + Dual-Plateau CLAHE + DoG Coring)
  edgeGateThresholdADU: number; // Protects real vertical/horizontal scene structures
  rankImpulseProtection: boolean; // Preserves 2x2 hot targets while removing 1px static spikes
  dualPlateauBlend: number; // 0..1 blend between quantile linear & dual-plateau histogram
  dogNoiseCoring: number; // Deadzone coring threshold for static grain suppression

  // Instance 2 specific parameters (Wavelet Garrote Subband Shrinkage + Guided Filter Base/Detail)
  waveletShrinkThreshold: number; // ADU threshold for directional Haar subband shrinkage
  spectralCombNotch: number; // 0..1 periodic parallel static line notch strength
  guidedFilterRadius: number; // 2..6 radius for edge-preserving base/detail decomposition
  guidedFilterEps: number; // Regularization epsilon for halo-free base compression
  sCurveContrast: number; // S-curve tone compression strength on Base layer

  // Instance 3 specific parameters (Cross-Bilateral Strip + Motion-Gated Kalman + Integral ACE)
  bilateralRangeSigmaADU: number; // Radiometric sigma for 1D cross-bilateral destriping
  kalmanMotionGateADU: number; // Motion threshold in 14-bit ADU to zero out ghosting trails
  kalmanTemporalAlpha: number; // Static background temporal smoothing strength (0..0.85)
  localAceStrength: number; // Integral-image local standard deviation contrast boost (0..1)
  cnnBlendStrength: number; // 0..1 strength of live residual CNN correction in 14-bit space
}

export interface CnnWeightsState {
  methodology: MethodologyId;
  architectureName: string;
  trainedEpochs: number;
  isTrained: boolean;
  initialLoss: number;
  currentLoss: number;
  valLoss: number;
  lossHistory: number[];
  paramCount: number;
  lastTrainTimeMs: number;
  // Learned weights stored as Float32Arrays for live 14-bit residual inference
  kHoriz: Float32Array; // 1x7 horizontal stripe extractor
  kVert: Float32Array;  // 7x1 vertical stripe extractor
  kSpatial: Float32Array; // 3x3 local static/edge context kernel
  mixWeights: Float32Array; // Channel mixing / shrinkage weights
  bias: number;
}

export interface FrameTelemetryStats {
  rawMin14: number;
  rawMax14: number;
  sceneSpanADU: number;
  frameTimeMs: number;
  colStripeResidual: number; // Flat-ROI high-pass column profile std dev (lower = fewer vertical lines)
  rowStripeResidual: number; // Flat-ROI high-pass row profile std dev (lower = fewer horizontal lines)
  staticGrainMad: number;    // Flat-ROI 3x3 median absolute deviation (lower = less static grain)
  thinFeatureRetentionPct: number; // % contrast retained on thin 1px scene features (synthetic) or edge proxy
  hotTargetPeakPct: number;  // % of small hot target contrast preserved
  haloOvershootIndex: number; // Edge overshoot artifact proxy (lower = fewer halos)
  colProfileRaw: number[];   // 64-point sampled column mean profile for sparkline plot
  colProfileProc: number[];  // 64-point sampled processed column profile for sparkline plot
  rowProfileRaw: number[];   // 64-point sampled row mean profile
  rowProfileProc: number[];  // 64-point sampled processed row profile
}

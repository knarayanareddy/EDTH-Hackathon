"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/core.ts
var core_exports = {};
__export(core_exports, {
  LABELS: () => LABELS,
  METHODS: () => METHODS,
  VERSION: () => VERSION,
  configFor: () => configFor,
  createMethodRunner: () => createMethodRunner,
  decodeBuffer: () => decodeBuffer,
  decodeConfig: () => decodeConfig,
  frameCountFor: () => frameCountFor,
  medianGap: () => medianGap,
  readFrame: () => readFrame,
  reference: () => reference,
  runMethod: () => runMethod,
  stats: () => stats,
  synthetic: () => synthetic,
  temporalDifference: () => temporalDifference,
  validSettings: () => validSettings
});
module.exports = __toCommonJS(core_exports);

// src/argos/cnnPrototypeEngine.ts
function createInitialCnnState(methodology) {
  if (methodology === "instance1") {
    return {
      methodology: "instance1",
      architectureName: "StripeResNet-1D2D (Separable 1\xD77 / 7\xD71 + 3\xD73 Residual CNN)",
      trainedEpochs: 0,
      isTrained: false,
      initialLoss: 0,
      currentLoss: 0,
      valLoss: 0,
      lossHistory: [],
      paramCount: 148,
      lastTrainTimeMs: 0,
      kHoriz: new Float32Array([-0.02, -0.04, -0.08, 0.28, -0.08, -0.04, -0.02]),
      kVert: new Float32Array([0.05, 0.1, 0.2, 0.3, 0.2, 0.1, 0.05]),
      kSpatial: new Float32Array([
        -0.02,
        -0.03,
        -0.02,
        -0.03,
        0.2,
        -0.03,
        -0.02,
        -0.03,
        -0.02
      ]),
      mixWeights: new Float32Array([0.15, 0.12, 0.1, 45]),
      // [wVertStripe, wHorizStripe, wStatic, edgeGateScale]
      bias: 0
    };
  }
  if (methodology === "instance2") {
    return {
      methodology: "instance2",
      architectureName: "HaarWaveletCNN (2D DWT Subband HL/LH/HH Learned Shrinkage Net)",
      trainedEpochs: 0,
      isTrained: false,
      initialLoss: 0,
      currentLoss: 0,
      valLoss: 0,
      lossHistory: [],
      paramCount: 192,
      lastTrainTimeMs: 0,
      kHoriz: new Float32Array([0.1, 0.2, 0.4, 0.2, 0.1, 0, 0]),
      // HL vertical-stripe subband smoother along y
      kVert: new Float32Array([0.1, 0.2, 0.4, 0.2, 0.1, 0, 0]),
      // LH horizontal-stripe subband smoother along x
      kSpatial: new Float32Array([
        0.05,
        0.1,
        0.05,
        0.1,
        0.4,
        0.1,
        0.05,
        0.1,
        0.05
      ]),
      // [hlShrinkGain, lhShrinkGain, hhStaticGain, softThresholdADU]
      mixWeights: new Float32Array([0.15, 0.15, 0.12, 18]),
      bias: 0
    };
  }
  return {
    methodology: "instance3",
    architectureName: "BurstTempCNN (Self-Supervised Orthogonal Projection + Temporal Gate CNN)",
    trainedEpochs: 0,
    isTrained: false,
    initialLoss: 0,
    currentLoss: 0,
    valLoss: 0,
    lossHistory: [],
    paramCount: 224,
    lastTrainTimeMs: 0,
    kHoriz: new Float32Array([-0.03, -0.06, -0.1, 0.38, -0.1, -0.06, -0.03]),
    kVert: new Float32Array([0.08, 0.14, 0.2, 0.16, 0.2, 0.14, 0.08]),
    kSpatial: new Float32Array([
      -0.02,
      -0.04,
      -0.02,
      -0.04,
      0.24,
      -0.04,
      -0.02,
      -0.04,
      -0.02
    ]),
    // [wColNull, wRowNull, wTemporalStatic, motionProtectSigma]
    mixWeights: new Float32Array([0.14, 0.14, 0.12, 65]),
    bias: 0
  };
}
function applyLiveCnnResidual14(input14, W, H, cnn, blendStrength = 1) {
  const N = W * H;
  const out = new Float32Array(input14);
  if (blendStrength <= 1e-3) return out;
  const [w1, w2, w3, gateScale] = cnn.mixWeights;
  const kH = cnn.kHoriz;
  const kV = cnn.kVert;
  const kS = cnn.kSpatial;
  if (cnn.methodology === "instance1") {
    const horizHP = new Float32Array(N);
    const vertHP = new Float32Array(N);
    for (let y = 3; y < H - 3; y++) {
      const rowOff = y * W;
      for (let x = 3; x < W - 3; x++) {
        const idx = rowOff + x;
        const c = input14[idx];
        let hConv = 0;
        for (let k = -3; k <= 3; k++) {
          const diff = c - input14[rowOff + x + k];
          const clamped = Math.max(-gateScale, Math.min(gateScale, diff));
          hConv += clamped * (k === 0 ? 0 : -kH[k + 3]);
        }
        horizHP[idx] = hConv;
        let vConv = 0;
        for (let k = -3; k <= 3; k++) {
          const diff = c - input14[(y + k) * W + x];
          const clamped = Math.max(-gateScale, Math.min(gateScale, diff));
          vConv += clamped * (k === 0 ? 0 : -kH[k + 3]);
        }
        vertHP[idx] = vConv;
      }
    }
    for (let y = 3; y < H - 3; y++) {
      const rowOff = y * W;
      for (let x = 3; x < W - 3; x++) {
        const idx = rowOff + x;
        let colStripeEst = 0;
        let rowStripeEst = 0;
        for (let k = -3; k <= 3; k++) {
          colStripeEst += horizHP[(y + k) * W + x] * kV[k + 3];
          rowStripeEst += vertHP[rowOff + x + k] * kV[k + 3];
        }
        const c = input14[idx];
        const l = input14[idx - 1];
        const r = input14[idx + 1];
        const u = input14[idx - W];
        const d = input14[idx + W];
        const localLap = c - 0.25 * (l + r + u + d);
        const edgeGate = Math.exp(-(localLap * localLap) / (2 * gateScale * gateScale));
        const staticRes = localLap * edgeGate * kS[4];
        const predictedNoise = (w1 * colStripeEst + w2 * rowStripeEst + w3 * staticRes + cnn.bias) * blendStrength;
        out[idx] = c - predictedNoise;
      }
    }
    return out;
  }
  if (cnn.methodology === "instance2") {
    const halfW = Math.floor(W / 2);
    const halfH = Math.floor(H / 2);
    const thresh = Math.max(4, gateScale);
    const LL = new Float32Array(halfW * halfH);
    const HL = new Float32Array(halfW * halfH);
    const LH = new Float32Array(halfW * halfH);
    const HH = new Float32Array(halfW * halfH);
    for (let hy = 0; hy < halfH; hy++) {
      const y0 = hy * 2;
      const y1 = y0 + 1;
      for (let hx = 0; hx < halfW; hx++) {
        const x0 = hx * 2;
        const x1 = x0 + 1;
        const a = input14[y0 * W + x0];
        const b = input14[y0 * W + x1];
        const c = input14[y1 * W + x0];
        const d = input14[y1 * W + x1];
        const hIdx = hy * halfW + hx;
        LL[hIdx] = 0.25 * (a + b + c + d);
        HL[hIdx] = 0.25 * (a - b + c - d);
        LH[hIdx] = 0.25 * (a + b - c - d);
        HH[hIdx] = 0.25 * (a - b - c + d);
      }
    }
    for (let hy = 2; hy < halfH - 2; hy++) {
      for (let hx = 2; hx < halfW - 2; hx++) {
        const hIdx = hy * halfW + hx;
        let hlCoherent = 0;
        for (let k = -2; k <= 2; k++) {
          hlCoherent += HL[(hy + k) * halfW + hx] * kH[k + 2];
        }
        let lhCoherent = 0;
        for (let k = -2; k <= 2; k++) {
          lhCoherent += LH[hy * halfW + (hx + k)] * kV[k + 2];
        }
        const hlGate = Math.exp(-(hlCoherent * hlCoherent) / (2 * thresh * thresh * 4));
        const lhGate = Math.exp(-(lhCoherent * lhCoherent) / (2 * thresh * thresh * 4));
        const hhVal = HH[hIdx];
        const hhGate = Math.exp(-(hhVal * hhVal) / (2 * thresh * thresh));
        HL[hIdx] -= hlCoherent * Math.min(0.95, w1) * hlGate * blendStrength;
        LH[hIdx] -= lhCoherent * Math.min(0.95, w2) * lhGate * blendStrength;
        HH[hIdx] -= hhVal * Math.min(0.9, w3) * hhGate * blendStrength;
      }
    }
    for (let hy = 0; hy < halfH; hy++) {
      const y0 = hy * 2;
      const y1 = y0 + 1;
      for (let hx = 0; hx < halfW; hx++) {
        const x0 = hx * 2;
        const x1 = x0 + 1;
        const hIdx = hy * halfW + hx;
        const ll = LL[hIdx];
        const hl = HL[hIdx];
        const lh = LH[hIdx];
        const hh = HH[hIdx];
        out[y0 * W + x0] = ll + hl + lh + hh;
        out[y0 * W + x1] = ll - hl + lh - hh;
        out[y1 * W + x0] = ll + hl - lh - hh;
        out[y1 * W + x1] = ll - hl - lh + hh;
      }
    }
    return out;
  }
  const colRes = new Float32Array(W);
  const rowRes = new Float32Array(H);
  for (let x = 1; x < W - 1; x++) {
    let sumDiff = 0;
    let weightSum = 0;
    for (let y = 4; y < H - 4; y += 2) {
      const idx = y * W + x;
      const dx = input14[idx] - 0.5 * (input14[idx - 1] + input14[idx + 1]);
      const dy = input14[idx + W] - input14[idx - W];
      const w = Math.exp(-(dx * dx + 0.5 * dy * dy) / (2 * gateScale * gateScale));
      sumDiff += dx * w;
      weightSum += w;
    }
    colRes[x] = weightSum > 1e-3 ? sumDiff / weightSum : 0;
  }
  for (let y = 1; y < H - 1; y++) {
    let sumDiff = 0;
    let weightSum = 0;
    const rowOff = y * W;
    for (let x = 4; x < W - 4; x += 2) {
      const idx = rowOff + x;
      const dy = input14[idx] - 0.5 * (input14[idx - W] + input14[idx + W]);
      const dx = input14[idx + 1] - input14[idx - 1];
      const w = Math.exp(-(dy * dy + 0.5 * dx * dx) / (2 * gateScale * gateScale));
      sumDiff += dy * w;
      weightSum += w;
    }
    rowRes[y] = weightSum > 1e-3 ? sumDiff / weightSum : 0;
  }
  for (let y = 1; y < H - 1; y++) {
    const rowOff = y * W;
    for (let x = 1; x < W - 1; x++) {
      const idx = rowOff + x;
      const c = input14[idx];
      const avg4 = 0.25 * (input14[idx - 1] + input14[idx + 1] + input14[idx - W] + input14[idx + W]);
      const diff = c - avg4;
      const staticGate = Math.exp(-(diff * diff) / (2 * gateScale * gateScale));
      const corr = (w1 * colRes[x] + w2 * rowRes[y] + w3 * diff * staticGate + cnn.bias) * blendStrength;
      out[idx] = c - corr;
    }
  }
  return out;
}

// src/argos/thermalPipelineEngine.ts
var DEFAULT_ISP_CONFIGS = {
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
    cnnBlendStrength: 0.75
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
    dogNoiseCoring: 3,
    waveletShrinkThreshold: 46,
    spectralCombNotch: 0.55,
    guidedFilterRadius: 3,
    guidedFilterEps: 2200,
    sCurveContrast: 0.42,
    bilateralRangeSigmaADU: 110,
    kalmanMotionGateADU: 95,
    kalmanTemporalAlpha: 0.55,
    localAceStrength: 0.45,
    cnnBlendStrength: 0.75
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
    dogNoiseCoring: 3,
    waveletShrinkThreshold: 42,
    spectralCombNotch: 0.5,
    guidedFilterRadius: 3,
    guidedFilterEps: 2e3,
    sCurveContrast: 0.35,
    bilateralRangeSigmaADU: 115,
    kalmanMotionGateADU: 90,
    kalmanTemporalAlpha: 0.58,
    localAceStrength: 0.52,
    cnnBlendStrength: 0.75
  }
};
function smooth1DProfile(profile, radius) {
  const len = profile.length;
  const out = new Float32Array(len);
  const sigma = Math.max(1, radius * 0.5);
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
function runOriginalClearHotBaseline8(raw14, W, H, cfg, pLow, pHigh) {
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
        if (v > 1e3 && v < 12e3) {
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
      let sum = 0, count = 0;
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
        let v = raw14[idx] - (colBias[x] - globalMed) * cfg.verticalStrength - rowBias[y] * cfg.horizontalStrength;
        const avgN = (raw14[idx - 1] + raw14[idx + 1] + raw14[idx - W] + raw14[idx + W]) * 0.25;
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
      normBuf[i] = Math.max(0, Math.min(232, (v - pLow) / span * 232));
    } else {
      const excess = Math.min(1, (v - pHigh) / 7e3);
      normBuf[i] = 232 + excess * 23;
    }
  }
  const out8 = new Uint8ClampedArray(N);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x;
      let center = normBuf[idx];
      if (cfg.stage4EdgePreservingDetail && y > 0 && y < H - 1 && x > 0 && x < W - 1) {
        const localMean = (normBuf[idx - 1] + normBuf[idx + 1] + normBuf[idx - W] + normBuf[idx + W]) * 0.25;
        const diff = center - localMean;
        const clampedDiff = Math.max(-18, Math.min(18, diff));
        center = center + clampedDiff * (cfg.detailGain - 1) * 1.8;
      }
      out8[idx] = Math.max(0, Math.min(255, Math.round(center)));
    }
  }
  return out8;
}
function runThermalInstancePipeline(params) {
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
    frameKey
  } = params;
  const t0 = performance.now();
  const N = W * H;
  let rMin = 16383;
  let rMax = 0;
  for (let i = 0; i < N; i++) {
    const v = raw14[i];
    if (v < rMin) rMin = v;
    if (v > rMax) rMax = v;
  }
  let stage1Buf = new Float32Array(raw14);
  if (cfg.stage1DestripeAndBadPx) {
    if (!cfg.enableMethodologyDestripe) {
      const colBias = new Float32Array(W);
      let globalMed = 0;
      for (let x = 0; x < W; x++) {
        let sum = 0, cnt = 0;
        for (let y = 16; y < H - 16; y += 4) {
          const v = raw14[y * W + x];
          if (v > 1e3 && v < 12e3) {
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
        let sum = 0, count = 0;
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
          let v = raw14[idx] - (colBias[x] - globalMed) * cfg.verticalStrength - rowBias[y] * cfg.horizontalStrength;
          const avgN = (raw14[idx - 1] + raw14[idx + 1] + raw14[idx - W] + raw14[idx + W]) * 0.25;
          if (Math.abs(v - avgN) > 1800) v = avgN;
          stage1Buf[idx] = v;
        }
      }
    } else if (methodology === "instance1") {
      const edgeThresh = Math.max(25, cfg.edgeGateThresholdADU);
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
            const w = 1 / (1 + dx * dx / (edgeThresh * edgeThresh * 0.25));
            sumDiff += dx * w;
            weightSum += w;
          }
        }
        colDiff[x] = weightSum > 4 ? sumDiff / weightSum : 0;
        colIntegrated[x] = colIntegrated[x - 1] + colDiff[x];
      }
      const colLowPass = smooth1DProfile(colIntegrated, 9);
      const colStripeEst = new Float32Array(W);
      for (let x = 0; x < W; x++) {
        colStripeEst[x] = colIntegrated[x] - colLowPass[x];
      }
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
            const w = 1 / (1 + dy * dy / (edgeThresh * edgeThresh * 0.25));
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
      const nbrs = new Float32Array(8);
      for (let y = 1; y < H - 1; y++) {
        const rowOff = y * W;
        for (let x = 1; x < W - 1; x++) {
          const idx = rowOff + x;
          const rawV = raw14[idx];
          const localHorizGrad = Math.abs(rawV - 0.5 * (raw14[idx - 1] + raw14[idx + 1]));
          const localVertGrad = Math.abs(rawV - 0.5 * (raw14[idx - W] + raw14[idx + W]));
          const colProtect = localHorizGrad > edgeThresh * 1.35 ? 0.25 : 1;
          const rowProtect = localVertGrad > edgeThresh * 1.35 ? 0.25 : 1;
          let v = rawV - colStripeEst[x] * cfg.verticalStrength * colProtect - rowStripeEst[y] * cfg.horizontalStrength * rowProtect;
          if (cfg.rankImpulseProtection) {
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
            const avg4 = (raw14[idx - 1] + raw14[idx + 1] + raw14[idx - W] + raw14[idx + W]) * 0.25;
            if (Math.abs(v - avg4) > 1800) v = avg4;
          }
          stage1Buf[idx] = v;
        }
      }
    } else if (methodology === "instance2") {
      const shrinkT = Math.max(8, cfg.waveletShrinkThreshold);
      const colProf = new Float32Array(W);
      for (let x = 0; x < W; x++) {
        let sum = 0, cnt = 0;
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
        let sum = 0, cnt = 0;
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
      const colSmooth1 = smooth1DProfile(colProf, 1);
      const colSmooth2 = smooth1DProfile(colProf, 3);
      const colSmooth4 = smooth1DProfile(colProf, 8);
      const colWaveletStripe = new Float32Array(W);
      for (let x = 0; x < W; x++) {
        const d1 = colProf[x] - colSmooth1[x];
        const d2 = colSmooth1[x] - colSmooth2[x];
        const d3 = colSmooth2[x] - colSmooth4[x];
        const g1 = Math.abs(d1) < shrinkT ? d1 : d1 * (shrinkT * shrinkT / (d1 * d1));
        const g2 = Math.abs(d2) < shrinkT ? d2 : d2 * (shrinkT * shrinkT / (d2 * d2));
        const g3 = Math.abs(d3) < shrinkT * 0.8 ? d3 * cfg.spectralCombNotch : d3 * (shrinkT * shrinkT * 0.64 / (d3 * d3)) * cfg.spectralCombNotch;
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
        const g1 = Math.abs(d1) < shrinkT ? d1 : d1 * (shrinkT * shrinkT / (d1 * d1));
        const g2 = Math.abs(d2) < shrinkT ? d2 : d2 * (shrinkT * shrinkT / (d2 * d2));
        const g3 = Math.abs(d3) < shrinkT * 0.8 ? d3 * cfg.spectralCombNotch : d3 * (shrinkT * shrinkT * 0.64 / (d3 * d3)) * cfg.spectralCombNotch;
        rowWaveletStripe[y] = g1 + g2 + g3;
      }
      for (let y = 1; y < H - 1; y++) {
        const rowOff = y * W;
        for (let x = 1; x < W - 1; x++) {
          const idx = rowOff + x;
          const rawV = raw14[idx];
          const localDx = Math.abs(rawV - 0.5 * (raw14[idx - 1] + raw14[idx + 1]));
          const localDy = Math.abs(rawV - 0.5 * (raw14[idx - W] + raw14[idx + W]));
          const colGate = Math.exp(-(localDx * localDx) / (2 * 180 * 180));
          const rowGate = Math.exp(-(localDy * localDy) / (2 * 180 * 180));
          let v = rawV - colWaveletStripe[x] * cfg.verticalStrength * colGate - rowWaveletStripe[y] * cfg.horizontalStrength * rowGate;
          const n1 = raw14[idx - 1], n2 = raw14[idx + 1], n3 = raw14[idx - W], n4 = raw14[idx + W];
          const avg4 = (n1 + n2 + n3 + n4) * 0.25;
          if (Math.abs(v - avg4) > 1750) {
            v = avg4;
          } else if (cfg.spectralCombNotch > 0.1) {
            const grainDiff = v - avg4;
            if (Math.abs(grainDiff) < 24) {
              v -= grainDiff * 0.35 * cfg.spectralCombNotch;
            }
          }
          stage1Buf[idx] = v;
        }
      }
    } else {
      const sigmaR = Math.max(20, cfg.bilateralRangeSigmaADU);
      const twoSigmaRSq = 2 * sigmaR * sigmaR;
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
          const avg4 = (raw14[idx - 1] + raw14[idx + 1] + raw14[idx - W] + raw14[idx + W]) * 0.25;
          if (Math.abs(c - avg4) > 1750) {
            c = avg4;
          }
          const dLeft0 = c - raw14[idx - 1];
          const dRight0 = c - raw14[idx + 1];
          const dLeftU = raw14[idx - W] - raw14[idx - W - 1];
          const dRightU = raw14[idx - W] - raw14[idx - W + 1];
          const dLeftD = raw14[idx + W] - raw14[idx + W - 1];
          const dRightD = raw14[idx + W] - raw14[idx + W + 1];
          const coherentColResidual = (dLeft0 + dRight0) * 0.25 + (dLeftU + dRightU) * 0.125 + (dLeftD + dRightD) * 0.125;
          const wCol = Math.exp(
            -(coherentColResidual * coherentColResidual) / twoSigmaRSq
          );
          const colCorr = coherentColResidual * wCol * cfg.verticalStrength;
          const dUp0 = c - raw14[idx - W];
          const dDown0 = c - raw14[idx + W];
          const dUpL = raw14[idx - 1] - raw14[idx - W - 1];
          const dDownL = raw14[idx - 1] - raw14[idx + W - 1];
          const dUpR = raw14[idx + 1] - raw14[idx - W + 1];
          const dDownR = raw14[idx + 1] - raw14[idx + W + 1];
          const coherentRowResidual = (dUp0 + dDown0) * 0.25 + (dUpL + dDownL) * 0.125 + (dUpR + dDownR) * 0.125;
          const wRow = Math.exp(
            -(coherentRowResidual * coherentRowResidual) / twoSigmaRSq
          );
          const rowCorr = coherentRowResidual * wRow * cfg.horizontalStrength;
          let spatialClean = c - colCorr - rowCorr;
          if (hasValidPrev && tempAlpha > 0.01) {
            const prevV = prevKalman[idx];
            const innovation = Math.abs(spatialClean - prevV);
            if (innovation < motionGate) {
              const motionWeight = tempAlpha * Math.exp(-(innovation * innovation) / (2 * motionGate * motionGate * 0.35));
              spatialClean = (1 - motionWeight) * spatialClean + motionWeight * prevV;
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
  if (cfg.enableLiveCnnResidual) {
    stage1Buf = applyLiveCnnResidual14(
      stage1Buf,
      W,
      H,
      cnnState,
      cfg.cnnBlendStrength
    );
  }
  let pLow = rMin;
  let pHigh = rMax;
  if (cfg.stage2TemporalQuantileAgc) {
    const sortedSample = [];
    for (let i = 0; i < N; i += 11) {
      sortedSample.push(stage1Buf[i]);
    }
    sortedSample.sort((a, b) => a - b);
    const idxLow = Math.floor(sortedSample.length * 0.02);
    const idxHigh = Math.floor(
      sortedSample.length * (cfg.stage3DualPlateauCompression ? 0.975 : 0.999)
    );
    const rawPLow = sortedSample[idxLow] !== void 0 ? sortedSample[idxLow] : 7e3;
    const rawPHigh = sortedSample[idxHigh] !== void 0 ? sortedSample[idxHigh] : 8200;
    const maxDelta = cfg.agcSlewLimitADU;
    if (lastFrameKeyRef.current !== frameKey) {
      pLow = lastFrameKeyRef.current === "" ? rawPLow : prevBlackRef.current + Math.max(
        -maxDelta,
        Math.min(maxDelta, rawPLow - prevBlackRef.current)
      );
      pHigh = lastFrameKeyRef.current === "" ? rawPHigh : prevWhiteRef.current + Math.max(
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
  const normBuf = new Float32Array(N);
  if (cfg.enableMethodologyEnhancement && methodology === "instance2") {
    const r = Math.max(1, Math.min(5, Math.round(cfg.guidedFilterRadius)));
    const eps = Math.max(100, cfg.guidedFilterEps);
    const sContrast = cfg.sCurveContrast;
    for (let y = 0; y < H; y++) {
      const y0 = Math.max(0, y - r);
      const y1 = Math.min(H - 1, y + r);
      for (let x = 0; x < W; x++) {
        const x0 = Math.max(0, x - r);
        const x1 = Math.min(W - 1, x + r);
        let sum = 0, sumSq = 0, cnt = 0;
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
        const a_k = variance / (variance + eps);
        const v = stage1Buf[y * W + x];
        const base14 = (1 - a_k * 0.35) * mean + a_k * 0.35 * v;
        const detail14 = v - base14;
        let t = Math.max(0, Math.min(1, (base14 - pLow) / span));
        if (sContrast > 0.01) {
          const sCurve = t + sContrast * 1.4 * t * (1 - t) * (2 * t - 1);
          t = Math.max(0, Math.min(1, sCurve));
        }
        let mapped = t * 232;
        if (v > pHigh) {
          const excess = Math.min(1, (v - pHigh) / 7e3);
          mapped = 232 + excess * 23;
        }
        const detail8 = detail14 / span * 232 * (0.85 + cfg.detailGain * 0.55);
        normBuf[y * W + x] = Math.max(0, Math.min(255, mapped + detail8));
      }
    }
  } else {
    for (let i = 0; i < N; i++) {
      const v = stage1Buf[i];
      if (v <= pHigh) {
        normBuf[i] = Math.max(0, Math.min(232, (v - pLow) / span * 232));
      } else {
        const excess = Math.min(1, (v - pHigh) / 7e3);
        normBuf[i] = 232 + excess * 23;
      }
    }
    if (cfg.enableMethodologyEnhancement && methodology === "instance1" && cfg.dualPlateauBlend > 0.01) {
      const hist = new Uint32Array(256);
      for (let i = 0; i < N; i++) {
        const b = Math.max(0, Math.min(255, Math.round(normBuf[i])));
        hist[b]++;
      }
      const upperPlateau = Math.max(12, Math.floor(N / 256 * 2.4));
      const lowerPlateau = Math.max(2, Math.floor(N / 256 * 0.18));
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
        const eq8 = cdf[bin] / cdfMax * 246;
        normBuf[i] = (1 - blend) * orig8 + blend * eq8;
      }
    } else if (cfg.enableMethodologyEnhancement && methodology === "instance3" && cfg.localAceStrength > 0.01) {
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
          const sum = sat[y1 * stride + x1] - sat[y0 * stride + x1] - sat[y1 * stride + x0] + sat[y0 * stride + x0];
          const sumSq = satSq[y1 * stride + x1] - satSq[y0 * stride + x1] - satSq[y1 * stride + x0] + satSq[y0 * stride + x0];
          const mean = sum / area;
          const std = Math.sqrt(Math.max(0, sumSq / area - mean * mean));
          const center = normBuf[y * W + x];
          const localDev = center - mean;
          const adaptiveFactor = 1 + aceGain * Math.min(2.2, 14 / Math.max(5.5, std));
          const clampedDev = Math.max(-28, Math.min(28, localDev * adaptiveFactor));
          tempAce[y * W + x] = Math.max(0, Math.min(255, mean + clampedDev));
        }
      }
      for (let i = 0; i < N; i++) normBuf[i] = tempAce[i];
    }
  }
  if (!cfg.antiGhostingPureSpatial && prevNormFrameRef.current?.length === N) {
    for (let i = 0; i < N; i++) {
      normBuf[i] = 0.25 * normBuf[i] + 0.75 * prevNormFrameRef.current[i];
    }
  }
  prevNormFrameRef.current = normBuf.slice();
  const processed8 = new Uint8ClampedArray(N);
  const coring = cfg.enableMethodologyEnhancement && methodology === "instance1" ? cfg.dogNoiseCoring : 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x;
      let center = normBuf[idx];
      if (cfg.stage4EdgePreservingDetail && y > 1 && y < H - 2 && x > 1 && x < W - 2) {
        const l = normBuf[idx - 1];
        const r = normBuf[idx + 1];
        const u = normBuf[idx - W];
        const d = normBuf[idx + W];
        const localMean1 = (l + r + u + d) * 0.25;
        let diff = center - localMean1;
        if (cfg.enableMethodologyEnhancement && methodology === "instance1") {
          const outerMean = (normBuf[idx - 2] + normBuf[idx + 2] + normBuf[idx - 2 * W] + normBuf[idx + 2 * W]) * 0.25;
          const mediumDetail = localMean1 - outerMean;
          const coredFine = Math.abs(diff) <= coring ? 0 : Math.sign(diff) * (Math.abs(diff) - coring);
          diff = coredFine + 0.45 * mediumDetail;
        }
        const clampedDiff = Math.max(-18, Math.min(18, diff));
        center = center + clampedDiff * (cfg.detailGain - 1) * 1.8;
      }
      processed8[idx] = Math.max(0, Math.min(255, Math.round(center)));
    }
  }
  const leftBaseline8 = new Uint8ClampedArray(N);
  if (cfg.leftBaselineMode === "original_clearhot") {
    const orig = runOriginalClearHotBaseline8(raw14, W, H, cfg, pLow, pHigh);
    leftBaseline8.set(orig);
  } else {
    const naiveSpan = Math.max(1, rMax - rMin);
    for (let i = 0; i < N; i++) {
      leftBaseline8[i] = Math.round((raw14[i] - rMin) / naiveSpan * 255);
    }
  }
  const dt = performance.now() - t0;
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
    telemetry
  };
}
function computeFrameTelemetry(raw14, stage1Clean14, processed8, W, H, rMin, rMax, span, dtMs) {
  const yStart = 8;
  const yEnd = Math.min(H - 8, 44);
  const xStart = Math.floor(W * 0.45);
  const xEnd = W - 12;
  const colMeansClean = [];
  const colProfileRaw = [];
  const colProfileProc = [];
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
  let colHpSq = 0;
  for (let i = 1; i < colMeansClean.length - 1; i++) {
    const hp = colMeansClean[i] - 0.5 * (colMeansClean[i - 1] + colMeansClean[i + 1]);
    colHpSq += hp * hp;
  }
  const colStripeResidual = Number(
    Math.sqrt(colHpSq / Math.max(1, colMeansClean.length - 2)).toFixed(2)
  );
  const rowMeansClean = [];
  const rowProfileRaw = [];
  const rowProfileProc = [];
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
    const hp = rowMeansClean[i] - 0.5 * (rowMeansClean[i - 1] + rowMeansClean[i + 1]);
    rowHpSq += hp * hp;
  }
  const rowStripeResidual = Number(
    Math.sqrt(rowHpSq / Math.max(1, rowMeansClean.length - 2)).toFixed(2)
  );
  let madSum = 0;
  let madCnt = 0;
  for (let y = yStart + 1; y < yEnd - 1; y += 2) {
    for (let x = xStart + 1; x < xEnd - 1; x += 2) {
      const idx = y * W + x;
      const c = stage1Clean14[idx];
      const avg4 = 0.25 * (stage1Clean14[idx - 1] + stage1Clean14[idx + 1] + stage1Clean14[idx - W] + stage1Clean14[idx + W]);
      madSum += Math.abs(c - avg4);
      madCnt++;
    }
  }
  const staticGrainMad = Number((madSum / Math.max(1, madCnt)).toFixed(2));
  let rawEdgeEnergy = 0;
  let cleanEdgeEnergy = 0;
  for (let y = Math.floor(H * 0.2); y < Math.floor(H * 0.8); y += 4) {
    for (let x = Math.floor(W * 0.15); x < Math.floor(W * 0.85); x += 4) {
      const idx = y * W + x;
      const rDx = Math.abs(raw14[idx + 1] - raw14[idx - 1]);
      const rDy = Math.abs(raw14[idx + W] - raw14[idx - W]);
      if (rDx > 160 && rDx < 1200 || rDy > 160 && rDy < 1200) {
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
      rawEdgeEnergy > 10 ? cleanEdgeEnergy / rawEdgeEnergy * 100 : 98.5
    ).toFixed(1)
  );
  let maxProc8 = 0;
  for (let i = 0; i < processed8.length; i += 3) {
    if (processed8[i] > maxProc8) maxProc8 = processed8[i];
  }
  const hotTargetPeakPct = Number((maxProc8 / 255 * 100).toFixed(1));
  let haloSum = 0;
  let haloCnt = 0;
  for (let y = 4; y < H - 4; y += 6) {
    for (let x = 4; x < W - 4; x += 6) {
      const idx = y * W + x;
      const lap8 = processed8[idx] - 0.25 * (processed8[idx - 1] + processed8[idx + 1] + processed8[idx - W] + processed8[idx + W]);
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
    rowProfileProc
  };
}

// src/claude/dsp.ts
function quickselect(a, n, k) {
  let l = 0, r = n - 1;
  while (l < r) {
    const pivot = a[l + r >> 1];
    let i = l, j = r;
    while (i <= j) {
      while (a[i] < pivot) i++;
      while (a[j] > pivot) j--;
      if (i <= j) {
        const t = a[i];
        a[i] = a[j];
        a[j] = t;
        i++;
        j--;
      }
    }
    if (k <= j) r = j;
    else if (k >= i) l = i;
    else return a[k];
  }
  return a[k];
}
function medianOf(a, n) {
  return n === 0 ? 0 : quickselect(a, n, n >> 1);
}
function percentileSample(src, q, step = 7) {
  const n = Math.ceil(src.length / step);
  const buf = new Float32Array(n);
  let m = 0;
  for (let i = 0; i < src.length; i += step) buf[m++] = src[i];
  return quickselect(buf, m, Math.min(m - 1, Math.floor(q * m)));
}
function boxBlur(src, W, H, rx, ry = rx) {
  const tmp = new Float32Array(W * H), out = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    const o = y * W;
    let sum = 0;
    for (let x = 0; x <= Math.min(rx, W - 1); x++) sum += src[o + x];
    for (let x = 0; x < W; x++) {
      if (x > 0) {
        if (x + rx < W) sum += src[o + x + rx];
        if (x - rx - 1 >= 0) sum -= src[o + x - rx - 1];
      }
      tmp[o + x] = sum / (Math.min(W - 1, x + rx) - Math.max(0, x - rx) + 1);
    }
  }
  for (let x = 0; x < W; x++) {
    let sum = 0;
    for (let y = 0; y <= Math.min(ry, H - 1); y++) sum += tmp[y * W + x];
    for (let y = 0; y < H; y++) {
      if (y > 0) {
        if (y + ry < H) sum += tmp[(y + ry) * W + x];
        if (y - ry - 1 >= 0) sum -= tmp[(y - ry - 1) * W + x];
      }
      out[y * W + x] = sum / (Math.min(H - 1, y + ry) - Math.max(0, y - ry) + 1);
    }
  }
  return out;
}
function guidedSelf(I, W, H, r, eps) {
  const m = boxBlur(I, W, H, r);
  const sq = new Float32Array(I.length);
  for (let i = 0; i < I.length; i++) sq[i] = I[i] * I[i];
  const mm = boxBlur(sq, W, H, r);
  const a = new Float32Array(I.length), b = new Float32Array(I.length);
  for (let i = 0; i < I.length; i++) {
    const v = Math.max(0, mm[i] - m[i] * m[i]);
    a[i] = v / (v + eps);
    b[i] = m[i] - a[i] * m[i];
  }
  const ma = boxBlur(a, W, H, r), mb = boxBlur(b, W, H, r);
  const out = new Float32Array(I.length);
  for (let i = 0; i < I.length; i++) out[i] = ma[i] * I[i] + mb[i];
  return out;
}
function noiseSigma(I, W, H) {
  const bins = new Uint32Array(2048);
  let n = 0;
  for (let y = 1; y < H - 1; y += 2) for (let x = 1; x < W - 1; x += 2) {
    const i = y * W + x;
    const r = I[i - W - 1] - 2 * I[i - W] + I[i - W + 1] - 2 * I[i - 1] + 4 * I[i] - 2 * I[i + 1] + I[i + W - 1] - 2 * I[i + W] + I[i + W + 1];
    const b = Math.min(2047, Math.floor(Math.abs(r) * 4));
    bins[b]++;
    n++;
  }
  let c = 0, k = 0;
  while (k < 2048 && c < n / 2) {
    c += bins[k];
    k++;
  }
  return Math.max(0.3, k / 4 / 4.047);
}
function fft(re, im, inverse = false) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i];
      re[i] = re[j];
      re[j] = t;
      t = im[i];
      im[i] = im[j];
      im[j] = t;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (inverse ? 2 : -2) * Math.PI / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = i + k + len / 2;
        const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
  if (inverse) for (let i = 0; i < n; i++) {
    re[i] /= n;
    im[i] /= n;
  }
}
function lineGeom(o, W, H) {
  return o === "col" ? { nL: W, nA: H, ls: 1, as: W } : { nL: H, nA: W, ls: W, as: 1 };
}
function alongGate(img, W, H, o, pct) {
  const { nL, nA, ls, as } = lineGeom(o, W, H);
  const samp = [];
  for (let l = 0; l < nL; l += 3) for (let t = 1; t < nA - 1; t += 3) samp.push(Math.abs(img[l * ls + (t + 1) * as] - img[l * ls + (t - 1) * as]));
  const a = Float32Array.from(samp);
  return quickselect(a, a.length, Math.floor(pct * (a.length - 1)));
}
function stepThreshold(img, W, H, o, kg, pct) {
  const { nL, nA, ls, as } = lineGeom(o, W, H);
  const samp = [];
  for (let l = kg; l < nL - kg; l += 3) for (let t = 1; t < nA - 1; t += 3) {
    let a = 0, b = 0;
    for (let j = 1; j <= kg; j++) {
      a += img[(l - j) * ls + t * as];
      b += img[(l + j) * ls + t * as];
    }
    samp.push(Math.abs(a - b) / kg);
  }
  const arr = Float32Array.from(samp);
  return quickselect(arr, arr.length, Math.floor(pct * (arr.length - 1)));
}
function lineSweep(img, W, H, o, off, op) {
  const { nL, nA, ls, as } = lineGeom(o, W, H);
  const out = new Float32Array(nL);
  const segLen = Math.ceil(nA / op.segs);
  const bufs = Array.from({ length: op.segs }, () => new Float32Array(segLen));
  const cnt = new Int32Array(op.segs), med = new Float32Array(op.segs);
  for (let l = 0; l < nL; l++) {
    cnt.fill(0);
    const j0 = Math.max(0, l - op.k), j1 = Math.min(nL - 1, l + op.k);
    const haveBoth = l - op.kg >= 0 && l + op.kg <= nL - 1;
    for (let t = 1; t < nA - 1; t++) {
      const p = t * as;
      if (Math.abs(img[l * ls + p + as] - img[l * ls + p - as]) > op.thrAlong) continue;
      let s = 0, c = 0, sl = 0, sr = 0;
      for (let j = j0; j <= j1; j++) {
        if (j === l) continue;
        const v = img[j * ls + p] - (off ? off[j] : 0);
        s += v;
        c++;
        if (j < l && l - j <= op.kg) sl += v;
        else if (j > l && j - l <= op.kg) sr += v;
      }
      if (haveBoth && Math.abs(sl - sr) / op.kg > op.thrStep) continue;
      const e = img[l * ls + p] - (off ? off[l] : 0) - s / c;
      if (Math.abs(e) > op.clipE) continue;
      const sg = Math.min(op.segs - 1, Math.floor(t / segLen));
      bufs[sg][cnt[sg]++] = e;
    }
    let nv = 0, pos = 0, neg = 0, minAbs = Infinity;
    for (let g = 0; g < op.segs; g++) {
      if (cnt[g] < segLen * 0.12) continue;
      const m = medianOf(bufs[g], cnt[g]);
      med[nv++] = m;
      if (m > 0) pos++;
      else if (m < 0) neg++;
      minAbs = Math.min(minAbs, Math.abs(m));
    }
    if (nv < Math.min(2, op.segs) || pos > 0 && neg > 0 && Math.min(pos, neg) > 0 && Math.min(pos, neg) >= 1 && minAbs < Infinity && pos !== nv && neg !== nv) {
      out[l] = 0;
      continue;
    }
    const sign = pos >= neg ? 1 : -1;
    out[l] = sign * minAbs;
  }
  return out;
}
function estimateLineOffsetsLocal(img, W, H, o, k = 4, iters = 3, gatePct = 0.75, clipE = 300, segs = 4) {
  const { nL } = lineGeom(o, W, H);
  const op = { k, kg: Math.min(4, k), segs, clipE, thrAlong: alongGate(img, W, H, o, gatePct) + 1e-3, thrStep: stepThreshold(img, W, H, o, Math.min(4, k), 0.7) + 1e-3 };
  const off = new Float32Array(nL);
  for (let it = 0; it < iters; it++) {
    const d = lineSweep(img, W, H, o, off, op);
    for (let l = 0; l < nL; l++) off[l] += d[l];
  }
  let m = 0;
  for (let l = 0; l < nL; l++) m += off[l];
  m /= nL;
  for (let l = 0; l < nL; l++) off[l] -= m;
  return off;
}
function estimateLineOffsetsSpectral(img, W, H, o, cutoff, peakK, mode, R = 8, clipE = 300, iters = 3) {
  const { nL } = lineGeom(o, W, H);
  const op = { k: R, kg: 4, segs: 4, clipE, thrAlong: alongGate(img, W, H, o, 0.75) + 1e-3, thrStep: stepThreshold(img, W, H, o, 4, 0.7) + 1e-3 };
  const off = new Float32Array(nL);
  let n = 1;
  while (n < nL * 2) n <<= 1;
  const win = (l) => 0.3 + 0.7 * (0.5 - 0.5 * Math.cos(2 * Math.PI * (l + 0.5) / nL));
  for (let it = 0; it < iters; it++) {
    const prof = lineSweep(img, W, H, o, off, op);
    const re = new Float64Array(n), im = new Float64Array(n);
    let mean = 0;
    for (let l = 0; l < nL; l++) mean += prof[l];
    mean /= nL;
    for (let l = 0; l < nL; l++) re[l] = (prof[l] - mean) * win(l);
    fft(re, im);
    const half = n / 2, amp = new Float64Array(half + 1);
    for (let f = 0; f <= half; f++) amp[f] = Math.hypot(re[f], im[f]);
    const mask = new Float64Array(half + 1);
    for (let f = 1; f <= half; f++) {
      const hp = 1 - Math.exp(-((f / n / Math.max(1e-4, cutoff)) ** 2));
      const w0 = Math.max(1, f - 12), w1 = Math.min(half, f + 12);
      const loc = new Float32Array(w1 - w0 + 1);
      for (let q = w0; q <= w1; q++) loc[q - w0] = amp[q];
      const peak = amp[f] > peakK * (medianOf(loc, loc.length) + 1e-9) ? 1 : 0;
      mask[f] = mode === "broadband" ? hp : mode === "peaks" ? peak : Math.max(hp, peak);
    }
    for (let f = 0; f <= half; f++) {
      const g = mask[f];
      re[f] *= g;
      im[f] *= g;
      if (f > 0 && f < half) {
        re[n - f] *= g;
        im[n - f] *= g;
      }
    }
    fft(re, im, true);
    for (let l = 0; l < nL; l++) off[l] += re[l] / win(l);
  }
  let m2 = 0;
  for (let l = 0; l < nL; l++) m2 += off[l];
  m2 /= nL;
  for (let l = 0; l < nL; l++) off[l] -= m2;
  return off;
}
function applyLineOffsets(img, W, H, o, off, strength) {
  if (strength === 0) return;
  if (o === "col") {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) img[y * W + x] -= off[x] * strength;
  } else {
    for (let y = 0; y < H; y++) {
      const v = off[y] * strength;
      for (let x = 0; x < W; x++) img[y * W + x] -= v;
    }
  }
}
function robustBadPixels(img, W, H, sigma) {
  const out = Float32Array.from(img);
  const thr = Math.max(8 * sigma, 150);
  const nb = new Float32Array(8);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x, v = img[i];
    const m4 = (img[i - 1] + img[i + 1] + img[i - W] + img[i + W]) * 0.25;
    if (Math.abs(v - m4) <= thr) continue;
    nb[0] = img[i - W - 1];
    nb[1] = img[i - W];
    nb[2] = img[i - W + 1];
    nb[3] = img[i - 1];
    nb[4] = img[i + 1];
    nb[5] = img[i + W - 1];
    nb[6] = img[i + W];
    nb[7] = img[i + W + 1];
    const med = (quickselect(nb, 8, 3) + quickselect(nb, 8, 4)) * 0.5;
    const dev = v - med;
    if (Math.abs(dev) <= thr) continue;
    let close = 0;
    for (let k = 0; k < 8; k++) if (Math.abs(nb[k] - v) < Math.abs(dev) * 0.5) close++;
    if (close === 0) out[i] = med;
  }
  return out;
}
function bilateral5(img, W, H, sigmaR, mix) {
  const out = Float32Array.from(img);
  const sw = [1, 0.8, 0.45];
  const lut = new Float32Array(4096);
  for (let i = 0; i < 4096; i++) {
    const d = i / 8;
    lut[i] = Math.exp(-(d * d) / (2 * sigmaR * sigmaR));
  }
  for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
    const i = y * W + x, c = img[i];
    let sum = 0, ws = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const v = img[i + dy * W + dx];
      const d = Math.min(4095, Math.round(Math.abs(v - c) * 8));
      const w = lut[d] * sw[Math.max(Math.abs(dx), Math.abs(dy))];
      sum += w * v;
      ws += w;
    }
    out[i] = c + (sum / ws - c) * mix;
  }
  return out;
}
function clahe(img, W, H, tilesX, tilesY, clip) {
  const tw = W / tilesX, th = H / tilesY;
  const luts = new Float32Array(tilesX * tilesY * 256);
  for (let ty = 0; ty < tilesY; ty++) for (let tx = 0; tx < tilesX; tx++) {
    const x0 = Math.floor(tx * tw), x1 = Math.floor((tx + 1) * tw), y0 = Math.floor(ty * th), y1 = Math.floor((ty + 1) * th);
    const hist = new Float64Array(256);
    let n = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      hist[Math.max(0, Math.min(255, Math.round(img[y * W + x])))]++;
      n++;
    }
    const limit = Math.max(1, clip * n / 256);
    let excess = 0;
    for (let b = 0; b < 256; b++) if (hist[b] > limit) {
      excess += hist[b] - limit;
      hist[b] = limit;
    }
    const add = excess / 256;
    let cum = 0;
    const base = (ty * tilesX + tx) * 256;
    for (let b = 0; b < 256; b++) {
      hist[b] += add;
      cum += hist[b];
      luts[base + b] = cum / n * 255;
    }
  }
  const out = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    const fy = Math.max(0, Math.min(tilesY - 1, (y + 0.5) / th - 0.5));
    const ty0 = Math.floor(fy), ty1 = Math.min(tilesY - 1, ty0 + 1), wy = fy - ty0;
    for (let x = 0; x < W; x++) {
      const fx = Math.max(0, Math.min(tilesX - 1, (x + 0.5) / tw - 0.5));
      const tx0 = Math.floor(fx), tx1 = Math.min(tilesX - 1, tx0 + 1), wx = fx - tx0;
      const v = Math.max(0, Math.min(255, Math.round(img[y * W + x])));
      const a = luts[(ty0 * tilesX + tx0) * 256 + v], b = luts[(ty0 * tilesX + tx1) * 256 + v];
      const c = luts[(ty1 * tilesX + tx0) * 256 + v], d = luts[(ty1 * tilesX + tx1) * 256 + v];
      out[y * W + x] = (a * (1 - wx) + b * wx) * (1 - wy) + (c * (1 - wx) + d * wx) * wy;
    }
  }
  return out;
}

// src/claude/cnn-disabled.ts
function getCnn(_v) {
  return null;
}
async function cnnRestore(_m, _x, _w, _h, _strength) {
  throw new Error("CNN is disabled in this evaluator");
}

// src/claude/pipeline.ts
var BASE = {
  stage1: true,
  stage2: true,
  stage3: true,
  stage4: true,
  spatialOnly: true,
  split: 50,
  agcSlew: 18,
  detailGain: 1.4,
  vStr: 0.65,
  hStr: 0,
  lineMethod: "orig",
  badPixel: "orig",
  detailMethod: "orig",
  toneMode: "quantile",
  cnn: false,
  cnnStrength: 1,
  clahe: false,
  claheClip: 3,
  claheAmount: 0.5,
  fpnPixel: 0.5,
  window: 12,
  tdenoise: false,
  tdStrength: 0.5,
  pheAmount: 0.6,
  plateau: 6,
  coring: 1.5,
  specMode: "both",
  specCutoff: 0.02,
  specPeak: 4,
  bilateral: false,
  bilStrength: 0.6,
  baseCompress: 0.15
};
function defaultCfg(v) {
  if (v === "O") return { ...BASE };
  const shared = { ...BASE, lineMethod: "new", badPixel: "robust", vStr: 1, hStr: 1 };
  if (v === "A") return { ...shared, clahe: true };
  if (v === "B") return { ...shared, detailMethod: "guided", toneMode: "plateau", tdenoise: true };
  return { ...shared, detailMethod: "multiscale", bilateral: true };
}
var newState = () => ({ lastKey: "", hasPrev: false, hasPrevB: false, lo: 7100, hi: 7950, loB: 7100, hiB: 7950, prevNorm: null, prevNormB: null, lut: null, lutB: null });
function origStage1(raw, W, H, vS, hS) {
  const out = Float32Array.from(raw);
  const colBias = new Float32Array(W);
  let globalMed = 0;
  for (let x = 0; x < W; x++) {
    let sum = 0, cnt = 0;
    for (let y = 16; y < H - 16; y += 4) {
      const v = raw[y * W + x];
      if (v > 1e3 && v < 12e3) {
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
    let s = 0;
    for (let x = 0; x < W; x += 4) s += raw[y * W + x];
    rowMean[y] = s / Math.ceil(W / 4);
  }
  const rowBias = new Float32Array(H);
  for (let y = 0; y < H; y++) {
    let s = 0, c = 0;
    for (let k = -4; k <= 4; k++) {
      const j = y + k;
      if (j >= 0 && j < H) {
        s += rowMean[j];
        c++;
      }
    }
    rowBias[y] = rowMean[y] - s / c;
  }
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const idx = y * W + x;
    let v = raw[idx] - (colBias[x] - globalMed) * vS - rowBias[y] * hS;
    const avgN = (raw[idx - 1] + raw[idx + 1] + raw[idx - W] + raw[idx + W]) * 0.25;
    if (Math.abs(v - avgN) > 1800) v = avgN;
    out[idx] = v;
  }
  return out;
}
function origDetail(norm, W, H, gain) {
  const out = Float32Array.from(norm);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x, c = norm[i];
    const lm = (norm[i - 1] + norm[i + 1] + norm[i - W] + norm[i + W]) * 0.25;
    const d = Math.max(-18, Math.min(18, c - lm));
    out[i] = c + d * (gain - 1) * 1.8;
  }
  return out;
}
var softLimit = (d, m) => Math.abs(d) <= m ? d : Math.sign(d) * (m + (Math.abs(d) - m) * 0.2);
var coringFn = (d, tau) => tau <= 0 ? d : d * (d * d / (d * d + tau * tau));
function guidedDetail(norm, W, H, gain, tau) {
  const base = guidedSelf(norm, W, H, 4, 100);
  const g = 1 + (gain - 1) * 1.8;
  const out = new Float32Array(norm.length);
  for (let i = 0; i < out.length; i++) out[i] = base[i] + g * softLimit(coringFn(norm[i] - base[i], tau), 30);
  return out;
}
function multiscaleDetail(norm, W, H, gain, tau, compress) {
  const b1 = boxBlur(norm, W, H, 1), b2 = boxBlur(norm, W, H, 3), b3 = boxBlur(boxBlur(norm, W, H, 8), W, H, 8);
  const g = 1 + (gain - 1) * 1.8;
  const out = new Float32Array(norm.length);
  for (let i = 0; i < out.length; i++) {
    const d1 = coringFn(norm[i] - b1[i], tau), d2 = b1[i] - b2[i], d3 = b2[i] - b3[i];
    const base = 128 + (b3[i] - 128) * (1 - compress);
    out[i] = base + g * (softLimit(d1, 24) * 1 + softLimit(d2, 28) * 0.8 + softLimit(d3, 30) * 0.5) * 0.9;
  }
  return out;
}
function toneMap(x, rMin, rMax, cfg, st, key, reset, mode) {
  const N = x.length;
  let pLow = rMin, pHigh = rMax;
  const isNew = st.lastKey !== key;
  if (isNew) {
    st.loB = st.lo;
    st.hiB = st.hi;
    st.prevNormB = st.prevNorm;
    st.lutB = st.lut;
    st.hasPrevB = st.hasPrev && !reset;
    st.lastKey = key;
  }
  if (cfg.stage2) {
    const rawLo = percentileSample(x, 0.02, 11), rawHi = percentileSample(x, cfg.stage3 ? 0.975 : 0.999, 11);
    const m = cfg.agcSlew;
    pLow = st.hasPrevB ? st.loB + Math.max(-m, Math.min(m, rawLo - st.loB)) : rawLo;
    pHigh = st.hasPrevB ? st.hiB + Math.max(-m, Math.min(m, rawHi - st.hiB)) : rawHi;
    st.lo = pLow;
    st.hi = pHigh;
  }
  const span = Math.max(80, pHigh - pLow);
  const norm = new Float32Array(N);
  let lut = null;
  if (mode === "plateau") {
    const BINS = 512, hist = new Float64Array(BINS);
    let n = 0;
    for (let i = 0; i < N; i += 2) {
      const v = x[i];
      if (v >= pLow && v <= pHigh) {
        hist[Math.min(BINS - 1, Math.floor((v - pLow) / span * BINS))]++;
        n++;
      }
    }
    const T = Math.max(1, n / BINS * cfg.plateau);
    const floor = Math.max(0.05 * T, 0.5);
    let cum = 0;
    const l = new Float32Array(BINS);
    for (let b = 0; b < BINS; b++) {
      cum += Math.max(floor, Math.min(T, hist[b]));
      l[b] = cum;
    }
    for (let b = 0; b < BINS; b++) l[b] /= cum;
    lut = st.hasPrevB && st.lutB && st.lutB.length === BINS ? l.map((v, i) => 0.7 * st.lutB[i] + 0.3 * v) : l;
    st.lut = lut;
  }
  for (let i = 0; i < N; i++) {
    const v = x[i];
    if (v <= pHigh) {
      const lin = Math.max(0, Math.min(232, (v - pLow) / span * 232));
      if (lut) {
        const eq = v <= pLow ? 0 : lut[Math.min(lut.length - 1, Math.floor((v - pLow) / span * lut.length))] * 232;
        norm[i] = lin * (1 - cfg.pheAmount) + eq * cfg.pheAmount;
      } else norm[i] = lin;
    } else norm[i] = 232 + Math.min(1, (v - pHigh) / 7e3) * 23;
  }
  if (!cfg.spatialOnly && st.hasPrevB && st.prevNormB && st.prevNormB.length === N) for (let i = 0; i < N; i++) norm[i] = 0.25 * norm[i] + 0.75 * st.prevNormB[i];
  st.prevNorm = norm.slice();
  st.hasPrev = true;
  return { norm, pLow, pHigh, span };
}
async function destripeB(ctx, x, cfg, sigma) {
  const { W, H } = ctx, N = W * H;
  const K = Math.max(1, Math.min(cfg.window, ctx.total));
  const i0 = Math.max(0, Math.min(ctx.total - K, ctx.idx - K + 1));
  const med = percentileSample(x, 0.5, 5);
  const M = new Float32Array(N);
  let used = 0;
  let first = null, last = null;
  for (let k = 0; k < K; k++) {
    const f = k + i0 === ctx.idx ? ctx.raw : await ctx.getFrame(i0 + k);
    if (!f) continue;
    const c = new Float32Array(N);
    for (let i = 0; i < N; i++) c[i] = Math.max(med - 1e3, Math.min(med + 1e3, f[i] & 16383));
    for (let i = 0; i < N; i++) M[i] += c[i];
    if (!first) first = c;
    last = c;
    used++;
  }
  if (used === 0) return { col: new Float32Array(W), row: new Float32Array(H), fpn: null, conf: 0 };
  for (let i = 0; i < N; i++) M[i] /= used;
  let conf = 0;
  if (used >= 4 && first && last) {
    let s = 0;
    for (let i = 0; i < N; i += 3) s += Math.abs(last[i] - first[i]);
    s /= N / 3;
    conf = Math.max(0, Math.min(1, (s - 1.3 * sigma) / (4 * sigma)));
  }
  const col = cfg.vStr > 0 ? estimateLineOffsetsLocal(M, W, H, "col", 4, 3) : new Float32Array(W);
  applyLineOffsets(M, W, H, "col", col, 1);
  const row = cfg.hStr > 0 ? estimateLineOffsetsLocal(M, W, H, "row", 4, 3) : new Float32Array(H);
  applyLineOffsets(M, W, H, "row", row, 1);
  let fpn = null;
  if (cfg.fpnPixel > 0 && conf > 0) {
    const bl = boxBlur(M, W, H, 6);
    fpn = new Float32Array(N);
    const g = conf * cfg.fpnPixel;
    for (let i = 0; i < N; i++) fpn[i] = Math.max(-40, Math.min(40, M[i] - bl[i])) * g;
  }
  return { col, row, fpn, conf };
}
function applyB(img, W, H, c, cfg) {
  applyLineOffsets(img, W, H, "col", c.col, cfg.vStr);
  applyLineOffsets(img, W, H, "row", c.row, cfg.hStr);
  if (c.fpn) for (let i = 0; i < img.length; i++) img[i] -= c.fpn[i];
}
async function runPipeline(v, ctx, cfg, st) {
  const T0 = performance.now();
  const { W, H, raw } = ctx, N = W * H;
  const notes = [];
  const tm = { lines: 0, cnn: 0, denoise: 0, tone: 0, detail: 0, total: 0 };
  const raw14 = new Float32Array(N);
  let rMin = 16383, rMax = 0;
  for (let i = 0; i < N; i++) {
    const q = raw[i] & 16383;
    raw14[i] = q;
    if (q < rMin) rMin = q;
    if (q > rMax) rMax = q;
  }
  const base8 = new Uint8ClampedArray(N), nspan = Math.max(1, rMax - rMin);
  for (let i = 0; i < N; i++) base8[i] = Math.round((raw14[i] - rMin) / nspan * 255);
  let t = performance.now();
  let x = raw14;
  let sigma = noiseSigma(raw14, W, H), conf = 0;
  let bcorr = null;
  if (cfg.stage1) {
    if (cfg.badPixel === "robust") x = robustBadPixels(x, W, H, sigma);
    if (cfg.lineMethod === "orig") x = origStage1(x, W, H, cfg.vStr, cfg.hStr);
    else if (cfg.lineMethod === "new") {
      x = Float32Array.from(x);
      if (v === "B") {
        bcorr = await destripeB(ctx, x, cfg, sigma);
        conf = bcorr.conf;
        applyB(x, W, H, bcorr, cfg);
      } else if (v === "C") {
        if (cfg.vStr > 0) applyLineOffsets(x, W, H, "col", estimateLineOffsetsSpectral(x, W, H, "col", cfg.specCutoff, cfg.specPeak, cfg.specMode), cfg.vStr);
        if (cfg.hStr > 0) applyLineOffsets(x, W, H, "row", estimateLineOffsetsSpectral(x, W, H, "row", cfg.specCutoff, cfg.specPeak, cfg.specMode), cfg.hStr);
      } else {
        if (cfg.vStr > 0) applyLineOffsets(x, W, H, "col", estimateLineOffsetsLocal(x, W, H, "col", 4, 3), cfg.vStr);
        if (cfg.hStr > 0) applyLineOffsets(x, W, H, "row", estimateLineOffsetsLocal(x, W, H, "row", 4, 3), cfg.hStr);
      }
    }
    if (cfg.badPixel === "orig" && cfg.lineMethod !== "orig") x = origStage1(x, W, H, 0, 0);
  }
  tm.lines = performance.now() - t;
  let usedCnn = false;
  if (cfg.cnn && v !== "O") {
    const m = getCnn(v);
    if (m) {
      t = performance.now();
      try {
        x = await cnnRestore(m, x, W, H, cfg.cnnStrength);
        usedCnn = true;
      } catch (e2) {
        notes.push("CNN inference failed: " + (e2 instanceof Error ? e2.message : String(e2)));
      }
      tm.cnn = performance.now() - t;
    } else notes.push("CNN enabled but no model trained/loaded for this instance.");
  }
  t = performance.now();
  if (v === "B" && cfg.tdenoise && cfg.stage1) {
    const pi = ctx.idx > 0 ? ctx.idx - 1 : ctx.idx + 1;
    const prev = ctx.total > 1 ? await ctx.getFrame(pi) : null;
    if (prev) {
      const p = new Float32Array(N);
      for (let i = 0; i < N; i++) p[i] = prev[i] & 16383;
      if (bcorr) applyB(p, W, H, bcorr, cfg);
      const s = noiseSigma(x, W, H), k = 3.5 * s;
      const y = Float32Array.from(x);
      for (let i = 0; i < N; i++) {
        const d = Math.abs(x[i] - p[i]) / k;
        y[i] = x[i] + (p[i] - x[i]) * cfg.tdStrength * Math.exp(-d * d);
      }
      x = y;
    }
  }
  if (v === "C" && cfg.bilateral) {
    const s = noiseSigma(x, W, H);
    x = bilateral5(x, W, H, Math.max(4, 2.2 * s), cfg.bilStrength);
  }
  tm.denoise = performance.now() - t;
  sigma = noiseSigma(x, W, H);
  t = performance.now();
  const mode = v === "B" || cfg.toneMode === "plateau" ? cfg.toneMode : "quantile";
  const { norm, pLow, pHigh, span } = toneMap(x, rMin, rMax, cfg, st, ctx.key, ctx.reset, mode);
  tm.tone = performance.now() - t;
  t = performance.now();
  let e = norm;
  if (v === "A" && cfg.clahe) {
    const c = clahe(e, W, H, 8, 8, cfg.claheClip), a = cfg.claheAmount;
    e = new Float32Array(N);
    for (let i = 0; i < N; i++) e[i] = norm[i] * (1 - a) + c[i] * a;
  }
  if (cfg.stage4) {
    const sn = sigma * 232 / span;
    if (cfg.detailMethod === "guided") e = guidedDetail(e, W, H, cfg.detailGain, cfg.coring * sn);
    else if (cfg.detailMethod === "multiscale") e = multiscaleDetail(e, W, H, cfg.detailGain, cfg.coring * sn, cfg.baseCompress);
    else e = origDetail(e, W, H, cfg.detailGain);
  }
  const out8 = new Uint8ClampedArray(N);
  for (let i = 0; i < N; i++) out8[i] = Math.max(0, Math.min(255, Math.round(e[i])));
  tm.detail = performance.now() - t;
  tm.total = performance.now() - T0;
  return { out8, base8, restored: x, rMin, rMax, pLow, pHigh, sigma, conf, timings: tm, usedCnn, notes };
}

// src/lab/dsp.ts
function robustSigma(values, step = 1) {
  const n = Math.ceil(values.length / step);
  if (n === 0) return { median: 0, sigma: 0 };
  const tmp = new Float32Array(n);
  for (let i = 0, k = 0; i < values.length; i += step, k++) tmp[k] = values[i];
  tmp.sort();
  const med = tmp[n >> 1];
  for (let i = 0; i < n; i++) tmp[i] = Math.abs(tmp[i] - med);
  tmp.sort();
  return { median: med, sigma: 1.4826 * tmp[n >> 1] };
}
function estimateNoiseSigma(src, w, h) {
  const res = new Float32Array(Math.max(1, (w - 2) * (h - 2)));
  let k = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      res[k++] = src[i] - 0.25 * (src[i - 1] + src[i + 1] + src[i - w] + src[i + w]);
    }
  }
  return robustSigma(res, 3).sigma / Math.sqrt(1.25);
}
function lineProfile(src, w, h, axis, hw, gateK) {
  const nLines = axis === "col" ? w : h;
  const nAlong = axis === "col" ? h : w;
  const lineStride = axis === "col" ? 1 : w;
  const alongStride = axis === "col" ? w : 1;
  const d = new Float32Array(nLines);
  const col = new Float32Array(nAlong);
  const dev = new Float32Array(nAlong);
  let sigSum = 0;
  for (let l = 0; l < nLines - 1; l++) {
    for (let t = 0; t < nAlong; t++) {
      col[t] = src[(l + 1) * lineStride + t * alongStride] - src[l * lineStride + t * alongStride];
    }
    const sorted = col.slice().sort();
    const med = sorted[nAlong >> 1];
    for (let t = 0; t < nAlong; t++) dev[t] = Math.abs(col[t] - med);
    dev.sort();
    const sg = Math.max(1e-3, 1.4826 * dev[nAlong >> 1]);
    sigSum += sg;
    const lim = gateK * sg;
    let s = 0;
    let k = 0;
    for (let t = 0; t < nAlong; t++) {
      if (Math.abs(col[t] - med) <= lim) {
        s += col[t];
        k++;
      }
    }
    d[l] = k > 0.2 * nAlong ? s / k : med;
  }
  const p = new Float64Array(nLines);
  for (let l = 1; l < nLines; l++) p[l] = p[l - 1] + d[l - 1];
  const ps = new Float64Array(nLines + 1);
  for (let l = 0; l < nLines; l++) ps[l + 1] = ps[l] + p[l];
  const profile = new Float32Array(nLines);
  for (let l = 0; l < nLines; l++) {
    const lo = Math.max(0, l - hw);
    const hi = Math.min(nLines - 1, l + hw);
    profile[l] = p[l] - (ps[hi + 1] - ps[lo]) / (hi - lo + 1);
  }
  return { profile, sigma: sigSum / Math.max(1, nLines - 1) };
}
function applyProfile(src, w, h, axis, profile, strength, clampAdu) {
  const out = new Float32Array(src.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = profile[axis === "col" ? x : y];
      const c = Math.max(-clampAdu, Math.min(clampAdu, p)) * strength;
      out[y * w + x] = src[y * w + x] - c;
    }
  }
  return out;
}
function boxFilter(src, w, h, r) {
  const tmp = new Float64Array(w * h);
  const out = new Float64Array(w * h);
  const ps = new Float64Array(Math.max(w, h) + 1);
  for (let y = 0; y < h; y++) {
    const b = y * w;
    ps[0] = 0;
    for (let x = 0; x < w; x++) ps[x + 1] = ps[x] + src[b + x];
    for (let x = 0; x < w; x++) {
      const lo = Math.max(0, x - r);
      const hi = Math.min(w - 1, x + r);
      tmp[b + x] = (ps[hi + 1] - ps[lo]) / (hi - lo + 1);
    }
  }
  for (let x = 0; x < w; x++) {
    ps[0] = 0;
    for (let y = 0; y < h; y++) ps[y + 1] = ps[y] + tmp[y * w + x];
    for (let y = 0; y < h; y++) {
      const lo = Math.max(0, y - r);
      const hi = Math.min(h - 1, y + r);
      out[y * w + x] = (ps[hi + 1] - ps[lo]) / (hi - lo + 1);
    }
  }
  return out;
}
function guidedFilter(src, w, h, r, eps) {
  const n = w * h;
  let mean = 0;
  for (let i = 0; i < n; i++) mean += src[i];
  mean /= n;
  const I = new Float64Array(n);
  const II = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const v = src[i] - mean;
    I[i] = v;
    II[i] = v * v;
  }
  const mI = boxFilter(I, w, h, r);
  const mII = boxFilter(II, w, h, r);
  const a = new Float64Array(n);
  const b = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const v = Math.max(0, mII[i] - mI[i] * mI[i]);
    a[i] = v / (v + eps);
    b[i] = mI[i] - a[i] * mI[i];
  }
  const ma = boxFilter(a, w, h, r);
  const mb = boxFilter(b, w, h, r);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = ma[i] * I[i] + mb[i] + mean;
  return out;
}
function detailEnhance(src, w, h, p, noiseSigma2) {
  const base = guidedFilter(src, w, h, p.radius, p.edgeAdu * p.edgeAdu);
  const out = new Float32Array(src.length);
  const thr = p.coringK * noiseSigma2;
  const g = Math.max(1, p.gain) - 1;
  for (let i = 0; i < src.length; i++) {
    const d = src[i] - base[i];
    const ex = Math.max(0, Math.abs(d) - thr);
    let add = g * ex;
    if (add > p.maxBoostAdu) add = p.maxBoostAdu;
    out[i] = src[i] + (d < 0 ? -add : add);
  }
  return out;
}
function clahe2(src, w, h, tilesX, clip, blend) {
  const tilesY = Math.max(1, Math.round(tilesX * h / w));
  const luts = new Uint8Array(tilesX * tilesY * 256);
  const hist = new Float64Array(256);
  for (let ty = 0; ty < tilesY; ty++) {
    const y0 = Math.floor(ty * h / tilesY);
    const y1 = Math.floor((ty + 1) * h / tilesY);
    for (let tx = 0; tx < tilesX; tx++) {
      const x0 = Math.floor(tx * w / tilesX);
      const x1 = Math.floor((tx + 1) * w / tilesX);
      hist.fill(0);
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) hist[src[y * w + x]]++;
      const area = (y1 - y0) * (x1 - x0);
      const limit = Math.max(1, clip * area / 256);
      let excess = 0;
      for (let i = 0; i < 256; i++) {
        if (hist[i] > limit) {
          excess += hist[i] - limit;
          hist[i] = limit;
        }
      }
      const add = excess / 256;
      let cdf = 0;
      const base = (ty * tilesX + tx) * 256;
      for (let i = 0; i < 256; i++) {
        cdf += hist[i] + add;
        luts[base + i] = Math.min(255, Math.round(255 * cdf / area));
      }
    }
  }
  const out = new Uint8Array(src.length);
  for (let y = 0; y < h; y++) {
    const fy = Math.min(tilesY - 1, Math.max(0, (y + 0.5) / (h / tilesY) - 0.5));
    const ty0 = Math.floor(fy);
    const ty1 = Math.min(tilesY - 1, ty0 + 1);
    const wy = fy - ty0;
    for (let x = 0; x < w; x++) {
      const fx = Math.min(tilesX - 1, Math.max(0, (x + 0.5) / (w / tilesX) - 0.5));
      const tx0 = Math.floor(fx);
      const tx1 = Math.min(tilesX - 1, tx0 + 1);
      const wx = fx - tx0;
      const v = src[y * w + x];
      const a = luts[(ty0 * tilesX + tx0) * 256 + v];
      const b = luts[(ty0 * tilesX + tx1) * 256 + v];
      const c = luts[(ty1 * tilesX + tx0) * 256 + v];
      const d = luts[(ty1 * tilesX + tx1) * 256 + v];
      const eq = (1 - wy) * ((1 - wx) * a + wx * b) + wy * ((1 - wx) * c + wx * d);
      out[y * w + x] = Math.round((1 - blend) * v + blend * eq);
    }
  }
  return out;
}
function temporalFilter(cur, st, alpha, gateK, noiseSigma2) {
  if (!st.buf || st.buf.length !== cur.length) {
    st.buf = new Float32Array(cur);
    st.frames = 1;
    return { out: new Float32Array(cur), movingFrac: 0 };
  }
  const buf = st.buf;
  const thr = gateK * Math.max(noiseSigma2, 1e-3);
  let moving = 0;
  for (let i = 0; i < cur.length; i++) {
    const d = cur[i] - buf[i];
    if (Math.abs(d) > thr) {
      buf[i] = cur[i];
      moving++;
    } else buf[i] += alpha * d;
  }
  st.frames++;
  return { out: new Float32Array(buf), movingFrac: moving / cur.length };
}

// src/lab/pipeline.ts
var MAX_CODE_14 = 16383;
var DEFAULT_CONFIG = {
  line: { mode: "columns", strength: 1, clampAdu: 400, halfWidth: 32, gateK: 3 },
  tone: { mode: "fixed", fixedLo: 4e3, fixedHi: 9e3, pLo: 1, pHi: 99, gamma: 1, knee: 1 },
  detail: { on: true, radius: 6, edgeAdu: 150, gain: 2.5, coringK: 2, maxBoostAdu: 250 },
  clahe: { on: false, tiles: 8, clip: 3, blend: 0.5 },
  temporal: { on: false, alpha: 0.4, gateK: 4 }
};
function cloneConfig(c) {
  return JSON.parse(JSON.stringify(c));
}
function toneFn(p) {
  const span = Math.max(1, p.hi - p.lo);
  const knee = Math.min(1, Math.max(0.05, p.knee));
  const g = Math.max(0.1, p.gamma);
  return (x) => {
    let t = (x - p.lo) / span;
    if (t <= 0) return 0;
    if (knee < 1 && t > knee) t = knee + (1 - knee) * Math.tanh((t - knee) / (1 - knee));
    if (t > 1) t = 1;
    if (g !== 1) t = Math.pow(t, 1 / g);
    return Math.round(255 * t);
  };
}
function checkMonotonic(fn, maxCode2 = MAX_CODE_14) {
  let prev = fn(0);
  const first = prev;
  let nonDecreasing = true;
  const levels = /* @__PURE__ */ new Set([prev]);
  let lowClip = 0;
  let last = prev;
  for (let c = 1; c <= maxCode2; c++) {
    const v = fn(c);
    if (v < prev) nonDecreasing = false;
    if (v === first) lowClip = c;
    levels.add(v);
    prev = v;
    last = v;
  }
  let highFrom = maxCode2;
  for (let c = maxCode2; c >= 0; c--) {
    if (fn(c) === last) highFrom = c;
    else break;
  }
  const active = Math.max(1, highFrom - lowClip);
  return {
    nonDecreasing,
    distinctLevels: levels.size,
    aduPerLevel: active / Math.max(1, levels.size - 1),
    lowClipBelow: lowClip,
    highClipFrom: highFrom,
    clippedFractionOfRange: (lowClip + (maxCode2 - highFrom)) / maxCode2
  };
}
function percentileWindow(data, pLo, pHi) {
  const hist = new Uint32Array(MAX_CODE_14 + 1);
  for (let i = 0; i < data.length; i++) {
    const v = Math.min(MAX_CODE_14, Math.max(0, Math.round(data[i])));
    hist[v]++;
  }
  const n = data.length;
  const tLo = pLo / 100 * n;
  const tHi = pHi / 100 * n;
  let acc = 0;
  let lo = 0;
  let hi = MAX_CODE_14;
  let gotLo = false;
  for (let i = 0; i <= MAX_CODE_14; i++) {
    acc += hist[i];
    if (!gotLo && acc >= tLo) {
      lo = i;
      gotLo = true;
    }
    if (acc >= tHi) {
      hi = i;
      break;
    }
  }
  if (hi <= lo) hi = lo + 1;
  return { lo, hi };
}
function applyTone(src, fn) {
  const out = new Uint8Array(src.length);
  for (let i = 0; i < src.length; i++) out[i] = fn(src[i]);
  return out;
}
function referenceDisplay(raw, cfg) {
  const fn = toneFn({ lo: cfg.tone.fixedLo, hi: cfg.tone.fixedHi, gamma: 1, knee: 1 });
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = fn(raw[i]);
  return out;
}
var now = () => typeof performance !== "undefined" ? performance.now() : Date.now();
function runPipeline2(raw, w, h, cfg, tstate) {
  const t0 = now();
  let cur = new Float32Array(raw);
  const profiles = { col: null, row: null };
  const axes = cfg.line.mode === "columns" ? ["col"] : cfg.line.mode === "rows" ? ["row"] : cfg.line.mode === "both" ? ["col", "row"] : [];
  for (const ax of axes) {
    const { profile } = lineProfile(cur, w, h, ax, cfg.line.halfWidth, cfg.line.gateK);
    profiles[ax] = profile;
    cur = applyProfile(cur, w, h, ax, profile, cfg.line.strength, cfg.line.clampAdu);
  }
  const corrected = cur;
  const t1 = now();
  const noiseSigma2 = estimateNoiseSigma(corrected, w, h);
  let temporal = { used: false, frames: 0, movingFrac: 0 };
  if (cfg.temporal.on && tstate) {
    const r = temporalFilter(cur, tstate, cfg.temporal.alpha, cfg.temporal.gateK, noiseSigma2);
    cur = r.out;
    temporal = { used: true, frames: tstate.frames, movingFrac: r.movingFrac };
  }
  const t2 = now();
  if (cfg.detail.on) {
    const dp = {
      radius: cfg.detail.radius,
      edgeAdu: cfg.detail.edgeAdu,
      gain: cfg.detail.gain,
      coringK: cfg.detail.coringK,
      maxBoostAdu: cfg.detail.maxBoostAdu
    };
    cur = detailEnhance(cur, w, h, dp, noiseSigma2);
  }
  const enhanced = cur;
  const t3 = now();
  let lo = cfg.tone.fixedLo;
  let hi = cfg.tone.fixedHi;
  if (cfg.tone.mode === "percentile") {
    const pw = percentileWindow(enhanced, cfg.tone.pLo, cfg.tone.pHi);
    lo = pw.lo;
    hi = pw.hi;
  }
  const tone = { lo, hi, gamma: cfg.tone.gamma, knee: cfg.tone.knee };
  const fn = toneFn(tone);
  let display = applyTone(enhanced, fn);
  let below = 0;
  let above = 0;
  for (let i = 0; i < enhanced.length; i++) {
    if (enhanced[i] < lo) below++;
    else if (enhanced[i] > hi) above++;
  }
  const t4 = now();
  if (cfg.clahe.on) display = clahe2(display, w, h, cfg.clahe.tiles, cfg.clahe.clip, cfg.clahe.blend);
  const t5 = now();
  let s0 = 0;
  let s255 = 0;
  for (let i = 0; i < display.length; i++) {
    if (display[i] === 0) s0++;
    else if (display[i] === 255) s255++;
  }
  const n = display.length;
  return {
    corrected,
    enhanced,
    display,
    tone,
    toneReport: checkMonotonic(fn),
    clipLowFrac: below / n,
    clipHighFrac: above / n,
    sat0Frac: s0 / n,
    sat255Frac: s255 / n,
    noiseSigma: noiseSigma2,
    profiles,
    temporal,
    timingsMs: { line: t1 - t0, temporal: t2 - t1, detail: t3 - t2, tone: t4 - t3, clahe: t5 - t4, total: t5 - t0 }
  };
}
var FROZEN_VARIANTS = (() => {
  const base = cloneConfig(DEFAULT_CONFIG);
  base.clahe.on = false;
  base.temporal.on = false;
  const mk = (line, detail) => {
    const c = cloneConfig(base);
    c.line.mode = line;
    c.detail.on = detail;
    return c;
  };
  return [
    { id: "identity", label: "Identity (raw)", cfg: mk("off", false) },
    { id: "line", label: "Line correction (columns)", cfg: mk("columns", false) },
    { id: "detail", label: "Detail only", cfg: mk("off", true) },
    { id: "line+detail", label: "Line + detail", cfg: mk("columns", true) }
  ];
})();

// src/lab/decode.ts
function frameBytes(c) {
  return c.width * c.height * 2;
}
function maxCode(c) {
  return (1 << c.bits) - 1;
}
function frameCountFor(size, c) {
  const usable = Math.max(0, size - c.headerBytes);
  const fb = frameBytes(c);
  return { frames: Math.floor(usable / fb), remainder: usable % fb };
}
function decodeBuffer(buf, c) {
  const n = c.width * c.height;
  const out = new Uint16Array(n);
  const dv = new DataView(buf);
  const mask = maxCode(c);
  const avail = Math.min(n, Math.floor(buf.byteLength / 2));
  for (let i = 0; i < avail; i++) {
    out[i] = dv.getUint16(i * 2, c.littleEndian) >> c.shift & mask;
  }
  return out;
}
async function readFrame(file, c, index) {
  const fb = frameBytes(c);
  const start = c.headerBytes + index * fb;
  const buf = await file.slice(start, start + fb).arrayBuffer();
  return decodeBuffer(buf, c);
}
var PRIMES = [];
for (let p = 2; PRIMES.length < 64; p++) {
  let ok = true;
  for (let d = 2; d * d <= p; d++) if (p % d === 0) ok = false;
  if (ok) PRIMES.push(p);
}
var frac32 = (x) => Math.floor((x - Math.floor(x)) * 4294967296) >>> 0;
var K256 = new Uint32Array(PRIMES.map((p) => frac32(Math.cbrt(p))));
var H256 = new Uint32Array(PRIMES.slice(0, 8).map((p) => frac32(Math.sqrt(p))));

// src/lab/roi.ts
function roiStats(data, W, H, r, satHigh) {
  const x0 = Math.max(0, Math.floor(r.x));
  const y0 = Math.max(0, Math.floor(r.y));
  const x1 = Math.min(W, Math.ceil(r.x + r.w));
  const y1 = Math.min(H, Math.ceil(r.y + r.h));
  const n = Math.max(0, x1 - x0) * Math.max(0, y1 - y0);
  if (n === 0) return { n: 0, median: NaN, sigma: NaN, min: NaN, max: NaN, satFrac: 0, validFrac: 0 };
  const vals = new Float32Array(n);
  let k = 0;
  let sat = 0;
  let min = Infinity;
  let max = -Infinity;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const v = data[y * W + x];
      vals[k++] = v;
      if (v >= satHigh || v <= 0) sat++;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  const { median, sigma } = robustSigma(vals);
  return { n, median, sigma, min, max, satFrac: sat / n, validFrac: 1 - sat / n };
}

// src/core.ts
var VERSION = "1.1.0";
var METHODS = ["argos2", "argos1", "argos3", "claudeA", "claudeB", "claudeC", "lab", "argos2-no-line", "argos2-no-detail", "lab-line-only", "lab-detail-low", "lab-detail-high"];
var LABELS = {
  argos2: "Argos 2 \xB7 original default",
  argos1: "Argos 1 \xB7 original default",
  argos3: "Argos 3 \xB7 original default",
  claudeA: "Claude A \xB7 original default",
  claudeB: "Claude B \xB7 original default (offline look-ahead)",
  claudeC: "Claude C \xB7 original default",
  lab: "New Claude lab \xB7 line + detail",
  "argos2-no-line": "Argos 2 \xB7 stage 1 bypass",
  "argos2-no-detail": "Argos 2 \xB7 detail bypass",
  "lab-line-only": "New lab \xB7 line only",
  "lab-detail-low": "New lab \xB7 lower detail",
  "lab-detail-high": "New lab \xB7 higher detail"
};
function validSettings(s) {
  if (!Number.isInteger(s.width) || !Number.isInteger(s.height) || s.width < 32 || s.height < 32 || s.width % 2 || s.height % 2 || s.width * s.height > 4194304) return "Width and height must be even integers \u226532, with at most 4,194,304 pixels.";
  if (!Number.isInteger(s.headerBytes) || s.headerBytes < 0 || !Number.isSafeInteger(s.headerBytes)) return "Header bytes must be a non-negative integer.";
  if (!Number.isInteger(s.shift) || s.shift < 0 || s.shift > 2) return "Right shift must be 0, 1 or 2 for a 14-bit field in uint16.";
  if (!Number.isFinite(s.lo) || !Number.isFinite(s.hi) || s.lo < 0 || s.hi > 16383 || s.hi <= s.lo) return "Fixed window must satisfy 0 \u2264 low < high \u2264 16383.";
  return null;
}
var decodeConfig = (s) => ({ width: s.width, height: s.height, headerBytes: s.headerBytes, shift: s.shift, littleEndian: s.littleEndian, bits: 14 });
function reference(raw, s) {
  let c = cloneConfig(DEFAULT_CONFIG);
  c.tone.fixedLo = s.lo;
  c.tone.fixedHi = s.hi;
  return referenceDisplay(raw, c);
}
function configFor(id, s) {
  if (id.startsWith("argos")) {
    const m = id === "argos1" ? "instance1" : id === "argos3" ? "instance3" : "instance2";
    let c2 = { ...DEFAULT_ISP_CONFIGS[m] };
    c2.enableLiveCnnResidual = false;
    if (id === "argos2-no-line") c2.stage1DestripeAndBadPx = false;
    if (id === "argos2-no-detail") c2.stage4EdgePreservingDetail = false;
    return c2;
  }
  if (id.startsWith("claude")) {
    const v = id.slice(-1);
    return { ...defaultCfg(v), cnn: false };
  }
  let c = cloneConfig(DEFAULT_CONFIG);
  c.tone.fixedLo = s.lo;
  c.tone.fixedHi = s.hi;
  c.tone.mode = "fixed";
  c.temporal.on = false;
  if (id === "lab-line-only") c.detail.on = false;
  if (id === "lab-detail-low") c.detail.gain = 1.5;
  if (id === "lab-detail-high") c.detail.gain = 3.5;
  return c;
}
function createMethodRunner(id, s, total, getFrame) {
  const cfg = configFor(id, s);
  const W = s.width, H = s.height;
  const methodology = id === "argos1" ? "instance1" : id === "argos3" ? "instance3" : "instance2";
  let argos = { prevBlackRef: { current: 7100 }, prevWhiteRef: { current: 7950 }, lastFrameKeyRef: { current: "" }, prevNormFrameRef: { current: null }, prevKalman14Ref: { current: null } };
  let claude = newState();
  let last = -1;
  return async (raw, index) => {
    const start = performance.now();
    let pixels, restored;
    const reset = last < 0 || index !== last + 1;
    if (reset) {
      argos = { prevBlackRef: { current: 7100 }, prevWhiteRef: { current: 7950 }, lastFrameKeyRef: { current: "" }, prevNormFrameRef: { current: null }, prevKalman14Ref: { current: null } };
      claude = newState();
    }
    if (id.startsWith("argos")) {
      const a = runThermalInstancePipeline({ methodology, raw14: raw, W, H, cfg, cnnState: createInitialCnnState(methodology), ...argos, frameKey: `${index}` });
      pixels = new Uint8Array(a.processed8);
      restored = a.stage1Clean14;
    } else if (id.startsWith("claude")) {
      const v = id.slice(-1);
      const a = await runPipeline(v, { raw, W, H, key: `${index}`, idx: index, total, reset, getFrame }, cfg, claude);
      pixels = new Uint8Array(a.out8);
      restored = a.restored;
    } else {
      const a = runPipeline2(raw, W, H, cfg);
      pixels = a.display;
      restored = a.enhanced;
    }
    last = index;
    return { pixels, restored, ms: performance.now() - start, config: cfg };
  };
}
async function runMethod(id, raw, s, index, total, getFrame) {
  return createMethodRunner(id, s, total, getFrame)(raw, index);
}
function stats(data, w, h, r, sat) {
  const x0 = Math.max(0, Math.floor(r.x)), y0 = Math.max(0, Math.floor(r.y)), x1 = Math.min(w, Math.ceil(r.x + r.w)), y1 = Math.min(h, Math.ceil(r.y + r.h));
  if (x1 <= x0 || y1 <= y0) throw new Error("ROI is outside the image");
  return roiStats(data, w, h, { ...r, x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, sat);
}
function temporalDifference(a, b, w, h, r) {
  const x0 = Math.max(0, Math.floor(r.x)), y0 = Math.max(0, Math.floor(r.y)), x1 = Math.min(w, Math.ceil(r.x + r.w)), y1 = Math.min(h, Math.ceil(r.y + r.h));
  let sum = 0, n = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = y * w + x;
    sum += Math.abs(a[i] - b[i]);
    n++;
  }
  return n ? sum / n : null;
}
function medianGap(a, b) {
  let spread = Math.sqrt((a.sigma * a.sigma + b.sigma * b.sigma) / 2);
  return { delta: a.median - b.median, pooledRobustSpread: spread, ratio: spread > 1e-6 ? Math.abs(a.median - b.median) / spread : null, interpretation: "Descriptive ROI statistic only; no universal separability or temperature conclusion." };
}
function synthetic(w, h, frame) {
  let a = new Uint16Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let target = (x - 0.3 * w - frame) ** 2 / (0.04 * w * w) + (y - 0.7 * h) ** 2 / (0.01 * h * h) < 1 ? 250 : 0;
    let bridge = Math.abs(y - 0.45 * h) < 2 ? 300 : 0;
    let line = x === Math.floor(w * 0.7) ? 150 : 0;
    let stripe = (x % 2 ? 1 : -1) * 35;
    a[y * w + x] = Math.round(6e3 + 180 * y / h + target + bridge + line + stripe + ((x * 19 + y * 31 + frame * 7) % 13 - 6));
  }
  return a;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  LABELS,
  METHODS,
  VERSION,
  configFor,
  createMethodRunner,
  decodeBuffer,
  decodeConfig,
  frameCountFor,
  medianGap,
  readFrame,
  reference,
  runMethod,
  stats,
  synthetic,
  temporalDifference,
  validSettings
});

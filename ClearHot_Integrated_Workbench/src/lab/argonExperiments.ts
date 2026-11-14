// Experimental variants adapted from Argon's submission; not the original Argos 2 algorithm.
import {detailEnhance, estimateNoiseSigma, freshTemporal, temporalFilter, type TemporalState} from './dsp';
import {toneFn} from './pipeline';
export interface CausalArgosState {
  temporalState: TemporalState;
  lastIndex: number;
}

export function createCausalArgosState(): CausalArgosState {
  return {
    temporalState: freshTemporal(),
    lastIndex: -1,
  };
}

/**
 * Separated Stage 1 Line-Only operator derived from Argos 2's 1D Haar wavelet shrinkage,
 * with explicit thin-wire gradient gating and NO bad-pixel neighbor replacement
 * (labeled as a Modified Ablation / Controlled Variant so original Argos 2 remains untouched).
 */
export function argos2SeparatedLineOnly14(
  raw14: ArrayLike<number>,
  W: number,
  H: number,
  verticalStrength = 0.85,
  horizontalStrength = 0.65
): Float32Array {
  const N = W * H;
  const out = new Float32Array(N);
  const colProf = new Float32Array(W);
  const rowProf = new Float32Array(H);

  // Estimate column profile excluding strong vertical transitions
  let colGlobal = 0;
  for (let x = 0; x < W; x++) {
    let sum = 0;
    let cnt = 0;
    for (let y = 4; y < H - 4; y++) {
      const idx = y * W + x;
      const v = raw14[idx];
      const vDiff = Math.abs(v - raw14[idx - W]);
      if (vDiff < 160 && v > 200 && v < 15500) {
        sum += v;
        cnt++;
      }
    }
    colProf[x] = cnt > 0 ? sum / cnt : 7000;
    colGlobal += colProf[x];
  }
  colGlobal /= Math.max(1, W);

  // High-pass column stripe offset relative to 9-tap local moving average
  const colStripe = new Float32Array(W);
  for (let x = 0; x < W; x++) {
    let s = 0;
    let c = 0;
    for (let k = -4; k <= 4; k++) {
      const xk = Math.max(0, Math.min(W - 1, x + k));
      s += colProf[xk];
      c++;
    }
    const hp = colProf[x] - s / c;
    // Softly bound extreme column jumps so a true full-height mast is not completely erased
    colStripe[x] = Math.abs(hp) > 180 ? Math.sign(hp) * 180 * 0.35 : hp;
  }

  // Estimate row profile excluding strong horizontal transitions
  for (let y = 0; y < H; y++) {
    let sum = 0;
    let cnt = 0;
    const yOff = y * W;
    for (let x = 4; x < W - 4; x++) {
      const idx = yOff + x;
      const v = raw14[idx];
      const hDiff = Math.abs(v - raw14[idx - 1]);
      if (hDiff < 160 && v > 200 && v < 15500) {
        sum += v;
        cnt++;
      }
    }
    rowProf[y] = cnt > 0 ? sum / cnt : colGlobal;
  }

  const rowStripe = new Float32Array(H);
  for (let y = 0; y < H; y++) {
    let s = 0;
    let c = 0;
    for (let k = -4; k <= 4; k++) {
      const yk = Math.max(0, Math.min(H - 1, y + k));
      s += rowProf[yk];
      c++;
    }
    const hp = rowProf[y] - s / c;
    rowStripe[y] = Math.abs(hp) > 180 ? Math.sign(hp) * 180 * 0.35 : hp;
  }

  for (let y = 0; y < H; y++) {
    const yOff = y * W;
    const rOff = rowStripe[y] * horizontalStrength;
    for (let x = 0; x < W; x++) {
      const idx = yOff + x;
      const v = raw14[idx];
      // Protect isolated 1-pixel high-contrast thin features
      const xL = Math.max(0, x - 1);
      const xR = Math.min(W - 1, x + 1);
      const yU = Math.max(0, y - 1);
      const yD = Math.min(H - 1, y + 1);
      const hSpike = Math.abs(v - 0.5 * (raw14[yOff + xL] + raw14[yOff + xR]));
      const vSpike = Math.abs(v - 0.5 * (raw14[yU * W + x] + raw14[yD * W + x]));
      const cScale = hSpike > 220 ? 0.25 : 1.0;
      const rScale = vSpike > 220 ? 0.25 : 1.0;
      const clean = v - colStripe[x] * verticalStrength * cScale - rOff * rScale;
      out[idx] = Math.max(0, Math.min(16383, clean));
    }
  }
  return out;
}

/**
 * Separated 14-bit Guided Base/Detail Enhancement with Noise-Aware Coring
 * (operates in 14-bit ADU prior to locked monotone window mapping).
 */
export function argos2SeparatedGuidedDetail14(
  input14: Float32Array,
  W: number,
  H: number,
  gain = 2.2,
  coringK = 1.6,
  maxBoostAdu = 220
): Float32Array {
  const sigma = Math.max(2.0, estimateNoiseSigma(input14, W, H));
  const enhanced = detailEnhance(
    input14,
    W,
    H,
    {
      radius: 3,
      edgeAdu: 140,
      gain,
      coringK,
      maxBoostAdu,
    },
    sigma
  );
  const out = new Float32Array(enhanced.length);
  for (let i = 0; i < enhanced.length; i++) {
    out[i] = Math.max(0, Math.min(16383, enhanced[i]));
  }
  return out;
}

/**
 * Controlled Candidate 1: 'argos2-guided-cored'
 * Separated line correction + bounded edge-aware guided detail with noise-aware coring +
 * locked monotone reference window [lo, hi] with soft highlight knee (0.92).
 */
export function runArgos2GuidedCoredCandidate(
  raw14: Uint16Array,
  W: number,
  H: number,
  lo: number,
  hi: number
): { pixels: Uint8Array; restored14: Float32Array; config: Record<string, unknown> } {
  const lineClean14 = argos2SeparatedLineOnly14(raw14, W, H, 0.85, 0.65);
  const enhanced14 = argos2SeparatedGuidedDetail14(lineClean14, W, H, 2.2, 1.6, 220);
  const fn = toneFn({ lo, hi, gamma: 1.0, knee: 0.92 });
  const pixels = new Uint8Array(W * H);
  for (let i = 0; i < pixels.length; i++) pixels[i] = fn(enhanced14[i]);
  return {
    pixels,
    restored14: enhanced14,
    config: {
      variant: "argos2-guided-cored",
      lineVerticalStrength: 0.85,
      lineHorizontalStrength: 0.65,
      guidedRadius: 3,
      edgeAdu: 140,
      detailGain: 2.2,
      coringK: 1.6,
      maxBoostAdu: 220,
      toneMode: "locked_monotone_window_soft_knee",
      lo,
      hi,
      knee: 0.92,
    },
  };
}

/**
 * Controlled Candidate 2: 'argos2-causal-temporal'
 * Strictly causal motion-gated temporal filter (declared 3-frame warm-up, resets on seek/reset) +
 * guided detail + locked monotone window.
 */
export function runArgos2CausalTemporalCandidate(
  raw14: Uint16Array,
  W: number,
  H: number,
  lo: number,
  hi: number,
  index: number,
  state: CausalArgosState
): { pixels: Uint8Array; restored14: Float32Array; config: Record<string, unknown> } {
  const isConsecutive = state.lastIndex >= 0 && index === state.lastIndex + 1;
  if (!isConsecutive) {
    state.temporalState = freshTemporal();
  }
  state.lastIndex = index;

  const lineClean14 = argos2SeparatedLineOnly14(raw14, W, H, 0.85, 0.65);
  const sigma = Math.max(2.0, estimateNoiseSigma(lineClean14, W, H));
  const tempRes = temporalFilter(lineClean14, state.temporalState, 0.4, 3.8, sigma);
  const enhanced14 = argos2SeparatedGuidedDetail14(tempRes.out, W, H, 2.0, 1.8, 200);
  const fn = toneFn({ lo, hi, gamma: 1.0, knee: 0.92 });
  const pixels = new Uint8Array(W * H);
  for (let i = 0; i < pixels.length; i++) pixels[i] = fn(enhanced14[i]);

  return {
    pixels,
    restored14: enhanced14,
    config: {
      variant: "argos2-causal-temporal",
      causalOnly: true,
      declaredWarmupFrames: 3,
      currentWarmupFrames: state.temporalState.frames,
      temporalAlpha: 0.4,
      motionGateK: 3.8,
      movingPixelFrac: Number(tempRes.movingFrac.toFixed(4)),
      lo,
      hi,
    },
  };
}


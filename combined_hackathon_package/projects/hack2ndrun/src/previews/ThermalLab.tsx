import { useEffect, useRef, useState } from "react";
import { Slider, Toggle, Btn, Stat } from "../components/ui";

const W = 192;
const H = 144;
const N = W * H;

const g = () => (Math.random() + Math.random() + Math.random() - 1.5) * 2;

function makeBackground() {
  const bg = new Float32Array(N);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let v = y < 50 ? 6300 + y * 4 : 6900 + (y - 50) * 7;
      if (x > 20 && x < 70 && y > 40 && y < 90) {
        v = 7700;
        if ((x - 20) % 12 > 7 && (y - 40) % 14 > 8) v = 7950;
      }
      if (x > 120 && x < 150 && y > 100 && y < 116) v = x > 130 && x < 140 ? 12600 : 11400;
      bg[y * W + x] = v;
    }
  return bg;
}

interface Cfg {
  destripe: boolean;
  temporal: boolean;
  plateau: boolean;
  smooth: number;
  tstrength: number;
  plat: number;
  lin: number;
  detail: number;
  flare: boolean;
}

export default function ThermalLab() {
  const [cfg, setCfg] = useState<Cfg>({ destripe: true, temporal: true, plateau: true, smooth: 0.08, tstrength: 0.2, plat: 2, lin: 0.3, detail: 0.6, flare: true });
  const [playing, setPlaying] = useState(true);
  const [ms, setMs] = useState(0);
  const cfgRef = useRef(cfg);
  cfgRef.current = cfg;
  const playRef = useRef(playing);
  playRef.current = playing;
  const cA = useRef<HTMLCanvasElement>(null);
  const cB = useRef<HTMLCanvasElement>(null);
  const cT = useRef<HTMLCanvasElement>(null);
  const cR = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const bg = makeBackground();
    const fpn = new Float32Array(W);
    for (let x = 0; x < W; x++) fpn[x] = g() * 45;
    const colEst = new Float32Array(W);
    const prev = new Float32Array(N);
    let havePrev = false;
    const lutS = new Float32Array(256);
    let haveLut = false;
    const raw = new Float32Array(N);
    const work = new Float32Array(N);
    const out8 = new Float32Array(N);
    const tmp = new Float32Array(N);
    const histA: number[] = [];
    const histB: number[] = [];
    let t = 0;
    let acc = 0;
    let last = performance.now();
    let raf = 0;
    let tAvg = 0;
    let tick = 0;

    const ctxA = cA.current!.getContext("2d")!;
    const ctxB = cB.current!.getContext("2d")!;
    const ctxR = cR.current!.getContext("2d")!;
    const imgA = ctxA.createImageData(W, H);
    const imgB = ctxB.createImageData(W, H);
    const imgR = ctxR.createImageData(W, H);

    const putImg = (img: ImageData, ctx: CanvasRenderingContext2D, d: Float32Array) => {
      for (let i = 0; i < N; i++) {
        const v = Math.max(0, Math.min(255, d[i]));
        img.data[i * 4] = v;
        img.data[i * 4 + 1] = v;
        img.data[i * 4 + 2] = v;
        img.data[i * 4 + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
    };

    const scene = () => {
      raw.set(bg);
      // moving warm person
      const px = 10 + ((t * 0.7) % 170);
      for (let y = 92; y < 114; y++) for (let x = Math.floor(px); x < Math.floor(px) + 6 && x < W; x++) raw[y * W + x] = 8400 + ((y < 98) ? 250 : 0);
      // flare
      const ft = t % 360;
      if (cfgRef.current.flare && ft > 140 && ft < 230) {
        for (let y = 18; y < 32; y++) for (let x = 150; x < 166; x++) if ((x - 158) ** 2 + (y - 25) ** 2 < 30) raw[y * W + x] = 16000;
      }
      const drift = 140 * Math.sin(t / 80);
      for (let x = 0; x < W; x++) fpn[x] += g() * 0.4;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) raw[y * W + x] += drift + fpn[x] + g() * 28;
      t++;
    };

    const baseline = () => {
      let lo = 1e9;
      let hi = -1e9;
      for (let i = 0; i < N; i++) {
        const v = raw[i];
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
      const s = 255 / Math.max(1, hi - lo);
      let sum = 0;
      for (let i = 0; i < N; i++) {
        out8[i] = (raw[i] - lo) * s;
        sum += out8[i];
      }
      return sum / N;
    };

    const pipeline = () => {
      const c = cfgRef.current;
      work.set(raw);
      if (c.destripe) {
        const d = new Float32Array(W);
        for (let y = 0; y < H; y++) {
          const o = y * W;
          for (let x = 0; x < W; x++) {
            let s = 0;
            let n = 0;
            for (let k = -5; k <= 5; k++) {
              const xx = x + k;
              if (xx >= 0 && xx < W) {
                s += work[o + xx];
                n++;
              }
            }
            d[x] += work[o + x] - s / n;
          }
        }
        for (let x = 0; x < W; x++) {
          const e = Math.max(-200, Math.min(200, d[x] / H));
          colEst[x] += (e - colEst[x]) * (t < 3 ? 1 : 0.06);
        }
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) work[y * W + x] -= colEst[x];
      }
      if (c.temporal && havePrev) {
        for (let i = 0; i < N; i++) {
          const d = work[i] - prev[i];
          const k = Math.min(1, c.tstrength + Math.abs(d) / 110);
          work[i] = prev[i] + k * d;
        }
      }
      prev.set(work);
      havePrev = true;

      // AGC
      if (c.plateau) {
        const hist = new Float32Array(256);
        for (let i = 0; i < N; i++) hist[Math.max(0, Math.min(255, work[i] >> 6))]++;
        let lo = 0;
        let hi = 255;
        while (lo < 255 && hist[lo] < 2) lo++;
        while (hi > 0 && hist[hi] < 2) hi--;
        const T = c.plat * (N / Math.max(1, hi - lo + 1)) * 0.5;
        const h2 = new Float32Array(256);
        let tot = 0;
        for (let i = lo; i <= hi; i++) {
          h2[i] = Math.min(hist[i], T) + c.lin * T * 0.5;
          tot += h2[i];
        }
        const lut = new Float32Array(256);
        let cum = 0;
        for (let i = 0; i < 256; i++) {
          if (i < lo) lut[i] = 0;
          else if (i > hi) lut[i] = 255;
          else {
            cum += h2[i];
            lut[i] = (255 * (cum - h2[i] / 2)) / tot;
          }
        }
        if (!haveLut) {
          lutS.set(lut);
          haveLut = true;
        } else for (let i = 0; i < 256; i++) lutS[i] += (lut[i] - lutS[i]) * c.smooth;
        for (let i = 0; i < N; i++) {
          const fb = Math.max(0, Math.min(255, work[i] / 64));
          const i0 = Math.floor(fb);
          const fr = fb - i0;
          out8[i] = lutS[i0] * (1 - fr) + lutS[Math.min(255, i0 + 1)] * fr;
        }
      } else {
        // naive per-frame minmax
        let lo = 1e9;
        let hi = -1e9;
        for (let i = 0; i < N; i++) {
          if (work[i] < lo) lo = work[i];
          if (work[i] > hi) hi = work[i];
        }
        const s = 255 / Math.max(1, hi - lo);
        for (let i = 0; i < N; i++) out8[i] = (work[i] - lo) * s;
      }

      // detail (guarded unsharp)
      if (c.detail > 0) {
        for (let y = 0; y < H; y++)
          for (let x = 0; x < W; x++) {
            let s = 0;
            let n = 0;
            for (let k = -2; k <= 2; k++) {
              const xx = x + k;
              if (xx >= 0 && xx < W) {
                s += out8[y * W + xx];
                n++;
              }
            }
            tmp[y * W + x] = s / n;
          }
        const res = new Float32Array(N);
        for (let y = 0; y < H; y++)
          for (let x = 0; x < W; x++) {
            let s = 0;
            let n = 0;
            for (let k = -2; k <= 2; k++) {
              const yy = y + k;
              if (yy >= 0 && yy < H) {
                s += tmp[yy * W + x];
                n++;
              }
            }
            const blur = s / n;
            const dtl = Math.max(-22, Math.min(22, out8[y * W + x] - blur));
            res[y * W + x] = out8[y * W + x] + c.detail * dtl;
          }
        out8.set(res);
      }
      let sum = 0;
      for (let i = 0; i < N; i++) sum += Math.max(0, Math.min(255, out8[i]));
      return sum / N;
    };

    const drawTrace = () => {
      const cv = cT.current;
      if (!cv) return;
      const ctx = cv.getContext("2d")!;
      const w = cv.width;
      const h = cv.height;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "rgba(255,255,255,0.03)";
      ctx.fillRect(0, 0, w, h);
      const plot = (arr: number[], color: string) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        arr.forEach((v, i) => {
          const x = (i / 240) * w;
          const y = h - (v / 255) * h;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
      };
      plot(histA, "#f87171");
      plot(histB, "#fbbf24");
    };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      acc += now - last;
      last = now;
      if (!playRef.current) {
        acc = 0;
        return;
      }
      if (acc < 33) return;
      acc = 0;
      scene();
      const mA = baseline();
      putImg(imgA, ctxA, out8);
      const t0 = performance.now();
      const mB = pipeline();
      const dt = performance.now() - t0;
      tAvg = tAvg * 0.9 + dt * 0.1;
      putImg(imgB, ctxB, out8);
      // raw viewer: linear fixed window
      const rv = new Float32Array(N);
      for (let i = 0; i < N; i++) rv[i] = ((raw[i] - 5000) / 11400) * 255;
      putImg(imgR, ctxR, rv);
      histA.push(mA);
      histB.push(mB);
      if (histA.length > 240) {
        histA.shift();
        histB.shift();
      }
      drawTrace();
      if (++tick % 15 === 0) setMs(tAvg);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const set = <K extends keyof Cfg>(k: K, v: Cfg[K]) => setCfg((c) => ({ ...c, [k]: v }));
  const cv = "w-full rounded-lg border border-white/10 bg-black";

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <div className="mb-1 text-[11px] text-slate-500">Raw, fixed linear window (what the sensor gives)</div>
          <canvas ref={cR} width={W} height={H} className={cv} />
        </div>
        <div>
          <div className="mb-1 text-[11px] text-rose-300">Baseline: per-frame min/max</div>
          <canvas ref={cA} width={W} height={H} className={cv} />
        </div>
        <div>
          <div className="mb-1 text-[11px] text-amber-300">Your pipeline</div>
          <canvas ref={cB} width={W} height={H} className={cv} />
        </div>
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500">
          <span>Mean brightness per frame (flicker detector): <span className="text-rose-300">baseline</span> vs <span className="text-amber-300">pipeline</span></span>
          <span>last 8 s</span>
        </div>
        <canvas ref={cT} width={900} height={90} className="w-full rounded-lg border border-white/10" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr_220px]">
        <div className="space-y-2">
          <Toggle label="1 · Column-stripe removal" on={cfg.destripe} onChange={(v) => set("destripe", v)} hint="Temporally filtered column offsets estimated from horizontal residuals" />
          <Toggle label="2 · Motion-adaptive temporal denoise" on={cfg.temporal} onChange={(v) => set("temporal", v)} hint="Stronger averaging only where pixels didn't change → no ghosts" />
          <Toggle label="3 · Plateau histogram AGC" on={cfg.plateau} onChange={(v) => set("plateau", v)} hint="Off = naive min/max per frame" />
          <Toggle label="Inject hot 'flare' every 12 s" on={cfg.flare} onChange={(v) => set("flare", v)} hint="The classic 'one hot object kills the scene'" />
        </div>
        <div className="space-y-3">
          <Slider label="Temporal base weight (new frame)" value={cfg.tstrength} min={0.05} max={0.8} step={0.05} onChange={(v) => set("tstrength", v)} hint="Lower = cleaner, more lag on slow changes" />
          <Slider label="Plateau clip (× mean bin)" value={cfg.plat} min={0.3} max={8} step={0.1} onChange={(v) => set("plat", v)} hint="Low = gentle, flat-ish. High = aggressive HE" />
          <Slider label="Linear component" value={cfg.lin} min={0} max={1} step={0.05} onChange={(v) => set("lin", v)} />
          <Slider label="4 · LUT smoothing (per frame)" value={cfg.smooth} min={0.01} max={1} step={0.01} onChange={(v) => set("smooth", v)} hint="1.0 = no smoothing → flicker returns" />
          <Slider label="5 · Detail gain (halo-guarded)" value={cfg.detail} min={0} max={2} step={0.1} onChange={(v) => set("detail", v)} hint="High values give a plastic look" />
        </div>
        <div className="space-y-2">
          <Stat label="Pipeline cost" value={`${ms.toFixed(1)} ms`} tone="cyan" sub={`${W}×${H} in JS; 640×512 is ~11× more pixels`} />
          <Btn onClick={() => setPlaying((p) => !p)} className="w-full">{playing ? "Pause" : "Play"}</Btn>
          <div className="text-[11px] leading-relaxed text-slate-500">Watch the red trace jump when the flare appears: that is the flicker defect. The amber trace stays calm when AGC smoothing is on.</div>
        </div>
      </div>
    </div>
  );
}

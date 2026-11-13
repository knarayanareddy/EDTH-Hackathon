// Node harness: trains the three CNNs on SIMULATED data (tfjs CPU backend), then runs the held-out SYNTHETIC benchmark.
import { writeFileSync } from 'node:fs';
import { trainCnn, setCnn, KIND_OF, type Variant } from '../src/lib/cnn';
import { runBenchmark, standardMethods } from '../src/lib/bench';
const steps = { A: Number(process.env.SA || 200), B: Number(process.env.SB || 300), C: Number(process.env.SC || 200) };
const batch = { A: Number(process.env.BA || 8), B: Number(process.env.BB || 16), C: Number(process.env.BC || 8) };
const info: Record<string, unknown> = {};
for (const v of ['B', 'A', 'C'] as Variant[]) {
  if (steps[v] <= 0) continue;
  const t0 = Date.now();
  const m = await trainCnn(KIND_OF[v], { steps: steps[v], batch: batch[v], lr: 0.003, seed: 42 + v.charCodeAt(0), shouldStop: () => false,
    onProgress: (p) => { if (p.step % 20 === 0) console.log(v, 'step', p.step, 'loss', p.loss.toFixed(4), 'val', p.val?.toFixed(4) ?? '', p.msPerStep.toFixed(0) + 'ms/step', p.backend); } });
  setCnn(v, m);
  info[v] = { kind: m.kind, steps: m.steps, batch: batch[v], params: m.params, macsPerPx: m.macsPerPx, seconds: +((Date.now() - t0) / 1000).toFixed(1), backend: m.backend, finalVal: m.val.at(-1)?.v, firstLoss: m.loss[0] };
  console.log(v, JSON.stringify(info[v]));
}
const W = Number(process.env.W || 320), H = Number(process.env.H || 256);
const has = { A: steps.A > 0, B: steps.B > 0, C: steps.C > 0 };
const rows = await runBenchmark(standardMethods(has), W, H);
const f = (n: number, d = 2) => n.toFixed(d);
for (const r of rows) console.log(r.label.padEnd(52), f(r.m.psnr), f(r.m.ssim, 3), f(r.m.colRes), f(r.m.rowRes), f(r.m.edgeKeep), f(r.m.thinRet), f(r.ms, 0));
writeFileSync(process.env.OUT || 'src/lib/benchSnapshot.json', JSON.stringify({ generated: new Date().toISOString().slice(0, 10), env: `Node ${process.version} · tfjs CPU backend (sandbox, no GPU) · ${W}x${H}`, W, H, scenes: 3, scenarios: 6, cnn: info, rows }, null, 1));

// Node harness: runs the SYNTHETIC held-out benchmark for the classical methods (no CNN).
import { runBenchmark, standardMethods, SCENARIOS } from '../src/lib/bench';
const W = Number(process.env.W || 320), H = Number(process.env.H || 256);
const rows = await runBenchmark(standardMethods({ A: false, B: false, C: false }), W, H);
const f = (n: number, d = 2) => n.toFixed(d);
console.log(`Synthetic benchmark ${W}x${H}, ${rows[0].n} runs/method (6 scenarios x 3 scenes)`);
console.log('method'.padEnd(52), 'PSNR  SSIM  colRes rowRes edgeK thinR  ms');
for (const r of rows) console.log(r.label.padEnd(52), f(r.m.psnr), f(r.m.ssim,3), f(r.m.colRes), f(r.m.rowRes), f(r.m.edgeKeep), f(r.m.thinRet), f(r.ms,0));
console.log('\nPer-scenario PSNR');
console.log(''.padEnd(52), SCENARIOS.map(s=>s.id.padStart(6)).join(' '));
for (const r of rows) console.log(r.label.padEnd(52), SCENARIOS.map(s=>f(r.byScenario[s.id].psnr).padStart(6)).join(' '));
console.log('\nPer-scenario colRes / rowRes (ADU)');
for (const r of rows) console.log(r.label.padEnd(52), SCENARIOS.map(s=>(f(r.byScenario[s.id].colRes,1)+'/'+f(r.byScenario[s.id].rowRes,1)).padStart(9)).join(' '));

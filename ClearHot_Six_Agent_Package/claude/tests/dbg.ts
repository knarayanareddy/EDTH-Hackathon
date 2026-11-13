import { synthFrame } from '../src/lib/synth';
import { estimateLineOffsetsLocal, estimateLineOffsetsSpectral, robustBadPixels, noiseSigma } from '../src/lib/dsp';
const W=320,H=256;
const rms=(a:Float32Array,b:Float32Array)=>{let m=0;for(let i=0;i<a.length;i++)m+=a[i]-b[i];m/=a.length;let s=0;for(let i=0;i<a.length;i++)s+=((a[i]-b[i])-m)**2;return Math.sqrt(s/a.length)};
for (const corr of ['vertical','periodic','strong'] as const) {
  const f=synthFrame('hot_object',5,W,H,corr);
  let x=Float32Array.from(f.raw); x=robustBadPixels(x,W,H,noiseSigma(x,W,H));
  const tr=f.colOff; const zero=new Float32Array(W);
  const rep=(n:string,o:Float32Array)=>console.log(corr.padEnd(9),n.padEnd(34),'err rms',rms(o,tr).toFixed(2),'(no-correction',rms(zero,tr).toFixed(2)+')');
  rep('A local',estimateLineOffsetsLocal(x,W,H,'col'));
  for (const R of [4,8,16]) for (const mode of ['broadband','peaks','both'] as const)
    for (const cut of [0.005,0.02]) rep(`C R=${R} ${mode} fc=${cut}`,estimateLineOffsetsSpectral(x,W,H,'col',cut,4,mode,R));
}

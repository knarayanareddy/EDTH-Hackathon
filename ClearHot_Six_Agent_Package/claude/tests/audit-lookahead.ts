import { defaultCfg,newState,runPipeline } from '../src/lib/pipeline';
const W=64,H=64,N=W*H;let accessed:number[]=[];const raw=new Uint16Array(N).fill(7500);
await runPipeline('B',{raw,W,H,key:'frame-0',idx:0,total:20,reset:true,getFrame:async(i)=>{accessed.push(i);return new Uint16Array(N).fill(7500+i)}},defaultCfg('B'),newState());
console.log('B at frame 0 requested frames:',[...new Set(accessed)].sort((a,b)=>a-b).join(','));

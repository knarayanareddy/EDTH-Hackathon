import {createCausalArgosState,runArgos2GuidedCoredCandidate,runArgos2CausalTemporalCandidate} from './lab/argonExperiments';
import { DEFAULT_ISP_CONFIGS, runThermalInstancePipeline } from './argos/thermalPipelineEngine';
import { createInitialCnnState } from './argos/cnnPrototypeEngine';
import { defaultCfg, newState, runPipeline as claudeRun, type PVariant } from './claude/pipeline';
import { DEFAULT_CONFIG, cloneConfig, runPipeline as labRun, referenceDisplay } from './lab/pipeline';
import { decodeBuffer, frameCountFor, readFrame, type DecodeConfig } from './lab/decode';
import { roiStats, type Roi } from './lab/roi';

export { decodeBuffer, frameCountFor, readFrame };
export * from './cnncache';
export type { DecodeConfig, Roi };
export const VERSION = 'integrated-0.1.0';
export const METHODS = ['argos2','argos1','argos3','claudeA','claudeB','claudeC','lab','argos2-no-line','argos2-no-detail','lab-line-only','lab-detail-low','lab-detail-high','experiment-guided','experiment-causal'] as const;
export type Method = typeof METHODS[number];
export const LABELS: Record<Method,string> = {
  argos2:'Argos 2 · original default', argos1:'Argos 1 · original default', argos3:'Argos 3 · original default',
  claudeA:'Claude A · original default', claudeB:'Claude B · original default (offline look-ahead)', claudeC:'Claude C · original default',
  lab:'New Claude lab · line + detail', 'argos2-no-line':'Argos 2 · stage 1 bypass', 'argos2-no-detail':'Argos 2 · stage 4 bypass (fused detail remains)',
  'lab-line-only':'New lab · line only', 'lab-detail-low':'New lab · lower detail', 'lab-detail-high':'New lab · higher detail',
  'experiment-guided':'EXPERIMENT · guided cored (not original Argos 2)', 'experiment-causal':'EXPERIMENT · causal temporal (not original Argos 2)'
};
export interface Settings {width:number;height:number;headerBytes:number;shift:number;littleEndian:boolean;lo:number;hi:number;}
export function validSettings(s:Settings):string|null {
 if (!Number.isInteger(s.width)||!Number.isInteger(s.height)||s.width<32||s.height<32||s.width%2||s.height%2||s.width*s.height>4194304) return 'Width and height must be even integers ≥32, with at most 4,194,304 pixels.';
 if(!Number.isInteger(s.headerBytes)||s.headerBytes<0||!Number.isSafeInteger(s.headerBytes))return 'Header bytes must be a non-negative integer.';
 if(!Number.isInteger(s.shift)||s.shift<0||s.shift>2)return 'Right shift must be 0, 1 or 2 for a 14-bit field in uint16.';
 if(!Number.isFinite(s.lo)||!Number.isFinite(s.hi)||s.lo<0||s.hi>16383||s.hi<=s.lo)return 'Fixed window must satisfy 0 ≤ low < high ≤ 16383.';
 return null;
}
export const decodeConfig=(s:Settings):DecodeConfig=>({width:s.width,height:s.height,headerBytes:s.headerBytes,shift:s.shift,littleEndian:s.littleEndian,bits:14});
export function reference(raw:Uint16Array,s:Settings){let c=cloneConfig(DEFAULT_CONFIG);c.tone.fixedLo=s.lo;c.tone.fixedHi=s.hi;return referenceDisplay(raw,c);}
export function configFor(id:Method,s:Settings):unknown {
 if(id==='experiment-guided')return {variant:id,vertical:0.85,horizontal:0.65,gain:2.2,coring:1.6,maxBoost:220,window:[s.lo,s.hi]};
 if(id==='experiment-causal')return {variant:id,vertical:0.85,horizontal:0.65,alpha:0.4,motionGateK:3.8,gain:2,coring:1.8,maxBoost:200,window:[s.lo,s.hi]};
 if(id.startsWith('argos')){const m=id==='argos1'?'instance1':id==='argos3'?'instance3':'instance2';let c={...DEFAULT_ISP_CONFIGS[m]};c.enableLiveCnnResidual=false;if(id==='argos2-no-line')c.stage1DestripeAndBadPx=false;if(id==='argos2-no-detail')c.stage4EdgePreservingDetail=false;return c;}
 if(id.startsWith('claude')){const v=id.slice(-1) as PVariant;return {...defaultCfg(v),cnn:false};}
 let c=cloneConfig(DEFAULT_CONFIG);c.tone.fixedLo=s.lo;c.tone.fixedHi=s.hi;c.tone.mode='fixed';c.temporal.on=false;
 if(id==='lab-line-only')c.detail.on=false;
 if(id==='lab-detail-low')c.detail.gain=1.5;
 if(id==='lab-detail-high')c.detail.gain=3.5;
 return c;
}
export interface MethodResult { pixels:Uint8Array; ms:number; config:unknown; restored?:Float32Array; }
/** A sequential player owns its temporal state. A seek or a new player resets it. */
export function createMethodRunner(id:Method,s:Settings,total:number,getFrame:(i:number)=>Promise<Uint16Array|null>, override?:Record<string,unknown>){
 // Tuned copy; never alter the frozen original defaults. CNN remains disabled.
 const cfg=override ? {...(configFor(id,s) as object), ...override, ...(id.startsWith('argos') ? {enableLiveCnnResidual:false} : id.startsWith('claude') ? {cnn:false} : {})} : configFor(id,s);const W=s.width,H=s.height;
 const methodology=id==='argos1'?'instance1':id==='argos3'?'instance3':'instance2';
 let argos={prevBlackRef:{current:7100},prevWhiteRef:{current:7950},lastFrameKeyRef:{current:''},prevNormFrameRef:{current:null as Float32Array|null},prevKalman14Ref:{current:null as Float32Array|null}};
 let claude=newState();let causal=createCausalArgosState();let last=-1;
 return async (raw:Uint16Array,index:number):Promise<MethodResult>=>{
  const start=performance.now();let pixels:Uint8Array,restored:Float32Array|undefined;const reset=last<0||index!==last+1;
  if(reset){argos={prevBlackRef:{current:7100},prevWhiteRef:{current:7950},lastFrameKeyRef:{current:''},prevNormFrameRef:{current:null},prevKalman14Ref:{current:null}};claude=newState();causal=createCausalArgosState()}
  if(id==='experiment-guided'){const r=runArgos2GuidedCoredCandidate(raw,W,H,s.lo,s.hi);pixels=r.pixels;restored=r.restored14;
  }else if(id==='experiment-causal'){const r=runArgos2CausalTemporalCandidate(raw,W,H,s.lo,s.hi,index,causal);pixels=r.pixels;restored=r.restored14;
  }else if(id.startsWith('argos')){
   const a=runThermalInstancePipeline({methodology,raw14:raw,W,H,cfg:cfg as typeof DEFAULT_ISP_CONFIGS.instance2,cnnState:createInitialCnnState(methodology),...argos,frameKey:`${index}`});
   pixels=new Uint8Array(a.processed8);restored=a.stage1Clean14;
  }else if(id.startsWith('claude')){
   const v=id.slice(-1) as PVariant;
   const a=await claudeRun(v,{raw,W,H,key:`${index}`,idx:index,total,reset,getFrame},cfg as ReturnType<typeof defaultCfg>,claude);
   pixels=new Uint8Array(a.out8);restored=a.restored;
  }else {const a=labRun(raw,W,H,cfg as typeof DEFAULT_CONFIG);pixels=a.display;restored=a.enhanced;}
  last=index;return {pixels,restored,ms:performance.now()-start,config:cfg};
 };
}
export async function runMethod(id:Method,raw:Uint16Array,s:Settings,index:number,total:number,getFrame:(i:number)=>Promise<Uint16Array|null>):Promise<MethodResult>{
 return createMethodRunner(id,s,total,getFrame)(raw,index);
}

export function stats(data:ArrayLike<number>,w:number,h:number,r:Roi,sat:number){
 const x0=Math.max(0,Math.floor(r.x)),y0=Math.max(0,Math.floor(r.y)),x1=Math.min(w,Math.ceil(r.x+r.w)),y1=Math.min(h,Math.ceil(r.y+r.h));
 if(x1<=x0||y1<=y0)throw new Error('ROI is outside the image');
 return roiStats(data,w,h,{...r,x:x0,y:y0,w:x1-x0,h:y1-y0},sat);
}
export function temporalDifference(a:ArrayLike<number>,b:ArrayLike<number>,w:number,h:number,r:Roi):number|null{
 const x0=Math.max(0,Math.floor(r.x)),y0=Math.max(0,Math.floor(r.y)),x1=Math.min(w,Math.ceil(r.x+r.w)),y1=Math.min(h,Math.ceil(r.y+r.h));let sum=0,n=0;
 for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const i=y*w+x;sum+=Math.abs(a[i]-b[i]);n++;}return n?sum/n:null;
}
export function medianGap(a:ReturnType<typeof stats>,b:ReturnType<typeof stats>){let spread=Math.sqrt((a.sigma*a.sigma+b.sigma*b.sigma)/2);return {delta:a.median-b.median,pooledRobustSpread:spread,ratio:spread>1e-6?Math.abs(a.median-b.median)/spread:null,interpretation:'Descriptive ROI statistic only; no universal separability or temperature conclusion.'};}
export function synthetic(w:number,h:number,frame:number){let a=new Uint16Array(w*h);for(let y=0;y<h;y++)for(let x=0;x<w;x++){let target=((x-0.3*w-frame)**2/(0.04*w*w)+(y-0.7*h)**2/(0.01*h*h)<1)?250:0;let bridge=Math.abs(y-.45*h)<2?300:0;let line=x===Math.floor(w*.7)?150:0;let stripe=(x%2?1:-1)*35; a[y*w+x]=Math.round(6000+180*y/h+target+bridge+line+stripe+((x*19+y*31+frame*7)%13-6));}return a;}

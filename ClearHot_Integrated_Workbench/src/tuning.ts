import {configFor, type Method, type Settings} from './core';
export type TuneMethod = 'argos1'|'argos2'|'argos3'|'claudeA'|'claudeB'|'claudeC';
export const TUNE_METHODS: TuneMethod[] = ['argos2','argos1','argos3','claudeA','claudeB','claudeC'];
type Spec = {key:string; label:string; kind:'number'|'boolean'|'select'; min?:number;max?:number;step?:number;options?:string[]; note?:string};
const n=(key:string,label:string,min:number,max:number,step:number,note?:string):Spec=>({key,label,kind:'number',min,max,step,note});
const b=(key:string,label:string,note?:string):Spec=>({key,label,kind:'boolean',note});
const choice=(key:string,label:string,options:string[],note?:string):Spec=>({key,label,kind:'select',options,note});
const ag:Spec[]=[b('stage1DestripeAndBadPx','Stage 1 · destripe + bad pixels','These are coupled in the original.'),b('stage2TemporalQuantileAgc','Temporal quantile AGC'),b('stage3DualPlateauCompression','Quantile/plateau setting'),b('stage4EdgePreservingDetail','Stage 4 post-display detail','Argos 2 fused guided detail also depends on methodology enhancement; this toggle alone is not a full detail bypass.'),b('antiGhostingPureSpatial','Pure spatial (disable post-display temporal smoothing)'),b('enableMethodologyDestripe','Method-specific destriping'),b('enableMethodologyEnhancement','Method-specific enhancement'),n('verticalStrength','Vertical correction',0,2,0.05),n('horizontalStrength','Horizontal correction',0,2,0.05),n('detailGain','Detail gain',0,4,0.05),n('agcSlewLimitADU','AGC slew (ADU/frame)',0,1000,1)];
const cl:Spec[]=[b('stage1','Stage 1 · correction'),b('stage2','Temporal quantile AGC'),b('stage3','Plateau/quantile setting'),b('stage4','Display detail'),b('spatialOnly','Pure spatial output'),n('vStr','Vertical correction',0,2,0.05),n('hStr','Horizontal correction',0,2,0.05),n('detailGain','Detail gain',0,4,0.05),n('agcSlew','AGC slew (ADU/frame)',0,1000,1),choice('lineMethod','Line correction algorithm',['orig','new','off'],'Off does not disable bad-pixel handling; stage 1 controls both.'),choice('badPixel','Bad pixel algorithm',['orig','robust']),choice('detailMethod','Detail algorithm',['orig','guided','multiscale']),choice('toneMode','Tone mapping',['quantile','plateau']),n('coring','Detail noise coring',0,10,0.1),n('baseCompress','Multiscale base compression',0,1,0.05)];
export function specs(m:TuneMethod):Spec[]{
 const base=m.startsWith('argos')?[...ag]:[...cl];
 if(m==='argos1')base.push(n('edgeGateThresholdADU','Edge gate (ADU)',25,1000,5),b('rankImpulseProtection','Rank impulse protection'),n('dualPlateauBlend','Plateau blend',0,1,0.05),n('dogNoiseCoring','DoG noise coring',0,30,0.5));
 if(m==='argos2')base.push(n('waveletShrinkThreshold','Wavelet shrink (ADU)',8,500,2),n('spectralCombNotch','Spectral comb strength',0,1,0.05),n('guidedFilterRadius','Guided radius (effective 1–5)',1,5,1),n('guidedFilterEps','Guided epsilon',100,10000,100),n('sCurveContrast','S-curve contrast',0,1,0.05));
 if(m==='argos3')base.push(n('bilateralRangeSigmaADU','Bilateral sigma (ADU)',20,1000,5),n('kalmanMotionGateADU','Motion gate (ADU)',15,1000,5),n('kalmanTemporalAlpha','Kalman temporal alpha',0,0.85,0.05),n('localAceStrength','Local ACE strength',0,1,0.05));
 if(m==='claudeA')base.push(b('clahe','CLAHE'),n('claheClip','CLAHE clip',0.1,10,0.1),n('claheAmount','CLAHE blend',0,1,0.05));
 if(m==='claudeB')base.push(n('window','Temporal window (offline look-ahead possible)',1,24,1),b('tdenoise','Temporal denoise'),n('tdStrength','Temporal denoise strength',0,1,0.05),n('fpnPixel','FPN pixel strength',0,1,0.05),n('pheAmount','Plateau equalization blend',0,1,0.05),n('plateau','Plateau',1,20,1));
 if(m==='claudeC')base.push(n('specCutoff','Spectral cutoff',0,0.5,0.01),n('specPeak','Spectral peak threshold',0,20,0.5),b('bilateral','Bilateral denoise'),n('bilStrength','Bilateral strength',0,1,0.05),choice('specMode','Spectral estimator mode',['both','broadband','peaks']));
 return base;
}
export type Preset={schema:'clearhot-tuning-preset-v1'; name:string; method:TuneMethod; overrides:Record<string,number|boolean|string>};
export function validatePreset(a:unknown):Preset {
 const p=a as Preset;if(!p||p.schema!=='clearhot-tuning-preset-v1'||!TUNE_METHODS.includes(p.method)||typeof p.name!=='string'||!p.name.trim()||p.name.length>100||!p.overrides||typeof p.overrides!=='object'||Array.isArray(p.overrides))throw Error('Invalid preset.');
 const ss=specs(p.method), entries=Object.entries(p.overrides);
 if(entries.length!==ss.length)throw Error('Preset must contain exactly the supported controls for its method.');
 for(const [k,v] of entries){const sp=ss.find(s=>s.key===k);if(!sp)throw Error('Unknown control: '+k);if(sp.kind==='boolean'){if(typeof v!=='boolean')throw Error('Invalid boolean: '+k)}else if(sp.kind==='select'){if(typeof v!=='string'||!sp.options?.includes(v))throw Error('Invalid choice: '+k)}else if(typeof v!=='number'||!Number.isFinite(v)||v<sp.min!||v>sp.max!||(sp.step===1&&!Number.isInteger(v)))throw Error('Out-of-range value: '+k)}
 return {schema:p.schema,name:p.name.trim(),method:p.method,overrides:{...p.overrides}};
}
export function defaultPreset(method:TuneMethod,s:Settings):Preset{const cfg=configFor(method as Method,s) as Record<string,number|boolean|string>;const overrides:Record<string,number|boolean|string>={};for(const x of specs(method))overrides[x.key]=cfg[x.key];return validatePreset({schema:'clearhot-tuning-preset-v1',name:'Untitled',method,overrides})}

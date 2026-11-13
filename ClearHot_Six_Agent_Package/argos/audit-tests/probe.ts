import {DEFAULT_ISP_CONFIGS,runThermalInstancePipeline} from '../src/utils/thermalPipelineEngine';
import {createInitialCnnState,trainCnnInBrowser} from '../src/utils/cnnPrototypeEngine';
import type {MethodologyId} from '../src/types/thermal';
const W=320,H=256,N=W*H;
function process(id:MethodologyId,raw:Uint16Array){return runThermalInstancePipeline({methodology:id,raw14:raw,W,H,cfg:{...DEFAULT_ISP_CONFIGS[id]},cnnState:createInitialCnnState(id),prevBlackRef:{current:7100},prevWhiteRef:{current:7950},lastFrameKeyRef:{current:''},prevNormFrameRef:{current:null},prevKalman14Ref:{current:null},frameKey:'sample0'})}
const stripes=new Uint16Array(N),wire=new Uint16Array(N),flat=new Uint16Array(N);
for(let y=0;y<H;y++)for(let x=0;x<W;x++){stripes[y*W+x]=7500+(x%2?150:-150);wire[y*W+x]=7500+(x===160?500:0);flat[y*W+x]=7500}
for(const id of ['instance1','instance2','instance3'] as MethodologyId[]){
 const a=process(id,stripes),b=process(id,wire),c=process(id,flat);let err=0;for(let i=0;i<N;i++)err+=(a.stage1Clean14[i]-7500)**2;const y=128;const contrast=b.stage1Clean14[y*W+160]-(b.stage1Clean14[y*W+158]+b.stage1Clean14[y*W+162])/2;
 const init=createInitialCnnState(id),post=trainCnnInBrowser(init,1);
 const kernelChange=Array.from(init.kHoriz).some((v,i)=>v!==post.kHoriz[i])||Array.from(init.kVert).some((v,i)=>v!==post.kVert[i])||Array.from(init.kSpatial).some((v,i)=>v!==post.kSpatial[i]);
 console.log(JSON.stringify({id,stripe_rmse_before:150,stripe_rmse_after:Math.sqrt(err/N),scene_line_original:500,scene_line_after:contrast,flat_reported_thin_retention_pct:c.telemetry.thinFeatureRetentionPct,flat_reported_halo:c.telemetry.haloOvershootIndex,training_epochs:post.trainedEpochs,kernels_changed:kernelChange,mix_before:Array.from(init.mixWeights),mix_after:Array.from(post.mixWeights),train_loss:post.currentLoss,val_loss:post.valLoss}));
}

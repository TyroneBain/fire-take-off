// Original-PDF adapter for bounded contour paint verification. This supplies
// visibility evidence only; it never creates accepted counts or match scores.
import {extractRawPathProvenance,createOptionalContentVisibilityResolver,RAW_PATH_CLIP_REASON,RAW_REDUNDANT_CLIP_VERSION} from './vector-paint-provenance.mjs';
import {extractClipFillProposals} from './vector-clip-paths.mjs';
import {captureContourRaster,CONTOUR_CONTEXT_OPTIONS,verifyContourVisibility} from './contour-visibility.mjs';

const preparedPages=new WeakMap();
const fail=reason=>{throw new Error(reason);};
const refuse=reason=>({supported:false,reason,requiresSemanticVerification:true});
const checkIds=ids=>Array.isArray(ids)&&ids.length<=128&&ids.every(id=>Number.isSafeInteger(id)&&id>=0)&&new Set(ids).size===ids.length;
const sameTransform=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&a.length===6&&b.length===6&&a.every((v,i)=>v===b[i]);
function awaitOperators(page,check){
 // Stop waiting promptly without destroying a PDF document shared by the
 // viewer. Observe late completion/rejection, but never publish a late handle.
 return new Promise((resolve,reject)=>{
  let done=false;
  const finish=(error,value)=>{if(done)return;done=true;clearInterval(poll);clearTimeout(deadline);error?reject(error):resolve(value);};
  const poll=setInterval(()=>{try{check();}catch(error){finish(error);}},25);
  const deadline=setTimeout(()=>finish(new Error('Original contour preparation timed out')),20000);
  Promise.resolve().then(()=>page.getOperatorList()).then(list=>{try{check();finish(null,list);}catch(error){finish(error);}},error=>finish(error));
 });
}
function contentState(config){
 if(config===undefined)return null;
 if(!config||typeof config.getHash!=='function'||typeof config.getGroup!=='function'||typeof config.isVisible!=='function')fail('Invalid optional-content configuration');
 const hash=config.getHash();if(typeof hash!=='string'||!hash.length)fail('Optional-content configuration has no stable identity');
 return hash;
}
/** Prepare before PDF.js renders and replaces raw path arrays with Path2D.
 * contextIds must come from independently validated explicit source exclusions.
 * The resulting handle is bound to this exact PDF page and layer configuration.
 */
export async function preparePdfContourPaints({page,OPS,elementIds,contextIds=[],optionalContentConfig,cancelled=()=>false}={}){
 try{
  if(typeof cancelled!=='function')fail('Invalid cancellation callback');
  const check=()=>{if(cancelled())fail('Contour preparation cancelled');};check();
  if(!page||typeof page.getOperatorList!=='function'||typeof page.getViewport!=='function'||typeof page.render!=='function'||!checkIds(elementIds)||!elementIds.length||!checkIds(contextIds)||contextIds.length>16||elementIds.length+contextIds.length>128||elementIds.some(id=>contextIds.includes(id)))fail('Invalid page or original paint identities');
  const contentHash=contentState(optionalContentConfig),operatorList=await awaitOperators(page,check);check();
  const viewportTransform=Array.from(page.getViewport({scale:2,rotation:0}).transform);
  const ids=[...elementIds,...contextIds],raw=extractRawPathProvenance({operatorList,OPS,ids,cancelled,viewportTransform,...(optionalContentConfig?{optionalContentVisible:createOptionalContentVisibilityResolver(optionalContentConfig)}:{})});
  if(raw.reason)fail(raw.reason);
  const byId=new Map(raw.records.map(p=>[p.id,p])),failures=new Map(raw.failures.map(p=>[p.id,p]));
  const clips=raw.failures.length?extractClipFillProposals({operatorList,OPS,cancelled}):{proposals:[],paintContexts:[]};
  if(clips.reason)fail(clips.reason);
  const clipById=new Map(clips.proposals.map(p=>[p.paintId,p])),clipContext=new Map(clips.paintContexts.map(p=>[p.paintId,p]));
  const adapt=id=>{
   const p=byId.get(id);
   if(p){
    if(p.clipDepth!==0){const proof=p.clipRedundancyProof;if(p.effectiveClipDepth!==0||proof?.version!==RAW_REDUNDANT_CLIP_VERSION||!sameTransform(proof.viewportTransform,viewportTransform)||proof.clips.length!==p.clipDepth||proof.clips.some((c,i)=>c.pathId!==p.clipPathIds[i]))fail('Clipping has no proof bound to this exact viewport');}
    return {kind:'path',id,bounds:[...p.bounds],pathCommands:[...p.pathCommands],paintClosesPath:p.paintClosesPath,style:{...p.style},rawPath:{sourceCommands:[...p.sourceCommands],matrix:[...p.matrix],sourceLineWidth:p.sourceLineWidth},wholeOperation:true,opaque:true,contextComplete:true,clipDepth:0};
   }
   const failure=failures.get(id),clip=clipById.get(id),context=clipContext.get(id);
   if(failure?.reason!==RAW_PATH_CLIP_REASON||failure.opaque!==true||failure.contextComplete!==true||failure.optionalContentVisible!==true||!clip||!context?.opaque||!context.supportedClipChain||context.definesClip||failure.clipPathIds?.length!==1||failure.clipPathIds[0]!==clip.clipPathId||context.clipPathIds.length!==1||context.clipPathIds[0]!==clip.clipPathId)fail(failure?.reason||'Original paint provenance is incomplete');
   return {kind:'clip-fill',id,bounds:[...clip.bounds],fill:clip.fill,clipRule:clip.clipRule,clip:structuredClone(clip.clip),paint:structuredClone(clip.paint),clipPathId:clip.clipPathId,clipOperatorId:clip.clipOperatorId,wholeOperation:true,opaque:true,contextComplete:true,clipDepth:1};
  };
  const paints=elementIds.map(adapt).sort((a,b)=>a.id-b.id),contextPaints=contextIds.map(adapt).sort((a,b)=>a.id-b.id);check();
  if(contentState(optionalContentConfig)!==contentHash)fail('Drawing layer visibility changed during preparation');
  const result=Object.freeze({supported:true,elementIds:Object.freeze([...elementIds]),contextIds:Object.freeze([...contextIds]),requiresSemanticVerification:true});
  preparedPages.set(result,{page,paints,contextPaints,optionalContentConfig,contentHash,viewportTransform,clipProofs:raw.records.filter(p=>p.clipRedundancyProof).map(p=>({id:p.id,proof:structuredClone(p.clipRedundancyProof)}))});return result;
 }catch(error){return refuse(error instanceof Error?error.message:'Original paint preparation failed');}
}

/** Render the unmodified original page into one bounded readback crop. Handles
 * cannot be forged, rebound to another page or reused after a layer change.
 * This deliberately returns no score, coordinates for accepted marks or count.
 */
export async function verifyPdfContourPaints({prepared,createCanvas,pdfjsVersion,cancelled=()=>false,onRender=()=>{}}={}){
 let canvas,task,timer,timedOut=false;
 try{
  const p=preparedPages.get(prepared);
  if(!p||typeof createCanvas!=='function'||typeof cancelled!=='function'||typeof onRender!=='function')fail('Invalid prepared paint handle or render callbacks');
  const check=()=>{if(cancelled())fail('Contour verification cancelled');if(contentState(p.optionalContentConfig)!==p.contentHash)fail('Drawing layer visibility changed; prepare again');};check();
  const viewport=p.page.getViewport({scale:2,rotation:0}),all=[...p.paints,...p.contextPaints],native=[Infinity,Infinity,-Infinity,-Infinity],scale=Math.hypot(viewport.transform[0],viewport.transform[1]);
  if(!sameTransform(Array.from(viewport.transform),p.viewportTransform))fail('Drawing viewport changed; prepare again');
  if(!Number.isFinite(scale)||scale<=0)fail('Invalid drawing viewport');
  for(const paint of all){
   const style=paint.style,pad=style?.stroke?Math.max(style.width,1/scale)/2*Math.max(Math.SQRT2,style.miter):0;
   native[0]=Math.min(native[0],paint.bounds[0]-pad);native[1]=Math.min(native[1],paint.bounds[1]-pad);native[2]=Math.max(native[2],paint.bounds[2]+pad);native[3]=Math.max(native[3],paint.bounds[3]+pad);
  }
  const points=[[native[0],native[1]],[native[0],native[3]],[native[2],native[1]],[native[2],native[3]]].map(point=>viewport.convertToViewportPoint(...point));
  const left=Math.floor(Math.min(...points.map(p=>p[0])))-2,top=Math.floor(Math.min(...points.map(p=>p[1])))-2,width=Math.ceil(Math.max(...points.map(p=>p[0])))+2-left,height=Math.ceil(Math.max(...points.map(p=>p[1])))+2-top;
  if(![left,top,width,height].every(Number.isSafeInteger)||width<1||height<1||width>256||height>256)fail('Complete paint footprint exceeds bounded verification crop');
  canvas=createCanvas(width,height);const context=canvas.getContext('2d',CONTOUR_CONTEXT_OPTIONS);
  // Validate actual context configuration before spending time on PDF replay.
  captureContourRaster({context,left,top,width,height,pdfjsVersion});
  task=p.page.render({canvas,canvasContext:context,viewport,transform:[1,0,0,1,-left,-top],...(p.optionalContentConfig?{optionalContentConfigPromise:Promise.resolve(p.optionalContentConfig)}:{})});
  timer=setTimeout(()=>{timedOut=true;task.cancel();},20000);
  task.onContinue=resume=>{try{check();resume();}catch{task.cancel();}};
  onRender(task);await task.promise;check();
  const image=captureContourRaster({context,left,top,width,height,pdfjsVersion});
  const proof=verifyContourVisibility({paints:p.paints,contextPaints:p.contextPaints,authorizedContextIds:prepared.contextIds,viewportTransform:Array.from(viewport.transform),image,createCanvas,cancelled});check();
  return {...proof,crop:{left,top,width,height},redundantClipOperations:p.clipProofs.map(p=>p.id),requiresSemanticVerification:true};
 }catch(error){
  if(task){task.cancel();try{await task.promise;}catch{}}
  return {verified:false,proof:null,reason:timedOut?'Original contour render timed out':error instanceof Error?error.message:'Original contour rendering failed',requiresSemanticVerification:true};
 }finally{clearTimeout(timer);if(canvas){canvas.width=0;canvas.height=0;}}
}

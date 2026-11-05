// Review-only orchestration. The caller owns a fresh, unrendered PDF page and
// attests its SHA256; the native anchor comes from a separate unfiltered render.
// Neither partial extraction nor a pixel-presence proof establishes class identity.
import {extractRawPathProvenance,createOptionalContentVisibilityResolver} from './vector-paint-provenance.mjs';
import {scopeVectorLayerCandidates} from './vector-layer-scope.mjs';
import {extractVectorPage,createVectorTemplate,findVectorMatches} from './vector-recognition.mjs';
import {preparePdfContourPaints,verifyPdfContourPaints} from './pdf-contour-verification.mjs';
export const VECTOR_CANDIDATE_REVIEW_VERSION='vector-candidate-review-1';
const MAX_PAINTS=50000,MAX_VALUES=2000000,MAX_AUDIT_WORK=50000000,MAX_CANDIDATES=128;
const finite=a=>Array.isArray(a)&&a.every(Number.isFinite);
function awaitOperators(page,check){
 return new Promise((resolve,reject)=>{let done=false;const finish=(error,value)=>{if(done)return;done=true;clearInterval(poll);error?reject(error):resolve(value);},poll=setInterval(()=>{try{check();}catch(error){finish(error);}},25);
  Promise.resolve().then(()=>page.getOperatorList()).then(value=>{try{check();finish(null,value);}catch(error){finish(error);}},error=>finish(error));
 });
}
function nativeElement(r,OPS){
 const fnArray=[OPS.transform,OPS.setLineWidth,OPS.setLineCap,OPS.setLineJoin,OPS.setMiterLimit,OPS.setStrokeRGBColor,OPS.setFillRGBColor,OPS.constructPath],argsArray=[[...r.matrix],[r.sourceLineWidth],[r.style.cap],[r.style.join],[r.style.miter],[r.style.stroke??'#000000'],[r.style.fill??'#000000'],[r.paintOperator,[[...r.sourceCommands]]]],native=extractVectorPage({operatorList:{fnArray,argsArray},OPS});
 if(!native.supported||native.elements.length!==1)throw Error('Audited paint could not be converted to native geometry');
 const e=native.elements[0];if(JSON.stringify(e.bounds)!==JSON.stringify(r.bounds)||JSON.stringify(e.style)!==JSON.stringify(r.style)||JSON.stringify(e.pathCommands)!==JSON.stringify(r.pathCommands))throw Error('Native paint conversion changed original geometry');
 return {...e,id:r.id};
}
/** No saved matches, scores, page-support assertion or layer visibility changes.
 * progress receives only phase/completed/total, never partial candidate results.
 * The caller must compute selection.anchor on a separate unfiltered PDF render
 * and supply optionalContentConfig from that same original document. Hash guards
 * pin the supplied configuration; they cannot attest its document provenance. */
export async function runVectorCandidateReview({page,OPS,optionalContentConfig,documentSha256,selection,sourceLayerScope=false,createCanvas,pdfjsVersion,cancelled=()=>false,progress=()=>{},maxMilliseconds=120000}={}){
 const base={version:VECTOR_CANDIDATE_REVIEW_VERSION,requiresSemanticReview:true,requiresSemanticVerification:true},refuse=reason=>({...base,completed:false,reason,proposals:[]});
 if(!page||typeof page.getOperatorList!=='function'||typeof page.getViewport!=='function'||typeof page.render!=='function'||!Number.isSafeInteger(page.pageNumber)||page.pageNumber<1||selection?.page!==page.pageNumber||typeof documentSha256!=='string'||!/^[a-f0-9]{64}$/.test(documentSha256))return refuse('Fresh original page and matching document/page identity are required');
 if(!OPS||!Number.isInteger(OPS.constructPath)||!Number.isInteger(OPS.endPath)||typeof createCanvas!=='function'||typeof cancelled!=='function'||typeof progress!=='function'||typeof sourceLayerScope!=='boolean'||!Number.isSafeInteger(maxMilliseconds)||maxMilliseconds<1||maxMilliseconds>120000)return refuse('Invalid candidate review callbacks or bounds');
 if(!finite(selection.bounds)||selection.bounds.length!==4||selection.bounds[2]<=selection.bounds[0]||selection.bounds[3]<=selection.bounds[1]||!finite(selection.anchor)||selection.anchor.length!==2||!Array.isArray(selection.ids)||!selection.ids.length||selection.ids.length>128||selection.ids.some(id=>!Number.isSafeInteger(id)||id<0)||new Set(selection.ids).size!==selection.ids.length||selection.excluded!==undefined&&!Array.isArray(selection.excluded))return refuse('Original selection identities, bounds and native anchor are required');
 const saved={page:selection.page,bounds:[...selection.bounds],anchor:[...selection.anchor],ids:[...selection.ids],excluded:[...(selection.excluded??[])]};
 if(new Set(saved.excluded).size!==saved.excluded.length||saved.excluded.some(id=>!saved.ids.includes(id))||saved.excluded.length===saved.ids.length)return refuse('Invalid explicit source exclusions');
 const started=performance.now(),deadline=started+maxMilliseconds;let configurationHash;
 try{
  const optionalContentVisible=createOptionalContentVisibilityResolver(optionalContentConfig);configurationHash=optionalContentConfig.getHash();
  const check=()=>{if(cancelled())throw Error('Candidate review cancelled; no results published');if(performance.now()>=deadline)throw Error('Candidate review timed out; no results published');if(optionalContentConfig.getHash()!==configurationHash)throw Error('Original optional-content configuration changed');};
  const notify=(phase,completed,total)=>{check();progress({phase,completed,total});check();};check();notify('audit',0,0);
  const operatorList=await awaitOperators(page,check);check();
  if(!Array.isArray(operatorList?.fnArray)||!Array.isArray(operatorList.argsArray)||operatorList.fnArray.length!==operatorList.argsArray.length||operatorList.fnArray.length>1000000)throw Error('Invalid or excessive original operator list');
  const textOps=new Set(['showText','showSpacedText','nextLineShowText','nextLineSetSpacingShowText'].map(name=>OPS[name]).filter(Number.isInteger)),imageOps=new Set(Object.entries(OPS).filter(([name])=>name.startsWith('paint')&&name.includes('Image')).map(([,op])=>op)),nonPathContent={textOperations:0,imageOperations:0,shadingOperations:0},paintIds=[];
  for(let id=0;id<operatorList.fnArray.length;id++){if((id&255)===0)check();const op=operatorList.fnArray[id];if(textOps.has(op))nonPathContent.textOperations++;if(imageOps.has(op))nonPathContent.imageOperations++;if(op===OPS.shadingFill)nonPathContent.shadingOperations++;if(op===OPS.constructPath&&operatorList.argsArray[id]?.[0]!==OPS.endPath)paintIds.push(id);if(paintIds.length>MAX_PAINTS)throw Error('Candidate paint inventory budget exceeded');}
  const records=[],elements=[],failures=[],viewportTransform=Array.from(page.getViewport({scale:2,rotation:0}).transform);let storedValues=0,auditWork=0;
  const chargeAudit=(count=operatorList.fnArray.length)=>{auditWork+=count;if(auditWork>MAX_AUDIT_WORK)throw Error('Candidate operator audit work budget exceeded');check();};
  for(let offset=0;offset<paintIds.length;offset+=128){chargeAudit();const raw=extractRawPathProvenance({operatorList,OPS,ids:paintIds.slice(offset,offset+128),optionalContentVisible,viewportTransform,cancelled:()=>{check();return false;}});check();if(raw.reason)throw Error(raw.reason);failures.push(...raw.failures);
   for(const r of raw.records){check();storedValues+=r.sourceCommands.length+r.pathCommands.length+6*r.transformChain.length;if(storedValues>MAX_VALUES)throw Error('Candidate geometry storage budget exceeded');records.push(r);elements.push(nativeElement(r,OPS));}
   notify('audit',Math.min(offset+128,paintIds.length),paintIds.length);await new Promise(resolve=>setTimeout(resolve,0));check();
  }
  const retainedIds=saved.ids.filter(id=>!saved.excluded.includes(id)),binding={documentSha256,pageNumber:saved.page,configurationHash},scope=sourceLayerScope?scopeVectorLayerCandidates({enabled:true,source:{...binding,records,retainedIds},target:{...binding,records,failures},optionalContentVisible,cancelled:()=>{check();return false;}}):null;
  check();if(scope&&!scope.supported)throw Error(scope.reason);const included=scope?new Set(scope.candidateRecords.map(r=>r.id)):null;
  // Legacy kernel's private geometry adapter; never returned as supported PDF
  // extraction and never sent to the application's saved-match worker contract.
  const sourceGeometry={supported:true,elements},targetGeometry={supported:true,elements:included?elements.filter(e=>included.has(e.id)):elements},template=createVectorTemplate(sourceGeometry,saved);
  if(!template.supported)throw Error('Source geometry is unavailable: '+template.reason);notify('search',0,1);
  const geometry=findVectorMatches(targetGeometry,template,{cancelled:()=>{check();return false;}});check();if(geometry.length>MAX_CANDIDATES)throw Error('Candidate verification result budget exceeded');notify('search',1,1);
  const prepare=async elementIds=>{chargeAudit();const handle=await preparePdfContourPaints({page,OPS,elementIds,contextIds:[],optionalContentConfig,cancelled:()=>{check();return false;}});chargeAudit(handle.additionalAuditWork??0);check();return handle;};
  const sourceHandle=await prepare(retainedIds);if(!sourceHandle.supported)throw Error('Source paint preparation failed: '+sourceHandle.reason);const prepared=[];notify('prepare',1,geometry.length+1);
  for(const hit of geometry){prepared.push(await prepare(hit.elementIds));notify('prepare',prepared.length+1,geometry.length+1);}
  // All original handles exist before the first render, including the source.
  const verify=async handle=>{check();let timer,poll,operationalFailure;
   try{const proof=handle.supported?await verifyPdfContourPaints({prepared:handle,createCanvas:(width,height)=>{try{return createCanvas(width,height);}catch(error){operationalFailure=error??Error('Canvas allocation failed');throw error;}},pdfjsVersion,cancelled:()=>{check();return false;},onRender:task=>{
    clearTimeout(timer);clearInterval(poll);
    // Observe rejection without changing the adapter's refusal contract. A
    // failed render is an interrupted job, not an ordinary visibility refusal.
    task.promise.then(undefined,error=>{operationalFailure=error??Error('Original render rejected');});
    // RenderTask may stall without onContinue callbacks. Enforce the whole-job
    // deadline and user cancellation independently of the adapter's per-crop limit.
    const stopIfInvalid=()=>{try{check();}catch{task.cancel();}};
    timer=setTimeout(stopIfInvalid,Math.max(1,Math.ceil(deadline-performance.now())));poll=setInterval(stopIfInvalid,25);stopIfInvalid();
   }}):{verified:false,reason:handle.reason,requiresSemanticVerification:true};check();if(proof.executionFailure)throw Error('Original paint '+proof.executionFailure+' failed: '+proof.reason);if(operationalFailure)throw Error('Original paint rendering failed: '+(operationalFailure.message??String(operationalFailure)));if(!proof.verified&&/timed out|cancelled|canceled/i.test(proof.reason??''))throw Error(proof.reason);return proof;}
   finally{clearTimeout(timer);clearInterval(poll);}
  };
  const sourceVisibility=await verify(sourceHandle);if(!sourceVisibility.verified)throw Error('Original source paint does not verify: '+sourceVisibility.reason);notify('verify',1,geometry.length+1);const proposals=[];
  for(let i=0;i<geometry.length;i++){const h=geometry[i],visibility=await verify(prepared[i]);proposals.push({x:h.x,y:h.y,rotation:h.rotation,elementIds:[...h.elementIds],wholeOperations:true,requiresSemanticVerification:true,visibility});notify('verify',i+2,geometry.length+1);}
  const coverage={complete:false,requestedPaints:paintIds.length,admittedPaints:records.length,candidateInventoryPaints:targetGeometry.elements.length,unknown:scope?scope.unknown:failures.map(f=>({...f,rawExtractionFailure:true})),excluded:scope?scope.excluded:[],nonPathContent,scope:sourceLayerScope?'explicit-same-page-source-ocg':'all-admitted-paints'};
  const result={...base,completed:true,binding,sourceLayerScope,source:{elementIds:retainedIds,excludedIds:saved.excluded,anchor:saved.anchor,visibility:sourceVisibility},proposals,coverage,allHandlesPreparedBeforeRendering:true,elapsedMs:performance.now()-started};notify('complete',proposals.length,proposals.length);check();return result;
 }catch(error){return refuse(error instanceof Error?error.message:'Candidate review failed');}
}

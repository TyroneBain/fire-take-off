import {extractRawPathProvenance,createOptionalContentVisibilityResolver} from './vector-paint-provenance.mjs';
import {createVectorTemplate,findVectorMatches} from './vector-recognition.mjs';
import {preparePdfContourPaints,verifyPdfContourPaints} from './pdf-contour-verification.mjs';
import {awaitNativeOperators,validateNativeOperators,nativeElementFromPaint,auditNativePage} from './vector-page-audit.mjs';
import {createLocalContextResolver,loadContextGeometry} from './vector-context-match.mjs';
import {VECTOR_CONTEXT_MATCH_POLICY} from './vector-review-policy.mjs';

export const VECTOR_PATTERN_REVIEW_VERSION='vector-pattern-review-1';
export const VECTOR_CONTEXT_PATTERN_VERSION='vector-pattern-review-2';
const patterns=new WeakMap(),digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v),finite=a=>Array.isArray(a)&&a.every(Number.isFinite);
const base={version:VECTOR_PATTERN_REVIEW_VERSION,requiresSemanticReview:true,requiresSemanticVerification:true};
const refused=error=>({...base,completed:false,reason:error instanceof Error?error.message:String(error),proposals:[]});
function budget({page,OPS,optionalContentConfig,documentSha256,createCanvas,pdfjsVersion,cancelled=()=>false,progress=()=>{},maxMilliseconds=120000,maxAuditWork=50000000},sourceCheck=()=>{}){
 if(!page||!Number.isSafeInteger(page.pageNumber)||page.pageNumber<1||typeof page.getOperatorList!=='function'||typeof page.getViewport!=='function'||typeof page.render!=='function'||!digest(documentSha256))throw Error('Fresh original page and document identity required');
 if(!OPS||!Number.isInteger(OPS.constructPath)||typeof createCanvas!=='function'||typeof pdfjsVersion!=='string'||typeof cancelled!=='function'||typeof progress!=='function'||!Number.isSafeInteger(maxMilliseconds)||maxMilliseconds<1||maxMilliseconds>120000||!Number.isSafeInteger(maxAuditWork)||maxAuditWork<1||maxAuditWork>50000000)throw Error('Invalid pattern review callbacks or budgets');
 const visible=createOptionalContentVisibilityResolver(optionalContentConfig),hash=optionalContentConfig.getHash(),started=performance.now(),deadline=started+maxMilliseconds;let visits=0;
 const check=()=>{if(cancelled())throw Error('Pattern review cancelled; no results published');if(performance.now()>=deadline)throw Error('Pattern review timed out; no results published');if(optionalContentConfig.getHash()!==hash)throw Error('Original layer configuration changed');sourceCheck();};
 const notify=(phase,completed,total)=>{check();progress({phase,completed,total});check();};
 const chargeAudit=count=>{visits+=count;if(visits>maxAuditWork)throw Error('Pattern operator audit budget exceeded');check();};
 return {check,notify,chargeAudit,visible,hash,started,deadline,get auditWork(){return visits;}};
}
function singleScope(record){
 const scopes=record?.optionalContentScopes;if(record?.wholeOperation!==true||record.opaque!==true||record.contextComplete!==true||!Array.isArray(scopes)||scopes.length!==1)return null;
 const scope=scopes[0],d=scope?.descriptor;if(scope.visible!==true||d?.type!=='OCG'||typeof d.id!=='string'||!d.id.length||d.id.length>256||Object.keys(d).some(k=>!['type','id'].includes(k)))return null;return d;
}
function uniqueLayer(config,name,visible,check){
 if(typeof name!=='string'||!name.length||name.length>512||typeof config[Symbol.iterator]!=='function')throw Error('A named original PDF layer is required');
 const found=[];let count=0;for(const [id,group] of config){check();if(++count>10000)throw Error('PDF layer inventory budget exceeded');if(group?.name===name&&visible({type:'OCG',id})===true)found.push(id);}
 if(found.length!==1)throw Error('The target needs exactly one visible PDF layer with the source layer name; choose all admitted paths explicitly to widen the search');
 return {mode:'unique-visible-ocg-name',name,ocgId:found[0],configurationHash:config.getHash()};
}
async function verify(handle,args,b){
 b.check();let timer,poll,operationalFailure;
 try{
  const proof=handle.supported?await verifyPdfContourPaints({prepared:handle,createCanvas:(w,h)=>{try{return args.createCanvas(w,h);}catch(error){operationalFailure=error;throw error;}},pdfjsVersion:args.pdfjsVersion,cancelled:()=>{b.check();return false;},onRender:task=>{
   clearTimeout(timer);clearInterval(poll);
   task.promise.then(undefined,error=>{operationalFailure=error??Error('Original render rejected');});const stop=()=>{try{b.check();}catch{task.cancel();}};timer=setTimeout(stop,Math.max(1,Math.ceil(b.deadline-performance.now())));poll=setInterval(stop,25);stop();
  }}):{verified:false,reason:handle.reason,requiresSemanticVerification:true};
  b.check();if(proof.executionFailure)throw Error('Original paint '+proof.executionFailure+' failed: '+proof.reason);if(operationalFailure)throw Error('Original paint rendering failed: '+(operationalFailure.message??String(operationalFailure)));if(!proof.verified&&/timed out|cancelled|canceled/i.test(proof.reason??''))throw Error(proof.reason);return proof;
 }finally{clearTimeout(timer);clearInterval(poll);}
}
// The source handle is intentionally opaque and local to this run. Paint IDs
// are never transferred into a target page; only the original geometric pattern.
export async function prepareVectorPattern(args={}){
 try{
  const b=budget(args),{selection,layerPolicy='all-admitted',matchPolicy='strict',page,OPS,optionalContentConfig,documentSha256}=args;
  if(!['strict',VECTOR_CONTEXT_MATCH_POLICY].includes(matchPolicy))throw Error('Unknown vector pattern policy');
  const contextual=matchPolicy===VECTOR_CONTEXT_MATCH_POLICY,policyBase=contextual?{...base,version:VECTOR_CONTEXT_PATTERN_VERSION}:base;
  if(!['all-admitted','same-layer-name'].includes(layerPolicy)||selection?.page!==page.pageNumber||!finite(selection.bounds)||selection.bounds.length!==4||selection.bounds[2]<=selection.bounds[0]||selection.bounds[3]<=selection.bounds[1]||!finite(selection.anchor)||selection.anchor.length!==2||!Array.isArray(selection.ids)||!selection.ids.length||selection.ids.length>128||selection.ids.some(id=>!Number.isSafeInteger(id)||id<0)||new Set(selection.ids).size!==selection.ids.length||!Array.isArray(selection.excluded??[])||(selection.excluded??[]).some(id=>!selection.ids.includes(id))||new Set(selection.excluded??[]).size!==(selection.excluded??[]).length||(selection.excluded??[]).length===selection.ids.length)throw Error('Invalid original source selection or explicit layer policy');
  const saved=structuredClone({...selection,excluded:selection.excluded??[]}),retained=saved.ids.filter(id=>!saved.excluded.includes(id));b.notify('source-audit',0,1);
  const list=await awaitNativeOperators(page,b.check);validateNativeOperators(list);b.chargeAudit(list.fnArray.length);
  const raw=extractRawPathProvenance({operatorList:list,OPS,ids:saved.ids,optionalContentVisible:b.visible,viewportTransform:Array.from(page.getViewport({scale:2,rotation:0}).transform),cancelled:()=>{b.check();return false;}});
  if(raw.reason||raw.failures.length)throw Error('Source geometry is unavailable: '+(raw.reason??raw.failures[0].reason));
  const geometry={supported:true,elements:raw.records.map(r=>nativeElementFromPaint(r,OPS))},template=createVectorTemplate(geometry,saved);if(!template.supported)throw Error('Source geometry is unavailable: '+template.reason);
  let sourceLayer=null;if(layerPolicy==='same-layer-name'){
   const scopes=retained.map(id=>singleScope(raw.records.find(r=>r.id===id)));if(scopes.some(s=>!s)||scopes.some(s=>s.id!==scopes[0].id))throw Error('Every retained source operation needs the same single visible PDF layer');
   sourceLayer=uniqueLayer(optionalContentConfig,optionalContentConfig.getGroup(scopes[0].id)?.name,b.visible,b.check);if(sourceLayer.ocgId!==scopes[0].id)throw Error('Source layer identity changed');
  }
  b.notify('source-audit',1,1);b.chargeAudit(list.fnArray.length);
  const handle=await preparePdfContourPaints({page,OPS,elementIds:retained,contextIds:[],optionalContentConfig,cancelled:()=>{b.check();return false;}});b.chargeAudit(handle.additionalAuditWork??0);b.check();if(!handle.supported)throw Error('Source paint preparation failed: '+handle.reason);
  const visibility=await verify(handle,args,b);if(!visibility.verified)throw Error('Original source paint does not verify: '+visibility.reason);
  const source={elementIds:[...retained],excludedIds:[...saved.excluded],anchor:[...saved.anchor],visibility,...(contextual?{contextIds:[]}: {})},sourceBinding={documentSha256,pageNumber:page.pageNumber,configurationHash:b.hash};
  b.notify('source-complete',1,1);b.check();const pattern=Object.freeze({version:policyBase.version});patterns.set(pattern,{template:structuredClone(template),source:structuredClone(source),sourceRecords:contextual?structuredClone(raw.records):null,matchPolicy,sourceBinding,sourceLayer,layerPolicy,config:optionalContentConfig,hash:b.hash});
  return {...policyBase,completed:true,pattern,source,sourceBinding,sourceLayer:sourceLayer?{...sourceLayer}:null,auditWork:b.auditWork};
 }catch(error){return refused(error);}
}
export function releaseVectorPattern(pattern){return patterns.delete(pattern);}
export async function reviewVectorPatternPage(args={}){
 try{
  const pattern=patterns.get(args.pattern);if(!pattern)throw Error('An original verified source pattern is required');
  const contextual=pattern.matchPolicy===VECTOR_CONTEXT_MATCH_POLICY,policyBase=contextual?{...base,version:VECTOR_CONTEXT_PATTERN_VERSION}:base;
  const sourceCheck=()=>{if(patterns.get(args.pattern)!==pattern||pattern.config.getHash()!==pattern.hash)throw Error('Original source pattern or layer configuration changed');};
  const b=budget(args,sourceCheck),{page,OPS,optionalContentConfig,documentSha256}=args;b.notify('audit',0,0);
  const layerScope=pattern.layerPolicy==='same-layer-name'?uniqueLayer(optionalContentConfig,pattern.sourceLayer.name,b.visible,b.check):{mode:'all-admitted'};
  const audit=await auditNativePage({page,OPS,optionalContentVisible:b.visible,check:b.check,chargeAudit:b.chargeAudit,notify:b.notify});
  const included=[],excluded=[],unknown=audit.failures.map(f=>({...f,rawExtractionFailure:true}));
  for(const r of audit.records){b.check();if(layerScope.mode==='all-admitted'){included.push(r.id);continue;}const d=singleScope(r);if(!d||b.visible(d)!==true)unknown.push({id:r.id,reason:'Target operation lacks a single audited visible OCG'});else if(d.id===layerScope.ocgId)included.push(r.id);else excluded.push({id:r.id,descriptor:{...d},reason:'Outside the explicitly selected named PDF layer'});}
  const ids=new Set(included),target={supported:true,elements:audit.elements.filter(e=>ids.has(e.id))};
  const resolver=contextual?createLocalContextResolver({sourceRecords:pattern.sourceRecords,targetRecords:audit.records,polygonBoolean:await loadContextGeometry(),check:b.check,chargeWork:b.chargeAudit}):null;b.check();
  b.notify('search',0,1);const searchOptions={cancelled:()=>{b.check();return false;}},geometry=findVectorMatches(target,pattern.template,searchOptions);
  // Finish the established search first: expanded proposals cannot replace an
  // existing body's identity, pose or correction anchor.
  if(resolver){const keys=new Set(geometry.map(h=>JSON.stringify([...h.elementIds].sort((a,b)=>a-b))));for(const hit of findVectorMatches(target,pattern.template,{...searchOptions,resolveExcludedContext:resolver.resolve})){
   const key=JSON.stringify([...hit.elementIds].sort((a,b)=>a-b));if(!keys.has(key)&&!geometry.some(h=>Math.hypot(h.x-hit.x,h.y-hit.y)<=.05)){keys.add(key);geometry.push(hit);}
  }geometry.sort((a,b)=>a.y-b.y||a.x-b.x);}
  b.check();if(geometry.length>512)throw Error('Page candidate verification budget exceeded');b.notify('search',1,1);
  const prepared=[];for(const hit of geometry){b.chargeAudit(audit.operatorCount);const handle=await preparePdfContourPaints({page,OPS,elementIds:hit.elementIds,contextIds:[],optionalContentConfig,cancelled:()=>{b.check();return false;}});b.chargeAudit(handle.additionalAuditWork??0);prepared.push(handle);b.notify('prepare',prepared.length,geometry.length);}
  const proposals=[];for(let i=0;i<geometry.length;i++){const hit=geometry[i],visibility=await verify(prepared[i],args,b),geometryContext=resolver?.evidence(hit);proposals.push({...(geometryContext?{geometryContext}:{}),x:hit.x,y:hit.y,rotation:hit.rotation,elementIds:[...hit.elementIds],...(contextual?{contextIds:[]}:{}),wholeOperations:true,requiresSemanticVerification:true,visibility});b.notify('verify',i+1,geometry.length);}
  const coverage={complete:false,requestedPaints:audit.requestedPaints,admittedPaints:audit.records.length,candidateInventoryPaints:target.elements.length,unknown,excluded,nonPathContent:audit.nonPathContent,scope:layerScope.mode==='all-admitted'?'all-admitted-paints':'explicit-unique-visible-ocg-name'};
  const result={...policyBase,completed:true,binding:{documentSha256,pageNumber:page.pageNumber,configurationHash:b.hash},sourceBinding:{...pattern.sourceBinding},source:structuredClone(pattern.source),layerScope,proposals,coverage,...(resolver?{contextDiagnostics:{...resolver.diagnostics}}:{}),allHandlesPreparedBeforeRendering:true,auditWork:b.auditWork,elapsedMs:performance.now()-b.started};b.notify('complete',proposals.length,proposals.length);b.check();return result;
 }catch(error){return refused(error);}
}

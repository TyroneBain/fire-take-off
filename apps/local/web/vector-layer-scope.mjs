// Explicit, same-page optional-content scope for an already audited inventory.
// This does not establish page extraction completeness, visibility, or class identity.
export const VECTOR_LAYER_SCOPE_VERSION='vector-source-layer-scope-1';
const MAX_RECORDS=50000,MAX_SOURCE_IDS=128;
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const page=v=>Number.isSafeInteger(v)&&v>0&&v<=100000;
const id=v=>Number.isSafeInteger(v)&&v>=0;
function singleScope(record){
 if(record?.wholeOperation!==true||record.opaque!==true||record.contextComplete!==true)return null;
 const scopes=record.optionalContentScopes;if(!Array.isArray(scopes)||scopes.length!==1)return null;
 const scope=scopes[0],d=scope?.descriptor;
 if(scope.visible!==true||!id(scope.operatorId)||!d||d.type!=='OCG'||Object.keys(d).some(k=>!['type','id'].includes(k))||typeof d.id!=='string'||!d.id.length||d.id.length>256)return null;
 return {type:'OCG',id:d.id};
}
/** Source records remain unfiltered for template construction and exclusions.
 * candidateRecords is a new array of the original target record references.
 * Pass the actual document-bound optional-content resolver used by raw extraction.
 * target.failures carries raw extraction omissions so coverage stays explicit.
 * Document/page identities, records and resolver are caller-attested, not a PDF
 * handle binding. Revalidate the bound configuration before using returned record
 * references; this result cannot authorize reuse after a document/layer change. */
export function scopeVectorLayerCandidates({enabled=false,source,target,optionalContentVisible,cancelled=()=>false}={}){
 const base={version:VECTOR_LAYER_SCOPE_VERSION,scopeOnly:true,complete:false,requiresRenderVerification:true,requiresSemanticVerification:true};
 const no=reason=>({...base,supported:false,reason,candidateRecords:[],excluded:[],unknown:[]});
 if(enabled!==true)return no('Source-layer candidate scope requires explicit opt-in');
 if(typeof cancelled!=='function'||typeof optionalContentVisible!=='function')return no('Bound optional-content visibility and cancellation callbacks are required');
 if(!digest(source?.documentSha256)||source.documentSha256!==target?.documentSha256||!page(source?.pageNumber)||source.pageNumber!==target?.pageNumber)return no('Source-layer scope requires the same original document and page');
 if(!Array.isArray(source.records)||!Array.isArray(target.records)||source.records.length>MAX_RECORDS||target.records.length>MAX_RECORDS||!Array.isArray(source.retainedIds)||!source.retainedIds.length||source.retainedIds.length>MAX_SOURCE_IDS||source.retainedIds.some(v=>!id(v))||new Set(source.retainedIds).size!==source.retainedIds.length)return no('Invalid or excessive source-layer inventory or retained identities');
 const failures=target.failures??[];if(!Array.isArray(failures)||failures.length+target.records.length>MAX_RECORDS)return no('Invalid or excessive raw extraction coverage');
 try{
  let work=0;const check=()=>{if(cancelled())throw Error('Source-layer scope cancelled');},tick=()=>{if((work++&127)===0)check();};check();
  const sourceById=new Map();for(const r of source.records){tick();if(!id(r?.id)||sourceById.has(r.id))throw Error('Invalid or duplicate source operation identity');sourceById.set(r.id,r);}
  let descriptor;for(const originalId of source.retainedIds){tick();const d=singleScope(sourceById.get(originalId));if(!d||descriptor&&descriptor.id!==d.id)throw Error('Every retained source operation needs the same single audited visible OCG');descriptor=d;}
  const visible=d=>optionalContentVisible(Object.freeze({...d}))===true;
  if(!visible(descriptor))throw Error('Original source OCG visibility is unresolved or hidden');
  const candidateRecords=[],excluded=[],unknown=[],seen=new Set();
  for(const r of target.records){tick();if(!id(r?.id)||seen.has(r.id))throw Error('Invalid or duplicate target operation identity');seen.add(r.id);const d=singleScope(r);
   if(!d||!visible(d)){unknown.push({id:r.id,reason:'Target operation lacks a single audited visible OCG'});continue;}
   if(d.id===descriptor.id)candidateRecords.push(r);else excluded.push({id:r.id,descriptor:d,reason:'Outside the explicitly selected source OCG'});
  }
  for(const f of failures){tick();if(!id(f?.id)||seen.has(f.id)||typeof f.reason!=='string'||!f.reason.length||f.reason.length>2048)throw Error('Invalid or overlapping raw extraction failure');seen.add(f.id);unknown.push({id:f.id,reason:f.reason,rawExtractionFailure:true});}
  check();if(!visible(descriptor))throw Error('Original source OCG visibility changed during scoping');check();
  return {...base,supported:true,binding:{documentSha256:source.documentSha256,pageNumber:source.pageNumber,descriptor:{...descriptor}},candidateRecords,excluded,unknown,coverage:{admittedInputRecords:target.records.length,rawExtractionFailures:failures.length,candidateRecords:candidateRecords.length,excludedRecords:excluded.length,unknownRecords:unknown.length}};
 }catch(error){return no(error instanceof Error?error.message:'Source-layer scope could not establish complete context');}
}

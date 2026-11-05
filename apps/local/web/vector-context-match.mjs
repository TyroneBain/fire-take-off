import {compareLocalContext} from './vector-local-context.mjs';

let library;
export async function loadContextGeometry(){
 if(!library)library=(globalThis.process?.versions?.node?import('polygon-clipping'):import('/vendor/polygon-clipping.mjs')).then(m=>m.default).catch(error=>{library=undefined;throw error;});
 return library;
}

// Caller supplies fresh, audited page-local provenance. This resolver only
// explains explicitly erased fill support; it never changes required body IDs.
export function createLocalContextResolver({sourceRecords,targetRecords,polygonBoolean,check,chargeWork}){
 if(!Array.isArray(sourceRecords)||sourceRecords.length>128||!Array.isArray(targetRecords)||targetRecords.length>50000||typeof check!=='function'||typeof chargeWork!=='function')throw Error('Invalid bounded context resolver inputs');
 const source=new Map(sourceRecords.map(r=>[r.id,r])),target=new Map(targetRecords.map(r=>[r.id,r])),cache=new Map();
 const diagnostics={comparisons:0,work:0,unsupported:0};
 let inventoryPage=null,inventoryTemplate=null,inventory=null,subpathReferences=0;
 const charge=amount=>{check();chargeWork(amount);diagnostics.work+=amount;};
 const poseKey=(angle,offset,ids)=>JSON.stringify([angle,offset,[...ids].sort((a,b)=>a-b)]);
 const styleKey=e=>JSON.stringify([e.style.fill,e.style.stroke,e.style.width,e.style.cap,e.style.join,e.style.miter,e.style.rule]);
 const fill=e=>Boolean(e.style.fill&&!e.style.stroke);
 const touches=(a,b,pad)=>a[0]<=b[2]+pad&&a[2]>=b[0]-pad&&a[1]<=b[3]+pad&&a[3]>=b[1]-pad;
 // Bounds are only a conservative connected-component broad phase. Every
 // included operation remains complete and the helper compares its full fill.
 // Overinclusion can refuse a match; bounds alone never explain any paint.
 const expand=(pool,seeds,tolerance,fullSourceBounds=null)=>{
  const canFit=e=>!fullSourceBounds||(e.bounds[0]>=fullSourceBounds[0]-tolerance&&e.bounds[1]>=fullSourceBounds[1]-tolerance&&e.bounds[2]<=fullSourceBounds[2]+tolerance&&e.bounds[3]<=fullSourceBounds[3]+tolerance);
  // A connected complete target operation extending outside the complete
  // source support bounds cannot be equal. Refuse it; never clip or omit it.
  if(seeds.some(e=>!canFit(e)))return null;
  const selected=new Map(seeds.map(e=>[e.id,e])),queue=[...seeds];let visits=0;
  if(queue.length>128)throw Error('Local connected context element budget exceeded');
  for(let i=0;i<queue.length;i++){
   const current=queue[i],key=styleKey(current);visits+=pool.length;
   if(visits>1000000)throw Error('Local context neighbour traversal budget exceeded');
   charge(pool.length);
   for(const candidate of pool){check();if(selected.has(candidate.id)||styleKey(candidate)!==key||!touches(current.bounds,candidate.bounds,tolerance))continue;
    if(!canFit(candidate))return null;
    selected.set(candidate.id,candidate);queue.push(candidate);if(queue.length>128)throw Error('Local connected context element budget exceeded');
   }
  }
  return queue;
 };
 const resolve=({template,ignored,envelope,used,angle,offset,scale,tolerance,page})=>{
  check();if(scale!==1)return new Set();
  if(inventoryPage&&inventoryPage!==page)throw Error('Local context resolver is bound to one page inventory');
  if(inventoryTemplate&&inventoryTemplate!==template)throw Error('Local context resolver is bound to one source template');
  const key=poseKey(angle,offset,used);if(cache.has(key))return new Set(cache.get(key).explained);if(cache.size>=10000)throw Error('Local context pose budget exceeded');
  if(!inventory){
   if(!Array.isArray(page.elements)||page.elements.length>50000)throw Error('Local context inventory budget exceeded');
   charge(page.elements.length);inventory=[];for(const e of page.elements){check();if(fill(e))inventory.push(e);}inventoryPage=page;inventoryTemplate=template;
  }
  const inside=b=>b[0]>=envelope[0]+tolerance&&b[1]>=envelope[1]+tolerance&&b[2]<=envelope[2]-tolerance&&b[3]<=envelope[3]-tolerance;
  if(ignored.length>128)throw Error('Local source context element budget exceeded');
  charge(ignored.length+inventory.length);
  const [a,b,c,d]=angle===0?[1,0,0,1]:angle===90?[0,1,-1,0]:angle===180?[-1,0,0,-1]:[0,-1,1,0];
  const evaluate=(placedSource,targetElements)=>{
   const sourceIds=new Set(placedSource.map(e=>e.id)),sourceElements=template.excludedElements.filter(e=>sourceIds.has(e.id));
   if(sourceElements.length+targetElements.length>128)throw Error('Local connected context combined element budget exceeded');
   if(!sourceElements.length||!targetElements.length)return null;
   const result=compareLocalContext({sourceElements,targetElements,sourceExcludedIds:[...sourceIds],sourceRecords:sourceElements.map(e=>source.get(e.id)),targetRecords:targetElements.map(e=>target.get(e.id)),sourceTransform:[a,b,c,d,offset[0]-a*template.anchor[0]-c*template.anchor[1],offset[1]-b*template.anchor[0]-d*template.anchor[1]],polygonBoolean,tolerance,cancelled:()=>{check();return false;}});
   charge(result.work);check();diagnostics.comparisons++;
   if(!result.supported){diagnostics.unsupported++;if(/budget|cancel/i.test(result.reason??''))throw Error(result.reason);}
   return result;
  };
  const sourcePool=ignored.filter(fill),targetPool=inventory.filter(e=>!used.has(e.id)),targetSeeds=targetPool.filter(e=>inside(e.bounds));
  // Preserve the established bounded interior comparison. Only an explicitly
  // erased source fill crossing the envelope justifies looking farther afield.
  let result=evaluate(sourcePool.filter(e=>inside(e.bounds)),targetSeeds);
  if(!result?.equivalent&&sourcePool.some(e=>!inside(e.bounds)&&touches(e.bounds,envelope,0))){
   const sourceExpanded=expand(sourcePool,sourcePool.filter(e=>touches(e.bounds,envelope,0)),tolerance),styles=new Set(sourceExpanded.map(styleKey));
   const bounds=[Math.min(...sourceExpanded.map(e=>e.bounds[0])),Math.min(...sourceExpanded.map(e=>e.bounds[1])),Math.max(...sourceExpanded.map(e=>e.bounds[2])),Math.max(...sourceExpanded.map(e=>e.bounds[3]))];
   const pool=targetPool.filter(e=>styles.has(styleKey(e))),expanded=expand(pool,pool.filter(e=>inside(e.bounds)),tolerance,bounds);
   if(expanded)result=evaluate(sourceExpanded,expanded);
  }
  const explained=new Set(result?.supported?result.explainedTargetIds:[]);let evidence=null;
  if(explained.size){
   const sourceElementIds=[...new Set(result.support.flatMap(group=>group.sourceElementIds))].sort((a,b)=>a-b),sourceIdsUsed=new Set(sourceElementIds);
   const compact=fragment=>({elementId:fragment.elementId,subpathIndex:fragment.subpathIndex,commandRange:[...fragment.commandRange]});
   const sourceSubpaths=result.sourceFragments.filter(f=>sourceIdsUsed.has(f.elementId)).map(compact),targetSubpaths=result.targetFragments.filter(f=>explained.has(f.elementId)).map(compact);
   subpathReferences+=sourceSubpaths.length+targetSubpaths.length;if(subpathReferences>50000)throw Error('Local context provenance reference budget exceeded');
   charge(sourceSubpaths.length+targetSubpaths.length);
   evidence={version:result.version,sourceElementIds,targetElementIds:[...explained].sort((a,b)=>a-b),sourceSubpaths,targetSubpaths,requiresOriginalPaintVerification:true,requiresSemanticReview:true};
  }
  check();cache.set(key,{explained,evidence});return new Set(explained);
 };
 const evidence=hit=>{check();const value=cache.get(poseKey(hit.rotation,[hit.x,hit.y],hit.elementIds))?.evidence;return value?structuredClone(value):null;};
 return {resolve,evidence,diagnostics};
}

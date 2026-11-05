import {extractRawPathProvenance} from './vector-paint-provenance.mjs';
import {extractVectorPage} from './vector-recognition.mjs';

// Count the numeric geometry actually retained, not temporary raw/native
// copies. The previous 2M raw-value guard also retained uncounted converted
// commands and segments (up to roughly 4.667M numeric values altogether).
// These are representation limits, not a measurement of JavaScript heap bytes.
export const NATIVE_PAGE_STORAGE_LIMITS=Object.freeze({nativeCommandValues:2000000,retainedGeometryValues:4666666,scopeMetadataValues:250000,scopeMetadataCharacters:1000000});
function compactScopeRecord(record,storage,check){
 const visit=value=>{
  check();if(++storage.scopeMetadataValues>NATIVE_PAGE_STORAGE_LIMITS.scopeMetadataValues)throw Error('Candidate scope metadata storage budget exceeded');
  if(typeof value==='string'){storage.scopeMetadataCharacters+=value.length;if(storage.scopeMetadataCharacters>NATIVE_PAGE_STORAGE_LIMITS.scopeMetadataCharacters)throw Error('Candidate scope metadata storage budget exceeded');}
  else if(Array.isArray(value)){for(const child of value)visit(child);}
  else if(value&&typeof value==='object'){for(const [key,child]of Object.entries(value)){visit(key);visit(child);}}
 };
 visit(record.optionalContentScopes);
 return {id:record.id,wholeOperation:record.wholeOperation,opaque:record.opaque,contextComplete:record.contextComplete,optionalContentScopes:structuredClone(record.optionalContentScopes)};
}

export function awaitNativeOperators(page,check){
 return new Promise((resolve,reject)=>{let done=false;const finish=(error,value)=>{if(done)return;done=true;clearInterval(poll);error?reject(error):resolve(value);},poll=setInterval(()=>{try{check();}catch(error){finish(error);}},25);
  Promise.resolve().then(()=>page.getOperatorList()).then(value=>{try{check();finish(null,value);}catch(error){finish(error);}},error=>finish(error));
 });
}
export function nativeElementFromPaint(r,OPS){
 const fnArray=[OPS.transform,OPS.setLineWidth,OPS.setLineCap,OPS.setLineJoin,OPS.setMiterLimit,OPS.setStrokeRGBColor,OPS.setFillRGBColor,OPS.constructPath],argsArray=[[...r.matrix],[r.sourceLineWidth],[r.style.cap],[r.style.join],[r.style.miter],[r.style.stroke??'#000000'],[r.style.fill??'#000000'],[r.paintOperator,[[...r.sourceCommands]]]],native=extractVectorPage({operatorList:{fnArray,argsArray},OPS});
 if(!native.supported||native.elements.length!==1)throw Error('Audited paint could not be converted to native geometry');
 const e=native.elements[0];if(JSON.stringify(e.bounds)!==JSON.stringify(r.bounds)||JSON.stringify(e.style)!==JSON.stringify(r.style)||JSON.stringify(e.pathCommands)!==JSON.stringify(r.pathCommands))throw Error('Native paint conversion changed original geometry');
 return {...e,id:r.id};
}
export function validateNativeOperators(list){
 if(!Array.isArray(list?.fnArray)||!Array.isArray(list.argsArray)||list.fnArray.length!==list.argsArray.length||list.fnArray.length>1000000)throw Error('Invalid or excessive original operator list');
}
// Partial path inventory only. Text/images and raw refusals remain explicit;
// every proposed symbol still needs its own original-PDF paint proof.
export async function auditNativePage({page,OPS,optionalContentVisible,check,chargeAudit,notify}){
 const list=await awaitNativeOperators(page,check);validateNativeOperators(list);check();
 const textOps=new Set(['showText','showSpacedText','nextLineShowText','nextLineSetSpacingShowText'].map(name=>OPS[name]).filter(Number.isInteger)),imageOps=new Set(Object.entries(OPS).filter(([name])=>name.startsWith('paint')&&name.includes('Image')).map(([,op])=>op)),nonPathContent={textOperations:0,imageOperations:0,shadingOperations:0},paintIds=[];
 for(let id=0;id<list.fnArray.length;id++){if((id&255)===0)check();const op=list.fnArray[id];if(textOps.has(op))nonPathContent.textOperations++;if(imageOps.has(op))nonPathContent.imageOperations++;if(op===OPS.shadingFill)nonPathContent.shadingOperations++;if(op===OPS.constructPath&&list.argsArray[id]?.[0]!==OPS.endPath)paintIds.push(id);if(paintIds.length>50000)throw Error('Candidate paint inventory budget exceeded');}
 const records=[],elements=[],failures=[],viewportTransform=Array.from(page.getViewport({scale:2,rotation:0}).transform),storage={nativeCommandValues:0,segmentValues:0,retainedGeometryValues:0,scopeMetadataValues:0,scopeMetadataCharacters:0};
 for(let offset=0;offset<paintIds.length;offset+=128){chargeAudit(list.fnArray.length);const raw=extractRawPathProvenance({operatorList:list,OPS,ids:paintIds.slice(offset,offset+128),optionalContentVisible,viewportTransform,cancelled:()=>{check();return false;}});check();if(raw.reason)throw Error(raw.reason);failures.push(...raw.failures);
  for(const record of raw.records){
   check();const element=nativeElementFromPaint(record,OPS);storage.nativeCommandValues+=element.pathCommands.length;storage.segmentValues+=element.segments.reduce((sum,segment)=>sum+segment.length,0);storage.retainedGeometryValues=storage.nativeCommandValues+storage.segmentValues;
   if(storage.nativeCommandValues>NATIVE_PAGE_STORAGE_LIMITS.nativeCommandValues||storage.retainedGeometryValues>NATIVE_PAGE_STORAGE_LIMITS.retainedGeometryValues)throw Error('Candidate retained geometry storage budget exceeded');
   // Matching needs every original native command/segment and paint ID. Layer
   // scoping needs only these audited flags/descriptors. Original transform and
   // clipping provenance is re-extracted by the proof adapter before rendering.
   records.push(compactScopeRecord(record,storage,check));elements.push(element);
  }
  notify('audit',Math.min(offset+128,paintIds.length),paintIds.length);await new Promise(resolve=>setTimeout(resolve,0));check();
 }
 check();return {records,elements,failures,nonPathContent,requestedPaints:paintIds.length,operatorCount:list.fnArray.length,storage};
}

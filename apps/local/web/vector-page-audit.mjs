import {extractRawPathProvenance} from './vector-paint-provenance.mjs';
import {extractVectorPage} from './vector-recognition.mjs';

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
 const records=[],elements=[],failures=[],viewportTransform=Array.from(page.getViewport({scale:2,rotation:0}).transform);let storedValues=0;
 for(let offset=0;offset<paintIds.length;offset+=128){chargeAudit(list.fnArray.length);const raw=extractRawPathProvenance({operatorList:list,OPS,ids:paintIds.slice(offset,offset+128),optionalContentVisible,viewportTransform,cancelled:()=>{check();return false;}});check();if(raw.reason)throw Error(raw.reason);failures.push(...raw.failures);
  for(const record of raw.records){check();storedValues+=record.sourceCommands.length+record.pathCommands.length+6*record.transformChain.length;if(storedValues>2000000)throw Error('Candidate geometry storage budget exceeded');records.push(record);elements.push(nativeElementFromPaint(record,OPS));}
  notify('audit',Math.min(offset+128,paintIds.length),paintIds.length);await new Promise(resolve=>setTimeout(resolve,0));check();
 }
 return {records,elements,failures,nonPathContent,requestedPaints:paintIds.length,operatorCount:list.fnArray.length};
}

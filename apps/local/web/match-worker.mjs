import {findVectorMatches,VECTOR_SCALE_RANGE} from './vector-recognition.mjs';
import {inkImage,findSymbolMatches} from './matcher.mjs';
export function matchRequestResult({rgba,width,height,template,vectorPage,vectorOnly=false}){
  let fallbackReason=template.vector?template.vector.reason||vectorPage?.reason||null:null;
  if(vectorPage?.supported&&template.vector?.supported){
    try{return {matches:findVectorMatches(vectorPage,template.vector,{rotations:template.matchRotations===true,scaleRange:template.matchScales===true?VECTOR_SCALE_RANGE:null}),engine:'vector',fallbackReason:null};}
    catch(error){if(error.code!=='VECTOR_TEXT_OVERLAP')throw error;fallbackReason=error.message;}
  }
  // Overlay verification has no raster payload and must never manufacture a
  // geometric hit from an unsupported or partially visible page.
  if(vectorOnly)return {matches:[],engine:'none',fallbackReason:fallbackReason||'Vector geometry unavailable'};
  // Use a complete raster result when text obscures any geometric candidate.
  // Never merge partial vector hits with raster hits or swallow cancellation/budgets.
  return {matches:findSymbolMatches(inkImage(new Uint8ClampedArray(rgba),width,height),template,{rotations:template.matchRotations===true,threshold:template.matchThreshold??(template.elementSubset?.95:.85)}),engine:'raster',fallbackReason};
}
export const matchRequest=request=>matchRequestResult(request).matches;
// Same entry point is exercised in the independent PDF tests and the browser worker.
if(typeof self!=='undefined')self.onmessage=event=>{
  try{self.postMessage(matchRequestResult(event.data));}catch(error){self.postMessage({error:error.message});}
};

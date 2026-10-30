import {findVectorMatches} from './vector-recognition.mjs';
import {inkImage,findSymbolMatches} from './matcher.mjs';
export function matchRequest({rgba,width,height,template,vectorPage}){
  if(vectorPage?.supported&&template.vector?.supported)return findVectorMatches(vectorPage,template.vector,{rotations:template.matchRotations===true});
  return findSymbolMatches(inkImage(new Uint8ClampedArray(rgba),width,height),template,{rotations:template.matchRotations===true,threshold:template.matchThreshold??(template.elementSubset?.95:.85)});
}
// Same entry point is exercised in the independent PDF tests and the browser worker.
if(typeof self!=='undefined')self.onmessage=event=>{
  try{self.postMessage({matches:matchRequest(event.data)});}catch(error){self.postMessage({error:error.message});}
};

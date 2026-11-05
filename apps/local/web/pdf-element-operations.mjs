// PDF.js 6.4.299's display optimizer rewrites text/images and folds path
// translations. Raw operator indexes therefore are NOT display indexes.
// In this pinned version it preserves constructPath order and paint kinds,
// including endPath clips. Bind them only after a complete successful render.
export function trackPdfPathIdentity(raw,OPS){
 if(!Array.isArray(raw?.fnArray)||!Array.isArray(raw.argsArray)||raw.fnArray.length!==raw.argsArray.length||raw.fnArray.length>1000000)throw Error('Invalid original path operator list');
 const paths=raw.fnArray.flatMap((op,id)=>op===OPS.constructPath?[{id,paint:raw.argsArray[id]?.[0]}]:[]),display=new Map(),original=new Map();let next=0,finished=false,lastIndex=-1;
 const observe=(index,list)=>{
  if(list.fnArray[index]!==OPS.constructPath)return true;
  const seen=display.get(index);if(seen){if(seen.paint!==list.argsArray[index]?.[0])throw Error('PDF display path identity changed');return true;}
  if(!Number.isSafeInteger(index)||index<0||index>1000000||index<=lastIndex||finished||next>=paths.length||list.argsArray[index]?.[0]!==paths[next].paint)throw Error('PDF raw and display path sequences differ');
  lastIndex=index;const path=paths[next++];display.set(index,path);original.set(path.id,index);return true;
 };
 return {observe,finish(){
  if(next!==paths.length)throw Error('Incomplete PDF display path identity');finished=true;
  return Object.freeze({displayId(id){if(!original.has(id))throw Error('Saved element is not an original PDF path');return original.get(id);},rawId(index,list){
   const path=display.get(index),isPath=list.fnArray[index]===OPS.constructPath;
   if(isPath!==!!path||path&&path.paint!==list.argsArray[index]?.[0])throw Error('PDF display path identity changed');return path?.id;
  }});
 }};
}
const identities=new WeakMap();
export function rememberPdfPathIdentity(page,identity){identities.set(page,identity);}
export function mappedSelectionFilter(selection,identity){
 const excluded=new Set(selection?.excluded||[]);for(const id of excluded)identity.displayId(id);
 return (index,list)=>!excluded.has(identity.rawId(index,list));
}
// Saved selection previews/raster fallbacks also need the same raw identity.
// This bounded original render collects mapping only; no user data is edited.
export async function preparePdfSelectionFilter({page,OPS,selection,createCanvas,cancelled=()=>false}){
 const check=()=>{if(cancelled())throw Error('Selection rendering cancelled');};check();
 if(!selection?.excluded?.length)return undefined;
 let identity=identities.get(page);
 if(!identity){
  const raw=await new Promise((resolve,reject)=>{
   let done=false;const finish=(error,value)=>{if(done)return;done=true;clearInterval(poll);clearTimeout(timer);error?reject(error):resolve(value);},poll=setInterval(()=>{try{check();}catch(error){finish(error);}},25),timer=setTimeout(()=>finish(Error('Selection operator loading timed out')),20000);
   Promise.resolve().then(()=>page.getOperatorList()).then(value=>{try{check();finish(null,value);}catch(error){finish(error);}},error=>finish(error));
  });check();const tracker=trackPdfPathIdentity(raw,OPS),unit=page.getViewport({scale:1,rotation:0}),scale=Math.min(.5,.99*Math.sqrt(1000000/(unit.width*unit.height))),viewport=page.getViewport({scale,rotation:0}),w=Math.ceil(viewport.width),h=Math.ceil(viewport.height);
  if(!Number.isFinite(scale)||scale<=0||w*h>1000000)throw Error('Drawing exceeds the element identity budget');
  const canvas=createCanvas(w,h);let timer,poll;
  try{const task=page.render({canvas,canvasContext:canvas.getContext('2d'),viewport,operationsFilter:tracker.observe});timer=setTimeout(()=>task.cancel(),20000);poll=setInterval(()=>{if(cancelled())task.cancel();},25);await task.promise;check();identity=tracker.finish();rememberPdfPathIdentity(page,identity);}
  finally{clearTimeout(timer);clearInterval(poll);canvas.width=canvas.height=0;}
 }
 check();return mappedSelectionFilter(selection,identity);
}

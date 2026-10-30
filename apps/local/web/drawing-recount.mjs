import {extractVectorPage,resolveVectorTextBounds} from './vector-recognition.mjs';
import {isVectorAlgorithm} from './matcher.mjs';
import {recognizeDrawing} from './recognize-drawing.mjs';
import {selectionFilter} from './pdf-elements.mjs';
import {MATCH_IMAGE_PIXELS,createTileBudget,renderMatchSelection,tiledMatchPage,searchMatchTiles} from './pdf-match-tiles.mjs';
export async function runDrawingRecount({state,target,pdfjs,run,progress}){
 const opened=new Map(),vectors=new Map(),vector=state.countExamples.some(e=>isVectorAlgorithm(e.example.algorithm)&&state.countItems.some(i=>i.id===e.item_id&&i.discipline_id===target.discipline_id)),check=()=>{if(run.cancelled)throw new Error('Recount cancelled; no results saved');};
 run.fallbacks=new Set();
 const tileBudget=createTileBudget();
 async function render(d,number,elements,sourceBounds){
  check();let entry=opened.get(d.id);if(!entry){const task=pdfjs.getDocument({url:`/api/drawings/${d.id}/source`,isEvalSupported:false,cMapUrl:'/vendor/cmaps/',cMapPacked:true,standardFontDataUrl:'/vendor/standard_fonts/',wasmUrl:'/vendor/wasm/'});entry={task,doc:null};opened.set(d.id,entry);run.task=task;entry.doc=await task.promise;}check();
  const page=await entry.doc.getPage(number),viewport=page.getViewport({scale:2,rotation:0}),width=Math.ceil(viewport.width),height=Math.ceil(viewport.height);
  if(width*height>MATCH_IMAGE_PIXELS){const options={page,viewport,createCanvas:(w,h)=>{const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;return canvas;},operationsFilter:elements?selectionFilter(elements):undefined,cancelled:()=>run.cancelled,onRender:task=>{run.cancel=()=>task.cancel();}};return sourceBounds?renderMatchSelection({...options,bounds:sourceBounds}):tiledMatchPage(options);}
  const key=d.id+':'+number;if(vector&&!vectors.has(key))vectors.set(key,extractVectorPage({operatorList:await page.getOperatorList(),OPS:pdfjs.OPS}));
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d',{willReadFrequently:true}),recordText=!elements&&vectors.get(key)?.pendingTextBounds===true,task=page.render({canvas,canvasContext:ctx,viewport,recordOperations:recordText,operationsFilter:elements?selectionFilter(elements):undefined});run.cancel=()=>task.cancel();await task.promise;check();
  if(recordText)vectors.set(key,resolveVectorTextBounds(vectors.get(key),{reader:page.recordedBBoxes,viewport,width,height}));
  const data=ctx.getImageData(0,0,width,height).data;page.cleanup();return {data,width,height,viewport,vectorPage:vectors.get(key)};
 }
 function searchRaster(raster,template){return new Promise((resolve,reject)=>{check();const worker=new Worker('/match-worker.mjs',{type:'module'});run.worker=worker;const finish=()=>{clearTimeout(timer);worker.terminate();run.worker=null;},timer=setTimeout(()=>{finish();reject(new Error('Page matching timed out'));},20000);run.cancel=()=>{finish();reject(new Error('Recount cancelled; no results saved'));};worker.onmessage=e=>{finish();if(e.data.fallbackReason)run.fallbacks.add(e.data.fallbackReason);e.data.error?reject(new Error(e.data.error)):resolve(e.data.matches);};worker.onerror=e=>{finish();reject(new Error(e.message||'Matching failed'));};worker.postMessage({rgba:raster.data.buffer,width:raster.width,height:raster.height,template,vectorPage:raster.vectorPage},[raster.data.buffer]);});}
 async function search(raster,template){if(!raster.tiled)return searchRaster(raster,template);run.fallbacks.add(raster.vectorPage.reason);return searchMatchTiles({raster,template,search:searchRaster,cancelled:()=>run.cancelled,budget:tileBudget,progress:(tile,count)=>progress?.(`Searching large drawing · tile ${tile}/${count}…`)});}
 try{return await recognizeDrawing({state,target,render,search,cancelled:()=>run.cancelled,progress});}
 finally{run.worker?.terminate();for(const {task} of opened.values())await task.destroy().catch(()=>{});run.cancel=null;run.task=null;}
}

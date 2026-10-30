import {extractVectorPage} from './vector-recognition.mjs';
import {recognizeDrawing} from './recognize-drawing.mjs';
import {selectionFilter} from './pdf-elements.mjs';
export async function runDrawingRecount({state,target,pdfjs,run,progress}){
 const opened=new Map(),vectors=new Map(),check=()=>{if(run.cancelled)throw new Error('Recount cancelled; no results saved');};
 async function render(d,number,elements){
  check();let entry=opened.get(d.id);if(!entry){const task=pdfjs.getDocument({url:`/api/drawings/${d.id}/source`,isEvalSupported:false,cMapUrl:'/vendor/cmaps/',cMapPacked:true,standardFontDataUrl:'/vendor/standard_fonts/',wasmUrl:'/vendor/wasm/'});entry={task,doc:null};opened.set(d.id,entry);run.task=task;entry.doc=await task.promise;}check();
  const page=await entry.doc.getPage(number),viewport=page.getViewport({scale:2,rotation:0}),width=Math.ceil(viewport.width),height=Math.ceil(viewport.height);if(width*height>4000000)throw new Error('Drawing exceeds the current matching resolution budget');
  const key=d.id+':'+number;if(!vectors.has(key))vectors.set(key,extractVectorPage({operatorList:await page.getOperatorList(),OPS:pdfjs.OPS}));
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d',{willReadFrequently:true}),task=page.render({canvasContext:ctx,viewport,operationsFilter:elements?selectionFilter(elements):undefined});run.cancel=()=>task.cancel();await task.promise;check();const data=ctx.getImageData(0,0,width,height).data;page.cleanup();return {data,width,height,viewport,vectorPage:vectors.get(key)};
 }
 function search(raster,template){return new Promise((resolve,reject)=>{check();const worker=new Worker('/match-worker.mjs',{type:'module'});run.worker=worker;const finish=()=>{clearTimeout(timer);worker.terminate();run.worker=null;},timer=setTimeout(()=>{finish();reject(new Error('Page matching timed out'));},20000);run.cancel=()=>{finish();reject(new Error('Recount cancelled; no results saved'));};worker.onmessage=e=>{finish();e.data.error?reject(new Error(e.data.error)):resolve(e.data.matches);};worker.onerror=e=>{finish();reject(new Error(e.message||'Matching failed'));};worker.postMessage({rgba:raster.data.buffer,width:raster.width,height:raster.height,template,vectorPage:raster.vectorPage},[raster.data.buffer]);});}
 try{return await recognizeDrawing({state,target,render,search,cancelled:()=>run.cancelled,progress});}
 finally{run.worker?.terminate();for(const {task} of opened.values())await task.destroy().catch(()=>{});run.cancel=null;run.task=null;}
}

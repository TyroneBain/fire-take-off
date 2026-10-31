// Same-page, read-only application runner. Saved definitions are inputs only.
// Browser source bytes come from the integrity-checked original-PDF endpoint.
import {renderMatchSelection} from './pdf-match-tiles.mjs';
import {inkImage,exampleImage} from './matcher.mjs';
import {validElementSelection} from './pdf-elements.mjs';
import {runVectorCandidateReview} from './vector-candidate-search.mjs';
export async function runSavedVectorReview({pdfjs,drawing,example,elements=example?.elements,sourceLayerScope=true,createCanvas,run={cancelled:false},progress=()=>{},sourceData,maxMilliseconds=180000}={}){
 if(!pdfjs||typeof pdfjs.getDocument!=='function'||!pdfjs.OPS||typeof pdfjs.version!=='string'||typeof createCanvas!=='function'||typeof progress!=='function'||!run||typeof run!=='object'||typeof sourceLayerScope!=='boolean'||!Number.isSafeInteger(maxMilliseconds)||maxMilliseconds<1||maxMilliseconds>180000)throw Error('Invalid saved vector review dependencies or limits');
 if(typeof drawing?.id!=='string'||!drawing.id||typeof drawing.digest!=='string'||!/^[a-f0-9]{64}$/.test(drawing.digest)||example?.drawing_id!==drawing.id||example.digest!==drawing.digest)throw Error('Saved selection source is missing or changed');
 if(!Number.isSafeInteger(example.page)||example.page<1||!Array.isArray(example.bounds)||example.bounds.length!==4||!example.bounds.every(Number.isFinite)||example.bounds[2]<=example.bounds[0]||example.bounds[3]<=example.bounds[1]||!validElementSelection(elements))throw Error('Review needs compatible original selection IDs, exclusions, page and bounds');
 if(sourceData!==undefined&&(!(sourceData instanceof Uint8Array)||!sourceData.length||sourceData.length>25*1024*1024))throw Error('Injected original PDF must be a nonempty byte array of at most 25 MiB');
 const saved={page:example.page,bounds:[...example.bounds],ids:[...elements.ids],excluded:[...elements.excluded]},documentSha256=drawing.digest,drawingId=drawing.id,bytes=sourceData?new Uint8Array(sourceData):null,started=performance.now(),deadline=started+maxMilliseconds,tasks=[],destroyed=new Map(),canvases=[],previousCancel=run.cancel,previousTask=run.task;
 let activeTask,activeRender,taskControl,report,cleanupFailure;
 const check=()=>{if(run.cancelled)throw Error('Saved vector review cancelled; no results published');if(performance.now()>=deadline)throw Error('Saved vector review timed out; no results published');if(cleanupFailure)throw Error('Original PDF cleanup failed: '+cleanupFailure.message);};
 const notify=p=>{check();progress(p);check();};
 const destroy=task=>{
  if(!destroyed.has(task))destroyed.set(task,new Promise(resolve=>{let done=false;const finish=error=>{if(done)return;done=true;clearTimeout(timer);if(error)cleanupFailure??=error;resolve();},timer=setTimeout(()=>finish(Error('Original PDF cleanup timed out')),Math.max(1,Math.min(5000,Math.ceil(deadline-performance.now()))));Promise.resolve().then(()=>task.destroy()).then(()=>finish(),error=>finish(error instanceof Error?error:Error(String(error))));}));
  return destroyed.get(task);
 };
 const cancel=()=>{run.cancelled=true;activeRender?.cancel();if(activeTask)void destroy(activeTask);};
 const awaitBounded=(promise,label,maxWait=20000)=>new Promise((resolve,reject)=>{let done=false;const finish=(error,value)=>{if(done)return;done=true;clearTimeout(timer);clearInterval(poll);error?reject(error):resolve(value);},poll=setInterval(()=>{try{check();}catch(error){finish(error);}},25),timer=setTimeout(()=>finish(Error(label+' timed out')),Math.max(1,Math.min(maxWait,Math.ceil(deadline-performance.now()))));Promise.resolve(promise).then(value=>{try{check();finish(null,value);}catch(error){finish(error);}},error=>finish(error));});
 const canvasFactory=(width,height)=>{check();const canvas=createCanvas(width,height);canvases.push(canvas);return canvas;};
 async function open(phase){
  notify({phase,completed:0,total:1});const options={isEvalSupported:false,cMapUrl:'/vendor/cmaps/',cMapPacked:true,standardFontDataUrl:'/vendor/standard_fonts/',wasmUrl:'/vendor/wasm/',...(bytes?{data:new Uint8Array(bytes)}:{url:`/api/drawings/${encodeURIComponent(drawingId)}/source`})},task=pdfjs.getDocument(options);tasks.push(task);activeTask=task;
  taskControl={destroy:()=>{run.cancelled=true;return destroy(task);}};run.task=taskControl;
  const doc=await awaitBounded(task.promise,'Original PDF opening');check();if(!Number.isSafeInteger(doc.numPages)||doc.numPages>200||saved.page>doc.numPages)throw Error('Original PDF page scope exceeds the review limit');notify({phase,completed:1,total:1});return{task,doc};
 }
 run.cancel=cancel;
 try{
  check();if(bytes){const digest=await awaitBounded(globalThis.crypto.subtle.digest('SHA-256',bytes),'Original PDF digest');if(Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('')!==documentSha256)throw Error('Injected source digest does not match saved selection');}
  const original=await open('source-open');let anchor;
  try{
   const page=await awaitBounded(original.doc.getPage(saved.page),'Original source page'),viewport=page.getViewport({scale:2,rotation:0});let timer,poll,image;
   notify({phase:'source-anchor',completed:0,total:1});
   try{image=await renderMatchSelection({page,viewport,bounds:saved.bounds,createCanvas:canvasFactory,cancelled:()=>{check();return false;},onRender:task=>{activeRender=task;const stop=()=>{try{check();}catch{task.cancel();}};poll=setInterval(stop,25);timer=setTimeout(stop,Math.max(1,Math.ceil(deadline-performance.now())));stop();}});}
   finally{clearTimeout(timer);clearInterval(poll);activeRender=null;}
   check();const a=image.viewport.convertToViewportPoint(saved.bounds[0],saved.bounds[3]),b=image.viewport.convertToViewportPoint(saved.bounds[2],saved.bounds[1]),base=exampleImage(inkImage(image.data,image.width,image.height),[...a,...b]);anchor=image.viewport.convertToPdfPoint(base.left+base.width/2,base.top+base.height/2);notify({phase:'source-anchor',completed:1,total:1});
  }finally{await destroy(original.task);activeTask=null;}
  check();const proof=await open('proof-open');let result;
  try{const page=await awaitBounded(proof.doc.getPage(saved.page),'Original proof page'),optionalContentConfig=await awaitBounded(proof.doc.getOptionalContentConfig({intent:'display'}),'Original layer configuration');check();
   result=await runVectorCandidateReview({page,OPS:pdfjs.OPS,optionalContentConfig,documentSha256,selection:{...saved,anchor},sourceLayerScope,createCanvas:canvasFactory,pdfjsVersion:pdfjs.version,cancelled:()=>{check();return false;},progress:notify,maxMilliseconds:Math.max(1,Math.min(120000,Math.floor(deadline-performance.now())))});check();if(!result.completed)throw Error(result.reason||'Saved vector review did not complete');
  }finally{await destroy(proof.task);activeTask=null;}
  check();report={result,savedNativeAnchor:[...anchor],documentSha256,drawingId,page:saved.page,sourceLayerScope,selection:{...saved,anchor:[...anchor]}};
 }finally{
  activeRender?.cancel();for(const task of tasks)await destroy(task);for(const canvas of canvases){try{canvas.width=canvas.height=0;}catch{}}
  if(run.cancel===cancel)run.cancel=previousCancel;if(run.task===taskControl)run.task=previousTask;
 }
 check();return report;
}

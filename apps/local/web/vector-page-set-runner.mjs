// Atomic, read-only review of an explicit set of original PDF pages. Browser
// bytes use the server's digest-attested source route; injected test bytes are
// independently hashed. No viewer document, saved matches or layer mutations.
import {renderMatchSelection} from './pdf-match-tiles.mjs';
import {inkImage,exampleImage} from './matcher.mjs';
import {validElementSelection} from './pdf-elements.mjs';
import {prepareVectorPattern,reviewVectorPatternPage,releaseVectorPattern} from './vector-pattern-review.mjs';

export async function runSavedVectorPageSetReview({pdfjs,sourceDrawing,example,elements=example?.elements,targets,layerPolicy='all-admitted',createCanvas,run={cancelled:false},progress=()=>{},sourceData,targetData,maxMilliseconds=300000}={}){
 const validDrawing=d=>typeof d?.id==='string'&&d.id.length>0&&typeof d.digest==='string'&&/^[a-f0-9]{64}$/.test(d.digest);
 if(!pdfjs||typeof pdfjs.getDocument!=='function'||!pdfjs.OPS||typeof pdfjs.version!=='string'||typeof createCanvas!=='function'||typeof progress!=='function'||!run||typeof run!=='object'||!['all-admitted','same-layer-name'].includes(layerPolicy)||!Number.isSafeInteger(maxMilliseconds)||maxMilliseconds<1||maxMilliseconds>300000)throw Error('Invalid page-set review dependencies or limits');
 if(!validDrawing(sourceDrawing)||example?.drawing_id!==sourceDrawing.id||example.digest!==sourceDrawing.digest)throw Error('Saved selection source is missing or changed');
 if(!Number.isSafeInteger(example.page)||example.page<1||example.page>200||!Array.isArray(example.bounds)||example.bounds.length!==4||!example.bounds.every(Number.isFinite)||example.bounds[2]<=example.bounds[0]||example.bounds[3]<=example.bounds[1]||!validElementSelection(elements))throw Error('Review needs compatible original selection IDs, exclusions, page and bounds');
 if(!Array.isArray(targets)||targets.length<1||targets.length>20)throw Error('Review requires 1 to 20 explicit target pages');
 const source={drawingId:sourceDrawing.id,digest:sourceDrawing.digest,page:example.page},selection={page:example.page,bounds:[...example.bounds],ids:[...elements.ids],excluded:[...elements.excluded]},drawings=new Map([[source.drawingId,source.digest]]),keys=new Set(),pages=targets.map(t=>{
  if(!validDrawing(t?.drawing)||!Number.isSafeInteger(t.page)||t.page<1||t.page>200)throw Error('Invalid original target drawing or page');
  const drawingId=t.drawing.id,digest=t.drawing.digest,key=JSON.stringify([drawingId,t.page]);if(keys.has(key))throw Error('Target pages must be unique');keys.add(key);
  if(drawings.has(drawingId)&&drawings.get(drawingId)!==digest)throw Error('Target drawing digest conflicts with source identity');drawings.set(drawingId,digest);return {drawingId,digest,page:t.page};
 });
 if(!keys.has(JSON.stringify([source.drawingId,source.page])))throw Error('Target pages must include the original source page');
 if(targetData!==undefined&&!(targetData instanceof Map))throw Error('Injected target data must be a drawing-ID Map');
 const bytesByDrawing=new Map();
 const cloneBytes=(id,bytes)=>{
  if(!drawings.has(id)||!(bytes instanceof Uint8Array)||!bytes.length||bytes.length>25*1024*1024)throw Error('Injected original PDFs need known drawing IDs and 1 byte to 25 MiB per document');
  const prior=bytesByDrawing.get(id);if(prior&&(prior.length!==bytes.length||prior.some((b,i)=>b!==bytes[i])))throw Error('Conflicting injected bytes for the same original drawing');
  if(!prior)bytesByDrawing.set(id,new Uint8Array(bytes));
 };
 if(targetData)for(const [id,bytes]of targetData)cloneBytes(id,bytes);
 if(sourceData!==undefined)cloneBytes(source.drawingId,sourceData);
 const getDocument=pdfjs.getDocument.bind(pdfjs),OPS={...pdfjs.OPS},pdfjsVersion=pdfjs.version,deadline=performance.now()+maxMilliseconds,tasks=[],destroyed=new Map(),canvases=[],previousCancel=run.cancel,previousTask=run.task,totals={proposals:0,verifiedElementIds:0,auditWork:0};
 let activeTask,activeRender,taskControl,pattern,report,cleanupFailure;
 const check=()=>{if(run.cancelled)throw Error('Page-set review cancelled; no results published');if(performance.now()>=deadline)throw Error('Page-set review timed out; no results published');if(cleanupFailure)throw Error('Original PDF cleanup failed: '+cleanupFailure.message);};
 const notify=p=>{check();progress(p);check();};
 const remaining=()=>{check();return Math.max(1,Math.min(120000,Math.floor(deadline-performance.now())));};
 const destroy=task=>{
  if(!destroyed.has(task))destroyed.set(task,new Promise(resolve=>{let done=false;const finish=error=>{if(done)return;done=true;clearTimeout(timer);if(error)cleanupFailure??=error;resolve();},timer=setTimeout(()=>finish(Error('Original PDF cleanup timed out')),Math.max(1,Math.min(5000,Math.ceil(deadline-performance.now()))));Promise.resolve().then(()=>task.destroy()).then(()=>finish(),error=>finish(error instanceof Error?error:Error(String(error))));}));
  return destroyed.get(task);
 };
 const cancel=()=>{run.cancelled=true;activeRender?.cancel();if(activeTask)void destroy(activeTask);};
 const awaitBounded=(promise,label,maxWait=20000)=>new Promise((resolve,reject)=>{let done=false;const finish=(error,value)=>{if(done)return;done=true;clearTimeout(timer);clearInterval(poll);error?reject(error):resolve(value);},poll=setInterval(()=>{try{check();}catch(error){finish(error);}},25),timer=setTimeout(()=>finish(Error(label+' timed out')),Math.max(1,Math.min(maxWait,Math.ceil(deadline-performance.now()))));Promise.resolve(promise).then(value=>{try{check();finish(null,value);}catch(error){finish(error);}},error=>finish(error));});
 const canvasFactory=(width,height)=>{check();const canvas=createCanvas(width,height);canvases.push(canvas);return canvas;};
 const stageProgress=(stage,identity,pageIndex)=>p=>notify({stage,drawingId:identity.drawingId,page:identity.page,pageIndex,pageTotal:pages.length,phase:p.phase,completed:p.completed,total:p.total});
 async function open(identity,phase,pageIndex){
  const update=stageProgress(phase,identity,pageIndex);update({phase,completed:0,total:1});const bytes=bytesByDrawing.get(identity.drawingId),task=getDocument({isEvalSupported:false,cMapUrl:'/vendor/cmaps/',cMapPacked:true,standardFontDataUrl:'/vendor/standard_fonts/',wasmUrl:'/vendor/wasm/',...(bytes?{data:new Uint8Array(bytes)}:{url:`/api/drawings/${encodeURIComponent(identity.drawingId)}/source`})});tasks.push(task);activeTask=task;
  taskControl={destroy:()=>{run.cancelled=true;return destroy(task);}};run.task=taskControl;
  const doc=await awaitBounded(task.promise,'Original PDF opening');if(!Number.isSafeInteger(doc.numPages)||doc.numPages<1||doc.numPages>200||identity.page>doc.numPages)throw Error('Original PDF page scope exceeds the review limit');update({phase,completed:1,total:1});return {task,doc};
 }
 const chargeAudit=value=>{if(!Number.isSafeInteger(value)||value<0)throw Error('Pattern review did not report bounded operator audit work');totals.auditWork+=value;if(totals.auditWork>250000000)throw Error('Page-set operator audit work budget exceeded');};
 run.cancel=cancel;
 try{
  check();for(const [id,bytes]of bytesByDrawing){const digest=await awaitBounded(globalThis.crypto.subtle.digest('SHA-256',bytes),'Original PDF digest');if(Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('')!==drawings.get(id))throw Error('Injected original digest does not match the saved drawing');}
  const original=await open(source,'source-open',0);let anchor;
  try{
   const page=await awaitBounded(original.doc.getPage(source.page),'Original source page'),viewport=page.getViewport({scale:2,rotation:0}),update=stageProgress('source-anchor',source,0);let timer,poll,image;update({phase:'source-anchor',completed:0,total:1});
   try{image=await renderMatchSelection({page,viewport,bounds:selection.bounds,createCanvas:canvasFactory,cancelled:()=>{check();return false;},onRender:task=>{activeRender=task;const stop=()=>{try{check();}catch{task.cancel();}};poll=setInterval(stop,25);timer=setTimeout(stop,Math.max(1,Math.ceil(deadline-performance.now())));stop();}});}
   finally{clearTimeout(timer);clearInterval(poll);activeRender=null;}
   check();const a=image.viewport.convertToViewportPoint(selection.bounds[0],selection.bounds[3]),b=image.viewport.convertToViewportPoint(selection.bounds[2],selection.bounds[1]),base=exampleImage(inkImage(image.data,image.width,image.height),[...a,...b]);anchor=image.viewport.convertToPdfPoint(base.left+base.width/2,base.top+base.height/2);update({phase:'source-anchor',completed:1,total:1});
  }finally{await destroy(original.task);activeTask=null;}
  check();const sourceProof=await open(source,'pattern-open',0);
  try{
   const page=await awaitBounded(sourceProof.doc.getPage(source.page),'Original source proof page'),optionalContentConfig=await awaitBounded(sourceProof.doc.getOptionalContentConfig({intent:'display'}),'Original source layer configuration');
   const prepared=await prepareVectorPattern({page,OPS,optionalContentConfig,documentSha256:source.digest,selection:{...selection,anchor:[...anchor]},layerPolicy,createCanvas:canvasFactory,pdfjsVersion,cancelled:()=>{check();return false;},progress:stageProgress('source-pattern',source,0),maxMilliseconds:remaining()});
   pattern=prepared?.pattern;check();if(!prepared?.completed||!pattern)throw Error(prepared?.reason||'Original source pattern did not complete');chargeAudit(prepared.auditWork);
  }finally{await destroy(sourceProof.task);activeTask=null;}
  const reviewed=[];
  for(let i=0;i<pages.length;i++){
   check();const identity=pages[i],target=await open(identity,'target-open',i+1);let result;
   try{
    const page=await awaitBounded(target.doc.getPage(identity.page),'Original target page'),optionalContentConfig=await awaitBounded(target.doc.getOptionalContentConfig({intent:'display'}),'Original target layer configuration'),auditRemaining=250000000-totals.auditWork;
    if(auditRemaining<=0)throw Error('Page-set operator audit work budget exceeded');
    result=await reviewVectorPatternPage({pattern,page,OPS,optionalContentConfig,documentSha256:identity.digest,createCanvas:canvasFactory,pdfjsVersion,cancelled:()=>{check();return false;},progress:stageProgress('target-page',identity,i+1),maxMilliseconds:remaining(),maxAuditWork:Math.min(50000000,auditRemaining)});check();
    if(!result?.completed)throw Error(result?.reason||'Original target page review did not complete');
    if(result.binding?.documentSha256!==identity.digest||result.binding?.pageNumber!==identity.page||!Array.isArray(result.proposals)||result.proposals.length>512)throw Error('Target review identity or per-page result budget changed');
    chargeAudit(result.auditWork);totals.proposals+=result.proposals.length;
    for(const proposal of result.proposals)if(proposal.visibility?.verified===true){if(!Array.isArray(proposal.elementIds))throw Error('Verified original paint identities are missing');totals.verifiedElementIds+=proposal.elementIds.length;}
    if(totals.proposals>2048||totals.verifiedElementIds>50000)throw Error('Page-set proposal or verified-element budget exceeded');
   }finally{await destroy(target.task);activeTask=null;}
   check();reviewed.push({...identity,result});
  }
  check();report={completed:true,requiresSemanticReview:true,source:{...source,anchor:[...anchor]},selection:{...selection,anchor:[...anchor]},layerPolicy,pages:reviewed,totals:{...totals}};
  notify({stage:'complete',phase:'complete',completed:pages.length,total:pages.length,pageTotal:pages.length});
 }finally{
  activeRender?.cancel();for(const task of tasks)await destroy(task);
  if(pattern)try{releaseVectorPattern(pattern);}catch(error){cleanupFailure??=error instanceof Error?error:Error(String(error));}
  for(const canvas of canvases){try{canvas.width=canvas.height=0;}catch{}}
  if(run.cancel===cancel)run.cancel=previousCancel;if(run.task===taskControl)run.task=previousTask;
 }
 check();return report;
}

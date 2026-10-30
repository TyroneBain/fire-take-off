import {performance} from 'node:perf_hooks';
import {getDocument,OPS} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {prepareQa,rasterQa,scoreInstances,writeQaReport} from './vector-qa-benchmark.mjs';
import {extractVectorPage,createVectorTemplate} from '../apps/local/web/vector-recognition.mjs';
import {matchRequest} from '../apps/local/web/match-worker.mjs';

// The independent QA agent authored the fixture and oracle. The lead completed
// this runner after the QA agent hit its usage limit; independent sign-off is pending.
export async function benchmarkVectorPreview({scales=false}={}){
 const q=await prepareQa(),task=getDocument({data:new Uint8Array(q.fixture.bytes),isEvalSupported:false});
 try{
  const doc=await task.promise,pages=[];
  for(let page=1;page<=doc.numPages;page++)pages.push(extractVectorPage({operatorList:await(await doc.getPage(page)).getOperatorList(),OPS}));
  const source=q.pages[0],anchor=source.viewport.convertToPdfPoint(q.model.box[0]+q.template.left+q.template.anchorX,q.model.box[1]+q.template.top+q.template.anchorY);
  const vector=createVectorTemplate(pages[0],{bounds:q.fixture.manifest.selection,...q.elements,anchor});
  if(!vector.supported)throw Error(vector.reason);
  const template={...q.template,vector,matchRotations:true,matchScales:scales,matchThreshold:.95},hits=[],timings=[];
  for(const [i,r] of q.pages.entries()){
   const start=performance.now(),found=matchRequest({rgba:r.data,width:r.width,height:r.height,template,vectorPage:pages[i]});
   timings.push({page:i+1,matchingMs:performance.now()-start,engine:pages[i].supported?'vector':'raster',fallback:pages[i].reason||null});
   for(const h of found){const [x,y]=Number.isFinite(h.x)?[h.x,h.y]:r.viewport.convertToPdfPoint(h.left+(h.anchorX??template.anchorX),h.top+(h.anchorY??template.anchorY));hits.push({page:i+1,x,y});}
  }
  return {date:new Date().toISOString(),runtime:process.version,platform:process.platform,architecture:process.arch,fixture:q.fixture.manifest,validation:'Independent QA-authored labels; runner completed and executed by lead. Independent QA sign-off blocked by agent usage limit.',baseline:await rasterQa(q),candidate:{...scoreInstances(hits,q.fixture.manifest.labels),perPage:q.pages.map((_,i)=>({page:i+1,...scoreInstances(hits.filter(h=>h.page===i+1),q.fixture.manifest.labels.filter(s=>s.page===i+1))})),hits,timings},limitations:['Synthetic only; no representative real drawing or Countfire comparison','Single-run timings exclude parsing/rendering and are not p50/p95 or estimator task times',scales?'Arbitrary-angle and raster-only positives remain misses':'Scaled and arbitrary-angle positives remain misses','Nested forms/clipping/image-only pages use raster fallback','The mirror-labelled distractor is geometrically equal to a rotated seed; raw label score retained pending independent oracle adjudication']};
 }finally{await task.destroy();await q.task.destroy();}
}
if(process.argv[1]?.endsWith('run-vector-preview-benchmark.mjs')){const report=await benchmarkVectorPreview();await writeQaReport(report,'docs/evidence/vector-preview-2026-10-30.json');console.log(JSON.stringify({baseline:report.baseline.raster_quarter_turns,candidate:report.candidate,validation:report.validation}));}

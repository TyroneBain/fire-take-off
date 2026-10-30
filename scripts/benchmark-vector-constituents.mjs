import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {getDocument,OPS} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {createCanvas} from '@napi-rs/canvas';
import {constituentQaFixture} from './vector-constituents-qa-fixture.mjs';
import {scoreInstances} from './vector-qa-benchmark.mjs';
import {extractVectorPage,createVectorTemplate,findVectorMatches} from '../apps/local/web/vector-recognition.mjs';
import {createConstituentTemplate,findConstituentMatches,CONSTITUENT_KERNEL_VERSION} from '../apps/local/web/vector-constituents.mjs';

// An executable recognition investigation, deliberately separate from saved
// count policies. Geometry candidates are never written to a project store.
const intersects=(a,b)=>a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1];
const equalBounds=(a,b)=>a.every((n,i)=>Math.abs(n-b[i])<1e-6);
const sha=data=>createHash('sha256').update(data).digest('hex');
async function crop(page,bounds,scale=4){
 const viewport=page.getViewport({scale,rotation:0}),a=viewport.convertToViewportPoint(bounds[0],bounds[3]),b=viewport.convertToViewportPoint(bounds[2],bounds[1]);
 const left=Math.floor(Math.min(a[0],b[0])),top=Math.floor(Math.min(a[1],b[1])),width=Math.ceil(Math.max(a[0],b[0]))-left,height=Math.ceil(Math.max(a[1],b[1]))-top;
 if(width*height>262144)throw Error('Benchmark crop exceeds budget');
 const canvas=createCanvas(width,height),ctx=canvas.getContext('2d');
 try{await page.render({canvas,canvasContext:ctx,viewport,transform:[1,0,0,1,-left,-top]}).promise;return {width,height,data:ctx.getImageData(0,0,width,height).data};}
 finally{canvas.width=canvas.height=0;}
}
export async function benchmarkConstituents(){
 const fixture=constituentQaFixture(),task=getDocument({data:new Uint8Array(fixture.bytes),isEvalSupported:false});
 const started=performance.now(),timings=[],unsupported=[],baseline=[],candidate=[];
 try{
  const doc=await task.promise,pages=[];
  for(let n=1;n<=doc.numPages;n++){const page=await doc.getPage(n),start=performance.now(),geometry=extractVectorPage({operatorList:await page.getOperatorList(),OPS});pages.push({page,geometry});timings.push({page:n,extractMs:performance.now()-start});}
  const source=pages[fixture.manifest.sourcePage-1].geometry;if(!source.supported)throw Error(source.reason);
  const ids=source.elements.filter(e=>intersects(e.bounds,fixture.manifest.selection)).map(e=>e.id),excluded=fixture.manifest.excludedNativeBounds.map(b=>{const matches=source.elements.filter(e=>equalBounds(e.bounds,b));if(matches.length!==1)throw Error('Declared source exclusion must identify exactly one operation');return matches[0].id;});
  const options={bounds:fixture.manifest.selection,anchor:fixture.manifest.anchor,ids,excluded},oldTemplate=createVectorTemplate(source,options),template=createConstituentTemplate(source,options);
  if(!oldTemplate.supported||!template.supported)throw Error(oldTemplate.reason||template.reason);
  for(const n of [...new Set(fixture.manifest.labels.map(l=>l.page))]){
   const {geometry}=pages[n-1];if(!geometry.supported){unsupported.push({page:n,reason:geometry.reason,positiveLabels:fixture.manifest.labels.filter(l=>l.page===n).map(l=>l.id)});continue;}
   let start=performance.now();baseline.push(...findVectorMatches(geometry,oldTemplate).map(h=>({...h,page:n})));timings[n-1].baselineMs=performance.now()-start;
   start=performance.now();const proposals=findConstituentMatches(geometry,template);timings[n-1].candidateMs=performance.now()-start;
   if(proposals.some(h=>h.requiresRenderVerification!==true||h.wholeOperations!==true))throw Error('Unverified proposal contract missing');
   candidate.push(...proposals.map(h=>({...h,page:n})));
  }
  const control=fixture.manifest.capJoinControl,{geometry,page}=pages[control.page-1],capTemplate=createConstituentTemplate(geometry,{bounds:control.selection,anchor:control.anchor}),capProposals=findConstituentMatches(geometry,capTemplate),reference=await crop(page,control.selection),offset=[control.negative[0]-control.positive[0],control.negative[1]-control.positive[1]],other=await crop(page,control.selection.map((v,i)=>v+offset[i%2]));
  if(reference.width!==other.width||reference.height!==other.height)throw Error('Cap control crop sizes differ');
  let changedPixels=0;for(let i=0;i<reference.data.length;i+=4)if(reference.data.subarray(i,i+4).some((v,j)=>v!==other.data[i+j]))changedPixels++;
  const sourcePaths=['apps/local/web/vector-constituents.mjs','apps/local/web/vector-recognition.mjs','scripts/vector-constituents-qa-fixture.mjs','scripts/benchmark-vector-constituents.mjs'];
  return {date:new Date().toISOString(),runtime:process.version,kernel:CONSTITUENT_KERNEL_VERSION,fixture:fixture.manifest,sourceSha256:Object.fromEntries(await Promise.all(sourcePaths.map(async p=>[p,sha(await readFile(p))]))),sourceSelection:{...options},baseline:{...scoreInstances(baseline,fixture.manifest.labels),hits:baseline},candidate:{...scoreInstances(candidate,fixture.manifest.labels),hits:candidate,status:'Unverified geometric proposals, not accepted app counts'},unsupported,timings,capJoinControl:{geometricProposals:capProposals.map(h=>[h.x,h.y]),changedPixels,renderScale:4,verdict:changedPixels?'Physical ink differs: render verification is required':'No measured pixel difference; inspect fixture'},elapsedMs:performance.now()-started,limitations:['Original synthetic PDFs only; no Countfire or real-drawing accuracy claim','Unsupported positive labels stay in overall recall; no fallback raster scan is included in this geometry benchmark','No saved policies, marks, corrections, zones or exports are modified','Single-run Node timing, not browser performance or estimator task time']};
 }finally{await task.destroy();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const args=process.argv.slice(2);if(args.length&&!(args.length===2&&args[0]==='--output'))throw Error('Usage: node scripts/benchmark-vector-constituents.mjs [--output report.json]');
 const report=await benchmarkConstituents();if(args.length)await writeFile(args[1],JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({baseline:{tp:report.baseline.tp,fp:report.baseline.fp,fn:report.baseline.fn},candidate:{tp:report.candidate.tp,fp:report.candidate.fp,fn:report.candidate.fn,status:report.candidate.status},unsupported:report.unsupported,capJoinControl:report.capJoinControl,timings:report.timings,elapsedMs:report.elapsedMs},null,2));
}

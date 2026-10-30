import {performance} from 'node:perf_hooks';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {getDocument,OPS} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {createCanvas} from '@napi-rs/canvas';
import {vectorQaFixture} from './vector-qa-fixture.mjs';
import {inkImage,findMatches,findSymbolMatches} from '../apps/local/web/matcher.mjs';
import {inspectPdfElements,editedTemplate,ELEMENT_RENDERER} from '../apps/local/web/pdf-elements.mjs';

export function scoreInstances(hits,labels){
 const remaining=new Map(labels.map(s=>[s.id,s])),matched=[],falsePositives=[];let duplicates=0;
 for(const hit of hits){const nearest=[...remaining.values()].filter(s=>s.page===hit.page).map(s=>({s,d:Math.hypot(s.x-hit.x,s.y-hit.y)})).sort((a,b)=>a.d-b.d)[0];
  if(nearest&&nearest.d<=1){matched.push(nearest.s.id);remaining.delete(nearest.s.id);}
  else {falsePositives.push(hit);if(labels.some(s=>s.page===hit.page&&Math.hypot(s.x-hit.x,s.y-hit.y)<=1))duplicates++;}
 }
 const tp=matched.length,fp=falsePositives.length,fn=remaining.size;return {tp,fp,fn,precision:tp+fp?tp/(tp+fp):null,recall:tp+fn?tp/(tp+fn):null,duplicates,matched,missed:[...remaining.keys()],falsePositives};
}

export async function prepareQa(){
 const fixture=await vectorQaFixture(),task=getDocument({data:new Uint8Array(fixture.bytes),isEvalSupported:false}),doc=await task.promise,pages=[];
 for(let i=1;i<=doc.numPages;i++){const page=await doc.getPage(i),viewport=page.getViewport({scale:2,rotation:0}),canvas=createCanvas(viewport.width,viewport.height),ctx=canvas.getContext('2d');await page.render({canvas,canvasContext:ctx,viewport}).promise;const data=ctx.getImageData(0,0,canvas.width,canvas.height).data;pages.push({page,viewport,data,width:canvas.width,height:canvas.height,image:inkImage(data,canvas.width,canvas.height)});}
 const model=await inspectPdfElements({page:pages[0].page,OPS,bounds:fixture.manifest.selection,createCanvas}),original=await model.render(),filtered=await model.render([13]),template=editedTemplate(inkImage(original.data,model.width,model.height),inkImage(filtered.data,model.width,model.height),[0,0,model.width,model.height]);
 return {fixture,task,pages,model,template,elements:{renderer:ELEMENT_RENDERER,ids:[5,6,7,13],excluded:[13]}};
}

export async function rasterQa(prepared){
 const {pages,template,fixture}=prepared,results={};
 for(const [name,run] of [['legacy_same_orientation',r=>findMatches(r.image,template,{threshold:.95})],['raster_quarter_turns',r=>findSymbolMatches(r.image,template,{threshold:.95,rotations:true})]]){
  const hits=[],timings=[];for(const [i,r] of pages.entries()){const start=performance.now(),found=run(r);timings.push({page:i+1,matchingMs:performance.now()-start});for(const h of found){const[x,y]=r.viewport.convertToPdfPoint(h.left+(h.anchorX??template.anchorX??h.width/2),h.top+(h.anchorY??template.anchorY??h.height/2));hits.push({page:i+1,x,y});}}
  results[name]={...scoreInstances(hits,fixture.manifest.labels),perPage:pages.map((_,i)=>({page:i+1,...scoreInstances(hits.filter(h=>h.page===i+1),fixture.manifest.labels.filter(s=>s.page===i+1))})),timings,hits};
 }
 return results;
}

export async function writeQaReport(report,path='docs/evidence/vector-qa-2026-10-30.json'){
 const sources=['scripts/vector-qa-fixture.mjs','scripts/vector-qa-benchmark.mjs','apps/local/web/matcher.mjs'];
 report.sourceSha256=Object.fromEntries(await Promise.all(sources.map(async p=>[p,createHash('sha256').update(await readFile(p)).digest('hex')])));
 await writeFile(path,JSON.stringify(report,null,2)+'\n');
}

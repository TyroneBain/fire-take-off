import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {getDocument,OPS,version} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {createCanvas} from '@napi-rs/canvas';
import {ELEMENT_RENDERER} from '../apps/local/web/pdf-elements.mjs';
import {inkImage,exampleImage} from '../apps/local/web/matcher.mjs';
import {runSavedVectorReview} from '../apps/local/web/vector-review-runner.mjs';
function originalPdf(){
 const glyph=(x,red=false)=>`/OC /Symbols BDC q 1 0 0 1 ${x} 40 cm 0 G 0 g 1 w -4 -4 8 8 re S ${red?'1 0 0 rg':''} -1 -1 2 2 re f Q EMC`;
 const content=[glyph(40),'/OC /Symbols BDC 1 w 40 44 m 40 70 l S EMC',glyph(100),glyph(160,true)].join('\n'),objects=['<< /Type /Catalog /Pages 2 0 R /OCProperties << /OCGs [5 0 R] /D << /ON [5 0 R] >> >> >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 100] /Resources << /Properties << /Symbols 5 0 R >> >> /Contents 4 0 R >>',`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,'<< /Type /OCG /Name (Original runner symbols) >>'];let pdf='%PDF-1.7\n',offsets=[0];for(const[i,o]of objects.entries()){offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${o}\nendobj\n`;}const xref=Buffer.byteLength(pdf);pdf+=`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(v=>`${String(v).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;return new Uint8Array(Buffer.from(pdf));
}
async function fixture(){
 const bytes=originalPdf(),digest=createHash('sha256').update(bytes).digest('hex'),task=getDocument({data:new Uint8Array(bytes),isEvalSupported:false});let ids,oracle;
 try{const doc=await task.promise,page=await doc.getPage(1),ops=await page.getOperatorList();ids=ops.fnArray.flatMap((op,id)=>op===OPS.constructPath?[id]:[]).slice(0,3);const viewport=page.getViewport({scale:2,rotation:0}),canvas=createCanvas(viewport.width,viewport.height),ctx=canvas.getContext('2d',{willReadFrequently:true});try{await page.render({canvas,canvasContext:ctx,viewport}).promise;const bounds=[30,30,50,50],box=[...viewport.convertToViewportPoint(bounds[0],bounds[3]),...viewport.convertToViewportPoint(bounds[2],bounds[1])],base=exampleImage(inkImage(ctx.getImageData(0,0,canvas.width,canvas.height).data,canvas.width,canvas.height),box);oracle=viewport.convertToPdfPoint(base.left+base.width/2,base.top+base.height/2);}finally{canvas.width=canvas.height=0;}}
 finally{await task.destroy();}
 const drawing={id:'owned-drawing',digest,pages:[{}]},example={drawing_id:drawing.id,digest,page:1,bounds:[30,30,50,50],algorithm:'vector-elements-1',anchor:[9999,9999],elements:{renderer:ELEMENT_RENDERER,ids,excluded:[]}},elements={...example.elements,excluded:[ids[2]]},events=[],canvases=[],run={cancelled:false};let serial=0;
 const pdfjs={OPS,version,getDocument(options){const index=serial++;events.push({kind:'open',index,options});const task=getDocument({...options,...options.data?{}:{data:new Uint8Array(bytes),url:undefined}});return{promise:task.promise.then(doc=>({numPages:doc.numPages,getOptionalContentConfig:options=>doc.getOptionalContentConfig(options),getPage:async number=>{const page=await doc.getPage(number);return{pageNumber:number,getOperatorList:()=>{events.push({kind:'operators',index});return page.getOperatorList();},getViewport:options=>page.getViewport(options),render:options=>{events.push({kind:'render',index});assert.equal(options.operationsFilter,undefined);return page.render(options);}};}})),destroy:async()=>{await task.destroy();events.push({kind:'destroy',index});}};}};
 return{bytes,oracle,events,canvases,run,args:{pdfjs,drawing,example,elements,sourceData:bytes,sourceLayerScope:true,run,createCanvas:(w,h)=>{const canvas=createCanvas(w,h);canvases.push(canvas);return canvas;}}};
}
test('saved runner uses edited IDs and exact unfiltered app anchor on separate source and proof tasks',async()=>{
 const{args,oracle,events,canvases,bytes}=await fixture(),before=structuredClone({drawing:args.drawing,example:args.example,elements:args.elements}),originalBytes=new Uint8Array(bytes),report=await runSavedVectorReview(args);
 assert.equal(report.result.completed,true);assert.deepEqual(report.savedNativeAnchor,oracle);assert.notDeepEqual(oracle,[40,40],'unfiltered source pipe deliberately offsets the application anchor');assert.deepEqual(report.selection.ids,args.elements.ids);assert.deepEqual(report.selection.excluded,args.elements.excluded);assert.deepEqual(report.result.proposals.map(p=>p.elementIds.length),[2,2]);assert.ok(report.result.proposals.every(p=>p.visibility.verified));assert.equal(report.result.proposals[0].x,oracle[0]);assert.equal(report.result.proposals[1].x,oracle[0]+60);assert.ok(events.findIndex(e=>e.kind==='destroy'&&e.index===0)<events.findIndex(e=>e.kind==='open'&&e.index===1));assert.deepEqual(events.filter(e=>e.kind==='destroy').map(e=>e.index),[0,1]);assert.ok(canvases.every(c=>c.width===0&&c.height===0));assert.deepEqual({drawing:args.drawing,example:args.example,elements:args.elements},before);assert.deepEqual(bytes,originalBytes);assert.equal(JSON.stringify(report).includes('"score"'),false);assert.equal(args.run.cancel,undefined);assert.equal(args.run.task,undefined);
});
test('browser source route remains original and byte injection must match the saved digest',async()=>{
 const f=await fixture(),report=await runSavedVectorReview({...f.args,sourceData:undefined});assert.equal(report.result.completed,true);assert.deepEqual(f.events.filter(e=>e.kind==='open').map(e=>e.options.url),['/api/drawings/owned-drawing/source','/api/drawings/owned-drawing/source']);
 const bad=await fixture(),bytes=new Uint8Array(bad.bytes);bytes[0]^=1;await assert.rejects(runSavedVectorReview({...bad.args,sourceData:bytes}),/digest/);assert.equal(bad.events.length,0);
 await assert.rejects(runSavedVectorReview({...bad.args,elements:{...bad.args.elements,renderer:'unknown'}}),/compatible/);await assert.rejects(runSavedVectorReview({...bad.args,example:{...bad.args.example,digest:'0'.repeat(64)}}),/changed/);
});
test('runner cancellation at source, proof and final publication boundaries releases both tasks and canvases',async()=>{
 for(const phase of ['source-anchor','proof-open','complete']){const f=await fixture();await assert.rejects(runSavedVectorReview({...f.args,progress:p=>{if(p.phase===phase)f.run.cancel();}}),/cancel/i);assert.equal(f.events.filter(e=>e.kind==='destroy').length,f.events.filter(e=>e.kind==='open').length);assert.ok(f.canvases.every(c=>c.width===0&&c.height===0));assert.equal(f.run.cancel,undefined);assert.equal(f.run.task,undefined);}
});
test('stalled PDF opening is bounded and cancel destroys the owned loading task once',async()=>{
 const f=await fixture();let destroyed=0;const stalled={OPS,version,getDocument:()=>({promise:new Promise(()=>{}),destroy:async()=>{destroyed++;}})};
 await assert.rejects(runSavedVectorReview({...f.args,pdfjs:stalled,maxMilliseconds:30}),/timed out/);assert.equal(destroyed,1);assert.equal(f.run.task,undefined);
 const g=await fixture();destroyed=0;const cancelLoad={OPS,version,getDocument:()=>{setTimeout(()=>g.run.cancel(),5);return{promise:new Promise(()=>{}),destroy:async()=>{destroyed++;}};}};await assert.rejects(runSavedVectorReview({...g.args,pdfjs:cancelLoad}),/cancel/i);assert.equal(destroyed,1);
});
test('source cleanup failure cannot publish a review or start the proof document',async()=>{
 const f=await fixture(),original=f.args.pdfjs.getDocument,pdfjs={...f.args.pdfjs,getDocument:options=>{const task=original(options);return{...task,destroy:async()=>{await task.destroy();throw Error('Owned teardown failure');}};}};
 await assert.rejects(runSavedVectorReview({...f.args,pdfjs}),/cleanup failed/);assert.equal(f.events.filter(e=>e.kind==='open').length,1);assert.ok(f.canvases.every(c=>c.width===0&&c.height===0));assert.equal(f.run.task,undefined);
});

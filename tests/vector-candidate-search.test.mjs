import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createCanvas} from '@napi-rs/canvas';
import {getDocument,OPS,version as pdfjsVersion} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {runVectorCandidateReview} from '../apps/local/web/vector-candidate-search.mjs';
function originalPdf({targetWhite=false,sourceWhite=false,nonPath=false}={}){
 const glyph=(x,red=false)=>`/OC /Symbols BDC q 1 0 0 1 ${x} 20 cm 1 w 0 G -4 -4 8 8 re S ${red?'1 0 0 RG':''} -1 -1 2 2 re S Q EMC`;
 const content=[glyph(20),'/OC /Background BDC .5 w 20 24 m 20 36 l S .4 G .2 w 48 22 m 52 22 l S EMC',glyph(50),glyph(80,true),targetWhite?'1 g 48 18 4 4 re f':'',sourceWhite?'1 g 18 18 4 4 re f':'',nonPath?'BT /F1 3 Tf 100 45 Td (A) Tj ET q 1 0 0 1 100 40 cm BI /W 1 /H 1 /CS /RGB /BPC 8 /F /AHx ID 000000> EI Q':''].join('\n');
 const objects=['<< /Type /Catalog /Pages 2 0 R /OCProperties << /OCGs [5 0 R 6 0 R] /D << /ON [5 0 R 6 0 R] >> >> >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 110 50] /Resources << /Font << /F1 7 0 R >> /Properties << /Symbols 5 0 R /Background 6 0 R >> >> /Contents 4 0 R >>',`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,'<< /Type /OCG /Name (Original symbol controls) >>','<< /Type /OCG /Name (Original background controls) >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];let pdf='%PDF-1.7\n';const offsets=[0];for(const[i,o]of objects.entries()){offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${o}\nendobj\n`;}const xref=Buffer.byteLength(pdf);pdf+=`xref\n0 8\n0000000000 65535 f \n${offsets.slice(1).map(n=>`${String(n).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size 8 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;return new Uint8Array(Buffer.from(pdf));
}
async function corpus(t,options){
 const bytes=originalPdf(options),documentSha256=createHash('sha256').update(bytes).digest('hex'),task=getDocument({data:bytes,isEvalSupported:false,standardFontDataUrl:fileURLToPath(new URL('../node_modules/pdfjs-dist/standard_fonts/',import.meta.url))});t.after(()=>task.destroy());const pdf=await task.promise,original=await pdf.getPage(1),operatorList=await original.getOperatorList(),optionalContentConfig=await pdf.getOptionalContentConfig({intent:'display'}),ids=operatorList.fnArray.flatMap((op,id)=>op===OPS.constructPath?[id]:[]),events=[],canvases=[];
 const page={pageNumber:1,getOperatorList(){events.push('operators');return original.getOperatorList();},getViewport:options=>original.getViewport(options),render(options){events.push('render');assert.equal(options.operationsFilter,undefined);assert.equal(options.optionalContentConfigPromise instanceof Promise,true);return original.render(options);}};
 const selection={page:1,bounds:[15,15,25,25],anchor:[20.3,20.2],ids:ids.slice(0,3),excluded:[ids[2]]};
 return {events,canvases,ids,optionalContentConfig,args:{page,OPS,pdfjsVersion,optionalContentConfig,documentSha256,selection,sourceLayerScope:true,createCanvas:(w,h)=>{const c=createCanvas(w,h);canvases.push(c);return c;}}};
}
test('actual same-page review preserves original identities, source exclusions and anchors without scored counts',async t=>{
 const {args,ids,events,canvases,optionalContentConfig}=await corpus(t),before=structuredClone(args.selection),hash=optionalContentConfig.getHash(),progress=[],result=await runVectorCandidateReview({...args,progress:p=>progress.push(p)});
 assert.equal(result.completed,true,result.reason);assert.equal(result.requiresSemanticReview,true);assert.equal(result.proposals.length,2);assert.deepEqual(result.proposals.map(p=>p.elementIds),[ids.slice(0,2),ids.slice(4,6)]);assert.deepEqual(result.proposals.map(p=>[p.x,p.y]),[[20.3,20.2],[50.3,20.2]]);assert.ok(result.proposals.every(p=>p.visibility.verified));assert.equal(result.source.visibility.verified,true);assert.deepEqual(result.source.excludedIds,[ids[2]]);assert.deepEqual(args.selection,before);assert.equal(optionalContentConfig.getHash(),hash);
 assert.equal(result.coverage.complete,false);assert.equal(result.coverage.requestedPaints,8);assert.equal(result.coverage.excluded.length,2);assert.equal(result.coverage.unknown.length,0);assert.equal(result.allHandlesPreparedBeforeRendering,true);assert.equal(events.filter(e=>e==='operators').length,4);assert.equal(events.filter(e=>e==='render').length,3);assert.ok(events.lastIndexOf('operators')<events.indexOf('render'));assert.ok(canvases.every(c=>c.width===0&&c.height===0));assert.equal(progress.at(-1).phase,'complete');assert.equal(JSON.stringify(result).includes('"score"'),false);assert.equal('supported'in result,false);
});
test('scope opt-in changes candidate inventory only; default search retains full admitted geometry',async t=>{
 const {args}=await corpus(t),result=await runVectorCandidateReview({...args,sourceLayerScope:false});assert.equal(result.completed,true,result.reason);assert.equal(result.proposals.length,1);assert.equal(result.coverage.excluded.length,0);assert.equal(result.coverage.scope,'all-admitted-paints');
});
test('original white overpaint is retained and flags candidate visibility without hiding unknown coverage',async t=>{
 const {args,canvases}=await corpus(t,{targetWhite:true}),result=await runVectorCandidateReview(args);assert.equal(result.completed,true,result.reason);assert.equal(result.proposals.length,2);assert.equal(result.proposals[0].visibility.verified,true);assert.equal(result.proposals[1].visibility.verified,false);assert.match(result.proposals[1].visibility.reason,/raster/);assert.equal(result.coverage.unknown.length,1);assert.match(result.coverage.unknown[0].reason,/White overpainting/);assert.ok(canvases.every(c=>c.width===0&&c.height===0));
});
test('invisible source refuses the entire review rather than publishing candidate proofs',async t=>{
 const {args,canvases}=await corpus(t,{sourceWhite:true}),result=await runVectorCandidateReview(args);assert.equal(result.completed,false);assert.match(result.reason,/source paint/);assert.deepEqual(result.proposals,[]);assert.ok(canvases.every(c=>c.width===0&&c.height===0));
});
test('cancellation at every publication boundary returns no partial results and releases canvases',async t=>{
 for(const phase of ['audit','search','prepare','verify','complete']){const{args,canvases}=await corpus(t);let cancelled=false;const result=await runVectorCandidateReview({...args,cancelled:()=>cancelled,progress:p=>{if(p.phase===phase)cancelled=true;}});assert.equal(result.completed,false,phase);assert.match(result.reason,/cancelled/);assert.deepEqual(result.proposals,[]);assert.equal(result.coverage,undefined);assert.ok(canvases.every(c=>c.width===0&&c.height===0));}
});
test('stalled operators time out and late layer changes or mismatched page identities fail atomically',async t=>{
 const {args}=await corpus(t),stalled={...args.page,getOperatorList:()=>new Promise(()=>{})},timeout=await runVectorCandidateReview({...args,page:stalled,maxMilliseconds:5});assert.equal(timeout.completed,false);assert.match(timeout.reason,/timed out/);assert.deepEqual(timeout.proposals,[]);
 const mismatch=await runVectorCandidateReview({...args,selection:{...args.selection,page:2}});assert.equal(mismatch.completed,false);assert.deepEqual(mismatch.proposals,[]);
 const group=args.optionalContentConfig.getOrder()[0];const changed=await runVectorCandidateReview({...args,progress:p=>{if(p.phase==='prepare')args.optionalContentConfig.setVisibility(group,false);}});assert.equal(changed.completed,false);assert.match(changed.reason,/configuration changed/);assert.deepEqual(changed.proposals,[]);
});

test('actual text and image operations remain separate explicit non-path coverage',async t=>{
 const{args}=await corpus(t,{nonPath:true}),result=await runVectorCandidateReview(args);assert.equal(result.completed,true,result.reason);assert.equal(result.proposals.length,2);assert.deepEqual(result.coverage.nonPathContent,{textOperations:1,imageOperations:1,shadingOperations:0});assert.equal(result.coverage.complete,false);
});

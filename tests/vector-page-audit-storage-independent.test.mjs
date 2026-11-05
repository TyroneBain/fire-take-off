import test from 'node:test';
import assert from 'node:assert/strict';
import {getDocument,OPS,version as pdfjsVersion} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {createCanvas} from '@napi-rs/canvas';
import {auditNativePage,nativeElementFromPaint} from '../apps/local/web/vector-page-audit.mjs';
import {extractRawPathProvenance,createOptionalContentVisibilityResolver} from '../apps/local/web/vector-paint-provenance.mjs';
import {preparePdfContourPaints,verifyPdfContourPaints} from '../apps/local/web/pdf-contour-verification.mjs';

const viewport=[2,0,0,-2,0,200];
function harness(list,{check=()=>{},notify=()=>{},visible=()=>true}={}){
 let work=0;return {args:{page:{getOperatorList:async()=>list,getViewport:()=>({transform:viewport})},OPS,optionalContentVisible:visible,check,chargeAudit:n=>{work+=n;check();},notify},get work(){return work;}};
}
function manyPaths(count,segments=1){const path=[0,20,20];for(let i=0;i<segments;i++)path.push(1,20+i%80,20+(i%7));return {fnArray:Array(count).fill(OPS.constructPath),argsArray:Array.from({length:count},()=>[OPS.stroke,[[...path]]])};}

test('independent compact inventory preserves exact geometry and isolates mutable original arrays',async()=>{
 const descriptor={type:'OCG',id:'original-heads'},list=manyPaths(130,3);list.fnArray.unshift(OPS.beginMarkedContentProps,OPS.transform);list.argsArray.unshift(['OC',descriptor],[1,0,0,1,.125,.375]);list.fnArray.push(OPS.endMarkedContent);list.argsArray.push([]);
 const original=structuredClone(list),ids=list.fnArray.flatMap((v,i)=>v===OPS.constructPath?[i]:[]),expected=[];
 for(let i=0;i<ids.length;i+=128){const raw=extractRawPathProvenance({operatorList:list,OPS,ids:ids.slice(i,i+128),optionalContentVisible:()=>true,viewportTransform:viewport});assert.equal(raw.requestedComplete,true);expected.push(...raw.records.map(r=>nativeElementFromPaint(r,OPS)));}
 const h=harness(list),audit=await auditNativePage(h.args);assert.deepEqual(audit.elements,expected);assert.equal(audit.requestedPaints,130);assert.equal(audit.failures.length,0);assert.equal(h.work,list.fnArray.length*2);assert.deepEqual(list,original);
 assert.deepEqual(audit.records.map(r=>r.id),ids);for(const r of audit.records){assert.equal(r.wholeOperation,true);assert.equal(r.opaque,true);assert.equal(r.contextComplete,true);assert.equal(r.optionalContentScopes[0].descriptor.id,'original-heads');for(const key of ['sourceCommands','matrix','transformChain','pathCommands','clipRedundancyProof'])assert.equal(Object.hasOwn(r,key),false,`unused ${key} must not remain in compact page metadata`);}
 const saved=structuredClone(audit);descriptor.id='mutated';list.argsArray[2][1][0][1]=999;list.argsArray[1][4]=700;assert.deepEqual(audit,saved,'retained geometry and layer provenance must not alias original operator arrays');
});

test('independent retained-geometry excess fails atomically even when every raw batch is bounded',async()=>{
 const list=manyPaths(600,1000),raw=extractRawPathProvenance({operatorList:list,OPS,ids:Array.from({length:128},(_,i)=>i),viewportTransform:viewport});assert.equal(raw.requestedComplete,true);assert.ok(raw.storedValues<2000000);
 let published;const completed=[];await assert.rejects(async()=>{published=await auditNativePage(harness(list,{notify:(_phase,n)=>completed.push(n)}).args);},/geometry.*storage budget|retained.*budget|storage.*budget/i);assert.equal(published,undefined);assert.ok(completed.includes(512),'derived retained cap must replace the earlier duplicated-raw refusal, not merely leave that refusal in place');
});

test('independent last audit callback cancellation and unresolved optional content publish no compact inventory',async()=>{
 const list=manyPaths(129);let cancelled=false,published,callbacks=0;const h=harness(list,{check:()=>{if(cancelled)throw Error('Independent cancellation');},notify:(_phase,n,total)=>{callbacks++;if(n===total)cancelled=true;}});
 await assert.rejects(async()=>{published=await auditNativePage(h.args);},/Independent cancellation/);assert.equal(callbacks,2);assert.equal(published,undefined);
 const layer=manyPaths(1);layer.fnArray.unshift(OPS.beginMarkedContentProps);layer.argsArray.unshift(['OC',{type:'OCG',id:'unknown'}]);layer.fnArray.push(OPS.endMarkedContent);layer.argsArray.push([]);await assert.rejects(auditNativePage(harness(layer,{visible:()=>undefined}).args),/visibility is unresolved/);
});

test('independent long layer descriptors cannot bypass the metadata budget with tiny geometry',async()=>{
 const list=manyPaths(5000);list.fnArray.unshift(OPS.beginMarkedContentProps);list.argsArray.unshift(['OC',{type:'OCG',id:'L'.repeat(240)}]);list.fnArray.push(OPS.endMarkedContent);list.argsArray.push([]);let published;
 await assert.rejects(async()=>{published=await auditNativePage(harness(list).args);},/metadata.*budget/i);assert.equal(published,undefined);
});

function clippedOriginal(){
 const stream='/OC /Heads BDC q 10 10 180 80 re W n 1 w 30 30 8 8 re S 188 30 8 8 re S Q EMC q /A gs 100 30 8 8 re f Q';
 const objects=['<< /Type /Catalog /Pages 2 0 R /OCProperties << /OCGs [5 0 R] /D << /ON [5 0 R] >> >> >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 220 100] /Resources << /Properties << /Heads 5 0 R >> /ExtGState << /A << /Type /ExtGState /ca .5 >> >> >> /Contents 4 0 R >>',`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,'<< /Type /OCG /Name (Independent heads) >>'];
 let pdf='%PDF-1.7\n';const offsets=[0];for(const [i,o]of objects.entries()){offsets.push(pdf.length);pdf+=`${i+1} 0 obj\n${o}\nendobj\n`;}const xref=pdf.length;pdf+=`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;return new Uint8Array(Buffer.from(pdf));
}
test('independent original clip and alpha refusals survive compaction and proof re-extracts original provenance',async()=>{
 const task=getDocument({data:clippedOriginal(),isEvalSupported:false});try{const doc=await task.promise,page=await doc.getPage(1),list=await page.getOperatorList(),before=structuredClone(list.argsArray),config=await doc.getOptionalContentConfig({intent:'display'}),visible=createOptionalContentVisibilityResolver(config),ids=list.fnArray.flatMap((v,i)=>v===OPS.constructPath&&list.argsArray[i][0]!==OPS.endPath?[i]:[]);
  const audit=await auditNativePage({page,OPS,optionalContentVisible:visible,check(){},chargeAudit(){},notify(){}});assert.deepEqual(audit.records.map(r=>r.id),[ids[0]]);assert.deepEqual(audit.failures.map(f=>f.id),ids.slice(1));assert.match(audit.failures[0].reason,/clip/i);assert.match(audit.failures[1].reason,/Opaque/);assert.deepEqual(list.argsArray,before);
  const raw=extractRawPathProvenance({operatorList:list,OPS,ids:[ids[0]],optionalContentVisible:visible,viewportTransform:viewport});assert.ok(raw.records[0].clipRedundancyProof);assert.equal(Object.hasOwn(audit.records[0],'clipRedundancyProof'),false);
  const good=await preparePdfContourPaints({page,OPS,elementIds:[ids[0]],optionalContentConfig:config}),bad=await preparePdfContourPaints({page,OPS,elementIds:[ids[1]],optionalContentConfig:config}),alpha=await preparePdfContourPaints({page,OPS,elementIds:[ids[2]],optionalContentConfig:config});assert.equal(good.supported,true,good.reason);assert.equal(bad.supported,false);assert.equal(alpha.supported,false);
  const proof=await verifyPdfContourPaints({prepared:good,createCanvas,pdfjsVersion});assert.equal(proof.verified,true,proof.reason);assert.equal(proof.requiresSemanticVerification,true);
 }finally{await task.destroy();}
});

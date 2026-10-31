import test from 'node:test';
import assert from 'node:assert/strict';
import {createCanvas} from '@napi-rs/canvas';
import {getDocument,OPS,version} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {preparePdfContourPaints,verifyPdfContourPaints} from '../apps/local/web/pdf-contour-verification.mjs';

function documentBytes(content,{layers=false}={}){
 const objects=[`<< /Type /Catalog /Pages 2 0 R ${layers?'/OCProperties << /OCGs [5 0 R] /D << /BaseState /ON /Order [5 0 R] >> >>':''} >>`,'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Resources << ${layers?'/Properties << /Layer 5 0 R >>':''} >> /Contents 4 0 R >>`,`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`];
 if(layers)objects.push('<< /Type /OCG /Name (Original test layer) >>');
 let pdf='%PDF-1.5\n';const offsets=[0];for(const [i,value] of objects.entries()){offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${value}\nendobj\n`;}
 const xref=Buffer.byteLength(pdf);pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(n=>`${String(n).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;return new Uint8Array(Buffer.from(pdf));
}
async function original(t,content,options){
 const bytes=documentBytes(content,options),task=getDocument({data:bytes.slice(),isEvalSupported:false});t.after(()=>task.destroy());const doc=await task.promise,page=await doc.getPage(1),ops=await page.getOperatorList();
 return {page,ops,doc,bytes,ids:ops.fnArray.flatMap((op,id)=>op===OPS.constructPath&&ops.argsArray[id][0]!==OPS.endPath?[id]:[])};
}
const shape='q 1 0 0 1 30.25 40.125 cm 0 0 m 10 0 l 14 5 l 10 10 l 0 10 l h W n .8 .1 .1 rg -20 -20 50 50 re f Q 0 G .48 w 30.25 40.125 m 40.25 40.125 l 40.25 50.125 l S 0 g 34 43 2 2 re f';
const prepare=(f,extra={})=>preparePdfContourPaints({page:f.page,OPS,elementIds:f.ids,...extra});
const verify=(prepared,extra={})=>verifyPdfContourPaints({prepared,createCanvas,pdfjsVersion:version,...extra});

test('original clipped and unclipped paint verifies end-to-end with raw CTMs and bounded readback',async t=>{
 const f=await original(t,shape),before=structuredClone(f.ops),prepared=await prepare(f);assert.equal(prepared.supported,true,prepared.reason);assert.deepEqual(f.ops,before);
 const allocated=[],result=await verify(prepared,{createCanvas:(w,h)=>{const c=createCanvas(w,h);allocated.push(c);return c;}});
 assert.equal(result.verified,true,result.reason);assert.equal(result.requiresSemanticVerification,true);assert.equal('score'in result,false);assert.ok(result.crop.width<100&&result.crop.height<100);assert.ok(allocated.length>=2);assert.ok(allocated.every(c=>c.width===0&&c.height===0));
 assert.equal((await verify(prepared)).verified,true,'prepared raw provenance remains usable after PDF.js caches paths');
});

test('later white overpainting remains in original replay and rejects an invisible symbol detail',async t=>{
 const f=await original(t,'0 g 30 30 20 20 re f 1 g 39.5 39.5 .5 .5 re f'),prepared=await prepare(f,{elementIds:[f.ids[0]]}),result=await verify(prepared);
 assert.equal(prepared.supported,true,prepared.reason);assert.equal(result.verified,false);assert.equal(result.diagnostics.mismatchedPixels,1);assert.equal('executionFailure'in result,false);
});

test('caller-authorised context is separate from required symbol paint and cannot substitute for it',async t=>{
 const f=await original(t,'1 0 0 RG 1 w 25 40 m 55 40 l S 0 g 35 35 10 10 re f'),prepared=await prepare(f,{elementIds:[f.ids[1]],contextIds:[f.ids[0]]}),result=await verify(prepared);
 assert.equal(result.verified,true,result.reason);assert.equal(result.requiresContextVerification,true);assert.equal(result.diagnostics.contextPaintCount,1);
 assert.equal((await prepare(f,{elementIds:[f.ids[0]],contextIds:[f.ids[0]]})).supported,false);
});

test('forged handles and oversize whole paths are refused before any canvas allocation',async t=>{
 let allocations=0;const factory=(w,h)=>{allocations++;return createCanvas(w,h);};
 assert.equal((await verify({supported:true},{createCanvas:factory})).verified,false);
 const f=await original(t,'0 G 1 w 10 20 m 290 20 l S'),prepared=await prepare(f),result=await verify(prepared,{createCanvas:factory});
 assert.equal(prepared.supported,true,prepared.reason);assert.equal(result.verified,false);assert.match(result.reason,/footprint/);assert.equal(allocations,0);assert.equal('executionFailure'in result,false);
 assert.equal((await verify({...prepared},{createCanvas:factory})).verified,false);
});

test('cancellation and renderer failures release canvas memory without returning a partial proof',async t=>{
 const f=await original(t,shape),prepared=await prepare(f),allocated=[],factory=(w,h)=>{const c=createCanvas(w,h);allocated.push(c);return c;};
 const cancelled=await verify(prepared,{createCanvas:factory,cancelled:()=>true});assert.equal(cancelled.verified,false);assert.equal(allocated.length,0);
 const aborted=await verify(prepared,{createCanvas:factory,onRender:task=>task.cancel()});assert.equal(aborted.verified,false);assert.ok(allocated.every(c=>c.width===0&&c.height===0));
 const failed=await verify(prepared,{createCanvas:factory,onRender:()=>{throw Error('Injected render callback failure');}});assert.equal(failed.verified,false);assert.equal(failed.executionFailure,'render');assert.match(failed.reason,/Injected/);assert.ok(allocated.every(c=>c.width===0&&c.height===0));
});

test('synchronous render dispatch errors are operational failures, not ordinary visibility refusals',async t=>{
 const f=await original(t,shape),prepared=await prepare(f),allocated=[];f.page.render=()=>{throw Error('Synchronous render failure');};
 const result=await verify(prepared,{createCanvas:(w,h)=>{const c=createCanvas(w,h);allocated.push(c);return c;}});assert.equal(result.executionFailure,'render');assert.match(result.reason,/Synchronous/);assert.ok(allocated.every(c=>c.width===0&&c.height===0));
});

test('wrong renderer version fails explicitly and releases its crop',async t=>{
 const f=await original(t,shape),prepared=await prepare(f),allocated=[],result=await verify(prepared,{pdfjsVersion:'0.0.0',createCanvas:(w,h)=>{const c=createCanvas(w,h);allocated.push(c);return c;}});
 assert.equal(result.verified,false);assert.match(result.reason,/version|renderer|PDF.js/i);assert.ok(allocated.every(c=>c.width===0&&c.height===0));
});

test('preparation cancellation stops waiting for a stalled shared PDF and safely observes late rejection',{timeout:2000},async()=>{
 let cancelled=false,rejectOperators,rendered=false;
 const page={getOperatorList:()=>new Promise((resolve,reject)=>{rejectOperators=reject;}),getViewport:()=>{},render:()=>{rendered=true;}};
 const waiting=preparePdfContourPaints({page,OPS,elementIds:[1],cancelled:()=>cancelled});
 await new Promise(resolve=>setTimeout(resolve,0));cancelled=true;
 const result=await waiting;assert.equal(result.supported,false);assert.match(result.reason,/cancelled/);assert.equal(rendered,false);
 rejectOperators(new Error('Late parser rejection after cancellation'));
 await new Promise(resolve=>setTimeout(resolve,0));
});

test('original optional layers need actual visibility; prepared handles invalidate after a layer toggle',async t=>{
 const f=await original(t,'/OC /Layer BDC 0 g 30 30 20 20 re f EMC',{layers:true});
 assert.equal((await prepare(f)).supported,false,'missing optional-content context must not become visible by default');
 const config=await f.doc.getOptionalContentConfig({intent:'display'}),prepared=await prepare(f,{optionalContentConfig:config});assert.equal(prepared.supported,true,prepared.reason);
 assert.equal((await verify(prepared)).verified,true);
 const id=[...config][0][0];config.setVisibility(id,false);
 const changed=await verify(prepared);assert.equal(changed.verified,false);assert.match(changed.reason,/visibility changed/);
 // Obtain a fresh page/operator list because the previous replay cached Path2D.
 const hidden=await original(t,'/OC /Layer BDC 0 g 30 30 20 20 re f EMC',{layers:true}),hiddenConfig=await hidden.doc.getOptionalContentConfig({intent:'display'});hiddenConfig.setVisibility([...hiddenConfig][0][0],false);
 const rejected=await prepare(hidden,{optionalContentConfig:hiddenConfig});assert.equal(rejected.supported,false);assert.match(rejected.reason,/hidden|visible|visibility/i);
});

test('a page rectangle that cannot touch the whole symbol admits original paint with viewport-bound proof',async t=>{
 const f=await original(t,'q 10 10 100 100 re W n 0 G .1 w 30 30 m 50 30 l S 0 g 35 35 5 5 re f Q'),prepared=await prepare(f);
 assert.equal(prepared.supported,true,prepared.reason);const proof=await verify(prepared);assert.equal(proof.verified,true,proof.reason);assert.deepEqual(proof.redundantClipOperations,f.ids);assert.equal('score'in proof,false);
});

test('partial and pixel-adjacent clips are never treated as irrelevant to a thin stroke',async t=>{
 for(const content of ['q 30 29 20 2 re W n 0 G .1 w 29 30 m 51 30 l S Q','q 20 29.9 40 .2 re W n 0 G .1 w 30 30 m 50 30 l S Q']){
  const f=await original(t,content),prepared=await prepare(f);assert.equal(prepared.supported,false);assert.match(prepared.reason,/clip/i);
 }
});

test('a redundant-clip proof cannot be reused with a changed page viewport',async t=>{
 const f=await original(t,'q 10 10 100 100 re W n 0 G .1 w 30 30 m 50 30 l S Q'),getViewport=f.page.getViewport.bind(f.page);let changed=false;
 f.page.getViewport=options=>getViewport(changed?{...options,scale:3}:options);
 const prepared=await prepare(f);assert.equal(prepared.supported,true,prepared.reason);changed=true;let allocations=0;
 const proof=await verify(prepared,{createCanvas:(w,h)=>{allocations++;return createCanvas(w,h);}});assert.equal(proof.verified,false);assert.match(proof.reason,/viewport changed/);assert.equal(allocations,0);
});

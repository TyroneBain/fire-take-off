import test from 'node:test';
import assert from 'node:assert/strict';
import {getDocument,OPS,version} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {createCanvas} from '@napi-rs/canvas';
import {preparePdfContourPaints,verifyPdfContourPaints} from '../apps/local/web/pdf-contour-verification.mjs';

// Original literal layered PDF, independently constructed for adapter admission.
function bytes(content){
 const objects=['<< /Type /Catalog /Pages 2 0 R /OCProperties << /OCGs [5 0 R] /D << /BaseState /ON /Order [5 0 R] >> >> >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 100] /Resources << /Properties << /Layer 5 0 R >> /ExtGState << /Half 6 0 R >> >> /Contents 4 0 R >>',`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,'<< /Type /OCG /Name (Independent original layer) >>','<< /Type /ExtGState /ca 0.5 >>'];
 let out='%PDF-1.5\n';const offsets=[0];for(const [i,o]of objects.entries()){offsets.push(Buffer.byteLength(out));out+=`${i+1} 0 obj\n${o}\nendobj\n`;}
 const xref=Buffer.byteLength(out);out+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(v=>`${String(v).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;return new Uint8Array(Buffer.from(out));
}
async function fixture(t,content){const task=getDocument({data:bytes(content),isEvalSupported:false});t.after(()=>task.destroy());const doc=await task.promise,page=await doc.getPage(1),ops=await page.getOperatorList(),config=await doc.getOptionalContentConfig({intent:'display'}),ids=ops.fnArray.flatMap((op,id)=>op===OPS.constructPath&&ops.argsArray[id][0]!==OPS.endPath?[id]:[]);return {page,ops,config,ids};}
const clipped='q 30 30 20 20 re W n 0 g 20 20 40 40 re f Q';
const prepare=(f,ids)=>preparePdfContourPaints({page:f.page,OPS,elementIds:ids,optionalContentConfig:f.config});
const verify=(prepared,options={})=>verifyPdfContourPaints({prepared,createCanvas,pdfjsVersion:version,...options});

test('independent hidden clipped layer cannot be admitted through the clip-fill fallback',async t=>{
 const f=await fixture(t,'/OC /Layer BDC '+clipped+' EMC'),layer=[...f.config][0][0];assert.equal(f.ids.length,1);
 f.config.setVisibility(layer,false);const hidden=await prepare(f,f.ids);assert.equal(hidden.supported,false);assert.match(hidden.reason,/hidden|visible|visibility/i);
 f.config.setVisibility(layer,true);const visible=await prepare(f,f.ids);assert.equal(visible.supported,true,visible.reason);const proof=await verify(visible);assert.equal(proof.verified,true,proof.reason);assert.equal('score' in proof,false);assert.equal(proof.requiresSemanticVerification,true);
 f.config.setVisibility(layer,false);let allocations=0;const stale=await verify(visible,{createCanvas:(w,h)=>{allocations++;return createCanvas(w,h);}});assert.equal(stale.verified,false);assert.match(stale.reason,/visibility changed/);assert.equal(allocations,0,'changed layers must invalidate before original-page rendering');
});

test('independent translucent clipped paint fails admission before any opaque clip attestation',async t=>{
 const f=await fixture(t,'/OC /Layer BDC q /Half gs '+clipped+' Q EMC'),prepared=await prepare(f,f.ids);assert.equal(prepared.supported,false);assert.match(prepared.reason,/opaque|graphics-state/i);
});

test('independent handles prepared together preserve actual later white paint and cancellation',async t=>{
 const f=await fixture(t,'/OC /Layer BDC '+clipped+' q 1 0 0 1 70 0 cm '+clipped+' Q 1 g 109.5 39.5 .5 .5 re f EMC');assert.equal(f.ids.length,3);
 const source=await prepare(f,[f.ids[0]]),covered=await prepare(f,[f.ids[1]]);assert.equal(source.supported,true,source.reason);assert.equal(covered.supported,true,covered.reason);
 assert.equal((await verify(source)).verified,true);const rejection=await verify(covered);assert.equal(rejection.verified,false);assert.equal(rejection.diagnostics.mismatchedPixels,1,'full original PDF keeps the one-pixel white knockout');
 const canvases=[];let cancelled=false;const aborted=await verify(source,{createCanvas:(w,h)=>{const c=createCanvas(w,h);canvases.push(c);return c;},cancelled:()=>cancelled,onRender:()=>{cancelled=true;}});assert.equal(aborted.verified,false);assert.ok(canvases.every(c=>c.width===0&&c.height===0));assert.equal((await verify(source)).verified,true,'cancelled verification must not corrupt its retained handle');
});

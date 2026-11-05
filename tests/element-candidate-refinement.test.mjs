import test from 'node:test';
import assert from 'node:assert/strict';
import {getDocument,OPS} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {createCanvas} from '@napi-rs/canvas';
import {inspectPdfElements,ELEMENT_RENDERER,validElementSelection} from '../apps/local/web/pdf-elements.mjs';

// Original PDFs: nearby paths share coarse PDF.js bbox bins with the source,
// but their complete painted footprints lie outside its fixed crop.
function pdf(content,media=[2384,1684]){
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>',`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${media.join(' ')}] /Resources << >> /Contents 4 0 R >>`,`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`];
 let data='%PDF-1.4\n';const offsets=[0];for(const [i,o]of objects.entries()){offsets.push(Buffer.byteLength(data));data+=`${i+1} 0 obj\n${o}\nendobj\n`;}
 const at=Buffer.byteLength(data);data+=`xref\n0 5\n0000000000 65535 f \n${offsets.slice(1).map(n=>`${String(n).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${at}\n%%EOF\n`;return new Uint8Array(Buffer.from(data));
}
const bounds=[100,100,110,110],nearby=(count=140)=>Array.from({length:count},()=> '98 104 .4 .4 re f').join('\n'),glyph='1 w 102 102 6 6 re S 104 104 2 2 re f';
async function fixture(t,content,media){
 const task=getDocument({data:pdf(content,media),isEvalSupported:false});t.after(()=>task.destroy());const page=await(await task.promise).getPage(1),ops=await page.getOperatorList(),allocations=[],sizes=[];
 const factory=(w,h)=>{sizes.push([w,h]);const c=createCanvas(w,h);allocations.push(c);return c;};
 return {page,ops,allocations,sizes,factory};
}

test('coarse bbox overflow refines to original visible IDs, exact pixels and unfiltered native anchor',async t=>{
 const f=await fixture(t,`0 g 0 G ${nearby()} ${glyph}`),ids=f.ops.fnArray.flatMap((op,i)=>op===OPS.constructPath?[i]:[]),model=await inspectPdfElements({page:f.page,OPS,bounds,createCanvas:f.factory});
 assert.equal(ids.length,142);assert.deepEqual(model.elements.map(e=>e.id),ids.slice(-2));
 assert.ok(f.sizes.length>142,'fixture exercises refinement, rather than merely missing the coarse bins');
 assert.deepEqual(model.viewport.convertToPdfPoint(model.box[0]+model.anchor[0],model.box[1]+model.anchor[1]),[105,105]);
 assert.ok(validElementSelection({renderer:ELEMENT_RENDERER,ids:ids.slice(-2),excluded:[ids.at(-1)]}));
 const canvas=createCanvas(20,20),ctx=canvas.getContext('2d');try{
  await f.page.render({canvas,canvasContext:ctx,viewport:model.viewport,transform:[1,0,0,1,-model.box[0],-model.box[1]]}).promise;
  const original=ctx.getImageData(0,0,20,20);assert.deepEqual((await model.render()).data,original.data);assert.notDeepEqual((await model.render([ids.at(-1)])).data,original.data);assert.deepEqual((await model.render()).data,original.data);
 }finally{canvas.width=canvas.height=0;}
 assert.ok(f.sizes.every(([w,h],i)=>i===0?w*h<=1000000:w===20&&h===20));
 assert.ok(f.allocations.every(c=>c.width===0&&c.height===0));
});

test('small-page selection also refines coarse overflow without changing element identity',async t=>{
 const f=await fixture(t,`0 g 0 G ${nearby()} ${glyph}`,[800,800]),ids=f.ops.fnArray.flatMap((op,i)=>op===OPS.constructPath?[i]:[]),model=await inspectPdfElements({page:f.page,OPS,bounds,createCanvas:f.factory});
 assert.deepEqual(model.elements.map(e=>e.id),ids.slice(-2));assert.ok(f.sizes.length>142);
 assert.deepEqual(model.anchor,[10,10]);
 assert.ok(f.allocations.slice(1,-1).every(c=>c.width===0&&c.height===0),'new refinement scratch surfaces released');
 // Small editor retains its pre-existing final canvas for render(excluded).
 for(const c of f.allocations)c.width=c.height=0;
});

test('129 actual nonempty source paths still exceed the unchanged editable-element limit',async t=>{
 const content=Array.from({length:129},(_,i)=>`${100+i%13*4} ${100+Math.floor(i/13)*4} 1 1 re f`).join('\n'),f=await fixture(t,`0 g ${content}`);
 await assert.rejects(inspectPdfElements({page:f.page,OPS,bounds:[98,98,152,140],createCanvas:f.factory}),/too many elements/);
 assert.ok(f.sizes.length<=130,'refinement stops at the 129th nonempty operation');assert.ok(f.allocations.every(c=>c.width===0&&c.height===0));
});

test('separate coarse budget and cancellation bound refinement work and release scratch surfaces',async t=>{
 const over=await fixture(t,`0 g 0 G ${nearby(513)} ${glyph}`);
 await assert.rejects(inspectPdfElements({page:over.page,OPS,bounds,createCanvas:over.factory}),/512 candidate inspection budget/);assert.equal(over.sizes.length,1);assert.ok(over.allocations.every(c=>c.width===0&&c.height===0));
 const cancelled=await fixture(t,`0 g 0 G ${nearby()} ${glyph}`);
 await assert.rejects(inspectPdfElements({page:cancelled.page,OPS,bounds,createCanvas:cancelled.factory,cancelled:()=>cancelled.sizes.length>=4}),/cancelled/);
 assert.equal(cancelled.sizes.length,4);assert.ok(cancelled.allocations.every(c=>c.width===0&&c.height===0));
});

test('refinement cannot admit a white knockout or redundant hidden source paint',async t=>{
 for(const source of ['0 g 102 104 6 2 re f 1 g 105 104 3 2 re f','0 g 102 104 6 2 re f 102 104 6 2 re f']){
  const f=await fixture(t,`0 g ${nearby()} ${source}`);
  await assert.rejects(inspectPdfElements({page:f.page,OPS,bounds,createCanvas:f.factory}),/obscured|hidden|redundant/);
  assert.ok(f.allocations.every(c=>c.width===0&&c.height===0));
 }
});

test('elapsed inspection deadline aborts refinement before more paint renders',async t=>{
 const f=await fixture(t,`0 g 0 G ${nearby()} ${glyph}`),now=performance.now.bind(performance);let elapsed=0;
 t.mock.method(performance,'now',()=>now()+elapsed);
 const factory=(w,h)=>{const canvas=f.factory(w,h);if(f.sizes.length===2)elapsed=120001;return canvas;};
 await assert.rejects(inspectPdfElements({page:f.page,OPS,bounds,createCanvas:factory}),/time budget/);
 assert.equal(f.sizes.length,2);assert.ok(f.allocations.every(c=>c.width===0&&c.height===0));
});

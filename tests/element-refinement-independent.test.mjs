import test from 'node:test';
import assert from 'node:assert/strict';
import {getDocument,OPS} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {createCanvas} from '@napi-rs/canvas';
import {inspectPdfElements,elementAt} from '../apps/local/web/pdf-elements.mjs';

// Independent literal PDFs. Every remote operation has a bounding box spanning
// the source but consists of two disconnected short strokes nowhere near it.
const remote=n=>Array.from({length:n},(_,i)=>`${i%11} 5 m ${20+i%11} 5 l 1170 1195 m 1195 1195 l S`).join('\n');
const circle=(r,paint)=>{const k=.552284749831*r;return `${r} 0 m ${r} ${k} ${k} ${r} 0 ${r} c ${-k} ${r} ${-r} ${k} ${-r} 0 c ${-r} ${-k} ${-k} ${-r} 0 ${-r} c ${k} ${-r} ${r} ${-k} ${r} 0 c h ${paint}`;};
const glyph=`q 1 0 0 1 600 600 cm 1 w ${circle(4,'S')} ${circle(1.2,'f')} Q 604.5 600 m 630 600 l S`;
function original(content){const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 1200 1200] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> /ExtGState << /A << /Type /ExtGState /CA .5 /ca .5 >> >> >> /Contents 4 0 R >>',`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`];let pdf='%PDF-1.4\n',offsets=[0];for(const[i,value]of objects.entries()){offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${value}\nendobj\n`;}const xref=Buffer.byteLength(pdf);pdf+=`xref\n0 5\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;return new Uint8Array(Buffer.from(pdf));}
async function setup(t,content){const task=getDocument({data:original(content),isEvalSupported:false,standardFontDataUrl:new URL('../node_modules/pdfjs-dist/standard_fonts/',import.meta.url).pathname});t.after(()=>task.destroy());const page=await(await task.promise).getPage(1),ops=await page.getOperatorList(),allocations=[],sizes=[];return{page,ops,allocations,sizes,createCanvas:(w,h)=>{const canvas=createCanvas(w,h);allocations.push(canvas);sizes.push([w,h]);return canvas;}};}
const bounds=[590,590,610,610];

test('independent disconnected geometry bounds refine to whole original clipped cubic glyph operations',async t=>{
 const f=await setup(t,`0 G 0 g .5 w ${remote(147)} q 589 589 22 22 re W n ${glyph} Q`),ids=f.ops.fnArray.flatMap((op,id)=>op===OPS.constructPath&&f.ops.argsArray[id][0]!==OPS.endPath?[id]:[]),model=await inspectPdfElements({page:f.page,OPS,bounds,createCanvas:f.createCanvas});
 assert.equal(ids.length,150);assert.deepEqual(model.elements.map(e=>e.id),ids.slice(-3));assert.ok(f.sizes.length>150,'actual isolated refinement ran on the spanning but empty paths');
 const reference=createCanvas(40,40);try{await f.page.render({canvas:reference,canvasContext:reference.getContext('2d',{willReadFrequently:true}),viewport:model.viewport.clone({offsetX:-model.box[0],offsetY:-model.box[1]})}).promise;assert.deepEqual((await model.render()).data,reference.getContext('2d').getImageData(0,0,40,40).data);}finally{reference.width=reference.height=0;}
 const pipe=elementAt(model.elements,36,20,40,40);assert.equal(pipe,ids.at(-1));const cleaned=await model.render([pipe]);assert.equal(cleaned.data[(20*40+36)*4],255);assert.equal(cleaned.data[(20*40+20)*4],0,'filled centre remains original black paint');
 assert.ok(f.sizes.every(([w,h],i)=>i===0?w*h<=1000000:w===40&&h===40));assert.ok(f.allocations.every(c=>c.width===0&&c.height===0));
});

test('independent actual-white knockout and duplicate hidden centre still refuse after coarse refinement',async t=>{
 for(const extra of ['1 g 600 600 .5 .5 re f',`q 1 0 0 1 600 600 cm ${circle(1.2,'f')} Q`]){const f=await setup(t,`0 G 0 g .5 w ${remote(140)} ${glyph} ${extra}`);await assert.rejects(inspectPdfElements({page:f.page,OPS,bounds,createCanvas:f.createCanvas}),/obscured|hidden|redundant/);assert.ok(f.sizes.length>128);assert.ok(f.allocations.every(c=>c.width===0&&c.height===0));}
});

test('independent 129 distinct visible squares retain the editable limit despite removable broad-phase noise',async t=>{
 const visible=Array.from({length:129},(_,i)=>`${581+(i%13)*3} ${581+Math.floor(i/13)*3} 1 1 re f`).join('\n'),f=await setup(t,`0 G 0 g .5 w ${remote(140)} ${visible}`);
 await assert.rejects(inspectPdfElements({page:f.page,OPS,bounds:[580,580,620,620],createCanvas:f.createCanvas}),/too many elements/);assert.ok(f.allocations.every(c=>c.width===0&&c.height===0));
});

test('independent remote spanning paths obey 512 broad-phase cap and cancellation releases every crop',async t=>{
 const over=await setup(t,`0 G 0 g .5 w ${remote(513)} ${glyph}`);await assert.rejects(inspectPdfElements({page:over.page,OPS,bounds,createCanvas:over.createCanvas}),/512 candidate inspection budget/);assert.equal(over.sizes.length,1);assert.ok(over.allocations.every(c=>c.width===0&&c.height===0));
 const cancel=await setup(t,`0 G 0 g .5 w ${remote(140)} ${glyph}`);await assert.rejects(inspectPdfElements({page:cancel.page,OPS,bounds,createCanvas:cancel.createCanvas,cancelled:()=>cancel.sizes.length>=7}),/cancelled/);assert.equal(cancel.sizes.length,7);assert.ok(cancel.allocations.every(c=>c.width===0&&c.height===0));
});

test('independent translucent source remains unsupported before any refinement canvas',async t=>{
 const f=await setup(t,`0 G 0 g .5 w ${remote(140)} q /A gs ${glyph} Q`);await assert.rejects(inspectPdfElements({page:f.page,OPS,bounds,createCanvas:f.createCanvas}),/composited/);assert.equal(f.sizes.length,0);
});

test('independent masked pipe needs explicit native exclusion while original retained head passes strict paint proof',async t=>{
 const {preparePdfContourPaints,verifyPdfContourPaints}=await import('../apps/local/web/pdf-contour-verification.mjs'),{version:pdfjsVersion}=await import('pdfjs-dist/legacy/build/pdf.mjs');
 const whiteHead=`q 1 0 0 1 600 600 cm 1 w 1 g ${circle(4,'f')} 0 g ${circle(4,'S')} ${circle(1.2,'f')} Q`,content=`0 G 0 g .5 w ${remote(140)} 1.4 w 600 600 m 630 600 l 630 620 l S ${whiteHead}`;
 const legacy=await setup(t,content);await assert.rejects(inspectPdfElements({page:legacy.page,OPS,bounds,createCanvas:legacy.createCanvas}),/obscured paths/,'legacy editor still refuses partially obscured unwanted pipe');
 const f=await setup(t,content),ids=f.ops.fnArray.flatMap((op,id)=>op===OPS.constructPath&&f.ops.argsArray[id][0]!==OPS.endPath?[id]:[]).slice(-4),[pipe,whiteBase,head,centre]=ids;
 const docTask=getDocument({data:original(content),isEvalSupported:false,standardFontDataUrl:new URL('../node_modules/pdfjs-dist/standard_fonts/',import.meta.url).pathname});t.after(()=>docTask.destroy());const doc=await docTask.promise,page=await doc.getPage(1),config=await doc.getOptionalContentConfig({intent:'display'}),prepared=await preparePdfContourPaints({page,OPS,elementIds:[head,centre],optionalContentConfig:config});assert.equal(prepared.supported,true,prepared.reason);
 const proof=await verifyPdfContourPaints({prepared,createCanvas:f.createCanvas,pdfjsVersion});assert.equal(proof.verified,true,proof.reason);assert.equal(proof.requiresSemanticVerification,true);
 const viewport=page.getViewport({scale:2,rotation:0}),top=viewport.convertToViewportPoint(590,610),cropViewport=viewport.clone({offsetX:-top[0],offsetY:-top[1]});
 async function crop(omitted){const c=createCanvas(40,40);try{const options={canvas:c,canvasContext:c.getContext('2d',{willReadFrequently:true}),viewport:cropViewport,optionalContentConfigPromise:Promise.resolve(config)};if(omitted!==undefined)options.operationsFilter=index=>index!==omitted;await page.render(options).promise;return c.getContext('2d').getImageData(0,0,40,40).data;}finally{c.width=c.height=0;}}
 const full=await crop(),withoutHead=await crop(whiteBase),withoutPipe=await crop(pipe),at=(x,y)=>((610-y)*2*40+(x-590)*2)*4;
 assert.equal(full[at(602.5,600)],255,'original white annulus hides the pipe');assert.equal(withoutHead[at(602.5,600)],0,'diagnostic omission of white head base reveals the original pipe through the annulus');assert.equal(full[at(608,600)],0);assert.equal(withoutPipe[at(608,600)],255,'explicit omission removes visible exterior pipe');assert.equal(withoutPipe[at(600,600)],0,'retained black central disk remains');
 assert.ok(legacy.allocations.every(c=>c.width===0&&c.height===0));assert.ok(f.allocations.every(c=>c.width===0&&c.height===0));
});

test('independent native-only interaction selects only visible pipe ink and retains hidden nonwhite IDs without hit targets',async t=>{
 const content=`0 G 0 g .5 w ${remote(140)} 598 598 .5 .5 re f 1.4 w 600 600 m 630 600 l 630 620 l S q 1 0 0 1 600 600 cm 1 w 1 g ${circle(4,'f')} 0 g ${circle(4,'S')} ${circle(1.2,'f')} Q`,f=await setup(t,content),[hidden,pipe,whiteBase,head,centre]=f.ops.fnArray.flatMap((op,id)=>op===OPS.constructPath?[id]:[]).slice(-5),model=await inspectPdfElements({page:f.page,OPS,bounds,createCanvas:f.createCanvas,nativeReviewOnly:true});
 assert.equal(model.nativeReviewOnly,true);assert.deepEqual(model.elements.map(e=>e.id),[hidden,pipe,head,centre]);assert.equal(model.elements.find(e=>e.id===hidden).ink.some(Boolean),false,'wholly hidden original path remains in inventory without a false click target');
 assert.equal(elementAt(model.elements,25,20,40,40),null,'covered pipe section in white annulus cannot be selected');assert.equal(elementAt(model.elements,36,20,40,40),pipe,'visible exterior pipe selects its whole original operation');assert.equal(elementAt(model.elements,20,20,40,40),centre);
 const full=await model.render(),cleaned=await model.render([pipe]),index=(x,y)=>((610-y)*2*40+(x-590)*2)*4;assert.equal(full.data[index(608,600)],0);assert.equal(cleaned.data[index(608,600)],255);assert.equal(cleaned.data[index(600,600)],0);assert.equal(cleaned.data[index(602.5,600)],255,'unselected original white context is preserved');
 await assert.rejects(model.render([whiteBase]),/Invalid excluded selection element/);assert.ok(f.allocations.every(c=>c.width===0&&c.height===0));
});

test('independent native-only inspection still refuses visible text outside retained path coverage',async t=>{
 const f=await setup(t,`0 G 0 g .5 w ${remote(140)} ${glyph} BT /F1 2 Tf 606 606 Td (X) Tj ET`);await assert.rejects(inspectPdfElements({page:f.page,OPS,bounds,createCanvas:f.createCanvas,nativeReviewOnly:true}),/unassigned text or image detail/);assert.ok(f.allocations.every(c=>c.width===0&&c.height===0));
});

test('independent overlapping cubic antialias contributions explain original ink without inventing text',async t=>{
 const f=await setup(t,`0 G 0 g q 1 0 0 1 600.13 600.27 cm .72 w ${circle(4,'S')} ${circle(4,'S')} ${circle(1.2,'f')} Q`),ids=f.ops.fnArray.flatMap((op,id)=>op===OPS.constructPath?[id]:[]),model=await inspectPdfElements({page:f.page,OPS,bounds,createCanvas:f.createCanvas,nativeReviewOnly:true});
 assert.equal(model.nativeReviewOnly,true);assert.deepEqual(model.elements.map(e=>e.id),ids);assert.equal(model.elements.length,3);assert.ok(model.elements.slice(0,2).every(e=>e.ink.some(Boolean)),'each overlaid stroke has actual visible AA contribution');
 const c=createCanvas(40,40);try{await f.page.render({canvas:c,canvasContext:c.getContext('2d',{willReadFrequently:true}),viewport:model.viewport.clone({offsetX:-model.box[0],offsetY:-model.box[1]})}).promise;assert.deepEqual((await model.render()).data,c.getContext('2d').getImageData(0,0,40,40).data);}finally{c.width=c.height=0;}assert.ok(f.allocations.every(c=>c.width===0&&c.height===0));
});

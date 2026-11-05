import test from 'node:test';
import assert from 'node:assert/strict';
import {getDocument,OPS} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {createCanvas} from '@napi-rs/canvas';
import {inspectPdfElements,elementAt} from '../apps/local/web/pdf-elements.mjs';
import {inkImage} from '../apps/local/web/matcher.mjs';
import {extractVectorPage,createVectorTemplate,findVectorMatches} from '../apps/local/web/vector-recognition.mjs';
// Independently authored literal PDF; no customer paths or coordinates.
const ring=x=>`q 1 0 0 1 ${x} 64 cm 1 0 0 RG 1 w 4 0 m 4 2.209139 2.209139 4 0 4 c -2.209139 4 -4 2.209139 -4 0 c -4 -2.209139 -2.209139 -4 0 -4 c 2.209139 -4 4 -2.209139 4 0 c h S Q`;
const pipe=x=>`.8 G 1 w ${x-15} 64 m ${x+15} 64 l S`;
function pdf(content){const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 128] /Resources << >> /Contents 4 0 R >>',`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`];let s='%PDF-1.4\n',offsets=[0];for(const[i,o]of objects.entries()){offsets.push(Buffer.byteLength(s));s+=`${i+1} 0 obj\n${o}\nendobj\n`;}const x=Buffer.byteLength(s);s+=`xref\n0 5\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${x}\n%%EOF`;return new Uint8Array(Buffer.from(s));}
async function open(t,content){const task=getDocument({data:pdf(content),isEvalSupported:false});t.after(()=>task.destroy());const page=await(await task.promise).getPage(1),ops=await page.getOperatorList(),canvases=[];return{page,ops,ids:ops.fnArray.flatMap((op,id)=>op===OPS.constructPath?[id]:[]),canvases,createCanvas:(w,h)=>{const c=createCanvas(w,h);canvases.push(c);return c;}};}
const bounds=[30,54,50,74];
async function originalCrop(page){const c=createCanvas(40,40);try{await page.render({canvas:c,canvasContext:c.getContext('2d',{willReadFrequently:true}),viewport:page.getViewport({scale:2,offsetX:-60,offsetY:-108})}).promise;return c.getContext('2d').getImageData(0,0,40,40).data;}finally{c.width=c.height=0;}}

test('independent faint source pipe remains an explicit native whole-path choice despite zero binary ink',async t=>{
 const f=await open(t,`${ring(40)} ${pipe(40)}`),model=await inspectPdfElements({page:f.page,OPS,bounds,createCanvas:f.createCanvas,nativeReviewOnly:true});
 assert.deepEqual(model.elements.map(e=>e.id),f.ids,'must not silently omit the faint original context operation');
 const faint=model.elements.find(e=>e.id===f.ids[1]);assert.equal(inkImage(faint.rgba.data,40,40).data.some(Boolean),false,'original faint pipe has no legacy binary ink');assert.ok(faint.rgba.data.some((v,i)=>i%4!==3&&v<255));assert.equal(elementAt(model.elements,36,20,40,40),f.ids[1],'visible faint exterior pipe is selectable');
 const reference=await open(t,ring(40));assert.deepEqual((await model.render([f.ids[1]])).data,await originalCrop(reference.page),'explicit whole-path exclusion equals independently authored no-pipe PDF');assert.notDeepEqual((await model.render()).data,await originalCrop(reference.page));assert.ok(f.canvases.every(c=>!c.width&&!c.height));
 const legacy=await open(t,`${ring(40)} ${pipe(40)}`),legacyModel=await inspectPdfElements({page:legacy.page,OPS,bounds,createCanvas:legacy.createCanvas});assert.deepEqual(legacyModel.elements.map(e=>e.id),[legacy.ids[0]],'existing small-page legacy binary inventory still omits faint pipe');assert.equal(elementAt(legacyModel.elements,36,20,40,40),null);for(const c of legacy.canvases)c.width=c.height=0;
});

test('independent additional faint internal detail still rejects a lookalike after explicit source-pipe exclusion',async t=>{
 const f=await open(t,`${ring(40)} ${pipe(40)} ${ring(100)} ${pipe(100)} ${ring(160)} ${pipe(160)} .8 G 1 w 160 62 m 160 66 l S`),vector=extractVectorPage({operatorList:f.ops,OPS});assert.equal(vector.supported,true,vector.reason);
 const template=createVectorTemplate(vector,{bounds,anchor:[40,64],ids:f.ids.slice(0,2),excluded:[f.ids[1]]});assert.equal(template.supported,true,template.reason);const hits=findVectorMatches(vector,template,{rotations:false});assert.deepEqual(hits.map(h=>h.x),[40,100]);assert.ok(!hits.some(h=>Math.abs(h.x-160)<1),'same gray internal bar cannot be discarded by colour');
});

test('independent fully covered faint context remains inventoried without a false hit target',async t=>{
 const f=await open(t,`.8 G 1 w 36 64 m 44 64 l S 1 g 35 63 10 2 re f ${ring(40)}`),model=await inspectPdfElements({page:f.page,OPS,bounds,createCanvas:f.createCanvas,nativeReviewOnly:true});
 assert.deepEqual(model.elements.map(e=>e.id),[f.ids[0],f.ids[2]]);assert.equal(model.elements.find(e=>e.id===f.ids[0]).ink.some(Boolean),false);assert.equal(elementAt(model.elements,20,20,40,40),null);await assert.rejects(model.render([f.ids[1]]),/Invalid excluded/);assert.ok(f.canvases.every(c=>!c.width&&!c.height));
});

test('independent faint operations retain 128 editable and 512 broad-phase bounds plus cancellation',async t=>{
 const paths=n=>Array.from({length:n},(_,i)=>`${31+i%17*.9} ${55+(Math.floor(i/17)%17)*.9} .2 .2 re f`).join(' ');
 for(const[n,pattern]of[[129,/too many elements/],[513,/512 candidate inspection budget/]]){const f=await open(t,`${ring(40)} .8 g ${paths(n)}`);await assert.rejects(inspectPdfElements({page:f.page,OPS,bounds,createCanvas:f.createCanvas,nativeReviewOnly:true}),pattern);assert.ok(f.canvases.every(c=>!c.width&&!c.height));}
 const f=await open(t,`${ring(40)} ${pipe(40)}`);await assert.rejects(inspectPdfElements({page:f.page,OPS,bounds,createCanvas:f.createCanvas,nativeReviewOnly:true,cancelled:()=>f.canvases.length>=3}),/cancel/);assert.ok(f.canvases.every(c=>!c.width&&!c.height));
});

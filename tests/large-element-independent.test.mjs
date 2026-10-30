import test from 'node:test';
import assert from 'node:assert/strict';
import {getDocument,OPS} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {createCanvas} from '@napi-rs/canvas';
import {inspectPdfElements,elementAt} from '../apps/local/web/pdf-elements.mjs';

// Independently declared literal PDF geometry; no customer drawing or matcher
// output defines this oracle. Large media triggers the bounded selection path.
const bounds=[90,90,130,130];
function documentBytes(content){
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 1200 1000] /Resources << >> /Contents 4 0 R >>',`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`];
 let pdf='%PDF-1.4\n';const offsets=[0];for(const [i,object]of objects.entries()){offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${object}\nendobj\n`;}
 const xref=Buffer.byteLength(pdf);pdf+=`xref\n0 5\n0000000000 65535 f \n${offsets.slice(1).map(n=>`${String(n).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;return new Uint8Array(Buffer.from(pdf));
}
async function setup(t,content){
 const task=getDocument({data:documentBytes(content),isEvalSupported:false});t.after(()=>task.destroy());const page=await(await task.promise).getPage(1),allocations=[];
 const factory=(w,h)=>{assert.ok(w*h<=1000000,'no full-resolution whole-page inspection canvas');const c=createCanvas(w,h);allocations.push(c);return c;};
 const model=await inspectPdfElements({page,OPS,bounds,createCanvas:factory});
 // Separate raw PDF.js rendering, without selection filters or editor metadata.
 const viewport=page.getViewport({scale:2,rotation:0}),canvas=createCanvas(80,80),ctx=canvas.getContext('2d');await page.render({canvas,canvasContext:ctx,viewport,transform:[1,0,0,1,-180,-1740]}).promise;
 const reference=ctx.getImageData(0,0,80,80);canvas.width=canvas.height=0;
 assert.deepEqual((await model.render()).data,reference.data,'editor must reproduce original RGBA exactly');
 assert.ok(allocations.every(c=>c.width<=1&&c.height<=1),'scratch surfaces disposed after each render');
 const index=(x,y)=>Math.floor((130-y)*2)*80+Math.floor((x-90)*2);
 return {model,index,reference};
}

test('independent nested even-odd and transformed clips retain holes, intersections and restored graphics state',async t=>{
 const {model,index}=await setup(t,'q 95 95 30 30 re 103 103 14 14 re W* n q 1 0 0 1 2 0 cm 91 91 28 38 re W n 0 g 80 80 60 60 re f Q Q 0 g 126 106 2 8 re f');
 assert.equal(model.elements.length,2);
 const [clipped,restored]=model.elements;
 assert.equal(clipped.ink[index(100,100)],1);
 assert.equal(clipped.ink[index(110,110)],0,'even-odd interior hole remains empty');
 assert.equal(clipped.ink[index(123,100)],0,'nested transformed clipping boundary intersects outer clip');
 assert.equal(restored.ink[index(127,110)],1,'Q restores prior clip for subsequent paint');
 const removed=await model.render([clipped.id]);assert.equal(removed.data[index(100,100)*4],255);assert.equal(removed.data[index(127,110)*4],0);
 assert.deepEqual((await model.render()).data,(await model.render([])).data);
});

test('independent concave clipping never exposes the bounding rectangle or wholly clipped paint',async t=>{
 const {model,index}=await setup(t,'q 95 95 m 125 95 l 125 105 l 105 105 l 105 125 l 95 125 l h W n 0 g 90 90 40 40 re f 112 112 4 4 re f Q');
 assert.equal(model.elements.length,1,'fully clipped second path is not an editable element');
 const element=model.elements[0];assert.equal(element.ink[index(100,120)],1);assert.equal(element.ink[index(120,100)],1);assert.equal(element.ink[index(120,120)],0);
 const blank=await model.render([element.id]);assert.ok(blank.data.every((v,i)=>i%4===3||v===255),'removal preserves structural clips without revealing a hidden rectangle');
});

test('independent colored-overpaint masks expose only each path contribution and preserve original paint order on removal',async t=>{
 const {model,index}=await setup(t,'0.8 0 0 rg 96 104 28 12 re f 0 g 110 104 14 12 re f');
 assert.equal(model.elements.length,2);const [red,black]=model.elements;
 assert.equal(red.ink[index(100,110)],1);assert.equal(red.ink[index(118,110)],0,'covered red portion is not a selectable hit target');assert.equal(black.ink[index(118,110)],1);
 assert.equal(elementAt(model.elements,(118-90)*2,(130-110)*2,80,80),black.id);
 const without=await model.render([black.id]),p=index(118,110)*4;
 assert.ok(without.data[p]>150&&without.data[p+1]===0&&without.data[p+2]===0,'removing black reveals the correctly clipped underlying red paint');
});

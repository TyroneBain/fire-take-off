import test from 'node:test';
import assert from 'node:assert/strict';
import {getDocument,OPS} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {createCanvas} from '@napi-rs/canvas';
import {inspectPdfElements,elementAt} from '../apps/local/web/pdf-elements.mjs';
import {inkImage} from '../apps/local/web/matcher.mjs';

// Original faint off-centre square: no customer paths or benchmark labels.
function pdf(content){
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Resources << >> /Contents 4 0 R >>',`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`];
 let s='%PDF-1.4\n',offsets=[];for(const [i,value]of objects.entries()){offsets.push(Buffer.byteLength(s));s+=`${i+1} 0 obj\n${value}\nendobj\n`;}const x=Buffer.byteLength(s);s+=`xref\n0 5\n0000000000 65535 f \n${offsets.map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${x}\n%%EOF`;return new Uint8Array(Buffer.from(s));
}
async function fixture(t,content){const task=getDocument({data:pdf(content),isEvalSupported:false});t.after(()=>task.destroy());const page=await(await task.promise).getPage(1),ops=await page.getOperatorList(),canvases=[];return{page,ids:ops.fnArray.flatMap((op,id)=>op===OPS.constructPath?[id]:[]),canvases,createCanvas:(w,h)=>{const c=createCanvas(w,h);canvases.push(c);return c;}};}
const bounds=[40,40,52,52];

test('independent native-only faint source opens despite zero binary pixels and uses crop midpoint',async t=>{
 const f=await fixture(t,'.85 g 43 44 2 2 re f'),model=await inspectPdfElements({page:f.page,OPS,bounds,createCanvas:f.createCanvas,nativeReviewOnly:true});
 assert.equal(model.nativeReviewOnly,true);assert.deepEqual(model.elements.map(e=>e.id),f.ids);assert.deepEqual(model.anchor,[12,12],'off-centre paint cannot move the native inspection anchor');
 const rgba=await model.render();assert.equal(inkImage(rgba.data,24,24).data.reduce((a,b)=>a+b,0),0,'fixture has fewer than the old eight binary-pixel requirement');assert.ok(model.elements[0].ink.some(Boolean));assert.equal(elementAt(model.elements,8,14,24,24),f.ids[0]);assert.ok(f.canvases.every(c=>!c.width&&!c.height));
});

test('independent same faint source retains legacy refusal and blank native selection remains refused',async t=>{
 const legacy=await fixture(t,'.85 g 43 44 2 2 re f');await assert.rejects(inspectPdfElements({page:legacy.page,OPS,bounds,createCanvas:legacy.createCanvas}),/more visible detail/);for(const c of legacy.canvases)c.width=c.height=0;
 const blank=await fixture(t,'1 g 43 44 2 2 re f');await assert.rejects(inspectPdfElements({page:blank.page,OPS,bounds,createCanvas:blank.createCanvas,nativeReviewOnly:true}),/unassigned|visible|paths/);assert.ok(blank.canvases.every(c=>!c.width&&!c.height));
});

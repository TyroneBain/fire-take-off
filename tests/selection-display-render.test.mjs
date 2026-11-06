import test from 'node:test';
import assert from 'node:assert/strict';
import {getDocument,OPS} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {createCanvas} from '@napi-rs/canvas';
import {inspectPdfElements} from '../apps/local/web/pdf-elements.mjs';

// Original curved vector symbol, a crossing pipe, structural clip and white
// overpaint. No customer drawing or stored matcher output is used as an oracle.
function pdf({pipe=true}={}){
 const stream=`q 38 38 24 24 re W n ${pipe?'.7 G .35 w 25 50 m 75 50 l S ':''}0 G .6 w 57 50 m 57 53.866 53.866 57 50 57 c 46.134 57 43 53.866 43 50 c 43 46.134 46.134 43 50 43 c 53.866 43 57 46.134 57 50 c S 1 g 41 49 1 2 re f Q`;
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Resources << >> /Contents 4 0 R >>',`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
 let text='%PDF-1.4\n',offsets=[];for(const [i,o]of objects.entries()){offsets.push(text.length);text+=`${i+1} 0 obj\n${o}\nendobj\n`;}const x=text.length;text+=`xref\n0 5\n0000000000 65535 f \n${offsets.map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${x}\n%%EOF\n`;return new Uint8Array(Buffer.from(text));
}
async function open(t,options){const task=getDocument({data:pdf(options),isEvalSupported:false});t.after(()=>task.destroy());return(await task.promise).getPage(1);}
async function directCrop(page,width=640,height=640){
 const canvas=createCanvas(width,height);try{
  // Independently construct the viewport from PDF crop [40,40,60,60].
  const viewport=page.getViewport({scale:width/20,rotation:0,offsetX:-40*width/20,offsetY:-40*width/20});
  await page.render({canvas,canvasContext:canvas.getContext('2d'),viewport}).promise;return canvas.getContext('2d').getImageData(0,0,width,height);
 }finally{canvas.width=canvas.height=0;}
}
async function inspect(t,options={}){const page=await open(t),allocations=[];const model=await inspectPdfElements({page,OPS,bounds:[40,40,60,60],nativeReviewOnly:true,createCanvas:(w,h)=>{const c=createCanvas(w,h);allocations.push(c);return c;},...options});return{page,model,allocations};}

test('native display rerenders original curves at requested resolution rather than enlarging inspection pixels',async t=>{
 const {model,allocations}=await inspect(t),base=await model.render(),ids=model.elements.map(e=>e.id),originalMasks=model.elements.map(e=>e.ink.slice()),before={width:model.width,height:model.height,box:[...model.box],anchor:[...model.anchor]};
 const high=await model.renderDisplay([],{width:640,height:640}),reference=await directCrop(await open(t));
 assert.deepEqual(high.data,reference.data,'screen-resolution pixels equal an independent original-PDF render');assert.equal(high.width,640);assert.equal(high.height,640);
 let differs=0;for(let y=0;y<640;y++)for(let x=0;x<640;x++){const a=(y*640+x)*4,b=(Math.floor(y/16)*40+Math.floor(x/16))*4;for(let c=0;c<3;c++)if(high.data[a+c]!==base.data[b+c]){differs++;break;}}
 assert.ok(differs>1000,'native curved edges are not stretched nearest-neighbour pixels');
 assert.deepEqual({width:model.width,height:model.height,box:model.box,anchor:model.anchor},before);assert.deepEqual(model.elements.map(e=>e.id),ids);assert.deepEqual(model.elements.map(e=>e.ink),originalMasks);assert.deepEqual((await model.render()).data,base.data);
 assert.ok(allocations.every(c=>c.width===0&&c.height===0),'all scratch display surfaces released');
});

test('high-resolution removal retains original clips and white paint, and restoration is exact',async t=>{
 const {model}=await inspect(t),pipe=model.elements[0].id,original=await model.renderDisplay([],{width:640,height:640}),removed=await model.renderDisplay([pipe],{width:640,height:640}),reference=await directCrop(await open(t,{pipe:false}));
 assert.deepEqual(removed.data,reference.data,'whole-path exclusion equals an independently authored no-pipe original');assert.notDeepEqual(removed.data,original.data);assert.deepEqual((await model.renderDisplay([],{width:640,height:640})).data,original.data);
});

test('display validation and cancellation allocate no oversized surfaces and never change base selections',async t=>{
 let cancelled=false;const {model,allocations}=await inspect(t,{cancelled:()=>cancelled}),count=allocations.length;
 for(const size of [{width:0,height:40},{width:2049,height:1},{width:1001,height:1000},{width:40.5,height:40},{width:NaN,height:40}])await assert.rejects(model.renderDisplay([],size),/display exceeds/);
 await assert.rejects(model.renderDisplay([999999],{width:100,height:100}),/Invalid excluded/);assert.equal(allocations.length,count);
 cancelled=true;await assert.rejects(model.renderDisplay([],{width:100,height:100}),/cancel/);assert.equal(allocations.length,count);
});

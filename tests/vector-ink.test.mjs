import test from 'node:test';
import assert from 'node:assert/strict';
import {getDocument,OPS} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {createCanvas} from '@napi-rs/canvas';
import {vectorScaleQaFixture} from '../scripts/vector-scale-qa-fixture.mjs';
import {extractVectorPage,createVectorTemplate,findVectorMatches,VECTOR_SCALE_RANGE} from '../apps/local/web/vector-recognition.mjs';
import {vectorInkMask} from '../apps/local/web/vector-ink.mjs';
import {inkImage} from '../apps/local/web/matcher.mjs';
async function fixture(t){const f=vectorScaleQaFixture(),task=getDocument({data:new Uint8Array(f.bytes),isEvalSupported:false});t.after(()=>task.destroy());const page=await(await task.promise).getPage(1),vectorPage=extractVectorPage({operatorList:await page.getOperatorList(),OPS}),template=createVectorTemplate(vectorPage,{bounds:f.manifest.selection,ids:[5,6,7,8,13],excluded:[13],anchor:f.manifest.seed}),hits=findVectorMatches(vectorPage,template,{scaleRange:VECTOR_SCALE_RANGE}),viewport=page.getViewport({scale:2,rotation:0}),canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height)),ctx=canvas.getContext('2d');await page.render({canvas,canvasContext:ctx,viewport}).promise;const image=inkImage(ctx.getImageData(0,0,canvas.width,canvas.height).data,canvas.width,canvas.height);return {page,vectorPage,hits,viewport,image};}
test('actual target vector ink matches filtered PDF.js glyphs across16 scaled/rotated symbols and crossing pipes',async t=>{
 const f=await fixture(t);assert.equal(f.hits.length,16);let coloured=0,oracleInk=0;
 for(const hit of f.hits){const mask=vectorInkMask({...f,hit,createCanvas});assert.ok(mask,`mask at ${hit.x},${hit.y}`);const canvas=createCanvas(mask.width,mask.height),ctx=canvas.getContext('2d'),ids=new Set(hit.elementIds);
  await f.page.render({canvas,canvasContext:ctx,viewport:f.viewport,transform:[1,0,0,1,-mask.left,-mask.top],operationsFilter:(id,ops)=>ops.fnArray[id]!==OPS.constructPath||ids.has(id)}).promise;
  const oracle=inkImage(ctx.getImageData(0,0,mask.width,mask.height).data,mask.width,mask.height);let falseColour=0,missed=0;
  for(let y=0;y<mask.height;y++)for(let x=0;x<mask.width;x++){const i=y*mask.width+x,target=f.image.data[(mask.top+y)*f.image.width+mask.left+x],expected=oracle.data[i]&target;assert.ok(!mask.data[i]||target,'never colour paper or invented pixels');falseColour+=mask.data[i]&&!expected?1:0;missed+=expected&&!mask.data[i]?1:0;coloured+=mask.data[i];oracleInk+=expected;}
  assert.equal(falseColour,0,`no glyph-external pipe colour at ${hit.x},${hit.y}`);assert.equal(missed,0,`exact filtered oracle at ${hit.x},${hit.y}`);
 }
 t.diagnostic(JSON.stringify({symbols:16,colouredPixels:coloured,oraclePixels:oracleInk,scope:'Original synthetic vector PDF only; all four orientations/scales and crossing linework'}));
});
test('unknown identities, missing commands, text ambiguity, invalid geometry and resource budgets return explicit fallback',async t=>{
 const f=await fixture(t),hit=f.hits[0],call=overrides=>vectorInkMask({...f,hit,createCanvas,...overrides});
 assert.equal(call({hit:{...hit,elementIds:[999999]}}),null);assert.equal(call({hit:{...hit,elementIds:[hit.elementIds[0],hit.elementIds[0]]}}),null);
 assert.equal(call({hit:{...hit,score:.9}}),null);assert.equal(call({viewport:null}),null);assert.equal(call({vectorPage:{supported:true}}),null);assert.equal(call({vectorPage:{...f.vectorPage,elements:[...f.vectorPage.elements,f.vectorPage.elements[0]]}}),null);assert.equal(call({vectorPage:{...f.vectorPage,supported:false}}),null);
 const missing=structuredClone(f.vectorPage);delete missing.elements.find(e=>e.id===hit.elementIds[0]).pathCommands;assert.equal(call({vectorPage:missing}),null);
 const malformed=structuredClone(f.vectorPage);malformed.elements.find(e=>e.id===hit.elementIds[0]).pathCommands=[0,NaN,10];assert.equal(call({vectorPage:malformed}),null);
 assert.equal(call({vectorPage:{...f.vectorPage,textRegions:[[70,70,90,90]]}}),null);assert.equal(call({maxPixels:1}),null);
 assert.equal(call({image:{...f.image,data:new Uint8Array(f.image.data.length)}}),null,'no drawing ink must never create a coloured synthetic glyph');
});
test('extraction preserves explicit path boundaries and rejects unsafe compound close-stroke or unbounded moves',()=>{
 const commands=[0,10,10,1,20,10,0,20,10,1,20,20],ops=paint=>({fnArray:[OPS.constructPath],argsArray:[[paint,[new Float32Array(commands)],[10,10,20,20]]]});
 const open=extractVectorPage({operatorList:ops(OPS.stroke),OPS});assert.equal(open.supported,true);assert.deepEqual(open.elements[0].pathCommands,commands);assert.equal(open.elements[0].paintClosesPath,false);
 const compound=extractVectorPage({operatorList:ops(OPS.closeStroke),OPS});assert.equal(compound.supported,false);assert.match(compound.reason,/Compound close/);
 const huge=Array.from({length:5000},()=>[0,1,1]).flat();const bounded=extractVectorPage({operatorList:{fnArray:[OPS.constructPath],argsArray:[[OPS.stroke,[new Float32Array(huge)],[0,0,1,1]]]},OPS});assert.equal(bounded.supported,false);assert.match(bounded.reason,/command budget/);
});
function pathFixture(content){const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 180 180] /Resources << >> /Contents 4 0 R >>',`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`];let pdf='%PDF-1.4\n';const offsets=[0];for(const [i,o]of objects.entries()){offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${o}\nendobj\n`;}const xref=Buffer.byteLength(pdf);pdf+=`xref\n0 5\n0000000000 65535 f \n${offsets.slice(1).map(o=>`${String(o).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;return new Uint8Array(Buffer.from(pdf));}
test('actual PDF caps, joins, meeting subpaths and explicit vs implicit closure reproduce their drawn ink',async()=>{
 const samples=[
  '0 G 3 w 0 J 0 j 40 40 m 80 40 l 80 40 m 80 80 l S',
  '0 G 3 w 1 J 1 j 40 40 m 80 40 l 80 80 l S',
  '0 G 3 w 2 J 2 j 40 40 m 80 40 l 80 80 l S',
  '0 G 3 w 0 J 0 j 40 40 m 80 40 l 80 80 l s',
  '0 G 0 g 3 w 2 J 2 j 40 40 m 80 40 l 80 80 l B',
  '0 G 3 w 1 J 1 j 40 40 m 45 90 90 45 100 100 c S',
 ];
 for(const content of samples){const task=getDocument({data:pathFixture(content),isEvalSupported:false});try{const page=await(await task.promise).getPage(1),vectorPage=extractVectorPage({operatorList:await page.getOperatorList(),OPS});assert.equal(vectorPage.supported,true,vectorPage.reason);const viewport=page.getViewport({scale:2,rotation:90}),canvas=createCanvas(viewport.width,viewport.height),ctx=canvas.getContext('2d');await page.render({canvas,canvasContext:ctx,viewport}).promise;const image=inkImage(ctx.getImageData(0,0,canvas.width,canvas.height).data,canvas.width,canvas.height),hit={x:70,y:70,score:1,elementIds:vectorPage.elements.map(e=>e.id)},mask=vectorInkMask({vectorPage,hit,viewport,image,createCanvas});assert.ok(mask,content);let total=0;for(let y=0;y<mask.height;y++)for(let x=0;x<mask.width;x++){const expected=image.data[(mask.top+y)*image.width+mask.left+x];assert.equal(mask.data[y*mask.width+x],expected,content);total+=expected;}assert.ok(total>8);}finally{await task.destroy();}}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {getDocument,OPS} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {createCanvas} from '@napi-rs/canvas';
import polygonBoolean from 'polygon-clipping';
import {extractVectorPage,createVectorTemplate,findVectorMatches} from '../apps/local/web/vector-recognition.mjs';
import {extractRawPathProvenance} from '../apps/local/web/vector-paint-provenance.mjs';

// Original QA geometry and labels declared before evaluating the new helper.
// All positive stems have exactly the same continuous painted union. Source
// erasure does not authorize arbitrary extra details sharing its black colour.
export const localContextQaCases=Object.freeze([
 {id:'source',x:24,positive:true,context:'whole'},
 {id:'abutting-pieces',x:64,positive:true,context:'abutting'},
 {id:'overlapping-pieces',x:104,positive:true,context:'overlap'},
 {id:'reverse-traversal',x:144,positive:true,context:'reverse'},
 {id:'compound-pieces',x:184,positive:true,context:'compound'},
 {id:'extra-dot',x:224,positive:false,context:'abutting',extra:'2 2 1 1 re f'},
 {id:'extra-bar',x:264,positive:false,context:'abutting',extra:'-3 2 6 1 re f'},
 {id:'extra-loop',x:304,positive:false,context:'abutting',extra:'.4 w -2 1 4 3 re S'},
 {id:'filled-centre',x:344,positive:false,context:'abutting',extra:'-2 -2 4 4 re f'},
 {id:'missing-quadrant',x:384,positive:false,context:'abutting',missing:true},
]);
const ring=missing=>'1 0 0 RG 1 w 6 0 m 6 3.3137085 3.3137085 6 0 6 c -3.3137085 6 -6 3.3137085 -6 0 c -6 -3.3137085 -3.3137085 -6 0 -6 c '+(missing?'S':'3.3137085 -6 6 -3.3137085 6 0 c h S');
const contexts={whole:'-.5 -16 1 16 re f',abutting:'-.5 -16 1 12 re f -.5 -4 1 4 re f',overlap:'-.5 -16 1 14 re f -.5 -4 1 4 re f',reverse:'-.5 -16 m -.5 0 l .5 0 l .5 -16 l h f',compound:'-.5 -16 1 12 re -.5 -4 1 4 re f'};
function makePdf(content){
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 410 80] /Resources << >> /Contents 4 0 R >>',`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`];
 let out='%PDF-1.4\n',offsets=[0];for(const[i,o]of objects.entries()){offsets.push(Buffer.byteLength(out));out+=`${i+1} 0 obj\n${o}\nendobj\n`;}const x=Buffer.byteLength(out);out+=`xref\n0 5\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${x}\n%%EOF`;return new Uint8Array(Buffer.from(out));
}
export function localContextQaPdf(){return makePdf(localContextQaCases.map(c=>`q 1 0 0 1 ${c.x} 40 cm 0 g 0 G ${contexts[c.context]} ${ring(c.missing)} 0 g 0 G ${c.extra??''} Q`).join('\n'));}
async function fixture(t){
 const task=getDocument({data:localContextQaPdf(),isEvalSupported:false});t.after(()=>task.destroy());const page=await(await task.promise).getPage(1),operatorList=await page.getOperatorList(),vector=extractVectorPage({operatorList,OPS});assert.equal(vector.supported,true,vector.reason);
 const source=vector.elements.filter(e=>e.bounds[0]<32),ids=source.map(e=>e.id),excluded=source.filter(e=>e.style.fill!==null).map(e=>e.id);assert.equal(ids.length,2);assert.equal(excluded.length,1);
 const selection={bounds:[16,32,32,48],anchor:[24,40],ids,excluded},template=createVectorTemplate(vector,selection);assert.equal(template.supported,true,template.reason);const raw=extractRawPathProvenance({operatorList,OPS,ids:vector.elements.map(e=>e.id),viewportTransform:Array.from(page.getViewport({scale:2}).transform)});assert.equal(raw.failures.length,0);return{page,vector,selection,template,records:raw.records};
}
test('independent original context fixture freezes five equivalent bodies and five different classes',async t=>{
 const f=await fixture(t);assert.equal(localContextQaCases.filter(c=>c.positive).length,5);const baseline=findVectorMatches(f.vector,f.template,{rotations:false});
 // Existing whole-operation matcher is a baseline, not an oracle for labels.
 for(const hit of baseline)assert.ok(localContextQaCases.some(c=>c.positive&&Math.abs(c.x-hit.x)<.05));
 t.diagnostic(JSON.stringify({strictBaseline:baseline.map(h=>h.x),positiveAnchors:localContextQaCases.filter(c=>c.positive).map(c=>[c.x,40]),scope:'Original synthetic geometry; no real-drawing acceptance claim'}));
});

function contextInput(f,c){
 const sourceElements=f.vector.elements.filter(e=>f.selection.excluded.includes(e.id)),targetElements=f.vector.elements.filter(e=>e.bounds[0]>=c.x-8&&e.bounds[2]<=c.x+8&&e.style.stroke!=='#ff0000');
 return{sourceElements,targetElements,sourceExcludedIds:[...f.selection.excluded],sourceRecords:f.records.filter(r=>sourceElements.some(e=>e.id===r.id)),targetRecords:f.records.filter(r=>targetElements.some(e=>e.id===r.id)),sourceTransform:[1,0,0,1,c.x-24,0],polygonBoolean};
}
test('independent context equivalence tolerates subdivision while keeping original whole-paint identity and uncertainty',async t=>{
 const {compareLocalContext}=await import('../apps/local/web/vector-local-context.mjs'),f=await fixture(t),before=structuredClone({vector:f.vector,records:f.records}),outcomes=[];
 for(const c of localContextQaCases.filter(c=>!c.missing)){
  const input=contextInput(f,c),r=compareLocalContext(input);outcomes.push({id:c.id,supported:r.supported,equivalent:r.equivalent,reason:r.reason});
  if(c.positive){assert.equal(r.supported,true,c.id+': '+r.reason);assert.equal(r.equivalent,true,c.id);assert.equal(r.requiresOriginalPaintVerification,true);assert.equal(r.requiresSemanticReview,true);assert.equal('score' in r,false);assert.deepEqual([...r.explainedTargetIds].sort((a,b)=>a-b),input.targetElements.map(e=>e.id).sort((a,b)=>a-b));}
  else assert.notEqual(r.equivalent,true,c.id+' is a different visible class, not authorized source context');
 }
 assert.deepEqual({vector:f.vector,records:f.records},before,'Derived comparison must not rewrite original source/target geometry');
 t.diagnostic(JSON.stringify({outcomes,scope:'Context comparison only; missing-quadrant remains independently rejected by body matcher, and no automatic count is authorized without original visibility proof'}));
});
test('independent local context refuses missing provenance, unapproved IDs, cancellation and exhausted work',async t=>{
 const{compareLocalContext}=await import('../apps/local/web/vector-local-context.mjs'),f=await fixture(t),input=contextInput(f,localContextQaCases[1]);
 for(const change of [{sourceExcludedIds:[]},{targetRecords:[]},{sourceRecords:input.sourceRecords.map(r=>({...r,opaque:false}))},{targetRecords:input.targetRecords.map(r=>({...r,optionalContentVisible:false}))},{cancelled:()=>true},{maxWork:1}]){const r=compareLocalContext({...input,...change});assert.equal(r.supported,false,JSON.stringify(Object.keys(change)));assert.notEqual(r.equivalent,true);assert.ok(r.reason);}
});
test('independent context holes and unrelated merged tails cannot become equivalent through bounds clipping or union',async t=>{
 const{compareLocalContext}=await import('../apps/local/web/vector-local-context.mjs'),f=await fixture(t),input=contextInput(f,localContextQaCases[0]);
 const controls=[
  {id:'wrong-context-colour',path:'1 0 0 rg -.5 -16 1 16 re f'},
  {id:'evenodd-hole',path:'-.5 -16 1 16 re -.2 -10 .4 2 re f*'},
  {id:'nonzero-hole',path:'-.5 -16 1 16 re -.2 -10 m -.2 -8 l .2 -8 l .2 -10 l h f'},
  {id:'merged-remote-tail',path:'-.5 -16 1 16 re 9 -4 6 1 re f'},
 ];
 for(const c of controls){const task=getDocument({data:makePdf(`q 1 0 0 1 24 40 cm 0 g ${c.path} Q`),isEvalSupported:false});try{const page=await(await task.promise).getPage(1),operatorList=await page.getOperatorList(),vector=extractVectorPage({operatorList,OPS});assert.equal(vector.supported,true,vector.reason);const raw=extractRawPathProvenance({operatorList,OPS,ids:vector.elements.map(e=>e.id),viewportTransform:Array.from(page.getViewport({scale:2}).transform)});assert.equal(raw.failures.length,0);const r=compareLocalContext({...input,targetElements:vector.elements,targetRecords:raw.records});assert.notEqual(r.equivalent,true,c.id);assert.ok(r.supported===true||typeof r.reason==='string');}finally{await task.destroy();}}
});
test('independent actual PDF render confirms split and overlapping stems retain the same visible symbol',async t=>{
 // Render each original at the SAME transform; translated cubic control points
 // can round differently in the renderer and are not a pixel-equality oracle.
 let source;for(const c of localContextQaCases){const task=getDocument({data:makePdf(`q 1 0 0 1 24 40 cm 0 g 0 G ${contexts[c.context]} ${ring(c.missing)} 0 g 0 G ${c.extra??''} Q`),isEvalSupported:false}),canvas=createCanvas(1640,320);try{const page=await(await task.promise).getPage(1);await page.render({canvas,canvasContext:canvas.getContext('2d',{willReadFrequently:true}),viewport:page.getViewport({scale:4})}).promise;const pixels=canvas.getContext('2d').getImageData(64,128,64,104).data;if(c.id==='source')source=pixels;else if(c.positive)assert.deepEqual(pixels,source,c.id);else assert.notDeepEqual(pixels,source,c.id);}finally{canvas.width=canvas.height=0;await task.destroy();}}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {getDocument,OPS} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {createCanvas,loadImage} from '@napi-rs/canvas';
import {vectorScaleQaFixture} from '../scripts/vector-scale-qa-fixture.mjs';
import {setupCountInk,vectorHitIndex} from '../apps/local/web/count-ink.mjs';
import {matchRequestResult} from '../apps/local/web/match-worker.mjs';
import {ELEMENT_RENDERER} from '../apps/local/web/pdf-elements.mjs';
import {VECTOR_SCALE_VERSION} from '../apps/local/web/vector-recognition.mjs';

function scenario(searchOverride){
 const fixture=vectorScaleQaFixture(),drawing={id:'owned',digest:fixture.manifest.sha256},example={id:'example',version:1,example:{drawing_id:drawing.id,digest:drawing.digest,page:1,bounds:fixture.manifest.selection,algorithm:VECTOR_SCALE_VERSION,elements:{renderer:ELEMENT_RENDERER,ids:[5,6,7,8,13],excluded:[13]}}};
 const marks=fixture.manifest.labels.map(p=>({id:p.id,drawing_id:drawing.id,page:1,x:p.x,y:p.y,origin:'automatic',included:1,example_id:example.id}));
 const state={drawings:[drawing],countExamples:[example],countMarks:marks},context={drawing,pageNumber:1,viewport:{},state};let searches=0,renders=0,ready=0;
 const controller=setupCountInk({context:()=>context,pdfjs:{OPS,getDocument(){renders++;return getDocument({data:new Uint8Array(fixture.bytes),isEvalSupported:false});}},createCanvas,onReady:()=>ready++,searchVector:async request=>{searches++;assert.equal(request.vectorOnly,true);assert.equal(request.rgba,undefined);assert.equal(request.template.matchScales,true);return searchOverride?searchOverride(request):matchRequestResult(request);}});
 return {controller,context,state,marks,example,stats:()=>({searches,renders,ready})};
}
async function alphaAt(mask,x,y){const image=await loadImage(mask.url),canvas=createCanvas(mask.width,mask.height),ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);const [px,py]=mask.viewport.convertToViewportPoint(x,y),ix=Math.floor(px-mask.left),iy=Math.floor(py-mask.top);return ix<0||iy<0||ix>=mask.width||iy>=mask.height?0:ctx.getImageData(ix,iy,1,1).data[3];}

test('live overlay preparation colours all16 scaled/rotated glyphs using one verified worker query and leaves quantities untouched',async()=>{
 const s=scenario(),before=structuredClone(s.state);await s.controller.prepare();assert.deepEqual(s.state,before);assert.equal(s.stats().searches,1);assert.equal(s.stats().renders,2);
 for(const mark of s.marks){const mask=s.controller.get(mark);assert.ok(mask,mark.id);assert.match(mask.url,/^data:image\/png;base64,/);assert.ok(mask.score>=.95);assert.equal(mask.data,undefined);}
 const small=s.controller.get(s.marks.find(m=>m.id==='s0.8-r0')),large=s.controller.get(s.marks.find(m=>m.id==='s1.2-r0'));assert.ok(large.width>small.width);
 assert.equal(await alphaAt(small,80,180),0,'crossing pipe through the empty symbol centre must remain uncoloured');
 await s.controller.prepare();assert.equal(s.stats().searches,1,'unchanged page must reuse masks');
 const changed=s.marks[0];changed.included=0;await s.controller.prepare();assert.equal(s.controller.get(changed),null);assert.equal(s.stats().searches,1);
 assert.equal(s.controller.get({...s.marks[1],origin:'manual'}),null,'manual marks retain their explicit marker');
 s.example.version++;await s.controller.prepare();assert.equal(s.stats().searches,2,'saved selection changes invalidate verified hits');
});

test('failed vector overlay search is bounded once per selection and keeps scaled outlines instead of invented glyphs',async()=>{
 const s=scenario(()=>{throw Error('Vector matching budget exceeded');}),before=structuredClone(s.state);await s.controller.prepare();assert.equal(s.stats().searches,1);assert.deepEqual(s.state,before);
 assert.equal(s.controller.get(s.marks.find(m=>m.id==='s1.2-r0')),null);assert.ok(s.controller.get(s.marks.find(m=>m.id==='s1-r90')),'existing same-size raster alignment remains available');
});

test('native-anchor lookup is strict, spatial, and ambiguous candidates never choose arbitrary target elements',()=>{
 const a={x:10,y:20,elementIds:[1]},b={x:11,y:21,elementIds:[2]},index=vectorHitIndex([a,b]);
 assert.equal(index.at(10,20),a);assert.equal(index.at(10.499,20.499),a);assert.equal(index.at(10.5,20),null);assert.equal(index.at(NaN,20),null);
 assert.equal(vectorHitIndex([a,{...a,x:10.1,elementIds:[3]}]).at(10,20),null);assert.equal(vectorHitIndex([a,a]).at(10,20),null);
 assert.throws(()=>vectorHitIndex(Array(5001).fill(a)),/budget/);assert.throws(()=>vectorHitIndex([{x:NaN,y:0}]),/anchor/);
});

test('vector-only overlay requests never use raster data on unsupported pages or text-overlap fallback',async()=>{
 const s=scenario(request=>{const unavailable=matchRequestResult({...request,vectorPage:{supported:false,reason:'unsupported test page'}});assert.deepEqual(unavailable,{matches:[],engine:'none',fallbackReason:'unsupported test page'});
  const textOverlap=matchRequestResult({...request,vectorPage:{...request.vectorPage,textRegions:[[70,70,90,90]]}});assert.equal(textOverlap.engine,'none');assert.deepEqual(textOverlap.matches,[]);assert.match(textOverlap.fallbackReason,/overlaps text/);return textOverlap;
 });await s.controller.prepare();assert.equal(s.stats().searches,1);assert.equal(s.controller.get(s.marks.find(m=>m.id==='s1.2-r0')),null);
});

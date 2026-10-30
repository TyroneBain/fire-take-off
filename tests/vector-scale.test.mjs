import test from 'node:test';
import assert from 'node:assert/strict';
import {getDocument,OPS} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {vectorScaleQaFixture} from '../scripts/vector-scale-qa-fixture.mjs';
import {extractVectorPage,createVectorTemplate,findVectorMatches,VECTOR_SCALE_RANGE,VECTOR_SCALE_VERSION,VECTOR_SCALE_FIXED_VERSION} from '../apps/local/web/vector-recognition.mjs';
async function corpus(t){const f=await vectorScaleQaFixture(),task=getDocument({data:new Uint8Array(f.bytes),isEvalSupported:false});t.after(()=>task.destroy());const p=await(await task.promise).getPage(1),page=extractVectorPage({operatorList:await p.getOperatorList(),OPS}),template=createVectorTemplate(page,{bounds:[67,69,93,91],anchor:[80,80],ids:[5,6,7,8,13],excluded:[13]});assert.ok(page.supported&&template.supported);return {page,template};}
test('uniform scale policy is explicit; saved same-size calls retain their exact results and input identities',async t=>{
 const {page,template}=await corpus(t),before=structuredClone({page,template}),baseline=findVectorMatches(page,template);
 assert.equal(baseline.length,4);assert.ok(baseline.every(h=>!Object.hasOwn(h,'scale')));
 const scaled=findVectorMatches(page,template,{scaleRange:VECTOR_SCALE_RANGE});assert.equal(scaled.length,16);
 assert.ok(scaled.some(h=>Math.abs(h.scale-1.13)<1e-6),'continuous scale inference must not use a fixed preset list');
 assert.deepEqual(findVectorMatches(page,template),baseline);assert.deepEqual({page,template},before);
 assert.deepEqual(VECTOR_SCALE_RANGE,[.75,1.5]);assert.ok(Object.isFrozen(VECTOR_SCALE_RANGE));
 assert.equal(VECTOR_SCALE_VERSION,'vector-elements-scale-1');assert.equal(VECTOR_SCALE_FIXED_VERSION,'vector-elements-scale-fixed-1');
});
test('scale matching preserves fixed orientation when requested and scales off-centre native anchors',async t=>{
 const {page,template}=await corpus(t),shifted={...template,anchor:[81,82]},fixed=findVectorMatches(page,shifted,{rotations:false,scaleRange:VECTOR_SCALE_RANGE});assert.equal(fixed.length,4);
 for(const [scale,y]of [[1,80],[.8,180],[1.2,280],[1.13,380]])assert.ok(fixed.some(h=>Math.hypot(h.x-(80+scale),h.y-(y+2*scale))<1e-6));
 const rotated=findVectorMatches(page,shifted,{scaleRange:VECTOR_SCALE_RANGE});assert.equal(rotated.length,16);
 assert.ok(rotated.some(h=>h.rotation===90&&Math.hypot(h.x-(220-2*1.2),h.y-(280+1.2))<1e-6));
});
test('scale ranges, cancellation and work budgets fail atomically without relaxing saved defaults',async t=>{
 const {page,template}=await corpus(t);
 for(const scaleRange of [[],[.4,1.5],[.8,2.1],[1.1,1.5],[.8,.9],[NaN,1.5],'auto',true])assert.throws(()=>findVectorMatches(page,template,{scaleRange}),/scale range/);
 assert.throws(()=>findVectorMatches(page,template,{scaleRange:VECTOR_SCALE_RANGE,maxComparisons:1}),/budget/);
 assert.throws(()=>findVectorMatches(page,template,{scaleRange:VECTOR_SCALE_RANGE,cancelled:()=>true}),/cancelled/);
 assert.equal(findVectorMatches(page,template).length,4);
});
test('new scaled candidates retain whole-page text visibility fallback',async t=>{
 const {page,template}=await corpus(t),target={...page,textRegions:[[70,170,90,190]]};
 assert.equal(findVectorMatches(target,template).length,4,'same-size policy has no candidate at scaled text site');
 assert.throws(()=>findVectorMatches(target,template,{scaleRange:VECTOR_SCALE_RANGE}),error=>error.code==='VECTOR_TEXT_OVERLAP');
});

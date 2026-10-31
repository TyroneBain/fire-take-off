import test from 'node:test';
import assert from 'node:assert/strict';
import {getDocument,OPS} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {vectorPoseQaFixture} from '../scripts/vector-pose-qa-fixture.mjs';
import {extractVectorPage,createVectorTemplate,findVectorMatches} from '../apps/local/web/vector-recognition.mjs';

async function fixture(t){const f=vectorPoseQaFixture(),task=getDocument({data:new Uint8Array(f.bytes),isEvalSupported:false});t.after(()=>task.destroy());const doc=await task.promise,vectors=[];for(let n=1;n<=doc.numPages;n++){const p=await doc.getPage(n);vectors.push(extractVectorPage({operatorList:await p.getOperatorList(),OPS}));}return {...f,vectors};}
test('independent actual symmetric PDF retains one stable original anchor per physical head across quarter turns',async t=>{
 const f=await fixture(t),page=f.vectors[0],template=createVectorTemplate(page,{bounds:f.manifest.selection,anchor:f.manifest.anchor}),before=structuredClone(page),zero=findVectorMatches(page,template,{rotations:false}),all=findVectorMatches(page,template);assert.ok(template.supported,template.reason);assert.equal(zero.length,3);assert.equal(all.length,3,'four equivalent poses cannot produce four counts for one pair of paint IDs');assert.deepEqual(all,zero,'canonical first orientation preserves exact anchors and IDs used by saved corrections');
 for(const [i,h]of all.entries()){assert.ok(Math.hypot(h.x-f.manifest.labels[i].x,h.y-f.manifest.labels[i].y)<1e-6);assert.equal(h.rotation,0);assert.equal(h.elementIds.length,2);}
 assert.equal(new Set(all.map(h=>h.elementIds.join(','))).size,3);assert.deepEqual(page,before);assert.deepEqual(findVectorMatches(page,template),all);t.diagnostic(JSON.stringify({fixtureSha256:f.manifest.sha256,physicalHeads:3,proposals:all.length,originalAnchorPreserved:true}));
});
test('independent nearby distinct physical paint identities survive symmetry deduplication',async t=>{
 const f=await fixture(t),page=f.vectors[1],c=f.manifest.nearby;assert.equal(page.elements.length,2);const template=createVectorTemplate(page,{bounds:c.selection,anchor:c.anchor,ids:[page.elements[0].id]}),zero=findVectorMatches(page,template,{rotations:false}),all=findVectorMatches(page,template);assert.equal(zero.length,2);assert.equal(all.length,2);assert.deepEqual(all,zero);assert.deepEqual(all.map(h=>h.elementIds[0]).sort((a,b)=>a-b),page.elements.map(e=>e.id).sort((a,b)=>a-b),'nearby but distinct original paint operations cannot collapse together');
});

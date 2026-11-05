import test from 'node:test';
import assert from 'node:assert/strict';
import {getDocument,OPS} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {extractVectorPage,createVectorTemplate,findVectorMatches} from '../apps/local/web/vector-recognition.mjs';

// Original PDF: a nearly symmetric glyph has an exactly rotated target whose
// 0-degree pose can also fit after registration. The saved off-centre anchor
// must continue to use the pre-existing 90-degree pose.
function bytes(duplicate=false){
 const glyph=(x,dx)=>`.2 w ${x-4} 16 8 8 re S ${x-1+dx} 19.03 2 2 re f`;
 const content=`${glyph(20,.03)} ${duplicate?'19.03 19.03 2 2 re f':''} ${glyph(80,-.03)} ${duplicate?'78.97 19.03 2 2 re f':''}`;
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 110 50] /Resources << >> /Contents 4 0 R >>',`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`];
 let pdf='%PDF-1.4\n';const offsets=[0];for(const[i,o]of objects.entries()){offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${o}\nendobj\n`;}const start=Buffer.byteLength(pdf);pdf+=`xref\n0 5\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;return new Uint8Array(Buffer.from(pdf));
}
async function input(t,duplicate=false){
 const task=getDocument({data:bytes(duplicate),isEvalSupported:false});t.after(()=>task.destroy());
 const page=extractVectorPage({operatorList:await(await(await task.promise).getPage(1)).getOperatorList(),OPS});assert.equal(page.supported,true,page.reason);
 const template=createVectorTemplate(page,{bounds:[15,15,25,25],anchor:[20.7,20.4],ids:page.elements.slice(0,duplicate?3:2).map(e=>e.id),excluded:duplicate?[page.elements[2].id]:[]});assert.equal(template.supported,true,template.reason);return{page,template};
}
test('all legacy orientations precede registration and preserve existing rotated native anchor',async t=>{
 const{page,template}=await input(t),before=structuredClone({page,template}),fixed=findVectorMatches(page,template,{rotations:false}),hits=findVectorMatches(page,template);
 assert.equal(fixed.length,2,'The new registered zero-degree pose really is feasible');assert.equal(fixed[1].rotation,0);
 assert.equal(hits.length,2);const target=hits.find(h=>h.x>50);assert.equal(target.rotation,90,'Existing exact quarter-turn wins globally over new zero-degree fit');
 assert.ok(Math.abs(target.x-79.6)<1e-6);assert.ok(Math.abs(target.y-20.7)<1e-6);assert.deepEqual(target.elementIds,page.elements.slice(2).map(e=>e.id));
 assert.equal(new Set(hits.map(h=>h.elementIds.join(','))).size,2);assert.deepEqual(findVectorMatches(page,template),hits);assert.deepEqual({page,template},before);
});
test('registration refuses ambiguous whole-operation assignment even with an explicitly erased duplicate',async t=>{
 const{page,template}=await input(t,true),hits=findVectorMatches(page,template,{rotations:false});
 assert.equal(hits.length,1);assert.deepEqual(hits[0].elementIds,template.elements.map(e=>e.id));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {getDocument,OPS} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {extractVectorPage,createVectorTemplate,findVectorMatches} from '../apps/local/web/vector-recognition.mjs';

// Original symmetric glyphs. Their off-centre selection anchor deliberately
// yields four separated pose anchors for exactly the same painted operations.
function fixture(){
 const glyph=(x,y,s=1)=>`q ${s} 0 0 ${s} ${x} ${y} cm .2 w -4 -4 8 8 re S -2 -2 4 4 re S Q`;
 const content=[glyph(20,20),glyph(31,20),glyph(70,20,1.25)].join('\n');
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 60] /Resources << >> /Contents 4 0 R >>',`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`];
 let pdf='%PDF-1.4\n';const offsets=[0];for(const [i,o]of objects.entries()){offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${o}\nendobj\n`;}
 const xref=Buffer.byteLength(pdf);pdf+=`xref\n0 5\n0000000000 65535 f \n${offsets.slice(1).map(o=>`${String(o).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;return new Uint8Array(Buffer.from(pdf));
}
async function corpus(t){
 const task=getDocument({data:fixture(),isEvalSupported:false});t.after(()=>task.destroy());
 const pdf=await task.promise,page=extractVectorPage({operatorList:await(await pdf.getPage(1)).getOperatorList(),OPS});assert.equal(page.supported,true);
 const template=createVectorTemplate(page,{bounds:[15,15,25,25],anchor:[21,22],ids:page.elements.slice(0,2).map(e=>e.id)});assert.equal(template.supported,true);return{page,template};
}
test('symmetric whole paint identities emit once despite off-centre quarter-turn anchors',async t=>{
 const{page,template}=await corpus(t),before=structuredClone({page,template}),fixed=findVectorMatches(page,template,{rotations:false}),rotated=findVectorMatches(page,template);
 assert.equal(fixed.length,2);assert.deepEqual(fixed.map(h=>[h.x,h.y]),[[21,22],[32,22]],'nearby distinct paint sets retain their native anchors');
 assert.deepEqual(rotated,fixed,'first deterministic orientation represents each original paint set');
 assert.deepEqual(findVectorMatches(page,template),rotated);assert.deepEqual({page,template},before);
});
test('identity deduplication spans scaled poses without merging distinct instances',async t=>{
 const{page,template}=await corpus(t),options={scaleRange:[.75,1.5]},fixed=findVectorMatches(page,template,{...options,rotations:false}),rotated=findVectorMatches(page,template,options);
 assert.equal(fixed.length,3);assert.deepEqual(rotated,fixed);assert.equal(new Set(rotated.map(h=>JSON.stringify(h.elementIds))).size,3);
 assert.deepEqual(rotated.map(h=>[h.x,h.y,h.rotation,h.scale]),[[21,22,0,1],[32,22,0,1],[71.25,22.5,0,1.25]]);
});
test('pose identity bookkeeping retains atomic cancellation and comparison budgets',async t=>{
 const{page,template}=await corpus(t);
 assert.throws(()=>findVectorMatches(page,template,{cancelled:()=>true}),/cancelled/);
 assert.throws(()=>findVectorMatches(page,template,{maxComparisons:1}),/budget/);
 assert.equal(findVectorMatches(page,template,{rotations:false}).length,2);
});

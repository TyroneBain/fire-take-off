import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {getDocument,OPS} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {openStore} from '../apps/local/store.mjs';
import {vectorMultipageQaFixture} from '../scripts/vector-multipage-qa-fixture.mjs';
import {ELEMENT_RENDERER} from '../apps/local/web/pdf-elements.mjs';

// Persistence-only assertions; this test does not claim matcher accuracy.
async function fixture(t){
 const directory=await mkdtemp(join(tmpdir(),'native-create-')),store=await openStore(directory);
 t.after(async()=>{store.close();await rm(directory,{recursive:true,force:true});});
 const p=store.create('project',null,'Native creation'),takeoff=store.create('takeoff',p.id,'Takeoff'),discipline=store.create('discipline',takeoff.id,'Fire');
 const bytes=vectorMultipageQaFixture().bytes,drawing=await store.importPdf(discipline.id,'original.pdf',bytes),task=getDocument({data:new Uint8Array(bytes),isEvalSupported:false});let ids;
 try{const list=await(await(await task.promise).getPage(1)).getOperatorList();ids=list.fnArray.flatMap((op,i)=>op===OPS.constructPath?[i]:[]);}finally{await task.destroy();}
 const decisions=[{x:40,y:40,rotation:0,elementIds:[ids[2],ids[3]],contextIds:[],included:true,reviewed:false},{x:110,y:40,rotation:180,elementIds:[ids[4],ids[5]],contextIds:[],included:true,reviewed:true},{x:180,y:40,rotation:0,elementIds:[ids[6],ids[7]],contextIds:[],included:false,reviewed:true}];
 const example={drawing_id:drawing.id,page:1,bounds:[34,34,46,46],digest:drawing.digest,algorithm:'vector-paint-review-4',elements:{renderer:ELEMENT_RENDERER,ids:[ids[0],ids[2],ids[3]],excluded:[ids[0]]},vectorReview:{version:'vector-paint-review-4',matchPolicy:'selected-geometry-1',sourceContextIds:[],scope:'explicit-pages',anchor:[40,40],decision:'apply',layerPolicy:'all-admitted',pages:[{drawing_id:drawing.id,page:1,digest:drawing.digest,layerScope:{mode:'all-admitted'},decisions,provenance:{engine:'vector-pattern-review-3',visibility:'contour-paint-visibility-4',requestedPaints:ids.length,admittedPaints:ids.length,unknownCount:0,excludedCount:0,proposalCount:4,verifiedCount:4,pendingCount:1,selectedCount:2}}]}};
 const matches=decisions.filter(d=>d.included).map(d=>({drawing_id:drawing.id,page:1,digest:drawing.digest,x:d.x,y:d.y,score:1}));return {directory,store,discipline,drawing,example,matches};
}
test('native creation persists only decisions, protects explicit accepts and leaves baseline results unreviewed',async t=>{
 const f=await fixture(t),item=f.store.createCount(f.discipline.id,{name:'Heads',color:'#168a90',example:f.example,matches:f.matches}),s=f.store.snapshot();
 assert.equal(s.countExamples.length,1);assert.equal(s.countMarks.length,3);assert.deepEqual(s.countMarks.map(m=>[m.x,m.included,m.reviewed]).sort((a,b)=>a[0]-b[0]),[[40,1,0],[110,1,1],[180,0,1]]);
 assert.equal(s.countMarks.reduce((n,m)=>n+m.quantity,0),2);assert.equal(s.countEvents.length,2);assert.equal(s.countItems[0].id,item.id);
});
test('pending-only native drafts create neither empty headings nor empty examples',async t=>{
 const f=await fixture(t),empty=structuredClone(f.example),page=empty.vectorReview.pages[0];page.decisions=[];page.provenance.selectedCount=0;page.provenance.pendingCount=4;
 let before=f.store.snapshot();assert.throws(()=>f.store.createCount(f.discipline.id,{name:'Pending',example:empty,matches:[]}),/before saving/);assert.deepEqual(f.store.snapshot(),before);
 const item=f.store.createCount(f.discipline.id,{name:'Existing'});before=f.store.snapshot();assert.throws(()=>f.store.addCountExample(item.id,{version:item.version,example:empty,matches:[]}),/before saving/);assert.deepEqual(f.store.snapshot(),before);
});
test('adding a native example preserves existing correction bytes and rejects a stale target heading',async t=>{
 const f=await fixture(t),item=f.store.createCount(f.discipline.id,{name:'Existing'}),manual=f.store.addManualMark(item.id,{drawing_id:f.drawing.id,page:1,x:40,y:40});let before=f.store.snapshot();
 assert.throws(()=>f.store.addCountExample(item.id,{version:99,example:f.example,matches:f.matches}),/Heading changed/);assert.deepEqual(f.store.snapshot(),before);
 f.store.addCountExample(item.id,{version:before.countItems[0].version,example:f.example,matches:f.matches});const after=f.store.snapshot();assert.deepEqual(after.countMarks.find(m=>m.id===manual.id),before.countMarks.find(m=>m.id===manual.id));assert.equal(after.countMarks.find(m=>m.x===110).reviewed,1);assert.equal(after.countMarks.length,3);
});
test('failed native acceptance audit rolls back the entire new heading and selection',async t=>{
 const f=await fixture(t),before=f.store.snapshot(),db=new DatabaseSync(join(f.directory,'projects.sqlite'));
 try{db.exec("CREATE TRIGGER fail_native_creation BEFORE INSERT ON count_events BEGIN SELECT RAISE(ABORT,'native audit failed'); END");assert.throws(()=>f.store.createCount(f.discipline.id,{name:'Heads',example:f.example,matches:f.matches}),/native audit failed/);assert.deepEqual(f.store.snapshot(),before);}finally{db.close();}
});

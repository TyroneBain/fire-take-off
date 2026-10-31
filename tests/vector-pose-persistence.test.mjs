import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {getDocument,OPS} from 'pdfjs-dist/legacy/build/pdf.mjs';
import ExcelJS from 'exceljs';
import {vectorPoseQaFixture} from '../scripts/vector-pose-qa-fixture.mjs';
import {extractVectorPage,createVectorTemplate,VECTOR_MATCHER_VERSION} from '../apps/local/web/vector-recognition.mjs';
import {matchRequestResult} from '../apps/local/web/match-worker.mjs';
import {ELEMENT_RENDERER} from '../apps/local/web/pdf-elements.mjs';
import {openStore} from '../apps/local/store.mjs';
import {quantityWorkbook} from '../apps/local/workbook.mjs';

async function inputs(t,{legacy=false}={}){
 const fixture=vectorPoseQaFixture(),task=getDocument({data:new Uint8Array(fixture.bytes),isEvalSupported:false});t.after(()=>task.destroy());
 const page=await(await task.promise).getPage(1),vectorPage=extractVectorPage({operatorList:await page.getOperatorList(),OPS});
 const bounds=legacy?[34,34,48.4,48.6]:fixture.manifest.selection,anchor=legacy?[41.2,41.3]:fixture.manifest.anchor,vector=createVectorTemplate(vectorPage,{bounds,anchor});assert.equal(vector.supported,true,vector.reason);
 const search=(rotations=true)=>matchRequestResult({vectorOnly:true,vectorPage,template:{vector,matchRotations:rotations}}).matches;
 const directory=await mkdtemp(join(tmpdir(),'fire-pose-integrity-'));let store=await openStore(directory);t.after(async()=>{store.close();await rm(directory,{recursive:true,force:true});});
 const project=store.create('project',null,'Original pose integrity'),takeoff=store.create('takeoff',project.id,'Takeoff'),discipline=store.create('discipline',takeoff.id,'Fire'),drawing=await store.importPdf(discipline.id,'owned-symmetric.pdf',fixture.bytes);
 const match=h=>({drawing_id:drawing.id,digest:drawing.digest,page:1,x:h.x,y:h.y,score:h.score??1}),elements={renderer:ELEMENT_RENDERER,ids:vector.elements.map(e=>e.id),excluded:[]},definition={drawing_id:drawing.id,digest:drawing.digest,page:1,bounds,algorithm:VECTOR_MATCHER_VERSION,elements};
 return {fixture,search,match,definition,drawing,discipline,takeoff,get store(){return store;},async reopen(){store.close();store=await openStore(directory);}};
}
function rerun(f,exampleId,matches,rotations=true){const state=f.store.snapshot(),example=state.countExamples.find(e=>e.id===exampleId);return f.store.editCountSelection(exampleId,{version:example.version,rotations,matches:matches.map(f.match),scope:[{id:f.drawing.id,digest:f.drawing.digest}],expected_marks:state.countMarks.filter(m=>m.example_id===exampleId).map(m=>({id:m.id,version:m.version}))});}
async function workbookTotal(state,takeoff){const book=new ExcelJS.Workbook();await book.xlsx.load((await quantityWorkbook(state,takeoff)).bytes);let total=0;book.getWorksheet('Count instances').eachRow((row,n)=>{if(n>1)total+=row.getCell(17).value;});return total;}

test('one mark per symmetric head survives worker, corrections, overlapping zones, colour, Excel and reopen',async t=>{
 const f=await inputs(t),hits=f.search();assert.equal(hits.length,3);assert.deepEqual(hits,f.search(false),'first pose and anchor must remain identical when rotations are enabled');
 const item=f.store.createCount(f.discipline.id,{name:'Heads',color:'#d48b24',example:f.definition,matches:hits.map(f.match)}),other=f.store.createCount(f.discipline.id,{name:'Reclassified heads',color:'#168a90'}),example=f.store.snapshot().countExamples[0];
 const marks=f.store.snapshot().countMarks.sort((a,b)=>a.x-b.x);assert.equal(marks.length,3);
 f.store.updateMark(marks[0].id,{version:marks[0].version,included:false,reviewed:true});f.store.updateMark(marks[1].id,{version:marks[1].version,included:true,reviewed:true,item_id:other.id});
 f.store.addManualMark(item.id,{drawing_id:f.drawing.id,page:1,x:180,y:70});
 const west=f.store.createZoneHeading(f.discipline.id,{name:'West'}),east=f.store.createZoneHeading(f.discipline.id,{name:'East'});
 f.store.createZone(f.drawing.id,{heading_id:west.id,page:1,points:[[0,0],[110,0],[110,100],[0,100]]});f.store.createZone(f.drawing.id,{heading_id:east.id,page:1,points:[[90,0],[200,0],[200,100],[90,100]]});
 const before=f.store.snapshot(),protectedMarks=before.countMarks.filter(m=>m.reviewed);
 for(const rotations of [false,true,true]){
  const result=rerun(f,example.id,f.search(rotations),rotations);assert.deepEqual([result.added,result.removed,result.skipped],[0,0,3]);
  const state=f.store.snapshot();for(const m of protectedMarks)assert.deepEqual(state.countMarks.find(n=>n.id===m.id),m);assert.deepEqual(state.zones,before.zones);assert.deepEqual(state.zoneHeadings,before.zoneHeadings);assert.equal(state.countItems.find(i=>i.id===item.id).color,'#d48b24');
 }
 for(const heading of [item,other])f.store.reviewMarks(heading.id,f.store.snapshot().countMarks.filter(m=>m.item_id===heading.id).map(m=>({id:m.id,version:m.version,included:!!m.included,reviewed:true})));
 const state=f.store.snapshot();assert.equal(state.countMarks.length,4);assert.equal(state.countMarks.filter(m=>m.included).length,3);assert.equal(state.quantitySchedule.reduce((n,r)=>n+r.value,0),3);
 const quantity=heading=>state.quantitySchedule.filter(r=>r.heading_id===heading.id).reduce((n,r)=>n+r.value,0);assert.equal(quantity(west),1);assert.equal(quantity(east),2);assert.equal(await workbookTotal(state,f.takeoff.id),3);
 await f.reopen();assert.deepEqual(f.store.snapshot(),state);
});

test('rerun removes obsolete unchecked legacy poses but never erases an explicit reviewed decision',async t=>{
 const f=await inputs(t,{legacy:true});
 // The historical four quarter-turn anchors of each symmetric physical glyph.
 // These are original fixture placements, not outputs from the corrected code.
 const legacy=f.fixture.manifest.labels.flatMap(label=>[[1.2,1.3],[-1.3,1.2],[-1.2,-1.3],[1.3,-1.2]].map(([dx,dy])=>({x:label.centre[0]+dx,y:label.centre[1]+dy,score:1})));
 const item=f.store.createCount(f.discipline.id,{name:'Legacy heads',example:f.definition,matches:legacy.map(f.match)}),example=f.store.snapshot().countExamples[0],initial=f.store.snapshot().countMarks;
 assert.equal(initial.length,12);const rejected=initial.find(m=>Math.abs(m.x-38.7)<1e-6&&Math.abs(m.y-41.2)<1e-6);assert.ok(rejected);
 f.store.updateMark(rejected.id,{version:rejected.version,included:false,reviewed:true});const protectedMark=f.store.snapshot().countMarks.find(m=>m.id===rejected.id),hits=f.search();assert.equal(hits.length,3);
 const result=rerun(f,example.id,hits);assert.deepEqual([result.added,result.removed,result.skipped],[0,8,3]);
 let state=f.store.snapshot();assert.equal(state.countMarks.length,4);assert.deepEqual(state.countMarks.find(m=>m.id===rejected.id),protectedMark);
 assert.equal(state.countSelectionEvents.at(-1).current.retained_corrections.includes(rejected.id),true);
 f.store.reviewMarks(item.id,state.countMarks.map(m=>({id:m.id,version:m.version,included:!!m.included,reviewed:true})));state=f.store.snapshot();assert.equal(await workbookTotal(state,f.takeoff.id),3);
 await f.reopen();assert.deepEqual(f.store.snapshot(),state);
});

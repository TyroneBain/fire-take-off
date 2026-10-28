import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import ExcelJS from 'exceljs';
import {openStore} from '../apps/local/store.mjs';
import {quantityWorkbook} from '../apps/local/workbook.mjs';
import {visibleCountHeadings} from '../apps/local/web/count-headings.mjs';
async function workspace(t){
 const directory=await mkdtemp(join(tmpdir(),'fire-move-selection-')),store=await openStore(directory);t.after(()=>{store.close();return rm(directory,{recursive:true,force:true});});
 execFileSync(process.execPath,['scripts/generate-drawing-fixture.mjs',join(directory,'fixture')]);const bytes=await readFile(join(directory,'fixture','small-vector.pdf'));
 const p=store.create('project',null,'Owned movement'),takeoff=store.create('takeoff',p.id,'Original'),discipline=store.create('discipline',takeoff.id,'Fire'),drawing=await store.importPdf(discipline.id,'Owned.pdf',bytes),hit=(x,y=100)=>({drawing_id:drawing.id,page:1,x,y,digest:drawing.digest,score:1}),example={drawing_id:drawing.id,page:1,bounds:[90,90,110,110],digest:drawing.digest,algorithm:'binary-overlap-1'};
 const matches=[hit(100),hit(200),hit(300),hit(100,200),hit(200,200),hit(300,200)],source=store.createCount(discipline.id,{name:'Source',example,matches}),target=store.createCount(discipline.id,{name:'Target'}),selection=store.snapshot().countExamples[0];
 const input=destination=>{const s=store.snapshot(),e=s.countExamples.find(e=>e.id===selection.id);return {version:e.version,item_version:s.countItems.find(i=>i.id===e.item_id).version,destination_id:destination.id,destination_version:s.countItems.find(i=>i.id===destination.id).version,expected_marks:s.countMarks.filter(m=>m.example_id===e.id).map(m=>({id:m.id,version:m.version}))};};
 return {directory,store,drawing,discipline,takeoff,source,target,selection,hit,matches,input};
}
test('whole-selection movement preserves corrections, factors and original identity; later recounts do not duplicate reclassified marks',async t=>{
 const {store,drawing,discipline,source,target,selection,hit,matches,input}=await workspace(t),third=store.createCount(discipline.id,{name:'Correction'});
 const sorted=store.snapshot().countMarks.sort((a,b)=>a.y-b.y||a.x-b.x);store.updateMark(sorted[0].id,{version:1,included:false,reviewed:true});store.updateMark(sorted[1].id,{version:1,included:true,reviewed:true,item_id:third.id});store.updateCountMultiplier(selection.id,{version:1,multiplier:3});
 const manual=store.addManualMark(source.id,{drawing_id:drawing.id,page:1,x:400,y:300}),other=store.addCountExample(target.id,{version:1,example:{...selection.example,bounds:[190,90,210,110]},matches:[hit(450,300)]});
 const before=store.snapshot(),result=store.moveCountSelection(selection.id,input(target)),after=store.snapshot();assert.equal(result.moved,5);assert.equal(result.retained,1);assert.equal(after.countExamples.find(e=>e.id===selection.id).multiplier,3);
 for(const old of before.countMarks){const now=after.countMarks.find(m=>m.id===old.id);assert.deepEqual(now,{...old,...(old.example_id===selection.id&&old.item_id===source.id?{item_id:target.id,version:old.version+1}:{})});}
 assert.deepEqual(after.countItems.find(i=>i.id===target.id).example,before.countItems.find(i=>i.id===target.id).example);assert.equal(after.countMarks.find(m=>m.id===manual.id).item_id,source.id);
 const e=after.countExamples.find(e=>e.id===selection.id),recount=store.editCountSelection(e.id,{version:e.version,elements:{renderer:'pdfjs-6.4.299-paths-1',ids:[13,14,15],excluded:[15]},matches,scope:[{id:drawing.id,digest:drawing.digest}],expected_marks:input(target).expected_marks});assert.equal(recount.added,0);assert.equal(recount.removed,0);assert.equal(store.snapshot().countMarks.length,before.countMarks.length);
 const updated=store.snapshot(),again=store.addCountExample(target.id,{version:updated.countItems.find(i=>i.id===target.id).version,example:updated.countExamples.find(e=>e.id===selection.id).example,matches});assert.equal(again.added,0);assert.equal(again.skipped,6);assert.equal(store.snapshot().countMarks.filter(m=>m.item_id===third.id).length,1);assert.equal(store.snapshot().countSelectionMoves.length,1);
});
test('empty moved-from headings hide without losing original names and reappear on a round-trip move',async t=>{
 const {store,source,target,selection,input,discipline}=await workspace(t),empty=store.createCount(discipline.id,{name:'Manual empty'}),before=store.snapshot();
 store.moveCountSelection(selection.id,input(target));let s=store.snapshot();assert.deepEqual(visibleCountHeadings(s,discipline.id).map(i=>i.id).sort(),[target.id,empty.id].sort());assert.equal(s.countItems.find(i=>i.id===source.id).name,'Source');assert.ok(s.countMarks.every(m=>m.original_item_id===source.id));
 store.moveCountSelection(selection.id,input(source));s=store.snapshot();assert.deepEqual(visibleCountHeadings(s,discipline.id).map(i=>i.id).sort(),[source.id,empty.id].sort());assert.ok(s.countMarks.every(m=>m.item_id===source.id&&m.original_item_id===source.id));assert.deepEqual(s.drawings,before.drawings);
 const unchanged=store.snapshot();assert.equal(store.moveCountSelection(selection.id,input(source)).moved,0);assert.deepEqual(store.snapshot(),unchanged);
});
test('movement rejects stale snapshots, cross-discipline targets, collisions and duplicate definitions without partial writes',async t=>{
 const {store,takeoff,source,target,selection,input,drawing}=await workspace(t),body=input(target),before=store.snapshot();
 for(const patch of [{version:99},{item_version:99},{destination_version:99},{destination_id:null},{expected_marks:[]},{expected_marks:[null]},{expected_marks:body.expected_marks.map(m=>({...m,version:99}))},{expected_marks:[...body.expected_marks,body.expected_marks[0]]}]){assert.throws(()=>store.moveCountSelection(selection.id,{...body,...patch}));assert.deepEqual(store.snapshot(),before);}
 const d=store.create('discipline',takeoff.id,'Other'),outside=store.createCount(d.id,{name:'Outside'});assert.throws(()=>store.moveCountSelection(selection.id,input(outside)),/another discipline/);
 store.addManualMark(target.id,{drawing_id:drawing.id,page:1,x:100,y:100});let saved=store.snapshot();assert.throws(()=>store.moveCountSelection(selection.id,input(target)),{status:409});assert.deepEqual(store.snapshot(),saved);
 const twin=store.createCount(source.discipline_id,{name:'Duplicate',example:selection.example});saved=store.snapshot();assert.throws(()=>store.moveCountSelection(selection.id,input(twin)),/already has this selection/);assert.deepEqual(store.snapshot(),saved);
 const full=store.createCount(source.discipline_id,{name:'Full'});for(let n=0;n<50;n++)store.addCountExample(full.id,{version:store.snapshot().countItems.find(i=>i.id===full.id).version,example:{...selection.example,bounds:[10+n,10,15+n,15]},matches:[]});saved=store.snapshot();assert.throws(()=>store.moveCountSelection(selection.id,input(full)),/50 examples/);assert.deepEqual(store.snapshot(),saved);
});
test('movement audit failure rolls back source, target, example, marks and per-instance events',async t=>{
 const {store,directory,target,selection,input}=await workspace(t),before=store.snapshot(),db=new DatabaseSync(join(directory,'projects.sqlite'));
 try{db.exec("CREATE TRIGGER fail_move BEFORE INSERT ON count_selection_moves BEGIN SELECT RAISE(ABORT,'movement audit unavailable'); END");assert.throws(()=>store.moveCountSelection(selection.id,input(target)),/movement audit unavailable/);assert.deepEqual(store.snapshot(),before);}finally{db.close();}
});
test('movement provenance survives deletion and appears in the correct workbook with original/current names',async t=>{
 const {store,source,target,selection,input,takeoff,directory}=await workspace(t);store.reviewMarks(source.id,store.snapshot().countMarks.map(m=>({id:m.id,version:m.version,included:true,reviewed:true})));store.moveCountSelection(selection.id,input(target));
 const state=store.snapshot(),out=await quantityWorkbook(state,takeoff.id),book=new ExcelJS.Workbook();await book.xlsx.load(out.bytes);assert.equal(book.getWorksheet('Selection moves').getCell('C2').value,'Source');assert.equal(book.getWorksheet('Selection moves').getCell('D2').value,'Target');assert.equal(book.getWorksheet('Selection moves').getCell('E2').value,6);assert.equal(book.getWorksheet('Count instances').getCell('L2').value,'Source');assert.equal(book.getWorksheet('Count instances').getCell('B2').value,'Target');assert.notEqual((await quantityWorkbook({...state,countSelectionMoves:[]},takeoff.id)).snapshotDigest,out.snapshotDigest);
 store.deleteCountSelection(selection.id,input(target));const after=store.snapshot();assert.equal(after.countSelectionMoves.length,1);const deletedBook=new ExcelJS.Workbook();await deletedBook.xlsx.load((await quantityWorkbook(after,takeoff.id)).bytes);assert.equal(deletedBook.getWorksheet('Selection moves').rowCount,2);
 store.close();store.close=()=>{};const reopened=await openStore(directory);try{assert.deepEqual(reopened.snapshot(),after);}finally{reopened.close();}
});
test('schema 13 migration preserves prior state and historical-only references do not make headings visible',async t=>{
 const {store,directory}=await workspace(t),before=store.snapshot();store.close();store.close=()=>{};const db=new DatabaseSync(join(directory,'projects.sqlite'));db.exec('DROP TABLE count_selection_moves;UPDATE schema_version SET version=13');db.close();const reopened=await openStore(directory);try{assert.deepEqual(reopened.snapshot(),before);}finally{reopened.close();}
 const state={countItems:[{id:'old',discipline_id:'d'},{id:'manual',discipline_id:'d'},{id:'outside',discipline_id:'other'}],countSelectionMoves:[{source_item_id:'old'}],countMarks:[{item_id:'new',original_item_id:'old'}],countExamples:[]};assert.deepEqual(visibleCountHeadings(state,'d').map(i=>i.id),['manual']);state.countMarks.push({item_id:'old',included:0});assert.deepEqual(visibleCountHeadings(state,'d').map(i=>i.id),['old','manual']);
});
test('move HTTP route checks token and input and rejects stale replay',async t=>{
 const {directory,store,target,selection,input}=await workspace(t),{startApp}=await import('../apps/local/server.mjs'),app=await startApp({directory,port:0});
 try{const token=(await(await fetch(app.origin+'/api/session')).json()).token,request=(body,auth=true)=>fetch(`${app.origin}/api/examples/${selection.id}/move`,{method:'PATCH',headers:{'Content-Type':'application/json',...(auth?{'X-Fire-Token':token}:{})},body:JSON.stringify(body)}),body=input(target);
 assert.equal((await request(body,false)).status,403);for(const value of [null,[]])assert.equal((await request(value)).status,400);assert.equal((await request(body)).status,200);assert.equal((await request(body)).status,409);const state=await(await fetch(app.origin+'/api/state')).json();assert.equal(state.countSelectionMoves.length,1);assert.ok(state.countMarks.every(m=>m.item_id===target.id));
 }finally{await app.close();}
});

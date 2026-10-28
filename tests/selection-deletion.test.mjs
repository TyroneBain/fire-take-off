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

async function workspace(t){
 const directory=await mkdtemp(join(tmpdir(),'fire-delete-selection-')),store=await openStore(directory);t.after(()=>{store.close();return rm(directory,{recursive:true,force:true});});
 execFileSync(process.execPath,['scripts/generate-drawing-fixture.mjs',join(directory,'fixture')]);
 const bytes=await readFile(join(directory,'fixture','small-vector.pdf')),p=store.create('project',null,'Original deletion fixture'),takeoff=store.create('takeoff',p.id,'Original'),discipline=store.create('discipline',takeoff.id,'Fire'),a=await store.importPdf(discipline.id,'Original.pdf',bytes);
 execFileSync(process.execPath,['scripts/generate-drawing-fixture.mjs',join(directory,'revision'),'revision']);const b=await store.importPdf(discipline.id,'Revision.pdf',await readFile(join(directory,'revision','small-vector.pdf')));
 const hit=(d,x,y=100)=>({drawing_id:d.id,page:1,x,y,digest:d.digest,score:1}),example={drawing_id:a.id,page:1,bounds:[90,90,110,110],algorithm:'binary-overlap-1',digest:a.digest};
 const item=store.createCount(discipline.id,{name:'Heads',example,matches:[hit(a,100),hit(a,200),hit(a,300),hit(b,100),hit(b,200),hit(b,300)]}),selection=store.snapshot().countExamples[0];
 const input=()=>({version:store.snapshot().countExamples.find(e=>e.id===selection.id).version,item_version:store.snapshot().countItems.find(i=>i.id===item.id).version,expected_marks:store.snapshot().countMarks.filter(m=>m.example_id===selection.id).map(m=>({id:m.id,version:m.version}))});
 return {directory,store,takeoff,discipline,a,b,hit,item,selection,input};
}
test('deletion removes only its attributed matches across drawings and archives reviews, edits and factors',async t=>{
 const {store,a,b,hit,item,selection,input,discipline}=await workspace(t),destination=store.createCount(discipline.id,{name:'Moved'});
 store.updateCountMultiplier(selection.id,{version:1,multiplier:3});
 store.editCountSelection(selection.id,{version:2,elements:{renderer:'pdfjs-6.4.299-paths-1',ids:[13,14,15],excluded:[15]},matches:[hit(a,100),hit(a,200),hit(a,300),hit(b,100),hit(b,200),hit(b,300)],scope:[a,b].map(d=>({id:d.id,digest:d.digest})),expected_marks:input().expected_marks});
 const original=store.snapshot().countMarks.filter(m=>m.example_id===selection.id).sort((a,b)=>a.x-b.x||a.drawing_id.localeCompare(b.drawing_id));
 store.updateMark(original[0].id,{version:1,included:true,reviewed:true});store.updateMark(original[1].id,{version:1,included:false,reviewed:true});store.updateMark(original[2].id,{version:1,included:true,reviewed:true,item_id:destination.id});
 store.addManualMark(item.id,{drawing_id:a.id,page:1,x:400,y:200});
 const second=store.addCountExample(item.id,{version:input().item_version,example:{...selection.example,bounds:[190,90,210,110]},matches:[hit(a,450,300)]});
 const before=store.snapshot(),unrelated=before.countMarks.filter(m=>m.example_id!==selection.id),result=store.deleteCountSelection(selection.id,input()),after=store.snapshot();
 assert.deepEqual(result,{deleted:true,id:selection.id,removed:6,pruned_heading:false});assert.deepEqual(after.countMarks,unrelated);assert.deepEqual(after.countExamples,before.countExamples.filter(e=>e.id!==selection.id));
 assert.deepEqual(after.countItems.find(i=>i.id===item.id).example,after.countExamples.find(e=>e.id===second.example_id).example);
 const audit=after.countSelectionDeletions[0];assert.equal(audit.previous.marks.length,6);assert.equal(audit.previous.reviews.length,3);assert.equal(audit.previous.edits.length,1);assert.equal(audit.previous.factors.length,1);assert.equal(audit.previous.selection.multiplier,3);assert.equal(audit.previous.pruned_heading,false);
 assert.deepEqual(after.drawings,before.drawings);assert.equal(after.countSelectionEvents.length,0);assert.equal(after.countExampleEvents.length,0);assert.equal(after.countEvents.length,0);
});
test('last unused heading is pruned while deletion history, source and workbook provenance survive reopen',async t=>{
 const {store,directory,item,selection,input,takeoff}=await workspace(t);store.updateCoverage('items',item.id,{version:1,radius:7.5});store.updateCountMultiplier(selection.id,{version:1,multiplier:2});
 const result=store.deleteCountSelection(selection.id,input());assert.equal(result.pruned_heading,true);const saved=store.snapshot();assert.equal(saved.countItems.length,0);assert.equal(saved.countMarks.length,0);assert.equal(saved.countSelectionDeletions[0].previous.coverage.length,1);
 const out=await quantityWorkbook(saved,takeoff.id),book=new ExcelJS.Workbook();await book.xlsx.load(out.bytes);const sheet=book.getWorksheet('Deleted selections');assert.equal(sheet.getCell('G2').value,6);assert.equal(sheet.getCell('H2').value,12);assert.equal(sheet.getCell('L2').value,'Yes');assert.notEqual((await quantityWorkbook({...saved,countSelectionDeletions:[]},takeoff.id)).snapshotDigest,out.snapshotDigest);
 const another=store.create('takeoff',store.snapshot().entities.find(e=>e.kind==='project').id,'Other');const unrelated=await quantityWorkbook(store.snapshot(),another.id),otherBook=new ExcelJS.Workbook();await otherBook.xlsx.load(unrelated.bytes);assert.equal(otherBook.getWorksheet('Deleted selections'),undefined);
 const persisted=store.snapshot();store.close();store.close=()=>{};const reopened=await openStore(directory);try{assert.deepEqual(reopened.snapshot(),persisted);}finally{reopened.close();}
 const db=new DatabaseSync(join(directory,'projects.sqlite'));assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);db.close();
});
test('stale heading, selection, match snapshots and audit failure roll back the complete deletion',async t=>{
 const {store,directory,item,selection,input}=await workspace(t),body=input(),before=store.snapshot();
 for(const patch of [{version:999},{item_version:999},{expected_marks:null},{expected_marks:[null]},{expected_marks:[]},{expected_marks:[...body.expected_marks,body.expected_marks[0]]},{expected_marks:body.expected_marks.map(m=>({...m,version:999}))}]){assert.throws(()=>store.deleteCountSelection(selection.id,{...body,...patch}));assert.deepEqual(store.snapshot(),before);}
 const db=new DatabaseSync(join(directory,'projects.sqlite'));try{db.exec("CREATE TRIGGER fail_delete_audit BEFORE INSERT ON count_selection_deletions BEGIN SELECT RAISE(ABORT,'deletion audit unavailable'); END");assert.throws(()=>store.deleteCountSelection(selection.id,body),/deletion audit unavailable/);assert.deepEqual(store.snapshot(),before);}finally{db.close();}
 const m=before.countMarks[0];store.updateMark(m.id,{version:m.version,included:false,reviewed:true});const changed=store.snapshot();assert.throws(()=>store.deleteCountSelection(selection.id,body),{status:409});assert.deepEqual(store.snapshot(),changed);
});
test('missing source and reclassified manual original references do not prevent safe scoped deletion',async t=>{
 const {store,item,selection,input,discipline,a,b}=await workspace(t),other=store.createCount(discipline.id,{name:'Other'}),manual=store.addManualMark(item.id,{drawing_id:b.id,page:1,x:450,y:300});store.updateMark(manual.id,{version:1,included:true,reviewed:true,item_id:other.id});store.deleteDrawing(a.id);
 const before=store.snapshot(),result=store.deleteCountSelection(selection.id,input());assert.equal(result.removed,3);assert.equal(result.pruned_heading,false);const after=store.snapshot();assert.deepEqual(after.countMarks,before.countMarks.filter(m=>m.id===manual.id));assert.equal(after.countItems.find(i=>i.id===item.id).example,null);assert.equal(after.countEvents.length,1);
});
test('actual schema 12 migration adds deletion ledger without modifying prior records',async t=>{
 const {store,directory}=await workspace(t),before=store.snapshot();store.close();store.close=()=>{};const db=new DatabaseSync(join(directory,'projects.sqlite'));db.exec('DROP TABLE count_selection_deletions;UPDATE schema_version SET version=12');db.close();const reopened=await openStore(directory);try{assert.deepEqual(reopened.snapshot(),before);}finally{reopened.close();}
});
test('selection DELETE HTTP requires token, JSON and current snapshot and does not repeat deletion',async t=>{
 const {directory,store,selection,input}=await workspace(t),{startApp}=await import('../apps/local/server.mjs'),app=await startApp({directory,port:0});
 try{const token=(await(await fetch(app.origin+'/api/session')).json()).token,request=(body,auth=true)=>fetch(`${app.origin}/api/examples/${selection.id}`,{method:'DELETE',headers:{'Content-Type':'application/json',...(auth?{'X-Fire-Token':token}:{})},body:JSON.stringify(body)}),body=input();
 assert.equal((await request(body,false)).status,403);for(const value of [null,[]])assert.equal((await request(value)).status,400);assert.equal((await request({...body,version:99})).status,409);assert.equal((await request(body)).status,200);assert.equal((await request(body)).status,404);const state=await(await fetch(app.origin+'/api/state')).json();assert.equal(state.countSelectionDeletions.length,1);assert.equal(state.countMarks.length,0);
 }finally{await app.close();}
});

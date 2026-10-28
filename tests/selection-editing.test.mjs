import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {getDocument,OPS} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {createCanvas} from '@napi-rs/canvas';
import ExcelJS from 'exceljs';
import {openStore} from '../apps/local/store.mjs';
import {quantityWorkbook} from '../apps/local/workbook.mjs';
import {inspectPdfElements,elementAt,validElementSelection,ELEMENT_RENDERER,editedTemplate} from '../apps/local/web/pdf-elements.mjs';
import {inkImage,findMatches} from '../apps/local/web/matcher.mjs';
const elements={renderer:ELEMENT_RENDERER,ids:[13,14,15],excluded:[15]};
async function workspace(t){
 const directory=await mkdtemp(join(tmpdir(),'fire-selection-')),store=await openStore(directory);t.after(()=>{store.close();return rm(directory,{recursive:true,force:true});});
 execFileSync(process.execPath,['scripts/generate-drawing-fixture.mjs',join(directory,'fixture')]);const bytes=await readFile(join(directory,'fixture','small-vector.pdf'));
 const p=store.create('project',null,'Selection tests'),takeoff=store.create('takeoff',p.id,'Original'),discipline=store.create('discipline',takeoff.id,'Fire'),drawing=await store.importPdf(discipline.id,'Owned.pdf',bytes);
 const hit=(x,y=100)=>({drawing_id:drawing.id,page:1,x,y,digest:drawing.digest,score:1}),item=store.createCount(discipline.id,{name:'Heads',example:{drawing_id:drawing.id,page:1,bounds:[90,90,110,110],algorithm:'binary-overlap-1',digest:drawing.digest},matches:[hit(100),hit(200),hit(300),hit(100,200),hit(200,200),hit(300,200)]}),example=store.snapshot().countExamples[0];
 const input=(matches)=>({version:store.snapshot().countExamples.find(e=>e.id===example.id).version,elements,matches,scope:[{id:drawing.id,digest:drawing.digest}],expected_marks:store.snapshot().countMarks.filter(m=>m.example_id===example.id).map(m=>({id:m.id,version:m.version}))});
 return {directory,store,bytes,drawing,item,example,discipline,takeoff,hit,input};
}
test('actual PDF path elements erase and restore independently; retained subset finds six original symbols at unchanged anchors',async t=>{
 const {bytes}=await workspace(t),task=getDocument({data:new Uint8Array(bytes),isEvalSupported:false,standardFontDataUrl:process.cwd()+'/node_modules/pdfjs-dist/standard_fonts/'});t.after(()=>task.destroy());const page=await(await task.promise).getPage(1),model=await inspectPdfElements({page,OPS,bounds:[90,90,110,110],createCanvas});
 assert.deepEqual(model.elements.map(e=>e.id),[13,14,15]);assert.deepEqual(model.anchor,[20,20]);assert.equal(elementAt(model.elements,20,20,40,40),15);assert.equal(elementAt(model.elements,-1,20,40,40),null);
 const original=await model.render(),erased=await model.render([15]),restored=await model.render();assert.notDeepEqual(erased.data,original.data);assert.deepEqual(restored.data,original.data);
 const template=editedTemplate(inkImage(original.data,40,40),inkImage(erased.data,40,40),[0,0,40,40]),viewport=page.getViewport({scale:2,rotation:0}),canvas=createCanvas(viewport.width,viewport.height);await page.render({canvas,canvasContext:canvas.getContext('2d'),viewport}).promise;
 const found=findMatches(inkImage(canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data,canvas.width,canvas.height),template,{threshold:.95});
 assert.equal(found.length,6);assert.deepEqual(found.map(h=>viewport.convertToPdfPoint(h.left+template.anchorX,h.top+template.anchorY)).sort((a,b)=>a[1]-b[1]||a[0]-b[0]),[[100,100],[200,100],[300,100],[100,200],[200,200],[300,200]]);
 await assert.rejects(()=>inspectPdfElements({page,OPS,bounds:[45,760,170,790],createCanvas}),/text or image/);await assert.rejects(()=>inspectPdfElements({page,OPS,bounds:[0,0,200,200],createCanvas}),/128 PDF/);await assert.rejects(()=>inspectPdfElements({page,OPS,bounds:[90,90,110,110],createCanvas,cancelled:()=>true}),/cancelled/);
});
test('element provenance rejects malformed, duplicate, unknown and empty selections',()=>{
 assert.equal(validElementSelection(elements),true);
 for(const value of [null,{}, {...elements,renderer:'other'}, {...elements,ids:[13,13]}, {...elements,ids:[15,14]}, {...elements,ids:[-1]}, {...elements,excluded:[99]}, {...elements,excluded:[13,14,15]}, {...elements,excluded:[15,15]}, {...elements,ids:Array.from({length:129},(_,i)=>i)}])assert.equal(validElementSelection(value),false);
});
test('selection recount retains reviewed exclusions/reclassification and other examples, removes only obsolete unchecked instances, and preserves factors',async t=>{
 const {store,directory,item,example,drawing,discipline,hit,input}=await workspace(t),other=store.createCount(discipline.id,{name:'Other'});
 const original=store.snapshot().countMarks.sort((a,b)=>a.y-b.y||a.x-b.x);store.updateMark(original[0].id,{included:true,reviewed:true,version:1});store.updateMark(original[1].id,{included:false,reviewed:true,version:1});store.updateMark(original[2].id,{included:true,reviewed:true,version:1,item_id:other.id});store.updateCountMultiplier(example.id,{version:1,multiplier:3});
 const second=store.addCountExample(item.id,{version:store.snapshot().countItems.find(i=>i.id===item.id).version,example:{...example.example,bounds:[190,90,210,110]},matches:[hit(450,300)]});
 const secondMark=store.snapshot().countMarks.find(m=>m.example_id===second.example_id);
 const manual=store.addManualMark(item.id,{drawing_id:drawing.id,page:1,x:400,y:300}),before=store.snapshot(),kept=before.countMarks.filter(m=>m.reviewed);
 const result=store.editCountSelection(example.id,input([hit(100,200),hit(350,200)]));assert.deepEqual([result.added,result.removed,result.skipped],[1,2,1]);const after=store.snapshot();for(const mark of kept)assert.deepEqual(after.countMarks.find(m=>m.id===mark.id),mark);assert.ok(after.countMarks.some(m=>m.id===manual.id));assert.equal(after.countExamples.find(e=>e.id===example.id).multiplier,3);assert.deepEqual(after.countExamples.find(e=>e.id===example.id).example.elements,elements);assert.equal(after.countExamples.find(e=>e.id===example.id).example.algorithm,'binary-elements-2');assert.equal(after.countSelectionEvents.length,1);assert.equal(after.countSelectionEvents[0].current.retained_corrections.length,3);
 assert.deepEqual(after.countMarks.find(m=>m.id===secondMark.id),secondMark);assert.deepEqual(after.countItems.find(i=>i.id===item.id).example,after.countExamples.find(e=>e.id===example.id).example);
 const saved=store.snapshot();store.close();store.close=()=>{};const reopened=await openStore(directory);try{assert.deepEqual(reopened.snapshot(),saved);}finally{reopened.close();}
});
test('stale snapshots, invalid scope and forced selection audit failure cannot partially change templates or detections',async t=>{
 const {store,directory,item,example,drawing,discipline,takeoff,hit,input,bytes}=await workspace(t),baseline=store.snapshot(),valid=input([hit(350)]);
 for(const patch of [{version:999},{expected_marks:[]},{expected_marks:[null]},{scope:[null]},{scope:[]},{scope:[{id:drawing.id,digest:'wrong'}]},{elements:{...elements,excluded:[99]}},{matches:[null]},{matches:[{...hit(350),page:2}]}]){assert.throws(()=>store.editCountSelection(example.id,{...valid,...patch}));assert.deepEqual(store.snapshot(),baseline);}
 const db=new DatabaseSync(join(directory,'projects.sqlite'));try{db.exec("CREATE TRIGGER fail_selection BEFORE INSERT ON count_selection_events BEGIN SELECT RAISE(ABORT,'selection audit unavailable'); END");assert.throws(()=>store.editCountSelection(example.id,valid),/selection audit unavailable/);assert.deepEqual(store.snapshot(),baseline);}finally{db.close();}
 const stale=input([hit(350)]),m=store.snapshot().countMarks[0];store.updateMark(m.id,{included:false,reviewed:true,version:m.version});assert.throws(()=>store.editCountSelection(example.id,stale),{status:409});
});
test('schema 11 migration preserves prior state and edited selection audit enters workbook provenance',async t=>{
 const {store,directory,item,example,takeoff,hit,input}=await workspace(t),baseline=store.snapshot();store.close();store.close=()=>{};const db=new DatabaseSync(join(directory,'projects.sqlite'));db.exec('DROP TABLE count_selection_events;UPDATE schema_version SET version=11');db.close();const reopened=await openStore(directory);
 try{assert.deepEqual(reopened.snapshot(),baseline);const marks=reopened.snapshot().countMarks;reopened.editCountSelection(example.id,{version:1,elements,matches:[],scope:[{id:marks[0].drawing_id,digest:reopened.snapshot().drawings[0].digest}],expected_marks:marks.map(m=>({id:m.id,version:m.version}))});const state=reopened.snapshot(),out=await quantityWorkbook(state,takeoff.id),book=new ExcelJS.Workbook();await book.xlsx.load(out.bytes);assert.equal(book.getWorksheet('Selection edits').getCell('G2').value,6);assert.equal(book.getWorksheet('Selection edits').getCell('E2').value,2);assert.notEqual((await quantityWorkbook({...state,countSelectionEvents:[]},takeoff.id)).snapshotDigest,out.snapshotDigest);}finally{reopened.close();}
});
test('selection editing HTTP validates authentication and input and rejects repeated stale edits',async t=>{
 const {directory,store,example,input}=await workspace(t),{startApp}=await import('../apps/local/server.mjs'),app=await startApp({directory,port:0});
 try{const {token}=await(await fetch(app.origin+'/api/session')).json(),request=(body,auth=true)=>fetch(`${app.origin}/api/examples/${example.id}/selection`,{method:'PATCH',headers:{'Content-Type':'application/json',...(auth?{'X-Fire-Token':token}:{})},body:JSON.stringify(body)}),body=input([]);
 assert.equal((await request(body,false)).status,403);for(const value of [null,[]])assert.equal((await request(value)).status,400);assert.equal((await request(body)).status,200);assert.equal((await request(body)).status,409);const state=await(await fetch(app.origin+'/api/state')).json();assert.equal(state.countMarks.length,0);assert.equal(state.countSelectionEvents.length,1);
 }finally{await app.close();}
});

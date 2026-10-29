import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {createCanvas} from '@napi-rs/canvas';
import ExcelJS from 'exceljs';
import {openStore} from '../apps/local/store.mjs';
import {quantityWorkbook} from '../apps/local/workbook.mjs';
import {recognizeDrawing} from '../apps/local/web/recognize-drawing.mjs';
import {selectionFilter,ELEMENT_RENDERER} from '../apps/local/web/pdf-elements.mjs';
import {inkImage,findMatches} from '../apps/local/web/matcher.mjs';
const originalCentres=[[100,100],[200,100],[300,100],[100,200],[200,200],[300,200]],revisedCentres=[[200,100],[300,100],[350,150],[100,200],[200,200],[300,200]];
async function workspace(t){
 const directory=await mkdtemp(join(tmpdir(),'fire-recounts-')),store=await openStore(directory);t.after(()=>{store.close();return rm(directory,{recursive:true,force:true});});
 const p=store.create('project',null,'Owned revisions'),takeoff=store.create('takeoff',p.id,'Original and revision'),discipline=store.create('discipline',takeoff.id,'Fire'),drawings=[];
 for(const variant of ['base','revision']){execFileSync(process.execPath,['scripts/generate-drawing-fixture.mjs',join(directory,variant),variant]);drawings.push(await store.importPdf(discipline.id,variant+'.pdf',await readFile(join(directory,variant,'small-vector.pdf'))));}
 const [base,revision]=drawings,hit=(d,[x,y])=>({drawing_id:d.id,page:1,x,y,digest:d.digest,score:1}),item=store.createCount(discipline.id,{name:'Heads',example:{drawing_id:base.id,page:1,bounds:[90,90,110,110],digest:base.digest,algorithm:'binary-overlap-1'},matches:originalCentres.map(p=>hit(base,p))});
 const input=(d=revision)=>{const s=store.snapshot();return {digest:d.digest,selections:s.countExamples.filter(e=>s.countItems.find(i=>i.id===e.item_id)?.discipline_id===d.discipline_id).map(e=>({id:e.id,version:e.version,item_version:s.countItems.find(i=>i.id===e.item_id).version,matches:revisedCentres.map(p=>hit(d,p))})),expected_marks:s.countMarks.filter(m=>m.drawing_id===d.id).map(m=>({id:m.id,version:m.version}))};};
 const render=async(d,number,elements)=>{const task=getDocument({data:new Uint8Array(await store.source(d.id)),isEvalSupported:false,standardFontDataUrl:process.cwd()+'/node_modules/pdfjs-dist/standard_fonts/'});try{const page=await(await task.promise).getPage(number),viewport=page.getViewport({scale:2,rotation:0}),canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height)),ctx=canvas.getContext('2d');await page.render({canvasContext:ctx,viewport,operationsFilter:elements?selectionFilter(elements):undefined}).promise;return {data:ctx.getImageData(0,0,canvas.width,canvas.height).data,width:canvas.width,height:canvas.height,viewport};}finally{await task.destroy();}};
 const search=async(raster,template)=>findMatches(inkImage(raster.data,raster.width,raster.height),template,template.elementSubset?{threshold:.95}:{});
 return {directory,store,takeoff,discipline,base,revision,item,input,hit,render,search};
}
test('actual revised PDF reuses an original selection, finds independently declared changed centres, and preserves original results',async t=>{
 const {store,base,revision,item,render,search}=await workspace(t),before=store.snapshot(),body=await recognizeDrawing({state:before,target:revision,render,search});
 assert.deepEqual(body.selections[0].matches.map(m=>[m.x,m.y]).sort((a,b)=>a[1]-b[1]||a[0]-b[0]),revisedCentres);assert.ok(!body.selections[0].matches.some(m=>m.x===100&&m.y===100));
 const result=store.recountDrawing(revision.id,body),after=store.snapshot();assert.equal(result.added,6);assert.deepEqual(after.countMarks.filter(m=>m.drawing_id===base.id),before.countMarks);for(const key of ['drawings','countExamples','countItems','countGroupMembers'])assert.deepEqual(after[key],before[key]);assert.ok(after.countMarks.filter(m=>m.drawing_id===revision.id).every(m=>!m.reviewed&&m.included));
 // Reuse a genuinely edited source with retained anchor, without silently replacing its saved definition.
 const e=after.countExamples[0],elements={renderer:ELEMENT_RENDERER,ids:[13,14,15],excluded:[15]};store.editCountSelection(e.id,{version:e.version,elements,matches:after.countMarks.map(m=>({...m,digest:after.drawings.find(d=>d.id===m.drawing_id).digest})),scope:after.drawings.map(d=>({id:d.id,digest:d.digest})),expected_marks:after.countMarks.map(m=>({id:m.id,version:m.version}))});
 const edited=store.snapshot(),cleaned=await recognizeDrawing({state:edited,target:revision,render,search});assert.deepEqual(cleaned.selections[0].matches.map(m=>[m.x,m.y]).sort((a,b)=>a[1]-b[1]||a[0]-b[0]),revisedCentres);assert.equal(store.recountDrawing(revision.id,cleaned).added,0);assert.deepEqual(store.snapshot().countExamples,edited.countExamples);assert.equal(store.snapshot().countMarks.filter(m=>m.item_id===item.id).length,12);
});
test('target recount keeps corrections, manual marks, factors and identities; obsolete unchecked results disappear and repeated definitions deduplicate',async t=>{
 const {store,base,revision,item,input,hit,discipline}=await workspace(t);store.recountDrawing(revision.id,input());let s=store.snapshot(),e=s.countExamples[0];store.updateCountMultiplier(e.id,{version:e.version,multiplier:2});const rows=s.countMarks.filter(m=>m.drawing_id===revision.id).sort((a,b)=>a.y-b.y||a.x-b.x),other=store.createCount(discipline.id,{name:'Correction'});
 store.updateMark(rows[0].id,{version:rows[0].version,included:false,reviewed:true});store.updateMark(rows[1].id,{version:rows[1].version,included:true,reviewed:true,item_id:other.id});store.addManualMark(item.id,{drawing_id:revision.id,page:1,x:450,y:300});
 store.addCountExample(item.id,{version:store.snapshot().countItems.find(i=>i.id===item.id).version,example:{...e.example,bounds:[190,90,210,110]},matches:[hit(revision,[400,300])]});s=store.snapshot();const preserved=s.countMarks.filter(m=>m.drawing_id===base.id||m.reviewed||m.origin==='manual'),result=store.recountDrawing(revision.id,input());assert.equal(result.added,0);assert.equal(result.removed,1);const after=store.snapshot();for(const m of preserved)assert.deepEqual(after.countMarks.find(n=>n.id===m.id),m);assert.equal(after.countMarks.filter(m=>m.drawing_id===revision.id).length,7);assert.deepEqual(after.countExamples,s.countExamples);assert.deepEqual(after.countItems,s.countItems);
 const beforeReplay=store.snapshot(),replay=store.recountDrawing(revision.id,input());assert.equal(replay.added,0);assert.equal(replay.removed,0);assert.deepEqual(store.snapshot().countMarks,beforeReplay.countMarks);assert.equal(store.snapshot().countDrawingRecounts.length,3);
});
test('stale definitions, complete target snapshots and all result scopes are validated before any recount writes',async t=>{
 const {store,revision,base,input,discipline,item}=await workspace(t),body=input();
 const patches=[{digest:'wrong'},{selections:[]},{selections:[null]},{selections:[...body.selections,...body.selections]},{selections:body.selections.map(e=>({...e,version:99}))},{selections:body.selections.map(e=>({...e,item_version:99}))},{selections:body.selections.map(e=>({...e,matches:[null]}))},{selections:body.selections.map(e=>({...e,matches:[{...e.matches[0],drawing_id:base.id,digest:base.digest}]}))},{expected_marks:[null]},{expected_marks:[{id:'missing',version:1}]}];
 for(const patch of patches){const before=store.snapshot();assert.throws(()=>store.recountDrawing(revision.id,{...body,...patch}));assert.deepEqual(store.snapshot(),before);}
 store.addManualMark(item.id,{drawing_id:revision.id,page:1,x:450,y:300});let before=store.snapshot();assert.throws(()=>store.recountDrawing(revision.id,body),{status:409});assert.deepEqual(store.snapshot(),before);
 const ready=input(),example=store.snapshot().countExamples[0];store.addCountExample(item.id,{version:item.version,example:{...example.example,bounds:[190,90,210,110]},matches:[]});before=store.snapshot();assert.throws(()=>store.recountDrawing(revision.id,ready),{status:409});assert.deepEqual(store.snapshot(),before);
 const scoped=store.create('discipline',store.snapshot().entities.find(e=>e.id===discipline.id).parent_id,'Outside'),outside=await store.importPdf(scoped.id,'Outside.pdf',await store.source(base.id));const outsideBody=input();outsideBody.selections[0].matches=[{...outsideBody.selections[0].matches[0],drawing_id:outside.id,digest:outside.digest}];before=store.snapshot();assert.throws(()=>store.recountDrawing(revision.id,outsideBody),/scope|target/);assert.deepEqual(store.snapshot(),before);const excessive=input();excessive.selections[0].matches=Array(5001).fill(excessive.selections[0].matches[0]);assert.throws(()=>store.recountDrawing(revision.id,excessive));assert.deepEqual(store.snapshot(),before);
});
test('recount audit failure rolls back inserted and removed target results',async t=>{
 const {store,revision,item,input,directory}=await workspace(t),e=store.snapshot().countExamples[0];store.addCountExample(item.id,{version:item.version,example:e.example,matches:[{drawing_id:revision.id,page:1,x:450,y:300,digest:revision.digest,score:1}]});const before=store.snapshot(),db=new DatabaseSync(join(directory,'projects.sqlite'));
 try{db.exec("CREATE TRIGGER fail_recount BEFORE INSERT ON count_drawing_recounts BEGIN SELECT RAISE(ABORT,'recount audit unavailable'); END");assert.throws(()=>store.recountDrawing(revision.id,input()),/recount audit unavailable/);assert.deepEqual(store.snapshot(),before);}finally{db.close();}
});
test('recount cancellation, missing/legacy sources and resource limits produce no request or saved changes',async t=>{
 const {store,revision,render,search}=await workspace(t),state=store.snapshot(),call=patch=>recognizeDrawing({state,target:revision,render,search,...patch});await assert.rejects(()=>call({cancelled:()=>true}),/cancelled/);
 let cancelled=false;await assert.rejects(()=>call({render:async(...args)=>{const r=await render(...args);cancelled=true;return r;},cancelled:()=>cancelled}),/cancelled/);
 await assert.rejects(()=>call({state:{...state,drawings:[]}}),/source is missing/);await assert.rejects(()=>call({state:{...state,countExamples:state.countExamples.map(e=>({...e,example:{...e.example,algorithm:'binary-elements-1'}}))}}),/legacy/);await assert.rejects(()=>call({target:{...revision,pages:Array(21).fill({})}}),/20 pages/);await assert.rejects(()=>call({state:{...state,countExamples:Array(51).fill(state.countExamples[0])}}),/50 selections/);assert.deepEqual(store.snapshot(),state);
});
test('schema15 migration and workbook preserve recount provenance after drawing deletion and reopen',async t=>{
 const {store,directory,revision,item,input,takeoff}=await workspace(t),before=store.snapshot(),payload=input();store.close();store.close=()=>{};let db=new DatabaseSync(join(directory,'projects.sqlite'));db.exec('DROP TABLE count_drawing_recounts;UPDATE schema_version SET version=15');db.close();let reopened=await openStore(directory);
 try{assert.deepEqual(reopened.snapshot(),before);reopened.recountDrawing(revision.id,payload);reopened.reviewMarks(item.id,reopened.snapshot().countMarks.map(m=>({id:m.id,version:m.version,included:true,reviewed:true})));const s=reopened.snapshot(),out=await quantityWorkbook(s,takeoff.id),book=new ExcelJS.Workbook();await book.xlsx.load(out.bytes);assert.equal(book.getWorksheet('Drawing recounts').getCell('D2').value,6);assert.equal(book.getWorksheet('Count instances').rowCount,13);assert.notEqual((await quantityWorkbook({...s,countDrawingRecounts:[]},takeoff.id)).snapshotDigest,out.snapshotDigest);reopened.deleteDrawing(revision.id);assert.equal(reopened.snapshot().countDrawingRecounts.length,1);const saved=reopened.snapshot();reopened.close();reopened=await openStore(directory);assert.deepEqual(reopened.snapshot(),saved);const deletedBook=new ExcelJS.Workbook();await deletedBook.xlsx.load((await quantityWorkbook(saved,takeoff.id)).bytes);assert.equal(deletedBook.getWorksheet('Drawing recounts').getCell('A2').value,'revision.pdf');}finally{reopened.close();}
});
test('recount HTTP checks token/body and target snapshots, then returns committed review-needed results',async t=>{
 const {directory,store,revision,input}=await workspace(t),{startApp}=await import('../apps/local/server.mjs'),app=await startApp({directory,port:0});
 try{const token=(await(await fetch(app.origin+'/api/session')).json()).token,request=(body,auth=true)=>fetch(`${app.origin}/api/drawings/${revision.id}/recount`,{method:'POST',headers:{'Content-Type':'application/json',...(auth?{'X-Fire-Token':token}:{})},body:JSON.stringify(body)}),body=input();assert.equal((await request(body,false)).status,403);for(const value of [null,[]])assert.equal((await request(value)).status,400);assert.equal((await request(body)).status,200);assert.equal((await request(body)).status,409);assert.equal(store.snapshot().countDrawingRecounts.length,1);
 }finally{await app.close();}
});

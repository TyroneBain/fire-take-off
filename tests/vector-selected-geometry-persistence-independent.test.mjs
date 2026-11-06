import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {getDocument,OPS} from 'pdfjs-dist/legacy/build/pdf.mjs';
import ExcelJS from 'exceljs';
import {vectorMultipageQaFixture} from '../scripts/vector-multipage-qa-fixture.mjs';
import {openStore} from '../apps/local/store.mjs';
import {quantityWorkbook} from '../apps/local/workbook.mjs';
import {ELEMENT_RENDERER} from '../apps/local/web/pdf-elements.mjs';
import {VECTOR_CONTEXT_REVIEW_VERSION,VECTOR_CONTEXT_MATCH_POLICY,VECTOR_SELECTED_REVIEW_VERSION,VECTOR_SELECTED_MATCH_POLICY} from '../apps/local/web/vector-review-policy.mjs';
import {nativeDecisionForMark} from '../apps/local/web/native-count-ink.mjs';

// Persistence fixtures assert client-decision handling only. They deliberately
// do not claim these metadata assertions were produced by the matcher.
async function fixture(t){
 const directory=await mkdtemp(join(tmpdir(),'qa-selected-ledger-')),store=await openStore(directory);t.after(async()=>{store.close();await rm(directory,{recursive:true,force:true});});
 const original=vectorMultipageQaFixture(),project=store.create('project',null,'Pending QA'),takeoff=store.create('takeoff',project.id,'Takeoff'),discipline=store.create('discipline',takeoff.id,'Fire'),drawing=await store.importPdf(discipline.id,'original.pdf',original.bytes),task=getDocument({data:new Uint8Array(original.bytes),isEvalSupported:false}),ids=[];
 try{const doc=await task.promise;for(let p=1;p<=2;p++){const list=await(await doc.getPage(p)).getOperatorList();ids.push(list.fnArray.flatMap((op,id)=>op===OPS.constructPath?[id]:[]));}}finally{await task.destroy();}
 const item=store.createCount(discipline.id,{name:'Heads',example:{drawing_id:drawing.id,digest:drawing.digest,page:1,bounds:[34,34,46,46],algorithm:'binary-overlap-2'},matches:[{drawing_id:drawing.id,digest:drawing.digest,page:1,x:40,y:40,score:1}]}),example=store.snapshot().countExamples[0],elements={renderer:ELEMENT_RENDERER,ids:[ids[0][0],ids[0][2],ids[0][3]],excluded:[ids[0][0]]};
 const decision=(page,x,included=true)=>{const index=x===40?0:x===110?1:2,ordinals=x===180&&page===1?original.manifest.paintOrdinalsByPage[page].negative[0]:original.manifest.paintOrdinalsByPage[page].positive[index];return{x,y:40,rotation:page===1?(x===110?180:0):(x===40?90:x===110?270:0),elementIds:ordinals.map(i=>ids[page-1][i]),contextIds:[],included};};
 const page=(number,decisions,v4=true)=>({drawing_id:drawing.id,digest:drawing.digest,page:number,layerScope:{mode:'all-admitted'},provenance:{engine:v4?'vector-pattern-review-3':'vector-pattern-review-2',visibility:'contour-paint-visibility-4',requestedPaints:ids[number-1].length,admittedPaints:ids[number-1].length,unknownCount:0,excludedCount:0,proposalCount:v4?3:decisions.length,verifiedCount:v4?3:decisions.length,selectedCount:decisions.filter(d=>d.included).length,...(v4?{pendingCount:3-decisions.length}:{})},decisions:v4?decisions.map(d=>({...d,reviewed:true})):decisions});
 const review=(decisions=[[],[]],v4=true)=>({version:v4?VECTOR_SELECTED_REVIEW_VERSION:VECTOR_CONTEXT_REVIEW_VERSION,matchPolicy:v4?VECTOR_SELECTED_MATCH_POLICY:VECTOR_CONTEXT_MATCH_POLICY,sourceContextIds:[],scope:'explicit-pages',anchor:[40,40],decision:'apply',layerPolicy:'all-admitted',pages:[page(1,decisions[0],v4),page(2,decisions[1],v4)]});
 const matches=r=>r.pages.flatMap(p=>p.decisions.filter(d=>d.included).map(d=>({drawing_id:p.drawing_id,digest:p.digest,page:p.page,x:d.x,y:d.y,score:1}))),payload=r=>{const s=store.snapshot();return{version:s.countExamples[0].version,item_version:s.countItems.find(i=>i.id===item.id).version,elements:structuredClone(elements),scope:[{id:drawing.id,digest:drawing.digest,pages:[1,2]}],expected_marks:s.countMarks.filter(m=>m.example_id===example.id).map(m=>({id:m.id,version:m.version})),matches:matches(r),vectorReview:r};};
 const recount=r=>{const s=store.snapshot();return{digest:drawing.digest,selections:[{id:example.id,version:s.countExamples[0].version,item_version:s.countItems.find(i=>i.id===item.id).version,matches:matches(r),vectorReview:r}],expected_marks:s.countMarks.map(m=>({id:m.id,version:m.version}))};};
 store.editCountSelection(example.id,payload(review([[decision(1,40),decision(1,110)],[decision(2,40)]],false)));
 let s=store.snapshot();const rejected=s.countMarks.find(m=>m.page===1&&m.x===110),reclassified=s.countMarks.find(m=>m.page===2),alternate=store.createCount(discipline.id,{name:'Other'});store.updateMark(rejected.id,{version:rejected.version,included:false,reviewed:true});store.updateMark(reclassified.id,{version:reclassified.version,included:true,reviewed:true,item_id:alternate.id});store.addManualMark(item.id,{drawing_id:drawing.id,page:2,x:180,y:40});
 return{directory,store,takeoff,drawing,item,example,elements,decision,review,payload,recount};
}

test('independent all-pending v4 Apply preserves every old mark and its native glyph evidence',async t=>{
 const f=await fixture(t),before=f.store.snapshot(),old=before.countMarks.filter(m=>m.included&&m.origin==='automatic'),evidence=old.map(mark=>nativeDecisionForMark({mark,example:before.countExamples[0],drawing:f.drawing,pageNumber:mark.page}));assert.ok(evidence.every(Boolean));
 const result=f.store.editCountSelection(f.example.id,f.payload(f.review()));assert.equal(result.added,0);assert.equal(result.removed,0);assert.equal(result.rejected,0);const after=f.store.snapshot();assert.deepEqual(after.countMarks,before.countMarks,'Pending cannot delete even an old unreviewed automatic count');
 for(let i=0;i<old.length;i++){const current=nativeDecisionForMark({mark:old[i],example:after.countExamples[0],drawing:f.drawing,pageNumber:old[i].page});assert.ok(current);for(const key of ['x','y','rotation','elementIds','contextIds','included'])assert.deepEqual(current[key],evidence[i][key],'Omitted current candidate retains original paint evidence: '+key);}
 assert.equal(after.countMarks.some(m=>m.page===2&&m.x===110),false,'Untouched new positive remains pending');
});

test('independent explicit v4 decisions persist while pending remains absent through recount/reopen/Excel',async t=>{
 const f=await fixture(t),before=f.store.snapshot(),review=f.review([[f.decision(1,180,false)],[f.decision(2,110,true)]]);f.store.editCountSelection(f.example.id,f.payload(review));let s=f.store.snapshot();for(const old of before.countMarks)assert.deepEqual(s.countMarks.find(m=>m.id===old.id),old);
 const included=s.countMarks.find(m=>m.page===2&&m.x===110),rejected=s.countMarks.find(m=>m.page===1&&m.x===180);assert.equal(included.included,1);assert.equal(included.reviewed,1,'Explicit broader acceptance must be protected on recount');assert.equal(rejected.included,0);assert.equal(rejected.reviewed,1);assert.equal(s.countMarks.length,6);
 const savedMarks=structuredClone(s.countMarks);f.store.recountDrawing(f.drawing.id,f.recount(f.review()));s=f.store.snapshot();assert.deepEqual(s.countMarks,savedMarks,'An all-pending fresh scan cannot erase past explicit decisions');
 assert.ok(nativeDecisionForMark({mark:included,example:s.countExamples[0],drawing:f.drawing,pageNumber:2}),'Accepted broader glyph evidence survives sparse recount');
 for(const item of s.countItems){const rows=s.countMarks.filter(m=>m.item_id===item.id&&m.included&&!m.reviewed);if(rows.length)f.store.reviewMarks(item.id,rows.map(m=>({id:m.id,version:m.version,included:true,reviewed:true})));}
 s=f.store.snapshot();const workbook=new ExcelJS.Workbook();await workbook.xlsx.load((await quantityWorkbook(s,f.takeoff.id)).bytes);let rows=0,total=0;workbook.getWorksheet('Count instances').eachRow((row,n)=>{if(n>1){rows++;total+=row.getCell(17).value;}});assert.equal(rows,6);assert.equal(total,4);
 f.store.close();f.store.close=()=>{};const reopened=await openStore(f.directory);try{assert.deepEqual(reopened.snapshot(),s);}finally{reopened.close();}
});

test('independent client cannot forge retained evidence or promote a new v4 candidate through recount',async t=>{
 const f=await fixture(t),before=f.store.snapshot(),forged=f.payload(f.review());forged.vectorReview.retainedPages=[{drawing_id:f.drawing.id,digest:f.drawing.digest,page:1,decisions:[f.decision(1,180,true)]}];assert.throws(()=>f.store.editCountSelection(f.example.id,forged));assert.deepEqual(f.store.snapshot(),before);
 f.store.editCountSelection(f.example.id,f.payload(f.review()));const saved=f.store.snapshot(),newCandidate=f.recount(f.review([[],[f.decision(2,110,true)]]));assert.throws(()=>f.store.recountDrawing(f.drawing.id,newCandidate));assert.deepEqual(f.store.snapshot(),saved,'Recount is not an explicit review Apply');
 const changed=f.decision(1,40);changed.elementIds=[f.decision(1,180).elementIds[0]];assert.throws(()=>f.store.recountDrawing(f.drawing.id,f.recount(f.review([[changed],[]]))));assert.deepEqual(f.store.snapshot(),saved,'Same location cannot substitute a different original physical paint identity');
});

test('independent manual restoration of a v4 rejected mark survives recount and keeps original coloured-glyph evidence',async t=>{
 const f=await fixture(t),review=f.review([[f.decision(1,180,false)],[]]);f.store.editCountSelection(f.example.id,f.payload(review));let s=f.store.snapshot(),rejected=s.countMarks.find(m=>m.page===1&&m.x===180);assert.equal(rejected.included,0);
 f.store.updateMark(rejected.id,{version:rejected.version,included:true,reviewed:true});const before=f.store.snapshot(),restored=before.countMarks.find(m=>m.id===rejected.id);assert.equal(restored.reviewed,1);
 f.store.recountDrawing(f.drawing.id,f.recount(review));const after=f.store.snapshot();assert.deepEqual(after.countMarks,before.countMarks,'Recount cannot replay a superseded rejection over a manual restoration');
 const evidence=nativeDecisionForMark({mark:restored,example:after.countExamples[0],drawing:f.drawing,pageNumber:1});assert.ok(evidence,'Explicit restored ledger mark may reuse known original paint evidence');assert.deepEqual(evidence.elementIds,f.decision(1,180).elementIds);
});

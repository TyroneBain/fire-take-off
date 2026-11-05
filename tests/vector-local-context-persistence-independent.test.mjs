import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {getDocument,OPS} from 'pdfjs-dist/legacy/build/pdf.mjs';
import ExcelJS from 'exceljs';
import {vectorMultipageQaFixture} from '../scripts/vector-multipage-qa-fixture.mjs';
import {openStore} from '../apps/local/store.mjs';
import {quantityWorkbook} from '../apps/local/workbook.mjs';
import {ELEMENT_RENDERER} from '../apps/local/web/pdf-elements.mjs';
import {VECTOR_CONTEXT_REVIEW_VERSION,VECTOR_CONTEXT_MATCH_POLICY,VECTOR_PAGE_REVIEW_VERSION,validVectorReview,vectorReviewPage} from '../apps/local/web/vector-review-policy.mjs';
import {nativeDecisionForMark} from '../apps/local/web/native-count-ink.mjs';

// Reuse the already frozen independent two-page PDF and labels. This test
// exercises persisted client decisions, not a claim the server rerenders them.
async function workspace(t){
 const directory=await mkdtemp(join(tmpdir(),'qa-context-ledger-')),store=await openStore(directory);t.after(async()=>{store.close();await rm(directory,{recursive:true,force:true});});
 const fixture=vectorMultipageQaFixture(),project=store.create('project',null,'Original context QA'),takeoff=store.create('takeoff',project.id,'Takeoff'),discipline=store.create('discipline',takeoff.id,'Fire'),drawing=await store.importPdf(discipline.id,'original-two-page.pdf',fixture.bytes),task=getDocument({data:new Uint8Array(fixture.bytes),isEvalSupported:false}),ids=[];
 try{const doc=await task.promise;for(let page=1;page<=2;page++){const list=await(await doc.getPage(page)).getOperatorList();ids.push(list.fnArray.flatMap((op,id)=>op===OPS.constructPath?[id]:[]));}}finally{await task.destroy();}
 const source=fixture.manifest.source,sourceIds=[ids[0][0],...source.paintOrdinals.retained.map(i=>ids[0][i])].sort((a,b)=>a-b),pipe=ids[0][0],hit=(page,x,y=40)=>({drawing_id:drawing.id,page,digest:drawing.digest,x,y,score:1}),item=store.createCount(discipline.id,{name:'Original heads',example:{drawing_id:drawing.id,page:1,bounds:source.bounds,digest:drawing.digest,algorithm:'binary-overlap-2'},matches:[hit(1,40)]}),example=store.snapshot().countExamples[0];
 const pages=[1,2].map(page=>{const labels=fixture.manifest.labels.filter(l=>l.page===page&&l.verified),decisions=labels.map((l,i)=>({x:l.x,y:l.y,rotation:l.rotation,elementIds:fixture.manifest.paintOrdinalsByPage[page].positive[i].map(j=>ids[page-1][j]).sort((a,b)=>a-b),contextIds:page===1&&i===0?[pipe]:[],included:true}));return{drawing_id:drawing.id,page,digest:drawing.digest,layerScope:{mode:'all-admitted'},provenance:{engine:'vector-pattern-review-2',visibility:'contour-paint-visibility-4',requestedPaints:ids[page-1].length,admittedPaints:ids[page-1].length,unknownCount:0,excludedCount:0,proposalCount:decisions.length,verifiedCount:decisions.length,selectedCount:decisions.length},decisions};});
 const review=()=>({version:VECTOR_CONTEXT_REVIEW_VERSION,matchPolicy:VECTOR_CONTEXT_MATCH_POLICY,sourceContextIds:[pipe],scope:'explicit-pages',anchor:[40,40],decision:'apply',layerPolicy:'all-admitted',pages:structuredClone(pages)}),matches=()=>pages.flatMap(p=>p.decisions.map(d=>hit(p.page,d.x,d.y)));
 const payload=()=>{const s=store.snapshot();return{version:s.countExamples[0].version,item_version:s.countItems.find(i=>i.id===item.id).version,elements:{renderer:ELEMENT_RENDERER,ids:sourceIds,excluded:[pipe]},scope:[{id:drawing.id,digest:drawing.digest,pages:[1,2]}],expected_marks:s.countMarks.filter(m=>m.example_id===example.id).map(m=>({id:m.id,version:m.version})),matches:matches(),vectorReview:review()};};
 const recount=()=>{const s=store.snapshot();return{digest:drawing.digest,selections:[{id:example.id,version:s.countExamples[0].version,item_version:s.countItems.find(i=>i.id===item.id).version,matches:matches(),vectorReview:review()}],expected_marks:s.countMarks.map(m=>({id:m.id,version:m.version}))};};
 return{directory,store,takeoff,discipline,drawing,item,example,pipe,sourceIds,pages,review,payload,recount};
}

test('independent v3 source context and page-local decisions survive correction, recount, reopen and workbook reconciliation',async t=>{
 const f=await workspace(t),s=f.store;assert.equal(validVectorReview(f.review(),4),true);s.editCountSelection(f.example.id,f.payload());let state=s.snapshot();assert.equal(state.countMarks.length,4);assert.equal(state.countExamples[0].example.algorithm,VECTOR_CONTEXT_REVIEW_VERSION);
 const sourceMark=state.countMarks.find(m=>m.page===1&&m.x===40),sourceDecision=nativeDecisionForMark({mark:sourceMark,example:state.countExamples[0],drawing:f.drawing,pageNumber:1});assert.deepEqual(sourceDecision.contextIds,[f.pipe]);assert.equal(nativeDecisionForMark({mark:sourceMark,example:state.countExamples[0],drawing:f.drawing,pageNumber:2}),null);
 const alternate=s.createCount(f.discipline.id,{name:'Reclassified'}),reject=state.countMarks.find(m=>m.page===1&&m.x===110),move=state.countMarks.find(m=>m.page===2&&m.x===40),exclude=state.countMarks.find(m=>m.page===2&&m.x===110);
 s.updateMark(reject.id,{version:reject.version,included:false,reviewed:true});s.updateMark(move.id,{version:move.version,included:true,reviewed:true,item_id:alternate.id});s.updateMark(exclude.id,{version:exclude.version,included:false,reviewed:true});s.addManualMark(f.item.id,{drawing_id:f.drawing.id,page:2,x:180,y:40});state=s.snapshot();
 for(const item of state.countItems){const marks=state.countMarks.filter(m=>m.item_id===item.id&&m.included&&!m.reviewed);if(marks.length)s.reviewMarks(item.id,marks.map(m=>({id:m.id,version:m.version,included:true,reviewed:true})));}
 const before=s.snapshot(),protectedMarks=structuredClone(before.countMarks);s.recountDrawing(f.drawing.id,f.recount());const after=s.snapshot();assert.deepEqual(after.countMarks,protectedMarks,'All reviewed exclusions, reclassification and manual correction remain byte-identical');assert.equal(after.countMarks.length,5);assert.equal(after.countMarks.filter(m=>m.included).length,3);assert.deepEqual(after.countExamples[0].example.vectorReview.sourceContextIds,[f.pipe]);assert.deepEqual(vectorReviewPage(after.countExamples[0].example,f.drawing.id,1).decisions[0].contextIds,[f.pipe]);
 const workbook=new ExcelJS.Workbook();await workbook.xlsx.load((await quantityWorkbook(after,f.takeoff.id)).bytes);const sheet=workbook.getWorksheet('Count instances');let total=0,rows=0;sheet.eachRow((row,n)=>{if(n>1){total+=row.getCell(17).value;rows++;}});assert.equal(rows,5);assert.equal(total,3);assert.equal(workbook.getWorksheet('Selection edits').getCell('J2').value,VECTOR_CONTEXT_REVIEW_VERSION);
 s.close();s.close=()=>{};const reopened=await openStore(f.directory);try{assert.deepEqual(reopened.snapshot(),after);}finally{reopened.close();}
});

test('independent v3 forbids retained or unapproved context, changed source policy and stale recount before writes',async t=>{
 const f=await workspace(t),before=f.store.snapshot();
 const mutations=[
  p=>p.vectorReview.sourceContextIds=[f.sourceIds.find(id=>id!==f.pipe)],
  p=>p.vectorReview.pages[0].decisions[0].contextIds=[...p.vectorReview.pages[0].decisions[0].elementIds],
  p=>p.vectorReview.pages[0].decisions[0].contextIds=[999,998],
  p=>p.vectorReview.pages[0].decisions[0].contextIds=Array.from({length:17},(_,i)=>1000+i),
  p=>delete p.vectorReview.pages[1].decisions[0].contextIds,
  p=>p.vectorReview.matchPolicy='ignore-all-background',
 ];
 for(const mutate of mutations){const payload=f.payload();mutate(payload);assert.throws(()=>f.store.editCountSelection(f.example.id,payload));assert.deepEqual(f.store.snapshot(),before);}
 const legacy=f.review();legacy.version=VECTOR_PAGE_REVIEW_VERSION;for(const page of legacy.pages)page.provenance.engine='vector-pattern-review-1';assert.equal(validVectorReview(legacy),false,'v2 cannot silently inherit v3 context permission');delete legacy.matchPolicy;delete legacy.sourceContextIds;for(const page of legacy.pages)for(const d of page.decisions)delete d.contextIds;assert.equal(validVectorReview(legacy,4),true,'existing strict v2 remains readable');
 f.store.editCountSelection(f.example.id,f.payload());const saved=f.store.snapshot();
 for(const mutate of [r=>r.selections[0].vectorReview.sourceContextIds=[],r=>r.selections[0].vectorReview.matchPolicy='other',r=>r.selections[0].version--]){const r=f.recount();mutate(r);assert.throws(()=>f.store.recountDrawing(f.drawing.id,r));assert.deepEqual(f.store.snapshot(),saved);}
});

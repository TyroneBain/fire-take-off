import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {DatabaseSync} from 'node:sqlite';
import {getDocument,OPS,version as pdfjsVersion} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {createCanvas} from '@napi-rs/canvas';
import ExcelJS from 'exceljs';
import {openStore} from '../apps/local/store.mjs';
import {quantityWorkbook} from '../apps/local/workbook.mjs';
import {ELEMENT_RENDERER} from '../apps/local/web/pdf-elements.mjs';
import {VECTOR_REVIEW_VERSION,VECTOR_PAGE_REVIEW_VERSION,validVectorReview,vectorReviewPage,vectorReviewPages} from '../apps/local/web/vector-review-policy.mjs';
import {nativeDecisionForMark,prepareNativeCountInk} from '../apps/local/web/native-count-ink.mjs';

// Two independently authored two-page documents. Document B deliberately has
// an extra preceding paint, so identical symbol coordinates have different IDs.
function pdfBytes(label,offset){
 const glyph=x=>`${x-4} 36 8 8 re S ${x-1} 39 m ${x+1} 39 l ${x} 41 l h f`;
 const stream=`% ${label}\n0 G 0 g .75 w ${offset?'2 2 3 3 re f ':''}${glyph(40)} 40 44 m 40 56 l S ${glyph(110)} ${glyph(150)} ${glyph(190)}`;
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 220 160] /Resources << >> /Contents 4 0 R >>',`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 220 160] /Resources << >> /Contents 6 0 R >>',`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`];
 let out='%PDF-1.4\n';const offsets=[0];for(const [i,o]of objects.entries()){offsets.push(Buffer.byteLength(out));out+=`${i+1} 0 obj\n${o}\nendobj\n`;}const xref=Buffer.byteLength(out);out+=`xref\n0 7\n0000000000 65535 f \n${offsets.slice(1).map(n=>`${String(n).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;return Buffer.from(out);
}
async function workspace(t){
 const directory=await mkdtemp(join(tmpdir(),'vector-page-set-')),store=await openStore(directory);t.after(()=>{store.close();return rm(directory,{recursive:true,force:true});});const project=store.create('project',null,'Page binding'),takeoff=store.create('takeoff',project.id,'Original'),discipline=store.create('discipline',takeoff.id,'Fire'),models=[];
 for(const [name,offset]of [['A',false],['B',true]]){const bytes=pdfBytes(name,offset),task=getDocument({data:new Uint8Array(bytes),isEvalSupported:false}),doc=await task.promise,pages=[];for(let n=1;n<=2;n++){const op=await(await doc.getPage(n)).getOperatorList(),ids=op.fnArray.flatMap((v,i)=>v===OPS.constructPath?[i]:[]),start=offset?1:0;pages.push({ids,sourceIds:ids.slice(start,start+3),glyphs:new Map([[40,ids.slice(start,start+2)],[110,ids.slice(start+3,start+5)],[150,ids.slice(start+5,start+7)],[190,ids.slice(start+7,start+9)]])});}await task.destroy();models.push({drawing:await store.importPdf(discipline.id,name+'.pdf',bytes),bytes,pages});}
 const [a,b]=models,hit=(model,page,x)=>({drawing_id:model.drawing.id,page,x,y:40,digest:model.drawing.digest,score:1}),item=store.createCount(discipline.id,{name:'Heads',example:{drawing_id:a.drawing.id,page:1,bounds:[30,30,50,50],digest:a.drawing.digest,algorithm:'binary-overlap-1'},matches:[hit(a,1,40),hit(a,2,40),hit(b,1,40)]}),example=store.snapshot().countExamples[0],elements={renderer:ELEMENT_RENDERER,ids:a.pages[0].sourceIds,excluded:[a.pages[0].sourceIds[2]]};
 const bundle=(model,page,rows)=>{const decisions=rows.map(row=>{const [x,included=true]=Array.isArray(row)?row:[row,true];return{x,y:40,rotation:0,elementIds:model.pages[page-1].glyphs.get(x),included};});return {drawing_id:model.drawing.id,page,digest:model.drawing.digest,layerScope:{mode:'all-admitted'},provenance:{engine:'vector-pattern-review-1',visibility:'contour-paint-visibility-4',requestedPaints:model.pages[page-1].ids.length,admittedPaints:model.pages[page-1].ids.length,unknownCount:0,excludedCount:0,proposalCount:decisions.length,verifiedCount:decisions.length,selectedCount:decisions.filter(d=>d.included).length},decisions};};
 const metadata=pages=>({version:VECTOR_PAGE_REVIEW_VERSION,scope:'explicit-pages',anchor:[40,40],decision:'apply',layerPolicy:'all-admitted',pages});
 const matches=pages=>pages.flatMap(p=>p.decisions.filter(d=>d.included).map(d=>({drawing_id:p.drawing_id,page:p.page,digest:p.digest,x:d.x,y:d.y,score:1})));
 const payload=pages=>{const s=store.snapshot(),scope=[];for(const p of pages){let row=scope.find(d=>d.id===p.drawing_id);if(!row){row={id:p.drawing_id,digest:p.digest,pages:[]};scope.push(row);}row.pages.push(p.page);}for(const row of scope)row.pages.sort((a,b)=>a-b);return {version:s.countExamples.find(e=>e.id===example.id).version,item_version:s.countItems.find(i=>i.id===item.id).version,elements,scope,expected_marks:s.countMarks.filter(m=>m.example_id===example.id).map(m=>({id:m.id,version:m.version})),matches:matches(pages),vectorReview:metadata(pages)};};
 const recount=(model,pages)=>{const s=store.snapshot();return {digest:model.drawing.digest,selections:[{id:example.id,version:s.countExamples.find(e=>e.id===example.id).version,item_version:s.countItems.find(i=>i.id===item.id).version,matches:matches(pages),vectorReview:metadata(pages)}],expected_marks:s.countMarks.filter(m=>m.drawing_id===model.drawing.id).map(m=>({id:m.id,version:m.version}))};};
 return{directory,store,takeoff,discipline,a,b,item,example,elements,bundle,metadata,payload,recount,hit};
}

test('page-set Apply preserves same-coordinate identities, corrections and target-specific glyph provenance after reopen',async t=>{
 const f=await workspace(t),{store,a,b}=f,other=store.createCount(f.discipline.id,{name:'Other'}),s=store.snapshot(),source=s.countMarks.find(m=>m.drawing_id===a.drawing.id&&m.page===1),reclassified=s.countMarks.find(m=>m.drawing_id===a.drawing.id&&m.page===2);
 store.updateMark(source.id,{version:1,included:false,reviewed:true});store.updateMark(reclassified.id,{version:1,included:true,reviewed:true,item_id:other.id});const manual=store.addManualMark(f.item.id,{drawing_id:b.drawing.id,page:1,x:150,y:40}),protectedMarks=store.snapshot().countMarks.filter(m=>m.reviewed);
 const pages=[f.bundle(a,1,[40,110]),f.bundle(a,2,[40,[110,false]]),f.bundle(b,1,[40,[110,false],150]),f.bundle(b,2,[])],result=store.editCountSelection(f.example.id,f.payload(pages));assert.equal(result.added,1);assert.equal(result.rejected,2);
 const after=store.snapshot(),example=after.countExamples.find(e=>e.id===f.example.id);assert.equal(example.example.algorithm,VECTOR_PAGE_REVIEW_VERSION);for(const m of protectedMarks)assert.deepEqual(after.countMarks.find(v=>v.id===m.id),m);assert.equal(after.countMarks.filter(m=>m.x===40).length,3);assert.equal(after.countMarks.filter(m=>!m.included&&m.x===110).length,2);assert.equal(after.countMarks.find(m=>m.id===manual.id).origin,'manual');assert.equal(after.countMarks.reduce((n,m)=>n+m.quantity,0),4);
 const bMark=after.countMarks.find(m=>m.drawing_id===b.drawing.id&&m.page===1&&m.x===40),decision=nativeDecisionForMark({mark:bMark,example,drawing:b.drawing,pageNumber:1});assert.deepEqual(decision.elementIds,b.pages[0].glyphs.get(40));assert.notDeepEqual(decision.elementIds,a.pages[0].glyphs.get(40));assert.equal(nativeDecisionForMark({mark:bMark,example,drawing:{...b.drawing,digest:a.drawing.digest},pageNumber:1}),null);assert.equal(nativeDecisionForMark({mark:bMark,example,drawing:b.drawing,pageNumber:2}),null);
 assert.deepEqual(vectorReviewPage(example.example,b.drawing.id,2).decisions,[]);store.close();store.close=()=>{};const reopened=await openStore(f.directory);try{assert.deepEqual(reopened.snapshot(),after);}finally{reopened.close();}
});

test('page manifests, source identity, digest, discipline and selected decisions reject before any writes',async t=>{
 const f=await workspace(t),basePages=[f.bundle(f.a,1,[40]),f.bundle(f.a,2,[40]),f.bundle(f.b,1,[40])],valid=f.payload(basePages),before=f.store.snapshot();
 const variants=[v=>v.vectorReview.pages[2].digest='a'.repeat(64),v=>v.scope[0].pages=[2,1],v=>v.scope[1].pages=[2],v=>v.vectorReview.pages.push(structuredClone(v.vectorReview.pages[0])),v=>v.vectorReview.pages=v.vectorReview.pages.filter(p=>p.drawing_id!==f.a.drawing.id||p.page!==1),v=>v.matches[2].drawing_id=f.a.drawing.id,v=>v.matches[2].score=.9,v=>v.vectorReview.pages[2].decisions[0].elementIds=[9,8],v=>v.expected_marks.pop(),v=>v.item_version=999];
 for(const mutate of variants){const value=structuredClone(valid);mutate(value);assert.throws(()=>f.store.editCountSelection(f.example.id,value));assert.deepEqual(f.store.snapshot(),before);}
 const foreignDiscipline=f.store.create('discipline',f.takeoff.id,'Other discipline'),foreign=await f.store.importPdf(foreignDiscipline.id,'Foreign.pdf',f.b.bytes),foreignPage={...f.bundle(f.b,2,[]),drawing_id:foreign.id,digest:foreign.digest},foreignBefore=f.store.snapshot();assert.throws(()=>f.store.editCountSelection(f.example.id,f.payload([...basePages,foreignPage])),/another discipline/);assert.deepEqual(f.store.snapshot(),foreignBefore);
});

test('page-set changes preserve protected corrections and reject shifted or conflicting proposals',async t=>{
 const f=await workspace(t),pages=[f.bundle(f.a,1,[40]),f.bundle(f.a,2,[40]),f.bundle(f.b,1,[40]),f.bundle(f.b,2,[])];f.store.editCountSelection(f.example.id,f.payload(pages));let before=f.store.snapshot();
 const mark=before.countMarks.find(m=>m.drawing_id===f.b.drawing.id);f.store.updateMark(mark.id,{version:mark.version,included:false,reviewed:true});before=f.store.snapshot();const shifted=structuredClone(pages);shifted[2].decisions[0].x=45;assert.throws(()=>f.store.editCountSelection(f.example.id,f.payload(shifted)),/overlap an existing correction/);assert.deepEqual(f.store.snapshot(),before);
 const reviewed=before.countMarks.find(m=>m.drawing_id===f.a.drawing.id&&m.page===2);f.store.updateMark(reviewed.id,{version:reviewed.version,included:true,reviewed:true});before=f.store.snapshot();const rejected=structuredClone(pages);rejected[1].decisions[0].included=false;rejected[1].provenance.selectedCount=0;assert.throws(()=>f.store.editCountSelection(f.example.id,f.payload(rejected)),/conflicts with an existing correction/);assert.deepEqual(f.store.snapshot(),before);
});

test('explicit scope change preserves outside-page marks and requires their complete current versions',async t=>{
 const f=await workspace(t),pages=[f.bundle(f.a,1,[40,110]),f.bundle(f.a,2,[40]),f.bundle(f.b,1,[40,[110,false]]),f.bundle(f.b,2,[])];f.store.editCountSelection(f.example.id,f.payload(pages));
 const outside=f.store.snapshot().countMarks.find(m=>m.drawing_id===f.a.drawing.id&&m.page===2),other=f.store.createCount(f.discipline.id,{name:'Other'});f.store.updateMark(outside.id,{version:outside.version,included:true,reviewed:true,item_id:other.id});f.store.addManualMark(f.item.id,{drawing_id:f.b.drawing.id,page:2,x:190,y:40});
 const before=f.store.snapshot(),narrow=[f.bundle(f.a,1,[40])],request=f.payload(narrow),missing=structuredClone(request);missing.expected_marks=missing.expected_marks.filter(m=>m.id!==outside.id);
 assert.throws(()=>f.store.editCountSelection(f.example.id,missing),/Matches changed/);assert.deepEqual(f.store.snapshot(),before);
 const stale=structuredClone(request);stale.expected_marks.find(m=>m.id===outside.id).version--;assert.throws(()=>f.store.editCountSelection(f.example.id,stale),/Matches changed/);assert.deepEqual(f.store.snapshot(),before);
 f.store.editCountSelection(f.example.id,request);const after=f.store.snapshot();for(const old of before.countMarks.filter(m=>m.drawing_id!==f.a.drawing.id||m.page!==1))assert.deepEqual(after.countMarks.find(m=>m.id===old.id),old);
 assert.equal(after.countMarks.some(m=>m.drawing_id===f.a.drawing.id&&m.page===1&&m.x===110),false,'only obsolete unchecked mark inside the explicit new scope is removed');assert.deepEqual(vectorReviewPages(after.countExamples[0].example).map(p=>[p.drawing_id,p.page]),[[f.a.drawing.id,1]]);
 const current=f.store.snapshot(),skip=f.recount(f.b,[]);delete skip.selections[0].vectorReview;f.store.recountDrawing(f.b.drawing.id,skip);assert.deepEqual(f.store.snapshot().countMarks,current.countMarks,'recount outside saved scope preserves every old mark');
 f.store.editCountSelection(f.example.id,f.payload(pages));for(const old of before.countMarks.filter(m=>m.reviewed||m.origin==='manual'))assert.deepEqual(f.store.snapshot().countMarks.find(m=>m.id===old.id),old);
});

test('page-local paint IDs may repeat across pages but one physical set cannot become two same-page marks',async t=>{
 const f=await workspace(t),pages=[f.bundle(f.a,1,[40]),f.bundle(f.a,2,[40]),f.bundle(f.b,1,[40])],request=f.payload(pages),before=f.store.snapshot();assert.deepEqual(pages[0].decisions[0].elementIds,pages[1].decisions[0].elementIds);assert.equal(validVectorReview(request.vectorReview,3),true);
 const duplicate=structuredClone(request),bundle=duplicate.vectorReview.pages[0];bundle.decisions.push({...structuredClone(bundle.decisions[0]),x:110});for(const field of ['proposalCount','verifiedCount','selectedCount'])bundle.provenance[field]++;duplicate.matches.push({...duplicate.matches[0],x:110});assert.equal(validVectorReview(duplicate.vectorReview,4),false);assert.throws(()=>f.store.editCountSelection(f.example.id,duplicate),/Invalid native/);assert.deepEqual(f.store.snapshot(),before);
 f.store.editCountSelection(f.example.id,request);assert.equal(f.store.snapshot().countMarks.length,3);
});

test('page-set multiplier, overlapping zones and reviewed Excel quantities reconcile exactly',async t=>{
 const f=await workspace(t),pages=[f.bundle(f.a,1,[40,110]),f.bundle(f.a,2,[40]),f.bundle(f.b,1,[40,[110,false]])];f.store.editCountSelection(f.example.id,f.payload(pages));let s=f.store.snapshot();f.store.updateCountMultiplier(f.example.id,{version:s.countExamples[0].version,multiplier:3});f.store.addManualMark(f.item.id,{drawing_id:f.b.drawing.id,page:2,x:190,y:40});
 const west=f.store.createZoneHeading(f.discipline.id,{name:'West'}),east=f.store.createZoneHeading(f.discipline.id,{name:'East'});f.store.createZone(f.a.drawing.id,{heading_id:west.id,page:1,points:[[0,0],[60,0],[60,160],[0,160]]});f.store.createZone(f.a.drawing.id,{heading_id:east.id,page:1,points:[[30,0],[140,0],[140,160],[30,160]]});s=f.store.snapshot();assert.equal(s.quantitySchedule.reduce((sum,row)=>sum+row.value,0),13);
 await assert.rejects(quantityWorkbook(s,f.takeoff.id),/Review/);f.store.reviewMarks(f.item.id,s.countMarks.filter(m=>m.included&&!m.reviewed).map(m=>({id:m.id,version:m.version,included:true,reviewed:true})));s=f.store.snapshot();assert.equal(s.quantitySchedule.reduce((sum,row)=>sum+row.value,0),13);
 const book=new ExcelJS.Workbook();await book.xlsx.load((await quantityWorkbook(s,f.takeoff.id)).bytes);let total=0;book.getWorksheet('Count instances').eachRow((row,n)=>{if(n>1)total+=row.getCell(17).value;});assert.equal(total,13);assert.equal(book.getWorksheet('Selection edits').getCell('J2').value,VECTOR_PAGE_REVIEW_VERSION);
});

test('actual target PDF glyph preparation uses target-local IDs and cancellation returns no partial masks',async t=>{
 const f=await workspace(t),pages=[f.bundle(f.a,1,[40]),f.bundle(f.a,2,[40]),f.bundle(f.b,1,[40])];f.store.editCountSelection(f.example.id,f.payload(pages));const s=f.store.snapshot(),mark=s.countMarks.find(m=>m.drawing_id===f.b.drawing.id),allocations=[];
 const options={pdfjs:{OPS,version:pdfjsVersion,getDocument:options=>{assert.equal(options.url,`/api/drawings/${f.b.drawing.id}/source`);return getDocument({data:new Uint8Array(f.b.bytes),isEvalSupported:false});}},drawing:f.b.drawing,pageNumber:1,marks:[mark],examples:s.countExamples,createCanvas:(w,h)=>{const c=createCanvas(w,h);allocations.push(c);return c;}};
 const result=await prepareNativeCountInk(options),mask=result.masks.get(mark.id);assert.ok(mask,JSON.stringify(result.refusals));assert.equal(result.refusals.length,0);assert.ok(mask.left>10&&mask.top+mask.height<310,'crop excludes the preceding unrelated paint near native [2,2]');assert.ok(mask.left<80&&mask.left+mask.width>80&&mask.top<240&&mask.top+mask.height>240,'target glyph is at its own viewport position');assert.ok(allocations.every(c=>!c.width&&!c.height));
 let cancelled=false;await assert.rejects(prepareNativeCountInk({...options,cancelled:()=>cancelled,createCanvas:(w,h)=>{cancelled=true;return options.createCanvas(w,h);}}),/cancelled/);assert.ok(allocations.every(c=>!c.width&&!c.height));assert.deepEqual(f.store.snapshot(),s,'glyph preparation and cancelled output cannot mutate saved marks');
});

test('partial drawing recount merges only completed declared pages and never replays decisions on untouched pages',async t=>{
 const f=await workspace(t),pages=[f.bundle(f.a,1,[40]),f.bundle(f.a,2,[40]),f.bundle(f.b,1,[40,[110,false]]),f.bundle(f.b,2,[])];f.store.editCountSelection(f.example.id,f.payload(pages));let s=f.store.snapshot(),rejected=s.countMarks.find(m=>m.drawing_id===f.b.drawing.id&&m.x===110);f.store.updateMark(rejected.id,{version:rejected.version,included:true,reviewed:true});s=f.store.snapshot();const kept=s.countMarks.filter(m=>m.drawing_id!==f.b.drawing.id||m.page!==2),oldPages=s.countExamples[0].example.vectorReview.pages.map(p=>JSON.stringify(p));
 f.store.recountDrawing(f.b.drawing.id,f.recount(f.b,[f.bundle(f.b,2,[40,110])]));const after=f.store.snapshot();for(const m of kept)assert.deepEqual(after.countMarks.find(n=>n.id===m.id),m);for(let i=0;i<3;i++)assert.equal(JSON.stringify(after.countExamples[0].example.vectorReview.pages[i]),oldPages[i]);assert.equal(after.countExamples[0].version,s.countExamples[0].version+1);assert.equal(after.countMarks.filter(m=>m.drawing_id===f.b.drawing.id&&m.page===2).length,2);assert.ok(after.countMarks.filter(m=>m.drawing_id===f.b.drawing.id&&m.page===2).every(m=>m.reviewed===0));
 const before=after;assert.throws(()=>f.store.recountDrawing(f.b.drawing.id,f.recount(f.b,[f.bundle(f.a,1,[40])])),/declared target pages/);assert.deepEqual(f.store.snapshot(),before);
});

test('failed Apply and recount audit roll back every page, provenance version and rejection event',async t=>{
 const f=await workspace(t),pages=[f.bundle(f.a,1,[40,110]),f.bundle(f.a,2,[40]),f.bundle(f.b,1,[40,[110,false]]),f.bundle(f.b,2,[])],db=new DatabaseSync(join(f.directory,'projects.sqlite'));let before=f.store.snapshot();
 try{db.exec("CREATE TRIGGER fail_page_apply BEFORE INSERT ON count_selection_events BEGIN SELECT RAISE(ABORT,'page apply audit failed'); END");assert.throws(()=>f.store.editCountSelection(f.example.id,f.payload(pages)),/page apply audit failed/);assert.deepEqual(f.store.snapshot(),before);db.exec('DROP TRIGGER fail_page_apply');f.store.editCountSelection(f.example.id,f.payload(pages));before=f.store.snapshot();db.exec("CREATE TRIGGER fail_page_recount BEFORE INSERT ON count_drawing_recounts BEGIN SELECT RAISE(ABORT,'page recount audit failed'); END");assert.throws(()=>f.store.recountDrawing(f.b.drawing.id,f.recount(f.b,[f.bundle(f.b,2,[40,[110,false]])])),/page recount audit failed/);assert.deepEqual(f.store.snapshot(),before);}finally{db.close();}
});

test('v2 caps and explicit layer-name policy do not widen v1 or permit ambiguous scope',()=>{
 const decision=i=>({x:i,y:0,rotation:0,elementIds:[i],included:true}),provenance=n=>({engine:'vector-pattern-review-1',visibility:'contour-paint-visibility-4',requestedPaints:50000,admittedPaints:50000,unknownCount:0,excludedCount:0,proposalCount:n,verifiedCount:n,selectedCount:n}),page=(number,n)=>({drawing_id:'drawing',page:number,digest:'a'.repeat(64),layerScope:{mode:'all-admitted'},provenance:provenance(n),decisions:Array.from({length:n},(_,i)=>decision(i))}),review=pages=>({version:VECTOR_PAGE_REVIEW_VERSION,scope:'explicit-pages',anchor:[0,0],decision:'apply',layerPolicy:'all-admitted',pages});
 assert.equal(validVectorReview(review([page(1,512),page(2,512),page(3,512),page(4,512)])),true);assert.equal(validVectorReview(review([page(1,513)])),false);assert.equal(validVectorReview(review([page(1,512),page(2,512),page(3,512),page(4,512),page(5,1)])),false);assert.equal(validVectorReview(review(Array.from({length:21},(_,i)=>page(i+1,0)))),false);
 const large=review([page(1,512)]);for(const d of large.pages[0].decisions)d.elementIds=Array.from({length:128},(_,i)=>i);assert.equal(validVectorReview(large),false);
 const scoped=review([page(1,1),page(2,1)]);scoped.layerPolicy='same-layer-name';for(const [i,p]of scoped.pages.entries())p.layerScope={mode:'unique-visible-ocg-name',name:'Original symbols',ocgId:'local-'+i,configurationHash:'config-'+i};assert.equal(validVectorReview(scoped),true);scoped.pages[1].layerScope.name='Different';assert.equal(validVectorReview(scoped),false);
 const v1={version:VECTOR_REVIEW_VERSION,scope:'source-page',anchor:[0,0],decision:'apply',sourceLayerScope:false,provenance:{...provenance(129),engine:'vector-candidate-review-1'},decisions:Array.from({length:129},(_,i)=>decision(i))};assert.equal(validVectorReview(v1),false);assert.deepEqual(vectorReviewPages({algorithm:'binary-overlap-1'}),[]);
});

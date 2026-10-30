import test from 'node:test';
import assert from 'node:assert/strict';
import {getDocument,OPS} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {vectorQaFixture} from '../scripts/vector-qa-fixture.mjs';
import {benchmarkVectorPreview} from '../scripts/run-vector-preview-benchmark.mjs';
import {extractVectorPage,createVectorTemplate,findVectorMatches} from '../apps/local/web/vector-recognition.mjs';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import ExcelJS from 'exceljs';
import {openStore} from '../apps/local/store.mjs';
import {quantityWorkbook} from '../apps/local/workbook.mjs';
import {ELEMENT_RENDERER} from '../apps/local/web/pdf-elements.mjs';

test('vector preview improves crossing/fractional fixture recall; raw negative and unsupported labels stay in reported metrics',async()=>{
 const r=await benchmarkVectorPreview();assert.deepEqual([r.baseline.raster_quarter_turns.tp,r.baseline.raster_quarter_turns.fp,r.baseline.raster_quarter_turns.fn],[9,2,5]);
 assert.deepEqual([r.candidate.tp,r.candidate.fp,r.candidate.fn],[11,1,3]);assert.equal(r.candidate.duplicates,0);
 assert.ok(r.candidate.matched.includes('fractional-crossing'));assert.ok(r.candidate.matched.includes('two-pipe-crossing'));
 assert.deepEqual(r.candidate.timings.map(t=>t.engine),['vector','raster','raster','raster']);
});

test('vector upgrade preserves reviewed exclusions, reclassification, manual marks, overlapping zones and exact workbook/reopen quantities',async()=>{
 const result=await benchmarkVectorPreview(),fixture=await vectorQaFixture(),directory=await mkdtemp(join(tmpdir(),'fire-vector-integrity-'));let store;
 try{
  store=await openStore(directory);const p=store.create('project',null,'Vector integrity'),t=store.create('takeoff',p.id,'Takeoff'),d=store.create('discipline',t.id,'Sprinklers'),drawing=await store.importPdf(d.id,'owned.pdf',fixture.bytes);
  const match=h=>({...h,drawing_id:drawing.id,digest:drawing.digest,score:1}),definition={drawing_id:drawing.id,page:1,bounds:fixture.manifest.selection,digest:drawing.digest,algorithm:'binary-elements-rotations-1',elements:{renderer:ELEMENT_RENDERER,ids:[5,6,7,13],excluded:[13]}};
  const item=store.createCount(d.id,{name:'Sprinklers',example:definition,matches:result.baseline.raster_quarter_turns.hits.map(match)}),other=store.createCount(d.id,{name:'Special sprinklers'});
  let s=store.snapshot();const seed=s.countMarks.find(m=>m.page===1&&m.x===50&&m.y===50),mirror=s.countMarks.find(m=>m.page===1&&m.x===350&&m.y===250),moved=s.countMarks.find(m=>m.page===1&&m.x===250&&m.y===50);
  for(const m of [seed,mirror])store.updateMark(m.id,{version:m.version,included:false,reviewed:true});store.updateMark(moved.id,{version:moved.version,included:true,reviewed:true,item_id:other.id});store.addManualMark(item.id,{drawing_id:drawing.id,page:1,x:390,y:390});
  const west=store.createZoneHeading(d.id,{name:'West'}),east=store.createZoneHeading(d.id,{name:'East'});store.createZone(drawing.id,{heading_id:west.id,page:1,points:[[0,0],[200,0],[200,400],[0,400]]});store.createZone(drawing.id,{heading_id:east.id,page:1,points:[[150,0],[400,0],[400,400],[150,400]]});
  s=store.snapshot();const retained=s.countMarks.filter(m=>m.reviewed),zones=structuredClone(s.zones),headings=structuredClone(s.zoneHeadings),e=s.countExamples[0];
  const body={version:e.version,vector:true,matches:result.candidate.hits.map(match),scope:[{id:drawing.id,digest:drawing.digest}],expected_marks:s.countMarks.filter(m=>m.example_id===e.id).map(m=>({id:m.id,version:m.version}))};
  assert.throws(()=>store.editCountSelection(e.id,{...body,vector:'true'}),/vector/);assert.deepEqual(store.snapshot(),s);
  store.editCountSelection(e.id,body);s=store.snapshot();assert.equal(s.countExamples[0].example.algorithm,'vector-elements-1');for(const m of retained)assert.deepEqual(s.countMarks.find(n=>n.id===m.id),m);assert.deepEqual(s.zones,zones);assert.equal(JSON.stringify(s.zoneHeadings),JSON.stringify(headings));
  const ids=s.countMarks.map(m=>m.id).sort();store.editCountSelection(e.id,{...body,version:s.countExamples[0].version,expected_marks:s.countMarks.filter(m=>m.example_id===e.id).map(m=>({id:m.id,version:m.version}))});assert.deepEqual(store.snapshot().countMarks.map(m=>m.id).sort(),ids);
  for(const i of [item,other])store.reviewMarks(i.id,store.snapshot().countMarks.filter(m=>m.item_id===i.id).map(m=>({id:m.id,version:m.version,included:!!m.included,reviewed:true})));s=store.snapshot();
  assert.equal(s.countMarks.filter(m=>m.included).length,11);assert.equal(s.quantitySchedule.reduce((n,r)=>n+r.value,0),11);
  for(const row of s.quantitySchedule){const m=s.countMarks.find(m=>m.id===row.source_id);assert.equal(row.heading_id,m.page!==1?null:m.x<=200?west.id:east.id);}
  const book=new ExcelJS.Workbook();await book.xlsx.load((await quantityWorkbook(s,t.id)).bytes);const instances=book.getWorksheet('Count instances');let total=0;instances.eachRow((r,n)=>{if(n>1)total+=r.getCell(17).value;});assert.equal(total,11);assert.equal(book.getWorksheet('Selection edits').getCell('J2').value,'vector-elements-1');
  store.close();store=await openStore(directory);assert.deepEqual(store.snapshot(),s);
 }finally{store?.close();await rm(directory,{recursive:true,force:true});}
});
test('whole vector paths require explicit pipe exclusion; bounded cancellation and native off-centre anchor are retained',async()=>{
 const f=await vectorQaFixture(),task=getDocument({data:new Uint8Array(f.bytes),isEvalSupported:false});
 try{const page=await(await task.promise).getPage(1),v=extractVectorPage({operatorList:await page.getOperatorList(),OPS});
  assert.equal(createVectorTemplate(v,{bounds:f.manifest.selection,anchor:[50,50]}).supported,false);
  const t=createVectorTemplate(v,{bounds:f.manifest.selection,anchor:[51,52],ids:[5,6,7,13],excluded:[13]});assert.ok(t.supported);
  const hits=findVectorMatches(v,t);assert.ok(hits.some(h=>h.x===51&&h.y===52&&h.rotation===0));assert.ok(hits.some(h=>h.x===248&&h.y===51&&h.rotation===90));
  assert.throws(()=>findVectorMatches(v,t,{maxComparisons:1}),/budget/);assert.throws(()=>findVectorMatches(v,t,{cancelled:()=>true}),/cancelled/);
  assert.equal(createVectorTemplate(v,{bounds:f.manifest.selection,anchor:[50,50],ids:[999999],excluded:[]}).supported,false);
 }finally{await task.destroy();}
});

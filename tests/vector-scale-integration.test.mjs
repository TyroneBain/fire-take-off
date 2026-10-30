import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import ExcelJS from 'exceljs';
import {getDocument,OPS} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {createCanvas} from '@napi-rs/canvas';
import {vectorScaleQaFixture} from '../scripts/vector-scale-qa-fixture.mjs';
import {extractVectorPage,createVectorTemplate,VECTOR_MATCHER_VERSION,VECTOR_FIXED_VERSION,VECTOR_SCALE_VERSION,VECTOR_SCALE_FIXED_VERSION} from '../apps/local/web/vector-recognition.mjs';
import {inkImage,exampleImage,isVectorAlgorithm,includesRotations,includesScales} from '../apps/local/web/matcher.mjs';
import {ELEMENT_RENDERER,selectionFilter,editedTemplate} from '../apps/local/web/pdf-elements.mjs';
import {matchRequestResult} from '../apps/local/web/match-worker.mjs';
import {recognizeDrawing} from '../apps/local/web/recognize-drawing.mjs';
import {openStore} from '../apps/local/store.mjs';
import {quantityWorkbook} from '../apps/local/workbook.mjs';

const elements={renderer:ELEMENT_RENDERER,ids:[5,6,7,8,13],excluded:[13]};
async function render(bytes,number=1,selection){
 const task=getDocument({data:new Uint8Array(bytes),isEvalSupported:false});
 try{const page=await(await task.promise).getPage(number),vectorPage=extractVectorPage({operatorList:await page.getOperatorList(),OPS}),viewport=page.getViewport({scale:2,rotation:0}),canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height)),ctx=canvas.getContext('2d');
  await page.render({canvas,canvasContext:ctx,viewport,operationsFilter:selection?selectionFilter(selection):undefined}).promise;
  return {data:ctx.getImageData(0,0,canvas.width,canvas.height).data,width:canvas.width,height:canvas.height,viewport,vectorPage};
 }finally{await task.destroy();}
}
const worker=(r,template)=>matchRequestResult({rgba:r.data,width:r.width,height:r.height,vectorPage:r.vectorPage,template});
async function inputs(){
 const f=vectorScaleQaFixture(),r=await render(f.bytes),clean=await render(f.bytes,1,elements),b=f.manifest.selection,box=[...r.viewport.convertToViewportPoint(b[0],b[3]),...r.viewport.convertToViewportPoint(b[2],b[1])],original=exampleImage(inkImage(r.data,r.width,r.height),box),anchor=r.viewport.convertToPdfPoint(original.left+original.width/2,original.top+original.height/2);
 const template={...editedTemplate(inkImage(r.data,r.width,r.height),inkImage(clean.data,clean.width,clean.height),box),matchRotations:true,matchThreshold:.95,vector:createVectorTemplate(r.vectorPage,{bounds:b,...elements,anchor})};
 return {f,r,template};
}

test('scaled worker opt-in supports all four policy versions and leaves raster fallback same-size',async()=>{
 const {f,r,template}=await inputs();
 assert.equal(worker(r,template).matches.length,4);
 assert.equal(worker(r,{...template,matchScales:true}).matches.length,16);
 assert.equal(worker(r,{...template,matchScales:true,matchRotations:false}).matches.length,4);
 const fallback=await render(f.bytes,2),same=worker(fallback,template),scaled=worker(fallback,{...template,matchScales:true});
 assert.equal(scaled.engine,'raster');assert.ok(scaled.fallbackReason);assert.deepEqual(scaled.matches,same.matches);
 for(const [algorithm,rotations,scales]of [[VECTOR_MATCHER_VERSION,true,false],[VECTOR_FIXED_VERSION,false,false],[VECTOR_SCALE_VERSION,true,true],[VECTOR_SCALE_FIXED_VERSION,false,true]]){
  assert.equal(isVectorAlgorithm(algorithm),true);assert.equal(includesRotations(algorithm),rotations);assert.equal(includesScales(algorithm),scales);
 }
});

test('explicit scale policy survives cleanup, rotation updates, recount, correction retention, zones, Excel and reopen',async()=>{
 const {f,r,template}=await inputs(),directory=await mkdtemp(join(tmpdir(),'fire-vector-scale-'));let store;
 try{
  store=await openStore(directory);const p=store.create('project',null,'Scale integration'),t=store.create('takeoff',p.id,'Takeoff'),d=store.create('discipline',t.id,'Sprinklers'),drawing=await store.importPdf(d.id,'owned-scales.pdf',f.bytes);
  const match=h=>({drawing_id:drawing.id,digest:drawing.digest,page:1,x:h.x,y:h.y,score:h.score}),definition={drawing_id:drawing.id,page:1,bounds:f.manifest.selection,digest:drawing.digest,algorithm:VECTOR_MATCHER_VERSION,elements};
  const item=store.createCount(d.id,{name:'Heads',color:'#1480fa',example:definition,matches:worker(r,template).matches.map(match)}),other=store.createCount(d.id,{name:'Special heads'});
  let s=store.snapshot(),e=s.countExamples[0];const seed=s.countMarks.find(m=>Math.hypot(m.x-80,m.y-80)<.01),moved=s.countMarks.find(m=>Math.hypot(m.x-220,m.y-80)<.01);
  store.updateMark(seed.id,{version:seed.version,included:false,reviewed:true});store.updateMark(moved.id,{version:moved.version,included:true,reviewed:true,item_id:other.id});store.addManualMark(item.id,{drawing_id:drawing.id,page:1,x:550,y:620});
  const west=store.createZoneHeading(d.id,{name:'West'}),east=store.createZoneHeading(d.id,{name:'East'});store.createZone(drawing.id,{heading_id:west.id,page:1,points:[[0,0],[300,0],[300,650],[0,650]]});store.createZone(drawing.id,{heading_id:east.id,page:1,points:[[200,0],[600,0],[600,650],[200,650]]});
  s=store.snapshot();const corrections=s.countMarks.filter(m=>m.reviewed),zones=s.zones,zoneHeadings=s.zoneHeadings;
  const body=()=>{const state=store.snapshot(),saved=state.countExamples.find(x=>x.id===e.id);return {version:saved.version,matches:worker(r,{...template,matchScales:true}).matches.map(match),scope:[{id:drawing.id,digest:drawing.digest}],expected_marks:state.countMarks.filter(m=>m.example_id===e.id).map(m=>({id:m.id,version:m.version}))};};
  for(const scales of ['true',1,null]){assert.throws(()=>store.editCountSelection(e.id,{...body(),scales}),/scale setting/);assert.deepEqual(store.snapshot(),s);}
  assert.throws(()=>store.editCountSelection(e.id,{...body(),vector:false,scales:true}),/require vector/);assert.deepEqual(store.snapshot(),s);
  const upgrade=store.editCountSelection(e.id,{...body(),scales:true});assert.equal(upgrade.added,12);assert.equal(upgrade.removed,0);
  const assertPreserved=()=>{const current=store.snapshot();for(const mark of corrections)assert.deepEqual(current.countMarks.find(m=>m.id===mark.id),mark);assert.deepEqual(current.zones,zones);assert.deepEqual(current.zoneHeadings,zoneHeadings);assert.equal(current.countItems.find(i=>i.id===item.id).color,'#1480fa');};assertPreserved();
  assert.equal(store.snapshot().countExamples[0].example.algorithm,VECTOR_SCALE_VERSION);
  const before=store.snapshot();assert.throws(()=>store.editCountSelection(e.id,{...body(),vector:false}),/require vector/);assert.deepEqual(store.snapshot(),before);
  store.editCountSelection(e.id,{...body(),elements});assert.equal(store.snapshot().countExamples[0].example.algorithm,VECTOR_SCALE_VERSION,'cleanup must preserve absent scale policy');
  store.editCountSelection(e.id,{...body(),rotations:false});assert.equal(store.snapshot().countExamples[0].example.algorithm,VECTOR_SCALE_FIXED_VERSION);
  store.editCountSelection(e.id,{...body(),rotations:true});assert.equal(store.snapshot().countExamples[0].example.algorithm,VECTOR_SCALE_VERSION);assertPreserved();
  const beforeRecount=store.snapshot(),flags=[];
  const payload=await recognizeDrawing({state:beforeRecount,target:drawing,render:(_d,n,selection)=>render(f.bytes,n,selection),search:async(raster,tpl)=>{flags.push([tpl.matchRotations,tpl.matchScales]);return worker(raster,tpl).matches;}});
  assert.ok(flags.length===2&&flags.every(([rotation,scale])=>rotation&&scale));assert.equal(payload.selections[0].matches.filter(m=>m.page===1).length,16);
  const rerun=store.recountDrawing(drawing.id,payload);assert.equal(rerun.added,0);assert.equal(rerun.removed,0);assertPreserved();
  for(const heading of [item,other])store.reviewMarks(heading.id,store.snapshot().countMarks.filter(m=>m.item_id===heading.id).map(m=>({id:m.id,version:m.version,included:!!m.included,reviewed:true})));
  s=store.snapshot();assert.equal(s.countMarks.length,17);assert.equal(s.countMarks.filter(m=>m.included).length,16);assert.equal(s.quantitySchedule.reduce((n,row)=>n+row.value,0),16);
  for(const row of s.quantitySchedule){const m=s.countMarks.find(m=>m.id===row.source_id);assert.equal(row.heading_id,m.x<=300?west.id:east.id);}
  const workbook=new ExcelJS.Workbook();await workbook.xlsx.load((await quantityWorkbook(s,t.id)).bytes);let total=0;workbook.getWorksheet('Count instances').eachRow((row,n)=>{if(n>1)total+=row.getCell(17).value;});assert.equal(total,16);assert.equal(workbook.getWorksheet('Selection edits').getCell('J2').value,VECTOR_SCALE_VERSION);
  store.close();store=await openStore(directory);assert.deepEqual(store.snapshot(),s);
 }finally{store?.close();await rm(directory,{recursive:true,force:true});}
});

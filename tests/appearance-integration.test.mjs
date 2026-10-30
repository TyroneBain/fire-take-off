import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import ExcelJS from 'exceljs';
import {rotationFixture} from '../scripts/generate-count-rotation-fixture.mjs';
import {openStore} from '../apps/local/store.mjs';
import {quantityWorkbook} from '../apps/local/workbook.mjs';
import {ELEMENT_RENDERER} from '../apps/local/web/pdf-elements.mjs';
import {APPEARANCE_MATCHER_VERSION,APPEARANCE_FIXED_VERSION,isAppearanceAlgorithm} from '../apps/local/web/appearance-policy.mjs';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {createCanvas} from '@napi-rs/canvas';
import {appearanceTemplate} from '../apps/local/web/appearance-template.mjs';
import {inkImage,exampleImage,includesRotations,matchingThreshold} from '../apps/local/web/matcher.mjs';
import {matchRequestResult} from '../apps/local/web/match-worker.mjs';
import {recognizeDrawing} from '../apps/local/web/recognize-drawing.mjs';

async function workspace(t){
 const directory=await mkdtemp(join(tmpdir(),'fire-appearance-')),store=await openStore(directory);let closed=false;const close=()=>{if(!closed){store.close();closed=true;}};t.after(async()=>{close();await rm(directory,{recursive:true,force:true});});
 const p=store.create('project',null,'Appearance policy'),takeoff=store.create('takeoff',p.id,'Takeoff'),discipline=store.create('discipline',takeoff.id,'Fire'),fixture=rotationFixture(),drawing=await store.importPdf(discipline.id,'owned-appearance.pdf',fixture.bytes);
 const hit=(x,y=100)=>({drawing_id:drawing.id,digest:drawing.digest,page:1,x,y,score:1}),definition=algorithm=>({drawing_id:drawing.id,digest:drawing.digest,page:1,bounds:fixture.manifest.selection,algorithm});
 const edit=(id,matches)=>{const s=store.snapshot(),e=s.countExamples.find(e=>e.id===id);return{version:e.version,rotations:true,matches,scope:[{id:drawing.id,digest:drawing.digest}],expected_marks:s.countMarks.filter(m=>m.example_id===id).map(m=>({id:m.id,version:m.version}))};};
 const recount=matchesFor=>{const s=store.snapshot();return{digest:drawing.digest,selections:s.countExamples.map(e=>({id:e.id,version:e.version,item_version:s.countItems.find(i=>i.id===e.item_id).version,matches:matchesFor(e)})),expected_marks:s.countMarks.map(m=>({id:m.id,version:m.version}))};};
 return{directory,store,close,takeoff,discipline,drawing,hit,definition,edit,recount};
}
const unchangedFailure=(store,run,expected)=>{const before=store.snapshot();assert.throws(run,expected);assert.deepEqual(store.snapshot(),before);};
async function renderFixture(bytes){
 const task=getDocument({data:new Uint8Array(bytes),isEvalSupported:false});
 try{const page=await(await task.promise).getPage(1),viewport=page.getViewport({scale:2,rotation:0}),width=Math.ceil(viewport.width),height=Math.ceil(viewport.height),canvas=createCanvas(width,height),ctx=canvas.getContext('2d');await page.render({canvas,canvasContext:ctx,viewport}).promise;return{data:ctx.getImageData(0,0,width,height).data,width,height,viewport};}finally{await task.destroy();}
}
const search=(r,template)=>matchRequestResult({rgba:r.data,width:r.width,height:r.height,template,vectorPage:{supported:false,reason:'Fixture checks explicit appearance dispatch'}});

test('actual PDF RGBA crop and worker preserve strict anchors, fixed orientation, source buffer independence and fail-closed inputs',async()=>{
 const fixture=rotationFixture(),r=await renderFixture(fixture.bytes),b=fixture.manifest.selection,box=[...r.viewport.convertToViewportPoint(b[0],b[3]),...r.viewport.convertToViewportPoint(b[2],b[1])],base=exampleImage(inkImage(r.data,r.width,r.height),box),template={...appearanceTemplate(r,base),matchAppearance:true,matchRotations:true,matchScales:false},strict=search(r,{...base,matchRotations:true,matchThreshold:.95}),result=search(r,template);
 const anchors=hits=>hits.map(h=>[h.left+h.anchorX,h.top+h.anchorY]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
 assert.equal(result.engine,'appearance');assert.equal(result.fallbackReason,null);assert.equal(result.matches.length,12);assert.deepEqual(anchors(result.matches),anchors(strict.matches),'strict passing identities must not move');assert.equal(search(r,{...template,matchRotations:false}).matches.length,3);
 assert.equal(includesRotations(APPEARANCE_MATCHER_VERSION),true);assert.equal(includesRotations(APPEARANCE_FIXED_VERSION),false);assert.equal(matchingThreshold(APPEARANCE_FIXED_VERSION),.95);
 for(const patch of [{matchScales:true},{vector:{supported:false}},{ignore:new Uint8Array(base.width*base.height)},{elementSubset:true}])assert.throws(()=>search(r,{...template,...patch}),/uncleaned/);
 assert.throws(()=>search(r,{...template,matchAppearance:'true'}),/policy/);
 const solid={width:20,height:20,data:new Uint8ClampedArray(1600).fill(255),matchAppearance:true,matchRotations:true};for(let y=4;y<16;y++)for(let x=4;x<16;x++)solid.data.set([0,0,0,255],(y*20+x)*4);assert.throws(()=>search(r,solid),/isolated contrast detail/,'unsupported detail must not return legacy hits');
 assert.throws(()=>appearanceTemplate(r,{...base,width:65,height:65}),/4096-pixel/);assert.throws(()=>appearanceTemplate(r,{...base,ignore:new Uint8Array(base.width*base.height)}),/cleaned/);
 const saved=template.data.slice(),copy=r.data.slice(),copiedTemplate=appearanceTemplate({...r,data:copy},base);structuredClone(copy,{transfer:[copy.buffer]});assert.equal(copy.byteLength,0);assert.deepEqual(copiedTemplate.data,saved);
});

test('saved appearance recount uses real PDF pixels and preserves reviewed identities; cancellation and unsupported cleaning return no payload',async t=>{
 const {store,discipline,drawing,definition}=await workspace(t),fixture=rotationFixture(),render=()=>renderFixture(fixture.bytes),i=store.createCount(discipline.id,{name:'Real worker',example:definition(APPEARANCE_MATCHER_VERSION),matches:[]}),workerFlags=[];
 const recognize=options=>recognizeDrawing({state:store.snapshot(),target:drawing,render,search:async(r,template)=>{workerFlags.push(template.matchAppearance);return search(r,template).matches;},...options});
 const payload=await recognize();assert.equal(payload.selections[0].matches.length,12);assert.equal(store.recountDrawing(drawing.id,payload).added,12);assert.deepEqual(workerFlags,[true]);
 const m=store.snapshot().countMarks[0];store.updateMark(m.id,{version:m.version,included:false,reviewed:true});const before=store.snapshot(),repeated=await recognize(),result=store.recountDrawing(drawing.id,repeated);assert.equal(result.added,0);assert.equal(result.removed,0);assert.deepEqual(store.snapshot().countMarks,before.countMarks);
 const state=store.snapshot();await assert.rejects(()=>recognize({cancelled:()=>true}),/cancelled/);let cancelled=false;await assert.rejects(()=>recognize({search:async(r,t)=>{const hits=search(r,t).matches;cancelled=true;return hits;},cancelled:()=>cancelled}),/cancelled/);
 await assert.rejects(()=>recognize({state:{...state,countExamples:state.countExamples.map(e=>({...e,example:{...e.example,elements:{renderer:ELEMENT_RENDERER,ids:[0],excluded:[]}}}))}}),/cleaned/);assert.deepEqual(store.snapshot(),state);assert.equal(state.countMarks.filter(m=>m.item_id===i.id&&m.included).length,11);
});

test('appearance is explicit for new selections; legacy policies and saved rotation choices never migrate',async t=>{
 const {store,discipline,definition,edit}=await workspace(t),legacy=['binary-overlap-1','binary-overlap-2','binary-overlap-rotations-1','vector-elements-1','vector-elements-fixed-1','vector-elements-scale-1','vector-elements-scale-fixed-1'];
 for(const algorithm of legacy){const i=store.createCount(discipline.id,{name:algorithm,example:definition(algorithm),matches:[]}),e=store.snapshot().countExamples.find(e=>e.item_id===i.id);assert.equal(isAppearanceAlgorithm(e.example.algorithm),false);unchangedFailure(store,()=>store.editCountSelection(e.id,{...edit(e.id,[]),appearance:true}),/new selection/);}
 assert.deepEqual(store.snapshot().countExamples.map(e=>e.example.algorithm).sort(),legacy.sort());
 const i=store.createCount(discipline.id,{name:'Appearance',example:definition(APPEARANCE_FIXED_VERSION),matches:[]}),id=store.snapshot().countExamples.find(e=>e.item_id===i.id).id;
 store.editCountSelection(id,{...edit(id,[]),rotations:false});assert.equal(store.snapshot().countExamples.find(e=>e.id===id).example.algorithm,APPEARANCE_FIXED_VERSION);
 store.editCountSelection(id,{...edit(id,[]),rotations:true});assert.equal(store.snapshot().countExamples.find(e=>e.id===id).example.algorithm,APPEARANCE_MATCHER_VERSION);
 for(const appearance of [null,1,'true'])unchangedFailure(store,()=>store.editCountSelection(id,{...edit(id,[]),appearance}),/appearance setting/);
 for(const patch of [{appearance:false},{vector:true},{scales:true},{elements:{renderer:ELEMENT_RENDERER,ids:[0,1],excluded:[]}}])unchangedFailure(store,()=>store.editCountSelection(id,{...edit(id,[]),...patch}),/new selection|uncleaned/);
 unchangedFailure(store,()=>store.createCount(discipline.id,{name:'Unsupported',example:{...definition(APPEARANCE_MATCHER_VERSION),elements:{renderer:ELEMENT_RENDERER,ids:[0,1],excluded:[]}},matches:[]}),/cleaned selections/);
});

test('appearance Add to current rejects shifted protected corrections atomically and keeps strict identity unchanged',async t=>{
 const {store,discipline,drawing,hit,definition}=await workspace(t),i=store.createCount(discipline.id,{name:'Appearance',example:definition(APPEARANCE_MATCHER_VERSION),matches:[hit(70),hit(170),hit(270)]}),other=store.createCount(discipline.id,{name:'Reclassified'});
 let s=store.snapshot();for(const m of s.countMarks)store.updateMark(m.id,{version:m.version,included:m.x!==70,reviewed:true,...(m.x===170?{item_id:other.id}:{})});store.addManualMark(i.id,{drawing_id:drawing.id,page:1,x:370,y:100});
 const add=matches=>store.addCountExample(i.id,{version:store.snapshot().countItems.find(x=>x.id===i.id).version,example:definition(APPEARANCE_MATCHER_VERSION),matches});
 s=store.snapshot();const exact=add([70,170,270,370].map(x=>hit(x+.499)));assert.equal(exact.skipped,4);assert.equal(exact.added,0);assert.deepEqual(store.snapshot(),s);
 for(const x of [70,170,270,370])for(const delta of [.5,1,28])unchangedFailure(store,()=>add([hit(450,300),hit(x+delta)]),{status:409});
 // A rejected request must not create its new example, modify an audit, or save
 // an earlier otherwise-valid hit. This is conservative rejection, not merging.
 unchangedFailure(store,()=>store.addCountExample(i.id,{version:store.snapshot().countItems.find(x=>x.id===i.id).version,example:{...definition(APPEARANCE_MATCHER_VERSION),bounds:[60,88,80,112]},matches:[hit(450,300),hit(70.5)]}),{status:409});
 const far=add([hit(70+28.01)]);assert.equal(far.added,1);
 const unrelated=store.createCount(discipline.id,{name:'Intentional second classification',example:definition(APPEARANCE_MATCHER_VERSION),matches:[hit(70.5)]});assert.ok(store.snapshot().countMarks.some(m=>m.item_id===unrelated.id&&m.x===70.5));
 // Existing legacy behavior remains unchanged; no global dedup widening.
 const old=store.createCount(discipline.id,{name:'Legacy',example:definition('binary-overlap-2'),matches:[hit(70)]}),m=store.snapshot().countMarks.find(m=>m.item_id===old.id);store.updateMark(m.id,{version:m.version,included:false,reviewed:true});assert.equal(store.addCountExample(old.id,{version:old.version,example:definition('binary-overlap-2'),matches:[hit(70.5)]}).added,1);
});

test('appearance edit and recount guard run before removals; protected source size and removed identities cannot bypass them',async t=>{
 const {store,discipline,hit,definition,edit,recount,drawing}=await workspace(t),i=store.createCount(discipline.id,{name:'Appearance',example:definition(APPEARANCE_MATCHER_VERSION),matches:[hit(70),hit(170)]});let s=store.snapshot(),e=s.countExamples[0],m=s.countMarks.find(m=>m.x===70);store.updateMark(m.id,{version:m.version,included:false,reviewed:true});
 for(const delta of [.5,1]){
  unchangedFailure(store,()=>store.editCountSelection(e.id,edit(e.id,[hit(70+delta),hit(450,300)])),{status:409});
  unchangedFailure(store,()=>store.recountDrawing(drawing.id,recount(()=>[hit(70+delta),hit(450,300)])),{status:409});
 }
 const larger={...definition('binary-overlap-2'),bounds:[130,60,210,140]};store.addCountExample(i.id,{version:store.snapshot().countItems.find(x=>x.id===i.id).version,example:larger,matches:[hit(270,300)]});m=store.snapshot().countMarks.find(m=>m.x===270);store.updateMark(m.id,{version:m.version,included:true,reviewed:true});
 unchangedFailure(store,()=>store.addCountExample(i.id,{version:store.snapshot().countItems.find(x=>x.id===i.id).version,example:definition(APPEARANCE_MATCHER_VERSION),matches:[hit(330,300)]}),{status:409});
 // The other selection's unchecked hit would be removed during this recount.
 // It cannot provide an identity exemption for a new hit near an exclusion.
 const legacy=store.snapshot().countExamples.find(x=>x.example.algorithm==='binary-overlap-2');store.addCountExample(i.id,{version:store.snapshot().countItems.find(x=>x.id===i.id).version,example:legacy.example,matches:[hit(71)]});
 unchangedFailure(store,()=>store.recountDrawing(drawing.id,recount(record=>record.id===e.id?[hit(71)]:[])),{status:409});
});

test('appearance repeated saves, rotation edits, recount, zones, multipliers, Excel and reopen preserve corrections and quantities',async t=>{
 const {directory,store,close,takeoff,discipline,drawing,hit,definition,edit,recount}=await workspace(t),i=store.createCount(discipline.id,{name:'Heads',color:'#147dfa',example:definition(APPEARANCE_MATCHER_VERSION),matches:[hit(70),hit(170),hit(270)]}),other=store.createCount(discipline.id,{name:'Special heads'});let s=store.snapshot(),e=s.countExamples[0];store.updateCountMultiplier(e.id,{version:e.version,multiplier:2});
 for(const m of s.countMarks){if(m.x===70||m.x===170)store.updateMark(m.id,{version:m.version,included:m.x!==70,reviewed:true,...(m.x===170?{item_id:other.id}:{})});}store.addManualMark(i.id,{drawing_id:drawing.id,page:1,x:370,y:100});
 const west=store.createZoneHeading(discipline.id,{name:'West'}),east=store.createZoneHeading(discipline.id,{name:'East'});store.createZone(drawing.id,{heading_id:west.id,page:1,points:[[0,0],[200,0],[200,560],[0,560]]});store.createZone(drawing.id,{heading_id:east.id,page:1,points:[[150,0],[500,0],[500,560],[150,560]]});
 const original=store.snapshot(),matches=[hit(70),hit(170),hit(270)];
 const added=store.addCountExample(i.id,{version:original.countItems.find(x=>x.id===i.id).version,example:definition(APPEARANCE_MATCHER_VERSION),matches});assert.equal(added.added,0);assert.equal(added.skipped,3);
 store.editCountSelection(e.id,{...edit(e.id,matches),rotations:false});store.editCountSelection(e.id,edit(e.id,matches));
 const payload=recount(()=>matches),result=store.recountDrawing(drawing.id,payload);assert.equal(result.added,0);assert.equal(result.removed,0);
 s=store.snapshot();for(const key of ['countMarks','zones','zoneHeadings','quantitySchedule'])assert.deepEqual(s[key],original[key]);assert.equal(s.countExamples[0].example.algorithm,APPEARANCE_MATCHER_VERSION);assert.equal(s.quantitySchedule.reduce((sum,row)=>sum+row.value,0),5);
 unchangedFailure(store,()=>store.recountDrawing(drawing.id,{...payload,expected_marks:[]}),{status:409});
 for(const item of [i,other])store.reviewMarks(item.id,store.snapshot().countMarks.filter(m=>m.item_id===item.id).map(m=>({id:m.id,version:m.version,included:!!m.included,reviewed:true})));
 s=store.snapshot();const book=new ExcelJS.Workbook();await book.xlsx.load((await quantityWorkbook(s,takeoff.id)).bytes);let total=0;book.getWorksheet('Count instances').eachRow((row,n)=>{if(n>1)total+=row.getCell(17).value;});assert.equal(total,5);assert.equal(book.getWorksheet('Selection edits').getCell('J2').value,APPEARANCE_FIXED_VERSION);
 close();const reopened=await openStore(directory);try{assert.deepEqual(reopened.snapshot(),s);}finally{reopened.close();}
});

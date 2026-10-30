import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {createCanvas} from '@napi-rs/canvas';
import ExcelJS from 'exceljs';
import {rotationFixture} from '../scripts/generate-count-rotation-fixture.mjs';
import {inkImage,exampleImage,findMatches,findSymbolMatches,rotateTemplate,ROTATION_MATCHER_VERSION,ROTATION_ELEMENTS_VERSION,EXACT_MATCHER_VERSION} from '../apps/local/web/matcher.mjs';
import {matchRequest} from '../apps/local/web/match-worker.mjs';
import {recognizeDrawing} from '../apps/local/web/recognize-drawing.mjs';
import {openStore} from '../apps/local/store.mjs';
import {quantityWorkbook} from '../apps/local/workbook.mjs';
async function raster(bytes){const task=getDocument({data:new Uint8Array(bytes),isEvalSupported:false});try{const page=await(await task.promise).getPage(1),viewport=page.getViewport({scale:2,rotation:0}),canvas=createCanvas(viewport.width,viewport.height),ctx=canvas.getContext('2d');await page.render({canvasContext:ctx,viewport}).promise;return {width:canvas.width,height:canvas.height,data:ctx.getImageData(0,0,canvas.width,canvas.height).data,viewport};}finally{await task.destroy();}}
const centre=(r,h)=>r.viewport.convertToPdfPoint(h.left+(h.anchorX??h.width/2),h.top+(h.anchorY??h.height/2));
const close=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1])<.01;
function selection(r,manifest){const b=manifest.selection;return exampleImage(inkImage(r.data,r.width,r.height),[...r.viewport.convertToViewportPoint(b[0],b[3]),...r.viewport.convertToViewportPoint(b[2],b[1])]);}
async function workspace(t){const directory=await mkdtemp(join(tmpdir(),'fire-count-rotation-')),store=await openStore(directory);t.after(()=>{store.close();return rm(directory,{recursive:true,force:true});});const project=store.create('project',null,'Rotation acceptance'),takeoff=store.create('takeoff',project.id,'Original revisions'),discipline=store.create('discipline',takeoff.id,'Sprinklers'),base=rotationFixture(),revision=rotationFixture({revision:true}),drawing=await store.importPdf(discipline.id,'base.pdf',base.bytes),revised=await store.importPdf(discipline.id,'revision.pdf',revision.bytes);return {store,takeoff,discipline,drawing,revised,base,revision,directory};}
test('quarter turns rotate pixels, erased masks and asymmetric anchors together; four turns preserve input',()=>{
 const data=new Uint8Array(7*9);for(let y=1;y<8;y++)data[y*7+1]=1;for(let x=1;x<6;x++)data[7*7+x]=1;
 const ignore=new Uint8Array(data.length);ignore[2*7+5]=1;const t={data,width:7,height:9,ignore,anchorX:2.25,anchorY:6.5},copy=structuredClone(t);
 let r=rotateTemplate(t);assert.equal(r.width,9);assert.equal(r.height,7);assert.equal(r.anchorX,2.5);assert.equal(r.anchorY,2.25);assert.equal(r.ignore[5*9+6],1);
 for(let i=0;i<3;i++)r=rotateTemplate(r);assert.deepEqual(r,t);assert.deepEqual(t,copy);
});
test('symmetric variants do not duplicate detections; malformed masks and shared work budgets fail without partial output',()=>{
 const t={width:9,height:9,data:new Uint8Array(81)};for(let i=1;i<8;i++){t.data[4*9+i]=1;t.data[i*9+4]=1;}
 const image={width:60,height:30,data:new Uint8Array(1800)};for(const [x,y]of [[5,5],[25,5]])for(let dy=0;dy<9;dy++)for(let dx=0;dx<9;dx++)image.data[(y+dy)*60+x+dx]=t.data[dy*9+dx];
 assert.equal(findSymbolMatches(image,t,{rotations:true,threshold:.95}).length,2);
 assert.throws(()=>findSymbolMatches(image,t,{rotations:true,maxComparisons:1}),/budget/);
 assert.throws(()=>findSymbolMatches(image,t,{rotations:true,maxPositions:1}),/budget/);
 assert.throws(()=>findSymbolMatches(image,{...t,ignore:new Uint8Array(1)},{rotations:true}),/ignored/);
 assert.throws(()=>findMatches(image,t,{threshold:NaN}),/Invalid/);
 const asymmetric={width:7,height:9,data:new Uint8Array(63)};for(let i=0;i<9;i++)asymmetric.data[i*7]=1;
 assert.doesNotThrow(()=>findSymbolMatches(image,asymmetric,{maxPositions:1800}));
 assert.throws(()=>findSymbolMatches(image,asymmetric,{rotations:true,maxPositions:1800}),/scan budget/,'all orientations share one scan budget');
});
test('actual PDF worker finds all twelve labelled quarter-turn symbols and rejects four distinct negatives; challenge misses remain explicit',async()=>{
 const {bytes,manifest}=rotationFixture(),r=await raster(bytes),template=selection(r,manifest),image=inkImage(r.data,r.width,r.height);
 const legacy=findMatches(image,template),hits=matchRequest({rgba:r.data,width:r.width,height:r.height,template:{...template,matchRotations:true,matchThreshold:.95}}),points=hits.map(h=>centre(r,h));
 assert.equal(legacy.filter(h=>manifest.symbols.some(s=>close(centre(r,h),[s.x,s.y]))).length,3);
 assert.equal(legacy.filter(h=>manifest.negatives.some(s=>close(centre(r,h),[s.x,s.y]))).length,1,'legacy threshold admits missing-detail distractor');
 assert.equal(hits.length,12);for(const s of manifest.symbols)assert.ok(points.some(p=>close(p,[s.x,s.y])),s.id);
 for(const s of manifest.negatives)assert.ok(!points.some(p=>close(p,[s.x,s.y])),s.kind);
 assert.equal(manifest.challenges.filter(s=>points.some(p=>close(p,[s.x,s.y]))).length,0,'subpixel/oblique challenge coverage is not claimed');
 const fixed=matchRequest({rgba:r.data,width:r.width,height:r.height,template:{...template,matchRotations:false,matchThreshold:.95}});assert.equal(fixed.length,3);
});
test('explicit matching upgrade removes unchecked false positives, adds rotated counts, preserves decisions and stays repeatable through recount/reopen/export',async t=>{
 const w=await workspace(t),{store,discipline,drawing,revised,base,revision,takeoff,directory}=w,r=await raster(base.bytes),template=selection(r,base.manifest),hit=h=>{const[x,y]=centre(r,h);return {drawing_id:drawing.id,page:1,x,y,score:h.score,digest:drawing.digest};};
 const item=store.createCount(discipline.id,{name:'Asymmetric detector',example:{drawing_id:drawing.id,page:1,bounds:base.manifest.selection,digest:drawing.digest,algorithm:'binary-overlap-1'},matches:findMatches(inkImage(r.data,r.width,r.height),template).map(hit)});
 let s=store.snapshot(),e=s.countExamples[0];const excluded=s.countMarks.find(m=>m.x===70&&m.y===100);store.updateMark(excluded.id,{version:excluded.version,included:false,reviewed:true});
 store.addManualMark(item.id,{drawing_id:drawing.id,page:1,x:450,y:450});s=store.snapshot();const preserved=s.countMarks.filter(m=>m.reviewed),hits=matchRequest({rgba:r.data,width:r.width,height:r.height,template:{...template,matchRotations:true,matchThreshold:.95}}).map(hit),body={version:e.version,rotations:true,matches:hits,scope:[{id:drawing.id,digest:drawing.digest}],expected_marks:s.countMarks.filter(m=>m.example_id===e.id).map(m=>({id:m.id,version:m.version}))};
 const result=store.editCountSelection(e.id,body);assert.equal(result.added,9);assert.equal(result.removed,1);s=store.snapshot();for(const m of preserved)assert.deepEqual(s.countMarks.find(n=>n.id===m.id),m);assert.equal(s.countExamples[0].example.algorithm,ROTATION_MATCHER_VERSION);assert.equal(s.countMarks.length,13);
 const before=store.snapshot();assert.throws(()=>store.editCountSelection(e.id,body),/changed/);assert.deepEqual(store.snapshot(),before);
 const render=async d=>raster(d.id===drawing.id?base.bytes:revision.bytes),search=async(r,t)=>matchRequest({rgba:r.data,width:r.width,height:r.height,template:t});
 const payload=await recognizeDrawing({state:s,target:revised,render,search});assert.equal(payload.selections[0].matches.length,12);for(const p of revision.manifest.symbols)assert.ok(payload.selections[0].matches.some(m=>close([m.x,m.y],[p.x,p.y])));store.recountDrawing(revised.id,payload);
 s=store.snapshot();const replay=await recognizeDrawing({state:s,target:revised,render,search});assert.equal(store.recountDrawing(revised.id,replay).added,0);assert.equal(store.snapshot().countMarks.length,25);
 store.reviewMarks(item.id,store.snapshot().countMarks.map(m=>({id:m.id,version:m.version,included:!!m.included,reviewed:true})));s=store.snapshot();const workbook=new ExcelJS.Workbook();await workbook.xlsx.load((await quantityWorkbook(s,takeoff.id)).bytes);assert.equal(workbook.getWorksheet('Selection edits').getCell('J2').value,ROTATION_MATCHER_VERSION);assert.equal(workbook.getWorksheet('Sprinklers').getCell('G2').value,12);assert.equal(workbook.getWorksheet('Sprinklers').getCell('G3').value,12);
 store.close();store.close=()=>{};const reopened=await openStore(directory);try{assert.deepEqual(reopened.snapshot(),s);}finally{reopened.close();}
});
test('matching-only updates reject invalid policy and scope atomically; cleanup preserves rotation policy',async t=>{
 const {store,discipline,drawing,base}=await workspace(t),item=store.createCount(discipline.id,{name:'Heading',example:{drawing_id:drawing.id,page:1,bounds:base.manifest.selection,digest:drawing.digest,algorithm:ROTATION_MATCHER_VERSION},matches:[]}),e=store.snapshot().countExamples[0],input={version:1,matches:[],scope:[{id:drawing.id,digest:drawing.digest}],expected_marks:[]};
 const before=store.snapshot();for(const rotations of ['yes',1,null]){assert.throws(()=>store.editCountSelection(e.id,{...input,rotations}),/rotation/);assert.deepEqual(store.snapshot(),before);}
 assert.throws(()=>store.editCountSelection(e.id,{...input,rotations:true,scope:[]}),/scope/);assert.deepEqual(store.snapshot(),before);
 store.editCountSelection(e.id,{...input,elements:{renderer:'pdfjs-6.4.299-paths-1',ids:[1,2],excluded:[2]}});assert.equal(store.snapshot().countExamples[0].example.algorithm,ROTATION_ELEMENTS_VERSION);
 const edited=store.snapshot().countExamples[0];store.editCountSelection(e.id,{...input,version:edited.version,rotations:false});assert.equal(store.snapshot().countExamples[0].example.algorithm,'binary-elements-2');assert.equal(store.snapshot().countItems[0].id,item.id);
});

test('matching policy cannot collide with another saved selection or leave partial changes',async t=>{
 const {store,discipline,drawing,base}=await workspace(t),definition={drawing_id:drawing.id,page:1,bounds:base.manifest.selection,digest:drawing.digest,algorithm:'binary-overlap-1'},item=store.createCount(discipline.id,{name:'Old selection',example:definition,matches:[]});
 store.addCountExample(item.id,{version:store.snapshot().countItems[0].version,example:{...definition,algorithm:ROTATION_MATCHER_VERSION},matches:[]});const before=store.snapshot(),old=before.countExamples.find(e=>e.example.algorithm==='binary-overlap-1');
 assert.throws(()=>store.editCountSelection(old.id,{version:old.version,rotations:true,matches:[],scope:[{id:drawing.id,digest:drawing.digest}],expected_marks:[]}),e=>e.status===409&&/already uses/.test(e.message));assert.deepEqual(store.snapshot(),before);
});

test('symbol colour masks follow actual matched ink through quarter turns and page transforms without painting background or absent pixels',async()=>{
 const {alignedInk,inkTransform}=await import('../apps/local/web/count-ink.mjs'),{bytes,manifest}=rotationFixture(),r=await raster(bytes),image=inkImage(r.data,r.width,r.height),template=selection(r,manifest);
 for(const symbol of manifest.symbols){const centre=r.viewport.convertToViewportPoint(symbol.x,symbol.y),mask=alignedInk(image,template,centre,{rotations:true,threshold:.95});assert.ok(mask,symbol.id);assert.ok(mask.data.some(v=>v===0),'background remains transparent');assert.ok(mask.data.some(Boolean));
  for(let y=0;y<mask.height;y++)for(let x=0;x<mask.width;x++)if(mask.data[y*mask.width+x])assert.equal(image.data[(mask.top+y)*image.width+mask.left+x],1);
  for(const rotation of [0,90,180,270])for(const scale of [.4,1,2.5]){const target=r.viewport.clone({scale,rotation}),m=inkTransform(r.viewport,target,mask);for(const [x,y]of [[0,0],[mask.width,mask.height]]){const expected=target.convertToViewportPoint(...r.viewport.convertToPdfPoint(mask.left+x,mask.top+y));assert.ok(Math.abs(m[0]*x+m[2]*y+m[4]-expected[0])<1e-8);assert.ok(Math.abs(m[1]*x+m[3]*y+m[5]-expected[1])<1e-8);}}
 }
 for(const n of manifest.negatives)assert.equal(alignedInk(image,template,r.viewport.convertToViewportPoint(n.x,n.y),{rotations:true,threshold:.95}),null,n.kind);
 const blank={...image,data:new Uint8Array(image.data.length)};assert.equal(alignedInk(blank,template,r.viewport.convertToViewportPoint(70,100),{rotations:true,threshold:.95}),null);
});

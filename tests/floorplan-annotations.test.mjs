import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {floorplanAnnotationModel} from '../apps/local/web/floorplan-annotations.mjs';
const state={countItems:[{id:'heading',name:'Owned head',color:'#123456'}],countMarks:[{id:'mark',item_id:'heading',drawing_id:'owned',page:1,x:100,y:100,included:true,reviewed:false},{id:'excluded',item_id:'heading',drawing_id:'owned',page:1,x:200,y:100,included:false,reviewed:true},{id:'other-page',item_id:'heading',drawing_id:'owned',page:2,x:100,y:100},{id:'other-source',item_id:'heading',drawing_id:'elsewhere',page:1,x:100,y:100}],measurements:[{id:'line',drawing_id:'owned',page:1,kind:'length',name:'Pipe',points:[[50,400],[350,400]],quantity:{value:30,unit:'m'}},{id:'area',drawing_id:'owned',page:1,kind:'area',name:'Area',points:[[50,450],[150,450],[150,550]],quantity:{value:null,unit:'m²'}}],zoneHeadings:[{id:'zone-heading',name:'East'}],zones:[{id:'zone',heading_id:'zone-heading',drawing_id:'owned',page:1,points:[[50,50],[400,50],[400,250]]}],notes:[{id:'note',drawing_id:'owned',page:1,x:100,y:100,text:'<script>literal note</script>'},{id:'other-note',drawing_id:'elsewhere',page:1,x:100,y:100,text:'Other'}]};

test('floorplan annotation projections use actual cropped PDF viewports at all rotations and zoom levels',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'fire-annotation-'));t.after(()=>rm(directory,{recursive:true,force:true}));execFileSync(process.execPath,['scripts/generate-drawing-fixture.mjs',directory,'cropped']);
 const task=getDocument({data:new Uint8Array(await readFile(join(directory,'small-vector.pdf'))),isEvalSupported:false});t.after(()=>task.destroy());const page=await(await task.promise).getPage(1),original=structuredClone(state);
 const expected=new Map([[0,[60,640]],[90,[60,60]],[180,[340,60]],[270,[640,340]]]);
 for(const [rotation,point]of expected)for(const scale of [.5,1,2]){const model=floorplanAnnotationModel(state,'owned',1,page.getViewport({scale:1,rotation}),scale);assert.deepEqual(model.marks[0].point,point.map(v=>v*scale));assert.deepEqual(model.notes[0].point,point.map(v=>v*scale));assert.equal(model.marks[0].id,'mark');}
 const rotated=floorplanAnnotationModel(state,'owned',1,page.getViewport({scale:1,rotation:90}),2);assert.deepEqual(rotated.measurements[0].points,[[720,20],[720,620]]);assert.deepEqual(rotated.measurements[1].points,[[820,20],[820,220],[1020,220]]);assert.deepEqual(rotated.zones[0].points,[[20,20],[20,720],[420,720]]);assert.deepEqual(state,original);
});

test('floorplan review model isolates source pages, preserves status and record identity, and applies heading visibility',()=>{
 const viewport={convertToViewportPoint:(x,y)=>[x,842-y]},baseline=structuredClone(state),model=floorplanAnnotationModel(state,'owned',1,viewport);
 assert.deepEqual(model.marks.map(m=>m.id),['mark','excluded']);assert.equal(model.marks[0].reviewed,false);assert.equal(model.marks[1].included,false);assert.equal(model.marks[1].color,'#a5adb0');
 assert.equal(model.measurements[0].label,'Pipe · 30 m');assert.match(model.measurements[1].label,/Set scale/);assert.equal(model.notes[0].label,'Note 1: <script>literal note</script>');
 for(const group of Object.values(model))for(const r of group){assert.equal(r.drawing_id,'owned');assert.equal(r.page,1);assert.ok(['count','measure','zone','note'].includes(r.kind));}
 const hidden=floorplanAnnotationModel(state,'owned',1,viewport,1,()=>false);assert.equal(hidden.marks.length,0);assert.equal(hidden.measurements.length,2);assert.equal(hidden.notes.length,1);
 assert.deepEqual(floorplanAnnotationModel(state,'missing',1,viewport),{marks:[],measurements:[],zones:[],notes:[]});assert.deepEqual(state,baseline);
 for(const scale of [0,-1,NaN,Infinity])assert.throws(()=>floorplanAnnotationModel(state,'owned',1,viewport,scale),RangeError);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {openStore} from '../apps/local/store.mjs';
import {coverageCircles} from '../apps/local/web/coverage.mjs';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
async function workspace(t){
 const directory=await mkdtemp(join(tmpdir(),'fire-coverage-')),store=await openStore(directory);t.after(()=>{store.close();return rm(directory,{recursive:true,force:true});});
 execFileSync(process.execPath,['scripts/generate-drawing-fixture.mjs',join(directory,'fixture'),'cropped']);const bytes=await readFile(join(directory,'fixture','small-vector.pdf'));
 const project=store.create('project',null,'Coverage fixture'),takeoff=store.create('takeoff',project.id,'Original'),discipline=store.create('discipline',takeoff.id,'Fire');
 const drawing=await store.importPdf(discipline.id,'Owned.pdf',bytes),item=store.createCount(discipline.id,{name:'Heads'}),point=store.createMeasure(drawing.id,{page:1,name:'Additional head',kind:'point',points:[[200,100]]});
 store.addManualMark(item.id,{drawing_id:drawing.id,page:1,x:100,y:100});
 return{store,directory,drawing,item,point,bytes};
}
test('coverage settings persist and audit without changing source geometry, calibration or quantities',async t=>{
 const {store,directory,drawing,item,point,bytes}=await workspace(t),before=store.snapshot();
 assert.deepEqual(store.updateCoverage('items',item.id,{radius:7.5,version:1}),{id:item.id,coverage_radius:7.5,version:2});store.updateCoverage('measurements',point.id,{radius:3.25,version:1});
 let after=store.snapshot();assert.equal(after.coverageEvents.length,2);assert.deepEqual(after.countMarks,before.countMarks);assert.deepEqual(after.quantitySchedule,before.quantitySchedule);assert.deepEqual(after.calibrations,before.calibrations);assert.deepEqual(after.measurements[0].points,before.measurements[0].points);assert.deepEqual(await store.source(drawing.id),bytes);
 store.updateCountItem(item.id,{name:'Renamed',color:'#123456',version:2});assert.equal(store.snapshot().countItems[0].coverage_radius,7.5);
 store.updateCoverage('items',item.id,{radius:0,version:3});assert.equal(store.snapshot().countItems[0].coverage_radius,0);const unchanged=store.snapshot();store.updateCoverage('items',item.id,{radius:0,version:4});assert.deepEqual(store.snapshot(),unchanged);
 store.close();store.close=()=>{};const reopened=await openStore(directory);try{assert.deepEqual(reopened.snapshot(),unchanged);reopened.deleteMeasure(point.id,2);assert.equal(reopened.snapshot().coverageEvents.filter(e=>e.measurement_id).length,0);}finally{reopened.close();}
});
test('coverage rejects wrong kind, invalid radius and stale versions; audit failure rolls back value and version',async t=>{
 const {store,directory,drawing,item,point}=await workspace(t),line=store.createMeasure(drawing.id,{page:1,name:'Line',kind:'length',points:[[100,100],[200,100]]}),baseline=store.snapshot();
 for(const radius of [-1,10001,NaN,Infinity,'5',null])assert.throws(()=>store.updateCoverage('items',item.id,{radius,version:1}),{status:400});
 assert.throws(()=>store.updateCoverage('items',item.id,{radius:5,version:2}),{status:409});assert.throws(()=>store.updateCoverage('measurements',line.id,{radius:5,version:1}),{status:400});assert.throws(()=>store.updateCoverage('unknown',item.id,{radius:5,version:1}),{status:400});assert.throws(()=>store.updateCoverage('items','missing',{radius:5,version:1}),{status:404});assert.deepEqual(store.snapshot(),baseline);
 const db=new DatabaseSync(join(directory,'projects.sqlite'));try{db.exec("CREATE TRIGGER fail_coverage BEFORE INSERT ON coverage_events BEGIN SELECT RAISE(ABORT,'coverage audit unavailable'); END");for(const [kind,id]of [['items',item.id],['measurements',point.id]]){assert.throws(()=>store.updateCoverage(kind,id,{radius:4,version:1}),/coverage audit unavailable/);assert.deepEqual(store.snapshot(),baseline);}}finally{db.close();}
});
test('schema 10 migrates real absent radius columns to zero without modifying prior data',async t=>{
 const {store,directory}=await workspace(t),baseline=store.snapshot();store.close();store.close=()=>{};
 const db=new DatabaseSync(join(directory,'projects.sqlite'));db.exec('DROP TABLE coverage_events;ALTER TABLE count_items DROP COLUMN coverage_radius;ALTER TABLE measurements DROP COLUMN coverage_radius;UPDATE schema_version SET version=10');db.close();
 const reopened=await openStore(directory);try{assert.deepEqual(reopened.snapshot(),baseline);}finally{reopened.close();}
});
test('coverage uses calibrated native distances through cropped PDF rotations and UserUnit, independent of multipliers',async t=>{
 const {store,drawing,item,point,bytes}=await workspace(t);store.updateCoverage('items',item.id,{radius:7.5,version:1});store.updateCoverage('measurements',point.id,{radius:3,version:1});
 const task=getDocument({data:new Uint8Array(bytes),isEvalSupported:false});t.after(()=>task.destroy());const page=await(await task.promise).getPage(1);assert.deepEqual(coverageCircles(store.snapshot(),drawing.id,1,page.getViewport({scale:1})),[]);
 store.calibrate(drawing.id,{page:1,points:[[100,400],[400,400]],distance:30,unit:'m',version:0});let state=store.snapshot(),original=structuredClone(state);
 for(const angle of [0,90,180,270])for(const zoom of [.5,1,2]){const circles=coverageCircles(state,drawing.id,1,page.getViewport({scale:zoom,rotation:angle}));assert.equal(circles.length,2);assert.ok(Math.abs(circles[0].radius-75*zoom)<1e-9);assert.ok(Math.abs(circles[1].radius-30*zoom)<1e-9);}
 const rotated=coverageCircles(state,drawing.id,1,page.getViewport({scale:1,rotation:90}),2);assert.deepEqual(rotated[0].centre,[120,120]);assert.equal(rotated[0].radius,150);
 const unitViewport={convertToViewportPoint:(x,y)=>[2*(x-40),2*(740-y)]};assert.equal(coverageCircles(state,drawing.id,1,unitViewport)[0].radius,150);
 state.countMarks[0].quantity=100;state.countMarks[0].multiplier=100;assert.equal(coverageCircles(state,drawing.id,1,unitViewport).length,2);state.countMarks[0].included=false;assert.equal(coverageCircles(state,drawing.id,1,unitViewport).length,1);
 assert.equal(coverageCircles(original,drawing.id,1,unitViewport,1,()=>false).length,1);assert.deepEqual(coverageCircles(original,drawing.id,2,unitViewport),[]);assert.deepEqual(coverageCircles(original,'other',1,unitViewport),[]);
 store.calibrate(drawing.id,{page:1,points:[[100,400],[400,400]],distance:60,unit:'m',version:1});assert.equal(coverageCircles(store.snapshot(),drawing.id,1,page.getViewport({scale:1}))[0].radius,37.5);
 const elsewhere=structuredClone(original);elsewhere.countMarks.push({...elsewhere.countMarks[0],drawing_id:'second'});elsewhere.calibrations.push({drawing_id:'second',page:1,metres_per_point:.2});assert.equal(coverageCircles(elsewhere,'second',1,page.getViewport({scale:1}))[0].radius,37.5);assert.deepEqual(store.snapshot().countMarks,original.countMarks);
 const reclassified=structuredClone(original);reclassified.countItems.push({id:'new',coverage_radius:2,color:'#abcdef'});reclassified.countMarks[0].item_id='new';assert.equal(coverageCircles(reclassified,drawing.id,1,page.getViewport({scale:1}))[0].radius,20);
 for(const scale of [0,-1,NaN])assert.throws(()=>coverageCircles(original,drawing.id,1,unitViewport,scale),RangeError);
});
test('coverage HTTP writes enforce token, shape and optimistic version and return persisted state',async t=>{
 const {store,directory,item,point}=await workspace(t),{startApp}=await import('../apps/local/server.mjs'),app=await startApp({directory,port:0});
 try{const {token}=await(await fetch(app.origin+'/api/session')).json(),request=(kind,id,body,auth=true)=>fetch(`${app.origin}/api/${kind}/${id}/coverage`,{method:'PATCH',headers:{'Content-Type':'application/json',...(auth?{'X-Fire-Token':token}:{})},body:JSON.stringify(body)});
 assert.equal((await request('items',item.id,{radius:5,version:1},false)).status,403);for(const body of [null,[],{}, {radius:'5',version:1}])assert.equal((await request('items',item.id,body)).status,400);
 assert.equal((await request('items',item.id,{radius:5,version:1})).status,200);assert.equal((await request('items',item.id,{radius:6,version:1})).status,409);assert.equal((await request('measurements',point.id,{radius:2.5,version:1})).status,200);
 const saved=await(await fetch(app.origin+'/api/state')).json();assert.equal(saved.countItems[0].coverage_radius,5);assert.equal(saved.measurements[0].coverage_radius,2.5);assert.equal(saved.coverageEvents.length,2);
 }finally{await app.close();}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {openStore} from '../apps/local/store.mjs';
import {quantityWorkbook} from '../apps/local/workbook.mjs';
import {floorplanLayout,floorplanFor,pageSize,rotateVector} from '../apps/local/web/floorplan-model.mjs';
async function workspace(t){
 const directory=await mkdtemp(join(tmpdir(),'fire-floorplans-')),store=await openStore(directory);t.after(()=>{store.close();return rm(directory,{recursive:true,force:true});});
 const p=store.create('project',null,'Owned floorplan test'),takeoff=store.create('takeoff',p.id,'Revision 0'),discipline=store.create('discipline',takeoff.id,'Fire');
 const drawings=[],bytes=[];
 for(const variant of ['base','revision','cropped']){execFileSync(process.execPath,['scripts/generate-drawing-fixture.mjs',join(directory,variant),variant]);const b=await readFile(join(directory,variant,'small-vector.pdf'));bytes.push(b);drawings.push(await store.importPdf(discipline.id,variant+'.pdf',b));}
 return {store,directory,drawings,bytes,discipline,takeoff};
}
const add=(store,a,b,version=0)=>store.addFloorplanPage(a.id,{page:1,drawing_id:b.id,target_page:1,version});
const withoutFloorplans=state=>Object.fromEntries(Object.entries(state).filter(([k])=>!k.startsWith('floorplan')));

test('floorplan membership and saved positions survive member navigation/reopen without changing source takeoff quantities',async t=>{
 const {store,directory,drawings:[a,b,c],bytes}=await workspace(t);
 store.createNote(a.id,{page:1,x:100,y:100,text:'Anchored note'});store.createMeasure(a.id,{page:1,kind:'point',points:[[200,100]],name:'Valve'});
 const original=store.snapshot(),takeoffId=original.entities.find(e=>e.kind==='takeoff').id,originalWorkbook=await quantityWorkbook(original,takeoffId);let group=add(store,a,b);assert.equal(group.members.length,2);assert.deepEqual(group.members.map(m=>[m.x,m.y]),[[0,0],[619,0]]);
 group=add(store,b,c,group.version);assert.equal(group.members.length,3);const m=group.members.find(m=>m.drawing_id===b.id);group=store.updateFloorplanMember(m.id,{x:-250,y:120,version:group.version});
 const state=store.snapshot();for(const d of [a,b,c])assert.equal(floorplanFor(state,d.id,1).group.id,group.id);assert.deepEqual(withoutFloorplans(state),withoutFloorplans(original));assert.equal(state.floorplanEvents.length,3);assert.equal((await quantityWorkbook(state,takeoffId)).snapshotDigest,originalWorkbook.snapshotDigest);
 for(const [i,d]of [a,b,c].entries())assert.deepEqual(await store.source(d.id),bytes[i]);
 store.close();store.close=()=>{};const reopened=await openStore(directory);try{assert.deepEqual(reopened.snapshot(),state);}finally{reopened.close();}
});

test('floorplans reject wrong scope, pages, duplicates, group merging and stale/out-of-range edits atomically',async t=>{
 const {store,drawings:[a,b,c],bytes,discipline,takeoff}=await workspace(t),other=store.create('discipline',takeoff.id,'Other'),outside=await store.importPdf(other.id,'Other.pdf',bytes[0]);
 const baseline=store.snapshot();for(const input of [{page:0,drawing_id:b.id,target_page:1,version:0},{page:1,drawing_id:b.id,target_page:2,version:0},{page:1,target_page:1,version:0},{page:1,drawing_id:a.id,target_page:1,version:0},{page:1,drawing_id:outside.id,target_page:1,version:0}]){assert.throws(()=>store.addFloorplanPage(a.id,input),{status:400});assert.deepEqual(store.snapshot(),baseline);}
 const group=add(store,a,b),m=group.members[1],saved=store.snapshot();
 assert.throws(()=>add(store,a,c,0),{status:409});assert.throws(()=>add(store,a,b,1),{status:409});assert.throws(()=>add(store,c,b,0),{status:409});
 for(const fields of [{x:NaN,y:0},{x:Infinity,y:0},{x:'5',y:0},{x:100001,y:0},{x:99999,y:0},{x:0,y:null}]){assert.throws(()=>store.updateFloorplanMember(m.id,{...fields,version:1}),{status:400});assert.deepEqual(store.snapshot(),saved);}
 assert.throws(()=>store.removeFloorplanMember(m.id,0),{status:409});assert.deepEqual(store.snapshot(),saved);
 store.updateFloorplanMember(m.id,{x:m.x,y:m.y,version:1});assert.deepEqual(store.snapshot(),saved);
});

test('floorplan create/update/removal and drawing deletion roll back when audit persistence fails',async t=>{
 const {store,directory,drawings:[a,b,c]}=await workspace(t),db=new DatabaseSync(join(directory,'projects.sqlite'));t.after(()=>db.close());
 const fail=()=>db.exec("CREATE TRIGGER fail_floorplan_audit BEFORE INSERT ON floorplan_events BEGIN SELECT RAISE(ABORT,'audit unavailable'); END");
 let baseline=store.snapshot();fail();assert.throws(()=>add(store,a,b),/audit unavailable/);assert.deepEqual(store.snapshot(),baseline);db.exec('DROP TRIGGER fail_floorplan_audit');
 const g=add(store,a,b);baseline=store.snapshot();fail();
 for(const operation of [()=>add(store,a,c,1),()=>store.updateFloorplanMember(g.members[1].id,{x:20,y:30,version:1}),()=>store.removeFloorplanMember(g.members[1].id,1),()=>store.deleteDrawing(a.id)]){assert.throws(operation,/audit unavailable/);assert.deepEqual(store.snapshot(),baseline);}
});

test('floorplan removal prunes singleton groups and source drawing deletion preserves other drawings',async t=>{
 const {store,drawings:[a,b,c],bytes}=await workspace(t);let g=add(store,a,b);g=add(store,a,c,g.version);const original=withoutFloorplans(store.snapshot());
 g=store.removeFloorplanMember(g.members.find(m=>m.drawing_id===c.id).id,g.version);assert.equal(g.members.length,2);assert.deepEqual(withoutFloorplans(store.snapshot()),original);
 store.deleteDrawing(a.id);assert.equal(store.snapshot().floorplans.length,0);assert.equal(store.snapshot().floorplanMembers.length,0);assert.equal(store.snapshot().floorplanEvents.at(-1).action,'drawing removed');assert.equal(store.snapshot().floorplanEvents.at(-1).current,null);assert.deepEqual(await store.source(b.id),bytes[1]);assert.deepEqual(await store.source(c.id),bytes[2]);
});

test('schema 9 migrates floorplan tables without changing prior saved state',async t=>{
 const {store,directory}=await workspace(t),original=store.snapshot();store.close();store.close=()=>{};const db=new DatabaseSync(join(directory,'projects.sqlite'));db.exec('DROP TABLE floorplan_events;DROP TABLE floorplan_members;DROP TABLE floorplans;UPDATE schema_version SET version=9');db.close();
 const reopened=await openStore(directory);try{assert.deepEqual(reopened.snapshot(),original);}finally{reopened.close();}
});

test('floorplan bounds and rotated offsets follow independent geometry including crop and UserUnit',()=>{
 const drawings=[{id:'a',pages:[{view:[0,0,595,842],rotation:0,userUnit:1}]},{id:'b',pages:[{view:[40,40,440,740],rotation:90,userUnit:1}]}],members=[{id:'a1',drawing_id:'a',page:1,x:0,y:0},{id:'b1',drawing_id:'b',page:1,x:-250,y:120}];
 assert.deepEqual(pageSize(drawings[1].pages[0]),{width:700,height:400});assert.deepEqual(pageSize({...drawings[1].pages[0],userUnit:2}),{width:1400,height:800});
 const normal=floorplanLayout(members,drawings),rotated=floorplanLayout(members,drawings,90);assert.deepEqual([normal.left,normal.top,normal.width,normal.height],[-250,0,845,842]);assert.deepEqual(normal.rectangles.map(r=>[r.left,r.top,r.width,r.height]),[[250,0,595,842],[0,120,700,400]]);
 assert.deepEqual([rotated.width,rotated.height],[842,845]);assert.deepEqual(rotated.rectangles.map(r=>[r.left,r.top,r.width,r.height]),[[0,250,842,595],[322,0,400,700]]);
 for(const r of [0,90,180,270])assert.deepEqual(rotateVector(rotateVector([31,-17],r),-r),[31,-17]);
 assert.throws(()=>floorplanLayout(members,drawings,45),RangeError);assert.throws(()=>floorplanLayout([...members,{...members[0],x:100001}],drawings),RangeError);assert.throws(()=>floorplanLayout(Array(17).fill(members[0]),drawings),RangeError);
});

test('floorplan HTTP routes require tokens and reject stale or malformed writes',async t=>{
 const {store,directory,drawings:[a,b]}=await workspace(t),{startApp}=await import('../apps/local/server.mjs'),app=await startApp({directory,port:0});
 try{const {token}=await(await fetch(app.origin+'/api/session')).json(),request=(path,method,body,auth=true)=>fetch(app.origin+path,{method,headers:{...(body===undefined?{}:{'Content-Type':'application/json'}),...(auth?{'X-Fire-Token':token}:{})},body:body===undefined?undefined:JSON.stringify(body)}),route=`/api/drawings/${a.id}/floorplan-pages`,input={page:1,drawing_id:b.id,target_page:1,version:0};
 assert.equal((await request(route,'POST',input,false)).status,403);for(const body of [null,[],{}])assert.equal((await request(route,'POST',body)).status,400);
 const response=await request(route,'POST',input);assert.equal(response.status,201);const g=await response.json(),memberRoute=`/api/floorplan-members/${g.members[1].id}`;
 assert.equal((await request(memberRoute,'PATCH',{x:30,y:50,version:1})).status,200);assert.equal((await request(memberRoute,'PATCH',{x:0,y:0,version:1})).status,409);assert.equal((await request(memberRoute,'PATCH',null)).status,400);
 assert.equal((await request(memberRoute+'?version=2','DELETE')).status,200);assert.equal(store.snapshot().floorplans.length,0);
 }finally{await app.close();}
});

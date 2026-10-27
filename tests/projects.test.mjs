import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {openStore} from '../apps/local/store.mjs';
import {projectRows,PROJECT_STATUSES} from '../apps/local/web/project-model.mjs';
async function workspace(t){const directory=await mkdtemp(join(tmpdir(),'fire-projects-')),store=await openStore(directory);t.after(()=>{store.close();return rm(directory,{recursive:true,force:true});});return {store,directory};}
const metadata=(store,id)=>store.snapshot().projectMetadata.find(p=>p.project_id===id);

test('project metadata, all lifecycle statuses and archive/restore survive reopen without changing descendants',async t=>{
 const {store,directory}=await workspace(t),p=store.create('project',null,'Hospital',{customer:'Original customer',building_type:'Health',owner:'Local user',due_date:'2028-02-29'}),takeoff=store.create('takeoff',p.id,'Revision 0'),discipline=store.create('discipline',takeoff.id,'Fire');
 execFileSync(process.execPath,['scripts/generate-drawing-fixture.mjs',join(directory,'fixture')]);const bytes=await readFile(join(directory,'fixture','small-vector.pdf')),d=await store.importPdf(discipline.id,'Owned.pdf',bytes);
 store.createMeasure(d.id,{page:1,name:'Valve',kind:'point',points:[[100,100]]});const before=store.snapshot();
 for(const status of PROJECT_STATUSES)store.updateProject(p.id,{status,version:metadata(store,p.id).version});
 store.updateProject(p.id,{archived:true,version:metadata(store,p.id).version});assert.equal(projectRows(store.snapshot()).length,0);assert.equal(projectRows(store.snapshot(),{scope:'archived'})[0].id,p.id);
 store.updateProject(p.id,{archived:false,name:'Hospital revised',version:metadata(store,p.id).version});const after=store.snapshot();
 assert.deepEqual(after.drawings,before.drawings);assert.deepEqual(after.measurements,before.measurements);assert.deepEqual(after.entities.filter(e=>e.kind!=='project'),before.entities.filter(e=>e.kind!=='project'));assert.deepEqual(await store.source(d.id),bytes);
 assert.equal(metadata(store,p.id).due_date,'2028-02-29');assert.equal(metadata(store,p.id).status,'On hold');assert.equal(after.projectEvents.length,7);
 store.close();store.close=()=>{};const reopened=await openStore(directory);try{assert.deepEqual(reopened.snapshot(),after);}finally{reopened.close();}
});

test('project validation rejects invalid dates, fields, kinds and stale edits without partial changes',async t=>{
 const {store}=await workspace(t),p=store.create('project',null,'Original'),child=store.create('takeoff',p.id,'Revision 0'),baseline=store.snapshot();
 for(const fields of [{due_date:'2026-02-29'},{due_date:'2026-04-31'},{due_date:'2026-2-01'},{due_date:'0000-01-01'},{due_date:'not a date'},{owner:12},{customer:'x'.repeat(161)},{building_type:null},{status:'Unknown'},{archived:1},{name:''}]){
  assert.throws(()=>store.updateProject(p.id,{...fields,version:1}),{status:400});assert.deepEqual(store.snapshot(),baseline);
 }
 for(const fields of [{due_date:'2026-02-30'},null,[],{archived:'true'}])assert.throws(()=>store.create('project',null,'Bad metadata',fields),{status:400});
 assert.throws(()=>store.updateProject(child.id,{name:'Wrong kind',version:1}),{status:404});assert.deepEqual(store.snapshot(),baseline);
 store.updateProject(p.id,{customer:'Changed',version:1});const changed=store.snapshot();assert.throws(()=>store.updateProject(p.id,{name:'Stale',version:1}),{status:409});assert.deepEqual(store.snapshot(),changed);
 store.updateProject(p.id,{customer:'Changed',version:2});assert.equal(metadata(store,p.id).version,2);assert.equal(store.snapshot().projectEvents.length,1);
});

test('project creation and edits roll back when metadata or audit persistence fails',async t=>{
 const {store,directory}=await workspace(t),db=new DatabaseSync(join(directory,'projects.sqlite'));
 try{
  const empty=store.snapshot();db.exec("CREATE TRIGGER fail_project_create BEFORE INSERT ON project_metadata BEGIN SELECT RAISE(ABORT,'metadata unavailable'); END;");
  assert.throws(()=>store.create('project',null,'Must not exist'),/metadata unavailable/);assert.deepEqual(store.snapshot(),empty);db.exec('DROP TRIGGER fail_project_create');
  const p=store.create('project',null,'Original'),baseline=store.snapshot();db.exec("CREATE TRIGGER fail_project_audit BEFORE INSERT ON project_events BEGIN SELECT RAISE(ABORT,'audit unavailable'); END;");
  assert.throws(()=>store.updateProject(p.id,{name:'Must roll back',archived:true,customer:'Changed',version:1}),/audit unavailable/);assert.deepEqual(store.snapshot(),baseline);
 }finally{db.close();}
});

test('project views filter metadata, distinguish local ownership/archive and sort dates with empty dates last',async t=>{
 const {store}=await workspace(t),a=store.create('project',null,'Building 10',{customer:'Original customer',due_date:'2026-12-01'}),b=store.create('project',null,'Building 2',{owner:'Another local label',due_date:'2026-11-01'}),c=store.create('project',null,'Third',{building_type:'Warehouse'}),d=store.create('project',null,'Archived',{archived:true});
 const state=store.snapshot();assert.deepEqual(projectRows(state,{scope:'own',sort:'name',direction:1}).map(p=>p.id),[a.id,c.id]);assert.deepEqual(projectRows(state,{scope:'archived'}).map(p=>p.id),[d.id]);
 assert.deepEqual(projectRows(state,{filter:'WAREHOUSE'}).map(p=>p.id),[c.id]);assert.deepEqual(projectRows(state,{filter:'original customer'}).map(p=>p.id),[a.id]);
 assert.deepEqual(projectRows(state,{sort:'name',direction:1}).map(p=>p.id),[b.id,a.id,c.id]);assert.deepEqual(projectRows(state,{sort:'due_date',direction:-1}).map(p=>p.id),[a.id,b.id,c.id]);assert.deepEqual(projectRows(state,{sort:'due_date',direction:1}).map(p=>p.id),[b.id,a.id,c.id]);assert.deepEqual(store.snapshot(),state);
});

test('schema 8 project migration adds default local metadata without changing entity identity',async t=>{
 const {store,directory}=await workspace(t),p=store.create('project',null,'Existing'),child=store.create('takeoff',p.id,'Existing takeoff'),baseline=store.snapshot();
 store.close();store.close=()=>{};const db=new DatabaseSync(join(directory,'projects.sqlite'));db.exec('DROP TABLE project_events;DROP TABLE project_metadata;UPDATE schema_version SET version=8');db.close();
 const reopened=await openStore(directory);try{assert.deepEqual(reopened.snapshot(),baseline);assert.equal(metadata(reopened,p.id).owner,'Local user');assert.equal(reopened.snapshot().entities.find(e=>e.id===child.id).parent_id,p.id);}finally{reopened.close();}
});

test('project HTTP create/update rejects unauthenticated, malformed and stale changes',async t=>{
 const {directory,store}=await workspace(t),{startApp}=await import('../apps/local/server.mjs'),app=await startApp({directory,port:0});
 try{
  const {token}=await(await fetch(app.origin+'/api/session')).json();const request=(path,method,body,auth=true)=>fetch(app.origin+path,{method,headers:{'Content-Type':'application/json',...(auth?{'X-Fire-Token':token}:{})},body:JSON.stringify(body)});
  const response=await request('/api/entities','POST',{kind:'project',name:'HTTP project',metadata:{customer:'Original',due_date:'2026-12-31'}});assert.equal(response.status,201);const p=await response.json(),route=`/api/projects/${p.id}`;
  assert.equal((await request(route,'PATCH',{version:1,archived:true},false)).status,403);assert.equal((await request(route,'PATCH',null)).status,400);assert.equal((await request(route,'PATCH',[])).status,400);assert.equal((await request(route,'PATCH',{version:1,due_date:'2026-02-30'})).status,400);
  assert.equal((await request(route,'PATCH',{version:1,archived:true,status:'Won'})).status,200);assert.equal((await request(route,'PATCH',{version:1,archived:false})).status,409);
  assert.equal(metadata(store,p.id).archived,1);assert.equal(metadata(store,p.id).status,'Won');assert.equal(store.snapshot().projectEvents.length,1);
 }finally{await app.close();}
});

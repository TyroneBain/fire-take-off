import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import ExcelJS from 'exceljs';
import {openStore} from '../apps/local/store.mjs';
import {quantityWorkbook} from '../apps/local/workbook.mjs';
import {countGroupSections} from '../apps/local/web/count-groups.mjs';
async function workspace(t){
 const directory=await mkdtemp(join(tmpdir(),'fire-count-groups-')),store=await openStore(directory);t.after(()=>{store.close();return rm(directory,{recursive:true,force:true});});
 const project=store.create('project',null,'Owned group tests'),takeoff=store.create('takeoff',project.id,'Original'),discipline=store.create('discipline',takeoff.id,'Fire'),a=store.createCount(discipline.id,{name:'Sprinklers'}),b=store.createCount(discipline.id,{name:'Detectors'});
 const v=()=>store.snapshot().countGroupScopes.find(s=>s.discipline_id===discipline.id)?.version??0;
 return {directory,store,project,takeoff,discipline,a,b,v};
}
function numerical(s){const {countGroups,countGroupMembers,countGroupScopes,countGroupEvents,...rest}=s;return rest;}
test('group lifecycle persists independently of all quantity data, with no-op and scoped ordered membership',async t=>{
 const {store,directory,discipline,a,b,v}=await workspace(t),before=numerical(store.snapshot());
 const first=store.createCountGroup(discipline.id,{name:'Suppression',version:0}).group,second=store.createCountGroup(discipline.id,{name:'Detection',version:v()}).group;
 store.assignCountGroup(a.id,{group_id:first.id,version:v()});store.assignCountGroup(b.id,{group_id:second.id,version:v()});
 let snapshot=store.snapshot();store.assignCountGroup(a.id,{group_id:first.id,version:v()});store.renameCountGroup(first.id,{name:'Suppression',version:v()});assert.deepEqual(store.snapshot(),snapshot);
 store.renameCountGroup(first.id,{name:'Wet systems',version:v()});assert.throws(()=>store.deleteCountGroup(first.id,{version:v()}),/Move this group/);
 store.assignCountGroup(a.id,{group_id:second.id,version:v()});store.deleteCountGroup(first.id,{version:v()});assert.equal(store.snapshot().countGroups[0].position,0);
 store.assignCountGroup(a.id,{group_id:null,version:v()});assert.deepEqual(numerical(store.snapshot()),before);assert.equal(v(),8);
 snapshot=store.snapshot();assert.deepEqual(snapshot.countGroupEvents.map(e=>e.action),['create','create','assign','assign','rename','assign','delete','assign']);
 store.close();store.close=()=>{};const reopened=await openStore(directory);try{assert.deepEqual(reopened.snapshot(),snapshot);}finally{reopened.close();}
});
test('invalid, stale and cross-discipline group writes preserve the complete snapshot',async t=>{
 const {store,discipline,takeoff,a,v}=await workspace(t),other=store.create('discipline',takeoff.id,'Other'),outside=store.createCountGroup(other.id,{name:'Other',version:0}).group,group=store.createCountGroup(discipline.id,{name:'Fire systems',version:0}).group;
 const cases=[()=>store.createCountGroup(discipline.id,{name:'FIRE SYSTEMS',version:v()}),()=>store.createCountGroup(discipline.id,{name:' Misc ',version:v()}),()=>store.createCountGroup(discipline.id,{name:' ',version:v()}),()=>store.renameCountGroup(group.id,{name:'Misc',version:v()}),()=>store.assignCountGroup(a.id,{group_id:outside.id,version:v()}),()=>store.assignCountGroup(a.id,{group_id:'missing',version:v()}),()=>store.assignCountGroup(a.id,{version:v()}),()=>store.assignCountGroup(a.id,{group_id:[],version:v()})];
 for(const action of cases){const before=store.snapshot();assert.throws(action);assert.deepEqual(store.snapshot(),before);}
 for(const version of [0,undefined,null,'1',-1,1.5])for(const action of [()=>store.createCountGroup(discipline.id,{name:'Next',version}),()=>store.renameCountGroup(group.id,{name:'Renamed',version}),()=>store.assignCountGroup(a.id,{group_id:group.id,version}),()=>store.deleteCountGroup(group.id,{version})]){const before=store.snapshot();assert.throws(action,{status:409});assert.deepEqual(store.snapshot(),before);}
});
test('an unavailable group audit rolls back group, membership and scope writes',async t=>{
 const {store,directory,discipline,a,v}=await workspace(t),g=store.createCountGroup(discipline.id,{name:'Group',version:0}).group,db=new DatabaseSync(join(directory,'projects.sqlite'));
 try{db.exec("CREATE TRIGGER fail_group BEFORE INSERT ON count_group_events BEGIN SELECT RAISE(ABORT,'group audit unavailable'); END");for(const action of [()=>store.createCountGroup(discipline.id,{name:'Another',version:v()}),()=>store.renameCountGroup(g.id,{name:'Renamed',version:v()}),()=>store.assignCountGroup(a.id,{group_id:g.id,version:v()}),()=>store.deleteCountGroup(g.id,{version:v()})]){const before=store.snapshot();assert.throws(action,/group audit unavailable/);assert.deepEqual(store.snapshot(),before);}}
 finally{db.close();}
});
test('grouping, selection moves and deletion keep membership tied to the heading; export quantities and source bytes are unchanged',async t=>{
 const {store,directory,discipline,takeoff,a,b,v}=await workspace(t);execFileSync(process.execPath,['scripts/generate-drawing-fixture.mjs',join(directory,'fixture')]);const bytes=await readFile(join(directory,'fixture','small-vector.pdf')),drawing=await store.importPdf(discipline.id,'Owned.pdf',bytes);
 store.addManualMark(a.id,{drawing_id:drawing.id,page:1,x:100,y:100});store.reviewMarks(a.id,store.snapshot().countMarks.map(m=>({id:m.id,version:m.version,included:true,reviewed:true})));
 const before=store.snapshot(),exportBefore=await quantityWorkbook(before,takeoff.id),g=store.createCountGroup(discipline.id,{name:'=SUM(A1:A2)',version:0}).group;store.assignCountGroup(a.id,{group_id:g.id,version:v()});const after=store.snapshot(),exportAfter=await quantityWorkbook(after,takeoff.id);
 assert.deepEqual(numerical(after),numerical(before));assert.deepEqual(await store.source(drawing.id),bytes);assert.notEqual(exportAfter.snapshotDigest,exportBefore.snapshotDigest);
 const oldBook=new ExcelJS.Workbook(),newBook=new ExcelJS.Workbook();await oldBook.xlsx.load(exportBefore.bytes);await newBook.xlsx.load(exportAfter.bytes);
 for(const sheet of ['Fire','Count instances','Quantity detail','Review history'])assert.deepEqual(newBook.getWorksheet(sheet).getSheetValues(),oldBook.getWorksheet(sheet).getSheetValues());assert.equal(newBook.getWorksheet('Count groups').getCell('B2').value,'=SUM(A1:A2)');assert.equal(newBook.getWorksheet('Count groups').getCell('B2').type,ExcelJS.ValueType.String);assert.equal(newBook.getWorksheet('Group history').rowCount,3);
 const other=store.create('discipline',takeoff.id,'Other'),outsideTakeoff=store.create('takeoff',store.snapshot().entities.find(e=>e.kind==='project').id,'Separate'),outside=store.create('discipline',outsideTakeoff.id,'Private outside');store.createCountGroup(outside.id,{name:'Outside',version:0});const separateBook=new ExcelJS.Workbook();await separateBook.xlsx.load((await quantityWorkbook(store.snapshot(),takeoff.id)).bytes);assert.ok(!JSON.stringify(separateBook.getWorksheet('Group history').getSheetValues()).includes('Outside'));
 const example={drawing_id:drawing.id,page:1,bounds:[90,90,110,110],digest:drawing.digest,algorithm:'binary-overlap-1'};store.addCountExample(b.id,{version:1,example,matches:[]});let s=store.snapshot(),e=s.countExamples.find(e=>e.item_id===b.id);store.assignCountGroup(b.id,{group_id:g.id,version:v()});
 store.moveCountSelection(e.id,{version:e.version,item_version:s.countItems.find(i=>i.id===b.id).version,destination_id:a.id,destination_version:s.countItems.find(i=>i.id===a.id).version,expected_marks:[]});assert.equal(store.snapshot().countGroupMembers.find(m=>m.item_id===b.id).group_id,g.id);
 // Delete a genuinely unused grouped heading through its last selection, keeping group audit history.
 const empty=store.createCount(discipline.id,{name:'Disposable',example});store.assignCountGroup(empty.id,{group_id:g.id,version:v()});s=store.snapshot();e=s.countExamples.find(e=>e.item_id===empty.id);store.deleteCountSelection(e.id,{version:e.version,item_version:empty.version,expected_marks:[]});assert.ok(!store.snapshot().countGroupMembers.some(m=>m.item_id===empty.id));assert.ok(store.snapshot().countGroupEvents.some(e=>e.current.item_id===empty.id));
 assert.equal(store.snapshot().countGroups.length,2);assert.ok(other.id);
});
test('schema 14 migration preserves every previous field and starts empty grouping',async t=>{
 const {store,directory}=await workspace(t),before=store.snapshot();store.close();store.close=()=>{};const db=new DatabaseSync(join(directory,'projects.sqlite'));db.exec('DROP TABLE count_group_members;DROP TABLE count_group_events;DROP TABLE count_groups;DROP TABLE count_group_scopes;UPDATE schema_version SET version=14');db.close();const reopened=await openStore(directory);try{assert.deepEqual(reopened.snapshot(),before);const verify=new DatabaseSync(join(directory,'projects.sqlite'));assert.equal(verify.prepare('SELECT version FROM schema_version').get().version,15);verify.close();}finally{reopened.close();}
});
test('group sections partition headings once, preserve order, filter members and fall back to Misc',()=>{
 const items=[{id:'a',name:'Sprinkler'},{id:'b',name:'Detector'},{id:'c',name:'Call point'}],state={countGroups:[{id:'g2',name:'Detection',position:1,discipline_id:'d'},{id:'g1',name:'Wet systems',position:0,discipline_id:'d'},{id:'outside',name:'Outside',position:0,discipline_id:'other'}],countGroupMembers:[{item_id:'a',group_id:'g1'},{item_id:'b',group_id:'g2'},{item_id:'c',group_id:'outside'}]};
 const sections=countGroupSections(state,'d',items);assert.deepEqual(sections.map(s=>s.name),['Wet systems','Detection','Misc']);assert.deepEqual(sections.flatMap(s=>s.items),items);assert.deepEqual(countGroupSections(state,'d',items,'wet').flatMap(s=>s.items),[items[0]]);assert.deepEqual(countGroupSections(state,'d',items,'detector').map(s=>s.name),['Detection']);assert.deepEqual(countGroupSections(state,'d',items,'unknown'),[]);assert.deepEqual(countGroupSections({},'d',items,'CALL')[0].items,[items[2]]);
});
test('group HTTP routes validate token and JSON, reject stale replay and preserve populated groups',async t=>{
 const {directory,discipline,a}=await workspace(t),{startApp}=await import('../apps/local/server.mjs'),app=await startApp({directory,port:0});
 try{const token=(await(await fetch(app.origin+'/api/session')).json()).token,request=(path,method,body,auth=true)=>fetch(app.origin+path,{method,headers:{'Content-Type':'application/json',...(auth?{'X-Fire-Token':token}:{})},body:JSON.stringify(body)}),path=`/api/disciplines/${discipline.id}/count-groups`;
 assert.equal((await request(path,'POST',{name:'Group',version:0},false)).status,403);for(const body of [null,[]])assert.equal((await request(path,'POST',body)).status,400);const response=await request(path,'POST',{name:'Group',version:0});assert.equal(response.status,201);const {group:g}=await response.json();
 assert.equal((await request(`/api/items/${a.id}/group`,'PATCH',{group_id:g.id,version:1})).status,200);assert.equal((await request(`/api/items/${a.id}/group`,'PATCH',{group_id:null,version:1})).status,409);assert.equal((await request(`/api/count-groups/${g.id}`,'DELETE',{version:2})).status,409);
 assert.equal((await request(`/api/count-groups/${g.id}`,'PATCH',{name:'Renamed',version:2})).status,200);assert.equal((await request(`/api/items/${a.id}/group`,'PATCH',{group_id:null,version:3})).status,200);assert.equal((await request(`/api/count-groups/${g.id}`,'DELETE',{version:4})).status,200);const final=await(await fetch(app.origin+'/api/state')).json();assert.equal(final.countGroups.length,0);assert.equal(final.countGroupEvents.length,5);
 }finally{await app.close();}
});

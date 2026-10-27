import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import ExcelJS from 'exceljs';
import {openStore} from '../apps/local/store.mjs';
import {quantityWorkbook} from '../apps/local/workbook.mjs';

async function workspace(t){
  const directory=await mkdtemp(join(tmpdir(),'fire-factors-'));t.after(()=>rm(directory,{recursive:true,force:true}));
  execFileSync(process.execPath,['scripts/generate-drawing-fixture.mjs',join(directory,'fixture')]);
  const store=await openStore(directory);t.after(()=>store.close());
  const p=store.create('project',null,'Factor tests'),takeoff=store.create('takeoff',p.id,'Original'),discipline=store.create('discipline',takeoff.id,'Services');
  const drawing=await store.importPdf(discipline.id,'Original.pdf',await readFile(join(directory,'fixture','small-vector.pdf')));
  return {store,directory,takeoff,discipline,drawing};
}
const measure=(store,id)=>store.snapshot().measurements.find(m=>m.id===id);
const heading=(store,id)=>store.snapshot().zoneHeadings.find(h=>h.id===id);
function factor(store,id,multiplier){const m=measure(store,id);return store.updateMeasure(id,{name:m.name,points:m.points,version:m.version,multiplier});}
function calibrate(store,id,distance=30,version=0){store.calibrate(id,{page:1,points:[[50,400],[350,400]],distance,unit:'m',version});}
const rectangle=(x1,y1,x2,y2)=>[[x1,y1],[x2,y1],[x2,y2],[x1,y2]];

test('length factors preserve geometry, survive recalibration/reopen and leave other measurement kinds unchanged',async t=>{
  const {store,drawing:d,directory}=await workspace(t);
  const length=store.createMeasure(d.id,{page:1,name:'Twin run',kind:'length',points:[[50,400],[350,400],[350,600]]});
  const area=store.createMeasure(d.id,{page:1,name:'Floor',kind:'area',points:rectangle(50,450,150,550)});
  const point=store.createMeasure(d.id,{page:1,name:'Valve',kind:'point',points:[[100,100]]});
  const original=measure(store,length.id);factor(store,length.id,2);
  assert.equal(measure(store,length.id).quantity.value,null);calibrate(store,d.id);
  let m=measure(store,length.id);assert.equal(m.base_quantity.value,50);assert.equal(m.quantity.value,100);assert.deepEqual(m.points,original.points);assert.equal(m.created,original.created);
  assert.ok(Math.abs(measure(store,area.id).quantity.value-100)<1e-9);assert.equal(measure(store,point.id).quantity.value,1);
  calibrate(store,d.id,60,1);assert.equal(measure(store,length.id).quantity.value,200);
  const edited=measure(store,length.id);store.updateMeasure(length.id,{name:'Renamed',points:edited.points,version:edited.version});assert.equal(measure(store,length.id).multiplier,2);
  assert.equal(store.snapshot().measurementFactorEvents.length,1);
  const state=store.snapshot();store.close();store.close=()=>{};const reopened=await openStore(directory);
  try{assert.deepEqual(reopened.snapshot(),state);assert.equal(measure(reopened,length.id).quantity.value,200);}finally{reopened.close();}
});

test('invalid/stale length factors and forced audit failures leave all geometry, factors and history intact',async t=>{
  const {store,drawing:d,directory}=await workspace(t);
  const length=store.createMeasure(d.id,{page:1,name:'Run',kind:'length',points:[[50,400],[350,400]]});
  const point=store.createMeasure(d.id,{page:1,name:'Point',kind:'point',points:[[100,100]]});
  const area=store.createMeasure(d.id,{page:1,name:'Area',kind:'area',points:rectangle(50,450,150,550)});
  const original=store.snapshot();
  for(const value of [0,-1,1.5,10001,'2',null,NaN])assert.throws(()=>factor(store,length.id,value),{status:400});
  for(const id of [point.id,area.id])assert.throws(()=>factor(store,id,2),{status:400});
  const m=measure(store,length.id);assert.throws(()=>store.updateMeasure(m.id,{name:m.name,points:m.points,version:99,multiplier:2}),{status:409});
  assert.deepEqual(store.snapshot(),original);
  const db=new DatabaseSync(join(directory,'projects.sqlite'));
  try{
    db.exec("CREATE TRIGGER fail_measure_audit BEFORE INSERT ON measurement_factor_events BEGIN SELECT RAISE(ABORT,'audit unavailable'); END;");
    assert.throws(()=>store.updateMeasure(m.id,{name:'Must roll back',points:[[50,400],[300,400]],version:1,multiplier:3}),/audit unavailable/);
    assert.deepEqual(store.snapshot(),original);db.exec('DROP TRIGGER fail_measure_audit');
  }finally{db.close();}
  factor(store,m.id,3);store.deleteMeasure(m.id,2);assert.equal(store.snapshot().measurementFactorEvents.length,0);
});

test('zone factors apply to every outline under their heading across drawings; unoutlined pages retain factor one',async t=>{
  const {store,drawing:d,discipline,directory}=await workspace(t);
  for(const variant of ['revision','cropped'])execFileSync(process.execPath,['scripts/generate-drawing-fixture.mjs',join(directory,variant),variant]);
  const revision=await store.importPdf(discipline.id,'Revision.pdf',await readFile(join(directory,'revision','small-vector.pdf')));
  const rotated=await store.importPdf(discipline.id,'Rotated.pdf',await readFile(join(directory,'cropped','small-vector.pdf')));
  const a=store.createZoneHeading(discipline.id,{name:'Typical floor'}),b=store.createZoneHeading(discipline.id,{name:'Other'});
  for(const drawing of [d,revision]){store.createMeasure(drawing.id,{page:1,name:'Valve',kind:'point',points:[[100,100]]});store.createZone(drawing.id,{heading_id:a.id,page:1,points:rectangle(50,50,200,200)});}
  store.createMeasure(rotated.id,{page:1,name:'Whole page',kind:'point',points:[[100,100]]});
  const before=store.snapshot();store.updateZoneMultiplier(a.id,{version:1,multiplier:5});
  const after=store.snapshot();assert.deepEqual(after.zones,before.zones);assert.deepEqual(after.measurements,before.measurements);assert.equal(heading(store,b.id).multiplier,1);
  assert.equal(after.quantitySchedule.reduce((n,r)=>n+r.value,0),11);
  assert.deepEqual(after.quantitySchedule.map(r=>[r.base_value,r.zone_multiplier,r.value]).sort((a,b)=>a[1]-b[1]),[[1,1,1],[1,5,5],[1,5,5]]);
  assert.equal(after.zoneFactorEvents.length,1);
  store.updateZoneMultiplier(a.id,{version:2,multiplier:5});assert.equal(heading(store,a.id).version,2);assert.equal(store.snapshot().zoneFactorEvents.length,1);
});

test('zone factor edits reject stale/reordered versions and roll back when audit fails',async t=>{
  const {store,discipline,directory}=await workspace(t),a=store.createZoneHeading(discipline.id,{name:'A'}),b=store.createZoneHeading(discipline.id,{name:'B'});
  const original=store.snapshot();
  for(const multiplier of [0,-1,1.25,10001,'5',null,NaN])assert.throws(()=>store.updateZoneMultiplier(a.id,{multiplier,version:1}),{status:400});
  assert.throws(()=>store.updateZoneMultiplier(a.id,{multiplier:5,version:99}),{status:409});assert.deepEqual(store.snapshot(),original);
  const db=new DatabaseSync(join(directory,'projects.sqlite'));
  try{db.exec("CREATE TRIGGER fail_zone_audit BEFORE INSERT ON zone_factor_events BEGIN SELECT RAISE(ABORT,'audit unavailable'); END;");assert.throws(()=>store.updateZoneMultiplier(a.id,{multiplier:5,version:1}),/audit unavailable/);assert.deepEqual(store.snapshot(),original);db.exec('DROP TRIGGER fail_zone_audit');}finally{db.close();}
  store.updateZoneMultiplier(a.id,{multiplier:5,version:1});assert.throws(()=>store.reorderZoneHeadings(discipline.id,[{id:b.id,version:1},{id:a.id,version:1}]),{status:409});
  store.reorderZoneHeadings(discipline.id,[{id:b.id,version:1},{id:a.id,version:2}]);assert.equal(heading(store,a.id).multiplier,5);
  assert.throws(()=>store.updateZoneMultiplier(a.id,{multiplier:2,version:2}),{status:409});
  store.deleteZoneHeading(a.id,3);assert.equal(store.snapshot().zoneFactorEvents.length,0);
});

test('mixed source/zone factors reconcile independent geometry, workbook details, red cells and audit',async t=>{
  const {store,drawing:d,discipline,takeoff,directory}=await workspace(t);calibrate(store,d.id);
  const run=store.createMeasure(d.id,{page:1,name:'Twin cable',kind:'length',points:[[50,400],[350,400]]});factor(store,run.id,2);
  store.createMeasure(d.id,{page:1,name:'Floor',kind:'area',points:rectangle(50,450,150,550)});
  const item=store.createCount(discipline.id,{name:'Six pack',example:{drawing_id:d.id,page:1,bounds:[90,90,110,110],digest:d.digest,algorithm:'binary-overlap-1'},matches:[{drawing_id:d.id,page:1,x:100,y:100,score:1,digest:d.digest}]});
  const example=store.snapshot().countExamples[0];store.updateCountMultiplier(example.id,{version:1,multiplier:6});store.reviewMarks(item.id,store.snapshot().countMarks.map(m=>({id:m.id,included:true,reviewed:true,version:m.version})));
  const west=store.createZoneHeading(discipline.id,{name:'West'}),east=store.createZoneHeading(discipline.id,{name:'East'});
  store.createZone(d.id,{heading_id:west.id,page:1,points:rectangle(0,0,200,750)});store.createZone(d.id,{heading_id:east.id,page:1,points:rectangle(150,0,400,750)});
  store.updateZoneMultiplier(west.id,{version:1,multiplier:5});store.updateZoneMultiplier(east.id,{version:1,multiplier:2});
  const state=store.snapshot(),rows=state.quantitySchedule;
  const cable=rows.filter(r=>r.source_id===run.id);assert.deepEqual(cable.map(r=>[r.fraction,r.base_value,r.value]),[[.5,30,150],[.5,30,60]]);
  assert.equal(rows.find(r=>r.name==='Six pack').value,30);assert.ok(Math.abs(rows.find(r=>r.name==='Floor').value-500)<1e-9);
  assert.equal(state.countMarks.length,1);assert.equal(state.countMarks[0].quantity,6);assert.equal(measure(store,run.id).quantity.value,60);
  const result=await quantityWorkbook(state,takeoff.id),book=new ExcelJS.Workbook();await book.xlsx.load(result.bytes);
  const sheet=book.getWorksheet('Services'),data=sheet.getRows(2,sheet.rowCount-1),runRow=data.find(r=>r.getCell(2).value==='Twin cable');
  assert.equal(runRow.getCell(7).value,210);assert.equal(runRow.getCell(8).value,150);assert.equal(runRow.getCell(9).value,60);assert.equal(sheet.getCell('H1').value,'West ×5');assert.equal(runRow.getCell(8).font.color.argb,'FFCC0000');
  const detail=book.getWorksheet('Quantity detail').getSheetValues().slice(2).filter(r=>r[1]===run.id);assert.deepEqual(detail.map(r=>r.slice(10,15)),[[15,2,30,5,150],[15,2,30,2,60]]);
  assert.equal(book.getWorksheet('Factor history').rowCount,5);
  const path=join(directory,'factors.xlsx');await writeFile(path,result.bytes);
  const independent=JSON.parse(execFileSync('python3',['-c',`import zipfile,xml.etree.ElementTree as E,json,sys
z=zipfile.ZipFile(sys.argv[1]); n={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
s=E.fromstring(z.read('xl/styles.xml')); fonts=s.find('s:fonts',n); styles=s.find('s:cellXfs',n)
rows=E.fromstring(z.read('xl/worksheets/sheet6.xml')).findall('s:sheetData/s:row',n)
found=[]
for row in rows[1:]:
 cells={c.get('r').rstrip('0123456789'):c for c in row.findall('s:c',n)}
 if cells['G'].find('s:v',n).text=='210':
  for col in ['G','H','I']:
   c=cells[col]; font=fonts[int(styles[int(c.get('s','0'))].get('fontId'))]; color=font.find('s:color',n)
   found.append([float(c.find('s:v',n).text),color.get('rgb') if color is not None else None])
print(json.dumps(found))`,path],{encoding:'utf8'}));
  assert.deepEqual(independent,[[210,'FFCC0000'],[150,'FFCC0000'],[60,'FFCC0000']]);
  store.updateZoneMultiplier(east.id,{version:2,multiplier:1});assert.notEqual((await quantityWorkbook(store.snapshot(),takeoff.id)).snapshotDigest,result.snapshotDigest);
});

test('schema 7 upgrade defaults factors to one without altering source/geometry and persists the upgraded state',async t=>{
  const {store,drawing:d,discipline,directory}=await workspace(t);calibrate(store,d.id);
  const m=store.createMeasure(d.id,{page:1,name:'Run',kind:'length',points:[[50,400],[350,400]]}),h=store.createZoneHeading(discipline.id,{name:'Whole'});
  store.createZone(d.id,{heading_id:h.id,page:1,points:rectangle(0,0,400,750)});
  const before=store.snapshot();store.close();store.close=()=>{};
  const db=new DatabaseSync(join(directory,'projects.sqlite'));db.exec('DROP TABLE measurement_factor_events;DROP TABLE zone_factor_events;ALTER TABLE measurements DROP COLUMN multiplier;ALTER TABLE zone_headings DROP COLUMN multiplier;UPDATE schema_version SET version=7');db.close();
  let reopened=await openStore(directory);
  try{assert.deepEqual(reopened.snapshot(),before);assert.equal(measure(reopened,m.id).quantity.value,30);assert.equal(heading(reopened,h.id).multiplier,1);}finally{reopened.close();}
  reopened=await openStore(directory);try{assert.deepEqual(reopened.snapshot(),before);}finally{reopened.close();}
});

test('length and zone factors use authenticated versioned HTTP updates and retain export gates',async t=>{
  const {store,drawing:d,discipline,takeoff,directory}=await workspace(t);
  const m=store.createMeasure(d.id,{page:1,name:'Run',kind:'length',points:[[50,400],[350,400]]}),h=store.createZoneHeading(discipline.id,{name:'Typical'});
  store.createZone(d.id,{heading_id:h.id,page:1,points:rectangle(0,0,400,750)});
  const {startApp}=await import('../apps/local/server.mjs'),app=await startApp({directory,port:0});
  try{
    const {token}=await(await fetch(app.origin+'/api/session')).json();
    const patch=(path,body,auth=true)=>fetch(app.origin+path,{method:'PATCH',headers:{'Content-Type':'application/json',...(auth?{'X-Fire-Token':token}:{})},body:JSON.stringify(body)});
    const mr=`/api/measurements/${m.id}`,zr=`/api/zone-headings/${h.id}`,payload={name:'Run',points:[[50,400],[350,400]],version:1,multiplier:2};
    for(const route of [mr,zr]){assert.equal((await patch(route,{version:1,multiplier:5},false)).status,403);assert.equal((await patch(route,null)).status,400);}
    assert.equal((await patch(mr,payload)).status,200);assert.equal((await patch(zr,{version:1,multiplier:5})).status,200);
    assert.equal((await patch(mr,payload)).status,409);assert.equal((await patch(zr,{version:1,multiplier:2})).status,409);
    await assert.rejects(quantityWorkbook(store.snapshot(),takeoff.id),{status:409});calibrate(store,d.id);
    const state=await(await fetch(app.origin+'/api/state')).json();assert.equal(state.measurements[0].quantity.value,60);assert.equal(state.quantitySchedule[0].value,300);assert.equal(state.zoneFactorEvents.length,1);assert.equal(state.measurementFactorEvents.length,1);
  }finally{await app.close();}
});

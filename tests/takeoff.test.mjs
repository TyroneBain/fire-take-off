import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {openStore} from '../apps/local/store.mjs';
import {exampleImage,findMatches,MATCHER_VERSION} from '../apps/local/web/matcher.mjs';
import {polygonArea,pathLength,validateGeometry} from '../apps/local/web/takeoff-geometry.mjs';
import {quantityWorkbook} from '../apps/local/workbook.mjs';
import ExcelJS from 'exceljs';

async function workspace(t){const directory=await mkdtemp(join(tmpdir(),'fire-takeoff-domain-'));t.after(()=>rm(directory,{recursive:true,force:true}));execFileSync(process.execPath,['scripts/generate-drawing-fixture.mjs',join(directory,'fixture')]);const bytes=await readFile(join(directory,'fixture','small-vector.pdf'));const store=await openStore(directory);t.after(()=>store.close());const p=store.create('project',null,'Original takeoff'),takeoff=store.create('takeoff',p.id,'Rev 0'),discipline=store.create('discipline',takeoff.id,'Sprinkler');const drawing=await store.importPdf(discipline.id,'Original.pdf',bytes);return {store,discipline,drawing,bytes,directory};}
function example(d){return {drawing_id:d.id,page:1,bounds:[90,90,110,110],digest:d.digest,algorithm:MATCHER_VERSION};}
function hit(d,x,y){return {drawing_id:d.id,page:1,x,y,score:1,digest:d.digest};}

test('matcher finds six labelled instances, suppresses duplicates and rejects a similar distractor',()=>{
  const width=180,height=130,data=new Uint8Array(width*height);
  function glyph(cx,cy,cross=true){for(let i=-5;i<=5;i++){data[(cy-5)*width+cx+i]=1;data[(cy+5)*width+cx+i]=1;data[(cy+i)*width+cx-5]=1;data[(cy+i)*width+cx+5]=1;if(cross){data[cy*width+cx+i]=1;data[(cy+i)*width+cx]=1;}}}
  const expected=[[25,25],[65,25],[105,25],[25,75],[65,75],[105,75]];for(const p of expected)glyph(...p);glyph(150,75,false);
  const image={data,width,height},template=exampleImage(image,[15,15,35,35]);
  const found=findMatches(image,template);assert.equal(found.length,6);
  for(const [x,y]of expected)assert.ok(found.some(m=>Math.abs(m.left+m.width/2-x)<=1&&Math.abs(m.top+m.height/2-y)<=1));
  assert.ok(found.every(m=>m.score===1));
});

test('matcher rejects empty examples and fails bounded work without returning partial matches',()=>{
  const image={data:new Uint8Array(100*100),width:100,height:100};assert.throws(()=>exampleImage(image,[0,0,20,20]),/detail/);
  image.data.fill(1);const template=exampleImage(image,[0,0,10,10]);assert.throws(()=>findMatches(image,template,{maxComparisons:1}),/budget/);
});

test('A004/A005: six instance counts, exclusion/restoration, review audit and saved corrections',async t=>{
  const {store,discipline,drawing:d}=await workspace(t);
  const points=[[100,100],[200,100],[300,100],[100,200],[200,200],[300,200]];
  const item=store.createCount(discipline.id,{name:'Original heads',example:example(d),matches:points.map(([x,y])=>hit(d,x,y))});
  let marks=store.snapshot().countMarks;assert.equal(marks.length,6);assert.equal(marks.filter(m=>m.included).length,6);assert.ok(marks.every(m=>!m.reviewed));
  store.updateMark(marks[0].id,{included:false,reviewed:true,version:1});assert.equal(store.snapshot().countMarks.filter(m=>m.included).length,5);
  assert.throws(()=>store.updateMark(marks[0].id,{included:true,reviewed:true,version:1}),{status:409});
  store.updateMark(marks[0].id,{included:true,reviewed:true,version:2});
  marks=store.snapshot().countMarks;store.reviewMarks(item.id,marks.map(m=>({id:m.id,version:m.version,included:true,reviewed:true})));
  assert.ok(store.snapshot().countMarks.every(m=>m.included&&m.reviewed));assert.equal(store.events(item.id).length,8);
  assert.equal(store.events(item.id)[0].action,'exclude');
  assert.throws(()=>store.addManualMark(item.id,{drawing_id:d.id,page:1,x:100,y:100}),{status:409});
  store.addManualMark(item.id,{drawing_id:d.id,page:1,x:350,y:250});assert.equal(store.snapshot().countMarks.filter(m=>m.included).length,7);
});

test('count batches reject stale/wrong-scope/duplicate results atomically',async t=>{
  const {store,discipline,drawing:d}=await workspace(t);
  assert.throws(()=>store.createCount(discipline.id,{name:'Bad',example:example(d),matches:[hit(d,100,100),hit(d,100,100)]}),{status:409});
  assert.equal(store.snapshot().countItems.length,0);assert.equal(store.snapshot().countMarks.length,0);
  assert.throws(()=>store.createCount(discipline.id,{name:'Stale',example:example(d),matches:[{...hit(d,100,100),digest:'changed'}]}),{status:400});
  const parent=store.snapshot().entities.find(e=>e.kind==='takeoff'),other=store.create('discipline',parent.id,'Other discipline');
  assert.throws(()=>store.createCount(other.id,{name:'Outside scope',example:example(d),matches:[hit(d,100,100)]}),{status:400});
  assert.equal(store.snapshot().countItems.length,0);
});

test('bulk review with a stale decision rolls back earlier decisions and audit events',async t=>{
  const {store,discipline,drawing:d}=await workspace(t);const item=store.createCount(discipline.id,{name:'Test',example:example(d),matches:[hit(d,100,100),hit(d,200,100)]});
  const [a,b]=store.snapshot().countMarks;
  assert.throws(()=>store.reviewMarks(item.id,[{id:a.id,included:false,reviewed:true,version:1},{id:b.id,included:true,reviewed:true,version:999}]),{status:409});
  assert.ok(store.snapshot().countMarks.every(m=>m.included&&m.version===1));assert.equal(store.events(item.id).length,0);
});

test('A006: calibration yields independent 50 m run and 100 m² polygon; recalibration updates quantities',async t=>{
  const {store,drawing:d}=await workspace(t);
  store.createMeasure(d.id,{page:1,name:'Pipe',kind:'length',points:[[50,400],[350,400],[350,600]]});
  store.createMeasure(d.id,{page:1,name:'Floor',kind:'area',points:[[50,450],[150,450],[150,550],[50,550]]});
  store.createMeasure(d.id,{page:1,name:'Valve',kind:'point',points:[[100,100]]});
  let values=Object.fromEntries(store.snapshot().measurements.map(m=>[m.name,m.quantity.value]));assert.deepEqual(values,{Pipe:null,Floor:null,Valve:1});
  store.calibrate(d.id,{page:1,points:[[50,400],[350,400]],distance:30,unit:'m',version:0});
  values=Object.fromEntries(store.snapshot().measurements.map(m=>[m.name,m.quantity.value]));assert.ok(Math.abs(values.Pipe-50)<1e-9&&Math.abs(values.Floor-100)<1e-9);assert.equal(values.Valve,1);
  store.calibrate(d.id,{page:1,points:[[50,400],[350,400]],distance:15000,unit:'mm',version:1});
  values=Object.fromEntries(store.snapshot().measurements.map(m=>[m.name,m.quantity.value]));assert.ok(Math.abs(values.Pipe-25)<1e-9&&Math.abs(values.Floor-25)<1e-9);assert.equal(values.Valve,1);
});

test('invalid calibration, stale scale and crossed/degenerate polygons are rejected without edits',async t=>{
  const {store,drawing:d}=await workspace(t);
  for(const invalid of [{distance:0},{distance:-1},{unit:'unknown'},{points:[[100,100],[100,100]]}])assert.throws(()=>store.calibrate(d.id,{page:1,points:[[50,400],[350,400]],distance:30,unit:'m',version:0,...invalid}),{status:400});
  assert.equal(store.snapshot().calibrations.length,0);
  store.calibrate(d.id,{page:1,points:[[50,400],[350,400]],distance:30,unit:'m',version:0});
  assert.throws(()=>store.calibrate(d.id,{page:1,points:[[50,400],[350,400]],distance:60,unit:'m',version:0}),{status:409});
  for(const points of [[[0,0],[100,100],[0,100],[100,0]],[[0,0],[100,0],[200,0]]])assert.throws(()=>store.createMeasure(d.id,{page:1,name:'Invalid area',kind:'area',points}),{status:400});
  assert.equal(store.snapshot().measurements.length,0);
});

test('analytic geometry is orientation independent and rejects repeated/touching boundaries',()=>{
  assert.equal(pathLength([[0,0],[3,4],[6,8]]),10);
  const polygon=[[0,0],[4,0],[4,3],[0,3]];assert.equal(polygonArea(polygon),12);assert.equal(polygonArea([...polygon].reverse()),12);
  assert.throws(()=>validateGeometry('length',[[1,1],[1,1]],[0,0,10,10]));
  assert.throws(()=>validateGeometry('area',[[0,0],[4,0],[2,0],[2,3],[0,3]],[0,0,10,10]));
});

test('A010: workbook refuses unreviewed/unscaled work and reconciles approved counts and measures',async t=>{
  const {store,discipline,drawing:d,directory}=await workspace(t);
  const takeoffId=discipline.parent_id;
  const count=store.createCount(discipline.id,{name:'=HYPERLINK("untrusted")',example:example(d),matches:[hit(d,100,100),hit(d,200,100)]});
  await assert.rejects(quantityWorkbook(store.snapshot(),takeoffId),{status:409});
  store.reviewMarks(count.id,store.snapshot().countMarks.map(m=>({id:m.id,version:m.version,included:true,reviewed:true})));
  store.createMeasure(d.id,{page:1,name:'Pipe',kind:'length',points:[[50,400],[350,400],[350,600]]});
  await assert.rejects(quantityWorkbook(store.snapshot(),takeoffId),{status:409});
  store.calibrate(d.id,{page:1,points:[[50,400],[350,400]],distance:30,unit:'m',version:0});
  store.createMeasure(d.id,{page:1,name:'Floor',kind:'area',points:[[50,450],[150,450],[150,550],[50,550]]});
  store.createNote(d.id,{page:1,x:100,y:100,text:'=Literal note, not a formula'});
  const result=await quantityWorkbook(store.snapshot(),takeoffId);assert.equal(result.snapshotDigest.length,64);
  const book=new ExcelJS.Workbook();await book.xlsx.load(result.bytes);
  assert.deepEqual(book.worksheets.map(s=>s.name),['Takeoff overview','Drawing list','Notes','Count instances','Review history','Sprinkler']);
  const rows=book.getWorksheet('Sprinkler').getSheetValues().slice(2).map(r=>r.slice(1));
  assert.equal(rows.find(r=>r[0]==='Count')[6],2);
  assert.equal(rows.find(r=>r[1]==='Pipe')[6],50);assert.ok(Math.abs(rows.find(r=>r[1]==='Floor')[6]-100)<1e-9);
  assert.equal(book.getWorksheet('Notes').getCell('C2').type,ExcelJS.ValueType.String);
  // Independent standard-library ZIP/XML inspection, not only writer readback.
  const {writeFile}=await import('node:fs/promises');const path=join(directory,'quantities.xlsx');await writeFile(path,result.bytes);
  const inspection=JSON.parse(execFileSync('python3',['-c',`import zipfile,xml.etree.ElementTree as E,json,sys
z=zipfile.ZipFile(sys.argv[1]); n={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
strings=[''.join(e.itertext()) for e in E.fromstring(z.read('xl/sharedStrings.xml')).findall('s:si',n)]
rows=E.fromstring(z.read('xl/worksheets/sheet6.xml')).findall('s:sheetData/s:row',n)
values=[]
for row in rows:
 cells=[]
 for c in row.findall('s:c',n):
  v=c.find('s:v',n); value=v.text if v is not None else ''
  cells.append(strings[int(value)] if c.get('t')=='s' else value)
 values.append(cells)
assert not any(b'<f>' in z.read(p) for p in z.namelist() if p.startswith('xl/worksheets/'))
print(json.dumps(values))`,path],{encoding:'utf8'}));
  assert.equal(inspection.find(r=>r[1]==='Pipe')[6],'50');assert.equal(inspection.find(r=>r[0]==='Count')[6],'2');
  assert.ok(inspection.some(r=>r[1]==='=HYPERLINK("untrusted")'));
});

test('zones: no-zone totals, priority, duplicate outlines, edges and reordering reconcile six counts',async t=>{
 const {store,discipline,drawing:d}=await workspace(t);
 const item=store.createCount(discipline.id,{name:'Heads',example:example(d),matches:[[100,100],[200,100],[300,100],[100,200],[200,200],[300,200]].map(([x,y])=>hit(d,x,y))});
 assert.equal(store.snapshot().quantitySchedule.reduce((n,r)=>n+r.value,0),6);
 const a=store.createZoneHeading(discipline.id,{name:'Left'}),b=store.createZoneHeading(discipline.id,{name:'Right'});
 const left=[[50,50],[200,50],[200,250],[50,250]],right=[[150,50],[350,50],[350,250],[150,250]];
 store.createZone(d.id,{heading_id:a.id,page:1,points:left});store.createZone(d.id,{heading_id:a.id,page:1,points:left});store.createZone(d.id,{heading_id:b.id,page:1,points:right});
 const totals=()=>store.snapshot().quantitySchedule.reduce((n,r)=>(n[r.zone]=(n[r.zone]||0)+r.value,n),{});
 assert.deepEqual(totals(),{Left:4,Right:2});
 store.reorderZoneHeadings(discipline.id,[{id:b.id,version:1},{id:a.id,version:1}]);assert.deepEqual(totals(),{Left:2,Right:4});
 assert.throws(()=>store.reorderZoneHeadings(discipline.id,[{id:a.id,version:1},{id:b.id,version:1}]),{status:409});
 assert.deepEqual(totals(),{Left:2,Right:4});assert.equal(store.snapshot().countMarks.length,6);assert.equal(store.snapshot().countItems[0].id,item.id);
});

test('zones: analytic crossing line and area split 15/5 m and 150/50 m² without double counting',async t=>{
 const {store,discipline,drawing:d}=await workspace(t);
 store.calibrate(d.id,{page:1,points:[[0,0],[100,0]],distance:10,unit:'m',version:0});
 store.createMeasure(d.id,{page:1,name:'Run',kind:'length',points:[[50,100],[250,100]]});
 store.createMeasure(d.id,{page:1,name:'Floor',kind:'area',points:[[50,50],[250,50],[250,150],[50,150]]});
 const a=store.createZoneHeading(discipline.id,{name:'First'}),b=store.createZoneHeading(discipline.id,{name:'Second'});
 store.createZone(d.id,{heading_id:a.id,page:1,points:[[0,0],[200,0],[200,200],[0,200]]});
 store.createZone(d.id,{heading_id:b.id,page:1,points:[[100,0],[300,0],[300,200],[100,200]]});
 const rows=store.snapshot().quantitySchedule;
 for(const [name,zone,value] of [['Run','First',15],['Run','Second',5],['Floor','First',150],['Floor','Second',50]])assert.ok(Math.abs(rows.find(r=>r.name===name&&r.zone===zone).value-value)<1e-9);
 store.reorderZoneHeadings(discipline.id,[{id:b.id,version:1},{id:a.id,version:1}]);
 const changed=store.snapshot().quantitySchedule;assert.equal(changed.find(r=>r.name==='Run'&&r.zone==='Second').value,15);assert.ok(Math.abs(changed.filter(r=>r.name==='Floor').reduce((n,r)=>n+r.value,0)-200)<1e-9);
});

test('zones: outside quantities excluded, deletion cascades and version/scope validation preserves state',async t=>{
 const {store,discipline,drawing:d}=await workspace(t);
 store.createMeasure(d.id,{page:1,name:'Inside',kind:'point',points:[[100,100]]});store.createMeasure(d.id,{page:1,name:'Outside',kind:'point',points:[[300,100]]});
 const h=store.createZoneHeading(discipline.id,{name:'Area'}),z=store.createZone(d.id,{heading_id:h.id,page:1,points:[[0,0],[200,0],[200,200],[0,200]]});
 assert.deepEqual(store.snapshot().quantitySchedule.map(r=>r.name),['Inside']);
 assert.throws(()=>store.updateZone(z.id,{version:99,points:[[0,0],[400,0],[400,400],[0,400]]}),{status:409});
 assert.throws(()=>store.createZone(d.id,{heading_id:h.id,page:1,points:[[0,0],[100,100],[0,100],[100,0]]}),{status:400});
 const other=store.create('discipline',discipline.parent_id,'Other'),oh=store.createZoneHeading(other.id,{name:'Wrong scope'});
 assert.throws(()=>store.createZone(d.id,{heading_id:oh.id,page:1,points:[[0,0],[200,0],[200,200],[0,200]]}),{status:400});
 assert.throws(()=>store.createZoneHeading(discipline.id,{name:'area'}),{status:409});
 store.updateZone(z.id,{version:1,points:[[250,0],[400,0],[400,200],[250,200]]});assert.deepEqual(store.snapshot().quantitySchedule.map(r=>r.name),['Outside']);
 assert.throws(()=>store.deleteZone(z.id,1),{status:409});
 store.deleteZoneHeading(h.id,1);assert.equal(store.snapshot().zones.length,0);assert.equal(store.snapshot().quantitySchedule.length,2);
});

test('zones: concave polygons, holes, boundary lines and reversed geometry conserve analytic quantities',async()=>{
 const {effectiveZones,allocateGeometry}=await import('../apps/local/zone-allocation.mjs');
 const h=[{id:'a',position:0},{id:'b',position:1}];
 const groups=effectiveZones(h,[{heading_id:'a',points:[[2,2],[8,2],[8,8],[2,8]]},{heading_id:'b',points:[[0,0],[10,0],[10,10],[0,10]]}]);
 const area=allocateGeometry('area',[[0,0],[10,0],[10,10],[0,10]],groups);assert.ok(Math.abs(area.find(r=>r.heading_id==='a').fraction-.36)<1e-9);assert.ok(Math.abs(area.find(r=>r.heading_id==='b').fraction-.64)<1e-9);
 const line=allocateGeometry('length',[[0,2],[10,2]],groups);assert.ok(Math.abs(line.find(r=>r.heading_id==='a').fraction-.6)<1e-9);assert.ok(Math.abs(line.reduce((n,r)=>n+r.fraction,0)-1)<1e-9);
 const concave=effectiveZones([h[0]],[{heading_id:'a',points:[[0,0],[10,0],[10,4],[4,4],[4,10],[0,10]]}]);
 assert.ok(Math.abs(allocateGeometry('area',[[0,0],[0,10],[10,10],[10,0]],concave)[0].fraction-.64)<1e-9);
 assert.ok(Math.abs(allocateGeometry('length',[[10,5],[0,5]],concave)[0].fraction-.4)<1e-9);
});

test('zones: zoned workbook matches schedule and ignores unreviewed marks entirely outside output',async t=>{
 const {store,discipline,drawing:d}=await workspace(t);
 const item=store.createCount(discipline.id,{name:'Heads',example:example(d),matches:[hit(d,100,100),hit(d,300,100)]});
 const h=store.createZoneHeading(discipline.id,{name:'Included'});store.createZone(d.id,{heading_id:h.id,page:1,points:[[50,50],[200,50],[200,200],[50,200]]});
 await assert.rejects(quantityWorkbook(store.snapshot(),discipline.parent_id),{status:409});
 const inside=store.snapshot().countMarks.find(m=>m.x===100);store.updateMark(inside.id,{included:true,reviewed:true,version:1});
 const book=new ExcelJS.Workbook(),result=await quantityWorkbook(store.snapshot(),discipline.parent_id);await book.xlsx.load(result.bytes);
 const rows=book.getWorksheet('Sprinkler').getSheetValues().slice(2).map(r=>r.slice(1));assert.equal(rows.length,1);assert.equal(rows[0][6],1);assert.equal(rows[0][7],1);assert.equal(book.getWorksheet('Sprinkler').getCell('H1').value,'Included');
 const old=result.snapshotDigest;store.deleteZoneHeading(h.id,1);await assert.rejects(quantityWorkbook(store.snapshot(),discipline.parent_id),{status:409});
 store.reviewMarks(item.id,store.snapshot().countMarks.map(m=>({id:m.id,version:m.version,included:true,reviewed:true})));assert.notEqual((await quantityWorkbook(store.snapshot(),discipline.parent_id)).snapshotDigest,old);
});

test('zones: schema 4 migration and reopen preserve sources, prior quantities, outlines and ordering',async t=>{
 const {store,discipline,drawing:d,directory}=await workspace(t);
 store.createMeasure(d.id,{page:1,name:'Valve',kind:'point',points:[[100,100]]});
 store.close();store.close=()=>{};const {DatabaseSync}=await import('node:sqlite');const db=new DatabaseSync(join(directory,'projects.sqlite'));db.exec('DROP TABLE zones;DROP TABLE zone_headings;UPDATE schema_version SET version=4');db.close();
 let reopened=await openStore(directory);const a=reopened.createZoneHeading(discipline.id,{name:'Retained'});reopened.createZone(d.id,{heading_id:a.id,page:1,points:[[50,50],[200,50],[200,200],[50,200]]});const expected=reopened.snapshot();reopened.close();
 reopened=await openStore(directory);assert.deepEqual(reopened.snapshot(),expected);assert.equal(reopened.snapshot().quantitySchedule[0].value,1);assert.equal(reopened.snapshot().drawings[0].digest,d.digest);reopened.close();
});

test('zones: HTTP creation, stale edits, ordered headings and removal use the real authenticated routes',async t=>{
 const {store,discipline,drawing:d,directory}=await workspace(t);store.createMeasure(d.id,{page:1,name:'Point',kind:'point',points:[[100,100]]});
 const {startApp}=await import('../apps/local/server.mjs');const app=await startApp({directory,port:0});
 try{
  const {token}=await (await fetch(app.origin+'/api/session')).json();
  const request=(path,method,body,auth=true)=>fetch(app.origin+path,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(auth?{'X-Fire-Token':token}:{})},body:body?JSON.stringify(body):undefined});
  const route=`/api/disciplines/${discipline.id}/zone-headings`;
  assert.equal((await request(route,'POST',{name:'Denied'},false)).status,403);
  const response=await request(route,'POST',{name:'Area'});assert.equal(response.status,201);const h=await response.json();
  const created=await request(`/api/drawings/${d.id}/zones`,'POST',{heading_id:h.id,page:1,points:[[50,50],[200,50],[200,200],[50,200]]});assert.equal(created.status,201);const z=await created.json();
  assert.equal((await request(`/api/zones/${z.id}`,'PATCH',{version:99,points:[[0,0],[10,0],[10,10],[0,10]]})).status,409);
  assert.equal((await request(route,'PATCH',{order:[{id:h.id,version:1}]})).status,200);
  const snapshot=await (await fetch(app.origin+'/api/state')).json();assert.equal(snapshot.quantitySchedule[0].zone,'Area');assert.equal(snapshot.quantitySchedule[0].value,1);
  assert.equal((await request(`/api/zones/${z.id}?version=1`,'DELETE')).status,200);
  assert.equal((await request(`/api/zone-headings/${h.id}?version=2`,'DELETE')).status,200);
 }finally{await app.close();}
});

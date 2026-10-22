import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { startApp } from '../apps/local/server.mjs';
import { openStore, MAX_PDF_BYTES } from '../apps/local/store.mjs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { pagePoint, viewPoint } from '../apps/local/web/coordinates.mjs';
import { DatabaseSync } from 'node:sqlite';

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'fire-take-off-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  execFileSync(process.execPath, ['scripts/generate-drawing-fixture.mjs', join(directory, 'fixture')]);
  const bytes = await readFile(join(directory, 'fixture', 'small-vector.pdf'));
  return { directory, bytes };
}
function hierarchy(store) {
  const project = store.create('project', null, 'Original fixture project');
  const takeoff = store.create('takeoff', project.id, 'Revision 0');
  return store.create('discipline', takeoff.id, 'Original geometry');
}

test('A001/A002: hierarchy, source bytes and page geometry survive database reopen', async t => {
  const { directory, bytes } = await fixture(t);
  let store = await openStore(directory);
  const discipline = hierarchy(store);
  const d = await store.importPdf(discipline.id, 'Original.pdf', bytes);
  assert.equal(d.digest, createHash('sha256').update(bytes).digest('hex'));
  assert.deepEqual(d.pages, [{ number: 1, view: [0,0,595,842], rotation: 0, userUnit: 1 }]);
  store.close(); store = await openStore(directory); t.after(() => store.close());
  assert.equal(store.snapshot().entities.length, 3);
  assert.equal(store.snapshot().drawings[0].id, d.id);
  assert.deepEqual(await store.source(d.id), bytes);
});

test('A001: invalid names and incorrect parent kinds leave state unchanged', async t => {
  const { directory } = await fixture(t); const store = await openStore(directory); t.after(() => store.close());
  assert.throws(() => store.create('project', null, '  '), { status: 400 });
  assert.throws(() => store.create('constructor', null, 'Name'), { status: 400 });
  const project = store.create('project', null, '<script>literal name</script>');
  assert.throws(() => store.create('discipline', project.id, 'Wrong parent'), { status: 404 });
  assert.equal(store.snapshot().entities.length, 1);
});

test('A002: malformed, oversized and duplicate PDFs do not damage prior drawings', async t => {
  const { directory, bytes } = await fixture(t); const store = await openStore(directory); t.after(() => store.close());
  const discipline = hierarchy(store); const d = await store.importPdf(discipline.id, 'Valid.pdf', bytes);
  await assert.rejects(store.importPdf(discipline.id, 'Not.pdf', Buffer.from('not a PDF')), { status: 422 });
  await assert.rejects(store.importPdf(discipline.id, 'Corrupt.pdf', Buffer.from('%PDF-1.7\ninvalid')), { status: 422 });
  await assert.rejects(store.importPdf(discipline.id, 'Big.pdf', Buffer.alloc(MAX_PDF_BYTES + 1)), { status: 413 });
  await assert.rejects(store.importPdf(discipline.id, 'Duplicate.pdf', bytes), { status: 409 });
  assert.equal(store.snapshot().drawings.length, 1);
  assert.deepEqual(await store.source(d.id), bytes);
});

test('A002: independent disciplines can share a source; deleting one drawing preserves the other', async t => {
  const { directory, bytes } = await fixture(t); const store = await openStore(directory); t.after(() => store.close());
  const first = hierarchy(store), second = hierarchy(store);
  const a = await store.importPdf(first.id, 'A.pdf', bytes), b = await store.importPdf(second.id, 'B.pdf', bytes);
  store.deleteDrawing(a.id);
  assert.throws(() => store.drawing(a.id), { status: 404 });
  assert.deepEqual(await store.source(b.id), bytes);
  assert.equal(store.snapshot().drawings.length, 1);
});

test('source tampering is detected rather than displayed as the approved original', async t => {
  const { directory, bytes } = await fixture(t); const store = await openStore(directory); t.after(() => store.close());
  const discipline = hierarchy(store), d = await store.importPdf(discipline.id, 'A.pdf', bytes);
  await writeFile(join(directory, 'sources', `${d.digest}.pdf`), 'changed');
  await assert.rejects(store.source(d.id), { status: 409 });
});

test('A003: PDF viewport maps known fiducials and inverts zoom/rotation without geometry drift', async t => {
  const { bytes } = await fixture(t);
  const task = getDocument({ data: new Uint8Array(bytes), isEvalSupported: false });
  t.after(() => task.destroy());
  const doc = await task.promise, page = await doc.getPage(1);
  assert.deepEqual(page.getViewport({ scale: 1 }).convertToViewportPoint(100,100), [100,742]);
  assert.deepEqual(page.getViewport({ scale: 1, rotation: 90 }).convertToViewportPoint(100,100), [100,100]);
  for (const scale of [.1,1,2.75,4]) for (const rotation of [0,90,180,270]) {
    const view = page.getViewport({ scale, rotation });
    for (const original of [[100,100],[300,200],[50,400],[350,600]]) {
      const result = view.convertToPdfPoint(...view.convertToViewportPoint(...original));
      assert.ok(result.every((value,i) => Math.abs(value-original[i]) < 1e-8));
      const [vx,vy] = viewPoint(view,...original);
      const click = pagePoint(view,{left:20,top:30,width:view.width*.75,height:view.height*.75},20+vx*.75,30+vy*.75);
      assert.ok(click.every((value,i)=>Math.abs(value-original[i])<1e-8));
    }
  }
});

test('concurrent duplicate imports cannot create double drawing records', async t => {
  const { directory, bytes } = await fixture(t); const store = await openStore(directory); t.after(() => store.close());
  const discipline = hierarchy(store);
  const results = await Promise.allSettled([store.importPdf(discipline.id,'A.pdf',bytes), store.importPdf(discipline.id,'B.pdf',bytes)]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(results.find(r=>r.status==='rejected').reason.status,409);
  assert.equal(store.snapshot().drawings.length,1);
});

test('parser concurrency is bounded and rejected work leaves no drawing', async t => {
  const { directory, bytes } = await fixture(t); const store = await openStore(directory); t.after(() => store.close());
  const discipline = hierarchy(store);
  const results = await Promise.allSettled(['A','B','C'].map(name => store.importPdf(discipline.id, name+'.pdf', bytes)));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.deepEqual(results.filter(r=>r.status==='rejected').map(r=>r.reason.status).sort(),[409,429]);
});

test('local HTTP workflow requires session token, rejects external origins and serves persisted PDF', async t => {
  const { directory, bytes } = await fixture(t); const app = await startApp({ directory, port: 0 }); t.after(() => app.close());
  const url = path => app.origin + path;
  const { token } = await (await fetch(url('/api/session'))).json();
  const post = async (body, extra = {}) => fetch(url('/api/entities'), { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Fire-Token': token, ...extra }, body: JSON.stringify(body) });
  assert.equal((await post({ kind: 'project', name: 'Blocked' }, { 'X-Fire-Token': '' })).status, 403);
  assert.equal((await post({ kind: 'project', name: 'Blocked' }, { Origin: 'https://example.invalid' })).status, 403);
  const project = await (await post({ kind: 'project', name: 'API project' })).json();
  const takeoff = await (await post({ kind: 'takeoff', parentId: project.id, name: 'API takeoff' })).json();
  const discipline = await (await post({ kind: 'discipline', parentId: takeoff.id, name: 'API discipline' })).json();
  const upload = await fetch(url(`/api/disciplines/${discipline.id}/drawings?name=Fixture.pdf`), { method: 'POST', headers: { 'Content-Type': 'application/pdf', 'X-Fire-Token': token }, body: bytes });
  assert.equal(upload.status, 201); const drawing = await upload.json();
  const pdf = await fetch(url(`/api/drawings/${drawing.id}/source`));
  assert.equal(pdf.headers.get('content-type'), 'application/pdf');
  assert.deepEqual(Buffer.from(await pdf.arrayBuffer()), bytes);
  assert.equal((await fetch(url('/.git/config'))).status, 404);
  assert.equal((await fetch(url('/'))).status, 200);
  const noteResponse = await fetch(url(`/api/drawings/${drawing.id}/notes`), { method:'POST',headers:{'Content-Type':'application/json','X-Fire-Token':token},body:JSON.stringify({page:1,x:100,y:100,text:'API note'}) });
  assert.equal(noteResponse.status,201); const note = await noteResponse.json();
  const editResponse = await fetch(url(`/api/notes/${note.id}`),{method:'PATCH',headers:{'Content-Type':'application/json','X-Fire-Token':token},body:JSON.stringify({text:'Updated API note',version:1})});
  assert.equal(editResponse.status,200); assert.equal((await editResponse.json()).version,2);
  assert.equal((await fetch(url(`/api/notes/${note.id}?version=1`),{method:'DELETE',headers:{'X-Fire-Token':token}})).status,409);
  assert.equal((await fetch(url(`/api/notes/${note.id}?version=2`),{method:'DELETE',headers:{'X-Fire-Token':token}})).status,200);
  assert.equal((await fetch(url(`/api/drawings/${drawing.id}`), { method: 'DELETE', headers: { 'X-Fire-Token': token } })).status, 200);
  assert.equal((await fetch(url(`/api/drawings/${drawing.id}/source`))).status, 404);
});

test('A008: notes retain literal text/page coordinates through edit and database reopen', async t => {
  const { directory, bytes } = await fixture(t); let store = await openStore(directory);
  const discipline = hierarchy(store), d = await store.importPdf(discipline.id,'Notes.pdf',bytes);
  const n = store.createNote(d.id,{page:1,x:100,y:200,text:'<script>literal text</script>\nOriginal note'});
  assert.equal(n.version,1);
  assert.equal(n.text,'<script>literal text</script>\nOriginal note');
  const updated = store.updateNote(n.id,'Revised note',1);
  assert.equal(updated.version,2);
  assert.throws(()=>store.updateNote(n.id,'Stale edit',1),{status:409});
  assert.throws(()=>store.deleteNote(n.id,1),{status:409});
  store.close();store=await openStore(directory);t.after(()=>store.close());
  assert.deepEqual(store.snapshot().notes.map(n=>[n.page,n.x,n.y,n.text,n.version]),[[1,100,200,'Revised note',2]]);
  store.deleteNote(n.id,2); assert.equal(store.snapshot().notes.length,0);
});

test('note validation rejects missing pages, invalid coordinates and blank/oversized text', async t => {
  const { directory,bytes } = await fixture(t);const store=await openStore(directory);t.after(()=>store.close());
  const discipline=hierarchy(store), d=await store.importPdf(discipline.id,'A.pdf',bytes);
  for(const invalid of [{page:0},{page:2},{x:NaN},{x:Infinity},{x:'100'},{x:-1},{y:900},{text:' '},{text:'x'.repeat(4001)}]) {
    assert.throws(()=>store.createNote(d.id,{page:1,x:100,y:100,text:'Valid',...invalid}),{status:400});
  }
  assert.equal(store.snapshot().notes.length,0);
  store.createNote(d.id,{page:1,x:100,y:100,text:'Will cascade'});
  store.deleteDrawing(d.id);assert.equal(store.snapshot().notes.length,0);
});

test('A003/A008: rotated cropped page anchors use the actual crop and inverse transform', async t => {
  const { directory } = await fixture(t);
  execFileSync(process.execPath,['scripts/generate-drawing-fixture.mjs',join(directory,'cropped'),'cropped']);
  const bytes = await readFile(join(directory,'cropped','small-vector.pdf'));
  const store=await openStore(directory);t.after(()=>store.close());
  const discipline=hierarchy(store), d=await store.importPdf(discipline.id,'Cropped.pdf',bytes);
  assert.deepEqual(d.pages[0].view,[40,40,440,740]); assert.equal(d.pages[0].rotation,90);
  assert.throws(()=>store.createNote(d.id,{page:1,x:20,y:100,text:'Outside crop'}),{status:400});
  const note=store.createNote(d.id,{page:1,x:100,y:100,text:'Inside crop'});
  const task=getDocument({data:new Uint8Array(bytes),isEvalSupported:false});t.after(()=>task.destroy());
  const doc=await task.promise,page=await doc.getPage(1);
  assert.deepEqual(viewPoint(page.getViewport({scale:1}),100,100),[60,60]);
  for(const scale of [.5,1,3])for(const rotation of [0,90,180,270]) {
    const v=page.getViewport({scale,rotation});const [x,y]=viewPoint(v,note.x,note.y);
    const original=pagePoint(v,{left:8,top:12,width:v.width,height:v.height},x+8,y+12);
    assert.ok(Math.abs(original[0]-100)<1e-8&&Math.abs(original[1]-100)<1e-8);
  }
});

test('schema 1 migrates to schema 2 without losing stored drawings or original bytes', async t => {
  const { directory,bytes } = await fixture(t);let store=await openStore(directory);
  const discipline=hierarchy(store),d=await store.importPdf(discipline.id,'Old workspace.pdf',bytes);store.close();
  const db=new DatabaseSync(join(directory,'projects.sqlite'));db.exec('DROP TABLE notes; UPDATE schema_version SET version=1');db.close();
  store=await openStore(directory);t.after(()=>store.close());
  assert.deepEqual(await store.source(d.id),bytes);
  assert.equal(store.snapshot().entities.length,3);
  const n=store.createNote(d.id,{page:1,x:100,y:100,text:'After migration'});assert.equal(n.version,1);
});

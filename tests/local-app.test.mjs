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
  assert.equal((await fetch(url(`/api/drawings/${drawing.id}`), { method: 'DELETE', headers: { 'X-Fire-Token': token } })).status, 200);
  assert.equal((await fetch(url(`/api/drawings/${drawing.id}/source`))).status, 404);
});

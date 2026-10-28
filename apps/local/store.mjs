import {migrateSelectionMoves} from './selection-moves.mjs';
import {migrateSelectionEdits,migrateSelectionDeletion} from './selection-edits.mjs';
import {migrateCoverage,coverageStore} from './coverage-store.mjs';
import {migrateFloorplans,floorplanStore} from './floorplan-store.mjs';
import {migrateProjects,projectStore} from './project-store.mjs';
import {migrateZones,zoneStore} from './zone-store.mjs';
import {migrateQuantityMultipliers} from './quantity-multipliers.mjs';
import {quantitySchedule} from './zone-allocation.mjs';
import { DatabaseSync } from 'node:sqlite';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { migrateTakeoff,migrateCountExamples,migrateCountMultipliers,takeoffStore } from './takeoff-store.mjs';
const execute = promisify(execFile);
export const MAX_PDF_BYTES = 25 * 1024 * 1024;

export class AppError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
function name(value) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 160) throw new AppError(400, 'Name must contain 1–160 characters');
  return value.trim();
}

export async function openStore(directory) {
  await mkdir(join(directory, 'sources'), { recursive: true });
  await mkdir(join(directory, 'pending'), { recursive: true });
  const db = new DatabaseSync(join(directory, 'projects.sqlite'));
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL);
    INSERT INTO schema_version SELECT 1 WHERE NOT EXISTS (SELECT 1 FROM schema_version);
    CREATE TABLE IF NOT EXISTS entities (
      id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('project','takeoff','discipline')),
      parent_id TEXT REFERENCES entities(id) ON DELETE CASCADE, name TEXT NOT NULL, created TEXT NOT NULL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS drawings (
      id TEXT PRIMARY KEY, discipline_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
      name TEXT NOT NULL, digest TEXT NOT NULL, bytes INTEGER NOT NULL, pages TEXT NOT NULL, created TEXT NOT NULL
    ) STRICT;
    CREATE UNIQUE INDEX IF NOT EXISTS drawing_source_unique ON drawings(discipline_id,digest);`);
  let version = db.prepare('SELECT version FROM schema_version').get().version;
  if (![1,2,3,4,5,6,7,8,9,10,11,12,13,14].includes(version)) { db.close(); throw new Error('Unsupported database schema'); }
  if (version === 1) { db.exec(`BEGIN;
    CREATE TABLE notes (
      id TEXT PRIMARY KEY, drawing_id TEXT NOT NULL REFERENCES drawings(id) ON DELETE CASCADE,
      page INTEGER NOT NULL, x REAL NOT NULL, y REAL NOT NULL, text TEXT NOT NULL,
      version INTEGER NOT NULL, created TEXT NOT NULL, updated TEXT NOT NULL
    ) STRICT;
    UPDATE schema_version SET version=2; COMMIT;`); version=2; }
  if (version === 2) db.exec(`BEGIN;
    CREATE TABLE page_metadata (
      drawing_id TEXT NOT NULL REFERENCES drawings(id) ON DELETE CASCADE,
      number INTEGER NOT NULL, name TEXT NOT NULL, title TEXT NOT NULL,
      version INTEGER NOT NULL, PRIMARY KEY(drawing_id,number)
    ) STRICT;
    INSERT INTO page_metadata SELECT drawings.id, json_extract(value,'$.number'),
      'Page ' || json_extract(value,'$.number'), '', 1 FROM drawings,json_each(drawings.pages);
    UPDATE schema_version SET version=3; COMMIT;`);
  migrateTakeoff(db);
  migrateZones(db);
  migrateCountExamples(db);
  migrateCountMultipliers(db);
  migrateQuantityMultipliers(db);
  migrateProjects(db);
  migrateFloorplans(db);
  migrateCoverage(db);
  migrateSelectionEdits(db);
  migrateSelectionDeletion(db);
  migrateSelectionMoves(db);
  const entity = id => db.prepare('SELECT * FROM entities WHERE id=?').get(id);
  let parsing = 0;
  function requireEntity(id, kind) {
    const found = entity(id);
    if (!found || found.kind !== kind) throw new AppError(404, `${kind} not found`);
    return found;
  }
  function drawing(id) {
    const row = db.prepare('SELECT * FROM drawings WHERE id=?').get(id);
    if (!row) throw new AppError(404, 'Drawing not found');
    return { ...row, pages: JSON.parse(row.pages) };
  }
  function note(id) {
    const found = db.prepare('SELECT * FROM notes WHERE id=?').get(id);
    if (!found) throw new AppError(404, 'Note not found');
    return found;
  }
  function noteText(value) {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > 4000) throw new AppError(400, 'Note must contain 1–4000 characters');
    return value.trim();
  }
  const coverage=coverageStore(db,{AppError});
  const takeoff=takeoffStore(db,{drawing,requireEntity,name,AppError});
  const floorplans=floorplanStore(db,{drawing,AppError});
  const projects=projectStore(db,{requireEntity,name,AppError});
  const zone=zoneStore(db,{drawing,requireEntity,name,AppError});
  return {
    ...takeoff,...zone,...floorplans,updateCoverage:coverage.updateCoverage,updateProject:projects.updateProject,
    close: () => db.close(),
    snapshot: () => {const state={ entities: db.prepare('SELECT * FROM entities ORDER BY created,id').all(),
      drawings: db.prepare('SELECT * FROM drawings ORDER BY created,id').all().map(row => ({ ...row, pages: JSON.parse(row.pages) })),
      notes: db.prepare('SELECT * FROM notes ORDER BY created,id').all(),
      pageMetadata: db.prepare('SELECT * FROM page_metadata ORDER BY drawing_id,number').all(),...takeoff.snapshot(),...zone.zoneSnapshot(),...projects.projectSnapshot(),...floorplans.floorplanSnapshot(),...coverage.coverageSnapshot() };return {...state,quantitySchedule:quantitySchedule(state)};},
    create(kind, parentId, value, metadata={}) {
      const expectedParent = { project: null, takeoff: 'project', discipline: 'takeoff' };
      if (!Object.hasOwn(expectedParent, kind)) throw new AppError(400, 'Invalid entity type');
      if (expectedParent[kind]) requireEntity(parentId, expectedParent[kind]);
      else if (parentId != null) throw new AppError(400, 'Projects cannot have a parent');
      const row = { id: randomUUID(), kind, parent_id: parentId ?? null, name: name(value), created: new Date().toISOString() };
      const fields=kind==='project'?projects.validateProject(metadata):null;
      db.exec('BEGIN');
      try{db.prepare('INSERT INTO entities VALUES (?,?,?,?,?)').run(row.id, row.kind, row.parent_id, row.name, row.created);if(fields)projects.insertProjectMetadata(row.id,fields);db.exec('COMMIT');}
      catch(error){db.exec('ROLLBACK');throw error;}
      return row;
    },
    async importPdf(disciplineId, filename, bytes) {
      requireEntity(disciplineId, 'discipline');
      const cleanName = name(filename);
      if (parsing >= 2) throw new AppError(429, 'Two PDFs are importing. Try again when one finishes.');
      if (!Buffer.isBuffer(bytes) || bytes.length === 0 || bytes.length > MAX_PDF_BYTES) throw new AppError(413, 'PDF must be between 1 byte and 25 MiB');
      if (!bytes.subarray(0,1024).includes(Buffer.from('%PDF-'))) throw new AppError(422, 'File is not a PDF');
      const pending = join(directory, 'pending', randomUUID());
      let metadata;
      parsing++;
      try {
        await writeFile(pending, bytes, { flag: 'wx', mode: 0o600 });
        const result = await execute(process.execPath, ['--max-old-space-size=256', new URL('./pdf-inspect.mjs', import.meta.url).pathname, pending],
          { timeout: 20000, maxBuffer: 1024 * 1024 });
        metadata = JSON.parse(result.stdout);
      } catch {
        throw new AppError(422, 'Unable to import PDF: invalid, encrypted, too complex or over 200 pages');
      } finally { parsing--; await unlink(pending).catch(() => {}); }
      if (!metadata.pages?.length || metadata.pages.some(p => p.view.some(v => !Number.isFinite(v)) || p.view[2] <= p.view[0] || p.view[3] <= p.view[1])) throw new AppError(422, 'Invalid page geometry');
      // Revalidate after asynchronous parsing: the parent may have been removed.
      requireEntity(disciplineId, 'discipline');
      const digest = createHash('sha256').update(bytes).digest('hex');
      const existing = db.prepare('SELECT id FROM drawings WHERE discipline_id=? AND digest=?').get(disciplineId, digest);
      if (existing) throw new AppError(409, 'This PDF is already in this discipline');
      const finalPath = join(directory, 'sources', `${digest}.pdf`);
      try { await writeFile(finalPath, bytes, { flag: 'wx', mode: 0o600 }); }
      catch (error) { if (error.code !== 'EEXIST') throw error; }
      const id = randomUUID();
      db.exec('BEGIN');
      try {
        db.prepare('INSERT INTO drawings VALUES (?,?,?,?,?,?,?)').run(id, disciplineId, cleanName, digest, bytes.length, JSON.stringify(metadata.pages), new Date().toISOString());
        const addPage=db.prepare('INSERT INTO page_metadata VALUES (?,?,?,?,?)');
        for(const page of metadata.pages) addPage.run(id,page.number,`Page ${page.number}`,'',1);
        db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); if (error.code === 'ERR_SQLITE_ERROR' && error.message.includes('UNIQUE')) throw new AppError(409, 'This PDF is already in this discipline'); throw error; }
      return drawing(id);
    },
    drawing,
    updatePage(drawingId, number, { name: value, title, version } = {}) {
      drawing(drawingId);
      if (!Number.isInteger(number)) throw new AppError(400,'Invalid page number');
      const page=db.prepare('SELECT * FROM page_metadata WHERE drawing_id=? AND number=?').get(drawingId,number);
      if (!page) throw new AppError(404,'Page not found');
      if (!Number.isInteger(version) || version !== page.version) throw new AppError(409,'This page changed. Reload before editing.');
      if (typeof title !== 'string' || title.length>500) throw new AppError(400,'Title must contain at most 500 characters');
      db.prepare('UPDATE page_metadata SET name=?,title=?,version=version+1 WHERE drawing_id=? AND number=? AND version=?').run(name(value),title.trim(),drawingId,number,version);
      return db.prepare('SELECT * FROM page_metadata WHERE drawing_id=? AND number=?').get(drawingId,number);
    },
    createNote(drawingId, { page, x, y, text } = {}) {
      const d = drawing(drawingId);
      if (!Number.isInteger(page) || page < 1 || page > d.pages.length) throw new AppError(400, 'Invalid note page');
      const [left,bottom,right,top] = d.pages[page-1].view;
      if (![x,y].every(v=>typeof v === 'number' && Number.isFinite(v)) || x < left || x > right || y < bottom || y > top) throw new AppError(400, 'Note position must be inside the page crop box');
      const id = randomUUID(), now = new Date().toISOString();
      db.prepare('INSERT INTO notes VALUES (?,?,?,?,?,?,?,?,?)').run(id,drawingId,page,x,y,noteText(text),1,now,now);
      return note(id);
    },
    updateNote(id, text, version) {
      const current = note(id);
      if (!Number.isInteger(version) || version !== current.version) throw new AppError(409, 'This note changed. Reload it before editing.');
      db.prepare('UPDATE notes SET text=?,version=version+1,updated=? WHERE id=? AND version=?').run(noteText(text),new Date().toISOString(),id,version);
      return note(id);
    },
    deleteNote(id, version) {
      const current = note(id);
      if (!Number.isInteger(version) || version !== current.version) throw new AppError(409, 'This note changed. Reload it before removing.');
      db.prepare('DELETE FROM notes WHERE id=? AND version=?').run(id,version);
    },
    async source(id) {
      const row = drawing(id);
      const bytes = await readFile(join(directory, 'sources', `${row.digest}.pdf`)).catch(() => { throw new AppError(410, 'Source PDF is missing'); });
      if (createHash('sha256').update(bytes).digest('hex') !== row.digest) throw new AppError(409, 'Source integrity check failed');
      return bytes;
    },
    deleteDrawing(id) {
      drawing(id);
      db.exec('BEGIN');
      try{floorplans.removeDrawingFromFloorplans(id);db.prepare('DELETE FROM drawings WHERE id=?').run(id);db.exec('COMMIT');}
      catch(error){db.exec('ROLLBACK');throw error;}
      // Immutable source retained for later explicit retention/backup policy.
    },
  };
}

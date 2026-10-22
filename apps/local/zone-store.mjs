import {randomUUID} from 'node:crypto';
import {validateGeometry} from './web/takeoff-geometry.mjs';
export function migrateZones(db){if(db.prepare('SELECT version FROM schema_version').get().version!==4)return;db.exec(`BEGIN;
CREATE TABLE IF NOT EXISTS zone_headings(id TEXT PRIMARY KEY,discipline_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,name TEXT NOT NULL,position INTEGER NOT NULL,version INTEGER NOT NULL) STRICT;
CREATE TABLE IF NOT EXISTS zones(id TEXT PRIMARY KEY,heading_id TEXT NOT NULL REFERENCES zone_headings(id) ON DELETE CASCADE,drawing_id TEXT NOT NULL REFERENCES drawings(id) ON DELETE CASCADE,page INTEGER NOT NULL,points TEXT NOT NULL,version INTEGER NOT NULL) STRICT;
UPDATE schema_version SET version=5;COMMIT;`);}
export function zoneStore(db,{drawing,requireEntity,name,AppError}){
 const fail=(s,status=400)=>{throw new AppError(status,s);};
 const heading=id=>{const h=db.prepare('SELECT * FROM zone_headings WHERE id=?').get(id);if(!h)fail('Zone heading not found',404);return h;};
 const outline=id=>{const z=db.prepare('SELECT * FROM zones WHERE id=?').get(id);if(!z)fail('Zone not found',404);return z;};
 function validate(h,drawingId,page,points){const d=drawing(drawingId);if(d.discipline_id!==h.discipline_id)fail('Zone heading belongs to another discipline');if(!Number.isInteger(page)||page<1||page>d.pages.length)fail('Invalid drawing page');if(!Array.isArray(points)||points.length>200)fail('Zone needs at most 200 vertices');try{validateGeometry('area',points,d.pages[page-1].view);}catch(e){fail(e.message);}}
 return {
 zoneSnapshot(){return {zoneHeadings:db.prepare('SELECT * FROM zone_headings ORDER BY position,id').all(),zones:db.prepare('SELECT * FROM zones ORDER BY rowid').all().map(z=>({...z,points:JSON.parse(z.points)}))};},
 createZoneHeading(disciplineId,{name:value}={}){requireEntity(disciplineId,'discipline');const all=db.prepare('SELECT * FROM zone_headings WHERE discipline_id=?').all(disciplineId);if(all.length>=100)fail('At most 100 zone headings per discipline');const label=name(value);if(all.some(h=>h.name.toLowerCase()===label.toLowerCase()))fail('Zone name already exists',409);const h={id:randomUUID(),discipline_id:disciplineId,name:label,position:all.reduce((m,h)=>Math.max(m,h.position+1),0),version:1};db.prepare('INSERT INTO zone_headings VALUES (?,?,?,?,?)').run(h.id,h.discipline_id,h.name,h.position,h.version);return h;},
 reorderZoneHeadings(disciplineId,order){requireEntity(disciplineId,'discipline');const all=db.prepare('SELECT * FROM zone_headings WHERE discipline_id=?').all(disciplineId);if(!Array.isArray(order)||order.length!==all.length||new Set(order.map(h=>h.id)).size!==all.length||order.some(h=>!all.some(a=>a.id===h.id&&a.version===h.version)))fail('Zone order changed. Reload before editing.',409);db.exec('BEGIN');try{order.forEach((h,i)=>db.prepare('UPDATE zone_headings SET position=?,version=version+1 WHERE id=?').run(i,h.id));db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}return {updated:true};},
 deleteZoneHeading(id,version){const h=heading(id);if(version!==h.version)fail('Zone heading changed',409);db.prepare('DELETE FROM zone_headings WHERE id=?').run(id);},
 createZone(drawingId,{heading_id,page,points}={}){const h=heading(heading_id);validate(h,drawingId,page,points);if(db.prepare('SELECT count(*) AS n FROM zones WHERE drawing_id=? AND page=?').get(drawingId,page).n>=100)fail('At most 100 zones per page');const id=randomUUID();db.prepare('INSERT INTO zones VALUES (?,?,?,?,?,?)').run(id,h.id,drawingId,page,JSON.stringify(points),1);return {id};},
 updateZone(id,{points,version}={}){const z=outline(id);if(version!==z.version)fail('Zone changed. Reload before editing.',409);validate(heading(z.heading_id),z.drawing_id,z.page,points);db.prepare('UPDATE zones SET points=?,version=version+1 WHERE id=?').run(JSON.stringify(points),id);return {id,version:version+1};},
 deleteZone(id,version){const z=outline(id);if(version!==z.version)fail('Zone changed',409);db.prepare('DELETE FROM zones WHERE id=?').run(id);},
 };
}

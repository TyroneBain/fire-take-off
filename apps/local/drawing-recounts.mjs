import {randomUUID} from 'node:crypto';
export function migrateDrawingRecounts(db){
 if(db.prepare('SELECT version FROM schema_version').get().version!==15)return;
 db.exec(`BEGIN;CREATE TABLE IF NOT EXISTS count_drawing_recounts(id TEXT PRIMARY KEY,discipline_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,drawing_id TEXT NOT NULL,previous TEXT NOT NULL,current TEXT NOT NULL,created TEXT NOT NULL) STRICT;UPDATE schema_version SET version=16;COMMIT`);
}
export function drawingRecounts(db,{drawing,item,exampleJSON,validateMark,insertMark,fail}){
 return {
  recountDrawing(drawingId,{digest,selections,expected_marks}={}){
   const target=drawing(drawingId);if(target.digest!==digest)fail('Drawing changed. Reload before recounting.',409);if(target.pages.length>20)fail('Recount supports at most 20 pages');
   const saved=db.prepare('SELECT e.* FROM count_examples e JOIN count_items i ON i.id=e.item_id WHERE i.discipline_id=? ORDER BY e.created,e.id').all(target.discipline_id);
   if(!saved.length)fail('Save a symbol selection in this discipline first');if(saved.length>50)fail('Recount supports at most 50 saved selections');
   if(!Array.isArray(selections)||selections.length!==saved.length||selections.some(s=>!s||typeof s.id!=='string')||new Set(selections.map(s=>s.id)).size!==selections.length)fail('Selections changed. Reload before recounting.',409);
   const inputs=new Map(selections.map(s=>[s.id,s]));let total=0;
   for(const e of saved){const request=inputs.get(e.id),heading=item(e.item_id),source=JSON.parse(e.example);if(!request||request.version!==e.version||request.item_version!==heading.version)fail('Selection or heading changed. Reload before recounting.',409);exampleJSON(target.discipline_id,source);if(source.algorithm==='binary-elements-1')fail('Re-edit legacy cleaned selections before recounting');
    if(!Array.isArray(request.matches)||request.matches.length>5000)fail('Invalid recount results');total+=request.matches.length;if(total>5000)fail('Recount supports at most 5000 results');for(const m of request.matches){validateMark(target.discipline_id,m,'automatic');if(m.drawing_id!==target.id)fail('Recount result outside target drawing');}
   }
   if(!Array.isArray(expected_marks)||expected_marks.some(m=>!m||typeof m.id!=='string'||!Number.isInteger(m.version)))fail('Complete target match snapshot required');
   const previous=db.prepare('SELECT * FROM count_marks WHERE drawing_id=? ORDER BY id').all(target.id),expected=new Map(expected_marks.map(m=>[m.id,m.version]));if(expected.size!==expected_marks.length||expected.size!==previous.length||previous.some(m=>expected.get(m.id)!==m.version))fail('Drawing matches changed. Reload before recounting.',409);
   const near=(a,b)=>a.page===b.page&&Math.abs(a.x-b.x)<.5&&Math.abs(a.y-b.y)<.5;
   const obsolete=previous.filter(m=>{const e=saved.find(e=>e.id===m.example_id);return e&&m.origin==='automatic'&&!m.reviewed&&m.included&&m.item_id===e.item_id&&!inputs.get(e.id).matches.some(n=>near(m,n));});
   const id=randomUUID(),added=[],results=[];db.exec('BEGIN');
   try{
    for(const m of obsolete)db.prepare('DELETE FROM count_marks WHERE id=?').run(m.id);
    for(const e of saved){let count=0,skipped=0;for(const m of inputs.get(e.id).matches){const exists=db.prepare('SELECT id FROM count_marks WHERE (item_id=? OR original_item_id=? OR example_id=?) AND drawing_id=? AND page=? AND abs(x-?)<0.5 AND abs(y-?)<0.5').get(e.item_id,e.item_id,e.id,target.id,m.page,m.x,m.y);if(exists){skipped++;continue;}const mark=insertMark(e.item_id,target.discipline_id,m,'automatic',e.id);added.push(mark.id);count++;}results.push({example_id:e.id,item_id:e.item_id,added:count,skipped});}
    const current={target:{id:target.id,name:target.name,digest:target.digest},selections:saved.map(e=>({...e,example:JSON.parse(e.example),heading:item(e.item_id).name})),results,added,removed:obsolete.map(m=>m.id),retained_corrections:previous.filter(m=>!obsolete.includes(m)&&(m.reviewed||!m.included||m.origin==='manual'||saved.some(e=>e.id===m.example_id&&e.item_id!==m.item_id))).map(m=>m.id)};
    db.prepare('INSERT INTO count_drawing_recounts VALUES (?,?,?,?,?,?)').run(id,target.discipline_id,target.id,JSON.stringify({marks:previous}),JSON.stringify(current),new Date().toISOString());db.exec('COMMIT');return {id,added:added.length,removed:obsolete.length,skipped:results.reduce((n,r)=>n+r.skipped,0),selections:results.length};
   }catch(error){db.exec('ROLLBACK');throw error;}
  }
 };
}

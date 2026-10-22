import { randomUUID } from 'node:crypto';
import { validateGeometry,pathLength,unitMetres,quantity } from './web/takeoff-geometry.mjs';
export function migrateTakeoff(db) {
  if(db.prepare('SELECT version FROM schema_version').get().version!==3)return;
  db.exec(`BEGIN;
    CREATE TABLE IF NOT EXISTS count_items(id TEXT PRIMARY KEY,discipline_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,name TEXT NOT NULL,color TEXT NOT NULL,example TEXT,created TEXT NOT NULL) STRICT;
    CREATE TABLE IF NOT EXISTS count_marks(id TEXT PRIMARY KEY,item_id TEXT NOT NULL REFERENCES count_items(id) ON DELETE CASCADE,drawing_id TEXT NOT NULL REFERENCES drawings(id) ON DELETE CASCADE,page INTEGER NOT NULL,x REAL NOT NULL,y REAL NOT NULL,score REAL NOT NULL,origin TEXT NOT NULL,included INTEGER NOT NULL,reviewed INTEGER NOT NULL,version INTEGER NOT NULL,created TEXT NOT NULL) STRICT;
    CREATE TABLE IF NOT EXISTS count_events(id TEXT PRIMARY KEY,mark_id TEXT NOT NULL REFERENCES count_marks(id) ON DELETE CASCADE,action TEXT NOT NULL,previous TEXT NOT NULL,current TEXT NOT NULL,created TEXT NOT NULL) STRICT;
    CREATE TABLE IF NOT EXISTS calibrations(drawing_id TEXT NOT NULL REFERENCES drawings(id) ON DELETE CASCADE,page INTEGER NOT NULL,points TEXT NOT NULL,distance REAL NOT NULL,unit TEXT NOT NULL,metres_per_point REAL NOT NULL,version INTEGER NOT NULL,PRIMARY KEY(drawing_id,page)) STRICT;
    CREATE TABLE IF NOT EXISTS measurements(id TEXT PRIMARY KEY,drawing_id TEXT NOT NULL REFERENCES drawings(id) ON DELETE CASCADE,page INTEGER NOT NULL,name TEXT NOT NULL,kind TEXT NOT NULL,points TEXT NOT NULL,version INTEGER NOT NULL,created TEXT NOT NULL) STRICT;
    UPDATE schema_version SET version=4;COMMIT;`);
}
export function migrateCountExamples(db) {
  if(db.prepare('SELECT version FROM schema_version').get().version!==5)return;
  db.exec('BEGIN');
  try {
    if(!db.prepare('PRAGMA table_info(count_items)').all().some(c=>c.name==='version'))db.exec('ALTER TABLE count_items ADD COLUMN version INTEGER NOT NULL DEFAULT 1');
    if(!db.prepare('PRAGMA table_info(count_marks)').all().some(c=>c.name==='original_item_id'))db.exec('ALTER TABLE count_marks ADD COLUMN original_item_id TEXT REFERENCES count_items(id)');
    db.exec(`UPDATE count_marks SET original_item_id=item_id WHERE original_item_id IS NULL;
      CREATE TABLE IF NOT EXISTS count_examples(id TEXT PRIMARY KEY,item_id TEXT NOT NULL REFERENCES count_items(id) ON DELETE CASCADE,example TEXT NOT NULL,created TEXT NOT NULL,UNIQUE(item_id,example)) STRICT;`);
    for(const i of db.prepare('SELECT * FROM count_items WHERE example IS NOT NULL').all())db.prepare('INSERT OR IGNORE INTO count_examples VALUES (?,?,?,?)').run(randomUUID(),i.id,i.example,i.created);
    db.exec('UPDATE schema_version SET version=6; COMMIT');
  } catch(error) {db.exec('ROLLBACK');throw error;}
}
export function takeoffStore(db,{drawing,requireEntity,name,AppError}) {
  function fail(message,status=400){throw new AppError(status,message);}
  function item(id){const row=db.prepare('SELECT * FROM count_items WHERE id=?').get(id);if(!row)fail('Count item not found',404);return row;}
  function mark(id){const row=db.prepare('SELECT * FROM count_marks WHERE id=?').get(id);if(!row)fail('Match not found',404);return row;}
  function geometry(drawingId,page,kind,points) {
    const d=drawing(drawingId);if(!Number.isInteger(page)||page<1||page>d.pages.length)fail('Invalid drawing page');
    try{validateGeometry(kind,points,d.pages[page-1].view);}catch(error){fail(error.message);}
    return d;
  }
  function validateMark(disciplineId,m,origin) {
    if(!m||typeof m!=='object')fail('Invalid match');
    const d=geometry(m.drawing_id,m.page,'point',[[m.x,m.y]]);
    if(d.discipline_id!==disciplineId)fail('Count scope does not include this drawing');
    if(origin==='automatic'&&(m.digest!==d.digest||!Number.isFinite(m.score)||m.score<0||m.score>1))fail('Invalid or stale matching source');
    return d;
  }
  function exampleJSON(disciplineId,example) {
    if(!example||!Array.isArray(example.bounds)||example.bounds.length!==4||!(example.bounds[2]>example.bounds[0])||!(example.bounds[3]>example.bounds[1]))fail('Invalid example rectangle');
    const d=geometry(example.drawing_id,example.page,'length',[[example.bounds[0],example.bounds[1]],[example.bounds[2],example.bounds[3]]]);
    if(d.discipline_id!==disciplineId||d.digest!==example.digest||example.algorithm!=='binary-overlap-1')fail('Invalid matching example');
    return JSON.stringify({drawing_id:d.id,page:example.page,bounds:example.bounds,digest:d.digest,algorithm:example.algorithm});
  }
  function insertMark(itemId,disciplineId,m,origin) {
    const d=validateMark(disciplineId,m,origin);
    if(db.prepare('SELECT id FROM count_marks WHERE item_id=? AND drawing_id=? AND page=? AND abs(x-?)<0.5 AND abs(y-?)<0.5').get(itemId,d.id,m.page,m.x,m.y))fail('This location is already counted for this item',409);
    const id=randomUUID();db.prepare('INSERT INTO count_marks (id,item_id,drawing_id,page,x,y,score,origin,included,reviewed,version,created,original_item_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id,itemId,d.id,m.page,m.x,m.y,origin==='manual'?1:m.score,origin,1,origin==='manual'?1:0,1,new Date().toISOString(),itemId);return mark(id);
  }
  function updateMark(id,{included,reviewed,version,item_id:destination}={}) {
    const old=mark(id);if(version!==old.version)fail('Match changed. Reload before reviewing.',409);
    if(typeof included!=='boolean'||reviewed!==true)fail('Explicit inclusion and review decision required');
    const target=destination===undefined?old.item_id:destination;
    if(typeof target!=='string')fail('Invalid destination heading');
    if(item(target).discipline_id!==drawing(old.drawing_id).discipline_id)fail('Destination heading belongs to another discipline');
    if(target!==old.item_id&&db.prepare('SELECT id FROM count_marks WHERE item_id=? AND drawing_id=? AND page=? AND abs(x-?)<0.5 AND abs(y-?)<0.5 AND id<>?').get(target,old.drawing_id,old.page,old.x,old.y,id))fail('Destination already has a match at this location',409);
    db.exec('SAVEPOINT match_decision');
    try {
      db.prepare('UPDATE count_marks SET item_id=?,included=?,reviewed=1,version=version+1 WHERE id=?').run(target,included?1:0,id);
      const updated=mark(id);db.prepare('INSERT INTO count_events VALUES (?,?,?,?,?,?)').run(randomUUID(),id,target!==old.item_id?'reclassify':included?'include':'exclude',JSON.stringify(old),JSON.stringify(updated),new Date().toISOString());
      db.exec('RELEASE match_decision');return updated;
    } catch(error) {db.exec('ROLLBACK TO match_decision; RELEASE match_decision');throw error;}
  }
  return {
    snapshot(){
      const calibrations=db.prepare('SELECT * FROM calibrations ORDER BY drawing_id,page').all().map(c=>({...c,points:JSON.parse(c.points)}));
      return {countItems:db.prepare('SELECT * FROM count_items ORDER BY created,id').all().map(i=>({...i,example:i.example?JSON.parse(i.example):null})),
        countExamples:db.prepare('SELECT * FROM count_examples ORDER BY created,id').all().map(e=>({...e,example:JSON.parse(e.example)})),
        countMarks:db.prepare('SELECT * FROM count_marks ORDER BY created,id').all(),calibrations,
        countEvents:db.prepare('SELECT * FROM count_events ORDER BY rowid').all().map(e=>({...e,previous:JSON.parse(e.previous),current:JSON.parse(e.current)})),
        measurements:db.prepare('SELECT * FROM measurements ORDER BY created,id').all().map(m=>{const points=JSON.parse(m.points),c=calibrations.find(c=>c.drawing_id===m.drawing_id&&c.page===m.page);return {...m,points,quantity:quantity(m.kind,points,c?.metres_per_point)};})};
    },
    createCount(disciplineId,{name:value,color='#168a90',example=null,matches=[]}={}){
      requireEntity(disciplineId,'discipline');const label=name(value);
      if(!/^#[0-9a-f]{6}$/i.test(color))fail('Invalid item colour');
      if(!Array.isArray(matches)||matches.length>5000)fail('Too many match results');
      const encoded=example?exampleJSON(disciplineId,example):null;
      if(!example&&matches.length)fail('Automatic results require a source example');
      const id=randomUUID();db.exec('BEGIN');
      try{const created=new Date().toISOString();db.prepare('INSERT INTO count_items (id,discipline_id,name,color,example,created) VALUES (?,?,?,?,?,?)').run(id,disciplineId,label,color,encoded,created);if(encoded)db.prepare('INSERT INTO count_examples VALUES (?,?,?,?)').run(randomUUID(),id,encoded,created);for(const m of matches)insertMark(id,disciplineId,m,'automatic');db.exec('COMMIT');}
      catch(error){db.exec('ROLLBACK');throw error;}
      return item(id);
    },
    addCountExample(itemId,{version,example,matches}={}) {
      const i=item(itemId);if(version!==i.version)fail('Heading changed. Reload before adding an example.',409);
      const encoded=exampleJSON(i.discipline_id,example);
      if(!Array.isArray(matches)||matches.length>5000)fail('Invalid match results');
      let saved=db.prepare('SELECT * FROM count_examples WHERE item_id=? AND example=?').get(itemId,encoded);
      if(!saved&&db.prepare('SELECT count(*) AS n FROM count_examples WHERE item_id=?').get(itemId).n>=50)fail('Limit of 50 examples per heading reached');
      let added=0,skipped=0;const isNew=!saved;
      db.exec('BEGIN');
      try {
        if(!saved){saved={id:randomUUID()};db.prepare('INSERT INTO count_examples VALUES (?,?,?,?)').run(saved.id,itemId,encoded,new Date().toISOString());}
        for(const m of matches){
          validateMark(i.discipline_id,m,'automatic');
          const exists=db.prepare('SELECT id FROM count_marks WHERE (item_id=? OR original_item_id=?) AND drawing_id=? AND page=? AND abs(x-?)<0.5 AND abs(y-?)<0.5').get(itemId,itemId,m.drawing_id,m.page,m.x,m.y);
          if(exists){skipped++;continue;}insertMark(itemId,i.discipline_id,m,'automatic');added++;
        }
        if(isNew||added)db.prepare('UPDATE count_items SET example=coalesce(example,?),version=version+1 WHERE id=?').run(encoded,itemId);
        db.exec('COMMIT');
      }catch(error){db.exec('ROLLBACK');throw error;}
      return {item:item(itemId),example_id:saved.id,added,skipped};
    },
    updateCountItem(itemId,{name:value,color,version}={}) {
      const i=item(itemId);if(version!==i.version)fail('Heading changed. Reload before editing.',409);
      const label=name(value);if(typeof color!=='string'||!/^#[0-9a-f]{6}$/i.test(color))fail('Invalid item colour');
      db.prepare('UPDATE count_items SET name=?,color=?,version=version+1 WHERE id=?').run(label,color,itemId);return item(itemId);
    },
    addManualMark(itemId,data){const i=item(itemId);return insertMark(itemId,i.discipline_id,data,'manual');},
    updateMark,
    reviewMarks(itemId,decisions){item(itemId);if(!Array.isArray(decisions)||decisions.length>5000)fail('Invalid review batch');
      db.exec('BEGIN');try{for(const decision of decisions){if(mark(decision.id).item_id!==itemId)fail('Match belongs to another item');updateMark(decision.id,decision);}db.exec('COMMIT');}catch(error){db.exec('ROLLBACK');throw error;}return {reviewed:decisions.length};},
    events(itemId){item(itemId);return db.prepare("SELECT e.* FROM count_events e JOIN count_marks m ON m.id=e.mark_id WHERE m.item_id=? OR m.original_item_id=? OR json_extract(e.previous,'$.item_id')=? OR json_extract(e.current,'$.item_id')=? ORDER BY e.rowid").all(itemId,itemId,itemId,itemId).map(e=>({...e,previous:JSON.parse(e.previous),current:JSON.parse(e.current)}));},
    calibrate(drawingId,{page,points,distance,unit,version}={}){
      geometry(drawingId,page,'length',points);
      if(points.length!==2||typeof distance!=='number'||!Number.isFinite(distance)||distance<=0||distance>1e9||!Object.hasOwn(unitMetres,unit))fail('Calibration requires two points, a positive distance and supported units');
      const previous=db.prepare('SELECT * FROM calibrations WHERE drawing_id=? AND page=?').get(drawingId,page);
      if(version!==(previous?.version||0))fail('Calibration changed. Reload before editing.',409);
      const ratio=distance*unitMetres[unit]/pathLength(points);
      db.prepare('INSERT INTO calibrations VALUES (?,?,?,?,?,?,?) ON CONFLICT(drawing_id,page) DO UPDATE SET points=excluded.points,distance=excluded.distance,unit=excluded.unit,metres_per_point=excluded.metres_per_point,version=excluded.version').run(drawingId,page,JSON.stringify(points),distance,unit,ratio,(previous?.version||0)+1);
      return {metres_per_point:ratio,version:(previous?.version||0)+1};
    },
    createMeasure(drawingId,{page,kind,points,name:value}={}){
      geometry(drawingId,page,kind,points);const id=randomUUID();
      db.prepare('INSERT INTO measurements VALUES (?,?,?,?,?,?,?,?)').run(id,drawingId,page,name(value),kind,JSON.stringify(points),1,new Date().toISOString());return {id};
    },
    deleteMeasure(id,version){const m=db.prepare('SELECT * FROM measurements WHERE id=?').get(id);if(!m)fail('Measurement not found',404);if(version!==m.version)fail('Measurement changed',409);db.prepare('DELETE FROM measurements WHERE id=?').run(id);},
  };
}

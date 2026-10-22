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
export function takeoffStore(db,{drawing,requireEntity,name,AppError}) {
  function fail(message,status=400){throw new AppError(status,message);}
  function item(id){const row=db.prepare('SELECT * FROM count_items WHERE id=?').get(id);if(!row)fail('Count item not found',404);return row;}
  function mark(id){const row=db.prepare('SELECT * FROM count_marks WHERE id=?').get(id);if(!row)fail('Match not found',404);return row;}
  function geometry(drawingId,page,kind,points) {
    const d=drawing(drawingId);if(!Number.isInteger(page)||page<1||page>d.pages.length)fail('Invalid drawing page');
    try{validateGeometry(kind,points,d.pages[page-1].view);}catch(error){fail(error.message);}
    return d;
  }
  function insertMark(itemId,disciplineId,m,origin) {
    const d=geometry(m.drawing_id,m.page,'point',[[m.x,m.y]]);
    if(d.discipline_id!==disciplineId)fail('Count scope does not include this drawing');
    if(origin==='automatic'&&(m.digest!==d.digest||!Number.isFinite(m.score)||m.score<0||m.score>1))fail('Invalid or stale matching source');
    if(db.prepare('SELECT id FROM count_marks WHERE item_id=? AND drawing_id=? AND page=? AND abs(x-?)<0.5 AND abs(y-?)<0.5').get(itemId,d.id,m.page,m.x,m.y))fail('This location is already counted for this item',409);
    const id=randomUUID();db.prepare('INSERT INTO count_marks VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(id,itemId,d.id,m.page,m.x,m.y,origin==='manual'?1:m.score,origin,1,origin==='manual'?1:0,1,new Date().toISOString());return mark(id);
  }
  function updateMark(id,{included,reviewed,version}) {
    const old=mark(id);if(version!==old.version)fail('Match changed. Reload before reviewing.',409);
    if(typeof included!=='boolean'||reviewed!==true)fail('Explicit inclusion and review decision required');
    db.prepare('UPDATE count_marks SET included=?,reviewed=1,version=version+1 WHERE id=?').run(included?1:0,id);
    const updated=mark(id);db.prepare('INSERT INTO count_events VALUES (?,?,?,?,?,?)').run(randomUUID(),id,included?'include':'exclude',JSON.stringify(old),JSON.stringify(updated),new Date().toISOString());return updated;
  }
  return {
    snapshot(){
      const calibrations=db.prepare('SELECT * FROM calibrations ORDER BY drawing_id,page').all().map(c=>({...c,points:JSON.parse(c.points)}));
      return {countItems:db.prepare('SELECT * FROM count_items ORDER BY created,id').all().map(i=>({...i,example:i.example?JSON.parse(i.example):null})),
        countMarks:db.prepare('SELECT * FROM count_marks ORDER BY created,id').all(),calibrations,
        countEvents:db.prepare('SELECT * FROM count_events ORDER BY rowid').all().map(e=>({...e,previous:JSON.parse(e.previous),current:JSON.parse(e.current)})),
        measurements:db.prepare('SELECT * FROM measurements ORDER BY created,id').all().map(m=>{const points=JSON.parse(m.points),c=calibrations.find(c=>c.drawing_id===m.drawing_id&&c.page===m.page);return {...m,points,quantity:quantity(m.kind,points,c?.metres_per_point)};})};
    },
    createCount(disciplineId,{name:value,color='#168a90',example=null,matches=[]}={}){
      requireEntity(disciplineId,'discipline');const label=name(value);
      if(!/^#[0-9a-f]{6}$/i.test(color))fail('Invalid item colour');
      if(!Array.isArray(matches)||matches.length>5000)fail('Too many match results');
      if(example){if(!Array.isArray(example.bounds)||example.bounds.length!==4||!(example.bounds[2]>example.bounds[0])||!(example.bounds[3]>example.bounds[1]))fail('Invalid example rectangle');const d=geometry(example.drawing_id,example.page,'length',[[example.bounds?.[0],example.bounds?.[1]],[example.bounds?.[2],example.bounds?.[3]]]);if(d.discipline_id!==disciplineId||d.digest!==example.digest||example.algorithm!=='binary-overlap-1')fail('Invalid matching example');}
      else if(matches.length)fail('Automatic results require a source example');
      const id=randomUUID();db.exec('BEGIN');
      try{db.prepare('INSERT INTO count_items VALUES (?,?,?,?,?,?)').run(id,disciplineId,label,color,example?JSON.stringify(example):null,new Date().toISOString());for(const m of matches)insertMark(id,disciplineId,m,'automatic');db.exec('COMMIT');}
      catch(error){db.exec('ROLLBACK');throw error;}
      return item(id);
    },
    addManualMark(itemId,data){const i=item(itemId);return insertMark(itemId,i.discipline_id,data,'manual');},
    updateMark,
    reviewMarks(itemId,decisions){item(itemId);if(!Array.isArray(decisions)||decisions.length>5000)fail('Invalid review batch');
      db.exec('BEGIN');try{for(const decision of decisions){if(mark(decision.id).item_id!==itemId)fail('Match belongs to another item');updateMark(decision.id,decision);}db.exec('COMMIT');}catch(error){db.exec('ROLLBACK');throw error;}return {reviewed:decisions.length};},
    events(itemId){item(itemId);return db.prepare('SELECT e.* FROM count_events e JOIN count_marks m ON m.id=e.mark_id WHERE m.item_id=? ORDER BY e.rowid').all(itemId).map(e=>({...e,previous:JSON.parse(e.previous),current:JSON.parse(e.current)}));},
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

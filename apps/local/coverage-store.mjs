import {randomUUID} from 'node:crypto';
export function migrateCoverage(db){
 if(db.prepare('SELECT version FROM schema_version').get().version!==10)return;
 db.exec('BEGIN');
 try{
  for(const table of ['count_items','measurements'])if(!db.prepare(`PRAGMA table_info(${table})`).all().some(c=>c.name==='coverage_radius'))db.exec(`ALTER TABLE ${table} ADD COLUMN coverage_radius REAL NOT NULL DEFAULT 0`);
  db.exec(`CREATE TABLE IF NOT EXISTS coverage_events(id TEXT PRIMARY KEY,count_item_id TEXT REFERENCES count_items(id) ON DELETE CASCADE,measurement_id TEXT REFERENCES measurements(id) ON DELETE CASCADE,previous REAL NOT NULL,current REAL NOT NULL,version INTEGER NOT NULL,created TEXT NOT NULL,CHECK((count_item_id IS NULL)!=(measurement_id IS NULL))) STRICT;
   UPDATE schema_version SET version=11; COMMIT;`);
 }catch(error){db.exec('ROLLBACK');throw error;}
}
export function coverageStore(db,{AppError}){
 return {
  coverageSnapshot:()=>({coverageEvents:db.prepare('SELECT * FROM coverage_events ORDER BY rowid').all()}),
  updateCoverage(kind,id,{radius,version}={}){
   if(!['items','measurements'].includes(kind))throw new AppError(400,'Invalid coverage type');
   const table=kind==='items'?'count_items':'measurements',row=db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(id);
   if(!row)throw new AppError(404,'Coverage item not found');
   if(kind==='measurements'&&row.kind!=='point')throw new AppError(400,'Coverage is available for point measurements only');
   if(typeof radius!=='number'||!Number.isFinite(radius)||radius<0||radius>10000)throw new AppError(400,'Coverage radius must be from 0 to 10000 metres');
   if(version!==row.version)throw new AppError(409,'Item changed. Reload before editing coverage.');
   if(radius===row.coverage_radius)return {id,coverage_radius:radius,version};
   db.exec('BEGIN');
   try{
    db.prepare(`UPDATE ${table} SET coverage_radius=?,version=version+1 WHERE id=?`).run(radius,id);
    db.prepare('INSERT INTO coverage_events VALUES (?,?,?,?,?,?,?)').run(randomUUID(),kind==='items'?id:null,kind==='measurements'?id:null,row.coverage_radius,radius,version+1,new Date().toISOString());
    db.exec('COMMIT');
   }catch(error){db.exec('ROLLBACK');throw error;}
   return {id,coverage_radius:radius,version:version+1};
  }
 };
}

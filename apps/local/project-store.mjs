import {randomUUID} from 'node:crypto';
import {PROJECT_STATUSES,LOCAL_OWNER} from './web/project-model.mjs';

export function migrateProjects(db) {
  if(db.prepare('SELECT version FROM schema_version').get().version!==8)return;
  db.exec('BEGIN');
  try{
    db.exec(`CREATE TABLE IF NOT EXISTS project_metadata (
      project_id TEXT PRIMARY KEY REFERENCES entities(id) ON DELETE CASCADE,
      owner TEXT NOT NULL, customer TEXT NOT NULL, building_type TEXT NOT NULL, due_date TEXT NOT NULL,
      status TEXT NOT NULL, archived INTEGER NOT NULL, version INTEGER NOT NULL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS project_events (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
      previous TEXT NOT NULL, current TEXT NOT NULL, created TEXT NOT NULL
    ) STRICT;`);
    db.prepare("INSERT OR IGNORE INTO project_metadata SELECT id,?,'','','','Takeoff',0,1 FROM entities WHERE kind='project'").run(LOCAL_OWNER);
    db.exec('UPDATE schema_version SET version=9; COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error;}
}

export function projectStore(db,{requireEntity,name,AppError}) {
  const fail=(message,status=400)=>{throw new AppError(status,message);};
  const text=(value,label)=>{if(typeof value!=='string'||value.trim().length>160)fail(`${label} must be text up to 160 characters`);return value.trim();};
  function validate(input,previous={owner:LOCAL_OWNER,customer:'',building_type:'',due_date:'',status:'Takeoff',archived:false}){
    if(!input||typeof input!=='object'||Array.isArray(input))fail('Project fields must be an object');
    const merged={...previous,...input},due=text(merged.due_date,'Due date');
    if(due&&(!/^\d{4}-\d{2}-\d{2}$/.test(due)||Number(due.slice(0,4))<1||!Number.isFinite(Date.parse(due+'T00:00:00Z'))||new Date(due+'T00:00:00Z').toISOString().slice(0,10)!==due))fail('Due date must be a real YYYY-MM-DD date');
    if(!PROJECT_STATUSES.includes(merged.status))fail('Invalid project status');
    if(typeof merged.archived!=='boolean')fail('Archived must be true or false');
    return {owner:text(merged.owner,'Owner'),customer:text(merged.customer,'Customer'),building_type:text(merged.building_type,'Building type'),due_date:due,status:merged.status,archived:merged.archived?1:0};
  }
  function row(id){const entity=requireEntity(id,'project'),metadata=db.prepare('SELECT * FROM project_metadata WHERE project_id=?').get(id);return {...metadata,name:entity.name};}
  return {
    validateProject:validate,
    insertProjectMetadata(id,metadata){db.prepare('INSERT INTO project_metadata VALUES (?,?,?,?,?,?,?,?)').run(id,metadata.owner,metadata.customer,metadata.building_type,metadata.due_date,metadata.status,metadata.archived,1);},
    projectSnapshot(){return {projectMetadata:db.prepare('SELECT * FROM project_metadata ORDER BY project_id').all(),projectEvents:db.prepare('SELECT * FROM project_events ORDER BY rowid').all().map(e=>({...e,previous:JSON.parse(e.previous),current:JSON.parse(e.current)}))};},
    updateProject(id,input){
      const previous=row(id);if(input.version!==previous.version)fail('Project changed. Reload before editing.',409);
      const fields=validate(input,{...previous,archived:!!previous.archived}),label=input.name===undefined?previous.name:name(input.name);
      if(label===previous.name&&Object.keys(fields).every(k=>fields[k]===previous[k]))return previous;
      db.exec('BEGIN');
      try{
        db.prepare('UPDATE entities SET name=? WHERE id=?').run(label,id);
        db.prepare('UPDATE project_metadata SET owner=?,customer=?,building_type=?,due_date=?,status=?,archived=?,version=version+1 WHERE project_id=?').run(fields.owner,fields.customer,fields.building_type,fields.due_date,fields.status,fields.archived,id);
        const updated=row(id);db.prepare('INSERT INTO project_events VALUES (?,?,?,?,?)').run(randomUUID(),id,JSON.stringify(previous),JSON.stringify(updated),new Date().toISOString());
        db.exec('COMMIT');return updated;
      }catch(error){db.exec('ROLLBACK');throw error;}
    },
  };
}

import {randomUUID} from 'node:crypto';
import {floorplanLayout,MAX_FLOORPLAN_PAGES,pageSize} from './web/floorplan-model.mjs';
export function migrateFloorplans(db){
  if(db.prepare('SELECT version FROM schema_version').get().version!==9)return;
  db.exec('BEGIN');try{db.exec(`
    CREATE TABLE IF NOT EXISTS floorplans(id TEXT PRIMARY KEY,discipline_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,version INTEGER NOT NULL,created TEXT NOT NULL) STRICT;
    CREATE TABLE IF NOT EXISTS floorplan_members(id TEXT PRIMARY KEY,floorplan_id TEXT NOT NULL REFERENCES floorplans(id) ON DELETE CASCADE,drawing_id TEXT NOT NULL REFERENCES drawings(id) ON DELETE CASCADE,page INTEGER NOT NULL,x REAL NOT NULL,y REAL NOT NULL,UNIQUE(drawing_id,page)) STRICT;
    CREATE TABLE IF NOT EXISTS floorplan_events(id TEXT PRIMARY KEY,discipline_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,floorplan_id TEXT NOT NULL,action TEXT NOT NULL,previous TEXT NOT NULL,current TEXT NOT NULL,created TEXT NOT NULL) STRICT;
    UPDATE schema_version SET version=10; COMMIT;
  `);}catch(error){db.exec('ROLLBACK');throw error;}
}
export function floorplanStore(db,{drawing,AppError}){
  const fail=(message,status=400)=>{throw new AppError(status,message);};
  const members=id=>db.prepare('SELECT * FROM floorplan_members WHERE floorplan_id=? ORDER BY rowid').all(id);
  function group(id){const p=db.prepare('SELECT * FROM floorplans WHERE id=?').get(id);if(!p)fail('Floorplan not found',404);return {...p,members:members(id)};}
  function member(id){const m=db.prepare('SELECT * FROM floorplan_members WHERE id=?').get(id);if(!m)fail('Floorplan drawing not found',404);return m;}
  function page(id,number){if(typeof id!=='string'||!id)fail('Invalid floorplan drawing');const d=drawing(id);if(!Number.isInteger(number)||number<1||number>d.pages.length)fail('Invalid floorplan page');return d;}
  function validate(list){try{floorplanLayout(list,[...new Set(list.map(m=>m.drawing_id))].map(drawing));}catch(error){fail(error.message);}}
  function version(p,input){if(!Number.isInteger(input)||input!==p.version)fail('Floorplan changed. Reload before editing.',409);}
  function transaction(fn){db.exec('BEGIN');try{const result=fn();db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}}
  function audit(previous,current,action){const p=current||previous;db.prepare('INSERT INTO floorplan_events VALUES (?,?,?,?,?,?,?)').run(randomUUID(),p.discipline_id,p.id,action,JSON.stringify(previous),JSON.stringify(current),new Date().toISOString());}
  function prune(previous,action){
    const remaining=members(previous.id);let current=null;
    if(remaining.length<2)db.prepare('DELETE FROM floorplans WHERE id=?').run(previous.id);
    else {db.prepare('UPDATE floorplans SET version=version+1 WHERE id=?').run(previous.id);current=group(previous.id);}
    audit(previous,current,action);return current;
  }
  return {
    floorplanSnapshot(){return {floorplans:db.prepare('SELECT * FROM floorplans ORDER BY rowid').all(),floorplanMembers:db.prepare('SELECT * FROM floorplan_members ORDER BY rowid').all(),floorplanEvents:db.prepare('SELECT * FROM floorplan_events ORDER BY rowid').all().map(e=>({...e,previous:JSON.parse(e.previous),current:JSON.parse(e.current)}))};},
    addFloorplanPage(baseId,input){
      const base=page(baseId,input.page),target=page(input.drawing_id,input.target_page);
      if(base.discipline_id!==target.discipline_id)fail('Floorplans only include drawings in the same discipline');
      if(baseId===target.id&&input.page===input.target_page)fail('Choose another drawing page');
      const found=db.prepare('SELECT * FROM floorplan_members WHERE drawing_id=? AND page=?').get(baseId,input.page),previous=found?group(found.floorplan_id):null;
      if(previous)version(previous,input.version);else if(input.version!==0)fail('Floorplan changed. Reload before adding.',409);
      if(db.prepare('SELECT id FROM floorplan_members WHERE drawing_id=? AND page=?').get(target.id,input.target_page))fail('That page already belongs to a floorplan; merging groups is not supported yet.',409);
      if(previous?.members.length>=MAX_FLOORPLAN_PAGES)fail(`A floorplan supports up to ${MAX_FLOORPLAN_PAGES} pages`);
      return transaction(()=>{
        const id=previous?.id||randomUUID();
        if(!previous){db.prepare('INSERT INTO floorplans VALUES (?,?,1,?)').run(id,base.discipline_id,new Date().toISOString());db.prepare('INSERT INTO floorplan_members VALUES (?,?,?,?,0,0)').run(randomUUID(),id,baseId,input.page);}
        const existing=members(id),right=Math.max(...existing.map(m=>m.x+pageSize(drawing(m.drawing_id).pages[m.page-1]).width));
        const next={id:randomUUID(),floorplan_id:id,drawing_id:target.id,page:input.target_page,x:right+24,y:found?.y||0};validate([...existing,next]);
        db.prepare('INSERT INTO floorplan_members VALUES (?,?,?,?,?,?)').run(next.id,id,target.id,next.page,next.x,next.y);
        if(previous)db.prepare('UPDATE floorplans SET version=version+1 WHERE id=?').run(id);
        const current=group(id);audit(previous,current,'add');return current;
      });
    },
    updateFloorplanMember(id,input){const m=member(id),previous=group(m.floorplan_id);version(previous,input.version);const next={...m,x:input.x,y:input.y};validate(previous.members.map(v=>v.id===id?next:v));if(m.x===next.x&&m.y===next.y)return previous;
      return transaction(()=>{db.prepare('UPDATE floorplan_members SET x=?,y=? WHERE id=?').run(next.x,next.y,id);db.prepare('UPDATE floorplans SET version=version+1 WHERE id=?').run(previous.id);const current=group(previous.id);audit(previous,current,'position');return current;});
    },
    removeFloorplanMember(id,inputVersion){const m=member(id),previous=group(m.floorplan_id);version(previous,inputVersion);return transaction(()=>{db.prepare('DELETE FROM floorplan_members WHERE id=?').run(id);return prune(previous,'remove');});},
    // Called within the drawing deletion transaction so a failed audit cannot partly delete sources or membership.
    removeDrawingFromFloorplans(id){const ids=db.prepare('SELECT DISTINCT floorplan_id FROM floorplan_members WHERE drawing_id=?').all(id);for(const {floorplan_id}of ids){const previous=group(floorplan_id);db.prepare('DELETE FROM floorplan_members WHERE floorplan_id=? AND drawing_id=?').run(floorplan_id,id);prune(previous,'drawing removed');}},
  };
}

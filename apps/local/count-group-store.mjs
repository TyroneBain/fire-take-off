import {randomUUID} from 'node:crypto';
export function migrateCountGroups(db){
 if(db.prepare('SELECT version FROM schema_version').get().version!==14)return;
 db.exec(`BEGIN;
 CREATE TABLE IF NOT EXISTS count_group_scopes(discipline_id TEXT PRIMARY KEY REFERENCES entities(id) ON DELETE CASCADE,version INTEGER NOT NULL) STRICT;
 CREATE TABLE IF NOT EXISTS count_groups(id TEXT PRIMARY KEY,discipline_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,name TEXT NOT NULL,position INTEGER NOT NULL) STRICT;
 CREATE TABLE IF NOT EXISTS count_group_members(item_id TEXT PRIMARY KEY REFERENCES count_items(id) ON DELETE CASCADE,group_id TEXT NOT NULL REFERENCES count_groups(id) ON DELETE CASCADE) STRICT;
 CREATE TABLE IF NOT EXISTS count_group_events(id TEXT PRIMARY KEY,discipline_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,action TEXT NOT NULL,previous TEXT NOT NULL,current TEXT NOT NULL,version INTEGER NOT NULL,created TEXT NOT NULL) STRICT;
 UPDATE schema_version SET version=15;COMMIT`);
}
export function countGroupStore(db,{requireEntity,name,AppError}){
 const fail=(message,status=400)=>{throw new AppError(status,message);};
 const group=id=>{const g=db.prepare('SELECT * FROM count_groups WHERE id=?').get(id);if(!g)fail('Group not found',404);return g;};
 const version=id=>db.prepare('SELECT version FROM count_group_scopes WHERE discipline_id=?').get(id)?.version??0;
 function check(disciplineId,expected){requireEntity(disciplineId,'discipline');if(!Number.isInteger(expected)||version(disciplineId)!==expected)fail('Groups changed. Reload before editing.',409);}
 function commit(disciplineId,expected,action,previous,change){
  check(disciplineId,expected);db.exec('BEGIN');
  try{const current=change(),next=expected+1;db.prepare('INSERT INTO count_group_scopes VALUES (?,?) ON CONFLICT(discipline_id) DO UPDATE SET version=excluded.version').run(disciplineId,next);db.prepare('INSERT INTO count_group_events VALUES (?,?,?,?,?,?,?)').run(randomUUID(),disciplineId,action,JSON.stringify(previous),JSON.stringify(current),next,new Date().toISOString());db.exec('COMMIT');return {version:next,...current};}
  catch(error){db.exec('ROLLBACK');throw error;}
 }
 function unique(disciplineId,label,except=''){if(label.toLowerCase()==='misc')fail('Misc is reserved for ungrouped headings');if(db.prepare('SELECT id FROM count_groups WHERE discipline_id=? AND lower(name)=lower(?) AND id<>?').get(disciplineId,label,except))fail('A group with this name already exists',409);}
 return {
  groupSnapshot:()=>({countGroups:db.prepare('SELECT * FROM count_groups ORDER BY discipline_id,position,id').all(),countGroupMembers:db.prepare('SELECT * FROM count_group_members ORDER BY item_id').all(),countGroupScopes:db.prepare('SELECT * FROM count_group_scopes ORDER BY discipline_id').all(),countGroupEvents:db.prepare('SELECT * FROM count_group_events ORDER BY rowid').all().map(e=>({...e,previous:JSON.parse(e.previous),current:JSON.parse(e.current)}))}),
  createCountGroup(disciplineId,{name:value,version:expected}={}){
   check(disciplineId,expected);const label=name(value);unique(disciplineId,label);if(db.prepare('SELECT count(*) AS n FROM count_groups WHERE discipline_id=?').get(disciplineId).n>=200)fail('Limit of 200 count groups reached');
   return commit(disciplineId,expected,'create',null,()=>{const g={id:randomUUID(),discipline_id:disciplineId,name:label,position:db.prepare('SELECT coalesce(max(position),-1)+1 AS n FROM count_groups WHERE discipline_id=?').get(disciplineId).n};db.prepare('INSERT INTO count_groups VALUES (?,?,?,?)').run(g.id,g.discipline_id,g.name,g.position);return {group:g};});
  },
  renameCountGroup(id,{name:value,version:expected}={}){
   const old=group(id),label=name(value);check(old.discipline_id,expected);unique(old.discipline_id,label,id);if(label===old.name)return {version:expected,group:old};
   return commit(old.discipline_id,expected,'rename',old,()=>{db.prepare('UPDATE count_groups SET name=? WHERE id=?').run(label,id);return {group:group(id)};});
  },
  assignCountGroup(itemId,{group_id,version:expected}={}){
   const item=db.prepare('SELECT * FROM count_items WHERE id=?').get(itemId);if(!item)fail('Count heading not found',404);check(item.discipline_id,expected);
   if(group_id!==null&&typeof group_id!=='string')fail('Choose a group or Misc');if(group_id!==null&&group(group_id).discipline_id!==item.discipline_id)fail('Group belongs to another discipline');
   const old=db.prepare('SELECT group_id FROM count_group_members WHERE item_id=?').get(itemId)?.group_id??null;if(old===group_id)return {version:expected,item_id:itemId,group_id};
   return commit(item.discipline_id,expected,'assign',{item_id:itemId,group_id:old},()=>{if(group_id===null)db.prepare('DELETE FROM count_group_members WHERE item_id=?').run(itemId);else db.prepare('INSERT INTO count_group_members VALUES (?,?) ON CONFLICT(item_id) DO UPDATE SET group_id=excluded.group_id').run(itemId,group_id);return {item_id:itemId,group_id};});
  },
  deleteCountGroup(id,{version:expected}={}){
   const old=group(id);check(old.discipline_id,expected);if(db.prepare('SELECT item_id FROM count_group_members WHERE group_id=? LIMIT 1').get(id))fail('Move this group’s items to another group or Misc before deleting it',409);
   return commit(old.discipline_id,expected,'delete',old,()=>{db.prepare('DELETE FROM count_groups WHERE id=?').run(id);db.prepare('UPDATE count_groups SET position=position-1 WHERE discipline_id=? AND position>?').run(old.discipline_id,old.position);return {deleted:id};});
  }
 };
}

export function migrateSelectionMoves(db){
 if(db.prepare('SELECT version FROM schema_version').get().version!==13)return;
 db.exec(`BEGIN;CREATE TABLE IF NOT EXISTS count_selection_moves(id TEXT PRIMARY KEY,discipline_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,example_id TEXT NOT NULL,source_item_id TEXT NOT NULL,destination_item_id TEXT NOT NULL,previous TEXT NOT NULL,current TEXT NOT NULL,created TEXT NOT NULL) STRICT;UPDATE schema_version SET version=14;COMMIT`);
}

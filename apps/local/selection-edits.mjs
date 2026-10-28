export function migrateSelectionEdits(db){
 if(db.prepare('SELECT version FROM schema_version').get().version!==11)return;
 db.exec(`BEGIN;CREATE TABLE IF NOT EXISTS count_selection_events(id TEXT PRIMARY KEY,example_id TEXT NOT NULL REFERENCES count_examples(id) ON DELETE CASCADE,previous TEXT NOT NULL,current TEXT NOT NULL,created TEXT NOT NULL) STRICT;UPDATE schema_version SET version=12;COMMIT`);
}

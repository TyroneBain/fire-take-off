// Whole-number bounds are a provisional application policy, not a reference limit.
export function validMultiplier(value) {
  return Number.isInteger(value) && value >= 1 && value <= 10000;
}

export function migrateQuantityMultipliers(db) {
  if (db.prepare('SELECT version FROM schema_version').get().version !== 7) return;
  db.exec('BEGIN');
  try {
    for (const table of ['measurements', 'zone_headings']) {
      if (!db.prepare(`PRAGMA table_info(${table})`).all().some(c => c.name === 'multiplier')) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN multiplier INTEGER NOT NULL DEFAULT 1`);
      }
    }
    db.exec(`
      CREATE TABLE IF NOT EXISTS measurement_factor_events (
        id TEXT PRIMARY KEY, measurement_id TEXT NOT NULL REFERENCES measurements(id) ON DELETE CASCADE,
        previous INTEGER NOT NULL, current INTEGER NOT NULL, version INTEGER NOT NULL, created TEXT NOT NULL
      ) STRICT;
      CREATE TABLE IF NOT EXISTS zone_factor_events (
        id TEXT PRIMARY KEY, heading_id TEXT NOT NULL REFERENCES zone_headings(id) ON DELETE CASCADE,
        previous INTEGER NOT NULL, current INTEGER NOT NULL, version INTEGER NOT NULL, created TEXT NOT NULL
      ) STRICT;
      UPDATE schema_version SET version=8; COMMIT;
    `);
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

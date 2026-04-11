#!/usr/bin/env node
// Migrate data from Replit Helium (DATABASE_URL) to Neon (NEON_DATABASE_URL)
// Uses ON CONFLICT DO NOTHING to preserve existing data in both DBs

import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

const SOURCE_URL = process.env.DATABASE_URL;
const TARGET_URL = process.env.NEON_DATABASE_URL;

if (!SOURCE_URL || !TARGET_URL) {
  console.error('ERROR: Both DATABASE_URL and NEON_DATABASE_URL must be set');
  process.exit(1);
}

if (SOURCE_URL === TARGET_URL) {
  console.error('ERROR: SOURCE and TARGET databases are the same!');
  process.exit(1);
}

const src = new Pool({ connectionString: SOURCE_URL });
const tgt = new Pool({ connectionString: TARGET_URL });

async function migrateTable(tableName, orderBy = 'id') {
  const { rows } = await src.query(`SELECT * FROM ${tableName} ORDER BY ${orderBy}`);
  if (rows.length === 0) {
    console.log(`  ${tableName}: 0 rows (skipping)`);
    return 0;
  }
  const cols = Object.keys(rows[0]);
  const placeholders = rows.map((_, ri) =>
    `(${cols.map((_, ci) => `$${ri * cols.length + ci + 1}`).join(', ')})`
  ).join(', ');
  const values = rows.flatMap(row => cols.map(c => row[c]));
  const quoted = cols.map(c => `"${c}"`).join(', ');
  const sql = `INSERT INTO ${tableName} (${quoted}) VALUES ${placeholders} ON CONFLICT DO NOTHING`;
  const result = await tgt.query(sql, values);
  console.log(`  ${tableName}: ${rows.length} read → ${result.rowCount} inserted (${rows.length - result.rowCount} already existed)`);
  return result.rowCount;
}

async function main() {
  console.log('=== Helium → Neon Data Migration ===\n');

  try {
    // Verify connections
    await src.query('SELECT 1');
    console.log('✓ Source (Helium) connected');
    await tgt.query('SELECT 1');
    console.log('✓ Target (Neon) connected\n');

    // Migrate in dependency order
    await migrateTable('users', 'id');
    await migrateTable('clients', 'id');
    await migrateTable('service_teams', 'id');
    await migrateTable('team_members', 'id');
    await migrateTable('team_assignments', 'team_id');
    await migrateTable('consumables', 'id');
    await migrateTable('equipment', 'id');
    await migrateTable('services', 'id');
    await migrateTable('field_reports', 'id');
    await migrateTable('service_stock_issued', 'id');

    console.log('\n✓ Migration complete!');
  } catch (err) {
    console.error('\n✗ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await src.end();
    await tgt.end();
  }
}

main();

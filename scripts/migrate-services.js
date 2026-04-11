#!/usr/bin/env node
// Migrate services and field_reports from Helium to Neon with JSON handling

import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

const src = new Pool({ connectionString: process.env.DATABASE_URL });
const tgt = new Pool({ connectionString: process.env.NEON_DATABASE_URL });

async function migrateTableWithJsonCast(tableName, jsonCols = [], orderBy = 'id') {
  const { rows } = await src.query(`SELECT * FROM ${tableName} ORDER BY ${orderBy}`);
  if (rows.length === 0) {
    console.log(`  ${tableName}: 0 rows (skipping)`);
    return 0;
  }
  const cols = Object.keys(rows[0]);
  let inserted = 0;
  let skipped = 0;

  // Insert one row at a time to handle errors gracefully
  for (const row of rows) {
    const values = cols.map(c => {
      const v = row[c];
      if (v === null || v === undefined) return null;
      if (jsonCols.includes(c)) {
        // Ensure JSON values are properly serialized
        return typeof v === 'string' ? v : JSON.stringify(v);
      }
      return v;
    });

    const placeholders = cols.map((c, i) => {
      if (jsonCols.includes(c)) return `$${i + 1}::jsonb`;
      return `$${i + 1}`;
    });

    const quoted = cols.map(c => `"${c}"`).join(', ');
    const sql = `INSERT INTO ${tableName} (${quoted}) VALUES (${placeholders.join(', ')}) ON CONFLICT DO NOTHING`;

    try {
      const result = await tgt.query(sql, values);
      if (result.rowCount > 0) inserted++;
      else skipped++;
    } catch (err) {
      console.log(`  Skipping row id=${row.id || '?'}: ${err.message.substring(0, 80)}`);
      skipped++;
    }
  }

  console.log(`  ${tableName}: ${rows.length} read → ${inserted} inserted (${skipped} skipped/existed)`);
  return inserted;
}

async function main() {
  console.log('=== Services Migration (Helium → Neon) ===\n');

  const JSON_COLS_SERVICES = ['recurrence_pattern', 'excluded_dates', 'completed_dates', 'invoiced_dates'];
  const JSON_COLS_FIELD_REPORTS = ['equipment_used', 'consumables_used'];

  try {
    await src.query('SELECT 1');
    await tgt.query('SELECT 1');
    console.log('✓ Both databases connected\n');

    await migrateTableWithJsonCast('services', JSON_COLS_SERVICES, 'id');
    await migrateTableWithJsonCast('service_stock_issued', [], 'id');
    await migrateTableWithJsonCast('field_reports', JSON_COLS_FIELD_REPORTS, 'id');

    console.log('\n✓ Done!');
  } catch (err) {
    console.error('\n✗ Failed:', err.message);
    process.exit(1);
  } finally {
    await src.end();
    await tgt.end();
  }
}

main();

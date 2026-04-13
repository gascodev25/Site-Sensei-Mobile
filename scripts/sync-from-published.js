#!/usr/bin/env node
// Sync all core data from the published Replit app (source of truth) to ITEX Neon database
// Usage: node --input-type=commonjs < scripts/sync-from-published.js
// (Must run as CommonJS because it uses require(); project root has "type":"module")

const https = require('https');

const SOURCE_URL = 'https://stock-schedule-gavinbgreen.replit.app';
const SOURCE_EMAIL = 'gavin@gasco.digital';
const SOURCE_PASSWORD = 'ChangeMe123!';

// ── HTTP helper ───────────────────────────────────────────────────────────────
function request(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: opts.method || 'GET',
      headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString() }));
    });
    req.on('error', reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

async function login() {
  console.log('Logging in to published app...');
  const res = await request(`${SOURCE_URL}/api/login/local`, {
    method: 'POST',
    body: JSON.stringify({ email: SOURCE_EMAIL, password: SOURCE_PASSWORD }),
  });
  if (res.status !== 200) throw new Error(`Login failed: ${res.status} ${res.body}`);
  const setCookie = res.headers['set-cookie'];
  if (!setCookie) throw new Error('No session cookie received');
  return (Array.isArray(setCookie) ? setCookie : [setCookie]).map(c => c.split(';')[0]).join('; ');
}

async function fetchJSON(cookie, path) {
  const res = await request(`${SOURCE_URL}${path}`, { headers: { Cookie: cookie } });
  if (res.status !== 200) throw new Error(`GET ${path} → ${res.status}: ${res.body.slice(0,100)}`);
  return JSON.parse(res.body);
}

async function fetchConcurrent(items, fn, concurrency = 8) {
  const results = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
    process.stdout.write(`\r  ${Math.min(i + concurrency, items.length)}/${items.length} done...`);
  }
  process.stdout.write('\n');
  return results;
}

// SQL helpers
const nil = v => (v === null || v === undefined) ? 'NULL' : null;
const str = v => nil(v) ?? `'${String(v).replace(/'/g, "''")}'`;
const num = v => nil(v) ?? Number(v);
const bool = v => v ? 'TRUE' : 'FALSE';
const json = v => nil(v) ?? `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
const ts = v => nil(v) ?? `'${v}'`;

async function main() {
  if (!process.env.NEON_DATABASE_URL) { console.error('ERROR: NEON_DATABASE_URL not set'); process.exit(1); }

  const cookie = await login();

  console.log('\nFetching data from published app...');
  const [teams, equipment, consumables, clients, services] = await Promise.all([
    fetchJSON(cookie, '/api/service-teams'),
    fetchJSON(cookie, '/api/equipment'),
    fetchJSON(cookie, '/api/consumables'),
    fetchJSON(cookie, '/api/clients'),
    fetchJSON(cookie, '/api/services'),
  ]);
  console.log(`  Teams: ${teams.length} | Equipment: ${equipment.length} | Consumables: ${consumables.length}`);
  console.log(`  Clients: ${clients.length} | Services: ${services.length}`);

  console.log(`\nFetching stock_issued for ${services.length} services...`);
  const stockResults = await fetchConcurrent(services, async (svc) => {
    const stock = await fetchJSON(cookie, `/api/services/${svc.id}/stock`);
    return stock;
  }, 8);
  const allStock = stockResults.flat();
  console.log(`  Total stock_issued records: ${allStock.length}`);

  // Connect to Neon
  const { Pool, neonConfig } = require('@neondatabase/serverless');
  const ws = require('ws');
  neonConfig.webSocketConstructor = ws;
  const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL });

  try {
    console.log('\nClearing existing data...');
    await pool.query('TRUNCATE TABLE service_stock_issued RESTART IDENTITY CASCADE');
    await pool.query('TRUNCATE TABLE services RESTART IDENTITY CASCADE');
    await pool.query('TRUNCATE TABLE clients RESTART IDENTITY CASCADE');
    await pool.query('TRUNCATE TABLE equipment RESTART IDENTITY CASCADE');
    await pool.query('TRUNCATE TABLE consumables RESTART IDENTITY CASCADE');
    await pool.query('TRUNCATE TABLE service_teams RESTART IDENTITY CASCADE');
    console.log('  Tables cleared');

    // ── Teams ─────────────────────────────────────────────────────────────────
    console.log('Inserting teams...');
    for (const t of teams) {
      await pool.query(
        `INSERT INTO service_teams (id, name, created_at) VALUES (${num(t.id)}, ${str(t.name)}, ${ts(t.createdAt)})`
      );
    }
    await pool.query(`SELECT setval('service_teams_id_seq', (SELECT MAX(id) FROM service_teams))`);
    console.log(`  ✓ ${teams.length} teams`);

    // ── Equipment ─────────────────────────────────────────────────────────────
    console.log('Inserting equipment...');
    for (const e of equipment) {
      await pool.query(
        `INSERT INTO equipment (id, name, stock_code, price, min_stock_level, current_stock,
          date_installed, installed_at_client_id, template_id, status, barcode, qr_code, created_at)
         VALUES (${num(e.id)}, ${str(e.name)}, ${str(e.stockCode)}, ${str(e.price)},
           ${num(e.minStockLevel) ?? 0}, ${num(e.currentStock) ?? 0},
           ${ts(e.dateInstalled)}, ${num(e.installedAtClientId)}, ${num(e.templateId)},
           ${str(e.status ?? 'in_warehouse')}, ${str(e.barcode)}, ${str(e.qrCode)}, ${ts(e.createdAt)})`
      );
    }
    await pool.query(`SELECT setval('equipment_id_seq', (SELECT MAX(id) FROM equipment))`);
    console.log(`  ✓ ${equipment.length} equipment items`);

    // ── Consumables ───────────────────────────────────────────────────────────
    console.log('Inserting consumables...');
    for (const c of consumables) {
      await pool.query(
        `INSERT INTO consumables (id, name, stock_code, price, min_stock_level, current_stock, barcode, qr_code, created_at)
         VALUES (${num(c.id)}, ${str(c.name)}, ${str(c.stockCode)}, ${str(c.price)},
           ${num(c.minStockLevel) ?? 0}, ${num(c.currentStock) ?? 0},
           ${str(c.barcode)}, ${str(c.qrCode)}, ${ts(c.createdAt)})`
      );
    }
    await pool.query(`SELECT setval('consumables_id_seq', (SELECT MAX(id) FROM consumables))`);
    console.log(`  ✓ ${consumables.length} consumables`);

    // ── Clients ───────────────────────────────────────────────────────────────
    console.log('Inserting clients...');
    for (const c of clients) {
      await pool.query(
        `INSERT INTO clients (id, name, address_text, latitude, longitude, city, postcode, country, contact_person, phone, created_at, updated_at)
         VALUES (${num(c.id)}, ${str(c.name)}, ${str(c.addressText ?? '')},
           ${c.latitude ?? 0}, ${c.longitude ?? 0},
           ${str(c.city)}, ${str(c.postcode)}, ${str(c.country ?? 'South Africa')},
           ${str(c.contactPerson)}, ${str(c.phone)}, ${ts(c.createdAt)}, ${ts(c.updatedAt ?? c.createdAt)})`
      );
    }
    await pool.query(`SELECT setval('clients_id_seq', (SELECT MAX(id) FROM clients))`);
    console.log(`  ✓ ${clients.length} clients`);

    // ── Services ──────────────────────────────────────────────────────────────
    console.log('Inserting services...');
    let svcDone = 0;
    for (const s of services) {
      await pool.query(
        `INSERT INTO services (id, client_id, type, installation_date, team_id, status,
           recurrence_pattern, original_service_id, split_from_date, excluded_dates,
           completed_dates, invoiced_dates, contract_length_months, created_at, completed_at,
           marked_for_invoicing, invoiced_status, invoiced_by, last_invoice_sync,
           service_priority, service_tag, estimated_duration, check_in_time, check_out_time,
           client_signature_url, signed_by, location_verified)
         VALUES (${num(s.id)}, ${num(s.clientId)}, ${str(s.type ?? 'installation')},
           ${ts(s.installationDate)}, ${num(s.teamId)}, ${str(s.status ?? 'scheduled')},
           ${json(s.recurrencePattern)}, ${num(s.originalServiceId)}, ${str(s.splitFromDate)},
           ${json(s.excludedDates ?? [])}, ${json(s.completedDates ?? [])}, ${json(s.invoicedDates ?? [])},
           ${num(s.contractLengthMonths)}, ${ts(s.createdAt)}, ${ts(s.completedAt)},
           ${bool(s.markedForInvoicing)}, ${str(s.invoicedStatus ?? 'not_ready')}, ${str(s.invoicedBy)},
           ${ts(s.lastInvoiceSync)}, ${str(s.servicePriority ?? 'Routine')}, ${str(s.serviceTag)},
           ${num(s.estimatedDuration) ?? 60}, ${ts(s.checkInTime)}, ${ts(s.checkOutTime)},
           ${str(s.clientSignatureUrl)}, ${str(s.signedBy)}, ${bool(s.locationVerified)})`
      );
      svcDone++;
      if (svcDone % 25 === 0) process.stdout.write(`\r  ${svcDone}/${services.length} services...`);
    }
    process.stdout.write('\n');
    await pool.query(`SELECT setval('services_id_seq', (SELECT MAX(id) FROM services))`);
    console.log(`  ✓ ${services.length} services`);

    // ── Stock Issued ──────────────────────────────────────────────────────────
    console.log('Inserting stock issued records...');
    let stDone = 0;
    for (const r of allStock) {
      await pool.query(
        `INSERT INTO service_stock_issued (id, service_id, equipment_id, consumable_id, quantity, returned, returned_at)
         VALUES (${num(r.id)}, ${num(r.serviceId)}, ${num(r.equipmentId)}, ${num(r.consumableId)},
           ${num(r.quantity) ?? 1}, ${bool(r.returned)}, ${ts(r.returnedAt)})`
      );
      stDone++;
      if (stDone % 25 === 0) process.stdout.write(`\r  ${stDone}/${allStock.length} stock records...`);
    }
    process.stdout.write('\n');
    if (allStock.length > 0) {
      await pool.query(`SELECT setval('service_stock_issued_id_seq', (SELECT MAX(id) FROM service_stock_issued))`);
    }
    console.log(`  ✓ ${allStock.length} stock issued records`);

    // ── Verify ────────────────────────────────────────────────────────────────
    console.log('\n── Verification ──────────────────────────────────────────────');
    const [t, eq, co, cl, sv, st] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM service_teams'),
      pool.query('SELECT COUNT(*) FROM equipment'),
      pool.query('SELECT COUNT(*) FROM consumables'),
      pool.query('SELECT COUNT(*) FROM clients'),
      pool.query('SELECT COUNT(*) FROM services'),
      pool.query('SELECT COUNT(*) FROM service_stock_issued'),
    ]);
    console.log(`  Teams:         ${t.rows[0].count}`);
    console.log(`  Equipment:     ${eq.rows[0].count}`);
    console.log(`  Consumables:   ${co.rows[0].count}`);
    console.log(`  Clients:       ${cl.rows[0].count}`);
    console.log(`  Services:      ${sv.rows[0].count}`);
    console.log(`  Stock issued:  ${st.rows[0].count}`);
    console.log('\n✓ Sync complete! ITEX now matches the published app data.');
  } finally {
    await pool.end();
  }
}

main().catch(err => { console.error('\nFailed:', err.message); process.exit(1); });

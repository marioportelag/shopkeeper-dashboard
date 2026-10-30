import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, describe, it } from 'node:test';
import pg from 'pg';
import { loadConfig } from '../../src/config.js';
import { buildSslOptions } from '../../src/db.js';
import { fetchListingStats, parseMonthRange } from '../../src/listings.js';

/**
 * Runs the real dashboard query against PostgreSQL in an isolated, temporary schema.
 * Requires DB_* environment variables (see .env.example); skipped when DB_HOST is unset.
 */
const enabled = Boolean(process.env.DB_HOST);
const schemaSql = readFileSync(new URL('../../db/schema.sql', import.meta.url), 'utf8');

describe('listing statistics query (PostgreSQL)', { skip: !enabled && 'DB_HOST is not set' }, () => {
  const schema = `test_${process.pid}_${Date.now()}`;
  let client;

  before(async () => {
    const { db } = loadConfig();
    client = new pg.Client({ ...db, ssl: buildSslOptions(db) });
    await client.connect();
    await client.query(`CREATE SCHEMA ${schema}`);
    await client.query(`SET search_path TO ${schema}`);
    await client.query(schemaSql);
    await client.query(`INSERT INTO sites (id, title) VALUES (1, 'Harbor'), (2, 'Summit')`);
    await client.query(`
      INSERT INTO deals (site_id, listing_date, revenue) VALUES
        (1, '2020-10-31', 999),   -- before the range
        (1, '2020-11-01', 100),   -- first day of the range
        (1, '2020-11-20', 200),
        (2, '2020-11-05', 50),
        (1, '2021-01-15', 300),
        (1, '2021-11-10', 400),   -- same month number as Nov 2020, different year
        (1, '2021-11-30', 500),   -- last day of the range
        (1, '2021-12-01', 999)    -- after the range`);
  });

  after(async () => {
    if (!client) return;
    await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await client.end();
  });

  it('keeps Nov 2020 and Nov 2021 in separate buckets and honours range boundaries', async () => {
    const rows = await fetchListingStats(client, parseMonthRange({ from: '2020-11', to: '2021-11' }));

    assert.deepEqual(rows, [
      { site_id: 1, broker: 'Harbor', month: '2020-11', total_listings: 2, avg_revenue: '150.00' },
      { site_id: 2, broker: 'Summit', month: '2020-11', total_listings: 1, avg_revenue: '50.00' },
      { site_id: 1, broker: 'Harbor', month: '2021-01', total_listings: 1, avg_revenue: '300.00' },
      { site_id: 1, broker: 'Harbor', month: '2021-11', total_listings: 2, avg_revenue: '450.00' },
    ]);
  });

  it('returns rows in chronological order across years', async () => {
    const rows = await fetchListingStats(client, parseMonthRange({ from: '2020-01', to: '2022-12' }));
    const months = rows.map((row) => row.month);

    assert.deepEqual(months, [...months].sort());
    assert.ok(months.indexOf('2020-12') === -1);
    assert.ok(months.indexOf('2021-12') > months.indexOf('2021-11'));
  });
});

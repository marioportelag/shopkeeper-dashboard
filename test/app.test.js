import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import request from 'supertest';
import { buildApp, extractChartData, row } from './helpers.js';

describe('GET /', () => {
  it('renders the dashboard for the default period', async () => {
    const { app, db } = buildApp({ rows: [row('2020-11', 1, 'Harbor', 4), row('2021-11', 1, 'Harbor', 9)] });
    const res = await request(app).get('/');

    assert.equal(res.status, 200);
    assert.match(res.headers['content-type'], /text\/html/);
    assert.ok(res.text.includes('Nov 2020 – Nov 2021'));
    assert.ok(res.text.includes('<td data-order="2020-11">Nov 2020</td>'));
    assert.ok(res.text.includes('<td data-order="2021-11">Nov 2021</td>'));
    assert.deepEqual(db.calls[0].values, ['2020-11-01', '2021-12-01']);
    assert.equal(extractChartData(res.text).labels.length, 13);
  });

  it('applies a custom period from the query string', async () => {
    const { app, db } = buildApp();
    const res = await request(app).get('/?from=2021-06&to=2021-08');

    assert.equal(res.status, 200);
    assert.deepEqual(db.calls[0].values, ['2021-06-01', '2021-09-01']);
    assert.deepEqual(extractChartData(res.text).labels, ['Jun 2021', 'Jul 2021', 'Aug 2021']);
  });

  it('shows an empty state when there is no data', async () => {
    const { app } = buildApp({ rows: [] });
    const res = await request(app).get('/');

    assert.equal(res.status, 200);
    assert.ok(res.text.includes('No listings were found for this period.'));
    assert.ok(!res.text.includes('id="broker-table"'));
  });

  it('rejects an invalid period with 400 without querying the database', async () => {
    const { app, db } = buildApp();
    const res = await request(app).get('/?from=2021-13&to=2021-12');

    assert.equal(res.status, 400);
    assert.ok(res.text.includes('Invalid reporting period'));
    assert.equal(db.calls.length, 0);
  });

  it('does not reflect the invalid input back into the page', async () => {
    const { app } = buildApp();
    const res = await request(app).get('/').query({ from: '<script>alert(1)</script>', to: '2021-12' });

    assert.equal(res.status, 400);
    assert.ok(!res.text.includes('<script>alert(1)'));
  });
});

describe('database error handling', () => {
  it('returns 503 with a generic message and logs the underlying error', async () => {
    const failure = new Error(
      'connect ECONNREFUSED 10.0.0.5:5432 password authentication failed for user "admin"',
    );
    const { app, logger } = buildApp({ error: failure });
    const res = await request(app).get('/');

    assert.equal(res.status, 503);
    assert.ok(res.text.includes('Data temporarily unavailable'));
    assert.ok(!res.text.includes('ECONNREFUSED'));
    assert.ok(!res.text.includes('10.0.0.5'));
    assert.ok(!res.text.includes('admin'));
    assert.equal(logger.errors.length, 1);
    assert.equal(logger.errors[0][1], failure);
  });
});

describe('other routes', () => {
  it('GET /health responds without touching the database', async () => {
    const { app, db } = buildApp();
    const res = await request(app).get('/health');

    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { status: 'ok' });
    assert.equal(db.calls.length, 0);
  });

  it('returns 404 for unknown pages', async () => {
    const { app } = buildApp();
    const res = await request(app).get('/does-not-exist');

    assert.equal(res.status, 404);
    assert.ok(res.text.includes('Page not found'));
  });

  for (const [path, type] of [
    ['/vendor/chart.umd.min.js', /javascript/],
    ['/vendor/dataTables.min.js', /javascript/],
    ['/vendor/dataTables.dataTables.min.css', /css/],
    ['/js/dashboard.js', /javascript/],
    ['/css/styles.css', /css/],
  ]) {
    it(`serves ${path}`, async () => {
      const { app } = buildApp();
      const res = await request(app).get(path);

      assert.equal(res.status, 200);
      assert.match(res.headers['content-type'], type);
    });
  }

  it('serves only allow-listed vendor files', async () => {
    const { app } = buildApp();

    for (const path of ['/vendor/package.json', '/vendor/..%2F..%2Fpackage.json', '/vendor/pg']) {
      assert.equal((await request(app).get(path)).status, 404, path);
    }
  });

  it('sets security headers and hides the framework', async () => {
    const { app } = buildApp();
    const res = await request(app).get('/health');

    assert.equal(res.headers['x-powered-by'], undefined);
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
    assert.ok(res.headers['content-security-policy']);
  });
});

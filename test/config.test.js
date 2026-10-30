import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { ConfigError, loadConfig } from '../src/config.js';
import { buildSslOptions, createPool } from '../src/db.js';

const BASE_ENV = { DB_HOST: 'localhost', DB_NAME: 'shopkeeper', DB_USER: 'shopkeeper' };

describe('loadConfig', () => {
  it('applies defaults', () => {
    const config = loadConfig(BASE_ENV);

    assert.equal(config.port, 3000);
    assert.equal(config.db.port, 5432);
    assert.equal(config.db.ssl, false);
  });

  for (const key of ['DB_HOST', 'DB_NAME', 'DB_USER']) {
    it(`fails fast when ${key} is missing`, () => {
      const env = { ...BASE_ENV };
      delete env[key];

      assert.throws(
        () => loadConfig(env),
        (error) => error instanceof ConfigError && error.message.includes(key),
      );
    });
  }

  it('rejects ambiguous DB_SSL values instead of guessing', () => {
    assert.throws(() => loadConfig({ ...BASE_ENV, DB_SSL: 'require' }), /DB_SSL/);
  });

  it('rejects a CA file without TLS enabled', () => {
    assert.throws(() => loadConfig({ ...BASE_ENV, DB_SSL_CA_FILE: '/tmp/ca.pem' }), /DB_SSL_CA_FILE/);
  });

  it('rejects an invalid port', () => {
    assert.throws(() => loadConfig({ ...BASE_ENV, DB_PORT: '99999' }), /DB_PORT/);
  });

  it('never echoes the database password in errors', () => {
    const password = 'super-secret-password';

    assert.throws(
      () => loadConfig({ DB_PASSWORD: password }),
      (error) => error instanceof ConfigError && !error.message.includes(password),
    );
  });
});

describe('buildSslOptions (regression for audit finding S4)', () => {
  it('disables TLS only when explicitly off', () => {
    assert.equal(buildSslOptions({ ssl: false }), false);
  });

  it('always verifies the server certificate when TLS is on', () => {
    assert.deepEqual(buildSslOptions({ ssl: true }), { rejectUnauthorized: true });
  });

  it('trusts a supplied CA bundle while keeping verification on', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'shopkeeper-ca-'));
    const caFile = path.join(dir, 'ca.pem');
    writeFileSync(caFile, '-----BEGIN CERTIFICATE-----\nTEST\n-----END CERTIFICATE-----\n');

    const options = buildSslOptions({ ssl: true, sslCaFile: caFile });

    assert.equal(options.rejectUnauthorized, true);
    assert.match(options.ca, /BEGIN CERTIFICATE/);
  });
});

describe('createPool', () => {
  it('wires verified TLS into the pool and handles idle-client errors', async () => {
    const pool = createPool({ ...loadConfig(BASE_ENV).db, ssl: true }, { error: () => {} });

    try {
      assert.deepEqual(pool.options.ssl, { rejectUnauthorized: true });
      assert.equal(pool.listenerCount('error'), 1);
      assert.doesNotThrow(() => pool.emit('error', new Error('idle client terminated')));
    } finally {
      await pool.end();
    }
  });
});

import { readFileSync } from 'node:fs';
import pg from 'pg';

/**
 * TLS options for the PostgreSQL connection.
 *
 * When TLS is enabled the server certificate is always verified (chain and
 * hostname). Servers using a private CA (e.g. AWS RDS, Azure, self-signed)
 * must provide that CA bundle via DB_SSL_CA_FILE instead of disabling checks.
 */
export function buildSslOptions({ ssl, sslCaFile }) {
  if (!ssl) return false;

  return {
    rejectUnauthorized: true,
    ...(sslCaFile ? { ca: readFileSync(sslCaFile, 'utf8') } : {}),
  };
}

export function createPool(dbConfig, logger = console) {
  const pool = new pg.Pool({
    host: dbConfig.host,
    port: dbConfig.port,
    database: dbConfig.database,
    user: dbConfig.user,
    password: dbConfig.password,
    ssl: buildSslOptions(dbConfig),
    max: 5,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
    statement_timeout: 10_000,
  });

  // An idle client losing its connection must not crash the process.
  pool.on('error', (error) => {
    logger.error('PostgreSQL pool error:', error.message);
  });

  return pool;
}

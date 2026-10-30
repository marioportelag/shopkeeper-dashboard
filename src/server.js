import { createApp } from './app.js';
import { ConfigError, loadConfig } from './config.js';
import { createPool } from './db.js';

const SHUTDOWN_TIMEOUT_MS = 10_000;

let config;
try {
  config = loadConfig();
} catch (error) {
  if (error instanceof ConfigError) {
    console.error(error.message);
    process.exit(1);
  }
  throw error;
}

const pool = createPool(config.db);
const app = createApp({ db: pool });

const server = app.listen(config.port, () => {
  console.log(`ShopKeeper Dashboard listening on http://localhost:${config.port}`);
});

function shutdown(signal) {
  console.log(`${signal} received, shutting down`);

  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS).unref();

  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);

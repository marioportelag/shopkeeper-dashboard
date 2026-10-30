export class ConfigError extends Error {
  /** @param {string[]} issues */
  constructor(issues) {
    super(`Invalid environment configuration:\n${issues.map((issue) => `  - ${issue}`).join('\n')}`);
    this.name = 'ConfigError';
    this.issues = issues;
  }
}

function parsePort(name, raw, fallback, issues) {
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    issues.push(`${name} must be an integer between 1 and 65535`);
  }
  return value;
}

function parseBoolean(name, raw, issues) {
  if (raw === undefined || raw === '' || raw === 'false') return false;
  if (raw === 'true') return true;
  issues.push(`${name} must be "true" or "false"`);
  return false;
}

/**
 * Reads and validates configuration from environment variables.
 * Fails fast with variable names only; values are never echoed back.
 */
export function loadConfig(env = process.env) {
  const issues = [];

  const required = (name) => {
    const value = env[name]?.trim();
    if (!value) issues.push(`${name} is required`);
    return value;
  };

  const config = {
    port: parsePort('PORT', env.PORT, 3000, issues),
    db: {
      host: required('DB_HOST'),
      port: parsePort('DB_PORT', env.DB_PORT, 5432, issues),
      database: required('DB_NAME'),
      user: required('DB_USER'),
      password: env.DB_PASSWORD,
      ssl: parseBoolean('DB_SSL', env.DB_SSL, issues),
      sslCaFile: env.DB_SSL_CA_FILE?.trim() || undefined,
    },
  };

  if (config.db.sslCaFile && !config.db.ssl) {
    issues.push('DB_SSL_CA_FILE requires DB_SSL=true');
  }

  if (issues.length > 0) throw new ConfigError(issues);
  return config;
}

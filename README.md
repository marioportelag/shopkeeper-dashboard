# ShopKeeper Dashboard

**A small server-rendered reporting dashboard: monthly business listings per broker, from PostgreSQL to chart and table.**

[![CI](https://github.com/marioportelag/shopkeeper-dashboard/actions/workflows/ci.yml/badge.svg)](https://github.com/marioportelag/shopkeeper-dashboard/actions/workflows/ci.yml)
![Node.js](https://img.shields.io/badge/Node.js-24-111827?style=flat-square&logo=nodedotjs&logoColor=5FA04E)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16%20%7C%2017-111827?style=flat-square&logo=postgresql&logoColor=4169E1)
![Express](https://img.shields.io/badge/Express-5-111827?style=flat-square&logo=express&logoColor=white)

This is a historical portfolio project, originally a short exercise from 2024, kept intentionally small. It
has since been revised to fix a cross-site scripting vulnerability, incorrect month aggregation and insecure
database TLS settings. It now has automated tests, CI and a one-command local environment.

---

## What it does

- Aggregates `deals` per broker site and **calendar month (year and month)**: listing count and average revenue.
- Renders a line chart (Chart.js) and a sortable, searchable table (DataTables) for a selectable period. The
  default period is Nov 2020 – Nov 2021.
- Validates the requested period (`?from=YYYY-MM&to=YYYY-MM`) and queries PostgreSQL with bind parameters only.

## Tech stack

| Area      | Choice                                                              |
| :-------- | :------------------------------------------------------------------ |
| Runtime   | Node.js 24 LTS (22.12+ supported), ES modules                       |
| Web       | Express 5, express-handlebars, helmet                               |
| Data      | PostgreSQL via `pg`                                                 |
| Front end | Chart.js, DataTables (served from npm packages, no CDNs, no jQuery) |
| Testing   | Node.js test runner (`node:test`), Supertest                        |
| Tooling   | ESLint, Prettier                                                    |
| Delivery  | Docker, Docker Compose, GitHub Actions, Dependabot                  |

## Project structure

```text
src/
├── server.js     # Bootstrap: config, connection pool, HTTP server, graceful shutdown
├── app.js        # Express app factory: routes, views, security headers, error pages
├── config.js     # Environment validation (fail-fast)
├── db.js         # PostgreSQL pool with verified TLS
├── listings.js   # Period parsing, SQL query, data shaping for chart and table
└── safe-json.js  # JSON serialization safe for embedding in HTML
views/            # Handlebars layout, dashboard and error pages
public/           # Stylesheet and the client script that renders chart and table
db/
├── schema.sql    # Tables and index used by the dashboard
└── seed.sql      # Deterministic fictional sample data (Sep 2020 – Jan 2022)
test/
├── *.test.js     # Unit and HTTP tests (no database needed)
└── integration/  # Real SQL against PostgreSQL (skipped when DB_HOST is unset)
```

`createApp({ db })` takes any object with a `pg`-compatible `query` method. HTTP tests pass a fake, and the
server passes a real connection pool.

## Getting started

### Option A: Docker Compose (recommended)

Starts PostgreSQL with the schema and sample data, plus the dashboard. The only prerequisite is Docker.

```bash
cp .env.example .env
```

Set `DB_PASSWORD` in `.env` to any value (the local database is created with it), then:

```bash
docker compose up --build
```

Open http://localhost:3000. The database port is not published to the host. To stop the stack and delete the
database volume:

```bash
docker compose down -v
```

### Option B: Node.js with your own PostgreSQL

**Prerequisites:** Node.js 22.12+ (see `.nvmrc`) and PostgreSQL 14+.

```bash
npm ci
```

```bash
cp .env.example .env
```

Edit `.env` with your connection details, then create the tables and, optionally, the sample data:

```bash
psql -h localhost -U shopkeeper -d shopkeeper -f db/schema.sql -f db/seed.sql
```

```bash
npm start
```

`npm run dev` restarts the server automatically on file changes.

## Configuration

| Variable         | Required | Default | Notes                                                              |
| :--------------- | :------- | :------ | :----------------------------------------------------------------- |
| `DB_HOST`        | **Yes**  | –       |                                                                    |
| `DB_NAME`        | **Yes**  | –       |                                                                    |
| `DB_USER`        | **Yes**  | –       |                                                                    |
| `DB_PASSWORD`    | No       | –       | Required by Docker Compose                                         |
| `DB_PORT`        | No       | `5432`  |                                                                    |
| `DB_SSL`         | No       | `false` | `true` enables TLS with full certificate and hostname verification |
| `DB_SSL_CA_FILE` | No       | –       | Path to a PEM CA bundle; requires `DB_SSL=true`                    |
| `PORT`           | No       | `3000`  | HTTP port                                                          |

The process exits at startup if a required variable is missing or a value is invalid.

### PostgreSQL TLS

TLS is either off (`DB_SSL=false`, suitable for a local database) or **fully verified**. The server
certificate chain and hostname are always checked, and there is no setting that skips verification.

- **Publicly trusted certificates:** set `DB_SSL=true`.
- **Private or cloud-provider CAs** (for example AWS RDS or Azure Database for PostgreSQL): download the
  provider's CA bundle and point `DB_SSL_CA_FILE` at it:

  ```bash
  DB_SSL=true DB_SSL_CA_FILE=/etc/ssl/certs/rds-global-bundle.pem npm start
  ```

- **Self-signed certificates:** use the CA that signed the server certificate as `DB_SSL_CA_FILE`, and make
  sure the certificate's hostname matches `DB_HOST`.

## Testing

| Command                    | Purpose                                                                                |
| :------------------------- | :------------------------------------------------------------------------------------- |
| `npm test`                 | Unit and HTTP tests (no database required)                                             |
| `npm run test:coverage`    | Same, with a coverage report                                                           |
| `npm run test:integration` | Runs the real query against PostgreSQL in a temporary schema (uses `DB_*` from `.env`) |
| `npm run lint`             | ESLint                                                                                 |
| `npm run format:check`     | Prettier check                                                                         |
| `npm run check`            | Format check, lint and unit tests                                                      |

The tests cover:

- **XSS prevention:** a `</script><script>…` payload and an HTML injection payload stored as broker names never
  appear raw in the page. They are HTML-escaped in the table and round-trip unchanged through the JSON data
  block. The page has no inline executable scripts, and the CSP limits scripts to `'self'`.
- **Date aggregation:** the same month in different years stays separate. Chart labels include the year,
  missing months are zero-filled, and range boundaries are half-open (first and last days included).
- **Chronological ordering:** across year boundaries, in both the SQL results and the rendered model.
- **Database errors:** a failing query returns a generic 503 page, and the underlying error is logged but
  never shown.
- **HTTP routes:** dashboard, custom periods, invalid periods (400, no query executed), empty state, health,
  404, allow-listed static vendor files and security headers.
- **Configuration:** fail-fast validation and TLS options, which always verify certificates.

## CI/CD

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on pushes to `main`, on pull requests, and manually:

1. **Verify:** `npm ci` → format check → lint → tests with coverage → `npm audit --audit-level=high` →
   Docker image build (not pushed).
2. **PostgreSQL integration:** a disposable PostgreSQL 17 service container. Runs the query integration tests,
   loads the schema and sample data, starts the app, and checks the rendered dashboard.

The workflow uses read-only permissions and commit-SHA-pinned actions, and it has no deployment step.
Dependabot proposes weekly dependency, Actions and base-image updates.

## Security considerations

- **No script injection from data:** chart data is embedded as `<script type="application/json">`, which is
  never executed, with `<`, `>`, `&`, U+2028 and U+2029 escaped. It is parsed with `JSON.parse` by a static
  script. Table values use Handlebars' HTML escaping.
- **Content Security Policy** (via helmet): scripts are allowed only from the app's own origin. Front-end
  libraries are served from pinned npm dependencies, and only from an explicit allow-list of files.
- **SQL:** a static query with bind parameters, and the user-supplied period is strictly validated first.
- **Database TLS:** verified certificates only. See [PostgreSQL TLS](#postgresql-tls).
- **Error handling:** clients see generic messages, while details go to the server log.
- **Container:** runs as the unprivileged `node` user with read-only application files and production
  dependencies only.

## Known limitations

- **No authentication.** The dashboard exposes aggregate business data to anyone who can reach it. Put it behind
  an authenticating proxy or add authentication before exposing it beyond a trusted network.
- **Reconstructed schema.** The original project did not include its database schema. `db/schema.sql` is the
  minimal schema implied by the query, and `db/seed.sql` contains fictional data.
- **No migrations tool.** The schema is applied with `psql` or by the Compose init scripts.
- **Currency-agnostic revenue.** Averages are shown as plain numbers with two decimals, with no currency or
  locale configuration.
- **Single page.** No pagination or caching on the server side. The query is bounded by a validated period of
  at most 120 months.
- **Logging** uses the console rather than structured logs.

## License

[MIT](LICENSE)

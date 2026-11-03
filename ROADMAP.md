# Roadmap

Planned work for ShopKeeper Dashboard. Nothing in this file is implemented yet unless marked as done.
Estimates are in hours of focused work and include tests and documentation for each item. They are
estimates, not commitments.

Each item will be tracked as a GitHub issue; links are added once the issues exist.

| Milestone                    | Items  | Estimate |
| :--------------------------- | :----: | -------: |
| v0.2 — Data and filters      |   4    |     16 h |
| v0.3 — Data management       |   3    |     18 h |
| v0.4 — Access and operations |   3    |     13 h |
| Quality (cross-cutting)      |   3    |      9 h |
| **Total**                    | **13** | **56 h** |

## v0.2 — Data and filters

### Filter by broker site — 4 h

A multi-select control lets the user restrict the dashboard to one or more broker sites, in addition to the
date range. The selection is part of the query string, so filtered views can be bookmarked.

- **Done when:** `?site=1&site=3` limits chart and table to those sites; unknown or malformed IDs return
  400 without running a query; the selection survives reloads; unit and integration tests cover it.

### Median and total revenue per month — 3 h

Add median revenue (`percentile_cont(0.5)`) and total revenue per site and month, alongside the existing
count and average.

- **Done when:** both columns appear in the table and the JSON chart data; values are checked against
  hand-computed results in a PostgreSQL integration test; null revenues are handled explicitly.

### Server-side sorting and pagination for the table — 6 h

Move sorting and paging of the table from DataTables (client side) to the server, with bounded page sizes.

- **Done when:** `?page=` / `?sort=` (allow-listed columns only) are validated; the page renders correctly
  without JavaScript; page size is capped; tests cover boundaries and invalid input. See the notes below
  on when this is worth doing.

### Export the period report to CSV — 3 h

A download link exports exactly the rows shown for the selected period and filters.

- **Done when:** `GET /report.csv` returns `text/csv` with a header row; values are escaped against CSV
  formula injection (`=`, `+`, `-`, `@`); output matches the HTML table for the same query in tests.

## v0.3 — Data management

### Versioned database migrations — 4 h

Replace the standalone `db/schema.sql` with versioned migrations (for example `node-pg-migrate`), applied by
an npm script, by Docker Compose and in CI.

- **Done when:** a fresh database reaches the current schema through migrations only; migrations run in
  CI before the integration tests; the README documents how to create and apply one.

### Basic CRUD for sites and deals — 8 h

Server-rendered list, create, edit and delete views for broker sites and deals, with server-side validation
and CSRF protection.

- **Done when:** all four operations work for both entities; invalid input re-renders the form with
  field-level errors; deleting a site with deals is either blocked or explicit; HTTP tests cover each
  route. Write routes stay disabled until authentication exists (see notes).

### Import deals from CSV — 6 h

Upload a CSV file of deals; every row is validated and the import reports errors per row.

- **Done when:** valid rows are inserted in one transaction (all-or-nothing, documented); the result page
  lists each rejected row with its line number and reason; file size and row count are capped; tests use
  fictional fixture files.

## v0.4 — Access and operations

### Simple authentication — 6 h

Session-based login for a single admin user to protect data-management routes.

- **Done when:** passwords are stored hashed (argon2 or bcrypt); sessions use secure, HTTP-only cookies;
  login is rate-limited; all write routes require a session; tests cover login, logout and access denial.

### Structured logging and a readiness check — 3 h

Replace console logging with `pino` (with redaction) and add a `/ready` endpoint that checks the database
connection. The existing `/health` endpoint stays a liveness check.

- **Done when:** logs are JSON with request IDs; credentials and cookies are redacted; `/ready` returns
  503 when the database is unreachable; the Docker healthcheck and README are updated.

### Year-over-year comparison in the chart — 4 h

Optionally overlay the same months of the previous year in the chart.

- **Done when:** a toggle adds the previous-year series; months without data in either year are handled;
  the comparison is covered by a multi-year integration test.

## Quality (cross-cutting)

### Integration tests for every new query — 3 h

Extend the PostgreSQL integration suite (already running in CI for the current query) to every query added
by the items above.

- **Done when:** each new SQL statement has an integration test with boundary cases, running in the CI
  PostgreSQL service job.

### Coverage threshold and report in CI — 2 h

Enforce a minimum line and branch coverage with the Node.js test runner and publish the report.

- **Done when:** CI fails below the agreed threshold; the coverage summary appears in the job summary.

### Basic accessibility of the UI — 4 h

Improve contrast, labels and keyboard navigation of the form, chart and table.

- **Done when:** form inputs have labels; colour contrast meets WCAG AA; the page is usable with the
  keyboard only; the chart has a text alternative (for example the table or a summary); an automated
  check such as axe reports no serious issues.

## Notes

Points where the original plan needed adjusting to fit the current code:

- **`/health` already exists** as a liveness endpoint without a database check. The item was reframed as a
  separate `/ready` endpoint, so liveness and readiness stay distinct.
- **Server-side pagination has limited value at current data sizes.** The table holds at most one row per
  site and month, so it stays small unless there are many sites. It becomes worthwhile together with CRUD,
  when data volume can grow. Consider doing it after v0.3.
- **CRUD before authentication would expose write routes.** Either do the authentication item before or
  together with CRUD, or keep write routes disabled by configuration until authentication lands.
- **Migrations should come first in v0.3,** because CRUD and CSV import will likely need schema changes
  (constraints, defaults).
- **Year-over-year comparison is a data feature** and could move to v0.2. It is kept in v0.4 to follow the
  original grouping.
- **PostgreSQL integration tests already run in CI** for the existing query. The quality item extends
  them; it does not introduce them.

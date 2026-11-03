# Contributing

Thanks for your interest. This is a small personal project; planned work is listed in
[ROADMAP.md](ROADMAP.md) and tracked in [GitHub issues](https://github.com/marioportelag/shopkeeper-dashboard/issues).
Please open or comment on an issue before starting larger changes.

## Run the project

The quickest way is Docker Compose, which starts PostgreSQL with the schema and fictional sample data:

```bash
cp .env.example .env
```

Set `DB_PASSWORD` in `.env`, then:

```bash
docker compose up --build
```

To run with Node.js 22.12+ against your own PostgreSQL instead, follow
[Getting started](README.md#getting-started) in the README.

## Checks

Before opening a pull request, run:

```bash
npm run check
```

That runs the Prettier check, ESLint and the unit and HTTP tests. If you change SQL, also run the
integration tests against a local PostgreSQL (they use the `DB_*` variables from `.env`):

```bash
npm run test:integration
```

CI runs all of the above, plus `npm audit` and a Docker build, on every pull request.

## Guidelines

- Keep pull requests small and focused on one change.
- Add or update tests with every behaviour change.
- Use only fictional data in seeds, fixtures and examples. Never commit real data, credentials or `.env`
  files.
- Update the README when behaviour or setup changes.

## Commit style

Commits follow [Conventional Commits](https://www.conventionalcommits.org/):

```text
<type>: <short summary in the imperative>
```

Common types: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `ci`, `build`. Add a body when the reason
for the change is not obvious from the summary.

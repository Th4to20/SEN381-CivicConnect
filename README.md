# CivicConnect

Community service request management platform (SEN381 project). CivicConnect gives requesters, staff and
management a single controlled record of every service request from submission to closure, with an
immutable audit trail. Baseline documents: `docs/PED/`, decisions in `docs/decisions/`.

**Current status (Milestone 2, bootstrap):** repository, schema/migrations, the FR-010 status-transition
service (transaction + audit + optimistic concurrency), centralised RBAC policy module, in-process event bus,
`/healthz` endpoint and CI are in place. **Not yet built:** authentication, request/staff/management screens
and routes, notifications beyond a logging stub, attachment storage.

## Runtime and dependency versions
| Item | Version |
|---|---|
| Node.js | 24 LTS target (`.nvmrc`); `engines` >= 22.9.0 (needed for `--env-file-if-exists`). Developed and tested here on 22.22 |
| Express / EJS / pg | 4.x / 3.x / 8.x (exact versions in `package-lock.json`) |
| PostgreSQL | 17 for local/CI; Neon-managed in production |
| Dev tooling | ESLint 9, Prettier 3, `node:test` |

## Prerequisites
Node.js (see above), npm, Git, and a PostgreSQL 17 database (Neon dev branch, or Docker for the local profile).

## Setup and run
```bash
git clone <repo-url> && cd civicconnect-root
npm ci
cp .env.example .env            # then edit values locally; .env is git-ignored

# Option 1 - local database via Docker (offline fallback profile)
POSTGRES_PASSWORD=<pick-a-local-value> docker compose -f docs/deployment/docker-compose.yml up -d
# put the same password in DATABASE_URL and MIGRATION_DATABASE_URL in .env

npm run migrate                 # applies src/db/migrations/*.sql with MIGRATION_DATABASE_URL
npm run dev                     # http://localhost:3000/healthz
```

## Testing and quality gates
| Command | What it does | CI status |
|---|---|---|
| `npm run build` | Syntax + import-resolution check of every module (JS has no compiler) | **Blocking** |
| `npm test` | Unit tests (domain rules, policy, transaction behaviour with a fake client) | **Blocking** |
| Secret scan | gitleaks over full history | **Blocking** |
| `npm run audit:deps` | `npm audit` fails on high/critical | **Blocking** (also nightly) |
| `npm run lint`, `npm run format:check` | Static analysis | Warn-only until M3 |
| `npm run test:integration` | Real-Postgres tests; needs `TEST_DATABASE_URL` (disposable DB). Skipped otherwise | Warn-only until stable |

Known limitation: the integration tests (rollback, concurrency, audit immutability) were written but have
**not yet been run against a live PostgreSQL** - run them before M2 sign-off.

gitleaks note: the official action is free for personal-account repos; a GitHub *organisation* repo needs a
`GITLEAKS_LICENSE` secret (free key from gitleaks.io). Otherwise replace that job with the CLI.

## Repository structure
```
.github/workflows/ci.yml          CI gates          .github/PULL_REQUEST_TEMPLATE.md   PR checklist
.github/CODEOWNERS                review ownership  render.yaml                        Render free-tier blueprint
docs/PED/ requirements/ risk/     controlled artefacts (PED v2.0 insert, RTM, risk register additions)
docs/architecture/data-model.md   ERD + persistence decisions
docs/decisions/                   ADR-001 transactions, ADR-002 stack, ADR-003 deployment
docs/change/CR-001-*.md           change request (two-reviewer variation)
docs/deployment/                  docker-compose fallback, keep-alive notes
src/config/                       environment-based configuration
src/db/                           pool, migration runner, migrations/ (001 schema, 002 audit permissions)
src/domain/                       pure business rules (status transitions)
src/services/                     application services (FR-010 transaction)
src/auth/policies.js              centralised RBAC policy layer (FR-015)
src/events/eventBus.js            in-process event dispatch (post-commit)
src/routes/, app.js, server.js    HTTP layer
tests/unit/, tests/integration/   automated verification
```

## Design in one paragraph
Status changes run in **one transaction** covering the status update and the audit entry; the database
enforces structure (FKs, controlled values, append-only audit permissions); the service enforces workflow and
role rules; concurrent edits are caught by a `row_version` check; events are published only after commit.
See ADR-001.

## Git workflow
One issue per unit of work -> branch `feat/FR-XXX-name` or `fix/RSK-XXX-name` from `main` -> small PR using the
template -> one non-author approval (variation requested in `docs/change/CR-001`) + green required checks ->
squash merge with the issue/requirement ID in the message. Never commit `.env` or credentials.

# ADR-003: Deployment direction (free tier)

| Field | Value |
|---|---|
| Status | Proposed - M2 baseline |
| Date | 2026-09-29 |
| Related | NFR-009, NFR-002, NFR-003, RSK-001, M1 Forward Considerations 1 and 5 |

## 1. Decision
Web tier on **Render Free web service**; database on **Neon Free Postgres**; offline **docker-compose** profile as the guaranteed demo fallback. CI on GitHub Actions. No deployment automation yet (deferred to M3).

## 2. Facts this rests on (vendor documentation, checked 2026-09-29 - re-verify at each milestone)
| Fact | Implication |
|---|---|
| Render Free web services spin down after 15 minutes without inbound traffic; spin-up takes up to about a minute | NFR-003 (<= 2 s) cannot hold on the first request after idle: state this as an accepted, measured exception and use keep-alive only in demo windows |
| Render Free gives 750 instance hours/month; exceeding suspends free services | Do not run permanent pings; window-based only |
| Render filesystem is ephemeral | No local file storage; attachments (FR-001) need an external store or are deferred |
| Render Free Postgres expires after 30 days | **Not used** - this is why the database is Neon |
| Neon Free: 0.5 GB storage and 100 CU-hours per project per month; compute scales to zero after 5 minutes (cannot be disabled), resuming in a few hundred ms | Ample for the data volume; the first query after idle is slower; use the pooled (`-pooler`) connection string |

## 3. Configuration, secrets, state, networking
- All config via environment variables (`.env.example`); real values set only in the Render dashboard / local `.env` (git-ignored); secret scanning is a blocking CI gate.
- Two DB credentials: an **owner** URL used only for `npm run migrate` from a developer machine, and a **restricted login role** (member of `civicconnect_app`, no UPDATE/DELETE on `audit_entries`) used by the running app. Create the login role manually in Neon: `CREATE ROLE civicconnect_web LOGIN PASSWORD '<generate>' IN ROLE civicconnect_app;`
- The app is stateless apart from the database (relevant to the deferred session-vs-token decision).
- TLS to Neon is required (`sslmode=require` in the connection string).

## 4. Risks
RSK-001 (quota / cold start), RSK-010 (Render spin-up vs NFR-003), RSK-011 (Neon storage/compute caps). Fallback: `docs/deployment/docker-compose.yml` runs the database locally and the app via `npm start`.

## 5. Deliberately deferred
CD pipeline and environment promotion; attachment storage provider; backup/restore drill (Neon Free offers only short instant-restore history - take manual `pg_dump` before assessments); load test for NFR-003.

# ADR-002: Technology stack

| Field | Value |
|---|---|
| Status | Proposed - **requires confirmation by both team members before baseline** |
| Date | 2026-09-29 |
| Requirements / ASRs | NFR-009 (free tier), NFR-002/003 (availability, response time), NFR-004 (security), FR-015 (RBAC), FR-010 (transactions), RSK-001, RSK-003 |
| Fulfils | DEC-003 (M1 deferred stack selection to M2) |

## 1. Decision
| Layer | Choice | Version target* |
|---|---|---|
| Runtime / backend | Node.js (LTS) + Express | Node 24 LTS (`.nvmrc`), engines >= 22.9; Express 4.x |
| Frontend | Server-rendered EJS templates + plain CSS/JS, responsive (DEC-001) | EJS 3.x |
| Persistence | PostgreSQL via `pg` with plain SQL migrations (no ORM) | Postgres 17 (local/CI), Neon-managed in production |
| Test / CI | `node:test`, ESLint 9, Prettier 3, GitHub Actions, gitleaks | - |
| Hosting | Render Free web service + Neon Free Postgres | see ADR-003 |

\*Confirm exact versions against the official release schedules on sign-off day; record them in the README.

## 2. Options
- **A. Node.js + Express + EJS + PostgreSQL** (chosen)
- **B. ASP.NET Core (Razor Pages) + EF Core + PostgreSQL** - the stack Assignment 2's examples assumed
- (Rejected outright) Any option needing paid SQL Server / Azure SQL: violates NFR-009.

## 3. Weighted comparison (draft scores 1-5; team to adjust and defend)
| Criterion | Weight | A: Node/Express/EJS | B: ASP.NET/EF Core |
|---|---|---|---|
| Team capability / learning-curve risk (RSK-003) | 25 | 5 | 4 |
| Free-tier deployability and cold-start behaviour (RSK-001) | 25 | 5 | 3 |
| Fit for RBAC, transactions, concurrency (FR-015, FR-010) | 20 | 4 | 5 |
| Security ecosystem / maintainability | 15 | 4 | 5 |
| Testability and CI cost (free runner minutes) | 10 | 4 | 4 |
| Continuity with A2 tooling examples | 5 | 3 | 5 |
| **Weighted total** | 100 | **4.45** | **4.15** |

**Sensitivity:** even if B's capability score is raised to 5, B totals 4.40 vs 4.45. The result is driven by deployability, not by preference: Render runs Node natively on its Free tier, whereas .NET would need a Docker image, longer builds (Render meters build pipeline minutes) and a heavier spin-up on top of the ~1 minute Free-tier spin-up. **If the team's real C# strength is materially higher than its Node strength, this ADR must be revisited** - capability is the assumption most worth challenging.

## 4. How the stack meets the learning-curve and RBAC needs
- **Learning curve (RSK-003):** one language across server, templates and tests; no ORM to learn (SQL is explicit, which also makes the transaction boundary in ADR-001 visible); fewer moving parts to explain in the individual defence.
- **RBAC (FR-015, NFR-004):** authorisation is centralised in `src/auth/policies.js` (`can(user, action)` + `authorize(action)` middleware) - the Node translation of A2's policy-based authorisation layer - so no controller contains `if (role === ...)`. Passwords are stored hashed (Argon2id/bcrypt to be selected in the auth ADR); direct-URL access by the wrong role returns 403 (RTM FR-015 acceptance criterion).
- **Change/extension (A2 Task 1):** Node `EventEmitter`-based in-process bus keeps the Observer intent with minimal boilerplate.

## 5. Risks and consequences
- Weaker compile-time safety than C# - mitigated by ESLint, the build check, unit tests and small PRs.
- Ecosystem/dependency risk (npm) - mitigated by lockfile, `npm ci`, `npm audit` gate and Dependabot alerts.
- Express 4 vs 5 and Node LTS dates change - verify on sign-off (open item).
- Deliberate difference from A2's C# examples is documented in ADR-001 s3 and must be explainable in the defence (indicative question 8).

## 6. Open items
Auth/session approach (stateless JWT vs server sessions - M1 Forward Consideration 4) and password-hash library are deferred to a follow-up ADR.

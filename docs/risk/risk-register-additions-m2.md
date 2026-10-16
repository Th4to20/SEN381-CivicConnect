# Risk Register additions (M2) - scored Probability (1-3) x Impact (1-3)

| ID | Risk and root cause | P x I | Mitigation | Contingency | Owner |
|---|---|---|---|---|---|
| RSK-009 | Lost update / silent overwrite: two staff change the same request; or a future writer forgets to bump `row_version` | 2 x 3 = 6 | Optimistic concurrency in UPDATE predicate; all writes via services; concurrency tests | Inform user, reload and retry (409); add DB bump trigger via new ADR | Thato |
| RSK-010 | Render Free spin-down (15 min idle, up to ~1 min spin-up) breaches NFR-003 / fails a live demo | 3 x 2 = 6 | Window-based keep-alive on `/healthz`; warm up before demos | Run docker-compose fallback locally | Thato |
| RSK-011 | Neon Free caps (0.5 GB, 100 CU-hours) or scale-to-zero latency | 1 x 2 = 2 | Monitor usage; small data; pooled connection | Local Postgres fallback; restore from `pg_dump` | Thato |
| RSK-012 | Stack choice (Node vs C#) is challenged, or team capability is lower than assumed, mid-milestone | 2 x 2 = 4 | ADR-002 scores, sensitivity and revisit trigger; small vertical slices first | Controlled change to ADR-002 (supersede, keep history) | Both |
| RSK-013 | Two-reviewer rule cannot be met by a two-person team; reviews become nominal | 3 x 2 = 6 | CR-001 escalation; small PRs, PR cap, checklist, required CI checks, stale-approval dismissal | Lecturer-approved variation recorded | Thato |
| RSK-014 | Integration tests (rollback, audit permissions) not yet proven on a real database; false confidence from mocked unit tests | 2 x 3 = 6 | Run `npm run test:integration` against a Neon dev branch or docker-compose DB before sign-off; promote gate once stable | Treat ADR-001 verification as partial until run | Thato |

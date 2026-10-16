# ADR-001: Transaction boundary and validation responsibility for status changes

| Field | Value |
|---|---|
| Status | Proposed - for M2 baseline sign-off (PED v2.0) |
| Date | 2026-09-29 |
| Deciders | Thato Goqo (Technical Lead for M2), Daluvuyo Magagane |
| Requirements | FR-010, FR-005, FR-009, NFR-004, NFR-005, NFR-006 |
| Evidence | Assignment 2 s2.1-2.4 (Task 2), Härder & Reuter (1983), Gray & Reuter (1993), OWASP (2021) |
| Supersedes | none |

## 1. Context (the actual problem)
A staff member changing a request's status looks like one action but is three things that must agree:
the status changes, an audit entry records who/when/old/new (NFR-005), and the requester is told (FR-005).
Assignment 2 identified four failure modes: partial write A (status without audit), partial write B
(audit without status), lost update (two staff, second overwrites first), and a side effect firing
before the transaction commits. Any of these recreates the M1 problem (weak accountability, no trustworthy record).

## 2. Options considered
| | **A - application orchestrates** | **B - database enforces** |
|---|---|---|
| Rules live in | Service layer; DB constraints as backstop | Stored procedure + audit trigger |
| Atomicity | One explicit transaction in one function | Inside procedure/trigger scope |
| Unit-testable without DB | Yes (pure transition rules; fake client) | No |
| Visible in PR review | Yes | Only via migrations; triggers are invisible to app readers |
| Team capability | Existing application-code skills | Needs stronger PL/pgSQL |
| Bypass by other writers | Weaker (constraints only) | Stronger |

## 3. Decision
**Approach A, hardened with database constraints and an optimistic-concurrency token.**

1. **Service layer** (`src/services/statusTransitionService.js`) owns workflow and authorisation. One `BEGIN ... COMMIT` covers the status `UPDATE` **and** the `audit_entries` `INSERT`.
2. **Database** owns structural rules only: FKs, NOT NULL, CHECKs, controlled reference tables for `roles`, `request_categories`, `request_statuses` (NFR-006), and an audit table the app role cannot UPDATE/DELETE (permission grants in `002_audit_permissions.sql`, plus a guard trigger that only refuses mutation and contains no business logic).
3. **Concurrency**: `service_requests.row_version` (bigint). The `UPDATE` predicate includes `row_version = $expected`; zero rows affected raises `ConcurrencyConflictError` (HTTP 409, "reload and retry"). Chosen over pessimistic locking because conflicts are rare but costly, and locks would be held across a user round-trip.
4. **Validation layers** (defence in depth): UI validates for usability only; the service validates transition legality (`src/domain/statusTransitions.js`) and role permission (`src/auth/policies.js`); the database rejects structurally invalid rows. Validation is never client-only (OWASP, 2021).
5. **Side effects after commit**: the `request.status_changed` event is published on the in-process bus only after `COMMIT`. The audit write is **not** placed on the bus.
6. **Caching**: none for status reads (staleness would defeat the visibility requirement). Revisit for management aggregates only if measured slow.

### Deliberate departure from Assignment 2 wording (evidence for the defence)
A2 was written around EF Core (`SaveChanges` implicit transaction, `rowversion`, `DbUpdateConcurrencyException`). The stack ADR (ADR-002) selects Node.js + `pg`, so the **decision is unchanged but the mechanism is translated**: an explicit transaction replaces the implicit one, and an explicit `row_version` counter replaces SQL Server `rowversion` (PostgreSQL has no such type). The A2 conclusion (atomicity around the business operation, optimistic concurrency, notify after commit) is technology-independent and is what was carried over.

## 4. Consequences
**Benefits:** the four failure modes are each closed by a specific mechanism and a specific test; rules are reviewable in PRs; the transition logic is unit-testable in milliseconds.
**Costs / trade-offs:** rules are enforceable only for writers that go through the service (mitigated by constraints + audit permissions); developers must remember to add every audited change into the same transaction (mitigated by PR checklist and the integration tests); the counter must be incremented by every writer of `service_requests` (see residual risk).
**Residual risk:** a future code path that updates `service_requests` without bumping `row_version` would silently defeat concurrency control. Mitigation: all writes go through services; consider a DB trigger that bumps `row_version` if a second writer path is ever added (would need a new ADR).

## 5. Verification evidence
| Failure mode | Test |
|---|---|
| Partial write A | Unit: "audit insert failure rolls back the status update"; integration: commit writes both |
| Partial write B | Same transaction; unit test asserts no `COMMIT` when either statement fails |
| Lost update | Unit + integration: stale `row_version` returns `CONCURRENCY_CONFLICT` |
| Side effect too early | Unit: publish index is after `COMMIT`; none on failure |
| Audit tampering | Integration: UPDATE/DELETE on `audit_entries` rejected |

## 6. If this decision changed, these artefacts change
PED v2.0 data model and validation sections; RTM rows FR-010, FR-005, NFR-005, NFR-006; `001/002` migrations; `statusTransitionService.js` and its tests; Risk Register RSK-009.

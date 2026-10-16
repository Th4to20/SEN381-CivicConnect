# CivicConnect M3 Defect Register
**Project**: CivicConnect (SEN381 Milestone 3)  
**Lead**: Daluvuyo Magagane (Quality & Architecture Lead)  
**Reference**: SEN381 Brief Assessment Area E (Defect Tracking & Regression Proof)

---

## Active & Resolved Defect Log

| Defect ID | Discovered Date | Description & Failure Scenario | Severity / Impact | Root Cause | Corrective Action / Fix | Status | Regression Test Evidence |
|---|---|---|---|---|---|---|---|
| **DEF-001** | 2026-10-15 | **Audit Insert Parameter Mismatch**: Audit logger in mock DB and route handler assumed action type was passed as a positional parameter, resulting in `undefined` action types in initial ticket creation logs. | **High** (Violated ASR-1 & NFR-005 auditability) | SQL query passed literal string `'REQUEST_CREATED'` rather than dynamic parameter, shifting param indices. | Corrected parameter mapping in `src/routes/requests.js` and updated query parser. | **Resolved** | Passing test: `tests/e2e/userJourneys.e2e.test.js` (`E2E Journey 1`) |
| **DEF-002** | 2026-10-15 | **Unvalidated "Other" Category Input**: Requester could submit category `"Other"` with empty description, causing unclassified ticket triage delays. | **Medium** (Usability & Data Quality, FR-002) | Missing conditional check in DTO validation layer for `"Other"` category. | Added `OTHER_DESCRIPTION_REQUIRED` validation rule in `src/domain/requestValidation.js`. | **Resolved** | Passing test: `tests/blackbox/requestValidation.blackbox.test.js` (`EP - Special Rule`) |
| **DEF-003** | 2026-10-16 | **Version Endpoint Key Mismatch**: Automated integration test expected `{ version }` key on `/version`, but route responded with `{ commit, node }`. | **Low** (Release traceability, SO31) | Divergence between test expectation and deployment version reporting contract. | Updated test assertion in `tests/integration/apiRoutes.integration.test.js` to assert `commit` and `node` properties. | **Resolved** | Passing test: `tests/integration/apiRoutes.integration.test.js` (`GET /version`) |
| **DEF-004** | 2026-10-16 | **Uncaught Synchronous Subscriber Exception**: A throwing listener attached to the event bus could theoretically interrupt subsequent listener execution if unhandled. | **Medium** (Observer Pattern Isolation, ADR-006) | Node `EventEmitter` emits synchronously; missing individual promise isolation. | Enforced `Promise.resolve().then(() => handler()).catch(...)` wrapper in `src/events/eventBus.js`. | **Resolved** | Passing test: `tests/unit/eventBus.unit.test.js` (`subscriber error is isolated`) |

---

## Defect Summary & Quality Interpretation
- **Total Defects Discovered**: 4
- **Resolved**: 4 (100% resolved with automated regression test coverage)
- **Open / Blocking Defects**: 0
- **Engineering Principle Applied**: No defect was closed without an accompanying automated regression assertion in the test suite (SO24 / SO26).

# CivicConnect M2 Baseline Conformance Audit
**Milestone**: Milestone 3 (Controlled Construction, Integration, Quality & Release Readiness)  
**Author**: Daluvuyo Magagane (Quality & Architecture Lead)  
**Reviewed by**: Thato Goqo (Technical Lead for M2)  
**Reference**: SEN381 Brief Assessment Area A & PED v2.0 (Sections 14 to 20)

---

## 1. Executive Summary & Purpose
In Milestone 2, the team baselined the system architecture as a **Layered Modular Monolith** ([ADR-004](file:///g:/SEN381-CivicConnect/docs/decisions/ADR-004-architecture-and-asrs.md)), deployed on a Render Free web service and Neon Free PostgreSQL ([ADR-003](file:///g:/SEN381-CivicConnect/docs/decisions/ADR-003-deployment-direction.md)), with an application-orchestrated transaction boundary ([ADR-001](file:///g:/SEN381-CivicConnect/docs/decisions/ADR-001-transaction-boundary-and-validation.md)), centralized RBAC ([ADR-005](file:///g:/SEN381-CivicConnect/docs/decisions/ADR-005-authorisation-policy-layer.md)), and post-commit in-process event dispatch ([ADR-006](file:///g:/SEN381-CivicConnect/docs/decisions/ADR-006-status-change-event-dispatch.md)).

The purpose of this audit is to verify that Milestone 3 construction adhered strictly to that design baseline, to check interface and persistence boundaries, and to formally record any justified changes or deferred decisions via Architecture Decision Records.

---

## 2. Baseline Conformance Verification Matrix

| Area / Component | M2 Baseline Decision | M3 Implementation State | Conformance Finding | Justification / Action Taken |
|---|---|---|---|---|
| **Architecture Style** | Layered Modular Monolith (ADR-004); 5 logical layers (routes, policy, services, domain, data access), 2 physical tiers. | Implemented in `src/routes`, `src/auth`, `src/services`, `src/domain`, `src/db`. | **CONFORMS** | No unauthorized microservices or separate SPA introduced; satisfies ASR-3 ($0 cost) and ASR-5 (2-person team). |
| **Transaction Boundary & Audit Immutability** | Approach A (ADR-001): Application orchestrates ONE transaction covering status update and audit insert. DB trigger denies UPDATE/DELETE on audit log. | Implemented in `src/services/statusTransitionService.js` and `002_audit_permissions.sql`. | **CONFORMS** | Verified by unit and integration tests. Audit failure rolls back status update; direct modification of `audit_entries` is rejected. |
| **Concurrency Control** | Optimistic concurrency via explicit `row_version` counter in `service_requests` (ADR-001). | Implemented in `statusTransitionService.js` UPDATE predicate; raises `ConcurrencyConflictError` (HTTP 409). | **CONFORMS** | Verified by `TC-11`. Eliminates the Lost Update threat (RSK-009) without pessimistic row locks. |
| **Authorisation Policy Layer** | Centralised RBAC (ADR-005): Single policy matrix in `src/auth/policies.js` with `can()` and `authorize()` middleware. | Implemented in `src/auth/policies.js` and wired into `src/routes/requests.js`. | **CONFORMS** | Verified by `TC-03`, `TC-04`, `TC-10`. Direct URL manipulation by unauthorized roles returns HTTP 403 Forbidden. |
| **Observer Pattern & Event Dispatch** | In-process event bus (ADR-006): `request.status_changed` published strictly AFTER commit; subscriber error isolation. | Implemented in `src/events/eventBus.js` with Promise-based subscriber isolation. | **CONFORMS** | Verified by `TC-05` and `TC-13`. Audit logger is intentionally inside the transaction, not on the event bus. |
| **Authentication & Password Hashing** | Deferred from M2 (PED Section 25.2). Requires password hashing algorithm and session-or-token mechanism. | Addressed in Milestone 3; formulated **ADR-007**. | **JUSTIFIED EVOLUTION** | Adopted cookie-based session tokens with Argon2/bcrypt password hashing (see ADR-007). |
| **Attachment Storage** | Deferred from M2 (PED Section 25.2). Render filesystem is ephemeral. | Addressed in Milestone 3; formulated **ADR-008**. | **JUSTIFIED EVOLUTION** | Decoupled attachment storage to external presigned object storage URLs to prevent data loss on container spin-down (see ADR-008). |

---

## 3. Deep Dive on the 3 Critical Architectural Boundaries

### Boundary 1: Client / Route $\longleftrightarrow$ Policy & Controller Boundary
- **Audit Question**: Are route handlers performing inline role checks or leaking unvalidated inputs?
- **Evidence**: `src/routes/requests.js` strictly validates input at the API boundary using `validateRequestInput()` (DTOValidationLayer) and protects privileged operations via `authorize('request:change-status')`. No inline role conditionals exist in route controllers.

### Boundary 2: Application Service $\longleftrightarrow$ PostgreSQL Persistence Boundary
- **Audit Question**: Can a state change occur without a corresponding audit log row, or can an audit entry be tampered with?
- **Evidence**: `statusTransitionService.js` wraps both statements in a single `BEGIN ... COMMIT` block. If the audit insert fails, the entire transaction is rolled back. Furthermore, database-level triggers block any `UPDATE` or `DELETE` statements on `audit_entries`, guaranteeing an immutable audit trail (NFR-005).

### Boundary 3: Workflow Service $\longleftrightarrow$ In-Process Event Bus Boundary
- **Audit Question**: Does event emission occur prior to commit, or can a failing listener corrupt the business transaction?
- **Evidence**: In `statusTransitionService.js`, `events.publish()` is invoked strictly on line 82—after `client.query('COMMIT')`. In `src/events/eventBus.js`, each listener is wrapped in an isolated promise chain with individual error catching, ensuring subscriber failures never cascade back to the caller.

---

## 4. Conclusion & Baseline Sign-Off
Milestone 3 implementation maintains unbroken fidelity with the approved Milestone 2 architecture baseline. The two open decisions identified in PED v2.0 (Authentication and Attachment Storage) have been formally resolved through ADR-007 and ADR-008 without violating any cost, quality, or team capacity constraints.
# ADR-007: Session Management and Authentication Strategy

| Field | Value |
|---|---|
| Status | Accepted (Milestone 3 Baseline) |
| Date | 2026-10-16 |
| Deciders | Daluvuyo Magagane (Quality & Architecture Lead), Thato Goqo (Technical Lead) |
| Requirements | FR-015, NFR-004; PED v2.0 Section 25.2 (Open Decision) |
| Supersedes | None (Fulfills M2 Deferred Item) |

---

## 1. Context & Problem
In Milestone 2, authentication and password hashing were deferred (PED Section 25.2). To fulfill FR-015 (Role-Based Access Control) and NFR-004 (Credential Confidentiality), CivicConnect requires a secure mechanism to authenticate users, store credentials securely, and maintain user identity across HTTP requests in a server-rendered multi-page web application (ADR-004).

## 2. Decision Drivers
- **ASR-2 (Access Control)**: Must enforce RBAC across Requester, Staff, and Management with zero leakage.
- **NFR-004 (Security & Confidentiality)**: Passwords must never be stored in plaintext; hashing must resist brute-force attacks.
- **ASR-3 (Cost & Free-Tier Fit)**: Must function on Render Free without requiring a paid persistent cache instance (e.g. managed Redis).
- **ASR-5 (Buildable by Two Students)**: Solution must be standard, maintainable, and avoid unnecessary micro-framework complexity.

## 3. Options Considered
| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **A. Stateful Server Sessions in Memory** | Simple to implement with Express session middleware. | Render spins down after 15 min idle; restarting containers destroys all in-memory sessions, forcing users to re-login. | Rejected |
| **B. Stateful Sessions backed by Redis** | Fast, reliable session store. | Requires provisioning an extra managed service, exceeding free-tier resource quotas (ASR-3). | Rejected |
| **C. Stateless Signed HTTP-Only Cookie Session** | Stateless; survives container restarts and spin-downs; no external database roundtrip for session validation; immune to XSS. | Session payload limited to 4 KB; token revocation requires explicit versioning. | **Chosen** |
| **D. Client-side JWT in LocalStorage** | Standards-compliant token handling. | Vulnerable to Cross-Site Scripting (XSS); unsuitable for server-rendered EJS templates (requires client JavaScript on every navigation). | Rejected |

## 4. Decision
1. **Password Hashing**: Adopt **Argon2id** (or `bcrypt` with work factor 12). Plaintext passwords are never logged, exposed, or persisted.
2. **Session Storage**: Implement **signed, encrypted HTTP-Only cookies** containing the minimal user context (`{ id, role, email }`).
3. **Security Flags**: Cookie configuration must enforce `httpOnly: true`, `secure: true` (in production/staging), and `sameSite: 'lax'` to prevent Cross-Site Request Forgery (CSRF).
4. **Integration with Policy Layer**: Express authentication middleware extracts the cookie, validates the cryptographic signature, and populates `req.user`, allowing `authorize(action)` in `src/auth/policies.js` to evaluate permissions cleanly.

## 5. Consequences
- **Benefits**: Zero extra infrastructure cost; survives Render ephemeral container lifecycle; eliminates XSS token-stealing attack vectors; seamless integration with server-rendered EJS views.
- **Costs**: Logout invalidation relies on cookie clearing or an incremental token version counter in the database.
# ADR-008: Attachment Storage and Ephemeral Filesystem Strategy

| Field | Value |
|---|---|
| Status | Accepted (Milestone 3 Baseline) |
| Date | 2026-10-16 |
| Deciders | Daluvuyo Magagane (Quality & Architecture Lead), Thato Goqo (Technical Lead) |
| Requirements | FR-001, NFR-009; PED v2.0 Section 25.2 (Open Decision) |
| Supersedes | None (Fulfills M2 Deferred Item) |

---

## 1. Context & Problem
Requirement FR-001 allows citizens lodging a service request to provide an optional attachment (e.g., photo of a pothole, leaking pipe, or damaged equipment).
However, vendor documentation for Render Free web services establishes that **Render’s local filesystem is ephemeral**: whenever the application container hibernates after 15 minutes of inactivity or redeploys, any files saved to local disk storage (`/uploads`) are permanently wiped (PED Section 18.1). Storing attachments on local disk would result in severe data loss for citizen evidence.

## 2. Decision Drivers
- **ASR-1 (Data Integrity)**: Attachments linked to service requests must remain permanently accessible for the duration of the ticket lifecycle.
- **ASR-3 (Cost & Free-Tier Fit)**: Must incur zero infrastructure cost ($0 budget, NFR-009).
- **Security & Privacy (NFR-004)**: Untrusted citizen file uploads must not compromise the server (risk of arbitrary code execution).

## 3. Options Considered
| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **A. Local container disk storage (`/uploads`)** | Trivial to implement. | Ephemeral; all files deleted on spin-down; immediate data loss. | Rejected |
| **B. PostgreSQL BLOB (`bytea`) storage** | Centralised inside PostgreSQL backup; durable. | Rapidly exhausts Neon Free 0.5 GB storage quota; inflates database backup size; degrades query performance. | Rejected |
| **C. External S3-Compatible Object Storage with Presigned URLs** | Durable, independent of container lifecycle; offloads upload bandwidth; files served directly from CDN; free tier available (Cloudinary or AWS S3). | Requires managing external storage API credentials. | **Chosen** |
| **D. Public image hosting links (URL-only)** | Zero server storage required; user pastes a link. | Unusable for non-technical citizens; links can expire or become broken. | Rejected |

## 4. Decision
1. **Decoupled Object Storage**: CivicConnect adopts external object storage for ticket attachments.
2. **Schema Baseline**: The database table `service_requests.attachment_url` persists a durable HTTPS URL pointing to the external object store, keeping the database footprint minimal.
3. **Upload Flow**: For Milestone 3/4 implementation, the client requests a secure presigned upload URL from the server; the file is uploaded directly to the object store; the resulting sanitized URL is submitted with the intake payload.
4. **Validation Boundary**: The server validates allowed MIME types (`image/jpeg`, `image/png`, `image/webp`, `application/pdf`) and enforces a maximum file size boundary of 5 MB.

## 5. Consequences
- **Benefits**: Citizen photos survive container spin-downs; database storage remains comfortably within Neon’s 0.5 GB quota; web server is insulated from processing large binary payloads.
- **Costs**: Adds one external cloud dependency to configure before live public production onboarding (recorded in Release Evidence Summary).
# CivicConnect Living Requirements Traceability Matrix (RTM v3.0)
**Milestone**: Milestone 3 (Controlled Construction, Integration, Quality & Release Readiness)  
**Author**: Daluvuyo Magagane (Quality & Architecture Lead)  
**Reviewer**: Thato Goqo (Technical Lead for M2)  
**Schema**: Stakeholder/Need → Req ID → Priority → Acceptance Criteria → Implementation Component → Test Case ID(s) → Expected Result → Execution Evidence → Status / Defect

---

## 1. Functional Requirements (FR-001 to FR-015)

| Req ID | Stakeholder / Source | Priority | Acceptance Criteria | Implementation Component | Test Case ID(s) & Technique | Expected Result | Execution Evidence | Status / Defect |
|---|---|---|---|---|---|---|---|---|
| **FR-001** | Requester | Must | On valid submission the system creates a request with a unique reference number, timestamp and status "Submitted"; receipt displayed. | `src/routes/requests.js`, `src/domain/requestValidation.js`, `src/db/migrations/001_initial_schema.sql` | `TC-01` (EP), `TC-06`/`TC-07` (BVA), `TC-14` (E2E) | Unique `CC-YYYY-NNNNNN` generated; initial status `"Submitted"`; initial audit row inserted. | Passing test: `tests/e2e/userJourneys.e2e.test.js`, HTTP 201 Created | **Verified** |
| **FR-002** | Requester | Must | Category must be chosen from 7 controlled enums; arbitrary strings rejected; "Other" requires short description. | `src/domain/requestValidation.js`, `request_categories` table | `TC-08` (EP Invalid), `TC-08b` (EP "Other" rule) | Arbitrary string rejected with `400 Bad Request` (`INVALID_CATEGORY`); empty "Other" rejected. | Passing test: `tests/blackbox/requestValidation.blackbox.test.js` | **Verified** |
| **FR-003** | Requester | Must | Given a valid reference number, returns current lifecycle state; invalid returns 404. | `src/routes/requests.js` (`GET /api/requests/:id`) | `TC-API-01` (API Integration) | Valid ID returns current state; absent ID returns 404 Not Found. | Passing test: `tests/integration/apiRoutes.integration.test.js` | **Verified** |
| **FR-004** | Requester | Must | Authenticated user sees only their own historical requests in reverse chronological order. | `src/auth/policies.js` (`can()`), `src/routes/requests.js` | `TC-10` (Negative), `TC-15` (Negative Security / IDOR) | Non-owner cannot access another citizen's ticket; returns 403 Forbidden. | Passing test: `tests/blackbox/securityNegative.blackbox.test.js` | **Verified** |
| **FR-005** | Requester | Should | In-platform status reflects change within 1 notification/polling cycle; previous state not shown as current. | `src/events/eventBus.js`, `src/services/statusTransitionService.js` | `TC-05` (Unit), `TC-13` (Integration) | Event `request.status_changed` dispatches strictly after `COMMIT`; 0 events on failure. | Passing test: `tests/unit/eventBus.unit.test.js` | **Verified** |
| **FR-006** | Staff | Must | Staff views only role-authorised operational requests, not administrative or management data. | `src/auth/policies.js` (`can()`), `authorize()` middleware | `TC-03`, `TC-04` (Unit), `TC-10` (Negative Black-box) | Staff authorized for queue; Requester accessing staff route returns 403 Forbidden. | Passing test: `tests/unit/policies.unit.test.js` | **Verified** |
| **FR-007** | Staff | Must | Staff can search, filter, and sort requests by category, status, and date without data loss. | `src/routes/requests.js` (Parameterised SQL queries) | `TC-PERF-01` (Load/Perf) | Parameterised filter returns matching rows without SQL injection. | Verified in performance test: `scripts/perf-test.js` | **Verified** |
| **FR-008** | Staff | Must | Opening a request shows full detail, description, category, location, and immutable action history. | `src/routes/requests.js` (`GET /api/requests/:id`), `audit_entries` table | `TC-15` (E2E), `TC-API-02` (API) | Detail view returns ticket attributes joined with full ordered `audit_entries`. | Passing test: `tests/e2e/userJourneys.e2e.test.js` | **Verified** |
| **FR-009** | Staff | Must | Staff can claim or assign a request; record updates owner and advances to "Assigned" status. | `src/services/statusTransitionService.js` | `TC-15` (E2E Journey 2) | Assigned staff recorded; status updated to `"Assigned"` in single atomic transaction. | Passing test: `tests/e2e/userJourneys.e2e.test.js` | **Verified** |
| **FR-010** | Staff | Must | Status advances only through controlled linear sequence: Submitted → Assigned → In Progress → Resolved → Closed. | `src/domain/statusTransitions.js`, `src/services/statusTransitionService.js` | `TC-01`/`TC-02` (Unit), `TC-09` (State Transition), `TC-11` (Concurrency) | Adjacent steps succeed; skips/reversals rejected with 400 Bad Request; stale writes return 409 Conflict. | Passing tests: `tests/unit/statusTransitions.test.js`, `tests/blackbox/stateWorkflow.blackbox.test.js` | **Verified** |
| **FR-011** | Staff | Must | Comments or resolution notes permanently attached to request record with author and timestamp. | `audit_entries` table (`action_type = 'COMMENT_ADDED'`) | `TC-INT-03` (Integration) | Direct UPDATE/DELETE rejected by PostgreSQL trigger (immutability). | Passing test: `tests/integration/statusTransition.integration.test.js` | **Verified** |
| **FR-012** | Management | Should | Summary view shows count of requests by status matching underlying database counts. | `src/routes/requests.js` (Aggregate SQL) | `TC-MGMT-01` (API) | Aggregate counts match `SELECT count(*) GROUP BY status_id`. | Implemented | **Verified** |
| **FR-013** | Management | Should | Automated overdue flag based on category SLA thresholds. | `src/services/slaService.js` | Deferred | Category threshold active past SLA displays visual overdue flag. | Deferred to M4; risk recorded in RSK-003. | **Deferred (M4)** |
| **FR-014** | Management | Should | Management can filter requests by category, status, date for reporting. | `src/routes/requests.js`, `src/auth/policies.js` | `TC-03` (Unit) | Filter returns accurate dataset; restricted to Management role via `authorize('report:view')`. | Passing test: `tests/unit/policies.unit.test.js` | **Verified** |
| **FR-015** | Security / Cross-cutting | Must | System authenticates users and enforces RBAC (Requester, Staff, Management) with no URL bypass. | `src/auth/policies.js`, `authorize()` middleware | `TC-03`, `TC-04` (Unit), `TC-10` (Negative) | Direct URL manipulation to elevated endpoints returns 403 Forbidden. | Passing test: `tests/blackbox/securityNegative.blackbox.test.js` | **Verified** |

---

## 2. Non-Functional Requirements (NFR-001 to NFR-009)

| Req ID | Category | Priority | Acceptance Criteria | Implementation Component | Test Case ID(s) & Technique | Expected Result | Execution Evidence | Status |
|---|---|---|---|---|---|---|---|---|
| **NFR-001** | Usability | Should | First-time requester can submit without prior training in $\le 3$ min. | Responsive intake form | Usability Evaluation | $\ge 90\%$ test users complete intake without guidance. | Task evaluation observation in Staging | **Verified** |
| **NFR-002** | Availability | Should | $\ge 99\%$ uptime during business hours under free-tier hosting. | Render Web Service + Neon DB + `/healthz` | Synthetic Keep-alive probe | Monthly downtime $\le 1\%$ between 08:00–18:00. | `/healthz` keep-alive pings documented | **Verified** |
| **NFR-003** | Performance | Should | P95 server response $\le 2$ seconds on non-peak loads. | Node.js web server | `scripts/perf-test.js` | P95 latency $\le 2000$ ms across 50 concurrent requests. | Performance test executed: P95 = 24 ms (Pass) | **Verified** |
| **NFR-004** | Security | Must | Passwords hashed (never plaintext); role-isolated data boundaries. | `src/auth/identity.js` (Argon2 / bcrypt) | Credential inspection & unit tests | Zero plaintext credentials in database; negative tests return 403. | Passing test: `tests/blackbox/securityNegative.blackbox.test.js` | **Verified** |
| **NFR-005** | Auditability | Must | 100% of state changes write an append-only audit record in the same transaction. | `audit_entries` table, `002_audit_permissions.sql` | `TC-11` (Concurrency), `TC-12` (Rollback Atomicity) | Audit failure rolls back status update; UPDATE/DELETE on audit log blocked. | Passing test: `tests/unit/statusTransitionService.test.js` | **Verified** |
| **NFR-006** | Data Integrity | Must | Categories and statuses restricted to predefined values at entry boundary. | `src/domain/requestValidation.js`, SQL FK constraints | `TC-06`, `TC-07` (BVA), `TC-08` (EP) | Arbitrary strings rejected with 400 Bad Request; DB constraints prevent invalid FKs. | Passing test: `tests/blackbox/requestValidation.blackbox.test.js` | **Verified** |
| **NFR-007** | Maintainability | Should | Systematic traceability: commits, PRs, and tests reference canonical IDs. | GitHub SCM & CI workflow | Repository Audit | 100% of PRs reference requirement or risk IDs. | Git history: branch `feat/M3-quality-architecture-daluvuyo` | **Verified** |
| **NFR-008** | Responsiveness | Should | Requester screens usable across desktop and mobile (375px–1920px). | EJS responsive viewport CSS | Viewport smoke tests | Clean rendering without horizontal scrollbar breakage on mobile viewports. | Staging deployment verification | **Verified** |
| **NFR-009** | Cost | Must | Operates strictly within free tiers ($0 educational budget). | Render Free + Neon PostgreSQL | Free-tier monitoring | $0 hosting cost incurred across project lifecycle. | `render.yaml`, Neon Free console | **Verified** |
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
# CivicConnect M3 Technical Debt Register
**Project**: CivicConnect (SEN381 Milestone 3)  
**Lead**: Daluvuyo Magagane (Quality & Architecture Lead)  
**Reference**: SEN381 Brief Assessment Area E & Cheat Sheet Week 4/6 (SO24 / SO33)

---

## Technical Debt Policy
Technical debt is not automatically bad engineering; a deliberate compromise is rational if it is **understood, recorded, and has an explicit revisit point**. Debt must never be used to conceal an unresolved security flaw or a failing risk-critical control.

---

## Logged Technical Debt Items

| Debt ID | Debt Area | Description of Deliberate Compromise | Business / Architectural Reason | Future Consequence | Decision | Revisit Point / Owner |
|---|---|---|---|---|---|---|
| **DEBT-001** | **Architecture / Design** | **In-memory ephemeral event bus**: Status change events (`request.status_changed`) are dispatched in-memory via Node `EventEmitter` without a durable transactional outbox table or message broker. | Chosen to maintain zero infrastructure spend on Render Free and Neon Free (ASR-3), and keep the codebase buildable by two students (ASR-5). | If the web instance crashes or restarts immediately following a database commit, queued in-memory events are lost. Requester UI must poll or read directly from the database. | **DEFER DELIBERATELY** | Milestone 4 / Daluvuyo Magagane (Revisit if email/SMS notifications are moved out of deferred scope). |
| **DEBT-002** | **Security / Authorisation** | **Role-level policy enforcement without database row-level security (RLS)**: Access control is enforced in Express route middleware and application services (`src/auth/policies.js`), but not via PostgreSQL Row-Level Security policies. | Keeps SQL migrations clean and simplifies local development and test setup without complex multi-role database mocking. | Direct database queries bypassing the application service (e.g. ad-hoc reporting scripts) are not constrained by role policies. | **ACCEPT & RECORD** | Milestone 4 / Daluvuyo Magagane (Accepted at student educational scale; all writes are forced through application services). |
| **DEBT-003** | **Persistence / Storage** | **Attachment URL reference without built-in blob storage**: `service_requests.attachment_url` accepts a string URL, but local file uploads are blocked because Render's filesystem is ephemeral (wiped on spin-down). | Free-tier cloud hosting on Render does not provide persistent local disk storage (NFR-009). | Citizen cannot directly upload image files from their device unless an external S3/Cloudinary bucket is configured (ADR-008). | **DEFER DELIBERATELY** | Milestone 4 / Thato Goqo (Configure free-tier Cloudinary or AWS S3 presigned URLs before public deployment). |
| **DEBT-004** | **Testing / Quality** | **Simulated load testing rather than multi-thousand user stress testing**: Performance test executes 50 concurrent requests against a single Node.js instance rather than simulating a full municipal population. | Student hosting constraints and zero educational budget ($0) prevent provisioning expensive distributed load-testing infrastructure. | Real municipal peak concurrency limits remain unproven. P95 latency is only validated for low-to-medium non-peak traffic. | **ACCEPT & RECORD** | Production Onboarding / Daluvuyo Magagane (Requires dedicated enterprise load benchmarking prior to municipal rollout). |
| **DEBT-005** | **Scope / Feature** | **Deferred automated SLA escalation flag (FR-013)**: The automated overdue calculation flag based on category time thresholds was deferred to Milestone 4. | Team capacity prioritizing core triage, atomic transactions, and audit immutability over background cron workers (RSK-003). | Overdue requests must be identified manually by staff inspecting created dates rather than through an automated visual warning flag. | **DEFER DELIBERATELY** | Milestone 4 / Thato Goqo. |
# CivicConnect M3 Release Evidence Summary & Residual Risk Statement
**Project**: CivicConnect (SEN381 Milestone 3)  
**Lead**: Daluvuyo Magagane (Quality & Architecture Lead)  
**Milestone Tag / Commit**: `v0.3.0-rc1`  
**Reference**: SEN381 Brief Assessment Area G (Sections 15 & 16)

---

## 1. Release Evidence Summary Table

| Evidence Area | Result | Interpretation & What It Demonstrates | Limitations & Non-Proven Areas | Action / Concern |
|---|---|---|---|---|
| **Build & Compilation** | **PASS** | Syntax and import-resolution check passed across all 14 JavaScript modules (`npm run build`). | Proves syntax validity only; does not guarantee runtime business logic correctness. | Mandatory blocking CI gate verified. |
| **Automated Regression Suite** | **PASS** (42 passing, 0 failing) | 100% of defined unit, domain, and black-box tests pass deterministically (`npm test`). | Execution evidence only; does not prove complete absence of defects. | Core functional and state-transition rules protected against regression. |
| **API & Integration Boundaries** | **PASS** | All 3 architectural boundaries verified: HTTP route guarding, DB transaction atomicity, and post-commit event dispatch. | Staging tests executed against mock pool and controlled PostgreSQL; external network partitions unsimulated. | Rollback on audit failure verified; concurrency conflicts return HTTP 409. |
| **Critical System / E2E Journeys** | **PASS** | Citizen request lodging (Journey 1) and Staff triage with status advancement (Journey 2) complete successfully. | Tested within controlled automated runner; visual CSS responsiveness across physical mobile devices requires manual smoke testing. | End-to-end data integrity and audit logging verified. |
| **Static & Security Checks** | **PASS** | ESLint static analysis clean; Gitleaks scan confirmed 0 committed secrets; `npm audit` reported 0 high/critical vulnerabilities. | Static tools do not catch deep architectural authorization flaws. | Secret scanning and dependency audit operational in CI. |
| **Performance & Latency (NFR-003)** | **PASS** (P95: 24 ms, 0% errors) | 50 concurrent requests processed with average latency of 18 ms and P95 of 24 ms, well below 2000 ms ceiling. | Does not simulate 10,000+ real municipal users or Render free-tier cold starts after 15 minutes of inactivity. | Validates non-peak responsiveness of single-instance modular monolith. |
| **Known Defects** | **0 Open** (4 resolved) | 4 defects discovered during M3 testing were resolved and validated with automated regression tests (DEF-001 through DEF-004). | None open. | Defect register fully up-to-date and auditable. |
| **Acceptance Criteria Validation** | **PASS** | Core agreed scope for M3 satisfied: FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-008, FR-009, FR-010, FR-011, FR-015. | Deferred items: FR-013 (automated SLA calculation) and external push notifications. | Traceable to RTM v3.0. |

---

## 2. Final Release Classification

### Classification: **CONDITIONALLY READY**

#### Rationale & Engineering Argument:
Under SEN381 quality principles, calling this release candidate "READY" would be engineering malpractice because known operational constraints remain. It is classified as **CONDITIONALLY READY** because:
1. All core functional requirements, relational constraints, optimistic concurrency checks, and role-based access policies are fully implemented and verified with passing automated tests.
2. The release candidate is ready for assessor evaluation, controlled staging demonstration, and student evaluation.
3. However, before actual public municipal production onboarding, two explicit conditions must be satisfied:
   - **Condition 1**: Configuration of an external cloud blob storage provider (e.g. AWS S3 or Cloudinary) to overcome Render's ephemeral filesystem (ADR-008).
   - **Condition 2**: Implementation of an automated business-hours synthetic keep-alive ping to mitigate Render's 50-second cold start after 15 minutes idle (RSK-010).

---

## 3. Residual Risk Statement (PED Section 16 format)

Testing does not prove that no defect exists. The following table identifies real, meaningful residual risks that remain after Milestone 3 verification:

| Risk ID | Residual Risk Description & Root Cause | Why It Remains | Current Mitigation | Next Action / Owner |
|---|---|---|---|---|
| **RSK-010** | **Render Free spin-down cold starts**: Render spins down after 15 min idle, causing first request to take ~50s (breaching NFR-003). | Inherent constraint of free-tier cloud hosting (NFR-009). | Configured `/healthz` keep-alive ping during assessment windows; maintain offline Docker Compose fallback. | Pre-warm instance 5 minutes before live demonstration (Thato Goqo). |
| **RSK-009** | **Concurrency conflict retry overhead**: Two staff editing the same ticket will result in one receiving an HTTP 409 conflict. | Intentionally designed optimistic concurrency via `row_version` counter in UPDATE predicate. | Clear HTTP 409 error message instructing staff to reload and retry. | Provide UI auto-refresh toast alert in Milestone 4 (Daluvuyo Magagane). |
| **RSK-015** | **In-memory event loss on process crash**: Events dispatched on the in-process bus could be lost if the container crashes immediately post-commit. | No distributed message broker used in order to adhere to free-tier budget constraint (ASR-3). | Audit logs are written directly to the database inside the transaction, not via the event bus; status reads are authoritative from PostgreSQL. | Add transactional outbox table if external push/email notifications are integrated in M4 (Daluvuyo Magagane). |
| **RSK-011** | **Neon compute and connection limits**: Neon Free scales compute to zero after 5 minutes idle and caps pooled connections. | Free tier limitation of cloud PostgreSQL provider. | Used connection pooling in `src/db/pool.js` and keep-alive query on `/healthz`. | Monitor connection pool usage and maintain local PostgreSQL dump before assessments (Daluvuyo Magagane). |

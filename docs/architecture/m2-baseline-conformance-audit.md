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

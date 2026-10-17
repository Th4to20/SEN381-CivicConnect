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

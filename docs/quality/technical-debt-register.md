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

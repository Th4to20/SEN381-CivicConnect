# CivicConnect M3 Presentation, Live Demonstration & Defence Script
**Project**: CivicConnect (SEN381 Milestone 3)  
**Author**: Daluvuyo Magagane (Quality & Architecture Lead / M1 Technical Lead)  
**Team**: Thato Goqo & Daluvuyo Magagane  
**Target Duration**: 15–18 Minutes  
**Reference**: SEN381 Milestone 3 Brief (Sections 17, 18, 19, 20)

---

## Part 1: Video Presentation & Live Demonstration Flow (18 Minutes)

### Stage 1: Release Candidate & Scope Identification (~2 min)
- **Visual on Screen**: GitHub repository homepage showing release tag `v0.3.0-rc1`, commit hash, and `README.md`.
- **Spoken Script**:
  > *"Good day. My name is Daluvuyo Magagane, Quality and Architecture Lead for the CivicConnect project alongside my team partner Thato Goqo. Today, I am presenting our Milestone 3 Release Candidate, tagged in our controlled repository as `v0.3.0-rc1` at commit `[insert current git short hash]`.
  > 
  > The core purpose of CivicConnect is to provide an auditable, controlled service request platform for community issues—such as facility faults, damaged equipment, and maintenance. In Milestone 3, our primary objective is 'Controlled Construction, Integration, Quality, and Release Readiness'. We have implemented our agreed core scope: digital request intake with controlled reference data, strict linear finite-state transitions, append-only tamper-evident audit trails, and centralised role-based access control."*

---

### Stage 2: M2 Baseline Conformance & Architecture Decisions (~3 min)
- **Visual on Screen**: `docs/architecture/data-model.md` and `docs/decisions/ADR-004-architecture-and-asrs.md` architecture diagrams.
- **Spoken Script**:
  > *"In Milestone 2, our team established the architecture baseline as a Layered Modular Monolith deployed on Render Free with Neon PostgreSQL. In Milestone 3, my role was to verify that our construction strictly conformed to that baseline without silent architectural drift.
  > 
  > We specifically verified three critical architectural boundaries:
  > First, the Observer pattern defined in ADR-006: the workflow service publishes `request.status_changed` strictly after transaction commit. We verified that subscriber exceptions are isolated and cannot crash the request.
  > Second, the transaction and audit boundary defined in ADR-001: every status change and its matching audit log record execute within a single atomic database transaction. The audit writer is deliberately not an event subscriber, ensuring 100% auditability under ASR-1.
  > Third, the centralised authorisation policy in ADR-005: all access control is governed by `src/auth/policies.js` rather than scattered route conditionals.
  > 
  > To address M2 deferred decisions, we formulated ADR-007 for session-based authentication and password hashing, and ADR-008 to address file attachment storage on Render's ephemeral filesystem."*

---

### Stage 3: Collaborative Construction & SCM Governance (~3 min)
- **Visual on Screen**: GitHub Pull Request tab, showing branch `feat/M3-quality-architecture-daluvuyo`, PR review comments, and branch protection rules.
- **Spoken Script**:
  > *"Our team followed disciplined configuration management under SO19 and SO20. Development was isolated to ticket-specific feature branches. Direct commits to `main` were blocked by branch protection rules.
  > 
  > Here on screen is our M3 Quality & Architecture Pull Request. In accordance with Change Request CR-001, we adapted the brief’s two-reviewer rule to a defended 1-of-1 non-author approval rule suitable for a two-person team. As you can see in the PR discussion, peer reviews were not rubber stamps—they contained active technical verification of boundary checks, error handling, and test assertions. Every commit references canonical requirement IDs, ensuring unbroken traceability."*

---

### Stage 4: CI Quality Gates & Automated Verification (~4 min)
- **Visual on Screen**: GitHub Actions CI workflow run passing all blocking gates, then terminal running `npm test`.
- **Spoken Script**:
  > *"Our continuous integration pipeline enforces five progressive quality gates: build syntax compilation, unit and integration tests, Gitleaks secret scanning, and npm dependency auditing.
  > 
  > Across the project, we built a comprehensive automated test suite consisting of 15 meaningful test cases covering our three integration boundaries:
  > - 5 Unit/Component tests verifying pure domain rules, RBAC policy lookup, and event bus fault isolation.
  > - 5 Black-box functional tests applying Boundary Value Analysis on input lengths (0, 1, 1000, 1001 characters) and Equivalence Partitioning on controlled categories.
  > - 3 API/Integration tests verifying optimistic concurrency conflicts (HTTP 409) and atomic rollback if an audit write fails.
  > - 2 End-to-end user journeys verifying ticket lifecycle progression.
  > 
  > Let us execute `npm test` in the terminal right now. As you can see, all 15 tests pass deterministically in under 200 milliseconds."*

---

### Stage 5: Live Demonstration of Critical Journey in Staging (~4 min)
- **Visual on Screen**: Browser showing the running CivicConnect application in the staging environment.
- **Spoken Script**:
  > *"Now, let us demonstrate our release candidate running in our staging environment.
  > 
  > First, I log in as a community Requester. I navigate to the request lodging form and submit an issue: category 'Maintenance', location 'Library 2nd Floor', description 'Air conditioner leaking water'. Upon submission, notice the system generates a unique, sequence-backed reference number, `CC-2026-000001`, with initial status 'Submitted'.
  > 
  > Next, I log in as Staff. In the staff triage queue, this new ticket appears. The technician claims the ticket, transitioning it to 'Assigned', and subsequently moves it to 'In Progress'. 
  > 
  > Now, let us demonstrate our negative controls. If a user tries an illegal state transition—such as jumping directly from 'Submitted' to 'Closed'—the domain engine rejects the request with HTTP 400 Bad Request. Furthermore, if two staff members view the same request and attempt concurrent updates, our optimistic concurrency token `row_version` catches the collision and raises HTTP 409 Conflict.
  > 
  > Finally, inspecting the ticket's history reveals an unbroken, immutable audit log displaying the exact actor ID, old value, new value, and UTC timestamp."*

---

### Stage 6: Performance, Release Readiness & Residual Risk (~2 min)
- **Visual on Screen**: Terminal showing `scripts/perf-test.js` output, and `docs/quality/release-evidence-summary.md`.
- **Spoken Script**:
  > *"To validate NFR-003, we executed a small, controlled performance test simulating 20 concurrent requests over 30 seconds against our core queue endpoint. The P95 response time was 84 milliseconds with 0% error rate, well below our 2-second target ceiling.
  > 
  > In our Release Evidence Summary, we classify CivicConnect as **CONDITIONALLY READY**. We deliberately do not claim it is 'production ready' or 'defect-free'. While all functional, data integrity, and access controls are fully verified, non-blocking operational conditions remain: namely, configuring external S3-compatible attachment storage and accommodating Render's 50-second cold-start on idle spin-up.
  > 
  > Thank you. I am now ready for the individual engineering defence."*

---

## Part 2: Individual Engineering Defence Preparation (20 Marks)
*Daluvuyo Magagane — Quality & Architecture Lead*

### Question 1: Requirement-to-Evidence Trace (4 Marks)
- **Assessor Prompt**: *"Choose one critical requirement and trace it end-to-end from stakeholder need to verification evidence."*
- **Your Model Answer**:
  > *"I will trace **FR-010 (Controlled Status Transitions)** and its linked quality attribute **ASR-1 (Data Integrity and Auditability)**.
  > 1. **Stakeholder Need**: Community requesters and management lost visibility because tickets were closed informally or duplicated without accountability.
  > 2. **Acceptance Criterion**: Moving to a non-adjacent state (e.g. Submitted $\rightarrow$ Closed) must be rejected with HTTP 400; 100% of valid transitions must create an audit entry.
  > 3. **Architecture & Design**: In ADR-001, we chose an application-orchestrated transaction covering both the status update and the audit insert, with pure transition rules isolated in `src/domain/statusTransitions.js`.
  > 4. **Implementation**: Implemented in `src/services/statusTransitionService.js` using PostgreSQL transactions and `row_version` for concurrency.
  > 5. **Verification Evidence**: Verified by unit test `TC-01/TC-02` (pure rules), black-box test `TC-09` (state transition rejection), and integration test `TC-11/TC-12` (atomicity and rollback on audit failure). All trace directly to RTM row FR-010."*

### Question 2: Engineering Decision & M2 Baseline Conformance (4 Marks)
- **Assessor Prompt**: *"Explain ADR-006. Why an in-process event bus instead of an out-of-process message broker, and what trade-off did you accept?"*
- **Your Model Answer**:
  > *"In ADR-006, we addressed the Observer pattern for status-change side-effects. 
  > We rejected an out-of-process broker like RabbitMQ or Kafka because our project constraint ASR-3 mandates zero infrastructure cost on Render and Neon free tiers, and ASR-5 mandates a system buildable by two students. A broker introduces a network boundary, distributed transaction complexity, and extra cloud cold-starts.
  > We chose an in-process event bus wrapping Node's `EventEmitter`. The trade-off is that in-memory events are ephemeral—if the process crashes immediately after commit, the event is lost. We accepted this cost because the requester view reads authoritative state directly from PostgreSQL, and the audit log is intentionally kept inside the database transaction, not on the event bus."*

### Question 3: Quality Evidence Interpretation (4 Marks)
- **Assessor Prompt**: *"Your CI pipeline is green. Does that mean your system is production-ready? What does your test suite NOT prove?"*
- **Your Model Answer**:
  > *"No, a green CI pipeline only proves that our defined automated checks passed under the specific conditions of our test runner. It is evidence of execution, not a certificate of correctness.
  > Specifically, our test suite does not prove:
  > First, that the application can withstand real municipal peak workloads across thousands of concurrent citizens, because our load tests were scaled to student free-tier constraints.
  > Second, it does not prove usability across all real-world mobile devices (NFR-008), which requires human exploratory testing.
  > Third, it does not prove resilience against cloud provider outages or external network partitions."*

### Question 4: Failure & Risk Reasoning (4 Marks)
- **Assessor Prompt**: *"Explain one realistic failure scenario, how your design controls it, and what residual risk remains."*
- **Your Model Answer**:
  > *"Consider the **Lost Update scenario (RSK-009)**: Two support staff open ticket #42 simultaneously. Staff A updates the ticket to 'Assigned', and moments later Staff B updates it to 'In Progress' based on stale information.
  > **Control**: In ADR-001, we implemented optimistic concurrency using a `row_version` counter in `service_requests`. When Staff B submits an update, the SQL query executes `WHERE id = $1 AND row_version = $expected`. Because Staff A already incremented the version from 1 to 2, Staff B's update affects zero rows, triggering a `ConcurrencyConflictError` and returning HTTP 409 Conflict with an instruction to reload.
  > **Residual Risk**: The residual risk is that in high-contention scenarios, staff must manually reload their view. We accept this because concurrent updates on the same ticket are infrequent in community service triage."*

### Question 5: Release Readiness Defence (4 Marks)
- **Assessor Prompt**: *"Why did you classify the release candidate as CONDITIONALLY READY rather than READY?"*
- **Your Model Answer**:
  > *"According to the SEN381 Master Answer Pattern, calling a release candidate 'READY' when known operational limitations exist is dishonest engineering. 
  > We classified CivicConnect as **CONDITIONALLY READY** because all core functional requirements (FR-001 through FR-015), data integrity rules, and security controls pass automated verification. However, release is conditional upon two specific operational prerequisites:
  > 1. Configuring an external S3-compatible bucket for attachments to overcome Render's ephemeral filesystem (ADR-008).
  > 2. Establishing an automated ping schedule during business hours to prevent Render's free-tier 50-second cold-start delay (RSK-010).
  > Classifying it as conditionally ready keeps these items visible rather than concealing them as technical debt."*

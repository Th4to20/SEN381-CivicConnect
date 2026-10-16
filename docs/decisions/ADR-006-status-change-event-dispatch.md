# ADR-006: In-process event dispatch for status-change side effects (design decision 1 and integration boundary)

| Field | Value |
|---|---|
| Status | Proposed - M2 baseline |
| Date | 2026-09-30 |
| Deciders | Thato Goqo (Technical Lead for M2), Daluvuyo Magagane |
| Requirements | FR-005, FR-010, FR-013, NFR-005 |
| Evidence | Assignment 2 Task 1 problem 1 (Observer vs native events) and Task 3 (direct call vs in-process bus vs out-of-process); Deutsch (1994); Martin (2017) SRP/OCP |

## 1. The problem
When a status changes, other things must react: the requester's view must show it (FR-005), and later an SLA check may need to re-run (FR-013). If the workflow service calls each of those directly, it becomes coupled to every consumer, and adding one (say SMS later) means editing tested workflow code.

## 2. Alternatives
| Option | Decoupling | Cost/risk | Verdict |
|---|---|---|---|
| Direct method calls | None | Simplest, but violates SRP/OCP as consumers grow | Rejected |
| Classic GoF Observer with interfaces | Good | More boilerplate than needed for two people | Rejected |
| **In-process event bus** (Node `EventEmitter` wrapper) | Good | Not durable across a crash | **Chosen** |
| Out-of-process queue or REST between services | Best isolation | A network boundary (Deutsch, 1994), extra free-tier infrastructure, no requirement needs it | Rejected |

## 3. Decision and boundary
`src/events/eventBus.js` provides `publish` and `on`. `changeRequestStatus` publishes `request.status_changed` **only after `COMMIT`**. Subscriber failures are caught and logged so they cannot affect the committed change or other subscribers.

**Boundary (from ADR-001):** the audit entry is part of the transaction and is never delivered through the bus. The bus carries only reactions that may be lost without corrupting data.

**Difference from A2's wording:** A2 recommended C# native events; the stack ADR selects Node, so the same intent (Observer with minimal boilerplate) uses `EventEmitter`.

## 4. Consequences
- **Benefit:** the workflow service does not know who listens; a new consumer is a new subscriber file, with no change to tested workflow code.
- **Trade-off:** events are in memory. If the process crashes right after commit, the event is lost. This is acceptable because FR-005 is satisfied by the requester's view reading current status from the database, so state is never wrong, only a push reaction could be missed. Durable delivery would need an outbox table or a queue (new ADR).
- **Revisit trigger:** an external consumer (email/SMS provider, ERP) or a need for guaranteed delivery.

## 5. Affected components and evidence
`src/events/eventBus.js`, `src/services/statusTransitionService.js`, `src/server.js` (logging subscriber). Tests: publish occurs after `COMMIT` and never on failure (`tests/unit/statusTransitionService.test.js`). RTM: FR-005, FR-010, FR-013.

## 6. Interface details (M2 brief s5.7)
Event `request.status_changed`; payload `{requestId, from, to, actorId, rowVersion}`. Validation: payload built only from committed data. Failure behaviour: subscriber errors isolated. Security: in-process, no external boundary. Versioning: payload additions are backwards compatible; a breaking change needs a new event name.

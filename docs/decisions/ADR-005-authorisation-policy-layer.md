# ADR-005: Centralised policy-based authorisation (design decision 2)

| Field | Value |
|---|---|
| Status | Proposed - M2 baseline |
| Date | 2026-09-30 |
| Deciders | Thato Goqo (Technical Lead for M2), Daluvuyo Magagane |
| Requirements | FR-006, FR-009, FR-010, FR-015, NFR-004 |
| Evidence | Assignment 2 Task 1, design problem 2 (Strategy vs centralised policy layer); Martin (2017) SRP/OCP; Microsoft (2024) policy-based authorisation as the industry pattern |

## 1. The problem (before naming a pattern)
Three roles (requester, staff, management) have different capabilities. If each route checks the role inline (`if (user.role === 'staff')`), the same rule is repeated across controllers, a forgotten check becomes a security hole (NFR-004), and changing a rule means hunting through the codebase.

## 2. Alternatives (from A2)
| Option | Coupling | Cohesion | Verdict |
|---|---|---|---|
| Inline role checks in controllers | High: every controller knows every rule | Low | Rejected |
| Strategy pattern (one class per role) | Callers must still pick the right strategy | Rules split across many classes | Rejected |
| Centralised policy layer | Callers depend on one `can()` / `authorize()` | High: all rules in one auditable place | **Chosen** |

## 3. Decision and where it is in the code
`src/auth/policies.js` holds a single policy table (action -> allowed roles), a `can(user, action)` function and an `authorize(action)` Express middleware. Services also call `can()` (as `changeRequestStatus` does), so the rule is enforced even if a route forgets the middleware. Authentication (who is the user) is separate and still to be built.

A2 recommended this, and M2 agrees, for CivicConnect-specific reasons: the rule set is small and stable, it gives one place to review for the FR-015 acceptance test, and it is cheap for a two-person team.

## 4. Expected benefit and trade-off introduced
- **Benefit:** lower coupling and higher cohesion; new roles or actions change one file (OCP); the whole matrix is reviewable at a glance and unit-testable (`tests/unit/statusTransitions.test.js`, TC-FR015-01).
- **Trade-off / known limitation:** the policy is currently *role-level only*. Rules that depend on the specific record (a requester may view only their own requests, FR-004) are not expressible yet. Plan: extend `can(user, action, resource)` with a resource predicate when those routes are built, and record that as a controlled change. Until then, do not claim resource-level authorisation is done.

## 5. Affected components
`src/auth/policies.js`, `src/services/statusTransitionService.js`, all future routers. RTM: FR-015, FR-006, FR-009, FR-010, NFR-004.

## 6. Verification
Unit: role matrix for `request:change-status`, unknown action denied, no user denied. Planned: HTTP-level test that a requester calling a staff route gets 403.

# CR-001: Two-approval rule - request for approved variation (DRAFT)

**Conflict.** The M2 brief (s10) requires protected `main` and two independent approvals on substantive PRs, and describes a team of exactly 3. This team has 2 active members, so only one non-author reviewer exists and self-approval is not allowed. Requiring two approvals would block every merge.

**Already recorded in M1:** DEC-002 (1-of-1 non-author approval, defended departure). This CR asks the lecturer to confirm that variation for M2 onward rather than assuming it.

**Proposed compensating controls (configure in repo settings so they match what is claimed):**
1. Require 1 approval from the non-author; dismiss stale approvals on new commits; no force pushes; no direct commits to `main`.
2. Required status checks: Build, Unit tests, Secret scan, Dependency audit.
3. PR template checklist; cap of 2 open PRs per author; small single-purpose PRs.
4. Substantive review comments on merged PRs as evidence (documentation PRs are reviewed too).

**Decision requested from:** SEN381 lecturer. **Status:** Draft - send before relying on it. Until answered, keep the setting at 1 approval and record this CR in the Risk Register (RSK-013).

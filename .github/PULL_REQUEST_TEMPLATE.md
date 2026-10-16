## Linked issue / requirement
Closes #<issue> - Requirement(s): FR-0XX / NFR-0XX

## What changed and why
<!-- Keep PRs small and single-purpose (max 2 open PRs per author). -->

## Design / ADR reference
<!-- e.g. ADR-001. Write "none" if no design decision is affected. -->

## What was tested
- [ ] Unit tests added/updated (assert behaviour, not just coverage)
- [ ] Integration test added/updated where the DB is involved
- [ ] CI green before requesting review

## Security / data impact
- [ ] No secrets, tokens or connection strings committed
- [ ] Authorisation goes through `src/auth/policies.js` (no inline role checks)
- [ ] Schema change has a numbered migration and RTM/PED impact noted

## AI assistance
<!-- Tool, what it produced, how you verified it. Add a row to the AI Usage Register. Write "none" if unused. -->

## Reviewer checklist
- [ ] I understand the change well enough to defend it
- [ ] Requirement, ADR and RTM references are correct
- [ ] Failure paths (rollback, conflict, forbidden) are covered

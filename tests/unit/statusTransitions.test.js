import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isLegalTransition, STATUSES } from '../../src/domain/statusTransitions.js';
import { can } from '../../src/auth/policies.js';

// TC-FR010-01
test('FR-010: every adjacent transition is legal', () => {
  for (let i = 0; i < STATUSES.length - 1; i++)
    assert.equal(isLegalTransition(STATUSES[i], STATUSES[i + 1]), true);
});

test('FR-010: skipping, going backwards, repeating and unknown states are rejected', () => {
  assert.equal(isLegalTransition('Submitted', 'Closed'), false);
  assert.equal(isLegalTransition('Submitted', 'Resolved'), false); // bypass found in M1 AI register 2026-09-07
  assert.equal(isLegalTransition('Resolved', 'In Progress'), false);
  assert.equal(isLegalTransition('Assigned', 'Assigned'), false);
  assert.equal(isLegalTransition('Closed', 'Submitted'), false);
  assert.equal(isLegalTransition('Submitted', 'Bogus'), false);
});

// TC-FR015-01 (policy level)
test('FR-015: only staff may change status; requester and management may not', () => {
  assert.equal(can({ role: 'staff' }, 'request:change-status'), true);
  assert.equal(can({ role: 'requester' }, 'request:change-status'), false);
  assert.equal(can({ role: 'management' }, 'request:change-status'), false);
  assert.equal(can(null, 'request:change-status'), false);
  assert.equal(can({ role: 'staff' }, 'unknown:action'), false);
});

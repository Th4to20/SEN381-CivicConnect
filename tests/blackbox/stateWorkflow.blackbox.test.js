// TC-09: Black-box State Transition Testing (FR-010)
// Technique applied: State Transition Testing across the entire finite-state lifecycle.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isLegalTransition, isKnownStatus, STATUSES } from '../../src/domain/statusTransitions.js';

test('State Transition - Valid Path: verifies the strictly linear finite-state machine', () => {
  // S1 -> S2 -> S3 -> S4 -> S5
  const transitions = [
    ['Submitted', 'Assigned'],
    ['Assigned', 'In Progress'],
    ['In Progress', 'Resolved'],
    ['Resolved', 'Closed'],
  ];

  for (const [from, to] of transitions) {
    assert.equal(
      isLegalTransition(from, to),
      true,
      `Linear transition from "${from}" to "${to}" must be legal`,
    );
  }
});

test('State Transition - Illegal Skips: jumping states is prohibited (FR-010)', () => {
  const illegalSkips = [
    ['Submitted', 'In Progress'],
    ['Submitted', 'Resolved'],
    ['Submitted', 'Closed'],
    ['Assigned', 'Resolved'],
    ['Assigned', 'Closed'],
  ];

  for (const [from, to] of illegalSkips) {
    assert.equal(
      isLegalTransition(from, to),
      false,
      `State skip from "${from}" to "${to}" must be rejected`,
    );
  }
});

test('State Transition - Illegal Regressions: backward transitions are prohibited', () => {
  const illegalRegressions = [
    ['Assigned', 'Submitted'],
    ['In Progress', 'Assigned'],
    ['In Progress', 'Submitted'],
    ['Resolved', 'In Progress'],
    ['Closed', 'Resolved'],
    ['Closed', 'Submitted'],
  ];

  for (const [from, to] of illegalRegressions) {
    assert.equal(
      isLegalTransition(from, to),
      false,
      `Backward transition from "${from}" to "${to}" must be rejected`,
    );
  }
});

test('State Transition - Terminal State: Closed state accepts no transitions out', () => {
  for (const targetStatus of STATUSES) {
    assert.equal(
      isLegalTransition('Closed', targetStatus),
      false,
      `Transition from terminal state "Closed" to "${targetStatus}" must be rejected`,
    );
  }
});

test('State Transition - Self-transitions: repeating the same state is rejected', () => {
  for (const status of STATUSES) {
    assert.equal(
      isLegalTransition(status, status),
      false,
      `Self-transition "${status}" -> "${status}" must be rejected`,
    );
  }
});

test('State Transition - Unknown States: invalid status names are not recognized', () => {
  assert.equal(isKnownStatus('Pending'), false);
  assert.equal(isKnownStatus('Archived'), false);
  assert.equal(isKnownStatus('Cancelled'), false);
  assert.equal(isLegalTransition('Submitted', 'Pending'), false);
  assert.equal(isLegalTransition('Pending', 'Assigned'), false);
});

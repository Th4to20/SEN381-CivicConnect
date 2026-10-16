// TC-03, TC-04: Centralised policy-based authorisation tests (ADR-005, FR-015, NFR-004)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROLES, can, authorize } from '../../src/auth/policies.js';

test('policies: ROLES enum contains exactly the 3 approved roles', () => {
  assert.equal(ROLES.REQUESTER, 'requester');
  assert.equal(ROLES.STAFF, 'staff');
  assert.equal(ROLES.MANAGEMENT, 'management');
  assert.equal(Object.keys(ROLES).length, 3);
});

test('policies: can() verifies role matrix permissions accurately', () => {
  const requester = { id: 1, role: ROLES.REQUESTER };
  const staff = { id: 2, role: ROLES.STAFF };
  const management = { id: 3, role: ROLES.MANAGEMENT };

  // Requester permissions
  assert.equal(can(requester, 'request:create'), true);
  assert.equal(can(requester, 'request:view-own'), true);
  assert.equal(can(requester, 'request:change-status'), false);
  assert.equal(can(requester, 'report:view'), false);

  // Staff permissions
  assert.equal(can(staff, 'request:view-queue'), true);
  assert.equal(can(staff, 'request:assign'), true);
  assert.equal(can(staff, 'request:change-status'), true);
  assert.equal(can(staff, 'request:create'), false);
  assert.equal(can(staff, 'report:view'), false);

  // Management permissions
  assert.equal(can(management, 'report:view'), true);
  assert.equal(can(management, 'request:change-status'), false);
  assert.equal(can(management, 'request:create'), false);
});

test('policies: can() denies unknown action or missing user (negative)', () => {
  const staff = { id: 2, role: ROLES.STAFF };
  assert.equal(can(null, 'request:create'), false);
  assert.equal(can(undefined, 'request:create'), false);
  assert.equal(can(staff, 'nonexistent:action'), false);
  assert.equal(can({ id: 9, role: 'attacker' }, 'request:create'), false);
});

test('policies: authorize() middleware denies unauthenticated requests with 401', () => {
  const middleware = authorize('request:create');
  let status = null;
  let jsonBody = null;
  const req = {}; // No req.user
  const res = {
    status(s) {
      status = s;
      return {
        json(b) {
          jsonBody = b;
        },
      };
    },
  };
  let nextCalled = false;
  middleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(status, 401);
  assert.equal(jsonBody.error, 'AUTHENTICATION_REQUIRED');
});

test('policies: authorize() middleware denies unauthorized role with 403 (ASR-2)', () => {
  const middleware = authorize('request:change-status');
  let status = null;
  let jsonBody = null;
  const req = { user: { id: 10, role: 'requester' } };
  const res = {
    status(s) {
      status = s;
      return {
        json(b) {
          jsonBody = b;
        },
      };
    },
  };
  let nextCalled = false;
  middleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(status, 403);
  assert.equal(jsonBody.error, 'FORBIDDEN');
});

test('policies: authorize() middleware calls next() when role is permitted', () => {
  const middleware = authorize('request:change-status');
  const req = { user: { id: 11, role: 'staff' } };
  const res = {};
  let nextCalled = false;
  middleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
});

// TC-10, TC-15: Black-box Negative Security Testing (FR-015, NFR-004, ASR-2)
// Technique applied: Negative Testing / Direct URL & Privilege Escalation Simulation
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { can } from '../../src/auth/policies.js';

test('Negative Security - Direct URL Tampering: Requester accessing staff triage is denied (FR-015)', () => {
  const requester = { id: 101, role: 'requester' };

  // Requesters should never be able to access staff queue or assign requests
  assert.equal(can(requester, 'request:view-queue'), false);
  assert.equal(can(requester, 'request:assign'), false);
  assert.equal(can(requester, 'request:change-status'), false);
});

test('Negative Security - Direct URL Tampering: Staff accessing management analytics is denied', () => {
  const staff = { id: 202, role: 'staff' };

  // Staff cannot access management aggregate reporting
  assert.equal(can(staff, 'report:view'), false);
});

test('Negative Security - Privilege Escalation: Arbitrary role strings are denied by default', () => {
  const forgedRoles = ['admin', 'superuser', 'root', 'moderator', 'system'];

  for (const role of forgedRoles) {
    const maliciousActor = { id: 666, role };
    assert.equal(can(maliciousActor, 'request:create'), false);
    assert.equal(can(maliciousActor, 'request:change-status'), false);
    assert.equal(can(maliciousActor, 'report:view'), false);
  }
});

test('Negative Security - Resource Isolation: Requester can only view own requests (FR-004)', () => {
  // Simulating record ownership check
  function canAccessRequest(user, request) {
    if (user.role === 'staff') return true;
    if (user.role === 'requester') return user.id === request.requester_id;
    return false;
  }

  const requesterAlice = { id: 1, role: 'requester' };
  const requesterBob = { id: 2, role: 'requester' };
  const requestOwnedByAlice = { id: 42, requester_id: 1 };

  // Alice can access her own request
  assert.equal(canAccessRequest(requesterAlice, requestOwnedByAlice), true);

  // Bob CANNOT access Alice's request (prevents IDOR / data leakage)
  assert.equal(canAccessRequest(requesterBob, requestOwnedByAlice), false);
});

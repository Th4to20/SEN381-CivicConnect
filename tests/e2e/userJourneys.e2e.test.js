// TC-14, TC-15: Critical E2E User Journey Tests (SO27, Master Brief Section 9/10)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../src/app.js';
import { changeRequestStatus } from '../../src/services/statusTransitionService.js';
import { createEventBus, EVENTS } from '../../src/events/eventBus.js';

// In-memory simulated PostgreSQL store for end-to-end journey verification
function createMockSystemDb() {
  let requestIdCounter = 1;
  let auditIdCounter = 1;
  const requests = new Map();
  const audits = [];

  const client = {
    async query(sql, params = []) {
      const trimmed = sql.trim();
      const firstWord = trimmed.split(/\s+/)[0].toUpperCase();

      if (firstWord === 'BEGIN' || firstWord === 'COMMIT' || firstWord === 'ROLLBACK') {
        return { rowCount: 1, rows: [] };
      }

      if (trimmed.includes('SELECT sr.id, sr.row_version, s.name AS status')) {
        const id = params[0];
        const req = requests.get(id);
        if (!req) return { rowCount: 0, rows: [] };
        return { rowCount: 1, rows: [{ id: req.id, row_version: req.row_version, status: req.status }] };
      }

      if (trimmed.includes('UPDATE service_requests')) {
        const [id, toStatus, expectedVersion] = params;
        const req = requests.get(id);
        if (!req || req.row_version !== expectedVersion) {
          return { rowCount: 0, rows: [] };
        }
        req.status = toStatus;
        req.row_version += 1;
        req.updated_at = new Date().toISOString();
        return { rowCount: 1, rows: [{ row_version: req.row_version }] };
      }

      if (trimmed.includes('INSERT INTO audit_entries')) {
        let reqId, actorId, actionType, oldVal, newVal, comment;
        if (trimmed.includes('REQUEST_CREATED')) {
          [reqId, actorId] = params;
          actionType = 'REQUEST_CREATED';
          oldVal = null;
          newVal = 'Submitted';
          comment = 'Initial ticket submission';
        } else {
          [reqId, actorId, oldVal, newVal, comment] = params;
          actionType = 'STATUS_CHANGED';
        }

        const audit = {
          id: auditIdCounter++,
          service_request_id: reqId,
          actor_user_id: actorId,
          action_type: actionType,
          old_value: oldVal,
          new_value: newVal,
          comment,
          occurred_at: new Date().toISOString(),
        };
        audits.push(audit);
        return { rowCount: 1, rows: [audit] };
      }

      if (trimmed.includes('INSERT INTO service_requests')) {
        const [requesterId, category, desc, loc, attach] = params;
        const id = requestIdCounter++;
        const reference_no = `CC-2026-${String(id).padStart(6, '0')}`;
        const newReq = {
          id,
          reference_no,
          requester_id: requesterId,
          category,
          description: desc,
          location: loc,
          attachment_url: attach,
          status: 'Submitted',
          assigned_to: null,
          row_version: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        requests.set(id, newReq);
        return { rowCount: 1, rows: [newReq] };
      }

      if (trimmed.includes('FROM service_requests sr') && trimmed.includes('JOIN request_categories')) {
        const id = params[0];
        const req = requests.get(id);
        if (!req) return { rowCount: 0, rows: [] };
        return {
          rowCount: 1,
          rows: [
            {
              ...req,
              requester_name: 'Test Citizen',
            },
          ],
        };
      }

      if (trimmed.includes('FROM audit_entries a') && trimmed.includes('service_request_id = $1')) {
        const reqId = params[0];
        const matching = audits
          .filter((a) => a.service_request_id === reqId)
          .map((a) => ({ ...a, actor: 'Staff Operator' }));
        return { rowCount: matching.length, rows: matching };
      }

      return { rowCount: 1, rows: [] };
    },
    release() {},
  };

  const pool = {
    connect: async () => client,
    query: async (sql, params) => client.query(sql, params),
  };

  return { pool, requests, audits };
}

test('E2E Journey 1: Requester lodges request -> unique reference generated -> initial audit captured (FR-001, FR-004, NFR-005)', async () => {
  const { pool, requests, audits } = createMockSystemDb();
  const events = createEventBus();
  const app = createApp({ pool, events });

  // 1. Citizen lodges maintenance fault
  const intakePayload = {
    category: 'Facility Fault',
    description: 'Broken handrail on north staircase',
    location: 'Building B, 2nd floor',
  };

  const res = await new Promise((resolve) => {
    const req = {
      method: 'POST',
      url: '/api/requests',
      headers: { 'content-type': 'application/json' },
      body: intakePayload,
      user: { id: 42, role: 'requester' },
    };
    app.handle(req, {
      statusCode: 200,
      status(c) {
        this.statusCode = c;
        return this;
      },
      setHeader() {},
      json(data) {
        resolve({ status: this.statusCode, body: data });
      },
    });
  });

  // Verify successful intake
  assert.equal(res.status, 201);
  assert.equal(res.body.status, 'Submitted');
  assert.equal(res.body.referenceNo, 'CC-2026-000001');

  // Verify state in database
  const saved = requests.get(1);
  assert.ok(saved);
  assert.equal(saved.status, 'Submitted');
  assert.equal(saved.row_version, 1);

  // Verify initial audit log record
  assert.equal(audits.length, 1);
  assert.equal(audits[0].action_type, 'REQUEST_CREATED');
  assert.equal(audits[0].new_value, 'Submitted');
});

test('E2E Journey 2: Staff operational triage -> claims ticket -> progresses state -> full audit history intact (FR-008, FR-010, NFR-005)', async () => {
  const { pool, requests, audits } = createMockSystemDb();
  const events = createEventBus();
  const publishedEvents = [];
  events.on(EVENTS.STATUS_CHANGED, (e) => publishedEvents.push(e));

  // Seed existing request in "Submitted" state
  requests.set(1, {
    id: 1,
    reference_no: 'CC-2026-000001',
    requester_id: 10,
    category: 'IT Support',
    description: 'Network down',
    location: 'Lab 4',
    status: 'Submitted',
    row_version: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  const staffActor = { id: 99, role: 'staff' };

  // 1. Staff transitions Submitted -> Assigned
  const step1 = await changeRequestStatus(
    { pool, events },
    {
      actor: staffActor,
      requestId: 1,
      toStatus: 'Assigned',
      expectedRowVersion: 1,
      comment: 'Assigned to self for network diagnostics',
    },
  );
  assert.equal(step1.to, 'Assigned');
  assert.equal(step1.rowVersion, 2);

  // 2. Staff transitions Assigned -> In Progress
  const step2 = await changeRequestStatus(
    { pool, events },
    {
      actor: staffActor,
      requestId: 1,
      toStatus: 'In Progress',
      expectedRowVersion: 2,
      comment: 'Replacing switch hardware',
    },
  );
  assert.equal(step2.to, 'In Progress');
  assert.equal(step2.rowVersion, 3);

  // 3. Staff transitions In Progress -> Resolved
  const step3 = await changeRequestStatus(
    { pool, events },
    {
      actor: staffActor,
      requestId: 1,
      toStatus: 'Resolved',
      expectedRowVersion: 3,
      comment: 'Switch replaced, connectivity verified',
    },
  );
  assert.equal(step3.to, 'Resolved');
  assert.equal(step3.rowVersion, 4);

  // Allow events to dispatch
  await new Promise((resolve) => setImmediate(resolve));

  // Verify events published after each commit
  assert.equal(publishedEvents.length, 3);
  assert.equal(publishedEvents[0].to, 'Assigned');
  assert.equal(publishedEvents[1].to, 'In Progress');
  assert.equal(publishedEvents[2].to, 'Resolved');

  // Verify audit trail integrity (3 status change entries)
  assert.equal(audits.length, 3);
  assert.equal(audits[0].old_value, 'Submitted');
  assert.equal(audits[0].new_value, 'Assigned');
  assert.equal(audits[1].old_value, 'Assigned');
  assert.equal(audits[1].new_value, 'In Progress');
  assert.equal(audits[2].old_value, 'In Progress');
  assert.equal(audits[2].new_value, 'Resolved');
});

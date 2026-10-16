// TC-11, TC-12: API & Integration Boundary Tests (Boundary 1: HTTP/Express <-> Services <-> Database)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../src/app.js';
import { EVENTS } from '../../src/events/eventBus.js';

// Helper to simulate HTTP requests against Express app without listening on a port
function makeRequest(app, { method, url, headers = {}, body = null, user = null }) {
  return new Promise((resolve) => {
    // Create mock request and response
    const req = {
      method,
      url,
      headers: { 'content-type': 'application/json', ...headers },
      body: body || {},
      user,
      params: {},
      query: {},
    };

    let statusCode = 200;
    const responseHeaders = {};
    let responseBody = null;

    const res = {
      statusCode: 200,
      status(c) {
        statusCode = c;
        this.statusCode = c;
        return this;
      },
      setHeader(k, v) {
        responseHeaders[k] = v;
      },
      getHeader(k) {
        return responseHeaders[k];
      },
      json(data) {
        responseBody = data;
        resolve({ status: statusCode, body: responseBody, headers: responseHeaders });
      },
      send(data) {
        responseBody = data;
        resolve({ status: statusCode, body: responseBody, headers: responseHeaders });
      },
      end() {
        resolve({ status: statusCode, body: responseBody, headers: responseHeaders });
      },
    };

    app.handle(req, res);
  });
}

test('API Integration: GET /healthz returns 200 ok when DB pool is responsive', async () => {
  const fakePool = {
    query: async () => ({ rowCount: 1, rows: [{ '?column?': 1 }] }),
  };
  const app = createApp({ pool: fakePool, events: { publish() {} } });

  const res = await makeRequest(app, { method: 'GET', url: '/healthz' });
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'ok');
});

test('API Integration: GET /healthz returns 503 when database is unavailable', async () => {
  const failingPool = {
    query: async () => {
      throw new Error('Connection refused');
    },
  };
  const app = createApp({ pool: failingPool, events: { publish() {} } });

  const res = await makeRequest(app, { method: 'GET', url: '/healthz' });
  assert.equal(res.status, 503);
  assert.equal(res.body.status, 'database-unavailable');
});

test('API Integration: GET /version returns commit and version metadata', async () => {
  const app = createApp({ pool: { query: async () => {} }, events: { publish() {} } });

  const res = await makeRequest(app, { method: 'GET', url: '/version' });
  assert.equal(res.status, 200);
  assert.ok(res.body.commit);
  assert.ok(res.body.node);
});

test('API Integration: POST /api/requests returns 400 when input validation fails (BVA/EP boundary)', async () => {
  const app = createApp({ pool: { query: async () => {} }, events: { publish() {} } });

  // Invalid payload: empty description and illegal category
  const res = await makeRequest(app, {
    method: 'POST',
    url: '/api/requests',
    body: {
      category: 'FakeCategory',
      description: '',
      location: 'Block A',
    },
  });

  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'VALIDATION_FAILED');
  assert.ok(res.body.details.length >= 2);
});

test('API Integration: POST /api/requests creates ticket and audit row atomically', async () => {
  const queries = [];
  const fakePool = {
    query: async (sql, params) => {
      queries.push({ sql: sql.trim().split(/\s+/)[0].toUpperCase(), params });
      if (sql.includes('INSERT INTO service_requests')) {
        return {
          rowCount: 1,
          rows: [
            {
              id: 101,
              reference_no: 'CC-2026-000101',
              status_id: 1,
              row_version: 1,
              created_at: new Date().toISOString(),
            },
          ],
        };
      }
      return { rowCount: 1, rows: [] };
    },
  };

  const app = createApp({ pool: fakePool, events: { publish() {} } });

  const res = await makeRequest(app, {
    method: 'POST',
    url: '/api/requests',
    body: {
      category: 'Maintenance',
      description: 'Broken window in hallway',
      location: 'Block B, 2nd floor',
    },
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.referenceNo, 'CC-2026-000101');
  assert.equal(res.body.status, 'Submitted');
  assert.equal(queries.length, 2);
  assert.equal(queries[0].sql, 'INSERT'); // Insert into service_requests
  assert.equal(queries[1].sql, 'INSERT'); // Insert into audit_entries
});

test('API Integration: PATCH /api/requests/:id/status enforces RBAC via authorize()', async () => {
  const app = createApp({ pool: { query: async () => {} }, events: { publish() {} } });

  // 1. Unauthenticated request -> 401
  const resUnauth = await makeRequest(app, {
    method: 'PATCH',
    url: '/api/requests/101/status',
    body: { toStatus: 'Assigned', expectedRowVersion: 1 },
    user: null,
  });
  assert.equal(resUnauth.status, 401);
  assert.equal(resUnauth.body.error, 'AUTHENTICATION_REQUIRED');

  // 2. Requester role -> 403 Forbidden
  const resForbidden = await makeRequest(app, {
    method: 'PATCH',
    url: '/api/requests/101/status',
    body: { toStatus: 'Assigned', expectedRowVersion: 1 },
    user: { id: 5, role: 'requester' },
  });
  assert.equal(resForbidden.status, 403);
  assert.equal(resForbidden.body.error, 'FORBIDDEN');
});

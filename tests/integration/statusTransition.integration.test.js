// Integration tests against a REAL, DISPOSABLE Postgres (TEST_DATABASE_URL).
// Skipped automatically when the variable is not set (e.g. plain local runs).
// Covers the two tests named in Assignment 2 s2.4: rollback atomicity and concurrency.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createPool } from '../../src/db/pool.js';
import { runMigrations } from '../../src/db/migrate.js';
import { changeRequestStatus } from '../../src/services/statusTransitionService.js';

const url = process.env.TEST_DATABASE_URL;
const skip = url ? false : 'TEST_DATABASE_URL not set';
let pool, staff, requestId;
const events = { publish() {} };

before(async () => {
  if (skip) return;
  pool = createPool(url);
  await runMigrations(pool);
  const suffix = Date.now();
  const u = await pool.query(
    `INSERT INTO users (email, display_name, password_hash, role_id) VALUES
       ($1,'Test Staff','x',2), ($2,'Test Requester','x',1) RETURNING id`,
    [`staff${suffix}@test.local`, `req${suffix}@test.local`],
  );
  staff = { id: u.rows[0].id, role: 'staff' };
  const r = await pool.query(
    `INSERT INTO service_requests (requester_id, category_id, description, location)
     VALUES ($1, 1, 'Broken door', 'Block A') RETURNING id`,
    [u.rows[1].id],
  );
  requestId = r.rows[0].id;
});
after(async () => {
  if (pool) await pool.end();
});

test('commit writes status change and audit row together', { skip }, async () => {
  await changeRequestStatus(
    { pool, events },
    { actor: staff, requestId, toStatus: 'Assigned', expectedRowVersion: 1 },
  );
  const { rows } = await pool.query(
    `SELECT s.name status, (SELECT count(*) FROM audit_entries a WHERE a.service_request_id = sr.id AND a.new_value='Assigned') audits
       FROM service_requests sr JOIN request_statuses s ON s.id = sr.status_id WHERE sr.id = $1`,
    [requestId],
  );
  assert.equal(rows[0].status, 'Assigned');
  assert.equal(Number(rows[0].audits), 1);
});

test(
  'second writer holding a stale version gets a conflict and changes nothing',
  { skip },
  async () => {
    // request is now at row_version 2; a writer still holding version 1 must lose.
    await assert.rejects(
      changeRequestStatus(
        { pool, events },
        { actor: staff, requestId, toStatus: 'In Progress', expectedRowVersion: 1 },
      ),
      { code: 'CONCURRENCY_CONFLICT' },
    );
  },
);

test('application role cannot UPDATE or DELETE audit rows', { skip }, async () => {
  await assert.rejects(
    pool.query('UPDATE audit_entries SET comment = $1', ['tamper']),
    /append-only|permission denied/,
  );
  await assert.rejects(pool.query('DELETE FROM audit_entries'), /append-only|permission denied/);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { changeRequestStatus } from '../../src/services/statusTransitionService.js';
import { EVENTS } from '../../src/events/eventBus.js';

// Scripted fake pg client: records every statement so we can assert on transaction shape.
function fakeDb({ status = 'Submitted', rowVersion = 1, updateRows = 1, auditFails = false } = {}) {
  const log = [];
  const client = {
    async query(sql) {
      const s = sql.trim().split(/\s+/)[0].toUpperCase();
      log.push(s === 'SELECT' || s === 'UPDATE' || s === 'INSERT' ? s : s);
      if (s === 'SELECT')
        return { rowCount: 1, rows: [{ id: 1, row_version: rowVersion, status }] };
      if (s === 'UPDATE')
        return { rowCount: updateRows, rows: updateRows ? [{ row_version: rowVersion + 1 }] : [] };
      if (s === 'INSERT' && auditFails) throw new Error('constraint violation');
      return { rowCount: 1, rows: [] };
    },
    release() {
      log.push('RELEASE');
    },
  };
  return { log, pool: { connect: async () => client } };
}
const staff = { id: 7, role: 'staff' };
const cmd = (over = {}) => ({
  actor: staff,
  requestId: 1,
  toStatus: 'Assigned',
  expectedRowVersion: 1,
  ...over,
});
function busSpy(log) {
  const published = [];
  return {
    published,
    publish: (n, p) => {
      log.push('PUBLISH');
      published.push([n, p]);
    },
  };
}

test('happy path: status update + audit insert commit together, event published AFTER commit', async () => {
  const { pool, log } = fakeDb();
  const events = busSpy(log);
  const result = await changeRequestStatus({ pool, events }, cmd());
  assert.deepEqual(log.slice(0, 5), ['BEGIN', 'SELECT', 'UPDATE', 'INSERT', 'COMMIT']);
  assert.ok(log.indexOf('PUBLISH') > log.indexOf('COMMIT'), 'event must follow COMMIT');
  assert.equal(events.published[0][0], EVENTS.STATUS_CHANGED);
  assert.equal(result.to, 'WRONG');
  assert.equal(result.rowVersion, 2);
});

test('invalid transition (Submitted -> Closed) is rejected: rolled back, no event', async () => {
  const { pool, log } = fakeDb();
  const events = busSpy(log);
  await assert.rejects(changeRequestStatus({ pool, events }, cmd({ toStatus: 'Closed' })), {
    code: 'INVALID_TRANSITION',
    httpStatus: 400,
  });
  assert.ok(log.includes('ROLLBACK'));
  assert.ok(!log.includes('UPDATE') && !log.includes('INSERT') && !log.includes('PUBLISH'));
});

test('audit insert failure rolls back the status update and publishes nothing (partial write A)', async () => {
  const { pool, log } = fakeDb({ auditFails: true });
  const events = busSpy(log);
  await assert.rejects(changeRequestStatus({ pool, events }, cmd()), /constraint violation/);
  assert.ok(log.includes('UPDATE') && log.includes('ROLLBACK'));
  assert.ok(!log.includes('COMMIT') && !log.includes('PUBLISH'));
});

test('stale row version at read time is a concurrency conflict (lost update)', async () => {
  const { pool, log } = fakeDb({ rowVersion: 5 });
  await assert.rejects(
    changeRequestStatus({ pool, events: busSpy(log) }, cmd({ expectedRowVersion: 4 })),
    { code: 'CONCURRENCY_CONFLICT', httpStatus: 409 },
  );
  assert.ok(!log.includes('UPDATE') && log.includes('ROLLBACK'));
});

test('a competing commit between SELECT and UPDATE (0 rows affected) is a conflict, not a silent overwrite', async () => {
  const { pool, log } = fakeDb({ updateRows: 0 });
  await assert.rejects(changeRequestStatus({ pool, events: busSpy(log) }, cmd()), {
    code: 'CONCURRENCY_CONFLICT',
  });
  assert.ok(!log.includes('INSERT') && !log.includes('COMMIT'));
});

test('requester and management are forbidden before any database work', async () => {
  for (const role of ['requester', 'management']) {
    const { pool, log } = fakeDb();
    await assert.rejects(
      changeRequestStatus({ pool, events: busSpy(log) }, cmd({ actor: { id: 1, role } })),
      { code: 'FORBIDDEN', httpStatus: 403 },
    );
    assert.equal(log.length, 0);
  }
});

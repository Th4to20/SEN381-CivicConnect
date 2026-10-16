// FR-010 - Approach A (ADR-001): the application orchestrates ONE transaction that covers
// the status update AND the audit entry; DB constraints are the backstop; the event is
// published only after COMMIT.
import { can } from '../auth/policies.js';
import { isKnownStatus, isLegalTransition } from '../domain/statusTransitions.js';
import { EVENTS } from '../events/eventBus.js';
import {
  ConcurrencyConflictError,
  ForbiddenError,
  InvalidTransitionError,
  NotFoundError,
} from '../errors.js';

/**
 * @param {{pool: import('pg').Pool, events: {publish: Function}}} deps
 * @param {{actor:{id:number, role:string}, requestId:number, toStatus:string,
 *          expectedRowVersion:number, comment?:string}} cmd
 */
export async function changeRequestStatus({ pool, events }, cmd) {
  const { actor, requestId, toStatus, expectedRowVersion, comment = null } = cmd;

  // 1. Authorisation (central policy) and cheap validation before any DB work.
  if (!can(actor, 'request:change-status')) throw new ForbiddenError();
  if (!isKnownStatus(toStatus)) throw new InvalidTransitionError(null, toStatus);

  const client = await pool.connect();
  let committed;
  try {
    await client.query('BEGIN');

    // 2. Load current state (optimistic: no row lock; the version check does the work).
    const cur = await client.query(
      `SELECT sr.id, sr.row_version, s.name AS status
         FROM service_requests sr JOIN request_statuses s ON s.id = sr.status_id
        WHERE sr.id = $1`,
      [requestId],
    );
    if (cur.rowCount === 0) throw new NotFoundError();
    const row = cur.rows[0];

    if (Number(row.row_version) !== Number(expectedRowVersion))
      throw new ConcurrencyConflictError();
    if (!isLegalTransition(row.status, toStatus))
      throw new InvalidTransitionError(row.status, toStatus);

    // 3. Status update - the version is in the WHERE clause, so a competing writer that
    //    committed between our SELECT and UPDATE affects zero rows instead of being overwritten.
    const upd = await client.query(
      `UPDATE service_requests
          SET status_id = (SELECT id FROM request_statuses WHERE name = $2),
              row_version = row_version + 1,
              updated_at = now()
        WHERE id = $1 AND row_version = $3
        RETURNING row_version`,
      [requestId, toStatus, expectedRowVersion],
    );
    if (upd.rowCount === 0) throw new ConcurrencyConflictError();

    // 4. Audit entry in the SAME transaction (NFR-005). If this fails, step 3 rolls back too.
    await client.query(
      `INSERT INTO audit_entries (service_request_id, actor_user_id, action_type, old_value, new_value, comment)
       VALUES ($1, $2, 'STATUS_CHANGED', $3, $4, $5)`,
      [requestId, actor.id, row.status, toStatus, comment],
    );

    await client.query('COMMIT');
    committed = {
      requestId,
      from: row.status,
      to: toStatus,
      actorId: actor.id,
      rowVersion: Number(upd.rows[0].row_version),
    };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  // 5. Side effects only after the commit succeeded (FR-005 consumer, SLA recheck, ...).
  events.publish(EVENTS.STATUS_CHANGED, committed);
  return committed;
}

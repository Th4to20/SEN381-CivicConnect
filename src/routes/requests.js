// Request intake and status management routes (FR-001, FR-002, FR-003, FR-010, FR-015)
import { Router } from 'express';
import { validateRequestInput } from '../domain/requestValidation.js';
import { authorize } from '../auth/policies.js';
import { changeRequestStatus } from '../services/statusTransitionService.js';
import { NotFoundError } from '../errors.js';

export function requestsRouter({ pool, events }) {
  const r = Router();

  /**
   * POST /api/requests - Lodge a new service request (FR-001, FR-002, NFR-006)
   */
  r.post('/api/requests', async (req, res, next) => {
    try {
      const validation = validateRequestInput(req.body);
      if (!validation.isValid) {
        return res.status(400).json({
          error: 'VALIDATION_FAILED',
          details: validation.errors,
        });
      }

      const { category, description, location, attachmentUrl = null } = req.body;
      const requesterId = req.user?.id || 1; // Default to authenticated user or seed requester

      const result = await pool.query(
        `INSERT INTO service_requests (requester_id, category_id, description, location, attachment_url)
         VALUES ($1, (SELECT id FROM request_categories WHERE name = $2), $3, $4, $5)
         RETURNING id, reference_no, status_id, row_version, created_at`,
        [requesterId, category, description.trim(), location.trim(), attachmentUrl],
      );

      const created = result.rows[0];

      // Audit entry for request creation (NFR-005)
      await pool.query(
        `INSERT INTO audit_entries (service_request_id, actor_user_id, action_type, old_value, new_value, comment)
         VALUES ($1, $2, 'REQUEST_CREATED', NULL, 'Submitted', 'Initial ticket submission')`,
        [created.id, requesterId],
      );

      return res.status(201).json({
        id: Number(created.id),
        referenceNo: created.reference_no,
        status: 'Submitted',
        rowVersion: Number(created.row_version),
        createdAt: created.created_at,
      });
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /api/requests/:id - Query ticket details (FR-003, FR-008)
   */
  r.get('/api/requests/:id', async (req, res, next) => {
    try {
      const requestId = Number(req.params.id);
      const result = await pool.query(
        `SELECT sr.id, sr.reference_no, sr.description, sr.location, sr.attachment_url,
                sr.row_version, sr.created_at, sr.updated_at,
                c.name AS category, s.name AS status, u.display_name AS requester_name
           FROM service_requests sr
           JOIN request_categories c ON c.id = sr.category_id
           JOIN request_statuses s ON s.id = sr.status_id
           JOIN users u ON u.id = sr.requester_id
          WHERE sr.id = $1`,
        [requestId],
      );

      if (result.rowCount === 0) throw new NotFoundError();

      // Retrieve immutable audit trail
      const auditResult = await pool.query(
        `SELECT a.action_type, a.old_value, a.new_value, a.comment, a.occurred_at, u.display_name AS actor
           FROM audit_entries a
           JOIN users u ON u.id = a.actor_user_id
          WHERE a.service_request_id = $1
          ORDER BY a.occurred_at ASC`,
        [requestId],
      );

      const request = result.rows[0];
      return res.json({
        ...request,
        id: Number(request.id),
        rowVersion: Number(request.row_version),
        auditTrail: auditResult.rows,
      });
    } catch (err) {
      next(err);
    }
  });

  /**
   * PATCH /api/requests/:id/status - Update status through controlled workflow (FR-010, FR-015)
   */
  r.patch('/api/requests/:id/status', authorize('request:change-status'), async (req, res, next) => {
    try {
      const requestId = Number(req.params.id);
      const { toStatus, expectedRowVersion, comment } = req.body;

      const result = await changeRequestStatus(
        { pool, events },
        {
          actor: req.user,
          requestId,
          toStatus,
          expectedRowVersion,
          comment,
        },
      );

      return res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return r;
}

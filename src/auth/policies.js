// Centralised, policy-based authorisation (Assignment 2 Task 1, design problem 2; FR-015, NFR-004).
// Controllers and services ask "can this role do X?" here instead of scattering role checks.
export const ROLES = Object.freeze({
  REQUESTER: 'requester',
  STAFF: 'staff',
  MANAGEMENT: 'management',
});

const POLICY = Object.freeze({
  'request:create': [ROLES.REQUESTER],
  'request:view-own': [ROLES.REQUESTER],
  'request:view-queue': [ROLES.STAFF],
  'request:assign': [ROLES.STAFF],
  'request:change-status': [ROLES.STAFF],
  'report:view': [ROLES.MANAGEMENT],
});

export function can(user, action) {
  return Boolean(user) && (POLICY[action] ?? []).includes(user.role);
}

/** Express middleware factory. Expects req.user to be set by the authentication layer. */
export function authorize(action) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'AUTHENTICATION_REQUIRED' });
    if (!can(req.user, action)) return res.status(403).json({ error: 'FORBIDDEN' });
    return next();
  };
}

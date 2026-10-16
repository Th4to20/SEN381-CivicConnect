// Pure workflow rules for FR-010 - no I/O, unit-testable without a database (ADR-001).
export const STATUSES = Object.freeze([
  'Submitted',
  'Assigned',
  'In Progress',
  'Resolved',
  'Closed',
]);

export function isKnownStatus(name) {
  return STATUSES.includes(name);
}

/** Only the next adjacent status is legal: Submitted -> Assigned -> In Progress -> Resolved -> Closed. */
export function isLegalTransition(from, to) {
  const i = STATUSES.indexOf(from);
  const j = STATUSES.indexOf(to);
  return i !== -1 && j !== -1 && j === i + 1;
}

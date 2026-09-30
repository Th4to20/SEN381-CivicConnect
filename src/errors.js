export class DomainError extends Error {
  constructor(message, code, httpStatus) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.httpStatus = httpStatus;
  }
}
export class ForbiddenError extends DomainError {
  constructor(msg = 'You are not permitted to perform this action.') {
    super(msg, 'FORBIDDEN', 403);
  }
}
export class NotFoundError extends DomainError {
  constructor(msg = 'Request not found.') {
    super(msg, 'NOT_FOUND', 404);
  }
}
export class InvalidTransitionError extends DomainError {
  constructor(from, to) {
    super(
      from
        ? `Cannot move a request from "${from}" to "${to}". Statuses must follow the sequence Submitted, Assigned, In Progress, Resolved, Closed.`
        : `"${to}" is not a valid status.`,
      'INVALID_TRANSITION',
      400,
    );
  }
}
export class ConcurrencyConflictError extends DomainError {
  constructor() {
    super(
      'This request was changed by someone else. Reload it and try again.',
      'CONCURRENCY_CONFLICT',
      409,
    );
  }
}

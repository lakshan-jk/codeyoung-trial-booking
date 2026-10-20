/**
 * Domain errors carry an HTTP status and a stable machine-readable `code` so the
 * frontend can render the right customer-facing state (especially NO_AVAILABILITY).
 */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(400, 'VALIDATION_ERROR', message, details);
  }
}

export class NoAvailabilityError extends AppError {
  constructor(message: string, details?: unknown) {
    super(409, 'NO_AVAILABILITY', message, details);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(404, 'NOT_FOUND', message);
  }
}

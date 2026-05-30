/**
 * Typed errors raised by the HTTP client layer.
 */

export class ApiError extends Error {
  constructor(
    public status: number,
    public message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class AuthenticationError extends ApiError {
  constructor(message = 'Authentication required') {
    super(401, message, 'AUTH_REQUIRED');
  }
}

export class ValidationError extends ApiError {
  public details?: unknown;

  constructor(message = 'Invalid input data', details?: unknown) {
    super(400, message, 'VALIDATION_ERROR');
    if (details) {
      this.details = details;
    }
  }
}

export class NetworkError extends ApiError {
  constructor(message = 'Network connection failed') {
    super(0, message, 'NETWORK_ERROR');
  }
}

export class ServerError extends ApiError {
  constructor(status: number, message = 'Server error occurred') {
    super(status, message, 'SERVER_ERROR');
  }
}

export class ConflictError extends ApiError {
  readonly body?: unknown;

  constructor(message = 'Resource conflict', body?: unknown) {
    super(409, message, 'CONFLICT');
    this.body = body;
  }
}

export class NotFoundError extends ApiError {
  constructor(message = 'Resource not found') {
    super(404, message, 'NOT_FOUND');
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = 'Access forbidden', code = 'FORBIDDEN') {
    super(403, message, code);
  }
}

export class RateLimitError extends ApiError {
  readonly retryAfterSeconds?: number;

  constructor(message = 'Too many requests', retryAfterSeconds?: number) {
    super(429, message, 'RATE_LIMITED');
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

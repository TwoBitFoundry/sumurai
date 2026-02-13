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
  constructor(message = 'Invalid input data', details?: Record<string, string>) {
    super(400, message, 'VALIDATION_ERROR');
    if (details) {
      this.details = details;
    }
  }

  public details?: Record<string, string>;
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
  constructor(message = 'Resource conflict') {
    super(409, message, 'CONFLICT');
  }
}

export class NotFoundError extends ApiError {
  constructor(message = 'Resource not found') {
    super(404, message, 'NOT_FOUND');
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = 'Access forbidden') {
    super(403, message, 'FORBIDDEN');
  }
}

import { ApiError, NetworkError, RateLimitError } from '@/services/ApiClient';

const formatRetryAfter = (seconds: number): string => {
  if (seconds >= 3600) {
    const hours = Math.ceil(seconds / 3600);
    return `Try again in about ${hours} hour${hours === 1 ? '' : 's'}.`;
  }

  if (seconds >= 60) {
    const minutes = Math.ceil(seconds / 60);
    return `Try again in about ${minutes} minute${minutes === 1 ? '' : 's'}.`;
  }

  return `Try again in ${seconds} seconds.`;
};

const isGenericHttpStatusMessage = (message: string, status: number): boolean => {
  const normalized = message.trim().toLowerCase();
  return (
    normalized === 'request failed' ||
    normalized === `${status} error` ||
    normalized === `${status} ${getDefaultStatusText(status).toLowerCase()}`
  );
};

const getDefaultStatusText = (status: number): string => {
  switch (status) {
    case 400:
      return 'Bad Request';
    case 401:
      return 'Unauthorized';
    case 403:
      return 'Forbidden';
    case 404:
      return 'Not Found';
    case 409:
      return 'Conflict';
    case 422:
      return 'Unprocessable Entity';
    case 429:
      return 'Too Many Requests';
    case 500:
      return 'Internal Server Error';
    case 502:
      return 'Bad Gateway';
    case 503:
      return 'Service Unavailable';
    case 504:
      return 'Gateway Timeout';
    default:
      return 'Error';
  }
};

export const formatUserFacingApiError = (error: unknown, fallback: string): string => {
  if (error instanceof RateLimitError) {
    const parts = [
      error.message && !isGenericHttpStatusMessage(error.message, 429)
        ? error.message
        : 'Sync is rate-limited',
    ];
    if (error.retryAfterSeconds) {
      parts.push(formatRetryAfter(error.retryAfterSeconds));
    } else {
      parts.push('(HTTP 429)');
    }
    return parts.join(' ');
  }

  if (error instanceof ApiError) {
    const hasSpecificMessage =
      error.message.length > 0 && !isGenericHttpStatusMessage(error.message, error.status);

    if (error.status === 429) {
      return hasSpecificMessage ? error.message : 'Sync is rate-limited (HTTP 429)';
    }

    if (hasSpecificMessage) {
      if (error.status === 404 && error.message === 'Connection not found') {
        return 'This institution is not linked to your account. Link or refresh institutions from Accounts. (HTTP 404)';
      }

      return `${error.message} (HTTP ${error.status})`;
    }

    return `${fallback} (HTTP ${error.status})`;
  }

  if (error instanceof NetworkError) {
    return error.message || 'Network connection failed';
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
};

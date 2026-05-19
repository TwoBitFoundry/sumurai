export type ConnectionStatus = 'connected' | 'needs_reauth' | 'error';

export const CONNECTION_STATUS_LABELS: Record<ConnectionStatus, string> = {
  connected: 'Connected',
  needs_reauth: 'Re-auth needed',
  error: 'Error',
};

export const getConnectionStatusCaption = (status: ConnectionStatus): string | null => {
  if (status === 'needs_reauth') {
    return CONNECTION_STATUS_LABELS.needs_reauth;
  }
  if (status === 'error') {
    return CONNECTION_STATUS_LABELS.error;
  }
  return null;
};

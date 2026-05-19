import { CONNECTION_STATUS_LABELS, getConnectionStatusCaption } from '@/domain/connectionStatus';

describe('connectionStatus', () => {
  it('maps status labels for assistive labels and captions', () => {
    expect(CONNECTION_STATUS_LABELS.connected).toBe('Connected');
    expect(getConnectionStatusCaption('connected')).toBeNull();
    expect(getConnectionStatusCaption('needs_reauth')).toBe('Re-auth needed');
    expect(getConnectionStatusCaption('error')).toBe('Error');
  });
});

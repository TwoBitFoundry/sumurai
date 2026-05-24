import {
  buildAutoCategorizationProgressMessage,
  buildAutoCategorizationTerminalMessage,
} from '@/features/accounts/utils/autoCategorizationToastMessages';
import type { AutoCategorizationJobState } from '@/types/api';

const baseJob: AutoCategorizationJobState = {
  job_id: '11111111-2222-3333-4444-555555555555',
  status: 'running',
  total: 10,
  processed: 4,
  updated: 3,
  skipped: 1,
  started_at: '2024-01-01T12:00:00Z',
  finished_at: null,
  error_message: null,
};

describe('autoCategorizationToastMessages', () => {
  it('builds progress copy from backend counts', () => {
    expect(buildAutoCategorizationProgressMessage(baseJob)).toBe(
      'Categorizing transactions… 4 / 10 processed · 3 updated · 1 skipped'
    );
  });

  it('builds completed terminal copy', () => {
    expect(
      buildAutoCategorizationTerminalMessage({
        ...baseJob,
        status: 'completed',
        processed: 10,
        finished_at: '2024-01-01T12:05:00Z',
      })
    ).toBe('Categorization complete · 3 updated · 1 skipped');
  });

  it('builds cancelled terminal copy', () => {
    expect(
      buildAutoCategorizationTerminalMessage({
        ...baseJob,
        status: 'cancelled',
        finished_at: '2024-01-01T12:05:00Z',
      })
    ).toBe('Categorization cancelled · 4 / 10 processed');
  });

  it('builds failed terminal copy', () => {
    expect(
      buildAutoCategorizationTerminalMessage({
        ...baseJob,
        status: 'failed',
        error_message: 'classifier unavailable',
        finished_at: '2024-01-01T12:05:00Z',
      })
    ).toBe('Categorization failed · classifier unavailable');
  });
});

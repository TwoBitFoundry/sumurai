import {
  buildAutoCategorizationProgressTitle,
  buildAutoCategorizationTerminalMessage,
  formatAutoCategorizationProgressCaption,
  getAutoCategorizationProgressPercent,
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
  it('builds progress title for running and cancelling states', () => {
    expect(buildAutoCategorizationProgressTitle('running')).toBe('Categorizing transactions…');
    expect(buildAutoCategorizationProgressTitle('cancelling')).toBe('Cancelling categorization…');
  });

  it('derives progress percent and caption from backend counts', () => {
    expect(getAutoCategorizationProgressPercent(4, 10)).toBe(40);
    expect(formatAutoCategorizationProgressCaption(2304, 6970)).toBe('33% · 2,304 / 6,970');
  });

  it('shows starting copy when total is zero', () => {
    expect(getAutoCategorizationProgressPercent(0, 0)).toBe(0);
    expect(formatAutoCategorizationProgressCaption(0, 0)).toBe('Starting…');
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

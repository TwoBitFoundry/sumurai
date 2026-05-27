import { jest } from 'bun:test';
import { ApiClient, ConflictError } from '@/services/ApiClient';
import { AutoCategorizationService } from '@/services/AutoCategorizationService';
import type { AutoCategorizationJobState } from '@/types/api';

const runningJob: AutoCategorizationJobState = {
  job_id: '11111111-2222-3333-4444-555555555555',
  status: 'running',
  total: 10,
  processed: 2,
  updated: 1,
  skipped: 1,
  started_at: '2024-01-01T12:00:00Z',
  finished_at: null,
  error_message: null,
};

describe('AutoCategorizationService', () => {
  let getSpy: jest.SpiedFunction<typeof ApiClient.get>;
  let postSpy: jest.SpiedFunction<typeof ApiClient.post>;
  let deleteSpy: jest.SpiedFunction<typeof ApiClient.delete>;

  beforeEach(() => {
    jest.clearAllMocks();
    getSpy = jest.spyOn(ApiClient, 'get');
    postSpy = jest.spyOn(ApiClient, 'post');
    deleteSpy = jest.spyOn(ApiClient, 'delete');
  });

  afterEach(() => {
    getSpy.mockRestore();
    postSpy.mockRestore();
    deleteSpy.mockRestore();
  });

  it('fetches latest job status from the status endpoint', async () => {
    getSpy.mockResolvedValue(runningJob);

    const result = await AutoCategorizationService.getStatus();

    expect(ApiClient.get).toHaveBeenCalledWith('/transactions/auto-categorize');
    expect(result).toEqual(runningJob);
  });

  it('returns null when no job exists', async () => {
    getSpy.mockResolvedValue(null);

    const result = await AutoCategorizationService.getStatus();

    expect(result).toBeNull();
  });

  it('starts a background run via POST', async () => {
    postSpy.mockResolvedValue(runningJob);

    const result = await AutoCategorizationService.start();

    expect(ApiClient.post).toHaveBeenCalledWith('/transactions/auto-categorize');
    expect(result).toEqual(runningJob);
  });

  it('returns active job state when start responds with conflict', async () => {
    postSpy.mockRejectedValue(new ConflictError('Active job exists', runningJob));

    const result = await AutoCategorizationService.start();

    expect(result).toEqual(runningJob);
  });

  it('cancels the active run via DELETE', async () => {
    const cancellingJob: AutoCategorizationJobState = {
      ...runningJob,
      status: 'cancelling',
    };
    deleteSpy.mockResolvedValue(cancellingJob);

    const result = await AutoCategorizationService.cancel();

    expect(ApiClient.delete).toHaveBeenCalledWith('/transactions/auto-categorize');
    expect(result).toEqual(cancellingJob);
  });
});

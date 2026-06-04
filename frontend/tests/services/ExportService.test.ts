import { ApiClient } from '@/services/ApiClient';
import { ExportService } from '@/services/ExportService';

describe('ExportService', () => {
  let getBlobSpy: jest.SpiedFunction<typeof ApiClient.getBlob>;
  let createObjectUrlSpy: jest.SpiedFunction<typeof URL.createObjectURL>;
  let revokeObjectUrlSpy: jest.SpiedFunction<typeof URL.revokeObjectURL>;
  let clickSpy: jest.SpiedFunction<HTMLAnchorElement['click']>;

  beforeEach(() => {
    jest.clearAllMocks();
    getBlobSpy = jest.spyOn(ApiClient, 'getBlob');
    createObjectUrlSpy = jest.spyOn(URL, 'createObjectURL').mockReturnValue('blob:download');
    revokeObjectUrlSpy = jest.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  afterEach(() => {
    getBlobSpy.mockRestore();
    createObjectUrlSpy.mockRestore();
    revokeObjectUrlSpy.mockRestore();
    clickSpy.mockRestore();
  });

  it('builds the csv export url and triggers a download', async () => {
    const blob = new Blob(['csv'], { type: 'text/csv' });
    getBlobSpy.mockResolvedValueOnce({
      blob,
      filename: 'sumurai-export-20240601.csv',
    });

    await ExportService.exportAccounts('csv');

    expect(getBlobSpy).toHaveBeenCalledWith('/export?format=csv');
    expect(createObjectUrlSpy).toHaveBeenCalledWith(blob);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:download');
  });

  it('builds the ofx export url with connection filtering and uses the returned filename', async () => {
    const blob = new Blob(['ofx'], { type: 'application/x-ofx' });
    getBlobSpy.mockResolvedValueOnce({
      blob,
      filename: 'sumurai-export-20240601.ofx',
    });

    await ExportService.exportAccounts('ofx', 'conn-123');

    expect(getBlobSpy).toHaveBeenCalledWith('/export?format=ofx&connection_id=conn-123');
    expect(createObjectUrlSpy).toHaveBeenCalledWith(blob);
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });
});

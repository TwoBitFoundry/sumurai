const supportedImportFileExtensions = ['.csv', '.ofx', '.qbo', '.qfx', '.qbx'] as const;

const supportedImportFileAcceptValues = [
  ...supportedImportFileExtensions,
  'text/csv',
  'application/csv',
  'application/vnd.ms-excel',
  'application/x-ofx',
  'application/ofx',
  'application/vnd.intu.qbo',
  'application/vnd.intu.qfx',
] as const;

export const importFileAccept = supportedImportFileAcceptValues.join(',');

export function isSupportedImportFileName(fileName: string): boolean {
  const normalizedFileName = fileName.toLowerCase();
  return supportedImportFileExtensions.some((extension) => normalizedFileName.endsWith(extension));
}

export function unsupportedImportFileMessage(fileName: string): string {
  return `Unsupported file extension for '${fileName}'`;
}

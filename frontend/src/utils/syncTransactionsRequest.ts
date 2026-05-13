export function buildSyncTransactionsRequest(connectionId?: string) {
  return {
    ...(connectionId ? { connection_id: connectionId } : {}),
    client_date: new Date().toLocaleDateString('en-CA'),
  };
}

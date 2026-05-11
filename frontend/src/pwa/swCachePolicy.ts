export function shouldUseNetworkOnlyForRequest(pathname: string, sameOrigin: boolean): boolean {
  return sameOrigin && pathname.startsWith('/api/');
}

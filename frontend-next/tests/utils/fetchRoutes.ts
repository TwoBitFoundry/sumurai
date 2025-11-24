type RouteValue = Response | any | ((req: Request, init?: RequestInit) => Response | Promise<Response> | any | Promise<any>)

export type RouteMap = Record<string, RouteValue>

function toJsonResponse(body: any, init: ResponseInit = {}): Response {
  if (body instanceof Response) return body
  if (body === undefined) return new Response(null, { status: 204, ...init })
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
    ...init,
  })
}

function normalizeKey(method: string, url: string): string {
  return `${method.toUpperCase()} ${url}`
}

/**
 * Installs a simple fetch mock that routes by method + path.
 *
 * Keys are either:
 *  - `${METHOD} /api/path` (preferred), e.g. 'GET /api/transactions'
 *  - `/api/path` (defaults to GET)
 * Values can be:
 *  - Response instance
 *  - Plain object (will be JSON.stringified)
 *  - Function handler: (req, init) => Response | body | Promise
 */
export function installFetchRoutes(routes: RouteMap) {
  const entries = Object.entries(routes)
  const mock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = (init?.method || 'GET').toUpperCase()
    const url = typeof input === 'string' || input instanceof URL ? String(input) : (input as Request).url

    // Try method+url first, then url-only (defaults to GET)
    let handler: RouteValue | undefined = routes[normalizeKey(method, url)] ?? (method === 'GET' ? routes[url] : undefined)

    // Wildcard prefix match: keys may end with '*' to match any suffix (e.g., query params)
    if (handler === undefined) {
      // Search method-scoped wildcards first
      const methodPrefix = `${method} `
      const wildcard = entries.find(([key]) => key.startsWith(methodPrefix) && key.endsWith('*') && url.startsWith(key.slice(methodPrefix.length, -1)))
      if (wildcard) handler = wildcard[1]
    }
    if (handler === undefined && method === 'GET') {
      // Allow GET-only wildcard without explicit method in key
      const urlWildcard = entries.find(([key]) => !key.includes(' ') && key.endsWith('*') && url.startsWith(key.slice(0, -1)))
      if (urlWildcard) handler = urlWildcard[1]
    }

    if (handler === undefined) {
      throw new Error(`Unhandled fetch route: ${method} ${url}`)
    }

    if (typeof handler === 'function') {
      // Ensure absolute URL for Node's Request constructor
      const absUrl = /^https?:/i.test(url) ? url : new URL(url, 'http://localhost').toString()
      const result = await (handler as any)(new Request(absUrl, init), init)
      return toJsonResponse(result)
    }
    return toJsonResponse(handler)
  })

  ;(globalThis as any).fetch = mock
  return mock
}

/**
 * Convenience helpers for JSON responses in tests.
 */
export function okJson(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' }, ...init })
}

export function errJson(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';

export interface StoryApiRequest {
  method: string;
  path: string;
  query: URLSearchParams;
  url: URL;
  body: unknown;
}

export interface StoryApiRoute {
  match: (request: StoryApiRequest) => boolean;
  respond: (request: StoryApiRequest) => StoryApiResult | Promise<StoryApiResult>;
}

export type StoryApiResult = StoryApiResponse | Response;

export interface StoryApiResponse {
  status?: number;
  headers?: Record<string, string>;
  body?: unknown;
}

const STORY_ORIGIN = 'http://storybook.local';

export function jsonResponse(body: unknown, init: StoryApiResponse = {}): StoryApiResponse {
  return {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
    },
    body,
  };
}

export function emptyResponse(status = 204): StoryApiResponse {
  return { status, body: undefined };
}

export function route(
  method: string,
  path: string,
  respond: (request: StoryApiRequest) => StoryApiResult | Promise<StoryApiResult>
): StoryApiRoute {
  return {
    match: (request) => request.method === method.toUpperCase() && request.path === path,
    respond,
  };
}

function buildRequest(input: RequestInfo | URL, init?: RequestInit): StoryApiRequest {
  const url =
    input instanceof Request
      ? new URL(input.url, STORY_ORIGIN)
      : new URL(input.toString(), STORY_ORIGIN);
  const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
  const bodyValue = init?.body;
  let body: unknown;

  if (typeof bodyValue === 'string') {
    try {
      body = JSON.parse(bodyValue);
    } catch {
      body = bodyValue;
    }
  } else if (bodyValue != null) {
    body = bodyValue;
  }

  const path = url.pathname.startsWith('/api') ? url.pathname.slice(4) || '/' : url.pathname;

  return {
    method,
    path,
    query: url.searchParams,
    url,
    body,
  };
}

function normalizeResponse(result: StoryApiResult): Response {
  if (result instanceof Response) {
    return result;
  }

  const status = result.status ?? 200;
  const headers = new Headers(result.headers);
  const body = result.body;

  if (body === undefined || body === null || status === 204) {
    return new Response(null, { status, headers });
  }

  if (typeof body === 'string') {
    return new Response(body, { status, headers });
  }

  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return new Response(JSON.stringify(body), { status, headers });
}

export function StoryApiScope({
  handlers,
  children,
}: {
  handlers: StoryApiRoute[];
  children: ReactNode;
}) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const restoreRef = useRef<(() => void) | null>(null);

  if (!restoreRef.current) {
    const originalFetch = globalThis.fetch.bind(globalThis);

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = buildRequest(input, init);
      const handler = handlersRef.current.find((entry) => entry.match(request));

      if (!handler) {
        throw new Error(`Unhandled story request: ${request.method} ${request.path}`);
      }

      const response = await handler.respond(request);
      return normalizeResponse(response);
    };

    restoreRef.current = () => {
      globalThis.fetch = originalFetch;
    };
  }

  useEffect(() => {
    return () => {
      restoreRef.current?.();
      restoreRef.current = null;
    };
  }, []);

  return <>{children}</>;
}

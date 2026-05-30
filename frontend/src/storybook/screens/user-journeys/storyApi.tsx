import type { ReactNode } from 'react';
import { useLayoutEffect, useRef } from 'react';

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

let nextScopeId = 0;

type StoryApiScopeEntry = {
  id: number;
  getHandlers: () => StoryApiRoute[];
};

const scopeStack: StoryApiScopeEntry[] = [];
let originalFetch: typeof globalThis.fetch | null = null;
let fetchInterceptorInstalled = false;

function ensureFetchInterceptor(): void {
  if (fetchInterceptorInstalled) {
    return;
  }
  fetchInterceptorInstalled = true;
  originalFetch = globalThis.fetch.bind(globalThis);

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = buildRequest(input, init);

    for (let index = scopeStack.length - 1; index >= 0; index -= 1) {
      const handler = scopeStack[index].getHandlers().find((entry) => entry.match(request));
      if (handler) {
        const response = await handler.respond(request);
        return normalizeResponse(response);
      }
    }

    return originalFetch!(input, init);
  }) as typeof globalThis.fetch;
}

function registerStoryApiScope(id: number, getHandlers: () => StoryApiRoute[]): void {
  ensureFetchInterceptor();
  scopeStack.push({ id, getHandlers });
}

function unregisterStoryApiScope(id: number): void {
  const index = scopeStack.findIndex((entry) => entry.id === id);
  if (index >= 0) {
    scopeStack.splice(index, 1);
  }
}

export type StoryCredentialsOverride = {
  create?: (options?: CredentialCreationOptions) => Promise<Credential | null>;
  get?: (options?: CredentialRequestOptions) => Promise<Credential | null>;
};

const credentialsOverrideStack: StoryCredentialsOverride[] = [];
let savedCredentials: CredentialsContainer | null = null;
let publicKeyCredentialStubInstalled = false;

function ensurePublicKeyCredentialStub(): void {
  if (publicKeyCredentialStubInstalled || typeof globalThis.PublicKeyCredential !== 'undefined') {
    publicKeyCredentialStubInstalled = true;
    return;
  }
  publicKeyCredentialStubInstalled = true;
  Object.defineProperty(globalThis, 'PublicKeyCredential', {
    configurable: true,
    value: function PublicKeyCredential() {},
  });
}

function installCredentialsFacade(): void {
  if (savedCredentials) {
    return;
  }
  ensurePublicKeyCredentialStub();
  savedCredentials = globalThis.navigator.credentials;

  Object.defineProperty(globalThis.navigator, 'credentials', {
    configurable: true,
    value: {
      create: async (options?: CredentialCreationOptions) => {
        for (let index = credentialsOverrideStack.length - 1; index >= 0; index -= 1) {
          const override = credentialsOverrideStack[index].create;
          if (override) {
            return override(options);
          }
        }
        return savedCredentials!.create.bind(savedCredentials)(options);
      },
      get: async (options?: CredentialRequestOptions) => {
        for (let index = credentialsOverrideStack.length - 1; index >= 0; index -= 1) {
          const override = credentialsOverrideStack[index].get;
          if (override) {
            return override(options);
          }
        }
        return savedCredentials!.get.bind(savedCredentials)(options);
      },
    },
  });
}

function uninstallCredentialsFacade(): void {
  if (!savedCredentials) {
    return;
  }
  Object.defineProperty(globalThis.navigator, 'credentials', {
    configurable: true,
    value: savedCredentials,
  });
  savedCredentials = null;
}

export function pushStoryCredentialsOverride(override: StoryCredentialsOverride): () => void {
  if (credentialsOverrideStack.length === 0) {
    installCredentialsFacade();
  }
  credentialsOverrideStack.push(override);
  return () => {
    const index = credentialsOverrideStack.lastIndexOf(override);
    if (index >= 0) {
      credentialsOverrideStack.splice(index, 1);
    }
    if (credentialsOverrideStack.length === 0) {
      uninstallCredentialsFacade();
    }
  };
}

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
  const scopeIdRef = useRef<number | null>(null);
  if (scopeIdRef.current === null) {
    scopeIdRef.current = nextScopeId + 1;
    nextScopeId += 1;
  }
  const scopeId = scopeIdRef.current;

  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useLayoutEffect(() => {
    registerStoryApiScope(scopeId, () => handlersRef.current);
    return () => unregisterStoryApiScope(scopeId);
  }, [scopeId]);

  return <>{children}</>;
}

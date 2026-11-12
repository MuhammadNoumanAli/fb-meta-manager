const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1').replace(
  /\/$/,
  '',
);

let accessToken: string | null = null;
let refreshPromise: Promise<boolean> | null = null;
let sessionExpiredHandler: (() => void) | null = null;

export interface ApiRequestInit extends RequestInit {
  skipAuth?: boolean;
  retryOnUnauthorized?: boolean;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly payload: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const authToken = {
  get: (): string | null => accessToken,
  set: (token: string | null): void => {
    accessToken = token;
  },
  clear: (): void => {
    accessToken = null;
  },
};

export const onSessionExpired = (handler: () => void): void => {
  sessionExpiredHandler = handler;
};

const refreshAccessToken = async (): Promise<boolean> => {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: '{}',
    })
      .then(async (response) => {
        if (!response.ok) {
          accessToken = null;
          return false;
        }

        const payload = (await response.json()) as { accessToken?: string };
        accessToken = payload.accessToken ?? null;
        return Boolean(accessToken);
      })
      .catch(() => {
        accessToken = null;
        return false;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
};

const toError = (payload: unknown, status: number): ApiError => {
  const body = payload as { message?: string | string[] } | null;
  const message = Array.isArray(body?.message)
    ? body.message.join(', ')
    : (body?.message ?? `Request failed with status ${status}`);

  return new ApiError(message, status, payload);
};

export async function apiRequest<T>(path: string, init: ApiRequestInit = {}): Promise<T> {
  const { skipAuth = false, retryOnUnauthorized = true, ...fetchInit } = init;

  const send = async (): Promise<Response> => {
    const headers = new Headers(fetchInit.headers);

    if (!headers.has('Accept')) {
      headers.set('Accept', 'application/json');
    }

    if (fetchInit.body !== undefined && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    if (!skipAuth && accessToken) {
      headers.set('Authorization', `Bearer ${accessToken}`);
    }

    return fetch(`${API_BASE_URL}${path}`, {
      ...fetchInit,
      headers,
      credentials: 'include',
    });
  };

  let response = await send();

  if (response.status === 401 && !skipAuth && retryOnUnauthorized && !path.startsWith('/auth/')) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      response = await send();
    } else {
      sessionExpiredHandler?.();
    }
  }

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw toError(payload, response.status);
  }

  return payload as T;
}

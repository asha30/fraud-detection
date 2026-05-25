export type ApiError = {
  message: string;
  status?: number;
  details?: unknown;
};

function joinUrl(base: string, path: string) {
  if (!base) return path;
  const b = base.replace(/\/+$/, '');
  const p = path.replace(/^\/+/, '');
  return `${b}/${p}`;
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';

async function parseError(res: Response): Promise<ApiError> {
  const status = res.status;
  try {
    const data = await res.json();
    const message =
      (typeof data?.detail === 'string' && data.detail) ||
      (typeof data?.message === 'string' && data.message) ||
      `Request failed (${status})`;
    return { message, status, details: data };
  } catch {
    return { message: `Request failed (${status})`, status };
  }
}

export async function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  const url = joinUrl(API_BASE_URL, path);
  const res = await fetch(url, {
    method: 'GET',
    credentials: 'include',
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    throw await parseError(res);
  }

  return (await res.json()) as T;
}

export async function apiSend<T>(
  path: string,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  body?: unknown,
  init?: RequestInit,
): Promise<T> {
  const url = joinUrl(API_BASE_URL, path);
  const res = await fetch(url, {
    method,
    credentials: 'include',
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    body: body == null ? undefined : JSON.stringify(body),
  });

  if (!res.ok) {
    throw await parseError(res);
  }

  // Some endpoints may return 204
  if (res.status === 204) return undefined as T;

  return (await res.json()) as T;
}

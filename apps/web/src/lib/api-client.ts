const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3011';

export interface ApiOptions {
  tenantSlug?: string;
  signal?: AbortSignal;
}

async function request<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
  opts: ApiOptions = {},
): Promise<T> {
  // Build the header map lazily — `Content-Type: application/json` is NOT in
  // the CORS-safe list, so attaching it to a body-less GET forces a preflight
  // OPTIONS roundtrip on every call. Skipping it for GET/DELETE turns those
  // into "simple" CORS requests (no preflight, cookies still ride along on
  // `credentials: 'include'`) and avoids the generic "Failed to fetch"
  // browsers raise when a preflight goes sideways.
  const hasBody = body !== undefined;
  const headers: Record<string, string> = {};
  if (hasBody) headers['Content-Type'] = 'application/json';
  if (opts.tenantSlug) headers['x-tenant-slug'] = opts.tenantSlug;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    credentials: 'include',
    body: hasBody ? JSON.stringify(body) : undefined,
    signal: opts.signal,
    cache: 'no-store',
  });

  if (!res.ok) {
    let detail: unknown = await res.text();
    try {
      detail = JSON.parse(detail as string);
    } catch {
      // keep as text
    }
    const err = new Error(
      typeof detail === 'object' && detail !== null && 'message' in detail
        ? String((detail as { message: unknown }).message)
        : `Request failed with ${res.status}`,
    ) as Error & { status: number; payload: unknown };
    err.status = res.status;
    err.payload = detail;
    throw err;
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string, opts?: ApiOptions) => request<T>('GET', path, undefined, opts),
  post: <T>(path: string, body: unknown, opts?: ApiOptions) => request<T>('POST', path, body, opts),
  patch: <T>(path: string, body: unknown, opts?: ApiOptions) => request<T>('PATCH', path, body, opts),
  delete: <T>(path: string, opts?: ApiOptions) => request<T>('DELETE', path, undefined, opts),
};

'use client';

export class ApiError extends Error {
  constructor(public status: number, message: string, public errors?: { path?: string; message: string; severity?: string }[]) { super(message); }
}

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown; form?: FormData } = {}): Promise<T> {
  const init: RequestInit = { method: opts.method || (opts.body || opts.form ? 'POST' : 'GET'), credentials: 'include', headers: {} };
  if (opts.form) init.body = opts.form;
  else if (opts.body !== undefined) { init.body = JSON.stringify(opts.body); (init.headers as Record<string, string>)['Content-Type'] = 'application/json'; }
  const r = await fetch(`/api${path}`, init);
  if (r.status === 401 && typeof window !== 'undefined' && !path.startsWith('/auth/')) {
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
  }
  const ct = r.headers.get('content-type') || '';
  const data = ct.includes('json') ? await r.json() : await r.text();
  if (!r.ok) {
    const msg = typeof data === 'object' ? (Array.isArray(data.message) ? data.message.join('. ') : data.message) : String(data);
    throw new ApiError(r.status, msg || `Error ${r.status}`, typeof data === 'object' ? data.errors : undefined);
  }
  return data as T;
}

export type Role = 'ADMIN' | 'TEACHER' | 'STUDENT';
export interface User { id: string; email: string; name: string; role: Role }

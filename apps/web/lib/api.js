const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export class ApiError extends Error {
  constructor(message, { status, code, details } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(body?.error?.message || 'Something went wrong.', {
      status: res.status,
      code: body?.error?.code,
      details: body?.error?.details,
    });
  }

  return body.data;
}

export const api = {
  get: (path) => apiFetch(path),
  post: (path, body) => apiFetch(path, { method: 'POST', body: JSON.stringify(body ?? {}) }),
  patch: (path, body) => apiFetch(path, { method: 'PATCH', body: JSON.stringify(body ?? {}) }),
  delete: (path) => apiFetch(path, { method: 'DELETE' }),
};

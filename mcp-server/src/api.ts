const BASE_URL = process.env.DESK_API_URL;
const TOKEN     = process.env.DESK_API_TOKEN;

if (!BASE_URL) throw new Error('DESK_API_URL is not set (e.g. https://desk.your-domain.example)');
if (!TOKEN)    throw new Error('DESK_API_TOKEN is not set — generate one in the portal under Settings > Connect LLM');

export class DeskApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${TOKEN}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    const message = typeof json.error === 'string' ? json.error : JSON.stringify(json.error ?? res.statusText);
    throw new DeskApiError(res.status, message);
  }

  return json as T;
}

export const desk = {
  get:    <T>(path: string)              => request<T>('GET', path),
  post:   <T>(path: string, body: unknown) => request<T>('POST', path, body),
  patch:  <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  put:    <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  delete: <T>(path: string)              => request<T>('DELETE', path),
};

export function qs(params: Record<string, string | number | boolean | undefined>): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') usp.set(k, String(v));
  }
  const s = usp.toString();
  return s ? `?${s}` : '';
}

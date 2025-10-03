import { API_BASE_URL, API_TOKEN } from '../../config/env';

async function handleResponse<T>(res: Response): Promise<T> {
  const contentType = res.headers.get('content-type') || '';
  if (!res.ok) {
    // Prefer structured JSON error bodies if available
    if (contentType.includes('application/json')) {
      try {
        const body = await res.json();
        const msg = body?.error || body?.message || body?.detail || JSON.stringify(body);
        throw new Error(`HTTP ${res.status} ${res.statusText}: ${msg}`);
      } catch {
        // Fallback to raw text if JSON parse fails
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status} ${res.statusText}`);
      }
    }
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status} ${res.statusText}`);
  }
  if (contentType.includes('application/json')) {
    return res.json() as Promise<T>;
  }
  return res as unknown as T;
}

export async function getJSON<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (API_TOKEN) headers.set('Authorization', `Bearer ${API_TOKEN}`);
  const res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers, method: 'GET' });
  return handleResponse<T>(res);
}

export async function getBlob(path: string, init: RequestInit = {}): Promise<Blob> {
  const headers = new Headers(init.headers);
  headers.set('Accept', '*/*');
  if (API_TOKEN) headers.set('Authorization', `Bearer ${API_TOKEN}`);
  const res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers, method: 'GET' });
  if (!res.ok) {
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        const body = await res.json();
        const msg = body?.error || body?.message || body?.detail || JSON.stringify(body);
        throw new Error(`HTTP ${res.status} ${res.statusText}: ${msg}`);
      } catch {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status} ${res.statusText}`);
      }
    }
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status} ${res.statusText}`);
  }
  return res.blob();
}

export async function postForm<T>(path: string, formData: FormData, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (API_TOKEN) headers.set('Authorization', `Bearer ${API_TOKEN}`);
  const res = await fetch(`${API_BASE_URL}${path}`, { method: 'POST', body: formData, headers });
  return handleResponse<T>(res);
}

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

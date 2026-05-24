const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.supplement-smarter.com';

export async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`);

  if (!res.ok) {
    throw new Error(`API request failed: ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<T>;
}

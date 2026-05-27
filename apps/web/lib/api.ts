const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export function getApiUrl(path: string): string {
  return `${API_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function fetchApi<T>(
  path: string,
  options?: RequestInit & { token?: string; apiKey?: string }
): Promise<T> {
  const headers = new Headers(options?.headers);
  headers.set("content-type", "application/json");
  if (options?.token) headers.set("authorization", `Bearer ${options.token}`);
  if (options?.apiKey) headers.set("x-api-key", options.apiKey);

  const res = await fetch(getApiUrl(path), { ...options, headers, cache: "no-store" });
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${path}`);
  }
  return res.json() as Promise<T>;
}

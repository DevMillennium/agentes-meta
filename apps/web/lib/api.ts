const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export function getApiUrl(path: string): string {
  return `${API_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function fetchApi<T>(
  path: string,
  options?: RequestInit & { token?: string }
): Promise<T> {
  const headers = new Headers(options?.headers);
  headers.set("content-type", "application/json");
  if (options?.token) headers.set("authorization", `Bearer ${options.token}`);

  const res = await fetch(getApiUrl(path), { ...options, headers, cache: "no-store" });
  if (!res.ok) {
    let detail = "";
    try {
      const body = (await res.json()) as { error?: unknown; message?: string };
      if (typeof body.message === "string") detail = body.message;
      else if (body.error) detail = JSON.stringify(body.error);
    } catch {
      /* ignore */
    }
    throw new Error(detail ? `${res.status}: ${detail}` : `API ${res.status}: ${path}`);
  }
  return res.json() as Promise<T>;
}

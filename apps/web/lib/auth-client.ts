const TOKEN_KEYS = ["phoenix_auth_jwt", "phoenix_console_jwt", "phoenix_emulator_jwt"];
export const AUTH_TOKEN_KEY = "phoenix_auth_jwt";

export interface AuthUser {
  userId: string;
  email: string;
  role: "admin" | "operator" | "viewer";
}

export function getStoredAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  for (const key of TOKEN_KEYS) {
    const value = localStorage.getItem(key);
    if (value?.trim()) return value.trim();
  }
  return null;
}

export function setAuthToken(token: string): void {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearAuthToken(): void {
  for (const key of TOKEN_KEYS) {
    localStorage.removeItem(key);
  }
}

export function getAuthFetchOptions(): { token?: string } {
  const token = getStoredAuthToken();
  if (token) return { token };
  return {};
}

export function getAuthHeaders(): HeadersInit {
  const opts = getAuthFetchOptions();
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  return headers;
}

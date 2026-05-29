"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchApi, getApiUrl } from "../../lib/api";
import { setAuthToken, type AuthUser } from "../../lib/auth-client";

interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await fetchApi<LoginResponse>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      setAuthToken(data.accessToken);
      router.replace(next);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("401") || msg.includes("Credenciais")) {
        setError("E-mail ou senha inválidos.");
      } else if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
        setError(
          `Não foi possível contactar a API (${getApiUrl("")}). Inicie com npm run dev ou verifique NEXT_PUBLIC_API_URL.`
        );
      } else {
        setError(msg || "Falha no login. Verifique a API e tente de novo.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-page">
      <form className="card login-card" onSubmit={handleSubmit}>
        <h1>Phoenix Global Market Automat</h1>
        <p className="muted">Entre com sua conta. Cada usuário conecta sua própria conta Meta.</p>
        <p className="muted login-api-hint">
          API: <code>{getApiUrl("")}</code>
        </p>
        <label>
          E-mail
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </label>
        <label>
          Senha
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </label>
        {error && <p className="login-error">{error}</p>}
        <button type="submit" disabled={busy}>
          {busy ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="login-page">
          <p className="muted">Carregando…</p>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

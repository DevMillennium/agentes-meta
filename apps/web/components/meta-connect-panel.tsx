"use client";

import { useCallback, useEffect, useState } from "react";
import { API_BASE_URL } from "../lib/meta-config";
import { getAuthHeaders } from "../lib/auth-client";
import type { FacebookLoginStatusResponse } from "../types/facebook-sdk";
import { useFacebookSdk } from "./facebook-sdk-provider";

interface MetaStatus {
  hasAccessToken?: boolean;
  marketingReady?: boolean;
  appId?: string;
  apiVersion?: string;
  tokenObtainedAt?: string | null;
}

export function MetaConnectPanel() {
  const { sdkState, isReady, getLoginStatus, login, logout } = useFacebookSdk();
  const [fbStatus, setFbStatus] = useState<FacebookLoginStatusResponse | null>(null);
  const [apiStatus, setApiStatus] = useState<MetaStatus | null>(null);
  const [message, setMessage] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const openOAuthServerLogin = useCallback(async () => {
    const res = await fetch(`${API_BASE_URL}/api/meta/oauth/login-url`, {
      headers: getAuthHeaders()
    });
    const body = (await res.json()) as { url?: string; error?: string };
    if (!res.ok || !body.url) {
      throw new Error(body.error ?? "Não foi possível iniciar OAuth.");
    }
    window.open(body.url, "_blank", "noopener,noreferrer");
  }, []);

  const refreshApiStatus = useCallback(async () => {
    const res = await fetch(`${API_BASE_URL}/api/meta/status`, { headers: getAuthHeaders() });
    if (res.ok) {
      setApiStatus((await res.json()) as MetaStatus);
    }
  }, []);

  const syncTokenToServer = useCallback(async (accessToken: string) => {
    const res = await fetch(`${API_BASE_URL}/api/meta/oauth/sdk-token`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ accessToken })
    });
    const body = (await res.json()) as {
      ok?: boolean;
      error?: string;
      message?: string;
      assets?: unknown;
    };
    if (!res.ok || !body.ok) {
      throw new Error(body.error ?? "Falha ao salvar token no servidor.");
    }
    setMessage(
      body.assets
        ? `${body.message ?? "Token salvo."} Ativos Meta sincronizados automaticamente.`
        : (body.message ?? "Token salvo no servidor Phoenix.")
    );
    await refreshApiStatus();
  }, [refreshApiStatus]);

  const refreshFbStatus = useCallback(async () => {
    if (!isReady) return;
    const status = await getLoginStatus();
    setFbStatus(status);
    return status;
  }, [getLoginStatus, isReady]);

  useEffect(() => {
    void refreshApiStatus();
  }, [refreshApiStatus]);

  useEffect(() => {
    if (!isReady) return;
    void refreshFbStatus();
  }, [isReady, refreshFbStatus]);

  async function handleConnect() {
    setBusy(true);
    setMessage("");
    try {
      const response = await login();
      setFbStatus(response);

      if (response.status === "connected" && response.authResponse?.accessToken) {
        await syncTokenToServer(response.authResponse.accessToken);
        return;
      }

      setMessage("Login não concluído. Autorize o app Phoenix Marketing Automat no Facebook.");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Erro ao conectar.";
      if (/JSSDK|Javascript|SDK/i.test(msg)) {
        setMessage(
          "JSSDK não habilitado no app Meta. Use o botão 'OAuth servidor (recomendado)' para concluir a conexão."
        );
      } else {
        setMessage(msg);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleCheckStatus() {
    setBusy(true);
    setMessage("");
    try {
      const status = await refreshFbStatus();
      if (status?.status === "connected" && status.authResponse?.accessToken) {
        await syncTokenToServer(status.authResponse.accessToken);
      } else {
        setMessage("Não conectado ao app. Use o botão Conectar com Facebook.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao verificar status.");
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    setBusy(true);
    setMessage("");
    try {
      await logout();
      setFbStatus({ status: "unknown" });
      setMessage("Sessão Facebook encerrada no navegador.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao desconectar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="meta-panel">
      <h3>Phoenix Global Market Automat</h3>
      <p className="muted">
        App <strong>Phoenix Marketing Automat</strong> · OAuth servidor recomendado (independe de JSSDK)
      </p>

      <dl className="meta-dl">
        <dt>SDK Facebook</dt>
        <dd>{sdkState === "ready" ? "Carregado" : sdkState === "error" ? "Erro" : "Carregando…"}</dd>
        <dt>Status FB (navegador)</dt>
        <dd>{fbStatus?.status ?? "—"}</dd>
        <dt>Token no servidor</dt>
        <dd>{apiStatus?.hasAccessToken ? "Sim" : "Não"}</dd>
        <dt>Marketing API</dt>
        <dd>{apiStatus?.marketingReady ? "Pronta" : "Aguardando token"}</dd>
      </dl>

      <div className="meta-actions">
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            setMessage("");
            void openOAuthServerLogin()
              .catch((error) => {
                setMessage(error instanceof Error ? error.message : "Erro OAuth.");
              })
              .finally(() => setBusy(false));
          }}
        >
          OAuth servidor (recomendado)
        </button>
        <button
          type="button"
          className="secondary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const res = await fetch(`${API_BASE_URL}/api/meta/sync-assets`, {
                method: "POST",
                headers: getAuthHeaders()
              });
              const body = await res.json();
              setMessage(body.ok ? "Ativos Meta sincronizados." : body.error ?? "Erro ao sincronizar.");
              await refreshApiStatus();
            } finally {
              setBusy(false);
            }
          }}
        >
          Sincronizar ativos Meta
        </button>
        <button type="button" disabled={!isReady || busy} onClick={() => void handleConnect()}>
          Conectar com Facebook (JSSDK)
        </button>
        <button type="button" disabled={!isReady || busy} onClick={() => void handleCheckStatus()}>
          Verificar login (FB.getLoginStatus)
        </button>
        <button type="button" className="secondary" disabled={!isReady || busy} onClick={() => void handleLogout()}>
          Logout Facebook
        </button>
      </div>

      {message ? <p className="meta-message">{message}</p> : null}

      {fbStatus?.authResponse?.userID ? (
        <p className="muted">User ID Facebook: {fbStatus.authResponse.userID}</p>
      ) : null}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { Sidebar } from "../../components/sidebar";
import { fetchApi } from "../../lib/api";
import { getAuthFetchOptions, getStoredAuthToken } from "../../lib/auth-client";

interface Approval {
  id: string;
  title: string;
  description: string;
  status: string;
  riskLevel: string;
  createdAt: string;
}

export default function AprovacoesPage() {
  const [items, setItems] = useState<Approval[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [lastExec, setLastExec] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchApi<{ items: Approval[] }>("/api/approvals", getAuthFetchOptions());
      setItems(data.items);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar aprovações.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(id: string, status: "APPROVED" | "REJECTED") {
    const token = getStoredAuthToken();
    if (!token) {
      setError("Faça login para aprovar ações.");
      return;
    }
    setBusyId(id);
    setError(null);
    try {
      const payload = await fetchApi<{ approval: Approval; execution?: Record<string, unknown> }>(
        `/api/approvals/${id}/decide`,
        {
          ...getAuthFetchOptions(),
          method: "POST",
          body: JSON.stringify({
            status,
            decidedById: "web-operator",
            description: status === "APPROVED" ? "Aprovado no painel web." : "Rejeitado no painel web."
          })
        }
      );
      setLastExec(
        payload.execution
          ? JSON.stringify(payload.execution, null, 2)
          : status === "APPROVED"
            ? "Aprovado (sem execução automática mapeada)."
            : "Rejeitado."
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha na decisão.");
    } finally {
      setBusyId(null);
    }
  }

  const pending = items.filter((i) => i.status === "PENDING");

  return (
    <main className="dashboard-layout">
      <Sidebar activePath="/aprovacoes" />
      <section className="content">
        <header className="page-header">
          <div>
            <h2>Aprovações</h2>
            <p className="muted">Ações de alto risco (ex.: campanhas pagas) aguardam confirmação humana.</p>
          </div>
          <span className="ai-pill">{pending.length} pendente(s)</span>
        </header>

        {error && (
          <div className="banner banner-err">
            <p>{error}</p>
          </div>
        )}

        {lastExec && (
          <pre className="card result-pre" role="status">
            {lastExec}
          </pre>
        )}

        <div className="approval-list">
          {items.length === 0 && <p className="muted card">Nenhuma solicitação registrada.</p>}
          {items.map((item) => (
            <article key={item.id} className="card approval-card">
              <div className="approval-card-head">
                <strong>{item.title}</strong>
                <span className={`risk-tag risk-${item.riskLevel.toLowerCase()}`}>{item.riskLevel}</span>
              </div>
              <p>{item.description}</p>
              <p className="muted">
                Status: <strong>{item.status}</strong> · {new Date(item.createdAt).toLocaleString("pt-BR")}
              </p>
              {item.status === "PENDING" && (
                <div className="inline-actions">
                  <button
                    type="button"
                    className="btn primary sm"
                    disabled={busyId === item.id}
                    onClick={() => void decide(item.id, "APPROVED")}
                  >
                    Aprovar e executar
                  </button>
                  <button
                    type="button"
                    className="btn secondary sm"
                    disabled={busyId === item.id}
                    onClick={() => void decide(item.id, "REJECTED")}
                  >
                    Rejeitar
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { Sidebar } from "../../components/sidebar";
import { fetchApi } from "../../lib/api";
import { getAuthFetchOptions } from "../../lib/auth-client";

interface CatalogEntry {
  key: string;
  name: string;
  riskProfile: string;
  description: string;
  capabilities: string[];
}

interface Product {
  id: string;
  name: string;
  stockQuantity: number;
}

interface AiStatus {
  provider: string;
  openaiConfigured: boolean;
  ollamaReachable: boolean;
  ollamaModel: string;
}

interface AgentAction {
  id: string;
  agentName: string;
  actionType: string;
  status: string;
  reason: string;
  createdAt: string;
}

const RISK_LABEL: Record<string, string> = {
  low: "Baixo",
  medium: "Médio",
  high: "Alto"
};

export default function AgentesPage() {
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [actions, setActions] = useState<AgentAction[]>([]);
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);
  const [productId, setProductId] = useState("");
  const [objective, setObjective] = useState("Vender produto prioritário com foco em WhatsApp e Instagram");
  const [maxDailyBudget, setMaxDailyBudget] = useState(50);
  const [campaignType, setCampaignType] = useState<"messages" | "traffic" | "leads" | "sales">("messages");
  const [running, setRunning] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  const load = useCallback(async () => {
    const opts = getAuthFetchOptions();
    try {
      const [cat, prods, acts, ai] = await Promise.all([
        fetchApi<{ items: CatalogEntry[] }>("/api/agents", opts),
        fetchApi<{ items: Product[] }>("/api/products", opts),
        fetchApi<{ items: AgentAction[] }>("/api/agents/actions?limit=12", opts),
        fetchApi<AiStatus>("/api/ai/status", opts)
      ]);
      setCatalog(cat.items);
      setProducts(prods.items);
      setActions(acts.items);
      setAiStatus(ai);
      if (!productId && prods.items[0]) setProductId(prods.items[0].id);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar agentes.");
    }
  }, [productId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function seedProducts() {
    setSeeding(true);
    setError(null);
    try {
      await fetchApi("/api/products/seed/default", {
        ...getAuthFetchOptions(),
        method: "POST"
      });
      await load();
      setResult("Catálogo padrão criado. Selecione um produto e execute o ciclo.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao criar produtos.");
    } finally {
      setSeeding(false);
    }
  }

  async function runOrchestrate() {
    if (!productId) {
      setError("Selecione um produto com estoque.");
      return;
    }
    setRunning("orchestrate");
    setError(null);
    setResult(null);
    try {
      const out = await fetchApi<{ success: boolean; message: string; data?: unknown }>(
        "/api/agents/orchestrate",
        {
          ...getAuthFetchOptions(),
          method: "POST",
          body: JSON.stringify({ objective, maxDailyBudget, productId, campaignType })
        }
      );
      setResult(out.message + (out.data ? `\n\n${JSON.stringify(out.data, null, 2)}` : ""));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha no ciclo de marketing.");
    } finally {
      setRunning(null);
    }
  }

  async function runAgent(key: string) {
    setRunning(key);
    setError(null);
    setResult(null);
    const body: Record<string, unknown> =
      key === "whatsappSales" || key === "instagramDirect"
        ? {
            channel: key === "whatsappSales" ? "whatsapp" : "instagram",
            conversationId: "demo",
            leadId: "demo",
            inboundText: "Quanto custa o iPhone?"
          }
        : key === "adCopywriter"
          ? { productId, objective }
          : key === "productManager"
            ? { productId }
            : { productId, objective };

    try {
      const out = await fetchApi<{ result: { message: string }; decision: { agentName: string } }>(
        `/api/agents/${key}/run`,
        { ...getAuthFetchOptions(), method: "POST", body: JSON.stringify(body) }
      );
      setResult(`${out.decision.agentName}: ${out.result.message}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : `Falha ao executar ${key}.`);
    } finally {
      setRunning(null);
    }
  }

  const providerLabel =
    aiStatus?.provider === "openai"
      ? "OpenAI"
      : aiStatus?.provider === "ollama"
        ? `Ollama (${aiStatus.ollamaModel})`
        : "Respostas padrão (sem IA remota)";

  return (
    <main className="dashboard-layout">
      <Sidebar activePath="/agentes" />
      <section className="content agents-hub">
        <header className="page-header">
          <div>
            <h2>Agentes IA</h2>
            <p className="muted">
              Orquestração de marketing, vendas e compliance — estilo automação conversacional.
            </p>
          </div>
          <span className={`ai-pill ${aiStatus?.provider ?? "fallback"}`}>{providerLabel}</span>
        </header>

        {error && (
          <div className="banner banner-err">
            <p>{error}</p>
          </div>
        )}

        <section className="card orchestrate-panel">
          <h3>Ciclo de marketing completo</h3>
          <p className="muted">
            Executa diretor → produto → copy → compliance → post Instagram → tráfego pago (com aprovação se
            necessário).
          </p>

          {products.length === 0 && (
            <div className="inline-actions">
              <button type="button" className="btn primary" disabled={seeding} onClick={() => void seedProducts()}>
                {seeding ? "Criando catálogo…" : "Criar produtos de exemplo"}
              </button>
            </div>
          )}

          <div className="form-grid">
            <label>
              Produto
              <select value={productId} onChange={(e) => setProductId(e.target.value)}>
                <option value="">— selecione —</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (estoque {p.stockQuantity})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Orçamento diário (R$)
              <input
                type="number"
                min={1}
                value={maxDailyBudget}
                onChange={(e) => setMaxDailyBudget(Number(e.target.value))}
              />
            </label>
            <label>
              Tipo de campanha Meta
              <select
                value={campaignType}
                onChange={(e) => setCampaignType(e.target.value as typeof campaignType)}
              >
                <option value="messages">Mensagens</option>
                <option value="traffic">Tráfego</option>
                <option value="leads">Leads</option>
                <option value="sales">Vendas</option>
              </select>
            </label>
            <label className="span-2">
              Objetivo
              <input value={objective} onChange={(e) => setObjective(e.target.value)} />
            </label>
          </div>

          <button
            type="button"
            className="btn primary"
            disabled={running === "orchestrate" || !productId}
            onClick={() => void runOrchestrate()}
          >
            {running === "orchestrate" ? "Executando ciclo…" : "Executar ciclo de marketing"}
          </button>
        </section>

        {result && (
          <pre className="card result-pre" role="status">
            {result}
          </pre>
        )}

        <h3 className="section-title">Catálogo de agentes</h3>
        <div className="agent-grid">
          {catalog.map((agent) => (
            <article key={agent.key} className={`agent-card risk-${agent.riskProfile}`}>
              <div className="agent-card-head">
                <strong>{agent.name.replace("Agent", "")}</strong>
                <span className="risk-tag">{RISK_LABEL[agent.riskProfile] ?? agent.riskProfile}</span>
              </div>
              <p>{agent.description}</p>
              <ul className="caps">
                {agent.capabilities.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
              <button
                type="button"
                className="btn secondary sm"
                disabled={running === agent.key}
                onClick={() => void runAgent(agent.key)}
              >
                {running === agent.key ? "Rodando…" : "Testar agente"}
              </button>
            </article>
          ))}
        </div>

        <h3 className="section-title">Últimas ações</h3>
        <div className="card actions-table-wrap">
          {actions.length === 0 ? (
            <p className="muted">Nenhuma ação registrada ainda.</p>
          ) : (
            <table className="actions-table">
              <thead>
                <tr>
                  <th>Agente</th>
                  <th>Ação</th>
                  <th>Status</th>
                  <th>Quando</th>
                </tr>
              </thead>
              <tbody>
                {actions.map((a) => (
                  <tr key={a.id}>
                    <td>{a.agentName}</td>
                    <td>{a.actionType}</td>
                    <td>
                      <span className={`status-pill ${a.status.toLowerCase()}`}>{a.status}</span>
                    </td>
                    <td>{new Date(a.createdAt).toLocaleString("pt-BR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </main>
  );
}

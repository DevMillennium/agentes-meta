"use client";

import { useEffect, useState } from "react";
import { fetchApi } from "../lib/api";

interface Summary {
  leads: number;
  conversations: number;
  messages: number;
  pendingApprovals: number;
  campaigns: number;
  activeProducts: number;
}

export function DashboardStats() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const apiKey =
      process.env.NEXT_PUBLIC_ADMIN_API_KEY ?? "phoenix-local-api-key-16";
    fetchApi<Summary>("/api/conversations/stats/summary", { apiKey })
      .then(setSummary)
      .catch((e) => setError(e instanceof Error ? e.message : "Erro ao carregar"));
  }, []);

  if (error) {
    return (
      <p className="muted">
        API offline ou sem auth. Rode a API e defina <code>NEXT_PUBLIC_ADMIN_API_KEY</code> no .env.
      </p>
    );
  }

  const cards = summary
    ? [
        { title: "Produtos ativos", value: String(summary.activeProducts) },
        { title: "Campanhas", value: String(summary.campaigns) },
        { title: "Leads", value: String(summary.leads) },
        { title: "Conversas", value: String(summary.conversations) },
        { title: "Mensagens", value: String(summary.messages) },
        { title: "Aprovações pendentes", value: String(summary.pendingApprovals) }
      ]
    : [
        { title: "Carregando…", value: "—" },
        { title: "—", value: "—" },
        { title: "—", value: "—" },
        { title: "—", value: "—" }
      ];

  return (
    <div className="card-grid">
      {cards.map((card) => (
        <article key={card.title} className="card">
          <strong>{card.title}</strong>
          <h3>{card.value}</h3>
        </article>
      ))}
    </div>
  );
}

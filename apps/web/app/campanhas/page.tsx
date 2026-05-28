"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "../../components/sidebar";
import { fetchApi } from "../../lib/api";
import { getAuthFetchOptions } from "../../lib/auth-client";

interface Campaign {
  id: string;
  name: string;
  objective: string;
  status: string;
  dailyBudget: string | null;
}

export default function CampanhasPage() {
  const [items, setItems] = useState<Campaign[]>([]);

  useEffect(() => {
    fetchApi<{ items: Campaign[] }>("/api/campaigns", getAuthFetchOptions())
      .then((data) => setItems(data.items))
      .catch(() => setItems([]));
  }, []);

  return (
    <main className="dashboard-layout">
      <Sidebar />
      <section className="content">
        <h2>Campanhas</h2>
        <p className="muted">Campanhas criadas pelo PaidTrafficStrategistAgent (Postgres + Meta).</p>
        <div className="card-grid">
          {items.map((c) => (
            <article key={c.id} className="card">
              <strong>{c.name}</strong>
              <h3>{c.status}</h3>
              <p>
                {c.objective} · Orçamento diário: R$ {c.dailyBudget ?? "—"}
              </p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

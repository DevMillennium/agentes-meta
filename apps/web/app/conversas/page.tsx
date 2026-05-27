"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "../../components/sidebar";
import { fetchApi } from "../../lib/api";

interface Conversation {
  id: string;
  channel: string;
  lead: { name: string | null; phone: string | null; temperature: string };
  messages: { content: string; direction: string }[];
}

export default function ConversasPage() {
  const [items, setItems] = useState<Conversation[]>([]);

  useEffect(() => {
    fetchApi<{ items: Conversation[] }>("/api/conversations", {
      apiKey: "phoenix-local-api-key-16"
    })
      .then((data) => setItems(data.items))
      .catch(() => setItems([]));
  }, []);

  return (
    <main className="dashboard-layout">
      <Sidebar />
      <section className="content">
        <h2>Conversas</h2>
        <p className="muted">Inbox WhatsApp / Instagram com respostas dos agentes IA.</p>
        {items.map((c) => (
          <article key={c.id} className="card" style={{ marginBottom: 12 }}>
            <strong>
              {c.channel.toUpperCase()} — {c.lead.name ?? c.lead.phone ?? "Lead"}
            </strong>
            <p className="muted">Temperatura: {c.lead.temperature}</p>
            <p>{c.messages[0]?.content ?? "Sem mensagens"}</p>
          </article>
        ))}
      </section>
    </main>
  );
}

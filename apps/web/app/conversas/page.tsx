"use client";

import { useCallback, useEffect, useState } from "react";
import { Sidebar } from "../../components/sidebar";
import { fetchApi } from "../../lib/api";
import { getAuthFetchOptions, getStoredAuthToken } from "../../lib/auth-client";

interface Lead {
  name: string | null;
  phone: string | null;
  instagramHandle: string | null;
  temperature: string;
  status: string;
}

interface Conversation {
  id: string;
  channel: string;
  externalId: string | null;
  updatedAt: string;
  lead: Lead;
  messages: { content: string; direction: string; sentAt?: string }[];
}

interface Message {
  id: string;
  direction: string;
  content: string;
  sentAt: string;
}

function formatContact(lead: Lead, channel: string): string {
  if (lead.name) return lead.name;
  if (channel === "whatsapp" && lead.phone) return `+${lead.phone}`;
  if (lead.instagramHandle) return `@${lead.instagramHandle}`;
  return "Lead";
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return "";
  }
}

function temperatureLabel(t: string): string {
  const map: Record<string, string> = {
    HOT: "Quente",
    WARM: "Morno",
    COLD: "Frio"
  };
  return map[t] ?? t;
}

export default function ConversasPage() {
  const [items, setItems] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [thread, setThread] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  const selected = items.find((c) => c.id === selectedId) ?? null;

  const loadConversations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchApi<{ items: Conversation[] }>(
        "/api/conversations",
        getAuthFetchOptions()
      );
      setItems(data.items);
      setSelectedId((prev) => prev ?? data.items[0]?.id ?? null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao carregar conversas";
      setError(msg);
      setNeedsLogin(msg.includes("401") || !getStoredAuthToken());
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadThread = useCallback(async (conversationId: string) => {
    setLoadingThread(true);
    try {
      const data = await fetchApi<{ items: Message[] }>(
        `/api/conversations/${conversationId}/messages`,
        getAuthFetchOptions()
      );
      setThread(data.items);
    } catch {
      setThread([]);
    } finally {
      setLoadingThread(false);
    }
  }, []);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (selectedId) void loadThread(selectedId);
    else setThread([]);
  }, [selectedId, loadThread]);

  async function sendReply() {
    if (!selectedId || !replyText.trim()) return;
    setSending(true);
    setError(null);
    try {
      await fetchApi(`/api/conversations/${selectedId}/messages`, {
        ...getAuthFetchOptions(),
        method: "POST",
        body: JSON.stringify({ content: replyText.trim() })
      });
      setReplyText("");
      await loadThread(selectedId);
      await loadConversations();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao enviar mensagem.");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="dashboard-layout">
      <Sidebar activePath="/conversas" />
      <section className="content inbox-page">
        <header className="inbox-header">
          <div>
            <h2>Conversas</h2>
            <p className="muted">Inbox WhatsApp e Instagram — respostas dos agentes IA.</p>
          </div>
          <button type="button" className="btn-refresh" onClick={() => void loadConversations()}>
            Atualizar
          </button>
        </header>

        {needsLogin && (
          <div className="card inbox-alert">
            <p>
              Faça login em{" "}
              <a href="http://localhost:4000/console" target="_blank" rel="noopener noreferrer">
                Phoenix Console
              </a>{" "}
              ou use a API com <code>x-api-key</code> no .env.
            </p>
          </div>
        )}

        {error && !needsLogin && (
          <div className="card inbox-alert err">
            <p>{error}</p>
          </div>
        )}

        <div className="inbox-layout">
          <aside className="inbox-list card">
            {loading && <p className="muted">Carregando…</p>}
            {!loading && items.length === 0 && (
              <p className="muted">
                Nenhuma conversa ainda. Teste no{" "}
                <a href={`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/tools/emulator`}>
                  emulador de webhooks
                </a>
                .
              </p>
            )}
            {items.map((c) => {
              const preview = c.messages[0]?.content ?? "Sem mensagens";
              const isActive = c.id === selectedId;
              return (
                <button
                  key={c.id}
                  type="button"
                  className={`inbox-item${isActive ? " active" : ""}`}
                  onClick={() => setSelectedId(c.id)}
                >
                  <span className={`channel-badge ${c.channel}`}>
                    {c.channel === "whatsapp" ? "WA" : "IG"}
                  </span>
                  <span className="inbox-item-body">
                    <strong>{formatContact(c.lead, c.channel)}</strong>
                    <span className="preview">{preview}</span>
                  </span>
                  <span className={`temp-badge ${c.lead.temperature.toLowerCase()}`}>
                    {temperatureLabel(c.lead.temperature)}
                  </span>
                </button>
              );
            })}
          </aside>

          <section className="inbox-thread card">
            {!selected && <p className="muted">Selecione uma conversa.</p>}
            {selected && (
              <>
                <div className="thread-header">
                  <div>
                    <h3>{formatContact(selected.lead, selected.channel)}</h3>
                    <p className="muted">
                      {selected.channel === "whatsapp" ? "WhatsApp" : "Instagram Direct"} ·{" "}
                      {temperatureLabel(selected.lead.temperature)} · {selected.lead.status}
                    </p>
                  </div>
                </div>

                <div className="thread-messages">
                  {loadingThread && <p className="muted">Carregando mensagens…</p>}
                  {!loadingThread && thread.length === 0 && (
                    <p className="muted">Sem mensagens nesta conversa.</p>
                  )}
                  {thread.map((m) => (
                    <div
                      key={m.id}
                      className={`bubble ${m.direction === "outbound" ? "out" : "in"}`}
                    >
                      <p>{m.content}</p>
                      <time>{formatTime(m.sentAt)}</time>
                    </div>
                  ))}
                </div>

                <form
                  className="thread-composer"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void sendReply();
                  }}
                >
                  <textarea
                    rows={2}
                    placeholder="Responder pelo WhatsApp ou Instagram…"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    disabled={sending}
                  />
                  <button type="submit" className="btn primary" disabled={sending || !replyText.trim()}>
                    {sending ? "Enviando…" : "Enviar"}
                  </button>
                </form>
              </>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}

"use client";

import { clearAuthToken } from "../lib/auth-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const MENU_ITEMS: { label: string; href: string; external?: boolean }[] = [
  { label: "Dashboard", href: "/" },
  { label: "Agentes IA", href: "/agentes" },
  { label: "Conversas", href: "/conversas" },
  { label: "Aprovações", href: "/aprovacoes" },
  { label: "Produtos", href: "/produtos" },
  { label: "Campanhas", href: "/campanhas" },
  { label: "Integração Meta", href: "/configuracoes/meta" },
  { label: "Console API", href: `${API_URL}/console`, external: true },
  { label: "CRM Leads", href: `${API_URL}/tools/leads`, external: true }
];

export function Sidebar({ activePath }: { activePath?: string }) {
  const current =
    activePath ??
    (typeof window !== "undefined" ? window.location.pathname : undefined);

  return (
    <aside className="sidebar">
      <h1>Phoenix Global Market Automat</h1>
      <nav aria-label="Menu principal">
        {MENU_ITEMS.map((item) => (
          <a
            key={item.label}
            className={`menu-item${current === item.href ? " active" : ""}`}
            href={item.href}
            {...(item.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          >
            {item.label}
          </a>
        ))}
        <button
          type="button"
          className="menu-item menu-item-button"
          onClick={() => {
            clearAuthToken();
            window.location.href = "/login";
          }}
        >
          Sair
        </button>
      </nav>
    </aside>
  );
}

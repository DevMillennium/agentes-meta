"use client";

import { clearAuthToken } from "../lib/auth-client";

const MENU_ITEMS: { label: string; href: string }[] = [
  { label: "Dashboard", href: "/" },
  { label: "Produtos", href: "/produtos" },
  { label: "Campanhas", href: "/campanhas" },
  { label: "Conversas", href: "/conversas" },
  { label: "Integração Meta", href: "/configuracoes/meta" },
  { label: "Emulador API", href: "http://localhost:4000/dev/emulator" }
];

export function Sidebar() {
  return (
    <aside className="sidebar">
      <h1>Phoenix Global Market Automat</h1>
      <nav aria-label="Menu principal">
        {MENU_ITEMS.map((item) => (
          <a key={item.label} className="menu-item" href={item.href}>
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

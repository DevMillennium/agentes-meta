"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "../../components/sidebar";
import { fetchApi } from "../../lib/api";

interface Product {
  id: string;
  name: string;
  brand: string | null;
  price: string;
  stockQuantity: number;
  status: string;
}

export default function ProdutosPage() {
  const [items, setItems] = useState<Product[]>([]);

  useEffect(() => {
    fetchApi<{ items: Product[] }>("/api/products", { apiKey: "phoenix-local-api-key-16" })
      .then((data) => setItems(data.items))
      .catch(() => setItems([]));
  }, []);

  return (
    <main className="dashboard-layout">
      <Sidebar />
      <section className="content">
        <h2>Produtos</h2>
        <p className="muted">Catálogo usado pelos agentes de vendas e campanhas.</p>
        <div className="card-grid">
          {items.map((p) => (
            <article key={p.id} className="card">
              <strong>{p.name}</strong>
              <h3>R$ {p.price}</h3>
              <p>
                {p.brand ?? "—"} · Estoque: {p.stockQuantity} · {p.status}
              </p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

import { Sidebar } from "../components/sidebar";
import { DashboardStats } from "../components/dashboard-stats";

export default function HomePage() {
  return (
    <main className="dashboard-layout">
      <Sidebar />
      <section className="content">
        <header className="page-header">
          <div>
            <h2>Phoenix Global Market Automat</h2>
            <p className="muted">Operação omnichannel — agentes IA, inbox e campanhas.</p>
          </div>
        </header>
        <div className="quick-actions card">
          <a className="btn primary" href="/agentes">
            Executar agentes IA
          </a>
          <a className="btn secondary" href="/conversas">
            Abrir inbox
          </a>
          <a className="btn secondary" href="/aprovacoes">
            Ver aprovações
          </a>
        </div>
        <DashboardStats />
      </section>
    </main>
  );
}

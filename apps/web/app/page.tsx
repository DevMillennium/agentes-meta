import { Sidebar } from "../components/sidebar";
import { DashboardStats } from "../components/dashboard-stats";

export default function HomePage() {
  return (
    <main className="dashboard-layout">
      <Sidebar />
      <section className="content">
        <h2>Phoenix Global Market Automat</h2>
        <p>Dashboard operacional — agentes, conversas, campanhas e aprovações.</p>
        <DashboardStats />
      </section>
    </main>
  );
}

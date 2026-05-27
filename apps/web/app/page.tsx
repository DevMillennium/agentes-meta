import { Sidebar } from "../components/sidebar";

const CARDS = [
  { title: "Produtos Ativos", value: "0", hint: "Cadastre os produtos prioritarios para campanhas." },
  { title: "Campanhas Ativas", value: "0", hint: "Nenhuma campanha criada nesta base inicial." },
  { title: "Leads Quentes", value: "0", hint: "Classificacao de interesse vinda de WhatsApp/Instagram." },
  { title: "Aprovacoes Pendentes", value: "0", hint: "Acoes sensiveis dos agentes aguardando decisao." }
];

export default function HomePage() {
  return (
    <main className="dashboard-layout">
      <Sidebar />
      <section className="content">
        <h2>Dashboard Inicial</h2>
        <p>
          Base pronta para iniciar o MVP: produtos, campanhas, atendimento e aprovacoes com trilha de auditoria.
        </p>
        <div className="card-grid">
          {CARDS.map((card) => (
            <article key={card.title} className="card">
              <strong>{card.title}</strong>
              <h3>{card.value}</h3>
              <p>{card.hint}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

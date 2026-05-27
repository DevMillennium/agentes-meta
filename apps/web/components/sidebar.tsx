const MENU_ITEMS = [
  "Produtos",
  "Campanhas",
  "Criativos",
  "Leads",
  "Conversas",
  "Aprovações",
  "Relatórios",
  "Logs"
];

export function Sidebar() {
  return (
    <aside className="sidebar">
      <h1>Phoenix Global Marketing AI Team</h1>
      <nav aria-label="Menu principal">
        {MENU_ITEMS.map((item) => (
          <a key={item} className="menu-item" href="#">
            {item}
          </a>
        ))}
      </nav>
    </aside>
  );
}

import { Link, NavLink, Outlet } from "react-router-dom";

const tabs: Array<{ to: string; end: boolean; label: string }> = [
  { to: "/admin", end: true, label: "Profile" },
  { to: "/admin/competitions", end: false, label: "Competitions" }
];

export function AdminLayout() {
  return (
    <main className="admin-shell">
      <header className="admin-nav">
        <Link to="/admin" className="brand" aria-label="Miniscout Admin">
          Miniscout Admin
        </Link>
        <nav aria-label="Admin sections">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) => (isActive ? "nav-tab active" : "nav-tab")}
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <Outlet />
    </main>
  );
}

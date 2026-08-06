import { Link, NavLink, Outlet } from "react-router-dom";
import { useStyleProfile } from "../lib/StyleProfileContext";

const tabs: Array<{ to: string; end: boolean; label: string }> = [
  { to: "/admin", end: true, label: "Profile" },
  { to: "/admin/competitions", end: false, label: "Competitions" },
  { to: "/admin/settings", end: true, label: "Settings" }
];

export function AdminLayout() {
  const { profile } = useStyleProfile();
  const logo = profile?.logo;

  return (
    <main className="admin-shell">
      <header className="admin-nav">
        <Link to="/admin" className="brand" aria-label="Miniscout Admin">
          Miniscout Admin
        </Link>
        {logo && (logo.dataUri || logo.teamName) && (
          <div className="brand-logo" data-testid="admin-brand-logo">
            {logo.dataUri && <img src={logo.dataUri} alt="" className="brand-logo-image" />}
            {logo.teamName && <span className="brand-team-name">{logo.teamName}</span>}
          </div>
        )}
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

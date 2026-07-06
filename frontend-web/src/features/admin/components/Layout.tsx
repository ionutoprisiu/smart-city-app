import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuthStore } from "@features/auth/store/authStore";
import { Icon } from "./Icon";

const NAV_ITEMS = [
  { to: "/admin/verifications", label: "Verifications", icon: "verified-user" },
  { to: "/admin/users", label: "Users", icon: "group" },
  { to: "/admin/algorithms", label: "Algorithms", icon: "science" },
] as const;

export function Layout() {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);

  async function onLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="app-shell">
      <header className="control-header">
        <div className="control-header__brand">
          <div className="brand-mark" aria-hidden>
            <Icon name="admin-panel-settings" size={22} color="var(--on-primary)" />
          </div>
          <div>
            <p className="label-small brand-eyebrow">Smart City</p>
            <h1 className="title-medium control-title">Administrare</h1>
          </div>
        </div>

        <nav className="control-nav" aria-label="Admin sections">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `control-nav__link${isActive ? " active" : ""}`}
            >
              <Icon name={item.icon} size={20} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="control-header__actions">
          <NavLink to="/visit-city" className="control-logout" title="Back to app">
            <Icon name="arrow-back" size={20} />
            <span>Aplicație</span>
          </NavLink>
          <button
            type="button"
            className="control-logout"
            onClick={onLogout}
            title="Sign out"
          >
            <Icon name="logout" size={20} />
            <span>Sign out</span>
          </button>
        </div>
      </header>

      <main className="content page">
        <Outlet />
      </main>
    </div>
  );
}

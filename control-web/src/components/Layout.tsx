import { NavLink, Outlet } from "react-router-dom";
import { setStoredToken } from "../api/client";
import { Icon } from "./Icon";

const NAV_ITEMS = [
  { to: "/verifications", label: "Verifications", icon: "verified-user" },
  { to: "/users", label: "Users", icon: "group" },
  { to: "/algorithms", label: "Algorithms", icon: "science" },
] as const;

export function Layout() {
  function logout() {
    setStoredToken(null);
    window.location.href = "/login";
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
            <h1 className="title-medium control-title">Control Panel</h1>
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

        <button
          type="button"
          className="control-logout"
          onClick={logout}
          title="Sign out"
        >
          <Icon name="logout" size={20} />
          <span>Sign out</span>
        </button>
      </header>

      <main className="content page">
        <Outlet />
      </main>
    </div>
  );
}

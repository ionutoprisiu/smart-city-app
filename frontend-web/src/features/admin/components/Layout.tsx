import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuthStore } from "@features/auth/store/authStore";
import { Icon } from "./Icon";

// Two conceptual groups: system administration vs. the evaluation lab.
const NAV_GROUPS = [
  {
    title: "Administrare",
    items: [
      { to: "/admin/verifications", label: "Verificări", icon: "verified-user" },
      { to: "/admin/users", label: "Utilizatori", icon: "group" },
    ],
  },
  {
    title: "Evaluare",
    items: [{ to: "/admin/algorithms", label: "Algoritmi", icon: "science" }],
  },
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
            <h1 className="title-medium control-title">Panou de administrare</h1>
          </div>
        </div>

        <nav className="control-nav" aria-label="Secțiuni admin">
          {NAV_GROUPS.map((group) => (
            <div key={group.title} className="control-nav__group">
              <span className="control-nav__group-title">{group.title}</span>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `control-nav__link${isActive ? " active" : ""}`}
                >
                  <Icon name={item.icon} size={20} />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="control-header__actions">
          <button type="button" className="control-logout" onClick={onLogout} title="Deconectare">
            <Icon name="logout" size={20} />
            <span>Deconectare</span>
          </button>
        </div>
      </header>

      <main className="content page">
        <Outlet />
      </main>
    </div>
  );
}

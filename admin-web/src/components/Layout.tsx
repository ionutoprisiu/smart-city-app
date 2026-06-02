import { NavLink, Outlet } from "react-router-dom";
import { setStoredToken } from "../api/client";

export function Layout() {
  function logout() {
    setStoredToken(null);
    window.location.href = "/login";
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Smart City</p>
          <h1>Admin Panel</h1>
        </div>
        <nav className="nav">
          <NavLink to="/verifications" className={({ isActive }) => (isActive ? "active" : "")}>
            Verifications
          </NavLink>
          <NavLink to="/users" className={({ isActive }) => (isActive ? "active" : "")}>
            Users
          </NavLink>
          <button type="button" className="ghost" onClick={logout}>
            Logout
          </button>
        </nav>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}

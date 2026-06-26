import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { login, setStoredToken } from "../api/client";
import { Icon } from "../components/Icon";
import { AppButton } from "../shared/components/AppButton";

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@admin.com");
  const [password, setPassword] = useState("admin");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await login(email.trim(), password);
      if (!response.accessToken) {
        throw new Error(response.message || "Login failed");
      }
      if (response.role !== "ADMIN") {
        throw new Error("Only ADMIN accounts can access this panel.");
      }
      setStoredToken(response.accessToken);
      navigate("/verifications", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <form className="card login-card" onSubmit={onSubmit}>
        <div className="login-card__hero">
          <div className="brand-mark brand-mark--large" aria-hidden>
            <Icon name="admin-panel-settings" size={28} color="var(--on-primary)" />
          </div>
          <p className="label-small brand-eyebrow">Smart City</p>
          <h1 className="title-large">Control Panel</h1>
          <p className="body-medium muted">Sign in with an admin account.</p>
        </div>

        <label className="text-field-label">
          Email
          <input
            className="text-input"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="username"
            required
          />
        </label>
        <label className="text-field-label">
          Password
          <input
            className="text-input"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        {error ? <p className="error banner">{error}</p> : null}

        <AppButton
          type="submit"
          label={loading ? "Signing in..." : "Sign in"}
          iconName="login"
          loading={loading}
          style={{ width: "100%" }}
        />
      </form>
    </div>
  );
}

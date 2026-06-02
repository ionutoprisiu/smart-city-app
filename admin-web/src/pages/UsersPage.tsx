import { useCallback, useEffect, useState } from "react";
import { AdminUserItem, demoteToUser, fetchUsers, promoteOrganizer, resetUserVerification } from "../api/client";

export function UsersPage() {
  const [items, setItems] = useState<AdminUserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await fetchUsers());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onPromote(userId: number) {
    setBusyId(userId);
    try {
      await promoteOrganizer(userId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Promote failed");
    } finally {
      setBusyId(null);
    }
  }

  async function onDemote(userId: number) {
    const confirmed = window.confirm(
      "Remove organizer role? The user must verify their identity again before becoming organizer.",
    );
    if (!confirmed) {
      return;
    }
    setBusyId(userId);
    try {
      await demoteToUser(userId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Demote failed");
    } finally {
      setBusyId(null);
    }
  }

  async function onResetVerification(userId: number) {
    const confirmed = window.confirm(
      "Reset verification? The user will need to submit documents again.",
    );
    if (!confirmed) {
      return;
    }
    setBusyId(userId);
    try {
      await resetUserVerification(userId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset verification failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section>
      <div className="section-head">
        <div>
          <h2>Users</h2>
          <p className="muted">Recently registered accounts</p>
        </div>
        <button type="button" className="ghost" onClick={() => void load()} disabled={loading}>
          Reload
        </button>
      </div>

      {error ? <p className="error banner">{error}</p> : null}
      {loading ? <p className="muted">Loading...</p> : null}

      {!loading ? (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Verification</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((user) => (
                <tr key={user.userId}>
                  <td>
                    {user.firstName} {user.lastName}
                  </td>
                  <td>{user.email}</td>
                  <td>
                    <span className={`pill pill-${user.role.toLowerCase()}`}>{user.role}</span>
                  </td>
                  <td>{user.verificationStatus}</td>
                  <td className="actions-cell">
                    <div className="actions">
                      {user.role === "ORGANIZER" ? (
                        <button
                          type="button"
                          className="danger"
                          disabled={busyId === user.userId}
                          onClick={() => void onDemote(user.userId)}
                        >
                          Demote to user
                        </button>
                      ) : null}
                      {user.role === "USER" &&
                      user.isVerified &&
                      user.verificationStatus === "APPROVED" ? (
                        <button
                          type="button"
                          className="ghost"
                          disabled={busyId === user.userId}
                          onClick={() => void onPromote(user.userId)}
                        >
                          Promote to organizer
                        </button>
                      ) : null}
                      {user.role === "USER" &&
                      (user.isVerified || user.verificationStatus !== "NOT_SUBMITTED") ? (
                        <button
                          type="button"
                          className="ghost"
                          disabled={busyId === user.userId}
                          onClick={() => void onResetVerification(user.userId)}
                        >
                          Reset verification
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

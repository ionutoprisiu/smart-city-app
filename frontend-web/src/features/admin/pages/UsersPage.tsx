import { useCallback, useEffect, useState } from "react";
import {
  AdminUserItem,
  AdminUserUpdateRequest,
  deleteUser,
  demoteToUser,
  fetchUsers,
  promoteGuide,
  resetUserVerification,
  updateUser,
} from "../api/client";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Icon } from "../components/Icon";
import { UserEditDialog } from "../components/UserEditDialog";

type PendingAction =
  | { type: "delete"; user: AdminUserItem }
  | { type: "demote"; userId: number }
  | { type: "reset"; userId: number };

export function UsersPage() {
  const [items, setItems] = useState<AdminUserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [editingUser, setEditingUser] = useState<AdminUserItem | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

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
      await promoteGuide(userId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Promote failed");
    } finally {
      setBusyId(null);
    }
  }

  async function onDemote(userId: number) {
    setBusyId(userId);
    try {
      await demoteToUser(userId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Demote failed");
    } finally {
      setBusyId(null);
      setPendingAction(null);
    }
  }

  async function onResetVerification(userId: number) {
    setBusyId(userId);
    try {
      await resetUserVerification(userId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset verification failed");
    } finally {
      setBusyId(null);
      setPendingAction(null);
    }
  }

  async function onSaveEdit(body: AdminUserUpdateRequest) {
    if (!editingUser) {
      return;
    }
    setBusyId(editingUser.userId);
    try {
      await updateUser(editingUser.userId, body);
      setEditingUser(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusyId(null);
    }
  }

  async function onDelete(user: AdminUserItem) {
    setBusyId(user.userId);
    try {
      await deleteUser(user.userId);
      setPendingAction(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section>
      <div className="section-head">
        <div>
          <h2>Users</h2>
          <p className="muted">Manage accounts, roles, and verification</p>
        </div>
        <button type="button" className="ghost" onClick={() => void load()} disabled={loading}>
          <Icon name="refresh" size={18} />
          Reload
        </button>
      </div>

      {error ? <p className="error banner">{error}</p> : null}
      {loading ? <p className="muted">Loading...</p> : null}

      {!loading ? (
        <div className="card table-wrap">
          <table className="users-table">
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
                  <td className="user-name">
                    <span className="user-avatar" aria-hidden>
                      {user.firstName.charAt(0)}
                      {user.lastName.charAt(0)}
                    </span>
                    <span>
                      {user.firstName} {user.lastName}
                    </span>
                  </td>
                  <td>{user.email}</td>
                  <td>
                    <span className={`pill pill-${user.role.toLowerCase()}`}>{user.role}</span>
                  </td>
                  <td>
                    <span className={`status-dot status-${user.verificationStatus.toLowerCase()}`} />
                    {user.verificationStatus}
                  </td>
                  <td className="actions-cell">
                    <div className="actions">
                      <button
                        type="button"
                        className="icon-action"
                        title="Edit user"
                        disabled={busyId === user.userId}
                        onClick={() => setEditingUser(user)}
                      >
                        <Icon name="edit" size={18} />
                      </button>
                      {user.role !== "ADMIN" ? (
                        <button
                          type="button"
                          className="icon-action icon-action--danger"
                          title="Delete user"
                          disabled={busyId === user.userId}
                          onClick={() => setPendingAction({ type: "delete", user })}
                        >
                          <Icon name="delete" size={18} />
                        </button>
                      ) : null}
                      {user.role === "GUIDE" ? (
                        <button
                          type="button"
                          className="ghost ghost--compact"
                          disabled={busyId === user.userId}
                          onClick={() => setPendingAction({ type: "demote", userId: user.userId })}
                        >
                          Demote
                        </button>
                      ) : null}
                      {user.role === "USER" &&
                      user.isVerified &&
                      user.verificationStatus === "APPROVED" ? (
                        <button
                          type="button"
                          className="ghost ghost--compact"
                          disabled={busyId === user.userId}
                          onClick={() => void onPromote(user.userId)}
                        >
                          Promote
                        </button>
                      ) : null}
                      {user.role === "USER" &&
                      (user.isVerified || user.verificationStatus !== "NOT_SUBMITTED") ? (
                        <button
                          type="button"
                          className="ghost ghost--compact"
                          disabled={busyId === user.userId}
                          onClick={() => setPendingAction({ type: "reset", userId: user.userId })}
                        >
                          Reset
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

      {editingUser ? (
        <UserEditDialog
          user={editingUser}
          loading={busyId === editingUser.userId}
          onSave={(body) => void onSaveEdit(body)}
          onClose={() => setEditingUser(null)}
        />
      ) : null}

      {pendingAction?.type === "delete" ? (
        <ConfirmDialog
          title="Delete user?"
          message={`This permanently removes ${pendingAction.user.firstName} ${pendingAction.user.lastName} and their clubs, events, and messages.`}
          confirmLabel="Delete"
          destructive
          loading={busyId === pendingAction.user.userId}
          onConfirm={() => void onDelete(pendingAction.user)}
          onCancel={() => setPendingAction(null)}
        />
      ) : null}

      {pendingAction?.type === "demote" ? (
        <ConfirmDialog
          title="Demote guide?"
          message="The user must verify their identity again before becoming guide."
          confirmLabel="Demote"
          loading={busyId === pendingAction.userId}
          onConfirm={() => void onDemote(pendingAction.userId)}
          onCancel={() => setPendingAction(null)}
        />
      ) : null}

      {pendingAction?.type === "reset" ? (
        <ConfirmDialog
          title="Reset verification?"
          message="The user will need to submit identity documents again."
          confirmLabel="Reset"
          loading={busyId === pendingAction.userId}
          onConfirm={() => void onResetVerification(pendingAction.userId)}
          onCancel={() => setPendingAction(null)}
        />
      ) : null}
    </section>
  );
}

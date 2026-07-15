import { FormEvent, useState } from "react";
import { AdminUserItem, AdminUserUpdateRequest, Role } from "../api/client";
import { AppButton } from "../shared/components/AppButton";
import { Icon } from "./Icon";

type Props = {
  user: AdminUserItem;
  loading?: boolean;
  onSave: (body: AdminUserUpdateRequest) => void;
  onClose: () => void;
};

export function UserEditDialog({ user, loading = false, onSave, onClose }: Props) {
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState<Role>(user.role);

  const isAdmin = user.role === "ADMIN";

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const body: AdminUserUpdateRequest = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
    };
    if (!isAdmin && role !== user.role) {
      body.role = role;
    }
    onSave(body);
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-card modal-card--wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-user-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-card__head">
          <div>
            <p className="label-small muted">Editează utilizatorul</p>
            <h3 id="edit-user-title" className="title-medium">
              {user.firstName} {user.lastName}
            </h3>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Închide">
            <Icon name="close" size={22} />
          </button>
        </div>

        <form className="user-form" onSubmit={handleSubmit}>
          <label className="field">
            <span className="label-medium">Prenume</span>
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
          </label>
          <label className="field">
            <span className="label-medium">Nume</span>
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} required />
          </label>
          <label className="field">
            <span className="label-medium">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          {!isAdmin ? (
            <label className="field">
              <span className="label-medium">Rol</span>
              <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
                <option value="USER">Turist</option>
                <option
                  value="GUIDE"
                  disabled={!user.isVerified || user.verificationStatus !== "APPROVED"}
                >
                  Ghid
                </option>
              </select>
              {role === "GUIDE" && (!user.isVerified || user.verificationStatus !== "APPROVED") ? (
                <span className="body-small muted">
                  User must be verified before becoming guide.
                </span>
              ) : null}
            </label>
          ) : (
            <p className="body-small muted">Admin accounts cannot change role here.</p>
          )}

          <div className="modal-actions">
            <AppButton label="Renunță" variant="outlined" onPress={onClose} disabled={loading} />
            <AppButton label="Salvează" type="submit" loading={loading} />
          </div>
        </form>
      </div>
    </div>
  );
}

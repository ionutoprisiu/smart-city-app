import { AdminVerificationItem } from "../api/client";
import { VerificationImage } from "./VerificationImage";

type VerificationCardProps = {
  item: AdminVerificationItem;
  busy: boolean;
  onApprove: (userId: number) => void;
  onReject: (userId: number) => void;
};

export function VerificationCard({
  item,
  busy,
  onApprove,
  onReject,
}: VerificationCardProps) {
  const canReview =
    item.verificationStatus === "MANUAL_REVIEW" || item.verificationStatus === "REJECTED";
  const isAutoApproved = item.verificationStatus === "APPROVED";

  return (
    <article className="card verification-card">
      <div className="verification-main">
        <div>
          <h3>
            {item.firstName} {item.lastName}
          </h3>
          <p className="muted">{item.email}</p>
          <p>
            Scor: {item.verificationScore != null ? item.verificationScore.toFixed(3) : "—"}
          </p>
          <p className="muted">{item.verificationReason ?? "Fără motiv specificat"}</p>
          {isAutoApproved ? (
            <p className="muted">Rol de ghid acordat automat. Folosește Utilizatori → Retrogradează pentru revocare.</p>
          ) : null}
        </div>
        {canReview ? (
          <div className="actions">
            <button
              type="button"
              className="success"
              disabled={busy}
              onClick={() => onApprove(item.userId)}
            >
              Aprobă
            </button>
            <button
              type="button"
              className="danger"
              disabled={busy}
              onClick={() => onReject(item.userId)}
            >
              Respinge
            </button>
          </div>
        ) : null}
      </div>

      <div className="verification-images">
        <figure>
          <figcaption>Buletin</figcaption>
          {item.idCardImageUrl ? (
            <VerificationImage src={item.idCardImageUrl} alt={`ID ${item.firstName}`} />
          ) : (
            <div className="image-placeholder">Fără poză buletin</div>
          )}
        </figure>
        <figure>
          <figcaption>Selfie</figcaption>
          {item.faceImageUrl ? (
            <VerificationImage src={item.faceImageUrl} alt={`Selfie ${item.firstName}`} />
          ) : (
            <div className="image-placeholder">Fără selfie</div>
          )}
        </figure>
      </div>
    </article>
  );
}

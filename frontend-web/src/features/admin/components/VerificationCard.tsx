import { AdminVerificationItem } from "../api/client";
import { VerificationImage } from "./VerificationImage";

type VerificationCardProps = {
  item: AdminVerificationItem;
  busy: boolean;
  onApprove: (userId: number) => void;
  onReject: (userId: number) => void;
  onAllowResubmit?: (userId: number) => void;
};

export function VerificationCard({
  item,
  busy,
  onApprove,
  onReject,
  onAllowResubmit,
}: VerificationCardProps) {
  const canReview =
    item.verificationStatus === "MANUAL_REVIEW" || item.verificationStatus === "REJECTED";
  const canAllowResubmit = item.verificationStatus === "REJECTED";
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
            Score: {item.verificationScore != null ? item.verificationScore.toFixed(3) : "—"}
          </p>
          <p className="muted">{item.verificationReason ?? "No reason given"}</p>
          {isAutoApproved ? (
            <p className="muted">Guide role granted automatically. Use Users → Demote to revoke.</p>
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
              Approve
            </button>
            <button
              type="button"
              className="danger"
              disabled={busy}
              onClick={() => onReject(item.userId)}
            >
              Reject
            </button>
            {canAllowResubmit && onAllowResubmit ? (
              <button
                type="button"
                className="ghost"
                disabled={busy}
                onClick={() => onAllowResubmit(item.userId)}
              >
                Allow resubmit
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="verification-images">
        <figure>
          <figcaption>ID card</figcaption>
          {item.idCardImageUrl ? (
            <VerificationImage src={item.idCardImageUrl} alt={`ID ${item.firstName}`} />
          ) : (
            <div className="image-placeholder">No ID photo</div>
          )}
        </figure>
        <figure>
          <figcaption>Selfie</figcaption>
          {item.faceImageUrl ? (
            <VerificationImage src={item.faceImageUrl} alt={`Selfie ${item.firstName}`} />
          ) : (
            <div className="image-placeholder">No selfie</div>
          )}
        </figure>
      </div>
    </article>
  );
}

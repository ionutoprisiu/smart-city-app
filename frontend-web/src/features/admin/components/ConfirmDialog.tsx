import { AppButton } from "../shared/components/AppButton";
import { Icon } from "./Icon";

type Props = {
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirmă",
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <div className="modal-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-card__icon modal-card__icon--warn" aria-hidden>
          <Icon name="warning" size={24} />
        </div>
        <h3 id="confirm-title" className="title-medium">
          {title}
        </h3>
        <p className="body-medium muted">{message}</p>
        <div className="modal-actions">
          <AppButton label="Renunță" variant="outlined" onPress={onCancel} disabled={loading} />
          <AppButton
            label={confirmLabel}
            variant={destructive ? "destructive" : "filled"}
            onPress={onConfirm}
            loading={loading}
          />
        </div>
      </div>
    </div>
  );
}

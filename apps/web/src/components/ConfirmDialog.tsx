import GlassCard from "./GlassCard";

interface ConfirmDialogProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  danger?: boolean;
}

export default function ConfirmDialog({
  message,
  onConfirm,
  onCancel,
  confirmLabel = "Delete",
  danger = true,
}: ConfirmDialogProps) {
  return (
    <div
      className="modal-overlay"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label="Confirmation"
    >
      <GlassCard
        className="modal-content confirm-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <p>{message}</p>
        <div className="confirm-actions">
          <button className="btn btn-ghost" onClick={onCancel} type="button">
            Cancel
          </button>
          <button
            className={`btn ${danger ? "btn-danger" : "btn-primary"}`}
            onClick={onConfirm}
            type="button"
          >
            {confirmLabel}
          </button>
        </div>
      </GlassCard>
    </div>
  );
}

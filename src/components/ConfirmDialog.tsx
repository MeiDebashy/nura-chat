import { Modal } from "./Modals";

interface Props {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
  onClose,
}: Props) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      {description && (
        <p className="text-[14px] text-gray-300 leading-relaxed mb-5">
          {description}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-lg text-[13px] text-gray-200 border border-white/10 hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 transition-colors"
        >
          {cancelLabel}
        </button>
        <button
          onClick={() => {
            onConfirm();
            onClose();
          }}
          className={`px-4 py-2 rounded-lg text-[13px] font-medium focus:outline-none focus-visible:ring-2 transition-colors ${
            destructive
              ? "bg-red-500/90 hover:bg-red-500 text-white focus-visible:ring-red-400/60"
              : "bg-cyan-500 hover:bg-cyan-400 text-[#0a0a0f] focus-visible:ring-cyan-400/60"
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

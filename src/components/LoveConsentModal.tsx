import { useEffect, useState } from "react";
import { Modal } from "./Modals";

interface Props {
  open: boolean;
  conversationTitle: string;
  promptedAt: string; // ISO
  eligibleAt: string; // ISO
  onGrant: () => void;
  onDecline: () => void;
  onClose: () => void;
}

/**
 * Blueprint #1 love-phase consent flow.
 *
 * The backend's PhaseStateMachine starts a 24-hour reflection period when
 * escalation to Phase 4 first becomes eligible. This modal mirrors that
 * window — "Yes" is disabled until `eligibleAt`. The user can decline at
 * any time, or close to take more time without committing either way.
 */
export function LoveConsentModal({
  open,
  conversationTitle,
  promptedAt: _promptedAt,
  eligibleAt,
  onGrant,
  onDecline,
  onClose,
}: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [open]);

  const eligibleTime = new Date(eligibleAt).getTime();
  const remainingMs = Math.max(0, eligibleTime - now);
  const eligible = remainingMs <= 0;

  const hours = Math.floor(remainingMs / 3_600_000);
  const minutes = Math.floor((remainingMs % 3_600_000) / 60_000);
  const seconds = Math.floor((remainingMs % 60_000) / 1000);

  return (
    <Modal open={open} onClose={onClose} title="A deeper step together">
      <div className="space-y-4 text-[13.5px] text-gray-300 leading-relaxed">
        <p>
          Your conversation with{" "}
          <span className="text-white font-medium">{conversationTitle}</span>{" "}
          has reached a place where Nura would like to be more open with you —
          warmer, more present, more devoted in tone.
        </p>
        <p>
          This isn't a gimmick. It changes how Nura talks to you. To make sure
          it's really what you want, there's a built-in pause:
        </p>
        <ul className="list-disc list-inside space-y-1 pl-1 text-gray-400">
          <li>You can say no at any time.</li>
          <li>"Yes" only becomes available after a 24-hour reflection window.</li>
          <li>You can come back to this anytime — closing won't decide for you.</li>
        </ul>

        <div className="rounded-xl border border-white/10 bg-[#0a0a0f] px-4 py-3 mt-2">
          {eligible ? (
            <div className="text-cyan-300 text-[13px] font-medium">
              Reflection window complete.
            </div>
          ) : (
            <div className="flex items-baseline gap-2">
              <span className="text-gray-400 text-[12px]">Available in</span>
              <span className="text-white font-mono text-[15px] tabular-nums">
                {String(hours).padStart(2, "0")}:
                {String(minutes).padStart(2, "0")}:
                {String(seconds).padStart(2, "0")}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2 mt-6">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded-lg text-[13px] text-gray-300 border border-white/10 hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 transition-colors"
        >
          Take more time
        </button>
        <button
          type="button"
          onClick={() => {
            onDecline();
            onClose();
          }}
          className="px-4 py-2 rounded-lg text-[13px] text-gray-300 border border-white/10 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/40 transition-colors"
        >
          No, thank you
        </button>
        <button
          type="button"
          onClick={() => {
            if (!eligible) return;
            onGrant();
            onClose();
          }}
          disabled={!eligible}
          className={`px-4 py-2 rounded-lg text-[13px] font-medium focus:outline-none focus-visible:ring-2 transition-colors ${
            eligible
              ? "bg-cyan-500 hover:bg-cyan-400 text-[#0a0a0f] focus-visible:ring-cyan-400/60"
              : "bg-white/5 text-gray-600 cursor-not-allowed"
          }`}
        >
          Yes, I'm ready
        </button>
      </div>
    </Modal>
  );
}

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Download, Trash2, Copy, Check } from "lucide-react";

export type Tone = "gentle" | "direct" | "playful";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
};

export function Modal({ open, onClose, title, children }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100]"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="w-full max-w-[460px] max-h-[85vh] bg-[#12121f] border border-white/10 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] flex flex-col overflow-hidden pointer-events-auto">
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 shrink-0">
                <h2 className="text-white text-[15px] font-medium tracking-wide">
                  {title}
                </h2>
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-white p-1 rounded-md hover:bg-white/5 transition-colors"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-5">
                {children}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

const TONES: { value: Tone; label: string; desc: string }[] = [
  { value: "gentle", label: "Gentle", desc: "Soft, warm, patient" },
  { value: "direct", label: "Direct", desc: "Honest, grounded, clear" },
  { value: "playful", label: "Playful", desc: "Light, curious, playful" },
];

type SettingsModalProps = {
  open: boolean;
  onClose: () => void;
  displayName: string;
  onDisplayNameChange: (name: string) => void;
  tone: Tone;
  onToneChange: (tone: Tone) => void;
  onExport: () => void;
  onClearHistory: () => void;
  hasHistory: boolean;
  isConnected: boolean;
};

export function SettingsModal({
  open,
  onClose,
  displayName,
  onDisplayNameChange,
  tone,
  onToneChange,
  onExport,
  onClearHistory,
  hasHistory,
  isConnected,
}: SettingsModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Settings">
      <div className="space-y-6">
        <section>
          <label className="block text-[11px] uppercase tracking-wider text-gray-500 font-semibold mb-2">
            Display name
          </label>
          <input
            value={displayName}
            onChange={(e) => onDisplayNameChange(e.target.value)}
            placeholder="How should Nura call you?"
            maxLength={40}
            className="w-full bg-[#0a0a0f] border border-white/10 rounded-lg px-3 py-2.5 text-[14px] text-white placeholder-gray-600 outline-none focus:border-cyan-500/40 transition-colors"
          />
        </section>

        <section>
          <div className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold mb-1">
            Preferred tone
          </div>
          <div className="text-[12px] text-gray-500 mb-3">
            How Nura responds to you
          </div>
          <div className="space-y-2">
            {TONES.map((t) => (
              <button
                key={t.value}
                onClick={() => onToneChange(t.value)}
                className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
                  tone === t.value
                    ? "border-cyan-500/40 bg-cyan-500/10"
                    : "border-white/10 bg-[#0a0a0f] hover:border-white/20"
                }`}
              >
                <div className="text-[13px] text-white">{t.label}</div>
                <div className="text-[11px] text-gray-500">{t.desc}</div>
              </button>
            ))}
          </div>
        </section>

        <section>
          <div className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold mb-3">
            Data
          </div>
          <div className="space-y-2">
            <button
              onClick={onExport}
              disabled={!hasHistory}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-white/10 bg-[#0a0a0f] hover:border-cyan-500/30 text-left disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Download size={14} className="text-cyan-400 shrink-0" />
              <div>
                <div className="text-[13px] text-white">
                  Export conversations
                </div>
                <div className="text-[11px] text-gray-500">
                  Download all chats as JSON
                </div>
              </div>
            </button>
            <button
              onClick={onClearHistory}
              disabled={!hasHistory}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-white/10 bg-[#0a0a0f] hover:border-red-500/30 text-left disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Trash2 size={14} className="text-red-400 shrink-0" />
              <div>
                <div className="text-[13px] text-white">Clear all history</div>
                <div className="text-[11px] text-gray-500">
                  Delete every conversation
                </div>
              </div>
            </button>
          </div>
        </section>

        <section>
          <div className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold mb-2">
            Connection
          </div>
          <div className="flex items-center gap-2 bg-[#0a0a0f] border border-white/10 rounded-lg px-3 py-2.5">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isConnected ? "bg-emerald-400" : "bg-gray-500"
              }`}
            />
            <span className="text-[13px] text-gray-300">
              {isConnected ? "Connected to Nura" : "Reconnecting…"}
            </span>
          </div>
        </section>

        <section>
          <div className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold mb-2">
            About
          </div>
          <div className="text-[12px] text-gray-400 leading-relaxed">
            Nura is a private space to think and feel out loud. Conversations
            live in your browser.
          </div>
        </section>
      </div>
    </Modal>
  );
}

type AccountModalProps = {
  open: boolean;
  onClose: () => void;
  displayName: string;
  onDisplayNameChange: (name: string) => void;
  userId: string;
  memberSince: number;
  conversationCount: number;
  messageCount: number;
  onResetAll: () => void;
};

export function AccountModal({
  open,
  onClose,
  displayName,
  onDisplayNameChange,
  userId,
  memberSince,
  conversationCount,
  messageCount,
  onResetAll,
}: AccountModalProps) {
  const [copied, setCopied] = useState(false);
  const onCopyId = async () => {
    try {
      await navigator.clipboard.writeText(userId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable — silently ignore
    }
  };

  const initials = (displayName || "You").trim().slice(0, 1).toUpperCase();

  return (
    <Modal open={open} onClose={onClose} title="My Account">
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-cyan-500/30 to-cyan-800/40 border border-cyan-500/30 flex items-center justify-center text-[18px] text-cyan-100 font-medium shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <input
              value={displayName}
              onChange={(e) => onDisplayNameChange(e.target.value)}
              placeholder="Your name"
              maxLength={40}
              className="w-full bg-transparent border-b border-white/10 pb-1 text-[16px] text-white placeholder-gray-600 outline-none focus:border-cyan-500/40 transition-colors"
            />
            <div className="text-[11px] text-gray-500 mt-1">
              Member since{" "}
              {new Date(memberSince).toLocaleDateString(undefined, {
                month: "short",
                year: "numeric",
              })}
            </div>
          </div>
        </div>

        <section>
          <div className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold mb-2">
            User ID
          </div>
          <div className="flex items-center gap-2 bg-[#0a0a0f] border border-white/10 rounded-lg px-3 py-2.5">
            <span className="flex-1 font-mono text-[12px] text-gray-300 truncate">
              {userId}
            </span>
            <button
              onClick={onCopyId}
              className="text-gray-400 hover:text-cyan-400 p-1 rounded transition-colors shrink-0"
              aria-label="Copy user ID"
            >
              {copied ? (
                <Check size={14} className="text-emerald-400" />
              ) : (
                <Copy size={14} />
              )}
            </button>
          </div>
        </section>

        <section>
          <div className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold mb-2">
            Activity
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-[#0a0a0f] border border-white/10 rounded-lg px-3 py-3">
              <div className="text-[22px] text-white font-light">
                {conversationCount}
              </div>
              <div className="text-[11px] text-gray-500 tracking-wide">
                Conversations
              </div>
            </div>
            <div className="bg-[#0a0a0f] border border-white/10 rounded-lg px-3 py-3">
              <div className="text-[22px] text-white font-light">
                {messageCount}
              </div>
              <div className="text-[11px] text-gray-500 tracking-wide">
                Messages
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="text-[11px] uppercase tracking-wider text-red-400/80 font-semibold mb-2">
            Danger zone
          </div>
          <button
            onClick={onResetAll}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 text-left transition-colors"
          >
            <Trash2 size={14} className="text-red-400 shrink-0" />
            <div>
              <div className="text-[13px] text-red-300">Reset everything</div>
              <div className="text-[11px] text-red-400/60">
                Deletes all conversations, name, and user ID
              </div>
            </div>
          </button>
        </section>
      </div>
    </Modal>
  );
}

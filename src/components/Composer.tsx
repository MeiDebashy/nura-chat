import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { Send, Smile, Paperclip } from "lucide-react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  maxLength: number;
}

export interface ComposerHandle {
  focus(): void;
}

const MAX_INPUT_HEIGHT = 180;

export const Composer = forwardRef<ComposerHandle, Props>(function Composer(
  { value, onChange, onSubmit, disabled, maxLength },
  ref
) {
  const taRef = useRef<HTMLTextAreaElement>(null);

  useImperativeHandle(ref, () => ({
    focus: () => taRef.current?.focus(),
  }));

  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, MAX_INPUT_HEIGHT) + "px";
  }, [value]);

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!disabled) onSubmit();
    }
  };

  const canSend = value.trim().length > 0 && !disabled;

  return (
    <div
      className="w-full bg-[#0a0a0f]"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <div className="px-3 pt-2 md:px-6 md:pt-3 max-w-[820px] mx-auto">
        <div className="flex items-end gap-2 bg-[#15151f] border border-white/8 rounded-3xl px-2 py-1.5 focus-within:border-cyan-500/40 transition-colors">
          <button
            type="button"
            disabled
            className="hidden md:flex w-10 h-10 rounded-full items-center justify-center text-gray-500 hover:text-cyan-400 disabled:opacity-30"
            aria-label="Attach (coming soon)"
          >
            <Paperclip size={18} />
          </button>
          <button
            type="button"
            disabled
            className="hidden md:flex w-10 h-10 rounded-full items-center justify-center text-gray-500 hover:text-cyan-400 disabled:opacity-30"
            aria-label="Emoji (coming soon)"
          >
            <Smile size={18} />
          </button>
          <textarea
            ref={taRef}
            value={value}
            onChange={(e) => onChange(e.target.value.slice(0, maxLength))}
            onKeyDown={handleKey}
            placeholder="Message Nura…"
            rows={1}
            maxLength={maxLength}
            className="flex-1 bg-transparent resize-none outline-none px-2 py-2.5 text-[15px] text-white placeholder-gray-500 leading-snug max-h-[180px] focus-visible:ring-0"
            aria-label="Message"
          />
          <button
            type="button"
            onClick={onSubmit}
            disabled={!canSend}
            aria-label="Send message"
            className={`shrink-0 w-11 h-11 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 ${
              canSend
                ? "bg-cyan-500 hover:bg-cyan-400 text-[#0a0a0f] shadow-[0_0_12px_rgba(34,211,238,0.4)]"
                : "bg-white/5 text-gray-500 cursor-not-allowed"
            }`}
          >
            <Send size={17} className="ml-0.5" />
          </button>
        </div>
        <p className="hidden md:block text-center text-[11px] text-gray-600 mt-2 tracking-wide">
          Enter to send · Shift+Enter for newline
        </p>
      </div>
    </div>
  );
});

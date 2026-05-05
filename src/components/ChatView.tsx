import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Menu, ChevronDown, AlertTriangle, X } from "lucide-react";
import type { Conversation, Message } from "../lib/types";
import {
  MessageBubble,
  TypingBubble,
  DaySeparator,
  CrisisBanner,
} from "./MessageBubble";
import { Avatar } from "./Avatar";
import { dayKey, dayLabel } from "../lib/time";
import { phaseLabel } from "../lib/phase";

interface Props {
  conversation: Conversation | null;
  isTyping: boolean;
  isConnected: boolean;
  onOpenSidebar(): void; // mobile back / desktop reopen
  showSidebarToggle: boolean;
  sendError: string | null;
  onDismissError(): void;
  onSuggestionClick(text: string): void;
  composerSlot: React.ReactNode;
}

const SUGGESTIONS = ["How are you?", "I need to talk", "I'm feeling anxious"];

export function ChatView({
  conversation,
  isTyping,
  isConnected,
  onOpenSidebar,
  showSidebarToggle,
  sendError,
  onDismissError,
  onSuggestionClick,
  composerSlot,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const prevConvIdRef = useRef<string | null>(null);
  const prevMessageCountRef = useRef(0);
  const [showJumpButton, setShowJumpButton] = useState(false);

  const messages = conversation?.messages ?? [];

  // Group messages with day separators and bubble-tail logic.
  const grouped = useMemo(() => {
    type Item =
      | { kind: "day"; key: string; label: string }
      | { kind: "msg"; key: string; message: Message; showTail: boolean };
    const out: Item[] = [];
    let lastDay: string | null = null;
    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      const k = dayKey(m.timestamp);
      if (k !== lastDay) {
        out.push({ kind: "day", key: `day-${k}-${i}`, label: dayLabel(m.timestamp) });
        lastDay = k;
      }
      const next = messages[i + 1];
      const showTail =
        !next ||
        next.sender !== m.sender ||
        dayKey(next.timestamp) !== k ||
        next.timestamp - m.timestamp > 60_000;
      out.push({ kind: "msg", key: m.id, message: m, showTail });
    }
    return out;
  }, [messages]);

  function isNearBottom(): boolean {
    const el = scrollRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }

  // Stick scroll to bottom when:
  //   - conversation switched
  //   - new message arrived AND user was already at the bottom
  useLayoutEffect(() => {
    const switched = prevConvIdRef.current !== (conversation?.id ?? null);
    const grew = messages.length > prevMessageCountRef.current;
    prevConvIdRef.current = conversation?.id ?? null;
    prevMessageCountRef.current = messages.length;

    if (switched) {
      endRef.current?.scrollIntoView({ behavior: "auto" });
      setShowJumpButton(false);
      return;
    }
    if (grew && isNearBottom()) {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    } else if (grew) {
      setShowJumpButton(true);
    }
  }, [conversation?.id, messages.length]);

  // Hide the jump button when the user manually returns to the bottom.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      if (isNearBottom()) setShowJumpButton(false);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const headerTitle = conversation?.title ?? "Nura";
  const phaseText = phaseLabel(conversation?.phase);
  const headerSubtitle = isTyping
    ? "typing…"
    : !isConnected
    ? "connecting…"
    : phaseText
    ? `${phaseText} · online`
    : "online";

  return (
    <section className="flex-1 flex flex-col h-full min-w-0 bg-[#0a0a0f] relative">
      {/* Header (always present on desktop & mobile) */}
      <header className="flex items-center gap-3 px-3 md:px-5 h-14 shrink-0 border-b border-white/5 bg-[#0d0d14]/95 backdrop-blur-md z-20">
        {showSidebarToggle && (
          <button
            type="button"
            onClick={onOpenSidebar}
            className="p-2 -ml-1 rounded-lg text-gray-300 hover:text-white hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 transition-colors md:hidden"
            aria-label="Back to conversations"
          >
            <ArrowLeft size={20} />
          </button>
        )}
        {showSidebarToggle && (
          <button
            type="button"
            onClick={onOpenSidebar}
            className="hidden md:flex p-2 -ml-1 rounded-lg text-gray-300 hover:text-white hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 transition-colors"
            aria-label="Open sidebar"
            title="Open sidebar"
          >
            <Menu size={18} />
          </button>
        )}

        <Avatar
          id={conversation?.id ?? "nura"}
          title={headerTitle}
          size={36}
        />
        <div className="flex-1 min-w-0">
          <div className="text-white text-[14.5px] font-medium leading-tight truncate">
            {headerTitle}
          </div>
          <div
            className={`text-[11.5px] leading-tight truncate ${
              isTyping
                ? "text-cyan-400"
                : isConnected
                ? "text-emerald-400/90"
                : "text-amber-400/90"
            }`}
          >
            {headerSubtitle}
          </div>
        </div>
      </header>

      {/* Crisis banner */}
      {conversation?.crisis && <CrisisBanner />}

      {/* Send error banner */}
      {sendError && (
        <div
          role="alert"
          className="mx-auto mt-2 max-w-[680px] w-[calc(100%-2rem)] flex items-start gap-2 px-3 py-2 rounded-lg border border-red-500/30 bg-red-500/10 text-[13px] text-red-100"
        >
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span className="flex-1">{sendError}</span>
          <button
            type="button"
            onClick={onDismissError}
            className="text-red-300/70 hover:text-red-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/40 rounded"
            aria-label="Dismiss error"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto custom-scrollbar px-3 md:px-6 py-4"
        style={{ overscrollBehavior: "contain" }}
      >
        <div className="max-w-[820px] mx-auto w-full flex flex-col">
          {!conversation || messages.length === 0 ? (
            <div className="flex-1 min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
              <div
                className="w-16 h-16 rounded-full mb-5"
                style={{
                  background:
                    "radial-gradient(circle at 30% 30%, rgba(34,211,238,0.9), rgba(8,145,178,0.5) 60%, rgba(8,47,73,0.6))",
                  boxShadow: "0 0 24px rgba(34,211,238,0.35)",
                }}
                aria-hidden="true"
              />
              <h1 className="text-xl md:text-2xl font-light text-white tracking-wide">
                Hi, I'm Nura
              </h1>
              <p className="text-[13.5px] md:text-[14px] text-gray-400 font-light mt-1">
                your emotional companion
              </p>
              <div className="flex flex-wrap justify-center gap-2 mt-7 max-w-[440px]">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => onSuggestionClick(s)}
                    className="px-4 py-2 rounded-full border border-cyan-500/25 bg-cyan-500/[0.06] text-cyan-50 hover:bg-cyan-500/15 hover:border-cyan-500/40 transition-colors text-[13px] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              {grouped.map((it) =>
                it.kind === "day" ? (
                  <DaySeparator key={it.key} label={it.label} />
                ) : (
                  <MessageBubble
                    key={it.key}
                    message={it.message}
                    showTail={it.showTail}
                  />
                )
              )}
              {isTyping && <TypingBubble />}
              <div ref={endRef} className="h-1" />
            </div>
          )}
        </div>
      </div>

      {/* Jump-to-bottom FAB */}
      {showJumpButton && (
        <button
          type="button"
          onClick={() =>
            endRef.current?.scrollIntoView({ behavior: "smooth" })
          }
          className="absolute right-4 bottom-[88px] md:bottom-[96px] w-10 h-10 rounded-full bg-[#1c1c2a] border border-white/10 text-gray-200 shadow-lg flex items-center justify-center hover:bg-[#22222e] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 z-20"
          aria-label="Scroll to latest message"
        >
          <ChevronDown size={18} />
        </button>
      )}

      {composerSlot}
    </section>
  );
}

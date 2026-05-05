import { Check, CheckCheck, AlertCircle } from "lucide-react";
import type { Message } from "../lib/types";
import { formatClock } from "../lib/time";

interface Props {
  message: Message;
  showTail: boolean;
}

export function MessageBubble({ message, showTail }: Props) {
  const isUser = message.sender === "user";
  const status = message.status;

  return (
    <div
      className={`group flex w-full ${
        isUser ? "justify-end" : "justify-start"
      }`}
    >
      <div
        className={`relative max-w-[85%] md:max-w-[70%] px-3.5 py-2 text-[14.5px] leading-snug shadow-sm ${
          isUser
            ? "bg-cyan-600/90 text-white"
            : "bg-[#1c1c2a] text-gray-100 border border-white/5"
        }`}
        style={{
          borderRadius: showTail
            ? isUser
              ? "16px 16px 4px 16px"
              : "16px 16px 16px 4px"
            : "16px",
          overflowWrap: "anywhere",
          wordBreak: "break-word",
        }}
      >
        <div className="whitespace-pre-wrap pr-12">{message.text}</div>
        <div
          className={`absolute right-2 bottom-1 flex items-center gap-1 text-[10px] ${
            isUser ? "text-cyan-100/80" : "text-gray-500"
          }`}
        >
          <span>{formatClock(message.timestamp)}</span>
          {isUser && status === "sending" && (
            <Check size={11} className="opacity-60" aria-label="Sending" />
          )}
          {isUser && status === "sent" && (
            <CheckCheck size={11} aria-label="Sent" />
          )}
          {isUser && status === "failed" && (
            <AlertCircle
              size={11}
              className="text-red-300"
              aria-label="Failed to send"
            />
          )}
        </div>
      </div>
    </div>
  );
}

export function TypingBubble() {
  return (
    <div className="flex w-full justify-start">
      <div className="bg-[#1c1c2a] border border-white/5 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1.5 items-center">
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
        <span
          className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"
          style={{ animationDelay: "0.15s" }}
        />
        <span
          className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"
          style={{ animationDelay: "0.3s" }}
        />
      </div>
    </div>
  );
}

export function DaySeparator({ label }: { label: string }) {
  return (
    <div className="flex justify-center my-2">
      <span className="text-[11px] text-gray-400 bg-white/5 border border-white/5 rounded-full px-3 py-1 backdrop-blur-sm">
        {label}
      </span>
    </div>
  );
}

export function CrisisBanner() {
  return (
    <div
      role="alert"
      className="mx-auto my-3 max-w-[680px] rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-[13px] text-red-100 leading-relaxed"
    >
      <div className="font-medium mb-1">If you're in immediate danger</div>
      <div className="text-red-200/90">
        You're not alone. Reach out to a local hotline or emergency services.
        In the US: <span className="font-medium">988</span>. In the UK:{" "}
        <span className="font-medium">116 123</span>. Otherwise see{" "}
        <a
          href="https://findahelpline.com"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-white"
        >
          findahelpline.com
        </a>
        .
      </div>
    </div>
  );
}

import { useMemo, useState } from "react";
import {
  Plus,
  Search,
  Settings as SettingsIcon,
  User,
  X,
  Trash2,
  PanelLeftClose,
} from "lucide-react";
import type { Conversation } from "../lib/types";
import { Avatar, NuraBrandAvatar } from "./Avatar";
import { formatRelativeTime } from "../lib/time";

interface Props {
  conversations: Conversation[];
  activeId: string | null;
  typingForId: string | null;
  isConnected: boolean;
  displayName: string;
  onSelect(id: string): void;
  onDelete(id: string): void;
  onNew(): void;
  onCollapse?(): void; // desktop only
  onCloseDrawer?(): void; // mobile only
  onOpenSettings(): void;
  onOpenAccount(): void;
  variant: "drawer" | "rail";
}

export function ChatList({
  conversations,
  activeId,
  typingForId,
  isConnected,
  displayName,
  onSelect,
  onDelete,
  onNew,
  onCollapse,
  onCloseDrawer,
  onOpenSettings,
  onOpenAccount,
  variant,
}: Props) {
  const [query, setQuery] = useState("");

  const sorted = useMemo(
    () => [...conversations].sort((a, b) => b.updatedAt - a.updatedAt),
    [conversations]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((c) => {
      if (c.title.toLowerCase().includes(q)) return true;
      return c.messages.some((m) => m.text.toLowerCase().includes(q));
    });
  }, [sorted, query]);

  const lastSnippet = (c: Conversation): { text: string; sender: string } => {
    const m = c.messages[c.messages.length - 1];
    if (!m) return { text: "No messages yet", sender: "" };
    const prefix = m.sender === "user" ? "You: " : "Nura: ";
    return { text: prefix + m.text.replace(/\s+/g, " "), sender: m.sender };
  };

  return (
    <aside className="h-full w-full flex flex-col bg-[#0d0d14] border-r border-white/5">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <NuraBrandAvatar size={30} />
          <span className="text-white font-medium tracking-[0.2em] text-[13px]">
            NURA
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onNew}
            className="p-2 rounded-lg text-gray-300 hover:text-white hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 transition-colors"
            aria-label="New chat"
            title="New chat (Ctrl/⌘+N)"
          >
            <Plus size={18} />
          </button>
          {variant === "rail" && onCollapse && (
            <button
              type="button"
              onClick={onCollapse}
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 transition-colors"
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
            >
              <PanelLeftClose size={18} />
            </button>
          )}
          {variant === "drawer" && onCloseDrawer && (
            <button
              type="button"
              onClick={onCloseDrawer}
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 transition-colors"
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="px-3 pb-3 shrink-0">
        <div className="flex items-center gap-2 bg-[#15151f] border border-white/5 rounded-xl px-3 h-9 focus-within:border-cyan-500/40 transition-colors">
          <Search size={14} className="text-gray-500 shrink-0" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            aria-label="Search conversations"
            className="flex-1 bg-transparent outline-none text-[13px] text-gray-100 placeholder-gray-500"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="text-gray-500 hover:text-gray-200"
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {filtered.length === 0 ? (
          <div className="text-[12.5px] text-gray-500 px-5 py-8 text-center leading-relaxed">
            {query
              ? "No matches."
              : "No conversations yet.\nStart by sending a message."}
          </div>
        ) : (
          <ul className="space-y-0.5 px-2 py-1">
            {filtered.map((c) => {
              const isActive = c.id === activeId;
              const snip = lastSnippet(c);
              const unread = c.unread ?? 0;
              const isTyping = typingForId === c.id;
              return (
                <li key={c.id}>
                  <div
                    className={`group flex items-center gap-3 rounded-xl pl-2 pr-1 py-2 cursor-pointer transition-colors ${
                      isActive
                        ? "bg-cyan-500/10"
                        : "hover:bg-white/[0.03] focus-within:bg-white/[0.03]"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onSelect(c.id)}
                      className="flex-1 flex items-center gap-3 min-w-0 text-left focus:outline-none"
                    >
                      <Avatar id={c.id} title={c.title} size={42} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <div
                            className={`text-[14px] truncate flex-1 ${
                              isActive
                                ? "text-white font-medium"
                                : unread > 0
                                ? "text-white font-medium"
                                : "text-gray-200"
                            }`}
                          >
                            {c.title}
                          </div>
                          <div className="text-[11px] text-gray-500 shrink-0">
                            {formatRelativeTime(c.updatedAt)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <div
                            className={`text-[12.5px] truncate flex-1 ${
                              isTyping
                                ? "text-cyan-400 italic"
                                : unread > 0
                                ? "text-gray-200"
                                : "text-gray-500"
                            }`}
                          >
                            {isTyping ? "typing…" : snip.text}
                          </div>
                          {unread > 0 && !isActive && (
                            <span className="shrink-0 min-w-[18px] h-[18px] px-1.5 rounded-full bg-cyan-500 text-[11px] font-semibold text-[#0a0a0f] flex items-center justify-center">
                              {unread > 99 ? "99+" : unread}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(c.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 focus-visible:opacity-100 text-gray-500 hover:text-red-400 p-2 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/40 transition-opacity"
                      aria-label={`Delete conversation: ${c.title}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-white/5 px-2 py-2 flex flex-col gap-0.5">
        <div className="flex items-center gap-2 px-3 py-1 text-[11px] text-gray-500">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isConnected ? "bg-emerald-400" : "bg-amber-400"
            }`}
          />
          <span>{isConnected ? "Connected" : "Reconnecting…"}</span>
        </div>
        <button
          type="button"
          onClick={onOpenSettings}
          className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 text-left text-gray-300 hover:text-white transition-colors"
        >
          <SettingsIcon size={15} />
          <span className="text-[13px]">Settings</span>
        </button>
        <button
          type="button"
          onClick={onOpenAccount}
          className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 text-left text-gray-300 hover:text-white transition-colors"
        >
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-500/30 to-cyan-800/40 border border-cyan-500/20 flex items-center justify-center text-[11px] text-cyan-100">
            {(displayName || "").trim().charAt(0).toUpperCase() || (
              <User size={12} />
            )}
          </div>
          <span className="text-[13px] truncate">
            {displayName.trim() || "My Account"}
          </span>
        </button>
      </div>
    </aside>
  );
}

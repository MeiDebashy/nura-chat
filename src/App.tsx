import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Send,
  Menu,
  Plus,
  MessageSquare,
  Trash2,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  Settings as SettingsIcon,
  User,
  AlertTriangle,
} from "lucide-react";
import { NuraLogo } from "./components/NuraLogo";
import { SettingsModal, AccountModal, type Tone } from "./components/Modals";
import type { Conversation, Message, ServerMsg } from "./lib/types";
import {
  STORAGE_KEY,
  NAME_KEY,
  TONE_KEY,
  MEMBER_KEY,
  USER_ID_KEY,
  loadConversations,
  saveConversations,
} from "./lib/storage";
import { uuid } from "./lib/uuid";

const API_URL = (
  import.meta.env.VITE_API_URL ||
  "https://nura-emotional-core-production.up.railway.app"
).replace(/\/+$/, "");
const WS_URL = API_URL.replace(/^http/, "ws") + "/ws";

const MAX_TITLE_LEN = 42;
const MAX_INPUT_HEIGHT = 180;
const MAX_MESSAGE_LEN = 4000;
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30000;

const SUGGESTIONS = ["How are you?", "I need to talk", "I'm feeling anxious"];

// ── Local persistence helpers ────────────────────────────────────────────

function getUserId(): string {
  let id = localStorage.getItem(USER_ID_KEY);
  if (!id) {
    id = uuid();
    localStorage.setItem(USER_ID_KEY, id);
  }
  return id;
}

function getMemberSince(): number {
  const raw = localStorage.getItem(MEMBER_KEY);
  if (raw) {
    const n = parseInt(raw, 10);
    if (!Number.isNaN(n)) return n;
  }
  const now = Date.now();
  localStorage.setItem(MEMBER_KEY, String(now));
  return now;
}

function loadDisplayName(): string {
  return localStorage.getItem(NAME_KEY) ?? "";
}

function loadTone(): Tone {
  const v = localStorage.getItem(TONE_KEY);
  if (v === "gentle" || v === "direct" || v === "playful") return v;
  return "gentle";
}

function titleFromText(text: string): string {
  const cleaned = text.trim().replace(/\s+/g, " ");
  if (cleaned.length <= MAX_TITLE_LEN) return cleaned;
  return cleaned.slice(0, MAX_TITLE_LEN - 1).trimEnd() + "…";
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (diff < 60_000) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d`;
  return new Date(ts).toLocaleDateString();
}

const NuraAvatar = ({ size = "sm" }: { size?: "sm" | "md" | "lg" }) => {
  const sizes = {
    sm: "w-7 h-7",
    md: "w-9 h-9",
    lg: "w-12 h-12",
  };
  return (
    <div
      className={`relative flex items-center justify-center shrink-0 ${sizes[size]}`}
    >
      <div className="rounded-full bg-cyan-950/40 border border-cyan-500/30 shadow-[0_0_12px_rgba(0,212,255,0.25)] flex items-center justify-center overflow-hidden w-full h-full">
        <div className="w-full h-full bg-gradient-to-tr from-cyan-600/20 to-cyan-300/40 blur-[2px]" />
      </div>
    </div>
  );
};

export default function App() {
  const [conversations, setConversations] = useState<Conversation[]>(() =>
    loadConversations()
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  // typingForId: the conversation id that has a reply in flight (or null).
  // Keeping it scoped per-conversation prevents dots from following the user
  // when they switch chats mid-reply.
  const [typingForId, setTypingForId] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [displayName, setDisplayName] = useState<string>(() =>
    loadDisplayName()
  );
  const [tone, setTone] = useState<Tone>(() => loadTone());
  const [activeModal, setActiveModal] = useState<
    "settings" | "account" | null
  >(null);
  const [memberSince] = useState<number>(() => getMemberSince());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const userIdRef = useRef(getUserId());
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );
  const reconnectAttempts = useRef(0);
  const isUnmountingRef = useRef(false);
  const replyTargetIdRef = useRef<string | null>(null);
  const displayNameRef = useRef(displayName);
  const toneRef = useRef(tone);
  const prevActiveIdRef = useRef<string | null>(null);

  useEffect(() => {
    displayNameRef.current = displayName;
  }, [displayName]);
  useEffect(() => {
    toneRef.current = tone;
  }, [tone]);

  const active = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId]
  );
  const messages = active?.messages ?? [];

  const sortedConversations = useMemo(
    () => [...conversations].sort((a, b) => b.updatedAt - a.updatedAt),
    [conversations]
  );

  // Persist conversations whenever they change
  useEffect(() => {
    saveConversations(conversations);
  }, [conversations]);

  // Persist display name (debounced) and tone
  useEffect(() => {
    const t = setTimeout(() => {
      localStorage.setItem(NAME_KEY, displayName);
    }, 250);
    return () => clearTimeout(t);
  }, [displayName]);
  useEffect(() => {
    localStorage.setItem(TONE_KEY, tone);
  }, [tone]);

  const messageCount = useMemo(
    () => conversations.reduce((sum, c) => sum + c.messages.length, 0),
    [conversations]
  );

  // Scroll to bottom on new messages — smooth when the same conversation
  // grows, instant when switching conversations.
  useEffect(() => {
    const switched = prevActiveIdRef.current !== activeId;
    prevActiveIdRef.current = activeId;
    messagesEndRef.current?.scrollIntoView({
      behavior: switched ? "auto" : "smooth",
    });
  }, [messages.length, typingForId, activeId]);

  // Auto-grow textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, MAX_INPUT_HEIGHT) + "px";
  }, [inputValue]);

  // WebSocket connection
  const connectWs = useCallback(() => {
    if (isUnmountingRef.current) return;
    const existing = wsRef.current;
    if (
      existing &&
      (existing.readyState === WebSocket.OPEN ||
        existing.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    let ws: WebSocket;
    try {
      ws = new WebSocket(WS_URL);
    } catch (err) {
      console.error("[nura] WebSocket construction failed:", err);
      scheduleReconnect();
      return;
    }
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectAttempts.current = 0;
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      let data: ServerMsg;
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }

      if (data.type === "typing") {
        // server announces typing; mark the conversation that has a reply in flight
        if (replyTargetIdRef.current) {
          setTypingForId(replyTargetIdRef.current);
        }
      } else if (data.type === "segment" && typeof data.text === "string") {
        const targetId = replyTargetIdRef.current;
        if (!targetId) return;
        const newMsg: Message = {
          id: uuid(),
          text: data.text,
          sender: "nura",
          timestamp: Date.now(),
        };
        setConversations((prev) =>
          prev.map((c) =>
            c.id === targetId
              ? {
                  ...c,
                  messages: [...c.messages, newMsg],
                  updatedAt: Date.now(),
                }
              : c
          )
        );
      } else if (data.type === "done") {
        setTypingForId(null);
        replyTargetIdRef.current = null;
      } else if (data.type === "error") {
        setTypingForId(null);
        replyTargetIdRef.current = null;
        setSendError(data.message ?? "Server error");
        console.error("[nura] Server error:", data.message);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      scheduleReconnect();
    };

    ws.onerror = () => {
      // Don't call ws.close() here — onclose fires regardless. Calling close()
      // can re-trigger error and stack reconnects.
    };
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (isUnmountingRef.current) return;
    clearTimeout(reconnectTimer.current);
    const attempt = ++reconnectAttempts.current;
    const delay = Math.min(
      RECONNECT_MAX_MS,
      RECONNECT_BASE_MS * 2 ** Math.min(attempt - 1, 6)
    );
    const jitter = Math.random() * 250;
    reconnectTimer.current = setTimeout(connectWs, delay + jitter);
  }, [connectWs]);

  useEffect(() => {
    isUnmountingRef.current = false;
    connectWs();
    return () => {
      isUnmountingRef.current = true;
      clearTimeout(reconnectTimer.current);
      const ws = wsRef.current;
      if (ws) {
        // Detach handlers so a stale onclose doesn't schedule a reconnect.
        ws.onopen = null;
        ws.onmessage = null;
        ws.onclose = null;
        ws.onerror = null;
        ws.close();
      }
    };
  }, [connectWs]);

  const sendToServer = useCallback(
    (messageText: string, targetId: string) => {
      const payload = {
        type: "chat" as const,
        userId: userIdRef.current,
        message: messageText,
        displayName: displayNameRef.current || undefined,
        tone: toneRef.current,
        timestamp: new Date().toISOString(),
      };

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(JSON.stringify(payload));
          return;
        } catch (err) {
          console.error("[nura] WS send failed, falling back to REST:", err);
        }
      }

      // REST fallback
      fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: payload.message,
          userId: payload.userId,
          displayName: payload.displayName,
          tone: payload.tone,
          timestamp: payload.timestamp,
        }),
      })
        .then(async (res) => {
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
          }
          return res.json();
        })
        .then((data) => {
          // Only commit if this is still the current pending reply.
          if (replyTargetIdRef.current !== targetId) return;
          setTypingForId(null);
          replyTargetIdRef.current = null;
          if (!data?.segments || !Array.isArray(data.segments)) return;
          const now = Date.now();
          const nuraMessages: Message[] = data.segments.map(
            (seg: string | { text: string }) => ({
              id: uuid(),
              text: typeof seg === "string" ? seg : seg.text,
              sender: "nura" as const,
              timestamp: now,
            })
          );
          setConversations((prev) =>
            prev.map((c) =>
              c.id === targetId
                ? {
                    ...c,
                    messages: [...c.messages, ...nuraMessages],
                    updatedAt: now,
                  }
                : c
            )
          );
        })
        .catch((err) => {
          if (replyTargetIdRef.current === targetId) {
            setTypingForId(null);
            replyTargetIdRef.current = null;
          }
          setSendError(
            "Couldn't reach Nura. Check your connection and try again."
          );
          console.error("[nura] REST fallback error:", err);
        });
    },
    []
  );

  const handleSend = (text?: string) => {
    const raw = (text ?? inputValue).trim();
    if (!raw) return;
    if (typingForId !== null) return; // wait for current reply

    // Hard cap to avoid runaway payloads.
    const messageText = raw.slice(0, MAX_MESSAGE_LEN);
    setSendError(null);

    const now = Date.now();
    const userMsg: Message = {
      id: uuid(),
      text: messageText,
      sender: "user",
      timestamp: now,
    };

    let targetId = activeId;
    if (!targetId) {
      targetId = uuid();
      const newConv: Conversation = {
        id: targetId,
        title: titleFromText(messageText),
        messages: [userMsg],
        createdAt: now,
        updatedAt: now,
      };
      setConversations((prev) => [newConv, ...prev]);
      setActiveId(targetId);
    } else {
      const tid = targetId;
      setConversations((prev) =>
        prev.map((c) =>
          c.id === tid
            ? {
                ...c,
                title:
                  c.messages.length === 0 ? titleFromText(messageText) : c.title,
                messages: [...c.messages, userMsg],
                updatedAt: now,
              }
            : c
        )
      );
    }

    replyTargetIdRef.current = targetId;
    setTypingForId(targetId);
    setInputValue("");
    sendToServer(messageText, targetId);
  };

  const handleNewChat = () => {
    // Don't drop a pending reply: if one is in flight, just navigate away
    // without resetting typing state — the reply still belongs to the
    // conversation it was sent from.
    setActiveId(null);
    setInputValue("");
    setIsSidebarOpen(false);
    setSendError(null);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const handleSelectConversation = (id: string) => {
    setActiveId(id);
    setIsSidebarOpen(false);
    setSendError(null);
  };

  const handleDeleteConversation = (id: string) => {
    const target = conversations.find((c) => c.id === id);
    const ok = window.confirm(
      `Delete "${target?.title ?? "this conversation"}"? This can't be undone.`
    );
    if (!ok) return;
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeId === id) setActiveId(null);
    if (replyTargetIdRef.current === id) {
      replyTargetIdRef.current = null;
      setTypingForId(null);
    }
  };

  const handleClearAll = () => {
    if (conversations.length === 0) return;
    const ok = window.confirm(
      `Delete all ${conversations.length} conversation${
        conversations.length === 1 ? "" : "s"
      }? This can't be undone.`
    );
    if (!ok) return;
    setConversations([]);
    setActiveId(null);
    replyTargetIdRef.current = null;
    setTypingForId(null);
  };

  const handleExport = () => {
    if (conversations.length === 0) return;
    const data = {
      exportedAt: new Date().toISOString(),
      // userId intentionally omitted — exports shouldn't leak identity.
      displayName,
      tone,
      conversations,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nura-chats-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleResetAll = () => {
    const ok = window.confirm(
      "Reset everything? This deletes all conversations, your name, and your user ID. This can't be undone."
    );
    if (!ok) return;
    [STORAGE_KEY, NAME_KEY, TONE_KEY, MEMBER_KEY, USER_ID_KEY].forEach((k) =>
      localStorage.removeItem(k)
    );
    window.location.reload();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isReplyForActive = typingForId !== null && typingForId === activeId;

  return (
    <div className="flex h-[100dvh] w-full bg-[#0a0a0f] text-gray-100 font-sans overflow-hidden selection:bg-cyan-500/30">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
        fixed md:relative inset-y-0 left-0 z-50 h-full bg-[#0a0a0f] md:bg-[#0a0a0f]/50 border-r border-white/5 transition-all duration-300 ease-in-out shrink-0
        ${isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        ${
          isDesktopSidebarOpen
            ? "w-[280px] md:w-[260px]"
            : "w-[280px] md:w-0 md:-ml-[260px] md:border-none"
        }
      `}
      >
        <div className="w-[280px] md:w-[260px] h-full flex flex-col p-4 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between mb-8 md:mb-6">
            <div className="flex items-center gap-3 md:gap-2">
              <NuraAvatar size="sm" />
              <span className="text-white font-medium tracking-widest text-[14px]">
                NURA
              </span>
            </div>
            <div className="flex items-center md:hidden">
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="text-gray-400 hover:text-white p-1"
                aria-label="Close sidebar"
              >
                <X size={20} />
              </button>
            </div>
            <div className="hidden md:flex">
              <button
                onClick={() => setIsDesktopSidebarOpen(false)}
                className="text-gray-400 hover:text-white p-1 rounded-md hover:bg-white/5 transition-colors"
                aria-label="Collapse sidebar"
              >
                <PanelLeftClose size={18} />
              </button>
            </div>
          </div>

          {/* New Chat Button */}
          <button
            onClick={handleNewChat}
            className="flex items-center gap-2 w-full py-2.5 px-3 rounded-lg border border-cyan-500/30 text-cyan-50 hover:bg-cyan-500/10 transition-colors text-[14px] font-medium mb-6 shadow-[0_0_15px_rgba(0,212,255,0.05)]"
          >
            <Plus size={16} className="text-cyan-400" />
            New Chat
          </button>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar -mx-2 px-2">
            {sortedConversations.length > 0 && (
              <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-3 px-2">
                Recent
              </div>
            )}
            <div className="space-y-1">
              {sortedConversations.length === 0 && (
                <div className="text-[12px] text-gray-500 px-2 py-6 text-center leading-relaxed">
                  No conversations yet.
                  <br />
                  Start by sending a message.
                </div>
              )}
              {sortedConversations.map((conv) => {
                const isActive = conv.id === activeId;
                return (
                  <div
                    key={conv.id}
                    className={`group relative flex items-center gap-2 rounded-lg transition-colors ${
                      isActive
                        ? "bg-cyan-500/10 border border-cyan-500/20"
                        : "border border-transparent hover:bg-white/5"
                    }`}
                  >
                    <button
                      onClick={() => handleSelectConversation(conv.id)}
                      className="flex-1 flex items-center gap-3 px-2 py-2.5 text-left min-w-0"
                    >
                      <MessageSquare
                        size={16}
                        className={`shrink-0 transition-colors ${
                          isActive
                            ? "text-cyan-400"
                            : "text-gray-500 group-hover:text-cyan-400/70"
                        }`}
                      />
                      <div className="flex-1 overflow-hidden">
                        <div
                          className={`text-[13px] truncate ${
                            isActive ? "text-white" : "text-gray-300"
                          }`}
                        >
                          {conv.title}
                        </div>
                        <div className="text-[11px] text-gray-500">
                          {formatRelativeTime(conv.updatedAt)}
                          {typingForId === conv.id && (
                            <span className="ml-1 text-cyan-400">· typing</span>
                          )}
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteConversation(conv.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-gray-500 hover:text-red-400 p-2 mr-1 rounded transition-opacity"
                      aria-label="Delete conversation"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="mt-auto pt-4 border-t border-white/5 flex flex-col gap-1">
            <div className="flex items-center gap-2 px-2 pb-2 text-[11px] text-gray-500">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isConnected ? "bg-emerald-400" : "bg-gray-600"
                }`}
              />
              <span>{isConnected ? "Connected" : "Reconnecting…"}</span>
            </div>
            <button
              onClick={() => {
                setActiveModal("settings");
                setIsSidebarOpen(false);
              }}
              className="flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-white/5 transition-colors text-left w-full text-gray-400 hover:text-gray-200"
            >
              <SettingsIcon size={16} />
              <span className="text-[13px]">Settings</span>
            </button>
            <button
              onClick={() => {
                setActiveModal("account");
                setIsSidebarOpen(false);
              }}
              className="flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-white/5 transition-colors text-left w-full text-gray-400 hover:text-gray-200"
            >
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-500/30 to-cyan-800/40 border border-cyan-500/20 flex items-center justify-center shrink-0 text-[11px] text-cyan-100">
                {(displayName || "").trim().charAt(0).toUpperCase() || (
                  <User size={12} />
                )}
              </div>
              <span className="text-[13px] truncate">
                {displayName.trim() || "My Account"}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col relative min-w-0 bg-[#0a0a0f]">
        {/* Subtle Background Noise/Gradient */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30 mix-blend-screen z-0">
          <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-cyan-900/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-900/10 rounded-full blur-[120px]" />
        </div>

        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-[#0a0a0f]/80 backdrop-blur-xl border-b border-white/5 z-20 shrink-0">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 -ml-2 text-gray-400 hover:text-white"
            aria-label="Open sidebar"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="relative flex items-center justify-center">
              <NuraAvatar size="sm" />
              <div
                className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-[2px] border-[#0a0a0f] ${
                  isConnected ? "bg-[#10b981]" : "bg-gray-500"
                }`}
              />
            </div>
            <div className="flex flex-col">
              <h2 className="font-medium text-white text-[14px] leading-tight">
                Nura
              </h2>
            </div>
          </div>
          <button
            onClick={handleNewChat}
            className="p-2 -mr-2 text-gray-400 hover:text-white"
            aria-label="New chat"
          >
            <Plus size={20} />
          </button>
        </header>

        {/* Desktop Sidebar Toggle (Floating) */}
        <div className="hidden md:flex absolute top-4 left-4 z-20">
          {!isDesktopSidebarOpen && (
            <button
              onClick={() => setIsDesktopSidebarOpen(true)}
              className="p-2 text-gray-400 hover:text-white rounded-md hover:bg-white/5 transition-colors"
              aria-label="Open sidebar"
            >
              <PanelLeftOpen size={20} />
            </button>
          )}
        </div>

        {/* Chat Scroll Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6 w-full z-10 relative">
          <div className="max-w-[680px] mx-auto w-full h-full flex flex-col">
            {messages.length === 0 ? (
              /* Welcome State */
              <div className="flex-1 flex flex-col items-center justify-center pb-12 md:pb-24">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                  className="transform scale-[0.6] md:scale-100 -my-14 md:-my-4 pointer-events-none"
                >
                  <NuraLogo />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5, duration: 1 }}
                  className="text-center space-y-2 mt-2 md:mt-12"
                >
                  <h1 className="text-2xl md:text-3xl font-light text-white tracking-wide">
                    Hi, I'm Nura
                  </h1>
                  <p className="text-[14px] md:text-base text-gray-400 font-light tracking-wide">
                    your emotional companion
                  </p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8, duration: 1 }}
                  className="flex flex-col md:flex-row justify-center gap-3 mt-8 md:mt-12 w-full max-w-[280px] md:max-w-none"
                >
                  {SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => handleSend(suggestion)}
                      className="px-5 py-3 md:py-2.5 rounded-2xl md:rounded-full border border-cyan-500/20 bg-cyan-950/10 text-cyan-50 hover:bg-cyan-500/10 hover:border-cyan-500/40 transition-all text-[14px] md:text-[13px] font-light tracking-wide backdrop-blur-sm"
                    >
                      {suggestion}
                    </button>
                  ))}
                </motion.div>
              </div>
            ) : (
              /* Message List */
              <div className="space-y-6 md:space-y-8 pb-4 w-full">
                <AnimatePresence initial={false}>
                  {messages.map((message) => {
                    const isNura = message.sender === "nura";
                    return (
                      <motion.div
                        key={message.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex w-full ${
                          isNura ? "justify-start" : "justify-end"
                        }`}
                      >
                        {isNura && (
                          <div className="hidden md:flex mr-4 mt-0.5 shrink-0">
                            <NuraAvatar size="md" />
                          </div>
                        )}
                        <div
                          className={`
                          text-[15px] leading-relaxed max-w-[85%] md:max-w-[80%] whitespace-pre-wrap break-words
                          ${
                            isNura
                              ? "md:bg-transparent md:border-none md:shadow-none md:px-0 md:py-1.5 md:text-gray-200 md:backdrop-blur-none bg-[#12121f] border-l-[3px] border-cyan-500/40 shadow-[-4px_0_20px_rgba(0,212,255,0.03)] rounded-2xl rounded-tl-sm px-4 py-3 backdrop-blur-sm text-gray-100"
                              : "bg-[#1a1a2e] text-white rounded-2xl rounded-tr-sm shadow-sm px-4 py-3 md:px-5 md:py-3.5 md:rounded-3xl md:rounded-tr-sm"
                          }
                        `}
                        >
                          {message.text}
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>

                {/* Typing Indicator */}
                {isReplyForActive && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex w-full justify-start"
                  >
                    <div className="hidden md:flex mr-4 mt-0.5 shrink-0">
                      <NuraAvatar size="md" />
                    </div>
                    <div className="md:bg-transparent md:border-none md:shadow-none md:px-0 md:py-3 md:backdrop-blur-none bg-[#12121f] border-l-[3px] border-cyan-500/40 shadow-[-4px_0_20px_rgba(0,212,255,0.03)] rounded-2xl rounded-tl-sm px-4 py-4 flex gap-1.5 items-center backdrop-blur-sm">
                      <motion.div
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1.4, repeat: Infinity, delay: 0 }}
                        className="w-1.5 h-1.5 rounded-full bg-cyan-400"
                      />
                      <motion.div
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1.4, repeat: Infinity, delay: 0.2 }}
                        className="w-1.5 h-1.5 rounded-full bg-cyan-400"
                      />
                      <motion.div
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1.4, repeat: Infinity, delay: 0.4 }}
                        className="w-1.5 h-1.5 rounded-full bg-cyan-400"
                      />
                    </div>
                  </motion.div>
                )}
                <div ref={messagesEndRef} className="h-1" />
              </div>
            )}
          </div>
        </div>

        {/* Input Area */}
        <div className="w-full shrink-0 p-4 md:px-6 md:pb-6 md:pt-2 bg-gradient-to-t from-[#0a0a0f] via-[#0a0a0f] to-transparent z-20">
          <div className="max-w-[680px] mx-auto">
            {sendError && (
              <div
                role="alert"
                className="mb-3 flex items-start gap-2 px-3 py-2 rounded-lg border border-red-500/30 bg-red-500/10 text-[13px] text-red-200"
              >
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                <span className="flex-1">{sendError}</span>
                <button
                  onClick={() => setSendError(null)}
                  className="text-red-300/70 hover:text-red-100"
                  aria-label="Dismiss error"
                >
                  <X size={14} />
                </button>
              </div>
            )}
            <div className="relative flex items-end bg-[#151523] rounded-[24px] md:rounded-[28px] border border-white/5 focus-within:border-cyan-500/30 focus-within:bg-[#1a1a2e] transition-all duration-300 shadow-[0_0_20px_rgba(0,0,0,0.5)]">
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) =>
                  setInputValue(e.target.value.slice(0, MAX_MESSAGE_LEN))
                }
                onKeyDown={handleKeyDown}
                placeholder="Message Nura…"
                rows={1}
                maxLength={MAX_MESSAGE_LEN}
                className="nura-input flex-1 bg-transparent pl-5 md:pl-6 pr-2 py-3.5 md:py-4 text-[15px] text-white placeholder-gray-500 outline-none w-full leading-relaxed max-h-[180px]"
              />
              <button
                onClick={() => handleSend()}
                disabled={!inputValue.trim() || typingForId !== null}
                className="p-2.5 md:p-3 mr-1.5 md:mr-2 mb-1.5 md:mb-1.5 rounded-full bg-cyan-500 hover:bg-cyan-400 disabled:opacity-30 disabled:hover:bg-cyan-500 text-[#0a0a0f] transition-all flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(0,212,255,0.4)] disabled:shadow-none"
                aria-label="Send message"
              >
                <Send size={18} className="ml-0.5" />
              </button>
            </div>
            <p className="text-center text-[12px] text-gray-500 mt-3 hidden md:block tracking-wide">
              Nura is here to listen and support you · Enter to send, Shift+Enter
              for newline
            </p>
          </div>
        </div>
      </div>

      <SettingsModal
        open={activeModal === "settings"}
        onClose={() => setActiveModal(null)}
        displayName={displayName}
        onDisplayNameChange={setDisplayName}
        tone={tone}
        onToneChange={setTone}
        onExport={handleExport}
        onClearHistory={handleClearAll}
        hasHistory={conversations.length > 0}
        isConnected={isConnected}
      />
      <AccountModal
        open={activeModal === "account"}
        onClose={() => setActiveModal(null)}
        displayName={displayName}
        onDisplayNameChange={setDisplayName}
        userId={userIdRef.current}
        memberSince={memberSince}
        conversationCount={conversations.length}
        messageCount={messageCount}
        onResetAll={handleResetAll}
      />
    </div>
  );
}
